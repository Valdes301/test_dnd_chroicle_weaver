'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CampaignWithRelations } from '@/lib/types';
import { BrainCircuit, Library, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import * as actions from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { MarkdownRenderer } from './ui/markdown-renderer';

type WorldDbProps = {
  campaign: CampaignWithRelations;
  onSummarize: () => Promise<void>;
  isSummarizing: boolean;
};

export function WorldDb({ campaign, onSummarize, isSummarizing }: WorldDbProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleInitializeSummary = async () => {
      setIsInitializing(true);
      try {
          const res = await actions.initializeAiSummary(campaign.id);
          if (res.success) {
              toast({ title: "Inizializzazione Completata!", description: "L'IA ha generato l'introduzione epica per la tua campagna." });
              router.refresh();
          } else throw new Error(res.error || "Errore sconosciuto.");
      } catch (e: any) {
          toast({ variant: 'destructive', title: "Errore IA", description: e.message });
      } finally {
          setIsInitializing(false);
      }
  };

  const renderContent = (content: string) => (
    <MarkdownRenderer content={content} className="text-sm text-muted-foreground font-serif" />
  );

  const hasLongSummary = (campaign.summary?.length || 0) > 300;
  const needsInitialization = campaign.summary?.includes('in attesa di inizializzazione');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-2xl">
            <BrainCircuit className="mr-2" /> Memoria dell'IA
          </CardTitle>
          <CardDescription>
            Usa l'IA per creare un riassunto della campagna. Questo riassunto sarà la "memoria" dell'IA per generare le sessioni future, risparmiando token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {needsInitialization ? (
               <Button onClick={handleInitializeSummary} disabled={isInitializing} className="w-full bg-accent hover:bg-accent/80 text-accent-foreground shadow-lg shadow-accent/20">
                    {isInitializing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Invocando la Musa...</>
                    ) : (
                        <><Sparkles className="mr-2 h-4 w-4" /> Genera Introduzione Epica (IA)</>
                    )}
               </Button>
           ) : (
                <Button onClick={onSummarize} disabled={isSummarizing} className="w-full">
                    {isSummarizing ? (
                    <>
                        <Library className="mr-2 h-4 w-4 animate-spin" />
                        Creazione riassunto...
                    </>
                    ) : (
                    <>
                        <Library className="mr-2 h-4 w-4" />
                        Crea/Aggiorna Sommario IA
                    </>
                    )}
                </Button>
           )}
        </CardContent>
      </Card>

      {campaign.summary && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
                <CardTitle className="font-headline flex items-center text-xl">
                  <Library className="mr-2 h-5 w-5 text-primary" /> Sommario del Capitolo
                </CardTitle>
                <CardDescription>
                  Questa è la memoria attiva usata dall'IA per la coerenza.
                </CardDescription>
            </div>
            {hasLongSummary && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-8 gap-1 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground"
                >
                    {isExpanded ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> Riduci</>
                    ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> Espandi</>
                    )}
                </Button>
            )}
          </CardHeader>
          <CardContent className="relative pb-6">
            <div className={cn(
                "transition-all duration-500 ease-in-out",
                (!isExpanded && hasLongSummary) ? "max-h-[160px] overflow-hidden" : "max-h-fit"
            )}>
                {renderContent(campaign.summary)}
            </div>
            
            {(!isExpanded && hasLongSummary) && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
