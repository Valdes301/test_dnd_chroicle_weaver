'use client';

import React, { useState, useMemo, memo, useRef, useLayoutEffect, useCallback } from 'react';
import type { MagicItem, Weapon, Armor, Spell, TechType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Download, Loader2, Wand, Sword, Heart, Beaker, Shield, Zap, Trophy } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createRoot } from 'react-dom/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// --- Dimensioni Standard (A4 96 DPI - Landscape) ---
const A4_WIDTH = 1123;  // 297mm
const A4_HEIGHT = 794;   // 210mm
const CARD_WIDTH = 212;  // 5.6cm
const CARD_HEIGHT = 333; // 8.8cm

// --- Scala per Alta Risoluzione (600 DPI) ---
const PRINT_SCALE = 6.25; 

const BannerIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 50" preserveAspectRatio="none">
        <path 
            d="M2,2 L38,2 L38,48 L20,38 L2,48 Z"
            fill="#d1d5db"
            stroke="black"
            strokeWidth="2"
            strokeLinejoin="round"
        />
    </svg>
);

// --- Item Card ---
type ItemCardData = {
    name: string;
    description: string;
    cost?: string | null;
    rarity?: string;
    attunement?: string;
    damage?: string | null;
    techType?: TechType;
    type: string;
};

const CardDisplay = memo(({ originalName, card, onUpdate, isForPrinting = false }: { originalName: string, card: ItemCardData, onUpdate: (itemName: string, field: keyof ItemCardData, value: string) => void, isForPrinting?: boolean }) => {
    const costValue = card.cost || "N/D";
    
    const nameContainerRef = useRef<HTMLDivElement>(null);
    const nameTextRef = useRef<HTMLHeadingElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    
    const [nameFontSize, setNameFontSize] = useState(22);
    const [fontSize, setFontSize] = useState(16);

    const adjustNameFontSize = useCallback(() => {
        const text = nameTextRef.current;
        if (!text) return;

        let size = 24; 
        text.style.fontSize = `${size}px`;
        text.style.lineHeight = "1.1";

        while (text.offsetHeight > 18 && size > 8) {
            size -= 0.5;
            text.style.fontSize = `${size}px`;
        }
        setNameFontSize(size);
    }, []);

    const adjustFontSize = useCallback(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) return;

        let size = 18; 
        text.style.fontSize = `${size}px`;
        text.style.lineHeight = "1.2";

        const availableHeight = container.clientHeight - 4;

        while (text.offsetHeight > availableHeight && size > 6) {
            size -= 0.2;
            text.style.fontSize = `${size}px`;
        }
        setFontSize(size);
    }, []);

    useLayoutEffect(() => {
        adjustNameFontSize();
        adjustFontSize();
    }, [card.name, card.description, card.damage, adjustNameFontSize, adjustFontSize]);

    const attunementText = (attunement?: string | null) => {
        const lowerAttunement = (attunement || 'no').toLowerCase();
        if (lowerAttunement === 'no' || lowerAttunement === 'non' || lowerAttunement === '') return 'Non richiede Sintonia';
        return `Richiede Sintonia${attunement && attunement !== 'Sì' ? ` (${attunement})` : ''}`;
    };

    const getTechIcon = () => {
        let type = card.techType;
        if (!type || type === 'none') {
            const d = (card.damage || '').toLowerCase();
            const t = (card.type || '').toLowerCase();
            if (t.includes('armatura') || t.includes('scudo') || d.includes('ca ') || d.includes('ac ')) type = 'defense';
            else if (d.includes('cura') || d.includes('guarigione')) type = 'cure';
            else if (t.includes('pozione') || d.includes('acido')) type = 'alchemy';
            else if (d.includes('cariche')) type = 'charges';
            else type = 'damage';
        }
        
        const iconStyle = { width: '12px', height: '12px', display: 'block' };
        
        switch (type) {
            case 'defense': return <Shield style={iconStyle} className="text-sky-700 fill-sky-700/10" />;
            case 'cure': return <Heart style={iconStyle} className="text-red-600 fill-red-600/10" />;
            case 'alchemy': return <Beaker style={iconStyle} className="text-emerald-700" />;
            case 'charges': return <Zap style={iconStyle} className="text-amber-600 fill-amber-600/20" />;
            case 'reward': return <Trophy style={iconStyle} className="text-amber-500 fill-amber-500/10" />;
            case 'damage':
            default: return <Sword style={iconStyle} className="text-gray-900" />;
        }
    };

    const bgUrl = card.type?.toLowerCase().includes('magie') 
        ? "url('/api/assets/card-front-magie.jpg'), url('/api/assets/card-background.jpg')" 
        : "url('/api/assets/card-front-oggetti.jpg'), url('/api/assets/card-background.jpg')";
    
    return (
        <div 
            style={{ 
                width: CARD_WIDTH, 
                height: CARD_HEIGHT,
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased'
            }}
            className="bg-white border-black border-2 rounded-xl p-3 flex flex-col relative text-black font-body overflow-hidden shadow-sm shrink-0 select-none"
        >
            <div 
              className="absolute inset-0 bg-cover bg-center z-0 opacity-15 pointer-events-none"
              style={{ backgroundImage: bgUrl, imageRendering: '-webkit-optimize-contrast' }}
            />
            
            <div className="relative z-10 flex flex-col h-full">
                <div ref={nameContainerRef} className="h-[50px] flex items-center justify-center bg-transparent pt-2 pb-6">
                    <div className="w-full text-center px-2">
                        <h2 
                            ref={nameTextRef}
                            contentEditable={!isForPrinting}
                            suppressContentEditableWarning 
                            onInput={!isForPrinting ? adjustNameFontSize : undefined}
                            onBlur={(e) => !isForPrinting && onUpdate(originalName, 'name', e.currentTarget.innerText)} 
                            style={{ fontSize: `${nameFontSize}px` }}
                            className="font-headline font-bold outline-none w-full text-center uppercase tracking-wider leading-[1.1] break-words"
                        >
                            {card.name}
                        </h2>
                    </div>
                </div>
                <div className="border-b-2 border-black mx-2" />
                
                <div 
                    className="flex flex-col items-center justify-center px-1"
                    style={{ 
                        height: '42px',
                        overflow: 'hidden'
                    }}
                >
                     <div className="flex items-center justify-center gap-2 text-center text-[10px] leading-none mb-1">
                        <div className="whitespace-nowrap">
                            <span className="font-semibold">Costo:</span> {costValue}
                        </div>
                        <span className="text-gray-400">|</span>
                        <div className="font-semibold whitespace-nowrap">
                            {card.rarity || 'Comune'}
                        </div>
                    </div>
                    {card.damage && card.techType !== 'none' && (
                        <div 
                            className="bg-black/5 px-2 rounded-md border border-black/10 flex flex-col"
                            style={{ 
                                height: '26px',
                                marginTop: '2px',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '22px', gap: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '14px', width: '12px', marginTop: '3px' }}>
                                    {getTechIcon()}
                                </div>
                                <span 
                                    style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 'bold', 
                                        display: 'inline-block',
                                        whiteSpace: 'nowrap',
                                        marginTop: '-9px',
                                        lineHeight: '1'
                                    }}
                                >
                                    {card.damage}
                                </span>
                            </div>
                            <div style={{ height: '4px' }} />
                        </div>
                    )}
                </div>
                <div className="border-b-2 border-black mx-2" />
                
                <div ref={containerRef} className="flex-grow py-1 px-2 flex items-center justify-center min-h-0 overflow-hidden text-center">
                    <div 
                        ref={textRef}
                        contentEditable={!isForPrinting}
                        suppressContentEditableWarning 
                        onInput={!isForPrinting ? adjustFontSize : undefined}
                        onBlur={(e) => !isForPrinting && onUpdate(originalName, 'description', e.currentTarget.innerText)} 
                        style={{ fontSize: `${fontSize}px` }}
                        className="w-full outline-none whitespace-pre-wrap text-center pb-2"
                    >
                       {card.description}
                    </div>
                </div>

                <div className="flex-shrink-0 mt-auto">
                    <div className="border-t-2 border-black mx-2" />
                     <div className="h-[14px] flex items-center justify-center text-[9px] text-center italic">
                        {attunementText(card.attunement)}
                    </div>
                </div>
            </div>
        </div>
    );
});
CardDisplay.displayName = 'CardDisplay';

