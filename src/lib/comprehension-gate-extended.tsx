// Comprehension Gate™ - Extended SDK for Composer Integration
// ============================================================
// ✅ Extends the base SDK with support for multiple sources queue management
// ✅ Provides types and utilities for Composer Gate integration
// ✅ Handles source states: Pending → Reading → Testing → Passed/Failed

// Import types directly from the base SDK
type ContentDescriptor = { id: string; title?: string; text?: string };
type QuizResult = { passed: boolean; score: number; attestation?: string };

// -------------------------------------------------------------
// EXTENDED TYPES FOR COMPOSER

export type SourceGateState = 'pending' | 'reading' | 'testing' | 'passed' | 'failed';

export interface SourceWithGate {
  id: string;
  url: string;
  title?: string;
  state: SourceGateState;
  attempts?: number;
  lastAttempt?: Date;
  content?: string;
  summary?: string;
  excerpt?: string;
  previewImg?: string;
  hostname?: string;
  type?: 'article' | 'video' | 'audio' | 'image';
  embedUrl?: string;
  embedHtml?: string;
  videoId?: string;
  platform?: string;
  duration?: string;
}

export interface GateQueueState {
  sources: SourceWithGate[];
  currentIndex: number;
  isActive: boolean;
  allPassed: boolean;
}

// -------------------------------------------------------------
// QUEUE MANAGEMENT UTILITIES

export class GateQueueManager {
  public state: GateQueueState;
  public onStateChange: (state: GateQueueState) => void;

  constructor(sources: string[], onStateChange: (state: GateQueueState) => void) {
    this.onStateChange = onStateChange;
    this.state = {
      sources: sources.map((url, index) => ({
        id: `src_${Date.now()}_${index}`,
        url,
        title: this.extractTitleFromUrl(url),
        state: 'pending' as SourceGateState,
        attempts: 0
      })),
      currentIndex: 0,
      isActive: false,
      allPassed: false
    };
    this.updateAllPassed();
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return 'Fonte';
    }
  }

  private updateAllPassed() {
    this.state.allPassed = this.state.sources.length > 0 && 
      this.state.sources.every(s => s.state === 'passed');
    this.notifyChange();
  }

  private notifyChange() {
    this.onStateChange({ ...this.state });
  }

  getState(): GateQueueState {
    return { ...this.state };
  }

  addSource(url: string) {
    const newSource: SourceWithGate = {
      id: `src_${Date.now()}_${this.state.sources.length}`,
      url,
      title: this.extractTitleFromUrl(url),
      state: 'pending',
      attempts: 0
    };
    this.state.sources.push(newSource);
    this.updateAllPassed();
  }

  removeSource(id: string) {
    this.state.sources = this.state.sources.filter(s => s.id !== id);
    if (this.state.currentIndex >= this.state.sources.length) {
      this.state.currentIndex = Math.max(0, this.state.sources.length - 1);
    }
    this.updateAllPassed();
  }

  updateSource(id: string, updates: Partial<SourceWithGate>) {
    const index = this.state.sources.findIndex(s => s.id === id);
    if (index !== -1) {
      this.state.sources[index] = { ...this.state.sources[index], ...updates };
      this.updateAllPassed();
    }
  }

  getCurrentSource(): SourceWithGate | null {
    return this.state.sources[this.state.currentIndex] || null;
  }

  nextSource(): SourceWithGate | null {
    if (this.state.currentIndex < this.state.sources.length - 1) {
      this.state.currentIndex++;
      this.notifyChange();
      return this.getCurrentSource();
    }
    return null;
  }

  previousSource(): SourceWithGate | null {
    if (this.state.currentIndex > 0) {
      this.state.currentIndex--;
      this.notifyChange();
      return this.getCurrentSource();
    }
    return null;
  }

  setActive(active: boolean) {
    this.state.isActive = active;
    this.notifyChange();
  }

  startGate(): SourceWithGate | null {
    // Find first non-passed source
    const pendingIndex = this.state.sources.findIndex(s => s.state !== 'passed');
    if (pendingIndex !== -1) {
      this.state.currentIndex = pendingIndex;
      this.state.isActive = true;
      this.notifyChange();
      return this.getCurrentSource();
    }
    return null;
  }

  getNextPendingSource(): SourceWithGate | null {
    const nextIndex = this.state.sources.findIndex((s, i) => 
      i > this.state.currentIndex && s.state !== 'passed'
    );
    if (nextIndex !== -1) {
      this.state.currentIndex = nextIndex;
      this.notifyChange();
      return this.getCurrentSource();
    }
    return null;
  }
}

