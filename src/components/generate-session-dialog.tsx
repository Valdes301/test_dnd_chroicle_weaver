'use client';

import { useState } from 'react';
import type { Session } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Check, RefreshCw, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type GenerationPanelProps = {
  onGenerate: (prompt: string, modification?: { storyToModify: string, request: string }) => Promise<void>;
  onConfirm: (session: Session) => void;
  onPendingSessionChange: (updates: Partial<Pick<Session, 'title' | 'notes' | 'xp_award'>>) => void;
  pendingSession: Session | null;
  isGenerating: boolean;
};

export function GenerationPanel({ onGenerate, onConfirm, onPendingSessionChange, pendingSession, isGenerating }: GenerationPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [modificationRequest, setModificationRequest] = useState('');

  const handleGenerate = () => {
    if (prompt.trim()) {
      setModificationRequest(''); // Clear old modification requests on new generation
      onGenerate(prompt);
    }
  };

  const handleConfirm = () => {
    if (pendingSession) {
      onConfirm(pendingSession);
    }
  };
  
  const handleModifyAndRegenerate = () => {
    if (prompt.trim() && modificationRequest.trim() && pendingSession) {
        onGenerate(prompt, { storyToModify: pendingSession.notes ?? '', request: modificationRequest });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-2xl">
            <Wand2 className="mr-2" /> Generatore di Storie
          </CardTitle>
          <CardDescription>
            Scrivi un prompt per guidare l'IA nella creazione della prossima parte della tua storia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Esempio: I giocatori entrano nella taverna 'Il Drago Addormentato' e incontrano un misterioso straniero incappucciato che offre loro una mappa..."
            className="min-h-[100px] resize-y"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          <Button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating} className="w-full">
            {isGenerating && !pendingSession ? (
              <>
                <Wand2 className="mr-2 h-4 w-4 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Genera la Prossima Scena
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {(isGenerating || pendingSession) && (
        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Scena Proposta dall'IA</CardTitle>
            <CardDescription>
              Ecco la bozza generata dall'IA. Puoi modificare il titolo e le note, chiedere all'IA di fare delle modifiche, o confermarla per aggiungerla alla tua cronologia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isGenerating && !pendingSession ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/4 mt-4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-1/4 mt-4" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="session-title">Titolo Scena</Label>
                  <Input
                    id="session-title"
                    value={pendingSession?.title || ''}
                    onChange={(e) => onPendingSessionChange({ title: e.target.value })}
                    disabled={isGenerating || !pendingSession}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-notes">Contenuto Scena</Label>
                  <Textarea
                    id="session-notes"
                    placeholder="L'IA sta scrivendo la sua proposta..."
                    className="min-h-[300px] resize-y"
                    value={pendingSession?.notes || ''}
                    onChange={(e) => onPendingSessionChange({ notes: e.target.value })}
                    disabled={isGenerating || !pendingSession}
                  />
                </div>
                 {pendingSession?.xp_award != null && (
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="xp-award">Punti Esperienza (XP) Consigliati</Label>
                        <div className="relative">
                            <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                id="xp-award"
                                type="number"
                                className="pl-10 font-bold"
                                value={pendingSession.xp_award}
                                onChange={(e) => onPendingSessionChange({ xp_award: parseInt(e.target.value, 10) || 0 })}
                                disabled={isGenerating || !pendingSession}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground px-1">
                            Modifica il suggerimento dell'IA se necessario.
                        </p>
                    </div>
                )}
              </>
            )}
            
            <div className="space-y-2">
                <Label htmlFor="modification-request">Vuoi cambiare qualcosa nella storia?</Label>
                <Textarea
                    id="modification-request"
                    placeholder="Esempio: 'Rendi lo straniero meno misterioso e più amichevole.'"
                    className="min-h-[80px] resize-y"
                    value={modificationRequest}
                    onChange={(e) => setModificationRequest(e.target.value)}
                    disabled={isGenerating || !pendingSession}
                />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleConfirm} disabled={isGenerating || !pendingSession} className="flex-1">
                <Check className="mr-2 h-4 w-4" /> Conferma e Aggiungi alla Storia
              </Button>
              <Button 
                onClick={handleModifyAndRegenerate} 
                variant="outline" 
                disabled={isGenerating || !pendingSession || !modificationRequest.trim()} 
                className="flex-1"
              >
                 {isGenerating && pendingSession ? (
                    <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Rigenerazione...
                    </>
                 ) : (
                    <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Modifica e Rigenera
                    </>
                 )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
