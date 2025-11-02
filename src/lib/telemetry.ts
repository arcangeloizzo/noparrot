import { READER_GATE_CONFIG } from '@/config/brand';

export type ReaderTelemetryEvent =
  | {
      type: 'reader_view_opened';
      articleId: string;
      totalBlocks: number;
      totalWords: number;
    }
  | {
      type: 'reader_block_completed';
      articleId: string;
      blockId: string;
      blockIndex: number;
      dwellMs: number;
      coverage: number;
      words: number;
    }
  | {
      type: 'reader_velocity_violation';
      articleId: string;
      velocity: number;
      threshold: number;
    }
  | {
      type: 'reader_unlock_reached';
      articleId: string;
      readRatio: number;
      readBlocks: number;
      totalBlocks: number;
      timeMs: number;
    }
  | {
      type: 'gate_test_started';
      articleId: string;
      finalReadRatio: number;
    };

export function sendReaderTelemetry(event: ReaderTelemetryEvent) {
  if (READER_GATE_CONFIG.debug) {
    console.log('[Reader Telemetry]', event);
  }

  // Store in localStorage for QA/testing
  try {
    const events = JSON.parse(localStorage.getItem('reader_telemetry') || '[]');
    events.push({ ...event, timestamp: new Date().toISOString() });
    
    // Keep only last 100 events
    const trimmedEvents = events.slice(-100);
    localStorage.setItem('reader_telemetry', JSON.stringify(trimmedEvents));
  } catch (error) {
    console.error('[Reader Telemetry] Failed to store event:', error);
  }

  // TODO: Future - Send to Supabase analytics or external service
  // await supabase.from('reader_analytics').insert({ ...event });
}

// Utility to retrieve telemetry for debugging
export function getReaderTelemetry(): ReaderTelemetryEvent[] {
  try {
    return JSON.parse(localStorage.getItem('reader_telemetry') || '[]');
  } catch {
    return [];
  }
}

// Clear telemetry data
export function clearReaderTelemetry() {
  localStorage.removeItem('reader_telemetry');
}
