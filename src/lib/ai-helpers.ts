import { supabase } from "@/integrations/supabase/client";

export interface QuizQuestion {
  id: string;
  stem: string;
  choices: Array<{
    id: string;
    text: string;
  }>;
  correctId: string;
}

export interface QAGenerationResult {
  questions?: QuizQuestion[];
  insufficient_context?: boolean;
  error?: string;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  total: number;
  wrongIndexes: string[];
  completionTime?: number;
}

/**
 * Genera Q&A per un contenuto usando Lovable AI
 */
export async function generateQA(params: {
  contentId: string | null;
  isPrePublish?: boolean;
  title?: string;
  summary: string;
  userText?: string;
  excerpt?: string;
  type?: 'article' | 'video' | 'audio' | 'image';
  sourceUrl?: string;
  testMode?: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY';
  questionCount?: 1 | 3;
}): Promise<QAGenerationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-qa', {
      body: params
    });

    if (error) {
      console.error('Error generating Q&A:', error);
      // Check if it's a payment error
      if (error.message?.includes('Crediti') || error.message?.includes('402')) {
        return { error: 'Crediti Lovable AI esauriti' };
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error generating Q&A:', error);
    return { error: error.message };
  }
}

/**
 * Valida le risposte dell'utente
 */
export async function validateAnswers(params: {
  postId: string | null;
  sourceUrl?: string;
  answers: Record<string, string>;
  gateType: 'share' | 'composer';
}): Promise<ValidationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-answers', {
      body: {
        postId: params.postId,
        sourceUrl: params.sourceUrl,
        answers: params.answers,
        gateType: params.gateType
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error validating answers:', error);
    throw error;
  }
}

/**
 * Fetch preview metadata da URL
 */
export async function fetchArticlePreview(url: string) {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-article-preview', {
      body: { url }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching article preview:', error);
    return null;
  }
}

/**
 * Verifica se un utente ha già superato il gate per un post
 */
export async function checkGatePassed(postId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('post_gate_attempts')
      .select('passed')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('passed', true)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking gate status:', error);
    return false;
  }
}

/**
 * Classifica il contenuto di un post in una delle macro-categorie
 */
export async function classifyContent(params: {
  text?: string;
  title?: string;
  summary?: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('classify-content', {
      body: params
    });

    if (error) {
      console.error('Error classifying content:', error);
      return null;
    }

    return data?.category || null;
  } catch (error) {
    console.error('Error classifying content:', error);
    return null;
  }
}

/**
 * Fetch YouTube transcript asynchronously (for client-side loading)
 * Returns transcript data or null if unavailable
 */
export async function fetchYouTubeTranscript(url: string): Promise<{
  transcript: string | null;
  source: string;
  error?: string;
}> {
  try {
    console.log('[fetchYouTubeTranscript] Fetching transcript for:', url);
    
    const { data, error } = await supabase.functions.invoke('transcribe-youtube', {
      body: { url }
    });

    if (error) {
      console.error('[fetchYouTubeTranscript] Error:', error);
      return { transcript: null, source: 'error', error: error.message };
    }

    console.log('[fetchYouTubeTranscript] Result:', {
      hasTranscript: !!data?.transcript,
      length: data?.transcript?.length || 0,
      source: data?.source
    });

    return {
      transcript: data?.transcript || null,
      source: data?.source || 'none',
      error: data?.error
    };
  } catch (error: any) {
    console.error('[fetchYouTubeTranscript] Exception:', error);
    return { transcript: null, source: 'error', error: error.message };
  }
}
