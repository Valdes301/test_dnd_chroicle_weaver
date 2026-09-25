'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Loader2, 
  Zap, 
  Server, 
  Check, 
  Clock, 
  Send,
  Trash2,
  Plus,
  Sliders,
  SlidersHorizontal
} from 'lucide-react';
import * as actions from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PresetModel {
  id: string;
  label: string;
  category?: 'recommended' | 'current' | 'pointer' | 'legacy' | 'custom';
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

const DEFAULT_MODELS: PresetModel[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    category: 'recommended',
    description: 'Ultima generazione Flash. Ottimizzato per rapidità fulminea, finestre di contesto estese e reasoning avanzato.',
    badge: 'Consigliato (Gen 3.8)',
    badgeVariant: 'default'
  },
  {
    id: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    category: 'current',
    description: 'Modello Flash di terza generazione ad alto throughput, bilanciato e stabile.',
    badge: 'Stabile (Gen 3.7)',
    badgeVariant: 'secondary'
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    category: 'current',
    description: 'Versione standard GA raccomandata ufficialmente da Google come sostituto a lungo termine di 2.5.',
    badge: 'Standard GA',
    badgeVariant: 'secondary'
  },
  {
    id: 'gemini-flash-latest',
    label: 'Gemini Flash Latest',
    category: 'pointer',
    description: 'Alias dinamico fornito da Google che punta sempre automaticamente alla versione Flash più recente.',
    badge: 'Auto-Update',
    badgeVariant: 'outline'
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    category: 'legacy',
    description: 'Generazione precedente. Dismissione programmata da Google a metà Ottobre 2026.',
    badge: 'In Dismissione',
    badgeVariant: 'destructive'
  }
];

