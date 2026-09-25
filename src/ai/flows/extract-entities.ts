'use server';

/**
 * @fileOverview A flow to extract new entities (magic items, monsters, rewards) and character events from story text.
 */

import {extractionAi as ai} from '@/ai/genkit';
import {z} from 'genkit';

const MagicItemSchema = z.object({
  name: z.string().describe('Il nome univoco dell\'oggetto o arma.'),
  type: z.string().describe('Il tipo di oggetto (es. "Arma", "Pergamena", "Pozione", "Equipaggiamento").'),
  rarity: z.string().describe('La rarità (es. Comune, Non comune, Rara). Se mondano, usa "Comune".'),
  attunement: z.string().optional().describe('Indica se richiede sintonia (es. "Sì", "No").'),
  description: z.string().describe('Descrizione delle statistiche e dell\'aspetto.'),
  cost: z.string().optional().describe('Valore stimato in monete.'),
  damage: z.string().optional().describe('Danno (es. 1d8) o CA (es. +1) se applicabile.'),
});

const MonsterSchema = z.object({
  name: z.string().describe('Il nome della creatura o mostro.'),
  type: z.string().describe('Tipo (es. Bestia, Umanoide).'),
  armorClass: z.string().describe('Classe Armatura stimata.'),
  hitPoints: z.string().describe('Punti Ferita stimati.'),
  challenge: z.string().describe('Grado di sfida (GS).'),
  description: z.string().describe('Breve descrizione fisica e comportamento.'),
});

const RewardSchema = z.object({
  name: z.string().describe("Il nome della ricompensa (es. '100 monete d'oro', 'Mappa del tesoro')."),
  description: z.string().describe("Cosa rappresenta la ricompensa.")
});

const CharacterEventSchema = z.object({
  name: z.string().describe("Il nome del personaggio (PG o PNG) rilevato nella scena."),
  event: z.string().describe("Un riassunto dettagliato di cosa ha fatto, come si è comportato o cosa gli è successo."),
  isNew: z.boolean().describe("Vero se il personaggio sembra apparire per la prima volta nella campagna."),
});

const ExtractEntitiesInputSchema = z.object({
  storyText: z.string().describe('Il testo di una sessione di D&D da cui estrarre entità.'),
  existingCharacters: z.array(z.string()).describe('Nomi di personaggi (PG e PNG) già noti nella campagna.'),
  systemOverride: z.string().optional().describe('Sovrascrittura delle istruzioni di sistema.'),
});

export type ExtractEntitiesInput = z.infer<typeof ExtractEntitiesInputSchema>;

const ExtractEntitiesOutputSchema = z.object({
  newMagicItems: z.array(MagicItemSchema).describe("Armi, pergamene, pozioni e oggetti fisici trovati."),
  newMonsters: z.array(MonsterSchema).describe("Mostri, animali o nemici incontrati."),
  rewards: z.array(RewardSchema).describe("Tesori monetari o ricompense materiali (oro, gemme, chiavi)."),
  characterEvents: z.array(CharacterEventSchema).describe("Eventi legati ai personaggi presenti nella scena."),
});
export type ExtractEntitiesOutput = z.infer<typeof ExtractEntitiesOutputSchema>;

export async function extractEntities(
  input: ExtractEntitiesInput
): Promise<ExtractEntitiesOutput> {
  return extractEntitiesFlow(input);
}


const prompt = ai.definePrompt({
    name: 'extractEntitiesPrompt',
    input: { schema: ExtractEntitiesInputSchema },
    output: { schema: ExtractEntitiesOutputSchema },
    prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei un esperto analista di sessioni di D&D 5e. Il tuo compito è estrarre OGNI elemento TANGIBILE e FISICO incontrato e analizzare minuziosamente il ruolo dei PERSONAGGI nella scena.{{/if}}

**1. ESTRAZIONE OGGETTI E TESORI:**
- Estrai ogni arma, pergamena, pozione e oggetto magico menzionato.
- Estrai oro, monete, gemme o oggetti di valore fisico.
- Ignora concetti astratti come "Reputazione" o "Fiducia".

**2. ANALISI PERSONAGGI (PG E PNG):**
Leggi la sessione e identifica i personaggi coinvolti.
- Per ogni personaggio già noto (lista fornita): descrivi cosa ha fatto e, soprattutto, COME lo ha fatto (es: "ha analizzato i documenti con fare sospetto e nervoso" invece di "ha guardato le carte").
- Se appare un nuovo PNG significativo: estrai il nome e un riassunto del suo ruolo.
- **DENSITÀ NARRATIVA**: Sii descrittivo ma preciso (usa circa 40-60 parole per ogni evento significativo). Non limitarti a verbi d'azione semplici.

**REGOLE TECNICHE:**
- **Lingua**: Fornisci l'output rigorosamente in italiano.
- **Personaggi noti**: {{{existingCharacters}}}

Testo della sessione:
'''
{{{storyText}}}
'''

Risultato:
`
});

const extractEntitiesFlow = ai.defineFlow(
  {
    name: 'extractEntitiesFlow',
    inputSchema: ExtractEntitiesInputSchema,
    outputSchema: ExtractEntitiesOutputSchema,
  },
  async (input) => {
    if (!input.storyText.trim()) {
        return { newMagicItems: [], newMonsters: [], rewards: [], characterEvents: [] };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
