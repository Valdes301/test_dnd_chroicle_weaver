'use client';

import React, { useState, useRef, memo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Download, Loader2, ImageIcon, Trash2, FileText, LayoutGrid, Mail, Type, Maximize2, Save, FolderOpen } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createRoot } from 'react-dom/client';
import * as actions from '@/lib/actions';
import type { LetterPreset } from '@/lib/types';
import { useRouter } from 'next/navigation';

const PRINT_SCALE = 6.25; // 600 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const A5_HEIGHT = 561;

type LetterData = {
    title: string;
    titleFont: string;
    titleSize: number;
    content: string;
    contentFont: string;
    contentSize: number;
    signature: string;
    signatureFont: string;
    signatureSize: number;
    background: string | null;
    logo: string | null;
    logoSize: number;
    seal: string | null;
    sealSize: number;
};

const defaultLetter: LetterData = {
    title: 'ORDINE DI MISSIONE',
    titleFont: 'font-authority',
    titleSize: 55,
    content: 'Cari avventurieri,\n\nIl destino di Waterdeep poggia sulle vostre spalle. Recatevi immediatamente presso i moli e attendete ulteriori istruzioni.\n\nChe il Verde vi guidi.',
    contentFont: 'font-scholarly',
    contentSize: 22,
    signature: 'Melannor Fellbranch',
    signatureFont: 'font-elegant',
    signatureSize: 32,
    background: null,
    logo: null,
    logoSize: 130,
    seal: null,
    sealSize: 120,
};

const fonts = [
    { id: 'font-body', label: 'Classico (Literata)' },
    { id: 'font-authority', label: 'Autoritario (Cinzel)' },
    { id: 'font-headline', label: 'Solenne (Belleza)' },
    { id: 'font-scholarly', label: 'Accademico (Fondamento)' },
    { id: 'font-calligraphy', label: 'Formale (Vibes)' },
    { id: 'font-handwriting', label: 'Manoscritto (Dancing)' },
    { id: 'font-alex', label: 'Fluido (Alex Brush)' },
    { id: 'font-gothic', label: 'Minaccioso (Pirata)' },
    { id: 'font-messy', label: 'Grezzo (Special Elite)' },
    { id: 'font-sharp', label: 'Medievale (Sharp)' },
    { id: 'font-noble', label: 'Signorile (Playfair)' },
    { id: 'font-ancient', label: 'Celtico (Uncial)' },
];

const removeWhiteBackground = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(dataUrl);

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                if (r > 235 && g > 235 && b > 235) {
                    data[i+3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = dataUrl;
    });
};

