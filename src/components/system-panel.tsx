'use client';

import { useState } from 'react';
import type { CampaignWithRelations } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Lock, 
  KeyRound, 
  Hammer, 
  Settings, 
  Download, 
  Image as ImageIcon, 
  Upload, 
  Plus, 
  ShieldCheck, 
  Database, 
  Sliders,
  Sparkles,
  Palette,
  Bot,
  Cpu
} from 'lucide-react';
import { SettingsView } from './settings-view';
import { HomebrewCompendium } from './homebrew-compendium';
import { BackgroundCustomizer } from './background-customizer';
import { AiModelSelector } from './ai-model-selector';
import { isPinConfigured, setIsLocked } from '@/lib/pin-storage';
import { useToast } from '@/hooks/use-toast';
import { PlayerPermissionsMatrix } from './player-permissions-matrix';

type SystemPanelProps = {
  campaign: CampaignWithRelations;
  onOpenPinConfig: () => void;
  onBackupData: () => void;
  onBackupImages: () => void;
  onNewCampaign: () => void;
};

export function SystemPanel({
  campaign,
  onOpenPinConfig,
  onBackupData,
  onBackupImages,
  onNewCampaign,
}: SystemPanelProps) {
  const [activeTab, setActiveTab] = useState<'control' | 'backgrounds' | 'settings' | 'homebrew' | 'model' | 'permissions'>('control');
  const { toast } = useToast();

  const handleQuickLock = () => {
    if (isPinConfigured()) {
      setIsLocked(true);
      toast({ title: "Schermo Sigillato", description: "Inserisci il PIN per riprendere." });
    } else {
      onOpenPinConfig();
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full h-auto bg-neutral-900/80 p-1.5 border border-border/40 rounded-xl mb-6 gap-1.5">
          <TabsTrigger 
            id="tab-system-control"
            value="control" 
            className="w-full h-auto py-2.5 px-2.5 flex items-center justify-center gap-1.5 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium text-xs sm:text-sm whitespace-normal transition-all text-center"
          >
            <Sliders className="h-4 w-4 shrink-0" />
            <span>Gestione &amp; Backup</span>
          </TabsTrigger>
          <TabsTrigger 
            id="tab-system-permissions"
            value="permissions" 
            className="w-full h-auto py-2.5 px-2.5 flex items-center justify-center gap-1.5 rounded-lg data-[state=active]:bg-amber-600/25 data-[state=active]:text-amber-200 font-medium text-xs sm:text-sm whitespace-normal transition-all text-center"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Schede Giocatori</span>
          </TabsTrigger>
          <TabsTrigger 
            id="tab-system-model"
            value="model" 
            className="w-full h-auto py-2.5 px-2.5 flex items-center justify-center gap-1.5 rounded-lg data-[state=active]:bg-amber-600/25 data-[state=active]:text-amber-200 font-medium text-xs sm:text-sm whitespace-normal transition-all text-center"
          >
            <Bot className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Modello IA</span>
          </TabsTrigger>
          <TabsTrigger 
            id="tab-system-backgrounds"
            value="backgrounds" 
            className="w-full h-auto py-2.5 px-2.5 flex items-center justify-center gap-1.5 rounded-lg data-[state=active]:bg-amber-600/25 data-[state=active]:text-amber-200 font-medium text-xs sm:text-sm whitespace-normal transition-all text-center"
          >
            <Palette className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Sfondi &amp; Tema</span>
          </TabsTrigger>
          <TabsTrigger 
            id="tab-system-settings"
            value="settings" 
            className="w-full h-auto py-2.5 px-2.5 flex items-center justify-center gap-1.5 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium text-xs sm:text-sm whitespace-normal transition-all text-center"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Stato Sistema &amp; API</span>
          </TabsTrigger>
          <TabsTrigger 
            id="tab-system-homebrew"
            value="homebrew" 
            className="w-full h-auto py-2.5 px-2.5 flex items-center justify-center gap-1.5 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium text-xs sm:text-sm whitespace-normal transition-all text-center"
          >
            <Hammer className="h-4 w-4 shrink-0" />
            <span>Compendio Homebrew</span>
          </TabsTrigger>
        </TabsList>

        {/* Scheda 1: Controlli, Sicurezza e Backup */}
        <TabsContent value="control" className="space-y-6 mt-0">
          
          {/* Sezione Selezione Modello IA */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 uppercase tracking-wider">
              <Bot className="h-4 w-4 text-amber-400" /> Motore IA Generativo (Gemini)
            </div>
            <Card className="bg-card/60 border-amber-500/20 hover:border-amber-500/40 transition-all">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-300">
                  <Bot className="h-5 w-5 text-amber-400" />
                  Configurazione &amp; Cambio Modello IA
                </CardTitle>
                <CardDescription className="text-xs">
                  Scegli o inserisci il modello Gemini attivo (es. gemini-3.8-flash, gemini-3.7-flash) per narrazione, PNG e lore. Verifica le date di dismissione e testa la connettività.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Button 
                  id="btn-open-ai-model-tab"
                  onClick={() => setActiveTab('model')} 
                  className="w-full sm:w-auto bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 gap-2"
                >
                  <Bot className="h-4 w-4" />
                  Gestisci Modello IA
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sezione Personalizzazione Sfondi Rapida */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 uppercase tracking-wider">
              <Palette className="h-4 w-4 text-amber-400" /> Personalizzazione Grafica
            </div>
            <Card className="bg-card/60 border-amber-500/20 hover:border-amber-500/40 transition-all">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-300">
                  <Palette className="h-5 w-5 text-amber-400" />
                  Sfondi Schermate (Principale, Bacheca & Sigillo PIN)
                </CardTitle>
                <CardDescription className="text-xs">
                  Modifica l'atmosfera visiva impostando preset fantasy, illustrazioni personalizzate o sfondi da file/URL con regolazione di trasparenza e contrasto.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Button 
                  onClick={() => setActiveTab('backgrounds')} 
                  className="w-full sm:w-auto bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 gap-2"
                >
                  <Palette className="h-4 w-4" />
                  Apri Personalizzazione Sfondi
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sezione Sicurezza */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" /> Sicurezza &amp; Permessi Giocatori
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/60 border-amber-500/20 hover:border-amber-500/40 transition-all">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-300">
                    <Lock className="h-5 w-5 text-amber-400" />
                    Sigilla Schermo (PIN)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Blocca istantaneamente lo schermo nascondendo le informazioni del DM agli sguardi indiscreti.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Button 
                    onClick={handleQuickLock} 
                    className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Sigilla Schermo Ora
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-amber-500/20 hover:border-amber-500/40 transition-all">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-300">
                    <KeyRound className="h-5 w-5 text-amber-400" />
                    Configura PIN &amp; Timer
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Imposta il PIN numerico, la password di ripristino d'emergenza e il tempo di blocco per inattività.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Button 
                    onClick={onOpenPinConfig}
                    variant="outline"
                    className="w-full border-amber-500/30 hover:bg-amber-950/30 text-amber-200 gap-2"
                  >
                    <KeyRound className="h-4 w-4 text-amber-400" />
                    Gestisci PIN &amp; Timer
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-amber-500/20 hover:border-amber-500/40 transition-all">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-300">
                    <ShieldCheck className="h-5 w-5 text-amber-400" />
                    Visibilità Schede
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Seleziona quali sezioni, botteghe, mappe e compendi nascondere o mostrare ai giocatori connessi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Button 
                    onClick={() => setActiveTab('permissions')}
                    variant="outline"
                    className="w-full border-amber-500/30 hover:bg-amber-950/30 text-amber-200 gap-2"
                  >
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    Configura Visibilità
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sezione Backup & Ripristino */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
              <Database className="h-4 w-4" /> Backup & Ripristino
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Card className="bg-card/60 border-border/50 hover:border-border transition-all">
                <CardHeader className="p-3.5 sm:p-4 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary shrink-0" />
                    <span>Backup Dati</span>
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Esporta un file JSON compatto contenente tutte le storie, schede, magie e PNG.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 sm:p-4 pt-2">
                  <Button onClick={onBackupData} variant="secondary" className="w-full text-xs gap-2">
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>Scarica Backup Dati</span>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/50 hover:border-border transition-all">
                <CardHeader className="p-3.5 sm:p-4 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                    <span>Backup Immagini</span>
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Esporta tutte le illustrazioni, ritratti e mappe salvate localmente per la campagna.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 sm:p-4 pt-2">
                  <Button onClick={onBackupImages} variant="secondary" className="w-full text-xs gap-2">
                    <ImageIcon className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                    <span>Scarica Backup Immagini</span>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/50 hover:border-border transition-all sm:col-span-2 md:col-span-1">
                <CardHeader className="p-3.5 sm:p-4 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Upload className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Ripristina Backup</span>
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Carica un file JSON salvato in precedenza per ripristinare dati o immagini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 sm:p-4 pt-2">
                  <Button asChild variant="outline" className="w-full text-xs gap-2 cursor-pointer border-emerald-500/30 hover:bg-emerald-950/20 text-emerald-300">
                    <label htmlFor="restore-backup-input" className="cursor-pointer flex items-center justify-center gap-2 w-full h-full">
                      <Upload className="h-3.5 w-3.5 shrink-0" />
                      <span>Ripristina Backup</span>
                    </label>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sezione Gestione Campagna */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-400 uppercase tracking-wider">
              <Sparkles className="h-4 w-4" /> Gestione Campagne
            </div>
            <Card className="bg-card/60 border-rose-500/20 hover:border-rose-500/40 transition-all">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-rose-300">
                  <Plus className="h-5 w-5 text-rose-400" />
                  Nuova Campagna
                </CardTitle>
                <CardDescription className="text-xs">
                  Inizia il processo per creare un nuova campagna o importarne una da zero. La campagna attuale rimarrà salvata.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto text-xs gap-2">
                      <Plus className="h-4 w-4" />
                      Crea Nuova Campagna
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[95vw]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Creare una Nuova Campagna?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Questo ti porterà alla schermata di creazione di una nuova campagna. La campagna attuale non sarà modificata né eliminata.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={onNewCampaign}>Continua</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* Scheda Modello IA & Motore */}
        <TabsContent value="model" className="space-y-4 mt-0">
          <AiModelSelector />
        </TabsContent>

        {/* Scheda Gestione Permessi Schede Giocatori */}
        <TabsContent value="permissions" className="space-y-4 mt-0">
          <Card className="bg-stone-950/40 border border-amber-900/40 p-4 sm:p-6 rounded-xl">
            <CardHeader className="px-0 pt-0 pb-4">
              <CardTitle className="text-lg font-headline font-bold text-amber-200 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
                Controllo Visibilità Schede Giocatore
              </CardTitle>
              <CardDescription className="text-xs text-stone-400">
                Seleziona quali strumenti e sezioni compendio sono visibili o oscurati per i giocatori quando l&apos;app è in Modalità Giocatore.
              </CardDescription>
            </CardHeader>
            <PlayerPermissionsMatrix campaignId={campaign.id} />
          </Card>
        </TabsContent>

        {/* Scheda 2: Personalizzazione Sfondi */}
        <TabsContent value="backgrounds" className="space-y-4 mt-0">
          <BackgroundCustomizer />
        </TabsContent>

        {/* Scheda 3: Stato Sistema e API */}
        <TabsContent value="settings" className="space-y-4 mt-0">
          <SettingsView campaignId={campaign.id} />
        </TabsContent>

        {/* Scheda 4: Compendio Homebrew */}
        <TabsContent value="homebrew" className="space-y-4 mt-0">
          <HomebrewCompendium campaign={campaign} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
