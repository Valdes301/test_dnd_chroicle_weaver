'use client';

import { useState, useMemo } from 'react';
import type { CampaignWithRelations, TreasureItem, MagicItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Wand2, Trash2, Coins, Gem, Skull, Loader2, Printer, Pencil, BookPlus, Trophy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as actions from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ExperimentalCardGenerator } from './experimental-card-generator';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './ui/markdown-renderer';

type TreasureGeneratorProps = {
  campaign: CampaignWithRelations;
};

const LOOT_TYPES = [
    { id: 'Monete', label: 'Monete', icon: Coins },
    { id: 'Gioielli', label: 'Gioielli', icon: Gem },
    { id: 'Oggetti Magici', label: 'Magici', icon: Sparkles },
    { id: 'Maledetti', label: 'Maledetti', icon: Skull },
];

export function TreasureGenerator({ campaign }: TreasureGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [location, setLocation] = useState('Forziere in un Dungeon');
  const [valueType, setValueType] = useState<'Random (Scarso)' | 'Random (Medio)' | 'Random (Ricco)' | 'Specifico'>('Random (Medio)');
  const [specificGold, setSpecificGold] = useState<number>(500);
  const [allowedTypes, setAllowedTypes] = useState<string[]>(['Monete', 'Gioielli', 'Oggetti Magici']);
  const [quantity, setQuantity] = useState(3);

  const [tempLoot, setTempLoot] = useState<{ title: string; items: TreasureItem[] } | null>(null);
  const [editingIdx, setEditingIndex] = useState<number | null>(null);
  
  const { toast } = useToast();
  const router = useRouter();

  const handleToggleType = (typeId: string) => {
    setAllowedTypes(prev => prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]);
  };

  const handleGenerate = async () => {
    if (allowedTypes.length === 0) {
        toast({ variant: 'destructive', title: "Seleziona almeno un tipo" });
        return;
    }

    setIsGenerating(true);
    setEditingIndex(null);
    try {
      const result = await actions.generateTreasureAction({
        location,
        valueType,
        specificGold: valueType === 'Specifico' ? specificGold : undefined,
        allowedTypes,
        quantity,
        campaignSummary: campaign.summary || undefined,
      });

      if (!result.success || !result.data) throw new Error(result.error || "Errore IA");

      setTempLoot(result.data);
      toast({ title: "Tesoro Generato!", description: `Ritrovamento: ${result.data.title}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateItem = (idx: number, updates: Partial<TreasureItem>) => {
    if (!tempLoot) return;
    const newItems = [...tempLoot.items];
    newItems[idx] = { ...newItems[idx], ...updates };
    setTempLoot({ ...tempLoot, items: newItems });
  };

  const handleSaveToManual = async (item: TreasureItem) => {
    const result = await actions.saveMagicItem({
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        description: item.description,
        cost: item.cost,
        techType: item.techType,
        campaignId: campaign.id
    });

    if (result.success) {
        toast({ title: "Salvato nel manuale!" });
        router.refresh();
    }
  };

  const handleSaveToRewards = async (item: TreasureItem) => {
    const result = await actions.quickSaveRewardAction(campaign.id, item.name, item.description);
    if (result.success) {
        toast({ title: "Aggiunto alle Ricompense!" });
        router.refresh();
    }
  };

  const itemsForGenerator = useMemo(() => {
    if (!tempLoot) return [];
    return tempLoot.items.map(item => ({
        ...item,
        damage: item.techType === 'reward' ? null : item.cost,
        source: 'created' as const
    })) as any[];
  }, [tempLoot]);

  const initialSelection = useMemo(() => {
    if (!tempLoot) return [];
    return tempLoot.items.map(item => ({
        name: item.name,
        type: 'item' as const
    }));
  }, [tempLoot]);

  return (
    <div className="space-y-8">
      {/* CONFIGURAZIONE */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="grid gap-6 md:grid-cols-2 pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
                <Label>Contesto</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label>Valore</Label>
              <Select value={valueType} onValueChange={(v: any) => setValueType(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Random (Scarso)">Scarso (1-4)</SelectItem>
                  <SelectItem value="Random (Medio)">Medio (5-10)</SelectItem>
                  <SelectItem value="Random (Ricco)">Ricco (11-16)</SelectItem>
                  <SelectItem value="Specifico">Specifico (mo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Contenuto</Label>
                <div className="grid grid-cols-2 gap-2">
                    {LOOT_TYPES.map(type => (
                        <div 
                            key={type.id} 
                            onClick={() => handleToggleType(type.id)}
                            className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                                allowedTypes.includes(type.id) ? "bg-primary/20 border-primary" : "bg-muted/20 opacity-60"
                            )}
                        >
                            <type.icon className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold uppercase">{type.label}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t p-4">
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-11 shadow-lg">
                {isGenerating ? <Loader2 className="mr-2 animate-spin h-5 w-5" /> : <Wand2 className="mr-2 h-5 w-5" />}
                Genera Tesoro
            </Button>
        </CardFooter>
      </Card>

      {/* RISULTATO E EDITING */}
      {tempLoot && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-headline text-2xl text-accent uppercase border-b pb-2">{tempLoot.title}</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                  {tempLoot.items.map((item, idx) => (
                      <Card key={idx} className={cn("relative group", editingIdx === idx && "border-primary")}>
                          <CardHeader className="pb-3">
                              <div className="flex justify-between items-center">
                                  <div className="flex-1 min-w-0">
                                      {editingIdx === idx ? (
                                          <Input value={item.name} onChange={(e) => handleUpdateItem(idx, { name: e.target.value })} className="h-8 text-sm" />
                                      ) : (
                                          <CardTitle className="text-lg leading-tight truncate">{item.name}</CardTitle>
                                      )}
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                      {editingIdx === idx ? (
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={() => setEditingIndex(null)}><Check className="h-4 w-4"/></Button>
                                      ) : (
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIndex(idx)}><Pencil className="h-4 w-4"/></Button>
                                      )}
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setTempLoot({...tempLoot, items: tempLoot.items.filter((_, i) => i !== idx)})}><Trash2 className="h-4 w-4"/></Button>
                                  </div>
                              </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <div className="text-xs bg-muted/30 p-2 rounded flex justify-between font-bold">
                                  <span className="opacity-60 uppercase">Valore:</span>
                                  <span className="text-primary">{item.cost}</span>
                              </div>
                              {editingIdx === idx ? (
                                  <Textarea value={item.description} onChange={(e) => handleUpdateItem(idx, { description: e.target.value })} className="text-xs min-h-[80px]" />
                              ) : (
                                  <MarkdownRenderer content={item.description} className="text-xs text-muted-foreground italic" />
                              )}
                          </CardContent>
                          <CardFooter className="pt-0 flex gap-2">
                              <Button variant="ghost" size="sm" className="h-7 text-[9px] uppercase w-full bg-primary/5" onClick={() => handleSaveToManual(item)}>Manuale</Button>
                              <Button variant="ghost" size="sm" className="h-7 text-[9px] uppercase w-full bg-accent/5" onClick={() => handleSaveToRewards(item)}>Premi</Button>
                          </CardFooter>
                      </Card>
                  ))}
              </div>

              <Separator />

              <div className="bg-background border rounded-xl p-4">
                  <ExperimentalCardGenerator allItems={itemsForGenerator} dbSpells={[]} initialSelection={initialSelection} />
              </div>
          </div>
      )}
    </div>
  );
}
