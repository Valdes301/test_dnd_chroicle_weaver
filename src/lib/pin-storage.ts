/**
 * Gestione dello stato del PIN e della Password di sicurezza
 * Salva i dati protetti in localStorage/sessionStorage.
 */

const STORAGE_KEYS = {
  PIN_HASH: 'dnd_master_pin_hash',
  PASSWORD_HASH: 'dnd_master_pwd_hash',
  IS_LOCKED: 'dnd_master_is_locked',
  AUTOLOCK_MINUTES: 'dnd_master_autolock_min',
  LAST_ACTIVITY: 'dnd_master_last_activity',
  IS_PLAYER_MODE: 'dnd_master_is_player_mode',
  BLOCKED_VIEWS: 'dnd_master_blocked_views',
  BLOCKED_BEHAVIOR: 'dnd_master_blocked_behavior',
};

// Funzione di hashing rapida, deterministica e sincrona
export function hashSecret(val: string): string {
  const normalized = val.trim();
  let h1 = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h1 ^= normalized.charCodeAt(i);
    h1 += (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');

  let h2 = 0x55555555;
  for (let i = normalized.length - 1; i >= 0; i--) {
    h2 ^= (normalized.charCodeAt(i) * 37);
    h2 = (h2 << 5) - h2;
  }
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `sigil_${part1}_${part2}`;
}

export function getPinConfig(): { isConfigured: boolean; autoLockMinutes: number } {
  return {
    isConfigured: isPinConfigured(),
    autoLockMinutes: getAutoLockMinutes(),
  };
}

export function isPinConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(STORAGE_KEYS.PIN_HASH));
}

export function getIsLocked(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isPinConfigured()) return false;
  return localStorage.getItem(STORAGE_KEYS.IS_LOCKED) === 'true';
}

export function setIsLocked(locked: boolean): void {
  if (typeof window === 'undefined') return;
  if (locked) {
    localStorage.setItem(STORAGE_KEYS.IS_LOCKED, 'true');
  } else {
    localStorage.setItem(STORAGE_KEYS.IS_LOCKED, 'false');
    touchActivity();
  }
  window.dispatchEvent(new CustomEvent('dnd-lock-state-changed', { detail: { isLocked: locked } }));
}

export function openPinConfigDialog(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dnd-open-pin-config'));
  }
}

export function configurePinAndPass(pin: string, password: string, autoLockMinutes: number = 0): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Ambiente non valido' };
  
  const cleanPin = pin.trim();
  const cleanPass = password.trim();

  if (!/^\d{4,6}$/.test(cleanPin)) {
    return { success: false, error: 'Il PIN deve contenere da 4 a 6 cifre numeriche.' };
  }
  if (cleanPass.length < 3) {
    return { success: false, error: 'La Password deve contenere almeno 3 caratteri.' };
  }

  const pinHash = hashSecret(cleanPin);
  const pwdHash = hashSecret(cleanPass);

  localStorage.setItem(STORAGE_KEYS.PIN_HASH, pinHash);
  localStorage.setItem(STORAGE_KEYS.PASSWORD_HASH, pwdHash);
  localStorage.setItem(STORAGE_KEYS.AUTOLOCK_MINUTES, String(autoLockMinutes));
  // Quando si configura il PIN, si apre la modalità Master e si sblocca lo schermo
  localStorage.setItem(STORAGE_KEYS.IS_PLAYER_MODE, 'false');
  localStorage.setItem(STORAGE_KEYS.IS_LOCKED, 'false');
  touchActivity();

  // Salva asincronamente in background sul DB centralizzato
  import('@/lib/actions').then(({ saveSystemSetting }) => {
    saveSystemSetting('master_pin_hash', pinHash);
    saveSystemSetting('master_password_hash', pwdHash);
    saveSystemSetting('autolock_minutes', String(autoLockMinutes));
  }).catch(err => console.error("Errore salvataggio DB PIN:", err));

  window.dispatchEvent(new CustomEvent('dnd-pin-config-changed'));
  window.dispatchEvent(new CustomEvent('dnd-player-mode-changed', { detail: { isPlayerMode: false } }));
  window.dispatchEvent(new CustomEvent('dnd-lock-state-changed', { detail: { isLocked: false } }));
  return { success: true };
}

