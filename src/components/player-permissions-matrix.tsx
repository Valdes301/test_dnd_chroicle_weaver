'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  RotateCcw,
  CheckCheck,
  XCircle,
  Users,
  Sparkles,
  BookOpen,
  Layers,
  Settings,
  AlertCircle,
  Smartphone,
  Laptop,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Activity,
  Wifi,
  User,
  PlusCircle,
  Search,
  LockOpen,
  Check,
  Crown,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import {
  NAV_SECTIONS,
  DEFAULT_VISIBLE_VIEWS,
  RECOMMENDED_VISIBLE_VIEWS,
  isPlayerMode,
  setPlayerMode,
  getVisibleViews,
  setVisibleViews,
  getBlockedBehavior,
  setBlockedBehavior,
  BlockedBehavior,
  isPinConfigured
} from '@/lib/pin-storage';
import * as actions from '@/lib/actions';
import { Device } from '@/lib/types';

const CATEGORY_META = {
  master: {
    label: 'Master & Campagna',
    icon: Shield,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-500/5',
  },
  creativi: {
    label: 'Strumenti Creativi & AI',
    icon: Sparkles,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/20',
    bgColor: 'bg-purple-500/5',
  },
  manuale: {
    label: 'Manuale & Regole',
    icon: BookOpen,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    bgColor: 'bg-blue-500/5',
  },
  avanzate: {
    label: 'Avanzate & Carte',
    icon: Layers,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    bgColor: 'bg-emerald-500/5',
  },
  sistema: {
    label: 'Sistema & Strumenti',
    icon: Settings,
    color: 'text-stone-400',
    borderColor: 'border-stone-500/20',
    bgColor: 'bg-stone-500/5',
  },
};

