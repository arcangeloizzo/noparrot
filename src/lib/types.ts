// Custom types for the application

export interface Author {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface PostWithAuthor {
  id: string;
  author: Author;
  content: string;
  topic_tag: string | null;
  shared_title: string | null;
  shared_url: string | null;
  preview_img: string | null;
  full_article: string | null;
  article_content: string | null;
  trust_level: 'BASSO' | 'MEDIO' | 'ALTO' | null;
  stance: 'Condiviso' | 'Confutato' | null;
  sources: string[];
  source_url?: string | null;
  created_at: string;
  quoted_post_id: string | null;
  reactions: {
    hearts: number;
    comments: number;
  };
  user_reactions: {
    has_hearted: boolean;
    has_bookmarked: boolean;
  };
  likes?: number;
  bookmarks?: number;
  likes_count?: number;
  comments_count?: number;
  quotes_count?: number;
  questions: Array<{
    id: string;
    question_text: string;
    options: string[];
    correct_index: number;
  }>;
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
    width?: number | null;
    height?: number | null;
    mime?: string;
    duration_sec?: number | null;
  }>;
}

export interface QuotedPost {
  id: string;
  content: string;
  created_at: string;
  shared_url?: string | null;
  shared_title?: string | null;
  preview_img?: string | null;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface PostWithAuthorAndQuotedPost extends PostWithAuthor {
  quoted_post?: QuotedPost | null;
}
