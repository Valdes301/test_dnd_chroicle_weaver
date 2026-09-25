'use server';

import { actionResponse } from './actions';
import { getGenAI, safeGenerateContent, getActiveFlashModel } from '@/ai/genai-client';

export async function parsePdfAction(base64Data: string, mimeType: string = 'application/pdf') {
    const isImage = mimeType.startsWith('image/');
    
    // Se è un'immagine, usiamo direttamente l'OCR avanzato di Gemini
    if (isImage) {
        try {
            const genAi = getGenAI();
            const model = getActiveFlashModel();
            const response = await safeGenerateContent(genAi, {
                model,
                contents: [
                    {
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    },
                    "Sei un assistente esperto di D&D. Trascrivi fedelmente e in modo dettagliato tutto il testo contenuto in questa immagine, con particolare attenzione alle statistiche dei mostri, descrizioni degli oggetti magici, formule o descrizioni di magie, talenti o regole di gioco."
                ]
            });
            return actionResponse(response.text || "Nessun testo estratto dall'immagine.");
        } catch (geminiError: any) {
            return actionResponse(null, `Errore estrazione immagine con Gemini: ${geminiError.message}`);
        }
    }

    // Se è un PDF, proviamo prima con il parser locale veloce pdf-parse
    try {
        const pdfModule = await import('pdf-parse');
        const pdfParse = pdfModule.default || pdfModule;
        const buffer = Buffer.from(base64Data, 'base64');
        const data = await pdfParse(buffer);
        if (data && data.text && data.text.trim().length > 50) {
            return actionResponse(data.text);
        }
        throw new Error("Il PDF estratto locale è vuoto o scansionato (senza testo selezionabile).");
    } catch (e: any) {
        console.warn(`[PDF Parser] Fallito parser locale (${e.message}). Provo fallback OCR con Gemini...`);
        try {
            const genAi = getGenAI();
            const model = getActiveFlashModel();
            const response = await safeGenerateContent(genAi, {
                model,
                contents: [
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: base64Data
                        }
                    },
                    "Sei un archivista di D&D. Leggi questo documento PDF ed estrai accuratamente tutto il suo contenuto testuale (regole, statistiche, descrizioni). Mantieni intatta la formattazione logica per permettere la catalogazione automatica."
                ]
            });
            return actionResponse(response.text || "Nessun testo estratto dal PDF.");
        } catch (geminiError: any) {
            return actionResponse(null, `Errore durante l'estrazione PDF (locale e fallback Gemini falliti): ${geminiError.message}`);
        }
    }
}

