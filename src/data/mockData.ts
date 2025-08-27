// Mock data for NOPARROT feed

export interface MockPost {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  status: "Shared" | "Refuted" | "No Source";
  comment: string;
  topic?: string;
  title?: string;
  previewImage?: string;
  sourceUrl?: string;
  trustScore?: "LOW" | "MEDIUM" | "HIGH" | "No Sources";
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
    user: { name: "Alessandro Viola" },
    status: "Shared",
    comment: "This data is truly concerning. CO2 levels in our atmosphere have reached 420 ppm, which is far from a temporary issue anymore.",
    topic: "Climate",
    title: "Climate data shows CO2 levels reach new record high",
    previewImage: "https://images.unsplash.com/photo-1569163139394-de4e5f43e4e3?w=800&h=450&fit=crop",
    sourceUrl: "nasa.gov/climate",
    trustScore: "HIGH",
    reactions: { heart: 24, comments: 8 },
    isBookmarked: false,
    questions: [
      {
        question: "What CO2 level was mentioned in the article?",
        options: ["380 ppm", "420 ppm", "450 ppm"],
        correct: 1
      },
      {
        question: "What is the main concern about current CO2 levels?",
        options: ["They are temporary", "They reached a new record", "They are decreasing"],
        correct: 1
      },
      {
        question: "Which organization provided this climate data?",
        options: ["NASA", "EPA", "NOAA"],
        correct: 0
      }
    ]
  },
  {
    id: "2",
    user: { name: "Maria Rossi" },
    status: "Refuted",
    comment: "This claim about electric cars being worse for the environment has been debunked multiple times. The lifecycle analysis clearly shows EVs have lower emissions.",
    topic: "Technology",
    title: "Study claims electric vehicles worse for environment than gas cars",
    previewImage: "https://images.unsplash.com/photo-1593941707882-a5bac6861d75?w=800&h=450&fit=crop",
    sourceUrl: "carbontrust.org/insights",
    trustScore: "MEDIUM",
    reactions: { heart: 18, comments: 12 },
    isBookmarked: true,
    questions: [
      {
        question: "What does lifecycle analysis show about EVs?",
        options: ["Higher emissions", "Lower emissions", "Same emissions"],
        correct: 1
      },
      {
        question: "How many times has this claim been debunked?",
        options: ["Once", "Multiple times", "Never"],
        correct: 1
      },
      {
        question: "What type of analysis was mentioned?",
        options: ["Cost analysis", "Lifecycle analysis", "Performance analysis"],
        correct: 1
      }
    ]
  },
  {
    id: "3",
    user: { name: "Luca Bianchi" },
    status: "No Source",
    comment: "Just heard that drinking lemon water in the morning boosts metabolism by 30%. Anyone else tried this?",
    topic: "Health",
    trustScore: "No Sources",
    reactions: { heart: 5, comments: 15 },
    isBookmarked: false,
    questions: [
      {
        question: "What percentage metabolism boost was claimed?",
        options: ["20%", "30%", "40%"],
        correct: 1
      },
      {
        question: "What beverage was mentioned?",
        options: ["Green tea", "Lemon water", "Coffee"],
        correct: 1
      },
      {
        question: "What time of day was specified?",
        options: ["Morning", "Afternoon", "Evening"],
        correct: 0
      }
    ]
  },
  {
    id: "4",
    user: { name: "Sofia Chen" },
    status: "Shared",
    comment: "This breakthrough in quantum computing could revolutionize cybersecurity. IBM's 1000-qubit processor is a major milestone.",
    topic: "Technology",
    title: "IBM unveils 1000-qubit quantum processor breakthrough",
    previewImage: "https://images.unsplash.com/photo-1518709268805-4e9042af2ac1?w=800&h=450&fit=crop",
    sourceUrl: "ibm.com/quantum",
    trustScore: "HIGH",
    reactions: { heart: 42, comments: 7 },
    isBookmarked: false,
    questions: [
      {
        question: "How many qubits does IBM's new processor have?",
        options: ["500", "1000", "1500"],
        correct: 1
      },
      {
        question: "What field could this breakthrough revolutionize?",
        options: ["Healthcare", "Cybersecurity", "Transportation"],
        correct: 1
      },
      {
        question: "Which company made this breakthrough?",
        options: ["Google", "IBM", "Microsoft"],
        correct: 1
      }
    ]
  },
  {
    id: "5",
    user: { name: "Marco Verdi" },
    status: "Refuted",
    comment: "This article misrepresents the vaccine data. The actual efficacy rates from peer-reviewed studies show completely different results.",
    topic: "Health",
    title: "Local news claims COVID vaccine only 12% effective",
    previewImage: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&h=450&fit=crop",
    sourceUrl: "localnews.com/health",
    trustScore: "LOW",
    reactions: { heart: 8, comments: 23 },
    isBookmarked: true,
    questions: [
      {
        question: "What efficacy rate did the local news claim?",
        options: ["12%", "22%", "32%"],
        correct: 0
      },
      {
        question: "What type of studies show different results?",
        options: ["Clinical studies", "Peer-reviewed studies", "Lab studies"],
        correct: 1
      },
      {
        question: "How does the user describe the article?",
        options: ["Accurate", "Misrepresents data", "Well-researched"],
        correct: 1
      }
    ]
  },
  {
    id: "6",
    user: { name: "Elena Fuentes" },
    status: "No Source",
    comment: "My grandmother always said eating carrots improves night vision. Is there any truth to this old saying?",
    topic: "Health",
    trustScore: "No Sources",
    reactions: { heart: 12, comments: 18 },
    isBookmarked: false,
    questions: [
      {
        question: "What food was mentioned for improving vision?",
        options: ["Carrots", "Spinach", "Blueberries"],
        correct: 0
      },
      {
        question: "What type of vision was specifically mentioned?",
        options: ["Day vision", "Night vision", "Color vision"],
        correct: 1
      },
      {
        question: "Who originally told the user this information?",
        options: ["Grandmother", "Doctor", "Teacher"],
        correct: 0
      }
    ]
  }
];

