import Database from 'better-sqlite3';
import path from 'path';
import fs from 'node:fs';

export const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('file:', '')
  : path.join(process.cwd(), 'data', 'dev.db');

const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
        console.error(`[DB] ERRORE CRITICO: Impossibile creare la directory ${dbDir}.`);
    }
}

const db = new Database(dbPath);

// Ottimizzazioni SQLite essenziali per alte prestazioni e reattività (WAL, cache RAM, MMAP)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -64000'); // 64 MB di page cache in RAM
db.pragma('mmap_size = 268435456'); // 256 MB memory-mapped I/O
db.pragma('busy_timeout = 5000');

// Assicura che esista anche la cartella degli asset persistenti
const assetsDir = path.join(dbDir, 'assets');
if (!fs.existsSync(assetsDir)) {
    try {
        fs.mkdirSync(assetsDir, { recursive: true });
    } catch (e) {
        console.error(`[DB] Impossibile creare la directory assets ${assetsDir}`);
    }
}

// Copia automatica dei preset in data/assets se non presenti, garantendo la visualizzazione in produzione (Docker, RPi, Standalone)
const presetFiles = [
    'hero-dnd-bg.jpg',
    'handout-background.jpg',
    'ancient-grimoire-bg.jpg',
    'tavern-board-bg.jpg',
    'card-background.jpg',
    'card-back-magie.jpg',
    'card-back-oggetti.jpg'
];

const candidateSourceDirs = [
    path.join(process.cwd(), 'public'),
    path.resolve('/app', 'public'),
    path.resolve('./public'),
    path.resolve(__dirname, '..', '..', 'public'),
    path.resolve(__dirname, '..', 'public'),
    path.resolve('../public'),
];

presetFiles.forEach(file => {
    const destPath = path.join(assetsDir, file);
    if (!fs.existsSync(destPath)) {
        for (const srcDir of candidateSourceDirs) {
            const srcPath = path.join(srcDir, file);
            if (fs.existsSync(srcPath)) {
                try {
                    fs.copyFileSync(srcPath, destPath);
                    console.log(`[DB Assets Init] Copiato preset ${file} da ${srcDir} in assets persistenti.`);
                    break;
                } catch (err) {
                    console.error(`[DB Assets Init] Errore copia preset ${file}:`, err);
                }
            }
        }
    }
});


