import { EDITORIAL } from '@/config/brand';

interface QuotedEditorialCardProps {
  title: string;
  summary: string;
  imageUrl?: string;
  onClick?: () => void;
}

export const QuotedEditorialCard = ({ title, summary, imageUrl, onClick }: QuotedEditorialCardProps) => {
  return (
    <div 
      className="border border-white/10 rounded-xl p-4 mt-3 bg-gradient-to-b from-[#0D1B2A] to-[#1B263B] cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      {/* Header with Il Punto branding */}
      <div className="flex items-center gap-2 mb-3">
        <img 
          src={EDITORIAL.AVATAR_IMAGE} 
          alt="Il Punto"
          className="w-6 h-6 rounded-full object-cover"
        />
        <span className="text-xs font-medium text-white/60 tracking-wide font-mono">
          ◉ IL PUNTO
        </span>
      </div>

      {/* Editorial Title */}
      <h3 className="font-bold text-white text-sm leading-tight mb-2 line-clamp-2">
        {title}
      </h3>

      {/* Summary preview */}
      <p className="text-xs text-white/60 leading-relaxed line-clamp-2">
        {summary.replace(/\[SOURCE:[\d,\s]+\]/g, '').substring(0, 150)}...
      </p>

      {/* Optional image */}
      {imageUrl && (
        <div className="mt-3 rounded-lg overflow-hidden aspect-video">
          <img 
            src={imageUrl} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
};
