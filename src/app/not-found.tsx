'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
      <h2 className="text-4xl font-bold mb-4 font-heading">Pagina non trovata</h2>
      <p className="text-muted-foreground mb-6">La pagina che stai cercando non esiste o è stata spostata.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Torna alla Home
      </Link>
    </div>
  );
}
