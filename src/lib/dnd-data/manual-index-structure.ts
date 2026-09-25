export interface Paragraph {
  id: string; // e.g., "phb-c1-p1"
  title: string; // e.g., "Giocatore o DM?"
  subsections?: string[]; // Sotto-argomenti per guidare l'IA
}

export interface Chapter {
  id: string; // e.g., "phb-c1"
  title: string; // e.g., "Cap. 1: Come Si Gioca"
  paragraphs: Paragraph[];
}

export interface Manual {
  id: 'phb' | 'dmg';
  title: string;
  chapters: Chapter[];
}

export const phbManualStructure: Chapter[] = [
  {
    id: "phb-c0",
    title: "Benvenuti nell'avventura",
    paragraphs: [
      { id: "phb-c0-cosa-serve", title: "Cosa Serve" },
      { id: "phb-c0-come-usare", title: "Come Usare questo Libro" },
      { id: "phb-c0-mondi", title: "Mondi dell'Avventura" }
    ]
  },
  {
    id: "phb-c1",
    title: "Cap. 1: Come Si Gioca",
    paragraphs: [
      { id: "phb-c1-giocatore-dm", title: "Giocatore o DM?" },
      { id: "phb-c1-ritmo", title: "Ritmo di Gioco" },
      { id: "phb-c1-gioco-continuo", title: "Un Gioco Continuo" },
      { id: "phb-c1-dadi", title: "Dadi" },
      { id: "phb-c1-caratteristiche", title: "Le Sei Caratteristiche" },
      { id: "phb-c1-prove-d20", title: "Prove con D20", subsections: ["Prove di Caratteristica", "Tiri Salvezza", "Tiri per Colpire", "Vantaggio/Svantaggio"] },
      { id: "phb-c1-competenza", title: "Competenza" },
      { id: "phb-c1-azioni", title: "Azioni", subsections: ["Azioni Bonus", "Reazioni"] },
      { id: "phb-c1-interazioni-sociali", title: "Interazioni Sociali" },
      { id: "phb-c1-esplorazione", title: "Esplorazione", subsections: ["Visione e Illuminazione", "Nascondersi", "Interazioni con gli Oggetti", "Pericoli", "Viaggiare"] },
      { id: "phb-c1-combattimento", title: "Combattimento", subsections: ["L'Ordine di Combattimento", "Movimento e Posizione", "Effettuare un Attacco", "Attacchi a Distanza", "Attacchi in Mischia", "Combattere in Sella", "Combattere Sott'Acqua"] },
      { id: "phb-c1-danni-guarigione", title: "Danni e Guarigione", subsections: ["Punti Ferita", "Tiri per i Danni", "Colpi Critici", "Tiri Salvezza e Danni", "Tipi di Danno", "Resistenza e Vulnerabilità", "Immunità", "Guarigione", "Scendere a 0 Punti Ferita", "Punti Ferita Temporanei"] },
      { id: "phb-c1-condizioni", title: "Condizioni" }
    ]
  },
  {
    id: "phb-c2",
    title: "Cap. 2: Creare un Personaggio",
    paragraphs: [
      { id: "phb-c2-creare", title: "Creare il Personaggio" },
      { id: "phb-c2-avanzamento", title: "Avanzamento di Livello" },
      { id: "phb-c2-livelli-superiori", title: "Iniziare a Livelli Superiori" },
      { id: "phb-c2-multiclasse", title: "Multiclasse" },
      { id: "phb-c2-monili", title: "Monili" }
    ]
  },
  {
    id: "phb-c3",
    title: "Cap. 3: Classi dei Personaggi",
    paragraphs: [
      { id: "phb-c3-barbaro", title: "Barbaro", subsections: ["Cammino dell'Albero del Mondo", "Cammino del Berserker", "Cammino del Cuore Selvaggio", "Cammino dello Zelota"] },
      { id: "phb-c3-bardo", title: "Bardo", subsections: ["Lista degli Incantesimi da Bardo", "Collegio della Danza", "Collegio del Fascino", "Collegio della Sapienza", "Collegio del Valore"] },
      { id: "phb-c3-chierico", title: "Chierico", subsections: ["Lista degli Incantesimi da Chierico", "Dominio della Guerra", "Dominio dell'Inganno", "Dominio della Luce", "Dominio della Vita"] },
      { id: "phb-c3-druido", title: "Druido", subsections: ["Lista degli Incantesimi da Druido", "Circolo della Luna", "Circolo del Mare", "Circolo delle Stelle", "Circolo della Terra"] },
      { id: "phb-c3-guerriero", title: "Guerriero", subsections: ["Campione", "Cavaliere Mistico", "Guerriero Psionico", "Maestro di Battaglia"] },
      { id: "phb-c3-ladro", title: "Ladro", subsections: ["Assassino", "Furfante", "Lama Spirituale", "Mistificatore Arcano"] },
      { id: "phb-c3-mago", title: "Mago", subsections: ["Lista degli incantesimi da mago", "Abiuratore", "Divinatore", "Illusionista", "Invocatore"] },
      { id: "phb-c3-monaco", title: "Monaco", subsections: ["Guerriero degli Elementi", "Guerriero della Mano Aperta", "Guerriero della Misericordia", "Guerriero dell'Ombra"] },
      { id: "phb-c3-paladino", title: "Paladino", subsections: ["Lista degli Incantesimi da Paladino", "Giuramento degli Antichi", "Giuramento di Devozione", "Giuramento di Gloria", "Giuramento di Vendetta"] },
      { id: "phb-c3-ranger", title: "Ranger", subsections: ["Lista degli Incantesimi da Ranger", "Cacciatore", "Cacciatore delle Tenebre", "Signore delle Bestie", "Viandante Fatato"] },
      { id: "phb-c3-stregone", title: "Stregone", subsections: ["Opzioni di Metamagia", "Lista degli Incantesimi da Stregone", "Stregoneria Aberrante", "Stregoneria Draconica", "Stregoneria della Magia Selvaggia", "Stregoneria Meccanica"] },
      { id: "phb-c3-warlock", title: "Warlock", subsections: ["Opzioni di Suppliche Occulte", "Lista degli Incantesimi da Warlock", "Patrono Celestiale", "Patrono Grande Antico", "Patrono Immondo", "Patrono Signore Fatato"] }
    ]
  },
  {
    id: "phb-c4",
    title: "Cap. 4: Origini dei Personaggi",
    paragraphs: [
      { id: "phb-c4-componenti", title: "Componenti delle Origini" },
      { id: "phb-c4-background", title: "Descrizioni dei Background", subsections: ["Accolito", "Artigiano", "Ciarlatano", "Contadino", "Criminale", "Eremita", "Guardia", "Guida", "Intrattenitore", "Marinaio", "Mercante", "Nobile", "Sapiente", "Scriba", "Soldato", "Viandante"] },
      { id: "phb-c4-specie", title: "Descrizioni delle Specie", subsections: ["Aasimar", "Dragonide", "Elfo", "Gnomo", "Goliath", "Halfling", "Nano", "Orco", "Tiefling", "Umano"] }
    ]
  },
  {
    id: "phb-c5",
    title: "Cap. 5: Talenti",
    paragraphs: [
      { id: "phb-c5-descrizioni", title: "Descrizioni dei Talenti" },
      { id: "phb-c5-talenti-origini", title: "Talenti Origini" },
      { id: "phb-c5-talenti-generali", title: "Talenti Generali" },
      { id: "phb-c5-talenti-stile", title: "Talenti Stile di Combattimento" },
      { id: "phb-c5-talenti-dono", title: "Talenti Dono Epico" }
    ]
  },
  {
    id: "phb-c6",
    title: "Cap. 6: Equipaggiamento",
    paragraphs: [
      { id: "phb-c6-monete", title: "Monete" },
      { id: "phb-c6-armi", title: "Armi", subsections: ["Proprietà", "Proprietà di Padronanza"] },
      { id: "phb-c6-armature", title: "Armature" },
      { id: "phb-c6-strumenti", title: "Strumenti" },
      { id: "phb-c6-equipaggiamento-avventura", title: "Equipaggiamento d'Avventura" },
      { id: "phb-c6-cavalcature-veicoli", title: "Cavalcature e Veicoli" },
      { id: "phb-c6-servizi", title: "Servizi" },
      { id: "phb-c6-oggetti-magici", title: "Oggetti Magici" },
      { id: "phb-c6-creare-equipaggiamento", title: "Creare Equipaggiamento" }
    ]
  },
  {
    id: "phb-c7",
    title: "Cap. 7: Incantesimi",
    paragraphs: [
      { id: "phb-c7-ottenere", title: "Ottenere Incantesimi" },
      { id: "phb-c7-lanciare", title: "Lanciare gli Incantesimi" },
      { id: "phb-c7-descrizioni", title: "Descrizioni degli Incantesimi" }
    ]
  },
  {
    id: "phb-c8",
    title: "App. A: Il Multiverso",
    paragraphs: [
      { id: "phb-c8-regni", title: "I Regni Materiali" },
      { id: "phb-c8-piani-transizione", title: "Piani di Transizione" },
      { id: "phb-c8-piani-interni", title: "I Piani Interni" },
      { id: "phb-c8-piani-esterni", title: "I Piani Esterni" }
    ]
  },
  {
    id: "phb-c9",
    title: "App. B: Schede delle Statistiche delle Creature",
    paragraphs: [
      { id: "phb-c9-schede", title: "Schede delle Statistiche delle Creature" }
    ]
  },
  {
    id: "phb-c10",
    title: "App. C: Glossario delle regole",
    paragraphs: [
      { id: "phb-c10-glossario", title: "Glossario delle regole" }
    ]
  }
];

