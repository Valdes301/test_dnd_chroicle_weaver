
'use client';

import { useState, useEffect, type ChangeEvent, type FC, useMemo, useRef, useId, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, MagicItem, Monster, Reward, CharacterEvent } from '@/lib/types';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollText, Upload, Pencil, Trash2, Trophy, Expand, GripVertical, Search, Cog, Package, Sparkles, Loader2, RotateCcw, Shield, Sword, X, Check, Users, MessageSquare, Printer, Archive, Hash, PanelLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './ui/markdown-renderer';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import * as actions from '@/lib/actions';
import { Separator } from '@/components/ui/separator';
import { ExperimentalCardGenerator } from './experimental-card-generator';
import { MagicItemFormDialog } from './items-db';
import { MonsterFormDialog } from './monsters-db';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ScrollArea } from './ui/scroll-area';
import { SidebarTrigger } from './ui/sidebar';

const EditableXpInput: FC<{ 
  sessionId: string;
  initialXp: number | null;
  onUpdate: (sessionId: string, newXp: number) => Promise<void>;
}> = ({ sessionId, initialXp, onUpdate }) => {
  const [xp, setXp] = useState(initialXp || 0);

  useEffect(() => {
    setXp(initialXp || 0);
  }, [initialXp]);

  const handleBlur = () => {
    const initialValue = initialXp || 0;
    if (xp !== initialValue) {
      onUpdate(sessionId, xp);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative flex items-center">
      <Trophy className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="number"
        value={xp}
        onChange={(e) => setXp(Number(e.target.value) || 0)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-8 w-24 pl-7 pr-1 text-center font-semibold bg-background/50"
        aria-label="Punti Esperienza"
      />
    </div>
  );
};


const SortableSessionItem: FC<{ 
  session: Session,
  getBadgeVariant: (source: Session['source']) => 'default' | 'secondary' | 'outline',
  startEditingContent: (session: Session) => void,
  cancelEditingContent: () => void,
  handleSaveNotes: (sessionId: string) => Promise<void>,
  editingContentId: string | null,
  newNotes: string,
  setNewNotes: (notes: string) => void,
  setEditingMetadataSession: (session: Session) => void,
  setDeleteCandidateId: (id: string) => void,
  onUpdateSessionXp: (sessionId: string, xp: number) => Promise<void>,
  onToggleSessionRead: (sessionId: string) => void,
  onOpenLoot: (session: Session) => void,
  onScanLoot: (session: Session) => void,
  onClearLoot: (sessionId: string) => void,
  onArchiveSession: (sessionId: string) => Promise<void>,
  onFocusSession: (sessionId: string) => void,
  isScanning: boolean,
}> = memo(({ 
  session, 
  getBadgeVariant, 
  startEditingContent,
  cancelEditingContent,
  handleSaveNotes,
  editingContentId, 
  newNotes,
  setNewNotes,
  setEditingMetadataSession,
  setDeleteCandidateId,
  onUpdateSessionXp,
  onToggleSessionRead,
  onOpenLoot,
  onScanLoot,
  onClearLoot,
  onArchiveSession,
  onFocusSession,
  isScanning
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: session.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card transition-shadow",
        isDragging ? "z-10 shadow-xl" : "shadow-sm",
      )}
    >
      <AccordionItem value={session.id} className="border-b-0">
         <div className={cn("flex flex-col p-4 transition-opacity", session.is_read ? 'opacity-60 hover:opacity-100' : 'opacity-100')}>
            <div className="flex-grow w-full text-center">
                <h4 className="font-headline text-lg break-words">{session.title}</h4>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>Sessione {session.session_number}</span>
                    <Badge variant={getBadgeVariant(session.source)} className="capitalize">{session.source === 'generated' ? 'Generata' : 'Importata'}</Badge>
                </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                 <div className="flex items-center gap-2">
                    <div {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground p-2 -ml-2">
                        <GripVertical className="h-5 w-5" />
                    </div>
                    <Checkbox
                        id={`read-${session.id}`}
                        aria-label="Segna come letto"
                        checked={session.is_read}
                        onCheckedChange={() => onToggleSessionRead(session.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5"
                    />
                    <EditableXpInput 
                        sessionId={session.id}
                        initialXp={session.xp_award}
                        onUpdate={onUpdateSessionXp}
                    />
                 </div>

                <div className="flex items-center gap-1 shrink-0">
                    {!!session.loot_scanned ? (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10" 
                            onClick={() => onOpenLoot(session)}
                            title="Gestisci Bottino e Personaggi"
                        >
                            <Package className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
                            onClick={() => onScanLoot(session)}
                            disabled={isScanning}
                            title="Cerca bottino e PNG"
                        >
                            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        </Button>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Cog className="h-4 w-4" />
                                <span className="sr-only">Opzioni Sessione</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {!!session.loot_scanned ? (
                                <DropdownMenuItem disabled className="text-[10px] uppercase font-bold text-accent opacity-70">
                                    <Check className="mr-2 h-3 w-3" />
                                    <span>Scansione completata</span>
                                </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onSelect={() => setEditingMetadataSession(session)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>Modifica Titolo e Numero</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => startEditingContent(session)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>Modifica Contenuto</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onArchiveSession(session.id)} className="text-primary">
                                <Archive className="mr-2 h-4 w-4" />
                                <span>Archivia in Biblioteca</span>
                            </DropdownMenuItem>
                            {!!session.loot_scanned ? (
                                <DropdownMenuItem onSelect={() => onClearLoot(session.id)} className="text-accent">
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    <span>Reset Scansione</span>
                                </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setDeleteCandidateId(session.id)} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Elimina Sessione</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AccordionTrigger className="p-2 hover:bg-accent rounded-md [&[data-state=open]>svg]:rotate-180" />
                </div>
            </div>
        </div>
          <AccordionContent>
              <div className="relative px-4 pb-4">
                {editingContentId === session.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Modifica testo della sessione / cronaca</span>
                      <span className="flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" /> Formattazione automatica attiva al salvataggio</span>
                    </div>
                    <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="min-h-[200px]" />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={cancelEditingContent}>Annulla</Button>
                      <Button onClick={() => handleSaveNotes(session.id)}>Salva Note</Button>
                    </div>
                  </div>
                ) : (
                    <div className="relative">
                        <div className="p-4 bg-background/50 rounded-md border text-foreground/90">
                            <MarkdownRenderer content={session.notes} className="prose-sm sm:prose-base font-serif" />
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 h-8 w-8 text-muted-foreground/70 hover:text-foreground"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFocusSession(session.id);
                            }}
                        >
                            <Expand className="h-4 w-4" />
                            <span className="sr-only">Schermo Intero</span>
                        </Button>
                    </div>
                )}
              </div>
          </AccordionContent>
      </AccordionItem>
    </div>
  );
});

const rewardSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Il nome è obbligatorio."),
  description: z.string().min(1, "La descrizione è obbligatoria."),
});

type RewardFormData = z.infer<typeof rewardSchema>;

function RewardFormDialog({ reward, trigger, onSave, onDelete }: { reward: Reward, trigger: React.ReactNode, onSave: (data: RewardFormData) => Promise<void>, onDelete: (id: string) => Promise<void> }) {
    const [isOpen, setIsOpen] = useState(false);
    const formId = useId();

    const form = useForm<RewardFormData>({
        resolver: zodResolver(rewardSchema),
        defaultValues: {
            id: reward.id,
            name: reward.name,
            description: reward.description,
        },
    });

    useEffect(() => {
        if(isOpen) {
            form.reset({
                id: reward.id,
                name: reward.name,
                description: reward.description,
            });
        }
    }, [isOpen, reward, form]);

    const handleSubmit = async (values: RewardFormData) => {
        await onSave(values);
        setIsOpen(false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="grid grid-rows-[auto_1fr_auto] max-h-[90vh] p-0">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle>Modifica Ricompensa Speciale</DialogTitle>
                    <DialogDescription>Correggi i dettagli del premio ricevuto dai giocatori.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="px-6 border-y">
                    <Form {...form}>
                        <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome Premio</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrizione</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </form>
                    </Form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-4 flex justify-between sm:justify-between items-center">
                    <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(reward.id)}><Trash2 className="h-4 w-4 mr-2"/>Elimina</Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Annulla</Button>
                        <Button type="submit" form={formId} disabled={form.formState.isSubmitting}>Salva</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


type SessionTimelineProps = {
  sessions: Session[];
  onImportSession: (notes: string, title: string) => void;
  onUpdateSessionTitle: (sessionId: string, newTitle: string) => Promise<void>;
  onUpdateSessionNumber: (sessionId: string, newNumber: number) => Promise<void>;
  onUpdateSessionNotes: (sessionId: string, newNotes: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onReorderSessions: (orderedIds: string[]) => Promise<void>;
  onUpdateSessionXp: (sessionId: string, newXp: number) => Promise<void>;
  onToggleSessionRead: (sessionId: string) => void;
  onClearSessionLoot: (sessionId: string) => Promise<void>;
  onFocusSession: (sessionId: string) => void;
};

export function SessionTimeline({ 
    sessions, 
    onImportSession, 
    onUpdateSessionTitle, 
    onUpdateSessionNumber,
    onUpdateSessionNotes, 
    onDeleteSession, 
    onReorderSessions,
    onUpdateSessionXp,
    onToggleSessionRead,
    onClearSessionLoot,
    onFocusSession
}: SessionTimelineProps) {
  const [importNotes, setImportNotes] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [isImportDialogOpen, setImportDialogOpen] = useState(false);

  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [newNotes, setNewNotes] = useState('');
  
  const [editingMetadataSession, setEditingMetadataSession] = useState<Session | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newNumber, setNewNumber] = useState<number>(0);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);

  // Loot & Character Presence State
  const [isScanningId, setIsScanningId] = useState<string | null>(null);
  const [lootModalData, setLootModalData] = useState<{ 
      session: Session, 
      items: MagicItem[], 
      monsters: Monster[], 
      rewards: Reward[],
      characterEvents: (CharacterEvent & { characterName: string, characterType: string })[]
  } | null>(null);

  // State to manage the order of session IDs for dnd-kit
  const [orderedSessionIds, setOrderedSessionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();
  const router = useRouter();

  // Sync the ordered IDs when the sessions prop changes
  useEffect(() => {
    setOrderedSessionIds(sessions.map(s => s.id).reverse());
  }, [sessions]);

  // Create a map for quick lookups. This improves performance.
  const sessionsMap = useMemo(() => new Map(sessions.map(s => [s.id, s])), [sessions]);

  // Derive the sessions to display from the ordered IDs
  const displayedSessions = useMemo(() => 
    orderedSessionIds.map(id => sessionsMap.get(id)).filter(Boolean) as Session[],
    [orderedSessionIds, sessionsMap]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (editingMetadataSession) {
      setNewTitle(editingMetadataSession.title);
      setNewNumber(editingMetadataSession.session_number);
    }
  }, [editingMetadataSession]);

  const filteredDisplayedSessions = useMemo(() => {
    if (!searchQuery) {
        return displayedSessions;
    }
    const lowerCaseSearch = searchQuery.toLowerCase();
    return displayedSessions.filter(session => 
        session.title.toLowerCase().includes(lowerCaseSearch) ||
        (session.notes?.toLowerCase() ?? '').includes(lowerCaseSearch)
    );
  }, [displayedSessions, searchQuery]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require an 8px drag to start
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
        const oldIndex = orderedSessionIds.indexOf(active.id as string);
        const newIndex = orderedSessionIds.indexOf(over.id as string);
        
        const newOrderedIds = arrayMove(orderedSessionIds, oldIndex, newIndex);
        setOrderedSessionIds(newOrderedIds);

        // Per il DB dobbiamo inviare i numeri crescenti, quindi invertiamo la lista visuale
        const idsInAscendingOrder = [...newOrderedIds].reverse();
        await onReorderSessions(idsInAscendingOrder);
    }
  };


  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportTitle(file.name.replace(/\.[^/.]+$/, ''));
    if (file.type === 'text/plain') {
      const text = await file.text();
      setImportNotes(text);
    } else {
      console.warn('Unsupported file type:', file.type);
      setImportNotes(`File non supportato: ${file.name}. Per favore usa un file .txt.`);
    }
  };

  const handleImport = async () => {
    if (importNotes.trim()) {
      await onImportSession(importNotes, importTitle);
      setImportNotes('');
      setImportTitle('');
      setImportDialogOpen(false);
      router.refresh(); 
    }
  };

  const startEditingContent = useCallback((session: Session) => {
    setEditingContentId(session.id);
    setNewNotes(session.notes ?? '');
  }, []);

  const cancelEditingContent = useCallback(() => {
    setEditingContentId(null);
    setNewNotes('');
  }, []);
  
  const handleSaveNotes = async (sessionId: string) => {
    if (newNotes.trim() && sessionId) {
      await onUpdateSessionNotes(sessionId, newNotes);
      cancelEditingContent();
      router.refresh();
    }
  };

  const handleSaveNewMetadata = async () => {
    if (!editingMetadataSession) return;
    setIsSavingMetadata(true);
    try {
        const res = await actions.updateSessionMetadata(editingMetadataSession.id, newTitle, newNumber);
        if (res.success) {
            toast({ title: "Metadati Aggiornati!" });
            setEditingMetadataSession(null);
            router.refresh(); 
        } else throw new Error(res.error || "Errore sconosciuto");
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Errore', description: e.message });
    } finally {
        setIsSavingMetadata(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteCandidateId) {
      await onDeleteSession(deleteCandidateId);
      setDeleteCandidateId(null);
      router.refresh();
    }
  };

  const handleResyncNumbers = async () => {
    if (!sessions[0]?.campaignId) return;
    setIsResyncing(true);
    try {
        const res = await actions.resyncSessionNumbers(sessions[0].campaignId);
        if (res.success) {
            toast({ title: "Numerazione Ripristinata!", description: "Tutte le storie sono state rinumerate correttamente." });
            router.refresh(); 
        } else throw new Error("Errore durante il ripristino.");
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Errore", description: e.message });
    } finally {
        setIsResyncing(false);
    }
  };

  const handleScanLoot = useCallback(async (session: Session) => {
    setIsScanningId(session.id);
    try {
        const result = await actions.scanSessionForLoot(session.id);
        if (result.success) {
            toast({ title: "Scansione Completata!", description: "L'IA ha identificato tesori e aggiornato la cronologia dei personaggi." });
            router.refresh();
        } else {
            throw new Error(result.error || "Errore sconosciuto.");
        }
    } catch (e: any) {
        toast({ variant: "destructive", title: "Errore Scansione", description: e.message });
    } finally {
        setIsScanningId(null);
    }
  }, [router, toast]);

  const handleOpenLoot = useCallback(async (session: Session) => {
    try {
        const result = await actions.getSessionLoot(session.id);
        if (result.success && result.data) {
            setLootModalData({ session, ...result.data });
        } else throw new Error(result.error || "Errore sconosciuto.");
    } catch (e: any) {
        toast({ variant: "destructive", title: "Errore caricamento", description: e.message });
    }
  }, [toast]);

  const handleSaveItemFromLoot = async (itemData: Partial<MagicItem> & { campaignId: string }) => {
    const result = await actions.saveMagicItem(itemData);
    if (result.success) {
        toast({ title: "Oggetto Aggiornato!" });
        if (lootModalData) handleOpenLoot(lootModalData.session);
    }
  };

  const handleSaveMonsterFromLoot = async (monsterData: any & { campaignId: string }) => {
    const result = await actions.saveMonster(monsterData);
    if (result.success) {
        toast({ title: "Mostro Aggiornato!" });
        if (lootModalData) handleOpenLoot(lootModalData.session);
    }
  };

  const handleSaveRewardFromLoot = async (rewardData: RewardFormData) => {
    const result = await actions.updateReward(rewardData);
    if (result.success) {
        toast({ title: "Ricompensa Aggiornata!" });
        if (lootModalData) handleOpenLoot(lootModalData.session);
    }
  };

  const handleDeleteRewardFromLoot = async (id: string) => {
    const result = await actions.deleteReward(id);
    if (result.success) {
        toast({ title: "Ricompensa Rimossa" });
        if (lootModalData) handleOpenLoot(lootModalData.session);
    }
  };

  const handleArchiveSingleSession = async (sessionId: string) => {
      const result = await actions.archiveSingleSession(sessionId);
      if (result.success) {
          toast({ title: "Sessione Archiviata", description: "La scena è stata spostata nella Biblioteca." });
          router.refresh();
      } else {
          toast({ variant: "destructive", title: "Errore", description: result.error });
      }
  };

  const getBadgeVariant = (source: Session['source']) => {
    switch (source) {
      case 'generated': return 'default';
      case 'imported': return 'secondary';
      default: return 'outline';
    }
  };

  const rewardCards = useMemo(() => {
    if (!lootModalData?.rewards) return [];
    return lootModalData.rewards.map(r => ({
        name: r.name,
        type: 'Ricompensa',
        rarity: 'Speciale',
        description: r.description,
        cost: '—',
        techType: 'reward' as any,
    }));
  }, [lootModalData?.rewards]);

  const allLootItemsForGenerator = useMemo(() => {
    if (!lootModalData) return [];
    return [...lootModalData.items, ...rewardCards] as any[];
  }, [lootModalData, rewardCards]);
  
  const timelineContent = sessions.length > 0 ? (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedSessionIds} strategy={verticalListSortingStrategy}>
            <Accordion type="single" collapsible className="w-full space-y-2">
                {filteredDisplayedSessions.map((session) => (
                  <SortableSessionItem
                    key={session.id}
                    session={session}
                    getBadgeVariant={getBadgeVariant}
                    editingContentId={editingContentId}
                    startEditingContent={startEditingContent}
                    cancelEditingContent={cancelEditingContent}
                    handleSaveNotes={handleSaveNotes}
                    newNotes={newNotes}
                    setNewNotes={setNewNotes}
                    setEditingMetadataSession={setEditingMetadataSession}
                    setDeleteCandidateId={setDeleteCandidateId}
                    onUpdateSessionXp={onUpdateSessionXp}
                    onToggleSessionRead={onToggleSessionRead}
                    onScanLoot={handleScanLoot}
                    onOpenLoot={handleOpenLoot}
                    onClearLoot={onClearSessionLoot}
                    onArchiveSession={handleArchiveSingleSession}
                    onFocusSession={onFocusSession}
                    isScanning={isScanningId === session.id}
                  />
                ))}
            </Accordion>
        </SortableContext>
    </DndContext>
  ) : (
    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
      <ScrollText className="mx-auto h-12 w-12" />
      <p className="mt-4 font-semibold">La tua avventura deve ancora iniziare.</p>
      <p className="text-sm">Genera o importa la tua prima sessione per iniziare!</p>
    </div>
  );

  if (!isClient) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-headline flex items-center text-2xl">
            <ScrollText className="mr-2" /> Cronologia della Storia
          </CardTitle>
          <CardDescription>La cronologia completa della tua campagna.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-2">
            <CardTitle className="font-headline flex items-center text-2xl">
              <ScrollText className="mr-2" /> Cronologia della Storia
            </CardTitle>
            <CardDescription>La cronologia completa della tua campagna. Puoi trascinare le sessioni per riordinarle.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cerca nella cronologia..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                            <Cog className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            <span>Importa Storia</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleResyncNumbers} disabled={isResyncing}>
                            {isResyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Hash className="mr-2 h-4 w-4" />}
                            <span>Riassegna Numeri</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
        <CardContent>
          {timelineContent}
        </CardContent>
      </Card>

      {/* DIALOG IMPORTAZIONE */}
      <Dialog open={isImportDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Importa Note</DialogTitle>
              <DialogDescription>Incolla le note o carica un file di testo (.txt).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input type="file" accept=".txt" onChange={handleFileChange} className="text-sm" />
              <Input placeholder="Titolo Sessione (opzionale)" value={importTitle} onChange={(e) => setImportTitle(e.target.value)} />
              <Textarea placeholder="Incolla qui le tue note o carica un file per popolarle..." className="min-h-[200px] resize-y" value={importNotes} onChange={(e) => setImportNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={handleImport}>Importa nella Cronologia</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* MODALE GESTIONE BOTTINO E CONTINUITÀ PERSONAGGI */}
      <Dialog open={!!lootModalData} onOpenChange={(open) => !open && setLootModalData(null)}>
          <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col p-0">
              <DialogHeader className="p-6 pb-2">
                  <div className="flex justify-between items-center pr-8">
                      <div>
                          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
                              <Package className="h-6 w-6 text-accent" /> Riepilogo Sessione: {lootModalData?.session.title}
                          </DialogTitle>
                          <DialogDescription>Bottino, creature e apparizioni dei personaggi.</DialogDescription>
                      </div>
                  </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto p-6 pt-2">
                  {lootModalData && (
                      <div className="space-y-10">
                          {/* SEZIONE PERSONAGGI E CONTINUITÀ */}
                          <div className="space-y-4">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                  <Users className="h-4 w-4" /> Personaggi e Azioni Rilevate
                              </h4>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {lootModalData.characterEvents.map((ev, i) => (
                                      <div key={i} className="p-4 rounded-xl border bg-primary/5 flex flex-col gap-2">
                                          <div className="flex items-center justify-between gap-2">
                                              <span className="font-bold text-sm text-primary truncate">{ev.characterName}</span>
                                              <Badge variant="outline" className="text-[9px] h-auto py-0.5 uppercase px-2 leading-tight text-center shrink-0">{ev.characterType}</Badge>
                                          </div>
                                          <p className="text-xs italic leading-relaxed text-muted-foreground">"{ev.eventDescription}"</p>
                                      </div>
                                  ))}
                                  {lootModalData.characterEvents.length === 0 && (
                                      <p className="text-xs text-muted-foreground italic p-4 border border-dashed rounded-lg col-span-full">L'IA non ha identificato azioni specifiche dei personaggi noti.</p>
                                  )}
                              </div>
                          </div>

                          <Separator />

                          {/* SEZIONE ELEMENTI ESTRATTI CON EDITING */}
                          <div className="grid gap-6 md:grid-cols-2">
                              {/* LISTA OGGETTI */}
                              <div className="space-y-3">
                                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                      <Sword className="h-4 w-4" /> Oggetti Rilevati ({lootModalData.items.length})
                                  </h4>
                                  <div className="space-y-2">
                                      {lootModalData.items.map(item => (
                                          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 group hover:bg-muted/30 transition-colors">
                                              <div className="flex flex-col min-w-0">
                                                  <span className="font-bold text-sm truncate">{item.name}</span>
                                                  <span className="text-[10px] text-muted-foreground uppercase">{item.type} • {item.rarity}</span>
                                              </div>
                                              <MagicItemFormDialog 
                                                  item={item} 
                                                  campaignId={lootModalData.session.campaignId} 
                                                  onSave={handleSaveItemFromLoot}
                                                  trigger={<Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><Pencil className="h-4 w-4"/></Button>}
                                              />
                                          </div>
                                      ))}
                                      {lootModalData.items.length === 0 && <p className="text-xs text-muted-foreground italic">Nessun oggetto fisico rilevato.</p>}
                                  </div>
                              </div>

                              {/* LISTA MOSTRI */}
                              <div className="space-y-3">
                                  <h4 className="text-xs font-bold uppercase tracking-widest text-rose-500 flex items-center gap-2">
                                      <Shield className="h-4 w-4" /> Creature Rilevate ({lootModalData.monsters.length})
                                  </h4>
                                  <div className="space-y-2">
                                      {lootModalData.monsters.map(monster => (
                                          <div key={monster.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 group hover:bg-muted/30 transition-colors">
                                              <div className="flex flex-col min-w-0">
                                                  <span className="font-bold text-sm truncate">{monster.name}</span>
                                                  <span className="text-[10px] text-muted-foreground uppercase">CA {monster.armorClass} • PF {monster.hitPoints}</span>
                                              </div>
                                              <MonsterFormDialog 
                                                  monster={monster} 
                                                  campaignId={lootModalData.session.campaignId} 
                                                  onSave={handleSaveMonsterFromLoot}
                                                  trigger={<Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><Pencil className="h-4 w-4"/></Button>}
                                              />
                                          </div>
                                      ))}
                                      {lootModalData.monsters.length === 0 && <p className="text-xs text-muted-foreground italic">Nessuna creatura rilevata.</p>}
                                  </div>
                              </div>
                          </div>

                          <Separator />

                          {/* SEZIONE RICOMPENSE ASTRATTE */}
                          {lootModalData.rewards.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Trophy className="h-4 w-4" /> Ricompense Speciali
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {lootModalData.rewards.map((r, i) => (
                                            <div key={r.id || i} className="p-5 rounded-xl border bg-muted/30 relative group overflow-hidden transition-colors hover:bg-muted/40 flex flex-col min-h-[160px]">
                                                <div className="absolute top-0 right-0 p-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <RewardFormDialog 
                                                        reward={r}
                                                        onSave={handleSaveRewardFromLoot}
                                                        onDelete={handleDeleteRewardFromLoot}
                                                        trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>}
                                                    />
                                                </div>
                                                <div className="absolute -bottom-2 -left-2 opacity-5">
                                                    <Sparkles className="h-16 w-16" />
                                                </div>
                                                <div className="font-headline font-bold text-xl text-primary mb-2 pr-8">{r.name}</div>
                                                <p className="text-sm text-muted-foreground leading-relaxed italic flex-grow">"{r.description}"</p>
                                            </div>
                                        ))}
                                    </div>
                                    <Separator className="my-8" />
                                </div>
                          )}

                          {/* GENERATORE CARTE COMPLETE */}
                          <div className="space-y-4">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                  <Printer className="h-4 w-4" /> Generatore Handout (Carte Fronte-Retro)
                              </h4>
                              <div className="rounded-xl border bg-background overflow-hidden p-4 sm:p-8">
                                  <ExperimentalCardGenerator 
                                      allItems={allLootItemsForGenerator} 
                                      dbSpells={[]} 
                                      initialSelection={[
                                          ...lootModalData.items.map(i => ({ name: i.name, type: 'item' as const })),
                                          ...rewardCards.map(r => ({ name: r.name, type: 'item' as const }))
                                      ]}
                                  />
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCandidateId} onOpenChange={(isOpen) => !isOpen && setDeleteCandidateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. La sessione verrà eliminata definitivamente dalla cronologia della tua campagna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteCandidateId(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>Sì, elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingMetadataSession} onOpenChange={(isOpen) => !isOpen && setEditingMetadataSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Metadati Sessione</DialogTitle>
            <DialogDescription>
              Aggiorna il titolo o il numero per questa sessione della cronologia.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="session-num-input" className="text-right">
                Numero
              </Label>
              <Input
                id="session-num-input"
                type="number"
                value={newNumber}
                onChange={(e) => setNewNumber(parseInt(e.target.value) || 0)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="session-title-input" className="text-right">
                Titolo
              </Label>
              <Input
                id="session-title-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditingMetadataSession(null)} disabled={isSavingMetadata}>Annulla</Button>
            <Button type="submit" onClick={handleSaveNewMetadata} disabled={isSavingMetadata}>
                {isSavingMetadata ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
