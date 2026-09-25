'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import * as actions from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  BookOpen, Search, Plus, Trash2, Edit3, Check, X, Shield, 
  BookMarked, Layers, ChevronDown, ChevronUp, Sparkles, BookText, Loader2,
  FolderPlus, AlertTriangle, Filter, Hash, RefreshCw, ChevronsUpDown, CheckCircle2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './ui/markdown-renderer';

type ManualeDbProps = {
  campaignId: string;
};

export interface SystemRule {
  id: string;
  title: string;
  content: string;
  sourceBook: 'phb' | 'dmg' | 'custom';
  chapterTitle: string;
  chapterId?: string;
  paragraphTitle?: string;
  tags?: string[];
  updatedAt?: string;
}

const DEFAULT_RULES: SystemRule[] = [
  {
    id: "default-phb-dadi",
    title: "La Regola dei Dadi e del d20",
    sourceBook: "phb",
    chapterTitle: "Come Si Gioca & Meccaniche Base",
    content: `Il cuore del gioco si basa sulla risoluzione delle azioni tramite il **D20** (dado a venti facce). Ogni volta che un personaggio tenta un'azione con esito incerto, si segue questa semplice regola:

1. **Tira un d20.**
2. **Aggiungi i modificatori relativi** (modificatore di caratteristica, bonus di competenza, o altri bonus temporanei).
3. **Confronta il totale con la Classe Difficoltà (CD)** o il punteggio stabilito dal DM.

Se il totale è **uguale o superiore** alla CD, l'azione ha successo. Altrimenti, fallisce.`,
    tags: ["d20", "meccaniche-base", "cd"]
  },
  {
    id: "default-phb-vantaggio",
    title: "Prove con d20: Vantaggio e Svantaggio",
    sourceBook: "phb",
    chapterTitle: "Come Si Gioca & Meccaniche Base",
    content: `### Vantaggio e Svantaggio
Il Vantaggio e lo Svantaggio sono i meccanismi principali per riflettere circostanze favorevoli o ostacoli durante un tiro di dado:

* **Vantaggio:** Tira **due d20** e tieni il risultato **più alto**.
* **Svantaggio:** Tira **due d20** e tieni il risultato **più basso**.

Se più fattori conferiscono Vantaggio o Svantaggio, questi **non si accumulano**: si tira comunque un solo dado aggiuntivo. Se un'azione riceve contemporaneamente sia Vantaggio che Svantaggio, questi si **annullano a vicenda** e si tira un normale d20.`,
    tags: ["vantaggio", "svantaggio", "dadi"]
  },
  {
    id: "default-phb-combattimento",
    title: "Le Azioni Principali in Combattimento",
    sourceBook: "phb",
    chapterTitle: "Combattimento",
    content: `Durante il proprio turno in combattimento, una creatura può muoversi della sua velocità ed effettuare **una azione principale**:

* **Attacco:** Effettuare un attacco in mischia o a distanza.
* **Lanciare un Incantesimo:** Lanciare una magia con tempo di lancio di 1 azione.
* **Scatto (Dash):** Ottenere movimento extra pari alla propria velocità.
* **Disimpegno (Disengage):** Il movimento di questo turno non provoca attacchi d'opportunità.
* **Schivata (Dodge):** Fino all'inizio del prossimo turno, i tiri per colpire contro di te hanno svantaggio e hai vantaggio sui tiri salvezza di Destrezza.
* **Aiuto (Help):** Concedere vantaggio al prossimo tiro di un alleato.
* **Nascondersi (Hide):** Effettuare una prova di Destrezza (Furtività) per nascondersi.
* **Preparare un'Azione (Ready):** Attendere un innesco per agire come reazione.`,
    tags: ["combattimento", "azioni", "turno"]
  },
  {
    id: "default-dmg-veleni",
    title: "I Veleni e le loro Categorie",
    sourceBook: "dmg",
    chapterTitle: "Pericoli & Strumenti del DM",
    content: `I veleni sono raggruppati in quattro categorie in base alla modalità di somministrazione:

* **Contatto:** Applicato sulla pelle o sugli oggetti. Ha effetto non appena viene toccato.
* **Ingestione:** Miscelato con cibo o bevande. Richiede che la vittima ingerisca l'intera dose.
* **Inalazione:** Gas o polveri che si diffondono nell'aria. Ha effetto quando la vittima respira nella zona.
* **Ferimento:** Applicato su armi e munizioni. Ha effetto solo se l'attacco infligge danni da perforazione o taglio.

### Esempio: Veleno di Serpente Gigante (Ferimento)
Una creatura colpita deve superare un tiro salvezza di **Costituzione CD 11**, subendo **3d6 danni da veleno** con tiro fallito, o la metà con tiro riuscito.`,
    tags: ["veleni", "pericoli", "dm-tools"]
  }
];

