import { supabase } from '@/integrations/supabase/client';

/**
 * Incrementa il cognitive_density dell'utente per una specifica categoria
 * Viene chiamato dopo il completamento con successo di un Cognitive Journey
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
 * Calcola la cognitive_density retroattivamente basandosi sui post pubblicati dall'utente
 * Utile per popolare la nebulosa per utenti che hanno già pubblicato post prima dell'implementazione del sistema
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
