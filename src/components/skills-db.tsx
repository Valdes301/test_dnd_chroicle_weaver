'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, PlusCircle, Plus, Trash2, Pencil, ChevronDown, CheckCircle } from 'lucide-react';
import type { Skill } from '@/lib/types';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';

const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Il nome è obbligatorio."),
  ability: z.string().optional(),
  description: z.string().optional(),
});

type SkillFormData = z.infer<typeof skillSchema>;

function SkillFormDialog({ skill, campaignId, trigger, onSave }: { skill?: Partial<Skill>, campaignId: string, trigger: React.ReactNode, onSave: (data: SkillFormData & { campaignId: string }) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const formId = useId();

    const form = useForm<SkillFormData>({
        resolver: zodResolver(skillSchema),
        defaultValues: {
            id: skill?.id,
            name: skill?.name ?? '',
            ability: skill?.ability ?? '',
            description: skill?.description ?? '',
        },
    });
     
    useEffect(() => {
        if(isOpen) {
            form.reset({
                id: skill?.id,
                name: skill?.name ?? '',
                ability: skill?.ability ?? '',
                description: skill?.description ?? '',
            });
        }
    }, [isOpen, skill, form]);

    const handleSubmit = async (values: SkillFormData) => {
        await onSave({ ...values, campaignId });
        setIsOpen(false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="grid grid-rows-[auto_1fr_auto] max-h-[90vh] p-0">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle>{skill?.id ? 'Modifica Abilità' : 'Nuova Abilità'}</DialogTitle>
                    <DialogDescription>Inserisci i dettagli per la tua abilità personalizzata.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="px-6 border-y">
                <Form {...form}>
                    <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="ability" render={({ field }) => (<FormItem><FormLabel>Caratteristica Associata</FormLabel><FormControl><Input placeholder="es. Destrezza, Saggezza..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrizione</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
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

interface SkillsDbProps {
    skills: Skill[];
    campaignId: string;
    possessedItems: string[];
    onSave: (skill: Partial<Skill> & { campaignId: string }) => void;
    onDelete: (id: string) => void;
    onTogglePossession: (itemName: string) => void;
}

export function SkillsDb({ skills, campaignId, possessedItems, onSave, onDelete, onTogglePossession }: SkillsDbProps) {
  const [search, setSearch] = useState('');
  
  const filteredSkills = useMemo(() => {
    const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
    if (!search) return sorted;
    const lowerCaseSearch = search.toLowerCase();
    return sorted.filter(skill =>
        skill.name.toLowerCase().includes(lowerCaseSearch) ||
        (skill.ability?.toLowerCase() ?? '').includes(lowerCaseSearch) ||
        (skill.description?.toLowerCase() ?? '').includes(lowerCaseSearch)
    );
  }, [skills, search]);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
            <Input
              placeholder="Cerca un'abilità..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <SkillFormDialog
                campaignId={campaignId}
                onSave={onSave}
                trigger={<Button size="icon" className="shrink-0"><Plus className="h-4 w-4" /><span className="sr-only">Aggiungi Abilità</span></Button>}
            />
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {filteredSkills.map((skill) => (
            <AccordionItem value={skill.name} key={skill.name}>
              <AccordionPrimitive.Header className="flex items-center">
                <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-4 font-medium text-left transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="break-words pr-2">{skill.name}</span>
                    {skill.source === 'created' && <Badge variant="secondary"><PlusCircle className="h-3 w-3 mr-1"/>Creata</Badge>}
                    {skill.ability && <Badge variant="secondary" className="flex-shrink-0 justify-self-end">{skill.ability}</Badge>}
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
                            e.stopPropagation();
                            onTogglePossession(skill.name);
                        }}
                    >
                        <CheckCircle className={cn('h-5 w-5', possessedItems.includes(skill.name) ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground/80')} />
                    </Button>
                    <SkillFormDialog skill={skill} campaignId={campaignId} onSave={onSave}
                        trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /><span className="sr-only">Modifica</span></Button>}
                    />
                </div>
              </AccordionPrimitive.Header>
              <AccordionContent>
                    <div className="prose prose-sm prose-invert max-w-none">
                        <p>{skill.description}</p>
                    </div>
                    {skill.source === 'created' && skill.id && (
                        <div className="mt-4 flex justify-end">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Elimina Abilità</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Sei sicuro?</AlertDialogTitle><AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(skill.id!)}>Elimina</AlertDialogAction>
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
