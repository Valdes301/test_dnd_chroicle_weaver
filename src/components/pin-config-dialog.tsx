'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Lock, 
  KeyRound, 
  ShieldAlert, 
  Check, 
  Trash2, 
  Eye, 
  EyeOff, 
  Timer,
  AlertTriangle 
} from 'lucide-react';
import { 
  isPinConfigured, 
  configurePinAndPass, 
  removePinProtection, 
  getAutoLockMinutes, 
  setAutoLockMinutes,
  verifyPin,
  verifyPassword,
  isPlayerMode
} from '@/lib/pin-storage';
import { useToast } from '@/hooks/use-toast';

interface PinConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: () => void;
}

export function PinConfigDialog({ open, onOpenChange, onConfigSaved }: PinConfigDialogProps) {
  const [configured, setConfigured] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'manage'>('setup');
  const [playerMode, setPlayerMode] = useState<boolean>(false);
  
  // Campi per la prima configurazione o aggiornamento
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [autoLockMin, setAutoLockMin] = useState<string>('0');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Campi per la rimozione o cambio
  const [currentSecret, setCurrentSecret] = useState<string>('');
  const [showCurrentSecret, setShowCurrentSecret] = useState<boolean>(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setPlayerMode(isPlayerMode());
    const handlePlayerModeChange = (e: any) => {
      const pm = Boolean(e.detail?.isPlayerMode);
      setPlayerMode(pm);
    };

    window.addEventListener('dnd-player-mode-changed', handlePlayerModeChange);
    return () => window.removeEventListener('dnd-player-mode-changed', handlePlayerModeChange);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      const isConfig = isPinConfigured();
      setConfigured(isConfig);
      setActiveTab(isConfig ? 'manage' : 'setup');
      setAutoLockMin(String(getAutoLockMinutes()));
      setPin('');
      setConfirmPin('');
      setPassword('');
      setCurrentSecret('');
      setErrorMsg(null);
      setRemoveConfirmOpen(false);
    }
  }, [open]);

  const handleSaveSetup = () => {
    setErrorMsg(null);

    // Se il dispositivo è attualmente in modalità giocatore, è severamente vietato impostare un nuovo PIN senza autorizzazione
    if (playerMode && configured) {
      if (!verifyPin(currentSecret) && !verifyPassword(currentSecret)) {
        setErrorMsg('Accesso negato: solo il Dungeon Master può modificare il PIN di sicurezza.');
        return;
      }
    }

    // Se stiamo modificando e c'è già un PIN, verifichiamo la credenziale attuale
    if (configured) {
      if (!verifyPin(currentSecret) && !verifyPassword(currentSecret)) {
        setErrorMsg('Inserisci il PIN attuale o la Password corretta per autorizzare le modifiche.');
        return;
      }
    }

    if (!/^\d{4,6}$/.test(pin.trim())) {
      setErrorMsg('Il PIN deve contenere da 4 a 6 cifre numeriche (es. 1234 o 123456).');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMsg('I due PIN inseriti non corrispondono.');
      return;
    }

    if (password.trim().length < 3) {
      setErrorMsg('La Password di sicurezza deve contenere almeno 3 caratteri.');
      return;
    }

    const res = configurePinAndPass(pin, password, parseInt(autoLockMin, 10));
    if (!res.success) {
      setErrorMsg(res.error || 'Errore nella configurazione.');
      return;
    }

    toast({
      title: "Modalità Master Attivata!",
      description: "Il PIN è stato configurato. Sei ora in modalità Dungeon Master con accesso completo.",
    });

    onOpenChange(false);
    if (onConfigSaved) onConfigSaved();
  };

  const handleRemoveProtection = () => {
    setErrorMsg(null);
    if (!currentSecret) {
      setErrorMsg('Inserisci il PIN attuale o la Password per disattivare la protezione.');
      return;
    }

    const res = removePinProtection(currentSecret);
    if (!res.success) {
      setErrorMsg(res.error || 'Credenziale non valida.');
      return;
    }

    toast({
      title: "Protezione Rimossa",
      description: "Il blocco schermo e il PIN sono stati disattivati.",
    });

    onOpenChange(false);
    if (onConfigSaved) onConfigSaved();
  };

  const handleUpdateAutoLockOnly = (val: string) => {
    setAutoLockMin(val);
    setAutoLockMinutes(parseInt(val, 10));
    toast({
      title: "Timer di Inattività Aggiornato",
      description: val === '0' ? "Blocco automatico disattivato." : `Blocco automatico impostato a ${val} minuti.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-900/60 bg-stone-950 text-amber-100 transition-all p-3 sm:p-6 max-h-[90vh] overflow-y-auto w-[96vw] max-w-full sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2 sm:gap-2.5 text-amber-400">
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-950/60 border border-amber-500/30 shrink-0">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-headline font-bold text-amber-200 truncate">
                {configured ? 'Gestione Sigillo & Permessi' : 'Configura Blocco Schermo (PIN)'}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-stone-400 line-clamp-2">
                Proteggi i tuoi appunti del Master con un PIN e seleziona le schede visibili ai giocatori.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="p-2.5 sm:p-3 rounded-md bg-red-950/40 border border-red-500/50 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab / Contenuto */}
        <div className="space-y-4 py-1 sm:py-2">
          <div className={`grid gap-1 rounded-md bg-stone-900 p-1 border border-stone-800 text-[11px] sm:text-xs font-medium ${
            configured ? 'grid-cols-2' : 'grid-cols-1'
          }`}>
            {configured && (
              <button
                type="button"
                onClick={() => { setActiveTab('manage'); setErrorMsg(null); }}
                className={`py-1.5 px-1 sm:px-2 text-center rounded transition-colors truncate ${
                  activeTab === 'manage' ? 'bg-amber-600/30 text-amber-200 font-semibold shadow-sm' : 'text-stone-400 hover:text-amber-200'
                }`}
              >
                Stato & Timer
              </button>
            )}
            <button
              type="button"
              onClick={() => { setActiveTab('setup'); setErrorMsg(null); }}
              className={`py-1.5 px-1 sm:px-2 text-center rounded transition-colors truncate ${
                activeTab === 'setup' ? 'bg-amber-600/30 text-amber-200 font-semibold shadow-sm' : 'text-stone-400 hover:text-amber-200'
              }`}
            >
              {configured ? 'PIN & Recupero' : 'Configura PIN'}
            </button>
          </div>

          {/* Modalità Gestione Stato & Timer (quando già configurato) */}
          {configured && activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-sm font-semibold text-emerald-300">Protezione Attiva</span>
                </div>
                <span className="text-xs text-stone-400">PIN a 4 cifre</span>
              </div>

              {/* Timer di Blocco Automatico */}
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-300 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-amber-400" />
                  Blocco automatico per inattività (Tablet / PC):
                </Label>
                <Select value={autoLockMin} onValueChange={handleUpdateAutoLockOnly}>
                  <SelectTrigger className="bg-stone-900 border-stone-800 text-amber-100 text-xs h-10">
                    <SelectValue placeholder="Seleziona tempo" />
                  </SelectTrigger>
                  <SelectContent className="bg-stone-900 border-stone-800 text-amber-100 text-xs">
                    <SelectItem value="0">Disabilitato (solo blocco manuale)</SelectItem>
                    <SelectItem value="1">Dopo 1 minuto di inattività</SelectItem>
                    <SelectItem value="3">Dopo 3 minuti di inattività</SelectItem>
                    <SelectItem value="5">Dopo 5 minuti di inattività</SelectItem>
                    <SelectItem value="10">Dopo 10 minuti di inattività</SelectItem>
                    <SelectItem value="15">Dopo 15 minuti di inattività</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-stone-500 italic">
                  Se abilitato, blocca automaticamente lo schermo se il tablet non rileva tocchi.
                </p>
              </div>

              {/* Rimozione Protezione */}
              <div className="pt-3 border-t border-stone-800">
                {!removeConfirmOpen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRemoveConfirmOpen(true)}
                    className="w-full text-xs text-red-400 hover:text-red-300 border-red-900/40 hover:bg-red-950/30 gap-2 h-9"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Disattiva protezione con PIN
                  </Button>
                ) : (
                  <div className="p-3 rounded-lg border border-red-900/60 bg-red-950/30 space-y-3">
                    <p className="text-xs text-red-300 font-medium">
                      Conferma disattivazione: inserisci il PIN attuale o la Password:
                    </p>
                    <div className="relative">
                      <Input
                        type={showCurrentSecret ? 'text' : 'password'}
                        placeholder="PIN o Password attuale..."
                        value={currentSecret}
                        onChange={(e) => setCurrentSecret(e.target.value)}
                        className="h-9 bg-stone-900 border-red-900/60 text-amber-100 pr-9 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentSecret(!showCurrentSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-amber-200"
                      >
                        {showCurrentSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setRemoveConfirmOpen(false); setCurrentSecret(''); }}
                        className="flex-1 text-xs h-8 text-stone-400 hover:text-stone-200"
                      >
                        Annulla
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleRemoveProtection}
                        className="flex-1 text-xs h-8 font-bold"
                      >
                        Rimuovi PIN
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modalità Setup / Cambio PIN & Password */}
          {(!configured || activeTab === 'setup') && (
            <div className="space-y-3.5">
              {configured && (
                <div className="space-y-1 pb-2 border-b border-stone-800">
                  <Label className="text-xs text-stone-300">PIN o Password Attuale:</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentSecret ? 'text' : 'password'}
                      placeholder="Richiesto per autorizzare..."
                      value={currentSecret}
                      onChange={(e) => setCurrentSecret(e.target.value)}
                      className="h-9 bg-stone-900 border-stone-800 text-amber-100 pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentSecret(!showCurrentSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-amber-200"
                    >
                      {showCurrentSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Nuovo PIN */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-stone-300">Nuovo PIN (4 cifre):</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Es. 1234"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="h-9 bg-stone-900 border-stone-800 text-amber-100 text-center tracking-widest text-base font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-stone-300">Conferma PIN:</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Conferma"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="h-9 bg-stone-900 border-stone-800 text-amber-100 text-center tracking-widest text-base font-mono font-bold"
                  />
                </div>
              </div>

              {/* Password di Sicurezza (Salvagente) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-stone-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Password di Recupero:
                  </Label>
                  <span className="text-[10px] text-amber-400/80">Salvagente se scordi il PIN</span>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Es. drago_rosso_99"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 bg-stone-900 border-stone-800 text-amber-100 pr-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-amber-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500 italic">
                  Usata esclusivamente se dimentichi il PIN al tavolo per sbloccare l'app.
                </p>
              </div>

              {!configured && (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs text-stone-300 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    Blocco automatico per inattività:
                  </Label>
                  <Select value={autoLockMin} onValueChange={setAutoLockMin}>
                    <SelectTrigger className="bg-stone-900 border-stone-800 text-amber-100 text-xs h-9">
                      <SelectValue placeholder="Seleziona tempo" />
                    </SelectTrigger>
                    <SelectContent className="bg-stone-900 border-stone-800 text-amber-100 text-xs">
                      <SelectItem value="0">Disabilitato (solo blocco manuale)</SelectItem>
                      <SelectItem value="1">Dopo 1 minuto di inattività</SelectItem>
                      <SelectItem value="3">Dopo 3 minuti di inattività</SelectItem>
                      <SelectItem value="5">Dopo 5 minuti di inattività</SelectItem>
                      <SelectItem value="10">Dopo 10 minuti di inattività</SelectItem>
                      <SelectItem value="15">Dopo 15 minuti di inattività</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter className="pt-3">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="text-stone-400 hover:text-amber-200 text-xs"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleSaveSetup}
                  className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Salva Configurazione
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