// -------------------------------------------------------------
// DETERMINISTIC QUIZ GENERATION

export interface SourceQuizTemplate {
  domain: string;
  type: 'news' | 'academic' | 'social' | 'blog' | 'general';
  questions: {
    macro1: string;
    macro2: string;
    detail: string;
  };
}

const QUIZ_TEMPLATES: SourceQuizTemplate[] = [
  {
    domain: 'news',
    type: 'news',
    questions: {
      macro1: 'Qual è la notizia principale riportata?',
      macro2: 'Quale impatto o conseguenza viene evidenziata?', 
      detail: 'Quale dato specifico o cifra viene citata?'
    }
  },
  {
    domain: 'academic',
    type: 'academic',
    questions: {
      macro1: 'Qual è la tesi o argomento principale?',
      macro2: 'Quale evidenza supporta la conclusione?',
      detail: 'Quale metodologia o studio viene citato?'
    }
  },
  {
    domain: 'social',
    type: 'social',
    questions: {
      macro1: 'Qual è il messaggio principale del post?',
      macro2: 'Quale reazione o discussione viene stimolata?',
      detail: 'Quale hashtag o menzione specifica è presente?'
    }
  },
  {
    domain: 'default',
    type: 'general',
    questions: {
      macro1: 'Qual è il tema principale del contenuto?',
      macro2: 'Quale punto di vista viene espresso?',
      detail: 'Quale informazione specifica viene fornita?'
    }
  }
];

export function generateSourceQuiz(source: SourceWithGate): ContentDescriptor {
  // Deterministic quiz based on URL hash
  const hash = source.url.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Determine template based on domain
  let template = QUIZ_TEMPLATES.find(t => t.domain === 'default')!;
  try {
    const domain = new URL(source.url).hostname.toLowerCase();
    if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) {
      template = QUIZ_TEMPLATES.find(t => t.type === 'news')!;
    } else if (domain.includes('edu') || domain.includes('arxiv') || domain.includes('pubmed')) {
      template = QUIZ_TEMPLATES.find(t => t.type === 'academic')!;
    } else if (domain.includes('twitter') || domain.includes('facebook') || domain.includes('instagram')) {
      template = QUIZ_TEMPLATES.find(t => t.type === 'social')!;
    }
  } catch {
    // Use default template
  }

  return {
    id: source.id,
    title: source.title || source.url,
    text: `Contenuto da: ${source.title || source.url}`
  };
}

// -------------------------------------------------------------
// CHIP STATE UTILITIES

export function getChipState(state: SourceGateState) {
  switch (state) {
    case 'pending':
      return {
        color: 'bg-muted text-muted-foreground',
        icon: '⏳',
        tooltip: 'Comprehension Gate™: In attesa di lettura'
      };
    case 'reading':
      return {
        color: 'bg-primary text-primary-foreground animate-pulse',
        icon: '📖',
        tooltip: 'Comprehension Gate™: Lettura in corso'
      };
    case 'testing':
      return {
        color: 'bg-accent text-accent-foreground animate-pulse',
        icon: '📝',
        tooltip: 'Comprehension Gate™: Test in corso'
      };
    case 'passed':
      return {
        color: 'bg-trust-high text-trust-high-text',
        icon: '✅',
        tooltip: 'Comprehension Gate™: Superato'
      };
    case 'failed':
      return {
        color: 'bg-trust-low text-trust-low-text',
        icon: '❌',
        tooltip: 'Comprehension Gate™: Non superato - Riprova'
      };
    default:
      return {
        color: 'bg-muted text-muted-foreground',
        icon: '⏳',
        tooltip: 'Comprehension Gate™: In attesa'
      };
  }
}