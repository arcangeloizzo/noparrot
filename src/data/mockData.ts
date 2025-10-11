// Mock data for NOPARROT feed

export interface MockPost {
  id: string;
  authorName: string;
  avatar?: string;
  minutesAgo: number;
  topicTag?: string;
  userComment: string;
  sharedTitle?: string;
  previewImg?: string;
  url?: string;
  sources: string[];
  trust: "BASSO" | "MEDIO" | "ALTO" | null;
  stance: "Condiviso" | "Confutato" | null;
  reactions: {
    heart: number;
    comments: number;
  };
  isBookmarked: boolean;
  questions: {
    question: string;
    options: string[];
    correct: number;
  }[];
}

export const mockPosts: MockPost[] = [
  {
    id: "1",
    authorName: "Alessandro Viola",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
    minutesAgo: 15,
    userComment: "Questi dati sono davvero preoccupanti. I livelli di CO2 nella nostra atmosfera hanno raggiunto 420 ppm, non è più un problema temporaneo.",
    topicTag: "Clima",
    sharedTitle: "I dati climatici mostrano che i livelli di CO2 raggiungono un nuovo record",
    previewImg: "https://images.unsplash.com/photo-1569163139394-de4e5f43e4e3?w=800&h=450&fit=crop",
    url: "nasa.gov/climate",
    sources: ["nasa.gov", "climate.gov"],
    trust: "ALTO",
    stance: "Condiviso",
    reactions: { heart: 24, comments: 8 },
    isBookmarked: false,
    questions: [
      {
        question: "Quale livello di CO2 è stato menzionato nell'articolo?",
        options: ["380 ppm", "420 ppm", "450 ppm"],
        correct: 1
      },
      {
        question: "Qual è la principale preoccupazione sui livelli attuali di CO2?",
        options: ["Sono temporanei", "Hanno raggiunto un nuovo record", "Stanno diminuendo"],
        correct: 1
      },
      {
        question: "Quale organizzazione ha fornito questi dati climatici?",
        options: ["NASA", "EPA", "NOAA"],
        correct: 0
      }
    ]
  },
  {
    id: "2",
    authorName: "Maria Rossi",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
    minutesAgo: 32,
    userComment: "Questa affermazione sulle auto elettriche peggiori per l'ambiente è stata smentita più volte. L'analisi del ciclo di vita mostra chiaramente che i veicoli elettrici hanno emissioni inferiori.",
    topicTag: "Tecnologia",
    sharedTitle: "Studio afferma che i veicoli elettrici sono peggiori per l'ambiente rispetto alle auto a benzina",
    previewImg: "https://images.unsplash.com/photo-1593941707882-a5bac6861d75?w=800&h=450&fit=crop",
    url: "carbontrust.org/insights",
    sources: ["carbontrust.org"],
    trust: "MEDIO",
    stance: "Confutato",
    reactions: { heart: 18, comments: 12 },
    isBookmarked: true,
    questions: [
      {
        question: "Cosa mostra l'analisi del ciclo di vita sui veicoli elettrici?",
        options: ["Emissioni più alte", "Emissioni più basse", "Stesse emissioni"],
        correct: 1
      },
      {
        question: "Quante volte è stata smentita questa affermazione?",
        options: ["Una volta", "Più volte", "Mai"],
        correct: 1
      },
      {
        question: "Che tipo di analisi è stata menzionata?",
        options: ["Analisi dei costi", "Analisi del ciclo di vita", "Analisi delle prestazioni"],
        correct: 1
      }
    ]
  },
  {
    id: "3",
    authorName: "Luca Bianchi",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
    minutesAgo: 47,
    userComment: "Ho sentito dire che bere acqua e limone al mattino aumenta il metabolismo del 30%. Qualcun altro l'ha provato?",
    topicTag: "Salute",
    sources: [],
    trust: null,
    stance: null,
    reactions: { heart: 5, comments: 15 },
    isBookmarked: false,
    questions: [
      {
        question: "Quale percentuale di aumento del metabolismo è stata affermata?",
        options: ["20%", "30%", "40%"],
        correct: 1
      },
      {
        question: "Quale bevanda è stata menzionata?",
        options: ["Tè verde", "Acqua e limone", "Caffè"],
        correct: 1
      },
      {
        question: "In quale momento della giornata è stato specificato?",
        options: ["Mattino", "Pomeriggio", "Sera"],
        correct: 0
      }
    ]
  },
  {
    id: "4",
    authorName: "Sofia Chen",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
    minutesAgo: 72,
    userComment: "Questa svolta nel quantum computing potrebbe rivoluzionare la cybersecurity. Il processore da 1000 qubit di IBM è una pietra miliare importante.",
    topicTag: "Tecnologia",
    sharedTitle: "IBM svela il processore quantistico da 1000 qubit",
    previewImg: "https://images.unsplash.com/photo-1518709268805-4e9042af2ac1?w=800&h=450&fit=crop",
    url: "ibm.com/quantum",
    sources: ["ibm.com", "nature.com"],
    trust: "ALTO",
    stance: "Condiviso",
    reactions: { heart: 42, comments: 7 },
    isBookmarked: false,
    questions: [
      {
        question: "Quanti qubit ha il nuovo processore IBM?",
        options: ["500", "1000", "1500"],
        correct: 1
      },
      {
        question: "Quale campo potrebbe essere rivoluzionato da questa svolta?",
        options: ["Sanità", "Cybersecurity", "Trasporti"],
        correct: 1
      },
      {
        question: "Quale azienda ha fatto questa svolta?",
        options: ["Google", "IBM", "Microsoft"],
        correct: 1
      }
    ]
  },
  {
    id: "5",
    authorName: "Marco Verdi",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces",
    minutesAgo: 95,
    userComment: "Questo articolo travisa i dati sui vaccini. I tassi di efficacia reali degli studi peer-reviewed mostrano risultati completamente diversi.",
    topicTag: "Salute",
    sharedTitle: "Notizie locali affermano che il vaccino COVID è efficace solo al 12%",
    previewImg: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&h=450&fit=crop",
    url: "localnews.com/health",
    sources: ["localnews.com"],
    trust: "BASSO",
    stance: "Confutato",
    reactions: { heart: 8, comments: 23 },
    isBookmarked: true,
    questions: [
      {
        question: "Quale tasso di efficacia hanno riportato le notizie locali?",
        options: ["12%", "22%", "32%"],
        correct: 0
      },
      {
        question: "Che tipo di studi mostrano risultati diversi?",
        options: ["Studi clinici", "Studi peer-reviewed", "Studi di laboratorio"],
        correct: 1
      },
      {
        question: "Come descrive l'utente l'articolo?",
        options: ["Accurato", "Travisa i dati", "Ben documentato"],
        correct: 1
      }
    ]
  },
  {
    id: "6",
    authorName: "Elena Fuentes",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
    minutesAgo: 128,
    userComment: "Mia nonna diceva sempre che mangiare carote migliora la vista notturna. C'è qualche verità in questo vecchio detto?",
    topicTag: "Salute",
    sources: [],
    trust: null,
    stance: null,
    reactions: { heart: 12, comments: 18 },
    isBookmarked: false,
    questions: [
      {
        question: "Quale cibo è stato menzionato per migliorare la vista?",
        options: ["Carote", "Spinaci", "Mirtilli"],
        correct: 0
      },
      {
        question: "Che tipo di vista è stata specificatamente menzionata?",
        options: ["Vista diurna", "Vista notturna", "Vista dei colori"],
        correct: 1
      },
      {
        question: "Chi ha originariamente detto queste informazioni all'utente?",
        options: ["Nonna", "Dottore", "Insegnante"],
        correct: 0
      }
    ]
  }
];

