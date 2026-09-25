export interface Campaign {
  id: string;
  name: string;
  setting: string;
  description: string | null;
  summary: string | null;
  global_compendium: string | null;
  active_arc_label: string | null;
  player_characters: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryArc {
  id: string;
  campaignId: string;
  title: string;
  summary: string | null;
  world_impact: string | null;
  status: "active" | "archived";
  order_index: number;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  session_number: number;
  title: string;
  notes: string | null;
  xp_award: number | null;
  source: "generated" | "imported";
  createdAt: string;
  updatedAt: string;
  campaignId: string;
  arcId: string;
  is_read: boolean;
  loot_scanned: boolean;
  is_archived: boolean;
  is_summarized?: boolean;
}

export interface Armor {
  name: string;
  type: string;
  cost: string;
  armorClass: string;
  strength: string;
  stealth: string;
  weight: string;
  rarity: string;
}

export interface Weapon {
  name: string;
  type: string;
  cost: string;
  damage: string;
  weight: string;
  properties: string;
  rarity: string;
}

export type TechType =
  "damage" | "defense" | "cure" | "alchemy" | "charges" | "reward" | "none";

export interface MagicItem {
  id?: string;
  campaignId?: string;
  name: string;
  type: string;
  rarity: string;
  attunement?: string;
  description: string;
  cost?: string | null;
  damage?: string | null;
  techType?: TechType;
  imageUrl?: string | null;
  source?: "base" | "created";
}

export interface Monster {
  id?: string;
  campaignId?: string;
  name: string;
  type?: string;
  armorClass?: string;
  hitPoints?: string;
  challenge?: string;
  description?: string;
  imageUrl?: string | null;
  source?: "base" | "created";
}

export interface Reward {
  id: string;
  campaignId: string;
  sessionId: string;
  name: string;
  description: string;
}

export interface CharacterEvent {
  id: string;
  characterId: string;
  characterType: "pc" | "npc";
  sessionId: string;
  campaignId: string;
  eventDescription: string;
  order_index: number;
  createdAt: string;
}

export interface Spell {
  id?: string;
  campaignId?: string;
  name: string;
  level?: string;
  school?: string;
  casting_time?: string;
  range?: string;
  components?: string;
  duration?: string;
  description?: string;
  classes?: string;
  source?: "base" | "created";
}

export interface Skill {
  id?: string;
  campaignId?: string;
  name: string;
  ability?: string;
  description?: string;
  source?: "base" | "created";
}

export interface PlayerCharacter {
  id: string;
  campaignId: string;
  name: string;
  race?: string | null;
  class?: string | null;
  archetype?: string | null;
  level?: number | null;
  hitPoints?: number | null;
  armorClass?: number | null;
  strength?: number | null;
  dexterity?: number | null;
  constitution?: number | null;
  intelligence?: number | null;
  wisdom?: number | null;
  charisma?: number | null;
  background?: string | null;
  imageUrl?: string | null;
  skills?: string | null;
  spells?: string | null;
  pact?: string | null;
  school?: string | null;
  domain?: string | null;
  traits?: string | null;
  ideals?: string | null;
  bonds?: string | null;
  flaws?: string | null;
  experiencePoints?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LetterPreset {
  id: string;
  name: string;
  settings: string;
  createdAt: string;
}

export interface ShopItem {
  name: string;
  type: string;
  rarity: string;
  cost: string;
  damage?: string | null;
  techType?: TechType;
  description: string;
  source: "database" | "ai";
}

export interface Shop {
  id: string;
  campaignId: string;
  name: string;
  owner: string | null;
  description: string | null;
  inventory: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorldLocation {
  id: string;
  campaignId: string;
  name: string;
  scale: string;
  style: string;
  atmosphere: string;
  details: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationDetails {
  title: string;
  sight: string;
  sound: string;
  smell: string;
  pointsOfInterest: string[];
  secret: string;
  mapSvg?: string;
}

export interface NpcDetails {
  name: string;
  race: string;
  occupation: string;
  appearance: string;
  personality: string;
  mannerism: string;
  secret: string;
  encounterHook: string;
  imageUrl?: string | null;
  gender?: string;
  age?: string;
  status?: string;
  alignment?: string;
  attitude?: "Amico" | "Nemico" | "Neutrale" | string;
  isHidden?: boolean;
  hiddenFields?: string[];
}

export interface Npc {
  id: string;
  campaignId: string;
  name: string;
  race: string;
  gender: string;
  age: string;
  status: string;
  alignment: string;
  details: string;
  createdAt: string;
  updatedAt: string;
}

export interface CombatUnit {
  quantity: number;
  race: string;
  role: string;
}

export interface CombatDetails {
  title: string;
  scenario: string;
  enemies: {
    name: string;
    quantity: number;
    stats: string;
    description: string;
  }[];
  strategy: string;
  xpTotal: number;
}

export interface Combat {
  id: string;
  campaignId: string;
  name: string;
  difficulty: string;
  details: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomebrewRule {
  id: string;
  campaignId: string;
  title: string;
  content: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiStats {
  service: string;
  rpm: number;
  rpd: number;
  status: string;
}

export interface GenerateCombatInput {
  difficulty: "Facile" | "Medio" | "Difficile" | "Mortale";
  units: CombatUnit[];
  environment?: string;
  campaignSummary?: string;
  homebrewRules?: string;
}

export interface GenerateNpcInput {
  gender: "Maschio" | "Femmina" | "Non binario";
  age: "Bambino" | "Ragazzo" | "Adulto" | "Vecchio";
  status: "Miserabile" | "Povero" | "Normale" | "Ricco" | "Sfarzoso" | "Nobile";
  alignment: "Buono" | "Neutrale" | "Malvagio";
  race?: string;
  campaignSummary?: string;
  homebrewRules?: string;
}

export interface GenerateShopInput {
  shopType:
    | "Alchimista"
    | "Armaiolo"
    | "Emporio Magico"
    | "Bernard"
    | "Contrabbandiere"
    | "Mercante Generale"
    | "Mercante Itinerante"
    | "Truffatore";
  campaignSummary?: string;
  numAiItems: number;
  generateCursed?: boolean;
  homebrewRules?: string;
}

export interface GenerateLocationInput {
  scale:
    | "Micro (Stanza, Vicolo)"
    | "Medio (Quartiere, Piazza, Taverna)"
    | "Macro (Villaggio, Dungeon, Foresta)";
  style:
    | "Ricco"
    | "Povero"
    | "Decadente"
    | "Sfarzoso"
    | "Diroccato"
    | "Incontaminato"
    | "In costruzione";
  atmosphere:
    | "Sinistro"
    | "Accogliente"
    | "Caotico"
    | "Silenzioso"
    | "Magico"
    | "Misterioso";
  population:
    | "Affollato"
    | "Deserto"
    | "Abitato da mostri"
    | "Solo PNG ostili"
    | "Tranquillo";
  campaignSummary?: string;
  homebrewRules?: string;
}

export interface GenerateTreasureInput {
  location: string;
  valueType:
    "Random (Scarso)" | "Random (Medio)" | "Random (Ricco)" | "Specifico";
  specificGold?: number;
  allowedTypes: string[];
  quantity: number;
  campaignSummary?: string;
  homebrewRules?: string;
}

export interface TreasureItem {
  name: string;
  type: string;
  rarity: string;
  description: string;
  cost: string;
  isCursed: boolean;
  techType: TechType;
}

export interface GenerateTreasureOutput {
  title: string;
  items: TreasureItem[];
}

export interface LoreEntry {
  id: string;
  campaignId: string;
  title: string;
  category: "citta" | "storia" | "personaggio" | "fazione" | "generale";
  subtitle?: string | null;
  content: string;
  tags?: string | null;
  sourceUrl?: string | null;
  era?: string | null;
  year_dr?: string | null;
  chronology_order?: number | null;
  status?: "canonical" | "inbox";
  createdAt: string;
  updatedAt: string;
}

export interface LoreVersion {
  id: string;
  entryId: string;
  campaignId: string;
  versionNumber: number;
  title: string;
  subtitle?: string | null;
  category: "citta" | "storia" | "personaggio" | "fazione" | "generale";
  content: string;
  tags?: string | null;
  era?: string | null;
  year_dr?: string | null;
  changeSummary?: string | null;
  createdAt: string;
}

export interface LoreMilestone {
  dateOrEra: string;
  title: string;
  description: string;
  importance?: "epico" | "maggiore" | "minore";
}

export interface LoreConflict {
  topic: string;
  description: string;
  advice: string;
}

export interface LoreConsolidationResult {
  title: string;
  category: "citta" | "storia" | "personaggio" | "fazione" | "generale";
  subtitle: string;
  content: string;
  tags: string;
  era: string;
  year_dr: string;
  chronology_order: number;
  deduplicationSummary: string[];
  milestones: LoreMilestone[];
  conflicts: LoreConflict[];
}

export type CampaignWithRelations = Campaign & {
  activeArc: StoryArc | null;
  sessions: Session[];
  magicItems: MagicItem[];
  monsters: Monster[];
  playerCharacters: PlayerCharacter[];
  worldLocations: WorldLocation[];
  npcs: Npc[];
  combats: Combat[];
  homebrewRules: HomebrewRule[];
  loreEntries: LoreEntry[];
};

// --- CONTROLLO GRANULARE CREAZIONE QUEST & STORIE ---

export type NpcQuestRole =
  | "amico"
  | "nemico"
  | "doppiogiochista"
  | "da_amico_a_nemico"
  | "da_nemico_a_amico"
  | "compagno_party";

export type ItemQuestRole = "necessario" | "trovato" | "rubato" | "in_possesso";

export interface SelectedNpcConfig {
  npcId: string;
  name: string;
  role: NpcQuestRole;
  customGoal?: string;
}

export interface SelectedItemConfig {
  itemId: string;
  name: string;
  role: ItemQuestRole;
  notes?: string;
}

export interface SelectedSpellConfig {
  spellId: string;
  name: string;
  context: "ostacolo" | "soluzione" | "chiave_enigma" | "rituale";
}

export interface SelectedSkillConfig {
  skillId: string;
  name: string;
  context:
    "indagine" | "sopravvivenza" | "sociale" | "atletica" | "conoscenza_arcana";
}

export interface SelectedLocationConfig {
  locationId: string;
  name: string;
  role: "punto_partenza" | "destinazione" | "luogo_segreto" | "zona_pericolo";
  atmosphere?: string;
}

export interface SelectedPreviousQuestLink {
  sessionId: string;
  sessionNumber: number;
  title: string;
  linkType:
    | "conseguenza_diretta"
    | "gancio_irrisolto"
    | "vendetta_o_debito"
    | "ritorno_sul_luogo";
  customHookNote?: string;
}

export interface SelectedPcConfig {
  pcId: string;
  name: string;
  includeIdeals: boolean;
  includeBonds: boolean;
  includeFlaws: boolean;
  includeStats: boolean;
  includeSpellsAndSkills: boolean;
  customFocus?: string;
}

export interface GranularQuestConfig {
  campaignId: string;
  // Prompt e Direttive del Master
  customPrompt: string;
  questTitleProposal?: string;
  narrativeTone:
    | "Epico ed Eroico"
    | "Cupo & Horror"
    | "Investigativo & Mistero"
    | "Survival & Tattico"
    | "Divertente & Leggero"
    | "Politico & Intrigo";
  primaryEncounterType:
    | "Bilanciato (Combattimento + Sociale + Esplorazione)"
    | "Prevalentemente Combattimento"
    | "Investigativo & Sociale"
    | "Dungeon Crawl & Enigmi"
    | "Furtivo & Infiltrazione";
  targetDifficulty: "Facile" | "Medio" | "Difficile" | "Mortale";

  // Contesto & Riassunti
  includeCampaignSummary: boolean;
  includeRecentSessionsSummary: boolean;
  includeGlobalLore: boolean;
  includeHomebrewRules: boolean;

  // Agganci a Quest e Sessioni Precedenti
  previousQuestLinks: SelectedPreviousQuestLink[];

  // Schede PG con filtri individuali
  selectedPcs: SelectedPcConfig[];

  // PNG con ruolo narrativo specifico
  selectedNpcs: SelectedNpcConfig[];

  // Oggetti & Armi
  selectedItems: SelectedItemConfig[];

  // Magie & Abilità
  selectedSpells: SelectedSpellConfig[];
  selectedSkills: SelectedSkillConfig[];

  // Luoghi & Ambientazione
  selectedLocations: SelectedLocationConfig[];

  // Elementi aggiuntivi di personalizzazione
  pacingSpeed: "Veloce & Incalzante" | "Regolare" | "Disteso & Esplorativo";
  plotTwistLikelihood:
    | "Nessun Colpo di Scena"
    | "Colpo di Scena Moderato"
    | "Rivelazione Sconvolgente";
  specificThreatsOrMonsters?: string;
}

export interface PcXpAward {
  pcId: string;
  pcName: string;
  currentXp: number;
  currentLevel: number;
  questBaseXp: number;
  bonusXp: number;
  bonusReason?: string;
  totalNewXp: number;
  newLevel: number;
  leveledUp: boolean;
}

export interface Device {
  id: string;
  name: string;
  mode: "master" | "player";
  role?: "master" | "player";
  blocked_views: string; // JSON string of string[]
  blocked_npcs: string; // JSON string of string[]
  blocked_locations: string; // JSON string of string[]
  use_custom_views?: boolean | number;
  is_blocked: boolean;
  last_active: string;
  updatedAt: string;
  campaignId: string | null;
  ip_address?: string | null;
  network_name?: string | null;
  userAgent?: string | null;
}

export interface SystemRule {
  id: string; // ID unico per la regola, es. "dmg-c1-che-cosa-fa-un-dm"
  title: string; // Titolo del paragrafo, es. "Che Cosa Fa un DM?"
  chapterId: string; // ID del capitolo, es. "dmg-cap-1"
  chapterTitle: string; // Titolo del capitolo, es. "Capitolo 1: Le Basi"
  sourceBook: 'phb' | 'dmg'; // 'phb' (Giocatore) o 'dmg' (Master)
  content: string; // Contenuto in formato Markdown
  tags?: string[]; // Tag aggiuntivi
  updatedAt?: string;
}

