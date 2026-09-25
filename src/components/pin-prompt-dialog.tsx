'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Lock, 
  Key, 
  ShieldAlert, 
  CheckCircle2, 
  Delete, 
  Shield, 
  KeyRound, 
  Keyboard, 
  Sparkles, 
  Flame, 
  Scroll,
  ArrowLeft,
  X
} from 'lucide-react';
import { verifyPin, verifyPassword, isPinConfigured, openPinConfigDialog, isPlayerMode } from '@/lib/pin-storage';
import { unlockDeviceToMasterAction } from '@/lib/actions';
import { 
  getBackgroundSettings, 
  resolveBackgroundStyle, 
  BackgroundConfig, 
  DEFAULT_BACKGROUND_SETTINGS 
} from '@/lib/background-storage';

function getDigitFromEvent(e: KeyboardEvent): string | null {
  // 1. Tasti standard 0-9 (tasti numerici superiori o tastierino con NumLock)
  if (e.key >= '0' && e.key <= '9') {
    return e.key;
  }
  // 2. Tastierino numerico fisico (Numpad0 - Numpad9, attivo con o senza NumLock)
  if (e.code && e.code.startsWith('Numpad')) {
    const match = e.code.match(/^Numpad([0-9])$/);
    if (match && match[1]) {
      return match[1];
    }
  }
  // 3. Fallback keyCode / which
  const code = e.keyCode || e.which;
  if (code >= 48 && code <= 57) {
    return String(code - 48);
  }
  if (code >= 96 && code <= 105) {
    return String(code - 96);
  }
  return null;
}

function isBackspaceOrDelete(e: KeyboardEvent): boolean {
  return (
    e.key === 'Backspace' ||
    e.key === 'Delete' ||
    e.code === 'Backspace' ||
    e.code === 'Delete' ||
    (e.code === 'NumpadDecimal' && e.key === 'Delete') ||
    e.keyCode === 8 ||
    e.keyCode === 46
  );
}

function isEnterKey(e: KeyboardEvent): boolean {
  return e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
}

interface PinPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSuccess: () => void;
}

