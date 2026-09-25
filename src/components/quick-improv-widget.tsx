'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Beer, Wand2, Loader2, RefreshCw, Copy, ChevronUp, ChevronDown, Globe, BookOpen, AlertCircle, CheckCircle2, Sparkles, Ghost, ShieldAlert, MessageSquare, CloudSun, Zap, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as actions from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MarkdownRenderer } from './ui/markdown-renderer';

type QuickImprovWidgetProps = {
    campaignId: string;
    inline?: boolean;
};

const IMPROV_CATEGORIES = [
    { id: 'dicerie', label: 'Dicerie e Segreti', icon: MessageSquare, description: 'Voci di taverna e ganci di trama' },
    { id: 'conseguenze', label: 'Conseguenze', icon: Zap, description: 'Cosa succede dopo le azioni dei PG' },
    { id: 'clima', label: 'Atmosfera e Clima', icon: CloudSun, description: 'Dettagli sensoriali e meteo' },
    { id: 'incontri', label: 'Incontri Rapidi', icon: Sparkles, description: 'Interazioni con la folla o eventi' },
    { id: 'nomi', label: 'Nomi Fantastici', icon: Fingerprint, description: 'Elenchi di nomi pronti all\'uso' },
];

export function QuickImprovWidget({ campaignId, inline = false }: QuickImprovWidgetProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [question, setQuestion] = useState('');
    const [category, setCategory] = useState('dicerie');
    const [isGenerating, setIsGenerating] = useState(false);
    const [numPlot, setNumPlot] = useState(1);
    const [numWorld, setNumWorld] = useState(1);
    const [numFalse, setNumFalse] = useState(1);
    const [result, setResult] = useState<{ items: { text: string; focus: 'trama' | 'mondo'; isFalse: boolean }[] } | null>(null);
    const { toast } = useToast();

    const handleImprov = async () => {
        setIsGenerating(true);
        setResult(null);
        try {
            const res = await actions.quickImprovAction({ 
                campaignId, 
                question: question.trim() || `Genera spunti casuali per la categoria: ${category}`, 
                numPlot,
                numWorld,
                numFalse,
                category
            });
            if (res.success && res.data) {
                setResult(res.data);
            } else throw new Error(res.error || "L'oste è occupato... Verifica le chiavi API.");
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Errore Taverna", description: e.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Testo copiato!" });
    };

    return (
        <div className="flex flex-col h-full">
            <CardHeader className={cn("p-4 bg-primary/10 border-b flex flex-row items-center justify-center relative shrink-0", inline && "hidden")}>
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Beer className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-sm font-headline uppercase tracking-widest text-center">Taverna</CardTitle>
                </div>
                <div className="absolute right-4 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
                        {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>

            {!isMinimized && (
                <>
                    <CardContent className="flex-1 p-0 flex flex-col bg-background/50 backdrop-blur-sm">
                        <ScrollArea className={cn("flex-1 p-4 sm:p-6", inline ? "h-[500px]" : "h-full")}>
                            <div className="space-y-8">
                                {/* CATEGORIA E CONFIG */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Cosa desideri?</Label>
                                        <Select value={category} onValueChange={setCategory}>
                                            <SelectTrigger className="h-11 bg-muted/20 border-primary/20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {IMPROV_CATEGORIES.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>
                                                        <div className="flex items-center gap-2 py-1">
                                                            <cat.icon className="h-4 w-4 text-primary" />
                                                            <div className="flex flex-col text-left">
                                                                <span className="font-bold text-xs">{cat.label}</span>
                                                                <span className="text-[9px] opacity-60 leading-none">{cat.description}</span>
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="h-px bg-border flex-1" />
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.2em] px-2">Quantità e Veridicità</Label>
                                            <div className="h-px bg-border flex-1" />
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-2 group">
                                                <div className="flex items-center justify-center gap-1.5 text-primary transition-colors group-focus-within:text-primary">
                                                    <BookOpen className="h-3 w-3" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Trama</span>
                                                </div>
                                                <Input 
                                                    type="number" 
                                                    min={0} max={5}
                                                    value={numPlot} 
                                                    onChange={(e) => setNumPlot(parseInt(e.target.value) || 0)}
                                                    className="h-8 text-center bg-muted/20 border-primary/20 focus:border-primary/50 transition-all font-mono text-xs"
                                                />
                                            </div>
                                            <div className="space-y-2 group">
                                                <div className="flex items-center justify-center gap-1.5 text-accent transition-colors group-focus-within:text-accent">
                                                    <Globe className="h-3 w-3" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Mondo</span>
                                                </div>
                                                <Input 
                                                    type="number" 
                                                    min={0} max={5}
                                                    value={numWorld} 
                                                    onChange={(e) => setNumWorld(parseInt(e.target.value) || 0)}
                                                    className="h-8 text-center bg-muted/20 border-accent/20 focus:border-accent/50 transition-all font-mono text-xs"
                                                />
                                            </div>
                                            <div className="space-y-2 group">
                                                <div className="flex items-center justify-center gap-1.5 text-rose-500 transition-colors group-focus-within:text-rose-500">
                                                    <ShieldAlert className="h-3 w-3" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">False</span>
                                                </div>
                                                <Input 
                                                    type="number" 
                                                    min={0} max={5}
                                                    value={numFalse} 
                                                    onChange={(e) => setNumFalse(parseInt(e.target.value) || 0)}
                                                    className="h-8 text-center bg-muted/20 border-rose-500/20 focus:border-rose-500/50 transition-all font-mono text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isGenerating && (
                                    <div className="flex flex-col items-center justify-center py-16 space-y-4 animate-in fade-in duration-500">
                                        <div className="relative">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                            <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-accent animate-pulse" />
                                        </div>
                                        <p className="text-[10px] font-headline uppercase tracking-[0.3em] animate-pulse text-center text-muted-foreground">L'Oste sta preparando la tua richiesta...</p>
                                    </div>
                                )}

                                {result && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                                        {result.items.map((item, idx) => (
                                            <div key={idx} className="space-y-3 group/item animate-in zoom-in-95 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                                <div className={cn(
                                                    "p-5 rounded-2xl border-2 relative overflow-hidden transition-all shadow-sm",
                                                    item.focus === 'trama' ? "bg-primary/5 border-primary/10" : "bg-accent/5 border-accent/10"
                                                )}>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            {item.focus === 'trama' ? (
                                                                <BookOpen className="h-4 w-4 text-primary" />
                                                            ) : (
                                                                <Globe className="h-4 w-4 text-accent" />
                                                            )}
                                                            <span className="text-[9px] uppercase font-bold tracking-[0.15em] opacity-60">
                                                                {category === 'nomi' ? 'Proposta' : `Diceria di ${item.focus}`}
                                                            </span>
                                                        </div>
                                                        <Badge 
                                                            variant={item.isFalse ? "destructive" : "outline"} 
                                                            className={cn(
                                                                "text-[8px] uppercase h-5 px-2 font-bold tracking-wider",
                                                                !item.isFalse && "border-emerald-500/50 text-emerald-500 bg-emerald-500/10"
                                                            )}
                                                        >
                                                            {item.isFalse ? (
                                                                <span className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> FALSO</span>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> VERO</span>
                                                            )}
                                                        </Badge>
                                                    </div>
                                                    <MarkdownRenderer 
                                                        content={item.text} 
                                                        className="text-sm leading-relaxed font-body text-foreground/90 italic pl-4 border-l-2 border-border/40"
                                                    />
                                                </div>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="w-full text-[10px] h-9 gap-2 uppercase tracking-widest font-bold transition-all hover:bg-primary hover:text-primary-foreground shadow-md" 
                                                    onClick={() => handleCopy(item.text)}
                                                >
                                                    <Copy className="h-3.5 w-3.5" /> Copia Spunto
                                                </Button>
                                            </div>
                                        ))}
                                        
                                        <Button variant="ghost" size="sm" className="w-full text-[10px] h-10 gap-2 mt-4 uppercase tracking-[0.2em] font-bold text-muted-foreground hover:text-primary" onClick={() => setResult(null)}>
                                            <RefreshCw className="h-4 w-4" /> Nuova Richiesta
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-4 sm:p-6 border-t bg-muted/10 shrink-0">
                        <div className="relative w-full shadow-2xl rounded-xl overflow-hidden border border-primary/20">
                            <Textarea 
                                placeholder="Dettagli extra? (Opzionale)..."
                                className="min-h-[100px] text-sm pr-12 p-4 resize-none bg-background focus:ring-0 focus:ring-offset-0 border-none leading-relaxed"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleImprov())}
                                disabled={isGenerating}
                            />
                            <Button 
                                size="icon" 
                                className="absolute bottom-3 right-3 h-10 w-10 rounded-full shadow-lg"
                                onClick={() => handleImprov()}
                                disabled={isGenerating}
                            >
                                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                            </Button>
                        </div>
                    </CardFooter>
                </>
            )}
        </div>
    );
}