// Definizioni tabelle base
db.exec(`
    CREATE TABLE IF NOT EXISTS Campaign (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        setting TEXT NOT NULL,
        description TEXT,
        summary TEXT,
        global_compendium TEXT,
        active_arc_label TEXT DEFAULT 'Arco Narrativo Attivo',
        player_characters TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS StoryArc (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        world_impact TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        order_index INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Session (
        id TEXT PRIMARY KEY,
        session_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        xp_award INTEGER DEFAULT 0,
        source TEXT NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT 0,
        is_summarized BOOLEAN NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        campaignId TEXT NOT NULL,
        arcId TEXT,
        is_read BOOLEAN NOT NULL DEFAULT 0,
        loot_scanned BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE,
        FOREIGN KEY (arcId) REFERENCES StoryArc (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS MagicItem (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        rarity TEXT,
        attunement TEXT,
        description TEXT,
        cost TEXT,
        damage TEXT,
        techType TEXT,
        imageUrl TEXT,
        campaignId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE,
        UNIQUE(name, campaignId)
    );

    CREATE TABLE IF NOT EXISTS Monster (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        armorClass TEXT,
        hitPoints TEXT,
        challenge TEXT,
        description TEXT,
        imageUrl TEXT,
        campaignId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE,
        UNIQUE(name, campaignId)
    );

    CREATE TABLE IF NOT EXISTS SessionLoot (
        sessionId TEXT NOT NULL,
        entityId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        PRIMARY KEY (sessionId, entityId),
        FOREIGN KEY (sessionId) REFERENCES Session (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Reward (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE,
        FOREIGN KEY (sessionId) REFERENCES Session (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS CharacterEvent (
        id TEXT PRIMARY KEY,
        characterId TEXT NOT NULL,
        characterType TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        campaignId TEXT NOT NULL,
        eventDescription TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sessionId) REFERENCES Session (id) ON DELETE CASCADE,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS PlayerCharacter (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        class TEXT,
        archetype TEXT,
        strength INTEGER,
        dexterity INTEGER,
        constitution INTEGER,
        intelligence INTEGER,
        wisdom INTEGER,
        charisma INTEGER,
        background TEXT,
        imageUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        campaignId TEXT NOT NULL,
        race TEXT,
        level INTEGER,
        hitPoints INTEGER,
        armorClass INTEGER,
        skills TEXT,
        spells TEXT,
        pact TEXT,
        school TEXT,
        domain TEXT,
        traits TEXT,
        ideals TEXT,
        bonds TEXT,
        flaws TEXT,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS CustomSpell (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        level TEXT,
        school TEXT,
        casting_time TEXT,
        range TEXT,
        components TEXT,
        duration TEXT,
        description TEXT,
        classes TEXT,
        campaignId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE,
        UNIQUE(name, campaignId)
    );

    CREATE TABLE IF NOT EXISTS CustomSkill (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ability TEXT,
        description TEXT,
        campaignId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE,
        UNIQUE(name, campaignId)
    );

    CREATE TABLE IF NOT EXISTS PossessedItems (
        campaignId TEXT NOT NULL,
        itemName TEXT NOT NULL,
        PRIMARY KEY (campaignId, itemName),
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS LetterPreset (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        settings TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AppSetting (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Shop (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        name TEXT NOT NULL,
        owner TEXT,
        description TEXT,
        inventory TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS WorldLocation (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        name TEXT NOT NULL,
        scale TEXT,
        style TEXT,
        atmosphere TEXT,
        details TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Npc (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        name TEXT NOT NULL,
        race TEXT,
        gender TEXT,
        age TEXT,
        status TEXT,
        alignment TEXT,
        details TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Combat (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        name TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        details TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS MasterChatMessage (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        sender TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS HomebrewRule (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'Generale',
        isActive BOOLEAN NOT NULL DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS LoreEntry (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        subtitle TEXT,
        content TEXT NOT NULL,
        tags TEXT,
        sourceUrl TEXT,
        era TEXT,
        year_dr TEXT,
        chronology_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'canonical',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS LoreVersion (
        id TEXT PRIMARY KEY,
        entryId TEXT NOT NULL,
        campaignId TEXT NOT NULL,
        versionNumber INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        subtitle TEXT,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        era TEXT,
        year_dr TEXT,
        changeSummary TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entryId) REFERENCES LoreEntry (id) ON DELETE CASCADE,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS SystemPrompt (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        defaultContent TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ApiUsage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS SystemSetting (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Device (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'player',
        blocked_views TEXT DEFAULT '[]',
        blocked_npcs TEXT DEFAULT '[]',
        blocked_locations TEXT DEFAULT '[]',
        is_blocked BOOLEAN DEFAULT 0,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        campaignId TEXT,
        FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE SET NULL
    );

    -- INDICI AD ALTE PRESTAZIONI PER QUERY ISTANTANEE
    CREATE INDEX IF NOT EXISTS idx_storyarc_campaign ON StoryArc (campaignId, status);
    CREATE INDEX IF NOT EXISTS idx_session_campaign ON Session (campaignId, is_archived, session_number);
    CREATE INDEX IF NOT EXISTS idx_session_arc ON Session (arcId);
    CREATE INDEX IF NOT EXISTS idx_magicitem_campaign ON MagicItem (campaignId);
    CREATE INDEX IF NOT EXISTS idx_monster_campaign ON Monster (campaignId);
    CREATE INDEX IF NOT EXISTS idx_sessionloot_session ON SessionLoot (sessionId);
    CREATE INDEX IF NOT EXISTS idx_reward_campaign ON Reward (campaignId);
    CREATE INDEX IF NOT EXISTS idx_characterevent_session ON CharacterEvent (sessionId);
    CREATE INDEX IF NOT EXISTS idx_playercharacter_campaign ON PlayerCharacter (campaignId);
    CREATE INDEX IF NOT EXISTS idx_customspell_campaign ON CustomSpell (campaignId);
    CREATE INDEX IF NOT EXISTS idx_customskill_campaign ON CustomSkill (campaignId);
    CREATE INDEX IF NOT EXISTS idx_shop_campaign ON Shop (campaignId);
    CREATE INDEX IF NOT EXISTS idx_worldloc_campaign ON WorldLocation (campaignId);
    CREATE INDEX IF NOT EXISTS idx_npc_campaign ON Npc (campaignId);
    CREATE INDEX IF NOT EXISTS idx_combat_campaign ON Combat (campaignId);
    CREATE INDEX IF NOT EXISTS idx_homebrew_campaign ON HomebrewRule (campaignId, isActive);
    CREATE INDEX IF NOT EXISTS idx_lore_campaign ON LoreEntry (campaignId, category);
    CREATE INDEX IF NOT EXISTS idx_loreversion_entry ON LoreVersion (entryId, versionNumber DESC);
    CREATE INDEX IF NOT EXISTS idx_apiusage_timestamp ON ApiUsage (timestamp);
`);

