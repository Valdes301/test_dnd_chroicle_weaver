
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

export interface MagicItem {
  id?: string;
  campaignId?: string;
  name: string;
  type: string;
  rarity: string;
  attunement?: string;
  description: string;
  source?: 'base' | 'created';
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
    source?: 'base' | 'created';
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
  source?: 'base' | 'created';
}

export interface Skill {
  id?: string;
  campaignId?: string;
  name: string;
  ability?: string;
  description?: string;
  source?: 'base' | 'created';
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

