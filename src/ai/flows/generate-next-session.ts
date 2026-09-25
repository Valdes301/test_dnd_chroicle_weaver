'use server';

/**
 * @fileOverview Flow avanzato per la generazione granulare di sessioni/quest D&D 5e
 * con controllo approfondito su riassunti, PG, agganci precedenti, PNG con ruoli,
 * oggetti, magie, luoghi e calcolo dettagliato dei Punti Esperienza (PX / XP).
 */

import {storyAi as ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNextSessionInputSchema = z.object({
  campaignName: z.string().describe('Il nome della campagna D&D.'),
  campaignSetting: z.string().describe("L'ambientazione della campagna D&D."),
  campaignSummary: z
    .string()
    .optional()
    .describe("Un riassunto generale dell'intera campagna per il contesto a lungo termine."),
  recentSessionsSummary: z
    .string()
    .optional()
    .describe('Riassunto o estratto delle sessioni precedenti selezionate per continuità.'),
  playerCharacters: z
    .string()
    .describe('Dati JSON o formattati dei Personaggi Giocanti (PG) selezionati con ideali, legami, difetti, magie e abilità.'),
  customPrompt: z
    .string()
    .describe("Il prompt / indicazioni principali del Dungeon Master per questa specifica quest."),
  storyToModify: z
    .string()
    .optional()
    .describe('La bozza precedente da raffinare o modificare.'),
  modificationRequest: z
    .string()
    .optional()
    .describe('Istruzioni di modifica specifica fornite dal Master.'),
  homebrewRules: z
    .string()
    .optional()
    .describe('Regole personalizzate di campagna da rispettare.'),
  loreContext: z
    .string()
    .optional()
    .describe('Dossier di lore, città, fazioni ed enciclopedia geografica.'),
  systemOverride: z
    .string()
    .optional()
    .describe('Sovrascrittura facoltativa del System Prompt.'),
  granularDirectives: z
    .string()
    .optional()
    .describe('Direttive granulari dettagliate: ruoli dei PNG, oggetti con contesto, incantesimi, abilità, agganci specifici a vecchie quest, ambientazione e tono narrativo.'),
});
export type GenerateNextSessionInput = z.infer<typeof GenerateNextSessionInputSchema>;

const GenerateNextSessionOutputSchema = z.object({
  titleProposal: z
    .string()
    .describe('Un titolo evocativo, solenne ed entusiasmante per la sessione o quest.'),
  sessionOutline: z
    .string()
    .describe('La narrazione dettagliata della sessione in Markdown con scene, dialoghi, snodi decisionali, bivi morali e incontri.'),
  xpAward: z
    .number()
    .describe('Punti Esperienza (PX / XP) totali di base per la sessione secondo le regole di D&D 5e.'),
  xpDetails: z
    .object({
      combatXp: z.number().describe('PX derivati dagli scontri con mostri o avversari'),
      questMilestoneXp: z.number().describe('PX per il completamento di obiettivi e traguardi principali/secondari'),
      explorationXp: z.number().describe('PX per la scoperta di segreti, luoghi celati o disattivazione trappole/enigmi'),
      roleplayDilemmaXp: z.number().describe('PX per l\'interpretazione di ideali, legami, difetti e scelte morali'),
      xpBreakdownNotes: z.string().describe('Spiegazione sintetica del calcolo dei PX per aiutare il DM nella ripartizione'),
    })
    .optional()
    .describe('Scomposizione dettagliata dei PX guadagnati.'),
});
export type GenerateNextSessionOutput = z.infer<typeof GenerateNextSessionOutputSchema>;

export async function generateNextSession(
  input: GenerateNextSessionInput
): Promise<GenerateNextSessionOutput> {
  return generateNextSessionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNextSessionPrompt',
  input: {schema: GenerateNextSessionInputSchema},
  output: {schema: GenerateNextSessionOutputSchema},
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei un Dungeon Master esperto di Dungeons & Dragons 5e e un narratore fantasy di livello maestro. Il tuo compito è creare un'avventura/sessione di D&D ricca, immersiva, strutturata in scene e guidata con precisione chirurgica dai vincoli forniti. L'output deve essere in lingua italiana con prosa epica, dialoghi vibranti e schemi d'azione chiari per il Master.{{/if}}

---
**AMBIENTAZIONE E CAMPAGNA:**
*   **Nome Campagna:** {{{campaignName}}}
*   **Mondo / Ambientazione:** {{{campaignSetting}}}

{{#if homebrewRules}}
**REGOLE DELLA CASA (HOMEBREW) OBBLIGATORIE:**
{{{homebrewRules}}}
{{/if}}

{{#if campaignSummary}}
**QUADRO GENERALE DELLA CAMPAGNA (RIASSUNTO A LUNGO TERMINE):**
{{{campaignSummary}}}
{{/if}}

{{#if loreContext}}
**DOSSIER DI LORE, CITTÀ E FAZIONI:**
{{{loreContext}}}
{{/if}}

{{#if recentSessionsSummary}}
**EVENTI E SESSIONI RECENTI / PRECEDENTI:**
{{{recentSessionsSummary}}}
{{/if}}

---
**PERSONAGGI GIOCANTI (PG) COINVOLTI:**
Analizza e integra attivamente i seguenti dettagli dei personaggi nella trama:
'''
{{{playerCharacters}}}
'''

{{#if granularDirectives}}
---
**DIRETTIVE GRANULARI DEL MASTER (VINCOLI DI MASSIMA PRIORITÀ):**
{{{granularDirectives}}}
{{/if}}

---
**OBIETTIVO E RICHIESTA DELLA SESSIONE:**
{{#if modificationRequest}}
**Bozza Precedente da Modificare:**
\`\`\`
{{{storyToModify}}}
\`\`\`
**Istruzioni di Revisione:** "{{{modificationRequest}}}"
{{else}}
**Prompt Principale del Master:** "{{{customPrompt}}}"
{{/if}}

**LINEE GUIDA PER LA GENERAZIONE:**
1. **Titolo d'Impatto:** Fornisci un titolo evocativo per l'avventura.
2. **Integrazione dei PNG:** Rispetta scrupolosamente i ruoli assegnati a ciascun PNG (es. se un PNG è 'doppiogiochista', 'da amico a nemico', o 'alleato', rendi evidente questa dinamica nella trama).
3. **Oggetti e Magie:** Utilizza gli oggetti specificati in base al loro ruolo (chiavi per proseguire, oggetti trovati o rubati) e valorizza le magie/abilità richieste per superare sfide specifiche.
4. **Agganci Narrativi:** Se sono indicati agganci a sessioni precedenti, fai emergere conseguenze o riferimenti diretti.
5. **Calcolo PX D&D 5e:** Calcola un totale di PX bilanciato per il gruppo (suddividendo tra Combattimento, Traguardi di Quest, Esplorazione/Enigmi e Interpretazione di Ideali/Difetti).
`,
});

const generateNextSessionFlow = ai.defineFlow(
  {
    name: 'generateNextSessionFlow',
    inputSchema: GenerateNextSessionInputSchema,
    outputSchema: GenerateNextSessionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
