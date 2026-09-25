'use server';

/**
 * @fileOverview Un flusso potenziato per l'Importazione Intelligente.
 */

import {catalogAi as ai} from '@/ai/genkit';
import {z} from 'genkit';

const MagicItemSchema = z.object({
  name: z.string().describe("Il nome dell'oggetto, TRADOTTO in italiano."),
  type: z.string().optional().describe('Il tipo di oggetto (es. Pozione, Anello, Arma).'),
  rarity: z.string().optional().describe('La rarità (es. Comune, Non comune, Rara).'),
  attunement: z.string().optional().describe('Sintonia (es. "Sì", "No").'),
  description: z.string().optional().describe('Descrizione degli effetti e della storia.'),
  cost: z.string().optional().describe("Il costo suggerito in mo basato sulla rarità se non specificato."),
  damage: z.string().optional().describe("Il dado di danno e il tipo (es. '1d8 tagliente') se applicabile."),
});

const MonsterSchema = z.object({
  name: z.string().describe("Il nome del mostro, TRADOTTO in italiano."),
  type: z.string().optional().describe('Il tipo di creatura (es. Umanoide, Bestia).'),
  armorClass: z.string().optional().describe('Classe Armatura.'),
  hitPoints: z.string().optional().describe('Punti Ferita.'),
  challenge: z.string().optional().describe('Grado di sfida (GS).'),
  description: z.string().optional().describe('Aspetto e abilità.'),
});

const SpellSchema = z.object({
    name: z.string().describe("Il nome dell'incantesimo, TRADOTTO in italiano."),
    level: z.string().optional(),
    school: z.string().optional(),
    casting_time: z.string().optional(),
    range: z.string().optional(),
    components: z.string().optional(),
    duration: z.string().optional(),
    description: z.string().optional(),
    classes: z.string().optional(),
});

const SkillSchema = z.object({
  name: z.string().describe("Il nome dell'abilità, TRADOTTO in italiano."),
  ability: z.string().optional(),
  description: z.string().optional(),
});

const RuleSchema = z.object({
  title: z.string().describe("Il titolo del capitolo o paragrafo in italiano, es. 'Veleno' o 'I Manieri'"),
  content: z.string().describe("Il testo completo della regola, impaginato in formato MARKDOWN ricco (usa tabelle, elenchi puntati, grassetti per le CD di salvezza o i danni)."),
  sourceBook: z.enum(['phb', 'dmg']).describe("Indica se appartiene al Manuale del Giocatore (phb) o Manuale del Master (dmg)"),
  chapterTitle: z.string().optional().describe("Il nome del capitolo appropriato, es. 'Capitolo 3: Strumenti del DM' o 'Cap. 1: Come Si Gioca'"),
  tags: z.array(z.string()).optional().describe("Parole chiave rilevanti, es. ['trappola', 'combattimento', 'manieri']"),
});

const CatalogHandbookInputSchema = z.object({
  content: z.string().optional().describe('Il testo grezzo da catalogare.'),
  photoDataUri: z.string().optional().describe("Una foto del manuale, come URI dati Base64."),
  systemOverride: z.string().optional().describe("Sovrascrittura delle istruzioni di sistema."),
});
export type CatalogHandbookInput = z.infer<typeof CatalogHandbookInputSchema>;

const CatalogHandbookOutputSchema = z.object({
  items: z.array(MagicItemSchema).describe("Oggetti ed equipaggiamento."),
  monsters: z.array(MonsterSchema).describe("Creature e mostri."),
  spells: z.array(SpellSchema).describe("Incantesimi."),
  skills: z.array(SkillSchema).describe("Abilità e capacità."),
  rules: z.array(RuleSchema).describe("Regole di gioco, sezioni di capitolo o interi argomenti del manuale."),
});
export type CatalogHandbookOutput = z.infer<typeof CatalogHandbookOutputSchema>;

export async function catalogHandbook(input: CatalogHandbookInput): Promise<CatalogHandbookOutput> {
    return catalogHandbookFlow(input);
}

