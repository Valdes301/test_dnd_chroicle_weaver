'use client';

import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import * as actions from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUp, Loader2, Download, Sparkles, BookOpen, FileText, LayoutGrid, Scroll, Lock, Plus, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';

// Scala per Alta Risoluzione (600 DPI)
const PRINT_SCALE = 6.25; 

export function CardBackgroundUploader() {
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [customImageName, setCustomImageName] = useState('');
    const { toast } = useToast();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, target: string) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 8 * 1024 * 1024) {
            toast({
                variant: 'destructive',
                title: 'Immagine troppo grande',
                description: 'Per favore, scegli un file più piccolo di 8MB.',
            });
            return;
        }

        setIsUploading(target);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target?.result as string;
            try {
                let targetFilename = target;
                if (target === 'custom_generic') {
                    const cleanName = customImageName.trim() ? customImageName.trim().replace(/\s+/g, '_').toLowerCase() : 'custom_bg';
                    targetFilename = `${cleanName}_${Date.now()}.jpg`;
                }

                const result = await actions.uploadCardBackground(imageData, targetFilename);
                if (result.success) {
                    toast({
                        title: 'Immagine Salvata con Successo!',
                        description: `Il file "${targetFilename}" è stato salvato nella cartella persistente degli asset e nel backup.`,
                    });
                    setCustomImageName('');
                    // Dispatcia evento per aggiornare viste o ricarica se necessario
                    window.dispatchEvent(new CustomEvent('dnd-assets-updated'));
                    setTimeout(() => window.location.reload(), 600);
                } else {
                    throw new Error(result.error || "Errore durante il caricamento.");
                }
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: "Errore di caricamento",
                    description: error.message,
                });
            } finally {
                setIsUploading(null);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDownloadBackA4 = async (imageType: 'magie' | 'oggetti') => {
        if (typeof document === 'undefined' || !document.body) return;
        setIsGenerating(true);
        toast({ title: 'Generazione foglio A4 retri (Alta Risoluzione)...' });

        const printContainer = document.createElement('div');
        printContainer.style.position = 'fixed';
        printContainer.style.left = '-10000px';
        printContainer.style.top = '-10000px';
        printContainer.style.width = '794px';
        printContainer.style.height = '1123px';
        printContainer.style.background = 'white';
        printContainer.style.pointerEvents = 'none';
        printContainer.style.zIndex = '-9999';
        document.body.appendChild(printContainer);

        const root = createRoot(printContainer);
        const imageUrl = imageType === 'magie' ? '/api/assets/card-back-magie.jpg' : '/api/assets/card-back-oggetti.jpg';

        const PageComponent = (
            <div 
                style={{ 
                    width: '794px', 
                    height: '1123px', 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gridTemplateRows: 'repeat(3, 1fr)',
                    padding: '40px',
                    gap: '20px',
                    justifyItems: 'center',
                    alignItems: 'center',
                    backgroundColor: 'white'
                }}
            >
                {Array.from({ length: 9 }).map((_, i) => (
                    <div 
                        key={i}
                        style={{ 
                            width: '215px', // 5.7cm
                            height: '333px', // 8.8cm
                            border: '2px solid black',
                            borderRadius: '12px',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundImage: `url('${imageUrl}?t=${Date.now()}')`,
                            backgroundColor: '#f3f4f6',
                            imageRendering: '-webkit-optimize-contrast'
                        }} 
                    />
                ))}
            </div>
        );

        try {
            root.render(PageComponent);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const canvas = await html2canvas(printContainer, { 
                scale: PRINT_SCALE,
                useCORS: true,
                width: 794,
                height: 1123,
                backgroundColor: '#ffffff',
                logging: false
            });

            const now = new Date();
            const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
            const prefix = imageType === 'magie' ? 'MC_RETRO' : 'IC_RETRO';

            const link = document.createElement('a');
            link.download = `${prefix}_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast({ title: 'Foglio scaricato correttamente!' });
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Errore', description: "Impossibile generare l'immagine. Assicurati di aver caricato il retro." });
        } finally {
            root.unmount();
            if (document.body && document.body.contains(printContainer)) {
                document.body.removeChild(printContainer);
            }
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* SEZIONE SFONDI CARTE & DOSSIER */}
            <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-amber-300 font-bold mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Sfondi Carte da Gioco & Dossier
                </h3>
                <div className="grid gap-6 md:grid-cols-3">
                    {/* CARTE MAGIA */}
                    <Card className="shadow-lg border-primary/20 bg-stone-950/70 h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-stone-100">
                                <BookOpen className="h-4 w-4 text-primary" /> Carte Magie
                            </CardTitle>
                            <CardDescription className="text-xs">Fronte e retro per gli incantesimi stampabili.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sfondo Fronte (Texture)</Label>
                                <Input id="front-magie" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'card-front-magie.jpg')} className="hidden" disabled={!!isUploading} />
                                <Button variant="outline" size="sm" className="w-full text-xs" asChild disabled={!!isUploading}>
                                    <label htmlFor="front-magie" className="cursor-pointer">
                                        {isUploading === 'card-front-magie.jpg' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                                        Carica Fronte
                                    </label>
                                </Button>
                            </div>

                            <Separator />

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Retro della Carta</Label>
                                <Input id="back-magie" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'card-back-magie.jpg')} className="hidden" disabled={!!isUploading} />
                                <Button variant="outline" size="sm" className="w-full text-xs" asChild disabled={!!isUploading}>
                                    <label htmlFor="back-magie" className="cursor-pointer">
                                        {isUploading === 'card-back-magie.jpg' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                                        Carica Retro
                                    </label>
                                </Button>
                            </div>

                            <Button onClick={() => handleDownloadBackA4('magie')} disabled={isGenerating} size="sm" className="w-full shadow-md text-xs">
                                {isGenerating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                                Scarica Foglio Retri A4
                            </Button>
                        </CardContent>
                    </Card>

                    {/* CARTE OGGETTO */}
                    <Card className="shadow-lg border-accent/20 bg-stone-950/70 h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-stone-100">
                                <Sparkles className="h-4 w-4 text-accent" /> Carte Oggetti
                            </CardTitle>
                            <CardDescription className="text-xs">Fronte e retro per armi, armature ed equipaggiamento.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sfondo Fronte (Texture)</Label>
                                <Input id="front-oggetti" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'card-front-oggetti.jpg')} className="hidden" disabled={!!isUploading} />
                                <Button variant="outline" size="sm" className="w-full text-xs" asChild disabled={!!isUploading}>
                                    <label htmlFor="front-oggetti" className="cursor-pointer">
                                        {isUploading === 'card-front-oggetti.jpg' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                                        Carica Fronte
                                    </label>
                                </Button>
                            </div>

                            <Separator />

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Retro della Carta</Label>
                                <Input id="back-oggetti" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'card-back-oggetti.jpg')} className="hidden" disabled={!!isUploading} />
                                <Button variant="outline" size="sm" className="w-full text-xs" asChild disabled={!!isUploading}>
                                    <label htmlFor="back-oggetti" className="cursor-pointer">
                                        {isUploading === 'card-back-oggetti.jpg' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                                        Carica Retro
                                    </label>
                                </Button>
                            </div>

                            <Button onClick={() => handleDownloadBackA4('oggetti')} disabled={isGenerating} variant="secondary" size="sm" className="w-full shadow-md text-xs">
                                {isGenerating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                                Scarica Foglio Retri A4
                            </Button>
                        </CardContent>
                    </Card>

                    {/* SFONDO HANDOUT PNG */}
                    <Card className="shadow-lg border-primary/40 bg-stone-950/70 h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-stone-100">
                                <FileText className="h-4 w-4 text-primary" /> Pergamena Dossier
                            </CardTitle>
                            <CardDescription className="text-xs">Sfondo per dossier personaggi ed estratti di lore.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 bg-muted/20 rounded-lg border border-dashed flex flex-col items-center justify-center min-h-[110px] relative group transition-all hover:bg-muted/30">
                                <ImageUp className="h-6 w-6 text-muted-foreground mb-1" />
                                <p className="text-[10px] uppercase font-bold text-muted-foreground text-center">Carica pergamena (.jpg o .png)</p>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => handleFileChange(e, 'handout-background.jpg')} 
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    disabled={!!isUploading}
                                />
                                {isUploading === 'handout-background.jpg' && (
                                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                )}
                            </div>
                            <p className="text-[9px] text-muted-foreground italic text-center">Salvataggio automatico in /api/assets/handout-background.jpg</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* SEZIONE SFONDI DELLE SCHERMATE PRINCIPALI */}
            <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-amber-300 font-bold mb-3 flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-amber-500" /> Sfondi Predefiniti delle Schermate
                </h3>
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Sfondo Taverna Principale & Backup */}
                    <Card className="shadow-lg border-amber-900/30 bg-stone-950/70 h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-stone-100">
                                <LayoutGrid className="h-4 w-4 text-amber-500" /> Schermata Principale & Backup
                            </CardTitle>
                            <CardDescription className="text-xs">Immagine della taverna fantasy per l'intera app.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="h-24 w-full rounded-md border border-stone-800 bg-cover bg-center overflow-hidden relative" style={{ backgroundImage: "url('/api/assets/hero-dnd-bg.jpg')" }}>
                                <div className="absolute inset-0 bg-stone-950/40 flex items-end p-2">
                                    <span className="text-[10px] font-bold text-amber-200 bg-stone-950/80 px-2 py-0.5 rounded">hero-dnd-bg.jpg (Taverna)</span>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full text-xs" asChild disabled={!!isUploading}>
                                <label className="cursor-pointer">
                                    {isUploading === 'hero-dnd-bg.jpg' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                                    Sostituisci Immagine Taverna
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'hero-dnd-bg.jpg')} className="hidden" disabled={!!isUploading} />
                                </label>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Sfondo Tavolo di Legno / Bacheca */}
                    <Card className="shadow-lg border-amber-900/30 bg-stone-950/70 h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-stone-100">
                                <Scroll className="h-4 w-4 text-amber-500" /> Bacheca della Taverna
                            </CardTitle>
                            <CardDescription className="text-xs">Tavolato in legno massiccio per la bacheca del gruppo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="h-24 w-full rounded-md border border-stone-800 bg-cover bg-center overflow-hidden relative" style={{ backgroundImage: "url('/api/assets/tavern-board-bg.jpg')" }}>
                                <div className="absolute inset-0 bg-stone-950/40 flex items-end p-2">
                                    <span className="text-[10px] font-bold text-amber-200 bg-stone-950/80 px-2 py-0.5 rounded">tavern-board-bg.jpg (Tavolo)</span>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full text-xs" asChild disabled={!!isUploading}>
                                <label className="cursor-pointer">
                                    {isUploading === 'tavern-board-bg.jpg' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                                    Sostituisci Tavolo di Legno
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'tavern-board-bg.jpg')} className="hidden" disabled={!!isUploading} />
                                </label>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Sfondo Blocco PIN / Antico Libro Chiuso */}
                    <Card className="shadow-lg border-amber-900/30 bg-stone-950/70 h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-stone-100">
                                <Lock className="h-4 w-4 text-amber-500" /> Schermata Sigillo PIN
                            </CardTitle>
                            <CardDescription className="text-xs">Antico libro/grimorio chiuso con fibbie e rune.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="h-24 w-full rounded-md border border-stone-800 bg-cover bg-center overflow-hidden relative" style={{ backgroundImage: "url('/api/assets/ancient-grimoire-bg.jpg')" }}>
                                <div className="absolute inset-0 bg-stone-950/40 flex items-end p-2">
                                    <span className="text-[10px] font-bold text-amber-200 bg-stone-950/80 px-2 py-0.5 rounded">ancient-grimoire-bg.jpg (Libro)</span>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full text-xs" asChild disabled={!!isUploading}>
                                <label className="cursor-pointer">
                                    {isUploading === 'ancient-grimoire-bg.jpg' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                                    Sostituisci Antico Libro
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ancient-grimoire-bg.jpg')} className="hidden" disabled={!!isUploading} />
                                </label>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* CARICAMENTO DI ALTRE IMMAGINI PERSONALIZZATE */}
            <Card className="shadow-lg border-primary/30 bg-stone-950/80">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-stone-100 font-serif">
                        <Plus className="h-4 w-4 text-primary" /> Carica Nuova Immagine Personalizzata negli Asset
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Aggiungi un'immagine personalizzata (personaggi, mappe, ambientazioni o sfondi) direttamente nella memoria persistente e nel backup immagini.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome Immagine (Opzionale)</Label>
                            <Input 
                                placeholder="es. mappa_costa_della_spada"
                                value={customImageName}
                                onChange={(e) => setCustomImageName(e.target.value)}
                                className="h-9 text-xs bg-stone-900 border-stone-800"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button variant="default" size="sm" className="h-9 w-full sm:w-auto text-xs font-bold gap-2" asChild disabled={!!isUploading}>
                                <label className="cursor-pointer">
                                    {isUploading === 'custom_generic' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
                                    Seleziona e Salva File
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'custom_generic')} className="hidden" disabled={!!isUploading} />
                                </label>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

