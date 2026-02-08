/// <reference types="vite/client" />

// Twitter widgets types
interface Window {
  twttr?: {
    widgets: {
      load: (element?: HTMLElement) => void;
    };
  };
}
