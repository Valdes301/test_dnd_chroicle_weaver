# D&D 5e Master & Player Campaign Hub - Il Tessitore

[Accedi all'applicazione](https://ais-dev-3ump57qbwimi6zlne4lkxg-835620404917.europe-west2.run.app)

Applicazione completa e reattiva per la gestione delle campagne di D&D 5e per Dungeon Master e Giocatori.

## Caratteristiche Principali

### 1. Bacheca del Gruppo (Taverna)
- **Layout Essenziale e Pulito**: Visualizzazione dedicata esclusivamente alle **Schede dei Personaggi Giocanti** e al **Riassunto della Storia**.
- **Schede dei PG**: Statistiche principali (CA, PF Massimi e Attuali, Punti Esperienza, Livello e Classe). Cliccando o toccando una scheda si accede direttamente al modulo del personaggio.
- **Riassunto Narrativo**: Cronache e pergamena di riepilogo della campagna in formato leggibile.

### 2. Modalità Giocatore & Dungeon Master
- **Visuale Iniziale Giocatore**: All'avvio dell'applicazione in modalità giocatore, è visibile unicamente la **Bacheca del Gruppo** sia nell'area centrale che nella barra di navigazione laterale.
- **Passaggio a Modalità Master**:
  - Se il PIN non è mai stato impostato, toccando l'icona di passaggio al profilo Master viene aperta automaticamente la **scheda di impostazione del PIN**.
  - Se il PIN è già configurato, viene mostrato il prompt per l'inserimento del **PIN di sicurezza** (o password di emergenza).
- **Idratazione SSR Robusta**: Gestione sincrona degli stati server/client per prevenire errori di rendering durante il caricamento iniziale.

### 3. Navigazione & Strumenti Sidebar
- **Logo Dadi d20**: Icona interattiva per espandere e comprimere la barra di navigazione su dispositivi desktop, tablet e smartphone.
- **Strumenti DM**: Architetto di Mondi, Arena Combattimenti, Botteghe ed Empori, Emporio dei Volti (PNG), Generatore di Tesori, Mappe e Compendi Ufficiali D&D 5e (Incantesimi, Mostri, Oggetti Magici, Abilità).

### 4. Prestazioni, Reattività e Fluidità Mobile
- **Reattività Istantanea al Singolo Tocco (1-Tap Fast Response)**: Risolto ogni ritardo o "doppio tocco" su smartphone e tablet aggiungendo gestori touch nativi (`onTouchEnd` con `preventDefault`) su tutte le icone di navigazione, i pulsanti della bacheca e i dadi d20.
- **Inserimento PIN Senza Tastiera OS (Tastierino Dedicato)**: Rimosso il campo di input di testo reale dal dialog di verifica PIN. L'inserimento avviene esclusivamente tramite il tastierino numerico magico sullo schermo (o da tastiera fisica PC/Mac), impedendo al sistema operativo dello smartphone di far comparire la tastiera virtuale nativa che copriva l'interfaccia.
- **Throttling I/O di Sicurezza**: Tracciamento dell'attività dell'utente ottimizzato con memoria ad accesso rapido per azzerare le scritture sincrone ridondanti su `localStorage` durante i movimenti del cursore o lo scroll.
- **Transizioni Fluide**: Passaggio istantaneo tra le schede con micro-animazioni CSS accelerate via hardware e caricamento asincrono leggero.
- **Aggiornamenti Reattivi Senza Ricaricamento**: Eliminati i ricaricamenti forzati della pagina a favore di refresh reattivi del router Next.js, preservando la memoria e lo stato dell'interfaccia.
