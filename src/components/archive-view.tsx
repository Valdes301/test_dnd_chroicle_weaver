'use client';

import { useState, useEffect, useMemo } from 'react';
import type { StoryArc, Session } from '@/lib/types';
import * as actions from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, LibraryBig, Loader2, ScrollText, History, Pencil, Save, X, Trash2, Search, Info, Wand2, Sparkles, RotateCcw, Check, Sparkle, Copy, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "./ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { MarkdownRenderer } from './ui/markdown-renderer';

export function ArchiveView({ campaignId }: { campaignId: string }) {
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);
  const [editingArcId, setEditingArcId] = useState<string | null>(null);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, boolean>>({});
  const [expandedImpacts, setExpandedImpacts] = useState<Record<string, boolean>>({});
  const [tempTitle, setTempTitle] = useState('');
  const [tempSummary, setTempSummary] = useState('');
  const [tempWorldImpact, setTempWorldImpact] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<Record<string, string[]>>({});
  
  const { toast } = useToast();
  const router = useRouter();

  const loadArcs = async () => {
    setIsLoading(true);
    try {
        const res = await actions.getStoryArcs(campaignId);
        if (res.success && res.data) {
            setArcs(res.data);
        }
    } catch (e) {
        console.error("Library load error:", e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArcs();
  }, [campaignId]);

  const filteredArcs = useMemo(() => {
      const lower = searchTerm.toLowerCase();
      return arcs.filter(a => 
        a.title.toLowerCase().includes(lower) || 
        (a.summary?.toLowerCase() ?? '').includes(lower)
      );
  }, [arcs, searchTerm]);

  const handleStartEdit = (arc: StoryArc) => {
      setEditingArcId(arc.id);
      setTempTitle(arc.title);
      setTempSummary(arc.summary || '');
      setTempWorldImpact(arc.world_impact || '');
  };

  const handleSaveEdit = async () => {
      if (!editingArcId) return;
      const res = await actions.updateStoryArc(editingArcId, tempTitle, tempSummary, tempWorldImpact);
      if (res.success) {
          toast({ title: "Volume aggiornato." });
          setEditingArcId(null);
          loadArcs();
          router.refresh();
      }
  };

  const handleDeleteArc = async (arcId: string) => {
    const res = await actions.deleteStoryArc(arcId);
    if (res.success) {
        toast({ title: "Volume rimosso e storie ripristinate." });
        loadArcs();
        router.refresh();
    } else {
        toast({ variant: 'destructive', title: "Errore", description: res.error });
    }
  };

  const handleGenerateSummary = async (arcId: string) => {
      const sessionIds = selectedSessions[arcId];
      if (!sessionIds || sessionIds.length === 0) {
          toast({ variant: 'destructive', title: "Seleziona le storie", description: "Scegli quali sessioni includere nel riassunto cliccando sui relativi box." });
          return;
      }

      setIsGeneratingId(arcId);
      try {
          const res = await actions.generateArcSummaryAction(arcId, sessionIds);
          if (res.success) {
              toast({ title: "Cronaca Aggiornata!", description: `${sessionIds.length} storie sono state integrate nel volume.` });
              setSelectedSessions(prev => ({ ...prev, [arcId]: [] })); // Pulizia selezione
              loadArcs();
              router.refresh();
          } else throw new Error(res.error || 'Errore nella generazione');
      } catch (e: any) {
          toast({ variant: 'destructive', title: "Errore", description: e.message });
      } finally {
          setIsGeneratingId(null);
      }
  };

  const toggleSessionSelection = (arcId: string, sessionId: string) => {
      setSelectedSessions(prev => {
          const current = prev[arcId] || [];
          const next = current.includes(sessionId) 
            ? current.filter(id => id !== sessionId)
            : [...current, sessionId];
          return { ...prev, [arcId]: next };
      });
  };

  const selectAllSessionsForArc = (arcId: string, allIds: string[]) => {
      setSelectedSessions(prev => ({ ...prev, [arcId]: allIds }));
  };

  const handleCopy = (text: string, title: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: `${title} Copiata!`, description: "Il testo è pronto per essere incollato." });
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-headline text-lg uppercase tracking-widest">Apertura della Grande Biblioteca...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex justify-end mb-6">
        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Cerca nei volumi..." 
                className="pl-10 h-10 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {filteredArcs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl opacity-40 mx-1">
              <BookOpen className="h-12 w-12 sm:h-16 w-16 mx-auto mb-4" />
              <p className="font-headline text-lg sm:text-xl uppercase">Nessun volume ancora rilegato.</p>
          </div>
      ) : (
          <div className="grid gap-6 sm:gap-8 px-1">
              {filteredArcs.map((arc) => (
                  <Card key={arc.id} className={cn("overflow-hidden border-primary/20 bg-card/40 w-full max-w-full", arc.status === 'active' && "ring-1 sm:ring-2 ring-primary/40")}>
                      <CardHeader className="bg-primary/5 border-b border-primary/10 p-3 sm:p-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 w-full">
                              <div className="space-y-1 flex-1 min-w-0 w-full">
                                  <div className="flex items-center gap-2 flex-wrap w-full">
                                    {editingArcId === arc.id ? (
                                        <Input 
                                            value={tempTitle} 
                                            onChange={(e) => setTempTitle(e.target.value)}
                                            className="font-headline text-lg sm:text-2xl h-9 sm:h-10 bg-background w-full"
                                        />
                                    ) : (
                                        <CardTitle className="font-headline text-lg sm:text-2xl lg:text-3xl text-primary break-words leading-tight flex-1 min-w-0">{arc.title}</CardTitle>
                                    )}
                                    {arc.status === 'active' && <Badge variant="default" className="bg-emerald-600 text-[8px] sm:text-[10px] h-4 sm:h-5 shrink-0">Arco Attuale</Badge>}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                                      <History className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Modifica: {new Date(arc.updatedAt).toLocaleDateString('it-IT')}
                                  </div>
                              </div>
                              <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 shrink-0">
                                  {editingArcId === arc.id ? (
                                      <div className="flex gap-1 ml-auto">
                                          <Button size="icon" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8 text-emerald-500"><Save className="h-5 w-5"/></Button>
                                          <Button size="icon" variant="ghost" onClick={() => setEditingArcId(null)} className="h-8 w-8 text-destructive"><X className="h-5 w-5"/></Button>
                                      </div>
                                  ) : (
                                      <div className="flex items-center gap-1 ml-auto">
                                          <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-[8px] sm:text-[10px] uppercase font-bold whitespace-nowrap border-accent/40 text-accent hover:bg-accent/10" onClick={() => handleGenerateSummary(arc.id)} disabled={isGeneratingId === arc.id}>
                                              {isGeneratingId === arc.id ? <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin"/> : <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                                              {!!(selectedSessions[arc.id]?.length > 0) ? `Sintetizza ${selectedSessions[arc.id].length}` : "Sintetizza"}
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleStartEdit(arc)}><Pencil className="h-5 w-5"/></Button>
                                          
                                          <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-5 w-5"/></Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent className="w-[95vw] max-md">
                                                  <AlertDialogHeader>
                                                      <AlertDialogTitle>Eliminare questo volume?</AlertDialogTitle>
                                                      <AlertDialogDescription>
                                                          L'Arco Narrativo e la sua sintesi verranno rimossi definitivamente. Tutte le sessioni torneranno visibili nella Dashboard e potranno essere ri-sintetizzate.
                                                      </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                      <AlertDialogAction onClick={() => handleDeleteArc(arc.id)} className="bg-destructive text-destructive-foreground">Elimina e Ripristina</AlertDialogAction>
                                                  </AlertDialogFooter>
                                              </AlertDialogContent>
                                          </AlertDialog>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 w-full">
                          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 w-full">
                              <div className="flex-1 min-w-0 space-y-6 sm:space-y-8 w-full">
                                  <div className="space-y-3 sm:space-y-4 w-full">
                                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/10 pb-2 w-full">
                                          <div className="flex items-center gap-1.5 text-[9px] sm:text-xs font-bold uppercase text-accent tracking-widest min-w-0 flex-1">
                                              <ScrollText className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">Sintesi Narrativa</span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0 ml-auto">
                                              {!!(arc.summary && editingArcId !== arc.id) && (
                                                <>
                                                  <Button 
                                                      variant="ghost" 
                                                      size="sm" 
                                                      className="h-6 sm:h-7 px-1.5 sm:px-2 text-[8px] sm:text-[10px] uppercase font-bold gap-1 opacity-70 hover:opacity-100"
                                                      onClick={() => handleCopy(arc.summary || '', 'Sintesi')}
                                                  >
                                                      <Copy className="h-3 w-3" />
                                                      <span>Copia</span>
                                                  </Button>
                                                  <Button 
                                                      variant="ghost" 
                                                      size="sm" 
                                                      className="h-6 sm:h-7 px-1.5 sm:px-2 text-[8px] sm:text-[10px] uppercase font-bold gap-1 opacity-70 hover:opacity-100"
                                                      onClick={() => setExpandedSummaries(p => ({...p, [arc.id]: !p[arc.id]}))}
                                                  >
                                                      {expandedSummaries[arc.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                      <span>{expandedSummaries[arc.id] ? "Riduci" : "Leggi tutto"}</span>
                                                  </Button>
                                                </>
                                              )}
                                          </div>
                                      </div>
                                      {editingArcId === arc.id ? (
                                          <Textarea 
                                            value={tempSummary} 
                                            onChange={(e) => setTempSummary(e.target.value)}
                                            className="min-h-[250px] sm:min-h-[400px] leading-relaxed bg-background font-serif text-sm sm:text-lg p-3 sm:p-6"
                                          />
                                      ) : (
                                          <div className="relative group w-full overflow-hidden">
                                              <div className={cn(
                                                  "transition-all duration-500 ease-in-out overflow-hidden w-full",
                                                  !expandedSummaries[arc.id] ? "max-h-[200px] sm:max-h-[300px]" : "max-h-fit"
                                              )}>
                                                  <div className="border-l-2 sm:border-l-4 border-accent/20 pl-3 sm:pl-6">
                                                      <MarkdownRenderer 
                                                          content={arc.summary || 'Sintesi non ancora generata. Seleziona le storie a destra per iniziare.'} 
                                                          className="font-serif text-[13px] sm:text-lg leading-relaxed text-foreground/90"
                                                      />
                                                  </div>
                                              </div>
                                              {!!(!expandedSummaries[arc.id] && arc.summary && arc.summary.length > 300) && (
                                                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card/95 to-transparent pointer-events-none" />
                                              )}
                                          </div>
                                      )}
                                  </div>

                                  {(!!(arc.world_impact || editingArcId === arc.id)) && (
                                      <div className="space-y-3 sm:space-y-4 pt-2 border-t border-primary/10 w-full">
                                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-2 w-full">
                                            <div className="flex items-center gap-1.5 text-[9px] sm:text-xs font-bold uppercase text-primary tracking-widest min-w-0 flex-1">
                                                <Globe className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">Impatto sul Mondo</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-auto">
                                              {!!(arc.world_impact && editingArcId !== arc.id) && (
                                                <>
                                                  <Button 
                                                      variant="ghost" 
                                                      size="sm" 
                                                      className="h-6 sm:h-7 px-1.5 sm:px-2 text-[8px] sm:text-[10px] uppercase font-bold gap-1 opacity-70 hover:opacity-100"
                                                      onClick={() => handleCopy(arc.world_impact || '', 'Impatto')}
                                                  >
                                                      <Copy className="h-3 w-3" />
                                                      <span>Copia</span>
                                                  </Button>
                                                  <Button 
                                                      variant="ghost" 
                                                      size="sm" 
                                                      className="h-6 sm:h-7 px-1.5 sm:px-2 text-[8px] sm:text-[10px] uppercase font-bold gap-1 opacity-70 hover:opacity-100"
                                                      onClick={() => setExpandedImpacts(p => ({...p, [arc.id]: !p[arc.id]}))}
                                                  >
                                                      {expandedImpacts[arc.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                      <span>{expandedImpacts[arc.id] ? "Riduci" : "Leggi tutto"}</span>
                                                  </Button>
                                                </>
                                              )}
                                          </div>
                                          </div>
                                          {editingArcId === arc.id ? (
                                              <Textarea 
                                                value={tempWorldImpact} 
                                                onChange={(e) => setTempWorldImpact(e.target.value)}
                                                className="min-h-[100px] bg-background text-xs sm:text-sm p-3"
                                                placeholder="Come è cambiato il mondo?"
                                              />
                                          ) : (
                                              <div className={cn(
                                                  "p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 transition-all duration-500 overflow-hidden w-full",
                                                  !expandedImpacts[arc.id] ? "max-h-[100px] relative" : "max-h-fit"
                                              )}>
                                                  <MarkdownRenderer 
                                                      content={arc.world_impact} 
                                                      className="text-[12px] sm:text-sm leading-relaxed text-muted-foreground"
                                                  />
                                                  {!!(!expandedImpacts[arc.id] && arc.world_impact && arc.world_impact.length > 200) && (
                                                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
                                                  )}
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>

                              <div className="bg-muted/10 rounded-xl border p-2 sm:p-4 space-y-3 sm:space-y-4 h-fit lg:w-72 xl:w-80 shrink-0 w-full">
                                  <div className="flex items-center justify-between gap-2 text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b pb-2 w-full">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1"><Info className="h-3 w-3 shrink-0" /> <span className="truncate">Memoria Grezza</span></div>
                                      <span className="text-accent shrink-0">{selectedSessions[arc.id]?.length || 0} sel.</span>
                                  </div>
                                  <ArchiveSessionsList 
                                    arcId={arc.id} 
                                    campaignId={campaignId} 
                                    selectedIds={selectedSessions[arc.id] || []}
                                    onToggleSelection={(id) => toggleSessionSelection(arc.id, id)}
                                    onSelectAll={(ids) => selectAllSessionsForArc(arc.id, ids)}
                                  />
                              </div>
                          </div>
                      </CardContent>
                  </Card>
              ))}
          </div>
      )}
    </div>
  );
}

function ArchiveSessionsList({ 
    arcId, 
    campaignId, 
    selectedIds, 
    onToggleSelection,
    onSelectAll
}: { 
    arcId: string, 
    campaignId: string, 
    selectedIds: string[],
    onToggleSelection: (id: string) => void,
    onSelectAll: (ids: string[]) => void
}) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSessionIds, setExpandedSessionIds] = useState<string[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const arcSessions = await actions.getArchiveSessions(arcId);
            if (arcSessions.success && arcSessions.data) {
                setSessions(arcSessions.data);
            }
        } catch (e) {
            console.error("Error loading arc sessions:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [arcId]);

    if (loading) return <div className="flex justify-center p-4 w-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="space-y-2 w-full">
            <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[9px] h-6 uppercase font-bold text-muted-foreground/70 hover:text-primary mb-1 shrink-0"
                onClick={() => onSelectAll(sessions.map(s => s.id))}
            >
                Seleziona Tutte
            </Button>
            {sessions.map(s => (
                <Card key={s.id} className={cn(
                    "bg-background/40 border-border/20 overflow-hidden cursor-pointer transition-all hover:bg-background/60 w-full",
                    selectedIds.includes(s.id) && "ring-1 ring-accent bg-accent/5 border-accent/30",
                    s.is_summarized && "border-emerald-500/30 bg-emerald-500/5"
                )} onClick={() => onToggleSelection(s.id)}>
                    <CardHeader className="p-2 sm:p-3 pb-1 space-y-0 w-full">
                        <div className="flex justify-between items-center gap-2 w-full">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                                <Checkbox 
                                    checked={selectedIds.includes(s.id)} 
                                    onCheckedChange={() => onToggleSelection(s.id)}
                                    className="h-3.5 w-3.5 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="text-[9px] sm:text-[11px] font-bold truncate flex items-center gap-1 min-w-0 overflow-hidden">
                                    {s.is_summarized ? (
                                        <Check className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                                    ) : (
                                        <Sparkle className="h-2.5 w-2.5 text-accent shrink-0" />
                                    )}
                                    <span className="opacity-70 flex-shrink-0">{s.session_number}:</span> <span className="truncate flex-1 min-w-0">{s.title}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onToggleSelection(s.id); }}>
                                    <Pencil className="h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-3 pt-0 w-full overflow-hidden">
                        <div 
                            className={cn(
                                "text-[8.5px] sm:text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap italic opacity-80 pl-1 break-words cursor-pointer",
                                !expandedSessionIds.includes(s.id) && "line-clamp-2"
                            )}
                            onClick={(e) => { e.stopPropagation(); setExpandedSessionIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id]); }}
                        >
                            {s.notes}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
