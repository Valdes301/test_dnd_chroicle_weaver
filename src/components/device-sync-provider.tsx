'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { registerDeviceAction } from '@/lib/actions';
import { syncFromDatabase } from '@/lib/pin-storage';
import { ShieldAlert, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { useToast } from '@/hooks/use-toast';

interface DeviceSyncContextProps {
  deviceId: string;
  deviceName: string;
  isBlocked: boolean;
  setDeviceName: (name: string) => void;
  syncDevice: () => Promise<void>;
}

const DeviceSyncContext = createContext<DeviceSyncContextProps | null>(null);

export function useDeviceSync() {
  const context = useContext(DeviceSyncContext);
  if (!context) {
    throw new Error('useDeviceSync must be used within a DeviceSyncProvider');
  }
  return context;
}

export function DeviceSyncProvider({ children, campaignId }: { children: React.ReactNode, campaignId?: string }) {
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceNameState] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let id = localStorage.getItem('dnd_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString().slice(-4);
      localStorage.setItem('dnd_device_id', id);
    }
    setDeviceId(id);

    let name = localStorage.getItem('dnd_device_name');
    if (!name) {
      let defaultName = 'Desktop PC';
      if (/iPad/.test(navigator.userAgent)) {
        defaultName = 'iPad';
      } else if (/iPhone/.test(navigator.userAgent)) {
        defaultName = 'iPhone';
      } else if (/Android/.test(navigator.userAgent)) {
        defaultName = 'Android';
      } else if (/Mobi/i.test(navigator.userAgent)) {
        defaultName = 'Mobile';
      }
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      name = `${defaultName} #${randomCode}`;
      localStorage.setItem('dnd_device_name', name);
    }
    setDeviceNameState(name);
    setNewNameInput(name);

    // Gestione automatica del disallineamento Server Action in caso di nuovo deployment
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event?.reason?.message || String(event?.reason || '');
      if (
        msg.includes('Failed to find Server Action') || 
        msg.includes('older or newer deployment') ||
        msg.includes('An unexpected response was received from the server')
      ) {
        console.warn('Server Action mismatch detected, auto-reloading page...');
        const lastReload = sessionStorage.getItem('last_action_reload');
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem('last_action_reload', now.toString());
          window.location.reload();
        }
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const changeDeviceName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('dnd_device_name', trimmed);
    setDeviceNameState(trimmed);
    setIsEditingName(false);
    toast({ title: 'Nome Dispositivo Aggiornato', description: `Il dispositivo ora si chiama "${trimmed}"` });
    syncDevice();
  };

  const isSyncingRef = React.useRef(false);

  const syncDevice = async (explicitMode?: 'master' | 'player') => {
    if (!deviceId || !deviceName || isSyncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isSyncingRef.current = true;
    try {
      const res = await registerDeviceAction(deviceId, deviceName, campaignId, undefined, undefined, explicitMode);
      if (res && res.success && res.data) {
        const { device, systemSettings, effective_blocked_views } = res.data;
        
        // 1. Sincronizza PIN Master e impostazioni globali dal DB nel localStorage
        if (systemSettings) {
          syncFromDatabase(systemSettings);
        }

        // 2. Salva le viste effettive calcolate dal DB specificamente per questo dispositivo
        if (effective_blocked_views) {
          localStorage.setItem('dnd_device_blocked_views', JSON.stringify(effective_blocked_views));
        }
        localStorage.setItem('dnd_device_blocked_npcs', device.blocked_npcs || '[]');
        localStorage.setItem('dnd_device_blocked_locations', device.blocked_locations || '[]');
        localStorage.setItem('dnd_device_use_custom', device.use_custom_views ? 'true' : 'false');
        
        const nowBlocked = Boolean(device.is_blocked);
        setIsBlocked(nowBlocked);
        localStorage.setItem('dnd_device_is_blocked', nowBlocked ? 'true' : 'false');

        // 3. Allinea lo stato locale di playerMode al ruolo definito nel database dal DM
        const serverIsPlayer = device.mode === 'player';
        localStorage.setItem('dnd_device_last_mode', device.mode);
        
        const currentLocalIsPlayer = localStorage.getItem('dnd_master_is_player_mode') !== 'false';

        if (currentLocalIsPlayer !== serverIsPlayer) {
          localStorage.setItem('dnd_master_is_player_mode', serverIsPlayer ? 'true' : 'false');
          window.dispatchEvent(new CustomEvent('dnd-player-mode-changed', { 
            detail: { isPlayerMode: serverIsPlayer } 
          }));
        }

        window.dispatchEvent(new CustomEvent('dnd-blocked-views-changed', { 
          detail: { blockedViews: effective_blocked_views || [] } 
        }));
        window.dispatchEvent(new CustomEvent('dnd-device-config-changed', { detail: device }));
      }
    } catch {
      // Ignora errori di rete transitori durante il polling in background
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!deviceId || !deviceName) return;
    
    syncDevice();

    const handlePlayerModeEvent = (e: any) => {
      const isPlayer = e.detail?.isPlayerMode;
      if (typeof isPlayer === 'boolean') {
        syncDevice(isPlayer ? 'player' : 'master');
      }
    };

    window.addEventListener('dnd-player-mode-changed', handlePlayerModeEvent);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      syncDevice();
    }, 10000);

    return () => {
      window.removeEventListener('dnd-player-mode-changed', handlePlayerModeEvent);
      clearInterval(interval);
    };
  }, [deviceId, deviceName, campaignId]);

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/30 bg-card shadow-2xl text-center p-6 space-y-6">
          <CardHeader className="space-y-2 pb-2">
            <div className="mx-auto bg-destructive/10 text-destructive p-4 rounded-full w-16 h-16 flex items-center justify-center animate-bounce">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <CardTitle className="font-serif text-2xl text-foreground">Dispositivo Sospeso</CardTitle>
            <CardDescription className="text-muted-foreground">
              Il Master ha temporaneamente sospeso l'accesso di questo dispositivo alla sessione di gioco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground italic">
              "Il tuo destino è nelle mani del narratore... Attendi che lo schermo venga sbloccato."
            </p>
            <div className="flex flex-col gap-2 pt-2 text-xs text-muted-foreground/60 border-t border-muted">
              <div className="flex items-center justify-between">
                <span>Dispositivo:</span>
                <span className="font-semibold text-foreground/80">{deviceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>ID:</span>
                <span className="font-mono text-[10px]">{deviceId}</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={syncDevice}
              className="w-full mt-4 gap-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 animate-spin" /> Verifica Sblocco
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DeviceSyncContext.Provider value={{ deviceId, deviceName, isBlocked, setDeviceName: changeDeviceName, syncDevice }}>
      {children}
      
      {deviceId && (
        <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-xs border border-muted py-1 px-2.5 rounded-full shadow-xs text-[10px]">
          <Smartphone className="h-3 w-3 text-muted-foreground" />
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') changeDeviceName(newNameInput);
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                className="bg-transparent border-b border-primary/40 focus:outline-hidden text-[10px] w-24 text-foreground py-0"
                autoFocus
              />
              <button onClick={() => changeDeviceName(newNameInput)} className="text-emerald-500 font-bold">✓</button>
              <button onClick={() => setIsEditingName(false)} className="text-destructive font-bold">✗</button>
            </div>
          ) : (
            <span 
              onClick={() => setIsEditingName(true)} 
              className="cursor-pointer font-medium hover:text-primary transition-colors flex items-center gap-1"
              title="Clicca per rinominare questo dispositivo"
            >
              {deviceName} <span className="opacity-40">✏️</span>
            </span>
          )}
        </div>
      )}
    </DeviceSyncContext.Provider>
  );
}
