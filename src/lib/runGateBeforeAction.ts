import { supabase } from "@/integrations/supabase/client";
import { getWordCount, getQuestionCountForIntentReshare } from "@/lib/gate-utils";

interface GateOptions {
  linkUrl: string;
  onSuccess: () => void;
  onCancel: () => void;
  setIsProcessing?: (processing: boolean) => void;
  setQuizData?: (data: any) => void;
  setShowQuiz?: (show: boolean) => void;
  // Intent post reshare: use original text as source
  intentPostContent?: string;
  // NEW: Force cache invalidation for retry flows
  forceRefresh?: boolean;
}

/**
 * Helper per eseguire il Comprehension Gate™ prima di un'azione
 * Usato per commenti con link e messaggi con link
 */
export async function runGateBeforeAction({
  linkUrl,
  onSuccess,
  onCancel,
  setIsProcessing,
  setQuizData,
  setShowQuiz,
  intentPostContent,
  forceRefresh
}: GateOptions): Promise<void> {
  try {
    if (setIsProcessing) setIsProcessing(true);

    console.log('[runGateBeforeAction] Starting gate for URL:', linkUrl, 'isIntentReshare:', !!intentPostContent, 'forceRefresh:', !!forceRefresh);

    // INTENT POST RESHARE: Generate questions from original text, not from link
    if (intentPostContent) {
      console.log('[runGateBeforeAction] Intent reshare - using original text as source');
      
      const originalWordCount = getWordCount(intentPostContent);
      const questionCount = getQuestionCountForIntentReshare(originalWordCount);
      
      console.log('[runGateBeforeAction] Intent reshare:', { originalWordCount, questionCount });
      
      // Generate QA from the original post text (the "cognitive source")
      const { data: qaData, error: qaError } = await supabase.functions.invoke(
        'generate-qa',
        { 
          body: { 
            title: 'Contenuto condiviso',
            summary: intentPostContent,
            excerpt: '',
            type: 'article',
            isPrePublish: true,
            testMode: 'USER_ONLY', // All questions from user text
            questionCount: questionCount,
            forceRefresh // Pass forceRefresh for retry
          } 
        }
      );

      console.log('[runGateBeforeAction] Intent QA response:', { qaData, qaError });

      if (qaError) {
        console.error('[runGateBeforeAction] Intent QA generation error:', qaError);
        throw new Error(qaError.message || 'Failed to generate questions');
      }

      if (!qaData?.questions || !Array.isArray(qaData.questions)) {
        console.error('[runGateBeforeAction] Invalid Intent questions format:', qaData);
        throw new Error('Formato domande non valido');
      }

      console.log('[runGateBeforeAction] Intent - Successfully generated', qaData.questions.length, 'questions');

      // Show quiz modal
      if (setQuizData && setShowQuiz) {
        setQuizData({
          qaId: qaData.qaId,
          questions: qaData.questions,
          sourceUrl: linkUrl,
          onSuccess,
          onCancel
        });
        setShowQuiz(true);
      } else {
        onSuccess();
      }
      return;
    }

    // STANDARD FLOW: Fetch article preview and generate questions from source

    // 1. Fetch article preview
    const { data: previewData, error: previewError } = await supabase.functions.invoke(
      'fetch-article-preview',
      { body: { url: linkUrl } }
    );

    console.log('[runGateBeforeAction] Preview response:', { previewData, previewError });

    if (previewError || !previewData?.success) {
      const errorMsg = previewData?.error || previewError?.message || 'Failed to fetch article preview';
      console.error('[runGateBeforeAction] Preview fetch failed:', errorMsg);
      throw new Error(errorMsg);
    }

    const articleContent = previewData.content;
    console.log('[runGateBeforeAction] Article content length:', articleContent?.length);

    // 2. Generate QA with correct parameters - use qaSourceRef for server-side fetching
    // FIX: Use qaSourceRef instead of legacy summary mode to ensure proper content extraction
    const qaPayload = { 
      title: previewData.title || 'Contenuto condiviso',
      // Use qaSourceRef from preview if available, otherwise construct fallback
      qaSourceRef: previewData.qaSourceRef || { kind: 'url' as const, id: linkUrl, url: linkUrl },
      excerpt: '',
      type: 'article',
      sourceUrl: linkUrl,
      isPrePublish: true,
      forceRefresh // Pass forceRefresh for retry
    };
    
    console.log('[runGateBeforeAction] Calling generate-qa with payload:', qaPayload);

    const { data: qaData, error: qaError } = await supabase.functions.invoke(
      'generate-qa',
      { body: qaPayload }
    );

    console.log('[runGateBeforeAction] QA response:', { qaData, qaError });

    if (qaError) {
      console.error('[runGateBeforeAction] QA generation error:', qaError);
      throw new Error(qaError.message || 'Failed to generate questions');
    }

    if (!qaData) {
      console.error('[runGateBeforeAction] No QA data returned');
      throw new Error('Nessuna risposta dal servizio');
    }

    // NEW: Check for validation errors
    if (qaData.error_code) {
      console.log('[runGateBeforeAction] Content validation failed:', qaData.error_code);
      if (setQuizData && setShowQuiz) {
        setQuizData({
          errorState: {
            code: qaData.error_code,
            message: qaData.message || 'Analisi non ottimale'
          },
          onRetry: () => runGateBeforeAction({ 
            linkUrl, 
            onSuccess, 
            onCancel, 
            setIsProcessing, 
            setQuizData, 
            setShowQuiz,
            intentPostContent,
            forceRefresh: true // Retry with cache clear
          }),
          onCancel
        });
        setShowQuiz(true);
      }
      if (setIsProcessing) setIsProcessing(false);
      return;
    }

    if (qaData.insufficient_context) {
      console.log('[runGateBeforeAction] Insufficient context');
      throw new Error('Contenuto insufficiente per generare il quiz');
    }

    if (qaData.error) {
      console.error('[runGateBeforeAction] QA data contains error:', qaData.error);
      throw new Error(qaData.error);
    }

    if (!qaData.questions || !Array.isArray(qaData.questions)) {
      console.error('[runGateBeforeAction] Invalid questions format:', qaData);
      throw new Error('Formato domande non valido');
    }

    console.log('[runGateBeforeAction] Successfully generated', qaData.questions.length, 'questions');

    // 3. Show quiz modal
    if (setQuizData && setShowQuiz) {
      // SECURITY HARDENED: Always save qaId from server for submit-qa validation
      setQuizData({
        qaId: qaData.qaId, // Server-generated qaId for secure validation
        questions: qaData.questions,
        sourceUrl: linkUrl,
        onSuccess,
        onCancel
      });
      setShowQuiz(true);
    } else {
      // Fallback: se non abbiamo il modal setup, procedi direttamente
      onSuccess();
    }
  } catch (error) {
    console.error('[runGateBeforeAction] Gate error:', error);
    // Mostra errore tramite setQuizData per renderlo più integrato
    if (setQuizData && setShowQuiz) {
      setQuizData({
        error: true,
        errorMessage: error instanceof Error ? error.message : 'Impossibile verificare il contenuto. Riprova.',
        onCancel
      });
      setShowQuiz(true);
    } else {
      onCancel();
    }
  } finally {
    if (setIsProcessing) setIsProcessing(false);
  }
}
