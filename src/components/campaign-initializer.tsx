'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Upload, ChevronLeft, Loader2 } from 'lucide-react';
import { Icons } from './icons';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { Separator } from './ui/separator';
import { 
  getBackgroundSettings, 
  DEFAULT_BACKGROUND_SETTINGS, 
  resolveBackgroundStyle, 
  BackgroundConfig 
} from '@/lib/background-storage';

const campaignFormSchema = z.object({
  name: z.string().min(3, 'Il nome della campagna deve contenere almeno 3 caratteri.'),
  setting: z.string().min(3, "L'ambientazione deve contenere almeno 3 caratteri."),
  description: z.string().optional().nullable(),
});

type CampaignInitializerProps = {
  onCreateCampaign: (data: z.infer<typeof campaignFormSchema>) => Promise<void>;
  onCancel?: () => void;
};

const CreateCampaignDialog = ({ onCreateCampaign }: { onCreateCampaign: (data: z.infer<typeof campaignFormSchema>) => Promise<void> }) => {
  const campaignForm = useForm<z.infer<typeof campaignFormSchema>>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: { name: '', setting: '', description: '' },
  });
  const [isOpen, setIsOpen] = useState(false);

  const onCampaignSubmit = async (values: z.infer<typeof campaignFormSchema>) => {
    try {
        await onCreateCampaign(values);
        campaignForm.reset();
        setIsOpen(false);
    } catch (e) {
        // L'errore viene gestito dal manager tramite toast
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="shadow-xl shadow-primary/25 w-full sm:w-auto h-12 sm:h-14 text-base sm:text-lg px-8 rounded-xl font-medium">
          <Wand2 className="mr-2 h-5 w-5" />
          Crea Nuova Campagna
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] w-[95vw] max-h-[95vh] flex flex-col p-0 overflow-hidden outline-none rounded-2xl border-primary/20">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/10 shrink-0">
          <DialogTitle className="font-headline text-2xl">Nuova Campagna</DialogTitle>
          <DialogDescription>
            Raccontaci del tuo nuovo mondo. L'IA genererà alcuni punti di partenza per te.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
            <Form {...campaignForm}>
                <form id="new-campaign-form" onSubmit={campaignForm.handleSubmit(onCampaignSubmit)} className="space-y-4">
                    <FormField control={campaignForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Nome della Campagna</FormLabel><FormControl><Input placeholder="es., L'Ombra di Dragonspire" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={campaignForm.control} name="setting" render={({ field }) => (
                        <FormItem><FormLabel>Ambientazione</FormLabel><FormControl><Input placeholder="es., Forgotten Realms, Eberron..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={campaignForm.control} name="description" render={({ field }) => (
                        <FormItem><FormLabel>Breve Descrizione (Opzionale)</FormLabel><FormControl>
                            <Textarea placeholder="Il tema centrale o il conflitto della campagna." className="min-h-[120px] resize-none" {...field} value={field.value ?? ''} />
                        </FormControl><FormMessage /></FormItem>
                    )} />
                </form>
            </Form>
        </div>
        <DialogFooter className="p-6 pt-4 border-t bg-muted/20 shrink-0">
            <Button type="submit" form="new-campaign-form" className="w-full h-12 text-lg" disabled={campaignForm.formState.isSubmitting}>
                {campaignForm.formState.isSubmitting ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Intrecciando la Storia...</>
                ) : 'Crea Campagna'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function CampaignInitializer({ onCreateCampaign, onCancel }: CampaignInitializerProps) {
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(DEFAULT_BACKGROUND_SETTINGS.main);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setBgConfig(getBackgroundSettings().main);
    const handleBgChange = (e: any) => {
      if (e.detail?.main) {
        setBgConfig(e.detail.main);
      }
    };
    window.addEventListener('dnd-backgrounds-changed', handleBgChange);
    return () => window.removeEventListener('dnd-backgrounds-changed', handleBgChange);
  }, []);

  const bgStyle = resolveBackgroundStyle('main', bgConfig);

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-center items-center overflow-x-hidden">
      {/* Sfondo D&D Fantasy con accelerazione hardware fissa per eliminare ogni lag di scorrimento */}
      <div 
        suppressHydrationWarning
        className="fixed inset-0 pointer-events-none -z-10 overflow-hidden transform-gpu bg-cover bg-center transition-all duration-300"
        style={{
          backgroundImage: bgStyle.backgroundImage 
            ? `${bgStyle.backgroundImage}, url('/hero-dnd-bg.jpg'), url('/api/assets/hero-dnd-bg.jpg')`
            : "url('/hero-dnd-bg.jpg'), url('/api/assets/hero-dnd-bg.jpg')",
          opacity: bgStyle.opacity ?? 0.6,
          filter: bgStyle.filter,
        }}
      />
      {/* Overlay leggero e suggestivo per esaltare i dettagli dell'immagine D&D mantenendo perfetta leggibilità */}
      <div 
        suppressHydrationWarning
        className="fixed inset-0 pointer-events-none -z-10 transition-all duration-300"
        style={{
          backgroundColor: `rgba(12, 10, 9, ${bgConfig.overlayDarkness ?? 0.45})`
        }}
      />
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-black/15 via-black/35 to-black/65" />

      {onCancel && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onCancel}
          className="absolute top-4 left-4 z-50 text-muted-foreground hover:text-foreground bg-background/40 backdrop-blur-sm border border-border/30 rounded-xl"
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Torna alla Campagna
        </Button>
      )}

      <div className="flex flex-col items-center justify-center p-4 sm:p-6 py-12 sm:py-16 md:py-20 text-center mx-auto w-full max-w-4xl my-auto">
        <h1 className="font-headline text-4xl sm:text-6xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white via-neutral-100 to-neutral-300 leading-tight shrink-0 tracking-wide drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
          Tessitore di Cronache
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-neutral-200 max-w-2xl mb-10 shrink-0 px-4 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] font-medium">
          Intreccia la tua saga di Dungeons & Dragons. Lascia che l'IA sia il tuo co-dungeon master, generando mondi, personaggi e spunti per la trama.
        </p>
        
        <div className="flex flex-col items-center gap-6 mb-8 shrink-0 w-full px-4 sm:px-6 max-w-3xl">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-center justify-center w-full">
            {isClient ? (
              <CreateCampaignDialog onCreateCampaign={onCreateCampaign} />
            ) : (
              <Button size="lg" className="shadow-xl shadow-primary/25 w-full sm:w-auto h-12 sm:h-14 text-base sm:text-lg px-8 rounded-xl" disabled>
                <Wand2 className="mr-2 h-5 w-5" />
                Crea Nuova Campagna
              </Button>
            )}

            <div className="flex items-center justify-center gap-3 my-1 sm:my-0">
                <Separator orientation="vertical" className="h-10 hidden sm:block bg-border/40"/>
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em] opacity-50 px-2 sm:px-0">oppure</span>
                <Separator orientation="vertical" className="h-10 hidden sm:block bg-border/40"/>
            </div>

            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto h-12 sm:h-14 cursor-pointer px-8 rounded-xl border-primary/30 bg-background/40 hover:bg-background/70 backdrop-blur-md transition-all text-base sm:text-lg shadow-lg">
                <label htmlFor="restore-backup-input">
                  <Upload className="mr-2 h-5 w-5 text-primary" />
                  Ripristina Backup
                </label>
            </Button>
          </div>
          
          <div className="w-full max-w-lg space-y-2 mt-4">
              <p className="text-xs sm:text-[13px] text-muted-foreground italic leading-relaxed text-center px-6 py-3.5 bg-background/50 backdrop-blur-md border border-border/30 rounded-2xl shadow-xl">
                  💡 <strong className="text-foreground/90">Nota di ripristino:</strong> carica prima il file di backup dei <strong>dati</strong> e successivamente quello delle <strong>immagini</strong> per collegare automaticamente ogni ritratto ed elemento visivo.
              </p>
          </div>
        </div>
      </div>
    </div>
  );
}