// Generate more posts dynamically
export const generateMorePosts = (count: number): MockPost[] => {
  const names = ["Anna Lombardi", "Giuseppe Romano", "Francesca Ricci", "Matteo Ferrari", "Giulia Esposito"];
  const topics = ["Politica", "Scienza", "Ambiente", "Tecnologia", "Società"];
  const stances: ("Condiviso" | "Confutato" | null)[] = ["Condiviso", "Confutato", null];
  const trustScores: ("BASSO" | "MEDIO" | "ALTO" | null)[] = ["BASSO", "MEDIO", "ALTO", null];
  
  const avatarPool = [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=faces",
  ];
  
  const previewImages: Record<string, string[]> = {
    "Politica": [
      "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=450&fit=crop"
    ],
    "Scienza": [
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&h=450&fit=crop"
    ],
    "Ambiente": [
      "https://images.unsplash.com/photo-1569163139394-de4e5f43e4e3?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800&h=450&fit=crop"
    ],
    "Tecnologia": [
      "https://images.unsplash.com/photo-1518709268805-4e9042af2ac1?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=450&fit=crop"
    ],
    "Società": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=450&fit=crop"
    ]
  };
  
  return Array.from({ length: count }, (_, i) => {
    const topic = topics[i % topics.length];
    const topicImages = previewImages[topic];
    
    return {
      id: (mockPosts.length + i + 1).toString(),
      authorName: names[i % names.length],
      avatar: avatarPool[i % avatarPool.length],
      minutesAgo: Math.floor(Math.random() * 240) + 5,
      userComment: `Questo è un commento di post generato che discute argomenti importanti. Post numero ${i + 1}.`,
      topicTag: topic,
      sharedTitle: Math.random() > 0.3 ? `Titolo Articolo Generato ${i + 1}` : undefined,
      previewImg: Math.random() > 0.3 ? topicImages[i % topicImages.length] : undefined,
      url: Math.random() > 0.3 ? `example.com/article-${i}` : undefined,
      sources: Math.random() > 0.4 ? [`source${i}.com`] : [],
      trust: trustScores[i % trustScores.length],
      stance: stances[i % stances.length],
      reactions: { heart: Math.floor(Math.random() * 50), comments: Math.floor(Math.random() * 25) },
      isBookmarked: Math.random() > 0.8,
      questions: [
        {
          question: `Domanda di esempio ${i + 1}?`,
          options: ["Opzione A", "Opzione B", "Opzione C"],
          correct: Math.floor(Math.random() * 3)
        },
        {
          question: `Altra domanda ${i + 1}?`,
          options: ["Scelta 1", "Scelta 2", "Scelta 3"],
          correct: Math.floor(Math.random() * 3)
        },
        {
          question: `Domanda specifica ${i + 1}?`,
          options: ["Risposta X", "Risposta Y", "Risposta Z"],
          correct: Math.floor(Math.random() * 3)
        }
      ]
    };
  });
};