'use client';

import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as actions from '@/lib/actions';
import type { PlayerCharacter, Skill, CharacterEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, ImagePlus, Loader2, History, User2, Star, Sparkles, Target, Fingerprint, ChevronDown, BookOpen, Heart, GripVertical, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const numericField = z.preprocess((val) => {
  if (val === "" || val === undefined || val === null) return null;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}, z.number().nullable().optional());

const characterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Il nome è obbligatorio."),
  race: z.string().optional().nullable(),
  class: z.string().optional().nullable(),
  archetype: z.string().optional().nullable(),
  level: numericField,
  hitPoints: numericField,
  armorClass: numericField,
  strength: numericField,
  dexterity: numericField,
  constitution: numericField,
  intelligence: numericField,
  wisdom: numericField,
  charisma: numericField,
  background: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  spells: z.string().optional().nullable(),
  traits: z.string().optional().nullable(),
  ideals: z.string().optional().nullable(),
  bonds: z.string().optional().nullable(),
  flaws: z.string().optional().nullable(),
});

type CharacterFormData = z.infer<typeof characterSchema>;

function AssetBrowser({ onSelect, currentUrl }: { onSelect: (url: string) => void, currentUrl?: string | null }) {
    const [assets, setAssets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        actions.listAssetsAction().then(res => {
            if (res.success && res.data) setAssets(res.data);
            setIsLoading(false);
        });
    }, []);

    if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5" /></div>;

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
            {assets.map(asset => (
                <div 
                    key={asset.name} 
                    onClick={() => onSelect(asset.url)}
                    className={cn(
                        "relative aspect-square rounded-md overflow-hidden border-2 cursor-pointer transition-all hover:scale-105",
                        currentUrl === asset.url ? "border-primary ring-2 ring-primary/20" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                >
                    <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                    {currentUrl === asset.url && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><Check className="text-white h-6 w-6 drop-shadow-md" /></div>}
                </div>
            ))}
            {assets.length === 0 && <p className="text-[10px] text-muted-foreground italic col-span-full">Nessuna immagine caricata nel server.</p>}
        </div>
    );
}

