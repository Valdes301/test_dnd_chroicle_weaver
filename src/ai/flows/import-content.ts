'use server';

/**
 * @fileOverview Un flusso per analizzare e importare contenuti di D&D (oggetti, mostri, incantesimi, abilità) da un file di testo o JSON.
 *
 * - importContent - Analizza il testo fornito e restituisce oggetti strutturati.
 * - ImportContentInput - Il tipo di input per la funzione importContent.
 * - ImportContentOutput - Il tipo di output per la funzione importContent.
 */

import { summaryAi as ai } from '@/ai/genkit';
import { z } from 'zod';

// Schemi con chiavi in inglese per corrispondere al database
const MagicItemSchema = z.object({
  name: z.string().describe("The unique name of the magic item."),
  type: z.string().optional().describe('The item type (e.g., "Pozione", "Anello", "Arma").'),
  rarity: z.string().optional().describe('The item\'s rarity (e.g., "Comune", "Non comune", "Rara").'),
  attunement: z.string().optional().describe('Whether the item requires attunement (e.g., "Sì", "No").'),
  description: z.string().optional().describe('A detailed description of the item\'s effects and history.'),
  cost: z.string().optional().describe("The item's cost (e.g., '400 mo')."),
});

const MonsterSchema = z.object({
  name: z.string().describe('The unique name of the monster.'),
  type: z.string().optional().describe('The creature type (e.g., "Umanoide", "Bestia", "Non morto").'),
  armorClass: z.string().optional().describe('The monster\'s Armor Class.'),
  hitPoints: z.string().optional().describe('The monster\'s average hit points or hit dice.'),
  challenge: z.string().optional().describe('The monster\'s challenge rating (GS).'),
  description: z.string().optional().describe('A brief description of the monster\'s appearance, behavior, and abilities.'),
});

const SpellSchema = z.object({
    name: z.string().describe("The spell's name."),
    level: z.string().optional().describe("The spell's level (e.g., 'Trucchetto', '1° Livello')."),
    school: z.string().optional().describe("The school of magic (e.g., 'Invocazione', 'Illusione')."),
    casting_time: z.string().optional().describe("The casting time."),
    range: z.string().optional().describe("The spell's range."),
    components: z.string().optional().describe("The required components (V, S, M)."),
    duration: z.string().optional().describe("The spell's duration."),
    description: z.string().optional().describe("The full description of the spell's effects."),
    classes: z.string().optional().describe("A comma-separated list of classes that can cast this spell."),
});

const SkillSchema = z.object({
  name: z.string().describe("The skill's name."),
  ability: z.string().optional().describe("The associated ability (e.g., 'Destrezza', 'Saggezza')."),
  description: z.string().optional().describe("A description of what the skill measures and when it's used."),
});


const ImportContentInputSchema = z.object({
  fileContent: z.string().describe('Il contenuto grezzo di un file di testo o JSON contenente dati di D&D.'),
});
export type ImportContentInput = z.infer<typeof ImportContentInputSchema>;

const ImportContentOutputSchema = z.object({
  newMagicItems: z.array(MagicItemSchema).optional().describe("Un elenco di nuovi oggetti magici trovati nel testo."),
  newMonsters: z.array(MonsterSchema).optional().describe("Un elenco di nuovi mostri trovati nel testo."),
  newSpells: z.array(SpellSchema).optional().describe("Un elenco di nuovi incantesimi trovati nel testo."),
  newSkills: z.array(SkillSchema).optional().describe("Un elenco di nuove abilità o capacità trovate nel testo."),
});
export type ImportContentOutput = z.infer<typeof ImportContentOutputSchema>;


export async function importContent(input: ImportContentInput): Promise<ImportContentOutput> {
    return importContentFlow(input);
}


const prompt = ai.definePrompt({
    name: 'importContentPrompt',
    input: { schema: ImportContentInputSchema },
    output: { schema: ImportContentOutputSchema },
    prompt: `Sei un catalogatore esperto di Dungeons & Dragons. Il tuo compito è analizzare il testo fornito, che può essere un JSON o testo libero (anche in italiano), ed estrarre tutti gli oggetti, armi, armature, incantesimi, mostri e abilità, convertendoli in un oggetto JSON strutturato secondo lo schema di output (che usa chiavi in inglese).

**Istruzioni Fondamentali:**
1.  **Analisi del Contenuto:** Identifica le diverse entità (oggetti, mostri, etc.) nel testo fornito.
2.  **Mappatura Rigorosa (Chiavi in Inglese):** Mappa i dati estratti ESATTAMENTE alle chiavi definite negli schemi di output (\`name\`, \`type\`, \`rarity\`, \`description\`, \`cost\`, \`armorClass\`, etc.). Anche se il testo di input è un JSON con chiavi in italiano come "nome", "tipo", "rarita", tu devi mappare i valori alle chiavi inglesi "name", "type", "rarity" nel tuo output. Non inventare campi e non includere testo esplicativo nei valori.
3.  **Gestione Oggetti (Importante!):**
    *   TUTTI gli oggetti fisici, che siano armi, armature o oggetti meravigliosi, devono essere inseriti nell'array \`newMagicItems\`.
    *   **Categorizzazione del Tipo:** È FONDAMENTALE assegnare il campo \`type\` corretto per permettere all'applicazione di smistarli. Il valore di questo campo deve essere in italiano:
        *   Se un oggetto è un'arma o una munizione (es. una spada, un arco, una freccia), il suo campo \`type\` DEVE iniziare con \`"Arma"\`. Esempio: \`"type": "Arma (Spada Lunga)"\`, \`"type": "Arma (Munizione)"\`.
        *   Se un oggetto è un'armatura o uno scudo (es. una corazza, un elmo), il suo campo \`type\` DEVE iniziare con \`"Armatura"\`. Esempio: \`"type": "Armatura (Corazza di Piastre)"\`, \`"type": "Armatura (Scudo)"\`.
        *   Per tutti gli altri oggetti (pozioni, anelli, bacchette, etc.), usa un tipo descrittivo come \`"Pozione"\` o \`"Oggetto meraviglioso"\`.

**Contenuto da Analizzare:**
'''
{{{fileContent}}}
'''
---
Risultato JSON Strutturato (con chiavi in inglese):
`,
});

const importContentFlow = ai.defineFlow(
  {
    name: 'importContentFlow',
    inputSchema: ImportContentInputSchema,
    outputSchema: ImportContentOutputSchema,
  },
  async (input) => {
    if (!input.fileContent.trim()) {
        return { newMagicItems: [], newMonsters: [], newSpells: [], newSkills: [] };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
