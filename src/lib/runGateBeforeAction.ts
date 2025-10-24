import { supabase } from "@/integrations/supabase/client";

interface GateOptions {
  linkUrl: string;
  onSuccess: () => void;
  onCancel: () => void;
  setIsProcessing?: (processing: boolean) => void;
  setQuizData?: (data: any) => void;
  setShowQuiz?: (show: boolean) => void;
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
  setShowQuiz
}: GateOptions): Promise<void> {
  try {
    if (setIsProcessing) setIsProcessing(true);

    // 1. Fetch article preview
    const { data: previewData, error: previewError } = await supabase.functions.invoke(
      'fetch-article-preview',
      { body: { url: linkUrl } }
    );

    if (previewError || !previewData?.success) {
      throw new Error(previewData?.error || 'Failed to fetch article preview');
    }

    const articleContent = previewData.content;

    // 2. Generate QA
    const { data: qaData, error: qaError } = await supabase.functions.invoke(
      'generate-qa',
      { body: { content: articleContent, sourceUrl: linkUrl } }
    );

    if (qaError || !qaData?.success) {
      throw new Error(qaData?.error || 'Failed to generate questions');
    }

    // 3. Show quiz modal
    if (setQuizData && setShowQuiz) {
      setQuizData({
        questions: qaData.questions,
        correctAnswers: qaData.correctAnswers,
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
    console.error('Gate error:', error);
    // Mostra errore tramite setQuizData per renderlo più integrato
    if (setQuizData && setShowQuiz) {
      setQuizData({
        error: true,
        errorMessage: 'Impossibile verificare il contenuto. Riprova.',
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
