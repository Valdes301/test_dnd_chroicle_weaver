'use server';

/**
 * @fileOverview Flow per espandere, approfondire ed elaborare comandi aggiuntivi su un dossier di lore con l'IA, nel rispetto rigoroso del canone ufficiale.
 */

import { getGenAI, DEFAULT_FLASH_MODEL, safeGenerateContent } from '@/ai/genai-client';
import { Type } from '@google/genai';

export interface ExpandLoreInput {
  title: string;
  category: string;
  currentContent: string;
  instruction: string;
  sourceUrl?: string;
  systemOverride?: string;
}

export interface ExpandLoreOutput {
  content: string;
}

export interface RefineLoreDraftInput {
  title: string;
  category: 'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale';
  subtitle?: string;
  currentContent: string;
  tags?: string;
  instruction: string;
  sourceUrl?: string;
  systemOverride?: string;
}

export interface RefineLoreDraftOutput {
  title: string;
  category: 'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale';
  subtitle: string;
  content: string;
  tags: string;
}

const STRICT_CANON_SYSTEM_PROMPT = `Sei il Grande Archivista di Candlekeep e il massimo esperto del canone ufficiale di D&D 5e e dei Forgotten Realms. Il tuo compito è eseguire comandi e richieste del Dungeon Master per ampliare, approfondire o riorganizzare i dossier di ambientazione.

REGOLE TASSATIVE (ANTI-INVENZIONE / FONTI UFFICIALI E CANONICHE):
1. DIVIETO ASSOLUTO DI INVENTARE INFORMAZIONI: Non inventare MAI dettagli, date, personaggi, fazioni o eventi che non siano verificati e documentati nella lore ufficiale di D&D 5e (Forgotten Realms, manuali WotC, Forgotten Realms Wiki ufficiale) o nelle fonti fornite.
2. ZERO SPECULAZIONI: Se un aspetto richiesto dal DM non ha riscontri ufficiali nel canone o nelle fonti fornite, indicalo esplicitamente con una nota ("Nota Archivistica: la documentazione ufficiale non specifica...") anziché inventare particolari non accertati.
3. DETTAGLI UFFICIALI E CRONOLOGIA: Arricchisci con precisione usando i nomi canonici, i quartieri reali, i governanti storici, la datazione in Dalereckoning (DR) e i riferimenti ai testi ufficiali di D&D 5e.
4. LINGUA & FORMATO: Rispondi in italiano con formattazione Markdown strutturata e professionale (titoli, elenchi, corsivi per termini canonici).`;

export async function expandLore(input: ExpandLoreInput): Promise<ExpandLoreOutput> {
  const genAi = getGenAI('GEMINI_API_KEY_WORLD');

  const prompt = `Dossier da Ampliare / Approfondire:
Titolo: ${input.title}
Categoria: ${input.category}
${input.sourceUrl ? `Fonte / Riferimento Video: ${input.sourceUrl}` : ''}

Contenuto Attuale del Dossier:
\`\`\`
${input.currentContent}
\`\`\`

COMANDO / ISTRUZIONE DEL DUNGEON MASTER:
"${input.instruction}"

Esegui il comando del DM ampliando il contenuto del dossier in formato Markdown. Ricorda di non inventare MAI informazioni e di basarti solo su fonti ufficiali di D&D 5e e sui fatti accertati. Restituisci il contenuto Markdown completo aggiornato.`;

  const response = await safeGenerateContent(genAi, {
    model: DEFAULT_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: input.systemOverride || STRICT_CANON_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: 'Il contenuto del dossier espanso e arricchito in Markdown' }
        },
        required: ['content']
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Nessuna risposta ricevuta per l'espansione del dossier.");
  }

  try {
    const parsed = JSON.parse(responseText) as ExpandLoreOutput;
    return parsed;
  } catch (parseErr) {
    const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleanJson) as ExpandLoreOutput;
  }
}

export async function refineLoreDraft(input: RefineLoreDraftInput): Promise<RefineLoreDraftOutput> {
  const genAi = getGenAI('GEMINI_API_KEY_WORLD');

  const prompt = `Dossier in Elaborazione:
Titolo: ${input.title}
Categoria Attuale: ${input.category}
Sottotitolo: ${input.subtitle || 'N/A'}
Tag: ${input.tags || 'N/A'}
${input.sourceUrl ? `Fonte Video / Link: ${input.sourceUrl}` : ''}

Contenuto Attuale:
\`\`\`
${input.currentContent}
\`\`\`

COMANDO / ISTRUZIONE DEL DUNGEON MASTER:
"${input.instruction}"

Esegui il comando del DM: aggiorna e amplia il testo, il titolo, il sommarietto e i tag se necessario, mantenendo la massima aderenza alle fonti ufficiali di D&D 5e senza MAI inventare dati non canonici.`;

  const response = await safeGenerateContent(genAi, {
    model: DEFAULT_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: input.systemOverride || STRICT_CANON_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Titolo del dossier aggiornato' },
          category: { 
            type: Type.STRING, 
            enum: ['citta', 'storia', 'personaggio', 'fazione', 'generale'], 
            description: 'Categoria del dossier' 
          },
          subtitle: { type: Type.STRING, description: 'Sottotitolo descrittivo' },
          content: { type: Type.STRING, description: 'Contenuto completo aggiornato ed espanso in Markdown' },
          tags: { type: Type.STRING, description: 'Tag separati da virgola' },
        },
        required: ['title', 'category', 'subtitle', 'content', 'tags'],
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Nessuna risposta ricevuta per l'elaborazione del comando.");
  }

  try {
    const parsed = JSON.parse(responseText) as RefineLoreDraftOutput;
    return parsed;
  } catch (parseErr) {
    const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleanJson) as RefineLoreDraftOutput;
  }
}


