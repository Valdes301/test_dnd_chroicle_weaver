import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Tessitore di Cronache',
  description: "Gestisci le tue campagne D&D 5e con la potenza dell'IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function checkAndReload(msg) {
                  if (typeof msg === 'string' && (
                    msg.includes('Failed to find Server Action') ||
                    msg.includes('older or newer deployment') ||
                    msg.includes('An unexpected response was received from the server')
                  )) {
                    var last = sessionStorage.getItem('last_sa_reload');
                    var now = Date.now();
                    if (!last || now - parseInt(last, 10) > 2500) {
                      sessionStorage.setItem('last_sa_reload', now.toString());
                      setTimeout(function() {
                        window.location.reload();
                      }, 300);
                    }
                  }
                }
                window.addEventListener('error', function(e) {
                  checkAndReload(e && (e.message || (e.error && e.error.message)));
                });
                window.addEventListener('unhandledrejection', function(e) {
                  var reason = e && e.reason;
                  var msg = reason ? (reason.message || String(reason)) : '';
                  checkAndReload(msg);
                });
              })();
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
