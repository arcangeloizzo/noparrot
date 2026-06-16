import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OriginalSource {
  id: string;
  url: string | null;
  title: string | null;
  image: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageRatio?: string | null;
  imageOrientation?: string | null;
  imageAmbientUrl?: string | null;
  category: string | null;
  postType: string | null;
  authorUsername: string;
  authorFullName: string | null;
  authorAvatar?: string | null;
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
    ratio?: '9:16' | '3:4' | '1:1' | '16:9';
    orientation?: 'portrait' | 'landscape' | 'square';
    ambient_url?: string | null;
  }>;
  voicePost?: {
    id?: string;
    audio_url: string;
    duration_seconds: number;
    waveform_data: number[];
    transcript?: string;
    transcript_status?: string;
    title?: string;
    body_text?: string;
  } | null;
  challenge?: {
    id: string;
    thesis: string;
    duration_hours: number;
    status: string;
    expires_at: string;
    votes_for: number;
    votes_against: number;
    title?: string;
    body_text?: string;
    voice_post?: {
      id: string;
      audio_url: string;
      duration_seconds: number;
      waveform_data: number[];
      transcript?: string;
      transcript_status?: string;
      title?: string;
      body_text?: string;
    } | null;
  } | null;
}

interface AncestorPost {
  id: string;
  shared_url: string | null;
  shared_title: string | null;
  preview_img: string | null;
  preview_img_width?: number | null;
  preview_img_height?: number | null;
  preview_img_ratio?: string | null;
  preview_img_orientation?: string | null;
  preview_img_ambient_url?: string | null;
  quoted_post_id: string | null;
  author: {
    username: string;
    full_name: string | null;
  };
}

const MAX_CHAIN_DEPTH = 10;

/**
 * Traverses the entire quoted_post_id chain to find the FIRST post with a shared_url or media.
 * Returns the last retrieved ancestor (root) if none have shared_url or media.
 */
export function useOriginalSource(quotedPostId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['original-source', quotedPostId],
    queryFn: async (): Promise<OriginalSource | null> => {
      if (!quotedPostId) return null;

      let currentId: string | null = quotedPostId;
      let depth = 0;
      let lastValidPost: any = null;
      let lastValidMedia: any[] = [];

      while (currentId && depth < MAX_CHAIN_DEPTH) {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            shared_url,
            shared_title,
            preview_img,
            preview_img_width,
            preview_img_height,
            preview_img_ratio,
            preview_img_orientation,
            preview_img_ambient_url,
            quoted_post_id,
            category,
            post_type,
            author:public_profiles!author_id (
              username,
              full_name,
              avatar_url
            ),
            post_media!post_media_post_id_fkey (
              order_idx,
              media:media_id (
                id,
                type,
                url,
                thumbnail_url,
                ratio,
                orientation,
                ambient_url
              )
            ),
            voice_posts (
              id,
              audio_url,
              duration_seconds,
              waveform_data,
              transcript,
              transcript_status,
              title,
              body_text
            ),
            challenges!challenges_post_id_fkey (
              id,
              thesis,
              duration_hours,
              status,
              expires_at,
              votes_for,
              votes_against,
              title,
              body_text,
              voice_post_id,
              voice_posts!challenges_voice_post_id_fkey (
                id,
                audio_url,
                duration_seconds,
                waveform_data,
                transcript,
                transcript_status,
                title,
                body_text
              )
            )
          `)
          .eq('id', currentId)
          .single();

        if (error || !data) break;

        const post: any = data;
        const media = (post.post_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((pm: any) => pm.media)
          .filter(Boolean);

        lastValidPost = post;
        lastValidMedia = media;

        // If this post itself has media or a shared_url, stop here and return it
        if (post.shared_url || media.length > 0) {
          break;
        }

        // Move to the next ancestor
        currentId = post.quoted_post_id;
        depth++;
      }

      if (lastValidPost) {
        return {
          id: lastValidPost.id,
          url: lastValidPost.shared_url,
          title: lastValidPost.shared_title || lastValidPost.title || null,
          image: lastValidPost.preview_img,
          imageWidth: lastValidPost.preview_img_width,
          imageHeight: lastValidPost.preview_img_height,
          imageRatio: lastValidPost.preview_img_ratio,
          imageOrientation: lastValidPost.preview_img_orientation,
          imageAmbientUrl: lastValidPost.preview_img_ambient_url,
          category: lastValidPost.category,
          postType: lastValidPost.post_type,
          authorUsername: lastValidPost.author.username,
          authorFullName: lastValidPost.author.full_name,
          authorAvatar: lastValidPost.author.avatar_url,
          media: lastValidMedia,
          voicePost: lastValidPost.voice_posts?.[0] || null,
          challenge: lastValidPost.challenges?.[0] ? {
            id: lastValidPost.challenges[0].id,
            thesis: lastValidPost.challenges[0].thesis,
            duration_hours: lastValidPost.challenges[0].duration_hours,
            status: lastValidPost.challenges[0].status,
            expires_at: lastValidPost.challenges[0].expires_at,
            votes_for: lastValidPost.challenges[0].votes_for || 0,
            votes_against: lastValidPost.challenges[0].votes_against || 0,
            title: lastValidPost.challenges[0].title,
            body_text: lastValidPost.challenges[0].body_text,
            voice_post: lastValidPost.challenges[0].voice_posts?.[0] || null,
          } : null
        };
      }

      return null;
    },
    enabled: !!quotedPostId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
