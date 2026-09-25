'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Crown, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isPlayerMode,
  setPlayerMode,
  isPinConfigured,
  openPinConfigDialog,
  getBlockedViews,
} from '@/lib/pin-storage';
import { PinPromptDialog } from './pin-prompt-dialog';
import { useToast } from '@/hooks/use-toast';

interface PlayerModeToggleProps {
  className?: string;
  showBadge?: boolean;
  variant?: 'outline' | 'ghost' | 'default';
  iconOnly?: boolean;
}

export function PlayerModeToggle({ 
  className, 
  showBadge = true,
  variant = 'outline',
  iconOnly = false
}: PlayerModeToggleProps) {
  const [playerMode, setPlayerModeState] = useState<boolean>(true);
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const { toast } = useToast();

  const update = useCallback(() => {
    setPlayerModeState(isPlayerMode());
    setBlockedCount(getBlockedViews().length);
  }, []);

  useEffect(() => {
    update();

    const handlePlayerModeChange = (e: any) => {
      setPlayerModeState(Boolean(e.detail?.isPlayerMode));
    };
    const handleBlockedViewsChange = () => {
      setBlockedCount(getBlockedViews().length);
    };

    window.addEventListener('dnd-player-mode-changed', handlePlayerModeChange);
    window.addEventListener('dnd-blocked-views-changed', handleBlockedViewsChange);

    return () => {
      window.removeEventListener('dnd-player-mode-changed', handlePlayerModeChange);
      window.removeEventListener('dnd-blocked-views-changed', handleBlockedViewsChange);
    };
  }, [update]);

  const handleToggleClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (e.type === 'touchend') {
      e.preventDefault();
    }
    if (playerMode) {
      // Se non è mai stato impostato il PIN -> fai apparire la scheda di configurazione PIN
      if (!isPinConfigured()) {
        openPinConfigDialog();
        return;
      }
      // Se è già stato impostato -> chiedi il PIN
      setIsPromptOpen(true);
    } else {
      // Da Master a Giocatore: attiva subito
      setPlayerMode(true);
      setPlayerModeState(true);
      toast({
        title: "Modalità Giocatore Attiva",
        description: `Le sezioni riservate sono ora protette.`,
      });
    }
  };

  const exitPlayerMode = () => {
    setPlayerMode(false);
    setPlayerModeState(false);
    toast({
      title: "Modalità Dungeon Master",
      description: "Accesso completo ripristinato a tutte le schede e note private.",
    });
  };

  const tooltipText = playerMode
    ? "Modalità Giocatore attiva. Tocca per passare al Dungeon Master."
    : "Modalità DM attiva. Tocca per passare alla Modalità Giocatore.";

  return (
    <>
      <Button
        type="button"
        variant={variant === 'ghost' ? 'ghost' : 'outline'}
        size={(iconOnly || playerMode) ? 'icon' : (variant === 'ghost' ? 'icon' : 'sm')}
        onClick={handleToggleClick}
        onTouchEnd={handleToggleClick}
        className={
          variant === 'ghost'
            ? `h-10 w-10 text-primary hover:bg-amber-500/10 rounded-md transition-all duration-200 active:scale-95 flex items-center justify-center touch-manipulation cursor-pointer ${
                playerMode
                  ? 'text-emerald-400 hover:bg-emerald-500/15'
                  : 'text-amber-400 hover:bg-amber-500/10'
              } ${className || ''}`
            : `relative touch-manipulation cursor-pointer min-h-[44px] sm:min-h-[40px] px-3 gap-2 border-stone-700 bg-stone-900/90 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                playerMode
                  ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/60 shadow-[0_0_10px_rgba(16,185,129,0.15)] rounded-full w-10 h-10 p-0'
                  : 'hover:bg-stone-800 text-stone-300'
              } ${className || ''}`
        }
        aria-label={tooltipText}
      >
        {playerMode ? (
          <>
            <Swords className={`${variant === 'ghost' ? 'w-6 h-6' : 'w-5 h-5'} text-emerald-400 pointer-events-none`} />
            {showBadge && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] pointer-events-none" />
            )}
          </>
        ) : (
          <>
            <Crown className={`${variant === 'ghost' ? 'w-6 h-6' : 'w-4 h-4'} text-amber-400 pointer-events-none`} />
            {!iconOnly && variant !== 'ghost' && <span className="font-serif hidden sm:inline pointer-events-none">👑 Modalità DM</span>}
          </>
        )}
      </Button>

      {/* Prompt PIN per sbloccare la modalità Master */}
      <PinPromptDialog
        open={isPromptOpen}
        onOpenChange={setIsPromptOpen}
        title="Sezione Protetta dal Dungeon Master"
        description="Inserisci il PIN per accedere alla scheda 'Sistema'"
        onSuccess={exitPlayerMode}
      />
    </>
  );
}