const prompt = ai.definePrompt({
    name: 'catalogHandbookPrompt',
    input: { schema: CatalogHandbookInputSchema },
    output: { schema: CatalogHandbookOutputSchema },
    prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei il Grande Bibliotecario di Candlekeep. Il tuo compito è catalogare i dati di D&D 5e con precisione assoluta e fedeltà rigorosa alle fonti.{{/if}}
Analizza il testo fornito e/o l'immagine del manuale per estrarre le entità (Oggetti, Mostri, Incantesimi, Abilità) o per catalogare regole generali del manuale (PHB/DMG).

**REGOLE RIGIDE DI CATALOGAZIONE (TUTTE LE REGOLE SONO MANDATORIE):**

1. **DIVIETO ASSOLUTO DI INVENZIONE / ALLUCINAZIONE:**
   - Non inventare MAI informazioni non esplicitamente scritte nel testo o visibili nell'immagine.
   - Se parametri tecnici (es. Classe Armatura, Punti Ferita, Gittata, Scuola, Grado di Sfida (GS), CD di tiri salvezza, danni, componenti d'incantesimo o costi) NON sono presenti nel testo originale, lasciali vuoti o impostali a "N/D". NON tirare a indovinare e non compilare valori medi stimati.
   - Se il testo è troppo parziale, incompleto o incoerente per poter estrarre un'entità con un nome e caratteristiche minime reali, **SCARTA completamente quell'elemento** e non includerlo in alcun vettore di output. Meglio ignorare un frammento illeggibile piuttosto che creare un'entità inventata.

2. **DEDICAZIONE CATEGORICA DELLE SEZIONI (NO DUPLICATI):**
   - **PREDIRIGI SEMPRE LE SEZIONI STRUTTURATE GIÀ PRESENTI:**
     - Ogni **Incantesimo** deve essere inserito esclusivamente nell'array \`spells\`.
     - Ogni **Creatura o Mostro** deve essere inserito esclusivamente nell'array \`monsters\`.
     - Ogni **Oggetto magico, Equipaggiamento, Arma o Armatura** deve essere inserito esclusivamente nell'array \`items\`.
     - Ogni **Abilità o Talento** deve essere inserito esclusivamente nell'array \`skills\`.
   - **ESCLUSIONE RIGIDA DALARRAY "RULES":**
     - Non inserire MAI schede tecniche o definizioni di Incantesimi, Mostri o Oggetti magici nell'array \`rules\`.
     - L'array \`rules\` deve essere riservato **solo ed esclusivamente** a regole testuali di gioco generali, procedure del DM, dinamiche ambientali (es. regole di viaggio, affaticamento, trappole generiche, veleni come dinamica, o manovre di combattimento) che non appartengono alle categorie specifiche di sopra.

3. **Traduzione**: TRADUCI sempre i nomi delle entità in italiano corretto e ufficiale (es: "Shield of Faith" diventa "Scudo della Fede", "Giant Spider" diventa "Ragno Gigante").

4. **Danno Separato**: Se un oggetto è un'arma, estrai il danno (es: "1d8 tagliente") nel campo 'damage' e non includerlo all'inizio della descrizione.

5. **Regole e Capitoli**: Per i testi classificati come regole generali (rules), estrai il testo formattandolo in Markdown ricco mantenendo fedelmente tabelle dei dadi o descrizioni. Associa il corretto libro di origine (phb o dmg) e il titolo approssimativo del capitolo originale.
   - **IMPORTANTE SUI TAG:** I tag devono contenere SOLO brevi parole chiave concettuali in minuscolo (es: 'combattimento', 'movimento', 'trappole', 'veleni', 'esplorazione'). NON inserire MAI nei tag il titolo o il numero del capitolo (es. VIETATO inserire 'Capitolo 2: Condurre il Gioco' o frasi con 'Capitolo').

6. **Lingua**: L'output deve essere interamente in italiano.

Testo fornito:
'''
{{{content}}}
'''

{{#if photoDataUri}}
Foto del manuale: {{media url=photoDataUri}}
{{/if}}
`,
});

const catalogHandbookFlow = ai.defineFlow(
  {
    name: 'catalogHandbookFlow',
    inputSchema: CatalogHandbookInputSchema,
    outputSchema: CatalogHandbookOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