const CharacterFormDialog = ({ character, onSave, onDelete, trigger, campaignId }: { character?: PlayerCharacter, onSave: (data: CharacterFormData & { campaignId: string }) => Promise<boolean>, onDelete?: (id: string) => void, trigger: React.ReactNode, campaignId: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const { toast } = useToast();
    
    const formId = character?.id ? `form-edit-${character.id}` : 'form-new-character';
    
    const statTranslations: Record<string, string> = {
        strength: 'FOR', dexterity: 'DES', constitution: 'COS', intelligence: 'INT', wisdom: 'SAG', charisma: 'CAR',
    };
    
    const form = useForm<CharacterFormData>({
        resolver: zodResolver(characterSchema),
        defaultValues: {
            id: character?.id,
            name: character?.name ?? '',
            race: character?.race ?? '',
            class: character?.class ?? '',
            archetype: character?.archetype ?? '',
            level: character?.level ?? 1,
            armorClass: character?.armorClass ?? 10,
            hitPoints: character?.hitPoints ?? 10,
            strength: character?.strength ?? 10,
            dexterity: character?.dexterity ?? 10,
            constitution: character?.constitution ?? 10,
            intelligence: character?.intelligence ?? 10,
            wisdom: character?.wisdom ?? 10,
            charisma: character?.charisma ?? 10,
            imageUrl: character?.imageUrl ?? '',
            background: character?.background ?? '',
            traits: character?.traits ?? '',
            ideals: character?.ideals ?? '',
            bonds: character?.bonds ?? '',
            flaws: character?.flaws ?? '',
            spells: character?.spells ?? '',
        },
    });

    useEffect(() => {
        if(isOpen) {
            setShowLibrary(false);
            if (character) {
                form.reset({
                    ...character,
                    imageUrl: character.imageUrl || '',
                } as any);
            } else {
                form.reset({
                    name: '', race: '', class: '', archetype: '', level: 1, armorClass: 10, hitPoints: 10,
                    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
                    imageUrl: '', background: '', traits: '', ideals: '', bonds: '', flaws: '', spells: ''
                });
            }
        }
    }, [isOpen, character, form]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const currentName = form.getValues('name');
            const result = await actions.uploadGenericImage(event.target?.result as string, currentName);
            if (result.success && result.data) {
                form.setValue('imageUrl', result.data.url);
                toast({ title: "Ritratto caricato!" });
            }
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleActualSubmit = async (values: CharacterFormData) => {
        const success = await onSave({...values, campaignId});
        if (success) {
            setIsOpen(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 outline-none border-primary/20">
                <DialogHeader className="p-6 border-b bg-muted/10 text-left">
                    <DialogTitle className="font-headline text-2xl">{character ? 'Modifica Eroe' : 'Nuovo Eroe'}</DialogTitle>
                    <DialogDescription className="sr-only">Modulo per inserire o modificare i dettagli del personaggio giocante.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <Form {...form}>
                        <form id={formId} onSubmit={form.handleSubmit(handleActualSubmit)} className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="w-full md:w-48 space-y-2 shrink-0 flex flex-col items-center">
                                    <Label>Ritratto</Label>
                                    <div className="relative h-40 w-40 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center bg-muted shadow-lg">
                                        {form.watch('imageUrl') ? (
                                            <img src={form.watch('imageUrl')!} alt="Avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="text-center p-4 opacity-40">
                                                <ImagePlus className="h-10 w-10 mx-auto mb-2" />
                                                <p className="text-[10px]">Tocca per caricare</p>
                                            </div>
                                        )}
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isUploading} />
                                        {isUploading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="link" type="button" size="sm" className="p-0 h-auto text-[10px]" onClick={() => setShowLibrary(!showLibrary)}>
                                            {showLibrary ? "Chiudi Libreria" : "Libreria Server"}
                                        </Button>
                                        <Button variant="link" type="button" size="sm" className="p-0 h-auto text-[10px] text-destructive" onClick={() => form.setValue('imageUrl', '')}>Rimuovi</Button>
                                    </div>

                                    {showLibrary && (
                                        <ScrollArea className="h-40 w-full rounded border bg-background p-2 mt-2">
                                            <AssetBrowser 
                                                currentUrl={form.watch('imageUrl')} 
                                                onSelect={(url) => { form.setValue('imageUrl', url); setShowLibrary(false); }} 
                                            />
                                        </ScrollArea>
                                    )}
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)} />
                                        <FormField control={form.control} name="race" render={({ field }) => (<FormItem><FormLabel>Razza</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="class" render={({ field }) => (<FormItem><FormLabel>Classe Base</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                        <FormField control={form.control} name="archetype" render={({ field }) => (<FormItem><FormLabel>Archetipo / Sottoclasse</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <FormField control={form.control} name="level" render={({ field }) => (<FormItem><FormLabel>Livello</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem>)} />
                                        <FormField control={form.control} name="armorClass" render={({ field }) => (<FormItem><FormLabel>CA</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem>)} />
                                        <FormField control={form.control} name="hitPoints" render={({ field }) => (<FormItem><FormLabel>PF Massimi</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                        {Object.entries(statTranslations).map(([key, label]) => (
                                            <FormField key={key} control={form.control} name={key as any} render={({ field }) => (
                                                <FormItem><FormLabel className="text-[10px]">{label}</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-8 text-center px-1" /></FormControl><FormMessage/></FormItem>
                                            )} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="grid md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="background" render={({ field }) => (<FormItem><FormLabel>Passato / Background</FormLabel><FormControl><Textarea className="min-h-[100px] text-xs" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={form.control} name="spells" render={({ field }) => (<FormItem><FormLabel>Incantesimi / Capacità Speciali</FormLabel><FormControl><Textarea className="min-h-[100px] text-xs" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={form.control} name="traits" render={({ field }) => (<FormItem><FormLabel>Tratti di Personalità</FormLabel><FormControl><Textarea className="min-h-[80px] text-xs" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={form.control} name="ideals" render={({ field }) => (<FormItem><FormLabel>Ideali</FormLabel><FormControl><Textarea className="min-h-[80px] text-xs" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={form.control} name="bonds" render={({ field }) => (<FormItem><FormLabel>Legami</FormLabel><FormControl><Textarea className="min-h-[80px] text-xs" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={form.control} name="flaws" render={({ field }) => (<FormItem><FormLabel>Difetti</FormLabel><FormControl><Textarea className="min-h-[80px] text-xs" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)} />
                            </div>
                        </form>
                    </Form>
                </div>
                <DialogFooter className="p-6 border-t bg-muted/20 flex flex-row items-center justify-between">
                    <div className="flex items-center">
                        {character?.id && onDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="gap-2">
                                        <Trash2 className="h-4 w-4" /> Elimina
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Eliminare {character.name}?</AlertDialogTitle>
                                        <AlertDialogDescription>Questa azione è definitiva e rimuoverà l'eroe dalla campagna.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => { onDelete(character.id); setIsOpen(false); }} className="bg-destructive text-destructive-foreground">Sì, elimina</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" type="button" onClick={() => setIsOpen(false)}>Annulla</Button>
                        <Button type="submit" form={formId} disabled={form.formState.isSubmitting || isUploading}>
                            {form.formState.isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvataggio...</> : 'Salva Eroe'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

function SortablePcHistoryItem({ ev }: { ev: any }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ev.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={cn(
                "text-[11px] border-l-2 border-primary/30 pl-3 py-1 mb-3 last:mb-0 text-left bg-background/20 rounded-r-md transition-shadow relative group/ev",
                isDragging ? "z-50 shadow-lg border-primary" : ""
            )}
        >
            <div className="flex items-center gap-2 mb-1">
                <div {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-muted-foreground/40 hover:text-primary opacity-0 group-hover/ev:opacity-100 transition-opacity">
                    <GripVertical className="h-2.5 w-2.5" />
                </div>
                <div className="font-bold opacity-60 text-[9px] uppercase">Sessione {ev.sessionNumber}</div>
            </div>
            <p className="italic leading-relaxed text-foreground/80">"{ev.eventDescription}"</p>
        </div>
    );
}

export function PlayerCharactersDb({ campaignId, initialCharacters, onSave, onDelete }: any) {
    const [viewingHistory, setViewingHistory] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const router = useRouter();
    const { toast } = useToast();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleLocalSave = async (data: any) => {
        const res = await onSave(data);
        if (res.success) {
            toast({ title: "Personaggio Salvato" });
            router.refresh();
            return true;
        } else {
            toast({ variant: 'destructive', title: "Errore nel salvataggio", description: res.error });
            return false;
        }
    };

    const handleLocalDelete = async (id: string) => {
        const res = await onDelete(id);
        if (res.success) {
            toast({ title: "Personaggio Eliminato" });
            router.refresh();
        } else {
            toast({ variant: 'destructive', title: "Errore nell'eliminazione", description: res.error });
        }
    };

    const loadHistory = async (pcId: string) => {
        setIsLoadingHistory(true); 
        setViewingHistory(pcId);
        try { 
            const res = await actions.getCharacterHistory(pcId); 
            if (res.success && res.data) setHistoryData(res.data); 
        } finally { 
            setIsLoadingHistory(false); 
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = historyData.findIndex(h => h.id === active.id);
            const newIndex = historyData.findIndex(h => h.id === over.id);
            const newHistory = arrayMove(historyData, oldIndex, newIndex);
            setHistoryData(newHistory);
            await actions.reorderCharacterEvents(newHistory.map(h => h.id));
            toast({ title: "Ordine aggiornato" });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="font-headline text-3xl">Eroi della Cronaca</h2>
                <CharacterFormDialog onSave={handleLocalSave} onDelete={handleLocalDelete} campaignId={campaignId} trigger={<Button size="sm" className="gap-2 shadow-lg"><Plus className="h-4 w-4" /> Nuovo PG</Button>} />
            </div>

            <Accordion type="multiple" value={expandedIds} onValueChange={setExpandedIds} className="grid gap-4 md:grid-cols-2">
                {initialCharacters.map((char: any) => (
                    <AccordionItem key={char.id} value={char.id} className="border rounded-xl bg-card/40 overflow-hidden flex flex-col group hover:border-primary/50 transition-all border-border/50 relative">
                        <div className="p-4 pb-2">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-full overflow-hidden border bg-muted shrink-0 relative shadow-inner">
                                    {char.imageUrl ? (
                                        <img src={char.imageUrl} alt={char.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                            <User2 className="h-8 w-8" />
                                        </div>
                                    )}
                                </div>
                                
                                <AccordionPrimitive.Header className="flex-1 min-w-0 flex items-center">
                                    <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-0 hover:no-underline group/trigger text-left">
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="font-headline text-xl text-primary truncate leading-tight">{char.name}</CardTitle>
                                                <div className="flex flex-wrap gap-1 mt-1 items-center justify-start">
                                                    <Badge variant="outline" className="text-[9px] h-auto py-0.5 px-2 leading-tight text-center">{char.race}</Badge>
                                                    <Badge variant="secondary" className="text-[9px] h-auto py-0.5 px-2 uppercase leading-tight text-center">{char.class}</Badge>
                                                    {char.archetype && (
                                                        <Badge variant="secondary" className="text-[9px] h-auto py-0.5 px-2 uppercase bg-primary/20 text-primary border-primary/30 leading-tight text-center">
                                                            {char.archetype}
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className="text-[9px] h-auto py-0.5 px-2 leading-tight text-center">Liv. {char.level}</Badge>
                                                </div>
                                            </div>
                                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground/50 group-data-[state=open]/trigger:rotate-180" />
                                        </div>
                                    </AccordionPrimitive.Trigger>
                                </AccordionPrimitive.Header>
                            </div>

                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <CharacterFormDialog 
                                    character={char} 
                                    onSave={handleLocalSave} 
                                    onDelete={handleLocalDelete}
                                    campaignId={campaignId} 
                                    trigger={<Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 border shadow-md hover:bg-primary hover:text-primary-foreground"><Pencil className="h-4 w-4" /></Button>} 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <div className="bg-primary/5 rounded p-1.5 text-center border border-border/50">
                                    <span className="text-[8px] uppercase font-bold text-muted-foreground block">Punti Ferita</span>
                                    <span className="text-sm font-bold text-red-500">{char.hitPoints || '—'}</span>
                                </div>
                                <div className="bg-primary/5 rounded p-1.5 text-center border border-border/50">
                                    <span className="text-[8px] uppercase font-bold text-muted-foreground block">Classe Armatura</span>
                                    <span className="text-sm font-bold text-sky-500">{char.armorClass || '—'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-3">
                                {[
                                    { label: 'FOR', val: char.strength },
                                    { label: 'DES', val: char.dexterity },
                                    { label: 'COS', val: char.constitution },
                                    { label: 'INT', val: char.intelligence },
                                    { label: 'SAG', val: char.wisdom },
                                    { label: 'CAR', val: char.charisma }
                                ].map((s) => (
                                    <div key={s.label} className="bg-muted/30 rounded py-1 px-1 text-center border border-border/30">
                                        <span className="text-[7px] font-bold text-muted-foreground block leading-none mb-0.5">{s.label}</span>
                                        <span className="text-[11px] font-semibold leading-none">{s.val || '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <AccordionContent className="p-4 pt-4 border-t bg-muted/5 space-y-6">
                            {!!char.background && (
                                <div className="space-y-1">
                                    <span className="text-[9px] font-bold uppercase text-primary/70 flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" /> Background</span>
                                    <p className="text-xs text-muted-foreground italic leading-relaxed text-left">{char.background}</p>
                                </div>
                            )}

                            {!!char.spells && (
                                <div className="space-y-1">
                                    <span className="text-[9px] font-bold uppercase text-accent/70 flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Capacità e Magie</span>
                                    <div className="text-xs text-foreground/80 leading-relaxed text-left whitespace-pre-wrap">{char.spells}</div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {!!char.traits && (
                                    <div className="bg-primary/5 p-2 rounded-md border border-primary/10">
                                        <span className="text-[9px] font-bold uppercase text-primary/70 flex items-center gap-1"><Fingerprint className="h-2.5 w-2.5" /> Tratti</span>
                                        <p className="text-[11px] italic text-left leading-tight text-muted-foreground">"{char.traits}"</p>
                                    </div>
                                )}
                                {!!char.ideals && (
                                    <div className="bg-accent/5 p-2 rounded-md border border-accent/10">
                                        <span className="text-[9px] font-bold uppercase text-accent/70 flex items-center gap-1"><Star className="h-2.5 w-2.5" /> Ideale</span>
                                        <p className="text-[11px] italic text-left leading-tight text-muted-foreground">"{char.ideals}"</p>
                                    </div>
                                )}
                                {!!char.bonds && (
                                    <div className="bg-emerald-500/5 p-2 rounded-md border border-emerald-500/10">
                                        <span className="text-[9px] font-bold uppercase text-emerald-500/70 flex items-center gap-1"><Heart className="h-2.5 w-2.5" /> Legame</span>
                                        <p className="text-[11px] italic text-left leading-tight text-muted-foreground">"{char.bonds}"</p>
                                    </div>
                                )}
                                {!!char.flaws && (
                                    <div className="bg-destructive/5 p-2 rounded-md border border-destructive/10">
                                        <span className="text-[9px] font-bold uppercase text-destructive/70 flex items-center gap-1"><Target className="h-2.5 w-2.5" /> Difetto</span>
                                        <p className="text-[11px] italic text-left leading-tight text-muted-foreground">"{char.flaws}"</p>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase text-primary"><History className="h-4 w-4" /> Cronaca delle Gesta</h4>
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold" onClick={() => viewingHistory === char.id ? setViewingHistory(null) : loadHistory(char.id)}>
                                        {viewingHistory === char.id ? "Chiudi" : "Espandi Diario"}
                                    </Button>
                                </div>
                                
                                {viewingHistory === char.id && (
                                    <ScrollArea className="h-48 rounded-lg bg-background/50 border p-3">
                                        {isLoadingHistory ? (
                                            <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5" /></div>
                                        ) : historyData.length > 0 ? (
                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                <SortableContext items={historyData.map(h => h.id)} strategy={verticalListSortingStrategy}>
                                                    <div className="space-y-1">
                                                        {historyData.map((ev) => (
                                                            <SortablePcHistoryItem key={ev.id} ev={ev} />
                                                        ))}
                                                    </div>
                                                </SortableContext>
                                            </DndContext>
                                        ) : (
                                            <p className="text-center text-[10px] text-muted-foreground py-10 italic">Nessun evento registrato per questo eroe.</p>
                                        )}
                                    </ScrollArea>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
