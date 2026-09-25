"use client";

import { useState, useMemo, useEffect, useId, memo } from "react";
import type { Npc, NpcDetails, CharacterEvent } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  History,
  UserCircle,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  Settings,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  FileText,
  Download,
  User2,
  Footprints,
  Fingerprint,
  ImagePlus,
  Library,
  GripVertical,
  Lock,
  Shield,
  EyeOff,
  Crown,
} from "lucide-react";
import { isPlayerMode } from "@/lib/pin-storage";
import { Separator } from "./ui/separator";
import { useToast } from "@/hooks/use-toast";
import * as actions from "@/lib/actions";
import { cn, safeJsonParse } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Textarea } from "./ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Switch } from "./ui/switch";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import Image from "next/image";
import { Label } from "./ui/label";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "./ui/checkbox";

type NpcWithLastEvent = Omit<Npc, 'details'> & {
  details: NpcDetails;
  lastEvent: any | null;
};

type NpcSummaryProps = {
  campaignId: string;
  npcs: Npc[];
};

const npcEditSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio."),
  race: z.string().min(1, "La razza è obbligatoria."),
  gender: z.string(),
  age: z.string(),
  status: z.string(),
  alignment: z.string(),
  attitude: z.string().optional().default("Neutrale"),
  occupation: z.string(),
  appearance: z.string(),
  personality: z.string(),
  mannerism: z.string().optional(),
  secret: z.string().optional(),
  encounterHook: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  isHidden: z.boolean().optional(),
  hiddenFields: z.array(z.string()).optional(),
});

type NpcEditFormData = z.infer<typeof npcEditSchema>;

function AssetBrowser({
  onSelect,
  currentUrl,
}: {
  onSelect: (url: string) => void;
  currentUrl?: string | null;
}) {
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    actions.listAssetsAction().then((res) => {
      if (res.success && res.data) setAssets(res.data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading)
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="animate-spin h-5 w-5" />
      </div>
    );

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
      {assets.map((asset) => (
        <div
          key={asset.name}
          onClick={() => onSelect(asset.url)}
          className={cn(
            "relative aspect-square rounded-md overflow-hidden border-2 cursor-pointer transition-all hover:scale-105",
            currentUrl === asset.url
              ? "border-primary ring-2 ring-primary/20"
              : "border-transparent opacity-60 hover:opacity-100",
          )}
        >
          <img
            src={asset.url}
            alt={asset.name}
            className="h-full w-full object-cover"
          />
          {currentUrl === asset.url && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <Check className="text-white h-6 w-6 drop-shadow-md" />
            </div>
          )}
        </div>
      ))}
      {assets.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic col-span-full">
          Nessuna immagine caricata nel server.
        </p>
      )}
    </div>
  );
}