export function PinPromptDialog({
  open,
  onOpenChange,
  title = "Area Riservata al Dungeon Master",
  description = "Inserisci il PIN del Master a 4 cifre per accedere a questa sezione protetta.",
  onSuccess,
}: PinPromptDialogProps) {
  const [pin, setPin] = useState<string>('');
  const pinRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState<string>('');
  const [usePassword, setUsePassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [inPlayerMode, setInPlayerMode] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pinBgConfig, setPinBgConfig] = useState<BackgroundConfig>(DEFAULT_BACKGROUND_SETTINGS.pin);

  useEffect(() => {
    setPinBgConfig(getBackgroundSettings().pin);
    const handleBgChange = (e: any) => {
      if (e.detail?.pin) {
        setPinBgConfig(e.detail.pin);
      }
    };
    window.addEventListener('dnd-backgrounds-changed', handleBgChange);
    return () => window.removeEventListener('dnd-backgrounds-changed', handleBgChange);
  }, []);

  const bgStyle = resolveBackgroundStyle('pin', pinBgConfig);

  useEffect(() => {
    if (open) {
      setHasPin(isPinConfigured());
      setInPlayerMode(isPlayerMode());
      setPin('');
      pinRef.current = '';
      setPassword('');
      setUsePassword(false);
      setError('');
      setIsSuccess(false);
      setIsLoading(false);
    }
  }, [open]);

  const triggerSuccess = useCallback(() => {
    setIsSuccess(true);
    setError('');
    setTimeout(() => {
      onOpenChange(false);
      onSuccess();
    }, 400);
  }, [onOpenChange, onSuccess]);

  const submitPin = useCallback(async (valToTest: string) => {
    setIsLoading(true);
    setError('');

    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('dnd_device_id') : null;

    // 1. Verifica locale immediata
    if (verifyPin(valToTest)) {
      if (deviceId) {
        unlockDeviceToMasterAction(deviceId, valToTest).catch(() => {});
      }
      setIsLoading(false);
      triggerSuccess();
      return;
    }

    // 2. Se verifica locale fallisce o non ha hash salvato, verifica sul server
    if (deviceId) {
      try {
        const res = await unlockDeviceToMasterAction(deviceId, valToTest);
        if (res.success) {
          setIsLoading(false);
          triggerSuccess();
          return;
        }
      } catch (err) {}
    }

    setIsLoading(false);
    setError('PIN Master non valido. Riprova.');
    pinRef.current = '';
    setPin('');
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(100);
    }
  }, [triggerSuccess]);

  const handleDigit = useCallback((digit: string) => {
    if (isLoading || isSuccess) return;
    const current = pinRef.current;
    if (current.length >= 4) return;
    const next = current + digit;
    pinRef.current = next;
    setPin(next);
    setError('');

    if (next.length === 4) {
      submitPin(next);
    }
  }, [isLoading, isSuccess, submitPin]);

  const handleDelete = useCallback(() => {
    if (isLoading || isSuccess) return;
    const current = pinRef.current;
    const next = current.slice(0, -1);
    pinRef.current = next;
    setPin(next);
    setError('');
  }, [isLoading, isSuccess]);

  // Intercettazione globale di keydown per tastiera fisica e tastierino numerico su desktop
  useEffect(() => {
    if (!open || usePassword) return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const digit = getDigitFromEvent(e);
      if (digit !== null) {
        e.preventDefault();
        e.stopPropagation();
        handleDigit(digit);
        return;
      }

      if (isBackspaceOrDelete(e)) {
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange(false);
        return;
      }

      if (isEnterKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (!hasPin) {
          triggerSuccess();
        } else if (pinRef.current.length === 4) {
          submitPin(pinRef.current);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true);
    };
  }, [open, usePassword, hasPin, handleDigit, handleDelete, triggerSuccess, submitPin, onOpenChange]);

  const submitPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');

    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('dnd_device_id') : null;

    if (verifyPassword(password)) {
      if (deviceId) {
        unlockDeviceToMasterAction(deviceId, password).catch(() => {});
      }
      setIsLoading(false);
      triggerSuccess();
      return;
    }

    if (deviceId) {
      try {
        const res = await unlockDeviceToMasterAction(deviceId, password);
        if (res.success) {
          setIsLoading(false);
          triggerSuccess();
          return;
        }
      } catch (err) {}
    }

    setIsLoading(false);
    setError('Password di emergenza del Master non corretta.');
  };

  const handleOpenSetup = () => {
    onOpenChange(false);
    openPinConfigDialog();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="w-[95vw] sm:max-w-[650px] md:max-w-[700px] max-h-[96vh] sm:max-h-[85vh] overflow-y-auto p-0 border-2 border-amber-600/70 text-stone-100 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.25)] rounded-2xl bg-stone-950 focus:outline-none text-center"
      >
        {/* Layer Sfondo Personalizzabile Dinamico (come il Blocco Schermo Master) */}
        <div 
          suppressHydrationWarning
          className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-300"
          style={{
            backgroundImage: bgStyle.backgroundImage 
              ? `${bgStyle.backgroundImage}, url('/ancient-grimoire-bg.jpg'), url('/api/assets/ancient-grimoire-bg.jpg')`
              : "url('/ancient-grimoire-bg.jpg'), url('/api/assets/ancient-grimoire-bg.jpg')",
            opacity: bgStyle.opacity ?? 0.85,
            filter: bgStyle.filter,
          }}
        />

        {/* Overlay scuro per contrasto testi */}
        <div 
          suppressHydrationWarning
          className="absolute inset-0 pointer-events-none transition-all duration-300"
          style={{
            backgroundColor: `rgba(14, 9, 6, ${pinBgConfig.overlayDarkness ?? 0.45})`
          }}
        />

        {/* Polvere d'oro e texture runica */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Angolari decorativi in ferro battuto / ottone antico */}
        <div className="absolute top-2 left-2 w-7 h-7 pointer-events-none border-t-2 border-l-2 border-amber-500/80 p-0.5 z-20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_#f59e0b]" />
        </div>
        <div className="absolute top-2 right-2 w-7 h-7 pointer-events-none border-t-2 border-r-2 border-amber-500/80 p-0.5 flex justify-end z-20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_#f59e0b]" />
        </div>
        <div className="absolute bottom-2 left-2 w-7 h-7 pointer-events-none border-b-2 border-l-2 border-amber-500/80 p-0.5 flex items-end z-20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_#f59e0b]" />
        </div>
        <div className="absolute bottom-2 right-2 w-7 h-7 pointer-events-none border-b-2 border-r-2 border-amber-500/80 p-0.5 flex items-end justify-end z-20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_#f59e0b]" />
        </div>

        {/* Bottone X per chiudere la schermata PIN Master */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChange(false);
          }}
          className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-stone-900/90 border border-amber-500/60 text-amber-300 hover:text-amber-100 hover:bg-amber-950 transition-all cursor-pointer shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Chiudi schermata PIN Master"
          title="Chiudi schermata PIN"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Contenuto principale del Dialogo: Grid orizzontale su schermi larghi */}
        <div className="relative z-10 p-3 sm:p-6 sm:grid sm:grid-cols-2 sm:gap-6 sm:items-center">
          
          {/* Colonna Sinistra (su desktop): Sigillo, Titolo e Descrizione */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left mb-2 sm:mb-0 space-y-1.5 sm:space-y-3">
            {/* Sigillo Magico Runico in miniatura con Cerchio Ruotante */}
            <div className="relative w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center mx-auto sm:mx-0">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]">
                <g className="animate-spin" style={{ transformOrigin: '50px 50px', animationDuration: '30s' }}>
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#d97706" strokeWidth="1.2" strokeDasharray="3 3" />
                  <circle cx="50" cy="50" r="41" fill="none" stroke="#b45309" strokeWidth="0.8" strokeOpacity="0.7" />
                  <text fontSize="5.5" fill="#f59e0b" fillOpacity="0.7" textAnchor="middle" letterSpacing="3">
                    <textPath href="#dialogRunicPath" startOffset="50%">
                      ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ
                    </textPath>
                  </text>
                </g>
                <defs>
                  <path id="dialogRunicPath" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
                </defs>
                <polygon points="50,16 61,39 84,39 65,54 72,77 50,63 28,77 35,54 16,39 39,39" fill="rgba(245, 158, 11, 0.08)" stroke="#d97706" strokeWidth="0.8" strokeOpacity="0.6" />
                <circle cx="50" cy="50" r="18" fill="radial-gradient(circle, #3a2010 0%, #170d06 100%)" stroke="#f59e0b" strokeWidth="1.5" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-amber-300 drop-shadow-[0_0_8px_#f59e0b]">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
            </div>

            <DialogHeader className="text-center sm:text-left items-center sm:items-start p-0 space-y-0.5 sm:space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[9px] sm:text-[10px] font-serif uppercase tracking-[0.18em] shadow-md">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                Grimorio Sigillato
              </div>
              <DialogTitle className="font-serif text-base sm:text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {title}
              </DialogTitle>
              <DialogDescription className="text-amber-200/70 text-[11px] sm:text-xs text-center sm:text-left max-w-[280px]">
                {hasPin 
                  ? description 
                  : inPlayerMode 
                    ? "Questo dispositivo è in Modalità Giocatore. È richiesto il PIN del Dungeon Master per sbloccare la modalità Master."
                    : "Nessun PIN Master configurato. Configura il tuo PIN per proteggere i contenuti del Master."}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="w-full flex items-center justify-center sm:justify-start gap-2 text-xs text-rose-300 bg-rose-950/80 border border-rose-700/60 rounded-lg p-2 animate-shake shadow-lg">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {isSuccess && (
              <div className="w-full flex items-center justify-center sm:justify-start gap-2 text-xs text-emerald-300 bg-emerald-950/80 border border-emerald-600/60 rounded-lg p-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-serif font-bold tracking-wide">Sigillo Spezzato • Accesso Master Autorizzato</span>
              </div>
            )}
          </div>

          {/* Colonna Destra (su desktop): Tastierino PIN o form password o pulsanti setup */}
          <div className="flex flex-col items-center justify-center w-full">

          {!hasPin ? (
            <div className="w-full space-y-3 py-1 text-center">
              <div className="p-3 rounded-xl bg-gradient-to-b from-[#24170e]/80 to-[#140c07]/90 border border-amber-700/50 text-xs text-amber-200/90 leading-relaxed shadow-inner">
                Nessun PIN di protezione è attualmente memorizzato nel grimorio. Puoi accedere alla modalità Master direttamente oppure incidere un nuovo PIN protettivo.
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={triggerSuccess}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-stone-950 font-serif font-bold text-xs uppercase tracking-wider gap-2 min-h-[40px] shadow-lg shadow-emerald-950/50 border border-emerald-400/40 active:scale-95"
                >
                  <Shield className="w-4 h-4" />
                  Accedi alla Modalità Master
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenSetup}
                  className="w-full border-amber-600/50 bg-[#1d120a]/80 text-amber-300 hover:bg-amber-950/80 hover:border-amber-400 font-serif text-xs uppercase tracking-wider gap-2 min-h-[38px] active:scale-95"
                >
                  <KeyRound className="w-4 h-4" />
                  Configura PIN di Sicurezza
                </Button>
              </div>
            </div>
          ) : !usePassword ? (
            <div className="w-full space-y-2 py-0.5">
              {/* Caselle visive runiche */}
              <div className="relative mx-auto my-0.5 w-full max-w-[260px]">
                <div className="flex justify-center gap-3 select-none py-0.5">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = pin.length > idx;
                    const isCurrent = pin.length === idx;
                    const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚬ'];

                    return (
                      <div key={idx} className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-amber-500/60 font-serif">{runes[idx]}</span>
                        <div
                          className={`w-9 h-10 sm:w-12 sm:h-14 rounded-xl border-2 flex items-center justify-center text-lg sm:text-xl font-serif transition-all duration-200 relative ${
                            isFilled
                              ? 'bg-gradient-to-b from-amber-500/25 to-amber-700/20 border-amber-400 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.5)] scale-105'
                              : isCurrent
                                ? 'border-amber-400 bg-[#22150d]/90 ring-2 ring-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                : 'border-amber-900/60 bg-[#160d07]/80 text-amber-950/60'
                          }`}
                        >
                          {isFilled ? (
                            <span className="text-amber-300 drop-shadow-[0_0_8px_#f59e0b] animate-in zoom-in-50 duration-200">✦</span>
                          ) : isCurrent ? (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping" />
                          ) : (
                            <span className="text-xs text-amber-800/40">●</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tastierino Magico del Grimorio (3 colonne x 4 righe) */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-w-[240px] sm:max-w-[250px] mx-auto pt-0.5">
                {[
                  { digit: '1', rune: 'I' },
                  { digit: '2', rune: 'II' },
                  { digit: '3', rune: 'III' },
                  { digit: '4', rune: 'IV' },
                  { digit: '5', rune: 'V' },
                  { digit: '6', rune: 'VI' },
                  { digit: '7', rune: 'VII' },
                  { digit: '8', rune: 'VIII' },
                  { digit: '9', rune: 'IX' },
                ].map(({ digit, rune }) => (
                  <Button
                    key={digit}
                    type="button"
                    variant="outline"
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDigit(digit);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDigit(digit);
                    }}
                    className="h-9.5 sm:h-12 flex flex-col items-center justify-center p-0 rounded-xl bg-gradient-to-b from-[#2a1a0f]/90 via-[#1c110a]/95 to-[#120a06]/98 border border-amber-700/50 hover:border-amber-400 hover:from-[#3a2415] hover:to-[#22140c] text-amber-200 active:scale-95 shadow-md shadow-black/80 transition-all disabled:opacity-50 touch-manipulation cursor-pointer"
                  >
                    <span className="text-sm sm:text-lg font-serif font-bold leading-none text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] pointer-events-none">{digit}</span>
                    <span className="text-[7px] sm:text-[8px] text-amber-400/50 uppercase tracking-widest mt-0.5 pointer-events-none">{rune}</span>
                  </Button>
                ))}

                {/* Tasto Parola Arcana di Emergenza */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setUsePassword(true);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setUsePassword(true);
                  }}
                  className="h-9.5 sm:h-12 flex flex-col items-center justify-center p-0 rounded-xl bg-[#170e08]/90 border border-amber-900/60 hover:border-amber-600/80 hover:bg-amber-950/60 text-amber-400/80 hover:text-amber-200 active:scale-95 transition-all disabled:opacity-50 touch-manipulation cursor-pointer"
                  aria-label="Parola Arcana di Emergenza"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400 pointer-events-none" />
                  <span className="text-[7px] uppercase tracking-wider text-amber-400/70 mt-0.5 pointer-events-none">Parola</span>
                </Button>

                {/* Tasto 0 */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDigit('0');
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDigit('0');
                  }}
                  className="h-9.5 sm:h-12 flex flex-col items-center justify-center p-0 rounded-xl bg-gradient-to-b from-[#2a1a0f]/90 via-[#1c110a]/95 to-[#120a06]/98 border border-amber-700/50 hover:border-amber-400 hover:from-[#3a2415] hover:to-[#22140c] text-amber-200 active:scale-95 shadow-md shadow-black/80 transition-all disabled:opacity-50 touch-manipulation cursor-pointer"
                >
                  <span className="text-sm sm:text-lg font-serif font-bold leading-none text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] pointer-events-none">0</span>
                  <span className="text-[7px] sm:text-[8px] text-amber-400/50 uppercase tracking-widest mt-0.5 pointer-events-none">Ø</span>
                </Button>

                {/* Tasto Cancella Cifra */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDelete();
                  }}
                  className="h-9.5 sm:h-12 flex flex-col items-center justify-center p-0 rounded-xl bg-[#170e08]/90 border border-amber-900/60 hover:border-rose-700/80 hover:bg-rose-950/40 text-rose-300/80 hover:text-rose-200 active:scale-95 transition-all disabled:opacity-50 touch-manipulation cursor-pointer"
                  aria-label="Cancella cifra"
                >
                  <Delete className="w-4 h-4 text-amber-300 pointer-events-none" />
                  <span className="text-[7px] uppercase tracking-wider text-amber-400/70 mt-0.5 pointer-events-none">Canc</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Modalità Password di Emergenza */
            <form onSubmit={submitPassword} className="w-full space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-[#24170e]/80 border border-amber-700/50 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-serif">
                  <Scroll className="w-4 h-4 text-amber-400" />
                  <span>Parola Segreta di Emergenza del Master:</span>
                </div>
                <Input
                  type="password"
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Inserisci la parola segreta..."
                  className="bg-[#140c07] border-amber-700/60 text-amber-100 placeholder:text-stone-600 focus:border-amber-400 rounded-lg h-11"
                  autoFocus
                />
              </div>
              <div className="flex gap-2.5 justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={() => setUsePassword(false)}
                  className="text-xs text-amber-300/80 hover:text-amber-100 hover:bg-amber-950/50 gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Torna al PIN
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-serif font-bold text-xs uppercase tracking-wider px-5 min-h-[40px] shadow-md shadow-amber-950/60"
                >
                  {isLoading ? 'Verifica...' : 'Conferma'}
                </Button>
              </div>
            </form>
          )}

          {/* Footer del Dialogo */}
          <div className="w-full flex items-center justify-between border-t border-amber-900/40 pt-3 mt-2 col-span-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-amber-300/70 hover:text-amber-100 hover:bg-amber-950/50 text-xs"
            >
              Annulla
            </Button>
            {!usePassword && hasPin && (
              <button
                type="button"
                onClick={() => setUsePassword(true)}
                className="text-[11px] text-amber-400/80 hover:text-amber-200 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
              >
                <Key className="w-3 h-3" />
                Password d'emergenza?
              </button>
            )}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