export function PlayerPermissionsMatrix({ campaignId }: { campaignId?: string }) {
  const [activeTab, setActiveTab] = useState<'global' | 'devices'>('global');
  const [playerMode, setPlayerModeState] = useState<boolean>(() => isPlayerMode());
  const [visibleViews, setVisibleViewsState] = useState<string[]>(() => getVisibleViews());
  const [behavior, setBehaviorState] = useState<BlockedBehavior>(() => getBlockedBehavior());
  const [pinConfigured, setPinConfigured] = useState<boolean>(() => isPinConfigured());
  const { toast } = useToast();

  // Device states
  const [devices, setDevices] = useState<Device[]>([]);
  const [npcs, setNpcs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState<string | null>(null);
  const [tempDeviceName, setTempDeviceName] = useState<string>('');

  // Search inside device expanders
  const [npcSearch, setNpcSearch] = useState<string>('');
  const [locSearch, setLocSearch] = useState<string>('');
  const lastUserEditTimeRef = React.useRef(0);

  // Tab 1 state synchronization
  useEffect(() => {
    setPlayerModeState(isPlayerMode());
    setVisibleViewsState(getVisibleViews());
    setBehaviorState(getBlockedBehavior());
    setPinConfigured(isPinConfigured());

    const handlePlayerModeChange = (e: any) => {
      setPlayerModeState(Boolean(e.detail?.isPlayerMode));
    };
    const handleVisibleViewsChange = (e: any) => {
      if (Date.now() - lastUserEditTimeRef.current < 15000) {
        return; // Ignore background updates during or right after user edits
      }
      setVisibleViewsState(e.detail?.visibleViews || getVisibleViews());
    };
    const handleBehaviorChange = (e: any) => {
      setBehaviorState(e.detail?.behavior || 'hide');
    };
    const handlePinChange = () => {
      setPinConfigured(isPinConfigured());
    };

    window.addEventListener('dnd-player-mode-changed', handlePlayerModeChange);
    window.addEventListener('dnd-visible-views-changed', handleVisibleViewsChange);
    window.addEventListener('dnd-blocked-views-changed', handleVisibleViewsChange);
    window.addEventListener('dnd-blocked-behavior-changed', handleBehaviorChange);
    window.addEventListener('dnd-pin-config-changed', handlePinChange);

    return () => {
      window.removeEventListener('dnd-player-mode-changed', handlePlayerModeChange);
      window.removeEventListener('dnd-visible-views-changed', handleVisibleViewsChange);
      window.removeEventListener('dnd-blocked-views-changed', handleVisibleViewsChange);
      window.removeEventListener('dnd-blocked-behavior-changed', handleBehaviorChange);
      window.removeEventListener('dnd-pin-config-changed', handlePinChange);
    };
  }, []);

  // Polling devices & single fetch for items
  useEffect(() => {
    if (!campaignId) return;

    // Fetch NPCs & locations once
    const fetchAssets = async () => {
      const npcRes = await actions.getCampaignNpcsAction(campaignId);
      if (npcRes.success && npcRes.data) {
        setNpcs(npcRes.data);
      }
      const locRes = await actions.getWorldLocationsAction(campaignId);
      if (locRes.success && locRes.data) {
        setLocations(locRes.data);
      }
    };
    fetchAssets();

    // Fetch devices initially
    const fetchDevices = async () => {
      const devRes = await actions.getDevicesAction(campaignId);
      if (devRes.success && devRes.data) {
        setDevices(devRes.data);
      }
    };
    fetchDevices();

    // Polling every 4 seconds
    const interval = setInterval(fetchDevices, 4000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const handleTogglePlayerMode = (enabled: boolean) => {
    setPlayerMode(enabled);
    setPlayerModeState(enabled);
    toast({
      title: enabled ? "Modalità Giocatore Attivata" : "Modalità Dungeon Master Attivata",
      description: enabled
        ? `Le schede contrassegnate (${blockedViews.length}) sono ora protette per i giocatori.`
        : "Accesso completo ripristinato a tutte le schede e strumenti del DM.",
    });
  };

  const handleToggleSection = (id: string) => {
    lastUserEditTimeRef.current = Date.now();
    const next = visibleViews.includes(id)
      ? visibleViews.filter(v => v !== id)
      : [...visibleViews, id];
    setVisibleViews(next);
    setVisibleViewsState(next);
  };

  const handleResetDefault = () => {
    lastUserEditTimeRef.current = Date.now();
    setVisibleViews(RECOMMENDED_VISIBLE_VIEWS);
    setVisibleViewsState(RECOMMENDED_VISIBLE_VIEWS);
    toast({
      title: "Preset Consigliato DM Applicato",
      description: "Sono state rese visibili le schede standard per i giocatori.",
    });
  };

  const handleSelectAll = () => {
    lastUserEditTimeRef.current = Date.now();
    const allIds = NAV_SECTIONS.map(s => s.id);
    setVisibleViews(allIds);
    setVisibleViewsState(allIds);
  };

  const handleDeselectAll = () => {
    lastUserEditTimeRef.current = Date.now();
    setVisibleViews([]);
    setVisibleViewsState([]);
  };

  const handleApplyGlobalPermissions = async () => {
    lastUserEditTimeRef.current = Date.now();
    setVisibleViews(visibleViews);
    try {
      await actions.saveSystemSetting('visible_views', JSON.stringify(visibleViews));
      toast({
        title: "Modifiche Applicate con Successo",
        description: `La schermata giocatore è stata aggiornata con ${visibleViews.length} schede visibili.`,
      });
      window.dispatchEvent(new CustomEvent('dnd-visible-views-changed', { detail: { visibleViews } }));
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: "Errore di salvataggio", description: "Impossibile salvare i permessi sul database." });
    }
  };

  const handleCategoryToggle = (category: keyof typeof CATEGORY_META) => {
    lastUserEditTimeRef.current = Date.now();
    const categorySections = NAV_SECTIONS.filter(s => s.category === category);
    const categoryIds = categorySections.map(s => s.id);
    const allCategoryVisible = categoryIds.every(id => visibleViews.includes(id));

    let next: string[];
    if (allCategoryVisible) {
      next = visibleViews.filter(id => !categoryIds.includes(id));
    } else {
      next = Array.from(new Set([...visibleViews, ...categoryIds]));
    }
    setVisibleViews(next);
    setVisibleViewsState(next);
  };

  const handleBehaviorChange = (newBehavior: BlockedBehavior) => {
    setBlockedBehavior(newBehavior);
    setBehaviorState(newBehavior);
    toast({
      title: "Comportamento Aggiornato",
      description: newBehavior === 'hide'
        ? "Le schede protette spariranno completamente dal menu in Modalità Giocatore."
        : "Le schede protette mostreranno un lucchetto e richiederanno il PIN per l'apertura.",
    });
  };

  const sectionsByCategory = useMemo(() => {
    const grouped: Record<string, typeof NAV_SECTIONS> = {};
    Object.keys(CATEGORY_META).forEach(cat => {
      grouped[cat] = NAV_SECTIONS.filter(s => s.category === cat);
    });
    return grouped;
  }, []);

  // Device Matrix Helpers
  const isOnline = (updatedAtStr: string) => {
    const lastActive = new Date(updatedAtStr).getTime();
    const diff = Date.now() - lastActive;
    return diff < 12000; // active in last 12 seconds
  };

  const handleUpdateDeviceConfig = async (deviceId: string, updates: Partial<Device>) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, ...updates } as Device : d));
    const res = await actions.updateDeviceConfigAction(deviceId, updates);
    if (!res.success) {
      toast({ variant: 'destructive', title: 'Errore', description: res.error });
      const devRes = await actions.getDevicesAction(campaignId || '');
      if (devRes.success && devRes.data) setDevices(devRes.data);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    const res = await actions.deleteDeviceAction(deviceId);
    if (res.success) {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      if (expandedDevice === deviceId) setExpandedDevice(null);
      toast({ title: 'Dispositivo rimosso con successo' });
    } else {
      toast({ variant: 'destructive', title: 'Errore', description: res.error });
    }
  };

  const startEditingName = (device: Device) => {
    setEditingDeviceName(device.id);
    setTempDeviceName(device.name);
  };

  const saveDeviceName = async (deviceId: string) => {
    if (!tempDeviceName.trim()) return;
    await handleUpdateDeviceConfig(deviceId, { name: tempDeviceName.trim() });
    setEditingDeviceName(null);
  };

  const handleSetDeviceRole = async (device: Device, role: 'master' | 'player' | 'isola') => {
    setDevices(prev => prev.map(d => {
      if (d.id !== device.id) return d;
      if (role === 'master') return { ...d, mode: 'master', is_blocked: 0 };
      if (role === 'player') return { ...d, mode: 'player', is_blocked: 0 };
      if (role === 'isola') return { ...d, is_blocked: 1 };
      return d;
    }));

    const res = await actions.setDeviceRoleAction(device.id, role);
    if (!res.success) {
      toast({ variant: 'destructive', title: 'Errore', description: res.error });
      const devRes = await actions.getDevicesAction(campaignId || '');
      if (devRes.success && devRes.data) setDevices(devRes.data);
    } else {
      toast({ 
        title: role === 'master' ? 'Ruolo Master Assegnato' : role === 'player' ? 'Ruolo Giocatore Assegnato' : 'Dispositivo Isolato',
        description: `Il dispositivo "${device.name}" è ora configurato come ${role.toUpperCase()}.`
      });
    }
  };

  const handleToggleCustomViews = async (device: Device, enabled: boolean) => {
    const updates: Partial<Device> = {
      use_custom_views: enabled ? 1 : 0,
    };
    if (enabled && (!device.blocked_views || device.blocked_views === '[]')) {
      updates.blocked_views = JSON.stringify(blockedViews);
    }
    await handleUpdateDeviceConfig(device.id, updates);
    toast({
      title: enabled ? "Permessi Personalizzati Attivati" : "Sincronizzazione Globale Ripristinata",
      description: enabled
        ? `Ora puoi scegliere sezioni specifiche per "${device.name}".`
        : `"${device.name}" ora riceve automaticamente i permessi dalla Pulsantiera Globale.`
    });
  };

  const handleToggleDeviceView = (device: Device, viewId: string) => {
    let currentBlocked: string[] = [];
    try {
      currentBlocked = JSON.parse(device.blocked_views || '[]');
    } catch {}

    const nextBlocked = currentBlocked.includes(viewId)
      ? currentBlocked.filter(v => v !== viewId)
      : [...currentBlocked, viewId];

    handleUpdateDeviceConfig(device.id, { blocked_views: JSON.stringify(nextBlocked) });
  };

  const handleSelectAllDeviceViews = (device: Device) => {
    const allIds = NAV_SECTIONS.map(s => s.id);
    handleUpdateDeviceConfig(device.id, { blocked_views: JSON.stringify(allIds) });
  };

  const handleDeselectAllDeviceViews = (device: Device) => {
    handleUpdateDeviceConfig(device.id, { blocked_views: '[]' });
  };

  const handleToggleDeviceNpc = (device: Device, npcId: string) => {
    let currentBlocked: string[] = [];
    try {
      currentBlocked = JSON.parse(device.blocked_npcs || '[]');
    } catch {}

    const nextBlocked = currentBlocked.includes(npcId)
      ? currentBlocked.filter(id => id !== npcId)
      : [...currentBlocked, npcId];

    handleUpdateDeviceConfig(device.id, { blocked_npcs: JSON.stringify(nextBlocked) });
  };

  const handleToggleDeviceLocation = (device: Device, locId: string) => {
    let currentBlocked: string[] = [];
    try {
      currentBlocked = JSON.parse(device.blocked_locations || '[]');
    } catch {}

    const nextBlocked = currentBlocked.includes(locId)
      ? currentBlocked.filter(id => id !== locId)
      : [...currentBlocked, locId];

    handleUpdateDeviceConfig(device.id, { blocked_locations: JSON.stringify(nextBlocked) });
  };

  return (
    <Card className="border-amber-500/30 bg-stone-900/60 shadow-xl overflow-hidden w-full max-w-full">
      <CardHeader className="border-b border-stone-800 bg-stone-950/50 p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <CardTitle className="text-sm sm:text-base font-serif tracking-wide text-amber-200 uppercase leading-snug">
                Pannello Sicurezza &amp; Dispositivi Live
              </CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-stone-400 leading-relaxed">
              Configura restrizioni globali o gestisci i singoli tablet, smartphone e computer connessi in tempo reale.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Tab Selector */}
      <div className="flex border-b border-stone-800 bg-stone-950/40">
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 py-3 text-center text-xs uppercase font-serif tracking-widest font-bold transition-all border-b-2 ${
            activeTab === 'global'
              ? 'border-amber-500 text-amber-300 bg-amber-500/5'
              : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
          }`}
        >
          Pulsantiera Globale
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`flex-1 py-3 text-center text-xs uppercase font-serif tracking-widest font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
            activeTab === 'devices'
              ? 'border-amber-500 text-amber-300 bg-amber-500/5'
              : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>Dispositivi Connessi</span>
          {devices.length > 0 && (
            <Badge className="bg-amber-600 text-[10px] py-0 px-1.5 h-4 text-stone-100 font-sans">
              {devices.length}
            </Badge>
          )}
        </button>
      </div>

      <CardContent className="p-3 sm:p-5 space-y-4 sm:space-y-6 pt-4">
        {activeTab === 'global' ? (
          <>
            {/* UNIFIED NOTICE BANNER */}
            <div className="text-xs text-stone-300 bg-stone-900/90 border border-stone-800 p-3 rounded-lg flex items-start gap-2.5 leading-relaxed">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-stone-200">Regole Predefinite per tutti i Giocatori:</span>
                <p className="text-[11px] text-stone-400">
                  Le sezioni selezionate qui sotto vengono applicate automaticamente a tutti i dispositivi dei giocatori. Se desideri autorizzare o oscurare schede per un giocatore specifico (senza toccare gli altri), apri la scheda <strong className="text-amber-300">&quot;Dispositivi Connessi&quot;</strong> ed espandi il singolo dispositivo.
                </p>
              </div>
            </div>

            {/* COMPONENT PERMISSIONS MATRIX - ORIGINAL GLOBAL */}
            <div className="flex items-center justify-between gap-3 bg-stone-900/80 border border-stone-800 rounded-lg p-3">
              <div>
                <div className="text-xs font-semibold text-stone-200">
                  {playerMode ? "Modalità Giocatore Attiva" : "Modalità Dungeon Master (Sbloccata)"}
                </div>
                <div className="text-[10px] text-stone-400">
                  {playerMode ? "Questo schermo locale ha le restrizioni attive" : "Accesso completo su questo schermo"}
                </div>
              </div>
              <Switch
                checked={playerMode}
                onCheckedChange={handleTogglePlayerMode}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>

            {/* Barra di Stato e Contatore Schede */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-stone-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`h-6 text-[10px] sm:text-[11px] px-2 gap-1.5 ${
                    playerMode
                      ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                  }`}
                >
                  {playerMode ? <Users className="w-3 h-3 shrink-0" /> : <Shield className="w-3 h-3 shrink-0" />}
                  <span className="truncate">{playerMode ? "Vista Giocatori" : "Dungeon Master"}</span>
                </Badge>

                <Badge variant="secondary" className="h-6 text-[10px] sm:text-[11px] px-2 gap-1 bg-stone-800 text-stone-300">
                  <Eye className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span><strong className="text-emerald-300">{visibleViews.length}</strong>/{NAV_SECTIONS.length} visibili</span>
                </Badge>
              </div>

              <div className="grid grid-cols-3 sm:flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto font-sans">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDefault}
                  className="h-7 text-[10px] uppercase font-bold border-amber-500/30 text-amber-300 hover:bg-amber-950/30 gap-1 px-1.5 truncate justify-center"
                >
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  <span className="truncate">Preset DM</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-7 text-[10px] uppercase font-bold text-stone-400 hover:text-stone-200 gap-1 px-1.5 truncate justify-center"
                >
                  <CheckCheck className="w-3 h-3 shrink-0" />
                  <span className="truncate">Tutte</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="h-7 text-[10px] uppercase font-bold text-stone-400 hover:text-stone-200 gap-1 px-1.5 truncate justify-center"
                >
                  <XCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">Nessuna</span>
                </Button>
              </div>
            </div>

            {/* Scelta del comportamento delle schede protette */}
            <div className="p-2.5 sm:p-3.5 rounded-lg bg-stone-950/40 border border-stone-800 space-y-2">
              <Label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Comportamento per le Schede Protette:
              </Label>
              <RadioGroup
                value={behavior}
                onValueChange={(v) => handleBehaviorChange(v as BlockedBehavior)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
              >
                <div
                  onClick={() => handleBehaviorChange('hide')}
                  className={`flex items-start gap-2.5 p-2.5 sm:p-3 rounded-md border cursor-pointer transition-colors ${
                    behavior === 'hide'
                      ? 'border-amber-500/50 bg-amber-950/20'
                      : 'border-stone-800 bg-stone-900/40 hover:bg-stone-900'
                  }`}
                >
                  <RadioGroupItem value="hide" id="behavior-hide" className="mt-0.5 shrink-0" />
                  <div className="space-y-0.5 min-w-0">
                    <Label htmlFor="behavior-hide" className="text-xs font-semibold text-stone-200 cursor-pointer flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Nascondi Completamente
                    </Label>
                    <p className="text-[10px] sm:text-[11px] text-stone-400 leading-tight">
                      Le schede contrassegnate non appaiono nel menu.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => handleBehaviorChange('pin')}
                  className={`flex items-start gap-2.5 p-2.5 sm:p-3 rounded-md border cursor-pointer transition-colors ${
                    behavior === 'pin'
                      ? 'border-amber-500/50 bg-amber-950/20'
                      : 'border-stone-800 bg-stone-900/40 hover:bg-stone-900'
                  }`}
                >
                  <RadioGroupItem value="pin" id="behavior-pin" className="mt-0.5 shrink-0" />
                  <div className="space-y-0.5 min-w-0">
                    <Label htmlFor="behavior-pin" className="text-xs font-semibold text-stone-200 cursor-pointer flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Mostra con Lucchetto e PIN
                    </Label>
                    <p className="text-[10px] sm:text-[11px] text-stone-400 leading-tight">
                      Le schede restano visibili ma richiedono il PIN.
                    </p>
                  </div>
                </div>
              </RadioGroup>
              {!pinConfigured && behavior === 'pin' && (
                <div className="flex items-center gap-2 text-[11px] text-amber-400/90 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Attenzione: Non hai ancora impostato un PIN. Configuralo sopra per proteggere le sezioni.</span>
                </div>
              )}
            </div>

            {/* Griglia delle Sezioni raggruppate per Categoria */}
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(sectionsByCategory).map(([catKey, sections]) => {
                const meta = CATEGORY_META[catKey as keyof typeof CATEGORY_META];
                const Icon = meta.icon;
                const categoryIds = sections.map(s => s.id);
                const allCategoryVisible = categoryIds.every(id => visibleViews.includes(id));

                return (
                  <div key={catKey} className={`rounded-lg border ${meta.borderColor} ${meta.bgColor} p-2.5 sm:p-3.5 space-y-2.5`}>
                    <div className="flex items-center justify-between gap-1.5 border-b border-stone-800/60 pb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${meta.color} shrink-0`} />
                        <span className="font-serif text-[11px] sm:text-xs uppercase tracking-wider font-bold text-stone-200 truncate">
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-stone-400 shrink-0 font-sans">
                          ({sections.filter(s => visibleViews.includes(s.id)).length}/{sections.length} visibili)
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCategoryToggle(catKey as keyof typeof CATEGORY_META)}
                        className="h-6 text-[9px] sm:text-[10px] px-1.5 uppercase tracking-wider text-stone-400 hover:text-stone-200 shrink-0 font-sans"
                      >
                        {allCategoryVisible ? "Oscura Categoria" : "Mostra Categoria"}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sections.map((sec) => {
                        const isVisible = visibleViews.includes(sec.id);
                        return (
                          <div
                            key={sec.id}
                            onClick={() => handleToggleSection(sec.id)}
                            className={`flex items-start gap-2 p-2 sm:p-2.5 rounded-md border cursor-pointer transition-all min-w-0 ${
                              isVisible
                                ? 'bg-emerald-950/20 border-emerald-600/40 shadow-sm'
                                : 'bg-stone-900/40 border-stone-800/80 hover:bg-stone-900 hover:border-stone-700 opacity-60'
                            }`}
                          >
                            <Checkbox
                              id={`perm-${sec.id}`}
                              checked={isVisible}
                              onCheckedChange={() => handleToggleSection(sec.id)}
                              className="mt-0.5 shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <Label
                                  htmlFor={`perm-${sec.id}`}
                                  className="text-xs font-semibold text-stone-200 cursor-pointer truncate"
                                >
                                  {sec.label}
                                </Label>
                                {isVisible ? (
                                  <Badge variant="outline" className="h-4 text-[9px] px-1 border-emerald-500/40 text-emerald-400 gap-0.5 shrink-0 font-sans">
                                    <Eye className="w-2.5 h-2.5" /> Visibile
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="h-4 text-[9px] px-1 text-stone-500 border-stone-800 gap-0.5 shrink-0 font-sans">
                                    <EyeOff className="w-2.5 h-2.5" /> Oscurata
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-[11px] text-stone-400 line-clamp-2 mt-0.5 leading-snug">
                                {sec.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pulsante Applica Modifiche Sincronizzazione Immediata */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleApplyGlobalPermissions}
                className="w-full bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-950 font-serif font-bold text-xs uppercase tracking-wider gap-2 h-11 shadow-lg shadow-amber-950/50 border border-amber-400/50 active:scale-95 transition-transform"
              >
                <CheckCheck className="w-4 h-4 text-stone-950" />
                Applica Modifiche & Sincronizza Schermata Giocatore
              </Button>
            </div>
          </>
        ) : (
          /* TAB 2: CONNECTED DEVICES LIST & DETAILED PERMISSIONS CONTROL */
          <div className="space-y-4">
            <div className="text-xs text-stone-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex flex-col gap-1.5 leading-relaxed">
              <span className="font-serif font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <Wifi className="h-3.5 w-3.5 text-amber-400" /> Fondamenta Sincronizzazione Rete Rilevata (Pronta)
              </span>
              <span>
                <strong>Nota per il DM:</strong> Le basi del database per raggruppare i dispositivi sulla stessa rete (WiFi o Hotspot del Master) sono pronte. Poiché le restrizioni dei browser impediscono la lettura del nome letterale del WiFi (SSID) per motivi di privacy, l&apos;approccio standard prevede il raggruppamento automatico basato sulla corrispondenza dell&apos;<strong>IP Pubblico NAT condiviso</strong> (i dispositivi connessi allo stesso router o hotspot mobile condivideranno lo stesso IP di rete).
              </span>
            </div>

            <div className="text-xs text-stone-400 italic leading-relaxed">
              In questa sezione puoi monitorare e configurare i permessi in tempo reale per ciascun dispositivo che apre l&apos;app. Ideale per nascondere segretamente PNG o intere sezioni solo a determinati giocatori.
            </div>

            {devices.length === 0 ? (
              <div className="p-8 border border-dashed border-stone-800 bg-stone-950/20 rounded-xl text-center text-muted-foreground flex flex-col items-center gap-3">
                <Smartphone className="h-10 w-10 text-stone-600 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-stone-300">Nessun Dispositivo Connesso</p>
                  <p className="text-xs text-stone-500">I dispositivi dei giocatori appariranno qui automaticamente quando apriranno questa campagna.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 font-sans">
                {devices.map((dev) => {
                  const online = isOnline(dev.last_active);
                  const isExpanded = expandedDevice === dev.id;
                  const devUA = dev.userAgent || '';
                  
                  let devViews: string[] = [];
                  let devNpcs: string[] = [];
                  let devLocs: string[] = [];
                  try { devViews = JSON.parse(dev.blocked_views || '[]'); } catch {}
                  try { devNpcs = JSON.parse(dev.blocked_npcs || '[]'); } catch {}
                  try { devLocs = JSON.parse(dev.blocked_locations || '[]'); } catch {}

                  return (
                    <Card key={dev.id} className={`border transition-all overflow-hidden ${
                      online 
                        ? 'border-amber-500/20 bg-stone-900/40 hover:border-amber-500/30' 
                        : 'border-stone-800 bg-stone-950/20 opacity-80'
                    }`}>
                      {/* ACCORDION BAR HEADER */}
                      <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-stone-800 bg-stone-950/20">
                        <div className="flex items-center gap-3 min-w-0">
                          {devUA.toLowerCase().includes('mobile') || devUA.toLowerCase().includes('android') || devUA.toLowerCase().includes('iphone') ? (
                            <Smartphone className="h-5 w-5 text-amber-400 shrink-0" />
                          ) : (
                            <Laptop className="h-5 w-5 text-stone-400 shrink-0" />
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              {editingDeviceName === dev.id ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    value={tempDeviceName}
                                    onChange={(e) => setTempDeviceName(e.target.value)}
                                    className="h-7 w-40 text-xs py-0 px-2 bg-stone-900 border-amber-500/40 text-stone-200"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && saveDeviceName(dev.id)}
                                  />
                                  <Button size="icon" className="h-7 w-7 bg-emerald-600 hover:bg-emerald-500" onClick={() => saveDeviceName(dev.id)}>
                                    <Check className="h-3 w-3 text-stone-100" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="font-serif text-sm font-semibold text-amber-200 truncate">
                                  {dev.name}
                                </span>
                              )}
                              {editingDeviceName !== dev.id && (
                                <button onClick={() => startEditingName(dev)} className="text-stone-500 hover:text-amber-400">
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-stone-500 font-mono truncate max-w-[200px]" title={devUA}>
                                {(devUA.split(' ')[0] || 'Browser')} ({dev.id.substring(0, 8)}...)
                              </span>
                              <Badge className={`h-4 text-[9px] font-sans ${
                                online 
                                  ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300' 
                                  : 'bg-stone-800 border-stone-700 text-stone-400'
                              }`} variant="outline">
                                <Wifi className="h-2.5 w-2.5 mr-1" />
                                {online ? 'Live' : 'Offline'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* STATUS AND 3-ROLE SELECTOR: MASTER, GIOCATORE, ISOLA */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                          {(() => {
                            const currentRole: 'master' | 'player' | 'isola' = Boolean(dev.is_blocked) 
                              ? 'isola' 
                              : (dev.mode === 'master' ? 'master' : 'player');

                            return (
                              <div className="inline-flex rounded-lg border border-stone-800 bg-stone-950 p-0.5 gap-0.5 shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => handleSetDeviceRole(dev, 'master')}
                                  className={`px-2 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                                    currentRole === 'master'
                                      ? 'bg-amber-600 text-stone-950 font-bold shadow-xs'
                                      : 'text-stone-400 hover:text-amber-300 hover:bg-stone-900'
                                  }`}
                                  title="Ruolo Master: accesso completo alle note e strumenti DM"
                                >
                                  <Crown className="w-3.5 h-3.5" />
                                  <span>Master</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetDeviceRole(dev, 'player')}
                                  className={`px-2 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                                    currentRole === 'player'
                                      ? 'bg-emerald-600 text-stone-950 font-bold shadow-xs'
                                      : 'text-stone-400 hover:text-emerald-300 hover:bg-stone-900'
                                  }`}
                                  title="Ruolo Giocatore: sezioni limitate e spoiler protetti"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>Giocatore</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetDeviceRole(dev, 'isola')}
                                  className={`px-2 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                                    currentRole === 'isola'
                                      ? 'bg-red-600 text-stone-100 font-bold shadow-xs'
                                      : 'text-stone-400 hover:text-red-400 hover:bg-stone-900'
                                  }`}
                                  title="Isola: blocca lo schermo del dispositivo"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  <span>Isola</span>
                                </button>
                              </div>
                            );
                          })()}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-stone-400 hover:text-white"
                            onClick={() => setExpandedDevice(isExpanded ? null : dev.id)}
                            title={isExpanded ? "Comprimi dettagli" : "Espandi per configurare"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-stone-500 hover:text-red-400"
                            onClick={() => handleDeleteDevice(dev.id)}
                            title="Elimina dispositivo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* EXPANDED CONTENT: CUSTOM SECTION, PNG, MAP DETAILS */}
                      {isExpanded && (
                        <div className="p-4 border-t border-stone-800/80 space-y-6 bg-stone-950/20 transition-all">
                          {dev.is_blocked ? (
                            <div className="p-4 border border-red-500/30 bg-red-950/10 text-red-400 rounded-lg flex items-center gap-3 text-xs leading-relaxed">
                              <Lock className="h-5 w-5 shrink-0" />
                              <div>
                                <span className="font-bold">Dispositivo Isolato:</span> Attualmente questo dispositivo ha lo schermo bloccato con un messaggio d&apos;attesa del DM. Nessuno strumento è accessibile. Clicca &quot;Giocatore&quot; o &quot;Master&quot; sopra per ripristinare.
                              </div>
                            </div>
                          ) : dev.mode === 'master' ? (
                            <div className="p-4 border border-emerald-500/30 bg-emerald-950/10 text-emerald-400 rounded-lg flex items-center gap-3 text-xs leading-relaxed">
                              <LockOpen className="h-5 w-5 shrink-0" />
                              <div>
                                <span className="font-bold">Ruolo Master:</span> Questo dispositivo ha pieni privilegi di Dungeon Master. Ha accesso a tutti i contenuti segreti, note, e strumenti del DM.
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* SEZIONE 1: GLOBAL VS CUSTOM UNIFICATION */}
                              <div className="space-y-3">
                                {dev.use_custom_views ? (
                                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[10px]">
                                          Permessi Personalizzati Attivi
                                        </Badge>
                                        <span className="text-xs text-amber-200 font-medium">Regole specifiche per questo dispositivo</span>
                                      </div>
                                      <p className="text-[11px] text-stone-400">
                                        Le sezioni selezionate sotto sovrascrivono la Pulsantiera Globale per questo giocatore.
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleToggleCustomViews(dev, false)}
                                      className="text-xs text-stone-300 hover:text-white hover:bg-stone-800/60 shrink-0 h-8 gap-1.5"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Segui Pulsantiera Globale
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="p-3 rounded-lg border border-stone-800 bg-stone-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px]">
                                          Sincronizzato con Pulsantiera Globale
                                        </Badge>
                                        <span className="text-xs text-stone-300 font-medium">Permessi Standard</span>
                                      </div>
                                      <p className="text-[11px] text-stone-400">
                                        Questo dispositivo riceve automaticamente le sezioni abilitate nella scheda &quot;Pulsantiera Globale&quot;. Nessun conflitto.
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleToggleCustomViews(dev, true)}
                                      className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/30 shrink-0 h-8 gap-1.5"
                                    >
                                      <Sliders className="w-3.5 h-3.5" />
                                      Personalizza per questo Giocatore
                                    </Button>
                                  </div>
                                )}

                                {Boolean(dev.use_custom_views) && (
                                  <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                                      <Label className="text-xs font-serif uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                                        <Layers className="h-4 w-4" /> Sezioni Protette Dedicate ({devViews.length})
                                      </Label>
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => handleSelectAllDeviceViews(dev)} className="text-[10px] text-stone-400 hover:text-stone-200">Oscura Tutte</button>
                                        <span className="text-stone-700">|</span>
                                        <button onClick={() => handleDeselectAllDeviceViews(dev)} className="text-[10px] text-stone-400 hover:text-stone-200">Permetti Tutte</button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {NAV_SECTIONS.map((sec) => {
                                        const isBlocked = devViews.includes(sec.id);
                                        return (
                                          <div
                                            key={sec.id}
                                            onClick={() => handleToggleDeviceView(dev, sec.id)}
                                            className={`p-2 rounded-md border text-xs cursor-pointer flex items-center gap-2 transition-all truncate ${
                                              isBlocked 
                                                ? 'bg-amber-950/30 border-amber-600/50 text-amber-200 font-bold' 
                                                : 'bg-stone-900/40 border-stone-800 text-stone-400 hover:bg-stone-900 hover:border-stone-700'
                                            }`}
                                          >
                                            <Checkbox
                                              id={`dev-${dev.id}-view-${sec.id}`}
                                              checked={isBlocked}
                                              onCheckedChange={() => handleToggleDeviceView(dev, sec.id)}
                                              className="scale-90 data-[state=checked]:bg-amber-600"
                                            />
                                            <span className="truncate">{sec.label}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* SEZIONE 2: BLOCKED NPCS (PNG) FOR DEVICE */}
                              <div className="space-y-3 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-800 pb-1.5 gap-2">
                                  <Label className="text-xs font-serif uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                                    <Users className="h-4 w-4" /> Personaggi (PNG) Oscurati ({devNpcs.length})
                                  </Label>
                                  <div className="relative w-full sm:w-48 h-7">
                                    <Search className="absolute left-2 top-2 h-3 w-3 text-stone-500" />
                                    <Input
                                      value={npcSearch}
                                      onChange={(e) => setNpcSearch(e.target.value)}
                                      placeholder="Cerca PNG..."
                                      className="h-7 pl-7 text-[11px] bg-stone-900 border-stone-800 text-stone-300"
                                    />
                                  </div>
                                </div>
                                {npcs.length === 0 ? (
                                  <p className="text-[10px] text-stone-500 italic">Crea dei personaggi nel modulo PNG per poterli bloccare singolarmente.</p>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                                    {npcs
                                      .filter(n => n.name.toLowerCase().includes(npcSearch.toLowerCase()))
                                      .map((npc) => {
                                        const isBlocked = devNpcs.includes(npc.id);
                                        return (
                                          <div
                                            key={npc.id}
                                            onClick={() => handleToggleDeviceNpc(dev, npc.id)}
                                            className={`p-2 rounded-md border text-xs cursor-pointer flex items-center gap-2 transition-all truncate ${
                                              isBlocked 
                                                ? 'bg-amber-950/30 border-amber-600/50 text-amber-200 font-bold' 
                                                : 'bg-stone-900/40 border-stone-800 text-stone-400 hover:bg-stone-900 hover:border-stone-700'
                                            }`}
                                          >
                                            <Checkbox
                                              id={`dev-${dev.id}-npc-${npc.id}`}
                                              checked={isBlocked}
                                              onCheckedChange={() => handleToggleDeviceNpc(dev, npc.id)}
                                              className="scale-90 data-[state=checked]:bg-amber-600"
                                            />
                                            <span className="truncate">{npc.name}</span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>

                              {/* SEZIONE 3: BLOCKED LOCATIONS FOR DEVICE */}
                              <div className="space-y-3 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-800 pb-1.5 gap-2">
                                  <Label className="text-xs font-serif uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                                    <BookOpen className="h-4 w-4" /> Luoghi della Mappa Oscurati ({devLocs.length})
                                  </Label>
                                  <div className="relative w-full sm:w-48 h-7">
                                    <Search className="absolute left-2 top-2 h-3 w-3 text-stone-500" />
                                    <Input
                                      value={locSearch}
                                      onChange={(e) => setLocSearch(e.target.value)}
                                      placeholder="Cerca Luoghi..."
                                      className="h-7 pl-7 text-[11px] bg-stone-900 border-stone-800 text-stone-300"
                                    />
                                  </div>
                                </div>
                                {locations.length === 0 ? (
                                  <p className="text-[10px] text-stone-500 italic">Genera dei luoghi in Atlante per poterli bloccare singolarmente.</p>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                                    {locations
                                      .filter(l => l.name.toLowerCase().includes(locSearch.toLowerCase()))
                                      .map((loc) => {
                                        const isBlocked = devLocs.includes(loc.id);
                                        return (
                                          <div
                                            key={loc.id}
                                            onClick={() => handleToggleDeviceLocation(dev, loc.id)}
                                            className={`p-2 rounded-md border text-xs cursor-pointer flex items-center gap-2 transition-all truncate ${
                                              isBlocked 
                                                ? 'bg-amber-950/30 border-amber-600/50 text-amber-200 font-bold' 
                                                : 'bg-stone-900/40 border-stone-800 text-stone-400 hover:bg-stone-900 hover:border-stone-700'
                                            }`}
                                          >
                                            <Checkbox
                                              id={`dev-${dev.id}-loc-${loc.id}`}
                                              checked={isBlocked}
                                              onCheckedChange={() => handleToggleDeviceLocation(dev, loc.id)}
                                              className="scale-90 data-[state=checked]:bg-amber-600"
                                            />
                                            <span className="truncate">{loc.name}</span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