// Generate more posts dynamically
export const generateMorePosts = (count: number): MockPost[] => {
  const names = ["Anna Lombardi", "Giuseppe Romano", "Francesca Ricci", "Matteo Ferrari", "Giulia Esposito"];
  const topics = ["Politics", "Science", "Environment", "Technology", "Society"];
  const statuses: ("Shared" | "Refuted" | "No Source")[] = ["Shared", "Refuted", "No Source"];
  const trustScores: ("LOW" | "MEDIUM" | "HIGH" | "No Sources")[] = ["LOW", "MEDIUM", "HIGH", "No Sources"];
  
  return Array.from({ length: count }, (_, i) => ({
    id: (mockPosts.length + i + 1).toString(),
    user: { name: names[i % names.length] },
    status: statuses[i % statuses.length],
    comment: `This is a generated post comment discussing important topics. Post number ${i + 1}.`,
    topic: topics[i % topics.length],
    title: Math.random() > 0.3 ? `Generated Article Title ${i + 1}` : undefined,
    previewImage: Math.random() > 0.4 ? `https://images.unsplash.com/photo-${1500000000000 + i}?w=800&h=450&fit=crop` : undefined,
    sourceUrl: Math.random() > 0.3 ? `example.com/article-${i}` : undefined,
    trustScore: trustScores[i % trustScores.length],
    reactions: { heart: Math.floor(Math.random() * 50), comments: Math.floor(Math.random() * 25) },
    isBookmarked: Math.random() > 0.8,
    questions: [
      {
        question: `Sample question ${i + 1}?`,
        options: ["Option A", "Option B", "Option C"],
        correct: Math.floor(Math.random() * 3)
      },
      {
        question: `Another question ${i + 1}?`,
        options: ["Choice 1", "Choice 2", "Choice 3"],
        correct: Math.floor(Math.random() * 3)
      },
      {
        question: `Specific question ${i + 1}?`,
        options: ["Answer X", "Answer Y", "Answer Z"],
        correct: Math.floor(Math.random() * 3)
      }
    ]
  }));
};