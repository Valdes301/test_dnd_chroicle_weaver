'use client';

import { useState, useEffect } from 'react';
import type { CampaignWithRelations, Session } from '@/lib/types';
import { SessionTimeline } from './session-timeline';
import { WorldDb } from './world-db';
import { Button } from './ui/button';
import { BookMarked, Loader2, Sparkles, Pencil, Check, Archive, ChevronLeft, Compass, Type } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import * as actions from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { MarkdownRenderer } from './ui/markdown-renderer';

type CampaignDashboardProps = {
  campaign: CampaignWithRelations;
  sessions: Session[];
  onImportSession: (notes: string, title: string) => void;
  onSummarizeCampaign: () => Promise<void>;
  isSummarizing: boolean;
  onUpdateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  onUpdateSessionNumber: (sessionId: string, num: number) => Promise<void>;
  onUpdateSessionNotes: (sessionId: string, notes: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onReorderSessions: (orderedIds: string[]) => Promise<void>;
  onUpdateSessionXp: (sessionId: string, xp: number) => Promise<void>;
  onToggleSessionRead: (sessionId: string) => Promise<void>;
  onClearSessionLoot: (sessionId: string) => Promise<void>;
  onFocusSession?: (sessionId: string) => void;
  onNavigateToQuestCreator?: () => void;
};

export function CampaignDashboard({
  campaign,
  sessions,
  onImportSession,
  onSummarizeCampaign,
  isSummarizing,
  onUpdateSessionTitle,
  onUpdateSessionNumber,
  onUpdateSessionNotes,
  onDeleteSession,
  onReorderSessions,
  onUpdateSessionXp,
  onToggleSessionRead,
  onClearSessionLoot,
  onNavigateToQuestCreator,
}: CampaignDashboardProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [tempLabel, setTempLabel] = useState(campaign.active_arc_label || 'Arco Narrativo Attivo');
  const [tempTitle, setTempTitle] = useState(campaign.activeArc?.title || 'Atto Iniziale');
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [focusFontSize, setFocusFontSize] = useState<'normal' | 'large' | 'extra'>('normal');

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleArchive = async () => {
    if (!campaign.activeArc) return;
    setIsArchiving(true);
    try {
        const res = await actions.archiveActiveArc(campaign.id, campaign.activeArc.id);
        if (res.success) {
            toast({
                title: "Arco Narrativo Archiviato!",
                description: `Le sessioni sono state spostate nella Biblioteca delle Cronache.`,
            });
            router.refresh();
        } else throw new Error(res.error || 'Errore durante l\'archiviazione');
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Errore", description: e.message });
    } finally {
        setIsArchiving(false);
    }
  };

  const handleSaveHeader = async () => {
    if (!campaign.activeArc) return;
    setIsSavingHeader(true);
    try {
        const res = await actions.updateActiveArcInfo(campaign.id, campaign.activeArc.id, tempTitle, tempLabel);
        if (res.success) {
            toast({ title: "Intestazione Aggiornata!" });
            setIsEditingHeader(false);
            router.refresh();
        } else throw new Error(res.error || 'Errore durante il salvataggio');
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Errore", description: e.message });
    } finally {
        setIsSavingHeader(false);
    }
  };

  if (!mounted) return null;

  const focusedSession = sessions.find(s => s.id === focusedSessionId);

  if (focusedSession) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFocusedSessionId(null)}
                    className="gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" /> Torna alla Cronologia
                </Button>

                <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-lg border">
                    <span className="text-[9px] uppercase font-bold px-2 opacity-50"><Type className="h-3 w-3" /></span>
                    <Tabs value={focusFontSize} onValueChange={(v: any) => setFocusFontSize(v)}>
                        <TabsList className="h-7 p-0 bg-transparent">
                            <TabsTrigger value="normal" className="h-6 text-[10px] uppercase font-bold">Piccolo</TabsTrigger>
                            <TabsTrigger value="large" className="h-6 text-[10px] uppercase font-bold">Medio</TabsTrigger>
                            <TabsTrigger value="extra" className="h-6 text-[10px] uppercase font-bold">Grande</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>
            
            <Card className="border-primary/20 bg-card/40 shadow-2xl overflow-hidden">
                <CardHeader className="border-b border-border/50 pb-6 pt-8">
                    <div className="flex flex-col items-center text-center space-y-3">
                        <Badge variant="outline" className="uppercase tracking-[0.2em] text-[9px] py-0.5 px-3 border-primary/20 text-primary/60">
                            Sessione {focusedSession.session_number}
                        </Badge>
                        <CardTitle className="font-headline text-3xl md:text-5xl text-foreground leading-tight tracking-tight max-w-5xl px-4">
                            {focusedSession.title}
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6 md:p-8 lg:p-12 bg-muted/5">
                    <div className="max-w-5xl mx-auto py-2">
                        <MarkdownRenderer 
                            content={focusedSession.notes} 
                            className={cn(
                                "leading-relaxed text-foreground/90 font-serif",
                                focusFontSize === 'normal' && "text-sm md:text-base",
                                focusFontSize === 'large' && "text-base md:text-lg",
                                focusFontSize === 'extra' && "text-lg md:text-xl"
                            )}
                        />
                    </div>
                </CardContent>
                <CardFooter className="justify-center border-t border-border/50 py-6 bg-background/20">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-30">Fine della Cronaca selezionata</p>
                </CardFooter>
            </Card>
        </div>
    );
  }
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-full overflow-x-hidden">
      <div className="flex flex-col items-center justify-center text-center group">
          <div className="flex flex-col items-center gap-3 w-full">
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center shadow-lg shadow-accent/10 border border-accent/20">
                  <BookMarked className="h-5 w-5 text-accent" />
              </div>
              <div className="space-y-2 max-w-2xl px-4 relative">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="font-headline text-2xl md:text-3xl text-foreground/90 leading-tight">
                        {campaign.active_arc_label || 'Arco Narrativo Attivo'}
                    </h2>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity absolute -right-8 top-0.5" onClick={() => setIsEditingHeader(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground uppercase font-bold tracking-[0.25em] leading-relaxed">
                      {campaign.activeArc?.title || 'Atto Iniziale'}
                  </p>
              </div>
          </div>
          <div className="w-20 h-px bg-border/50 mt-4" />
      </div>

      <Dialog open={isEditingHeader} onOpenChange={setIsEditingHeader}>
          <DialogContent className="w-[95vw] max-w-md">
              <DialogHeader>
                  <DialogTitle>Personalizza Intestazione</DialogTitle>
                  <DialogDescription>Modifica le scritte che appaiono nel box dell'arco narrativo attivo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Testo Superiore (Etichetta)</Label>
                      <Input value={tempLabel} onChange={(e) => setTempLabel(e.target.value)} placeholder="es. Arco Narrativo Attivo" />
                  </div>
                  <div className="space-y-2">
                      <Label>Nome dell'Atto / Capitolo</Label>
                      <Input value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} placeholder="es. Atto Iniziale" />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsEditingHeader(false)}>Annulla</Button>
                  <Button onClick={handleSaveHeader} disabled={isSavingHeader}>
                      {isSavingHeader ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Check className="h-4 w-4 mr-2"/>}
                      Salva Modifiche
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Header rapido con CTA per Creazione Nuova Quest */}
      {onNavigateToQuestCreator && (
        <div className="flex justify-end max-w-5xl mx-auto">
          <Button
            onClick={onNavigateToQuestCreator}
            size="sm"
            className="gap-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold shadow-md"
          >
            <Compass className="h-4 w-4" />
            Crea Nuova Quest
          </Button>
        </div>
      )}

      {/* Cronologia delle Sessioni / Cronache */}
      <SessionTimeline 
        sessions={sessions} 
        onImportSession={onImportSession}
        onUpdateSessionTitle={onUpdateSessionTitle}
        onUpdateSessionNumber={onUpdateSessionNumber}
        onUpdateSessionXp={onUpdateSessionXp}
        onUpdateSessionNotes={onUpdateSessionNotes}
        onDeleteSession={onDeleteSession}
        onReorderSessions={onReorderSessions}
        onToggleSessionRead={onToggleSessionRead}
        onClearSessionLoot={onClearSessionLoot}
        onFocusSession={(id) => setFocusedSessionId(id)}
      />

      {/* Conclusione ed Archiviazione Capitolo */}
      <Card className="border-accent/20 bg-accent/5 overflow-hidden shadow-sm">
          <CardHeader className="pb-4">
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" /> Concludi Capitolo Attuale
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                  Sposta tutte le sessioni attuali nella Biblioteca delle Cronache. Potrai generare la sintesi leggendaria successivamente.
              </p>
          </CardHeader>
          <CardFooter className="bg-accent/5 border-t border-accent/10 py-4">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="default" className="w-full gap-2 shadow-lg shadow-accent/20 h-11" disabled={sessions.length === 0 || isArchiving}>
                        {isArchiving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Archive className="h-4 w-4" />}
                        Archivia Capitolo
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[95vw] max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Concludere questo capitolo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Le {sessions.length} sessioni attuali verranno spostate nella Biblioteca delle Cronache. La Dashboard tornerà pulita per il prossimo arco narrativo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchive}>Procedi all'Archiviazione</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
      </Card>

      {/* Sintesi e World DB */}
      <WorldDb
        campaign={campaign}
        onSummarize={onSummarizeCampaign}
        isSummarizing={isSummarizing}
      />
    </div>
  );
}
