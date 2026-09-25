'use server';

/**
 * @fileOverview Un flusso per generare tesori e bottini per D&D 5e.
 */

import { shopAi as ai } from '@/ai/genkit';
import { z } from 'genkit';

const TreasureItemSchema = z.object({
  name: z.string().describe("Nome dell'oggetto o del gruppo di monete."),
  type: z.string().describe("Categoria: 'Monete', 'Gioiello', 'Oggetto Magico', 'Arma', 'Mondano'."),
  rarity: z.string().describe("Rarità (Comune, Non Comune, ecc.)."),
  description: z.string().describe("Descrizione narrativa e meccanica (dadi di danno, bonus, ecc.)."),
  cost: z.string().describe("Valore stimato (es. '100 mo')."),
  isCursed: z.boolean().describe("Se l'oggetto è maledetto."),
  techType: z.enum(['damage', 'defense', 'cure', 'alchemy', 'charges', 'reward', 'none']).describe("L'icona tecnica da usare."),
});

const GenerateTreasureInputSchema = z.object({
  location: z.string().describe("Dove viene trovato (es. 'Corpo di un Orco', 'Scomparto Segreto')."),
  valueType: z.enum(['Random (Scarso)', 'Random (Medio)', 'Random (Ricco)', 'Specifico']).describe("Metodo di calcolo del valore."),
  specificGold: z.number().optional().describe("Valore in oro specifico se richiesto."),
  allowedTypes: z.array(z.string()).describe("Tipi permessi: 'Monete', 'Gioielli', 'Oggetti Magici', 'Maledetti'."),
  quantity: z.number().min(1).max(10).describe("Numero di elementi da generare."),
  campaignSummary: z.string().optional().describe("Contesto della campagna per la coerenza."),
  homebrewRules: z.string().optional().describe("Regole personalizzate da rispettare."),
  systemOverride: z.string().optional().describe("Sovrascrittura delle istruzioni di sistema."),
});

export type GenerateTreasureInput = z.infer<typeof GenerateTreasureInputSchema>;

const GenerateTreasureOutputSchema = z.object({
  title: z.string().describe("Titolo del bottino (es. 'Il Tesoro del Capovalle')."),
  items: z.array(TreasureItemSchema).describe("Gli elementi del tesoro."),
});

export type GenerateTreasureOutput = z.infer<typeof GenerateTreasureOutputSchema>;

export async function generateTreasure(input: GenerateTreasureInput): Promise<GenerateTreasureOutput> {
  return generateTreasureFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTreasurePrompt',
  input: { schema: GenerateTreasureInputSchema },
  output: { schema: GenerateTreasureOutputSchema },
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei un Maestro dei Tesori per D&D 5e. Devi generare un bottino memorabile e coerente.{{/if}}

**Parametri del Ritrovamento:**
- **Luogo:** {{{location}}}
- **Valore Richiesto:** {{{valueType}}} {{#if specificGold}}({{{specificGold}}} mo){{/if}}
- **Tipi ammessi:** {{{allowedTypes}}}
- **Quantità elementi:** {{{quantity}}}

{{#if homebrewRules}}
**REGOLE DELLA CASA / VALORI PERSONALIZZATI:**
{{{homebrewRules}}}
{{/if}}

{{#if campaignSummary}}
**Contesto Campagna:**
{{{campaignSummary}}}
{{/if}}

**Istruzioni:**
1. **Coerenza**: Se il tesoro è in un sacchetto, non generare una corazza di piastre. Se è su un cadavere, gli oggetti dovrebbero avere senso per quella creatura.
2. **Monete e Gioielli**: Se permessi, devono essere descritti in modo evocativo (es. "Una borsa di seta contenente 50 mo con l'effigie del Re"). Rispetta i valori monetari homebrew se presenti.
3. **Oggetti Magici**: Includi statistiche 5e chiare (es. **+1 ai tiri per colpire**).
4. **Oggetti Maledetti**: Se inclusi, la maledizione deve essere interessante ma non rompere il gioco. Scrivila alla fine della descrizione tra parentesi [MALEDIZIONE].
5. **Icone (techType)**:
   - 'damage' per armi.
   - 'defense' per armature/scudi.
   - 'cure' per pozioni di cura.
   - 'alchemy' per pergamene/altre pozioni.
   - 'reward' per monete, gioielli o oggetti di valore.
   - 'charges' per bacchette.

Fornisci l'output in italiano.`
});

const generateTreasureFlow = ai.defineFlow(
  {
    name: 'generateTreasureFlow',
    inputSchema: GenerateTreasureInputSchema,
    outputSchema: GenerateTreasureOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
