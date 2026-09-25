'use server';
/**
 * @fileOverview Un flusso per riassumere un intero arco narrativo in modo incrementale.
 */

import {summaryAi as ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeArcInputSchema = z.object({
  arcTitle: z.string().describe('Il titolo attuale dell\'arco narrativo.'),
  existingSummary: z.string().optional().describe('La sintesi narrativa esistente prodotta finora per questo arco.'),
  sessions: z.array(z.object({
    sessionNumber: z.number(),
    title: z.string(),
    notes: z.string()
  })).describe('L\'elenco delle NUOVE sessioni da integrare nel riassunto.'),
  campaignContext: z.string().optional().describe('Contesto globale (riassunti di altri archi) per coerenza esterna.'),
  systemOverride: z.string().optional().describe('Sovrascrittura delle istruzioni di sistema.'),
});
export type SummarizeArcInput = z.infer<typeof SummarizeArcInputSchema>;

const SummarizeArcOutputSchema = z.object({
  newTitle: z.string().describe('Un titolo epico che riassume l\'intero Arco.'),
  summary: z.string().describe('Il riassunto AGGIORNATO che integra armoniosamente il passato con le nuove sessioni.'),
  worldImpact: z.string().describe('Come è cambiato permanentemente il mondo dopo questi eventi?'),
});
export type SummarizeArcOutput = z.infer<typeof SummarizeArcOutputSchema>;

export async function summarizeArc(input: SummarizeArcInput): Promise<SummarizeArcOutput> {
  return summarizeArcFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeArcPrompt',
  input: {schema: SummarizeArcInputSchema},
  output: {schema: SummarizeArcOutputSchema},
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei il Grande Cronista delle ere perdute. Il tuo compito è mantenere e aggiornare la cronaca epica di una campagna di D&D.{{/if}}

**INFORMAZIONI DI BASE:**
- Arco Narrativo: {{{arcTitle}}}
{{#if campaignContext}}
- Memoria Storica (Eventi passati): {{{campaignContext}}}
{{/if}}

**FONDAMENTA (Sintesi già scritta finora):**
{{#if existingSummary}}
'''
{{{existingSummary}}}
'''
{{else}}
(Nessuna sintesi precedente. Inizia da zero).
{{/if}}

---
**NUOVI EVENTI DA INTEGRARE (In ordine cronologico):**
{{#each sessions}}
- Sessione #{{{sessionNumber}}}: {{{title}}}
  Contenuto: {{{notes}}}
{{/each}}

**REGOLE DI SCRITTURA (INCREMENTALI E BILANCIATE):**
1. **INTEGRAZIONE FLUIDA**: Non limitarti ad aggiungere le nuove storie in fondo. Prendi la "Sintesi esistente" e riscrivila o espandila in modo che le nuove sessioni si colleghino logicamente a quelle passate, mantenendo la continuità narrativa.
2. **COERENZA TEMPORALE**: Segui rigorosamente l'ordine numerico delle sessioni. Usa connettivi temporali per mostrare la progressione.
3. **EQUILIBRIO NARRATIVO (CRUCIALE)**: Evita di essere troppo telegrafico. Il riassunto deve essere denso ma deve CONSERVARE i dettagli che danno sapore alla storia: nomi di PNG fondamentali, oggetti magici unici recuperati, scoperte di trama cruciali e decisioni morali dei giocatori. Non sacrificare la ricchezza del mondo per la brevità.
4. **DENSITÀ QUALITATIVA**: Elimina i dettagli tattici minuti (es. quanti danni ha fatto un colpo) ma enfatizza le conseguenze narrative di quegli scontri.
5. **NO CONCLUSIONI STANDARD**: Non usare frasi fatte come "la battaglia continua". Fermati esattamente all'ultimo evento reale riportato nelle nuove sessioni.
6. **IMPATTO SUL MONDO**: Determina come gli eventi analizzati hanno cambiato permanentemente lo stato del mondo (fazioni, luoghi, reputazione del party).
7. **TITOLO**: Se necessario, trasforma il titolo dell'Arco in qualcosa di più leggendario che rifletta l'intera saga finora.

Scrivi in italiano con stile solenne ed epico, degno di una vera cronaca fantasy.`,
});

const summarizeArcFlow = ai.defineFlow(
  {
    name: 'summarizeArcFlow',
    inputSchema: SummarizeArcInputSchema,
    outputSchema: SummarizeArcOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
