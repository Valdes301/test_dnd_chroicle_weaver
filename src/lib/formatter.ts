/**
 * Utilità avanzata per la formattazione e pulizia automatica dei testi narrativi,
 * storie, dossier lore, cronache di sessione e regole D&D (Markdown).
 */

export function formatNarrativeText(rawText: string | null | undefined): string {
  if (!rawText) return '';
  
  let text = rawText;

  // 1. Normalizzazione fine riga (CRLF/CR -> LF)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Rimozione spazi bianchi a fine riga
  text = text.split('\n').map(line => line.trimEnd()).join('\n');

  // 3. Normalizzazione intestazioni Markdown (# Titolo, ## Sottotitolo, etc.)
  // Assicura che ci sia uno spazio tra gli '#' e il testo dell'intestazione
  text = text.replace(/^(\#{1,6})([^\#\s\n])/gm, '$1 $2');
  
  // Se un'intestazione è attaccata a una riga precedente senza a capo doppio, assicura la separazione
  text = text.replace(/([^\n])\n(\#{1,6}\s+[^\n]+)/g, '$1\n\n$2');

  // Assicura che dopo un'intestazione ci sia un a capo pulito
  text = text.replace(/^(\#{1,6}\s+[^\n]+)\n([^\n\#\s])/gm, '$1\n\n$2');

  // 4. Normalizzazione elenchi puntati e numerati
  // Assicura spazio dopo i marcatori di elenco (- item, * item, + item)
  text = text.replace(/^(\s*[-*+])([^\s\-*+\n])/gm, '$1 $2');
  // Assicura spazio dopo gli elenchi numerati (1. item)
  text = text.replace(/^(\s*\d+\.)([^\s\n])/gm, '$1 $2');

  // 5. Normalizzazione citazioni (Blockquotes: > Citazione)
  text = text.replace(/^(\s*>)([^\s>\n])/gm, '$1 $2');

  // 6. Normalizzazione separatori orizzontali (--- o ***)
  text = text.replace(/([^\n])\n(\s*[-*_]{3,}\s*)\n([^\n])/g, '$1\n\n$2\n\n$3');

  // 7. Pulizia sintassi Grassetto e Corsivo Markdown
  // Rimuove spazi errati all'interno di ** grassetto ** o * corsivo *
  text = text.replace(/\*\*\s+([^\*\n]+?)\s+\*\*/g, '**$1**');
  text = text.replace(/__\s+([^_\n]+?)\s+__/g, '__$1__');
  text = text.replace(/(?<!\*)\*\s+([^\*\n\s]+?)\s+\*(?!\*)/g, '*$1*');
  text = text.replace(/(?<!_)_\s+([^_\n\s]+?)\s+_(?!_)/g, '_$1_');

  // 8. Correzione punteggiatura prima/dopo grassetto/corsivo
  // Es: "**testo** ," -> "**testo**,"
  text = text.replace(/\*\*\s+([,\.\:\;\!\?])/g, '**$1');

  // 9. Pulizia punteggiatura generale
  // Rimuove spazi prima della punteggiatura (es: "parola ," -> "parola,")
  text = text.replace(/\s+([,\.\:\;\!\?])/g, '$1');

  // Assicura spazio dopo virgole, punti e virgola, due punti se seguiti da lettere (evitando URL, numeri come 3.5, etc.)
  text = text.replace(/([,;])([a-zA-ZàèéìòùÀÈÉÌÒÙ])/g, '$1 $2');
  text = text.replace(/(:)(?!\/\/|\d)([a-zA-ZàèéìòùÀÈÉÌÒÙ])/g, '$1 $2');
  
  // Assicura spazio dopo punto fermo, punto esclamativo e interrogativo se seguiti da lettere maiuscole
  text = text.replace(/([\.\!\?])([A-ZÀÈÉÌÒÙ])/g, '$1 $2');

  // 10. Normalizzazione trattini di dialogo narrativo
  // Es: inizio riga con "- " o "— "
  text = text.replace(/^(\s*)-\s+/gm, '$1— ');

  // 11. Normalizzazione punti di sospensione multipli (es: "....." -> "...")
  text = text.replace(/\.{4,}/g, '...');
  text = text.replace(/\?{2,}/g, '?');
  text = text.replace(/\!{2,}/g, '!');

  // 12. Pulizia righe vuote multiple (massimo 1 riga vuota tra paragrafi, cioè \n\n)
  text = text.replace(/\n{3,}/g, '\n\n');

  // 13. Trim finale
  return text.trim();
}

/**
 * Pulisce e formatta stringhe corte (es. titoli, sottotitoli, tag)
 */
export function formatTitleOrTag(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\s+/g, ' ')
    .replace(/\s+([,\.\:\;\!\?])/g, '$1')
    .trim();
}
