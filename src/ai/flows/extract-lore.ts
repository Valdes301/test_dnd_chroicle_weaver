'use server';

/**
 * @fileOverview Flow per estrarre e strutturare informazioni di lore (città, storia, personaggi) da testi o video YouTube.
 */

import { fetchYouTubeDetails } from '@/lib/youtube-helper';
import { getGenAI, DEFAULT_FLASH_MODEL, safeGenerateContent } from '@/ai/genai-client';
import { Type } from '@google/genai';

export interface ExtractLoreInput {
  rawText?: string;
  youtubeUrl?: string;
  promptInstruction?: string;
  systemOverride?: string;
}

export interface ExtractLoreOutput {
  title: string;
  category: 'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale';
  subtitle: string;
  content: string;
  tags: string;
}

export async function extractLore(input: ExtractLoreInput): Promise<ExtractLoreOutput> {
  // Pre-process YouTube URL if present
  let enrichedRawText = input.rawText || '';
  let videoInfoText = '';

  if (input.youtubeUrl && input.youtubeUrl.trim()) {
    try {
      const ytInfo = await fetchYouTubeDetails(input.youtubeUrl);
      if (ytInfo.rawText) {
        videoInfoText = ytInfo.rawText;
        enrichedRawText = enrichedRawText 
          ? `${enrichedRawText}\n\n---\n[Dati estratti dal video YouTube]:\n${ytInfo.rawText}`
          : ytInfo.rawText;
      }
    } catch (err) {
      console.warn('[extractLore] Errore nel recupero automatico dati YouTube:', err);
    }
  }

  const genAi = getGenAI('GEMINI_API_KEY_WORLD');

  const systemPrompt = input.systemOverride || `Sei il Grande Archivista di Candlekeep e un rigoroso storico dei Forgotten Realms per D&D 5e. Il tuo compito è estrarre e organizzare informazioni da fonti ufficiali, link YouTube o appunti grezzi per creare un Dossier di Campagna impeccabile.

REGOLE TASSATIVE (ANTI-INVENZIONE / FONTI UFFICIALI E CANONICHE):
1. DIVIETO ASSOLUTO DI INVENTARE: Non inventare MAI dettagli, nomi, date, fazioni o avvenimenti di fantasia. Tutte le informazioni devono essere rigorosamente verificate o provenienti unicamente da fonti ufficiali di D&D 5e (manuali e avventure WotC, Forgotten Realms Wiki ufficiale) e dal materiale/video fornito dall'utente.
2. ZERO ALLUCINAZIONI O SPECULAZIONI: Se una data o un dettaglio non è documentato nel canone ufficiale o nel video, NON inventarlo. Riporta solo fatti accertati e conformi alla cronologia ufficiale (DR - Dalereckoning).
3. STRUTTURA RICCA E PROFESSIONALE: Organizza il dossier in sezioni Markdown chiare ed esaustive (es. ### Origini & Storia Ufficiale, ### Geografia & Luoghi Canonici, ### Fazioni & Poteri Ufficiali, ### Figure Storiche & PNG Canonici, ### Segreti & Eventi Documentati).
4. CATEGORIA: Seleziona la categoria più attinente tra: 'citta', 'storia', 'personaggio', 'fazione', 'generale'.
5. LINGUA & TONO: Rispondi in italiano con un registro colto, enciclopedico, suggestivo e fedele alle fonti.`;

  const promptParts: string[] = [];
  if (input.youtubeUrl) {
    promptParts.push(`Fonte Video YouTube: ${input.youtubeUrl}`);
  }
  if (videoInfoText) {
    promptParts.push(`Dettagli e trascrizione estratti dal video:\n${videoInfoText}`);
  }
  if (enrichedRawText && enrichedRawText !== videoInfoText) {
    promptParts.push(`Testo / Note grezze fornite:\n${enrichedRawText}`);
  }
  if (input.promptInstruction) {
    promptParts.push(`Istruzioni Aggiuntive del Dungeon Master:\n${input.promptInstruction}`);
  }

  if (promptParts.length === 0) {
    promptParts.push("Crea una guida di ambientazione per una città memorabile dei Forgotten Realms per D&D 5e.");
  }

  const response = await safeGenerateContent(genAi, {
    model: DEFAULT_FLASH_MODEL,
    contents: promptParts.join('\n\n'),
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Titolo del dossier' },
          category: { 
            type: Type.STRING, 
            enum: ['citta', 'storia', 'personaggio', 'fazione', 'generale'], 
            description: 'Categoria del dossier' 
          },
          subtitle: { type: Type.STRING, description: 'Sottotitolo descrittivo' },
          content: { type: Type.STRING, description: 'Contenuto completo formattato in Markdown' },
          tags: { type: Type.STRING, description: 'Tag separati da virgola (es. Neverwinter, Costa della Spada, Fazioni)' },
        },
        required: ['title', 'category', 'subtitle', 'content', 'tags'],
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Nessun contenuto generato dall'IA. Riprova con un testo o link più dettagliato.");
  }

  try {
    const parsed = JSON.parse(responseText) as ExtractLoreOutput;
    return parsed;
  } catch (parseErr) {
    const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleanJson) as ExtractLoreOutput;
  }
}

