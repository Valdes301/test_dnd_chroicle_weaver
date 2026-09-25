
'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Badge } from '@/components/ui/badge';
import { Sparkles, PlusCircle, Plus, Pencil, Trash2, ChevronDown, CheckCircle, Filter, ArrowUp, Coins, ImagePlus, Upload, Sword, Gem, Heart, Beaker, Shield, Zap, Loader2, X, Trophy } from 'lucide-react';
import type { MagicItem, TechType } from '@/lib/types';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Textarea } from './ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import Image from 'next/image';
import * as actions from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { MarkdownRenderer } from './ui/markdown-renderer';

const DetailItem = ({ label, value }: { label: string, value?: React.ReactNode }) => {
    if (!value) return null;
    return <p><strong>{label}:</strong> {String(value)}</p>;
}

const magicItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Il nome è obbligatorio."),
  type: z.string().min(1, "Il tipo è obbligatorio."),
  rarity: z.string().min(1, "La rarità è obbligatoria."),
  attunement: z.string().optional(),
  description: z.string().min(1, "La descrizione è obbligatoria."),
  cost: z.string().optional(),
  damage: z.string().optional().nullable(),
  techType: z.enum(['damage', 'defense', 'cure', 'alchemy', 'charges', 'reward', 'none']).optional(),
  imageUrl: z.string().optional().nullable(),
  source: z.enum(['base', 'created']).optional().default('created'),
});

export type MagicItemFormData = z.infer<typeof magicItemSchema>;

