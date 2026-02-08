import { supabase } from "@/integrations/supabase/client";
import { getWordCount, getQuestionCountForIntentReshare } from "@/lib/gate-utils";
import { withSessionGuard } from "@/lib/sessionGuard";

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
 * WRAPPED with sessionGuard for post-background stability
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
      
      // Wrap Edge Function call with sessionGuard
      const qaData = await withSessionGuard(async () => {
        const { data, error } = await supabase.functions.invoke(
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
        
        if (error) {
          console.error('[runGateBeforeAction] Intent QA generation error:', error);
          throw new Error(error.message || 'Failed to generate questions');
        }
        
        return data;
      }, { label: 'runGateBeforeAction_intent' });

      console.log('[runGateBeforeAction] Intent QA response:', { qaData });

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
    // Wrap both Edge Function calls with sessionGuard

    // 1. Fetch article preview
    const previewData = await withSessionGuard(async () => {
      const { data, error } = await supabase.functions.invoke(
        'fetch-article-preview',
        { body: { url: linkUrl } }
      );
      
      if (error || !data?.success) {
        const errorMsg = data?.error || error?.message || 'Failed to fetch article preview';
        console.error('[runGateBeforeAction] Preview fetch failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      return data;
    }, { label: 'runGateBeforeAction_preview' });

    console.log('[runGateBeforeAction] Preview response:', { previewData });

    const articleContent = previewData.content;
    console.log('[runGateBeforeAction] Article content length:', articleContent?.length);

    // 2. Generate QA with correct parameters - use qaSourceRef for server-side fetching
    const qaPayload = { 
      title: previewData.title || 'Contenuto condiviso',
      qaSourceRef: previewData.qaSourceRef || { kind: 'url' as const, id: linkUrl, url: linkUrl },
      excerpt: '',
      type: 'article',
      sourceUrl: linkUrl,
      isPrePublish: true,
      forceRefresh // Pass forceRefresh for retry
    };
    
    console.log('[runGateBeforeAction] Calling generate-qa with payload:', qaPayload);

    const qaData = await withSessionGuard(async () => {
      const { data, error } = await supabase.functions.invoke(
        'generate-qa',
        { body: qaPayload }
      );
      
      if (error) {
        console.error('[runGateBeforeAction] QA generation error:', error);
        throw new Error(error.message || 'Failed to generate questions');
      }
      
      return data;
    }, { label: 'runGateBeforeAction_qa' });

    console.log('[runGateBeforeAction] QA response:', { qaData });

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