const SingleLetterPreview = memo(({ 
    data, 
    isA5 = false, 
    isForPrinting = false 
}: { 
    data: LetterData; 
    isA5?: boolean; 
    isForPrinting?: boolean 
}) => {
    return (
        <div 
            style={{ 
                width: `${A4_WIDTH}px`, 
                height: isA5 ? `${A5_HEIGHT}px` : `${A4_HEIGHT}px`,
                backgroundColor: 'white',
                backgroundImage: data.background ? `url(${data.background})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'black',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                padding: isA5 ? '30px 50px' : '40px 80px',
                overflow: 'hidden',
                boxSizing: 'border-box',
                imageRendering: '-webkit-optimize-contrast',
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased'
            }}
            className={cn(!isForPrinting && "shadow-inner border")}
        >
            {data.logo && (
                <div className="flex justify-center mb-6 flex-shrink-0">
                    <img 
                        src={data.logo} 
                        alt="Logo" 
                        style={{ height: `${data.logoSize}px`, maxWidth: '90%', objectFit: 'contain' }} 
                    />
                </div>
            )}

            <div className={cn("text-center mb-10 uppercase tracking-widest font-bold flex-shrink-0", data.titleFont)} style={{ fontSize: `${data.titleSize}px` }}>
                <h1 className="leading-tight">{data.title}</h1>
            </div>

            <div className={cn("flex-grow whitespace-pre-wrap leading-relaxed", data.contentFont)} style={{ fontSize: `${data.contentSize}px` }}>
                {data.content}
            </div>

            <div className="flex justify-end items-center mt-8 gap-6 min-h-[100px] flex-shrink-0">
                {data.signature && (
                    <div 
                        className={cn(
                            "flex items-center text-center font-bold px-4",
                            data.signatureFont
                        )}
                        style={{ 
                            color: 'rgba(0,0,0,0.85)',
                            fontSize: `${data.signatureSize}px`,
                            lineHeight: '1.1'
                        }}
                    >
                        {data.signature}
                    </div>
                )}
                {data.seal && (
                    <div className="flex-shrink-0">
                        <img 
                            src={data.seal} 
                            alt="Sigillo" 
                            style={{ height: `${data.sealSize}px`, objectFit: 'contain' }} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
});
SingleLetterPreview.displayName = 'SingleLetterPreview';

export function LetterGenerator({ presets = [] }: { presets: LetterPreset[] }) {
    const [layout, setLayout] = useState<'A4' | 'A5x2'>('A4');
    const [letters, setLetters] = useState<LetterData[]>([
        { ...defaultLetter }, 
        { ...defaultLetter, title: 'SECONDO ORDINE' }
    ]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const handleImageUpload = useCallback(async (index: number, field: 'background' | 'logo' | 'seal', file: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            let result = e.target?.result as string;
            if (field === 'logo' || field === 'seal') {
                result = await removeWhiteBackground(result);
            }

            setLetters(prev => {
                const newLetters = [...prev];
                newLetters[index] = { ...newLetters[index], [field]: result };
                return newLetters;
            });
        };
        reader.readAsDataURL(file);
    }, []);

    const updateLetter = (index: number, field: keyof LetterData, value: any) => {
        setLetters(prev => {
            const newLetters = [...prev];
            newLetters[index] = { ...newLetters[index], [field]: value };
            return newLetters;
        });
    };

    const handleSavePreset = async () => {
        if (!newPresetName.trim()) {
            toast({ variant: 'destructive', title: "Inserisci un nome per il modello" });
            return;
        }

        const ref = letters[0];
        const settings = {
            titleFont: ref.titleFont,
            titleSize: ref.titleSize,
            contentFont: ref.contentFont,
            contentSize: ref.contentSize,
            signatureFont: ref.signatureFont,
            signatureSize: ref.signatureSize,
            logoSize: ref.logoSize,
            sealSize: ref.sealSize,
            layout: layout
        };

        const result = await actions.saveLetterPreset(newPresetName, JSON.stringify(settings));
        if (result.success) {
            toast({ title: "Modello Salvato!" });
            setNewPresetName('');
            router.refresh();
        } else {
            toast({ variant: 'destructive', title: "Errore durante il salvataggio", description: result.error });
        }
    };

    const handleLoadPreset = (preset: LetterPreset) => {
        try {
            const settings = JSON.parse(preset.settings);
            setLayout(settings.layout || 'A4');
            setLetters(prev => prev.map(l => ({
                ...l,
                titleFont: settings.titleFont || l.titleFont,
                titleSize: settings.titleSize || l.titleSize,
                contentFont: settings.contentFont || l.contentFont,
                contentSize: settings.contentSize || l.contentSize,
                signatureFont: settings.signatureFont || l.signatureFont,
                signatureSize: settings.signatureSize || l.signatureSize,
                logoSize: settings.logoSize || l.logoSize,
                sealSize: settings.sealSize || l.sealSize,
            })));
            toast({ title: `Modello "${preset.name}" caricato!` });
        } catch (e) {
            toast({ variant: 'destructive', title: "Errore nel caricamento del modello" });
        }
    };

    const handleDeletePreset = async (id: string) => {
        const result = await actions.deleteLetterPreset(id);
        if (result.success) {
            toast({ title: "Modello Eliminato" });
            router.refresh();
        }
    };

    const handleDownload = async () => {
        if (typeof document === 'undefined' || !document.body) return;
        setIsGenerating(true);
        toast({ title: "Generazione pergamena alta risoluzione (600 DPI)..." });

        const printContainer = document.createElement('div');
        printContainer.style.position = 'fixed';
        printContainer.style.left = '-10000px';
        printContainer.style.top = '-10000px';
        printContainer.style.width = `${A4_WIDTH}px`;
        printContainer.style.height = `${A4_HEIGHT}px`;
        printContainer.style.backgroundColor = 'white';
        printContainer.style.zIndex = '-9999';
        document.body.appendChild(printContainer);

        const root = createRoot(printContainer);
        
        const PrintContent = (
            <div style={{ width: `${A4_WIDTH}px`, height: `${A4_HEIGHT}px`, display: 'flex', flexDirection: 'column' }}>
                {layout === 'A4' ? (
                    <SingleLetterPreview data={letters[0]} isForPrinting />
                ) : (
                    <>
                        <SingleLetterPreview data={letters[0]} isA5 isForPrinting />
                        <div style={{ borderTop: '1px dashed #ccc', width: '100%' }} />
                        <SingleLetterPreview data={letters[1]} isA5 isForPrinting />
                    </>
                )}
            </div>
        );

        try {
            root.render(PrintContent);
            await new Promise(resolve => setTimeout(resolve, 1500));

            const canvas = await html2canvas(printContainer, {
                scale: PRINT_SCALE,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: A4_WIDTH,
                height: A4_HEIGHT,
                logging: false
            });

            const link = document.createElement('a');
            link.download = `Lettera_Missione_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast({ title: "Lettera scaricata correttamente!" });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore durante la generazione", description: e.message });
        } finally {
            root.unmount();
            if (document.body && document.body.contains(printContainer)) {
                document.body.removeChild(printContainer);
            }
            setIsGenerating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-6">
                <Card className="border-primary/20 shadow-sm bg-primary/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" /> I Tuoi Modelli di Stile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {presets.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {presets.map(p => (
                                    <div key={p.id} className="flex items-center gap-1 bg-background border rounded-md pl-3 pr-1 py-1">
                                        <button onClick={() => handleLoadPreset(p)} className="text-xs font-medium hover:text-primary transition-colors">{p.name}</button>
                                        <button onClick={() => handleDeletePreset(p.id)} className="p-1 hover:text-destructive transition-colors"><Trash2 className="h-3 w-3"/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input placeholder="Nome nuovo modello..." value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="h-9 text-xs" />
                            <Button size="sm" variant="secondary" onClick={handleSavePreset} className="h-9 text-[10px] uppercase font-bold">
                                <Save className="mr-2 h-3.5 w-3.5" /> Salva Stile
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="space-y-6 pt-6">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button 
                                variant={layout === 'A4' ? 'default' : 'outline'} 
                                onClick={() => setLayout('A4')}
                                className="flex-1"
                            >
                                <FileText className="mr-2 h-4 w-4" /> A4 Intero
                            </Button>
                            <Button 
                                variant={layout === 'A5x2' ? 'default' : 'outline'} 
                                onClick={() => setLayout('A5x2')}
                                className="flex-1"
                            >
                                <LayoutGrid className="mr-2 h-4 w-4" /> 2x A5
                            </Button>
                        </div>

                        {letters.slice(0, layout === 'A4' ? 1 : 2).map((letter, idx) => (
                            <div key={idx} className="p-4 border rounded-xl space-y-4 bg-muted/30">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Titolo</Label>
                                        <Input className="h-8 text-sm" value={letter.title} onChange={(e) => updateLetter(idx, 'title', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Font Titolo</Label>
                                        <select 
                                            className="w-full h-8 text-sm border rounded bg-background px-2"
                                            value={letter.titleFont} 
                                            onChange={(e) => updateLetter(idx, 'titleFont', e.target.value)}
                                        >
                                            {fonts.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs">Contenuto</Label>
                                    <Textarea value={letter.content} onChange={(e) => updateLetter(idx, 'content', e.target.value)} className="min-h-[80px] text-sm" />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <Input type="file" accept="image/*" className="hidden" id={`bg-${idx}`} onChange={(e) => handleImageUpload(idx, 'background', e.target.files?.[0] || null)} />
                                    <Button variant="outline" size="sm" asChild><label htmlFor={`bg-${idx}`} className="cursor-pointer text-[10px] uppercase font-bold">Texture</label></Button>
                                    <Input type="file" accept="image/*" className="hidden" id={`logo-${idx}`} onChange={(e) => handleImageUpload(idx, 'logo', e.target.files?.[0] || null)} />
                                    <Button variant="outline" size="sm" asChild><label htmlFor={`logo-${idx}`} className="cursor-pointer text-[10px] uppercase font-bold">Stemma</label></Button>
                                    <Input type="file" accept="image/*" className="hidden" id={`seal-${idx}`} onChange={(e) => handleImageUpload(idx, 'seal', e.target.files?.[0] || null)} />
                                    <Button variant="outline" size="sm" asChild><label htmlFor={`seal-${idx}`} className="cursor-pointer text-[10px] uppercase font-bold">Sigillo</label></Button>
                                </div>
                            </div>
                        ))}

                        <Button 
                            size="lg" 
                            className="w-full shadow-lg" 
                            onClick={handleDownload}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
                            Scarica PNG (600 DPI)
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-2 text-muted-foreground uppercase tracking-widest text-sm font-bold">
                    <Maximize2 className="h-4 w-4" /> Anteprima
                </div>
                <div className="bg-muted-foreground/10 p-4 rounded-2xl overflow-auto max-w-full flex justify-center border-2 border-dashed border-muted-foreground/20">
                    <div 
                        style={{ 
                            width: `${A4_WIDTH}px`, 
                            height: `${A4_HEIGHT}px`,
                            backgroundColor: 'white',
                            transform: 'scale(0.4)',
                            transformOrigin: 'top center',
                        }}
                        className="flex flex-col shadow-2xl"
                    >
                        {layout === 'A4' ? (
                            <SingleLetterPreview data={letters[0]} />
                        ) : (
                            <>
                                <SingleLetterPreview data={letters[0]} isA5 />
                                <div className="border-t border-dashed border-gray-300 relative h-0">
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-[10px] text-gray-400 font-mono">TAGLIA</span>
                                </div>
                                <SingleLetterPreview data={letters[1]} isA5 />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
