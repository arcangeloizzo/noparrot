import { useState } from "react";
import { X, ChevronLeft, Image, FileText, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComposerModal = ({ isOpen, onClose }: ComposerModalProps) => {
  const [content, setContent] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState("");

  const addSource = () => {
    if (newSource.trim() && !sources.includes(newSource.trim())) {
      setSources([...sources, newSource.trim()]);
      setNewSource("");
    }
  };

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (content.trim()) {
      // TODO: Submit the post
      console.log("Submitting post:", { content, sources });
      onClose();
      setContent("");
      setSources([]);
    }
  };

  const getAvatarContent = () => {
    const initials = "AI";
    return (
      <div className="w-8 h-8 bg-primary-blue rounded-full flex items-center justify-center text-white text-sm font-semibold">
        {initials}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-[340px] mx-4 bg-card rounded-3xl shadow-lg border border-border max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">Crea</h2>
          </div>
          
          <div className="flex items-center space-x-3">
            {getAvatarContent()}
            <button
              onClick={handleSubmit}
              disabled={!content.trim()}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                content.trim()
                  ? "bg-primary-blue text-white hover:bg-primary-blue/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Pubblica
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          {/* Text Area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Scrivi qui il tuo Knowledge Drop..."
            className="w-full min-h-[120px] p-0 bg-transparent border-0 resize-none focus:outline-none text-foreground placeholder:text-muted-foreground text-base leading-relaxed"
            autoFocus
          />

          {/* Sources Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Fonti</span>
              <button
                onClick={() => document.getElementById('source-input')?.focus()}
                className="text-sm text-primary-blue font-medium hover:underline"
              >
                Aggiungi Fonti
              </button>
            </div>

            {/* Add Source Input */}
            <div className="flex space-x-2">
              <input
                id="source-input"
                type="url"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 px-4 py-3 bg-input rounded-lg border border-border focus:ring-2 focus:ring-primary-blue focus:outline-none text-sm"
                onKeyPress={(e) => e.key === 'Enter' && addSource()}
              />
              <button
                onClick={addSource}
                disabled={!newSource.trim()}
                  className={cn(
                    "px-4 py-3 rounded-lg transition-colors",
                    newSource.trim()
                      ? "bg-primary-blue text-white hover:bg-primary-blue/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Sources List */}
            {sources.length > 0 && (
              <div className="space-y-2">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-foreground truncate flex-1">
                      {source}
                    </span>
                    <button
                      onClick={() => removeSource(index)}
                      className="ml-2 p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between p-5 border-t border-border">
          <div className="flex items-center space-x-4">
            <button className="p-2 text-muted-foreground hover:text-primary-blue transition-colors">
              <FileText className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-primary-blue transition-colors">
              <Image className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-primary-blue transition-colors">
              <MapPin className="w-5 h-5" />
            </button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {content.length}/280
          </div>
        </div>
      </div>
    </div>
  );
};