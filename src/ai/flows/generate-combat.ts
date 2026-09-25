'use server';

/**
 * @fileOverview A flow to generate a D&D combat encounter using AI.
 */

import { worldAi as ai } from '@/ai/genkit';
import { z } from 'genkit';

const CombatUnitSchema = z.object({
  quantity: z.number().describe("La quantità di nemici di questo tipo."),
  race: z.string().describe("La razza o tipo di nemico (es. Goblin, Umano, Drago)."),
  role: z.string().describe("Il ruolo o classe dei nemici (es. Arciere, Mago, Guerriero)."),
});

const GenerateCombatInputSchema = z.object({
  difficulty: z.enum(['Facile', 'Medio', 'Difficile', 'Mortale']).describe("La difficoltà dell'incontro."),
  units: z.array(CombatUnitSchema).describe("L'elenco dei gruppi di nemici richiesti."),
  environment: z.string().optional().describe("L'ambiente o il luogo in cui si svolge lo scontro (es. Grotta, Taverna, Foresta)."),
  campaignSummary: z.string().optional().describe("Il sommario della campagna per coerenza narrativa."),
  homebrewRules: z.string().optional().describe("Regole personalizzate da rispettare."),
  systemOverride: z.string().optional().describe("Sovrascrittura delle istruzioni di sistema."),
});

export type GenerateCombatInput = z.infer<typeof GenerateCombatInputSchema>;

const GenerateCombatOutputSchema = z.object({
  title: z.string().describe("Un nome evocativo per l'incontro."),
  scenario: z.string().describe("Una breve descrizione dell'ambiente tattico (es. ostacoli, luce, trappole)."),
  enemies: z.array(z.object({
    name: z.string().describe("Nome dell'unità."),
    quantity: z.number().describe("Quanti ne sono presenti."),
    stats: z.string().describe("Breve riassunto statistiche (CA, PF, Danni)."),
    description: z.string().describe("Come appaiono e cosa brandiscono."),
  })).describe("Dettagli dei nemici."),
  strategy: z.string().describe("Consigli per il Master su come gestire il combattimento tatticamente."),
  xpTotal: z.number().describe("Punti esperienza totali per l'incontro."),
});

export type GenerateCombatOutput = z.infer<typeof GenerateCombatOutputSchema>;

export async function generateCombat(input: GenerateCombatInput): Promise<GenerateCombatOutput> {
  return generateCombatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCombatPrompt',
  input: { schema: GenerateCombatInputSchema },
  output: { schema: GenerateCombatOutputSchema },
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei un Maestro della Strategia per D&D 5e. Devi generare un incontro di combattimento basandoti sui parametri forniti.{{/if}}

**Difficoltà:** {{{difficulty}}}
**Composizione Richiesta:**
{{#each units}}
- {{{quantity}}}x {{{race}}} (Ruolo: {{{role}}})
{{/each}}

{{#if homebrewRules}}
**REGOLE DELLA CASA DA RISPETTARE:**
{{{homebrewRules}}}
{{/if}}

{{#if environment}}
**Ambientazione:** {{{environment}}}
{{/if}}

{{#if campaignSummary}}
**Contesto Campagna:**
{{{campaignSummary}}}
{{/if}}

**Istruzioni:**
1. **Titolo**: Crea un nome per l'incontro (es. "L'Imoscata al Ponte Rotto").
2. **Scenario**: Descrivi brevemente il campo di battaglia. Includi elementi tattici come ripari, zone pericolose o condizioni di luce. Se è stata fornita un'ambientazione, usala come base.
3. **Nemici**: Per ogni gruppo di unità richiesto, genera una scheda rapida. Le 'stats' devono essere stringhe compatte (es: "CA 15, PF 22, Spada Corta +4 (1d6+2)"). Sii fedele alla 5a Edizione e alle eventuali regole homebrew fornite.
4. **Strategia**: Spiega come questi nemici collaborano. Chi attacca per primo? Chi resta nelle retrovie? Usano l'ambiente?
5. **XP**: Calcola il valore totale di XP appropriato per il grado di sfida e la difficoltà richiesta.

Fornisci l'output in italiano.`
});

const generateCombatFlow = ai.defineFlow(
  {
    name: 'generateCombatFlow',
    inputSchema: GenerateCombatInputSchema,
    outputSchema: GenerateCombatOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
