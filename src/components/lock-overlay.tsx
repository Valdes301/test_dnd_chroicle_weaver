'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Unlock, 
  KeyRound, 
  RotateCcw, 
  Delete, 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  EyeOff,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Wand2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  verifyPin, 
  verifyPassword, 
  setIsLocked 
} from '@/lib/pin-storage';
import { 
  getBackgroundSettings, 
  DEFAULT_BACKGROUND_SETTINGS,
  resolveBackgroundStyle, 
  BackgroundConfig 
} from '@/lib/background-storage';
import { useToast } from '@/hooks/use-toast';

function getDigitFromEvent(e: KeyboardEvent): string | null {
  if (e.key >= '0' && e.key <= '9') {
    return e.key;
  }
  if (e.code && e.code.startsWith('Numpad')) {
    const match = e.code.match(/^Numpad([0-9])$/);
    if (match && match[1]) {
      return match[1];
    }
  }
  const code = e.keyCode || e.which;
  if (code >= 48 && code <= 57) {
    return String(code - 48);
  }
  if (code >= 96 && code <= 105) {
    return String(code - 96);
  }
  return null;
}

interface LockOverlayProps {
  onUnlock?: () => void;
  onOpenPinSettings?: () => void;
}

export function LockOverlay({ onUnlock, onOpenPinSettings }: LockOverlayProps) {
  // Vista iniziale: 'seal' (sigillo magico luminoso) o 'keypad' (inserimento PIN/Password)
  const [viewState, setViewState] = useState<'seal' | 'keypad'>('seal');
  const [pin, setPin] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [usePasswordRecovery, setUsePasswordRecovery] = useState<boolean>(false);
  const [recoveryPassword, setRecoveryPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [pinBgConfig, setPinBgConfig] = useState<BackgroundConfig>(DEFAULT_BACKGROUND_SETTINGS.pin);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  // Previeni scroll del body quando bloccato
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  const handleSuccessfulUnlock = useCallback(() => {
    setIsSuccess(true);
    setTimeout(() => {
      setIsLocked(false);
      if (onUnlock) onUnlock();
    }, 450);
  }, [onUnlock]);

  const handleDigit = useCallback((digit: string) => {
    if (isSuccess || pin.length >= 4) return;
    setIsError(false);
    
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      if (verifyPin(nextPin)) {
        handleSuccessfulUnlock();
      } else {
        setIsError(true);
        setTimeout(() => {
          setPin('');
          setIsError(false);
        }, 650);
      }
    }
  }, [pin, isSuccess, handleSuccessfulUnlock]);

  const handleBackspace = useCallback(() => {
    if (isSuccess) return;
    setIsError(false);
    setPin(prev => prev.slice(0, -1));
  }, [isSuccess]);

  const handleClear = useCallback(() => {
    if (isSuccess) return;
    setIsError(false);
    setPin('');
  }, [isSuccess]);

  // Listener tastiera fisica e tastierino numerico
  useEffect(() => {
    if (usePasswordRecovery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSuccess) return;

      const digit = getDigitFromEvent(e);
      if (digit !== null) {
        e.preventDefault();
        // Se siamo ancora nella schermata del sigillo, apri automaticamente il tastierino e digita
        if (viewState === 'seal') {
          setViewState('keypad');
        }
        handleDigit(digit);
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Delete' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === ' ') {
        if (viewState === 'seal') {
          e.preventDefault();
          setViewState('keypad');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleDigit, handleBackspace, handleClear, isSuccess, usePasswordRecovery, viewState]);

  const handleRecoverySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordError(null);

    if (!recoveryPassword) {
      setPasswordError('Inserisci la Password.');
      return;
    }

    if (verifyPassword(recoveryPassword)) {
      toast({
        title: "Sigillo Spezzato!",
        description: "Accesso autorizzato tramite Password.",
      });
      handleSuccessfulUnlock();
    } else {
      setPasswordError('Password non corretta. Verifica e riprova.');
      setIsError(true);
      setTimeout(() => setIsError(false), 600);
    }
  };

  const bgStyle = resolveBackgroundStyle('pin', pinBgConfig);

  return (
    <div 
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Grimorio Sigillato - Inserisci PIN"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 select-none transition-opacity duration-300 ${
        isSuccess ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } backdrop-blur-xl bg-stone-950/75 text-amber-100 overflow-y-auto overflow-x-hidden`}
    >
      {/* Layer Sfondo Personalizzabile Dinamico */}
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

      {/* Overlay di oscuramento protettivo */}
      <div 
        suppressHydrationWarning
        className="absolute inset-0 pointer-events-none transition-all duration-300"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${pinBgConfig.overlayDarkness})`
        }}
      />

      {/* Velo magico di polvere d'oro e atmosfera runica */}
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:28px_28px]" />

      {/* Bottone X per chiudere la schermata PIN Master / uscire in caso di errore */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsLocked(false);
          if (onUnlock) onUnlock();
        }}
        className="absolute top-4 right-4 z-[100000] p-2 sm:p-2.5 rounded-full bg-stone-900/90 border border-amber-500/60 text-amber-300 hover:text-amber-100 hover:bg-amber-950 transition-all cursor-pointer shadow-2xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400 flex items-center justify-center"
        aria-label="Chiudi schermata PIN Master"
        title="Chiudi schermata PIN Master"
      >
        <X className="w-5 h-5" />
      </button>

      <AnimatePresence mode="wait">
        {viewState === 'seal' ? (
          /* ================================================================ */
          /* STATO 1: SIGILLO MAGICO CON LINEA LUMINOSA ANIMATA (STANDBY)     */
          /* ================================================================ */
          <motion.div
            key="seal-view"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15, filter: 'blur(10px)' }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            onClick={() => setViewState('keypad')}
            className="relative z-10 flex flex-col items-center justify-center text-center cursor-pointer group my-auto px-4 max-w-md w-full"
          >
            {/* Contenitore Sigillo con bagliore radiale */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center mb-6">
              {/* Alone magico pulsante di sfondo */}
              <div className="absolute inset-0 rounded-full bg-amber-500/15 blur-3xl group-hover:bg-amber-400/25 transition-all duration-500 animate-pulse" />
              
              {/* SVG Dettagliato del Sigillo Magico con la LINEA LUMINOSA che corre */}
              <svg 
                viewBox="0 0 300 300" 
                className="w-full h-full drop-shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-transform duration-500 group-hover:scale-105 group-active:scale-95"
              >
                <defs>
                  {/* Gradiente per la linea luminosa dorata */}
                  <linearGradient id="luminousGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
                    <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.9" />
                    <stop offset="80%" stopColor="#d97706" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
                  </linearGradient>

                  {/* Gradiente cyan/aurora per il cuore del sigillo */}
                  <radialGradient id="sealCoreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#d97706" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                  </radialGradient>

                  {/* Filtro bagliore incandescente */}
                  <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Sfera centrale di luce */}
                <circle cx="150" cy="150" r="130" fill="url(#sealCoreGlow)" />

                {/* Cerchio Esterno 1 con tratteggio sottile */}
                <circle 
                  cx="150" 
                  cy="150" 
                  r="138" 
                  fill="none" 
                  stroke="#78350f" 
                  strokeWidth="1.5" 
                  strokeDasharray="4 4"
                />

                {/* Cerchio Esterno 2 con Rune (Ruota in senso orario) */}
                <g className="animate-spin" style={{ transformOrigin: '150px 150px', animationDuration: '45s' }}>
                  <circle 
                    cx="150" 
                    cy="150" 
                    r="128" 
                    fill="none" 
                    stroke="#d97706" 
                    strokeWidth="2" 
                    strokeOpacity="0.5" 
                  />
                  <circle 
                    cx="150" 
                    cy="150" 
                    r="114" 
                    fill="none" 
                    stroke="#b45309" 
                    strokeWidth="1" 
                    strokeOpacity="0.4" 
                  />
                  {/* Testo runico inciso sul bordo dell'anello */}
                  <text 
                    className="font-serif text-[8.5px] fill-amber-300/60 uppercase tracking-[6px]"
                  >
                    <textPath href="#runeCirclePath" startOffset="0%">
                      ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ ✧ ARCANA SEAL ✧
                    </textPath>
                  </text>
                  <path 
                    id="runeCirclePath" 
                    d="M 150, 150 m -121, 0 a 121,121 0 1,1 242,0 a 121,121 0 1,1 -242,0" 
                    fill="none" 
                  />
                </g>

                {/* ======================================================== */}
                {/* LA LINEA LUMINOSA: Anello esterno brillante in corsa       */}
                {/* ======================================================== */}
                <circle 
                  cx="150" 
                  cy="150" 
                  r="128" 
                  fill="none" 
                  stroke="url(#luminousGradient)" 
                  strokeWidth="3.5" 
                  strokeLinecap="round"
                  strokeDasharray="90 320"
                  filter="url(#glowFilter)"
                  className="animate-spin"
                  style={{ transformOrigin: '150px 150px', animationDuration: '3.5s' }}
                />

                {/* Seconda linea luminosa interna più veloce (senso antiorario) */}
                <circle 
                  cx="150" 
                  cy="150" 
                  r="85" 
                  fill="none" 
                  stroke="#fef08a" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                  strokeDasharray="50 220"
                  filter="url(#glowFilter)"
                  className="animate-spin"
                  style={{ transformOrigin: '150px 150px', animationDuration: '2.5s', animationDirection: 'reverse' }}
                />

                {/* Geometria Mistica: Stella Heptagramma / Ottagramma inscritto */}
                <g className="animate-spin" style={{ transformOrigin: '150px 150px', animationDuration: '60s', animationDirection: 'reverse' }}>
                  {/* Triangoli incrociati / Stella a 8 punte */}
                  <polygon 
                    points="150,55 217,217 41,105 259,105 83,217" 
                    fill="none" 
                    stroke="#d97706" 
                    strokeWidth="1.2" 
                    strokeOpacity="0.6" 
                  />
                  <polygon 
                    points="150,245 83,83 259,195 41,195 217,83" 
                    fill="none" 
                    stroke="#f59e0b" 
                    strokeWidth="1.2" 
                    strokeOpacity="0.5" 
                  />
                  <circle 
                    cx="150" 
                    cy="150" 
                    r="85" 
                    fill="none" 
                    stroke="#f59e0b" 
                    strokeWidth="1.5" 
                    strokeOpacity="0.4" 
                    strokeDasharray="6 3"
                  />
                </g>

                {/* Cerchio Nucleo Centrale */}
                <circle 
                  cx="150" 
                  cy="150" 
                  r="48" 
                  fill="#1c120c" 
                  stroke="#f59e0b" 
                  strokeWidth="2" 
                  className="drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]"
                />

                {/* Linea luminosa sottile attorno al nucleo */}
                <circle 
                  cx="150" 
                  cy="150" 
                  r="48" 
                  fill="none" 
                  stroke="#fef08a" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeDasharray="30 120"
                  filter="url(#glowFilter)"
                  className="animate-spin"
                  style={{ transformOrigin: '150px 150px', animationDuration: '1.8s' }}
                />

                {/* 4 Nodi Cardinali con gemme di luce */}
                {[
                  { cx: 150, cy: 22 },
                  { cx: 278, cy: 150 },
                  { cx: 150, cy: 278 },
                  { cx: 22, cy: 150 }
                ].map((node, i) => (
                  <g key={i}>
                    <circle cx={node.cx} cy={node.cy} r="5" fill="#f59e0b" filter="url(#glowFilter)" />
                    <circle cx={node.cx} cy={node.cy} r="2.5" fill="#fef08a" />
                  </g>
                ))}
              </svg>

              {/* Icona Lucchetto Centrale nel Cuore del Sigillo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-amber-950/80 border border-amber-400/50 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)] group-hover:scale-110 transition-transform duration-300">
                  <Lock className="w-7 h-7 text-amber-300 drop-shadow-[0_0_8px_#f59e0b]" />
                </div>
              </div>
            </div>

            {/* Testo di Intestazione e Invito al Tocco */}
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-headline font-bold text-amber-200 tracking-wider drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                Grimorio del Master Sigillato
              </h2>
              
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-900/80 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-serif shadow-lg group-hover:bg-amber-950/60 group-hover:border-amber-400 transition-all duration-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>Tocca il Sigillo per Inserire il Codice</span>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ================================================================ */
          /* STATO 2: TASTIERINO / TESTATA DI INSERIMENTO PIN & PASSWORD      */
          /* ================================================================ */
          <motion.div
            key="keypad-view"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-sm flex flex-col items-center text-center my-auto px-2"
          >
            {/* Bottone per richiudere la testata e tornare al Sigillo */}
            <button
              type="button"
              onClick={() => {
                setViewState('seal');
                setPin('');
                setIsError(false);
              }}
              className="absolute -top-10 sm:-top-12 left-1/2 -translate-x-1/2 text-xs text-amber-400/80 hover:text-amber-200 flex items-center gap-1.5 py-1 px-3 rounded-full bg-stone-900/80 border border-amber-500/30 hover:border-amber-400 transition-all"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Torna al Sigillo</span>
            </button>

            {/* Sigillo Magico Compatto in cima al tastierino */}
            <div className="relative mb-2 sm:mb-4 flex items-center justify-center">
              {/* Anello magico esterno che ruota */}
              <div 
                className={`w-14 h-14 sm:w-24 sm:h-24 rounded-full border border-amber-500/30 border-dashed animate-spin ${
                  isError ? 'border-red-500/60' : isSuccess ? 'border-emerald-400' : ''
                }`}
                style={{ animationDuration: '30s' }}
              />

              {/* Anello interno con rune e pulsazione */}
              <div 
                className={`absolute w-11 h-11 sm:w-20 sm:h-20 rounded-full border-2 border-amber-500/40 ${
                  isError 
                    ? 'border-red-500/80 bg-red-950/40 shadow-[0_0_25px_rgba(239,68,68,0.5)]' 
                    : isSuccess
                    ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_35px_rgba(52,211,153,0.7)]'
                    : 'bg-amber-950/30 shadow-[0_0_25px_rgba(217,119,6,0.3)]'
                } flex items-center justify-center transition-all duration-300`}
              >
                {isSuccess ? (
                  <Unlock className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-400 animate-bounce" />
                ) : isError ? (
                  <AlertCircle className="w-5 h-5 sm:w-8 sm:h-8 text-red-400 animate-pulse" />
                ) : (
                  <Lock className="w-5 h-5 sm:w-8 sm:h-8 text-amber-400" />
                )}
              </div>

              {/* Cerchio di luce dorata al centro */}
              <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-lg pointer-events-none" />
            </div>

            {/* Intestazione */}
            <h2 className="text-base sm:text-xl font-headline font-bold text-amber-200 tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {usePasswordRecovery ? 'Recupero con Password' : 'Inserisci il Codice PIN'}
            </h2>
            <p className="text-[10px] sm:text-xs text-amber-400/80 font-serif italic mt-0.5 max-w-xs mb-2 sm:mb-4">
              {usePasswordRecovery 
                ? 'Inserisci la tua Password per spezzare il sigillo di protezione.' 
                : 'Digita il PIN a 4 cifre per accedere agli appunti e ai segreti.'}
            </p>

            {/* Modalità 1: Tastierino PIN Touch & Fisico */}
            {!usePasswordRecovery ? (
              <>
                {/* Slot delle 4 Cifre / Rune */}
                <div 
                  className={`flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-6 ${
                    isError ? 'animate-[shake_0.4s_ease-in-out]' : ''
                  }`}
                >
                  {[0, 1, 2, 3].map((index) => {
                    const isFilled = pin.length > index;
                    return (
                      <div
                        key={index}
                        className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                          isError
                            ? 'border-red-500 bg-red-500 shadow-[0_0_12px_#ef4444]'
                            : isSuccess
                            ? 'border-emerald-400 bg-emerald-400 shadow-[0_0_15px_#34d399]'
                            : isFilled
                            ? 'border-amber-400 bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.8)] scale-110'
                            : 'border-amber-500/40 bg-black/40'
                        }`}
                      >
                        {isFilled && !isError && !isSuccess && (
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-950" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Messaggio di Errore Transitorio */}
                <div className="h-4 mb-1 flex items-center justify-center">
                  {isError && (
                    <span className="text-[11px] text-red-400 font-semibold tracking-wider animate-pulse">
                      Sigillo non riconosciuto. Riprova.
                    </span>
                  )}
                </div>

                {/* Tastierino Numerico Circolare (Touch-friendly per Tablet & Mobile) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3.5 w-full max-w-[240px] sm:max-w-[300px] mb-2 sm:mb-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDigit(String(num));
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDigit(String(num));
                      }}
                      className="h-12 w-12 sm:h-16 sm:w-16 mx-auto rounded-full bg-stone-900/80 hover:bg-amber-950/60 active:scale-90 active:bg-amber-600/40 border border-amber-500/30 hover:border-amber-400/70 text-amber-100 font-headline font-bold text-lg sm:text-2xl shadow-lg transition-all duration-150 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400/50 touch-manipulation cursor-pointer select-none"
                      aria-label={`Tasto ${num}`}
                    >
                      {num}
                    </button>
                  ))}

                  {/* Tasto Cancella Tutto */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClear();
                    }}
                    className="h-14 w-14 sm:h-16 sm:w-16 mx-auto rounded-full bg-stone-900/50 hover:bg-stone-800/80 active:scale-90 border border-stone-700/50 text-stone-400 hover:text-amber-200 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all duration-150 flex items-center justify-center focus:outline-none touch-manipulation cursor-pointer select-none"
                    aria-label="Cancella tutto"
                  >
                    C
                  </button>

                  {/* Tasto 0 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDigit('0');
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDigit('0');
                    }}
                    className="h-14 w-14 sm:h-16 sm:w-16 mx-auto rounded-full bg-stone-900/80 hover:bg-amber-950/60 active:scale-90 active:bg-amber-600/40 border border-amber-500/30 hover:border-amber-400/70 text-amber-100 font-headline font-bold text-xl sm:text-2xl shadow-lg transition-all duration-150 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400/50 touch-manipulation cursor-pointer select-none"
                    aria-label="Tasto 0"
                  >
                    0
                  </button>

                  {/* Tasto Backspace / Elimina Ultima Cifra */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBackspace();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleBackspace();
                    }}
                    className="h-14 w-14 sm:h-16 sm:w-16 mx-auto rounded-full bg-stone-900/50 hover:bg-stone-800/80 active:scale-90 border border-stone-700/50 text-stone-400 hover:text-amber-200 transition-all duration-150 flex items-center justify-center focus:outline-none touch-manipulation cursor-pointer select-none"
                    aria-label="Cancella ultima cifra"
                  >
                    <Delete className="w-5 h-5 sm:w-6 sm:h-6 pointer-events-none" />
                  </button>
                </div>

                {/* Link di Recupero con Password */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUsePasswordRecovery(true);
                      setPasswordError(null);
                      setRecoveryPassword('');
                    }}
                    className="text-[11px] sm:text-xs text-amber-400/70 hover:text-amber-300 underline underline-offset-4 transition-colors flex items-center gap-1.5 py-1 px-3"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Hai dimenticato il PIN? Usa la Password
                  </button>
                </div>
              </>
            ) : (
              /* Modalità 2: Recupero tramite Password */
              <form 
                onSubmit={handleRecoverySubmit}
                className="w-full max-w-[300px] flex flex-col items-center gap-3.5 animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="w-full relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Inserisci Password..."
                    value={recoveryPassword}
                    onChange={(e) => {
                      setRecoveryPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    autoFocus
                    className="h-11 w-full pr-11 bg-stone-900/90 border-amber-500/40 text-amber-100 placeholder:text-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-sans text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400/60 hover:text-amber-300"
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordError && (
                  <p className="text-xs text-red-400 font-medium text-center">
                    {passwordError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold uppercase tracking-wider font-serif gap-2 shadow-lg shadow-amber-900/30 text-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verifica & Sblocca
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setUsePasswordRecovery(false);
                    setPasswordError(null);
                    setPin('');
                  }}
                  className="text-xs text-stone-400 hover:text-amber-200 underline underline-offset-4 mt-1 transition-colors"
                >
                  ← Torna al tastierino PIN
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
