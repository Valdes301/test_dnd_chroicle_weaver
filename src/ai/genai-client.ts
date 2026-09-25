import { GoogleGenAI } from '@google/genai';
import { getAppSetting } from '@/lib/db';

/**
 * Trova la prima chiave API Gemini valida tra quelle disponibili nell'ambiente.
 */
export function getActiveGeminiApiKey(preferredEnv?: string): string | null {
  const candidates = [
    preferredEnv ? process.env[preferredEnv] : undefined,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY_WORLD,
    process.env.GEMINI_API_KEY_STORY,
    process.env.GEMINI_API_KEY_EXTRACTION,
    process.env.GEMINI_API_KEY_IMPORT,
    process.env.GEMINI_API_KEY_SHOPS,
    process.env.GEMINI_API_KEY_SUMMARY,
  ];

  const invalidValues = [
    '',
    'undefined',
    'null',
    'tua_chiave_qui',
    'your_key_here',
    '<your_key_here>',
    'insert_key_here',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const clean = candidate.trim();
    if (clean && !invalidValues.includes(clean.toLowerCase()) && !clean.startsWith('YOUR_')) {
      return clean;
    }
  }

  return null;
}

let inMemoryFallbackModel: string | null = null;

/**
 * Recupera dinamicamente il modello Flash attivo configurato dall'utente (da SQLite o da ENV).
 * Supporta la selezione del modello per singola sezione (es. STORY, WORLD, SHOPS, IMPORT, EXTRACTION).
 */
export function getActiveFlashModel(serviceName?: string): string {
  if (serviceName) {
    try {
      const sectionSaved = getAppSetting(`model_service_${serviceName}`);
      if (sectionSaved && sectionSaved.trim() && sectionSaved.trim() !== 'default') {
        return sectionSaved.trim();
      }
    } catch {}
  }
  if (inMemoryFallbackModel) {
    return inMemoryFallbackModel;
  }
  try {
    const saved = getAppSetting('active_ai_model');
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {}
  return process.env.GEMINI_FLASH_MODEL || 'gemini-3.8-flash';
}

/**
 * Modello Flash predefinito per compatibilità retroattiva.
 */
export const DEFAULT_FLASH_MODEL = 'gemini-3.8-flash';

/**
 * Esegue generateContent con fallback ISTANTANEO sui modelli di riserva in caso di quota superata (429) o sovraccarico (503).
 */
export async function safeGenerateContent(
  genAi: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  serviceName?: string
) {
  const activeModel = getActiveFlashModel(serviceName);
  const primaryModel = params.model || activeModel;
  const modelsToTry = [
    primaryModel,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

  let lastError: any = null;

  for (let idx = 0; idx < modelsToTry.length; idx++) {
    const model = modelsToTry[idx];
    try {
      const res = await genAi.models.generateContent({
        ...params,
        model,
      });

      // Se un modello di riserva ha avuto successo, memorizzalo per le chiamate successive
      if (model !== activeModel) {
        inMemoryFallbackModel = model;
      }

      return res;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err || '');
      const isQuotaError = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('too many requests');
      const isHighDemandError = msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('unavailable');

      const hasNextModel = idx < modelsToTry.length - 1;

      if (isQuotaError || isHighDemandError) {
        if (hasNextModel) {
          // Passaggio istantaneo al modello successivo di riserva senza blocco
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        } else {
          // Tutti i modelli sono in quota/occupati, applica breve pausa
          const match = msg.match(/(?:retry in|please retry in|retry after)\s+(\d+(?:\.\d+)?)s?/i);
          const waitMs = match ? Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 1000, 15000) : 3000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  console.warn(`[GenAI] Richiesta fallita dopo aver tentato i modelli (${modelsToTry.join(', ')}):`, lastError?.message || lastError);
  throw lastError;
}

/**
 * Testa la connettività e la latenza di un modello specifico con un ping leggero.
 */
export async function testGeminiModel(modelName: string): Promise<{ success: boolean; latencyMs?: number; message?: string; error?: string }> {
  const startTime = Date.now();
  try {
    const genAi = getGenAI();
    const cleanModel = modelName.startsWith('googleai/') ? modelName.replace('googleai/', '') : modelName;
    const response = await genAi.models.generateContent({
      model: cleanModel,
      contents: 'Rispondi esclusivamente con la parola "OK".',
      config: {
        maxOutputTokens: 10,
        temperature: 0.1,
      },
    });
    const latencyMs = Date.now() - startTime;
    const text = response.text || '';
    return {
      success: true,
      latencyMs,
      message: `Modello ${cleanModel} operativo! Risposta ricevuta in ${latencyMs}ms ("${text.trim().substring(0, 30)}")`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      error: err?.message || String(err),
    };
  }
}

/**
 * Ottiene un'istanza GoogleGenAI configurata con la chiave corretta.
 */
export function getGenAI(preferredEnv?: string): GoogleGenAI {
  const key = getActiveGeminiApiKey(preferredEnv);
  if (!key) {
    throw new Error(
      "Nessuna chiave API Gemini configurata. Vai su Impostazioni per inserire una chiave API valida (GEMINI_API_KEY)."
    );
  }

  // Sincronizza per sicurezza le variabili globali
  if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = key;
  if (!process.env.GOOGLE_GENAI_API_KEY) process.env.GOOGLE_GENAI_API_KEY = key;

  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'dnd-chronicle-weaver',
      },
    },
  });
}
