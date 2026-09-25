'use client';

import { useState, useEffect } from 'react';
import type { HomebrewRule, CampaignWithRelations } from '@/lib/types';
import * as actions from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
    Plus, 
    Trash2, 
    Pencil, 
    Save, 
    Beaker, 
    ScrollText, 
    Loader2, 
    Info,
    Brain,
    ShieldAlert,
    History,
    Code2,
    RotateCcw,
    Sparkles,
    Check,
    BookMarked,
    Users,
    Compass,
    Swords,
    Store,
    Coins,
    LibraryBig,
    BookOpen,
    Beer,
    FileSearch
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from './ui/markdown-renderer';

type HomebrewCompendiumProps = {
  campaign: CampaignWithRelations;
};

const categories = ['Meccaniche', 'Ambientazione', 'Mostri', 'Oggetti', 'Economia', 'Generale'];

const PROMPT_ICONS: Record<string, any> = {
  'lore-gen': BookMarked,
  'story-gen': ScrollText,
  'npc-gen': Users,
  'world-gen': Compass,
  'combat-gen': Swords,
  'shop-gen': Store,
  'treasure-gen': Coins,
  'catalog-gen': LibraryBig,
  'summary-campaign': BookOpen,
  'summary-arc': BookOpen,
  'improv-gen': Beer,
  'extract-gen': FileSearch,
};