// --- Spell Card ---
type SpellCardData = {
    name: string;
    level: string;
    school: string;
    casting_time: string;
    range: string;
    components: string;
    duration: string;
    description: string;
};

const SpellCardDisplay = memo(({ originalName, card, onUpdate, isForPrinting = false }: { originalName: string, card: SpellCardData, onUpdate?: (originalName: string, field: keyof SpellCardData, value: string) => void, isForPrinting?: boolean }) => {
    const nameContainerRef = useRef<HTMLDivElement>(null);
    const nameTextRef = useRef<HTMLHeadingElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    
    const [nameFontSize, setNameFontSize] = useState(22);
    const [fontSize, setFontSize] = useState(16);

    const adjustNameFontSize = useCallback(() => {
        const text = nameTextRef.current;
        if (!text) return;

        let size = 24; 
        text.style.fontSize = `${size}px`;
        text.style.lineHeight = "1.1";

        while (text.offsetHeight > 18 && size > 8) {
            size -= 0.5;
            text.style.fontSize = `${size}px`;
        }
        setNameFontSize(size);
    }, []);

    const adjustFontSize = useCallback(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) return;

        let size = 18; 
        text.style.fontSize = `${size}px`;
        text.style.lineHeight = "1.2";

        const availableHeight = container.clientHeight - 4;

        while (text.offsetHeight > availableHeight && size > 6) {
            size -= 0.2;
            text.style.fontSize = `${size}px`;
        }
        setFontSize(size);
    }, []);

    useLayoutEffect(() => {
        adjustNameFontSize();
        adjustFontSize();
    }, [card.name, card.description, adjustNameFontSize, adjustFontSize]);

    const formatLevel = (level?: string) => {
        if (!level) return '';
        const lower = level.toLowerCase();
        if (lower === 'trucchetto' || lower === '0' || lower === '0°') return '0°';
        return level.replace('° Livello', '°').replace(' livello', '°').trim();
    }
    const formattedLevel = formatLevel(card.level);

    return (
        <div 
            style={{ 
                width: CARD_WIDTH, 
                height: CARD_HEIGHT,
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased'
            }}
            className="bg-white border-black border-2 rounded-xl p-3 flex flex-col relative font-body text-black overflow-hidden shadow-sm shrink-0 select-none"
        >
            <div 
              className="absolute inset-0 bg-cover bg-center z-0 opacity-15 pointer-events-none"
              style={{ backgroundImage: "url('/api/assets/card-front-magie.jpg'), url('/api/assets/card-background.jpg')", imageRendering: '-webkit-optimize-contrast' }}
            />
            
            <div className="relative z-10 flex flex-col h-full">
                <div ref={nameContainerRef} className="h-[50px] border-b-[3px] border-double border-black relative flex items-center bg-transparent pt-2 pb-8">
                    <div className="w-full pr-10 pl-1 text-center">
                        <h2 
                            ref={nameTextRef}
                            contentEditable={!isForPrinting} 
                            suppressContentEditableWarning 
                            onInput={!isForPrinting ? adjustNameFontSize : undefined}
                            onBlur={(e) => !isForPrinting && onUpdate?.(originalName, 'name', e.currentTarget.innerText)}
                            style={{ fontSize: `${nameFontSize}px` }}
                            className="font-headline font-bold uppercase tracking-wider outline-none leading-[1.1] break-words"
                        >
                            {card.name}
                        </h2>
                    </div>
                    <div className="absolute top-0 right-0 w-10 h-12 flex items-center justify-center">
                        <BannerIcon className="absolute inset-0 w-full h-full" />
                        <div className="relative z-10 font-bold text-black text-[21px] pb-6">
                            {formattedLevel}
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 pt-1 pb-3 grid grid-cols-[65px_1fr] gap-x-1 border-b-2 border-black bg-transparent text-[10px] leading-tight mt-[-9px]">
                    <div className="font-bold uppercase text-gray-700">CAST:</div>
                    <div className="font-medium">{card.casting_time}</div>
                    <div className="font-bold uppercase text-gray-700">RAGGIO:</div>
                    <div className="font-medium">{card.range}</div>
                    <div className="font-bold uppercase text-gray-700">COMP:</div>
                    <div className="font-medium break-words">{card.components}</div>
                    <div className="font-bold uppercase text-gray-700">DURATA:</div>
                    <div className="font-medium">{card.duration}</div>
                    <div className="font-bold uppercase text-gray-700">SCUOLA:</div>
                    <div className="font-medium">{card.school}</div>
                </div>
                
                <div ref={containerRef} className="flex-grow overflow-hidden flex items-center justify-center py-1 min-h-0 text-center">
                    <div 
                        ref={textRef}
                        contentEditable={!isForPrinting} 
                        suppressContentEditableWarning 
                        onInput={!isForPrinting ? adjustFontSize : undefined}
                        onBlur={(e) => !isForPrinting && onUpdate?.(originalName, 'description', e.currentTarget.innerText)}
                        style={{ fontSize: `${fontSize}px` }}
                        className="outline-none w-full px-1 whitespace-pre-wrap text-center pb-2"
                    >
                        {card.description}
                    </div>
                </div>
            </div>
        </div>
    );
});
SpellCardDisplay.displayName = 'SpellCardDisplay';

