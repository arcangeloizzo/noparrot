interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface MediaGalleryProps {
  media: Media[];
  onClick?: (media: Media, index: number) => void;
}

export const MediaGallery = ({ media, onClick }: MediaGalleryProps) => {
  if (!media || media.length === 0) return null;

  const images = media.filter(m => m.type === 'image');
  const videos = media.filter(m => m.type === 'video');

  const handleMediaClick = (e: React.MouseEvent, item: Media, index: number) => {
    if (onClick) {
      e.stopPropagation();
      // Pass the index within the full media array
      const fullIndex = media.findIndex(m => m.id === item.id);
      onClick(item, fullIndex);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Immagini - griglia responsiva */}
      {images.length > 0 && (
        <div className={`grid gap-1 rounded-2xl overflow-hidden ${
          images.length === 1 ? 'grid-cols-1' :
          images.length === 2 ? 'grid-cols-2' :
          images.length === 3 ? 'grid-cols-2' :
          'grid-cols-2'
        }`}>
          {images.map((img, idx) => (
            <div 
              key={img.id}
              className={`relative ${
                images.length === 3 && idx === 0 ? 'col-span-2' : ''
              } ${onClick ? 'cursor-pointer' : ''}`}
              onClick={(e) => handleMediaClick(e, img, idx)}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover aspect-video"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Video */}
      {videos.map((vid) => (
        <div 
          key={vid.id} 
          className={`rounded-2xl overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
          onClick={(e) => handleMediaClick(e, vid, videos.findIndex(v => v.id === vid.id) + images.length)}
        >
          <video
            src={vid.url}
            poster={vid.thumbnail_url}
            controls
            playsInline
            className="w-full aspect-video bg-black"
            preload="metadata"
          >
            Il tuo browser non supporta il tag video.
          </video>
        </div>
      ))}
    </div>
  );
};
