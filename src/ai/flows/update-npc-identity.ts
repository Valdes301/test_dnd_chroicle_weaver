
'use server';

/**
 * @fileOverview Un flusso IA per elaborare e approfondire l'identità di un PNG basandosi sulla sua cronologia.
 */

import {worldAi as ai} from '@/ai/genkit';
import {z} from 'genkit';

const UpdateNpcIdentityInputSchema = z.object({
  npcName: z.string().describe('Il nome del PNG.'),
  npcRace: z.string().describe('La razza attuale del PNG.'),
  history: z.string().describe('La cronologia completa delle gesta del PNG nelle varie sessioni.'),
  campaignSummary: z.string().optional().describe('Contesto globale della campagna.'),
  systemOverride: z.string().optional().describe('Sovrascrittura delle istruzioni di sistema.'),
});
export type UpdateNpcIdentityInput = z.infer<typeof UpdateNpcIdentityInputSchema>;

const UpdateNpcIdentityOutputSchema = z.object({
  name: z.string().describe("Il nome completo e l'eventuale titolo del PNG."),
  race: z.string().describe("La razza identificata o confermata."),
  gender: z.enum(['Maschio', 'Femmina', 'Non binario']).describe("Il genere del PNG."),
  age: z.enum(['Bambino', 'Ragazzo', 'Adulto', 'Vecchio']).describe("L'età apparente."),
  status: z.enum(['Miserabile', 'Povero', 'Normale', 'Ricco', 'Sfarzoso', 'Nobile']).describe("Lo stato sociale o ricchezza."),
  occupation: z.string().describe("Cosa fa nella vita basandosi sulle sue azioni."),
  appearance: z.string().describe("Descrizione fisica dettagliata e coerente."),
  personality: z.string().describe("Psicologia e temperamento distillati dalla storia."),
  mannerism: z.string().describe("Un tic o un modo di fare che lo renda unico."),
  secret: z.string().describe("Un obiettivo nascosto o un desiderio inconfessabile coerente con la trama."),
  encounterHook: z.string().describe("Descrizione di come i personaggi hanno incontrato questo PNG la prima volta, basandosi sulla cronologia."),
  alignment: z.enum(['Legale Buono', 'Neutrale Buono', 'Caotico Buono', 'Legale Neutrale', 'Neutrale', 'Caotico Neutrale', 'Legale Malvagio', 'Neutrale Malvagio', 'Caotico Malvagio']).describe("L'allineamento morale suggerito."),
});
export type UpdateNpcIdentityOutput = z.infer<typeof UpdateNpcIdentityOutputSchema>;

export async function updateNpcIdentity(input: UpdateNpcIdentityInput): Promise<UpdateNpcIdentityOutput> {
  return updateNpcIdentityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'updateNpcIdentityPrompt',
  input: {schema: UpdateNpcIdentityInputSchema},
  output: {schema: UpdateNpcIdentityOutputSchema},
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei il Maestro delle Identità per D&D 5e. Il tuo compito è trasformare un PNG abbozzato in un personaggio profondo e coerente analizzando la sua storia.{{/if}}

**PNG:** {{{npcName}}} ({{{npcRace}}})

**CRONOLOGIA DELLE GESTA:**
'''
{{{history}}}
'''

{{#if campaignSummary}}
**CONTESTO CAMPAGNA:**
{{{campaignSummary}}}
{{/if}}

**ISTRUZIONI RIGOROSE:**
1. **LORE CANONICA**: Se il PNG è un personaggio famoso della lore ufficiale di D&D 5e (es: Volo, Elminster, Jarlaxle, Laeral Silverhand, ecc.), attieniti RIGOROSAMENTE alla sua personalità, aspetto e obiettivi ufficiali, adattandoli solo se la cronologia fornita indica cambiamenti drastici avvenuti nella campagna.
2. **COERENZA NARRATIVA E RUOLO**: Se il PNG è originale, deduci la sua psicologia dalle azioni riportate. **Sii estremamente attento all'occupazione del PNG**: se è un mercante, i suoi tratti e segreti devono riguardare il commercio, la ricchezza o la sua merce; evita assolutamente di cadere in stereotipi da "oste di taverna" o "locandiere" se il ruolo dichiarato è diverso.
3. **ASPETTO**: Fornisci dettagli sensoriali vividi (es: "una veste di seta color zaffiro che profuma di lavanda", "una cicatrice che gli attraversa il labbro inferiore").
4. **PRIMO INCONTRO**: Leggi la cronologia e identifica l'evento in cui il PNG appare per la prima volta. Scrivi una descrizione evocativa di quella scena nel campo 'encounterHook'.
5. **PSICOLOGIA E STATUS**: Non limitarti ad aggettivi. Spiega come ragiona in base alla sua professione. Deduci anche genere, età e stato sociale.
6. **SEGRETO**: Crea un segreto che dia pepe alla storia, legato magari agli eventi della cronologia o al contesto della campagna.

Fornisci l'output in italiano.`,
});

const updateNpcIdentityFlow = ai.defineFlow(
  {
    name: 'updateNpcIdentityFlow',
    inputSchema: UpdateNpcIdentityInputSchema,
    outputSchema: UpdateNpcIdentityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