// --- Main Unified Component ---
interface UnifiedCardGeneratorProps {
  allItems: (MagicItem | Armor | Weapon)[];
  dbSpells: Spell[];
}

type SelectedCard = { name: string; type: 'item' | 'spell' };

export function UnifiedCardGenerator({ allItems, dbSpells }: UnifiedCardGeneratorProps) {
    const [selectedCards, setSelectedCards] = useState<SelectedCard[]>([]);
    const [cardData, setCardData] = useState<Record<string, any>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('oggetti');
    const { toast } = useToast();
    
    const allSelectableItems = useMemo(() => {
        const items = [...allItems].sort((a, b) => a.name.localeCompare(b.name));
        const spells = [...dbSpells].sort((a, b) => a.name.localeCompare(b.name));
        return { items, spells };
    }, [allItems, dbSpells]);

    const filteredItems = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return allSelectableItems.items.filter(item => item.name.toLowerCase().includes(lowerSearch));
    }, [searchTerm, allSelectableItems.items]);

    const filteredSpells = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return allSelectableItems.spells.filter(spell => spell.name.toLowerCase().includes(lowerSearch));
    }, [searchTerm, allSelectableItems.spells]);


    const handleCardSelect = (name: string, type: 'item' | 'spell', checked: boolean) => {
        if (checked && selectedCards.length >= 9) {
            toast({ variant: 'destructive', title: 'Limite raggiunto', description: 'Massimo 9 carte.' });
            return;
        }

        setSelectedCards(prev => {
            const isSelected = prev.some(c => c.name === name);
            if (checked && !isSelected) return [...prev, { name, type }];
            if (!checked && isSelected) return prev.filter(c => c.name !== name);
            return prev;
        });

        if (checked && !cardData[name]) {
            if (type === 'item') {
                const item = allItems.find(i => i.name === name);
                if (item) {
                    let description = 'description' in item ? item.description : '';
                    if (!description && 'damage' in item) description = `Proprietà: ${(item as any).properties}\nPeso: ${(item as any).weight}`;
                    else if (!description && 'armorClass' in item) description = `CA: ${item.armorClass}\nForza: ${item.strength}\nFurtività: ${item.stealth}`;
                    
                    setCardData(prev => ({
                        ...prev,
                        [name]: {
                            name: item.name,
                            description: (description || '').trim(),
                            cost: 'cost' in item ? item.cost : null,
                            rarity: 'rarity' in item ? item.rarity : 'Comune',
                            attunement: 'attunement' in item ? item.attunement : 'No',
                            damage: (item as any).damage || (item as any).armorClass || null,
                            techType: (item as any).techType || null,
                            type: 'type' in item ? item.type : '',
                        }
                    }));
                }
            } else {
                const spell = dbSpells.find(s => s.name === name);
                if (spell) {
                    setCardData(prev => ({
                        ...prev,
                        [name]: {
                            name: spell.name,
                            level: spell.level || '',
                            casting_time: spell.casting_time || '',
                            range: spell.range || '',
                            components: spell.components || '',
                            duration: spell.duration || '',
                            school: spell.school || '',
                            description: spell.description || '',
                            type: 'magie'
                        }
                    }));
                }
            }
        }
    };
    
    const handleCardUpdate = (originalName: string, field: string, value: string) => {
        setCardData(prev => ({
            ...prev,
            [originalName]: { ...prev[originalName], [field]: value }
        }));
    };

    const handleGenerateImages = async () => {
        if (selectedCards.length === 0 || typeof document === 'undefined' || !document.body) return;
        setIsGenerating(true);
        toast({ title: 'Generazione foglio A4 (Alta Risoluzione)...' });

        const printContainer = document.createElement('div');
        printContainer.id = 'print-container-isolated';
        printContainer.style.position = 'fixed';
        printContainer.style.left = '-10000px';
        printContainer.style.top = '-10000px';
        printContainer.style.width = `${A4_WIDTH}px`;
        printContainer.style.height = `${A4_HEIGHT}px`;
        printContainer.style.background = 'white';
        printContainer.style.pointerEvents = 'none';
        printContainer.style.zIndex = '-9999';
        document.body.appendChild(printContainer);

        const root = createRoot(printContainer);

        try {
            const slots = Array.from({ length: 9 });

            const PageComponent = (
                <div 
                    style={{ 
                        width: A4_WIDTH, 
                        height: A4_HEIGHT, 
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
                    {slots.map((_, index) => {
                       const selected = selectedCards[index];
                       if (selected) {
                           const data = cardData[selected.name];
                           if (selected.type === 'item') {
                               return <CardDisplay key={`p-${index}`} originalName={selected.name} card={data} onUpdate={() => {}} isForPrinting={true} />
                           } else {
                               return <SpellCardDisplay key={`p-${index}`} originalName={selected.name} card={data} onUpdate={() => {}} isForPrinting={true} />
                           }
                       } else {
                           return <div key={`empty-${index}`} style={{ width: CARD_WIDTH, height: CARD_HEIGHT }} />
                       }
                    })}
                </div>
            );
            
            await new Promise<void>(resolve => {
                root.render(PageComponent);
                setTimeout(resolve, 1500); 
            });
            
            const canvas = await html2canvas(printContainer, { 
                backgroundColor: "#ffffff",
                scale: PRINT_SCALE,
                useCORS: true,
                width: A4_WIDTH,
                height: A4_HEIGHT,
                logging: false
            });

            const now = new Date();
            const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
            const hasItems = selectedCards.some(c => c.type === 'item');
            const hasSpells = selectedCards.some(c => c.type === 'spell');
            let prefix = 'CARTE';
            if (hasItems && !hasSpells) prefix = 'IC';
            else if (!hasItems && hasSpells) prefix = 'MC';
            else if (hasItems && hasSpells) prefix = 'IC_MC';

            const link = document.createElement('a');
            link.download = `${prefix}_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            toast({ title: 'Foglio scaricato correttamente!' });
        } catch (error: any) {
            console.error("Error generating image:", error);
            toast({ variant: 'destructive', title: 'Errore', description: error.message });
        } finally {
            root.unmount();
            if (document.body && document.body.contains(printContainer)) {
                document.body.removeChild(printContainer);
            }
            setIsGenerating(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="whitespace-nowrap flex items-baseline gap-1">
                            Seleziona Carte <span className="text-[0.65em] font-normal opacity-70">(max 9)</span>
                        </CardTitle>
                        <Input placeholder="Cerca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="oggetti">Oggetti</TabsTrigger>
                                <TabsTrigger value="magie">Magie</TabsTrigger>
                            </TabsList>
                            <ScrollArea className="h-[55vh] mt-4">
                                <TabsContent value="oggetti" className="space-y-2 pr-4">
                                    {filteredItems.map(item => (
                                        <div key={item.name} className="flex items-center space-x-2 py-1 border-b border-border/50 last:border-0">
                                            <Checkbox 
                                                id={`s-${item.name}`} 
                                                checked={selectedCards.some(c => c.name === item.name)} 
                                                onCheckedChange={(checked) => handleCardSelect(item.name, 'item', !!checked)} 
                                            />
                                            <label htmlFor={`s-${item.name}`} className="text-sm font-medium flex-1 cursor-pointer truncate">{item.name}</label>
                                        </div>
                                    ))}
                                </TabsContent>
                                <TabsContent value="magie" className="space-y-2 pr-4">
                                    {filteredSpells.map(spell => (
                                        <div key={spell.name} className="flex items-center space-x-2 py-1 border-b border-border/50 last:border-0">
                                            <Checkbox 
                                                id={`s-${spell.name}`} 
                                                checked={selectedCards.some(c => c.name === spell.name)} 
                                                onCheckedChange={(checked) => handleCardSelect(spell.name, 'spell', !!checked)} 
                                            />
                                            <label htmlFor={`s-${spell.name}`} className="text-sm font-medium flex-1 cursor-pointer truncate">{spell.name}</label>
                                        </div>
                                    ))}
                                </TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2 flex flex-col gap-4">
                <Button onClick={handleGenerateImages} disabled={selectedCards.length === 0 || isGenerating} size="lg" className="w-full shadow-lg">
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isGenerating ? 'Generazione in corso...' : `Genera Foglio A4 (${selectedCards.length}/9)`}
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Anteprima e Modifica</CardTitle>
                        <CardDescription>Clicca sul testo per rifinire i contenuti prima della stampa. Dimensione: 5,6 x 8,8 cm.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center min-h-[400px]">
                             {selectedCards.length > 0 ? (
                                selectedCards.map(selected => {
                                    const data = cardData[selected.name];
                                    if (!data) return null;
                                    if (selected.type === 'item') {
                                        return <CardDisplay key={`e-${selected.name}`} originalName={selected.name} card={data} onUpdate={handleCardUpdate} />;
                                    } else {
                                        return <SpellCardDisplay key={`e-${selected.name}`} originalName={selected.name} card={data} onUpdate={handleCardUpdate} />;
                                    }
                                })
                            ) : (
                                <div className="col-span-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg w-full p-12">
                                    < Wand className="h-12 w-12 mb-4 opacity-20" />
                                    <p>Seleziona le carte dalla lista a sinistra per iniziare.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
