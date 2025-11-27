import { supabase } from '@/integrations/supabase/client';

/**
 * Incrementa il cognitive_density dell'utente per una specifica categoria
 * Viene chiamato dopo il completamento con successo di un Cognitive Journey
 */
export async function updateCognitiveDensity(userId: string, category: string) {
  if (!userId || !category) {
    console.error('[cognitiveDensity] Missing userId or category');
    return;
  }

  try {
    // 1. Leggi il profilo attuale
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('cognitive_density')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('[cognitiveDensity] Error fetching profile:', fetchError);
      return;
    }

    // 2. Incrementa il contatore per la categoria
    const currentDensity = (profile?.cognitive_density as Record<string, number>) || {};
    const newDensity = {
      ...currentDensity,
      [category]: (currentDensity[category] || 0) + 1
    };

    // 3. Aggiorna il profilo
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ cognitive_density: newDensity })
      .eq('id', userId);

    if (updateError) {
      console.error('[cognitiveDensity] Error updating profile:', updateError);
      return;
    }

    console.log(`[cognitiveDensity] Updated ${category}: ${newDensity[category]}`);
  } catch (error) {
    console.error('[cognitiveDensity] Unexpected error:', error);
  }
}
