import equipmentData from '@/lib/dnd-data/equipment.json';
import magicItemData from '@/lib/dnd-data/magic-items.json';
import commonItemData from '@/lib/dnd-data/common-items.json';
import monsterData from '@/lib/dnd-data/monsters.json';
import spellData from '@/lib/dnd-data/spells.json';
import skillsData from '@/lib/dnd-data/skills.json';
import type { MagicItem, Monster, Spell, Weapon, Armor, Skill } from '@/lib/types';

// Safe, environment-aware retrieval of custom JSON files
let customSystemSpells: Spell[] = [];
let customSystemMonsters: Monster[] = [];
let customSystemItems: MagicItem[] = [];

if (typeof window === 'undefined') {
  try {
    const fs = require('fs');
    const path = require('path');
    const getPath = (fileName: string) => path.join(process.cwd(), 'src', 'lib', 'dnd-data', fileName);
    
    const readJson = (fileName: string, key: string) => {
      const filePath = getPath(fileName);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))[key] || [];
      }
      return [];
    };
    
    customSystemSpells = readJson('custom-spells.json', 'spells');
    customSystemMonsters = readJson('custom-monsters.json', 'monsters');
    customSystemItems = readJson('custom-items.json', 'items');
  } catch (err) {
    console.error(`[Compendium Helper] Errore lettura file di sistema:`, err);
  }
}

export const baseSpells: Spell[] = [
  ...(spellData.spells as any[]).map(s => ({ ...s, source: 'base' as const })),
  ...customSystemSpells.map(s => ({ ...s, source: 'base' as const }))
];
export const allArmor: Armor[] = equipmentData.armor as Armor[];
export const allWeapons: Weapon[] = equipmentData.weapons as Weapon[];
export const baseSkills: Skill[] = (skillsData.skills as any[]).map(s => ({ ...s, source: 'base' as const }));
export const baseItems: MagicItem[] = [
  ...(commonItemData.commonItems as MagicItem[]),
  ...magicItemData.magicItems,
  ...((equipmentData as any).magicArmor || []),
  ...((equipmentData as any).magicWeapons || []),
  ...customSystemItems.map(i => ({ ...i, source: 'base' as const }))
];
export const baseMonsters: Monster[] = [
  ...(monsterData.monsters as unknown as Monster[]),
  ...customSystemMonsters.map(m => ({ ...m, source: 'base' as const }))
];


export const uniqueByName = <T extends { name: string; source?: 'base' | 'created' }>(baseItems: T[], createdItems: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of createdItems) {
    map.set(item.name.toLowerCase(), { ...item, source: 'created' as const });
  }
  for (const item of baseItems) {
    const key = item.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...item, source: 'base' as const });
    }
  }
  return Array.from(map.values());
};

export function getResolvedCompendia(params: {
  createdItems?: MagicItem[];
  createdMonsters?: Monster[];
  customSpells?: Spell[];
  customSkills?: Skill[];
}) {
  const mappedCreatedItems = (params.createdItems || []).map(i => ({
    ...i,
    type: i.type ?? 'Oggetto meraviglioso',
    rarity: i.rarity ?? 'Comune',
    attunement: i.attunement ?? 'No',
    description: i.description ?? '',
    cost: i.cost ?? 'N/D',
    damage: i.damage ?? '',
    techType: i.techType ?? 'damage',
    imageUrl: i.imageUrl || '',
    source: 'created' as const,
  }));

  const allItems = uniqueByName(baseItems, mappedCreatedItems);
  const allMonsters = uniqueByName(
    baseMonsters,
    (params.createdMonsters || []).map(m => ({
      ...m,
      type: m.type ?? '',
      armorClass: m.armorClass ?? '',
      hitPoints: m.hitPoints ?? '',
      challenge: m.challenge ?? '',
      description: m.description ?? '',
      imageUrl: m.imageUrl || '',
      source: 'created' as const,
    }))
  );
  const allSpells = uniqueByName(
    baseSpells,
    (params.customSpells || []).map(s => ({
      ...s,
      level: s.level ?? '',
      school: s.school ?? '',
      casting_time: s.casting_time ?? '',
      range: s.range ?? '',
      components: s.components ?? '',
      duration: s.duration ?? '',
      description: s.description ?? '',
      classes: s.classes ?? '',
      source: 'created' as const,
    }))
  );
  const allSkills = uniqueByName(
    baseSkills,
    (params.customSkills || []).map(s => ({
      ...s,
      ability: s.ability ?? '',
      description: s.description ?? '',
      source: 'created' as const,
    }))
  );

  const itemsForDb = allItems.filter(
    i => !['Armatura', 'Arma', 'Scudo'].some(type => (i.type || '').toLowerCase().includes(type.toLowerCase()))
  );
  const magicArmor = allItems.filter(
    i => (i.type || '').toLowerCase().includes('armatura') || (i.type || '').toLowerCase().includes('scudo')
  );
  const magicWeapons = allItems.filter(i => (i.type || '').toLowerCase().includes('arma'));

  return {
    allItems,
    dbMagicItems: itemsForDb,
    dbMonsters: allMonsters,
    dbSpells: allSpells,
    allArmor,
    allWeapons,
    magicArmor,
    magicWeapons,
    skills: allSkills,
  };
}