export function verifyPin(enteredPin: string): boolean {
  if (typeof window === 'undefined') return false;
  const storedHash = localStorage.getItem(STORAGE_KEYS.PIN_HASH);
  if (!storedHash) return true; // Se non c'è PIN, è sbloccato
  return hashSecret(enteredPin) === storedHash;
}

export function verifyPassword(enteredPassword: string): boolean {
  if (typeof window === 'undefined') return false;
  const storedHash = localStorage.getItem(STORAGE_KEYS.PASSWORD_HASH);
  if (!storedHash) return false;
  return hashSecret(enteredPassword) === storedHash;
}

export function removePinProtection(currentPinOrPassword: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Ambiente non valido' };
  if (!verifyPin(currentPinOrPassword) && !verifyPassword(currentPinOrPassword)) {
    return { success: false, error: 'PIN o Password errati. Impossibile rimuovere la protezione.' };
  }
  localStorage.removeItem(STORAGE_KEYS.PIN_HASH);
  localStorage.removeItem(STORAGE_KEYS.PASSWORD_HASH);
  localStorage.removeItem(STORAGE_KEYS.IS_LOCKED);

  // Rimuovi dal DB centralizzato
  import('@/lib/actions').then(({ saveSystemSetting }) => {
    saveSystemSetting('master_pin_hash', '');
    saveSystemSetting('master_password_hash', '');
  }).catch(err => console.error("Errore rimozione DB PIN:", err));

  window.dispatchEvent(new CustomEvent('dnd-pin-config-changed'));
  window.dispatchEvent(new CustomEvent('dnd-lock-state-changed', { detail: { isLocked: false } }));
  return { success: true };
}

export function getAutoLockMinutes(): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(STORAGE_KEYS.AUTOLOCK_MINUTES);
  return val ? parseInt(val, 10) : 0;
}

export function setAutoLockMinutes(min: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUTOLOCK_MINUTES, String(min));
}

let lastTouchMemory = 0;
export function touchActivity(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastTouchMemory < 10000) return;
  lastTouchMemory = now;
  localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(now));
}

export function checkAutoLockExpiry(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isPinConfigured() || getIsLocked()) return false;
  const autoLockMin = getAutoLockMinutes();
  if (autoLockMin <= 0) return false;

  const last = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) || '0', 10);
  if (!last) {
    touchActivity();
    return false;
  }
  const diffMs = Date.now() - last;
  const diffMin = diffMs / (1000 * 60);
  if (diffMin >= autoLockMin) {
    setIsLocked(true);
    return true;
  }
  return false;
}

export type BlockedBehavior = 'hide' | 'pin';

export interface NavSectionMeta {
  id: string;
  label: string;
  description: string;
  category: 'master' | 'creativi' | 'manuale' | 'avanzate' | 'sistema';
  defaultBlocked?: boolean;
}