function NpcEditDialog({
  npc,
  campaignId,
  open,
  onOpenChange,
  onSaved,
}: {
  npc: NpcWithLastEvent | null;
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const formId = useId();
  const { toast } = useToast();

  const form = useForm<NpcEditFormData>({
    resolver: zodResolver(npcEditSchema),
    defaultValues: {
      name: "",
      race: "",
      gender: "Maschio",
      age: "Adulto",
      status: "Normale",
      alignment: "Neutrale",
      attitude: "Neutrale",
      occupation: "",
      appearance: "",
      personality: "",
      mannerism: "",
      secret: "",
      encounterHook: "",
      imageUrl: "",
      isHidden: false,
      hiddenFields: [],
    },
  });

  useEffect(() => {
    if (open) {
      setShowLibrary(false);
      if (npc) {
        form.reset({
          name: npc.name || "",
          race: npc.race || "",
          gender: npc.gender || npc.details.gender || "Maschio",
          age: npc.age || npc.details.age || "Adulto",
          status: npc.status || npc.details.status || "Normale",
          alignment: npc.alignment || npc.details.alignment || "Neutrale",
          attitude: npc.details.attitude || "Neutrale",
          occupation: npc.details.occupation || "",
          appearance: npc.details.appearance || "",
          personality: npc.details.personality || "",
          mannerism: npc.details.mannerism || "",
          secret: npc.details.secret || "",
          encounterHook: npc.details.encounterHook || "",
          imageUrl: npc.details.imageUrl || "",
          isHidden: npc.details.isHidden ?? false,
          hiddenFields: npc.details.hiddenFields || [],
        });
      } else {
        form.reset({
          name: "",
          race: "",
          gender: "Maschio",
          age: "Adulto",
          status: "Normale",
          alignment: "Neutrale",
          attitude: "Neutrale",
          occupation: "",
          appearance: "",
          personality: "",
          mannerism: "",
          secret: "",
          encounterHook: "",
          imageUrl: "",
          isHidden: false,
          hiddenFields: [],
        });
      }
    }
  }, [open, npc?.id, form]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const currentName = form.getValues("name");
      const result = await actions.uploadGenericImage(
        event.target?.result as string,
        currentName,
      );
      if (result.success && result.data) {
        form.setValue("imageUrl", result.data.url);
        toast({ title: "Ritratto caricato!" });
      } else {
        toast({
          variant: "destructive",
          title: "Errore caricamento",
          description: result.error,
        });
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (values: NpcEditFormData) => {
    const details: NpcDetails = {
      ...values,
      mannerism: values.mannerism || "",
      secret: values.secret || "",
      encounterHook: values.encounterHook || "",
      imageUrl: values.imageUrl || "",
      isHidden: values.isHidden ?? false,
      hiddenFields: values.hiddenFields || [],
    } as NpcDetails;

    const res = await actions.saveNpc({
      id: npc?.id,
      campaignId,
      name: values.name,
      race: values.race,
      gender: values.gender,
      age: values.age,
      status: values.status,
      alignment: values.alignment,
      details: JSON.stringify(details),
    });

    if (res.success) {
      toast({ title: npc ? "Scheda PNG Aggiornata!" : "Nuovo PNG Creato!" });
      onOpenChange(false);
      onSaved();
    } else {
      toast({
        variant: "destructive",
        title: "Errore",
        description: res.error,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] w-[95vw] sm:w-full flex flex-col p-0 overflow-hidden outline-none">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/10">
          <DialogTitle className="font-headline text-2xl text-left">
            {npc ? `Modifica PNG: ${npc.name}` : "Crea Nuovo PNG"}
          </DialogTitle>
          <DialogDescription className="text-left">
            Inserisci i dati per dare vita a un nuovo abitante del tuo mondo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
          <Form {...form}>
            <form
              id={formId}
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6 py-6 text-left"
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-48 space-y-2 shrink-0 flex flex-col items-center">
                  <Label>Ritratto (Avatar)</Label>
                  <div className="relative h-40 w-40 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center group shadow-lg bg-muted">
                    {form.watch("imageUrl") ? (
                      <img
                        src={form.watch("imageUrl")!}
                        alt="Ritratto"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-4 opacity-40">
                        <ImagePlus className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-[10px]">Tocca per caricare</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={isUploading}
                    />
                    {isUploading && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <Loader2 className="animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="link"
                      type="button"
                      size="sm"
                      className="p-0 h-auto text-[10px]"
                      onClick={() => setShowLibrary(!showLibrary)}
                    >
                      {showLibrary ? "Chiudi Libreria" : "Libreria Server"}
                    </Button>
                    <Button
                      variant="link"
                      type="button"
                      size="sm"
                      className="p-0 h-auto text-[10px] text-destructive"
                      onClick={() => form.setValue("imageUrl", "")}
                    >
                      Rimuovi
                    </Button>
                  </div>

                  {showLibrary && (
                    <ScrollArea className="h-40 w-full rounded border bg-background p-2 mt-2">
                      <AssetBrowser
                        currentUrl={form.watch("imageUrl")}
                        onSelect={(url) => {
                          form.setValue("imageUrl", url);
                          setShowLibrary(false);
                        }}
                      />
                    </ScrollArea>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="race"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Razza</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Occupazione / Ruolo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Genere</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Maschio">Maschio</SelectItem>
                              <SelectItem value="Femmina">Femmina</SelectItem>
                              <SelectItem value="Non binario">
                                Non binario
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Età</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Bambino">Bambino</SelectItem>
                              <SelectItem value="Ragazzo">Ragazzo</SelectItem>
                              <SelectItem value="Adulto">Adulto</SelectItem>
                              <SelectItem value="Vecchio">Vecchio</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stato Sociale</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Miserabile">
                                Miserabile
                              </SelectItem>
                              <SelectItem value="Povero">Povero</SelectItem>
                              <SelectItem value="Normale">Normale</SelectItem>
                              <SelectItem value="Ricco">Ricco</SelectItem>
                              <SelectItem value="Sfarzoso">Sfarzoso</SelectItem>
                              <SelectItem value="Nobile">Nobile</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="alignment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Allineamento</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Legale Buono">
                                Legale Buono
                              </SelectItem>
                              <SelectItem value="Neutrale Buono">
                                Neutrale Buono
                              </SelectItem>
                              <SelectItem value="Caotico Buono">
                                Caotico Buono
                              </SelectItem>
                              <SelectItem value="Legale Neutrale">
                                Legale Neutrale
                              </SelectItem>
                              <SelectItem value="Neutrale">Neutrale</SelectItem>
                              <SelectItem value="Caotico Neutrale">
                                Caotico Neutrale
                              </SelectItem>
                              <SelectItem value="Legale Malvagio">
                                Legale Malvagio
                              </SelectItem>
                              <SelectItem value="Neutrale Malvagio">
                                Neutrale Malvagio
                              </SelectItem>
                              <SelectItem value="Caotico Malvagio">
                                Caotico Malvagio
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="attitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Atteggiamento</FormLabel>
                          <Select
                            value={field.value || "Neutrale"}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Amico">🟢 Amico / Alleato</SelectItem>
                              <SelectItem value="Neutrale">⚪ Neutrale</SelectItem>
                              <SelectItem value="Nemico">🔴 Nemico / Ostile</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4 text-left">
                <FormField
                  control={form.control}
                  name="appearance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aspetto Fisico</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="personality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperamento e Psicologia</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mannerism"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peculiarità / Tic Memorabile</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="p-4 bg-rose-500/5 rounded-lg border border-rose-500/20 space-y-4 text-left">
                <FormField
                  control={form.control}
                  name="encounterHook"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary font-bold uppercase text-xs">
                        Dettagli del Primo Incontro
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="bg-background/50"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-rose-500 font-bold uppercase text-xs">
                        Segreto o Desiderio Proibito
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="bg-background/50"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4 text-left">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold uppercase text-primary">
                    Visibilità per i Giocatori (Player Mode)
                  </h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Controlla se nascondere interamente questo PNG o se
                  mostrare/nascondere singoli campi dettagliati ai giocatori al
                  tavolo di gioco.
                </p>

                <FormField
                  control={form.control}
                  name="isHidden"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                      <div className="space-y-0.5">
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5 text-rose-400">
                          <EyeOff className="h-3.5 w-3.5" /> Nascondi PNG dai
                          Giocatori
                        </FormLabel>
                        <p className="text-[10px] text-muted-foreground">
                          Se attivo, l'intera scheda del PNG non sarà visibile
                          nella lista in Modalità Giocatore.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-2 mt-4 pt-2 border-t border-primary/10">
                  <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <EyeOff className="h-3 w-3" /> Seleziona campi da nascondere
                    ai giocatori
                  </Label>
                  <p className="text-[10px] text-muted-foreground mb-3 leading-tight">
                    I campi spuntati saranno visibili esclusivamente a te come
                    Dungeon Master. I giocatori vedranno messaggi di privacy o
                    il campo sarà nascosto.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: "attitude", label: "Atteggiamento (Amico/Nemico)" },
                      { id: "alignment", label: "Allineamento" },
                      { id: "status", label: "Stato Sociale" },
                      { id: "age", label: "Età" },
                      { id: "gender", label: "Genere" },
                      { id: "race", label: "Razza" },
                      { id: "occupation", label: "Occupazione" },
                      { id: "appearance", label: "Aspetto Fisico" },
                      { id: "personality", label: "Psicologia & Tratti" },
                      { id: "mannerism", label: "Peculiarità / Tic" },
                      { id: "encounterHook", label: "Gancio Incontro" },
                      { id: "secret", label: "Segreto del DM" },
                      { id: "history", label: "Diario delle Gesta" },
                    ].map((fieldOption) => {
                      const hiddenFields = form.watch("hiddenFields") || [];
                      const isChecked = hiddenFields.includes(fieldOption.id);
                      return (
                        <div
                          key={fieldOption.id}
                          className="flex items-center space-x-2 p-2 rounded border bg-background/30 hover:bg-background/60 transition-all select-none"
                        >
                          <Checkbox
                            id={`hide-${fieldOption.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const current =
                                form.getValues("hiddenFields") || [];
                              if (checked) {
                                form.setValue("hiddenFields", [
                                  ...current,
                                  fieldOption.id,
                                ]);
                              } else {
                                form.setValue(
                                  "hiddenFields",
                                  current.filter((x) => x !== fieldOption.id),
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={`hide-${fieldOption.id}`}
                            className="text-[11px] font-medium leading-none cursor-pointer flex items-center gap-1 flex-grow"
                          >
                            {fieldOption.label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
        <DialogFooter className="p-6 pt-4 border-t bg-muted/20">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={form.formState.isSubmitting || isUploading}
          >
            Salva PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const HandoutPreview = memo(
  ({
    npc,
    config,
    historyData,
    isForPrinting = false,
  }: {
    npc: NpcWithLastEvent;
    config: any;
    historyData: any[];
    isForPrinting?: boolean;
  }) => {
    const protectiveShadow = {
      textShadow: "0 0 10px #f4e4bc, 0 0 4px #f4e4bc, 0 0 1px #f4e4bc",
    };

    return (
      <div
        style={{
          width: "794px",
          minHeight: "1123px",
          height: "auto",
          backgroundColor: "#f4e4bc",
          backgroundImage: "url('/api/assets/handout-background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "top center",
          color: "#000000",
          padding: "60px 80px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "visible",
          boxSizing: "border-box",
          imageRendering: "-webkit-optimize-contrast",
          textRendering: "optimizeLegibility",
          WebkitFontSmoothing: "antialiased",
        }}
        className={cn(!isForPrinting && "shadow-2xl border")}
      >
        {npc.details.imageUrl && (
          <div className="absolute top-0 right-0 p-6 opacity-95 z-0 pointer-events-none">
            <div
              style={{
                height: "220px",
                width: "220px",
                backgroundImage: `url('${npc.details.imageUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderRadius: "9999px",
                border: "6px solid rgba(0,0,0,0.1)",
                boxShadow:
                  "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
              }}
            />
          </div>
        )}

        <div className="absolute top-0 left-0 p-8 opacity-5">
          <UserCircle className="h-48 w-48" />
        </div>

        <header className="mb-12 border-b-2 border-black/30 pb-6 relative z-10 text-center">
          <div className="flex flex-col items-center w-full text-center">
            <h1
              className="font-authority text-5xl uppercase tracking-widest text-black mb-2 text-center w-full leading-tight drop-shadow-sm font-bold"
              style={protectiveShadow}
            >
              {npc.name}
            </h1>
            <div
              className="flex justify-center items-center gap-4 font-headline text-lg uppercase tracking-wider text-black w-full text-center font-bold"
              style={protectiveShadow}
            >
              <span>{npc.race}</span>
              <span className="opacity-40">|</span>
              <span>{npc.details.occupation}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-10 relative z-10 text-black">
          {config.showAppearance && (
            <section className="space-y-3">
              <h2
                className="font-authority text-xl uppercase tracking-widest text-black border-b border-black/40 pb-1 text-left font-bold"
                style={protectiveShadow}
              >
                Descrizione Fisica
              </h2>
              <p
                className="font-body text-lg leading-relaxed italic text-black font-bold whitespace-pre-wrap text-left"
                style={protectiveShadow}
              >
                "{npc.details.appearance}"
              </p>
            </section>
          )}

          {config.showPersonality && (
            <section className="space-y-3">
              <h2
                className="font-authority text-xl uppercase tracking-widest text-black border-b border-black/40 pb-1 text-left font-bold"
                style={protectiveShadow}
              >
                Tratti Caratteriali
              </h2>
              <p
                className="font-body text-lg leading-relaxed text-black font-bold whitespace-pre-wrap text-left"
                style={protectiveShadow}
              >
                {npc.details.personality}
              </p>
            </section>
          )}

          {config.selectedEvents.length > 0 && (
            <section className="space-y-4">
              <h2
                className="font-authority text-xl uppercase tracking-widest text-black border-b border-black/40 pb-1 text-left font-bold"
                style={protectiveShadow}
              >
                Cronaca degli Incontri
              </h2>
              <div className="space-y-6">
                {historyData
                  .filter((ev) => config.selectedEvents.includes(ev.id))
                  .map((ev, i) => (
                    <div key={i} className="space-y-1">
                      <div
                        className="text-[11px] font-headline uppercase tracking-wider text-black font-bold text-left"
                        style={protectiveShadow}
                      >
                        Dalle Cronache della Sessione {ev.sessionNumber}
                      </div>
                      <p
                        className="font-handwriting text-2xl leading-snug text-black pl-4 border-l-2 border-black/20 text-left font-bold"
                        style={protectiveShadow}
                      >
                        {ev.eventDescription}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </main>

        <footer className="mt-20 pt-8 border-t border-black/20 flex justify-between items-center opacity-60">
          <div className="font-authority text-[10px] uppercase tracking-[0.3em] text-black font-bold">
            Archivio del Tessitore di Cronache
          </div>
          <div className="font-headline text-[10px] uppercase tracking-widest italic text-black font-bold">
            {new Date().toLocaleDateString("it-IT")}
          </div>
        </footer>
      </div>
    );
  },
);
HandoutPreview.displayName = "HandoutPreview";

function SortableHistoryItem({
  ev,
  onDelete,
}: {
  ev: any;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ev.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-l-2 border-primary/20 pl-4 py-2 group/ev text-left bg-background/50 rounded-r-md transition-shadow relative",
        isDragging ? "z-50 shadow-lg border-primary" : "",
      )}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none p-1 text-muted-foreground/40 hover:text-primary"
          >
            <GripVertical className="h-3 w-3" />
          </div>
          <span className="text-[9px] font-bold text-muted-foreground uppercase">
            Sess. {ev.sessionNumber}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover/ev:opacity-100 text-destructive"
          onClick={() => onDelete(ev.id)}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
      <p className="text-sm italic text-foreground/80 leading-relaxed pr-2">
        "{ev.eventDescription}"
      </p>
    </div>
  );
}

const isFieldHiddenForPlayers = (
  npc: NpcWithLastEvent | undefined,
  fieldId: string,
): boolean => {
  if (!npc || !npc.details) return false;
  const hiddenFields = npc.details.hiddenFields;
  if (hiddenFields !== undefined && Array.isArray(hiddenFields)) {
    return hiddenFields.includes(fieldId);
  }
  // Fallback defaults if hiddenFields is not configured yet
  const defaultHidden = ["alignment", "mannerism", "encounterHook", "secret"];
  return defaultHidden.includes(fieldId);
};

export function NpcSummary({ campaignId, npcs: initialNpcs }: NpcSummaryProps) {
  const [playerMode, setPlayerModeState] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"elenco" | "impostazioni">(
    "elenco",
  );

  useEffect(() => {
    setPlayerModeState(isPlayerMode());
    const handlePlayerModeChange = (e: any) => {
      const pm = Boolean(e.detail?.isPlayerMode);
      setPlayerModeState(pm);
      if (pm) {
        setActiveTab("elenco");
      }
    };
    window.addEventListener("dnd-player-mode-changed", handlePlayerModeChange);
    return () =>
      window.removeEventListener(
        "dnd-player-mode-changed",
        handlePlayerModeChange,
      );
  }, []);
  const [viewingNpcId, setViewingNpcId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [enrichedNpcs, setEnrichedNpcs] = useState<NpcWithLastEvent[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {},
  );
  const [isElaboratingId, setIsElaboratingId] = useState<string | null>(null);
  const [isDeepAnalyzingId, setIsDeepAnalyzingId] = useState<string | null>(
    null,
  );
  const [npcToEdit, setNpcToEdit] = useState<NpcWithLastEvent | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [handoutNpc, setHandoutNpc] = useState<NpcWithLastEvent | null>(null);
  const [isEditingPsychology, setIsEditingPsychology] = useState(false);
  const [isEditingSecret, setIsEditingSecret] = useState(false);
  const [tempPsychology, setTempPsychology] = useState("");
  const [tempSecret, setTempSecret] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [attitudeFilter, setAttitudeFilter] = useState<"all" | "Amico" | "Neutrale" | "Nemico">("all");

  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadData = async () => {
    try {
      const res = await actions.getNpcSummary(campaignId);
      if (res.success && res.data) setEnrichedNpcs(res.data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const npcList = useMemo(() => {
    let list = (
      enrichedNpcs.length > 0
        ? enrichedNpcs
        : initialNpcs.map((n) => {
            let parsedDetails: NpcDetails;
            try {
              parsedDetails =
                typeof n.details === "string"
                  ? (JSON.parse(n.details) as NpcDetails)
                  : n.details;
            } catch (e) {
              parsedDetails = {} as NpcDetails;
            }
            return { ...n, details: parsedDetails, lastEvent: null };
          })
    ) as NpcWithLastEvent[];

    if (playerMode) {
      list = list.filter((n) => !n.details?.isHidden);
      if (typeof window !== 'undefined') {
        const blockedNpcsRaw = localStorage.getItem('dnd_device_blocked_npcs');
        if (blockedNpcsRaw) {
          try {
            const blockedNpcs = JSON.parse(blockedNpcsRaw);
            if (Array.isArray(blockedNpcs)) {
              list = list.filter((n) => !blockedNpcs.includes(n.id));
            }
          } catch (e) {}
        }
      }
    }

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [initialNpcs, enrichedNpcs, playerMode]);

  const filteredNpcs = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return npcList.filter((n) => {
      const matchesSearch =
        n.name.toLowerCase().includes(lower) ||
        (n.details.occupation && n.details.occupation.toLowerCase().includes(lower)) ||
        (n.race && n.race.toLowerCase().includes(lower));

      if (!matchesSearch) return false;

      const npcAttitude = n.details.attitude || "Neutrale";
      if (attitudeFilter !== "all" && npcAttitude !== attitudeFilter) {
        return false;
      }

      return true;
    });
  }, [npcList, searchTerm, attitudeFilter]);

  const handleViewHistory = async (npcId: string) => {
    setIsLoadingHistory(true);
    setViewingNpcId(npcId);
    setIsEditingPsychology(false);
    setIsEditingSecret(false);
    try {
      const res = await actions.getCharacterHistory(npcId);
      if (res.success && res.data) setHistoryData(res.data);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: e.message,
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = historyData.findIndex((h) => h.id === active.id);
      const newIndex = historyData.findIndex((h) => h.id === over.id);
      const newHistory = arrayMove(historyData, oldIndex, newIndex);
      setHistoryData(newHistory);
      await actions.reorderCharacterEvents(newHistory.map((h) => h.id));
      toast({ title: "Ordine aggiornato" });
    }
  };

  const handleElaborateIdentity = async (npcId: string) => {
    setIsElaboratingId(npcId);
    try {
      const res = await actions.updateNpcIdentityAction(npcId, campaignId);
      if (res.success) {
        toast({ title: "Identità Elaborata!" });
        await loadData();
        if (viewingNpcId === npcId) await handleViewHistory(npcId);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: e.message,
      });
    } finally {
      setIsElaboratingId(null);
    }
  };

  const handleDeepAnalysis = async (npcId: string) => {
    setIsDeepAnalyzingId(npcId);
    try {
      const res = await actions.deepNpcElaborationAction(npcId, campaignId);
      if (res.success) {
        toast({ title: "Analisi Profonda Completata!" });
        await loadData();
        if (viewingNpcId === npcId) await handleViewHistory(npcId);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: e.message,
      });
    } finally {
      setIsDeepAnalyzingId(null);
    }
  };

  const handleDeleteNpc = async (id: string) => {
    const res = await actions.deleteNpc(id);
    if (res.success) {
      toast({ title: "PNG rimosso." });
      loadData();
    }
  };

  const saveQuickEdit = async (field: "personality" | "secret") => {
    const npc = npcList.find((n) => n.id === viewingNpcId);
    if (!npc) return;
    const currentDetails =
      typeof npc.details === "object" && npc.details
        ? npc.details
        : typeof npc.details === "string"
          ? safeJsonParse(npc.details, {})
          : {};
    const newDetails = {
      ...currentDetails,
      [field]: field === "personality" ? tempPsychology : tempSecret,
    };
    const res = await actions.saveNpc({
      id: npc.id,
      campaignId,
      name: npc.name,
      race: npc.race,
      gender: npc.gender,
      age: npc.age,
      status: npc.status,
      alignment: npc.alignment,
      details: JSON.stringify(newDetails),
    });
    if (res.success) {
      toast({ title: "Aggiornato!" });
      setIsEditingPsychology(false);
      setIsEditingSecret(false);
      loadData();
    }
  };

  const toggleNpcHidden = async (npc: NpcWithLastEvent) => {
    const currentDetails =
      typeof npc.details === "object" && npc.details ? npc.details : {};
    const isCurrentlyHidden = currentDetails.isHidden ?? false;
    const newDetails = { ...currentDetails, isHidden: !isCurrentlyHidden };

    // Optimistic state update
    setEnrichedNpcs((prev) =>
      prev.map((n) => (n.id === npc.id ? { ...n, details: newDetails } : n)),
    );

    const res = await actions.saveNpc({
      id: npc.id,
      campaignId,
      name: npc.name,
      race: npc.race,
      gender: npc.gender,
      age: npc.age,
      status: npc.status,
      alignment: npc.alignment,
      details: JSON.stringify(newDetails),
    });

    if (res.success) {
      toast({ title: `Visibilità di ${npc.name} aggiornata.` });
      loadData();
    } else {
      toast({
        variant: "destructive",
        title: "Errore",
        description: res.error || "Impossibile aggiornare la visibilità.",
      });
      loadData(); // Revert state
    }
  };

  const toggleNpcFieldHidden = async (
    npc: NpcWithLastEvent,
    fieldId: string,
  ) => {
    const currentDetails =
      typeof npc.details === "object" && npc.details ? npc.details : {};
    const currentHiddenFields = currentDetails.hiddenFields || [];
    let newHiddenFields: string[];
    if (currentHiddenFields.includes(fieldId)) {
      newHiddenFields = currentHiddenFields.filter((f: string) => f !== fieldId);
    } else {
      newHiddenFields = [...currentHiddenFields, fieldId];
    }
    const newDetails = { ...currentDetails, hiddenFields: newHiddenFields };

    // Optimistic state update
    setEnrichedNpcs((prev) =>
      prev.map((n) => (n.id === npc.id ? { ...n, details: newDetails } : n)),
    );

    const res = await actions.saveNpc({
      id: npc.id,
      campaignId,
      name: npc.name,
      race: npc.race,
      gender: npc.gender,
      age: npc.age,
      status: npc.status,
      alignment: npc.alignment,
      details: JSON.stringify(newDetails),
    });

    if (res.success) {
      toast({ title: `Impostazione ${fieldId} aggiornata per ${npc.name}.` });
      loadData();
    } else {
      toast({
        variant: "destructive",
        title: "Errore",
        description: res.error || "Impossibile aggiornare i campi nascosti.",
      });
      loadData(); // Revert state
    }
  };

  if (isInitialLoading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline uppercase">Caricamento...</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {!playerMode && (
        <div className="flex border-b border-muted/50 mb-2 w-full">
          <Button
            variant="ghost"
            onClick={() => setActiveTab("elenco")}
            className={cn(
              "rounded-none border-b-2 flex-1 sm:flex-none px-4 sm:px-6 py-3 font-serif text-xs sm:text-sm font-bold transition-all text-center sm:text-left flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2",
              activeTab === "elenco"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span>👤</span> <span className="truncate">Anagrafe</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab("impostazioni")}
            className={cn(
              "rounded-none border-b-2 flex-1 sm:flex-none px-4 sm:px-6 py-3 font-serif text-xs sm:text-sm font-bold transition-all text-center sm:text-left flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2",
              activeTab === "impostazioni"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span>⚙️</span> <span className="truncate">Impostazioni</span>
          </Button>
        </div>
      )}

      {activeTab === "elenco" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 max-sm:w-full flex-1 sm:max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca PNG..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select
                value={attitudeFilter}
                onValueChange={(val) => setAttitudeFilter(val as any)}
              >
                <SelectTrigger className="w-[130px] shrink-0 text-xs font-semibold bg-background">
                  <SelectValue placeholder="Relazione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti ({npcList.length})</SelectItem>
                  <SelectItem value="Amico">🟢 Amici</SelectItem>
                  <SelectItem value="Neutrale">⚪ Neutrali</SelectItem>
                  <SelectItem value="Nemico">🔴 Nemici</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!playerMode ? (
              <Button
                size="sm"
                onClick={() => {
                  setNpcToEdit(null);
                  setIsEditOpen(true);
                }}
                className="gap-2 shadow-lg max-sm:w-full"
              >
                <UserPlus className="h-4 w-4" /> Nuovo PNG
              </Button>
            ) : (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-400 text-xs py-1.5 px-3 uppercase gap-2 font-serif"
              >
                <Shield className="h-3.5 w-3.5" /> Schede PNG • Vista Giocatori
              </Badge>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {filteredNpcs.map((npc) => {
              const isAnalyzing =
                isElaboratingId === npc.id || isDeepAnalyzingId === npc.id;

              return (
                <Card
                  key={npc.id}
                  className={cn(
                    "group hover:border-primary/50 transition-all flex flex-col bg-card/40 overflow-hidden relative min-h-[250px]",
                    isAnalyzing && "opacity-80",
                  )}
                >
                  {isAnalyzing && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] animate-in fade-in duration-300 text-center">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-[10px] font-bold uppercase mt-3 text-primary tracking-widest animate-pulse">
                        {isDeepAnalyzingId === npc.id
                          ? "Analisi Profonda..."
                          : "Elaborazione..."}
                      </p>
                    </div>
                  )}

                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full overflow-hidden border bg-muted shrink-0 relative shadow-inner">
                        {npc.details.imageUrl ? (
                          <img
                            src={npc.details.imageUrl}
                            alt={npc.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <User2 className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="font-headline text-lg text-primary leading-tight truncate text-left">
                          {npc.name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-1 mt-1 items-center justify-start">
                          {!playerMode && npc.details.isHidden && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-auto py-0.5 px-2 bg-rose-500/10 text-rose-400 border-rose-500/30 gap-1 uppercase font-semibold"
                            >
                              <EyeOff className="h-2.5 w-2.5" /> Nascosto
                            </Badge>
                          )}
                          {(!playerMode ||
                            !isFieldHiddenForPlayers(npc, "occupation")) &&
                            npc.details.occupation && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] h-auto py-0.5 uppercase px-2 flex items-center justify-center text-center leading-tight max-w-full"
                              >
                                {npc.details.occupation}
                              </Badge>
                            )}
                          {(!playerMode ||
                            !isFieldHiddenForPlayers(npc, "race")) &&
                            npc.race && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-auto py-0.5 px-2 flex items-center justify-center text-center leading-tight"
                              >
                                {npc.race}
                              </Badge>
                            )}
                          {(!playerMode ||
                            !isFieldHiddenForPlayers(npc, "alignment")) &&
                            npc.alignment && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] h-auto py-0.5 px-2 flex items-center justify-center text-center leading-tight",
                                  playerMode
                                    ? "border-primary/40 text-primary"
                                    : "border-amber-500/40 text-amber-400 gap-1",
                                )}
                              >
                                {npc.alignment}{" "}
                                {!playerMode && (
                                  <span className="opacity-70 text-[8px]">
                                    🔒 DM
                                  </span>
                                )}
                              </Badge>
                            )}
                          {(!playerMode ||
                            !isFieldHiddenForPlayers(npc, "attitude")) && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] h-auto py-0.5 px-2 flex items-center justify-center text-center leading-tight font-semibold",
                                  npc.details.attitude === "Amico" &&
                                    "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                                  npc.details.attitude === "Nemico" &&
                                    "bg-rose-500/10 text-rose-400 border-rose-500/30",
                                  (!npc.details.attitude ||
                                    npc.details.attitude === "Neutrale") &&
                                    "bg-slate-500/10 text-slate-300 border-slate-700",
                                )}
                              >
                                {npc.details.attitude === "Amico"
                                  ? "🟢 Amico"
                                  : npc.details.attitude === "Nemico"
                                    ? "🔴 Nemico"
                                    : "⚪ Neutrale"}
                              </Badge>
                            )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-3 flex-grow space-y-3">
                    {(!playerMode ||
                      !isFieldHiddenForPlayers(npc, "appearance")) && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground opacity-70 flex items-center">
                          Identità e Aspetto Pubblico
                        </span>
                        <p
                          className={cn(
                            "text-xs text-muted-foreground italic leading-relaxed text-left",
                            !expandedCards[npc.id]
                              ? "line-clamp-2"
                              : "line-clamp-none",
                          )}
                        >
                          "
                          {npc.details.appearance ===
                          "Dati sensoriali in attesa di catalogo."
                            ? playerMode
                              ? "Abitante del mondo di gioco."
                              : npc.details.encounterHook
                            : npc.details.appearance}
                          "
                        </p>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-[9px] uppercase font-bold"
                          onClick={() =>
                            setExpandedCards((p) => ({
                              ...p,
                              [npc.id]: !p[npc.id],
                            }))
                          }
                        >
                          {expandedCards[npc.id] ? "Riduci" : "Altro..."}
                        </Button>
                      </div>
                    )}

                    {(!playerMode ||
                      !isFieldHiddenForPlayers(npc, "mannerism")) &&
                      !!npc.details.mannerism && (
                        <div
                          className={cn(
                            "p-2 rounded-md border animate-in fade-in",
                            playerMode
                              ? "bg-primary/5 border-primary/20"
                              : "bg-amber-500/5 border-amber-500/20",
                          )}
                        >
                          <div className="flex justify-between items-center mb-0.5">
                            <span
                              className={cn(
                                "text-[9px] font-bold uppercase flex items-center gap-1",
                                playerMode ? "text-primary" : "text-amber-400",
                              )}
                            >
                              <Fingerprint className="h-2.5 w-2.5" />{" "}
                              Peculiarità & Tic
                            </span>
                            {!playerMode && (
                              <span className="text-[8px] uppercase font-mono text-amber-400/80">
                                🔒 Solo DM
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] italic text-left text-foreground/80">
                            "{npc.details.mannerism}"
                          </p>
                        </div>
                      )}

                    {(!playerMode ||
                      !isFieldHiddenForPlayers(npc, "encounterHook")) &&
                      !!npc.details.encounterHook && (
                        <div className="bg-muted/30 p-2 rounded-md border border-stone-800 animate-in fade-in">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[9px] font-bold uppercase text-stone-400 flex items-center gap-1">
                              <Footprints className="h-2.5 w-2.5" /> Primo
                              Incontro (Gancio)
                            </span>
                            {!playerMode && (
                              <span className="text-[8px] uppercase font-mono text-amber-400/80">
                                🔒 Solo DM
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] leading-tight text-stone-300/90 text-left">
                            "{npc.details.encounterHook}"
                          </p>
                        </div>
                      )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 justify-start gap-2">
                    {!playerMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={isAnalyzing}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => {
                              setNpcToEdit(npc as NpcWithLastEvent);
                              setIsEditOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Modifica Scheda
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setHandoutNpc(npc as NpcWithLastEvent)
                            }
                          >
                            <FileText className="mr-2 h-4 w-4 text-emerald-500" />{" "}
                            Esporta Handout
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleElaborateIdentity(npc.id)}
                          >
                            <Sparkles className="mr-2 h-4 w-4 text-accent" />{" "}
                            Elabora Veloce
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeepAnalysis(npc.id)}
                          >
                            <RefreshCw className="mr-2 h-4 w-4 text-primary" />{" "}
                            Analisi Profonda
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive"
                              >
                                Elimina
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Eliminare {npc.name}?
                                </AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteNpc(npc.id)}
                                >
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => handleViewHistory(npc.id)}
                      disabled={isAnalyzing}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Diario
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card className="border-primary/20 bg-primary/5 p-6 animate-in fade-in duration-300">
          <CardHeader className="p-0 pb-4 mb-6 border-b border-muted">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <div className="text-left">
                <CardTitle className="font-headline text-xl text-primary">
                  Impostazioni Visibilità Giocatori
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Gestisci rapidamente la visibilità pubblica dei singoli PNG e
                  blocca l'accesso alle informazioni sensibili per i giocatori.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            {npcList.length === 0 ? (
              <p className="text-sm italic text-muted-foreground p-4 text-center">
                Nessun PNG registrato in questa campagna.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Desktop View */}
                <div className="rounded-md border bg-background/50 overflow-hidden hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                          <th className="p-3 pl-4">PNG</th>
                          <th className="p-3">Visibilità Generale</th>
                          <th className="p-3 text-right pr-4">
                            Campi Nascondibili (Tocca per commutare)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-muted/50">
                        {npcList.map((npc) => {
                          const isHidden = npc.details?.isHidden ?? false;
                          const hiddenFields = npc.details?.hiddenFields || [];
                          return (
                            <tr
                              key={npc.id}
                              className="hover:bg-muted/20 transition-all"
                            >
                              <td className="p-3 pl-4 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full overflow-hidden border bg-muted shrink-0 relative">
                                  {npc.details.imageUrl ? (
                                    <img
                                      src={npc.details.imageUrl}
                                      alt={npc.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-25">
                                      <User2 className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="text-left">
                                  <span className="font-bold text-foreground block">
                                    {npc.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground italic">
                                    {npc.race || "Razza non definita"} •{" "}
                                    {npc.details.occupation ||
                                      "Nessuna occupazione"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={!isHidden}
                                    onCheckedChange={() => toggleNpcHidden(npc)}
                                  />
                                  <span
                                    className={cn(
                                      "text-[10px] font-semibold",
                                      isHidden
                                        ? "text-rose-400"
                                        : "text-emerald-400",
                                    )}
                                  >
                                    {isHidden
                                      ? "Nascosto ai Giocatori"
                                      : "Visibile ai Giocatori"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-right pr-4">
                                <div className="flex flex-wrap gap-1 justify-end max-w-md ml-auto">
                                  {[
                                    { id: "race", label: "Razza" },
                                    { id: "alignment", label: "Allineamento" },
                                    { id: "status", label: "Sociale" },
                                    { id: "age", label: "Età" },
                                    { id: "occupation", label: "Lavoro" },
                                    { id: "appearance", label: "Aspetto" },
                                    { id: "personality", label: "Psiche" },
                                    { id: "mannerism", label: "Tic" },
                                    { id: "encounterHook", label: "Gancio" },
                                    { id: "secret", label: "Segreto" },
                                    { id: "history", label: "Diario" },
                                  ].map((f) => {
                                    const isFieldHidden = hiddenFields.includes(
                                      f.id,
                                    );
                                    return (
                                      <Badge
                                        key={f.id}
                                        variant={
                                          isFieldHidden
                                            ? "destructive"
                                            : "secondary"
                                        }
                                        onClick={() =>
                                          toggleNpcFieldHidden(npc, f.id)
                                        }
                                        className={cn(
                                          "text-[10px] py-0.5 px-2 cursor-pointer select-none transition-all gap-1 font-semibold",
                                          isFieldHidden
                                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                                            : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20",
                                        )}
                                      >
                                        {isFieldHidden ? "🔒" : "👁️"} {f.label}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden space-y-4">
                  {npcList.map((npc) => {
                    const isHidden = npc.details?.isHidden ?? false;
                    const hiddenFields = npc.details?.hiddenFields || [];
                    return (
                      <div
                        key={npc.id}
                        className="p-4 rounded-lg border bg-background/30 hover:bg-background/50 space-y-4 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden border bg-muted shrink-0 relative">
                            {npc.details.imageUrl ? (
                              <img
                                src={npc.details.imageUrl}
                                alt={npc.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center opacity-25">
                                <User2 className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-foreground block truncate">
                              {npc.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground italic truncate block">
                              {npc.race || "Razza non definita"} •{" "}
                              {npc.details.occupation || "Nessuna occupazione"}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-muted/50" />

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Visibilità Generale
                          </span>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!isHidden}
                              onCheckedChange={() => toggleNpcHidden(npc)}
                            />
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                isHidden ? "text-rose-400" : "text-emerald-400",
                              )}
                            >
                              {isHidden ? "Nascosto" : "Visibile"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-muted-foreground block">
                            Campi Nascondibili (Tocca per commutare)
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: "race", label: "Razza" },
                              { id: "alignment", label: "Allineamento" },
                              { id: "status", label: "Sociale" },
                              { id: "age", label: "Età" },
                              { id: "occupation", label: "Lavoro" },
                              { id: "appearance", label: "Aspetto" },
                              { id: "personality", label: "Psiche" },
                              { id: "mannerism", label: "Tic" },
                              { id: "encounterHook", label: "Gancio" },
                              { id: "secret", label: "Segreto" },
                              { id: "history", label: "Diario" },
                            ].map((f) => {
                              const isFieldHidden = hiddenFields.includes(f.id);
                              return (
                                <Badge
                                  key={f.id}
                                  variant={
                                    isFieldHidden ? "destructive" : "secondary"
                                  }
                                  onClick={() =>
                                    toggleNpcFieldHidden(npc, f.id)
                                  }
                                  className={cn(
                                    "text-[10px] py-1 px-2.5 cursor-pointer select-none transition-all gap-1 font-semibold flex items-center",
                                    isFieldHidden
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                                      : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20",
                                  )}
                                >
                                  <span>{isFieldHidden ? "🔒" : "👁️"}</span>
                                  <span>{f.label}</span>
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <NpcEditDialog
        npc={npcToEdit}
        campaignId={campaignId}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSaved={loadData}
      />
      {handoutNpc && (
        <HandoutNpcWrapper
          npc={handoutNpc}
          campaignId={campaignId}
          open={!!handoutNpc}
          onOpenChange={(o) => !o && setHandoutNpc(null)}
        />
      )}

      <Dialog
        open={!!viewingNpcId}
        onOpenChange={(o) => !o && setViewingNpcId(null)}
      >
        <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden outline-none">
          <DialogHeader className="p-6 border-b bg-muted/20">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden border bg-background shrink-0 relative shadow-md">
                {npcList.find((n) => n.id === viewingNpcId)?.details
                  .imageUrl ? (
                  <img
                    src={
                      npcList.find((n) => n.id === viewingNpcId)!.details
                        .imageUrl!
                    }
                    alt="Ritratto"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User2 className="h-full w-full p-3 opacity-20" />
                )}
              </div>
              <div className="text-left">
                <DialogTitle className="font-headline text-2xl">
                  {npcList.find((n) => n.id === viewingNpcId)?.name}
                </DialogTitle>
                <DialogDescription className="flex gap-2 mt-1 items-center justify-start">
                  {(!playerMode ||
                    !isFieldHiddenForPlayers(
                      npcList.find((n) => n.id === viewingNpcId),
                      "occupation",
                    )) &&
                    npcList.find((n) => n.id === viewingNpcId)?.details
                      .occupation && (
                      <Badge
                        variant="secondary"
                        className="flex items-center justify-center text-center"
                      >
                        {
                          npcList.find((n) => n.id === viewingNpcId)?.details
                            .occupation
                        }
                      </Badge>
                    )}
                  {(!playerMode ||
                    !isFieldHiddenForPlayers(
                      npcList.find((n) => n.id === viewingNpcId),
                      "race",
                    )) &&
                    npcList.find((n) => n.id === viewingNpcId)?.race && (
                      <Badge
                        variant="outline"
                        className="flex items-center justify-center text-center"
                      >
                        {npcList.find((n) => n.id === viewingNpcId)?.race}
                      </Badge>
                    )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(() => {
                const currentNpc = npcList.find((n) => n.id === viewingNpcId);
                return [
                  { id: "gender", label: "Genere" },
                  { id: "age", label: "Età" },
                  { id: "status", label: "Stato Sociale" },
                  { id: "alignment", label: "Allineamento" },
                ]
                  .filter(
                    (f) =>
                      !playerMode || !isFieldHiddenForPlayers(currentNpc, f.id),
                  )
                  .map((f) => {
                    const isPrivate = isFieldHiddenForPlayers(currentNpc, f.id);
                    return (
                      <div
                        key={f.id}
                        className="bg-primary/5 border rounded p-2 text-center flex flex-col items-center justify-center min-h-[48px] relative"
                      >
                        <span className="text-[8px] uppercase font-bold text-muted-foreground block mb-0.5 flex items-center justify-center gap-1">
                          {f.label}{" "}
                          {isPrivate && !playerMode && (
                            <span className="text-amber-400">🔒</span>
                          )}
                        </span>
                        <span className="text-xs font-medium leading-none">
                          {(currentNpc as any)?.[f.id] ||
                            (currentNpc as any)?.details?.[f.id] ||
                            "—"}
                        </span>
                      </div>
                    );
                  });
              })()}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {(() => {
                const currentNpc = npcList.find((n) => n.id === viewingNpcId);
                const showPersonality =
                  !playerMode ||
                  !isFieldHiddenForPlayers(currentNpc, "personality");
                const showSecret =
                  !playerMode || !isFieldHiddenForPlayers(currentNpc, "secret");

                return (
                  <>
                    {showPersonality && (
                      <div className="p-4 rounded-lg bg-muted/30 border text-xs relative group">
                        <div className="flex justify-between font-bold text-primary/70 mb-2 uppercase">
                          <span>Psicologia & Tratti</span>
                          {!playerMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setTempPsychology(
                                  currentNpc!.details.personality,
                                );
                                setIsEditingPsychology(true);
                              }}
                            >
                              <Pencil className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                        {isEditingPsychology && !playerMode ? (
                          <div className="space-y-2">
                            <Textarea
                              value={tempPsychology}
                              onChange={(e) =>
                                setTempPsychology(e.target.value)
                              }
                              className="text-xs h-24"
                            />
                            <Button
                              size="sm"
                              onClick={() => saveQuickEdit("personality")}
                              className="w-full h-6 text-[9px]"
                            >
                              Salva
                            </Button>
                          </div>
                        ) : (
                          <p className="italic">
                            "{currentNpc?.details.personality}"
                          </p>
                        )}
                      </div>
                    )}

                    {!playerMode ? (
                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs relative">
                        <div className="flex justify-between font-bold text-amber-400 mb-2 uppercase items-center">
                          <span className="flex items-center gap-1">
                            {isFieldHiddenForPlayers(currentNpc, "secret")
                              ? "🔒 Segreto del DM (Nascosto)"
                              : "🔓 Segreto del DM (Visibile ai giocatori)"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-400"
                            onClick={() => {
                              setTempSecret(currentNpc!.details.secret);
                              setIsEditingSecret(true);
                            }}
                          >
                            <Pencil className="h-5 w-5" />
                          </Button>
                        </div>
                        {isEditingSecret ? (
                          <div className="space-y-2">
                            <Textarea
                              value={tempSecret}
                              onChange={(e) => setTempSecret(e.target.value)}
                              className="text-xs h-24"
                            />
                            <Button
                              size="sm"
                              onClick={() => saveQuickEdit("secret")}
                              className="w-full h-6 text-[9px]"
                            >
                              Salva
                            </Button>
                          </div>
                        ) : (
                          <p className="text-amber-200 font-medium italic">
                            "{currentNpc?.details.secret}"
                          </p>
                        )}
                      </div>
                    ) : (
                      showSecret && (
                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs relative">
                          <h4 className="font-bold text-amber-400 mb-2 uppercase">
                            Segreto svelato
                          </h4>
                          <p className="text-amber-200 font-medium italic">
                            "{currentNpc?.details.secret}"
                          </p>
                        </div>
                      )
                    )}
                  </>
                );
              })()}
            </div>
            {(!playerMode ||
              !isFieldHiddenForPlayers(
                npcList.find((n) => n.id === viewingNpcId),
                "history",
              )) && (
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase text-primary border-b pb-1">
                  <History className="h-4 w-4" /> Diario delle Gesta
                </h4>
                {isLoadingHistory ? (
                  <div className="flex justify-center">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={historyData.map((h) => h.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {historyData.map((ev) => (
                          <SortableHistoryItem
                            key={ev.id}
                            ev={ev}
                            onDelete={(id) =>
                              actions
                                .deleteCharacterEvent(id)
                                .then(() => handleViewHistory(viewingNpcId!))
                            }
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrapper per risolvere il caricamento dei dati di handout
function HandoutNpcWrapper({
  npc,
  campaignId,
  open,
  onOpenChange,
}: {
  npc: NpcWithLastEvent;
  campaignId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <NpcHandoutDialog
      npc={npc}
      campaignId={campaignId}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

function NpcHandoutDialog({
  npc,
  campaignId,
  open,
  onOpenChange,
}: {
  npc: NpcWithLastEvent;
  campaignId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [config, setConfig] = useState({
    showAppearance: true,
    showPersonality: true,
    selectedEvents: [] as string[],
  });
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      actions.getCharacterHistory(npc.id).then((res) => {
        if (res.success && res.data) {
          setHistoryData(res.data);
          setConfig((prev) => ({
            ...prev,
            selectedEvents: (res.data || []).map((e: any) => e.id),
          }));
        }
        setIsLoading(false);
      });
    }
  }, [open, npc.id]);

  const handleDownload = async () => {
    if (typeof document === "undefined" || !document.body) return;
    setIsGenerating(true);
    toast({ title: "Preparazione Handout alta risoluzione..." });

    const printContainer = document.createElement("div");
    printContainer.style.position = "fixed";
    printContainer.style.left = "-10000px";
    printContainer.style.top = "-10000px";
    printContainer.style.width = "794px";
    printContainer.style.backgroundColor = "white";
    printContainer.style.zIndex = "-9999";
    document.body.appendChild(printContainer);

    const root = createRoot(printContainer);
    try {
      root.render(
        <HandoutPreview
          npc={npc}
          config={config}
          historyData={historyData}
          isForPrinting
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const canvas = await html2canvas(printContainer, {
        scale: 3, // Alta densità
        useCORS: true,
        backgroundColor: "#f4e4bc",
        logging: false,
        windowWidth: 794,
      });

      const link = document.createElement("a");
      link.download = `Dossier_${npc.name.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Handout scaricato!" });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: e.message,
      });
    } finally {
      root.unmount();
      if (document.body.contains(printContainer))
        document.body.removeChild(printContainer);
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden outline-none">
        <DialogHeader className="p-6 border-b bg-muted/20">
          <DialogTitle className="font-headline text-2xl">
            Esporta Dossier PNG
          </DialogTitle>
          <DialogDescription>
            Crea una pergamena riassuntiva da consegnare ai tuoi giocatori.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r bg-muted/10 p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto h-[50vh] md:h-auto shrink-0">
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Configurazione Sezioni
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="h-app" className="text-sm">
                    Descrizione Fisica
                  </Label>
                  <Switch
                    id="h-app"
                    checked={config.showAppearance}
                    onCheckedChange={(v) =>
                      setConfig((p) => ({ ...p, showAppearance: v }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="h-pers" className="text-sm">
                    Personalità
                  </Label>
                  <Switch
                    id="h-pers"
                    checked={config.showPersonality}
                    onCheckedChange={(v) =>
                      setConfig((p) => ({ ...p, showPersonality: v }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Seleziona Eventi
              </h4>
              <div className="space-y-2">
                {isLoading ? (
                  <Loader2 className="animate-spin mx-auto" />
                ) : (
                  historyData.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-2 p-2 rounded hover:bg-background border transition-colors"
                    >
                      <Checkbox
                        id={`ev-${ev.id}`}
                        checked={config.selectedEvents.includes(ev.id)}
                        onCheckedChange={(v) =>
                          setConfig((p) => ({
                            ...p,
                            selectedEvents: v
                              ? [...p.selectedEvents, ev.id]
                              : p.selectedEvents.filter((id) => id !== ev.id),
                          }))
                        }
                      />
                      <Label
                        htmlFor={`ev-${ev.id}`}
                        className="text-[10px] leading-tight cursor-pointer"
                      >
                        Sess. {ev.sessionNumber}:{" "}
                        {ev.eventDescription.substring(0, 40)}...
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button
              onClick={handleDownload}
              disabled={isGenerating || isLoading}
              className="w-full shadow-lg"
            >
              {isGenerating ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Scarica Handout (PNG)
            </Button>
          </div>

          <div className="flex-1 bg-zinc-800 p-4 sm:p-10 overflow-auto flex justify-center items-start">
            <div className="origin-top scale-[0.6] sm:scale-100">
              <HandoutPreview
                npc={npc}
                config={config}
                historyData={historyData}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
