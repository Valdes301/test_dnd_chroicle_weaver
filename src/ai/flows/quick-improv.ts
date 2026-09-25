'use server';

/**
 * @fileOverview Un flusso per l'improvvisazione istantanea (Taverna) con supporto a categorie.
 */

import { storyAi as ai } from '@/ai/genkit';
import { z } from 'genkit';

const QuickImprovInputSchema = z.object({
  campaignName: z.string(),
  campaignSetting: z.string(),
  campaignSummary: z.string().optional(),
  currentArcTitle: z.string().optional(),
  question: z.string().describe("La domanda o la situazione improvvisa."),
  category: z.string().optional().describe("La categoria di improvvisazione scelta."),
  numPlot: z.number().default(1).describe("Numero di spunti legati alla trama."),
  numWorld: z.number().default(1).describe("Numero di spunti legati al mondo."),
  numFalse: z.number().default(0).describe("Numero esatto di spunti che devono essere falsi/infondati."),
  systemOverride: z.string().optional().describe("Sovrascrittura delle istruzioni di sistema."),
});
export type QuickImprovInput = z.infer<typeof QuickImprovInputSchema>;

const QuickImprovOutputSchema = z.object({
  items: z.array(z.object({
    text: z.string(),
    focus: z.enum(['trama', 'mondo']),
    isFalse: z.boolean().describe("Vero se la diceria è falsa, infondata o fuorviante.")
  })).describe("L'elenco di risposte, dicerie o conseguenze."),
});
export type QuickImprovOutput = z.infer<typeof QuickImprovOutputSchema>;

export async function quickImprov(input: QuickImprovInput): Promise<QuickImprovOutput> {
  return quickImprovFlow(input);
}

const prompt = ai.definePrompt({
  name: 'quickImprovPrompt',
  input: { schema: QuickImprovInputSchema },
  output: { schema: QuickImprovOutputSchema },
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei l'Oste della Taverna, un assistente DM istantaneo esperto in D&D 5e. Il tuo compito è aiutare il Master a improvvisare fornendo un mix di dettagli basati sulla richiesta e sulla categoria selezionata.{{/if}}

**AMBIENTAZIONE:** {{{campaignSetting}}}
**CAMPAGNA:** {{{campaignName}}}
{{#if campaignSummary}}**MEMORIA TRAMA:** {{{campaignSummary}}}{{/if}}

**CATEGORIA RICHIESTA:** {{{category}}}
**RICHIESTA DEL MASTER:**
"{{{question}}}"

**ISTRUZIONI RIGOROSE SULLE CATEGORIE:**
- Se la categoria è **dicerie**: Genera segreti, voci di corridoio o ganci di trama.
- Se la categoria è **conseguenze**: Spiega cosa succede nell'immediato dopo l'azione descritta dal Master.
- Se la categoria è **clima**: Fornisci descrizioni sensoriali (vista, udito, tatto) e condizioni meteo.
- Se la categoria è **incontri**: Genera piccoli eventi casuali tra la folla o sulla strada.
- Se la categoria è **nomi**: Fornisci una lista di nomi adatti alla razza e al luogo.

**ISTRUZIONI SULLE QUANTITÀ:**
- Genera esattamente {{{numPlot}}} spunti focalizzati sulla **Trama Attiva** (se applicabile).
- Genera esattamente {{{numWorld}}} spunti focalizzati sul **Mondo Casuale**.
- **IMPORTANTE**: Di tutti gli spunti generati (totale {{{numPlot}}} + {{{numWorld}}}), esattamente {{{numFalse}}} DEVONO essere segnati come 'isFalse: true' (informazioni errate o fuorvianti). Gli altri devono essere verità.

**REGOLE DI SCRITTURA:**
1. Sii conciso ed evocativo. Usa un linguaggio fantasy immersivo.
2. Per ogni spunto, specifica se il focus è 'trama' o 'mondo'.
3. Le dicerie false devono essere credibili nel contesto ma errate.
4. Lingua: Italiano.`,
});

const quickImprovFlow = ai.defineFlow(
  {
    name: 'quickImprovFlow',
    inputSchema: QuickImprovInputSchema,
    outputSchema: QuickImprovOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
