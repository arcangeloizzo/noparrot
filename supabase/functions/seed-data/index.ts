import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting database seeding...')

    // Demo users data
    const demoUsers = [
      { email: 'marco.bianchi@demo.com', fullName: 'Marco Bianchi', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
      { email: 'giulia.rossi@demo.com', fullName: 'Giulia Rossi', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
      { email: 'luca.verdi@demo.com', fullName: 'Luca Verdi', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
      { email: 'sara.neri@demo.com', fullName: 'Sara Neri', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop' },
      { email: 'alessandro.gallo@demo.com', fullName: 'Alessandro Gallo', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
    ]

    const userIds: string[] = []

    // Create users
    for (const user of demoUsers) {
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
        email: user.email,
        password: 'Demo123456!',
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
          avatar_url: user.avatar
        }
      })

      if (authError) {
        console.error(`Error creating user ${user.email}:`, authError)
        continue
      }

      if (authUser.user) {
        userIds.push(authUser.user.id)
        console.log(`Created user: ${user.email}`)
      }
    }

    // Demo posts
    const demoPosts = [
      {
        userIndex: 0,
        content: "Finalmente una riforma concreta sulla trasparenza politica! Questo decreto potrebbe cambiare davvero le regole del gioco. 🇮🇹",
        topic_tag: "Politica",
        shared_title: "Nuovo decreto sulla trasparenza: cosa cambia",
        shared_url: "https://governo.it/decreto-trasparenza-2025",
        preview_img: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800",
        trust_level: "ALTO",
        stance: "Condiviso",
        sources: ["governo.it", "gazzettaufficiale.it"],
        full_article: "Il nuovo decreto sulla trasparenza politica introduce importanti novità per la pubblica amministrazione...\n\nTra le misure principali: obbligo di pubblicazione online di tutti i contratti superiori a 5000 euro, registro pubblico delle lobbies, e tracciabilità digitale di tutte le delibere.\n\nL'implementazione è prevista entro 6 mesi dall'entrata in vigore.",
        questions: [
          { text: "Qual è la soglia minima per la pubblicazione obbligatoria dei contratti?", options: ["1.000 euro", "5.000 euro", "10.000 euro"], correct: 1 },
          { text: "Cosa introduce il decreto?", options: ["Registro delle lobbies", "Tassa sulla trasparenza", "Nuovo ministero"], correct: 0 },
          { text: "Quando è prevista l'implementazione?", options: ["Subito", "Entro 6 mesi", "Entro 1 anno"], correct: 1 }
        ]
      },
      {
        userIndex: 1,
        content: "Interessante vedere come l'intelligenza artificiale stia trasformando il settore sanitario. Il futuro è davvero qui! 🏥",
        topic_tag: "Tecnologia",
        shared_title: "AI in medicina: diagnosi più rapide e precise",
        shared_url: "https://healthtech.com/ai-medicina-2025",
        preview_img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800",
        trust_level: "ALTO",
        stance: "Condiviso",
        sources: ["nature.com", "thelancet.com"],
        full_article: "L'intelligenza artificiale sta rivoluzionando la diagnostica medica con tassi di accuratezza superiori al 95%...\n\nI sistemi AI sono ora in grado di rilevare tumori, malattie cardiovascolari e patologie rare con precisione superiore ai metodi tradizionali.\n\nGli ospedali che hanno adottato queste tecnologie riportano una riduzione del 40% nei tempi di diagnosi.",
        questions: [
          { text: "Qual è il tasso di accuratezza dell'AI in diagnostica?", options: ["Oltre 95%", "80%", "70%"], correct: 0 },
          { text: "Di quanto si riducono i tempi di diagnosi?", options: ["20%", "30%", "40%"], correct: 2 },
          { text: "Cosa rileva l'AI?", options: ["Solo tumori", "Tumori e malattie cardiovascolari", "Solo malattie rare"], correct: 1 }
        ]
      },
      {
        userIndex: 2,
        content: "Le nuove politiche ambientali europee sono un passo avanti significativo. Dobbiamo tutti fare la nostra parte! 🌍",
        topic_tag: "Ambiente",
        shared_title: "UE approva piano verde 2030: obiettivi ambiziosi",
        shared_url: "https://ec.europa.eu/green-deal-2030",
        preview_img: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800",
        trust_level: "ALTO",
        stance: "Condiviso",
        sources: ["ec.europa.eu", "europarl.europa.eu"],
        full_article: "L'Unione Europea ha approvato un ambizioso piano verde che mira a ridurre le emissioni del 55% entro il 2030...\n\nTra le misure: investimenti da 1 trilione di euro in energie rinnovabili, stop alla vendita di auto a combustione dal 2035, e nuove normative per l'economia circolare.\n\nIl piano prevede anche un fondo di transizione per supportare le regioni più dipendenti dai combustibili fossili.",
        questions: [
          { text: "Di quanto mira a ridurre le emissioni il piano?", options: ["45%", "55%", "65%"], correct: 1 },
          { text: "Quanto investirà l'UE in energie rinnovabili?", options: ["500 miliardi", "1 trilione", "2 trilioni"], correct: 1 },
          { text: "Quando stop auto a combustione?", options: ["2030", "2035", "2040"], correct: 1 }
        ]
      },
      {
        userIndex: 3,
        content: "Studio interessante sull'impatto della dieta mediterranea sulla longevità. La scienza continua a confermarne i benefici! 🥗",
        topic_tag: "Salute",
        shared_title: "Dieta mediterranea: +10 anni di vita, dice studio",
        shared_url: "https://nutrition-journal.com/mediterranean-longevity",
        preview_img: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800",
        trust_level: "MEDIO",
        stance: "Condiviso",
        sources: ["nutrition-journal.com"],
        full_article: "Un nuovo studio della Harvard Medical School conferma i benefici della dieta mediterranea sulla longevità...\n\nLa ricerca, condotta su 100.000 partecipanti in 20 anni, mostra che chi segue rigorosamente questa dieta vive in media 10 anni in più.\n\nI benefici includono riduzione del rischio cardiovascolare del 60% e miglioramento delle funzioni cognitive.",
        questions: [
          { text: "Quanti anni di vita in più offre la dieta?", options: ["5 anni", "10 anni", "15 anni"], correct: 1 },
          { text: "Quanto riduce il rischio cardiovascolare?", options: ["40%", "50%", "60%"], correct: 2 },
          { text: "Dove è stato condotto lo studio?", options: ["Harvard", "Oxford", "Stanford"], correct: 0 }
        ]
      },
      {
        userIndex: 4,
        content: "Il nuovo telescopio spaziale ha scoperto pianeti potenzialmente abitabili! L'esplorazione spaziale continua a stupirci. 🚀",
        topic_tag: "Scienza",
        shared_title: "Scoperti 5 pianeti simili alla Terra a 40 anni luce",
        shared_url: "https://nasa.gov/exoplanet-discovery-2025",
        preview_img: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800",
        trust_level: "ALTO",
        stance: "Condiviso",
        sources: ["nasa.gov", "esa.int"],
        full_article: "Il telescopio spaziale James Webb ha identificato 5 esopianeti nella zona abitabile del sistema TRAPPIST-2...\n\nQuesti pianeti si trovano a circa 40 anni luce dalla Terra e presentano condizioni simili al nostro pianeta: presenza di acqua, atmosfera e temperatura compatibile con la vita.\n\nLa NASA sta già pianificando missioni di studio più approfondite per il 2030.",
        questions: [
          { text: "Quanti pianeti sono stati scoperti?", options: ["3", "5", "7"], correct: 1 },
          { text: "A che distanza si trovano?", options: ["20 anni luce", "40 anni luce", "60 anni luce"], correct: 1 },
          { text: "Quale telescopio li ha scoperti?", options: ["Hubble", "James Webb", "Chandra"], correct: 1 }
        ]
      }
    ]

    // Create posts
    for (const postData of demoPosts) {
      const authorId = userIds[postData.userIndex]
      
      const { data: post, error: postError } = await supabaseClient
        .from('posts')
        .insert({
          author_id: authorId,
          content: postData.content,
          topic_tag: postData.topic_tag,
          shared_title: postData.shared_title,
          shared_url: postData.shared_url,
          preview_img: postData.preview_img,
          trust_level: postData.trust_level,
          stance: postData.stance,
          sources: postData.sources,
          full_article: postData.full_article
        })
        .select()
        .single()

      if (postError) {
        console.error('Error creating post:', postError)
        continue
      }

      // Create questions for this post
      const questionsToInsert = postData.questions.map((q, idx) => ({
        post_id: post.id,
        question_text: q.text,
        options: q.options,
        correct_index: q.correct,
        order_index: idx
      }))

      const { error: questionsError } = await supabaseClient
        .from('questions')
        .insert(questionsToInsert)

      if (questionsError) {
        console.error('Error creating questions:', questionsError)
      } else {
        console.log(`Created post with ${postData.questions.length} questions`)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Database seeded successfully with ${userIds.length} users and ${demoPosts.length} posts` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error seeding database:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
