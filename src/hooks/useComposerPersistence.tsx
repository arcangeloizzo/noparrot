import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface ComposerState {
    content: string;
    detectedUrl: string | null;
    timestamp: number;
}

const STORAGE_KEY = 'noparrot_composer_draft';
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

export const useComposerPersistence = (
    isOpen: boolean,
    currentContent: string,
    currentDetectedUrl: string | null,
    onRestore: (content: string, detectedUrl: string | null) => void
) => {
    const [restored, setRestored] = useState(false);
    const initialMount = useRef(true);

    // Load draft on mount/open if valid
    useEffect(() => {
        if (!isOpen || restored) return;

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed: ComposerState = JSON.parse(saved);
                const now = Date.now();

                if (now - parsed.timestamp < EXPIRY_TIME) {
                    if (parsed.content.trim() || parsed.detectedUrl) {
                        console.log('[ComposerPersistence] Restoring draft', parsed);
                        onRestore(parsed.content, parsed.detectedUrl);
                        toast.info('Bozza ripristinata');
                    }
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('[ComposerPersistence] Error restoring draft', e);
        }
        setRestored(true);
    }, [isOpen, restored, onRestore]);

    // Save state on change (debounced)
    useEffect(() => {
        if (!isOpen || !restored) return;

        const handler = setTimeout(() => {
            // Only save if there is something substantial
            if (currentContent.trim() || currentDetectedUrl) {
                const state: ComposerState = {
                    content: currentContent,
                    detectedUrl: currentDetectedUrl,
                    timestamp: Date.now()
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } else {
                // Clear storage if user clears composer
                localStorage.removeItem(STORAGE_KEY);
            }
        }, 1000);

        return () => clearTimeout(handler);
    }, [currentContent, currentDetectedUrl, isOpen, restored]);

    // Clear on successful publish (caller should trigger this)
    const clearDraft = () => {
        localStorage.removeItem(STORAGE_KEY);
    };

    return { clearDraft };
};
