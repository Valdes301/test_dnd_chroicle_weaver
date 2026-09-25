
'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Badge } from '@/components/ui/badge';
import { Skull, PlusCircle, Plus, Pencil, Trash2, ChevronDown, CheckCircle, ImagePlus, Loader2, Filter } from 'lucide-react';
import type { Monster } from '@/lib/types';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Textarea } from './ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import * as actions from '@/lib/actions';
import Image from 'next/image';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { MarkdownRenderer } from './ui/markdown-renderer';

const DetailItem = ({ label, value }: { label: string, value?: React.ReactNode }) => {
    if (!value) return null;
    return <p><strong>{label}:</strong> {String(value)}</p>;
}

const monsterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Il nome è obbligatorio."),
  type: z.string().optional(),
  armorClass: z.string().optional(),
  hitPoints: z.string().optional(),
  challenge: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
});

export type MonsterFormData = z.infer<typeof monsterSchema>;

export function MonsterFormDialog({ monster, campaignId, trigger, onSave }: { monster?: Partial<Monster>, campaignId: string, trigger: React.ReactNode, onSave: (data: MonsterFormData & { campaignId: string }) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const formId = useId();
    const { toast } = useToast();

    const form = useForm<MonsterFormData>({
        resolver: zodResolver(monsterSchema),
        defaultValues: {
            id: monster?.id,
            name: monster?.name ?? '',
            type: monster?.type ?? '',
            armorClass: monster?.armorClass ?? '',
            hitPoints: monster?.hitPoints ?? '',
            challenge: monster?.challenge ?? '',
            description: monster?.description ?? '',
            imageUrl: monster?.imageUrl ?? '',
        },
    });
     
    useEffect(() => {
        if(isOpen) {
            form.reset({
                id: monster?.id,
                name: monster?.name ?? '',
                type: monster?.type ?? '',
                armorClass: monster?.armorClass ?? '',
                hitPoints: monster?.hitPoints ?? '',
                challenge: monster?.challenge ?? '',
                description: monster?.description ?? '',
                imageUrl: monster?.imageUrl ?? '',
            });
        }
    }, [isOpen, monster, form]);

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
                toast({ title: "Immagine caricata!" });
            } else {
                toast({ variant: 'destructive', title: "Errore caricamento", description: result.error });
            }
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (values: MonsterFormData) => {
        await onSave({ ...values, campaignId });
        setIsOpen(false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="grid grid-rows-[auto_1fr_auto] max-h-[90vh] p-0 sm:max-w-xl">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle>{monster?.id ? 'Modifica Mostro' : 'Nuovo Mostro'}</DialogTitle>
                    <DialogDescription>Inserisci le statistiche per il tuo mostro personalizzato.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="px-6 border-y">
                <Form {...form}>
                    <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 space-y-4">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Tipo</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <div className="w-full sm:w-32 space-y-2">
                                <Label>Immagine</Label>
                                <div className="relative aspect-square bg-muted rounded-md overflow-hidden border border-dashed flex items-center justify-center group">
                                    {form.watch('imageUrl') ? (
                                        <Image src={form.watch('imageUrl')!} alt="Anteprima" fill className="object-cover" />
                                    ) : (
                                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                                    )}
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isUploading} />
                                    {isUploading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
                                </div>
                                <Button variant="link" size="sm" className="p-0 h-auto text-[10px] w-full text-center" onClick={() => form.setValue('imageUrl', '')}>Rimuovi</Button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="armorClass" render={({ field }) => (<FormItem><FormLabel>CA</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="hitPoints" render={({ field }) => (<FormItem><FormLabel>PF</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="challenge" render={({ field }) => (<FormItem><FormLabel>GS</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrizione</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </form>
                </Form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-4">
                     <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Annulla</Button>
                    <Button type="submit" form={formId} disabled={form.formState.isSubmitting || isUploading}>{form.formState.isSubmitting ? 'Salvataggio...' : 'Salva'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface MonstersDbProps {
    monsters: Monster[];
    campaignId: string;
    possessedItems: string[];
    onSave: (monster: Partial<Monster> & { campaignId: string }) => void;
    onDelete: (id: string) => void;
    onTogglePossession: (itemName: string) => void;
}

export function MonstersDb({ monsters, campaignId, possessedItems, onSave, onDelete, onTogglePossession }: MonstersDbProps) {
  const [monsterSearch, setMonsterSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);

  // Estrai tipi e gradi di sfida unici dai mostri presenti
  const allTypes = useMemo(() => {
    const typeSet = new Set<string>();
    monsters.forEach(m => {
        if (m.type) {
            const trimmed = m.type.trim();
            if (trimmed) typeSet.add(trimmed);
        }
    });
    return Array.from(typeSet).sort();
  }, [monsters]);

  const allChallenges = useMemo(() => {
    const challengeSet = new Set<string>();
    monsters.forEach(m => {
        if (m.challenge) {
            challengeSet.add(m.challenge.trim());
        }
    });
    return Array.from(challengeSet).sort((a, b) => {
        const parseCh = (val: string) => {
            if (val.includes('/')) {
                const parts = val.split('/');
                return parseFloat(parts[0]) / parseFloat(parts[1]);
            }
            return parseFloat(val);
        };
        return parseCh(a) - parseCh(b);
    });
  }, [monsters]);

  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleChallengeToggle = (challenge: string) => {
    setSelectedChallenges(prev => 
      prev.includes(challenge) ? prev.filter(c => c !== challenge) : [...prev, challenge]
    );
  };

  const filteredMonsters = useMemo(() => {
    let items = [...monsters];

    if (selectedTypes.length > 0) {
        items = items.filter(m => m.type && selectedTypes.includes(m.type.trim()));
    }

    if (selectedChallenges.length > 0) {
        items = items.filter(m => m.challenge && selectedChallenges.includes(m.challenge.trim()));
    }

    if (monsterSearch) {
      const lowerCaseSearch = monsterSearch.toLowerCase();
      items = items.filter(monster =>
        monster.name.toLowerCase().includes(lowerCaseSearch) ||
        (monster.type?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
        (monster.challenge?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
        (monster.description?.toLowerCase() ?? '').includes(lowerCaseSearch)
      );
    }

    return items;
  }, [monsterSearch, monsters, selectedTypes, selectedChallenges]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center gap-4">
            <Input
              placeholder="Cerca un mostro per nome, tipo o grado di sfida..."
              value={monsterSearch}
              onChange={(e) => setMonsterSearch(e.target.value)}
              className="flex-1"
            />
            <MonsterFormDialog
                campaignId={campaignId}
                onSave={onSave}
                trigger={<Button size="icon" className="shrink-0"><Plus className="h-4 w-4" /><span className="sr-only">Aggiungi Mostro</span></Button>}
            />
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-4 mt-2 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold">
                <Filter className="mr-2 h-3.5 w-3.5" /> Tipo
                {selectedTypes.length > 0 && <Badge variant="secondary" className="ml-2 h-4 px-1">{selectedTypes.length}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filtra per Tipo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                {allTypes.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={selectedTypes.includes(type)}
                    onSelect={(e) => { e.preventDefault(); handleTypeToggle(type); }}
                  >
                    {type}
                  </DropdownMenuCheckboxItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold">
                <Filter className="mr-2 h-3.5 w-3.5" /> Grado di Sfida (GS)
                {selectedChallenges.length > 0 && <Badge variant="secondary" className="ml-2 h-4 px-1">{selectedChallenges.length}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filtra per GS</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                {allChallenges.map(challenge => (
                  <DropdownMenuCheckboxItem
                    key={challenge}
                    checked={selectedChallenges.includes(challenge)}
                    onSelect={(e) => { e.preventDefault(); handleChallengeToggle(challenge); }}
                  >
                    GS {challenge}
                  </DropdownMenuCheckboxItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {filteredMonsters.map((monster) => (
            <AccordionItem value={monster.name} key={monster.name}>
              <AccordionPrimitive.Header className="flex items-center">
                <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-4 font-medium text-left transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-2 flex-wrap">
                      <span className="break-words pr-2">{monster.name}</span>
                      {monster.source === 'created' && <Badge variant="secondary"><PlusCircle className="h-3 w-3 mr-1"/>Creato</Badge>}
                      {monster.challenge && <Badge variant="outline">GS {monster.challenge}</Badge>}
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
                <div className="flex items-center pl-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Segna come incontrato"
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePossession(monster.name);
                        }}
                    >
                        <CheckCircle className={cn('h-5 w-5', possessedItems.includes(monster.name) ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground/80')} />
                    </Button>
                    <MonsterFormDialog monster={monster} campaignId={campaignId} onSave={onSave}
                        trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /><span className="sr-only">Modifica</span></Button>}
                    />
                </div>
              </AccordionPrimitive.Header>
              <AccordionContent>
                <div className="flex flex-col sm:flex-row gap-6">
                    {monster.imageUrl && (
                        <div className="relative w-full sm:w-64 aspect-video rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                            <Image src={monster.imageUrl} alt={monster.name} fill className="object-cover" />
                        </div>
                    )}
                    <div className="prose prose-sm prose-invert max-w-none flex-grow">
                        <DetailItem label="Tipo" value={monster.type} />
                        <DetailItem label="Classe Armatura" value={monster.armorClass} />
                        <DetailItem label="Punti Ferita" value={monster.hitPoints} />
                        <Separator className="my-2"/>
                        <MarkdownRenderer content={monster.description} className="text-sm font-serif" />
                    </div>
                </div>
                {monster.source === 'created' && monster.id && (
                    <div className="mt-4 flex justify-end">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Elimina Mostro</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Sei sicuro?</AlertDialogTitle><AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(monster.id!)}>Elimina</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
