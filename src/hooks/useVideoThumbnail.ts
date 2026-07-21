import { useEffect, useState } from 'react';

/**
 * Generates a poster thumbnail from a video URL/File using a canvas.
 * Signature preserved from the original local hook in MediaPreviewTray.
 */
export const useVideoThumbnail = (
  videoUrl: string,
  type: 'image' | 'video',
  file?: File
): string | null => {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    if (type !== 'video') return;
    if (!videoUrl && !file) return;

    const isLocalFile = !!file;
    const videoSrc = file ? URL.createObjectURL(file) : videoUrl;

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let hasSeekCompleted = false;
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      video.pause();
      video.src = '';
      if (isLocalFile) URL.revokeObjectURL(videoSrc);
    };

    const timeout = setTimeout(() => {
      if (!hasSeekCompleted) cleanup();
    }, 5000);

    video.onloadeddata = () => {
      if (!hasSeekCompleted && !cleanedUp) {
        video.currentTime = Math.min(0.5, video.duration || 0.5);
      }
    };

    video.onseeked = () => {
      if (hasSeekCompleted || cleanedUp) return;
      hasSeekCompleted = true;
      clearTimeout(timeout);

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          if (dataUrl.length > 1000) setPoster(dataUrl);
        }
      } catch {
        /* CORS or draw failure — leave poster null */
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
    };

    video.src = videoSrc;
    video.load();

    return () => {
      clearTimeout(timeout);
      cleanup();
    };
  }, [videoUrl, type, file]);

  return poster;
};

export default useVideoThumbnail;