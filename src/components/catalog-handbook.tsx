'use client';

import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import * as actions from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Library, Wand2, Check, X, Shield, Sparkles, Skull, Wand, BrainCircuit, Loader2, ChevronDown, ChevronUp, Info, ImageUp, Trash2, Coins, Gem, Sword } from 'lucide-react';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { useRouter } from 'next/navigation';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { MarkdownRenderer } from './ui/markdown-renderer';

type CatalogHandbookProps = {
  campaignId: string;
};

export function CatalogHandbook({ campaignId }: CatalogHandbookProps) {
  const [content, setContent] = useState('');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [expandedIndices, setExpandedIndices] = useState<Record<string, number[]>>({
    items: [], monsters: [], spells: [], skills: []
  });
  const [selectedIndices, setSelectedIndices] = useState<Record<string, number[]>>({
    items: [], monsters: [], spells: [], skills: []
  });

  const { toast } = useToast();
  const router = useRouter();

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const rawUri = event.target?.result as string;
        if (rawUri) {
          try {
            const compressed = await compressImage(rawUri, 1000, 1000, 0.65);
            setImageDataUri(compressed);
          } catch (err) {
            setImageDataUri(rawUri);
          }
        }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!content.trim() && !imageDataUri) {
        toast({ variant: "destructive", title: "Dati mancanti", description: "Incolla del testo o carica un'immagine." });
        return;
    }
    setIsAnalyzing(true);
    try {
      let res: any = null;
      try {
        const resp = await fetch('/api/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, photoDataUri: imageDataUri || undefined })
        });
        if (resp.ok) {
          res = await resp.json();
        }
      } catch (err) {
        console.warn("API /api/catalog fetch failed, trying Server Action...", err);
      }

      if (!res || !res.success) {
        res = await actions.catalogHandbookAction(content, imageDataUri || undefined);
      }

      if (res && res.success && res.data) {
        setResults(res.data);
        setSelectedIndices({
          items: res.data.items.map((_: any, i: number) => i),
          monsters: res.data.monsters.map((_: any, i: number) => i),
          spells: res.data.spells.map((_: any, i: number) => i),
          skills: res.data.skills.map((_: any, i: number) => i),
        });
      } else {
        throw new Error(res?.error || "Errore durante la catalogazione con l'IA.");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Errore Analisi", description: e?.message || "Impossibile completare l'analisi. Riprova tra poco." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleExpand = (type: string, index: number) => {
    setExpandedIndices(prev => {
        const current = prev[type];
        return {
            ...prev,
            [type]: current.includes(index) ? current.filter(i => i !== index) : [...current, index]
        };
    });
  };

  const handleConfirm = async () => {
    if (!results) return;
    setIsImporting(true);
    try {
        const data = {
            items: results.items.filter((_: any, i: number) => selectedIndices.items.includes(i)),
            monsters: results.monsters.filter((_: any, i: number) => selectedIndices.monsters.includes(i)),
            spells: results.spells.filter((_: any, i: number) => selectedIndices.spells.includes(i)),
            skills: results.skills.filter((_: any, i: number) => selectedIndices.skills.includes(i)),
        };
        const res = await actions.bulkImportAction(campaignId, data);
        if (res.success) {
            toast({ title: "Archivio Aggiornato!" });
            setResults(null);
            setContent('');
            setImageDataUri(null);
            router.refresh();
        } else throw new Error(res.error || 'Errore importazione archivio');
    } catch (e: any) {
        toast({ variant: "destructive", title: "Errore", description: e.message });
    } finally {
        setIsImporting(false);
    }
  };

  if (results) {
    return (
        <Card className="border-primary/40 animate-in fade-in zoom-in-95 w-full max-w-full overflow-hidden">
            <CardContent className="p-4 sm:pt-6">
                <div className="max-h-[60vh] overflow-y-auto pr-2 sm:pr-4 scrollbar-thin">
                    <div className="space-y-6">
                        {results.items.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2"><Sparkles className="h-3 w-3"/> Equipaggiamento</h4>
                                {results.items.map((it: any, i: number) => (
                                    <div key={i} className={cn("flex flex-col p-3 rounded-lg border text-sm transition-all", selectedIndices.items.includes(i) ? "bg-background border-primary/20" : "opacity-40 grayscale")}>
                                        <div className="flex gap-3 items-start">
                                            <Checkbox checked={selectedIndices.items.includes(i)} onCheckedChange={() => setSelectedIndices(p => ({...p, items: p.items.includes(i) ? p.items.filter(x => x !== i) : [...p.items, i]}))} className="mt-1"/>
                                            <div className="flex-1 cursor-pointer min-w-0" onClick={() => toggleExpand('items', i)}>
                                                <div className="font-bold leading-tight break-words mb-1">{it.name}</div> 
                                                <div className="flex flex-wrap gap-1">
                                                    <Badge variant="outline" className="text-[9px] h-4 py-0 leading-none lowercase italic">{it.type}</Badge>
                                                    {it.rarity && <Badge variant="secondary" className="text-[9px] h-4 py-0 leading-none">{it.rarity}</Badge>}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1" onClick={(e) => { e.stopPropagation(); toggleExpand('items', i); }}>
                                                {expandedIndices.items.includes(i) ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                        {expandedIndices.items.includes(i) && (
                                            <div className="mt-3 pl-7 pb-2 space-y-3 text-xs border-l-2 border-primary/20 animate-in slide-in-from-top-1">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-muted/30 p-2 rounded">
                                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                                        <Gem className="h-3 w-3" />
                                                        <span className="font-bold uppercase text-[9px]">Rarità:</span>
                                                        <span className="text-foreground">{it.rarity || 'Comune'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                                        <Coins className="h-3 w-3" />
                                                        <span className="font-bold uppercase text-[9px]">Valore:</span>
                                                        <span className="text-foreground font-mono">{it.cost || 'N/D'}</span>
                                                    </div>
                                                    {it.damage && (
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <Sword className="h-3 w-3" />
                                                            <span className="font-bold uppercase text-[9px]">Danno:</span>
                                                            <span className="text-foreground font-bold">{it.damage}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <MarkdownRenderer content={it.description} className="text-muted-foreground leading-relaxed text-xs" />
                                                <div className="flex justify-end pt-1">
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => toggleExpand('items', i)}>
                                                        <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {results.monsters.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-rose-500 flex items-center gap-2"><Skull className="h-3 w-3"/> Bestiario</h4>
                                {results.monsters.map((m: any, i: number) => (
                                    <div key={i} className={cn("flex flex-col p-3 rounded-lg border text-sm transition-all", selectedIndices.monsters.includes(i) ? "bg-background border-rose-500/20" : "opacity-40 grayscale")}>
                                        <div className="flex gap-3 items-start">
                                            <Checkbox checked={selectedIndices.monsters.includes(i)} onCheckedChange={() => setSelectedIndices(p => ({...p, monsters: p.monsters.includes(i) ? p.monsters.filter(x => x !== i) : [...p.monsters, i]}))} className="mt-1"/>
                                            <div className="flex-1 cursor-pointer min-w-0" onClick={() => toggleExpand('monsters', i)}>
                                                <div className="font-bold leading-tight break-words mb-1">{m.name}</div> 
                                                <Badge variant="secondary" className="text-[9px] h-4 py-0 leading-none">GS {m.challenge}</Badge>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1" onClick={(e) => { e.stopPropagation(); toggleExpand('monsters', i); }}>
                                                {expandedIndices.monsters.includes(i) ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                        {expandedIndices.monsters.includes(i) && (
                                            <div className="mt-3 pl-7 pb-2 space-y-2 text-xs border-l-2 border-rose-500/20 animate-in slide-in-from-top-1">
                                                <div className="grid grid-cols-2 gap-2 bg-rose-500/5 p-2 rounded">
                                                    <p><span className="text-muted-foreground uppercase text-[9px] font-bold">Tipo:</span> {m.type}</p>
                                                    <p><span className="text-muted-foreground uppercase text-[9px] font-bold">CA:</span> {m.armorClass}</p>
                                                    <p><span className="text-muted-foreground uppercase text-[9px] font-bold">PF:</span> {m.hitPoints}</p>
                                                    <p><span className="text-muted-foreground uppercase text-[9px] font-bold">GS:</span> {m.challenge}</p>
                                                </div>
                                                <MarkdownRenderer content={m.description} className="text-muted-foreground leading-relaxed text-xs" />
                                                <div className="flex justify-end pt-1">
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-rose-500" onClick={() => toggleExpand('monsters', i)}>
                                                        <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {results.spells.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-sky-500 flex items-center gap-2"><Wand className="h-3 w-3"/> Incantesimi</h4>
                                {results.spells.map((s: any, i: number) => (
                                    <div key={i} className={cn("flex flex-col p-3 rounded-lg border text-sm transition-all", selectedIndices.spells.includes(i) ? "bg-background border-sky-500/20" : "opacity-40 grayscale")}>
                                        <div className="flex gap-3 items-start">
                                            <Checkbox checked={selectedIndices.spells.includes(i)} onCheckedChange={() => setSelectedIndices(p => ({...p, spells: p.spells.includes(i) ? p.spells.filter(x => x !== i) : [...p.spells, i]}))} className="mt-1"/>
                                            <div className="flex-1 cursor-pointer min-w-0" onClick={() => toggleExpand('spells', i)}>
                                                <div className="font-bold leading-tight break-words mb-1">{s.name}</div> 
                                                <Badge variant="outline" className="text-[9px] h-4 py-0 leading-none">{s.level}</Badge>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1" onClick={(e) => { e.stopPropagation(); toggleExpand('spells', i); }}>
                                                {expandedIndices.spells.includes(i) ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                        {expandedIndices.spells.includes(i) && (
                                            <div className="mt-3 pl-7 pb-2 space-y-2 text-xs border-l-2 border-sky-500/20 animate-in slide-in-from-top-1">
                                                <div className="grid grid-cols-2 gap-2 bg-sky-500/5 p-2 rounded">
                                                    <p><span className="text-muted-foreground uppercase text-[9px] font-bold">Scuola:</span> {s.school}</p>
                                                    <p><span className="text-muted-foreground uppercase text-[9px] font-bold">Tempo:</span> {s.casting_time}</p>
                                                </div>
                                                <MarkdownRenderer content={s.description} className="text-muted-foreground leading-relaxed text-xs" />
                                                <div className="flex justify-end pt-1">
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-sky-500" onClick={() => toggleExpand('spells', i)}>
                                                        <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {results.skills && results.skills.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2"><BrainCircuit className="h-3 w-3"/> Abilità e Capacità</h4>
                                {results.skills.map((sk: any, i: number) => (
                                    <div key={i} className={cn("flex flex-col p-3 rounded-lg border text-sm transition-all", selectedIndices.skills?.includes(i) ? "bg-background border-emerald-500/20" : "opacity-40 grayscale")}>
                                        <div className="flex gap-3 items-start">
                                            <Checkbox checked={selectedIndices.skills?.includes(i)} onCheckedChange={() => setSelectedIndices(p => ({...p, skills: p.skills?.includes(i) ? p.skills.filter(x => x !== i) : [...(p.skills || []), i]}))} className="mt-1"/>
                                            <div className="flex-1 cursor-pointer min-w-0" onClick={() => toggleExpand('skills', i)}>
                                                <div className="font-bold leading-tight break-words mb-1">{sk.name}</div> 
                                                <Badge variant="outline" className="text-[9px] h-4 py-0 leading-none">{sk.ability || 'Varia'}</Badge>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1" onClick={(e) => { e.stopPropagation(); toggleExpand('skills', i); }}>
                                                {expandedIndices.skills?.includes(i) ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                        {expandedIndices.skills?.includes(i) && (
                                            <div className="mt-3 pl-7 pb-2 space-y-2 text-xs border-l-2 border-emerald-500/20 animate-in slide-in-from-top-1">
                                                <MarkdownRenderer content={sk.description} className="text-muted-foreground leading-relaxed text-xs" />
                                                <div className="flex justify-end pt-1">
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-emerald-500" onClick={() => toggleExpand('skills', i)}>
                                                        <X className="h-3 w-3 mr-1" /> Chiudi Dettagli
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t p-4 sm:p-6 bg-muted/10">
                <Button variant="ghost" onClick={() => setResults(null)} className="w-full sm:w-auto order-2 sm:order-1">Annulla</Button>
                <Button onClick={handleConfirm} disabled={isImporting} className="w-full sm:flex-1 shadow-lg shadow-primary/20 order-1 sm:order-2 h-11 sm:h-10">
                    {isImporting ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Check className="h-4 w-4 mr-2"/>}
                    Conferma Importazione
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="border-primary/20 shadow-lg w-full max-w-full overflow-hidden">
      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
                <div className="relative group aspect-video bg-muted rounded-xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/40 hover:bg-muted/50">
                    {imageDataUri ? (
                        <>
                            <Image src={imageDataUri} alt="Manuale" fill className="object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Button variant="destructive" size="icon" onClick={() => setImageDataUri(null)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-4">
                            <ImageUp className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mx-auto mb-2" />
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-tighter">Tocca per scattare o caricare</p>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                    )}
                </div>
                <div className="p-3 sm:p-4 bg-primary/5 rounded-lg border border-primary/10 flex gap-3 text-[10px] sm:text-xs text-muted-foreground">
                    <Info className="h-4 w-4 text-primary shrink-0"/>
                    <p>Puoi caricare una foto del manuale fisico o incollare il testo sottostante. L'IA identificherà automaticamente rarità e costi degli oggetti.</p>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Testo Aggiuntivo (opzionale)</Label>
                <Textarea 
                    placeholder="Incolla qui il testo della pagina se la foto è poco chiara..." 
                    className="min-h-[150px] sm:min-h-[180px] font-mono text-[11px] sm:text-xs bg-muted/20 resize-none"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
            </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 sm:p-6">
        <Button onClick={handleAnalyze} disabled={(!content.trim() && !imageDataUri) || isAnalyzing} className="w-full h-12 text-base sm:text-lg shadow-xl shadow-primary/10">
          {isAnalyzing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Lettura manuale...</> : <><Wand2 className="mr-2 h-5 w-5" />Avvia Scansione Intelligente</>}
        </Button>
      </CardFooter>
    </Card>
  );
}