const TechTypeSelector = ({ value, onChange }: { value?: TechType, onChange: (val: TechType) => void }) => {
    const options = [
        { id: 'damage', icon: Sword, label: 'Danno' },
        { id: 'defense', icon: Shield, label: 'Difesa' },
        { id: 'cure', icon: Heart, label: 'Cura' },
        { id: 'alchemy', icon: Beaker, label: 'Pozione' },
        { id: 'charges', icon: Zap, label: 'Cariche' },
        { id: 'reward', icon: Trophy, label: 'Premio' },
        { id: 'none', icon: X, label: 'Nessuna' },
    ];

    return (
        <div className="flex flex-wrap gap-2 pt-1">
            {options.map((opt) => (
                <Button
                    key={opt.id}
                    type="button"
                    variant={value === opt.id ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 px-2 flex gap-1.5"
                    onClick={() => onChange(opt.id as TechType)}
                >
                    <opt.icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase font-bold">{opt.label}</span>
                </Button>
            ))}
        </div>
    );
};

export function MagicItemFormDialog({ item, campaignId, trigger, onSave }: { item?: Partial<MagicItem>, campaignId: string, trigger: React.ReactNode, onSave: (data: Partial<MagicItem> & { campaignId: string }) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const formId = useId();
    const { toast } = useToast();

    const form = useForm<MagicItemFormData>({
        resolver: zodResolver(magicItemSchema),
        defaultValues: {
            id: item?.id,
            name: item?.name ?? '',
            type: item?.type ?? 'Oggetto meraviglioso',
            rarity: item?.rarity ?? 'Comune',
            attunement: item?.attunement ?? 'No',
            description: item?.description ?? '',
            cost: item?.cost ?? '',
            damage: item?.damage ?? '',
            techType: item?.techType ?? 'damage',
            imageUrl: item?.imageUrl ?? '',
            source: item?.source ?? 'created',
        },
    });

    useEffect(() => {
        if(isOpen) {
            form.reset({
                id: item?.id,
                name: item?.name ?? '',
                type: item?.type ?? 'Oggetto meraviglioso',
                rarity: item?.rarity ?? 'Comune',
                attunement: item?.attunement ?? 'No',
                description: item?.description ?? '',
                cost: item?.cost ?? '',
                damage: item?.damage ?? '',
                techType: item?.techType ?? 'damage',
                imageUrl: item?.imageUrl ?? '',
                source: item?.source ?? 'created',
            });
        }
    }, [isOpen, item, form]);

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

    const handleSubmit = async (values: MagicItemFormData) => {
        await onSave({ ...values, attunement: values.attunement ?? 'No', campaignId });
        setIsOpen(false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="grid grid-rows-[auto_1fr_auto] max-h-[90vh] p-0 sm:max-w-xl">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle>{item?.id ? 'Modifica Oggetto' : 'Nuovo Oggetto'}</DialogTitle>
                    <DialogDescription>Inserisci i dettagli del tuo oggetto personalizzato.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="px-6 border-y">
                    <Form {...form}>
                        <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1 space-y-4">
                                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Tipo</FormLabel><FormControl><Input placeholder="es. Oggetto meraviglioso, Pozione..." {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                            
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="rarity" render={({ field }) => (<FormItem><FormLabel>Rarità</FormLabel><FormControl><Input placeholder="es. Comune, Rara..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="cost" render={({ field }) => (<FormItem><FormLabel>Costo</FormLabel><FormControl><Input placeholder="es. 500 mo" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            </div>

                            <div className="p-4 bg-muted/30 rounded-lg space-y-4 border">
                                <FormField control={form.control} name="damage" render={({ field }) => (<FormItem><FormLabel>Danno / CA / Valore Tecnico</FormLabel><FormControl><Input placeholder="es. 1d8 tagliente, CA +1, 7 cariche..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                
                                <FormField control={form.control} name="techType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Natura dell'Effetto (Icona)</FormLabel>
                                        <FormControl>
                                            <TechTypeSelector value={field.value as any} onChange={field.onChange} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            
                            <FormField control={form.control} name="attunement" render={({ field }) => (<FormItem><FormLabel>Sintonia</FormLabel><FormControl><Input placeholder="es. Sì, No, Sì (da un mago)..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />

                            <FormField
                              control={form.control}
                              name="source"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Origine Oggetto</FormLabel>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant={field.value === 'created' ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => field.onChange('created')}
                                      className="flex-1 text-xs"
                                    >
                                      ✨ Creato / Custom (Homebrew)
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={field.value === 'base' ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => field.onChange('base')}
                                      className="flex-1 text-xs"
                                    >
                                      🛡️ Base / SRD (Standard)
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrizione</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
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

interface ItemsDbProps {
    magicItems: MagicItem[];
    campaignId: string;
    possessedItems: string[];
    onSaveItem: (item: Partial<MagicItem> & { campaignId: string }) => void;
    onDeleteItem: (id: string) => void;
    onTogglePossession: (itemName: string) => void;
}

const parseCost = (costString?: string | null): number => {
    if (!costString) return 0;
    const cleanedCost = costString.replace(/[,.]/g, '').toLowerCase();
    const value = parseInt(cleanedCost, 10);
    if (isNaN(value)) return 0;

    if (cleanedCost.includes('mo')) return value * 100;
    if (cleanedCost.includes('ma')) return value * 10;
    if (cleanedCost.includes('mr') || cleanedCost.includes('pc')) return value;
    
    return value * 100; // Default a mo se non specificato
};

const rarities = ["Comune", "Non comune", "Rara", "Molto rara", "Leggendaria", "Artefatto", "Varia"];
const rarityOrder = rarities;

const TechBadge = ({ value, type }: { value?: string | null, type?: TechType }) => {
    if (!value) return null;
    let Icon = Sword;
    let colorClass = "bg-rose-500/10 text-rose-500 border-rose-500/20";
    
    switch (type) {
        case 'defense': Icon = Shield; colorClass = "bg-sky-500/10 text-sky-500 border-sky-500/20"; break;
        case 'cure': Icon = Heart; colorClass = "bg-red-500/10 text-red-500 border-red-500/20"; break;
        case 'alchemy': Icon = Beaker; colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"; break;
        case 'charges': Icon = Zap; colorClass = "bg-amber-500/10 text-amber-500 border-amber-500/20"; break;
        case 'reward': Icon = Trophy; colorClass = "bg-amber-500/10 text-amber-500 border-amber-500/20"; break;
        case 'none': return null;
    }

    return (
        <Badge variant="secondary" className={cn("flex items-center gap-1", colorClass)}>
            <Icon className="h-3 w-3" />
            {value}
        </Badge>
    );
};

export function ItemsDb({ magicItems, campaignId, possessedItems, onSaveItem, onDeleteItem, onTogglePossession }: ItemsDbProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [showPossessed, setShowPossessed] = useState(false);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'base' | 'created'>('all');

  const handleRarityChange = (rarity: string) => {
    setSelectedRarities(prev => 
      prev.includes(rarity) 
        ? prev.filter(r => r !== rarity) 
        : [...prev, rarity]
    );
  };

  const filteredAndSortedItems = useMemo(() => {
    let items = [...magicItems];

    if (search) {
      const lowerCaseSearch = search.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(lowerCaseSearch) ||
        (item.type?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
        (item.rarity?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
        (item.description?.toLowerCase() ?? '').includes(lowerCaseSearch)
      );
    }
    
    if (showPossessed) {
        items = items.filter(item => possessedItems.includes(item.name));
    }

    if (selectedRarities.length > 0) {
        items = items.filter(item => selectedRarities.includes(item.rarity));
    }

    if (sourceFilter === 'base') {
      items = items.filter(item => item.source === 'base' || (!item.source && !item.campaignId));
    } else if (sourceFilter === 'created') {
      items = items.filter(item => item.source === 'created' || !!item.campaignId);
    }

    items.sort((a, b) => {
        switch (sortBy) {
            case 'cost-asc':
                return parseCost(a.cost) - parseCost(b.cost);
            case 'cost-desc':
                return parseCost(b.cost) - parseCost(a.cost);
            case 'rarity':
                return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
            case 'alphabetical':
            default:
                return a.name.localeCompare(b.name);
        }
    });

    return items;
  }, [search, magicItems, sortBy, showPossessed, selectedRarities, possessedItems, sourceFilter]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center gap-4">
            <Input
              placeholder="Cerca un oggetto per nome, rarità, tipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
             <MagicItemFormDialog
                campaignId={campaignId}
                onSave={onSaveItem}
                trigger={<Button size="icon" className="shrink-0"><Plus className="h-4 w-4" /><span className="sr-only">Aggiungi Oggetto</span></Button>}
            />
        </div>
        <div className="border-t pt-4 mt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0 text-[10px] uppercase font-bold">
                            <ArrowUp className="mr-2 h-3.5 w-3.5" /> Ordina: {
                                sortBy === 'alphabetical' ? 'Nome' :
                                sortBy === 'cost-asc' ? 'Costo Asc' :
                                sortBy === 'cost-desc' ? 'Costo Desc' : 'Rarità'
                            }
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                            <DropdownMenuRadioItem value="alphabetical">Nome (A-Z)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="rarity">Rarità</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="cost-asc">Costo (Crescente)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="cost-desc">Costo (Decrescente)</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0 text-[10px] uppercase font-bold">
                            <Filter className="mr-2 h-3.5 w-3.5" /> Rarità 
                            {selectedRarities.length > 0 && <Badge variant="secondary" className="ml-2 h-4 px-1">{selectedRarities.length}</Badge>}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Filtra Rarità</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {rarities.map(rarity => (
                            <DropdownMenuCheckboxItem key={rarity} checked={selectedRarities.includes(rarity)} onSelect={(e) => {e.preventDefault(); handleRarityChange(rarity);}}>
                                {rarity}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0 text-[10px] uppercase font-bold">
                            <Sparkles className="mr-2 h-3.5 w-3.5 text-amber-500" /> Origine: {
                                sourceFilter === 'all' ? 'Tutti' :
                                sourceFilter === 'base' ? 'Solo Base' : 'Solo Creati'
                            }
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuRadioGroup value={sourceFilter} onValueChange={(val) => setSourceFilter(val as any)}>
                            <DropdownMenuRadioItem value="all">Tutti gli Oggetti</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="base">🛡️ Solo Base (SRD)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="created">✨ Solo Creati (Custom)</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center space-x-2">
                    <Switch id="show-possessed" checked={showPossessed} onCheckedChange={setShowPossessed} className="scale-75" />
                    <Label htmlFor="show-possessed" className="flex items-center gap-2 cursor-pointer text-[10px] uppercase font-bold opacity-70">
                        Solo posseduti
                    </Label>
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {filteredAndSortedItems.map((item) => (
            <AccordionItem value={item.name} key={item.name}>
              <AccordionPrimitive.Header className="flex items-center">
                <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-4 font-medium text-left transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-2 flex-wrap">
                      <span className="break-words pr-2">{item.name}</span>
                      {(item.source === 'created' || !!item.campaignId) ? (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <PlusCircle className="h-3 w-3 mr-1"/>Creato
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 border-slate-700">
                          🛡️ Base
                        </Badge>
                      )}
                      <Badge variant="outline">{item.rarity}</Badge>
                      <TechBadge value={item.damage} type={item.techType as any} />
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
                <div className="flex items-center pl-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Segna come posseduto"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent accordion from toggling
                            onTogglePossession(item.name);
                        }}
                    >
                        <CheckCircle className={cn('h-5 w-5', possessedItems.includes(item.name) ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground/80')} />
                    </Button>
                    <MagicItemFormDialog item={item} campaignId={campaignId} onSave={onSaveItem}
                        trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /><span className="sr-only">Modifica</span></Button>}
                    />
                </div>
              </AccordionPrimitive.Header>
              <AccordionContent>
                <div className="flex flex-col sm:flex-row gap-6">
                    {item.imageUrl && (
                        <div className="relative w-full sm:w-48 aspect-square rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                        </div>
                    )}
                    <div className="prose prose-sm prose-invert max-w-none flex-grow">
                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem label="Tipo" value={item.type} />
                            <DetailItem label="Costo" value={item.cost} />
                            {item.damage && <DetailItem label="Effetto" value={item.damage} />}
                            {item.attunement && item.attunement !== "No" && <DetailItem label="Sintonia" value={item.attunement} />}
                        </div>
                        <Separator className="my-2" />
                        <MarkdownRenderer content={item.description} className="text-sm font-serif" />
                    </div>
                </div>
                {item.source === 'created' && item.id && (
                    <div className="mt-4 flex justify-end">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Elimina Oggetto</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Sei sicuro?</AlertDialogTitle><AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteItem(item.id!)}>Elimina</AlertDialogAction>
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
