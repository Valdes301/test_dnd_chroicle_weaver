import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'dnd-chronicle-weaver',
    },
  },
});

export async function POST(req: NextRequest) {
  const { message, context } = await req.json();
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `${context ? `Contesto: ${context}\n\n` : ''}User: ${message}`,
    config: {
      systemInstruction: `Sei un Dungeon Master esperto per Dungeons & Dragons 5e e un massimo esperto della storia e dell'ambientazione ufficiale dei Forgotten Realms. Il tuo compito è aiutare il Master a pianificare quest, chiarire regole e fornire dettagli enciclopedici sul lore dei Forgotten Realms. Sii creativo, preciso secondo il canone ufficiale e utile per la gestione della campagna.`,
      temperature: 0.7,
    },
  });
  
  return NextResponse.json({ text: response.text });
}
