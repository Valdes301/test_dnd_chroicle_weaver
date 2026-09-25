'use server';

/**
 * @fileOverview Flow per consolidare, deduplicare e riordinare cronologicamente la Lore,
 * con verifica di consistenza e rilevamento paradossi, fedele al canone D&D 5e e Forgotten Realms.
 */

import { getGenAI, DEFAULT_FLASH_MODEL, safeGenerateContent } from '@/ai/genai-client';
import { Type } from '@google/genai';
import type { LoreConsolidationResult, LoreMilestone, LoreConflict } from '@/lib/types';

export interface ConsolidateLoreInput {
  title?: string;
  category?: 'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale';
  subtitle?: string;
  content: string;
  tags?: string;
  notesToMerge?: string[];
  instruction?: string;
  systemOverride?: string;
}

const CONSOLIDATION_SYSTEM_PROMPT = `Sei il Sommo Cronista e Archivista di Candlekeep per D&D 5e e Forgotten Realms. Il tuo compito è unificare, deduplicare ed ordinare cronologicamente informazioni e appunti di ambientazione.

OBIETTIVI FONDAMENTALI:
1. DEDUPLICAZIONE SEMANTICA: Identifica concetti, fatti o descrizioni ripetute o ridondanti. Fondili in un testo fluido ed esaustivo senza perdere NESSUN dettaglio utile o nome canonico.
2. ORDINAMENTO CRONOLOGICO STRUTTURATO: Riorganizza i fatti storici dal più antico al più recente. Estrai o stima la datazione canonica in Dalereckoning (es. '-300 DR', '1372 DR', '1492 DR') o per Ere (es. 'Era dei Miti', 'Secoli Bui', 'Età del Disfacimento', 'Presente').
3. INDICE CRONOLOGICO (chronology_order): Fornisci un valore numerico intero (da 0 per l'antico passato a 2000 per gli eventi contemporanei/futuri) per ordinare l'evento nella Timeline complessiva del mondo.
4. RILEVAMENTO PARADOSSI & CONFLITTI: Se rilevi incongruenze temporali o logiche (es. personaggi che agiscono dopo la morte, date discordanti), segnalale chiaramente.
5. RIGOROSO CANONE UFFICIALE: Non inventare MAI falsi storici. Se un dettaglio non è chiaramente datato, usa una stima contestuale precisa ("Circa...", "Durante il regno di...").

FORMATO RESTITUITO:
- title: Titolo del dossier (pulito ed elegante)
- category: Una tra 'citta', 'storia', 'personaggio', 'fazione', 'generale'
- subtitle: Breve sommarietto / epoca di riferimento
- content: Testo Markdown completo, ben diviso in sezioni storiche coerenti ed esaustive
- tags: Tag separati da virgola
- era: Nome dell'era o periodo principale (es. '1492 DR - Epoca Attuale', 'Era dei Miti', '1358 DR - Tempo dei Disordini')
- year_dr: Anno o intervallo in Dalereckoning (es. '1492 DR' o '1358-1372 DR')
- chronology_order: Numero intero (es. 100 per preistoria, 1000 per medioevo reame, 1492 per eventi moderni)
- deduplicationSummary: Array di stringhe che riassume cosa è stato fuso, rimosso o unificato
- milestones: Array di tappe cronologiche con { dateOrEra, title, description, importance: 'epico' | 'maggiore' | 'minore' }
- conflicts: Array di conflitti/paradossi rilevati con { topic, description, advice } (vuoto se nessuno)`;

