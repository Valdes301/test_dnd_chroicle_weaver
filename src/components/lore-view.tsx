'use client';

import { useState } from 'react';
import type { CampaignWithRelations, LoreEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { 
    BookMarked, 
    Plus, 
    Sparkles, 
    Search, 
    Youtube, 
    FileText, 
    Trash2, 
    Pencil, 
    Loader2, 
    ExternalLink, 
    Compass, 
    ScrollText, 
    Shield, 
    UserCircle, 
    Building2,
    CalendarDays,
    BookOpen,
    Undo2,
    CheckCircle2,
    ShieldCheck,
    Wand2,
    CornerDownRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import * as actions from '@/lib/actions';
import { MarkdownRenderer } from './ui/markdown-renderer';

type LoreViewProps = {
    campaign: CampaignWithRelations;
};

const CANON_COMMAND_PRESETS = [
    { label: "🏛️ Luoghi & Strutture", cmd: "Approfondisci la geografia, i quartieri e i punti di interesse canonici e ufficiali documentati." },
    { label: "⚔️ Fazioni & Poteri", cmd: "Espandi le fazioni ufficiali, le alleanze, i conflitti di potere e le gerarchie canoniche." },
    { label: "📜 Cronologia & Date DR", cmd: "Arricchisci con la cronologia storica ufficiale e gli anni esatti in Dalereckoning (DR)." },
    { label: "👤 Figure Storiche & PNG", cmd: "Dettaglia le figure storiche, governanti e PNG canonici ufficiali legati a questo dossier." },
    { label: "🔍 Segreti & Trame Ufficiali", cmd: "Estrai e approfondisci i segreti, le trame storiche e gli intrighi documentati nel canone ufficiale WotC." },
    { label: "📋 Sintesi per la Sessione", cmd: "Riorganizza il contenuto in punti chiave, descrizioni rapide ed elementi pratici da consultare al volo durante la sessione." }
];

export function LoreView({ campaign }: LoreViewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    
    // Modal states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [importMode, setImportMode] = useState<'ai' | 'manual'>('ai');
    
    // AI Import states
    const [aiRawText, setAiRawText] = useState('');
    const [aiYoutubeUrl, setAiYoutubeUrl] = useState('');
    const [aiPromptInstruction, setAiPromptInstruction] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    // Manual form states
    const [formId, setFormId] = useState<string | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState<'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale'>('citta');
    const [formSubtitle, setFormSubtitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formTags, setFormTags] = useState('');
    const [formSourceUrl, setFormSourceUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Follow-up AI Command state in Editor
    const [editorAiCommand, setEditorAiCommand] = useState('');
    const [isExecutingCommand, setIsExecutingCommand] = useState(false);
    const [previousDraft, setPreviousDraft] = useState<{
        title: string;
        category: 'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale';
        subtitle: string;
        content: string;
        tags: string;
    } | null>(null);

    // Detailed view modal state
    const [viewingEntry, setViewingEntry] = useState<LoreEntry | null>(null);
    const [expandInstruction, setExpandInstruction] = useState('');
    const [isExpanding, setIsExpanding] = useState(false);

    const { toast } = useToast();
    const router = useRouter();

    const loreEntries = campaign.loreEntries || [];

    const filteredEntries = loreEntries.filter(entry => {
        const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
        const query = searchQuery.toLowerCase();
        const matchesQuery = !query || 
            entry.title.toLowerCase().includes(query) ||
            (entry.subtitle && entry.subtitle.toLowerCase().includes(query)) ||
            entry.content.toLowerCase().includes(query) ||
            (entry.tags && entry.tags.toLowerCase().includes(query));
        return matchesCategory && matchesQuery;
    });

    const handleExtractWithAi = async () => {
        if (!aiRawText.trim() && !aiYoutubeUrl.trim()) {
            toast({ variant: 'destructive', title: "Attenzione", description: "Inserisci del testo o un link YouTube da cui estrarre la lore." });
            return;
        }

        setIsExtracting(true);
        try {
            const res = await actions.extractLoreAction({
                rawText: aiRawText,
                youtubeUrl: aiYoutubeUrl,
                promptInstruction: aiPromptInstruction
            });

            if (res.success && res.data) {
                setFormId(null);
                setPreviousDraft(null);
                setFormTitle(res.data.title);
                setFormCategory(res.data.category);
                setFormSubtitle(res.data.subtitle);
                setFormContent(res.data.content);
                setFormTags(res.data.tags);
                setFormSourceUrl(aiYoutubeUrl);
                setImportMode('manual');
                toast({ 
                    title: "Informazioni Estratte con Successo!", 
                    description: "Puoi ora impartire ulteriori comandi all'IA per ampliare il dossier o procedere al salvataggio." 
                });
            } else throw new Error(res.error || 'Errore estrazione lore');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore IA", description: e.message || "Impossibile estrarre la lore." });
        } finally {
            setIsExtracting(false);
        }
    };

    const handleExecuteAiCommand = async (customCmd?: string) => {
        const commandToRun = customCmd || editorAiCommand;
        if (!commandToRun.trim()) {
            toast({ variant: 'destructive', title: "Comando Richiesto", description: "Scrivi un comando o seleziona un'azione rapida per l'Archivista IA." });
            return;
        }

        setIsExecutingCommand(true);
        try {
            // Salva lo stato precedente per consentire l'annullamento
            setPreviousDraft({
                title: formTitle,
                category: formCategory,
                subtitle: formSubtitle,
                content: formContent,
                tags: formTags
            });

            const res = await actions.refineLoreDraftAction({
                title: formTitle || 'Nuovo Dossier',
                category: formCategory,
                subtitle: formSubtitle,
                currentContent: formContent,
                tags: formTags,
                instruction: commandToRun,
                sourceUrl: formSourceUrl || aiYoutubeUrl
            });

            if (res.success && res.data) {
                setFormTitle(res.data.title);
                setFormCategory(res.data.category);
                setFormSubtitle(res.data.subtitle);
                setFormContent(res.data.content);
                setFormTags(res.data.tags);
                setEditorAiCommand('');
                toast({ 
                    title: "Comando IA Eseguito!", 
                    description: "Dossier arricchito e aggiornato secondo le fonti ufficiali." 
                });
            } else throw new Error(res.error || 'Errore comando IA');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore Comando IA", description: e.message });
        } finally {
            setIsExecutingCommand(false);
        }
    };

    const handleUndoAiCommand = () => {
        if (!previousDraft) return;
        setFormTitle(previousDraft.title);
        setFormCategory(previousDraft.category);
        setFormSubtitle(previousDraft.subtitle);
        setFormContent(previousDraft.content);
        setFormTags(previousDraft.tags);
        setPreviousDraft(null);
        toast({ title: "Modifica IA Annullata", description: "Ripristinata la versione precedente del dossier." });
    };

    const handleSaveManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() || !formContent.trim()) {
            toast({ variant: 'destructive', title: "Attenzione", description: "Titolo e Contenuto sono obbligatori." });
            return;
        }

        setIsSaving(true);
        try {
            const res = await actions.saveLoreEntry({
                id: formId,
                campaignId: campaign.id,
                title: formTitle,
                category: formCategory,
                subtitle: formSubtitle,
                content: formContent,
                tags: formTags,
                sourceUrl: formSourceUrl
            });

            if (res.success) {
                toast({ title: formId ? "Dossier Aggiornato!" : "Dossier Creato!" });
                setIsCreateOpen(false);
                resetForm();
                router.refresh();
            } else throw new Error(res.error || 'Errore salvataggio dossier');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore", description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditClick = (entry: LoreEntry) => {
        setFormId(entry.id);
        setPreviousDraft(null);
        setFormTitle(entry.title);
        setFormCategory(entry.category);
        setFormSubtitle(entry.subtitle || '');
        setFormContent(entry.content);
        setFormTags(entry.tags || '');
        setFormSourceUrl(entry.sourceUrl || '');
        setImportMode('manual');
        setIsCreateOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo dossier dall'archivio?")) return;
        try {
            const res = await actions.deleteLoreEntry(id);
            if (res.success) {
                toast({ title: "Dossier Eliminato" });
                if (viewingEntry?.id === id) setViewingEntry(null);
                router.refresh();
            } else throw new Error(res.error || 'Errore eliminazione dossier');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore", description: e.message });
        }
    };

    const handleExpandEntry = async (customInstruction?: string) => {
        const cmd = customInstruction || expandInstruction;
        if (!viewingEntry || !cmd.trim()) return;
        setIsExpanding(true);
        try {
            const res = await actions.expandLoreAction(viewingEntry.id, cmd);
            if (res.success && res.data) {
                toast({ title: "Dossier Approfondito con Successo!" });
                setViewingEntry({ ...viewingEntry, content: res.data.content });
                setExpandInstruction('');
                router.refresh();
            } else throw new Error(res.error || 'Errore approfondimento dossier');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore IA", description: e.message });
        } finally {
            setIsExpanding(false);
        }
    };

    const resetForm = () => {
        setFormId(null);
        setPreviousDraft(null);
        setFormTitle('');
        setFormCategory('citta');
        setFormSubtitle('');
        setFormContent('');
        setFormTags('');
        setFormSourceUrl('');
        setEditorAiCommand('');
    };

    const getCategoryBadge = (cat: string) => {
        switch (cat) {
            case 'citta': return <Badge variant="outline" className="border-primary/30 text-primary gap-1"><Building2 className="h-3 w-3"/> Città & Luoghi</Badge>;
            case 'storia': return <Badge variant="outline" className="border-amber-500/30 text-amber-500 gap-1"><CalendarDays className="h-3 w-3"/> Storia & Ere</Badge>;
            case 'personaggio': return <Badge variant="outline" className="border-accent/30 text-accent gap-1"><UserCircle className="h-3 w-3"/> Personaggi & Dinastie</Badge>;
            case 'fazione': return <Badge variant="outline" className="border-purple-500/30 text-purple-400 gap-1"><Shield className="h-3 w-3"/> Fazioni & Gilde</Badge>;
            default: return <Badge variant="outline" className="border-muted text-muted-foreground gap-1"><Compass className="h-3 w-3"/> Generale</Badge>;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-full pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/50 pb-6">
                <div>
                    <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <BookMarked className="h-8 w-8 text-primary" /> Archivio Lore & Ambientazione
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Dossier di lore fedeli al canone ufficiale di D&D 5e e Forgotten Realms. Incolla video YouTube o testi, ed espandili con comandi IA precisi e privi di invenzioni.
                    </p>
                </div>
                
                <Button 
                    onClick={() => { resetForm(); setImportMode('ai'); setIsCreateOpen(true); }}
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 shrink-0"
                >
                    <Plus className="h-4 w-4" /> Nuovo Dossier / Estrai con IA
                </Button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/40 p-4 rounded-xl border border-border/50 shadow-sm">
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full sm:w-auto">
                    <TabsList className="grid grid-cols-3 sm:flex sm:flex-wrap h-auto p-1 bg-muted/20">
                        <TabsTrigger value="all" className="text-xs">Tutti ({loreEntries.length})</TabsTrigger>
                        <TabsTrigger value="citta" className="text-xs">Città</TabsTrigger>
                        <TabsTrigger value="storia" className="text-xs">Storia</TabsTrigger>
                        <TabsTrigger value="personaggio" className="text-xs">Personaggi</TabsTrigger>
                        <TabsTrigger value="fazione" className="text-xs">Fazioni</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cerca per titolo, tag o contenuto..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background/50 h-9 text-sm"
                    />
                </div>
            </div>

            {/* Cards Grid */}
            {filteredEntries.length === 0 ? (
                <div className="text-center py-20 bg-card/20 rounded-2xl border border-dashed border-border/60 space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <ScrollText className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-headline text-lg font-semibold">Nessun dossier trovato</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Non ci sono ancora schede di lore in questa categoria. Clicca su &quot;Nuovo Dossier&quot; per estrarre da video YouTube o creare un archivio con l'IA.
                        </p>
                    </div>
                    <Button onClick={() => { resetForm(); setImportMode('ai'); setIsCreateOpen(true); }} variant="outline" className="gap-2">
                        <Sparkles className="h-4 w-4 text-accent" /> Estrai Lore da Video o Testo con l'IA
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEntries.map((entry) => (
                        <Card 
                            key={entry.id} 
                            className="group hover:border-primary/50 transition-all duration-300 bg-card/60 backdrop-blur-sm shadow-md hover:shadow-xl flex flex-col justify-between overflow-hidden cursor-pointer border-border/60"
                            onClick={() => setViewingEntry(entry)}
                        >
                            <CardHeader className="space-y-3 pb-3">
                                <div className="flex items-center justify-between gap-2">
                                    {getCategoryBadge(entry.category)}
                                    {entry.sourceUrl && (
                                        <Badge variant="secondary" className="text-[10px] gap-1 bg-red-500/10 text-red-400 border-red-500/20">
                                            <Youtube className="h-3 w-3" /> Video
                                        </Badge>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <CardTitle className="font-headline text-xl text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                        {entry.title}
                                    </CardTitle>
                                    {entry.subtitle && (
                                        <CardDescription className="text-xs font-serif italic text-muted-foreground line-clamp-1">
                                            {entry.subtitle}
                                        </CardDescription>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pb-4 flex-1">
                                <div className="text-xs text-muted-foreground line-clamp-4 font-serif italic bg-muted/20 p-3 rounded-lg border border-border/30">
                                    {entry.content}
                                </div>
                                {entry.tags && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {entry.tags.split(',').map((tag, idx) => (
                                            <span key={idx} className="text-[10px] bg-background px-2 py-0.5 rounded border border-border/50 text-muted-foreground">
                                                #{tag.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pt-3 border-t border-border/40 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 font-medium text-primary">
                                    <BookOpen className="h-3.5 w-3.5" /> Leggi Dossier & Comandi IA
                                </span>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => handleEditClick(entry)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create / Import Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-2">
                            <DialogTitle className="font-headline text-xl sm:text-2xl flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-accent shrink-0" /> {formId ? 'Modifica Dossier Lore' : 'Nuovo Dossier di Ambientazione'}
                            </DialogTitle>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 shrink-0">
                                <ShieldCheck className="h-3 w-3" /> Canone Ufficiale WotC
                            </Badge>
                        </div>
                        <DialogDescription className="text-xs sm:text-sm">
                            Estrai da video YouTube o testi grezzi, poi usa i comandi per ampliare con dati autentici e verificati.
                        </DialogDescription>
                    </DialogHeader>

                    {!formId && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 bg-muted/30 p-1 rounded-lg border my-1">
                            <Button 
                                variant={importMode === 'ai' ? 'default' : 'ghost'} 
                                size="sm" 
                                className="w-full sm:flex-1 text-xs gap-2 h-8"
                                onClick={() => setImportMode('ai')}
                            >
                                <Sparkles className="h-3.5 w-3.5 text-accent" /> Estrazione Intelligente da Video/Testo (IA)
                            </Button>
                            <Button 
                                variant={importMode === 'manual' ? 'default' : 'ghost'} 
                                size="sm" 
                                className="w-full sm:flex-1 text-xs gap-2 h-8"
                                onClick={() => setImportMode('manual')}
                            >
                                <FileText className="h-3.5 w-3.5" /> Editor Dossier & Comandi IA
                            </Button>
                        </div>
                    )}

                    {importMode === 'ai' && !formId ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                                    <Youtube className="h-4 w-4 text-red-500 shrink-0" /> Link Video YouTube
                                </Label>
                                <Input 
                                    placeholder="es. https://youtu.be/2UIoDmpQ7Mw" 
                                    value={aiYoutubeUrl}
                                    onChange={(e) => setAiYoutubeUrl(e.target.value)}
                                    className="text-xs sm:text-sm"
                                />
                                <p className="text-[11px] text-muted-foreground">L'Archivista recupererà i metadati del video e strutturerà il dossier in capitoli ufficiali.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                                    <FileText className="h-4 w-4 text-primary shrink-0" /> Testo o Note Grezze da Incollare (Opzionale se c'è un video)
                                </Label>
                                <Textarea 
                                    placeholder="Incolla qui appunti, descrizioni da wiki ufficiali o trascrizioni..."
                                    value={aiRawText}
                                    onChange={(e) => setAiRawText(e.target.value)}
                                    rows={5}
                                    className="font-serif text-xs sm:text-sm leading-relaxed"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="font-semibold text-xs sm:text-sm">Istruzioni / Focus per l'Estrazione (Opzionale)</Label>
                                <Input 
                                    placeholder="es. Focus sui quartieri storici, le gilde e i governanti canonici..."
                                    value={aiPromptInstruction}
                                    onChange={(e) => setAiPromptInstruction(e.target.value)}
                                    className="text-xs sm:text-sm"
                                />
                            </div>

                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg flex items-start gap-2.5 text-xs text-emerald-300">
                                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                                <div>
                                    <span className="font-semibold text-emerald-200">Garanzia Canone Ufficiale WotC:</span> L'IA opera con vincolo tassativo anti-allucinazione. Nessun dato, nome o evento verrà inventato. Vengono riportate unicamente informazioni verificate.
                                </div>
                            </div>

                            <Button 
                                onClick={handleExtractWithAi} 
                                disabled={isExtracting}
                                className="w-full gap-2 bg-accent hover:bg-accent/80 text-accent-foreground shadow-lg shadow-accent/20 h-11 font-semibold text-xs sm:text-sm"
                            >
                                {isExtracting ? (
                                    <><Loader2 className="h-4 w-4 animate-spin shrink-0" /> L'Archivista sta consultando le fonti ufficiali...</>
                                ) : (
                                    <><Sparkles className="h-4 w-4 shrink-0" /> Estrai Dossier Ufficiale</>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-5 py-2">
                            {/* AI Commands & Refinement Console */}
                            <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 sm:p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-accent/20 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="h-4 w-4 text-accent" />
                                        <span className="font-headline text-sm font-semibold text-foreground">
                                            Comandi IA per Ampliare & Approfondire
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3 text-emerald-400" /> Solo Canone Ufficiale & Fonti Verificate
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-[11px] text-muted-foreground">Comandi Rapidi Canonici (clicca per applicare subito):</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {CANON_COMMAND_PRESETS.map((preset, idx) => (
                                            <Button
                                                key={idx}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={isExecutingCommand || !formContent}
                                                onClick={() => handleExecuteAiCommand(preset.cmd)}
                                                className="h-7 text-[11px] bg-background/80 hover:bg-accent hover:text-accent-foreground border-border/60 transition-colors"
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                    <Input
                                        placeholder="es. Approfondisci la storia del Tempio di Tymora e i sacerdoti canonici..."
                                        value={editorAiCommand}
                                        onChange={(e) => setEditorAiCommand(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleExecuteAiCommand();
                                            }
                                        }}
                                        disabled={isExecutingCommand}
                                        className="bg-background text-xs sm:text-sm h-9"
                                    />
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            type="button"
                                            onClick={() => handleExecuteAiCommand()}
                                            disabled={isExecutingCommand || !editorAiCommand.trim()}
                                            size="sm"
                                            className="h-9 gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-semibold"
                                        >
                                            {isExecutingCommand ? (
                                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Elaborazione...</>
                                            ) : (
                                                <><Sparkles className="h-3.5 w-3.5" /> Esegui Comando</>
                                            )}
                                        </Button>
                                        {previousDraft && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleUndoAiCommand}
                                                className="h-9 gap-1 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                                                title="Ripristina la versione precedente"
                                            >
                                                <Undo2 className="h-3.5 w-3.5" /> Annulla
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Main Form Fields */}
                            <form onSubmit={handleSaveManual} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Titolo del Dossier *</Label>
                                        <Input 
                                            placeholder="es. Neverwinter: Il Gioiello del Nord" 
                                            value={formTitle} 
                                            onChange={(e) => setFormTitle(e.target.value)} 
                                            className="text-xs sm:text-sm"
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Categoria</Label>
                                        <Select value={formCategory} onValueChange={(v: any) => setFormCategory(v)}>
                                            <SelectTrigger className="text-xs sm:text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="citta">Città & Luoghi</SelectItem>
                                                <SelectItem value="storia">Storia & Ere</SelectItem>
                                                <SelectItem value="personaggio">Personaggi & Dinastie</SelectItem>
                                                <SelectItem value="fazione">Fazioni & Gilde</SelectItem>
                                                <SelectItem value="generale">Generale</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs sm:text-sm">Sottotitolo / Sommarietto</Label>
                                    <Input 
                                        placeholder="es. Origini, Geografia e il Mistero del Fiume Caldo" 
                                        value={formSubtitle} 
                                        onChange={(e) => setFormSubtitle(e.target.value)} 
                                        className="text-xs sm:text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs sm:text-sm">Contenuto (Markdown supportato) *</Label>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Sparkles className="h-3 w-3 text-primary" /> Formattazione automatica attiva al salvataggio
                                        </span>
                                    </div>
                                    <Textarea 
                                        placeholder="Scrivi o incolla il testo dettagliato del dossier..." 
                                        value={formContent} 
                                        onChange={(e) => setFormContent(e.target.value)} 
                                        rows={9}
                                        className="font-serif text-xs sm:text-sm leading-relaxed"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Tag (separati da virgola)</Label>
                                        <Input 
                                            placeholder="es. Neverwinter, Hotenow, Alagondar" 
                                            value={formTags} 
                                            onChange={(e) => setFormTags(e.target.value)} 
                                            className="text-xs sm:text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Link di Riferimento / YouTube</Label>
                                        <Input 
                                            placeholder="es. https://youtu.be/..." 
                                            value={formSourceUrl} 
                                            onChange={(e) => setFormSourceUrl(e.target.value)} 
                                            className="text-xs sm:text-sm"
                                        />
                                    </div>
                                </div>

                                <DialogFooter className="pt-3 flex flex-col-reverse sm:flex-row gap-2">
                                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="w-full sm:w-auto">Annulla</Button>
                                    <Button type="submit" disabled={isSaving || isExecutingCommand} className="w-full sm:w-auto">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        {formId ? 'Salva Modifiche' : 'Salva Dossier in Archivio'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Detailed View Modal with Advanced AI Expansion */}
            <Dialog open={!!viewingEntry} onOpenChange={(open) => !open && setViewingEntry(null)}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
                    {viewingEntry && (
                        <div className="space-y-5">
                            <DialogHeader className="sr-only">
                                <DialogTitle>{viewingEntry.title}</DialogTitle>
                                <DialogDescription>{viewingEntry.subtitle || `Dossier di tipo ${viewingEntry.category}`}</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
                                <div className="space-y-1.5 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {getCategoryBadge(viewingEntry.category)}
                                        {viewingEntry.sourceUrl && (
                                            <a 
                                                href={viewingEntry.sourceUrl} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 hover:underline max-w-full truncate"
                                            >
                                                <Youtube className="h-3 w-3 shrink-0" /> Fonte Video <ExternalLink className="h-3 w-3 shrink-0" />
                                            </a>
                                        )}
                                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 gap-1 bg-emerald-500/5">
                                            <ShieldCheck className="h-3 w-3" /> Canone D&D 5e
                                        </Badge>
                                    </div>
                                    <h2 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
                                        {viewingEntry.title}
                                    </h2>
                                    {viewingEntry.subtitle && (
                                        <p className="text-xs sm:text-sm font-serif italic text-muted-foreground break-words">
                                            {viewingEntry.subtitle}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <Button variant="outline" size="sm" onClick={() => { setViewingEntry(null); handleEditClick(viewingEntry); }} className="gap-1.5 text-xs">
                                        <Pencil className="h-3.5 w-3.5" /> Modifica / Comandi
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(viewingEntry.id)} className="text-destructive hover:bg-destructive/10 text-xs">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-muted/10 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border border-border/50 shadow-inner overflow-hidden">
                                <MarkdownRenderer content={viewingEntry.content} className="font-serif text-sm sm:text-base leading-relaxed" />
                            </div>

                            {/* AI Expansion Box inside View Modal */}
                            <div className="bg-accent/10 border border-accent/30 p-3 sm:p-4 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-headline text-xs sm:text-sm font-semibold flex items-center gap-2 text-foreground">
                                        <Sparkles className="h-4 w-4 text-accent shrink-0" /> Comandi IA: Approfondisci o Espandi con Fonti Canoniche
                                    </h4>
                                    <span className="text-[10px] text-muted-foreground">Zero Invenzioni</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {CANON_COMMAND_PRESETS.slice(0, 4).map((preset, idx) => (
                                        <Button
                                            key={idx}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isExpanding}
                                            onClick={() => handleExpandEntry(preset.cmd)}
                                            className="h-6 text-[10px] bg-background/80 hover:bg-accent hover:text-accent-foreground border-border/60"
                                        >
                                            {preset.label}
                                        </Button>
                                    ))}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input 
                                        placeholder="es. Dettaglia le catacombe e le alleanze politiche storiche..."
                                        value={expandInstruction}
                                        onChange={(e) => setExpandInstruction(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && expandInstruction.trim()) {
                                                e.preventDefault();
                                                handleExpandEntry();
                                            }
                                        }}
                                        disabled={isExpanding}
                                        className="bg-background text-xs sm:text-sm h-9"
                                    />
                                    <Button 
                                        onClick={() => handleExpandEntry()} 
                                        disabled={isExpanding || !expandInstruction.trim()} 
                                        className="gap-2 shrink-0 w-full sm:w-auto text-xs font-semibold h-9 bg-accent text-accent-foreground hover:bg-accent/90"
                                    >
                                        {isExpanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        Espandi Dossier
                                    </Button>
                                </div>
                            </div>

                            {viewingEntry.tags && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {viewingEntry.tags.split(',').map((tag, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-[11px]">
                                            #{tag.trim()}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
