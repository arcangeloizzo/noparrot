import { Home, Search, PenSquare, Bell, User } from "lucide-react";

export const FeedPreviewMock = () => {
  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-[#1F3347] border border-white/10 shadow-2xl">
      {/* Il Punto Card Mock */}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs font-bold">◉</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white text-sm font-semibold">IL PUNTO</span>
            <span className="text-white/40 text-xs">Oggi, 09:00</span>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Fonte: Alto
            </span>
          </div>
        </div>

        {/* Content Preview */}
        <div className="space-y-2">
          <h3 className="text-white font-semibold text-base leading-snug">
            La nuova direttiva UE sull'intelligenza artificiale: cosa cambia per utenti e aziende
          </h3>
          <p className="text-white/60 text-sm line-clamp-2">
            Il Parlamento Europeo ha approvato il regolamento più completo al mondo sull'IA, stabilendo limiti chiari per i sistemi ad alto rischio...
          </p>
        </div>

        {/* Action hint */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 rounded-full bg-white/10" />
            <div className="w-6 h-6 rounded-full bg-white/10" />
            <div className="w-6 h-6 rounded-full bg-white/10" />
          </div>
          <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
            <span className="text-white/80 text-xs font-medium">Metti a fuoco</span>
          </div>
        </div>
      </div>

      {/* Second card preview (partial) */}
      <div className="p-4 pt-2 opacity-50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-white/20" />
          <div className="w-24 h-3 bg-white/20 rounded" />
        </div>
        <div className="w-full h-3 bg-white/10 rounded mb-1" />
        <div className="w-3/4 h-3 bg-white/10 rounded" />
      </div>

      {/* Bottom Navigation Mock */}
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-[#0E141A]/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-4">
        <Home className="w-5 h-5 text-primary" />
        <Search className="w-5 h-5 text-white/40" />
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center -mt-4 shadow-lg">
          <PenSquare className="w-5 h-5 text-primary-foreground" />
        </div>
        <Bell className="w-5 h-5 text-white/40" />
        <User className="w-5 h-5 text-white/40" />
      </div>
    </div>
  );
};
