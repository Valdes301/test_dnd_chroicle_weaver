'use server';

/**
 * @fileOverview Un flusso potenziato per la generazione di mappe SVG.
 * Supporta prompt testuali, analisi di schizzi (visione) e metadati per i layer.
 */

import { summaryAi as ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateMapInputSchema = z.object({
  prompt: z.string().describe('Descrizione del luogo o contesto della mappa.'),
  photoDataUri: z.string().optional().describe("Uno schizzo disegnato a mano, come URI dati Base64."),
  mapType: z.enum(['Dungeon', 'Città', 'Regionale']).default('Dungeon'),
  complexity: z.enum(['Semplice', 'Dettagliata']).default('Semplice'),
});

export type GenerateMapInput = z.infer<typeof GenerateMapInputSchema>;
export type GenerateMapOutput = string;

export async function generateMap(input: GenerateMapInput): Promise<GenerateMapOutput> {
  return generateMapFlow(input);
}

const generateMapFlow = ai.defineFlow(
  {
    name: 'generateMapFlow',
    inputSchema: GenerateMapInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const { text } = await ai.generate({
        prompt: [
            { text: `Sei un Architetto Cartografo per D&D 5e. Il tuo compito è generare codice SVG puro per una mappa di tipo: ${input.mapType}.

            REGOLE DI DISEGNO SVG:
            1. Output: SOLO codice <svg>...</svg>. No commenti, no markdown.
            2. Dimensioni: viewBox="0 0 1000 700". Sfondo bianco (<rect width="100%" height="100%" fill="white"/>).
            3. Stile: Bianco e nero, linee pulite (stroke="black", stroke-width="2", fill="none").
            4. ETICHETTE (CRUCIALE): 
               - Posiziona i nomi delle stanze AL CENTRO delle aree, non sovrapposti ai muri.
               - Usa <text x="..." y="..." font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="black">Nome Stanza</text>
               - Evita di ammassare troppe scritte. Se lo spazio è piccolo, usa abbreviazioni.
            5. LAYER SEGRETI: 
               - Ogni elemento che deve essere visto SOLO dal Master (trappole, tesori, nomi segreti) DEVE avere l'attributo data-master-only="true".
               - Esempio: <text x="100" y="100" data-master-only="true" fill="red" font-size="10">Trappola dardi</text>
               - Usa colori diversi per i segreti (es. rosso o grigio scuro) per distinguerli graficamente se data-master-only è vero.
            6. LIBRERIA SIMBOLI:
               - Muri: <path> o <rect> spessi.
               - Porte: Un piccolo <rect> con fill="white" e stroke="black" lungo il muro.
               - Scale: Serie di linee parallele ravvicinate.
               - Punto di interesse: Un cerchio <circle r="5"> con un'etichetta <text>.
            7. SEMANTICA: Usa etichette chiare per le stanze. Se è una mappa regionale, usa simboli stilizzati per montagne (triangoli) o foreste (piccoli cerchi).

            DESCRIZIONE RICHIESTA: ${input.prompt}
            COMPLESSITÀ: ${input.complexity}

            {{#if photoDataUri}}
            ANALISI SCHIZZO: Analizza l'immagine fornita. È uno schizzo del Master. Traducilo fedelmente in SVG vettoriale, mantenendo le proporzioni e la disposizione degli elementi indicati a mano.
            {{/if}}
            ` },
            ...(input.photoDataUri ? [{ media: { url: input.photoDataUri, contentType: 'image/jpeg' } }] : [])
        ]
    });
    
    // Pulizia dell'output per assicurare che sia SVG valido
    const svgMatch = text.match(/<svg[\s\S]*?>[\s\S]*?<\/svg>/);
    if (!svgMatch) {
      throw new Error("L'IA non è riuscita a generare un SVG valido. Riprova con una descrizione più semplice.");
    }

    return svgMatch[0];
  }
);
