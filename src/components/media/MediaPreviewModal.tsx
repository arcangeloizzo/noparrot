import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    mediaUrl: string | null;
    mediaType: 'image' | 'video' | null;
}

export function MediaPreviewModal({ isOpen, onClose, mediaUrl, mediaType }: MediaPreviewModalProps) {
    if (!mediaUrl) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95 border-none flex flex-col items-center justify-center overflow-hidden">
                <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors">
                    <X className="w-6 h-6" />
                </DialogClose>

                <div className="relative w-full h-full flex items-center justify-center p-4">
                    {mediaType === 'image' ? (
                        <img
                            src={mediaUrl}
                            alt="Anteprima"
                            className="max-w-full max-h-full object-contain rounded-md"
                        />
                    ) : (
                        <video
                            src={mediaUrl}
                            controls
                            className="max-w-full max-h-full rounded-md"
                            playsInline
                            autoPlay
                        />
                    )}
                </div>

                {/* Action Bar (Download/Open Original) */}
                <div className="absolute bottom-6 flex gap-4">
                    <Button
                        variant="outline"
                        className="bg-black/50 border-white/20 text-white hover:bg-white/10 backdrop-blur-sm gap-2"
                        onClick={() => window.open(mediaUrl, '_blank')}
                    >
                        <ExternalLink className="w-4 h-4" />
                        Apri originale
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