export function HomebrewCompendium({ campaign }: HomebrewCompendiumProps) {
  const [rules, setRules] = useState<HomebrewRule[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [tempTitle, setTempTitle] = useState('');
  const [tempContent, setTempContent] = useState('');
  const [tempCategory, setTempCategory] = useState('Generale');
  const [isSaving, setIsSaving] = useState(false);

  // State per editing system prompts
  const [editingPromptSlug, setEditingPromptSlug] = useState<string | null>(null);
  const [tempPromptContent, setTempPromptContent] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rulesRes, promptsRes] = await Promise.all([
          actions.getHomebrewRules(campaign.id),
          actions.getAllSystemPrompts()
      ]);
      
      if (rulesRes.success && rulesRes.data) setRules(rulesRes.data);
      if (promptsRes.success && promptsRes.data) setSystemPrompts(promptsRes.data);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaign.id]);

  const handleStartCreate = () => {
    setIsCreating(true);
    setIsEditingId(null);
    setTempTitle('');
    setTempContent('');
    setTempCategory('Generale');
  };

  const handleStartEdit = (rule: HomebrewRule) => {
    setIsEditingId(rule.id);
    setIsCreating(false);
    setTempTitle(rule.title);
    setTempContent(rule.content);
    setTempCategory(rule.category);
  };

  const handleSave = async (id?: string) => {
    if (!tempTitle.trim() || !tempContent.trim()) {
      toast({ variant: 'destructive', title: "Dati mancanti", description: "Inserisci un titolo e il contenuto." });
      return;
    }

    setIsSaving(true);
    try {
      const res = await actions.saveHomebrewRule({
        id,
        campaignId: campaign.id,
        title: tempTitle,
        content: tempContent,
        category: tempCategory,
        isActive: true
      });

      if (res.success) {
        toast({ title: id ? "Regola aggiornata" : "Regola aggiunta" });
        setIsCreating(false);
        setIsEditingId(null);
        loadData();
        router.refresh();
      } else throw new Error(res.error || 'Errore durante il salvataggio');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Errore", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await actions.deleteHomebrewRule(id);
    if (res.success) {
      toast({ title: "Regola rimossa" });
      loadData();
      router.refresh();
    }
  };

  const handleToggleActive = async (id: string) => {
    const res = await actions.toggleHomebrewRule(id);
    if (res.success) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
        toast({ title: "Stato regola aggiornato" });
        router.refresh();
    }
  };

  const handleStartEditPrompt = (prompt: any) => {
      setEditingPromptSlug(prompt.slug);
      setTempPromptContent(prompt.content);
  };

  const handleSavePrompt = async () => {
      if (!editingPromptSlug) return;
      setIsSavingPrompt(true);
      try {
          const res = await actions.updateSystemPrompt(editingPromptSlug, tempPromptContent);
          if (res.success) {
              toast({ title: "Istruzioni IA aggiornate!" });
              setEditingPromptSlug(null);
              loadData();
          } else throw new Error(res.error || 'Errore aggiornamento istruzioni');
      } catch (e: any) {
          toast({ variant: 'destructive', title: "Errore", description: e.message });
      } finally {
          setIsSavingPrompt(false);
      }
  };

  const handleResetPrompt = async (slug: string) => {
      try {
          const res = await actions.resetSystemPrompt(slug);
          if (res.success) {
              toast({ title: "Istruzioni ripristinate al default." });
              loadData();
          }
      } catch (e: any) {
          toast({ variant: 'destructive', title: "Errore", description: e.message });
      }
  };

  return (
    <div className="space-y-8">
      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="rules">Regole Personalizzate</TabsTrigger>
            <TabsTrigger value="ai-brain">Cervello dell'IA</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6 pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <span>Le regole attive vengono inviate all'IA prima di ogni generazione.</span>
                </div>
                <Button onClick={handleStartCreate} size="sm" className="gap-2 shadow-lg shadow-primary/20 shrink-0 uppercase text-[10px] font-bold">
                    <Plus className="h-4 w-4" /> Nuova Regola
                </Button>
            </div>

            {(isCreating || isEditingId) && (
                <Card className="border-primary/40 bg-primary/5 animate-in fade-in slide-in-from-top-4">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl">
                            {isCreating ? "Plasma una nuova regola" : "Rifinisci la regola"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Titolo</Label>
                                <Input value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} placeholder="es. Critici Devastanti" />
                            </div>
                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Select value={tempCategory} onValueChange={setTempCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Descrizione (Cosa deve sapere l'IA?)</Label>
                            <Textarea 
                                value={tempContent} 
                                onChange={(e) => setTempContent(e.target.value)} 
                                placeholder="Esempio: In questo mondo le monete d'oro sono rare, la valuta base è il bronzo..."
                                className="min-h-[120px]"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setIsCreating(false); setIsEditingId(null); }}>Annulla</Button>
                        <Button size="sm" onClick={() => handleSave(isEditingId || undefined)} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>}
                            Salva Regola
                        </Button>
                    </CardFooter>
                </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rules.map((rule) => (
                    <Card key={rule.id} className={cn("group transition-all", !rule.isActive && "opacity-60 grayscale-[0.5]")}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="text-[9px] uppercase">{rule.category}</Badge>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(rule)}><Pencil className="h-3 w-3"/></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rule.id)}><Trash2 className="h-3 w-3"/></Button>
                                </div>
                            </div>
                            <CardTitle className="font-headline text-lg line-clamp-1">{rule.title}</CardTitle>
                        </CardHeader>
                        <CardContent><p className="text-xs text-muted-foreground line-clamp-3 italic">"{rule.content}"</p></CardContent>
                        <CardFooter className="pt-2 border-t bg-muted/5 flex justify-between py-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest">{rule.isActive ? <span className="text-accent">● Attiva</span> : "Inattiva"}</span>
                            <Switch checked={!!rule.isActive} onCheckedChange={() => handleToggleActive(rule.id)} className="scale-75" />
                        </CardFooter>
                    </Card>
                ))}
                {rules.length === 0 && !isCreating && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed rounded-xl opacity-30">
                        <ScrollText className="h-12 w-12 mx-auto mb-4" />
                        <p>Nessuna regola personalizzata. Clicca su "Nuova Regola" per iniziare.</p>
                    </div>
                )}
            </div>
        </TabsContent>

        <TabsContent value="ai-brain" className="pt-6 space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
                {/* MEMORIA ATTIVA */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
                            <Brain className="h-4 w-4" /> Memoria Attiva (Sessioni)
                        </CardTitle>
                        <CardDescription className="text-[11px]">Il riassunto che Gemini usa per la coerenza tra le sessioni.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[120px] border rounded-lg bg-background/50 p-3">
                            <MarkdownRenderer 
                                content={campaign.summary || "Nessuna memoria inizializzata. Genera un sommario nella Dashboard."} 
                                className="text-[11px] text-muted-foreground leading-relaxed italic"
                            />
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* COMPENDIO GLOBALE */}
                <Card className="border-accent/20 bg-accent/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
                            <History className="h-4 w-4" /> Memoria Storica (Archi)
                        </CardTitle>
                        <CardDescription className="text-[11px]">I fatti epici del passato distillati dai volumi in biblioteca.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[120px] border rounded-lg bg-background/50 p-3">
                            <MarkdownRenderer 
                                content={campaign.global_compendium || "Nessun arco narrativo archiviato nella Biblioteca."} 
                                className="text-[11px] text-muted-foreground leading-relaxed"
                            />
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* DIRETTIVE DI SISTEMA EDITABILI */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Code2 className="h-4 w-4" /> Personalità degli Strumenti IA
                    </h4>
                    <span className="text-[9px] text-muted-foreground italic">Modifica come l'IA interpreta ogni tool</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {systemPrompts.map((p) => {
                        const isEditing = editingPromptSlug === p.slug;
                        const IconComponent = PROMPT_ICONS[p.slug] || Code2;
                        return (
                            <Card key={p.slug} className={cn("bg-muted/10 transition-all", isEditing && "col-span-full ring-2 ring-primary bg-background shadow-2xl")}>
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                                            <IconComponent className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                                            <span>{p.title}</span>
                                        </CardTitle>
                                        <div className="flex gap-1">
                                            {isEditing ? (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={handleSavePrompt} disabled={isSavingPrompt}>
                                                        {isSavingPrompt ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Check className="h-4 w-4"/>}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEditingPromptSlug(null)}>
                                                        <X className="h-4 w-4"/>
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/60" onClick={() => handleResetPrompt(p.slug)} title="Ripristina Default">
                                                        <RotateCcw className="h-3.5 w-3.5"/>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEditPrompt(p)}>
                                                        <Pencil className="h-3.5 w-3.5"/>
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    {isEditing ? (
                                        <Textarea 
                                            value={tempPromptContent} 
                                            onChange={(e) => setTempPromptContent(e.target.value)} 
                                            className="min-h-[150px] text-xs font-mono leading-relaxed"
                                            placeholder="Istruzioni per l'IA..."
                                        />
                                    ) : (
                                        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3 italic">
                                            "{p.content}"
                                        </p>
                                    )}
                                </CardContent>
                                {isEditing && (
                                    <CardFooter className="p-4 pt-0 text-[9px] text-muted-foreground italic flex items-center gap-2">
                                        <Sparkles className="h-3 w-3 text-accent" />
                                        Sii preciso: queste istruzioni definiscono l'identità dell'IA per questo strumento.
                                    </CardFooter>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