export const dmgManualStructure: Chapter[] = [
  {
    id: "dmg-c1",
    title: "Capitolo 1: Le Basi",
    paragraphs: [
      { id: "dmg-c1-che-cosa-fa", title: "Che Cosa Fa un DM?" },
      { id: "dmg-c1-di-cosa-hai", title: "Di Cosa Hai Bisogno" },
      { id: "dmg-c1-preparare", title: "Preparare una Sessione" },
      { id: "dmg-c1-come-gestire", title: "Come Gestire una Sessione" },
      { id: "dmg-c1-partita-esempio", title: "Partita di Esempio" },
      { id: "dmg-c1-ogni-dm-unico", title: "Ogni DM È Unico" },
      { id: "dmg-c1-garantire", title: "Garantire il Divertimento di Tutti", subsections: ["Rispetto Reciproco", "Rispetto per i Giocatori", "Rispetto per il DM"] }
    ]
  },
  {
    id: "dmg-c2",
    title: "Capitolo 2: Condurre il Gioco",
    paragraphs: [
      { id: "dmg-c2-conoscere-giocatori", title: "Conoscere i Giocatori" },
      { id: "dmg-c2-dimensioni-gruppo", title: "Dimensioni del Gruppo" },
      { id: "dmg-c2-vari-dm", title: "Vari DM" },
      { id: "dmg-c2-narrazione", title: "Narrazione" },
      { id: "dmg-c2-determinare-esiti", title: "Determinare gli Esiti", subsections: ["Prove di Caratteristica", "Tiri per Colpire", "Tiri Salvezza", "Classe Difficoltà", "Vantaggio e Svantaggio", "Conseguenze", "Improvvisare i Danni", "Improvvisare le Risposte"] },
      { id: "dmg-c2-interazioni-sociali", title: "Gestire le Interazioni Sociali", subsections: ["Interpretare il Ruolo", "Atteggiamento"] },
      { id: "dmg-c2-condurre-esplorazione", title: "Condurre l'Esplorazione", subsections: ["Usare una Mappa", "Tenere Traccia del Tempo", "Azioni in Esplorazione", "Percezione", "Viaggio"] },
      { id: "dmg-c2-condurre-combattimenti", title: "Condurre i Combattimenti", subsections: ["Tirare per l'Iniziativa", "Tenere Traccia dell'Iniziativa", "Tenere il Conto dei Punti Ferita dei Mostri", "Usare e Annotare le Condizioni", "Miniature", "Conteggiare la Posizione sulle Lunghe Distanze", "Narrare i Combattimenti", "Proseguire i Combattimenti", "Adeguare la Difficoltà", "Lottare o Fuggire"] },
      { id: "dmg-c2-avanzamento-personaggi", title: "Avanzamento dei Personaggi" }
    ]
  },
  {
    id: "dmg-c3",
    title: "Capitolo 3: Strumenti del DM",
    paragraphs: [
      { id: "dmg-c3-allineamento", title: "Allineamento" },
      { id: "dmg-c3-armi-fuoco", title: "Armi da Fuoco ed Esplosivi" },
      { id: "dmg-c3-creare-background", title: "Creare un Background" },
      { id: "dmg-c3-creare-incantesimo", title: "Creare un Incantesimo" },
      { id: "dmg-c3-creare-oggetto", title: "Creare un Oggetto Magico" },
      { id: "dmg-c3-creare-creatura", title: "Creare una Creatura" },
      { id: "dmg-c3-dei-poteri", title: "Dèi e Altri Poteri" },
      { id: "dmg-c3-dungeon", title: "Dungeon" },
      { id: "dmg-c3-effetti-ambientali", title: "Effetti Ambientali" },
      { id: "dmg-c3-equipaggiamento-assedio", title: "Equipaggiamento d'Assedio" },
      { id: "dmg-c3-fama", title: "Fama" },
      { id: "dmg-c3-insediamenti", title: "Insediamenti" },
      { id: "dmg-c3-inseguimenti", title: "Inseguimenti" },
      { id: "dmg-c3-maledizioni", title: "Maledizioni e Contagi Magici" },
      { id: "dmg-c3-morte", title: "Morte" },
      { id: "dmg-c3-orde", title: "Orde" },
      { id: "dmg-c3-paura-stress", title: "Paura e Stress Mentale" },
      { id: "dmg-c3-pericoli", title: "Pericoli" },
      { id: "dmg-c3-png", title: "Personaggi Non Giocanti" },
      { id: "dmg-c3-porte", title: "Porte" },
      { id: "dmg-c3-qualita-soprannaturali", title: "Qualità Soprannaturali" },
      { id: "dmg-c3-simboli-prestigio", title: "Simboli di Prestigio" },
      { id: "dmg-c3-trappole", title: "Trappole" },
      { id: "dmg-c3-veleno", title: "Veleno" }
    ]
  },
  {
    id: "dmg-c4",
    title: "Capitolo 4: Creare le Avventure",
    paragraphs: [
      { id: "dmg-c4-fasi", title: "Fasi dell'Avventura" },
      { id: "dmg-c4-premessa", title: "Delineare la Premessa", subsections: ["Premessa dell'Avventura", "Conflitto dell'Avventura", "Situazioni di Avventura per Livello"] },
      { id: "dmg-c4-ambientazione", title: "Ambientazione dell'Avventura" },
      { id: "dmg-c4-far-appassionare", title: "Far Appassionare i Giocatori", subsections: ["Patroni dell'Avventura", "Spunti Soprannaturali", "Spunti per Eventi Fortuiti"] },
      { id: "dmg-c4-pianificare-incontri", title: "Pianificare gli Incontri" },
      { id: "dmg-c4-obiettivi", title: "Obiettivi dei Personaggi" },
      { id: "dmg-c4-proseguire", title: "Proseguire l'Avventura", subsections: ["Qualcosa per Chiunque", "Diversi Modi per Proseguire"] },
      { id: "dmg-c4-interazioni-sociali", title: "Interazioni Sociali" },
      { id: "dmg-c4-esplorazioni", title: "Esplorazioni" },
      { id: "dmg-c4-combattimenti", title: "Combattimenti" },
      { id: "dmg-c4-comportamento-mostri", title: "Comportamento dei Mostri" },
      { id: "dmg-c4-ritmo-ritmo", title: "Ritmo degli Incontri e Tensione" },
      { id: "dmg-c4-portare-a-termine", title: "Portare a Termine la Campagna", subsections: ["Epilogo", "Ricompense dell'Avventura", "Esempi di Avventura"] }
    ]
  },
  {
    id: "dmg-c5",
    title: "Capitolo 5: Creare le Campagne",
    paragraphs: [
      { id: "dmg-c5-fasi-campagna", title: "Fasi della Campagna" },
      { id: "dmg-c5-diario", title: "Il Diario della Campagna" },
      { id: "dmg-c5-premessa-campagna", title: "Premessa della Campagna" },
      { id: "dmg-c5-personaggi-campagna", title: "Personaggi della Campagna" },
      { id: "dmg-c5-conflitti-campagna", title: "Conflitti nella Campagna" },
      { id: "dmg-c5-generi-fantasy", title: "Generi Fantasy" },
      { id: "dmg-c5-ambientazione-campagna", title: "Ambientazione della Campagna" },
      { id: "dmg-c5-inizio", title: "Inizio della Campagna" },
      { id: "dmg-c5-pianificare-avventure", title: "Pianificare le Avventure" },
      { id: "dmg-c5-episodi-serie", title: "Episodi e Serie" },
      { id: "dmg-c5-coinvolgere", title: "Coinvolgere i Giocatori" },
      { id: "dmg-c5-misurare-tempo", title: "Misurare il Tempo nella Campagna" },
      { id: "dmg-c5-concludere", title: "Concludere una Campagna" },
      { id: "dmg-c5-greyhawk", title: "Greyhawk", subsections: ["Nomi Importanti", "Premessa di Greyhawk", "Città Libera di Greyhawk", "Guida di Greyhawk"] }
    ]
  },
  {
    id: "dmg-c6",
    title: "Capitolo 6: Cosmologia",
    paragraphs: [
      { id: "dmg-c6-i-piani", title: "I Piani" },
      { id: "dmg-c6-viaggi-planari", title: "Viaggi Planari" },
      { id: "dmg-c6-avventure-planari", title: "Avventure Planari" },
      { id: "dmg-c6-multiverso", title: "Viaggio nel Multiverso" }
    ]
  },
  {
    id: "dmg-c7",
    title: "Capitolo 7: Tesori",
    paragraphs: [
      { id: "dmg-c7-temi", title: "Temi dei Tesori" },
      { id: "dmg-c7-monete", title: "Monete" },
      { id: "dmg-c7-lingotti", title: "Lingotti Commerciali" },
      { id: "dmg-c7-merci", title: "Merci" },
      { id: "dmg-c7-gemme", title: "Gemme" },
      { id: "dmg-c7-oggetti-arte", title: "Oggetti d'Arte" },
      { id: "dmg-c7-oggetti-magici", title: "Oggetti Magici", subsections: ["Categorie di Oggetti Magici", "Rarità degli Oggetti Magici", "Assegnare Oggetti Magici", "Attivare un Oggetto Magico", "L'Alba Successiva", "Oggetti Maledetti", "Resilienza degli Oggetti Magici", "Creare Oggetti Magici", "Caratteristiche Speciali degli Oggetti Magici", "Manufatti", "Oggetti Magici Senzienti", "Oggetti Magici A-Z", "Oggetti Magici Casuali"] }
    ]
  },
  {
    id: "dmg-c8",
    title: "Capitolo 8: Roccaforti",
    paragraphs: [
      { id: "dmg-c8-ottenere", title: "Ottenere una Roccaforte" },
      { id: "dmg-c8-turni", title: "Turni della Roccaforte" },
      { id: "dmg-c8-mappa", title: "Mappa della Roccaforte" },
      { id: "dmg-c8-strutture-base", title: "Strutture di Base" },
      { id: "dmg-c8-strutture-speciali", title: "Strutture Speciali" },
      { id: "dmg-c8-ordini", title: "Ordini" },
      { id: "dmg-c8-eventi", title: "Eventi nella Roccaforte" },
      { id: "dmg-c8-perdita", title: "Perdita di una Roccaforte" }
    ]
  },
  {
    id: "dmg-c9",
    title: "Appendice A: Glossario Esplicativo",
    paragraphs: [
      { id: "dmg-c9-glossario", title: "Glossario Esplicativo" }
    ]
  },
  {
    id: "dmg-c10",
    title: "Appendice B: Mappe",
    paragraphs: [
      { id: "dmg-c10-mappe", title: "Mappe di Riferimento", subsections: ["Accampamento di Carovane", "Casa Spettrale", "Cripta dei Tumuli", "Dedalo del Sottosuolo", "Fattoria", "Fortezza", "Grotte Vulcaniche", "Locanda sul Ciglio della Strada", "Maniero", "Miniera", "Nascondiglio del Dungeon", "Nave", "Tana del Drago", "Torre del Mago", "Villaggio Crocevia"] }
    ]
  },
  {
    id: "dmg-c11",
    title: "Schede di Tracciamento",
    paragraphs: [
      { id: "dmg-c11-aspettative", title: "Aspettative sul gioco" },
      { id: "dmg-c11-pianificazione-viaggio", title: "Scheda di Pianificazione del Viaggio" },
      { id: "dmg-c11-tracciamento-insediamenti", title: "Tracciamento degli Insediamenti" },
      { id: "dmg-c11-tracciamento-png", title: "Tracciamento dei PNG" },
      { id: "dmg-c11-diario-campagna", title: "Diario della Campagna" },
      { id: "dmg-c11-riepilogo-personaggio", title: "Riepilogo del personaggio del DM" },
      { id: "dmg-c11-conflitti", title: "Conflitti nella Campagna" },
      { id: "dmg-c11-tracciamento-oggetti", title: "Tracciamento degli Oggetti Magici" },
      { id: "dmg-c11-scheda-roccaforte", title: "Scheda della Roccaforte" }
    ]
  }
];

export const allManuals: Manual[] = [
  {
    id: 'phb',
    title: 'Manuale del Giocatore (PHB)',
    chapters: phbManualStructure
  },
  {
    id: 'dmg',
    title: 'Manuale del Master (DMG)',
    chapters: dmgManualStructure
  }
];

// Trova un paragrafo per ID e restituisce il percorso completo
export function findParagraphById(id: string) {
  for (const m of allManuals) {
    for (const c of m.chapters) {
      const p = c.paragraphs.find(p => p.id === id);
      if (p) {
        return {
          manual: m,
          chapter: c,
          paragraph: p
        };
      }
    }
  }
  return null;
}
