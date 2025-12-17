// GateQueueModal - Main modal for managing source comprehension gates
// =================================================================
// ✅ Manages queue of sources requiring comprehension gates
// ✅ Shows current progress and navigates between sources
// ✅ Hosts SourceReaderGate and SourceMCQTest components

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GateQueueManager, SourceWithGate, SourceGateState, getChipState } from '@/lib/comprehension-gate-extended';
import { SourceReaderGate } from './SourceReaderGate';
import { SourceMCQTest } from './SourceMCQTest';

interface GateQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  queueManager: GateQueueManager;
}

type ModalView = 'overview' | 'reading' | 'testing';

export const GateQueueModal: React.FC<GateQueueModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  queueManager
}) => {
  const [queueState, setQueueState] = useState(queueManager.getState());
  const [view, setView] = useState<ModalView>('overview');
  const [currentSource, setCurrentSource] = useState<SourceWithGate | null>(null);
  const [readerClosing, setReaderClosing] = useState(false);

  // Safe close function for iOS Safari
  const closeReaderSafely = async (nextView: ModalView) => {
    setReaderClosing(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setView(nextView);
    await new Promise((resolve) => setTimeout(resolve, 50));
    setReaderClosing(false);
  };

  useEffect(() => {
    if (isOpen) {
      // Set up queue manager listener
      const unsubscribe = (state: any) => setQueueState(state);
      queueManager.onStateChange = unsubscribe;
      
      // Start with first pending source
      const firstPending = queueManager.startGate();
      if (firstPending) {
        setCurrentSource(firstPending);
        setView('overview');
      }
    }
  }, [isOpen, queueManager]);

  useEffect(() => {
    // Check if all sources are passed
    if (queueState.allPassed && queueState.sources.length > 0) {
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  }, [queueState.allPassed, onComplete]);

  if (!isOpen) return null;

  const handleStartReading = (source: SourceWithGate) => {
    setCurrentSource(source);
    queueManager.updateSource(source.id, { state: 'reading' });
    setView('reading');
  };

  const handleReadingComplete = () => {
    if (currentSource) {
      queueManager.updateSource(currentSource.id, { state: 'testing' });
      setView('testing');
    }
  };

  const handleTestComplete = (passed: boolean) => {
    if (currentSource) {
      const newState: SourceGateState = passed ? 'passed' : 'failed';
      queueManager.updateSource(currentSource.id, { 
        state: newState,
        attempts: (currentSource.attempts || 0) + 1,
        lastAttempt: new Date()
      });

      if (passed) {
        // Move to next pending source or back to overview
        const nextSource = queueManager.getNextPendingSource();
        if (nextSource) {
          setCurrentSource(nextSource);
          setView('overview');
        } else {
          setView('overview');
        }
      } else {
        // Back to overview for retry
        setView('overview');
      }
    }
  };

  const handleSourceSelect = (source: SourceWithGate) => {
    setCurrentSource(source);
    queueManager.updateSource(queueManager.getCurrentSource()?.id || '', { state: 'pending' });
    
    const newIndex = queueState.sources.findIndex(s => s.id === source.id);
    queueManager.state.currentIndex = newIndex;
    
    if (source.state === 'pending' || source.state === 'failed') {
      setView('overview');
    }
  };

  const renderOverview = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          Comprehension Gate™
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress */}
      <div className="p-4 bg-muted/50 border-b border-border">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-foreground">
            Progresso: {queueState.sources.filter(s => s.state === 'passed').length}/{queueState.sources.length}
          </span>
          {queueState.allPassed && (
            <span className="text-trust-high font-medium">✅ Completo!</span>
          )}
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ 
              width: `${(queueState.sources.filter(s => s.state === 'passed').length / queueState.sources.length) * 100}%` 
            }}
          />
        </div>
      </div>

      {/* Sources List */}
      <div className="flex-1 p-4 overflow-y-auto">
        <p className="text-sm text-muted-foreground mb-4">
          Completa la lettura e il test per ogni fonte prima di pubblicare.
        </p>
        
        <div className="space-y-3">
          {queueState.sources.map((source, index) => {
            const chipState = getChipState(source.state);
            const isCurrent = currentSource?.id === source.id;
            
            return (
              <div
                key={source.id}
                className={cn(
                  "p-3 rounded-lg border transition-all cursor-pointer",
                  isCurrent ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50",
                  source.state === 'passed' && "border-trust-high/50 bg-trust-high/10"
                )}
                onClick={() => handleSourceSelect(source)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{chipState.icon}</span>
                      <span className="font-medium text-foreground truncate">
                        {source.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {source.url}
                    </p>
                    {source.state === 'failed' && source.attempts && (
                      <p className="text-xs text-trust-low mt-1">
                        Tentativi: {source.attempts}/2
                      </p>
                    )}
                  </div>
                  
                  {source.state === 'pending' || source.state === 'failed' ? (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartReading(source);
                      }}
                      className="ml-2"
                    >
                      Inizia
                    </Button>
                  ) : (
                    <div className={cn("px-2 py-1 rounded text-xs font-medium", chipState.color)}>
                      {source.state === 'passed' ? 'Superato' : 
                       source.state === 'reading' ? 'Lettura' :
                       source.state === 'testing' ? 'Test' : 'In attesa'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        {queueState.allPassed ? (
          <Button onClick={onComplete} className="w-full">
            Pubblica Contenuto
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            Completa tutti i gate per abilitare la pubblicazione
          </p>
        )}
      </div>
    </div>
  );

  if (view === 'reading' && currentSource) {
    return (
      <SourceReaderGate
        source={currentSource}
        isOpen={true}
        isClosing={readerClosing}
        onClose={() => closeReaderSafely('overview')}
        onComplete={handleReadingComplete}
      />
    );
  }

  if (view === 'testing' && currentSource) {
    return (
      <SourceMCQTest
        source={currentSource}
        isOpen={true}
        onClose={() => setView('overview')}
        onComplete={handleTestComplete}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-background rounded-2xl w-[90vw] h-[84vh] border border-border overflow-hidden">
        {renderOverview()}
      </div>
    </div>
  );
};