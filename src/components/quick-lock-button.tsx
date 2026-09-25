'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  isPinConfigured, 
  getIsLocked, 
  setIsLocked,
  isPlayerMode
} from '@/lib/pin-storage';

interface QuickLockButtonProps {
  onOpenConfig?: () => void;
  className?: string;
  showText?: boolean;
  variant?: 'outline' | 'ghost' | 'default';
}

export function QuickLockButton({ 
  onOpenConfig, 
  className, 
  showText = false,
  variant = 'outline'
}: QuickLockButtonProps) {
  const [configured, setConfigured] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const [playerMode, setPlayerMode] = useState<boolean>(true);

  const updateState = useCallback(() => {
    setConfigured(isPinConfigured());
    setLocked(getIsLocked());
    setPlayerMode(isPlayerMode());
  }, []);

  useEffect(() => {
    updateState();

    const handleLockChange = (e: any) => {
      setLocked(Boolean(e.detail?.isLocked));
    };

    const handleConfigChange = () => {
      setConfigured(isPinConfigured());
    };

    const handlePlayerModeChange = (e: any) => {
      setPlayerMode(Boolean(e.detail?.isPlayerMode));
    };

    window.addEventListener('dnd-lock-state-changed', handleLockChange);
    window.addEventListener('dnd-pin-config-changed', handleConfigChange);
    window.addEventListener('dnd-player-mode-changed', handlePlayerModeChange);

    // Scorciatoia di Emergenza (Alt + L) per bloccare al volo (solo se non in modalità giocatore)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPlayerMode()) return;
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (isPinConfigured()) {
          setIsLocked(true);
        } else if (onOpenConfig) {
          onOpenConfig();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dnd-lock-state-changed', handleLockChange);
      window.removeEventListener('dnd-pin-config-changed', handleConfigChange);
      window.removeEventListener('dnd-player-mode-changed', handlePlayerModeChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [updateState, onOpenConfig]);

  // In modalità Giocatore il pulsante di blocco / configurazione PIN non deve esistere né vedersi
  if (playerMode) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!configured) {
      if (onOpenConfig) onOpenConfig();
    } else {
      setIsLocked(true);
    }
  };

  const tooltipTitle = configured
    ? "Blocca schermo con PIN (Alt+L)"
    : "Configura PIN e Password di sicurezza";

  return (
    <Button
      type="button"
      variant={variant === 'ghost' ? 'ghost' : 'outline'}
      size={showText ? "sm" : "icon"}
      onClick={handleClick}
      title={tooltipTitle}
      className={
        variant === 'ghost'
          ? `h-10 w-10 text-primary hover:bg-amber-500/10 rounded-md transition-all duration-200 active:scale-95 flex items-center justify-center relative touch-manipulation cursor-pointer ${
              !configured ? 'text-stone-500 hover:text-stone-300' : 'text-amber-400 hover:text-amber-300'
            } ${className || ''}`
          : `relative touch-manipulation cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] border-amber-500/30 hover:border-amber-400 bg-stone-900/90 hover:bg-amber-950/40 text-amber-200 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
              !configured ? 'border-dashed border-stone-600 text-stone-400' : ''
            } ${className || ''}`
      }
      aria-label={tooltipTitle}
    >
      {configured ? (
        <Lock className={`${variant === 'ghost' ? 'w-5 h-5' : 'w-5 h-5'} text-amber-400 pointer-events-none`} />
      ) : (
        <ShieldAlert className={`${variant === 'ghost' ? 'w-5 h-5' : 'w-5 h-5'} text-stone-400 pointer-events-none`} />
      )}
      
      {showText && (
        <span className="font-serif text-xs font-semibold pointer-events-none">
          {configured ? "Sigilla Schermo" : "Imposta PIN"}
        </span>
      )}

      {/* Piccolo indicatore runico quando configurato */}
      {configured && (
        <span className={`w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b] pointer-events-none ${variant === 'ghost' ? 'absolute top-1 right-1' : 'absolute -top-0.5 -right-0.5'}`} />
      )}
    </Button>
  );
}
