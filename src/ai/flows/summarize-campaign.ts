'use server';

/**
 * @fileOverview A flow to summarize the entire campaign history.
 */

import { summaryAi as ai } from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCampaignInputSchema = z.object({
  campaignHistory: z.string().describe("L'intera cronologia della campagna D&D, composta da tutte le sessioni di gioco."),
  systemOverride: z.string().optional().describe("Sovrascrittura delle istruzioni di sistema."),
});
export type SummarizeCampaignInput = z.infer<typeof SummarizeCampaignInputSchema>;

const SummarizeCampaignOutputSchema = z.object({
  summary: z.string().describe("Un riassunto conciso e denso di informazioni della campagna. Deve includere gli archi narrativi principali, gli sviluppi dei personaggi, gli oggetti chiave e le questioni irrisolte."),
});
export type SummarizeCampaignOutput = z.infer<typeof SummarizeCampaignOutputSchema>;


export async function summarizeCampaign(input: SummarizeCampaignInput): Promise<SummarizeCampaignOutput> {
  return summarizeCampaignFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeCampaignPrompt',
    input: { schema: SummarizeCampaignInputSchema },
    output: { schema: SummarizeCampaignOutputSchema },
    prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei un cronista esperto con il compito di distillare una lunga saga di Dungeons & Dragons in un riassunto efficiente.{{/if}}
Leggi la seguente cronologia della campagna e crea un sommario conciso.
Il tuo obiettivo è catturare l'essenza della storia in modo che un'altra IA possa usarla per generare sessioni future senza dover rileggere tutto da capo.

Concentrati su:
- **Archi Narrativi Principali:** Quali sono le quest principali? Dove sono iniziate e dove sono dirette?
- **Personaggi Chiave (PNG):** Chi sono gli alleati e gli antagonisti principali? Come sono cambiate le loro relazioni con i giocatori?
- **Sviluppi dei Giocatori:** I personaggi giocanti hanno avuto momenti di svolta, cambiato obiettivi o acquisito poteri importanti?
- **Oggetti e Luoghi Rilevanti:** Quali oggetti magici o luoghi iconici hanno un ruolo centrale nella trama?
- **Questioni Irrisolte:** Quali sono i misteri, i conflitti o le minacce ancora aperti?

Sii denso di informazioni ma efficiente con le parole. Evita i dettagli superflui delle singole scene e concentrati sul quadro generale. L'output deve essere in italiano.

Cronologia della Campagna da riassumere:
'''
{{{campaignHistory}}}
'''
`
});


const summarizeCampaignFlow = ai.defineFlow(
  {
    name: 'summarizeCampaignFlow',
    inputSchema: SummarizeCampaignInputSchema,
    outputSchema: SummarizeCampaignOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate a summary.');
    }
    if (typeof output === 'string') {
      return { summary: output };
    }
    return output;
  }
);
