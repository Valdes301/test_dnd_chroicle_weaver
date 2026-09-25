import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import { getAppSetting } from '@/lib/db';

/**
 * @fileOverview Configurazione centralizzata Genkit e Google GenAI con Multi-Key Pooling.
 * Distribuisce il carico su diverse chiavi API per massimizzare le quote gratuite.
 */

export const getValidKey = (specificKeyEnv?: string): string | undefined => {
    const keys = [
        specificKeyEnv ? process.env[specificKeyEnv] : undefined,
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_GENAI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.NEXT_PUBLIC_GEMINI_API_KEY
    ];

    for (const k of keys) {
        if (!k) continue;
        const clean = k.trim();
        
        const invalid = [
            '', 
            'tua_chiave_qui', 
            'undefined', 
            'null', 
            'your_key_here', 
            '<your_key_here>',
            'insert_key_here'
        ];
        
        if (clean && !invalid.includes(clean.toLowerCase()) && !clean.startsWith('YOUR_')) {
            // Keep environment variables synced
            if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = clean;
            if (!process.env.GOOGLE_GENAI_API_KEY) process.env.GOOGLE_GENAI_API_KEY = clean;
            return clean;
        }
    }
    return undefined;
};

/**
 * Risolve dinamicamente il modello configurato dall'utente per Genkit (supporta sezioni specifiche).
 */
export const getActiveGenkitModel = (serviceName?: string): string => {
  let modelName = 'gemini-3.8-flash';
  if (serviceName) {
    try {
      const sectionSaved = getAppSetting(`model_service_${serviceName}`);
      if (sectionSaved && sectionSaved.trim() && sectionSaved.trim() !== 'default') {
        modelName = sectionSaved.trim();
        return modelName.startsWith('googleai/') ? modelName : `googleai/${modelName}`;
      }
    } catch {}
  }
  try {
    const saved = getAppSetting('active_ai_model');
    if (saved && saved.trim()) {
      modelName = saved.trim();
    } else if (process.env.GEMINI_FLASH_MODEL) {
      modelName = process.env.GEMINI_FLASH_MODEL;
    }
  } catch {}
  return modelName.startsWith('googleai/') ? modelName : `googleai/${modelName}`;
};

/**
 * Modello Flash predefinito per tutte le istanze Genkit.
 */
export const DEFAULT_GENKIT_FLASH_MODEL = getActiveGenkitModel();

/**
 * Crea un'istanza Genkit dedicata a un servizio specifico.
 * Questo permette di sfruttare le quote separate definite nel Docker Compose.
 */
const createAiInstance = (serviceName: string, envVar: string) => {
    const apiKey = getValidKey(envVar);
    const googleAiConfig: { apiKey?: string } = {};
    if (apiKey) {
        googleAiConfig.apiKey = apiKey;
    }

    return genkit({
      plugins: [googleAI(googleAiConfig)],
      model: getActiveGenkitModel(),
    });
};

// Istanze separate per pooling di quote (RPM/RPD)
export const storyAi = createAiInstance('STORY', 'GEMINI_API_KEY_STORY');
export const summaryAi = createAiInstance('SUMMARY', 'GEMINI_API_KEY_SUMMARY');
export const shopAi = createAiInstance('SHOPS', 'GEMINI_API_KEY_SHOPS');
export const worldAi = createAiInstance('WORLD', 'GEMINI_API_KEY_WORLD');
export const extractionAi = createAiInstance('EXTRACTION', 'GEMINI_API_KEY_EXTRACTION');
export const catalogAi = createAiInstance('IMPORT', 'GEMINI_API_KEY_IMPORT');

/**
 * Aggiorna a caldo il modello attivo per tutte le istanze Genkit in memoria.
 */
export function updateGenkitActiveModel(modelName: string) {
  const formatted = modelName.startsWith('googleai/') ? modelName : `googleai/${modelName}`;
  const instances = [storyAi, summaryAi, shopAi, worldAi, extractionAi, catalogAi];
  for (const inst of instances) {
    if (inst && (inst as any).options) {
      (inst as any).options.model = formatted;
    }
  }
}

// Istanza predefinita per compatibilità
export const ai = storyAi;

export { z } from 'genkit';

