'use client';

import { useState, useEffect } from 'react';
import type { MagicItem, Shop, ShopItem, CampaignWithRelations } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Store, Wand2, Plus, Trash2, Save, ShoppingBag, User, ScrollText, Sparkles, BookPlus, Percent, Skull, Pencil, Check, X, AlertCircle, Loader2, Shield, Lock } from 'lucide-react';
import { isPlayerMode } from '@/lib/pin-storage';
import { useToast } from '@/hooks/use-toast';
import * as actions from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { MarkdownRenderer } from './ui/markdown-renderer';

type ShopManagerProps = {
  campaign: CampaignWithRelations;
  dbItems: MagicItem[];
  savedShops: Shop[];
};

export function ShopManager({ campaign, dbItems, savedShops }: ShopManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shopType, setShopType] = useState('Mercante Generale');
  const [numCommon, setNumCommon] = useState(10);
  const [numUncommon, setNumUncommon] = useState(5);
  const [numRare, setNumRare] = useState(2);
  const [numAiItems, setNumAiItems] = useState(3);
  const [generateCursed, setGenerateCursed] = useState(false);
  const [discount, setDiscount] = useState(10); 

  const [tempShop, setTempShop] = useState<{
    name: string;
    owner: string;
    description: string;
    items: ShopItem[];
  } | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCost, setEditCost] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { toast } = useToast();
  const router = useRouter();

  const [playerMode, setPlayerModeState] = useState<boolean>(false);

  useEffect(() => {
    setPlayerModeState(isPlayerMode());
    const handlePlayerModeChange = (e: any) => {
      setPlayerModeState(Boolean(e.detail?.isPlayerMode));
    };
    window.addEventListener('dnd-player-mode-changed', handlePlayerModeChange);
    return () => window.removeEventListener('dnd-player-mode-changed', handlePlayerModeChange);
  }, []);

  const isBernard = shopType === 'Bernard';

  useEffect(() => {
    if (isBernard) {
        setGenerateCursed(false);
    }
  }, [isBernard]);

  const formatPriceWithDiscount = (price: string | null | undefined, pct: number) => {
    if (!price || pct <= 0 || price === 'N/D') return price || 'N/D';
    const numericPart = price.replace(/[^\d]/g, '');
    const unitPart = price.replace(/[\d\s.,]/g, '');
    const val = parseInt(numericPart);
    if (isNaN(val)) return price;
    
    const discounted = Math.floor(val * (1 - pct / 100));
    return `${discounted.toLocaleString('it-IT')} ${unitPart}`;
  };

  const handleGenerateShop = async () => {
    setIsGenerating(true);
    setEditingIndex(null);
    try {
      const aiResult = await actions.generateShopAction({
        shopType: shopType as any,
        campaignSummary: campaign.summary || undefined,
        numAiItems,
        generateCursed: isBernard ? false : generateCursed,
      });

      if (!aiResult.success || !aiResult.data) throw new Error(aiResult.error || "Errore IA");

      const dbShopItems: ShopItem[] = [];
      
      const pickRandom = (rarity: string, count: number) => {
        const pool = (dbItems || []).filter(i => i.rarity && i.rarity.toLowerCase() === rarity.toLowerCase());
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map(i => ({
          name: i.name,
          type: i.type,
          rarity: i.rarity,
          cost: i.cost || 'N/D',
          description: i.description,
          source: 'database' as const
        }));
      };

      dbShopItems.push(...pickRandom('Comune', numCommon));
      dbShopItems.push(...pickRandom('Non Comune', numUncommon));
      dbShopItems.push(...pickRandom('Rara', numRare));

      const aiItems: ShopItem[] = aiResult.data.customItems.map(i => ({ ...i, source: 'ai' }));

      setTempShop({
        name: aiResult.data.shopName,
        owner: aiResult.data.ownerName,
        description: aiResult.data.ownerDescription,
        items: [...aiItems, ...dbShopItems]
      });

      toast({ title: "Bottega Generata!", description: `${aiResult.data.shopName} ha aperto i battenti.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const startEditing = (idx: number, item: ShopItem) => {
    setEditingIndex(idx);
    setEditCost(item.cost);
    setEditDescription(item.description);
  };

  const saveEdit = () => {
    if (editingIndex === null || !tempShop) return;
    const newItems = [...tempShop.items];
    newItems[editingIndex] = {
      ...newItems[editingIndex],
      cost: editCost,
      description: editDescription
    };
    setTempShop({ ...tempShop, items: newItems });
    setEditingIndex(null);
    toast({ title: "Oggetto aggiornato localmente" });
  };

  const handleSaveShop = async () => {
    if (!tempShop) return;

    const finalItems = isBernard 
        ? tempShop.items.map(it => ({ ...it, cost: formatPriceWithDiscount(it.cost, discount) }))
        : tempShop.items;

    const result = await actions.saveShop({
      campaignId: campaign.id,
      name: tempShop.name,
      owner: tempShop.owner,
      description: tempShop.description,
      inventory: JSON.stringify(finalItems)
    });

    if (result.success) {
      toast({ title: "Bottega Salvata!", description: "Ora puoi trovarla nella tua lista botteghe." });
      setTempShop(null);
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Errore", description: result.error || "Impossibile salvare." });
    }
  };

  const handleDeleteShop = async (id: string) => {
    const result = await actions.deleteShop(id);
    if (result.success) {
      toast({ title: "Bottega Rimossa" });
      router.refresh();
    }
  };

  const handleAddItemToDb = async (item: ShopItem) => {
    const result = await actions.saveMagicItem({
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      description: item.description,
      cost: isBernard ? formatPriceWithDiscount(item.cost, discount) : item.cost,
      campaignId: campaign.id
    });

    if (result.success) {
      toast({ title: "Oggetto Aggiunto!", description: `${item.name} è ora nel tuo manuale.` });
      router.refresh();
    }
  };

  return (
    <div className="space-y-8">
      {playerMode ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-serif font-bold text-emerald-300 text-sm">Emporio e Catalogo Merci (Modalità Giocatore)</p>
                <p className="text-xs text-stone-400">In questa visuale sono visibili soltanto i prezzi di listino e la merce pubblica esposta dai mercanti.</p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] uppercase shrink-0">
              🛡️ Vista Pulita
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="grid gap-6 md:grid-cols-2 pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Tipo di Bottega</Label>
                  <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">🔒 Solo DM</Badge>
                </div>
                <Select value={shopType} onValueChange={setShopType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mercante Generale">Mercante Generale</SelectItem>
                    <SelectItem value="Alchimista">L'Alchimista</SelectItem>
                    <SelectItem value="Armaiolo">L'Armaiolo</SelectItem>
                    <SelectItem value="Emporio Magico">Emporio Magico</SelectItem>
                    <SelectItem value="Bernard">Bernard (Il magnifico emporio)</SelectItem>
                    <SelectItem value="Contrabbandiere">Contrabbandiere (Generico)</SelectItem>
                    <SelectItem value="Mercante Itinerante">Mercante Itinerante</SelectItem>
                    <SelectItem value="Truffatore">Il Truffatore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Oggetti Unici dell'IA</Label>
                <Input type="number" value={numAiItems} onChange={(e) => setNumAiItems(parseInt(e.target.value) || 0)} min={0} max={10} />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch 
                  id="cursed-toggle" 
                  checked={generateCursed} 
                  onCheckedChange={setGenerateCursed} 
                  disabled={isBernard}
                  className="scale-75"
                />
                <Label htmlFor="cursed-toggle" className={`text-[10px] uppercase font-bold flex items-center gap-2 cursor-pointer ${isBernard ? 'opacity-30' : 'text-destructive'}`}>
                  <Skull className="h-3 w-3" /> Maledetti {isBernard && "(N/A)"}
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-start">
              <div className="space-y-2">
                <Label className="h-10 flex items-center">Comuni</Label>
                <Input type="number" value={numCommon} onChange={(e) => setNumCommon(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label className="h-10 flex items-center leading-tight">Non Comuni</Label>
                <Input type="number" value={numUncommon} onChange={(e) => setNumUncommon(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label className="h-10 flex items-center">Rari</Label>
                <Input type="number" value={numRare} onChange={(e) => setNumRare(parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleGenerateShop} disabled={isGenerating} className="w-full h-11">
              {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
              Genera Bottega
            </Button>
          </CardFooter>
        </Card>
      )}

      {tempShop && (
        <Card className="border-accent/40 animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="bg-accent/10">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl font-headline text-accent">{tempShop.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <User className="h-4 w-4" /> <span className="font-bold">{tempShop.owner}</span>
                </div>
              </div>
              <Button onClick={handleSaveShop} variant="secondary">
                <Save className="mr-2 h-4 w-4" /> Salva Bottega
              </Button>
            </div>
            
            {isBernard ? (
                <div className="flex items-center gap-4 mt-6 bg-accent/20 p-4 rounded-lg border border-accent/30 shadow-inner">
                    <div className="bg-accent p-2 rounded-full">
                        <Percent className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <Label className="text-xs font-bold uppercase tracking-wider text-accent">Sconto Amicizia di Bernard</Label>
                        <div className="flex items-center gap-3">
                            <Input 
                                type="number" 
                                value={discount} 
                                onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                className="w-20 h-9 font-bold text-center border-accent/40"
                            />
                            <span className="text-sm font-medium text-muted-foreground">% di sconto applicato</span>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="mt-4 italic text-sm border-l-4 border-accent/30 pl-4">{tempShop.description}</p>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            <h4 className="font-bold uppercase text-xs tracking-widest text-muted-foreground mb-4">Inventario Disponibile</h4>
            <Accordion type="single" collapsible className="w-full">
              {tempShop.items.map((item, idx) => {
                const discountedPrice = isBernard ? formatPriceWithDiscount(item.cost, discount) : item.cost;
                const isEditing = editingIndex === idx;

                return (
                  <AccordionItem key={idx} value={`item-${idx}`}>
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center gap-3 text-left w-full">
                        {item.source === 'ai' ? <Sparkles className="h-4 w-4 text-accent" /> : <ShoppingBag className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium truncate max-w-[120px] sm:max-w-none">{item.name}</span>
                        <Badge variant="outline" className="ml-2 text-[10px] hidden sm:inline-flex">{item.rarity}</Badge>
                        
                        <div className="ml-auto mr-4 flex flex-col items-end">
                            {isBernard && discount > 0 && item.cost !== 'N/D' ? (
                                <>
                                    <span className="text-[10px] line-through opacity-40 font-mono">{item.cost}</span>
                                    <span className="text-xs text-accent font-bold font-mono">{discountedPrice}</span>
                                </>
                            ) : (
                                <span className="text-xs text-muted-foreground font-mono">{item.cost}</span>
                            )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="bg-muted/30 p-4 rounded-lg text-sm">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-bold text-xs uppercase tracking-tighter">Tipo: {item.type}</span>
                          <div className="flex gap-2">
                             {!isEditing ? (
                                 <>
                                    <Button size="icon" variant="ghost" onClick={() => startEditing(idx, item)} className="h-7 w-7">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    {item.source === 'ai' && (
                                      <Button size="sm" variant="ghost" onClick={() => handleAddItemToDb(item)} className="h-7 text-[10px] px-2 bg-accent/20 hover:bg-accent/30">
                                        <BookPlus className="mr-1 h-3 w-3" /> Manuale
                                      </Button>
                                    )}
                                 </>
                             ) : (
                                <>
                                    <Button size="icon" variant="ghost" onClick={saveEdit} className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10">
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setEditingIndex(null)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </>
                             )}
                          </div>
                        </div>

                        {isEditing ? (
                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Prezzo</Label>
                                    <Input 
                                        value={editCost} 
                                        onChange={(e) => setEditCost(e.target.value)} 
                                        className="h-9 text-sm bg-background/50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Descrizione</Label>
                                    <Textarea 
                                        value={editDescription} 
                                        onChange={(e) => setEditDescription(e.target.value)} 
                                        className="min-h-[120px] text-sm bg-background/50 leading-relaxed"
                                    />
                                </div>
                            </div>
                        ) : (
                            <MarkdownRenderer content={item.description} className="text-muted-foreground leading-relaxed text-sm" />
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {savedShops.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-headline text-2xl flex items-center gap-2 border-b pb-2">
            <ShoppingBag className="h-5 w-5" /> Botteghe nel Mondo
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {savedShops.map((shop) => {
              let inventory: ShopItem[] = [];
              let parseError = false;

              try {
                  inventory = JSON.parse(shop.inventory || '[]');
                  if (!Array.isArray(inventory)) inventory = [];
              } catch (e) {
                  console.error("Error parsing shop inventory:", e);
                  parseError = true;
              }

              return (
                <Card key={shop.id} className={parseError ? "border-destructive/40" : ""}>
                  <CardHeader>
                    <div className="flex justify-between">
                      <CardTitle className="font-headline">{shop.name || "Bottega senza nome"}</CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteShop(shop.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>{shop.owner || "Proprietario ignoto"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2 italic mb-4">{shop.description || "Nessuna descrizione disponibile."}</p>
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-[10px] uppercase text-muted-foreground">Merce in evidenza:</p>
                      {parseError ? (
                          <div className="flex items-center gap-2 text-destructive text-[10px] font-bold uppercase mt-2">
                              <AlertCircle className="h-3 w-3" /> Inventario corrotto
                          </div>
                      ) : inventory.length > 0 ? (
                          inventory.slice(0, 3).map((it, i) => (
                            <div key={i} className="flex justify-between text-xs border-b border-border/50 py-1 last:border-0">
                              <span className="truncate mr-2">{it.name}</span>
                              <span className="font-mono text-muted-foreground shrink-0">{it.cost}</span>
                            </div>
                          ))
                      ) : (
                          <p className="text-[10px] italic text-muted-foreground">Inventario vuoto.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
