'use client';

import { useEffect, useState } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isServerActionMismatch, setIsServerActionMismatch] = useState(false);

  useEffect(() => {
    console.error('Application Error Boundary Caught:', error);

    const errorMessage = error?.message || '';
    const isOutdatedAction = 
      errorMessage.includes('Failed to find Server Action') ||
      errorMessage.includes('older or newer deployment') ||
      errorMessage.includes('An unexpected response was received from the server');

    if (isOutdatedAction) {
      setIsServerActionMismatch(true);
      // Auto-reload veloce e resiliente per sincronizzare la versione client con il server
      const lastReload = sessionStorage.getItem('last_action_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 2500) {
        sessionStorage.setItem('last_action_reload', now.toString());
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 300);
      }
      return;
    }

    if (
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('chunk') ||
      errorMessage.includes('Loading CSS chunk') ||
      errorMessage.includes('Unexpected token')
    ) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div id="error-boundary-container" className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground">
      <div id="error-card" className="bg-card rounded-xl shadow-lg border border-border p-8 max-w-md w-full text-center">
        <div id="error-icon" className="w-16 h-16 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 id="error-title" className="text-xl font-bold font-cinzel mb-2">
          {isServerActionMismatch ? "Aggiornamento Applicazione" : "Qualcosa è andato storto"}
        </h2>
        <p id="error-desc" className="text-muted-foreground mb-6 text-sm">
          {isServerActionMismatch 
            ? "L'applicazione è stata aggiornata sul server. È necessario ricaricare la pagina per sincronizzare le azioni con la nuova versione."
            : "Si è verificato un errore imprevisto durante l'esecuzione dell'applicazione."}
        </p>
        <button
          id="error-reset-button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 px-4 rounded-lg transition duration-200 shadow-sm text-sm"
        >
          Aggiorna la pagina adesso
        </button>
      </div>
    </div>
  );
}