export function AiModelSelector() {
  const [models, setModels] = useState<PresetModel[]>(DEFAULT_MODELS);
  const [activeModel, setActiveModel] = useState<string>('gemini-3.8-flash');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [source, setSource] = useState<string>('default');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
    testedModel?: string;
  } | null>(null);

  const { toast } = useToast();

  const [sectionModels, setSectionModels] = useState<Record<string, string>>({
    STORY: 'default',
    WORLD: 'default',
    SHOPS: 'default',
    IMPORT: 'default',
    EXTRACTION: 'default',
  });
  const [isSavingSections, setIsSavingSections] = useState<boolean>(false);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await actions.getAiModelConfigAction();
      if (res.success && res.data) {
        const currentActive = res.data.activeModel || 'gemini-3.8-flash';
        setActiveModel(currentActive);
        setSelectedModel(currentActive);
        setSource(res.data.source || 'default');
        
        const loadedModels = res.data.models || DEFAULT_MODELS;
        setModels(loadedModels);
        
        const isKnown = loadedModels.some(p => p.id === currentActive);
        if (!isKnown) {
          setCustomModelInput(currentActive);
        } else {
          setCustomModelInput('');
        }
      }

      // Carica configurazione sezioni specifiche
      const secRes = await actions.getSectionAiModelsConfigAction();
      if (secRes.success && secRes.data) {
        setSectionModels(secRes.data.sectionModels || {
          STORY: 'default', WORLD: 'default', SHOPS: 'default', IMPORT: 'default', EXTRACTION: 'default'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Errore Caricamento Modello',
        description: err?.message || 'Impossibile recuperare la configurazione del modello IA.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSectionModelChange = (serviceKey: string, modelId: string) => {
    setSectionModels(prev => ({ ...prev, [serviceKey]: modelId }));
  };

  const handleSaveSectionModels = async () => {
    setIsSavingSections(true);
    try {
      const res = await actions.saveSectionAiModelsConfigAction(sectionModels);
      if (res.success) {
        toast({
          title: 'Configurazione Sezioni Salvata!',
          description: 'I modelli per ciascuna sezione dell\'app sono stati aggiornati.',
        });
      } else {
        throw new Error(res.error || 'Errore durante il salvataggio.');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Errore Salvataggio',
        description: err?.message || 'Impossibile salvare i modelli per sezione.',
      });
    } finally {
      setIsSavingSections(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSelectPreset = (modelId: string) => {
    setSelectedModel(modelId);
    setCustomModelInput('');
    setTestResult(null);
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomModelInput(val);
    if (val.trim()) {
      setSelectedModel(val.trim());
    } else {
      setSelectedModel(activeModel);
    }
    setTestResult(null);
  };

  const handleAddCustomModel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawInput = customModelInput.trim();
    if (!rawInput) {
      toast({
        variant: 'destructive',
        title: 'Nome mancante',
        description: 'Digita il nome o identificativo del modello prima di aggiungerlo.',
      });
      return;
    }

    setIsAdding(true);
    try {
      const res = await actions.addCustomAiModelAction(rawInput);
      if (res.success && res.data) {
        setModels(res.data.models);
        setSelectedModel(res.data.model.id);
        setCustomModelInput('');
        toast({
          title: res.data.alreadyExisted ? 'Modello già presente' : 'Modello Aggiunto a Modelli AI',
          description: `Il modello "${res.data.model.id}" è ora selezionabile nella lista.`,
        });
      } else {
        throw new Error(res.error || 'Impossibile aggiungere il modello.');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Errore Aggiunta Modello',
        description: err?.message || 'Si è verificato un errore.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteModel = async (modelId: string, label: string) => {
    setDeletingModelId(modelId);
    try {
      const res = await actions.deleteAiModelAction(modelId);
      if (res.success && res.data) {
        setModels(res.data.models);
        if (res.data.activeModel) {
          setActiveModel(res.data.activeModel);
        }
        if (selectedModel === modelId) {
          setSelectedModel(res.data.activeModel || res.data.models[0]?.id || 'gemini-3.8-flash');
        }
        toast({
          title: 'Modello Rimosso',
          description: `Il modello "${label}" è stato eliminato dalla lista.`,
        });
      } else {
        throw new Error(res.error || 'Impossibile eliminare il modello.');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Errore Eliminazione',
        description: err?.message || 'Non è stato possibile eliminare il modello.',
      });
    } finally {
      setDeletingModelId(null);
    }
  };

  const handleTestModel = async () => {
    const modelToTest = selectedModel.trim();
    if (!modelToTest) {
      toast({
        variant: 'destructive',
        title: 'Modello non valido',
        description: 'Inserisci o seleziona un identificativo di modello da testare.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await actions.testAiModelAction(modelToTest);
      if (res.success && res.data) {
        setTestResult({
          success: true,
          message: res.data.message || 'Risposta ricevuta con successo!',
          latencyMs: res.data.latencyMs,
          testedModel: modelToTest,
        });
        toast({
          title: 'Test Modello Riuscito!',
          description: `Il modello ${modelToTest} ha risposto in ${res.data.latencyMs || 0}ms.`,
        });
      } else {
        setTestResult({
          success: false,
          error: res.error || 'Nessuna risposta dal modello.',
          testedModel: modelToTest,
        });
        toast({
          variant: 'destructive',
          title: 'Test Fallito',
          description: res.error || 'Il modello non ha risposto.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Errore di rete o autorizzazione.',
        testedModel: modelToTest,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveModel = async () => {
    const modelToSave = selectedModel.trim();
    if (!modelToSave) {
      toast({
        variant: 'destructive',
        title: 'Nome mancante',
        description: 'Specifica un modello valido prima di salvare.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await actions.saveAiModelConfigAction(modelToSave);
      if (res.success && res.data) {
        setActiveModel(res.data.activeModel);
        setSelectedModel(res.data.activeModel);
        setSource('database');
        if (res.data.models) {
          setModels(res.data.models);
        }
        setCustomModelInput('');
        toast({
          title: 'Modello IA Aggiornato!',
          description: `Ora tutte le generazioni useranno ${res.data.activeModel}.`,
        });
      } else {
        throw new Error(res.error || 'Impossibile salvare il modello.');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Errore Salvataggio',
        description: err?.message || 'Non è stato possibile salvare la configurazione.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Box di Stato Attuale */}
      <Card className="border-amber-500/30 bg-card/70 backdrop-blur-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-amber-400" />
                <CardTitle className="text-base font-headline uppercase tracking-wider text-amber-300">
                  Motore IA Attivo
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-300">
                  {source === 'database' ? 'Persistito (DB)' : source === 'env' ? 'Da ENV' : 'Predefinito'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Modello impiegato per narrazione, NPC, combattimenti, negozi, lore enciclopedica e analisi cronache.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button 
                id="btn-refresh-model-config"
                variant="outline" 
                size="sm" 
                onClick={loadConfig} 
                disabled={isLoading}
                className="h-8 gap-1.5 text-xs border-amber-500/30 hover:bg-amber-950/20 text-amber-200"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                Ricarica
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-neutral-950/60 border border-amber-500/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Modello In Uso</div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-sm sm:text-base font-mono font-bold text-amber-200 break-all">
                    {activeModel}
                  </span>
                  {activeModel.includes('2.5') && (
                    <Badge variant="destructive" className="text-[10px] px-2 py-0.5 h-auto whitespace-nowrap shrink-0">
                      EOL Ottobre 2026
                    </Badge>
                  )}
                  {(activeModel.includes('3.8') || activeModel.includes('3.7')) && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-2 py-0.5 h-auto whitespace-nowrap shrink-0 font-sans shadow-sm font-medium">
                      Nuova Generazione
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right text-[11px] text-muted-foreground shrink-0">
              Fallback automatico integrato contro errori 503
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selezione Modelli AI */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> Modelli AI
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {models.length} {models.length === 1 ? 'modello disponibile' : 'modelli disponibili'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((preset) => {
            const isSelected = selectedModel === preset.id;
            const isCurrentlyActive = activeModel === preset.id;
            const isDeleting = deletingModelId === preset.id;

            return (
              <div
                key={preset.id}
                id={`preset-${preset.id}`}
                onClick={() => handleSelectPreset(preset.id)}
                className={cn(
                  "p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between relative group",
                  isSelected 
                    ? "border-amber-400 bg-amber-500/10 shadow-sm shadow-amber-500/10" 
                    : "border-border/50 bg-card/60 hover:border-amber-500/40 hover:bg-card/90"
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold tracking-tight text-foreground truncate flex-1" title={preset.label}>
                      {preset.label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {preset.badge && (
                        <Badge variant={preset.badgeVariant || 'outline'} className="text-[9px] px-1.5 py-0.5 h-auto whitespace-nowrap">
                          {preset.badge}
                        </Badge>
                      )}
                      <button
                        type="button"
                        id={`btn-delete-model-${preset.id}`}
                        title={`Elimina ${preset.label} dalla lista`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteModel(preset.id, preset.label);
                        }}
                        disabled={isDeleting || models.length <= 1}
                        className="opacity-60 group-hover:opacity-100 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all disabled:opacity-30"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
                    {preset.description}
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-between text-[10px]">
                  {isCurrentlyActive ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Attivo in questo momento
                    </span>
                  ) : isSelected ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> Selezionato (da salvare)
                    </span>
                  ) : (
                    <span className="text-muted-foreground group-hover:text-amber-300 transition-colors">
                      Clicca per scegliere
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inserimento Nome Modello Personalizzato */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Inserisci Nome Modello Personalizzato
          </CardTitle>
          <CardDescription className="text-xs">
            Digita qualsiasi identificativo valido di Google Gemini (es. <code className="text-amber-300 font-mono">gemini-3.8-flash</code>, <code className="text-amber-300 font-mono">gemini-3.7-flash</code>, <code className="text-amber-300 font-mono">gemini-3.5-pro</code>, o endpoint sperimentale). Verrà aggiunto alla lista dei <strong>Modelli AI</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleAddCustomModel} className="flex flex-col sm:flex-row gap-2">
            <Input
              id="input-custom-ai-model"
              placeholder="es. gemini-3.8-flash"
              value={customModelInput}
              onChange={handleCustomInputChange}
              className="font-mono text-xs h-10 border-border/70 focus-visible:ring-amber-500 flex-1"
            />
            <Button
              id="btn-add-ai-model"
              type="submit"
              variant="secondary"
              disabled={isAdding || !customModelInput.trim()}
              className="h-10 text-xs uppercase font-bold gap-1.5 shrink-0"
            >
              {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Aggiungi alla Lista
            </Button>
            <Button
              id="btn-test-ai-model"
              type="button"
              variant="outline"
              onClick={handleTestModel}
              disabled={isTesting || !selectedModel.trim()}
              className="h-10 text-xs uppercase font-bold border-border/70 hover:bg-accent gap-2 shrink-0"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Testa Connessione
            </Button>
            <Button
              id="btn-save-ai-model"
              type="button"
              onClick={handleSaveModel}
              disabled={isSaving || selectedModel === activeModel || !selectedModel.trim()}
              className="h-10 text-xs uppercase font-bold bg-amber-600 hover:bg-amber-500 text-stone-950 gap-2 shrink-0 shadow-md shadow-amber-600/20"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Salva ed Applica
            </Button>
          </form>

          {/* Risultato del Test Connessione */}
          {testResult && (
            <div className={cn(
              "p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-all",
              testResult.success 
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" 
                : "border-destructive/30 bg-destructive/10 text-destructive-foreground"
            )}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-bold flex items-center gap-2">
                  <span>{testResult.success ? 'Connessione Riuscita!' : 'Test Fallito'}</span>
                  {testResult.latencyMs !== undefined && (
                    <Badge variant="outline" className="text-[10px] h-4">
                      {testResult.latencyMs} ms
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] opacity-90">
                  {testResult.success ? testResult.message : testResult.error}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-muted-foreground gap-2 pt-1">
            <span>
              Modello pronto da applicare: <strong className="font-mono text-amber-200">{selectedModel}</strong>
            </span>
            {selectedModel !== activeModel && (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <Clock className="h-3 w-3" /> Modifiche non ancora salvate
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configurazione Modello per Singole Sezioni dell'App */}
      <Card className="border-amber-500/30 bg-card/60 backdrop-blur-sm">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-headline uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" />
                Assegnazione Modelli IA per Singole Sezioni
              </CardTitle>
              <CardDescription className="text-xs">
                Scegli quale modello Gemini utilizzare per ogni specifica funzionalità dell&apos;applicazione. Seleziona &quot;Predefinito di Sistema&quot; per ereditare il modello globale attivo.
              </CardDescription>
            </div>
            <Button
              id="btn-save-section-models"
              size="sm"
              onClick={handleSaveSectionModels}
              disabled={isSavingSections}
              className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs gap-1.5 shrink-0"
            >
              {isSavingSections ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Salva Assegnazione Sezioni
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                key: 'STORY',
                label: 'Narrazione & Sessioni',
                description: 'Generazione riassunti sessioni, sinossi narrative, archi narrativi e idee plot.',
                badge: 'Storyteller'
              },
              {
                key: 'WORLD',
                label: 'Mondo, PNG & Incontri',
                description: 'Identità PNG, schede luoghi, generatori combattimento e spunti veloci.',
                badge: 'World Architect'
              },
              {
                key: 'SHOPS',
                label: 'Negozi & Tesori',
                description: 'Generazione inventari negozi, tesori, ricompense ed oggetti magici.',
                badge: 'Economy'
              },
              {
                key: 'IMPORT',
                label: 'Importatore & OCR Manuali',
                description: 'Catalogazione ed estrazione strutturata da foto di manuali, PDF ed immagini.',
                badge: 'Vision & Parser'
              },
              {
                key: 'EXTRACTION',
                label: 'Estrazione Testo Grezzo',
                description: 'Trascrizione OCR di file immagine grezzi e scansioni.',
                badge: 'OCR Base'
              }
            ].map(sec => {
              const currentVal = sectionModels[sec.key] || 'default';

              return (
                <div key={sec.key} className="p-3 rounded-lg bg-neutral-950/50 border border-border/50 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-amber-200">{sec.label}</span>
                      <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-500/30 text-amber-400">
                        {sec.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                      {sec.description}
                    </p>
                  </div>

                  <select
                    id={`select-section-model-${sec.key}`}
                    value={currentVal}
                    onChange={(e) => handleSectionModelChange(sec.key, e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 font-mono"
                  >
                    <option value="default">🌐 Predefinito di Sistema ({activeModel})</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>
                        ⚡ {m.label || m.id} ({m.id})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
