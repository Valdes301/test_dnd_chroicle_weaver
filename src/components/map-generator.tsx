'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
    Map as MapIcon, 
    Wand2, 
    Download, 
    Image as ImageIcon, 
    Eye, 
    EyeOff, 
    Palette, 
    Layers, 
    Upload, 
    Trash2, 
    ZoomIn, 
    ZoomOut, 
    Maximize,
    ChevronDown,
    MapPin,
    Loader2,
    Sparkles,
    FileImage
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as actions from '@/lib/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { cn, safeJsonParse } from '@/lib/utils';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function MapGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'Dungeon' | 'Città' | 'Regionale'>('Dungeon');
  const [complexity, setComplexity] = useState<'Semplice' | 'Dettagliata'>('Semplice');
  const [visualStyle, setVisualStyle] = useState<'standard' | 'parchment' | 'blueprint' | 'night'>('standard');
  const [showMasterLayer, setShowMasterLayer] = useState(true);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [worldLocations, setWorldLocations] = useState<any[]>([]);
  
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
      // Carichiamo i luoghi esistenti per l'integrazione
      const loadLocations = async () => {
          const res = await actions.getAllWorldLocationsAction();
          if (res.success && res.data) setWorldLocations(res.data);
      };
      loadLocations();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageDataUri(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerateMap = async () => {
    if (!prompt.trim() && !imageDataUri) {
        toast({ variant: "destructive", title: "Dati mancanti", description: "Inserisci una descrizione o carica uno schizzo." });
        return;
    }
    setIsGenerating(true);
    setGeneratedSvg(null);
    try {
      const result = await actions.generateMapAction({
          prompt,
          photoDataUri: imageDataUri || undefined,
          mapType,
          complexity
      });
      if (result.success && result.data?.svgString) {
        setGeneratedSvg(result.data.svgString);
        setZoom(1);
        toast({ title: "Mappa Generata!", description: "La tua pianta vettoriale è pronta." });
      } else throw new Error(result.error || 'Impossibile generare la mappa.');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore IA", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSvg = () => {
    if (!generatedSvg) return;
    
    let finalSvg = generatedSvg;
    if (!showMasterLayer) {
        finalSvg = generatedSvg.replace(/data-master-only="true"/g, 'display="none"');
    }
    
    const blob = new Blob([finalSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mappa-${mapType.toLowerCase()}-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    if (document.body.contains(link)) document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = async () => {
    if (!svgContainerRef.current || !generatedSvg) return;
    setIsGenerating(true);
    toast({ title: "Generazione immagine PNG..." });

    try {
        const canvas = await html2canvas(svgContainerRef.current, {
            scale: 2,
            backgroundColor: visualStyle === 'parchment' ? '#f4e4bc' : 
                             visualStyle === 'blueprint' ? '#003366' : 
                             visualStyle === 'night' ? '#0a0a0a' : '#ffffff',
            logging: false,
            useCORS: true
        });

        const link = document.createElement('a');
        link.download = `mappa-${mapType.toLowerCase()}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast({ title: "PNG scaricato!" });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile generare il PNG.' });
    } finally {
        setIsGenerating(false);
    }
  };

  const applyLocation = (loc: any) => {
      const details = safeJsonParse(loc.details, { sight: '', pointsOfInterest: [] });
      const newPrompt = `Mappa di ${loc.name}. Descrizione visiva: ${details.sight}. Punti di interesse da includere: ${Array.isArray(details.pointsOfInterest) ? details.pointsOfInterest.join(', ') : ''}.`;
      setPrompt(newPrompt);
      toast({ title: "Luogo Caricato", description: "La descrizione è stata importata nell'editor." });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
      {/* PANNELLO CONTROLLI (4/12) */}
      <div className="xl:col-span-4 space-y-6">
        <Card className="border-primary/20 shadow-lg">
          <CardContent className="space-y-6 pt-6">
            <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="text">Testo</TabsTrigger>
                    <TabsTrigger value="sketch">Schizzo</TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Descrizione Luogo</Label>
                            {worldLocations.length > 0 && (
                                <Select onValueChange={(val) => applyLocation(worldLocations.find(l => l.id === val))}>
                                    <SelectTrigger className="h-7 w-auto border-none bg-accent/10 text-[10px] uppercase font-bold px-2">
                                        <MapPin className="h-3 w-3 mr-1" /> Da Mondo
                                    </SelectTrigger>
                                    <SelectContent>
                                        {worldLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <Textarea
                            placeholder="es. Un tempio in rovina con una navata centrale..."
                            className="min-h-[150px] text-sm resize-none bg-muted/20"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isGenerating}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="sketch" className="space-y-4">
                    <div className="relative aspect-video bg-muted rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/40 group">
                        {imageDataUri ? (
                            <>
                                <Image src={imageDataUri} alt="Schizzo" fill className="object-contain" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Button variant="destructive" size="icon" onClick={() => setImageDataUri(null)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-4">
                                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground font-bold uppercase">Carica schizzo</p>
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Traduci uno schizzo a mano in un SVG pulito.</p>
                </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Tipo Mappa</Label>
                    <Select value={mapType} onValueChange={(v: any) => setMapType(v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Dungeon">Dungeon</SelectItem>
                            <SelectItem value="Città">Città</SelectItem>
                            <SelectItem value="Regionale">Regionale</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Complessità</Label>
                    <Select value={complexity} onValueChange={(v: any) => setComplexity(v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Semplice">Semplice</SelectItem>
                            <SelectItem value="Dettagliata">Dettagliata</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button onClick={handleGenerateMap} disabled={isGenerating} className="w-full h-12 shadow-xl shadow-primary/10">
              {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
              {isGenerating ? "Disegnando..." : "Genera Mappa"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ANTEPRIMA MAPPA (8/12) */}
      <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg border">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}><ZoomOut className="h-4 w-4"/></Button>
                      <span className="text-[10px] font-bold w-10 text-center">{Math.round(zoom * 100)}%</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(3, z + 0.2))}><ZoomIn className="h-4 w-4"/></Button>
                      <Separator orientation="vertical" className="h-4 mx-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(1)} title="Resetta Zoom"><Maximize className="h-4 w-4"/></Button>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border">
                      <Label htmlFor="master-layer" className="text-[10px] uppercase font-bold cursor-pointer">Segreti</Label>
                      <Switch id="master-layer" checked={showMasterLayer} onCheckedChange={setShowMasterLayer} className="scale-75" />
                  </div>
              </div>

              <div className="flex items-center gap-2">
                  <Select value={visualStyle} onValueChange={(v: any) => setVisualStyle(v)}>
                      <SelectTrigger className="w-32 h-9 text-[10px] uppercase font-bold bg-muted border-none">
                          <Palette className="h-3.5 w-3.5 mr-2" /> <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="standard">B/N</SelectItem>
                          <SelectItem value="parchment">Pergamena</SelectItem>
                          <SelectItem value="blueprint">Blueprint</SelectItem>
                          <SelectItem value="night">Notte</SelectItem>
                      </SelectContent>
                  </Select>

                  <div className="flex gap-1">
                      <Button onClick={handleDownloadPng} disabled={!generatedSvg} variant="outline" size="sm" className="h-9 gap-2 text-[10px] uppercase font-bold">
                          PNG
                      </Button>
                      <Button onClick={handleDownloadSvg} disabled={!generatedSvg} variant="outline" size="sm" className="h-9 gap-2 text-[10px] uppercase font-bold">
                          SVG
                      </Button>
                  </div>
              </div>
          </div>

          <Card className="overflow-hidden border-2 h-[600px] flex flex-col relative bg-zinc-900 shadow-2xl">
              <div 
                className={cn(
                    "flex-1 overflow-auto p-8 flex items-start justify-center transition-all duration-300",
                    visualStyle === 'parchment' && "bg-[#f4e4bc]",
                    visualStyle === 'blueprint' && "bg-[#003366]",
                    visualStyle === 'standard' && "bg-white",
                    visualStyle === 'night' && "bg-zinc-950"
                )}
              >
                  {!generatedSvg && !isGenerating ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-20">
                          <MapIcon className="h-24 w-24 mb-4" />
                          <p className="font-headline text-2xl uppercase tracking-widest">In attesa...</p>
                      </div>
                  ) : isGenerating ? (
                      <div className="h-full flex flex-col items-center justify-center text-primary gap-4">
                          <Sparkles className="h-16 w-16 animate-pulse" />
                          <p className="font-headline text-lg uppercase tracking-widest animate-pulse text-center">IA al lavoro...</p>
                      </div>
                  ) : (
                      <div 
                        ref={svgContainerRef}
                        className={cn(
                            "shadow-2xl transition-transform duration-200 origin-top min-w-[1000px] min-height-[700px]",
                            visualStyle === 'parchment' && "[&_svg]:filter-parchment",
                            visualStyle === 'blueprint' && "[&_svg]:filter-blueprint",
                            visualStyle === 'night' && "[&_svg]:filter-night",
                            !showMasterLayer && "[&_[data-master-only='true']]:hidden"
                        )}
                        style={{ transform: `scale(${zoom})` }}
                        dangerouslySetInnerHTML={{ __html: generatedSvg! }}
                      />
                  )}
              </div>
          </Card>
      </div>
    </div>
  );
}
