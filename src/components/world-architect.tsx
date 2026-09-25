'use client';

import { useState, useRef, useMemo } from 'react';
import type { LocationDetails, WorldLocation, CampaignWithRelations } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Wand2, Save, Trash2, Eye, Ear, Wind, Sparkles, Ghost, Info, Download, FileImage, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as actions from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import html2canvas from 'html2canvas';
import { isPlayerMode } from '@/lib/pin-storage';

type WorldArchitectProps = {
  campaign: CampaignWithRelations;
  savedLocations: WorldLocation[];
};

export function WorldArchitect({ campaign, savedLocations }: WorldArchitectProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scale, setScale] = useState<string>('Medio (Quartiere, Piazza, Taverna)');
  const [style, setStyle] = useState<string>('Decadente');
  const [atmosphere, setAtmosphere] = useState<string>('Sinistro');
  const [population, setPopulation] = useState<string>('Deserto');

  const [tempLocation, setTempLocation] = useState<LocationDetails | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const router = useRouter();

  const playerMode = isPlayerMode();

  const visibleLocations = useMemo(() => {
    if (!playerMode) return savedLocations;
    if (typeof window === 'undefined') return savedLocations;
    const blockedLocationsRaw = localStorage.getItem('dnd_device_blocked_locations');
    if (!blockedLocationsRaw) return savedLocations;
    try {
      const blockedLocations = JSON.parse(blockedLocationsRaw);
      if (Array.isArray(blockedLocations)) {
        return savedLocations.filter(loc => !blockedLocations.includes(loc.id));
      }
    } catch {}
    return savedLocations;
  }, [savedLocations, playerMode]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await actions.generateLocationAction({
        scale: scale as any,
        style: style as any,
        atmosphere: atmosphere as any,
        population: population as any,
        campaignSummary: campaign.summary || undefined,
      });

      if (!result.success || !result.data) throw new Error(result.error || "Errore IA");

      setTempLocation(result.data);
      toast({ title: "Luogo Creato!", description: `L'IA ha immaginato "${result.data.title}".` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!tempLocation) return;

    const result = await actions.saveWorldLocation({
      campaignId: campaign.id,
      name: tempLocation.title,
      scale,
      style,
      atmosphere,
      details: JSON.stringify(tempLocation)
    });

    if (result.success) {
      toast({ title: "Luogo Salvato nell'Atlante!" });
      setTempLocation(null);
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Errore", description: result.error || "Impossibile salvare." });
    }
  };

  const handleDelete = async (id: string) => {
    const result = await actions.deleteWorldLocation(id);
    if (result.success) {
      toast({ title: "Luogo rimosso dall'Atlante" });
      router.refresh();
    }
  };

  const handleDownloadPng = async () => {
    if (!mapContainerRef.current || !tempLocation?.mapSvg) return;
    setIsExporting(true);
    try {
        const canvas = await html2canvas(mapContainerRef.current, {
            scale: 2,
            backgroundColor: '#f4e4bc',
            logging: false,
            useCORS: true
        });
        const link = document.createElement('a');
        link.download = `planimetria-${tempLocation.title.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast({ title: "Immagine scaricata!" });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile esportare la mappa.' });
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* CONFIGURAZIONE GENERATORE */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="grid gap-6 md:grid-cols-2 pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scala</Label>
              <Select value={scale} onValueChange={setScale}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Micro (Stanza, Vicolo)">Micro</SelectItem>
                  <SelectItem value="Medio (Quartiere, Piazza, Taverna)">Medio</SelectItem>
                  <SelectItem value="Macro (Villaggio, Dungeon, Foresta)">Macro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stile</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ricco">Ricco</SelectItem>
                  <SelectItem value="Povero">Povero</SelectItem>
                  <SelectItem value="Decadente">Decadente</SelectItem>
                  <SelectItem value="Diroccato">Rovina</SelectItem>
                  <SelectItem value="Incontaminato">Nuovo</SelectItem>
                  <SelectItem value="In costruzione">Cantiere</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Atmosfera</Label>
              <Select value={atmosphere} onValueChange={setAtmosphere}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sinistro">Sinistro</SelectItem>
                  <SelectItem value="Accogliente">Accogliente</SelectItem>
                  <SelectItem value="Caotico">Caotico</SelectItem>
                  <SelectItem value="Silenzioso">Silenzioso</SelectItem>
                  <SelectItem value="Magico">Magico</SelectItem>
                  <SelectItem value="Misterioso">Misterioso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Popolazione</Label>
              <Select value={population} onValueChange={setPopulation}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Affollato">Affollato</SelectItem>
                  <SelectItem value="Deserto">Deserto</SelectItem>
                  <SelectItem value="Abitato da mostri">Mostri</SelectItem>
                  <SelectItem value="Solo PNG ostili">Ostili</SelectItem>
                  <SelectItem value="Tranquillo">Tranquillo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-11 text-lg shadow-lg">
            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
            Genera Luogo e Mappa
          </Button>
        </CardFooter>
      </Card>

      {/* ANTEPRIMA LUOGO GENERATO */}
      {tempLocation && (
        <Card className="border-accent/40 animate-in fade-in slide-in-from-bottom-4 shadow-xl">
          <CardHeader className="bg-accent/10">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl font-headline text-accent uppercase tracking-wider">{tempLocation.title}</CardTitle>
                <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{scale}</Badge>
                    <Badge variant="secondary">{style}</Badge>
                </div>
              </div>
              <Button onClick={handleSave} variant="secondary">
                <Save className="mr-2 h-4 w-4" /> Salva
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {tempLocation.mapSvg && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold uppercase text-[10px] tracking-widest text-primary flex items-center gap-2">
                            <MapPin className="h-3 w-3" /> Planimetria
                        </h4>
                        <Button variant="ghost" size="sm" className="h-7 text-[9px] uppercase font-bold" onClick={handleDownloadPng} disabled={isExporting}>
                            {isExporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileImage className="h-3 w-3 mr-1" />}
                            PNG
                        </Button>
                    </div>
                    <div className="bg-[#f4e4bc] border-2 border-amber-900/20 rounded-xl p-4 shadow-inner flex items-center justify-center overflow-hidden min-h-[300px]">
                        <div 
                            ref={mapContainerRef}
                            className="w-full max-w-[400px] aspect-[4/3] [&_svg]:w-full [&_svg]:h-full [&_svg]:filter-sepia"
                            dangerouslySetInnerHTML={{ __html: tempLocation.mapSvg }}
                        />
                    </div>
                    <style jsx global>{`
                        .filter-sepia svg { filter: sepia(0.5) contrast(1.1) brightness(0.9); background: transparent !important; }
                        .filter-sepia svg rect[fill="white"] { fill: #f4e4bc !important; }
                    `}</style>
                </div>
            )}

            <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-[10px] uppercase">Vista</div>
                    <p className="text-sm text-muted-foreground italic">"{tempLocation.sight}"</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-[10px] uppercase">Udito</div>
                    <p className="text-sm text-muted-foreground italic">"{tempLocation.sound}"</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-[10px] uppercase">Olfatto</div>
                    <p className="text-sm text-muted-foreground italic">"{tempLocation.smell}"</p>
                </div>
            </div>

            <div>
                <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground mb-3 flex items-center gap-2">Punti di Interesse</h4>
                <ul className="grid sm:grid-cols-2 gap-2">
                    {tempLocation.pointsOfInterest.map((poi, i) => (
                        <li key={i} className="text-sm p-2 rounded bg-background border flex items-start gap-2">
                            <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                            <span>{poi}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <h4 className="font-bold uppercase text-[10px] tracking-widest text-destructive mb-2 flex items-center gap-2">Segreto Master</h4>
                <p className="text-sm text-foreground/90">{tempLocation.secret}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ATLANTE DELLA CAMPAGNA */}
      {visibleLocations.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-headline text-2xl flex items-center gap-2 border-b pb-2">
            <MapPin className="h-5 w-5" /> Luoghi nel Mondo
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleLocations.map((loc) => {
              const details = JSON.parse(loc.details) as LocationDetails;
              return (
                <Card key={loc.id} className="group hover:border-primary/50 transition-colors flex flex-col h-full">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="font-headline text-xl text-primary leading-tight line-clamp-1">{loc.name}</CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(loc.id)} className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    {details.mapSvg && (
                        <div className="aspect-[4/3] bg-[#f4e4bc] rounded-md mb-4 p-2 shadow-inner border border-amber-900/10 overflow-hidden flex items-center justify-center grayscale-[0.5] opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                             <div className="w-full h-full [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: details.mapSvg }} />
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-3 italic">"{details.sight}"</p>
                  </CardContent>
                  <CardFooter className="pt-0 justify-end">
                      <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setTempLocation(details)}>
                          Vedi Dettagli
                      </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
