'use server';

/**
 * @fileOverview A flow to generate a D&D shop, its owner, and unique items using AI.
 */

import { shopAi as ai } from '@/ai/genkit';
import { z } from 'genkit';

const ShopItemSchema = z.object({
  name: z.string().describe("Il nome dell'oggetto."),
  type: z.string().describe("Il tipo di oggetto (es. Arma, Armatura, Bacchetta, Pozione)."),
  rarity: z.string().describe("La rarità (Comune, Non Comune, Rara, Molto Rara, Leggendaria, Artefatto)."),
  cost: z.string().describe("Il costo suggerito in monete (es. 50 mo, 2000 mo)."),
  description: z.string().describe("Una descrizione che include SIA le meccaniche di gioco (danni, dadi, bonus, effetti) SIA il testo narrativo."),
});

const GenerateShopInputSchema = z.object({
  shopType: z.enum(['Alchimista', 'Armaiolo', 'Emporio Magico', 'Bernard', 'Contrabbandiere', 'Mercante Generale', 'Mercante Itinerante', 'Truffatore']).describe("Il tipo di negozio da generare."),
  campaignSummary: z.string().optional().describe("Il riassunto della campagna per contestualizzare gli oggetti."),
  numAiItems: z.number().min(1).max(10).describe("Il numero di oggetti unici normali da generare."),
  generateCursed: z.boolean().optional().describe("Se vero, genera 2 oggetti maledetti extra con tattiche di vendita variabili."),
  homebrewRules: z.string().optional().describe("Regole personalizzate da rispettare."),
  systemOverride: z.string().optional().describe("Sovrascrittura delle istruzioni di sistema."),
});

export type GenerateShopInput = z.infer<typeof GenerateShopInputSchema>;

const GenerateShopOutputSchema = z.object({
  shopName: z.string().describe("Il nome della bottega."),
  ownerName: z.string().describe("Il nome del PNG proprietario."),
  ownerDescription: z.string().describe("Una breve descrizione dell'aspetto e del carattere del PNG."),
  customItems: z.array(ShopItemSchema).describe("Gli oggetti unici generati."),
});

export type GenerateShopOutput = z.infer<typeof GenerateShopOutputSchema>;

export async function generateShop(input: GenerateShopInput): Promise<GenerateShopOutput> {
  return generateShopFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateShopPrompt',
  input: { schema: GenerateShopInputSchema },
  output: { schema: GenerateShopOutputSchema },
  prompt: `{{#if systemOverride}}{{{systemOverride}}}{{else}}Sei un Dungeon Master esperto e creativo per D&D 5e. Devi generare una bottega fantastica e il suo inventario speciale.{{/if}}

**Tipo di Bottega:** {{{shopType}}}

{{#if homebrewRules}}
**REGOLE DELLA CASA DA RISPETTARE:**
{{{homebrewRules}}}
{{/if}}

{{#if campaignSummary}}
**Contesto Campagna (Usa queste info per rendere gli oggetti coerenti):**
{{{campaignSummary}}}
{{/if}}

**Istruzioni sull'Inventario:**
Devi generare un elenco di oggetti unici.
1. Genera esattamente {{{numAiItems}}} oggetti normali coerenti con il tipo di bottega.
2. {{#if generateCursed}}
   IN AGGIUNTA ai precedenti, genera 2 oggetti chiamati "Occasioni Irripetibili". Questi 2 oggetti extra DEVONO essere maledetti. 
   **Tattiche di Vendita per gli oggetti maledetti:** Non usare sempre prezzi stracciati. Varia la strategia:
   - Uno potrebbe essere un "furto" (prezzo bassissimo, es. 10 mo).
   - L'altro potrebbe essere venduto a un prezzo onesto ma sembrare molto più potente di quanto la rarità suggerisca.
   - Oppure il mercante potrebbe inventare una scusa: "È un pezzo di famiglia di cui devo sbarazzarmi in fretta" o "Ha un graffio sulla guardia, lo do a metà prezzo". 
   L'obiettivo è rendere l'opportunità irresistibile ma non palesemente una trappola ricorrente.
{{/if}}

**Istruzioni Fondamentali per ogni Oggetto:**
Per ogni oggetto fornito, devi includere dettagli meccanici precisi per la 5a Edizione e per le eventuali regole homebrew fornite.
1. **Nome**: Evocativo e unico.
2. **Tipo**: Specifica se è un'Arma (indicando la base, es: Spada Lunga), un'Armatura, un Oggetto Meraviglioso, ecc.
3. **Rarità**: Scegli una rarità appropriata tra Comune e Leggendaria.
4. **Descrizione (IMPORTANTE)**: La descrizione deve iniziare con le statistiche di gioco in grassetto. 
   - Per le ARMI: Includi dadi di danno (es: **1d8 danni da forza**), bonus al tiro per colpire e proprietà speciali.
   - Per le ARMATURE: Includi il bonus alla CA o effetti di protezione.
   - Per le POZIONI/OGGETTI: Includi gli effetti magici, le CD dei tiri salvezza e la durata.
   Dopo le statistiche, aggiungi 1-2 frasi di descrizione narrativa.

{{#if generateCursed}}
   **REGOLE PER GLI OGGETTI MALEDETTI (Solo per i 2 extra):**
   - La maledizione deve essere subdola: l'oggetto deve sembrare un affare incredibile.
   - Nella descrizione, scrivi prima tutti i benefici in modo che il DM possa leggerli ai giocatori come "caratteristiche di vendita".
   - Aggiungi una sezione chiaramente separata alla FINE (es: "[MALEDIZIONE]") che descrive l'effetto negativo che si attiva dopo la sintonia o l'uso. Questo testo è solo per il Master.
{{/if}}

**Istruzioni Specifiche per Tipo:**
- **Alchimista**: Oggetti legati a pozioni, erbe rare e polveri esplosive.
- **Armaiolo**: Armi pesanti, corazze decorate o scudi magici con rune.
- **Emporio Magico**: Oggetti arcani, anelli, bacchette e pergamene rare.
- **Bernard**: Il negozio si chiama OBBLIGATORIAMENTE "Il magnifico emporio di Bernard". Bernard è un PNG umano, scaltro ma estremamente leale, amico stretto dei PG (Trovian gli ha salvato la vita). Vende merce di ogni tipo "sotto banco", ma la sua vera forza sono gli oggetti rari e di contrabbando che tiene nascosti. Bernard NON vende mai oggetti maledetti ai suoi amici.
- **Contrabbandiere**: Un mercante illegale generico, sospettoso, che opera in vicoli bui o mercati neri. Vende merce rubata o illegale "sotto banco" a prezzi variabili.
- **Mercante Itinerante**: Carovane o viaggiatori solitari che portano curiosità da terre lontane, spesso oggetti esotici o consumabili unici.
- **Truffatore**: Un venditore carismatico che vende "affaroni". Tutta la sua merce è discutibile, ma i 2 oggetti maledetti extra sono il suo pezzo forte.
- **Mercante Generale**: Oggetti utili per il viaggio ma con un tocco magico.

Fornisci l'output in italiano.`
});

const generateShopFlow = ai.defineFlow(
  {
    name: 'generateShopFlow',
    inputSchema: GenerateShopInputSchema,
    outputSchema: GenerateShopOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
