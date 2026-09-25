
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ShieldCheck, Key, RefreshCw, Loader2, AlertTriangle, ShieldAlert, Trash2, AlertCircle, BarChart3, Activity, Zap, History, FolderOpen, Image as ImageIcon, FileText, Link2, Sparkles, Wand2, BookOpen, Check, Upload, FileUp, Lock, Database } from 'lucide-react';
import * as actions from '@/lib/actions';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { isPinConfigured, getPinConfig, setIsLocked, isPlayerMode } from '@/lib/pin-storage';
import { PinConfigDialog } from './pin-config-dialog';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "./ui/alert-dialog";
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { PlayerPermissionsMatrix } from './player-permissions-matrix';
import { AiModelSelector } from './ai-model-selector';

export function SettingsView({ campaignId }: { campaignId: string }) {
    const [status, setStatus] = useState<any[]>([]);
    const [apiStats, setApiStats] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRelinking, setIsRelinking] = useState(false);
    const [isDeletingAsset, setIsDeletingAsset] = useState<string | null>(null);
    const [isRestoringImages, setIsRestoringImages] = useState(false);
    const [imageRestoreProgress, setImageRestoreProgress] = useState<{ current: number; total: number; message: string } | null>(null);
    const [isFormatting, setIsFormatting] = useState(false);
    const [formatStats, setFormatStats] = useState<{
        totalUpdated: number;
        totalScanned: number;
        loreUpdated: number;
        sessionsUpdated: number;
        arcsUpdated: number;
        rulesUpdated: number;
        locationsUpdated: number;
        campaignsUpdated: number;
    } | null>(null);
    const { toast } = useToast();
    const [pinConfigured, setPinConfigured] = useState<boolean>(false);
    const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
    const [pinConfigData, setPinConfigData] = useState<any>(null);
    const [playerMode, setPlayerMode] = useState<boolean>(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationResult, setOptimizationResult] = useState<{
        sizeBefore: number;
        sizeAfter: number;
        spaceSaved: number;
        optimizedAt: string;
    } | null>(null);

    const handleOptimizeDatabase = async () => {
        setIsOptimizing(true);
        try {
            const res = await actions.runVacuumAction();
            if (res.success && res.data) {
                setOptimizationResult(res.data);
                toast({
                    title: "Database Ottimizzato!",
                    description: `Operazione VACUUM & ANALYZE completata con successo.`
                });
            } else {
                throw new Error(res.error || "Impossibile ottimizzare il database.");
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore Ottimizzazione", description: e.message });
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleLargeJsonAssetsRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsRestoringImages(true);
        setImageRestoreProgress({ current: 0, total: 100, message: "Lettura file JSON di backup..." });
        
        try {
            const text = await file.text();
            setImageRestoreProgress({ current: 10, total: 100, message: "Analisi dati JSON..." });
            const data = JSON.parse(text);
            const assetsList = data.Assets || data.assets || [];
            if (!Array.isArray(assetsList) || assetsList.length === 0) {
                throw new Error("Nessun asset trovato nel file JSON o formato non valido.");
            }

            const chunkSize = 3;
            let uploaded = 0;
            const total = assetsList.length;

            for (let i = 0; i < assetsList.length; i += chunkSize) {
                const chunk = assetsList.slice(i, i + chunkSize);
                setImageRestoreProgress({
                    current: Math.round(10 + (i / total) * 85),
                    total: 100,
                    message: `Caricamento immagini in corso (${Math.min(i + chunkSize, total)}/${total})...`
                });
                const res = await actions.uploadBatchImages(chunk);
                if (!res.success) {
                    throw new Error(res.error || "Errore durante il caricamento del blocco di immagini.");
                }
                uploaded += chunk.length;
            }

            setImageRestoreProgress({ current: 100, total: 100, message: "Ripristino immagini completato!" });
            toast({ title: "Backup Immagini Ripristinato!", description: `Caricate con successo ${uploaded} immagini.` });
            loadData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Errore Ripristino Immagini", description: err.message });
        } finally {
            setIsRestoringImages(false);
            setTimeout(() => setImageRestoreProgress(null), 3000);
            e.target.value = '';
        }
    };

    const handleMultiFileImagesRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsRestoringImages(true);
        setImageRestoreProgress({ current: 0, total: 100, message: "Preparazione file immagine..." });

        try {
            const fileArray = Array.from(files);
            const batchSize = 10;
            const total = fileArray.length;
            let uploaded = 0;

            for (let i = 0; i < total; i += batchSize) {
                const currentFiles = fileArray.slice(i, i + batchSize);
                setImageRestoreProgress({
                    current: Math.round((i / total) * 90),
                    total: 100,
                    message: `Elaborazione file (${Math.min(i + batchSize, total)}/${total})...`
                });

                const batchPayload: { name: string; content: string }[] = [];
                for (const file of currentFiles) {
                    const base64Content = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    batchPayload.push({ name: file.name, content: base64Content });
                }

                const res = await actions.uploadBatchImages(batchPayload);
                if (!res.success) {
                    throw new Error(res.error || "Errore durante il caricamento del batch.");
                }
                uploaded += currentFiles.length;
            }

            setImageRestoreProgress({ current: 100, total: 100, message: "Caricamento multiplo completato!" });
            toast({ title: "Immagini Caricate!", description: `Caricati con successo ${uploaded} file immagine.` });
            loadData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Errore Caricamento", description: err.message });
        } finally {
            setIsRestoringImages(false);
            setTimeout(() => setImageRestoreProgress(null), 3000);
            e.target.value = '';
        }
    };

    const handleFormatAllTexts = async (onlyThisCampaign: boolean = true) => {
        setIsFormatting(true);
        try {
            const res = await actions.formatAllSavedTextsAction(onlyThisCampaign ? campaignId : undefined);
            if (res.success && res.data) {
                setFormatStats(res.data);
                toast({
                    title: "Formattazione Completata!",
                    description: `Aggiornati con successo ${res.data.totalUpdated} elementi su ${res.data.totalScanned} analizzati.`
                });
            } else {
                throw new Error(res.error || "Impossibile formattare i testi.");
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore Formattazione", description: e.message });
        } finally {
            setIsFormatting(false);
        }
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [statusRes, statsRes, assetsRes] = await Promise.all([
                actions.getSystemStatus(),
                actions.getApiUsageStats(),
                actions.listAssetsAction()
            ]);
            if (statusRes.success && statusRes.data) setStatus(statusRes.data);
            if (statsRes.success && statsRes.data) setApiStats(statsRes.data);
            if (assetsRes.success && assetsRes.data) setAssets(assetsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCampaign = async () => {
        setIsDeleting(true);
        try {
            const res = await actions.deleteCampaign(campaignId);
            if (res.success) {
                toast({ title: "Campagna Eliminata", description: "Verrai reindirizzato alla pagina principale." });
                window.location.href = '/';
            } else throw new Error(res.error || "Errore sconosciuto.");
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore", description: e.message });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRelink = async () => {
        setIsRelinking(true);
        try {
            const res = await actions.relinkImagesAction();
            if (res.success) {
                toast({ title: "Scansione Completata!", description: `Ricollegate ${res.data?.relinkedCount || 0} immagini ai personaggi.` });
                loadData();
            } else throw new Error(res.error || "Errore sconosciuto.");
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore Ricollegamento", description: e.message });
        } finally {
            setIsRelinking(false);
        }
    };

    const handleDeleteAsset = async (filename: string) => {
        setIsDeletingAsset(filename);
        try {
            const res = await actions.deleteAssetAction(filename);
            if (res.success) {
                toast({ title: "File eliminato." });
                setAssets(prev => prev.filter(a => a.name !== filename));
            } else throw new Error(res.error || "Errore sconosciuto.");
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore", description: e.message });
        } finally {
            setIsDeletingAsset(null);
        }
    };

    useEffect(() => {
        loadData();
        const checkPin = () => {
            setPinConfigured(isPinConfigured());
            setPinConfigData(getPinConfig());
            setPlayerMode(isPlayerMode());
        };
        checkPin();
        const handlePlayerModeChange = (e: any) => {
            setPlayerMode(Boolean(e.detail?.isPlayerMode));
        };
        window.addEventListener('dnd-pin-config-changed', checkPin);
        window.addEventListener('dnd-player-mode-changed', handlePlayerModeChange);
        return () => {
            window.removeEventListener('dnd-pin-config-changed', checkPin);
            window.removeEventListener('dnd-player-mode-changed', handlePlayerModeChange);
        };
    }, []);

    const allConfigured = status.length > 0 && status.every(s => s.configured);
    const totalAssetsSize = assets.reduce((acc, curr) => acc + curr.size, 0);
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-12 pb-20">
            {/* GESTIONE ASSET (MANUALE) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-headline text-xl uppercase tracking-widest flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-primary" /> Gestione File e Memoria
                    </h3>
                    <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-[10px] uppercase">{assets.length} file • {formatSize(totalAssetsSize)}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData}>
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                <Card className="border-primary/10 bg-muted/5">
                    <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                        <CardDescription className="text-[11px] italic">
                            Qui puoi gestire manualmente i file salvati nella cartella 'data/assets' del Raspberry Pi.
                        </CardDescription>
                        <Button variant="outline" size="sm" onClick={handleRelink} disabled={isRelinking} className="h-8 gap-2 text-[10px] uppercase font-bold border-accent/40 text-accent hover:bg-accent/10">
                            {isRelinking ? <Loader2 className="h-3 w-3 animate-spin"/> : <Link2 className="h-3 w-3" />}
                            Ricollega Asset Dispersi
                        </Button>
                    </CardHeader>
                    <CardContent className="p-4">
                        <ScrollArea className="h-[350px] pr-4">
                            {assets.length === 0 ? (
                                <div className="py-20 text-center opacity-30 italic text-sm">Cartella asset vuota.</div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {assets.map((asset) => (
                                        <div key={asset.name} className="flex flex-col p-3 rounded-lg border bg-background group relative overflow-hidden">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 border relative">
                                                    {asset.name.match(/\.(jpg|jpeg|png|webp|svg)$/i) ? (
                                                        <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <FileText className="h-full w-full p-2 opacity-20" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold truncate uppercase tracking-tighter" title={asset.name}>{asset.name}</p>
                                                    <p className="text-[9px] text-muted-foreground">{formatSize(asset.size)} • {new Date(asset.createdAt).toLocaleDateString('it-IT')}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 mt-auto items-center">
                                                <Button variant="ghost" size="sm" className="h-8 text-xs uppercase font-bold w-full" asChild>
                                                    <a href={asset.url} target="_blank" rel="noreferrer">Apri</a>
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/80 hover:text-destructive shrink-0" disabled={isDeletingAsset === asset.name}>
                                                            {isDeletingAsset === asset.name ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="w-[95vw] max-w-md">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Eliminare questo file?</AlertDialogTitle>
                                                            <AlertDialogDescription>L'operazione è irreversibile e il file verrà rimosso dal disco del Raspberry Pi.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteAsset(asset.name)} className="bg-destructive text-destructive-foreground">Elimina</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-muted/5">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-primary" /> Ripristino Avanzato Immagini (File Grandi / Backup)
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Se il file JSON di backup delle immagini è troppo grande o genera errori di memoria, puoi caricarlo a blocchi oppure selezionare direttamente più file immagine dal computer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border bg-background/60 space-y-2 flex flex-col justify-between">
                                <div>
                                    <span className="font-bold text-xs flex items-center gap-1.5 text-primary">
                                        <FileText className="h-3.5 w-3.5" /> Ripristina da File JSON Backup (A Blocchi)
                                    </span>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Seleziona il file <code className="text-xs bg-muted px-1 py-0.5 rounded">dnd_backup-immagini-*.json</code>. Verrà elaborato a blocchi per evitare limiti di dimensione.
                                    </p>
                                </div>
                                <div>
                                    <input 
                                        type="file" 
                                        id="json-assets-restore" 
                                        accept=".json" 
                                        className="hidden" 
                                        onChange={handleLargeJsonAssetsRestore}
                                        disabled={isRestoringImages}
                                    />
                                    <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs font-bold uppercase border-primary/40 hover:bg-primary/10">
                                        <label htmlFor="json-assets-restore" className="cursor-pointer">
                                            {isRestoringImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                            Seleziona JSON Immagini
                                        </label>
                                    </Button>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg border bg-background/60 space-y-2 flex flex-col justify-between">
                                <div>
                                    <span className="font-bold text-xs flex items-center gap-1.5 text-primary">
                                        <ImageIcon className="h-3.5 w-3.5" /> Caricamento Multiplo Immagini (Batch)
                                    </span>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Seleziona direttamente più file immagine dal computer (<code className="text-xs bg-muted px-1 py-0.5 rounded">.jpg, .png</code>) da aggiungere agli asset.
                                    </p>
                                </div>
                                <div>
                                    <input 
                                        type="file" 
                                        id="multifile-assets-restore" 
                                        accept="image/*" 
                                        multiple 
                                        className="hidden" 
                                        onChange={handleMultiFileImagesRestore}
                                        disabled={isRestoringImages}
                                    />
                                    <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs font-bold uppercase border-primary/40 hover:bg-primary/10">
                                        <label htmlFor="multifile-assets-restore" className="cursor-pointer">
                                            {isRestoringImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                                            Seleziona File Immagine (Multipli)
                                        </label>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {imageRestoreProgress && (
                            <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/10 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="flex items-center gap-1.5 text-primary">
                                        {isRestoringImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                        {imageRestoreProgress.message}
                                    </span>
                                    <span className="font-mono">{imageRestoreProgress.current}%</span>
                                </div>
                                <Progress value={imageRestoreProgress.current} className="h-2" />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* OTTIMIZZAZIONE E MANUTENZIONE DATABASE (VACUUM) */}
                <Card className="border-amber-500/25 bg-amber-500/5">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-amber-300">
                            <Database className="h-4 w-4 text-amber-400" /> Ottimizzazione &amp; Manutenzione Database (VACUUM)
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Deframmenta il database SQLite per riordinare gli indici, liberare lo spazio non più utilizzato (ROM) e velocizzare l&apos;I/O del Raspberry Pi 4. Ideale dopo eliminazioni di massa.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <Button
                                onClick={handleOptimizeDatabase}
                                disabled={isOptimizing}
                                className="flex-1 gap-2 text-xs uppercase font-bold bg-amber-600 hover:bg-amber-500 text-stone-950"
                            >
                                {isOptimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                                Esegui VACUUM &amp; ANALYZE
                            </Button>
                        </div>

                        {optimizationResult && (
                            <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2 text-xs">
                                <div className="flex items-center justify-between font-bold text-amber-400">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Ottimizzazione completata con successo!
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {new Date(optimizationResult.optimizedAt).toLocaleTimeString('it-IT')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                                    <div className="bg-background/40 p-2 rounded border border-border/30">
                                        <div className="text-muted-foreground text-[10px] uppercase">Dim. Iniziale</div>
                                        <div className="font-mono font-bold text-foreground mt-0.5">{formatSize(optimizationResult.sizeBefore)}</div>
                                    </div>
                                    <div className="bg-background/40 p-2 rounded border border-border/30">
                                        <div className="text-muted-foreground text-[10px] uppercase">Dim. Finale</div>
                                        <div className="font-mono font-bold text-foreground mt-0.5">{formatSize(optimizationResult.sizeAfter)}</div>
                                    </div>
                                    <div className="bg-background/40 p-2 rounded border border-border/30">
                                        <div className="text-muted-foreground text-[10px] uppercase">Spazio Liberato</div>
                                        <div className="font-mono font-bold text-emerald-400 mt-0.5">{formatSize(optimizationResult.spaceSaved)}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* FORMATTAZIONE AUTOMATICA E MANUTENZIONE TESTI */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-headline text-xl uppercase tracking-widest flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-primary" /> Formattazione Automatica & Tipografia
                    </h3>
                    <Badge variant="outline" className="text-[10px] uppercase bg-primary/10 text-primary border-primary/30 gap-1">
                        <Sparkles className="h-3 w-3" /> Attivo al Salvataggio
                    </Badge>
                </div>

                <Card className="border-primary/20 bg-muted/5">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-primary" /> Pulizia e Standardizzazione Testi (Lore & Storie)
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    Tutti i dossier di Lore, storie di sessione, note e regole vengono formattati automaticamente ad ogni salvataggio. Da qui puoi anche normalizzare retroattivamente tutti i testi già salvati nel database.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="p-3 rounded-lg border bg-background/60 space-y-1">
                                <span className="font-bold flex items-center gap-1.5 text-primary">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Sintassi Markdown
                                </span>
                                <p className="text-[11px] text-muted-foreground">
                                    Normalizza intestazioni (# Titoli), grassetti (**testo**), elenchi puntati e citazioni.
                                </p>
                            </div>
                            <div className="p-3 rounded-lg border bg-background/60 space-y-1">
                                <span className="font-bold flex items-center gap-1.5 text-primary">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Tipografia & Spaziatura
                                </span>
                                <p className="text-[11px] text-muted-foreground">
                                    Corregge spazi prima/dopo la punteggiatura ed elimina a capo multipli o spazi residui.
                                </p>
                            </div>
                            <div className="p-3 rounded-lg border bg-background/60 space-y-1">
                                <span className="font-bold flex items-center gap-1.5 text-primary">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Dialoghi & Narrazione
                                </span>
                                <p className="text-[11px] text-muted-foreground">
                                    Standardizza i trattini di dialogo narrativo (—) e uniforma i blocchi di lettura per il DM.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                            <Button 
                                onClick={() => handleFormatAllTexts(true)} 
                                disabled={isFormatting}
                                className="flex-1 gap-2 text-xs uppercase font-bold"
                            >
                                {isFormatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                Formatta Testi della Campagna Attuale
                            </Button>
                            <Button 
                                onClick={() => handleFormatAllTexts(false)} 
                                disabled={isFormatting}
                                variant="outline"
                                className="flex-1 gap-2 text-xs uppercase font-bold border-primary/30 hover:bg-primary/10"
                            >
                                {isFormatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Formatta Tutto il Database (Globale)
                            </Button>
                        </div>

                        {formatStats && (
                            <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4" /> Formattazione completata con successo!
                                    </span>
                                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                                        {formatStats.totalUpdated} Aggiornati / {formatStats.totalScanned} Scansionati
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1">
                                    <div className="bg-background/40 p-1.5 rounded border border-border/30">
                                        <span className="font-semibold text-foreground">{formatStats.loreUpdated}</span> Dossier Lore
                                    </div>
                                    <div className="bg-background/40 p-1.5 rounded border border-border/30">
                                        <span className="font-semibold text-foreground">{formatStats.sessionsUpdated}</span> Storie / Sessioni
                                    </div>
                                    <div className="bg-background/40 p-1.5 rounded border border-border/30">
                                        <span className="font-semibold text-foreground">{formatStats.arcsUpdated}</span> Archi Narrativi
                                    </div>
                                    <div className="bg-background/40 p-1.5 rounded border border-border/30">
                                        <span className="font-semibold text-foreground">{formatStats.rulesUpdated}</span> Regole & Luoghi
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* MONITORAGGIO QUOTE API */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-headline text-xl uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" /> Analitica Risorse IA
                    </h3>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {apiStats.map((stat) => {
                        const rpmPerc = Math.min(100, (stat.rpm / 15) * 100);
                        const rpdPerc = Math.min(100, (stat.rpd / 1500) * 100);
                        const isHighUsage = rpmPerc > 80 || rpdPerc > 80;

                        return (
                            <Card key={stat.service} className={cn("bg-muted/10 border-border/50", isHighUsage && "border-amber-500/40 bg-amber-500/5")}>
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.service}</CardTitle>
                                        <Badge variant={stat.status === 'success' ? 'default' : 'destructive'} className="h-4 text-[8px] uppercase">
                                            {stat.status === 'success' ? 'Attivo' : 'Errore'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 space-y-4">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[9px] font-bold uppercase">
                                            <span className="flex items-center gap-1"><Activity className="h-2.5 w-2.5" /> RPM (Minuto)</span>
                                            <span className={cn(rpmPerc > 80 ? "text-destructive" : "text-primary")}>{stat.rpm} / 15</span>
                                        </div>
                                        <Progress value={rpmPerc} className="h-1" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[9px] font-bold uppercase">
                                            <span className="flex items-center gap-1"><History className="h-2.5 w-2.5" /> RPD (Giorno)</span>
                                            <span>{stat.rpd} / 1500</span>
                                        </div>
                                        <Progress value={rpdPerc} className="h-1 bg-muted/20" />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* MATRICE DEI PERMESSI PER LE SCHEDE (MODALITÀ GIOCATORE) - Visibile solo al DM */}
            {!playerMode && (
                <div className="space-y-4">
                    <PlayerPermissionsMatrix />
                </div>
            )}

            {/* SELEZIONE & CONFIGURAZIONE MODELLO IA */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-headline text-xl uppercase tracking-widest flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" /> Modello &amp; Motore IA
                    </h3>
                </div>
                <AiModelSelector />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className={allConfigured ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"}>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between text-sm uppercase tracking-widest">
                            Configurazione API
                            {allConfigured ? <CheckCircle2 className="text-emerald-500 h-5 w-5" /> : <ShieldAlert className="text-destructive h-5 w-5" />}
                        </CardTitle>
                        <CardDescription className="text-[11px]">Rilevamento chiavi nel file .env</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            {status.map(s => (
                                <div key={s.name} className="flex items-center justify-between p-2 rounded border bg-background/50">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-mono font-bold">{s.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{s.preview}</span>
                                    </div>
                                    <Badge variant={s.configured ? "default" : "outline"} className={s.configured ? "bg-emerald-600 h-5 text-[10px]" : "h-5 text-[10px]"}>
                                        {s.configured ? "Valida" : "Assente"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* PROTEZIONE SCHERMO (PIN & PASSWORD) - Visibile solo al DM */}
                    {!playerMode && (
                        <Card className="border-amber-500/30 bg-amber-500/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between text-sm uppercase tracking-widest text-amber-300">
                                    <span className="flex items-center gap-2">
                                        <Lock className="h-4 w-4 text-amber-400" /> Protezione Schermo (PIN)
                                    </span>
                                    <Badge 
                                        variant={pinConfigured ? "default" : "outline"} 
                                        className={pinConfigured ? "bg-amber-600 text-amber-50 h-5 text-[10px]" : "border-amber-600/50 text-amber-400 h-5 text-[10px]"}
                                    >
                                        {pinConfigured ? "Attivo" : "Non Impostato"}
                                    </Badge>
                                </CardTitle>
                                <CardDescription className="text-[11px]">
                                    Blocca l'accesso alle tue note e dossier del Dungeon Master quando ti allontani dal tavolo o dal tablet.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-xs space-y-4 text-stone-300">
                                <div className="space-y-1 text-[11px] text-muted-foreground">
                                    <p>• <strong>PIN Rapido:</strong> 4 cifre per sblocco immediato da touch o tastiera.</p>
                                    <p>• <strong>Password di Emergenza:</strong> Per recuperare l'accesso se dimentichi il PIN.</p>
                                    <p>• <strong>Auto-blocco:</strong> {pinConfigData?.autoLockMinutes && pinConfigData.autoLockMinutes > 0 ? `Attivo (${pinConfigData.autoLockMinutes} min)` : 'Disattivato (blocco manuale).'}</p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                    <Button 
                                        onClick={() => setIsPinModalOpen(true)} 
                                        variant="outline" 
                                        className="flex-1 gap-2 h-9 text-[10px] uppercase font-bold border-amber-500/40 hover:bg-amber-950/30 text-amber-300"
                                    >
                                        <Key className="h-3.5 w-3.5" /> {pinConfigured ? "Modifica PIN / Password" : "Configura PIN"}
                                    </Button>
                                    {pinConfigured && (
                                        <Button 
                                            onClick={() => setIsLocked(true)} 
                                            className="flex-1 gap-2 h-9 text-[10px] uppercase font-bold bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold"
                                        >
                                            <Lock className="h-3.5 w-3.5" /> Sigilla Schermo
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
                                <AlertTriangle className="h-4 w-4 text-amber-500" /> Diagnostica
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-4 text-muted-foreground">
                            <p>Se riscontri errori frequenti, verifica che le chiavi API non abbiano superato i limiti di quota su Google Cloud Console.</p>
                            <Button onClick={loadData} variant="outline" className="w-full gap-2 h-9 text-[10px] uppercase font-bold">
                                <RefreshCw className="h-3.5 w-3.5" /> Ricarica Diagnostica
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive/30 bg-destructive/5 overflow-hidden">
                        <CardHeader className="bg-destructive/10">
                            <CardTitle className="text-[10px] uppercase tracking-[0.2em] text-destructive flex items-center gap-2">
                                <AlertCircle className="h-3.5 w-3.5" /> Zona Pericolo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <p className="text-[11px] text-muted-foreground italic">
                                L'eliminazione è irreversibile e rimuoverà tutti i dati della campagna dal server.
                            </p>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full gap-2 h-9 text-[10px] uppercase font-bold shadow-lg shadow-destructive/20" disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                                        Elimina Campagna Definitivamente
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="w-[95vw] max-w-md">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Questa azione non può essere annullata. Tutti i progressi, le mappe, i PNG e le cronache di questa campagna andranno persi per sempre.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground">
                                            Sì, Procedi all'Eliminazione
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <PinConfigDialog 
                open={isPinModalOpen} 
                onOpenChange={setIsPinModalOpen} 
            />
        </div>
    );
}