// --- SISTEMA DI MIGRAZIONE ROBUSTO ---
const migrations = [
    { table: 'Session', column: 'is_read', type: 'BOOLEAN NOT NULL DEFAULT 0' },
    { table: 'Session', column: 'loot_scanned', type: 'BOOLEAN NOT NULL DEFAULT 0' },
    { table: 'Session', column: 'is_summarized', type: 'BOOLEAN NOT NULL DEFAULT 0' },
    { table: 'Session', column: 'xp_award', type: 'INTEGER DEFAULT 0' },
    { table: 'Session', column: 'updatedAt', type: 'DATETIME' },
    { table: 'Campaign', column: 'active_arc_label', type: "TEXT DEFAULT 'Arco Narrativo Attivo'" },
    { table: 'Campaign', column: 'global_compendium', type: 'TEXT' },
    { table: 'Campaign', column: 'player_characters', type: 'TEXT' },
    { table: 'Campaign', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'Campaign', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'StoryArc', column: 'world_impact', type: 'TEXT' },
    { table: 'MagicItem', column: 'damage', type: 'TEXT' },
    { table: 'MagicItem', column: 'techType', type: 'TEXT' },
    { table: 'MagicItem', column: 'imageUrl', type: 'TEXT' },
    { table: 'MagicItem', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'MagicItem', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'Monster', column: 'imageUrl', type: 'TEXT' },
    { table: 'Monster', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'Monster', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'CustomSpell', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'CustomSpell', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'CustomSkill', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'CustomSkill', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'Reward', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'Reward', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'PlayerCharacter', column: 'imageUrl', type: 'TEXT' },
    { table: 'PlayerCharacter', column: 'archetype', type: 'TEXT' },
    { table: 'PlayerCharacter', column: 'experiencePoints', type: 'INTEGER DEFAULT 0' },
    { table: 'PlayerCharacter', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'PlayerCharacter', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'CharacterEvent', column: 'order_index', type: 'INTEGER DEFAULT 0' },
    { table: 'CharacterEvent', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'Npc', column: 'createdAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'Npc', column: 'updatedAt', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'LoreEntry', column: 'era', type: 'TEXT' },
    { table: 'LoreEntry', column: 'year_dr', type: 'TEXT' },
    { table: 'LoreEntry', column: 'chronology_order', type: 'INTEGER DEFAULT 0' },
    { table: 'LoreEntry', column: 'status', type: "TEXT DEFAULT 'canonical'" },
    { table: 'Device', column: 'ip_address', type: 'TEXT' },
    { table: 'Device', column: 'network_name', type: 'TEXT' },
    { table: 'Device', column: 'userAgent', type: 'TEXT' },
    { table: 'Device', column: 'use_custom_views', type: 'BOOLEAN DEFAULT 0' },
];

for (const m of migrations) {
    try {
        const columns = db.prepare(`PRAGMA table_info("${m.table}")`).all() as any[];
        const exists = columns.some(c => c.name.toLowerCase() === m.column.toLowerCase());
        if (!exists) {
            console.log(`[DB Migration] Adding missing column ${m.column} to table ${m.table}...`);
            db.exec(`ALTER TABLE "${m.table}" ADD COLUMN "${m.column}" ${m.type}`);
        }
    } catch (e) {
        console.error(`[DB Migration Error] Non è stato possibile migrare la colonna ${m.column} nella tabella ${m.table}:`, e);
    }
}

// Creazione degli indici complessi dipendenti dalle colonne migrate
try {
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_characterevent_char ON CharacterEvent (characterId, characterType, order_index);
        CREATE INDEX IF NOT EXISTS idx_lore_chronology ON LoreEntry (campaignId, chronology_order);
    `);
} catch (e) {
    console.error(`[DB Index Error] Errore nella creazione degli indici post-migrazione:`, e);
}

// Inizializzazione System Prompts predefiniti
const defaultPrompts = [
    {
        slug: 'story-gen',
        title: 'Generatore di Storie',
        content: `Sei un Dungeon Master esperto per Dungeons & Dragons 5e. Devi scrivere bozze di sessioni epiche calcolando gli XP. È MANDATORIO usare i dati delle schede dei PG (Ideali, Legami, Difetti, Abilità e Magie) per creare ganci narrativi personalizzati e sfide che mettano alla prova i loro valori e le loro debolezze specifiche.`
    },
    {
        slug: 'npc-gen',
        title: 'Anagrafe PNG',
        content: `Sei un Maestro delle Relazioni e dei PNG per D&D 5e. Devi generare un personaggio non giocante vibrante e utile per una sessione.`
    },
    {
        slug: 'world-gen',
        title: 'Architetto di Mondi',
        content: `Sei un Architetto di Mondi esperto per D&D 5e. Devi generare una scheda dettagliata per un luogo (vista, udito, olfatto) e una planimetria SVG minimale.`
    },
    {
        slug: 'combat-gen',
        title: 'Arena del Destino',
        content: `Sei un Maestro della Strategia per D&D 5e. Devi generare un incontro di combattimento bilanciato fornendo schede rapide per i nemici (CA, PF, Danni).`
    },
    {
        slug: 'shop-gen',
        title: 'Emporio Magico',
        content: `Sei un Dungeon Master esperto e creativo per D&D 5e. Devi generare una bottega fantastica e il suo inventario speciale, inclusi oggetti unici e potenzialmente maledetti.`
    },
    {
        slug: 'treasure-gen',
        title: 'Generatore di Tesori',
        content: `Sei un Maestro dei Tesori per D&D 5e. Devi generare un bottino memorabile e coerente con il luogo del ritrovamento.`
    },
    {
        slug: 'catalog-gen',
        title: 'Grande Bibliotecario',
        content: `Sei il Grande Bibliotecario di Candlekeep. Il tuo compito è catalogare i dati di D&D 5e (oggetti, mostri, magie) con precisione chirurgica partendo da testi o immagini.`
    },
    {
        slug: 'summary-campaign',
        title: 'Grande Cronista (Campagna)',
        content: `Sei un cronista esperto con il compito di distillare una lunga saga di Dungeons & Dragons in un riassunto efficiente e denso di informazioni per mantenere la coerenza.`
    },
    {
        slug: 'summary-arc',
        title: 'Grande Cronista (Arco Narrativo)',
        content: `Sei il Grande Cronista delle ere perdute. Il tuo compito è integrare nuove sessioni in un arco narrativo esistente, mantenendo uno stile solenne ed epico.`
    },
    {
        slug: 'improv-gen',
        title: 'Oste della Taverna',
        content: `Sei l'Oste della Taverna, un assistente DM istantaneo esperto in D&D 5e. Fornisci dicerie, risposte e spunti basati sulla trama e sul mondo.`
    },
    {
        slug: 'extract-gen',
        title: 'Analista di Sessione',
        content: `Sei un esperto analista di sessioni di D&D 5e. Il tuo compito è estrarre ogni elemento tangibile (oggetti, mostri) e analizzare le gesta dei personaggi.`
    },
    {
        slug: 'lore-gen',
        title: 'Grande Archivista (Lore & Ambientazione)',
        content: `Sei il Grande Archivista di Candlekeep e il massimo esperto del canone ufficiale di D&D 5e e dei Forgotten Realms. Il tuo compito è estrarre, strutturare ed espandere dossier di ambientazione (città, cronologia, personaggi storici, fazioni). Non inventare MAI informazioni o dettagli non documentati nel canone ufficiale di D&D 5e e mantieni una formattazione Markdown enciclopedica, ricca e rigorosa.`
    }
];

const seedStmt = db.prepare(`INSERT OR IGNORE INTO SystemPrompt (slug, title, content, defaultContent) VALUES (?, ?, ?, ?)`);
defaultPrompts.forEach(p => seedStmt.run(p.slug, p.title, p.content, p.content));

export function getAppSetting(key: string, defaultValue = ''): string {
    try {
        const row = db.prepare("SELECT value FROM AppSetting WHERE key = ?").get(key) as { value: string } | undefined;
        return row?.value ?? defaultValue;
    } catch {
        return defaultValue;
    }
}

export function setAppSetting(key: string, value: string): void {
    try {
        db.prepare(`
            INSERT INTO AppSetting (key, value, updatedAt)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
        `).run(key, value);
    } catch (err) {
        console.error(`[DB] Errore salvataggio impostazione ${key}:`, err);
    }
}

export default db;