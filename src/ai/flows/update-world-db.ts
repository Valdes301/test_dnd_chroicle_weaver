'use server';

/**
 * @fileOverview A flow to dynamically update the world database (NPCs, locations) based on the campaign history.
 *
 * - updateWorldDb - A function that triggers the world update.
 * - UpdateWorldDbInput - The input type for the updateWorldDb function.
 * - UpdateWorldDbOutput - The return type for the updateWorldDb function.
 */

import { storyAi as ai } from '@/ai/genkit';
import {z} from 'genkit';

const UpdateWorldDbInputSchema = z.object({
  campaignName: z.string().describe('Il nome della campagna.'),
  campaignSetting: z.string().describe("L'ambientazione della campagna."),
  campaignHistory: z
    .string()
    .describe('Una cronologia completa di tutte le sessioni di gioco precedenti.'),
});
export type UpdateWorldDbInput = z.infer<typeof UpdateWorldDbInputSchema>;

const UpdateWorldDbOutputSchema = z.object({
  locations: z
    .string()
    .describe('Un elenco aggiornato di luoghi importanti, inclusi quelli nuovi scoperti o modificati dagli eventi.'),
  npcs: z
    .string()
    .describe(
      'Un elenco aggiornato di personaggi non giocanti (PNG), che riflette le loro attuali relazioni, stati o nuove apparizioni.'
    ),
});
export type UpdateWorldDbOutput = z.infer<typeof UpdateWorldDbOutputSchema>;

export async function updateWorldDb(input: UpdateWorldDbInput): Promise<UpdateWorldDbOutput> {
  return updateWorldDbFlow(input);
}

const prompt = ai.definePrompt({
  name: 'updateWorldDbPrompt',
  input: {schema: UpdateWorldDbInputSchema},
  output: {schema: UpdateWorldDbOutputSchema},
  prompt: `Sei un assistente Dungeon Master per D&D 5e. Il tuo compito è analizzare la cronologia di una campagna e aggiornare dinamicamente il "database del mondo" (luoghi e PNG).

Considera gli eventi delle sessioni recenti. Fai evolvere le idee esistenti e introducine di nuove che siano una conseguenza diretta delle azioni dei giocatori. Mantieni le informazioni rilevanti e scarta quelle obsolete. L'output deve essere in italiano.

Nome Campagna: {{{campaignName}}}
Ambientazione: {{{campaignSetting}}}

Cronologia Completa della Campagna:
{{{campaignHistory}}}
---

Basandoti sulla cronologia fornita, genera le versioni aggiornate dei seguenti elementi:
- Luoghi: I luoghi sono cambiati? Ne sono stati scoperti di nuovi?
- PNG: Le relazioni dei PNG con i giocatori sono cambiate? Ci sono nuovi personaggi importanti?

Sii conciso e fornisci informazioni utili che un DM possa usare per preparare la prossima sessione.
`,
});

const updateWorldDbFlow = ai.defineFlow(
  {
    name: 'updateWorldDbFlow',
    inputSchema: UpdateWorldDbInputSchema,
    outputSchema: UpdateWorldDbOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
