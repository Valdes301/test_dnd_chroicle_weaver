
'use server';

/**
 * @fileOverview A flow to generate a D&D NPC with personality, secrets, and encounter hooks.
 */

import { worldAi as ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateNpcInputSchema = z.object({
  gender: z.enum(['Maschio', 'Femmina', 'Non binario']).describe("Il genere del PNG."),
  age: z.enum(['Bambino', 'Ragazzo', 'Adulto', 'Vecchio']).describe("L'età del PNG."),
  status: z.enum(['Miserabile', 'Povero', 'Normale', 'Ricco', 'Sfarzoso', 'Nobile']).describe("Lo stato sociale o la ricchezza del PNG."),
  alignment: z.enum(['Buono', 'Neutrale', 'Malvagio']).describe("L'orientamento morale del PNG."),
  race: z.string().optional().describe("La razza del PNG (es. Umano, Nano, Elfo)."),
  campaignSummary: z.string().optional().describe("Il sommario della campagna per coerenza narrativa."),
  homebrewRules: z.string().optional().describe("Regole personalizzate da rispettare."),
  systemOverride: z.string().optional().describe("Sovrascrittura delle istruzioni di sistema."),
});

export type GenerateNpcInput = z.infer<typeof GenerateNpcInputSchema>;

const GenerateNpcOutputSchema = z.object({
  name: z.string().describe("Il nome completo e l'eventuale titolo del PNG."),
  race: z.string().describe("La razza identificata."),
  occupation: z.string().describe("Cosa fa nella vita (es. Fabbro, Spia, Mercante)."),
  appearance: z.string().describe("Descrizione fisica dettagliata (Vista)."),
  personality: z.string().describe("Come si comporta e come parla (Udito/Carattere)."),
  mannerism: z.string().describe("Un tic, un'abitudine o un modo di fare particolare."),
  secret: z.string().describe("Un segreto, un obiettivo nascosto o un desiderio inconfessabile."),
  encounterHook: z.string().describe("Un suggerimento su come questo PNG può interagire con il party o iniziare un incontro."),
});

export type GenerateNpcOutput = z.infer<typeof GenerateNpcOutputSchema>;

export async function generateNpc(input: GenerateNpcInput): Promise<GenerateNpcOutput> {
  return generateNpcFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNpcPrompt',
  input: { schema: GenerateNpcInputSchema },
  output: { schema: GenerateNpcOutputSchema },
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei un Maestro delle Relazioni e dei PNG per D&D 5e. Devi generare un personaggio non giocante vibrante e utile per una sessione.{{/if}}

**Parametri Richiesti:**
- **Genere:** {{{gender}}}
- **Età:** {{{age}}}
- **Stato Sociale:** {{{status}}}
- **Moralità:** {{{alignment}}}
{{#if race}}- **Razza Preferita:** {{{race}}}{{/if}}

{{#if homebrewRules}}
**REGOLE DELLA CASA / AMBIENTAZIONE:**
{{{homebrewRules}}}
{{/if}}

{{#if campaignSummary}}
**Contesto Campagna:**
{{{campaignSummary}}}
{{/if}}

**Istruzioni:**
1. **Nome**: Crea un nome adatto alla razza e al ruolo.
2. **Occupazione**: Scegli un'occupazione sensata. **ATTENZIONE**: La personalità e i tic devono essere strettamente legati al ruolo. Se è un mercante, evita comportamenti da "locandiere" o "oste". Un mercante si preoccuperà dei prezzi e della qualità, un nobile dell'etichetta, un mendicante della sopravvivenza.
3. **Aspetto**: Fornisci dettagli visivi che lo rendano unico (es. una cicatrice, un vestito rammendato, uno sguardo penetrante).
4. **Personalità**: Descrivi il suo temperamento e il suo modo di porsi, coerentemente con la sua professione.
5. **Peculiarità**: Un dettaglio memorabile (es. giocherella sempre con un anello, parla in terza persona, annusa l'aria prima di rispondere).
6. **Segreto**: Qualcosa che i PG non sanno. Potrebbe essere un pericolo, una missione o un legame con l'antagonista.
7. **Gancio d'Incontro**: Come attira l'attenzione dei PG? Perché dovrebbero parlarci o combatterci?

Fornisci l'output in italiano.`
});

const generateNpcFlow = ai.defineFlow(
  {
    name: 'generateNpcFlow',
    inputSchema: GenerateNpcInputSchema,
    outputSchema: GenerateNpcOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
