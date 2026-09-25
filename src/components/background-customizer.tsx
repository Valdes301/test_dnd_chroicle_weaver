'use client';

import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Sparkles, 
  Image as ImageIcon, 
  Upload, 
  Link as LinkIcon, 
  RotateCcw, 
  Sliders, 
  Check, 
  Layers, 
  Eye, 
  Lock, 
  LayoutGrid, 
  Scroll, 
  ShieldCheck, 
  Info,
  Trash2,
  Loader2,
  FolderOpen,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  BackgroundTarget, 
  BackgroundConfig, 
  BackgroundSettings, 
  PRESETS_MAIN, 
  PRESETS_DASHBOARD, 
  PRESETS_PIN, 
  getBackgroundSettings, 
  DEFAULT_BACKGROUND_SETTINGS,
  saveBackgroundSettings, 
  updateBackgroundConfig, 
  resetBackgroundTarget, 
  resetAllBackgrounds,
  PresetBackground 
} from '@/lib/background-storage';
import * as actions from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

export function BackgroundCustomizer() {
  const [settings, setSettings] = useState<BackgroundSettings>(DEFAULT_BACKGROUND_SETTINGS);
  const [activeTarget, setActiveTarget] = useState<BackgroundTarget>('main');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [savedAssets, setSavedAssets] = useState<any[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const { toast } = useToast();

  const loadAssets = async () => {
    setIsLoadingAssets(true);
    try {
      const res = await actions.listAssetsAction();
      if (res.success && res.data) {
        setSavedAssets(res.data);
      }
    } catch (e) {
      console.error("Error loading assets", e);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    setSettings(getBackgroundSettings());
    loadAssets();

    const handleBgChange = (e: any) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    const handleAssetsUpdated = () => {
      loadAssets();
    };

    window.addEventListener('dnd-backgrounds-changed', handleBgChange);
    window.addEventListener('dnd-assets-updated', handleAssetsUpdated);
    return () => {
      window.removeEventListener('dnd-backgrounds-changed', handleBgChange);
      window.removeEventListener('dnd-assets-updated', handleAssetsUpdated);
    };
  }, []);

  const currentConfig: BackgroundConfig = settings[activeTarget];
  const presets: PresetBackground[] = activeTarget === 'main' 
    ? PRESETS_MAIN 
    : activeTarget === 'dashboard' 
    ? PRESETS_DASHBOARD 
    : PRESETS_PIN;

  const handleSelectPreset = (preset: PresetBackground) => {
    const updated = updateBackgroundConfig(activeTarget, {
      type: 'preset',
      presetId: preset.id,
      customUrl: undefined,
      opacity: preset.defaultOpacity ?? currentConfig.opacity,
      overlayDarkness: preset.defaultOverlayDarkness ?? currentConfig.overlayDarkness,
    });
    setSettings(updated);
    toast({
      title: "Sfondo Aggiornato",
      description: `Applicato: ${preset.name}`,
    });
  };

  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    const updated = updateBackgroundConfig(activeTarget, {
      type: 'custom_url',
      customUrl: customUrlInput.trim(),
      presetId: undefined
    });
    setSettings(updated);
    setCustomUrlInput('');
    toast({
      title: "Sfondo Personalizzato Applicato",
      description: "L'immagine da URL è stata impostata.",
    });
  };

  const handleSelectSavedAsset = (assetUrl: string, assetName: string) => {
    const updated = updateBackgroundConfig(activeTarget, {
      type: 'custom_file',
      customUrl: assetUrl,
      presetId: undefined
    });
    setSettings(updated);
    toast({
      title: "Asset Applicato",
      description: `Sfondo impostato da: ${assetName}`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File troppo pesante",
        description: "Seleziona un'immagine inferiore a 8MB.",
      });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        try {
          const filename = `sfondo_${activeTarget}_${Date.now()}.jpg`;
          const result = await actions.uploadCardBackground(dataUrl, filename);
          const uploadedUrl = (result.data as any)?.url || `/api/assets/${encodeURIComponent(filename)}`;
          if (result.success) {
            const updated = updateBackgroundConfig(activeTarget, {
              type: 'custom_file',
              customUrl: uploadedUrl,
              presetId: undefined
            });
            setSettings(updated);
            loadAssets();
            window.dispatchEvent(new CustomEvent('dnd-assets-updated'));
            toast({
              title: "Immagine Salvata e Applicata",
              description: `Sfondo salvato nella cartella persistente degli asset (${filename}) e incluso nel backup immagini!`,
            });
          } else {
            throw new Error(result.error || "Errore durante il salvataggio");
          }
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: 'Errore di caricamento',
            description: err.message || 'Impossibile salvare l\'immagine negli asset.',
          });
        } finally {
          setIsUploading(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetCurrent = () => {
    const updated = resetBackgroundTarget(activeTarget);
    setSettings(updated);
    toast({
      title: "Sfondo Ripristinato",
      description: "Impostazioni predefinite ricaricate per questa schermata.",
    });
  };

  const handleResetAll = () => {
    const updated = resetAllBackgrounds();
    setSettings(updated);
    toast({
      title: "Tutti gli Sfondi Ripristinati",
      description: "Tutte le schermate sono tornate all'aspetto predefinito.",
    });
  };

  // Calcolo stile di anteprima live per il target corrente
  const getPreviewBgStyle = () => {
    let bg = '';
    if (currentConfig.type === 'custom_url' || currentConfig.type === 'custom_file') {
      if (currentConfig.customUrl) {
        bg = `url("${currentConfig.customUrl}")`;
      }
    } else {
      const preset = presets.find(p => p.id === currentConfig.presetId) || presets[0];
      if (preset.imageUrl) {
        bg = `url("${preset.imageUrl}")`;
      } else if (preset.cssBackground) {
        bg = preset.cssBackground;
      } else {
        bg = preset.previewGradient;
      }
    }
    return bg;
  };

  return (
    <div className="space-y-6">
      {/* Header con Titolo & Azioni rapide */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <h3 className="text-lg font-headline font-semibold text-stone-100 flex items-center gap-2">
            <Palette className="h-5 w-5 text-amber-500" />
            Personalizzazione Sfondi & Atmosfera
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scegli sfondi fantasy tematici o carica illustrazioni per la schermata principale (Taverna), la bacheca (Tavolo di Legno) e il sigillo PIN (Antico Libro).
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 border-stone-700 hover:bg-stone-800 text-stone-300">
              <RotateCcw className="h-3.5 w-3.5" />
              Ripristina Tutti i Predefiniti
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-stone-950 border-stone-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-amber-300">Ripristinare tutti gli sfondi?</AlertDialogTitle>
              <AlertDialogDescription className="text-stone-400 text-xs">
                Questa operazione riporterà la schermata principale, la bacheca della taverna e la schermata PIN alle ambientazioni originali predefinite.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-stone-900 border-stone-800 text-stone-300">Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAll} className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold">
                Conferma Ripristino
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Selettore Schermata (3 Target Richiesti) */}
      <Tabs value={activeTarget} onValueChange={(v) => setActiveTarget(v as BackgroundTarget)} className="w-full">
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 w-full h-auto bg-stone-950/80 p-1.5 border border-stone-800 rounded-xl gap-1.5">
          <TabsTrigger 
            value="main" 
            className="w-full py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg data-[state=active]:bg-amber-600/25 data-[state=active]:text-amber-200 font-medium text-xs sm:text-sm whitespace-normal transition-all"
          >
            <LayoutGrid className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Schermata Principale & Backup</span>
          </TabsTrigger>
          <TabsTrigger 
            value="dashboard" 
            className="w-full py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg data-[state=active]:bg-amber-600/25 data-[state=active]:text-amber-200 font-medium text-xs sm:text-sm whitespace-normal transition-all"
          >
            <Scroll className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Bacheca Taverna</span>
          </TabsTrigger>
          <TabsTrigger 
            value="pin" 
            className="w-full py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg data-[state=active]:bg-amber-600/25 data-[state=active]:text-amber-200 font-medium text-xs sm:text-sm whitespace-normal transition-all"
          >
            <Lock className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Schermata Sigillo PIN</span>
          </TabsTrigger>
        </TabsList>

        {/* Contenuto per il Target Selezionato */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Colonna Sinistra: Galleria Preset & Custom Upload (7 Colonne) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Galleria Preset */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-serif uppercase tracking-widest text-amber-400/90 font-bold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Seleziona Ambientazione Preset
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {presets.length} Temi Disponibili
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {presets.map((preset) => {
                  const isSelected = currentConfig.type === 'preset' && currentConfig.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`relative group rounded-xl p-3 text-left transition-all border overflow-hidden flex flex-col justify-between min-h-[105px] ${
                        isSelected 
                          ? 'border-amber-500 ring-2 ring-amber-500/40 bg-stone-900/90 shadow-[0_0_20px_rgba(245,158,11,0.15)]' 
                          : 'border-stone-800 hover:border-stone-700 bg-stone-950/60 hover:bg-stone-900/50'
                      }`}
                    >
                      {/* Mini Preview Sfondo nel Card */}
                      <div 
                        className="absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity bg-cover bg-center pointer-events-none"
                        style={{
                          backgroundImage: preset.imageUrl ? `url("${preset.imageUrl}")` : (preset.cssBackground || preset.previewGradient),
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent pointer-events-none" />

                      <div className="relative z-10 flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider py-0 px-1.5 border-amber-500/30 text-amber-300/80 bg-stone-950/80 mb-1">
                            {preset.category}
                          </Badge>
                          <h4 className="font-serif font-bold text-xs sm:text-sm text-stone-100 group-hover:text-amber-200 transition-colors">
                            {preset.name}
                          </h4>
                        </div>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in-50">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <p className="relative z-10 text-[11px] text-stone-400 font-sans line-clamp-2 mt-2 leading-tight">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opzioni Immagine Personalizzata & Galleria Asset Salvati */}
            <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-serif uppercase tracking-widest text-amber-400 font-bold">
                  <ImageIcon className="h-3.5 w-3.5 text-amber-500" />
                  Immagini Personalizzate & Asset Salvati
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={loadAssets} 
                  disabled={isLoadingAssets}
                  className="h-6 px-2 text-[10px] text-stone-400 hover:text-amber-300"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingAssets ? 'animate-spin' : ''}`} />
                  Aggiorna Asset
                </Button>
              </div>

              {/* Upload Diretto salvato in Volume Persistente */}
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-300">Carica Nuova Immagine (Salvataggio in Memoria e Backup)</Label>
                <label className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-stone-700 hover:border-amber-500/60 bg-stone-900/40 hover:bg-stone-900/80 cursor-pointer transition-all text-xs text-stone-300 group">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  ) : (
                    <Upload className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                  )}
                  <span>{isUploading ? 'Salvataggio asset in corso...' : 'Clicca per caricare un file (JPG, PNG, WebP)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Le immagini caricate vengono salvate nella cartella persistente degli asset e incluse nel backup delle immagini scaricabile.
                </p>
              </div>

              {/* Galleria degli Asset Già Salvati */}
              {savedAssets.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-stone-800/80">
                  <Label className="text-xs text-stone-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                      Scegli tra gli Asset già presenti ({savedAssets.length})
                    </span>
                    <span className="text-[10px] text-muted-foreground">Clicca un'immagine per applicarla</span>
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1 p-1 bg-stone-900/30 rounded-lg border border-stone-800">
                    {savedAssets.map((asset) => {
                      const isSelected = (currentConfig.type === 'custom_file' || currentConfig.type === 'custom_url') && currentConfig.customUrl === asset.url;
                      return (
                        <button
                          key={asset.name}
                          type="button"
                          onClick={() => handleSelectSavedAsset(asset.url, asset.name)}
                          className={`group relative rounded-md overflow-hidden aspect-video border transition-all ${
                            isSelected 
                              ? 'border-amber-500 ring-2 ring-amber-500/50' 
                              : 'border-stone-800 hover:border-amber-500/40 opacity-80 hover:opacity-100'
                          }`}
                          title={asset.name}
                        >
                          <img 
                            src={asset.url} 
                            alt={asset.name} 
                            className="w-full h-full object-cover" 
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1">
                            <span className="text-[8px] text-stone-200 truncate w-full font-mono">{asset.name}</span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-amber-500 text-stone-950 rounded-full p-0.5 shadow">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Inserimento URL Esterno */}
              <div className="space-y-1.5 pt-2 border-t border-stone-800/80">
                <Label className="text-xs text-stone-300">Oppure Inserisci URL Immagine Esterno</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
                    <Input
                      type="url"
                      placeholder="https://esempio.com/sfondo-fantasy.jpg"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomUrl()}
                      className="pl-8 text-xs bg-stone-900/80 border-stone-800 h-9"
                    />
                  </div>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={handleApplyCustomUrl}
                    disabled={!customUrlInput.trim()}
                    className="h-9 px-3 text-xs bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold shrink-0"
                  >
                    Applica
                  </Button>
                </div>
              </div>

              {/* Mostra badge se è attivo custom */}
              {(currentConfig.type === 'custom_url' || currentConfig.type === 'custom_file') && (
                <div className="flex items-center justify-between p-2 rounded bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200">
                  <span className="flex items-center gap-1.5 truncate">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Sfondo personalizzato attivo: <strong className="font-mono text-[11px]">{currentConfig.customUrl}</strong></span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetCurrent}
                    className="h-6 text-[10px] text-stone-400 hover:text-red-300 shrink-0"
                  >
                    Ripristina
                  </Button>
                </div>
              )}
            </div>

          </div>

          {/* Colonna Destra: Regolazioni Fine-Tuning & Anteprima Live (5 Colonne) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Box Anteprima Live */}
            <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-serif uppercase tracking-widest text-stone-300 font-bold flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-amber-400" />
                  Anteprima in Tempo Reale
                </span>
                <Badge variant="outline" className="text-[10px] border-stone-800 text-stone-400">
                  {activeTarget === 'main' ? 'Schermata Principale' : activeTarget === 'dashboard' ? 'Bacheca' : 'Sigillo PIN'}
                </Badge>
              </div>

              {/* Miniatura Mockup Schermata */}
              <div className="relative w-full h-44 rounded-lg overflow-hidden border border-stone-800 bg-stone-950 shadow-inner flex flex-col justify-between p-3 select-none">
                
                {/* Sfondo attivo con stili applicati */}
                <div 
                  className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-300"
                  style={{
                    backgroundImage: getPreviewBgStyle(),
                    opacity: currentConfig.opacity,
                    filter: currentConfig.blur > 0 ? `blur(${currentConfig.blur}px)` : undefined,
                  }}
                />

                {/* Overlay di oscuramento */}
                <div 
                  className="absolute inset-0 pointer-events-none transition-all duration-300"
                  style={{
                    backgroundColor: `rgba(0, 0, 0, ${currentConfig.overlayDarkness})`
                  }}
                />

                {/* Trama sovrapposta se presente */}
                {currentConfig.textureOverlay === 'dots' && (
                  <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
                )}
                {currentConfig.textureOverlay === 'vignette' && (
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
                )}

                {/* Contenuto simulato del mockup a seconda del target */}
                {activeTarget === 'main' && (
                  <div className="relative z-10 w-full h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-stone-700/40 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-headline font-bold text-amber-200">La Forgia delle Cronache</span>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 h-2 rounded bg-stone-700/50" />
                        <div className="w-4 h-2 rounded bg-amber-500/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 my-auto">
                      <div className="p-2 rounded bg-stone-900/80 border border-stone-700/50 text-[9px] text-stone-300">
                        🛡️ Sessione Attiva
                      </div>
                      <div className="p-2 rounded bg-stone-900/80 border border-stone-700/50 text-[9px] text-stone-300">
                        ⚔️ Registro Eroi
                      </div>
                    </div>
                    <div className="text-[8px] text-stone-400 italic text-center">Interfaccia Principale del Master</div>
                  </div>
                )}

                {activeTarget === 'dashboard' && (
                  <div className="relative z-10 w-full h-full flex flex-col justify-between">
                    <div className="text-[11px] font-serif font-bold text-amber-300 text-center border-b border-amber-900/40 pb-1">
                      📜 Bacheca della Taverna
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 my-auto">
                      <div className="p-1.5 rounded bg-amber-950/60 border border-amber-700/30 text-[8px] text-amber-200 text-center font-serif">
                        Avviso di Taglia
                      </div>
                      <div className="p-1.5 rounded bg-stone-900/80 border border-stone-700/30 text-[8px] text-stone-300 text-center">
                        Mappa Locale
                      </div>
                      <div className="p-1.5 rounded bg-amber-950/60 border border-amber-700/30 text-[8px] text-amber-200 text-center font-serif">
                        Contratto
                      </div>
                    </div>
                    <div className="text-[8px] text-stone-400 italic text-center">Visualizzazione Note e Schede</div>
                  </div>
                )}

                {activeTarget === 'pin' && (
                  <div className="relative z-10 w-full h-full flex flex-col items-center justify-center space-y-2">
                    <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-[10px] font-headline font-bold text-stone-200">Inserisci Sigillo d'Accesso</div>
                    <div className="flex gap-1.5">
                      {[1,2,3,4].map(n => (
                        <div key={n} className="w-2.5 h-2.5 rounded-full border border-amber-500/40 bg-amber-500/20" />
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Slider di Regolazione Fine */}
            <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-4 space-y-5">
              <span className="text-xs font-serif uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-amber-500" />
                Regolazioni Ottiche Schermata
              </span>

              {/* Slider Opacità */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-stone-300">Intensità / Opacità Immagine</Label>
                  <span className="font-mono text-amber-400 text-xs">{Math.round(currentConfig.opacity * 100)}%</span>
                </div>
                <Slider
                  value={[currentConfig.opacity * 100]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={([val]) => {
                    const updated = updateBackgroundConfig(activeTarget, { opacity: val / 100 });
                    setSettings(updated);
                  }}
                  className="cursor-pointer"
                />
              </div>

              {/* Slider Oscuramento / Contrasto */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-stone-300">Oscuramento Overlay (Leggibilità)</Label>
                  <span className="font-mono text-amber-400 text-xs">{Math.round(currentConfig.overlayDarkness * 100)}%</span>
                </div>
                <Slider
                  value={[currentConfig.overlayDarkness * 100]}
                  min={0}
                  max={90}
                  step={5}
                  onValueChange={([val]) => {
                    const updated = updateBackgroundConfig(activeTarget, { overlayDarkness: val / 100 });
                    setSettings(updated);
                  }}
                  className="cursor-pointer"
                />
              </div>

              {/* Slider Sfocatura (Blur) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-stone-300">Sfocatura Artistica (Blur)</Label>
                  <span className="font-mono text-amber-400 text-xs">{currentConfig.blur}px</span>
                </div>
                <Slider
                  value={[currentConfig.blur]}
                  min={0}
                  max={12}
                  step={1}
                  onValueChange={([val]) => {
                    const updated = updateBackgroundConfig(activeTarget, { blur: val });
                    setSettings(updated);
                  }}
                  className="cursor-pointer"
                />
              </div>

              {/* Texture Sovrapposta */}
              <div className="space-y-2 pt-2 border-t border-stone-800">
                <Label className="text-xs text-stone-300">Filtro Texture d'Ambiente</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={currentConfig.textureOverlay === 'none' ? 'default' : 'outline'}
                    onClick={() => {
                      const updated = updateBackgroundConfig(activeTarget, { textureOverlay: 'none' });
                      setSettings(updated);
                    }}
                    className={`text-xs h-8 ${currentConfig.textureOverlay === 'none' ? 'bg-amber-600 text-stone-950 font-bold' : 'border-stone-800 text-stone-300'}`}
                  >
                    Nessuna
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={currentConfig.textureOverlay === 'vignette' ? 'default' : 'outline'}
                    onClick={() => {
                      const updated = updateBackgroundConfig(activeTarget, { textureOverlay: 'vignette' });
                      setSettings(updated);
                    }}
                    className={`text-xs h-8 ${currentConfig.textureOverlay === 'vignette' ? 'bg-amber-600 text-stone-950 font-bold' : 'border-stone-800 text-stone-300'}`}
                  >
                    Vignettatura
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={currentConfig.textureOverlay === 'dots' ? 'default' : 'outline'}
                    onClick={() => {
                      const updated = updateBackgroundConfig(activeTarget, { textureOverlay: 'dots' });
                      setSettings(updated);
                    }}
                    className={`text-xs h-8 ${currentConfig.textureOverlay === 'dots' ? 'bg-amber-600 text-stone-950 font-bold' : 'border-stone-800 text-stone-300'}`}
                  >
                    Puntinato D&D
                  </Button>
                </div>
              </div>

              {/* Bottone Ripristino Target Corrente */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetCurrent}
                  className="w-full text-xs text-stone-400 hover:text-amber-300 hover:bg-stone-900 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Ripristina Default per Questa Schermata
                </Button>
              </div>

            </div>

          </div>

        </div>
      </Tabs>
    </div>
  );
}