export const NAV_SECTIONS: NavSectionMeta[] = [
  // Master & Campagna
  { id: 'bacheca', label: 'Bacheca del Gruppo', description: 'Panoramica della campagna, eroi e stato', category: 'master' },
  { id: 'storia', label: 'Storia & Cronache', description: 'Archi narrativi, scaletta sessioni e trame future', category: 'master', defaultBlocked: true },
  { id: 'lore', label: 'Lore & Ambientazione', description: 'Voci di lore, fazioni ed enciclopedia del mondo', category: 'master' },
  { id: 'personaggi', label: 'Personaggi Giocanti', description: 'Schede dei PG, allineamenti e inventario', category: 'master' },
  { id: 'riepilogo-png', label: 'Anagrafe dei PNG', description: 'Dossier dei personaggi non giocanti incontrati', category: 'master' },
  { id: 'quest-creator', label: 'Crea Nuova Quest', description: 'Generatore avanzato per storie, PG, PNG e agganci', category: 'master', defaultBlocked: true },
  { id: 'oracolo-ai', label: 'Oracolo', description: 'Consigliere, regole 5e e lore Forgotten Realms', category: 'master', defaultBlocked: true },
  { id: 'party-xp', label: 'Assegna PX Party', description: 'Calcolo e distribuzione ufficiale dei Punti Esperienza', category: 'master', defaultBlocked: true },

  // Strumenti Creativi
  { id: 'architetto', label: 'Architetto di Mondi', description: 'Luoghi, insediamenti e mappa concettuale', category: 'creativi' },
  { id: 'combattimenti', label: 'Arena del Destino', description: 'Incontri tattici, ordine di iniziativa e mostri', category: 'creativi', defaultBlocked: true },
  { id: 'botteghe', label: 'Botteghe ed Empori', description: 'Negozi, mercanti e inventario merci', category: 'creativi' },
  { id: 'anagrafe', label: 'Emporio dei Volti (PNG)', description: 'Generatore rapido di PNG e segreti del DM', category: 'creativi', defaultBlocked: true },
  { id: 'tesori', label: 'Generatore di Tesori', description: 'Tabelle bottino, monete e ricompense segrete', category: 'creativi', defaultBlocked: true },
  { id: 'mappe', label: 'Mappe', description: 'Visualizzatore e mappe del territorio', category: 'creativi' },
  { id: 'lettere', label: 'Ordini e Lettere', description: 'Pergamene, proclami e corrispondenza di gioco', category: 'creativi' },
  { id: 'taverna', label: 'Taverna & Improvvisazione', description: 'Generatore di voci, bevande e incontri casuali', category: 'creativi' },

  // Manuale
  { id: 'manuale-importa', label: 'Importazione Intelligente', description: 'Caricamento ed estrazione di dati dai manuali', category: 'manuale', defaultBlocked: true },
  { id: 'abilità', label: 'Abilità', description: 'Compendio delle abilità e meccaniche', category: 'manuale' },
  { id: 'equipaggiamento', label: 'Equipaggiamento', description: 'Armi, armature e oggetti mondani', category: 'manuale' },
  { id: 'oggetti', label: 'Oggetti Magici', description: 'Artefatti, pozioni e reliquie', category: 'manuale' },
  { id: 'bestiario', label: 'Bestiario', description: 'Statistiche e schede delle creature', category: 'manuale', defaultBlocked: true },
  { id: 'magie', label: 'Incantesimi', description: 'Grimorio e formule arcane/divine', category: 'manuale' },

  // Avanzate
  { id: 'layout-sperimentale', label: 'Genera Carte Complete', description: 'Stampa e grafica per carte illustrate', category: 'avanzate' },
  { id: 'crea-carte', label: 'Crea Carte (Multiplo)', description: 'Generazione in blocco di carte da gioco', category: 'avanzate' },
  { id: 'personalizza', label: 'Personalizza Sfondo', description: 'Configurazione grafica del tavolo', category: 'avanzate' },

  // Sistema
  { id: 'homebrew', label: 'Compendio Homebrew', description: 'Regole e meccaniche create dal Master', category: 'sistema' },
  { id: 'impostazioni', label: 'Stato Sistema e API', description: 'Diagnostica, chiavi segrete e quote IA', category: 'sistema', defaultBlocked: true },
  { id: 'sistema', label: 'Pannello Sistema', description: 'Pannello laterale con sicurezza, backup e impostazioni', category: 'sistema', defaultBlocked: true },
];

