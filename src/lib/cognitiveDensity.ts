import { supabase } from '@/integrations/supabase/client';

// Costanti per i pesi delle azioni cognitive
export const COGNITIVE_WEIGHTS = {
  CREATE_POST: 1.0,      // Creare un nuovo post
  SHARE_POST: 0.8,       // Condividere/quotare un post esistente
  COMMENT_WITH_GATE: 0.7, // Commentare dopo aver superato il gate
  LIKE: 0.1              // Mettere like a un post
} as const;

export type CognitiveAction = keyof typeof COGNITIVE_WEIGHTS;

/**
 * @deprecated Phase 4.4: il sistema cognitive_density è stato refactored a vista derivata
 * (user_cognitive_density + RPC get_user_cognitive_density). Questa funzione non è più
 * chiamata da nessun call site. Lasciata per backward-compatibility temporanea.
 * Rimuovere completamente in Fase 4.5 dopo 30 giorni di stabilità.
 */
export async function updateCognitiveDensityWeighted(
  userId: string, 
  category: string,
  action: CognitiveAction
) {
  console.log('🧠 [cognitiveDensity] Called weighted with:', { userId, category, action });
  
  if (!userId || !category) {
    console.error('❌ [cognitiveDensity] Missing userId or category');
    return;
  }

  const weight = COGNITIVE_WEIGHTS[action];
  console.log(`⚖️ [cognitiveDensity] Action weight: ${weight}`);

  try {
    // 1. Leggi il profilo attuale (incluso cognitive_tracking_enabled)
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('cognitive_density, cognitive_tracking_enabled')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('❌ [cognitiveDensity] Error fetching profile:', fetchError);
      return;
    }

    // Check if tracking is disabled
    if (profile?.cognitive_tracking_enabled === false) {
      console.log('🚫 [cognitiveDensity] Tracking disabled for user, skipping update');
      return;
    }

    console.log('📊 [cognitiveDensity] Current density:', profile?.cognitive_density);

    // 2. Incrementa il contatore per la categoria con peso
    const currentDensity = (profile?.cognitive_density as Record<string, number>) || {};
    const newDensity = {
      ...currentDensity,
      [category]: (currentDensity[category] || 0) + weight
    };

    console.log('📈 [cognitiveDensity] New density:', newDensity);

    // 3. Aggiorna il profilo
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ cognitive_density: newDensity })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ [cognitiveDensity] Error updating profile:', updateError);
      return;
    }

    console.log(`✅ [cognitiveDensity] Updated ${category}: ${newDensity[category]} (${action}, +${weight})`);
  } catch (error) {
    console.error('❌ [cognitiveDensity] Unexpected error:', error);
  }
}

/**
 * @deprecated Phase 4.4: sistema density refactored a vista derivata. Non chiamare.
 * Rimuovere completamente in Fase 4.5 dopo 30 giorni di stabilità.
 */
export async function updateCognitiveDensity(userId: string, category: string) {
  console.log('🧠 [cognitiveDensity] Called with:', { userId, category });
  
  if (!userId || !category) {
    console.error('❌ [cognitiveDensity] Missing userId or category');
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
      console.error('❌ [cognitiveDensity] Error fetching profile:', fetchError);
      return;
    }

    console.log('📊 [cognitiveDensity] Current density:', profile?.cognitive_density);

    // 2. Incrementa il contatore per la categoria
    const currentDensity = (profile?.cognitive_density as Record<string, number>) || {};
    const newDensity = {
      ...currentDensity,
      [category]: (currentDensity[category] || 0) + 1
    };

    console.log('📈 [cognitiveDensity] New density:', newDensity);

    // 3. Aggiorna il profilo
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ cognitive_density: newDensity })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ [cognitiveDensity] Error updating profile:', updateError);
      return;
    }

    console.log(`✅ [cognitiveDensity] Updated ${category}: ${newDensity[category]}`);
  } catch (error) {
    console.error('❌ [cognitiveDensity] Unexpected error:', error);
  }
}

/**
 * @deprecated Phase 4.4: la density è ora derivata in tempo reale dalla vista materializzata
 * user_cognitive_density. Non serve più ricalcolare manualmente. Rimuovere in Fase 4.5.
 */
export async function recalculateCognitiveDensityFromPosts(userId: string) {
  console.log('🔄 [cognitiveDensity] Recalculating from posts for user:', userId);
  
  if (!userId) {
    console.error('❌ [cognitiveDensity] Missing userId');
    return;
  }

  try {
    // 1. Fetch tutti i post dell'utente con categoria
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('category')
      .eq('author_id', userId)
      .not('category', 'is', null);

    if (postsError) {
      console.error('❌ [cognitiveDensity] Error fetching posts:', postsError);
      return;
    }

    if (!posts || posts.length === 0) {
      console.log('ℹ️ [cognitiveDensity] No posts with category found');
      return;
    }

    // 2. Conta i post per categoria
    const densityMap: Record<string, number> = {};
    posts.forEach(post => {
      if (post.category) {
        densityMap[post.category] = (densityMap[post.category] || 0) + 1;
      }
    });

    console.log('📊 [cognitiveDensity] Calculated density from posts:', densityMap);

    // 3. Aggiorna il profilo
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ cognitive_density: densityMap })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ [cognitiveDensity] Error updating profile:', updateError);
      return;
    }

    console.log(`✅ [cognitiveDensity] Recalculated density from ${posts.length} posts`);
    return densityMap;
  } catch (error) {
    console.error('❌ [cognitiveDensity] Unexpected error:', error);
  }
}
