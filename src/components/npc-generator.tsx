'use client';

import { useState, useEffect } from 'react';
import type { Npc, NpcDetails, CampaignWithRelations, GenerateNpcInput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Wand2, Save, Trash2, Eye, Ear, Star, ShieldAlert, User, Footprints, History, BookOpen, Loader2, Shield, Lock } from 'lucide-react';
import { isPlayerMode } from '@/lib/pin-storage';
import { useToast } from '@/hooks/use-toast';
import * as actions from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

type NpcGeneratorProps = {
  campaign: CampaignWithRelations;
  savedNpcs: Npc[];
};

export function NpcGenerator({ campaign, savedNpcs }: NpcGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [gender, setGender] = useState<GenerateNpcInput['gender']>('Maschio');
  const [age, setAge] = useState<GenerateNpcInput['age']>('Adulto');
  const [status, setStatus] = useState<GenerateNpcInput['status']>('Normale');
  const [alignment, setAlignment] = useState<GenerateNpcInput['alignment']>('Neutrale');
  const [race, setRace] = useState<string>('');

  const [tempNpc, setTempNpc] = useState<NpcDetails | null>(null);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  const [playerMode, setPlayerModeState] = useState<boolean>(false);

  useEffect(() => {
    setPlayerModeState(isPlayerMode());
    const handlePlayerModeChange = (e: any) => {
      setPlayerModeState(Boolean(e.detail?.isPlayerMode));
    };
    window.addEventListener('dnd-player-mode-changed', handlePlayerModeChange);
    return () => window.removeEventListener('dnd-player-mode-changed', handlePlayerModeChange);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await actions.generateNpcAction({
        gender,
        age,
        status,
        alignment,
        race: race || undefined,
        campaignSummary: campaign.summary || undefined,
      });

      if (!result.success || !result.data) throw new Error(result.error || "Errore IA");

      setTempNpc(result.data);
      toast({ title: "PNG Generato!", description: `L'IA ha presentato "${result.data.name}".` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!tempNpc) return;

    const result = await actions.saveNpc({
      campaignId: campaign.id,
      name: tempNpc.name,
      race: tempNpc.race,
      gender,
      age,
      status,
      alignment,
      details: JSON.stringify(tempNpc)
    });

    if (result.success) {
      toast({ title: "PNG Salvato nell'Anagrafe!" });
      setTempNpc(null);
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Errore", description: result.error || "Impossibile salvare." });
    }
  };

  const handleDelete = async (id: string) => {
    const result = await actions.deleteNpc(id);
    if (result.success) {
      toast({ title: "PNG rimosso dall'Anagrafe" });
      router.refresh();
    }
  };

  const loadHistory = async (npc: Npc) => {
    setIsLoadingHistory(true);
    setViewingHistory(npc.id);
    try {
        const res = await actions.getCharacterHistory(npc.id);
        if (res.success && res.data) {
            setHistoryData(res.data);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-8">
      {playerMode ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-serif font-bold text-emerald-300 text-sm">Generatore PNG IA (Modalità Giocatore)</p>
                <p className="text-xs text-stone-400">La creazione e la sintonizzazione dei PNG con segreti e moventi è riservata al Dungeon Master.</p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] uppercase shrink-0">
              🔒 Riservato DM
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Genere</Label>
                <Select value={gender} onValueChange={(v: any) => setGender(v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Maschio">Maschio</SelectItem>
                    <SelectItem value="Femmina">Femmina</SelectItem>
                    <SelectItem value="Non binario">Non binario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Età</Label>
                <Select value={age} onValueChange={(v: any) => setAge(v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bambino">Bambino</SelectItem>
                    <SelectItem value="Ragazzo">Ragazzo</SelectItem>
                    <SelectItem value="Adulto">Adulto</SelectItem>
                    <SelectItem value="Vecchio">Vecchio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stato Sociale</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Miserabile">Miserabile</SelectItem>
                  <SelectItem value="Povero">Povero</SelectItem>
                  <SelectItem value="Normale">Normale</SelectItem>
                  <SelectItem value="Ricco">Ricco</SelectItem>
                  <SelectItem value="Sfarzoso">Sfarzoso</SelectItem>
                  <SelectItem value="Nobile">Nobile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allineamento</Label>
              <Select value={alignment} onValueChange={(v: any) => setAlignment(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Buono">Buono</SelectItem>
                  <SelectItem value="Neutrale">Neutrale</SelectItem>
                  <SelectItem value="Malvagio">Malvagio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Razza (Opzionale)</Label>
              <Input 
                placeholder="es. Umano, Nano..." 
                value={race} 
                onChange={(e) => setRace(e.target.value)} 
                className="h-9"
              />
            </div>
            <div className="pt-2">
               <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-11 shadow-lg">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Genera PNG
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* ANTEPRIMA PNG GENERATO */}
      {tempNpc && (
        <Card className="border-accent/40 animate-in fade-in slide-in-from-bottom-4 shadow-xl overflow-hidden">
          <CardHeader className="bg-accent/10 border-b border-accent/20">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl font-headline text-accent uppercase tracking-wider">{tempNpc.name}</CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">{tempNpc.race}</Badge>
                    <Badge variant="secondary">{tempNpc.occupation}</Badge>
                </div>
              </div>
              <Button onClick={handleSave} variant="secondary">
                <Save className="mr-2 h-4 w-4" /> Salva
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30 border">
                        <div className="text-primary font-bold text-[10px] uppercase mb-2">Aspetto</div>
                        <p className="text-sm italic">"{tempNpc.appearance}"</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 border">
                        <div className="text-primary font-bold text-[10px] uppercase mb-2">Psicologia</div>
                        <p className="text-sm italic">"{tempNpc.personality}"</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-accent/5 border">
                        <div className="text-accent font-bold text-[10px] uppercase mb-2">Tic / Peculiarità</div>
                        <p className="text-sm italic">"{tempNpc.mannerism}"</p>
                    </div>
                    <div className="p-4 rounded-lg bg-rose-500/5 border">
                        <div className="text-rose-500 font-bold text-[10px] uppercase mb-2">Segreto</div>
                        <p className="text-sm">{tempNpc.secret}</p>
                    </div>
                </div>
            </div>
            <Separator />
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-bold uppercase text-[10px] tracking-widest text-primary mb-2">Gancio Incontro</h4>
                <p className="text-sm font-medium">{tempNpc.encounterHook}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ANAGRAFE DELLA CAMPAGNA */}
      {savedNpcs.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-headline text-3xl flex items-center gap-2 border-b pb-2">
            <User className="h-6 w-6 text-primary" /> Anagrafe dei PNG
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedNpcs.map((n) => {
              const details = JSON.parse(n.details) as NpcDetails;
              const isViewingHistory = viewingHistory === n.id;

              return (
                <Card key={n.id} className={cn("group hover:border-primary/50 transition-all flex flex-col", isViewingHistory && "col-span-full")}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="font-headline text-xl text-primary leading-tight line-clamp-1">{n.name}</CardTitle>
                      <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => isViewingHistory ? setViewingHistory(null) : loadHistory(n)} className="h-8 w-8">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)} className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    {isViewingHistory ? (
                        <ScrollArea className="h-[200px] pr-4">
                            {isLoadingHistory ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>
                            ) : (
                                <div className="space-y-3">
                                    {historyData.map((ev, i) => (
                                        <div key={i} className="text-sm border-l-2 border-primary/20 pl-3 py-1">
                                            <div className="text-[9px] font-bold text-muted-foreground mb-1 uppercase">Sess. {ev.sessionNumber}</div>
                                            <p className="italic text-foreground/80 leading-relaxed">"{ev.eventDescription}"</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    ) : (
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">"{details.appearance}"</p>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0 justify-end">
                      <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setTempNpc(details)}>
                          Vedi Scheda
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
