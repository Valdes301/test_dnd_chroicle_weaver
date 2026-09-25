'use server';

/**
 * @fileOverview Inizializza una nuova campagna D&D 5e con spunti narrativi generati dall'IA.
 *
 * - initializeCampaign - Funzione che genera il sommario iniziale della campagna.
 * - CampaignInput - Tipo di input per la creazione della campagna.
 * - CampaignOutput - Tipo di output strutturato restituito dall'IA.
 */

import {storyAi as ai} from '@/ai/genkit';
import {z} from 'genkit';

const CampaignInputSchema = z.object({
  campaignName: z.string().describe('Il nome della campagna D&D 5e.'),
  setting: z.string().describe("L'ambientazione (es. Forgotten Realms, Eberron o mondo custom)."),
  description: z.string().optional().describe('Una breve descrizione o tema centrale.'),
});
export type CampaignInput = z.infer<typeof CampaignInputSchema>;

const CampaignOutputSchema = z.object({
  initial_summary: z.string().describe('Un testo narrativo coinvolgente che descrive luoghi, PNG e misteri iniziali.'),
  progress: z.string().describe('Un breve riassunto di una frase su ciò che è stato creato.'),
});
export type CampaignOutput = z.infer<typeof CampaignOutputSchema>;

export async function initializeCampaign(input: CampaignInput): Promise<CampaignOutput> {
  return initializeCampaignFlow(input);
}

const prompt = ai.definePrompt({
  name: 'initializeCampaignPrompt',
  input: { schema: CampaignInputSchema },
  output: { schema: CampaignOutputSchema },
  config: {
    temperature: 0.7,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `Sei un Dungeon Master leggendario. Il tuo compito è dare vita a una nuova campagna di D&D 5e.

    Dati di base forniti:
    - Nome Campagna: {{{campaignName}}}
    - Ambientazione: {{{setting}}}
    {{#if description}}- Tema/Descrizione: {{{description}}}{{/if}}

    Istruzioni:
    Genera un sommario introduttivo epico in italiano. 
    Includi almeno 1 luogo unico, 1 PNG memorabile con il suo ruolo e due spunti di trama (ganci) per iniziare l'avventura immediatamente.
    Sii creativo e solenne nel tono.`,
});

const initializeCampaignFlow = ai.defineFlow(
  {
    name: 'initializeCampaignFlow',
    inputSchema: CampaignInputSchema,
    outputSchema: CampaignOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("L'IA non è riuscita a generare il contenuto. Verifica la tua configurazione API.");
    }
    return output;
  }
);
