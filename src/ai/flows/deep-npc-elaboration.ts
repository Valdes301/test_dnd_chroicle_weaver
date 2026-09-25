
'use server';

/**
 * @fileOverview Un flusso IA avanzato per la rilettura completa delle storie focalizzata su un singolo PNG.
 */

import {worldAi as ai} from '@/ai/genkit';
import {z} from 'genkit';

const NpcEventSchema = z.object({
  sessionNumber: z.number(),
  sessionTitle: z.string(),
  eventDescription: z.string().describe("Cosa ha fatto il PNG in questa specifica sessione. Sii dettagliato (60-80 parole).")
});

const DeepNpcElaborationInputSchema = z.object({
  npcName: z.string().describe('Il nome del PNG da analizzare.'),
  npcRace: z.string().optional(),
  campaignSetting: z.string().optional(),
  allSessionsText: z.string().describe('Il testo grezzo di tutte le sessioni della campagna.'),
  systemOverride: z.string().optional().describe('Sovrascrittura delle istruzioni di sistema.'),
});
export type DeepNpcElaborationInput = z.infer<typeof DeepNpcElaborationInputSchema>;

const DeepNpcElaborationOutputSchema = z.object({
  events: z.array(NpcEventSchema).describe("La cronologia degli eventi in cui appare il PNG."),
  identity: z.object({
    name: z.string(),
    race: z.string(),
    gender: z.enum(['Maschio', 'Femmina', 'Non binario']).describe("Il genere del PNG."),
    age: z.enum(['Bambino', 'Ragazzo', 'Adulto', 'Vecchio']).describe("L'età del PNG."),
    status: z.enum(['Miserabile', 'Povero', 'Normale', 'Ricco', 'Sfarzoso', 'Nobile']).describe("Lo stato sociale o la ricchezza."),
    occupation: z.string(),
    appearance: z.string().describe("Descrizione fisica dettagliata."),
    personality: z.string().describe("Psicologia e temperamento basati sulle azioni."),
    mannerism: z.string().describe("Tic o modi di fare."),
    secret: z.string().describe("Un segreto coerente con quanto letto nelle storie."),
    encounterHook: z.string().describe("Dettagli evocativi del primo incontro tra questo PNG e il party."),
    alignment: z.enum(['Legale Buono', 'Neutrale Buono', 'Caotico Buono', 'Legale Neutrale', 'Neutrale', 'Caotico Neutrale', 'Legale Malvagio', 'Neutrale Malvagio', 'Caotico Malvagio']).describe("L'allineamento morale dedotto."),
  })
});
export type DeepNpcElaborationOutput = z.infer<typeof DeepNpcElaborationOutputSchema>;

export async function deepNpcElaboration(input: DeepNpcElaborationInput): Promise<DeepNpcElaborationOutput> {
  return deepNpcElaborationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'deepNpcElaborationPrompt',
  input: {schema: DeepNpcElaborationInputSchema},
  output: {schema: DeepNpcElaborationOutputSchema},
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei il Maestro della Memoria per D&D 5e. Il tuo compito è rileggere minuziosamente tutte le storie della campagna per estrarre ogni singola informazione riguardante un PNG specifico.{{/if}}

**PNG OBIETTIVO:** {{{npcName}}} ({{{npcRace}}})
**AMBIENTAZIONE:** {{{campaignSetting}}}

**STORIE DELLA CAMPAGNA (TESTO GREZZO):**
'''
{{{allSessionsText}}}
'''

**ISTRUZIONI RIGOROSE:**
1. **ANALISI INTEGRALE**: Leggi tutto il testo fornito. Ogni volta che il PNG {{{npcName}}} viene menzionato o compie un'azione, crea un elemento nel 'events'.
2. **DETTAGLIO CRONOLOGICO**: Per ogni apparizione, descrivi COSA ha fatto e COME lo ha fatto. Non essere sintetico: usa circa 60-80 parole per ogni evento significativo.
3. **IDENTITÀ E SPECIFICITÀ DEL RUOLO**: Dopo aver riletto tutto, compila la scheda 'identity'. 
   - **IMPORTANTE**: Mantieni la coerenza con l'occupazione dichiarata. Se il PNG è un mercante, evita assolutamente comportamenti o tic da "oste" o "locandiere". La sua personalità deve riflettere la sua professione (es: occhio per il valore, modo di parlare formale ma astuto, segreti legati a debiti o rotte commerciali).
   - Estrai con precisione il genere, l'età apparente e lo stato sociale basandoti sulle descrizioni nelle storie.
   - Se è un personaggio della LORE UFFICIALE (es. Volo, Elminster), attieniti alla sua natura canonica ma integra i fatti accaduti nella campagna.
4. **PRIMO INCONTRO**: Identifica il momento esatto in cui i giocatori hanno visto per la prima volta questo PNG. Estrai o ricostruisci quella scena nel campo 'encounterHook'.
5. **ASPETTO E SEGRETO**: Crea un aspetto fisico vivido e un segreto che dia profondità al personaggio nel contesto della trama che hai appena riletto.

Fornisci l'output rigorosamente in italiano.`,
});

const deepNpcElaborationFlow = ai.defineFlow(
  {
    name: 'deepNpcElaborationFlow',
    inputSchema: DeepNpcElaborationInputSchema,
    outputSchema: DeepNpcElaborationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
