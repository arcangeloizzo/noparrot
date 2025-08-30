import React, { useState, useEffect, useMemo } from 'react';
import { X, Link, Plus, User, ChevronLeft, Image, FileText, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GateQueueManager, SourceWithGate, GateQueueState } from '@/lib/comprehension-gate-extended';
import { GateQueueModal } from './GateQueueModal';
import { SourceChip } from './SourceChip';

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComposerModal: React.FC<ComposerModalProps> = ({ isOpen, onClose }) => {
  const [content, setContent] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [showGateQueue, setShowGateQueue] = useState(false);
  const [gateQueueState, setGateQueueState] = useState<GateQueueState | null>(null);

  // Create queue manager for sources with gate states
  const queueManager = useMemo(() => {
    if (sources.length === 0) return null;
    return new GateQueueManager(sources, setGateQueueState);
  }, [sources]);

  // Check if all sources are passed
  const allSourcesPassed = useMemo(() => {
    if (sources.length === 0) return true; // No sources = can publish
    return gateQueueState?.allPassed || false;
  }, [sources.length, gateQueueState?.allPassed]);

  const addSource = () => {
    if (newSource.trim() && !sources.includes(newSource.trim())) {
      setSources([...sources, newSource.trim()]);
      setNewSource('');
    }
  };

  const removeSource = (index: number) => {
    const removedSource = sources[index];
    setSources(sources.filter((_, i) => i !== index));
    
    // If queue manager exists, remove from queue as well
    if (queueManager && gateQueueState) {
      const sourceInQueue = gateQueueState.sources.find(s => s.url === removedSource);
      if (sourceInQueue) {
        queueManager.removeSource(sourceInQueue.id);
      }
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) return;

    // If no sources, publish immediately
    if (sources.length === 0) {
      publishContent();
      return;
    }

    // If sources exist but not all passed, open gate queue
    if (!allSourcesPassed) {
      setShowGateQueue(true);
      return;
    }

    // All sources passed, publish
    publishContent();
  };

  const publishContent = () => {
    console.log('Publishing:', { content, sources });
    // Here you would typically send the data to your backend
    
    // Show success toast
    // Note: toast would need to be imported and used here
    console.log('✅ Post pubblicato con successo!');
    
    onClose();
    // Reset form
    setContent('');
    setSources([]);
    setNewSource('');
    setGateQueueState(null);
  };

  const handleGateComplete = () => {
    setShowGateQueue(false);
    // Show toast notification before publishing
    setTimeout(() => {
      publishContent();
    }, 100);
  };

  const getAvatarContent = () => {
    const initials = "AI";
    return (
      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold">
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
                content.trim() && allSourcesPassed
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
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
                className="text-sm text-primary font-medium hover:underline"
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
                className="flex-1 px-4 py-3 bg-input rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none text-sm text-foreground"
                onKeyPress={(e) => e.key === 'Enter' && addSource()}
              />
              <button
                onClick={addSource}
                disabled={!newSource.trim()}
                className={cn(
                  "px-4 py-3 rounded-lg transition-colors",
                  newSource.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Sources List with Gate States */}
            {sources.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {sources.map((sourceUrl, index) => {
                    const sourceWithGate = gateQueueState?.sources.find(s => s.url === sourceUrl);
                    if (sourceWithGate) {
                      return (
                        <SourceChip
                          key={sourceWithGate.id}
                          source={sourceWithGate}
                          onRemove={() => removeSource(index)}
                        />
                      );
                    }
                    
                    // Fallback for sources not yet in queue
                    return (
                      <div
                        key={index}
                        className="inline-flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <span className="text-foreground truncate max-w-[200px]">
                          {sourceUrl}
                        </span>
                        <button
                          onClick={() => removeSource(index)}
                          className="text-muted-foreground hover:text-foreground ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {/* Gate Status Message */}
                {sources.length > 0 && !allSourcesPassed && (
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                    <p className="text-xs text-accent">
                      💡 <strong>Comprehension Gate™:</strong> Per pubblicare, completa la lettura e il test per tutte le fonti aggiunte. Il post verrà pubblicato automaticamente al completamento.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between p-5 border-t border-border">
          <div className="flex items-center space-x-4">
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <FileText className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <Image className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <MapPin className="w-5 h-5" />
            </button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {content.length}/280
          </div>
        </div>
      </div>
      
      {/* Gate Queue Modal */}
      {showGateQueue && queueManager && (
        <GateQueueModal
          isOpen={showGateQueue}
          onClose={() => setShowGateQueue(false)}
          onComplete={handleGateComplete}
          queueManager={queueManager}
        />
      )}
    </div>
  );
};