export const RECOMMENDED_VISIBLE_VIEWS = NAV_SECTIONS.filter(s => !s.defaultBlocked).map(s => s.id);
export const DEFAULT_VISIBLE_VIEWS = NAV_SECTIONS.map(s => s.id);
export const DEFAULT_BLOCKED_VIEWS = NAV_SECTIONS.filter(s => s.defaultBlocked).map(s => s.id);

export function isPlayerMode(): boolean {
  if (typeof window === 'undefined') return true;
  
  // Try to get explicit mode
  const stored = localStorage.getItem(STORAGE_KEYS.IS_PLAYER_MODE);
  if (stored !== null) return stored === 'true';

  // Fallback to last known device mode
  const lastMode = localStorage.getItem('dnd_device_last_mode');
  if (lastMode === 'master') return false; // Not player mode
  
  return true; // Default to Player mode
}

export function setPlayerMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.IS_PLAYER_MODE, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('dnd-player-mode-changed', { detail: { isPlayerMode: enabled } }));

  const deviceId = localStorage.getItem('dnd_device_id');
  if (deviceId) {
    import('@/lib/actions').then(({ updateDeviceConfigAction }) => {
      updateDeviceConfigAction(deviceId, { 
        mode: enabled ? 'player' : 'master',
        is_blocked: false 
      });
    }).catch(err => console.error("Errore sincronizzazione modalita dispositivo:", err));
  }
}

export function getVisibleViews(): string[] {
  // Se siamo in Modalità Giocatore e il PIN del Master NON è stato ancora configurato,
  // la vista Giocatore deve mostrare ESCLUSIVAMENTE la Bacheca del Gruppo ('bacheca').
  if (isPlayerMode() && !isPinConfigured()) {
    return ['bacheca'];
  }
  if (typeof window === 'undefined') return DEFAULT_VISIBLE_VIEWS;
  const raw = localStorage.getItem('dnd_master_visible_views');
  if (!raw) {
    // Fallback: check old blocked views if present
    const blockedRaw = localStorage.getItem(STORAGE_KEYS.BLOCKED_VIEWS);
    if (blockedRaw) {
      try {
        const blocked = JSON.parse(blockedRaw);
        if (Array.isArray(blocked)) {
          return NAV_SECTIONS.map(s => s.id).filter(id => !blocked.includes(id));
        }
      } catch {}
    }
    return DEFAULT_VISIBLE_VIEWS;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_VISIBLE_VIEWS;
  } catch {
    return DEFAULT_VISIBLE_VIEWS;
  }
}

export function setVisibleViews(views: string[]): void {
  if (typeof window === 'undefined') return;
  const raw = JSON.stringify(views);
  localStorage.setItem('dnd_master_visible_views', raw);
  // Also update blocked views for compatibility
  const blocked = NAV_SECTIONS.map(s => s.id).filter(id => !views.includes(id));
  localStorage.setItem(STORAGE_KEYS.BLOCKED_VIEWS, JSON.stringify(blocked));

  window.dispatchEvent(new CustomEvent('dnd-visible-views-changed', { detail: { visibleViews: views, blockedViews: blocked } }));
  window.dispatchEvent(new CustomEvent('dnd-blocked-views-changed', { detail: { blockedViews: blocked } }));

  // Salva nel DB centralizzato
  import('@/lib/actions').then(({ saveSystemSetting }) => {
    saveSystemSetting('visible_views', raw);
    saveSystemSetting('blocked_views', JSON.stringify(blocked));
  }).catch(err => console.error("Errore salvataggio DB visible_views:", err));
}

// Keep legacy wrapper for backwards compatibility
export function getBlockedViews(): string[] {
  if (isPlayerMode() && !isPinConfigured()) {
    return NAV_SECTIONS.map(s => s.id).filter(id => id !== 'bacheca');
  }
  const visible = getVisibleViews();
  return NAV_SECTIONS.map(s => s.id).filter(id => !visible.includes(id));
}

