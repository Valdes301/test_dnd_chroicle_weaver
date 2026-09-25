'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Badge } from '@/components/ui/badge';
import { Wand, PlusCircle, Plus, Pencil, Trash2, ChevronDown, CheckCircle, Filter } from 'lucide-react';
import type { Spell } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { MarkdownRenderer } from './ui/markdown-renderer';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const DetailItem = ({ label, value }: { label: string, value?: React.ReactNode }) => {
    if (!value) return null;
    return <p><strong>{label}:</strong> {String(value)}</p>;
}

const spellSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Il nome è obbligatorio."),
    level: z.string().optional(),
    school: z.string().optional(),
    casting_time: z.string().optional(),
    range: z.string().optional(),
    components: z.string().optional(),
    duration: z.string().optional(),
    description: z.string().optional(),
    classes: z.string().optional(),
});

type SpellFormData = z.infer<typeof spellSchema>;

function SpellFormDialog({ spell, campaignId, trigger, onSave }: { spell?: Partial<Spell>, campaignId: string, trigger: React.ReactNode, onSave: (data: SpellFormData & { campaignId: string }) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const formId = useId();

    const form = useForm<SpellFormData>({
        resolver: zodResolver(spellSchema),
        defaultValues: spell ? {
            ...spell,
            classes: spell.classes || '',
        } : {
            id: undefined,
            name: '',
            level: '',
            school: '',
            casting_time: '',
            range: '',
            components: '',
            duration: '',
            description: '',
            classes: '',
        },
    });

    useEffect(() => {
        if (isOpen) {
             form.reset(spell ? {
                ...spell,
                classes: spell.classes || '',
             } : {
                id: undefined,
                name: '',
                level: '',
                school: '',
                casting_time: '',
                range: '',
                components: '',
                duration: '',
                description: '',
                classes: '',
            });
        }
    }, [isOpen, spell, form]);

    const handleSubmit = async (values: SpellFormData) => {
        await onSave({ ...values, campaignId });
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="grid grid-rows-[auto_1fr_auto] max-h-[90vh] p-0">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle>{spell?.id ? 'Modifica Incantesimo' : 'Nuovo Incantesimo'}</DialogTitle>
                    <DialogDescription>Inserisci i dettagli del tuo incantesimo personalizzato.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="px-6 border-y">
                    <Form {...form}>
                        <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-2 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="level" render={({ field }) => (<FormItem><FormLabel>Livello</FormLabel><FormControl><Input placeholder="es. Trucchetto, 1° Livello..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="school" render={({ field }) => (<FormItem><FormLabel>Scuola</FormLabel><FormControl><Input placeholder="es. Invocazione, Illusione..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="casting_time" render={({ field }) => (<FormItem><FormLabel>Tempo di Lancio</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="range" render={({ field }) => (<FormItem><FormLabel>Gittata</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="components" render={({ field }) => (<FormItem><FormLabel>Componenti</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Durata</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="classes" render={({ field }) => (<FormItem><FormLabel>Classi</FormLabel><FormControl><Input placeholder="es. Mago, Stregone, Negromante..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrizione</FormLabel><FormControl><Textarea className="min-h-[100px]" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </form>
                    </Form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Annulla</Button>
                    <Button type="submit" form={formId} disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Salvataggio...' : 'Salva'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const getLevelNumber = (level?: string) => {
  if (!level) return 99;
  if (level === "Trucchetto") return 0;
  const num = parseInt(level, 10);
  return isNaN(num) ? 99 : num;
};

interface SpellsDbProps {
    spells: Spell[];
    campaignId: string;
    possessedItems: string[];
    onSave: (spell: Partial<Spell> & { campaignId: string }) => void;
    onDelete: (id: string) => void;
    onTogglePossession: (itemName: string) => void;
}

export function SpellsDb({ spells, campaignId, possessedItems, onSave, onDelete, onTogglePossession }: SpellsDbProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'level'>('alphabetical');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  const allClasses = useMemo(() => {
    const classSet = new Set<string>();
    spells.forEach(spell => {
        if (spell.classes) {
            spell.classes.split(',').forEach(c => {
                const trimmed = c.trim();
                if (trimmed) classSet.add(trimmed);
            });
        }
    });
    return Array.from(classSet).sort();
  }, [spells]);

  const allLevels = useMemo(() => {
    const levelSet = new Set<string>();
    spells.forEach(spell => {
        if (spell.level) {
            levelSet.add(spell.level.trim());
        }
    });
    return Array.from(levelSet).sort((a, b) => getLevelNumber(a) - getLevelNumber(b));
  }, [spells]);

  const handleClassChange = (cls: string) => {
    setSelectedClasses(prev =>
      prev.includes(cls)
        ? prev.filter(c => c !== cls)
        : [...prev, cls]
    );
  };

  const handleLevelChange = (lvl: string) => {
    setSelectedLevels(prev =>
      prev.includes(lvl)
        ? prev.filter(l => l !== lvl)
        : [...prev, lvl]
    );
  };

  const sortedAndFilteredSpells = useMemo(() => {
    let filtered = [...spells];

    if (selectedClasses.length > 0) {
        filtered = filtered.filter(spell => {
            if (!spell.classes) return false;
            const spellClasses = spell.classes.split(',').map(c => c.trim());
            return selectedClasses.some(selectedCls => spellClasses.includes(selectedCls));
        });
    }

    if (selectedLevels.length > 0) {
        filtered = filtered.filter(spell => {
            if (!spell.level) return false;
            return selectedLevels.includes(spell.level.trim());
        });
    }

    if (search) {
      const lowerCaseSearch = search.toLowerCase();
      filtered = filtered.filter(spell =>
          spell.name.toLowerCase().includes(lowerCaseSearch) ||
          (spell.school?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
          (spell.level?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
          (spell.description?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
          (spell.classes?.toLowerCase() ?? '').includes(lowerCaseSearch)
        );
    }

    if (sortBy === 'level') {
      filtered.sort((a, b) => {
        const levelA = getLevelNumber(a.level);
        const levelB = getLevelNumber(b.level);
        if (levelA !== levelB) {
          return levelA - levelB;
        }
        return a.name.localeCompare(b.name);
      });
    } else { // alphabetical
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [search, spells, sortBy, selectedClasses]);

  const getLevelBadge = (level?: string) => {
      if (!level) return null;
      if (level === "Trucchetto") return <Badge variant="outline">{level}</Badge>;
      return <Badge>{level}</Badge>
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center gap-4">
            <Input
              placeholder="Cerca una magia per nome, scuola, livello o classe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
             <SpellFormDialog
                campaignId={campaignId}
                onSave={onSave}
                trigger={<Button size="icon" className="shrink-0"><Plus className="h-4 w-4" /><span className="sr-only">Aggiungi Incantesimo</span></Button>}
            />
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-4 mt-2 border-t">
          <div className="flex items-center space-x-2">
            <Label className="text-[10px] uppercase font-bold opacity-60">Ordina:</Label>
            <RadioGroup
              value={sortBy}
              onValueChange={(value) => setSortBy(value as 'alphabetical' | 'level')}
              className="flex items-center"
            >
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="alphabetical" id="alpha" className="scale-75" />
                <Label htmlFor="alpha" className="text-[10px] uppercase font-medium cursor-pointer">A-Z</Label>
              </div>
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="level" id="level" className="scale-75" />
                <Label htmlFor="level" className="text-[10px] uppercase font-medium cursor-pointer">Livello</Label>
              </div>
            </RadioGroup>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold">
                <Filter className="mr-2 h-3.5 w-3.5" /> Classe
                {selectedClasses.length > 0 && <Badge variant="secondary" className="ml-2 h-4 px-1">{selectedClasses.length}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filtra per Classe</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                {allClasses.map(cls => (
                  <DropdownMenuCheckboxItem
                    key={cls}
                    checked={selectedClasses.includes(cls)}
                    onSelect={(e) => { e.preventDefault(); handleClassChange(cls); }}
                  >
                    {cls}
                  </DropdownMenuCheckboxItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold">
                <Filter className="mr-2 h-3.5 w-3.5" /> Livello
                {selectedLevels.length > 0 && <Badge variant="secondary" className="ml-2 h-4 px-1">{selectedLevels.length}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filtra per Livello</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                {allLevels.map(lvl => (
                  <DropdownMenuCheckboxItem
                    key={lvl}
                    checked={selectedLevels.includes(lvl)}
                    onSelect={(e) => { e.preventDefault(); handleLevelChange(lvl); }}
                  >
                    {lvl}
                  </DropdownMenuCheckboxItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {sortedAndFilteredSpells.map((spell) => (
            <AccordionItem value={spell.name} key={spell.name}>
              <AccordionPrimitive.Header className="flex items-center">
                <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-4 font-medium text-left transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-2 flex-wrap">
                      <span className="break-words pr-2">{spell.name}</span>
                      {spell.source === 'created' && <Badge variant="secondary"><PlusCircle className="h-3 w-3 mr-1"/>Creato</Badge>}
                      {getLevelBadge(spell.level)}
                      {spell.school && <Badge variant="secondary" className="hidden sm:inline-flex">{spell.school}</Badge>}
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
                <div className="flex items-center pl-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Segna come conosciuto"
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePossession(spell.name);
                        }}
                    >
                        <CheckCircle className={cn('h-5 w-5', possessedItems.includes(spell.name) ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground/80')} />
                    </Button>
                    <SpellFormDialog spell={spell} campaignId={campaignId} onSave={onSave}
                        trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /><span className="sr-only">Modifica</span></Button>}
                    />
                </div>
              </AccordionPrimitive.Header>
              <AccordionContent>
                    <div className="prose prose-sm prose-invert max-w-none">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <DetailItem label="Livello" value={spell.level} />
                          <DetailItem label="Scuola" value={spell.school} />
                          <DetailItem label="Tempo di Lancio" value={spell.casting_time} />
                          <DetailItem label="Gittata" value={spell.range} />
                          <DetailItem label="Componenti" value={spell.components} />
                          <DetailItem label="Durata" value={spell.duration} />
                        </div>
                        <DetailItem label="Classi" value={spell.classes} />
                        <Separator className="my-2"/>
                        <MarkdownRenderer content={spell.description} className="text-sm text-foreground/90 leading-relaxed font-serif" />
                    </div>
                    {spell.source === 'created' && spell.id && (
                        <div className="mt-4 flex justify-end">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Elimina Incantesimo</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Sei sicuro?</AlertDialogTitle><AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(spell.id!)}>Elimina</AlertDialogAction>
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
