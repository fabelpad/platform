/// <reference types="vite/client" />

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

/** Registers the offline shell on the published app, never on the dev server. */
export function registerPwa(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // The online app remains usable if this browser or host blocks offline storage.
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