export async function consolidateAndDeduplicateLore(input: ConsolidateLoreInput): Promise<LoreConsolidationResult> {
  const genAi = getGenAI('GEMINI_API_KEY_WORLD');

  const promptParts: string[] = [];
  if (input.title) promptParts.push(`Dossier Base: "${input.title}" (Categoria: ${input.category || 'generale'})`);
  if (input.subtitle) promptParts.push(`Sottotitolo / Note attuali: ${input.subtitle}`);
  
  promptParts.push(`TESTO PRINCIPALE ATTUALE:\n\`\`\`\n${input.content}\n\`\`\``);

  if (input.notesToMerge && input.notesToMerge.length > 0) {
    promptParts.push(`NOTE GREZZE / FRAMMENTI DA FONDE E DEDUPLICARE NEL DOSSIER:\n` + 
      input.notesToMerge.map((n, i) => `[Nota #${i + 1}]:\n${n}`).join('\n\n'));
  }

  if (input.instruction) {
    promptParts.push(`ISTRUZIONI SPECIALI DEL DUNGEON MASTER:\n${input.instruction}`);
  }

  promptParts.push(`Esegui la deduplicazione semantica, la riorganizzazione cronologica e l'estrazione delle tappe temporali.`);

  const response = await safeGenerateContent(genAi, {
    model: DEFAULT_FLASH_MODEL,
    contents: promptParts.join('\n\n'),
    config: {
      systemInstruction: input.systemOverride || CONSOLIDATION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { 
            type: Type.STRING, 
            enum: ['citta', 'storia', 'personaggio', 'fazione', 'generale'] 
          },
          subtitle: { type: Type.STRING },
          content: { type: Type.STRING, description: 'Testo consolidato e deduplicato in Markdown' },
          tags: { type: Type.STRING },
          era: { type: Type.STRING, description: 'Era o periodo' },
          year_dr: { type: Type.STRING, description: 'Anno o intervallo Dalereckoning' },
          chronology_order: { type: Type.INTEGER, description: 'Indice numerico per ordinamento temporale' },
          deduplicationSummary: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Sintesi delle deduplicazioni e accorpamenti eseguiti'
          },
          milestones: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dateOrEra: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                importance: { type: Type.STRING, enum: ['epico', 'maggiore', 'minore'] }
              },
              required: ['dateOrEra', 'title', 'description']
            }
          },
          conflicts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                description: { type: Type.STRING },
                advice: { type: Type.STRING }
              },
              required: ['topic', 'description', 'advice']
            }
          }
        },
        required: ['title', 'category', 'subtitle', 'content', 'tags', 'era', 'year_dr', 'chronology_order', 'deduplicationSummary', 'milestones', 'conflicts']
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("L'Archivista non ha restituito dati di consolidamento.");
  }

  try {
    return JSON.parse(text) as LoreConsolidationResult;
  } catch (err) {
    const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean) as LoreConsolidationResult;
  }
}

export interface SynthesizeInboxOutput {
  processedNotesCount: number;
  newEntriesCreated: number;
  existingEntriesUpdated: number;
  summary: string;
}

export async function synthesizeInboxNotes(
  rawNotes: { id: string; content: string }[],
  existingEntries: { id: string; title: string; category: string; content: string }[]
): Promise<{
  planSummary: string;
  actions: {
    actionType: 'create' | 'update';
    targetEntryId?: string;
    title: string;
    category: 'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale';
    subtitle: string;
    content: string;
    tags: string;
    era: string;
    year_dr: string;
    chronology_order: number;
    notesMergedIds: string[];
    changeSummary: string;
  }[];
}> {
  const genAi = getGenAI('GEMINI_API_KEY_WORLD');

  const notesFormatted = rawNotes.map((n, idx) => `[NOTA ID: ${n.id} (#${idx+1})]:\n${n.content}`).join('\n\n');
  const existingFormatted = existingEntries.length > 0 
    ? existingEntries.map(e => `[DOSSIER ESISTENTE ID: ${e.id}] Titolo: "${e.title}" | Categoria: ${e.category}\nEstratto:\n${e.content.slice(0, 400)}...`).join('\n\n')
    : "Nessun dossier canonico esistente.";

  const prompt = `Hai il compito di analizzare queste NOTE GREZZE dall'Inbox del DM e fonderle nel Canone Ufficiale.

DOSSIER CANONICI ESISTENTI NELL'ARCHIVIO:
${existingFormatted}

NOTE GREZZE DA SINTETIZZARE:
${notesFormatted}

ISTRUZIONI:
1. Raggruppa le note per argomento/tema.
2. Se una nota arricchisce un dossier esistente, proponi un'azione 'update' unificando i dati senza duplicazioni.
3. Se una o più note riguardano un nuovo tema, proponi un'azione 'create' per creare un nuovo dossier organico.
4. Ordina i fatti cronologicamente e assegna l'Era, la datazione in DR e il chronology_order.
5. Riporta gli ID delle note fuse in 'notesMergedIds'.`;

  const response = await safeGenerateContent(genAi, {
    model: DEFAULT_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: CONSOLIDATION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          planSummary: { type: Type.STRING, description: 'Sintesi del piano di unificazione e deduplicazione' },
          actions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                actionType: { type: Type.STRING, enum: ['create', 'update'] },
                targetEntryId: { type: Type.STRING, description: 'ID del dossier da aggiornare se actionType è update' },
                title: { type: Type.STRING },
                category: { type: Type.STRING, enum: ['citta', 'storia', 'personaggio', 'fazione', 'generale'] },
                subtitle: { type: Type.STRING },
                content: { type: Type.STRING, description: 'Contenuto consolidato formattato in Markdown' },
                tags: { type: Type.STRING },
                era: { type: Type.STRING },
                year_dr: { type: Type.STRING },
                chronology_order: { type: Type.INTEGER },
                notesMergedIds: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                },
                changeSummary: { type: Type.STRING, description: 'Breve sintesi delle modifiche per il registro versioni' }
              },
              required: ['actionType', 'title', 'category', 'subtitle', 'content', 'tags', 'era', 'year_dr', 'chronology_order', 'notesMergedIds', 'changeSummary']
            }
          }
        },
        required: ['planSummary', 'actions']
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Nessuna proposta di sintesi generata.");
  
  try {
    return JSON.parse(text);
  } catch (err) {
    const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  }
}