export function ManualeDb({ campaignId }: ManualeDbProps) {
  const [activeBook, setActiveBook] = useState<'phb' | 'dmg' | 'custom'>('phb');
  const [searchQuery, setSearchQuery] = useState('');
  const [rules, setRules] = useState<SystemRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Selezione Capitolo
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  
  // Accordion: ID delle regole attualmente aperte
  const [openRuleIds, setOpenRuleIds] = useState<string[]>([]);

  // Modale Aggiunta/Modifica
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formChapter, setFormChapter] = useState('');
  const [formBook, setFormBook] = useState<'phb' | 'dmg' | 'custom'>('phb');
  const [formTags, setFormTags] = useState('');

  // Dialog di conferma eliminazione capitolo / svuota manuale
  const [deleteChapterTarget, setDeleteChapterTarget] = useState<string | null>(null);
  const [showClearManualDialog, setShowClearManualDialog] = useState(false);

  const { toast } = useToast();

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const res = await actions.getSystemRulesAction();
      if (res.success && res.data && res.data.length > 0) {
        const savedRules = res.data as SystemRule[];
        const merged = [...savedRules];
        DEFAULT_RULES.forEach(defRule => {
          if (!merged.some(r => r.id === defRule.id || r.title.toLowerCase().trim() === defRule.title.toLowerCase().trim())) {
            merged.push(defRule);
          }
        });
        setRules(merged);
      } else {
        setRules(DEFAULT_RULES);
      }
    } catch (e) {
      setRules(DEFAULT_RULES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  // Regole del libro attualmente selezionato
  const bookRules = useMemo(() => {
    return rules.filter(r => r.sourceBook === activeBook);
  }, [rules, activeBook]);

  // Lista dinamica dei capitoli presenti nel libro attivo
  const dynamicChapters = useMemo(() => {
    const map = new Map<string, number>();
    bookRules.forEach(r => {
      const ch = (r.chapterTitle && r.chapterTitle.trim()) ? r.chapterTitle.trim() : 'Regole Generali';
      map.set(ch, (map.get(ch) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [bookRules]);

  // Regole filtrate per capitolo e ricerca, con sanitizzazione automatica dei tag
  const displayedRules = useMemo(() => {
    let list = bookRules;
    if (selectedChapter !== 'all') {
      list = list.filter(r => (r.chapterTitle || 'Regole Generali').trim() === selectedChapter.trim());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        (r.chapterTitle && r.chapterTitle.toLowerCase().includes(q)) ||
        (r.tags && r.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    return list.map(r => {
      // Pulizia automatica dei tag da titoli di capitolo o frasi lunghe
      const cleanTags = (r.tags || []).filter(t => {
        const lower = t.toLowerCase().trim();
        return (
          lower.length > 0 &&
          !lower.includes('capitolo') &&
          !lower.includes('condurre il gioco') &&
          lower !== (r.chapterTitle || '').toLowerCase().trim()
        );
      });
      return { ...r, tags: cleanTags };
    });
  }, [bookRules, selectedChapter, searchQuery]);

  // Apri automaticamente tutte le regole filtrate quando cambia capitolo o libro
  useEffect(() => {
    // Di default apri la prima regola o tutte se sono poche (<= 10)
    if (displayedRules.length > 0) {
      setOpenRuleIds(displayedRules.map(r => r.id));
    } else {
      setOpenRuleIds([]);
    }
  }, [selectedChapter, activeBook]);

  const toggleExpandAll = () => {
    if (openRuleIds.length === displayedRules.length) {
      setOpenRuleIds([]);
    } else {
      setOpenRuleIds(displayedRules.map(r => r.id));
    }
  };

  const openCreateDialog = (prefilledChapter?: string) => {
    setEditId(null);
    setFormTitle('');
    setFormContent('');
    setFormChapter(prefilledChapter || (selectedChapter !== 'all' ? selectedChapter : 'Regole Generali'));
    setFormBook(activeBook);
    setFormTags('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: SystemRule) => {
    setEditId(rule.id);
    setFormTitle(rule.title);
    setFormContent(rule.content);
    setFormChapter(rule.chapterTitle || 'Regole Generali');
    setFormBook(rule.sourceBook || activeBook);
    setFormTags(rule.tags ? rule.tags.join(', ') : '');
    setIsDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast({ variant: "destructive", title: "Campi obbligatori", description: "Inserisci titolo e contenuto della regola." });
      return;
    }

    const tagsArray = formTags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => (
        t.length > 0 &&
        !t.includes('capitolo') &&
        !t.includes('condurre il gioco')
      ));

    const ruleData: SystemRule = {
      id: editId || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: formTitle.trim(),
      content: formContent.trim(),
      sourceBook: formBook,
      chapterTitle: formChapter.trim() || 'Regole Generali',
      tags: tagsArray,
      updatedAt: new Date().toISOString()
    };

    const res = await actions.importSystemRuleAction(ruleData);
    if (res.success) {
      toast({ title: editId ? "Regola aggiornata" : "Regola salvata", description: `"${ruleData.title}" nel capitolo ${ruleData.chapterTitle}.` });
      setIsDialogOpen(false);
      await loadRules();
      // Apri automaticamente la regola salvata
      setOpenRuleIds(prev => Array.from(new Set([...prev, ruleData.id])));
    } else {
      toast({ variant: "destructive", title: "Errore", description: res.error || "Impossibile salvare la regola." });
    }
  };

  const handleDeleteRule = async (id: string, title: string) => {
    const res = await actions.deleteSystemRuleAction(id);
    if (res.success) {
      toast({ title: "Regola eliminata", description: `"${title}" è stata rimossa.` });
      setRules(prev => prev.filter(r => r.id !== id));
      setOpenRuleIds(prev => prev.filter(item => item !== id));
    } else {
      toast({ variant: "destructive", title: "Errore", description: res.error || "Impossibile eliminare la regola." });
    }
  };

  const handleDeleteChapter = async () => {
    if (!deleteChapterTarget) return;
    const res = await actions.deleteSystemChapterAction(activeBook, deleteChapterTarget);
    if (res.success) {
      toast({ title: "Capitolo eliminato", description: `Rimosse ${res.count || 0} regole dal capitolo "${deleteChapterTarget}".` });
      if (selectedChapter === deleteChapterTarget) {
        setSelectedChapter('all');
      }
      setDeleteChapterTarget(null);
      await loadRules();
    } else {
      toast({ variant: "destructive", title: "Errore", description: res.error || "Impossibile eliminare il capitolo." });
    }
  };

  const handleClearManual = async () => {
    const res = await actions.clearSystemRulesAction(activeBook);
    if (res.success) {
      toast({ 
        title: "Manuale azzerato", 
        description: `Tutti i capitoli del manuale (${activeBook.toUpperCase()}) sono stati rimossi. Pronto per la nuova importazione intelligente!` 
      });
      setSelectedChapter('all');
      setShowClearManualDialog(false);
      await loadRules();
    } else {
      toast({ variant: "destructive", title: "Errore", description: res.error || "Impossibile azzerare il manuale." });
    }
  };

  const bookLabels = {
    phb: { 
      label: "Manuale del Giocatore (PHB)", 
      short: "PHB", 
      icon: Shield, 
      color: "text-blue-400",
      description: "Regole base, creazione personaggi, abilità e combattimento"
    },
    dmg: { 
      label: "Guida del Dungeon Master (DMG)", 
      short: "DMG", 
      icon: BookMarked, 
      color: "text-amber-400",
      description: "Conduzione del gioco, strumenti del DM, pericoli, veleni e trama"
    },
    custom: { 
      label: "Espansioni & Homebrew", 
      short: "Custom", 
      icon: Sparkles, 
      color: "text-purple-400",
      description: "Regole personalizzate e moduli d'avventura proprietari"
    }
  };

  // Raggruppamento delle regole visualizzate per capitolo
  const rulesByChapter = useMemo(() => {
    const groups: { chapter: string; rules: SystemRule[] }[] = [];
    const map = new Map<string, SystemRule[]>();

    displayedRules.forEach(rule => {
      const ch = rule.chapterTitle || 'Regole Generali';
      if (!map.has(ch)) {
        map.set(ch, []);
      }
      map.get(ch)!.push(rule);
    });

    map.forEach((rulesList, chapter) => {
      groups.push({ chapter, rules: rulesList });
    });

    return groups.sort((a, b) => a.chapter.localeCompare(b.chapter));
  }, [displayedRules]);

  return (
    <div className="w-full space-y-6 pb-24 max-w-7xl mx-auto">
      
      {/* 1. SELETTORE MANUALE (PHB / DMG / CUSTOM) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['phb', 'dmg', 'custom'] as const).map(bk => {
          const info = bookLabels[bk];
          const Icon = info.icon;
          const count = rules.filter(r => r.sourceBook === bk).length;
          const isSelected = activeBook === bk;
          return (
            <button
              key={bk}
              type="button"
              onClick={() => {
                setActiveBook(bk);
                setSelectedChapter('all');
              }}
              className={cn(
                "flex flex-col p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group",
                isSelected
                  ? "bg-card border-primary ring-2 ring-primary/30 shadow-md"
                  : "bg-card/40 border-border/70 hover:bg-card/80 hover:border-border text-muted-foreground"
              )}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-2 rounded-lg border", isSelected ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border/50 text-muted-foreground")}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={cn("text-base font-bold font-cinzel tracking-wide block", isSelected ? "text-foreground" : "text-foreground/80")}>
                      {info.short}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {info.label}
                    </span>
                  </div>
                </div>

                <Badge 
                  variant={isSelected ? "default" : "outline"} 
                  className={cn("text-xs font-bold px-2 py-0.5 h-6", isSelected && "bg-primary text-primary-foreground")}
                >
                  {count} {count === 1 ? 'regola' : 'regole'}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                {info.description}
              </p>

              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. CARD PRINCIPALE DEL MANUALE ATTIVO */}
      <Card className="border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="p-4 sm:p-6 border-b border-border/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary shrink-0" />
                <CardTitle className="text-xl sm:text-2xl font-bold font-cinzel">
                  {bookLabels[activeBook].label}
                </CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Sfoglia, apri e consulta i capitoli e le regole. Fai clic su una regola per aprirla o chiuderla.
              </CardDescription>
            </div>

            {/* Azioni Globali */}
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleExpandAll}
                className="text-xs h-9"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 mr-1.5" />
                {openRuleIds.length === displayedRules.length ? "Comprimi Tutte" : "Espandi Tutte"}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowClearManualDialog(true)}
                className="text-destructive hover:bg-destructive/10 border-destructive/30 text-xs h-9"
                title="Azzera e ripulisci le regole di questo manuale"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Azzera Manuale
              </Button>

              <Button 
                size="sm" 
                onClick={() => openCreateDialog()}
                className="bg-primary hover:bg-primary/90 text-xs font-semibold h-9"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Nuova Regola
              </Button>
            </div>
          </div>

          {/* Barra Ricerca & Filtro Capitoli */}
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca regole, parole chiave o tag (es. dadi, combattimento, veleni)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 text-xs sm:text-sm bg-background/80"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Chips Capitoli */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedChapter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer shrink-0",
                  selectedChapter === 'all'
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="w-3 h-3" />
                <span>Tutti i Capitoli</span>
                <span className="opacity-70 text-[10px]">({bookRules.length})</span>
              </button>

              {dynamicChapters.map(({ title, count }) => {
                const isSelected = selectedChapter === title;
                return (
                  <div key={title} className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedChapter(title)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Hash className="w-3 h-3 opacity-60" />
                      <span>{title}</span>
                      <span className="opacity-70 text-[10px]">({count})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteChapterTarget(title)}
                      className="p-1 hover:text-destructive hover:bg-destructive/10 rounded-full text-muted-foreground/60 transition-colors"
                      title={`Elimina capitolo "${title}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>

        {/* 3. LISTA REGOLE CON ACCORDION FLUIDO E SCROLL NATURALE */}
        <CardContent className="p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-xs sm:text-sm">Caricamento compendio regole...</span>
            </div>
          ) : displayedRules.length > 0 ? (
            <div className="space-y-6">
              {rulesByChapter.map(({ chapter, rules: chapterRules }) => (
                <div key={chapter} className="space-y-3">
                  {/* Intestazione Capitolo */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      <BookText className="w-4 h-4 text-primary shrink-0" />
                      <h3 className="text-sm sm:text-base font-bold font-cinzel text-foreground">
                        {chapter}
                      </h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border">
                        {chapterRules.length} {chapterRules.length === 1 ? 'regola' : 'regole'}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreateDialog(chapter)}
                      className="h-7 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Aggiungi a questo capitolo
                    </Button>
                  </div>

                  {/* Accordion Regole del Capitolo */}
                  <Accordion 
                    type="multiple" 
                    value={openRuleIds}
                    onValueChange={setOpenRuleIds}
                    className="space-y-3 w-full"
                  >
                    {chapterRules.map((rule) => {
                      const isOpen = openRuleIds.includes(rule.id);
                      return (
                        <AccordionItem 
                          key={rule.id} 
                          value={rule.id}
                          className="border border-border/80 rounded-xl overflow-hidden bg-card/90 shadow-xs hover:border-primary/40 transition-colors"
                        >
                          <AccordionPrimitive.Header className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-accent/20 cursor-pointer transition-colors">
                            <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between text-left hover:no-underline [&[data-state=open]>svg]:rotate-180">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pr-2">
                                <span className="font-bold text-sm sm:text-base font-cinzel text-foreground tracking-wide">
                                  {rule.title}
                                </span>

                                {rule.tags && rule.tags.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {rule.tags.map((tag, idx) => (
                                      <Badge 
                                        key={idx} 
                                        variant="secondary" 
                                        className="text-[10px] px-1.5 py-0 h-4 font-normal bg-muted/60 text-muted-foreground"
                                      >
                                        #{tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground" />
                            </AccordionPrimitive.Trigger>

                            <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditDialog(rule)}
                                title="Modifica regola"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteRule(rule.id, rule.title)}
                                title="Elimina regola"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </AccordionPrimitive.Header>

                          <AccordionContent className="p-4 sm:p-6 pt-2 border-t border-border/50 bg-background/50">
                            <div className="prose prose-sm prose-invert max-w-none text-foreground/90 text-xs sm:text-sm leading-relaxed">
                              <MarkdownRenderer content={rule.content} />
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-semibold text-foreground font-cinzel">Nessuna regola trovata</h3>
              <p className="text-xs text-muted-foreground max-w-md mt-1 mb-5">
                {searchQuery 
                  ? `Nessun risultato corrispondente a "${searchQuery}". Prova a cercare un altro termine.`
                  : `Il manuale o capitolo selezionato non contiene regole. Creane una nuova o usa l'importazione intelligente.`}
              </p>
              <Button size="sm" onClick={() => openCreateDialog(selectedChapter !== 'all' ? selectedChapter : undefined)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Aggiungi Nuova Regola
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODALE AGGIUNGI / MODIFICA REGOLA */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cinzel text-lg">
              {editId ? "Modifica Regola di Gioco" : "Nuova Regola di Gioco"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Inserisci o modifica le informazioni della regola. Il testo supporta formattazione Markdown completa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Manuale di Riferimento</Label>
                <select 
                  value={formBook} 
                  onChange={(e) => setFormBook(e.target.value as any)}
                  className="w-full mt-1.5 h-9 px-3 rounded-md border border-input bg-background text-xs"
                >
                  <option value="phb">Manuale del Giocatore (PHB)</option>
                  <option value="dmg">Guida del Dungeon Master (DMG)</option>
                  <option value="custom">Espansioni & Homebrew</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Capitolo del Manuale</Label>
                <Input
                  value={formChapter}
                  onChange={(e) => setFormChapter(e.target.value)}
                  placeholder="Es. Capitolo 2: Condurre il Gioco, Combattimento..."
                  className="mt-1.5 h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Titolo della Regola / Sezione</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Es. Conoscere i Giocatori, Vantaggio e Svantaggio..."
                className="mt-1.5 h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Contenuto (Markdown completo: tabelle, elenchi, grassetti)</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Trascrivi la regola, formule, tiri salvezza o tabelle..."
                className="mt-1.5 min-h-[220px] text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-xs">Tag Tematici (separati da virgola, es. combattimento, esplorazione, veleni)</Label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="Es. giocatori, stili di gioco, dadi, cd"
                className="mt-1.5 h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Nota: non è necessario inserire il nome del capitolo tra i tag, viene indicizzato automaticamente.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
              Annulla
            </Button>
            <Button size="sm" onClick={handleSaveRule} className="bg-primary hover:bg-primary/90">
              {editId ? "Aggiorna Regola" : "Salva nel Compendio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG ELIMINAZIONE CAPITOLO */}
      <AlertDialog open={Boolean(deleteChapterTarget)} onOpenChange={() => setDeleteChapterTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-cinzel">
              <AlertTriangle className="w-5 h-5" />
              Eliminare l'intero Capitolo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Stai per eliminare il capitolo <strong>"{deleteChapterTarget}"</strong> e tutte le regole contenute al suo interno. Questa operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteChapter}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
            >
              Elimina Capitolo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG AZZERAMENTO MANUALE */}
      <AlertDialog open={showClearManualDialog} onOpenChange={setShowClearManualDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-cinzel">
              <AlertTriangle className="w-5 h-5" />
              Azzerare il {bookLabels[activeBook].label}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Questa operazione cancellerà tutte le regole e i capitoli attualmente presenti in questo manuale ({bookLabels[activeBook].short}), lasciandolo completamente vuoto per consentirti di reimportare le sezioni in modo pulito con l'IA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearManual}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
            >
              Azzera Tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
