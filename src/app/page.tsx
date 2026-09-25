import { CampaignManager } from '@/components/campaign-manager';
import db from '@/lib/db';
import { getSystemSettings } from '@/lib/actions';
import type { MagicItem, Monster, Spell, Skill, CampaignWithRelations, Session, Campaign, PlayerCharacter, LetterPreset, Shop, WorldLocation, Npc, Combat, StoryArc, LoreEntry, HomebrewRule } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getCampaignsData(activeCampaignId?: string): Promise<{ 
    campaigns: Campaign[], 
    activeCampaign: Campaign | null,
    activeArc: StoryArc | null,
    sessions: Session[], 
    magicItems: MagicItem[], 
    monsters: Monster[], 
    playerCharacters: PlayerCharacter[], 
    customSpells: Spell[], 
    customSkills: Skill[],
    possessedItems: string[],
    letterPresets: LetterPreset[],
    shops: Shop[],
    worldLocations: WorldLocation[],
    npcs: Npc[],
    combats: Combat[],
    loreEntries: LoreEntry[],
    homebrewRules: HomebrewRule[]
}> {
    try {
        const campaigns = db.prepare('SELECT * FROM Campaign ORDER BY updatedAt DESC').all() as Campaign[];
        const letterPresets = db.prepare('SELECT * FROM LetterPreset ORDER BY createdAt DESC').all() as LetterPreset[];
        
        if (!campaigns || campaigns.length === 0) {
            return { campaigns: [], activeCampaign: null, activeArc: null, sessions: [], magicItems: [], monsters: [], playerCharacters: [], customSpells: [], customSkills: [], possessedItems: [], letterPresets, shops: [], worldLocations: [], npcs: [], combats: [], loreEntries: [], homebrewRules: [] };
        }

        let activeCampaignData: Campaign | undefined;
        if (activeCampaignId) {
            activeCampaignData = campaigns.find(c => c.id === activeCampaignId);
        }
        
        if (!activeCampaignData) {
            activeCampaignData = campaigns[0];
        }

        let activeArc = db.prepare("SELECT * FROM StoryArc WHERE campaignId = ? AND status = 'active'").get(activeCampaignData.id) as StoryArc;
        
        // Se non c'è un arco attivo (capita in vecchi backup), proviamo a recuperare l'ultimo creato o a crearne uno
        if (!activeArc) {
            activeArc = db.prepare("SELECT * FROM StoryArc WHERE campaignId = ? ORDER BY createdAt DESC LIMIT 1").get(activeCampaignData.id) as StoryArc;
        }

        // Recupero sessioni Dashboard: diamo priorità all'arco attivo, ma se vuoto recuperiamo tutte le non archiviate della campagna
        let sessions = activeArc 
            ? db.prepare('SELECT * FROM Session WHERE campaignId = ? AND arcId = ? AND is_archived = 0 ORDER BY session_number ASC').all(activeCampaignData.id, activeArc.id) as Session[]
            : [];
            
        if (sessions.length === 0) {
            sessions = db.prepare('SELECT * FROM Session WHERE campaignId = ? AND is_archived = 0 ORDER BY session_number ASC').all(activeCampaignData.id) as Session[];
        }

        const magicItems = db.prepare('SELECT * FROM MagicItem WHERE campaignId = ?').all(activeCampaignData.id) as MagicItem[];
        const monsters = db.prepare('SELECT * FROM Monster WHERE campaignId = ?').all(activeCampaignData.id) as Monster[];
        const playerCharacters = db.prepare('SELECT * FROM PlayerCharacter WHERE campaignId = ? ORDER BY name ASC').all(activeCampaignData.id) as PlayerCharacter[];
        const customSpells = db.prepare('SELECT * FROM CustomSpell WHERE campaignId = ?').all(activeCampaignData.id) as Spell[];
        const customSkills = db.prepare('SELECT * FROM CustomSkill WHERE campaignId = ?').all(activeCampaignData.id) as Skill[];
        const possessedItems = db.prepare('SELECT itemName FROM PossessedItems WHERE campaignId = ?').all(activeCampaignData.id) as { itemName: string }[];
        const shops = db.prepare('SELECT * FROM Shop WHERE campaignId = ? ORDER BY updatedAt DESC').all(activeCampaignData.id) as Shop[];
        const worldLocations = db.prepare('SELECT * FROM WorldLocation WHERE campaignId = ? ORDER BY updatedAt DESC').all(activeCampaignData.id) as WorldLocation[];
        const npcs = db.prepare('SELECT * FROM Npc WHERE campaignId = ? ORDER BY updatedAt DESC').all(activeCampaignData.id) as Npc[];
        const combats = db.prepare('SELECT * FROM Combat WHERE campaignId = ? ORDER BY updatedAt DESC').all(activeCampaignData.id) as Combat[];
        const loreEntries = db.prepare('SELECT * FROM LoreEntry WHERE campaignId = ? ORDER BY updatedAt DESC').all(activeCampaignData.id) as LoreEntry[];
        let homebrewRules: HomebrewRule[] = [];
        try {
            homebrewRules = db.prepare('SELECT * FROM HomebrewRule WHERE campaignId = ? ORDER BY updatedAt DESC').all(activeCampaignData.id) as HomebrewRule[];
        } catch {
            homebrewRules = [];
        }
        
        return { campaigns, activeCampaign: activeCampaignData, activeArc: activeArc || null, sessions, magicItems, monsters, playerCharacters, customSpells, customSkills, possessedItems: possessedItems.map(i => i.itemName), letterPresets, shops, worldLocations, npcs, combats, loreEntries, homebrewRules };

    } catch (error) {
        console.error("Database error in getCampaignsData:", error);
        return { campaigns: [], activeCampaign: null, activeArc: null, sessions: [], magicItems: [], monsters: [], playerCharacters: [], customSpells: [], customSkills: [], possessedItems: [], letterPresets: [], shops: [], worldLocations: [], npcs: [], combats: [], loreEntries: [], homebrewRules: [] };
    }
}

export default async function Page(props: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  
  const campaignId = typeof searchParams?.campaignId === 'string' ? searchParams.campaignId : undefined;
  const initialView = typeof searchParams?.view === 'string' ? searchParams.view : undefined;

  const { campaigns, activeCampaign, activeArc, sessions, magicItems: createdMagicItems, monsters: createdMonsters, playerCharacters, customSpells, customSkills, possessedItems, letterPresets, shops, worldLocations, npcs, combats, loreEntries, homebrewRules } = await getCampaignsData(campaignId);
  const dbSettings = await getSystemSettings();

  const activeCampaignWithRelations: CampaignWithRelations | null = activeCampaign ? {
    ...activeCampaign,
    activeArc,
    sessions,
    magicItems: createdMagicItems,
    monsters: createdMonsters,
    playerCharacters,
    worldLocations,
    npcs,
    combats,
    loreEntries,
    homebrewRules
  } : null;

  return (
    <CampaignManager
      campaigns={campaigns}
      activeCampaign={activeCampaignWithRelations}
      initialView={initialView}
      sessions={sessions ?? []}
      possessedItems={possessedItems}
      letterPresets={letterPresets}
      shops={shops}
      worldLocations={worldLocations}
      npcs={npcs}
      combats={combats}
      customSpells={customSpells}
      customSkills={customSkills}
      dbSettings={dbSettings}
    />
  );
}
