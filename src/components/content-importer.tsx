'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import * as actions from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileUp, Wand2, Check, X, Shield, Sparkles, Skull, Wand, BrainCircuit, Info, 
  ChevronDown, ChevronUp, Loader2, BookOpen, Edit2, Save, Database, Globe, 
  Layers, Trash2, Play, RefreshCw, AlertCircle, FileText, CheckCircle2, Square, StopCircle 
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { phbManualStructure, dmgManualStructure, type Chapter, type Paragraph } from '@/lib/dnd-data/manual-index-structure';

type ContentImporterProps = {
  campaignId: string;
};

type AnalysisResults = {
  newMagicItems: any[];
  newMonsters: any[];
  newSpells: any[];
  newSkills: any[];
  newRules: any[];
};

type QueueFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'queued' | 'extracting' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  chunksCount?: number;
  processedChunks?: number;
  startPage?: number;
  endPage?: number;
  totalPages?: number;
};

export function ContentImporter({ campaignId }: ContentImporterProps) {
  const [textContent, setTextContent] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  // File Queue Management
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);

  // Real-time stats during pipeline execution
  const [foundStats, setFoundStats] = useState({
    items: 0,
    monsters: 0,
    spells: 0,
    skills: 0,
    rules: 0
  });

  // Tracciamento di quali elementi sono espansi, selezionati o in modifica
  const [expandedIndices, setExpandedIndices] = useState<Record<string, number[]>>({
    items: [], monsters: [], spells: [], skills: [], rules: []
  });
  
  const [selectedIndices, setSelectedIndices] = useState<Record<string, number[]>>({
    items: [], monsters: [], spells: [], skills: [], rules: []
  });

  // Target di importazione per ogni singolo elemento: 'system' o 'campaign'
  const [importTargets, setImportTargets] = useState<Record<string, Record<number, 'system' | 'campaign'>>>({
    items: {}, monsters: {}, spells: {}, skills: {}, rules: {}
  });

  // Elementi in modalità modifica
  const [editingIndices, setEditingIndices] = useState<Record<string, Record<number, boolean>>>({
    items: {}, monsters: {}, spells: {}, skills: {}, rules: {}
  });

  const isAbortedRef = useRef<boolean>(false);

  const { toast } = useToast();
  const router = useRouter();

  // Interrompi ogni operazione se l'utente naviga altrove o smonta il componente
  useEffect(() => {
    return () => {
      isAbortedRef.current = true;
    };
  }, []);

  // Attesa interrompibile per prevenire loop orfani in caso di annullamento
  const abortableSleep = async (ms: number): Promise<boolean> => {
    const step = 200;
    let elapsed = 0;
    while (elapsed < ms && !isAbortedRef.current) {
      await new Promise(r => setTimeout(r, step));
      elapsed += step;
    }
    return !isAbortedRef.current;
  };

  // Funzione per interrompere immediatamente qualsiasi processo in background
  const handleCancelProcessing = () => {
    isAbortedRef.current = true;
    setIsProcessingQueue(false);
    setIsAnalyzing(false);
    setCurrentFileIndex(null);
    setQueue(prev => prev.map(f => (f.status === 'extracting' || f.status === 'analyzing') ? { ...f, status: 'queued', progress: 0 } : f));
    toast({
      title: "Elaborazione Interrotta",
      description: "Tutti i processi in background sono stati arrestati. Nessun'altra richiesta verrà inviata.",
    });
  };

  // Loader dinamico per PDF.js sul client
  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error("Impossibile caricare la libreria di lettura PDF. Verifica la connessione internet."));
      document.head.appendChild(script);
    });
  };

  // Helper per dividere i capitoli o paragrafi di testo in blocchi semantici coerenti
  const chunkPages = (pages: string[], maxChunkSize = 32000): string[] => {
    const chunks: string[] = [];
    let currentChunk = '';
    
    pages.forEach((pageText, idx) => {
      const pageNum = idx + 1;
      const pageHeader = `\n\n--- [PAGINA ${pageNum}] ---\n\n`;
      if ((currentChunk + pageHeader + pageText).length > maxChunkSize && currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
        currentChunk = pageHeader + pageText;
      } else {
        currentChunk += pageHeader + pageText;
      }
    });
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  };

  const chunkTextPlain = (text: string, maxChunkSize = 32000): string[] => {
    const paragraphs = text.split('\n');
    const chunks: string[] = [];
    let currentChunk = '';
    
    paragraphs.forEach((p) => {
      if ((currentChunk + '\n' + p).length > maxChunkSize && currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
        currentChunk = p;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + p;
      }
    });
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  };

  // Funzione per comprimere le immagini sul client
  const compressImage = (dataUrl: string, maxWidth = 1000, maxHeight = 1000, quality = 0.65): Promise<string> => {
    return new Promise((resolve) => {
      const img = typeof window !== 'undefined' ? new window.Image() : null;
      if (!img) {
        resolve(dataUrl);
        return;
      }
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        resolve(dataUrl);
      };
    });
  };

  // Estrazione di testo page-by-page con PDF.js sul Client
  const extractTextFromPdfClient = async (
    file: File, 
    startPage: number | undefined, 
    endPage: number | undefined, 
    onProgress: (p: number) => void
  ): Promise<string[]> => {
    const pdfjs = await loadPdfJs();
    if (!pdfjs) throw new Error("Ambiente server-side rilevato o script non caricabile.");
    
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    const start = startPage && startPage >= 1 ? startPage : 1;
    const end = endPage && endPage <= totalPages ? endPage : totalPages;
    
    const pagesText: string[] = [];
    const pagesToExtract = end - start + 1;
    
    for (let i = start; i <= end; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        pagesText.push(pageText);
        onProgress(Math.round(((i - start + 1) / pagesToExtract) * 100));
      } catch (err) {
        console.warn(`Errore lettura pagina ${i}:`, err);
        pagesText.push("");
      }
    }
    
    return pagesText;
  };

  // Gestione dell'aggiunta dei file alla coda
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles: QueueFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;
      const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
      
      newFiles.push({
        id,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
        status: 'queued',
        progress: 0,
        startPage: 1,
        endPage: undefined,
        totalPages: undefined
      });

      if (isPdf) {
        // Avvia asincronamente la lettura del numero di pagine per non bloccare l'interfaccia!
        setTimeout(async () => {
          try {
            const pdfjs = await loadPdfJs();
            const arrayBuffer = await f.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            setQueue(prev => prev.map(item => item.id === id ? {
              ...item,
              totalPages: pdf.numPages,
              endPage: pdf.numPages
            } : item));
          } catch (err) {
            console.warn("Errore lettura pagine PDF:", err);
          }
        }, 100);
      }
    }

    setQueue(prev => [...prev, ...newFiles]);
    event.target.value = ''; // Reset per ricaricamento
    toast({ title: "File aggiunti alla coda", description: `Aggiunti ${newFiles.length} file pronti per l'elaborazione.` });
  };

  // Rimuovi singolo file dalla coda
  const removeQueueFile = (id: string) => {
    setQueue(prev => prev.filter(f => f.id !== id));
  };

  // Svuota completamente la coda
  const clearQueue = () => {
    setQueue([]);
    setResults(null);
    setFoundStats({ items: 0, monsters: 0, spells: 0, skills: 0, rules: 0 });
  };

  const updateQueueFile = (id: string, updates: Partial<QueueFile>) => {
    setQueue(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Unione intelligente e deduplicazione dei nuovi elementi estratti con quelli correnti
  const mergeAndDeduplicateResults = (newResults: AnalysisResults) => {
    setResults(prev => {
      const current = prev || {
        newMagicItems: [],
        newMonsters: [],
        newSpells: [],
        newSkills: [],
        newRules: []
      };

      const itemsMap = new Map();
      current.newMagicItems.forEach(x => itemsMap.set(x.name.toLowerCase().trim(), x));
      newResults.newMagicItems?.forEach(x => itemsMap.set(x.name.toLowerCase().trim(), x));

      const monstersMap = new Map();
      current.newMonsters.forEach(x => monstersMap.set(x.name.toLowerCase().trim(), x));
      newResults.newMonsters?.forEach(x => monstersMap.set(x.name.toLowerCase().trim(), x));

      const spellsMap = new Map();
      current.newSpells.forEach(x => spellsMap.set(x.name.toLowerCase().trim(), x));
      newResults.newSpells?.forEach(x => spellsMap.set(x.name.toLowerCase().trim(), x));

      const skillsMap = new Map();
      current.newSkills.forEach(x => skillsMap.set(x.name.toLowerCase().trim(), x));
      newResults.newSkills?.forEach(x => skillsMap.set(x.name.toLowerCase().trim(), x));

      const rulesMap = new Map();
      current.newRules.forEach(x => rulesMap.set(x.title.toLowerCase().trim(), x));
      newResults.newRules?.forEach(x => rulesMap.set(x.title.toLowerCase().trim(), x));

      const merged = {
        newMagicItems: Array.from(itemsMap.values()),
        newMonsters: Array.from(monstersMap.values()),
        newSpells: Array.from(spellsMap.values()),
        newSkills: Array.from(skillsMap.values()),
        newRules: Array.from(rulesMap.values())
      };

      // Seleziona tutti di default
      setSelectedIndices({
        items: merged.newMagicItems.map((_, i) => i),
        monsters: merged.newMonsters.map((_, i) => i),
        spells: merged.newSpells.map((_, i) => i),
        skills: merged.newSkills.map((_, i) => i),
        rules: merged.newRules.map((_, i) => i),
      });

      // Target predefiniti: Regole -> system, Altro -> campaign
      const initialTargets: Record<string, Record<number, 'system' | 'campaign'>> = {
        items: {}, monsters: {}, spells: {}, skills: {}, rules: {}
      };
      merged.newMagicItems.forEach((_, i) => { initialTargets.items[i] = 'campaign'; });
      merged.newMonsters.forEach((_, i) => { initialTargets.monsters[i] = 'campaign'; });
      merged.newSpells.forEach((_, i) => { initialTargets.spells[i] = 'campaign'; });
      merged.newSkills.forEach((_, i) => { initialTargets.skills[i] = 'campaign'; });
      merged.newRules.forEach((_, i) => { initialTargets.rules[i] = 'system'; });
      setImportTargets(initialTargets);

      setFoundStats({
        items: merged.newMagicItems.length,
        monsters: merged.newMonsters.length,
        spells: merged.newSpells.length,
        skills: merged.newSkills.length,
        rules: merged.newRules.length
      });

      return merged;
    });
  };

  // Esecuzione sequenziale della coda multi-file
  const runBatchQueue = async () => {
    if (queue.length === 0) {
      toast({ variant: "destructive", title: "Coda vuota", description: "Carica almeno un file prima di avviare." });
      return;
    }

    isAbortedRef.current = false;
    setIsProcessingQueue(true);
    setFoundStats({ items: 0, monsters: 0, spells: 0, skills: 0, rules: 0 });
    setResults(null);

    let hasErrors = false;

    for (let index = 0; index < queue.length; index++) {
      if (isAbortedRef.current) break;
      const qFile = queue[index];
      if (qFile.status === 'completed') continue;

      setCurrentFileIndex(index);
      updateQueueFile(qFile.id, { status: 'extracting', progress: 5 });

      try {
        let textChunks: string[] = [];

        const isPdf = qFile.name.toLowerCase().endsWith('.pdf') || qFile.type === 'application/pdf';
        const isImage = qFile.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(qFile.name);

        if (isImage) {
          if (isAbortedRef.current) break;
          // Analisi diretta dell'immagine con IA Multimodale Vision (estrazione atomica)
          updateQueueFile(qFile.id, { status: 'analyzing', progress: 20 });
          const base64Data = await readFileAsBase64(qFile.file);
          if (isAbortedRef.current) break;
          updateQueueFile(qFile.id, { progress: 40 });
          const compressed = await compressImage(base64Data, 1000, 1000, 0.65);
          if (isAbortedRef.current) break;
          
          updateQueueFile(qFile.id, { progress: 70 });
          const callApi = async (photoData: string) => {
            if (isAbortedRef.current) return { success: false, data: null, error: 'Aborted' };
            try {
              const r = await fetch('/api/catalog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: "", photoDataUri: photoData })
              });
              if (r.ok) {
                const json = await r.json();
                if (json) return json;
              }
            } catch (err: any) {
              console.warn("Fetch /api/catalog failed, trying Server Action fallback...", err);
            }
            if (isAbortedRef.current) return { success: false, data: null, error: 'Aborted' };
            try {
              return await actions.catalogHandbookAction("", photoData);
            } catch (err: any) {
              return { success: false, data: null, error: err?.message || "Errore di connessione" };
            }
          };

          let res = await callApi(compressed);
          let attempts = 0;

          while (!res.success && attempts < 3 && !isAbortedRef.current) {
            attempts++;
            const errStr = String(res.error || '').toLowerCase();
            if (errStr.includes('503') || errStr.includes('service unavailable') || errStr.includes('429') || errStr.includes('quota') || errStr.includes('demand') || errStr.includes('busy') || errStr.includes('http')) {
              toast({ title: "Server IA in forte carico", description: `In attesa di 6s per riprovare l'immagine (tentativo ${attempts + 1}/3)...` });
              const cont = await abortableSleep(6000);
              if (!cont || isAbortedRef.current) break;
              res = await callApi(compressed);
            } else {
              break;
            }
          }

          if (isAbortedRef.current) break;

          if (res.success && res.data) {
            const parsedResults: AnalysisResults = {
              newMagicItems: res.data.items || [],
              newMonsters: res.data.monsters || [],
              newSpells: res.data.spells || [],
              newSkills: res.data.skills || [],
              newRules: res.data.rules || [],
            };
            mergeAndDeduplicateResults(parsedResults);
            updateQueueFile(qFile.id, { status: 'completed', progress: 100 });
            continue; // Passa al file successivo in coda
          } else {
            throw new Error(res.error || "Impossibile analizzare l'immagine.");
          }
        } else if (isPdf) {
          if (isAbortedRef.current) break;
          // Estrazione testo PDF Client-Side con PDF.js (0 bytes binary upload!)
          let pageTexts: string[] = [];
          try {
            pageTexts = await extractTextFromPdfClient(qFile.file, qFile.startPage, qFile.endPage, (p) => {
              if (!isAbortedRef.current) {
                updateQueueFile(qFile.id, { progress: Math.min(p, 90) });
              }
            });
          } catch (pdfErr: any) {
            console.warn("PDF.js client extraction failed, trying server fallback:", pdfErr);
          }
          
          if (isAbortedRef.current) break;

          const combinedLength = pageTexts.join('').trim().length;
          if (combinedLength >= 30) {
            textChunks = chunkPages(pageTexts, 12000);
          } else {
            // Fallback per PDF scansionato
            updateQueueFile(qFile.id, { progress: 50 });
            const b64 = await readFileAsBase64(qFile.file);
            if (isAbortedRef.current) break;
            const cleanB64 = b64.includes(',') ? b64.split(',')[1] : b64;
            const res = await actions.parsePdfAction(cleanB64, 'application/pdf');
            if (res.success && res.data) {
              textChunks = chunkTextPlain(res.data, 12000);
            } else {
              throw new Error(res.error || "PDF vuoto o scansionato senza testo selezionabile.");
            }
          }
        } else {
          // Testo semplice (.txt, .md, .json)
          const text = await readFileAsText(qFile.file);
          textChunks = chunkTextPlain(text, 12000);
        }

        if (isAbortedRef.current) break;

        // Passa all'analisi dei blocchi
        const chunksCount = textChunks.length;
        updateQueueFile(qFile.id, { 
          status: 'analyzing', 
          chunksCount, 
          processedChunks: 0, 
          progress: 0 
        });

        for (let c = 0; c < chunksCount; c++) {
          if (isAbortedRef.current) break;
          const chunk = textChunks[c];

          // Pausa di rispetto rate-limit per evitare errori 429 su elaborazioni estese
          if (c > 0) {
            const cont = await abortableSleep(2500);
            if (!cont || isAbortedRef.current) break;
          }

          if (isAbortedRef.current) break;
          let res = await actions.catalogHandbookAction(chunk);
          let attempts = 0;

          while (!res.success && attempts < 3 && !isAbortedRef.current) {
            attempts++;
            const errStr = String(res.error || '').toLowerCase();
            if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('503') || errStr.includes('demand') || errStr.includes('busy')) {
              toast({ title: "Pausa di rispetto Quota IA", description: `Raggiunto limite frequenza. In attesa di 15s prima del tentativo ${attempts + 1}/3...` });
              const cont = await abortableSleep(15000);
              if (!cont || isAbortedRef.current) break;
              res = await actions.catalogHandbookAction(chunk);
            } else {
              break;
            }
          }
          
          if (isAbortedRef.current) break;

          if (res.success && res.data) {
            const parsedResults: AnalysisResults = {
              newMagicItems: res.data.items || [],
              newMonsters: res.data.monsters || [],
              newSpells: res.data.spells || [],
              newSkills: res.data.skills || [],
              newRules: res.data.rules || [],
            };
            
            mergeAndDeduplicateResults(parsedResults);
            
            const processed = c + 1;
            const progress = Math.round((processed / chunksCount) * 100);
            updateQueueFile(qFile.id, { 
              processedChunks: processed,
              progress
            });
          } else {
            throw new Error(res.error || `Errore catalogazione blocco ${c + 1}`);
          }
        }

        if (isAbortedRef.current) break;
        updateQueueFile(qFile.id, { status: 'completed', progress: 100 });

      } catch (err: any) {
        if (isAbortedRef.current) break;
        hasErrors = true;
        updateQueueFile(qFile.id, { status: 'failed', error: err.message || "Errore sconosciuto" });
        toast({ variant: "destructive", title: `Errore: ${qFile.name}`, description: err.message });
      }
    }

    setIsProcessingQueue(false);
    setCurrentFileIndex(null);

    if (isAbortedRef.current) {
      return;
    }

    if (hasErrors) {
      toast({ 
        variant: "destructive", 
        title: "Coda terminata con errori", 
        description: "Alcuni documenti non sono stati completati. Rivedi i dettagli qui sotto." 
      });
    } else {
      toast({ 
        title: "Elaborazione completata con successo!", 
        description: "Rivedi ora le schede trovate dall'IA." 
      });
    }
  };

  // Funzione di catalogazione manuale per il testo copiato e incollato
  const handleAnalyzePastedText = async () => {
    if (!textContent.trim()) {
      toast({ variant: "destructive", title: "Nessun Contenuto", description: "Incolla del testo o carica un file." });
      return;
    }

    isAbortedRef.current = false;
    setIsAnalyzing(true);
    setFoundStats({ items: 0, monsters: 0, spells: 0, skills: 0, rules: 0 });
    setResults(null);

    try {
      const textChunks = chunkTextPlain(textContent, 12000);
      const chunksCount = textChunks.length;

      for (let cIdx = 0; cIdx < chunksCount; cIdx++) {
        if (isAbortedRef.current) break;
        const chunkText = textChunks[cIdx];
        if (cIdx > 0) {
          const cont = await abortableSleep(2000);
          if (!cont || isAbortedRef.current) break;
        }

        if (isAbortedRef.current) break;
        let result = await actions.catalogHandbookAction(chunkText);
        let attempts = 0;

        while (!result.success && attempts < 3 && !isAbortedRef.current) {
          attempts++;
          const errStr = String(result.error || '').toLowerCase();
          if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('503') || errStr.includes('demand') || errStr.includes('busy')) {
            toast({ title: "In attesa di risposta dall'IA", description: `Riscontrata attesa quota. Riprovando il blocco ${cIdx + 1}/${chunksCount} (tentativo ${attempts + 1}/3)...` });
            const cont = await abortableSleep(6000);
            if (!cont || isAbortedRef.current) break;
            result = await actions.catalogHandbookAction(chunkText);
          } else {
            break;
          }
        }

        if (isAbortedRef.current) break;

        if (result.success && result.data) {
          const parsedResults: AnalysisResults = {
            newMagicItems: result.data.items || [],
            newMonsters: result.data.monsters || [],
            newSpells: result.data.spells || [],
            newSkills: result.data.skills || [],
            newRules: result.data.rules || [],
          };
          mergeAndDeduplicateResults(parsedResults);
        } else {
          throw new Error(result.error || `Errore analisi blocco ${cIdx + 1}`);
        }
      }

      if (isAbortedRef.current) return;
      toast({ title: "Analisi completata con successo!", description: "Rivedi ora tutti gli elementi catalogati qui sotto." });
    } catch (err: any) {
      if (!isAbortedRef.current) {
        toast({ variant: "destructive", title: "Errore nell'analisi", description: err.message });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Gestione selezioni ed espansioni dei risultati di analisi
  const toggleExpand = (type: string, index: number) => {
    setExpandedIndices(prev => {
      const current = prev[type] || [];
      return {
        ...prev,
        [type]: current.includes(index) ? current.filter(i => i !== index) : [...current, index]
      };
    });
  };

  const toggleSelection = (type: string, index: number) => {
    setSelectedIndices(prev => {
      const current = prev[type] || [];
      const next = current.includes(index) ? current.filter(i => i !== index) : [...current, index];
      return { ...prev, [type]: next };
    });
  };

  const handleTargetToggle = (type: string, index: number, target: 'system' | 'campaign') => {
    setImportTargets(prev => {
      const currentSection = prev[type] || {};
      return {
        ...prev,
        [type]: {
          ...currentSection,
          [index]: target
        }
      };
    });
  };

  const toggleEditing = (type: string, index: number) => {
    setEditingIndices(prev => {
      const currentSection = prev[type] || {};
      return {
        ...prev,
        [type]: {
          ...currentSection,
          [index]: !currentSection[index]
        }
      };
    });
  };

  const handleFieldChange = (type: string, index: number, field: string, value: any) => {
    if (!results) return;
    setResults(prev => {
      if (!prev) return null;
      let targetArray: any[] = [];
      let key = '';

      if (type === 'items') { targetArray = [...prev.newMagicItems]; key = 'newMagicItems'; }
      else if (type === 'monsters') { targetArray = [...prev.newMonsters]; key = 'newMonsters'; }
      else if (type === 'spells') { targetArray = [...prev.newSpells]; key = 'newSpells'; }
      else if (type === 'skills') { targetArray = [...prev.newSkills]; key = 'newSkills'; }
      else if (type === 'rules') { targetArray = [...prev.newRules]; key = 'newRules'; }

      if (targetArray[index]) {
        targetArray[index] = {
          ...targetArray[index],
          [field]: value
        };
      }

      return {
        ...prev,
        [key]: targetArray
      };
    });
  };

  // Salvataggio effettivo nel database D&D
  const handleConfirmImport = async () => {
    if (!results) return;
    setIsImporting(true);
    isAbortedRef.current = false;

    try {
      const selectedItems = results.newMagicItems
        .filter((_, i) => selectedIndices.items.includes(i))
        .map(item => ({
          item,
          target: importTargets.items?.[results.newMagicItems.indexOf(item)] || 'campaign'
        }));

      const selectedMonsters = results.newMonsters
        .filter((_, i) => selectedIndices.monsters.includes(i))
        .map(monster => ({
          monster,
          target: importTargets.monsters?.[results.newMonsters.indexOf(monster)] || 'campaign'
        }));

      const selectedSpells = results.newSpells
        .filter((_, i) => selectedIndices.spells.includes(i))
        .map(spell => ({
          spell,
          target: importTargets.spells?.[results.newSpells.indexOf(spell)] || 'campaign'
        }));

      const selectedSkills = results.newSkills
        .filter((_, i) => selectedIndices.skills.includes(i))
        .map(skill => ({
          skill,
          target: importTargets.skills?.[results.newSkills.indexOf(skill)] || 'campaign'
        }));

      const selectedRules = results.newRules
        .filter((_, i) => selectedIndices.rules.includes(i))
        .map((rule, idx) => {
          const cleanTags = (rule.tags || [])
            .map((t: string) => typeof t === 'string' ? t.trim().toLowerCase() : '')
            .filter((t: string) => (
              t.length > 0 &&
              !t.includes('capitolo') &&
              !t.includes('condurre il gioco') &&
              t !== (rule.chapterTitle || '').toLowerCase()
            ));

          return {
            rule: {
              id: rule.id || `rule-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              title: rule.title || 'Nuova Regola',
              content: rule.content || '',
              sourceBook: rule.sourceBook || 'phb',
              chapterTitle: rule.chapterTitle || (rule.sourceBook === 'dmg' ? 'Strumenti del DM' : 'Regole Generali'),
              tags: cleanTags,
              updatedAt: new Date().toISOString()
            },
            target: importTargets.rules?.[results.newRules.indexOf(rule)] || 'system'
          };
        });

      const totalToImport = selectedItems.length + selectedMonsters.length + selectedSpells.length + selectedSkills.length + selectedRules.length;
      if (totalToImport === 0) {
        toast({ title: "Nessun elemento selezionato", description: "Seleziona almeno un elemento da memorizzare." });
        setIsImporting(false);
        return;
      }
      
      if (isAbortedRef.current) return;

      const res = await actions.bulkSaveImportedContentAction(campaignId, {
        items: selectedItems,
        monsters: selectedMonsters,
        spells: selectedSpells,
        skills: selectedSkills,
        rules: selectedRules
      });

      if (isAbortedRef.current) return;

      if (res.success && res.data) {
        toast({
          title: "Importazione completata con successo!",
          description: `Aggiunti correttamente ${res.data.count} elementi al manuale di sistema / campagna.`
        });
        setResults(null);
        setTextContent('');
        setQueue([]);
        router.refresh();
      } else {
        throw new Error(res.error || "Errore durante il salvataggio dei contenuti importati.");
      }

    } catch (error: any) {
      if (!isAbortedRef.current) {
        console.error("Errore durante l'importazione:", error);
        toast({ variant: "destructive", title: "Errore durante il salvataggio", description: error.message || "Si è verificato un errore." });
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Formatta byte in dicitura leggibile
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const setAllTargets = (target: 'system' | 'campaign') => {
    if (!results) return;
    const newTargets: Record<string, Record<number, 'system' | 'campaign'>> = {
      items: {}, monsters: {}, spells: {}, skills: {}, rules: {}
    };

    results.newMagicItems.forEach((_, i) => { newTargets.items[i] = target; });
    results.newMonsters.forEach((_, i) => { newTargets.monsters[i] = target; });
    results.newSpells.forEach((_, i) => { newTargets.spells[i] = target; });
    results.newSkills.forEach((_, i) => { newTargets.skills[i] = target; });
    results.newRules.forEach((_, i) => { newTargets.rules[i] = target; });

    setImportTargets(newTargets);
    toast({
      title: target === 'system' ? "Destinazione: Tutto su Sistema" : "Destinazione: Tutto su Campagna",
      description: `Tutti gli elementi estratti verranno salvati in ${target === 'system' ? 'Manuale Globale di Sistema' : 'Campagna corrente (SQLite)'}.`
    });
  };

  if (results) {
    const totalFound = results.newMagicItems.length + results.newMonsters.length + results.newSpells.length + results.newSkills.length + results.newRules.length;
    const totalSelected = selectedIndices.items.length + selectedIndices.monsters.length + selectedIndices.spells.length + selectedIndices.skills.length + selectedIndices.rules.length;

    return (
      <Card className="border-accent/40 animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="bg-accent/5 p-4 sm:p-6 space-y-3">
          <CardTitle className="font-headline text-xl sm:text-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span>Revisione & Destinazione Importazione</span>
            <Badge variant="secondary" className="text-xs sm:text-sm bg-primary/20 text-primary border-primary/30 shrink-0">{totalSelected} / {totalFound} selezionati</Badge>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Rivedi ciascun elemento catalogato dall'IA. Puoi modificarlo sul momento e selezionare se salvarlo a livello <strong>Globale a Sistema</strong> (Manuale Base persistente) o nella <strong>Campagna corrente</strong> (SQLite).
          </CardDescription>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-accent/20">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> Azioni Rapide Destinazione:
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30 font-medium"
              onClick={() => setAllTargets('system')}
            >
              <Globe className="h-3.5 w-3.5 mr-1" /> Rendi TUTTO Sistema
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 font-medium"
              onClick={() => setAllTargets('campaign')}
            >
              <Database className="h-3.5 w-3.5 mr-1" /> Rendi TUTTO Campagna
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-3 sm:pt-6">
          <div className="max-h-[65vh] overflow-y-auto pr-1 sm:pr-4 scrollbar-thin">
            <div className="space-y-6 sm:space-y-8">

              {/* REGOLE DEL MANUALE */}
              {results.newRules.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0" /> Regole e Capitoli del Manuale ({results.newRules.length})
                  </h3>
                  <div className="grid gap-3">
                    {results.newRules.map((rule, i) => {
                      const isEditing = editingIndices.rules?.[i] || false;
                      const target = importTargets.rules?.[i] || 'system';
                      const isExpanded = expandedIndices.rules?.includes(i) || isEditing;

                      const isDmg = rule.sourceBook === 'dmg';
                      const manualChapters = isDmg ? dmgManualStructure : phbManualStructure;
                      const currentChapter = manualChapters.find(c => c.id === rule.chapterId) || manualChapters[0];

                      return (
                        <div key={i} className={cn("flex flex-col p-2.5 sm:p-4 rounded-xl border transition-all duration-200 overflow-hidden", selectedIndices.rules.includes(i) ? "bg-background border-amber-500/30 shadow-sm" : "bg-muted/10 opacity-60")}>
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Checkbox checked={selectedIndices.rules.includes(i)} onCheckedChange={() => toggleSelection('rules', i)} className="mt-1 border-amber-500/50 data-[state=checked]:bg-amber-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1" onClick={() => toggleExpand('rules', i)}>
                                <span className="font-bold text-sm sm:text-base cursor-pointer hover:text-amber-500 transition-colors line-clamp-1">{rule.title}</span>
                                <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 py-0 h-4">{isDmg ? 'Master' : 'Giocatore'}</Badge>
                                <Badge variant="secondary" className="text-[9px] sm:text-[10px] py-0 h-4 truncate max-w-[120px]">{rule.chapterTitle || 'Regola'}</Badge>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-primary" onClick={() => toggleEditing('rules', i)}>
                                {isEditing ? <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => toggleExpand('rules', i)}>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4"/> : <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>}
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2.5 sm:mt-3 pl-0 sm:pl-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 border-y border-muted/20 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] sm:text-xs"><Layers className="h-3.5 w-3.5 shrink-0" /> Salva in:</span>
                            <div className="grid grid-cols-2 w-full sm:w-auto items-center gap-1 bg-muted/40 p-1 rounded-lg">
                              <Button size="sm" variant={target === 'system' ? 'default' : 'ghost'} className={cn("h-7 px-2 text-[10px] sm:text-xs justify-center", target === 'system' && "bg-amber-500 hover:bg-amber-600")} onClick={() => handleTargetToggle('rules', i, 'system')}>
                                <Globe className="h-3.5 w-3.5 mr-1 shrink-0" /> Sistema
                              </Button>
                              <Button size="sm" variant={target === 'campaign' ? 'default' : 'ghost'} className="h-7 px-2 text-[10px] sm:text-xs justify-center" onClick={() => handleTargetToggle('rules', i, 'campaign')}>
                                <Database className="h-3.5 w-3.5 mr-1 shrink-0" /> Campagna
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 sm:mt-4 pl-0 sm:pl-8 space-y-3 sm:space-y-4 animate-in slide-in-from-top-1 duration-200">
                              {isEditing ? (
                                <div className="space-y-3 p-2.5 sm:p-3 bg-muted/20 rounded-lg border border-muted-foreground/10">
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Titolo Regola</Label>
                                    <Input value={rule.title} onChange={e => handleFieldChange('rules', i, 'title', e.target.value)} className="mt-1 text-xs" />
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Manuale Fonte</Label>
                                      <select value={rule.sourceBook} onChange={e => {
                                        const book = e.target.value as 'phb' | 'dmg';
                                        handleFieldChange('rules', i, 'sourceBook', book);
                                        const structure = book === 'dmg' ? dmgManualStructure : phbManualStructure;
                                        handleFieldChange('rules', i, 'chapterId', structure[0].id);
                                        handleFieldChange('rules', i, 'chapterTitle', structure[0].title);
                                      }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1">
                                        <option value="phb">Giocatore (PHB)</option>
                                        <option value="dmg">Master (DMG)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Capitolo Manuale</Label>
                                      <select value={rule.chapterId} onChange={e => {
                                        const chapId = e.target.value;
                                        const chap = manualChapters.find(c => c.id === chapId);
                                        handleFieldChange('rules', i, 'chapterId', chapId);
                                        if (chap) handleFieldChange('rules', i, 'chapterTitle', chap.title);
                                      }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1">
                                        {manualChapters.map(c => (
                                          <option key={c.id} value={c.id}>{c.title}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sezione / Paragrafo</Label>
                                    <select value={rule.paragraphId || ''} onChange={e => {
                                      const pId = e.target.value;
                                      const para = currentChapter.paragraphs.find(p => p.id === pId);
                                      handleFieldChange('rules', i, 'paragraphId', pId || undefined);
                                      if (para) handleFieldChange('rules', i, 'paragraphTitle', para.title);
                                    }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1">
                                      <option value="">Nessun paragrafo specifico (Generale)</option>
                                      {currentChapter.paragraphs.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Contenuto (Markdown)</Label>
                                    <Textarea value={rule.content} onChange={e => handleFieldChange('rules', i, 'content', e.target.value)} className="font-mono text-xs mt-1 min-h-[120px]" />
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 bg-muted/5 p-3 sm:p-4 rounded-lg border border-muted/10">
                                  <div className="flex flex-wrap gap-2 text-[10px] sm:text-[11px] text-muted-foreground border-b pb-2">
                                    <span><strong>Capitolo:</strong> {rule.chapterTitle}</span>
                                    {rule.paragraphTitle && <span><strong>Sezione:</strong> {rule.paragraphTitle}</span>}
                                  </div>
                                  <div className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                                    {rule.content}
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-end pt-1">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-amber-500" onClick={() => toggleExpand('rules', i)}>
                                  <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* OGGETTI MAGICI */}
              {results.newMagicItems.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0" /> Oggetti ed Equipaggiamento ({results.newMagicItems.length})
                  </h3>
                  <div className="grid gap-2 sm:gap-3">
                    {results.newMagicItems.map((item, i) => {
                      const isEditing = editingIndices.items?.[i] || false;
                      const target = importTargets.items?.[i] || 'campaign';
                      const isExpanded = expandedIndices.items?.includes(i) || isEditing;

                      return (
                        <div key={i} className={cn("flex flex-col p-2.5 sm:p-4 rounded-xl border transition-colors overflow-hidden", selectedIndices.items.includes(i) ? "bg-background border-primary/30 shadow-sm" : "bg-muted/10 opacity-50")}>
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Checkbox checked={selectedIndices.items.includes(i)} onCheckedChange={() => toggleSelection('items', i)} className="mt-1 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1 cursor-pointer" onClick={() => toggleExpand('items', i)}>
                                <span className="font-bold text-sm sm:text-base truncate line-clamp-1">{item.name}</span>
                                <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 h-4">{item.rarity || 'Comune'}</Badge>
                                {item.cost && <Badge variant="secondary" className="text-[9px] sm:text-[10px] py-0 h-4 bg-amber-500/10 text-amber-500 border-amber-500/20">{item.cost}</Badge>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-primary" onClick={() => toggleEditing('items', i)}>
                                {isEditing ? <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => toggleExpand('items', i)}>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4"/> : <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>}
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2.5 pl-0 sm:pl-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-1.5 border-y border-muted/10 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] sm:text-xs"><Layers className="h-3.5 w-3.5 shrink-0" /> Salva in:</span>
                            <div className="grid grid-cols-2 w-full sm:w-auto items-center gap-1 bg-muted/40 p-1 rounded-lg">
                              <Button size="sm" variant={target === 'system' ? 'default' : 'ghost'} className={cn("h-6 px-2 text-[10px] sm:text-[11px] justify-center", target === 'system' && "bg-primary hover:bg-primary/95")} onClick={() => handleTargetToggle('items', i, 'system')}>
                                <Globe className="h-3 w-3 mr-1 shrink-0" /> Sistema
                              </Button>
                              <Button size="sm" variant={target === 'campaign' ? 'default' : 'ghost'} className="h-6 px-2 text-[10px] sm:text-[11px] justify-center" onClick={() => handleTargetToggle('items', i, 'campaign')}>
                                <Database className="h-3 w-3 mr-1 shrink-0" /> Campagna
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pl-0 sm:pl-8 text-xs text-muted-foreground animate-in slide-in-from-top-1">
                              {isEditing ? (
                                <div className="space-y-2 p-2.5 sm:p-3 bg-muted/20 rounded-lg">
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Nome Oggetto</Label>
                                    <Input value={item.name} onChange={e => handleFieldChange('items', i, 'name', e.target.value)} className="h-8 text-xs mt-1" />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Tipo</Label>
                                      <Input value={item.type || ''} onChange={e => handleFieldChange('items', i, 'type', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Rarità</Label>
                                      <Input value={item.rarity || ''} onChange={e => handleFieldChange('items', i, 'rarity', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Costo</Label>
                                      <Input value={item.cost || ''} onChange={e => handleFieldChange('items', i, 'cost', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Danno</Label>
                                      <Input value={item.damage || ''} onChange={e => handleFieldChange('items', i, 'damage', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Descrizione</Label>
                                    <Textarea value={item.description || ''} onChange={e => handleFieldChange('items', i, 'description', e.target.value)} className="text-xs mt-1 min-h-[80px]" />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 sm:p-3 bg-muted/5 rounded-lg border border-muted/10 space-y-1.5">
                                  <p className="text-[11px] sm:text-xs"><span className="font-bold">Tipo:</span> {item.type || 'N/D'} • <span className="font-bold">Sintonia:</span> {item.attunement || 'No'} {item.damage && `• Danno: ${item.damage}`}</p>
                                  <p className="italic text-muted-foreground whitespace-pre-wrap text-xs">{item.description}</p>
                                </div>
                              )}
                              <div className="flex justify-end pt-1">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-primary" onClick={() => toggleExpand('items', i)}>
                                  <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* MOSTRI */}
              {results.newMonsters.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-rose-500 flex items-center gap-2">
                    <Skull className="h-4 w-4 shrink-0" /> Bestiario ({results.newMonsters.length})
                  </h3>
                  <div className="grid gap-2 sm:gap-3">
                    {results.newMonsters.map((m, i) => {
                      const isEditing = editingIndices.monsters?.[i] || false;
                      const target = importTargets.monsters?.[i] || 'campaign';
                      const isExpanded = expandedIndices.monsters?.includes(i) || isEditing;

                      return (
                        <div key={i} className={cn("flex flex-col p-2.5 sm:p-4 rounded-xl border transition-colors overflow-hidden", selectedIndices.monsters.includes(i) ? "bg-background border-rose-500/30 shadow-sm" : "bg-muted/10 opacity-50")}>
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Checkbox checked={selectedIndices.monsters.includes(i)} onCheckedChange={() => toggleSelection('monsters', i)} className="mt-1 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1 cursor-pointer" onClick={() => toggleExpand('monsters', i)}>
                                <span className="font-bold text-sm sm:text-base truncate line-clamp-1">{m.name}</span>
                                <Badge variant="secondary" className="text-[9px] sm:text-[10px] bg-rose-500/10 text-rose-500 border-rose-500/20 py-0 h-4">GS {m.challenge || '?'}</Badge>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-primary" onClick={() => toggleEditing('monsters', i)}>
                                {isEditing ? <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => toggleExpand('monsters', i)}>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4"/> : <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>}
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2.5 pl-0 sm:pl-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-1.5 border-y border-muted/10 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] sm:text-xs"><Layers className="h-3.5 w-3.5 shrink-0" /> Salva in:</span>
                            <div className="grid grid-cols-2 w-full sm:w-auto items-center gap-1 bg-muted/40 p-1 rounded-lg">
                              <Button size="sm" variant={target === 'system' ? 'default' : 'ghost'} className={cn("h-6 px-2 text-[10px] sm:text-[11px] justify-center", target === 'system' && "bg-rose-500 hover:bg-rose-600")} onClick={() => handleTargetToggle('monsters', i, 'system')}>
                                <Globe className="h-3 w-3 mr-1 shrink-0" /> Sistema
                              </Button>
                              <Button size="sm" variant={target === 'campaign' ? 'default' : 'ghost'} className="h-6 px-2 text-[10px] sm:text-[11px] justify-center" onClick={() => handleTargetToggle('monsters', i, 'campaign')}>
                                <Database className="h-3 w-3 mr-1 shrink-0" /> Campagna
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pl-0 sm:pl-8 text-xs text-muted-foreground animate-in slide-in-from-top-1">
                              {isEditing ? (
                                <div className="space-y-2 p-2.5 sm:p-3 bg-muted/20 rounded-lg">
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Nome Mostro</Label>
                                    <Input value={m.name} onChange={e => handleFieldChange('monsters', i, 'name', e.target.value)} className="h-8 text-xs mt-1" />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Classe Armatura</Label>
                                      <Input value={m.armorClass || ''} onChange={e => handleFieldChange('monsters', i, 'armorClass', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Punti Ferita</Label>
                                      <Input value={m.hitPoints || ''} onChange={e => handleFieldChange('monsters', i, 'hitPoints', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Tipo Creatura</Label>
                                      <Input value={m.type || ''} onChange={e => handleFieldChange('monsters', i, 'type', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Grado Sfida (GS)</Label>
                                      <Input value={m.challenge || ''} onChange={e => handleFieldChange('monsters', i, 'challenge', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Descrizione & Abilità</Label>
                                    <Textarea value={m.description || ''} onChange={e => handleFieldChange('monsters', i, 'description', e.target.value)} className="text-xs mt-1 min-h-[80px]" />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 sm:p-3 bg-muted/5 rounded-lg border border-muted/10 space-y-1.5">
                                  <p className="text-[11px] sm:text-xs"><span className="font-bold">Dati:</span> {m.type || 'N/D'} • <span className="font-bold">CA:</span> {m.armorClass || '10'} • <span className="font-bold">PF:</span> {m.hitPoints || '10'}</p>
                                  <p className="italic text-muted-foreground whitespace-pre-wrap text-xs">{m.description}</p>
                                </div>
                              )}
                              <div className="flex justify-end pt-1">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-rose-500" onClick={() => toggleExpand('monsters', i)}>
                                  <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* INCANTESIMI */}
              {results.newSpells.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                    <Wand className="h-4 w-4 shrink-0" /> Incantesimi e Magie ({results.newSpells.length})
                  </h3>
                  <div className="grid gap-2 sm:gap-3">
                    {results.newSpells.map((s, i) => {
                      const isEditing = editingIndices.spells?.[i] || false;
                      const target = importTargets.spells?.[i] || 'campaign';
                      const isExpanded = expandedIndices.spells?.includes(i) || isEditing;

                      return (
                        <div key={i} className={cn("flex flex-col p-2.5 sm:p-4 rounded-xl border transition-colors overflow-hidden", selectedIndices.spells.includes(i) ? "bg-background border-indigo-500/30 shadow-sm" : "bg-muted/10 opacity-50")}>
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Checkbox checked={selectedIndices.spells.includes(i)} onCheckedChange={() => toggleSelection('spells', i)} className="mt-1 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1 cursor-pointer" onClick={() => toggleExpand('spells', i)}>
                                <span className="font-bold text-sm sm:text-base truncate line-clamp-1">{s.name}</span>
                                <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 h-4">Liv. {s.level || 'Trucchetto'}</Badge>
                                {s.school && <Badge variant="secondary" className="text-[9px] sm:text-[10px] py-0 h-4 bg-indigo-500/10 text-indigo-500 border-indigo-500/20">{s.school}</Badge>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-primary" onClick={() => toggleEditing('spells', i)}>
                                {isEditing ? <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => toggleExpand('spells', i)}>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4"/> : <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>}
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2.5 pl-0 sm:pl-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-1.5 border-y border-muted/10 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] sm:text-xs"><Layers className="h-3.5 w-3.5 shrink-0" /> Salva in:</span>
                            <div className="grid grid-cols-2 w-full sm:w-auto items-center gap-1 bg-muted/40 p-1 rounded-lg">
                              <Button size="sm" variant={target === 'system' ? 'default' : 'ghost'} className={cn("h-6 px-2 text-[10px] sm:text-[11px] justify-center", target === 'system' && "bg-indigo-500 hover:bg-indigo-600")} onClick={() => handleTargetToggle('spells', i, 'system')}>
                                <Globe className="h-3 w-3 mr-1 shrink-0" /> Sistema
                              </Button>
                              <Button size="sm" variant={target === 'campaign' ? 'default' : 'ghost'} className="h-6 px-2 text-[10px] sm:text-[11px] justify-center" onClick={() => handleTargetToggle('spells', i, 'campaign')}>
                                <Database className="h-3 w-3 mr-1 shrink-0" /> Campagna
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pl-0 sm:pl-8 text-xs text-muted-foreground animate-in slide-in-from-top-1">
                              {isEditing ? (
                                <div className="space-y-2 p-2.5 sm:p-3 bg-muted/20 rounded-lg">
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Nome Incantesimo</Label>
                                    <Input value={s.name} onChange={e => handleFieldChange('spells', i, 'name', e.target.value)} className="h-8 text-xs mt-1" />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Livello</Label>
                                      <Input value={s.level || ''} onChange={e => handleFieldChange('spells', i, 'level', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Scuola</Label>
                                      <Input value={s.school || ''} onChange={e => handleFieldChange('spells', i, 'school', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Tempo di Lancio</Label>
                                      <Input value={s.casting_time || ''} onChange={e => handleFieldChange('spells', i, 'casting_time', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Gittata</Label>
                                      <Input value={s.range || ''} onChange={e => handleFieldChange('spells', i, 'range', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Componenti</Label>
                                      <Input value={s.components || ''} onChange={e => handleFieldChange('spells', i, 'components', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] uppercase font-bold">Durata</Label>
                                      <Input value={s.duration || ''} onChange={e => handleFieldChange('spells', i, 'duration', e.target.value)} className="h-8 text-xs mt-1" />
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Classi</Label>
                                    <Input value={s.classes || ''} onChange={e => handleFieldChange('spells', i, 'classes', e.target.value)} className="h-8 text-xs mt-1" />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Effetto</Label>
                                    <Textarea value={s.description || ''} onChange={e => handleFieldChange('spells', i, 'description', e.target.value)} className="text-xs mt-1 min-h-[80px]" />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 sm:p-3 bg-muted/5 rounded-lg border border-muted/10 space-y-1.5">
                                  <p className="text-[11px] sm:text-xs"><span className="font-bold">Dati:</span> Scuola: {s.school || 'Univ'} • Tempo: {s.casting_time || '1 Azione'} • Gittata: {s.range || 'Contatto'}</p>
                                  <p className="text-[11px] sm:text-xs"><span className="font-bold">Componenti:</span> {s.components || 'V, S'} • Durata: {s.duration || 'Istantanea'}</p>
                                  <p className="italic text-muted-foreground whitespace-pre-wrap text-xs">{s.description}</p>
                                </div>
                              )}
                              <div className="flex justify-end pt-1">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-indigo-500" onClick={() => toggleExpand('spells', i)}>
                                  <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ABILITA' */}
              {results.newSkills.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 shrink-0" /> Abilità e Capacità ({results.newSkills.length})
                  </h3>
                  <div className="grid gap-2 sm:gap-3">
                    {results.newSkills.map((sk, i) => {
                      const isEditing = editingIndices.skills?.[i] || false;
                      const isExpanded = expandedIndices.skills?.includes(i) || isEditing;

                      return (
                        <div key={i} className={cn("flex flex-col p-2.5 sm:p-4 rounded-xl border transition-colors overflow-hidden", selectedIndices.skills.includes(i) ? "bg-background border-emerald-500/30 shadow-sm" : "bg-muted/10 opacity-50")}>
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Checkbox checked={selectedIndices.skills.includes(i)} onCheckedChange={() => toggleSelection('skills', i)} className="mt-1 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1 cursor-pointer" onClick={() => toggleExpand('skills', i)}>
                                <span className="font-bold text-sm sm:text-base truncate line-clamp-1">{sk.name}</span>
                                <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{sk.ability || 'Varia'}</Badge>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-primary" onClick={() => toggleEditing('skills', i)}>
                                {isEditing ? <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => toggleExpand('skills', i)}>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4"/> : <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>}
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pl-0 sm:pl-8 text-xs text-muted-foreground animate-in slide-in-from-top-1">
                              {isEditing ? (
                                <div className="space-y-2 p-2.5 sm:p-3 bg-muted/20 rounded-lg">
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Nome Abilità</Label>
                                    <Input value={sk.name} onChange={e => handleFieldChange('skills', i, 'name', e.target.value)} className="h-8 text-xs mt-1" />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Caratteristica Correlata</Label>
                                    <Input value={sk.ability || ''} onChange={e => handleFieldChange('skills', i, 'ability', e.target.value)} className="h-8 text-xs mt-1" />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold">Descrizione</Label>
                                    <Textarea value={sk.description || ''} onChange={e => handleFieldChange('skills', i, 'description', e.target.value)} className="text-xs mt-1 min-h-[80px]" />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 sm:p-3 bg-muted/5 rounded-lg border border-muted/10 space-y-1.5">
                                  <p className="italic text-muted-foreground whitespace-pre-wrap text-xs">{sk.description}</p>
                                </div>
                              )}
                              <div className="flex justify-end pt-1">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-emerald-500" onClick={() => toggleExpand('skills', i)}>
                                  <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col-reverse sm:flex-row gap-3 border-t p-4 sm:p-6">
          <Button variant="ghost" onClick={() => setResults(null)} className="w-full sm:w-auto text-xs sm:text-sm">
            <X className="mr-2 h-4 w-4" /> Annulla e torna al caricamento
          </Button>
          <Button onClick={handleConfirmImport} disabled={totalSelected === 0 || isImporting} className="w-full sm:flex-1 shadow-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs sm:text-sm">
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Conferma Importazione ({totalSelected} elementi)
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="font-headline flex items-center text-xl sm:text-2xl gap-2">
            <FileUp className="text-amber-500 h-5 w-5 sm:h-6 sm:w-6 shrink-0" /> Importatore Intelligente & Coda Documenti
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Carica più file contemporaneamente (manuali PDF anche pesanti di oltre 150MB, foto/immagini di pagine, o file .txt) oppure incolla del testo grezzo. L'IA spezzetterà ed elaborerà tutto in modo progressivo e sicuro, senza bloccare il browser.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-3 sm:p-6 space-y-6">
          {/* Griglia Principale: Caricamento File e Copia & Incolla */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Pannello Caricamento File e Coda */}
            <div className="space-y-4 border rounded-xl p-3 sm:p-4 bg-muted/5">
              <div>
                <Label htmlFor="content-file-input" className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <FileText className="h-4 w-4 text-primary shrink-0" /> Carica uno o più Documenti (PDF, JPG, PNG, TXT)
                </Label>
                <Input 
                  id="content-file-input"
                  type="file" 
                  multiple
                  accept=".pdf,.txt,.json,application/pdf,image/*" 
                  onChange={handleFileChange} 
                  className="h-11 border-muted cursor-pointer text-xs sm:text-sm file:mr-2 file:py-1 file:px-2 file:text-xs file:rounded-md file:border-0 file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  disabled={isProcessingQueue}
                />
              </div>

              {queue.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Coda di Elaborazione ({queue.length})</span>
                    <Button variant="ghost" size="sm" onClick={clearQueue} disabled={isProcessingQueue} className="h-7 text-[11px] text-destructive hover:text-destructive/85">
                      <Trash2 className="h-3 w-3 mr-1" /> Svuota coda
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                    {queue.map((q, qIdx) => {
                      const isActive = qIdx === currentFileIndex;
                      
                      return (
                        <div key={q.id} className={cn(
                          "p-2.5 sm:p-3 rounded-lg border text-xs flex flex-col gap-2 transition-all duration-200",
                          isActive ? "border-amber-500/40 bg-amber-500/5 shadow-sm" : "bg-card border-muted/20"
                        )}>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="font-semibold truncate text-xs sm:text-sm">{q.name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatBytes(q.size)} • {q.type || 'Sconosciuto'}</p>
                              
                              {q.totalPages && q.totalPages > 1 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-muted/10">
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Pagine (Tot. {q.totalPages}):</span>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={q.endPage || q.totalPages}
                                      value={q.startPage || 1}
                                      disabled={isProcessingQueue}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        updateQueueFile(q.id, { startPage: Math.max(1, Math.min(val, q.totalPages || 1)) });
                                      }}
                                      className="w-14 h-6 px-1 py-0 text-center text-[10px] bg-background"
                                    />
                                    <span className="text-[10px] text-muted-foreground">-</span>
                                    <Input
                                      type="number"
                                      min={q.startPage || 1}
                                      max={q.totalPages}
                                      value={q.endPage || q.totalPages}
                                      disabled={isProcessingQueue}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || q.totalPages || 1;
                                        updateQueueFile(q.id, { endPage: Math.max(q.startPage || 1, Math.min(val, q.totalPages || 1)) });
                                      }}
                                      className="w-14 h-6 px-1 py-0 text-center text-[10px] bg-background"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-muted/10">
                              {q.status === 'queued' && (
                                <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">In attesa</Badge>
                              )}
                              {q.status === 'extracting' && (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] flex items-center gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Lettura...
                                </Badge>
                              )}
                              {q.status === 'analyzing' && (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] flex items-center gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Analisi...
                                </Badge>
                              )}
                              {q.status === 'completed' && (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] flex items-center gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /> Fatto
                                </Badge>
                              )}
                              {q.status === 'failed' && (
                                <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                                  <AlertCircle className="h-2.5 w-2.5" /> Errore
                                </Badge>
                              )}
                              {!isProcessingQueue && q.status !== 'completed' && (
                                <Button variant="ghost" size="icon" onClick={() => removeQueueFile(q.id)} className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {(q.status === 'extracting' || q.status === 'analyzing') && (
                            <div className="space-y-1 mt-1">
                              <div className="flex justify-between text-[9px] text-muted-foreground">
                                <span>
                                  {q.status === 'extracting' ? 'Estrazione testo PDF...' : `Blocchi elaborati: ${q.processedChunks || 0}/${q.chunksCount || 1}`}
                                </span>
                                <span className="font-mono">{q.progress}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${q.progress}%` }}></div>
                              </div>
                            </div>
                          )}

                          {q.error && (
                            <p className="text-[10px] text-destructive italic mt-1 leading-tight flex items-start gap-1">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {q.error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Statistiche real-time del batch */}
                  {(foundStats.items > 0 || foundStats.monsters > 0 || foundStats.spells > 0 || foundStats.rules > 0 || foundStats.skills > 0) && (
                    <div className="p-2.5 sm:p-3 bg-muted/30 border rounded-lg text-xs space-y-1.5 animate-in fade-in duration-200">
                      <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Elementi trovati finora nella sessione:</p>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {foundStats.rules > 0 && <span className="text-amber-500 font-medium">📜 Regole: {foundStats.rules}</span>}
                        {foundStats.items > 0 && <span className="text-primary font-medium">🛡️ Oggetti: {foundStats.items}</span>}
                        {foundStats.monsters > 0 && <span className="text-rose-500 font-medium">💀 Mostri: {foundStats.monsters}</span>}
                        {foundStats.spells > 0 && <span className="text-indigo-500 font-medium">🔮 Magie: {foundStats.spells}</span>}
                        {foundStats.skills > 0 && <span className="text-emerald-500 font-medium">⚔️ Abilità: {foundStats.skills}</span>}
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={runBatchQueue} 
                    disabled={isProcessingQueue || !queue.some(f => f.status !== 'completed')} 
                    className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    {isProcessingQueue ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Elaborazione in Corso...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Avvia Elaborazione Multi-File
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Pannello Copia & Incolla manuale */}
            <div className="space-y-4 border rounded-xl p-3 sm:p-4 bg-muted/5 flex flex-col justify-between">
              <div className="space-y-3 flex-1 flex flex-col">
                <Label htmlFor="paste-area" className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4 text-primary shrink-0" /> Oppure Copia e Incolla Testo Libero
                </Label>
                <Textarea
                  id="paste-area"
                  placeholder='Esempio di testo da incollare:
"I VELENI (MANUALE DEL MASTER)
Un assassino può usare il veleno per abbattere una vittima...
Veleno a Contatto (CD 12 Costituzione, subisce 1d10 danni...)"'
                  className="flex-1 min-h-[140px] sm:min-h-[160px] font-mono text-xs bg-muted/10 border-muted focus-visible:ring-amber-500/50"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isProcessingQueue || isAnalyzing}
                />
              </div>
              
              <Button 
                onClick={handleAnalyzePastedText} 
                disabled={!textContent.trim() || isProcessingQueue || isAnalyzing} 
                className="w-full h-11 mt-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold flex items-center justify-center gap-2 border text-xs sm:text-sm"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisi testo in corso...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Analizza Testo Incollato
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Box Informativo: Spostato in basso per dare priorità all'azione sui dispositivi mobili */}
          <div className="p-3.5 sm:p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 flex items-start gap-3 sm:gap-4">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
              <p className="font-bold text-amber-500 text-xs sm:text-sm">Architettura di Elaborazione ad Alte Prestazioni</p>
              <p>• <strong>0 byte caricati sul server per i PDF:</strong> L'estrazione del testo avviene localmente nel browser pagina per pagina.</p>
              <p>• <strong>Deduplicazione Automatica:</strong> Gli elementi con lo stesso nome identificati in blocchi o file diversi vengono uniti automaticamente.</p>
              <p>• <strong>Nessun Limite di Peso (PDF 150MB+):</strong> Puoi caricare file di grandi dimensioni o file multipli contemporaneamente.</p>
              <p>• <strong>Filtro Intervallo Pagine:</strong> Puoi indicare un intervallo di pagine specifico (es. da pagina 50 a 80) per i tuoi PDF di grandi dimensioni per elaborare solo ciò che ti serve, ottimizzare l'uso di memoria ed evitare il superamento dei limiti di token dell'IA.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