export function setBlockedViews(blocked: string[]): void {
  const visible = NAV_SECTIONS.map(s => s.id).filter(id => !blocked.includes(id));
  setVisibleViews(visible);
}

export function isViewBlockedInPlayerMode(viewId: string): boolean {
  if (!isPlayerMode()) return false;
  if (viewId === 'bacheca') return false;

  // Se il PIN del Master NON è ancora configurato, la schermata giocatore mostra SOLO la bacheca
  if (!isPinConfigured()) {
    return true;
  }

  if (typeof window !== 'undefined') {
    const devBlockedRaw = localStorage.getItem('dnd_device_blocked_views');
    if (devBlockedRaw) {
      try {
        const devBlocked = JSON.parse(devBlockedRaw);
        if (Array.isArray(devBlocked)) {
          return devBlocked.includes(viewId);
        }
      } catch {}
    }
  }

  const visible = getVisibleViews();
  return !visible.includes(viewId);
}

export function getBlockedBehavior(): BlockedBehavior {
  if (typeof window === 'undefined') return 'hide';
  const val = localStorage.getItem(STORAGE_KEYS.BLOCKED_BEHAVIOR);
  return val === 'pin' ? 'pin' : 'hide';
}

export function setBlockedBehavior(behavior: BlockedBehavior): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.BLOCKED_BEHAVIOR, behavior);
  window.dispatchEvent(new CustomEvent('dnd-blocked-behavior-changed', { detail: { behavior } }));

  // Salva nel DB centralizzato
  import('@/lib/actions').then(({ saveSystemSetting }) => {
    saveSystemSetting('blocked_behavior', behavior);
  }).catch(err => console.error("Errore salvataggio DB blocked_behavior:", err));
}

/**
 * Sincronizza i dati di sicurezza ricevuti dal DB nel localStorage locale.
 */
export function syncFromDatabase(dbSettings: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  
  let changed = false;
  
  if (dbSettings.master_pin_hash && localStorage.getItem(STORAGE_KEYS.PIN_HASH) !== dbSettings.master_pin_hash) {
    localStorage.setItem(STORAGE_KEYS.PIN_HASH, dbSettings.master_pin_hash);
    changed = true;
  }
  if (dbSettings.master_password_hash && localStorage.getItem(STORAGE_KEYS.PASSWORD_HASH) !== dbSettings.master_password_hash) {
    localStorage.setItem(STORAGE_KEYS.PASSWORD_HASH, dbSettings.master_password_hash);
    changed = true;
  }
  if (dbSettings.blocked_views && localStorage.getItem(STORAGE_KEYS.BLOCKED_VIEWS) !== dbSettings.blocked_views) {
    localStorage.setItem(STORAGE_KEYS.BLOCKED_VIEWS, dbSettings.blocked_views);
    changed = true;
  }
  if (dbSettings.blocked_behavior && localStorage.getItem(STORAGE_KEYS.BLOCKED_BEHAVIOR) !== dbSettings.blocked_behavior) {
    localStorage.setItem(STORAGE_KEYS.BLOCKED_BEHAVIOR, dbSettings.blocked_behavior);
    changed = true;
  }
  if (dbSettings.autolock_minutes && localStorage.getItem(STORAGE_KEYS.AUTOLOCK_MINUTES) !== dbSettings.autolock_minutes) {
    localStorage.setItem(STORAGE_KEYS.AUTOLOCK_MINUTES, dbSettings.autolock_minutes);
    changed = true;
  }

  if (changed) {
    window.dispatchEvent(new CustomEvent('dnd-pin-config-changed'));
    window.dispatchEvent(new CustomEvent('dnd-blocked-views-changed', { detail: { blockedViews: getBlockedViews() } }));
    window.dispatchEvent(new CustomEvent('dnd-blocked-behavior-changed', { detail: { behavior: getBlockedBehavior() } }));
  }
}

