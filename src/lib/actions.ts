
'use server';

import db, { dbPath, getAppSetting, setAppSetting } from '@/lib/db';
import { testGeminiModel, getGenAI, safeGenerateContent, getActiveFlashModel } from '@/ai/genai-client';
import { updateGenkitActiveModel } from '@/ai/genkit';
import { initializeCampaign as initializeCampaignFlow } from '@/ai/flows/initialize-campaign';
import { extractEntities as extractEntitiesFlow } from '@/ai/flows/extract-entities';
import { generateNextSession as generateNextSessionFlow } from '@/ai/flows/generate-next-session';
import { summarizeCampaign as summarizeCampaignFlow } from '@/ai/flows/summarize-campaign';
import { summarizeArc as summarizeArcFlow } from '@/ai/flows/summarize-arc-flow';
import { generateMap as generateMapFlow, type GenerateMapInput } from '@/ai/flows/generate-map';
import { catalogHandbook as catalogHandbookFlow } from '@/ai/flows/catalog-handbook';
import { generateShop as generateShopFlow } from '@/ai/flows/generate-shop';
import { generateLocation as generateLocationFlow } from '@/ai/flows/generate-location';
import { generateNpc as generateNpcFlow } from '@/ai/flows/generate-npc';
import { generateCombat as generateCombatFlow } from '@/ai/flows/generate-combat';
import { generateTreasure as generateTreasureFlow } from '@/ai/flows/generate-treasure';
import { quickImprov as quickImprovFlow } from '@/ai/flows/quick-improv';
import { updateNpcIdentity as updateNpcIdentityFlow } from '@/ai/flows/update-npc-identity';
import { deepNpcElaboration as deepNpcElaborationFlow } from '@/ai/flows/deep-npc-elaboration';
import { extractLore } from '@/ai/flows/extract-lore';
import { expandLore, refineLoreDraft } from '@/ai/flows/expand-lore';
import { consolidateAndDeduplicateLore, synthesizeInboxNotes } from '@/ai/flows/consolidate-lore';
import { formatNarrativeText, formatTitleOrTag } from '@/lib/formatter';
import type { Session, CampaignWithRelations, Campaign, MagicItem, Monster, PlayerCharacter, Spell, Skill, LetterPreset, Shop, WorldLocation, Npc, NpcDetails, Combat, CombatDetails, GenerateCombatInput, GenerateNpcInput, GenerateShopInput, GenerateLocationInput, Reward, GenerateTreasureInput, CharacterEvent, StoryArc, HomebrewRule, ApiStats, LoreEntry, LoreVersion, GranularQuestConfig, PcXpAward } from '@/lib/types';
import { getLevelFromXp } from '@/lib/dnd5e-xp';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

// --- UTILITY PERCORSI PERSISTENTI ---

function getAssetDir() {
    const baseDir = process.env.DATABASE_URL 
        ? path.dirname(process.env.DATABASE_URL.replace('file:', '')) 
        : path.join(process.cwd(), 'data');
    
    const assetDir = path.join(baseDir, 'assets');
    if (!fs.existsSync(assetDir)) {
        fs.mkdirSync(assetDir, { recursive: true });
    }
    return assetDir;
}

export async function deleteAssetAction(filename: string) {
    try {
        const assetDir = getAssetDir();
        const filePath = path.join(assetDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return actionResponse({ success: true });
        }
        return actionResponse(null, "File non trovato.");
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

function deleteAssetFile(imageUrl: string | null | undefined) {
    if (!imageUrl || !imageUrl.startsWith('/api/assets/')) return;
    try {
        const filename = imageUrl.replace('/api/assets/', '').split('?')[0];
        const assetDir = getAssetDir();
        const filePath = path.join(assetDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.error("[Cleanup] Error deleting file:", e);
    }
}

export async function listAssetsAction() {
    try {
        const dir = getAssetDir();
        if (!fs.existsSync(dir)) return actionResponse([]);

        // Garantisce che i preset precaricati siano sempre sincronizzati nella cartella persistente
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
        ];
        presetFiles.forEach(pf => {
            const dest = path.join(dir, pf);
            if (!fs.existsSync(dest)) {
                for (const sd of candidateSourceDirs) {
                    const src = path.join(sd, pf);
                    if (fs.existsSync(src)) {
                        try {
                            fs.copyFileSync(src, dest);
                            break;
                        } catch {}
                    }
                }
            }
        });

        const files = fs.readdirSync(dir);
        const stats = files.map(f => {
            const filePath = path.join(dir, f);
            const s = fs.statSync(filePath);
            return {
                name: f,
                size: s.size,
                createdAt: s.mtime.toISOString(),
                url: `/api/assets/${f}`
            };
        });
        stats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return actionResponse(stats);
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

let aiCooldownUntil: number = 0;

async function logApiUsage(service: string, status: 'success' | 'error') {
    try {
        db.prepare("INSERT INTO ApiUsage (service, status) VALUES (?, ?)").run(service, status);
    } catch (e) {
        console.error("[UsageLog] Error:", e);
    }
}

async function runAiWithRetry<T>(aiCall: () => Promise<T>, serviceName: string, maxRetries = 5): Promise<T> {
    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await aiCall();
            await logApiUsage(serviceName, 'success');
            return result;
        } catch (error: any) {
            lastError = error;
            const errorStr = String(error?.message || error || '').toLowerCase();
            await logApiUsage(serviceName, 'error');

            const retryablePatterns = ['503', 'service unavailable', '429', 'too many requests', 'quota', 'high demand', 'overloaded', 'resource exhausted', 'deadline exceeded'];
            const isRetryable = retryablePatterns.some(p => errorStr.includes(p));

            if (isRetryable && i < maxRetries - 1) {
                // Estraggo il tempo esatto di attesa per il reset della quota se specificato (es. "retry in 39s")
                const match = errorStr.match(/retry in (\d+(?:\.\d+)?)s/i);
                let waitTime = 2000 * (i + 1) + (Math.random() * 1000);
                if (match) {
                    waitTime = Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 1500, 45000);
                    console.warn(`[AI Retry ${i + 1}/${maxRetries}] Quota superata. Attesa sblocco di ${Math.round(waitTime / 1000)}s...`);
                } else {
                    const nextModel = fallbackModels[(i + 1) % fallbackModels.length];
                    try {
                        updateGenkitActiveModel(nextModel);
                        console.warn(`[AI Retry ${i + 1}/${maxRetries}] Cambio modello a: ${nextModel}`);
                    } catch {}
                }

                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

const actionResponse = <T>(data: T | null, error?: string) => {
    if (error) return { success: false, data: null, error };
    return { success: true, data, error: null };
}

async function getActiveHomebrewRulesString(campaignId: string): Promise<string> {
    try {
        const rules = db.prepare("SELECT title, content FROM HomebrewRule WHERE campaignId = ? AND isActive = 1").all(campaignId) as any[];
        if (rules.length === 0) return "";
        return rules.map(r => `Regola: ${r.title}\nDescrizione: ${r.content}`).join('\n\n');
    } catch (e) {
        console.error("Error fetching homebrew rules:", e);
        return "";
    }
}

async function getSystemOverride(slug: string): Promise<string | undefined> {
    try {
        const prompt = db.prepare("SELECT content FROM SystemPrompt WHERE slug = ?").get(slug) as { content: string };
        return prompt?.content;
    } catch (e) {
        return undefined;
    }
}

export async function getApiUsageStats(): Promise<{ success: boolean; data: ApiStats[] | null; error: string | null }> {
    try {
        const services = ['STORY', 'SUMMARY', 'SHOPS', 'WORLD', 'EXTRACTION', 'IMPORT'];
        const stats: ApiStats[] = [];
        for (const s of services) {
            const rpm = db.prepare("SELECT COUNT(*) as count FROM ApiUsage WHERE service = ? AND timestamp > datetime('now', '-1 minute')").get(s) as { count: number };
            const rpd = db.prepare("SELECT COUNT(*) as count FROM ApiUsage WHERE service = ? AND timestamp > datetime('now', '-24 hours')").get(s) as { count: number };
            const lastStatus = db.prepare("SELECT status FROM ApiUsage WHERE service = ? ORDER BY timestamp DESC LIMIT 1").get(s) as { status: string };
            stats.push({ service: s, rpm: rpm.count, rpd: rpd.count, status: lastStatus?.status || 'N/A' });
        }
        return actionResponse(stats);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function getSystemStatus() {
    const keys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_STORY', 'GEMINI_API_KEY_SUMMARY', 'GEMINI_API_KEY_SHOPS', 'GEMINI_API_KEY_WORLD', 'GEMINI_API_KEY_EXTRACTION', 'GEMINI_API_KEY_IMPORT'];
    const status = keys.map(k => {
        const val = (process.env[k] || '').trim();
        const isValid = val !== '' && val !== 'tua_chiave_qui' && val !== 'undefined';
        return { name: k, configured: isValid, preview: isValid ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}` : 'Non impostata' };
    });
    return actionResponse(status);
}

// --- CONFIGURAZIONE DINAMICA MODELLO IA ---

export interface PresetModelItem {
    id: string;
    label: string;
    category?: 'recommended' | 'current' | 'pointer' | 'legacy' | 'custom';
    description: string;
    badge?: string;
    badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

const DEFAULT_PRESET_MODELS: PresetModelItem[] = [
    {
        id: 'gemini-3.8-flash',
        label: 'Gemini 3.8 Flash',
        category: 'recommended',
        description: 'Ultima generazione Flash. Ottimizzato per rapidità fulminea, finestre di contesto estese e reasoning avanzato.',
        badge: 'Consigliato (Gen 3.8)',
        badgeVariant: 'default'
    },
    {
        id: 'gemini-3.7-flash',
        label: 'Gemini 3.7 Flash',
        category: 'current',
        description: 'Modello Flash di terza generazione ad alto throughput, bilanciato e stabile.',
        badge: 'Stabile (Gen 3.7)',
        badgeVariant: 'secondary'
    },
    {
        id: 'gemini-3.5-flash',
        label: 'Gemini 3.5 Flash',
        category: 'current',
        description: 'Versione standard GA raccomandata ufficialmente da Google come sostituto a lungo termine di 2.5.',
        badge: 'Standard GA',
        badgeVariant: 'secondary'
    },
    {
        id: 'gemini-flash-latest',
        label: 'Gemini Flash Latest',
        category: 'pointer',
        description: 'Alias dinamico fornito da Google che punta sempre automaticamente alla versione Flash più recente.',
        badge: 'Auto-Update',
        badgeVariant: 'outline'
    },
    {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        category: 'legacy',
        description: 'Generazione precedente. Dismissione programmata da Google a metà Ottobre 2026.',
        badge: 'In Dismissione',
        badgeVariant: 'destructive'
    }
];

function getStoredModelsList(): PresetModelItem[] {
    try {
        const saved = getAppSetting('ai_models_list');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {}
    return DEFAULT_PRESET_MODELS;
}

export async function getSectionAiModelsConfigAction() {
    'use server';
    try {
        const services = ['STORY', 'WORLD', 'SHOPS', 'IMPORT', 'EXTRACTION'];
        const sectionModels: Record<string, string> = {};
        
        for (const s of services) {
            const saved = getAppSetting(`model_service_${s}`);
            sectionModels[s] = (saved && saved.trim()) ? saved.trim() : 'default';
        }

        const globalSaved = getAppSetting('active_ai_model');
        const globalActiveModel = (globalSaved && globalSaved.trim()) || process.env.GEMINI_FLASH_MODEL || 'gemini-3.8-flash';
        const models = getStoredModelsList();

        return actionResponse({
            sectionModels,
            globalActiveModel,
            models
        });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function saveSectionAiModelsConfigAction(sectionModels: Record<string, string>) {
    'use server';
    try {
        const services = ['STORY', 'WORLD', 'SHOPS', 'IMPORT', 'EXTRACTION'];
        for (const s of services) {
            const val = sectionModels[s] ? sectionModels[s].trim() : 'default';
            setAppSetting(`model_service_${s}`, val);
        }
        return actionResponse({ success: true, sectionModels });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function getAiModelConfigAction() {
    try {
        const saved = getAppSetting('active_ai_model');
        const activeModel = (saved && saved.trim()) || process.env.GEMINI_FLASH_MODEL || 'gemini-3.8-flash';
        const models = getStoredModelsList();

        return actionResponse({
            activeModel,
            isCustom: !models.some(m => m.id === activeModel),
            source: saved ? 'database' : (process.env.GEMINI_FLASH_MODEL ? 'env' : 'default'),
            models
        });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function saveAiModelConfigAction(modelName: string) {
    try {
        if (!modelName || !modelName.trim()) {
            return actionResponse(null, "Il nome del modello non può essere vuoto.");
        }
        const cleanName = modelName.trim().replace(/^googleai\//i, '');
        // Salva nel database SQLite in modo permanente
        setAppSetting('active_ai_model', cleanName);
        // Sincronizza variabile d'ambiente per il processo corrente
        process.env.GEMINI_FLASH_MODEL = cleanName;
        // Aggiorna a caldo tutte le istanze Genkit in memoria
        updateGenkitActiveModel(cleanName);

        // Se il modello non è ancora presente nella lista, aggiungilo automaticamente
        let models = getStoredModelsList();
        if (!models.some(m => m.id.toLowerCase() === cleanName.toLowerCase())) {
            const newModel: PresetModelItem = {
                id: cleanName,
                label: cleanName,
                category: 'custom',
                description: 'Modello personalizzato aggiunto manualmente.',
                badge: 'Personalizzato',
                badgeVariant: 'outline'
            };
            models = [...models, newModel];
            setAppSetting('ai_models_list', JSON.stringify(models));
        }

        return actionResponse({ success: true, activeModel: cleanName, models });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function addCustomAiModelAction(modelId: string, label?: string, description?: string) {
    try {
        if (!modelId || !modelId.trim()) {
            return actionResponse(null, "Specificare un identificativo di modello valido.");
        }
        const cleanId = modelId.trim().replace(/^googleai\//i, '');
        let models = getStoredModelsList();

        const existing = models.find(m => m.id.toLowerCase() === cleanId.toLowerCase());
        if (existing) {
            return actionResponse({ success: true, models, model: existing, alreadyExisted: true });
        }

        const newModel: PresetModelItem = {
            id: cleanId,
            label: label?.trim() || cleanId,
            category: 'custom',
            description: description?.trim() || 'Modello personalizzato aggiunto manualmente.',
            badge: 'Personalizzato',
            badgeVariant: 'outline'
        };

        models = [...models, newModel];
        setAppSetting('ai_models_list', JSON.stringify(models));

        return actionResponse({ success: true, models, model: newModel, alreadyExisted: false });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function deleteAiModelAction(modelId: string) {
    try {
        if (!modelId || !modelId.trim()) {
            return actionResponse(null, "Identificativo modello non valido.");
        }
        const cleanId = modelId.trim();
        let models = getStoredModelsList();

        const filtered = models.filter(m => m.id.toLowerCase() !== cleanId.toLowerCase());
        if (filtered.length === 0) {
            return actionResponse(null, "Impossibile eliminare tutti i modelli. Deve rimanere almeno un modello nella lista.");
        }

        setAppSetting('ai_models_list', JSON.stringify(filtered));

        // Se era il modello attivo, imposta come attivo il primo rimasto
        const currentActive = getAppSetting('active_ai_model') || 'gemini-3.8-flash';
        let newActive = currentActive;
        if (currentActive.toLowerCase() === cleanId.toLowerCase()) {
            newActive = filtered[0].id;
            setAppSetting('active_ai_model', newActive);
            process.env.GEMINI_FLASH_MODEL = newActive;
            updateGenkitActiveModel(newActive);
        }

        return actionResponse({ success: true, models: filtered, activeModel: newActive });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function testAiModelAction(modelName: string) {
    try {
        if (!modelName || !modelName.trim()) {
            return actionResponse(null, "Nome del modello non valido.");
        }
        const res = await testGeminiModel(modelName.trim());
        if (!res.success) {
            return actionResponse(null, res.error || "Errore sconosciuto durante il test del modello.");
        }
        return actionResponse(res);
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

// --- ADAPTIVE DB HELPERS ---
function getTableCols(tableName: string) {
    try {
        return (db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map(c => c.name.toLowerCase());
    } catch (e) {
        return [];
    }
}

// --- AZIONI CAMPAGNA ---

export async function createCampaign(data: { name: string; setting: string; description?: string | null; }) {
    try {
        const campaignId = randomUUID();
        const arcId = randomUUID();
        const now = new Date().toISOString();
        const campaignCols = getTableCols('Campaign');
        const hasCampaignDates = campaignCols.includes('createdat');

        db.transaction(() => {
            if (hasCampaignDates) {
                db.prepare(`INSERT INTO Campaign (id, name, setting, description, summary, active_arc_label, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(campaignId, data.name, data.setting, data.description || null, "In attesa di inizializzazione...", "Arco Narrativo Attivo", now, now);
            } else {
                db.prepare(`INSERT INTO Campaign (id, name, setting, description, summary, active_arc_label) VALUES (?, ?, ?, ?, ?, ?)`).run(campaignId, data.name, data.setting, data.description || null, "In attesa di inizializzazione...", "Arco Narrativo Attivo");
            }
            db.prepare(`INSERT INTO StoryArc (id, campaignId, title, status, order_index, createdAt, updatedAt) VALUES (?, ?, ?, 'active', 0, ?, ?)`).run(arcId, campaignId, "Atto Iniziale", now, now);
        })();
        return actionResponse({ campaign: { id: campaignId }, progress: "La tua cronaca è stata creata correttamente!" });
    } catch (error: any) { return actionResponse(null, `Errore Salvataggio: ${error.message}`); }
}

export async function updateCampaignInfo(campaignId: string, name: string, setting: string) {
    try {
        const campaignCols = getTableCols('Campaign');
        const hasUpdatedAt = campaignCols.includes('updatedat');
        if (hasUpdatedAt) {
            db.prepare("UPDATE Campaign SET name = ?, setting = ?, updatedAt = ? WHERE id = ?").run(name, setting, new Date().toISOString(), campaignId);
        } else {
            db.prepare("UPDATE Campaign SET name = ?, setting = ? WHERE id = ?").run(name, setting, campaignId);
        }
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteCampaign(campaignId: string) {
    try {
        const pcs = db.prepare("SELECT imageUrl FROM PlayerCharacter WHERE campaignId = ?").all(campaignId) as { imageUrl: string }[];
        pcs.forEach(pc => deleteAssetFile(pc.imageUrl));
        
        const npcs = db.prepare("SELECT details FROM Npc WHERE campaignId = ?").all(campaignId) as { details: string }[];
        npcs.forEach(npc => {
            const d = JSON.parse(npc.details);
            deleteAssetFile(d.imageUrl);
        });

        const items = db.prepare("SELECT imageUrl FROM MagicItem WHERE campaignId = ?").all(campaignId) as { imageUrl: string }[];
        items.forEach(i => deleteAssetFile(i.imageUrl));

        const monsters = db.prepare("SELECT imageUrl FROM Monster WHERE campaignId = ?").all(campaignId) as { imageUrl: string }[];
        monsters.forEach(m => deleteAssetFile(m.imageUrl));

        db.prepare("DELETE FROM Campaign WHERE id = ?").run(campaignId);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function initializeAiSummary(campaignId: string) {
    try {
        const campaign = db.prepare("SELECT * FROM Campaign WHERE id = ?").get(campaignId) as Campaign;
        if (!campaign) throw new Error("Campagna non trovata.");
        const aiResult = await runAiWithRetry(() => initializeCampaignFlow({ campaignName: campaign.name, setting: campaign.setting, description: campaign.description || undefined }), 'STORY');
        const campaignCols = getTableCols('Campaign');
        const hasUpdatedAt = campaignCols.includes('updatedat');
        if (hasUpdatedAt) {
            db.prepare("UPDATE Campaign SET summary = ?, updatedAt = ? WHERE id = ?").run(aiResult.initial_summary, new Date().toISOString(), campaignId);
        } else {
            db.prepare("UPDATE Campaign SET summary = ? WHERE id = ?").run(aiResult.initial_summary, campaignId);
        }
        return actionResponse({ summary: aiResult.initial_summary });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function summarizeCampaign(campaignId: string) {
    try {
        const sessions = db.prepare("SELECT session_number, title, notes FROM Session WHERE campaignId = ? AND is_archived = 0 ORDER BY session_number ASC").all(campaignId) as any[];
        if (sessions.length === 0) return actionResponse({ success: true });
        const history = sessions.map(s => `Sessione ${s.session_number}: ${s.title}\n${s.notes}`).join('\n---\n');
        const override = await getSystemOverride('summary-campaign');
        const result = await runAiWithRetry(() => summarizeCampaignFlow({ campaignHistory: history, systemOverride: override }), 'SUMMARY');
        const campaignCols = getTableCols('Campaign');
        const hasUpdatedAt = campaignCols.includes('updatedat');
        if (hasUpdatedAt) {
            db.prepare("UPDATE Campaign SET summary = ?, updatedAt = ? WHERE id = ?").run(result.summary, new Date().toISOString(), campaignId);
        } else {
            db.prepare("UPDATE Campaign SET summary = ? WHERE id = ?").run(result.summary, campaignId);
        }
        return actionResponse({ success: true });
    } catch (error: any) { return actionResponse(null, error.message); }
}

// --- AZIONI BIBLIOTECA ---

export async function generateArcSummaryAction(arcId: string, sessionIds: string[]) {
    try {
        const arc = db.prepare("SELECT * FROM StoryArc WHERE id = ?").get(arcId) as StoryArc;
        if (!arc) throw new Error("Arco non trovato.");
        const placeholders = sessionIds.map(() => '?').join(',');
        const sessionsToSummarize = db.prepare(`SELECT session_number, title, notes FROM Session WHERE id IN (${placeholders}) ORDER BY session_number ASC`).all(...sessionIds) as any[];
        const override = await getSystemOverride('summary-arc');
        const result = await runAiWithRetry(() => summarizeArcFlow({ arcTitle: arc.title, existingSummary: arc.summary || undefined, sessions: sessionsToSummarize.map(s => ({ sessionNumber: s.session_number, title: s.title, notes: s.notes || '' })), campaignContext: (db.prepare("SELECT global_compendium FROM Campaign WHERE id = ?").get(arc.campaignId) as any)?.global_compendium || undefined, systemOverride: override }), 'SUMMARY');
        
        const campaignCols = getTableCols('Campaign');
        const hasCampaignUpdatedAt = campaignCols.includes('updatedat');

        db.transaction(() => {
            const now = new Date().toISOString();
            db.prepare("UPDATE StoryArc SET title = ?, summary = ?, world_impact = ?, updatedAt = ? WHERE id = ?").run(result.newTitle, result.summary, result.worldImpact, now, arcId);
            const updateSession = db.prepare("UPDATE Session SET is_summarized = 1, updatedAt = ? WHERE id = ?");
            sessionIds.forEach(id => updateSession.run(now, id));
            
            if (arc.status === 'active') {
                if (hasCampaignUpdatedAt) {
                    db.prepare("UPDATE Campaign SET summary = ?, updatedAt = ? WHERE id = ?").run(result.summary, now, arc.campaignId);
                } else {
                    db.prepare("UPDATE Campaign SET summary = ? WHERE id = ?").run(result.summary, arc.campaignId);
                }
            }
            
            const allArchived = db.prepare("SELECT title, summary, world_impact FROM StoryArc WHERE campaignId = ? AND status = 'archived' AND summary IS NOT NULL ORDER BY order_index ASC").all(arc.campaignId) as any[];
            const newCompendium = allArchived.length > 0 ? allArchived.map(a => `### ${a.title}\n${a.summary}\n\n**Impatto:**\n${a.world_impact || 'Nessuna nota.'}`).join('\n\n---\n\n') : null;
            db.prepare("UPDATE Campaign SET global_compendium = ? WHERE id = ?").run(newCompendium, arc.campaignId);
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function getStoryArcs(campaignId: string) {
    try {
        const arcs = db.prepare("SELECT * FROM StoryArc WHERE campaignId = ? ORDER BY order_index ASC, createdAt ASC").all(campaignId) as StoryArc[];
        return actionResponse(arcs);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateStoryArc(arcId: string, title: string, summary: string, worldImpact: string) {
    try {
        db.prepare("UPDATE StoryArc SET title = ?, summary = ?, world_impact = ?, updatedAt = ? WHERE id = ?").run(title, summary, worldImpact, new Date().toISOString(), arcId);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteStoryArc(arcId: string) {
    try {
        const arc = db.prepare("SELECT * FROM StoryArc WHERE id = ?").get(arcId) as StoryArc;
        if (!arc) throw new Error("Arco non trovato.");
        const campaignId = arc.campaignId;
        const now = new Date().toISOString();
        const campaignCols = getTableCols('Campaign');
        const hasCampaignUpdatedAt = campaignCols.includes('updatedat');

        db.transaction(() => {
            if (arc.status === 'active') {
                db.prepare("UPDATE StoryArc SET summary = NULL, world_impact = NULL, updatedAt = ? WHERE id = ?").run(now, arcId);
                db.prepare("UPDATE Session SET is_summarized = 0, updatedAt = ? WHERE arcId = ?").run(now, arcId);
                if (hasCampaignUpdatedAt) {
                    db.prepare("UPDATE Campaign SET summary = NULL, updatedAt = ? WHERE id = ?").run(now, campaignId);
                } else {
                    db.prepare("UPDATE Campaign SET summary = NULL WHERE id = ?").run(campaignId);
                }
            } else {
                const activeArc = db.prepare("SELECT id FROM StoryArc WHERE campaignId = ? AND status = 'active'").get(campaignId) as { id: string };
                if (activeArc) db.prepare("UPDATE Session SET arcId = ?, is_archived = 0, is_summarized = 0, updatedAt = ? WHERE arcId = ?").run(activeArc.id, now, arcId);
                db.prepare("DELETE FROM StoryArc WHERE id = ?").run(arcId);
            }
            const allRemaining = db.prepare("SELECT title, summary, world_impact FROM StoryArc WHERE campaignId = ? AND status = 'archived' AND summary IS NOT NULL ORDER BY order_index ASC").all(campaignId) as any[];
            const newCompendium = allRemaining.length > 0 ? allRemaining.map(a => `### ${a.title}\n${a.summary}\n\n**Impatto:**\n${a.world_impact || 'Nessuna nota.'}`).join('\n\n---\n\n') : null;
            if (hasCampaignUpdatedAt) {
                db.prepare("UPDATE Campaign SET global_compendium = ?, updatedAt = ? WHERE id = ?").run(newCompendium, now, campaignId);
            } else {
                db.prepare("UPDATE Campaign SET global_compendium = ? WHERE id = ?").run(newCompendium, campaignId);
            }
        })();
        return actionResponse({ success: true });
    } catch (error: any) { return actionResponse(null, error.message); }
}

export async function getArchiveSessions(arcId: string) {
    try {
        const sessions = db.prepare("SELECT * FROM Session WHERE arcId = ? ORDER BY session_number ASC, createdAt ASC").all(arcId) as Session[];
        return actionResponse(sessions);
    } catch (e: any) { return actionResponse(null, e.message); }
}

// --- AZIONI SESSIONI (ADAPTIVE) ---

export async function confirmSession(sessionData: any, campaignId: string) {
    try {
        const activeArc = db.prepare("SELECT id FROM StoryArc WHERE campaignId = ? AND status = 'active'").get(campaignId) as { id: string };
        const id = randomUUID();
        const now = new Date().toISOString();
        
        const cols = getTableCols('Session');
        const data: Record<string, any> = {
            id,
            session_number: sessionData.session_number,
            title: formatTitleOrTag(sessionData.title) || `Sessione ${sessionData.session_number}`,
            notes: formatNarrativeText(sessionData.notes),
            xp_award: sessionData.xp_award || 0,
            source: sessionData.source,
            campaignId,
            arcId: activeArc?.id || null,
            createdAt: now,
            updatedAt: now,
            is_read: 0,
            loot_scanned: 0,
            is_archived: 0,
            is_summarized: 0
        };

        const insertCols = Object.keys(data).filter(c => cols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const values = insertCols.map(c => data[c]);

        db.prepare(`INSERT INTO Session (${insertCols.join(',')}) VALUES (${placeholders})`).run(...values);
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function createSession(sessionData: any) {
    try {
        const campaignId = sessionData.campaignId;
        if (!campaignId) throw new Error("campaignId mancante.");
        return await confirmSession(sessionData, campaignId);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function importSession(notes: string, title: string, campaignId: string, session_number: number) {
    try {
        const activeArc = db.prepare("SELECT id FROM StoryArc WHERE campaignId = ? AND status = 'active'").get(campaignId) as { id: string };
        const id = randomUUID();
        const now = new Date().toISOString();
        
        const cols = getTableCols('Session');
        const data: Record<string, any> = {
            id,
            session_number,
            title: formatTitleOrTag(title) || `Sessione ${session_number}`,
            notes: formatNarrativeText(notes),
            source: 'imported',
            campaignId,
            arcId: activeArc?.id || null,
            createdAt: now,
            updatedAt: now,
            is_read: 0,
            loot_scanned: 0,
            is_archived: 0,
            is_summarized: 0
        };

        const insertCols = Object.keys(data).filter(c => cols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const values = insertCols.map(c => data[c]);

        db.prepare(`INSERT INTO Session (${insertCols.join(',')}) VALUES (${placeholders})`).run(...values);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function generateNextSession(campaign: CampaignWithRelations, recentSessions: Session[], prompt: string, modification?: { storyToModify: string, request: string }) {
    try {
        const playerCharactersJson = JSON.stringify(campaign.playerCharacters || []);
        const recentSummary = recentSessions.slice(-3).map(s => `Sess ${s.session_number}: ${s.title}\n${s.notes}`).join('\n---\n');
        const homebrewContext = await getActiveHomebrewRulesString(campaign.id);
        const override = await getSystemOverride('story-gen');
        
        const loreEntries = campaign.loreEntries || [];
        const loreContext = loreEntries.length > 0 
            ? loreEntries.map(l => `### [${l.category.toUpperCase()}] ${l.title}${l.subtitle ? ` - ${l.subtitle}` : ''}\n${l.content}`).join('\n\n---\n\n')
            : undefined;

        const result = await runAiWithRetry(() => generateNextSessionFlow({ campaignName: campaign.name, campaignSetting: campaign.setting, campaignSummary: campaign.summary || undefined, recentSessionsSummary: recentSummary || "Inizio campagna.", playerCharacters: playerCharactersJson, customPrompt: prompt, storyToModify: modification?.storyToModify, modificationRequest: modification?.request, homebrewRules: homebrewContext || undefined, loreContext, systemOverride: override }), 'STORY');
        return actionResponse(result);
    } catch (error: any) { return actionResponse(null, error.message); }
}

export async function generateGranularQuestAction(
    config: GranularQuestConfig,
    modification?: { storyToModify: string; request: string }
) {
    try {
        const campaign = db.prepare("SELECT * FROM Campaign WHERE id = ?").get(config.campaignId) as Campaign;
        if (!campaign) throw new Error("Campagna non trovata.");

        // Build PCs list based on granular selection
        const allPcs = db.prepare("SELECT * FROM PlayerCharacter WHERE campaignId = ?").all(config.campaignId) as PlayerCharacter[];
        const selectedPcsData = (config.selectedPcs || []).map(spc => {
            const fullPc = allPcs.find(p => p.id === spc.pcId);
            if (!fullPc) return null;
            const pcInfo: Record<string, any> = {
                id: fullPc.id,
                name: fullPc.name,
                race: fullPc.race,
                class: fullPc.class,
                archetype: fullPc.archetype,
                level: fullPc.level,
            };
            if (spc.includeStats) {
                pcInfo.stats = {
                    FOR: fullPc.strength,
                    DES: fullPc.dexterity,
                    COS: fullPc.constitution,
                    INT: fullPc.intelligence,
                    SAG: fullPc.wisdom,
                    CAR: fullPc.charisma,
                    CA: fullPc.armorClass,
                    PF: fullPc.hitPoints
                };
            }
            if (spc.includeIdeals && fullPc.ideals) pcInfo.ideals = fullPc.ideals;
            if (spc.includeBonds && fullPc.bonds) pcInfo.bonds = fullPc.bonds;
            if (spc.includeFlaws && fullPc.flaws) pcInfo.flaws = fullPc.flaws;
            if (spc.includeSpellsAndSkills) {
                if (fullPc.skills) pcInfo.skills = fullPc.skills;
                if (fullPc.spells) pcInfo.spells = fullPc.spells;
            }
            if (spc.customFocus) pcInfo.customMasterFocus = spc.customFocus;
            return pcInfo;
        }).filter(Boolean);

        // Build Granular Directives text
        const directives: string[] = [];

        // 1. Tono, Ritmo e Difficoltà
        directives.push(`### 1. IMPOSTAZIONI NARRATIVE & STRUTTURA:
- **Tono Narrativo:** ${config.narrativeTone || 'Epico ed Eroico'}
- **Tipologia Prevalente d'Incontro:** ${config.primaryEncounterType || 'Bilanciato'}
- **Grado di Sfida / Difficoltà:** ${config.targetDifficulty || 'Medio'}
- **Ritmo / Pacing:** ${config.pacingSpeed || 'Regolare'}
- **Colpi di Scena:** ${config.plotTwistLikelihood || 'Colpo di Scena Moderato'}`);

        if (config.specificThreatsOrMonsters) {
            directives.push(`- **Mostri / Minacce Specifiche Richieste:** ${config.specificThreatsOrMonsters}`);
        }

        // 2. PNG Selezionati e loro Ruolo
        if (config.selectedNpcs && config.selectedNpcs.length > 0) {
            const roleLabels: Record<string, string> = {
                'amico': 'Alleato / Amico sincero',
                'nemico': 'Antagonista / Nemico dichiarato',
                'doppiogiochista': 'Doppiogiochista / Traditore in incognito',
                'da_amico_a_nemico': 'Evoluzione: da Amico a Nemico (voltafaccia o corruzione)',
                'da_nemico_a_amico': 'Evoluzione: da Nemico ad Amico (redenzione o alleanza forzata)',
                'compagno_party': 'Spalla temporanea / Compagno di party'
            };
            const npcsText = config.selectedNpcs.map(n => 
                `- **${n.name}**: Ruolo: [${roleLabels[n.role] || n.role}]${n.customGoal ? ` - Obiettivo/Note: ${n.customGoal}` : ''}`
            ).join('\n');
            directives.push(`### 2. RUOLI SPECIFICI DEI PNG NELLA QUEST:\n${npcsText}`);
        }

        // 3. Oggetti & Armi
        if (config.selectedItems && config.selectedItems.length > 0) {
            const itemRoleLabels: Record<string, string> = {
                'necessario': 'Oggetto Chiave (Necessario per avanzare / risolvere la quest)',
                'trovato': 'Ricompensa / Trovato durante l\'avventura',
                'rubato': 'Oggetto Rubato / Sottratto da recuperare o difendere',
                'in_possesso': 'In possesso del party (da sfruttare attivamente)'
            };
            const itemsText = config.selectedItems.map(i => 
                `- **${i.name}**: Ruolo: [${itemRoleLabels[i.role] || i.role}]${i.notes ? ` - Note: ${i.notes}` : ''}`
            ).join('\n');
            directives.push(`### 3. OGGETTI & ARMI COINVOLTI:\n${itemsText}`);
        }

        // 4. Magie & Abilità
        if ((config.selectedSpells && config.selectedSpells.length > 0) || (config.selectedSkills && config.selectedSkills.length > 0)) {
            const spellsList = (config.selectedSpells || []).map(s => `- Incantesimo: **${s.name}** (Utilizzo/Ruolo: ${s.context})`).join('\n');
            const skillsList = (config.selectedSkills || []).map(sk => `- Abilità/Prova: **${sk.name}** (Tipo di test: ${sk.context})`).join('\n');
            directives.push(`### 4. MAGIE & ABILITÀ DA METTERE ALLA PROVA / VALORIZZARE:\n${[spellsList, skillsList].filter(Boolean).join('\n')}`);
        }

        // 5. Luoghi & Ambientazione
        if (config.selectedLocations && config.selectedLocations.length > 0) {
            const locText = config.selectedLocations.map(l => 
                `- **${l.name}** (Ruolo: ${l.role}${l.atmosphere ? ` | Atmosfera: ${l.atmosphere}` : ''})`
            ).join('\n');
            directives.push(`### 5. LUOGHI & AMBIENTAZIONI SPECIFICHE:\n${locText}`);
        }

        // 6. Agganci a Quest / Sessioni Precedenti
        if (config.previousQuestLinks && config.previousQuestLinks.length > 0) {
            const linkTypeLabels: Record<string, string> = {
                'conseguenza_diretta': 'Conseguenza diretta delle azioni passate',
                'gancio_irrisolto': 'Ripresa di un mistero o promessa irrisolta',
                'vendetta_o_debito': 'Vendetta di un superstite o riscossione di un debito',
                'ritorno_sul_luogo': 'Ritorno su un luogo già visitato in mutate condizioni'
            };
            const linksText = config.previousQuestLinks.map(l => 
                `- **Sessione ${l.sessionNumber} (${l.title})**: Tipo di aggancio: [${linkTypeLabels[l.linkType] || l.linkType}]${l.customHookNote ? ` - Note: ${l.customHookNote}` : ''}`
            ).join('\n');
            directives.push(`### 6. AGGANCI A SESSIONI & QUEST PRECEDENTI:\n${linksText}`);
        }

        // Prepare context
        let campaignSummaryContext: string | undefined = undefined;
        if (config.includeCampaignSummary) {
            campaignSummaryContext = campaign.summary || undefined;
        }

        let recentSessionsText: string | undefined = undefined;
        if (config.includeRecentSessionsSummary) {
            const recentSessions = db.prepare("SELECT session_number, title, notes FROM Session WHERE campaignId = ? AND is_archived = 0 ORDER BY session_number DESC LIMIT 3").all(config.campaignId) as any[];
            if (recentSessions.length > 0) {
                recentSessionsText = recentSessions.reverse().map(s => `Sess ${s.session_number}: ${s.title}\n${s.notes}`).join('\n---\n');
            }
        }

        let loreContext: string | undefined = undefined;
        if (config.includeGlobalLore) {
            const loreEntries = db.prepare("SELECT title, category, subtitle, content FROM LoreEntry WHERE campaignId = ?").all(config.campaignId) as any[];
            if (loreEntries.length > 0) {
                loreContext = loreEntries.map(l => `### [${l.category.toUpperCase()}] ${l.title}${l.subtitle ? ` - ${l.subtitle}` : ''}\n${l.content}`).join('\n\n---\n\n');
            }
        }

        let homebrewContext: string | undefined = undefined;
        if (config.includeHomebrewRules) {
            homebrewContext = await getActiveHomebrewRulesString(config.campaignId);
        }

        const override = await getSystemOverride('story-gen');

        const result = await runAiWithRetry(() => generateNextSessionFlow({
            campaignName: campaign.name,
            campaignSetting: campaign.setting,
            campaignSummary: campaignSummaryContext,
            recentSessionsSummary: recentSessionsText || "Continua l'avventura con la nuova quest.",
            playerCharacters: JSON.stringify(selectedPcsData.length > 0 ? selectedPcsData : allPcs),
            customPrompt: config.customPrompt || "Genera una nuova appassionante quest.",
            storyToModify: modification?.storyToModify,
            modificationRequest: modification?.request,
            homebrewRules: homebrewContext || undefined,
            loreContext,
            systemOverride: override,
            granularDirectives: directives.join('\n\n'),
        }), 'STORY');

        return actionResponse(result);
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function assignQuestXpToCharacters(campaignId: string, awards: PcXpAward[]) {
    try {
        const pcCols = getTableCols('PlayerCharacter');
        const hasUpdatedAt = pcCols.includes('updatedat');
        const hasXp = pcCols.includes('experiencepoints');
        const hasLevel = pcCols.includes('level');
        const now = new Date().toISOString();

        db.transaction(() => {
            for (const award of awards) {
                if (!award.pcId) continue;
                const setClauses: string[] = [];
                const params: any[] = [];

                if (hasXp) {
                    setClauses.push("experiencePoints = ?");
                    params.push(award.totalNewXp);
                }
                if (hasLevel && award.newLevel) {
                    setClauses.push("level = ?");
                    params.push(award.newLevel);
                }
                if (hasUpdatedAt) {
                    setClauses.push("updatedAt = ?");
                    params.push(now);
                }

                if (setClauses.length > 0) {
                    let query = `UPDATE PlayerCharacter SET ${setClauses.join(", ")} WHERE id = ?`;
                    params.push(award.pcId);
                    db.prepare(query).run(...params);
                }
            }
        })();

        const updatedPcs = db.prepare("SELECT * FROM PlayerCharacter WHERE campaignId = ? ORDER BY name ASC").all(campaignId) as PlayerCharacter[];
        return actionResponse(updatedPcs);
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function updateSessionMetadata(sessionId: string, title: string, num: number) {
    try {
        const cols = getTableCols('Session');
        const now = new Date().toISOString();
        let query = "UPDATE Session SET title = ?, session_number = ?";
        const params = [title, num];
        if (cols.includes('updatedat')) {
            query += ", updatedAt = ?";
            params.push(now);
        }
        query += " WHERE id = ?";
        params.push(sessionId);
        db.prepare(query).run(...params);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateSessionTitle(sessionId: string, title: string) {
    try {
        const cols = getTableCols('Session');
        let query = "UPDATE Session SET title = ?";
        const params = [title];
        if (cols.includes('updatedat')) {
            query += ", updatedAt = ?";
            params.push(new Date().toISOString());
        }
        query += " WHERE id = ?";
        params.push(sessionId);
        db.prepare(query).run(...params);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateSessionNumber(sessionId: string, num: number) {
    try {
        const cols = getTableCols('Session');
        let query = "UPDATE Session SET session_number = ?";
        const params: any[] = [num];
        if (cols.includes('updatedat')) {
            query += ", updatedAt = ?";
            params.push(new Date().toISOString());
        }
        query += " WHERE id = ?";
        params.push(sessionId);
        db.prepare(query).run(...params);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateSessionNotes(sessionId: string, newNotes: string) {
    try {
        const formattedNotes = formatNarrativeText(newNotes);
        const cols = getTableCols('Session');
        let query = "UPDATE Session SET notes = ?";
        const params = [formattedNotes];
        if (cols.includes('updatedat')) {
            query += ", updatedAt = ?";
            params.push(new Date().toISOString());
        }
        query += " WHERE id = ?";
        params.push(sessionId);
        db.prepare(query).run(...params);
        return actionResponse({ success: true, notes: formattedNotes });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateSessionXp(sessionId: string, xp: number) {
    try {
        const cols = getTableCols('Session');
        let query = "UPDATE Session SET xp_award = ?";
        const params: any[] = [xp];
        if (cols.includes('updatedat')) {
            query += ", updatedAt = ?";
            params.push(new Date().toISOString());
        }
        query += " WHERE id = ?";
        params.push(sessionId);
        db.prepare(query).run(...params);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function toggleSessionReadStatus(sessionId: string) {
    try {
        const cols = getTableCols('Session');
        let query = "UPDATE Session SET is_read = NOT is_read";
        const params = [];
        if (cols.includes('updatedat')) {
            query += ", updatedAt = ?";
            params.push(new Date().toISOString());
        }
        query += " WHERE id = ?";
        params.push(sessionId);
        db.prepare(query).run(...params);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteSession(sessionId: string) {
    try {
        db.prepare("DELETE FROM Session WHERE id = ?").run(sessionId);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function reorderSessions(orderedIds: string[]) {
    try {
        const placeholders = orderedIds.map(() => '?').join(',');
        const sessions = db.prepare(`SELECT id, session_number FROM Session WHERE id IN (${placeholders})`).all(...orderedIds) as { id: string, session_number: number }[];
        const sortedNumbers = sessions.map(s => s.session_number).sort((a, b) => a - b);
        db.transaction(() => {
            const now = new Date().toISOString();
            const cols = getTableCols('Session');
            const hasUpdatedAt = cols.includes('updatedat');
            let query = "UPDATE Session SET session_number = ?";
            if (hasUpdatedAt) query += ", updatedAt = ?";
            query += " WHERE id = ?";
            const updateStmt = db.prepare(query);
            orderedIds.forEach((id, idx) => {
                const params: any[] = [sortedNumbers[idx]];
                if (hasUpdatedAt) params.push(now);
                params.push(id);
                updateStmt.run(...params);
            });
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function resyncSessionNumbers(campaignId: string) {
    try {
        const sessions = db.prepare("SELECT id FROM Session WHERE campaignId = ? ORDER BY session_number ASC, createdAt ASC").all(campaignId) as { id: string }[];
        db.transaction(() => {
            const updateStmt = db.prepare("UPDATE Session SET session_number = ? WHERE id = ?");
            sessions.forEach((s, idx) => updateStmt.run(idx + 1, s.id));
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function archiveActiveArc(campaignId: string, arcId: string) {
    try {
        const now = new Date().toISOString();
        const newArcId = randomUUID();
        const campaign = db.prepare("SELECT summary FROM Campaign WHERE id = ?").get(campaignId) as { summary: string | null };
        
        const arcCols = getTableCols('StoryArc');
        const sessCols = getTableCols('Session');
        const campaignCols = getTableCols('Campaign');

        db.transaction(() => {
            // Update StoryArc
            let arcQuery = "UPDATE StoryArc SET status = 'archived', summary = ?";
            const arcParams = [campaign.summary];
            if (arcCols.includes('updatedat')) { arcQuery += ", updatedAt = ?"; arcParams.push(now); }
            arcQuery += " WHERE id = ?"; arcParams.push(arcId);
            db.prepare(arcQuery).run(...arcParams);

            // Update Session
            let sessQuery = "UPDATE Session SET is_archived = 1";
            const sessParams = [];
            if (sessCols.includes('updatedat')) { sessQuery += ", updatedAt = ?"; sessParams.push(now); }
            sessQuery += " WHERE arcId = ?"; sessParams.push(arcId);
            db.prepare(sessQuery).run(...sessParams);

            // Update Campaign
            let campQuery = "UPDATE Campaign SET summary = NULL";
            const campParams: any[] = [];
            if (campaignCols.includes('updatedat')) { campQuery += ", updatedAt = ?"; campParams.push(now); }
            campQuery += " WHERE id = ?"; campParams.push(campaignId);
            db.prepare(campQuery).run(...campParams);

            // Insert New Arc (Adaptive)
            const newArcD: Record<string, any> = { id: newArcId, campaignId, title: 'Nuovo Capitolo', status: 'active', order_index: 1, createdat: now, updatedat: now };
            const insArcCols = Object.keys(newArcD).filter(c => arcCols.includes(c.toLowerCase()));
            db.prepare(`INSERT INTO StoryArc (${insArcCols.join(',')}) VALUES (${insArcCols.map(() => '?').join(',')})`).run(...insArcCols.map(c => newArcD[c]));

            const allArchived = db.prepare("SELECT title, summary, world_impact FROM StoryArc WHERE campaignId = ? AND status = 'archived' AND summary IS NOT NULL ORDER BY order_index ASC").all(campaignId) as any[];
            const newCompendium = allArchived.length > 0 ? allArchived.map(a => `### ${a.title}\n${a.summary}\n\n**Impatto:**\n${a.world_impact || 'Nessuna nota.'}`).join('\n\n---\n\n') : null;
            db.prepare("UPDATE Campaign SET global_compendium = ? WHERE id = ?").run(newCompendium, campaignId);
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function archiveSingleSession(sessionId: string) {
    try {
        const now = new Date().toISOString();
        const cols = getTableCols('Session');
        let query = "UPDATE Session SET is_archived = 1";
        const params = [];
        if (cols.includes('updatedat')) {
            query += ", updatedAt = ?";
            params.push(now);
        }
        query += " WHERE id = ?";
        params.push(sessionId);
        db.prepare(query).run(...params);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateActiveArcInfo(campaignId: string, arcId: string, title: string, label: string) {
    try {
        db.transaction(() => {
            db.prepare("UPDATE StoryArc SET title = ? WHERE id = ?").run(title, arcId);
            db.prepare("UPDATE Campaign SET active_arc_label = ? WHERE id = ?").run(label, campaignId);
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

// --- AZIONI BOTTINO E SCANSIONE ---

export async function scanSessionForLoot(sessionId: string) {
    try {
        const session = db.prepare("SELECT * FROM Session WHERE id = ?").get(sessionId) as Session;
        if (!session || !session.notes) throw new Error("Sessione non trovata.");
        const knownCharacters = [...(db.prepare("SELECT name FROM PlayerCharacter WHERE campaignId = ?").all(session.campaignId) as any[]).map(c => c.name), ...(db.prepare("SELECT name FROM Npc WHERE campaignId = ?").all(session.campaignId) as any[]).map(n => n.name)];
        const override = await getSystemOverride('extract-gen');
        const entities = await runAiWithRetry(() => extractEntitiesFlow({ storyText: session.notes!, existingCharacters: knownCharacters, systemOverride: override }), 'EXTRACTION');
        
        db.transaction(() => {
            const now = new Date().toISOString();
            
            // MAGIC ITEMS (ADAPTIVE)
            const magicItemCols = getTableCols('MagicItem');
            for (const item of entities.newMagicItems) {
                const d: Record<string, any> = { id: randomUUID(), name: item.name, type: item.type, rarity: item.rarity, attunement: item.attunement || 'No', description: item.description, cost: item.cost || 'N/D', damage: item.damage || '', techType: 'damage', imageUrl: null, campaignId: session.campaignId, createdAt: now, updatedAt: now };
                const insertCols = Object.keys(d).filter(c => magicItemCols.includes(c.toLowerCase()));
                const placeholders = insertCols.map(() => '?').join(',');
                const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
                db.prepare(`INSERT INTO MagicItem (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(name, campaignId) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
                const actual = db.prepare("SELECT id FROM MagicItem WHERE name = ? AND campaignId = ?").get(item.name, session.campaignId) as { id: string };
                if (actual) db.prepare(`INSERT OR IGNORE INTO SessionLoot (sessionId, entityId, entityType) VALUES (?, ?, 'item')`).run(sessionId, actual.id);
            }

            // MONSTERS (ADAPTIVE)
            const monsterCols = getTableCols('Monster');
            for (const m of entities.newMonsters) {
                const d: Record<string, any> = { id: randomUUID(), name: m.name, type: m.type, armorClass: m.armorClass, hitPoints: m.hitPoints, challenge: m.challenge, description: m.description, imageUrl: null, campaignId: session.campaignId, createdAt: now, updatedAt: now };
                const insertCols = Object.keys(d).filter(c => monsterCols.includes(c.toLowerCase()));
                const placeholders = insertCols.map(() => '?').join(',');
                const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
                db.prepare(`INSERT INTO Monster (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(name, campaignId) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
                const actual = db.prepare("SELECT id FROM Monster WHERE name = ? AND campaignId = ?").get(m.name, session.campaignId) as { id: string };
                if (actual) db.prepare(`INSERT OR IGNORE INTO SessionLoot (sessionId, entityId, entityType) VALUES (?, ?, 'monster')`).run(sessionId, actual.id);
            }

            // REWARDS (ADAPTIVE)
            const rewardCols = getTableCols('Reward');
            for (const r of entities.rewards) {
                const d: Record<string, any> = { id: randomUUID(), campaignId: session.campaignId, sessionId, name: r.name, description: r.description, createdAt: now, updatedAt: now };
                const insertCols = Object.keys(d).filter(c => rewardCols.includes(c.toLowerCase()));
                const placeholders = insertCols.map(() => '?').join(',');
                db.prepare(`INSERT INTO Reward (${insertCols.join(',')}) VALUES (${placeholders})`).run(...insertCols.map(c => d[c]));
            }
            
            // CHARACTER EVENTS (ADAPTIVE)
            const charEventCols = getTableCols('CharacterEvent');
            entities.characterEvents.forEach((event, idx) => {
                const pc = db.prepare("SELECT id FROM PlayerCharacter WHERE LOWER(name) = LOWER(?) AND campaignId = ?").get(event.name, session.campaignId) as { id: string };
                let charId = pc?.id;
                let charType: 'pc' | 'npc' = 'pc';
                if (!charId) {
                    const npc = db.prepare("SELECT id FROM Npc WHERE LOWER(name) = LOWER(?) AND campaignId = ?").get(event.name, session.campaignId) as { id: string };
                    charId = npc?.id;
                    charType = 'npc';
                    if (!charId && event.isNew) {
                        charId = randomUUID();
                        const npcD: Record<string, any> = { id: charId, campaignId: session.campaignId, name: event.name, race: 'Sconosciuta', gender: 'Maschio', age: 'Adulto', status: 'Normale', alignment: 'Neutrale', details: JSON.stringify({ name: event.name, race: 'Sconosciuta', occupation: 'Rilevato', appearance: 'Dati sensoriali in attesa di catalogo.', personality: 'Personalità da definire.', mannerism: '—', secret: 'Segreto ignoto.', encounterHook: event.event }), createdAt: now, updatedAt: now };
                        const npcCols = getTableCols('Npc');
                        const nCols = Object.keys(npcD).filter(c => npcCols.includes(c.toLowerCase()));
                        db.prepare(`INSERT INTO Npc (${nCols.join(',')}) VALUES (${nCols.map(() => '?').join(',')})`).run(...nCols.map(c => npcD[c]));
                    }
                }
                if (charId) {
                    const evD: Record<string, any> = { id: randomUUID(), characterId: charId, characterType: charType, sessionId, campaignId: session.campaignId, eventDescription: event.event, order_index: idx, createdAt: now };
                    const evCols = Object.keys(evD).filter(c => charEventCols.includes(c.toLowerCase()));
                    db.prepare(`INSERT INTO CharacterEvent (${evCols.join(',')}) VALUES (${evCols.map(() => '?').join(',')})`).run(...evCols.map(c => evD[c]));
                }
            });
            db.prepare("UPDATE Session SET loot_scanned = 1, updatedAt = ? WHERE id = ?").run(now, sessionId);
        })();
        return actionResponse({ success: true });
    } catch (error: any) { return actionResponse(null, error.message); }
}

export async function getSessionLoot(sessionId: string) {
    try {
        const items = db.prepare(`SELECT m.* FROM MagicItem m JOIN SessionLoot l ON m.id = l.entityId WHERE l.sessionId = ? AND l.entityType = 'item'`).all(sessionId) as MagicItem[];
        const monsters = db.prepare(`SELECT m.* FROM Monster m JOIN SessionLoot l ON m.id = l.entityId WHERE l.sessionId = ? AND l.entityType = 'monster'`).all(sessionId) as Monster[];
        const rewards = db.prepare("SELECT * FROM Reward WHERE sessionId = ?").all(sessionId) as Reward[];
        const characterEvents = db.prepare(`SELECT e.*, CASE WHEN e.characterType = 'pc' THEN p.name ELSE n.name END as characterName, e.characterType FROM CharacterEvent e LEFT JOIN PlayerCharacter p ON e.characterId = p.id AND e.characterType = 'pc' LEFT JOIN Npc n ON e.characterId = n.id AND e.characterType = 'npc' WHERE e.sessionId = ? ORDER BY e.order_index ASC`).all(sessionId) as any[];
        return actionResponse({ items, monsters, rewards, characterEvents });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function clearSessionLoot(sessionId: string) {
    try {
        db.transaction(() => {
            db.prepare("DELETE FROM SessionLoot WHERE sessionId = ?").run(sessionId);
            db.prepare("DELETE FROM Reward WHERE sessionId = ?").run(sessionId);
            db.prepare("DELETE FROM CharacterEvent WHERE sessionId = ?").run(sessionId);
            db.prepare("UPDATE Session SET loot_scanned = 0 WHERE id = ?").run(sessionId);
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

// --- AZIONI GENERATORI IA ---

export async function generateMapAction(input: GenerateMapInput) {
    try {
        const svgString = await runAiWithRetry(() => generateMapFlow(input), 'SUMMARY');
        return actionResponse({ svgString });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function getAllWorldLocationsAction() {
    try {
        const data = db.prepare("SELECT * FROM WorldLocation ORDER BY updatedAt DESC").all();
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function catalogHandbookAction(content: string, photoDataUri?: string) {
    'use server';
    try {
        const override = await getSystemOverride('catalog-gen');
        const data = await runAiWithRetry(async () => {
            const genAi = getGenAI();
            const model = getActiveFlashModel();

            const contents: any[] = [];
            if (photoDataUri) {
                let base64Part = photoDataUri;
                let mimeType = 'image/jpeg';
                if (photoDataUri.includes(';base64,')) {
                    const parts = photoDataUri.split(';base64,');
                    mimeType = parts[0].replace('data:', '');
                    base64Part = parts[1];
                }
                contents.push({
                    inlineData: {
                        mimeType,
                        data: base64Part
                    }
                });
            }

            if (content && content.trim()) {
                contents.push(`TESTO DA ANALIZZARE:\n${content}`);
            }

            contents.push("Estrai accuratamente tutte le entità (Oggetti, Mostri, Incantesimi, Abilità, Regole) e rispondi ESCLUSIVAMENTE in formato JSON con la struttura richiesta.");

            const systemPrompt = `Sei l'Archimago e Gran Bibliotecario di Candlekeep. Il tuo compito è estrarre con PRECISIONE ASSOLUTA ed ESAUSTIVITÀ COMPLETA ogni singola scheda presente nel testo o nell'immagine.

PER I MOSTRI / CREATURE (RIGOROSO ED ESAUSTIVO):
- "name": Nome della creatura in italiano (es. "Doppelganger", "Dragolich Blu Adulto").
- "type": Tipo completo, taglia e allineamento (es. "Mostruosità Media (mutaforma), neutrale" o "Non morto Enorme, legale malvagio").
- "armorClass": Classe Armatura ESATTA completa di nota se presente (es. "14" o "19 (armatura naturale)"). MAI mettere "10" o "N/D" se la CA è presente nella scheda!
- "hitPoints": Punti Ferita ESATTI completi di dadi vita (es. "52 (8d8 + 16)" o "225 (18d12 + 108)"). MAI mettere "10" o "N/D" se i PF sono presenti nella scheda!
- "challenge": Grado di Sfida / GS ESATTO con PE se presenti (es. "3 (700 PE)" o "17 (18.000 PE)"). MAI mettere "?" se presente!
- "description": Trascrivi ed includi OBBLIGATORIAMENTE tutta la scheda tecnica e narrativa in elegante Markdown con questa struttura:
  * **Caratteristiche**: FOR, DES, COS, INT, SAG, CAR con relativi punteggi e modificatori.
  * **Velocità**: (es. 9m o 12m, scavare 9m, volare 24m).
  * **Tiri Salvezza, Abilità, Resistenze, Immunità ai Danni, Immunità alle Condizioni, Sensi, Linguaggi**.
  * **Tratti e Capacità Speciali**: (es. *Mutaforma*, *Imboscata*, *Resistenza Leggendaria*, *Resistenza alla Magia*, ecc.).
  * **Azioni**: (es. *Multiattacco*, *Schianto*, *Lettura del Pensiero*, *Morsso*, *Artiglio*, *Presenza Terrificante*, *Soffio di Fulmini*, ecc.).
  * **Azioni Leggendarie**: (se presenti nella scheda).
  * **Lore e Descrizione Narrativa**: (es. *Truffatori Edonisti*, *Ladri di Segreti*, *Cangianti*, ecc.).

PER GLI OGGETTI MAGICI ED EQUIPAGGIAMENTO:
- "name", "type", "rarity", "attunement", "cost", "damage", "description" (estrai tutto il testo esplicativo).

PER GLI INCANTESIMI:
- "name", "level", "school", "casting_time", "range", "components", "duration", "classes", "description" (estrai l'intero testo dell'effetto dell'incantesimo).

PER LE REGOLE DI GIOCO GENERALI:
- "title", "content", "sourceBook", "chapterTitle", "tags".

Restituisci ESCLUSIVAMENTE un JSON valido con questo schema esatto:
{
  "items": [
    { "name": "Nome", "type": "Tipo", "rarity": "Rarità", "attunement": "Sì/No", "description": "Descrizione", "cost": "Costo", "damage": "Danno" }
  ],
  "monsters": [
    { "name": "Nome", "type": "Tipo", "armorClass": "CA esatta", "hitPoints": "PF esatti", "challenge": "GS esatto", "description": "Scheda tecnica e narrativa completa in Markdown" }
  ],
  "spells": [
    { "name": "Nome", "level": "Livello", "school": "Scuola", "casting_time": "Tempo", "range": "Gittata", "components": "Componenti", "duration": "Durata", "description": "Descrizione completa", "classes": "Classi" }
  ],
  "skills": [
    { "name": "Nome", "ability": "Caratteristica", "description": "Descrizione" }
  ],
  "rules": [
    { "title": "Titolo", "content": "Contenuto Markdown", "sourceBook": "phb", "chapterTitle": "Capitolo", "tags": ["tag1"] }
  ]
}

REGOLE TASSATIVE:
1. TRADUCI I NOMI I TESTI IN ITALIANO.
2. NON OMETTERE mai le statistiche, i tiri salvezza, i tratti o le azioni dei mostri!
3. Se non ci sono entità per una categoria, ritorna un array vuoto [].
4. NON inventare informazioni non presenti nella fonte.
${override ? `Istruzioni custom: ${override}` : ''}`;

            const response = await safeGenerateContent(genAi, {
                model,
                contents,
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: "application/json",
                    temperature: 0.1,
                }
            });

            const text = response.text || '{}';
            
            // Funzione interna per estrarre in modo resiliente il JSON anche in presenza di testo spurio
            const extractJsonSafely = (raw: string): any => {
                const trimmed = raw.trim();
                if (!trimmed) return {};

                // 1. Tentativo parsing diretto
                try {
                    return JSON.parse(trimmed);
                } catch {}

                // 2. Estrazione da blocco di codice markdown ```json ... ```
                const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                if (codeBlock) {
                    try {
                        return JSON.parse(codeBlock[1].trim());
                    } catch {}
                }

                // 3. Estrazione a parentesi graffe bilanciate per isolare il primo oggetto JSON valido
                const startIdx = trimmed.indexOf('{');
                if (startIdx !== -1) {
                    let depth = 0;
                    let inString = false;
                    let escape = false;
                    for (let i = startIdx; i < trimmed.length; i++) {
                        const char = trimmed[i];
                        if (escape) {
                            escape = false;
                            continue;
                        }
                        if (char === '\\') {
                            escape = true;
                            continue;
                        }
                        if (char === '"') {
                            inString = !inString;
                            continue;
                        }
                        if (!inString) {
                            if (char === '{') {
                                depth++;
                            } else if (char === '}') {
                                depth--;
                                if (depth === 0) {
                                    const candidate = trimmed.substring(startIdx, i + 1);
                                    try {
                                        return JSON.parse(candidate);
                                    } catch {}
                                }
                            }
                        }
                    }
                }

                // 4. Fallback con rimozione apici o match greedy protetto
                const clean = trimmed.replace(/```json/gi, '').replace(/```/g, '').trim();
                try {
                    return JSON.parse(clean);
                } catch {}

                const match = clean.match(/\{[\s\S]*\}/);
                if (match) {
                    try {
                        return JSON.parse(match[0]);
                    } catch {}
                }

                throw new Error("Impossibile interpretare il JSON restituito dall'IA.");
            };

            const parsed = extractJsonSafely(text);

            return {
                items: Array.isArray(parsed?.items) ? parsed.items : [],
                monsters: Array.isArray(parsed?.monsters) ? parsed.monsters : [],
                spells: Array.isArray(parsed?.spells) ? parsed.spells : [],
                skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
                rules: Array.isArray(parsed?.rules) ? parsed.rules : [],
            };
        }, 'IMPORT');

        return actionResponse(data);
    } catch (e: any) { 
        console.error("Errore catalogHandbookAction:", e);
        return actionResponse(null, e.message); 
    }
}

export async function generateShopAction(input: GenerateShopInput) {
    try {
        const override = await getSystemOverride('shop-gen');
        const data = await runAiWithRetry(() => generateShopFlow({ ...input, systemOverride: override }), 'SHOPS');
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function generateLocationAction(input: GenerateLocationInput) {
    try {
        const override = await getSystemOverride('world-gen');
        const data = await runAiWithRetry(() => generateLocationFlow({ ...input, systemOverride: override }), 'WORLD');
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function generateNpcAction(input: GenerateNpcInput) {
    try {
        const override = await getSystemOverride('npc-gen');
        const data = await runAiWithRetry(() => generateNpcFlow({ ...input, systemOverride: override }), 'WORLD');
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function generateCombatAction(input: GenerateCombatInput) {
    try {
        const override = await getSystemOverride('combat-gen');
        const data = await runAiWithRetry(() => generateCombatFlow({ ...input, systemOverride: override }), 'WORLD');
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function generateTreasureAction(input: GenerateTreasureInput) {
    try {
        const override = await getSystemOverride('treasure-gen');
        const data = await runAiWithRetry(() => generateTreasureFlow({ ...input, systemOverride: override }), 'SHOPS');
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function quickImprovAction(input: { campaignId: string, question: string, numPlot: number, numWorld: number, numFalse: number, category?: string }) {
  try {
      const campaign = db.prepare("SELECT * FROM Campaign WHERE id = ?").get(input.campaignId) as Campaign;
      const activeArc = db.prepare("SELECT title FROM StoryArc WHERE campaignId = ? AND status = 'active'").get(input.campaignId) as any;
      const override = await getSystemOverride('improv-gen');
      let finalQuestion = input.question;
      if (!finalQuestion || finalQuestion.includes("Genera spunti casuali")) {
          const cat = input.category || 'dicerie';
          const labels: Record<string, string> = { 'dicerie': 'nuowe dicerie e segreti locali', 'conseguenze': 'conseguenze impreviste alle ultime azioni dei giocatori', 'clima': 'dettagli sull\'atmosfera, il meteo e le sensazioni ambientali', 'incontri': 'piccoli incontri casuali o interazioni con la folla', 'nomi': 'una lista di nomi evocativi per persone o luoghi' };
          finalQuestion = `L'avventura prosegue. Genera ${labels[cat] || 'nuovi spunti'} per il contesto attuale.`;
      }
      const result = await runAiWithRetry(() => quickImprovFlow({ campaignName: campaign.name, campaignSetting: campaign.setting, campaignSummary: campaign.summary || undefined, currentArcTitle: activeArc?.title, question: finalQuestion, numPlot: input.numPlot, numWorld: input.numWorld, numFalse: input.numFalse, systemOverride: override }), 'STORY');
      return actionResponse(result);
  } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateNpcIdentityAction(npcId: string, campaignId: string) {
    try {
        const npc = db.prepare("SELECT * FROM Npc WHERE id = ?").get(npcId) as Npc;
        if (!npc) throw new Error("PNG non trovato.");
        const campaign = db.prepare("SELECT summary FROM Campaign WHERE id = ?").get(campaignId) as { summary: string | null };
        const history = db.prepare(`SELECT e.eventDescription, s.session_number FROM CharacterEvent e JOIN Session s ON e.sessionId = s.id WHERE e.characterId = ? AND e.characterType = 'npc' ORDER BY s.session_number ASC, e.order_index ASC`).all(npcId) as any[];
        const historyText = history.length > 0 ? history.map(h => `Sess ${h.session_number}: ${h.eventDescription}`).join('\n') : "Nessuna azione registrata nelle sessioni finora.";
        const override = await getSystemOverride('npc-gen');
        const data = await runAiWithRetry(() => updateNpcIdentityFlow({ npcName: npc.name, npcRace: npc.race, history: historyText, campaignSummary: campaign.summary || undefined, systemOverride: override }), 'WORLD');
        
        const oldDetails = JSON.parse(npc.details) as any;
        if (oldDetails.imageUrl && oldDetails.imageUrl !== (data as any).imageUrl) {
            deleteAssetFile(oldDetails.imageUrl);
        }

        const npcCols = getTableCols('Npc');
        const hasUpdatedAt = npcCols.includes('updatedat');

        if (hasUpdatedAt) {
            db.prepare(`UPDATE Npc SET name = ?, race = ?, gender = ?, age = ?, status = ?, alignment = ?, details = ?, updatedAt = ? WHERE id = ?`).run(data.name, data.race, data.gender, data.age, data.status, data.alignment, JSON.stringify(data), new Date().toISOString(), npcId);
        } else {
            db.prepare(`UPDATE Npc SET name = ?, race = ?, gender = ?, age = ?, status = ?, alignment = ?, details = ? WHERE id = ?`).run(data.name, data.race, data.gender, data.age, data.status, data.alignment, JSON.stringify(data), npcId);
        }
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deepNpcElaborationAction(npcId: string, campaignId: string) {
    try {
        const npc = db.prepare("SELECT * FROM Npc WHERE id = ?").get(npcId) as Npc;
        if (!npc) throw new Error("PNG non trovato.");
        const campaign = db.prepare("SELECT setting FROM Campaign WHERE id = ?").get(campaignId) as { setting: string };
        const sessions = db.prepare("SELECT session_number, title, notes FROM Session WHERE campaignId = ? ORDER BY session_number ASC").all(campaignId) as any[];
        const allText = sessions.map(s => `Sessione ${s.session_number}: ${s.title}\n${s.notes}`).join('\n\n---\n\n');
        const override = await getSystemOverride('npc-gen');
        const result = await runAiWithRetry(() => deepNpcElaborationFlow({ npcName: npc.name, npcRace: npc.race, campaignSetting: campaign.setting, allSessionsText: allText, systemOverride: override }), 'WORLD');
        
        const npcCols = getTableCols('Npc');
        const hasUpdatedAt = npcCols.includes('updatedat');
        const charEventCols = getTableCols('CharacterEvent');
        const hasCharEventDate = charEventCols.includes('createdat');
        const hasCharEventOrder = charEventCols.includes('order_index');

        db.transaction(() => {
            const now = new Date().toISOString();
            
            const oldDetails = JSON.parse(npc.details) as any;
            if (oldDetails.imageUrl && oldDetails.imageUrl !== (result.identity as any).imageUrl) {
                deleteAssetFile(oldDetails.imageUrl);
            }

            db.prepare("DELETE FROM CharacterEvent WHERE characterId = ? AND characterType = 'npc'").run(npcId);
            result.events.forEach((ev, idx) => {
                const sess = db.prepare("SELECT id FROM Session WHERE session_number = ? AND campaignId = ?").get(ev.sessionNumber, campaignId) as { id: string };
                if (sess) {
                    const cols = ["id", "characterId", "characterType", "sessionId", "campaignId", "eventDescription"];
                    const vals: any[] = [randomUUID(), npcId, 'npc', sess.id, campaignId, ev.eventDescription];
                    if (hasCharEventOrder) { cols.push("order_index"); vals.push(idx); }
                    if (hasCharEventDate) { cols.push("createdAt"); vals.push(now); }
                    const placeholders = cols.map(() => '?').join(',');
                    db.prepare(`INSERT INTO CharacterEvent (${cols.join(',')}) VALUES (${placeholders})`).run(...vals);
                }
            });
            
            if (hasUpdatedAt) {
                db.prepare(`UPDATE Npc SET name = ?, race = ?, gender = ?, age = ?, status = ?, alignment = ?, details = ?, updatedAt = ? WHERE id = ?`).run(result.identity.name, result.identity.race, result.identity.gender, result.identity.age, result.identity.status, result.identity.alignment, JSON.stringify(result.identity), now, npcId);
            } else {
                db.prepare(`UPDATE Npc SET name = ?, race = ?, gender = ?, age = ?, status = ?, alignment = ?, details = ? WHERE id = ?`).run(result.identity.name, result.identity.race, result.identity.gender, result.identity.age, result.identity.status, result.identity.alignment, JSON.stringify(result.identity), npcId);
            }
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

// --- AZIONI CRUD DATABASE (ADAPTIVE) ---

export async function saveMagicItem(item: Partial<MagicItem> & { campaignId: string }) {
    try {
        const id = item.id || randomUUID();
        const now = new Date().toISOString();
        
        if (item.id) {
            const existing = db.prepare("SELECT imageUrl FROM MagicItem WHERE id = ?").get(item.id) as { imageUrl: string };
            if (existing && existing.imageUrl && existing.imageUrl !== item.imageUrl) {
                deleteAssetFile(existing.imageUrl);
            }
        }

        const magicItemCols = getTableCols('MagicItem');
        const d: Record<string, any> = { id, name: item.name, type: item.type, rarity: item.rarity, attunement: item.attunement || 'No', description: item.description, cost: item.cost || 'N/D', damage: item.damage || '', techType: item.techType || 'damage', imageUrl: item.imageUrl || null, campaignId: item.campaignId, createdAt: (item as any).createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => magicItemCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO MagicItem (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteMagicItem(id: string) {
    try {
        const item = db.prepare("SELECT imageUrl FROM MagicItem WHERE id = ?").get(id) as { imageUrl: string };
        if (item) deleteAssetFile(item.imageUrl);
        db.prepare("DELETE FROM MagicItem WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveMonster(monster: Partial<Monster> & { campaignId: string }) {
    try {
        const id = monster.id || randomUUID();
        const now = new Date().toISOString();

        if (monster.id) {
            const existing = db.prepare("SELECT imageUrl FROM Monster WHERE id = ?").get(monster.id) as { imageUrl: string };
            if (existing && existing.imageUrl && existing.imageUrl !== monster.imageUrl) {
                deleteAssetFile(existing.imageUrl);
            }
        }

        const monsterCols = getTableCols('Monster');
        const d: Record<string, any> = { id, name: monster.name, type: monster.type, armorClass: monster.armorClass, hitPoints: monster.hitPoints, challenge: monster.challenge, description: monster.description, imageUrl: monster.imageUrl || null, campaignId: monster.campaignId, createdAt: (monster as any).createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => monsterCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO Monster (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteMonster(id: string) {
    try {
        const m = db.prepare("SELECT imageUrl FROM Monster WHERE id = ?").get(id) as { imageUrl: string };
        if (m) deleteAssetFile(m.imageUrl);
        db.prepare("DELETE FROM Monster WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveSpell(spell: Partial<Spell> & { campaignId: string }) {
    try {
        const id = spell.id || randomUUID();
        const now = new Date().toISOString();
        const spellCols = getTableCols('CustomSpell');
        const d: Record<string, any> = { id, name: spell.name, level: spell.level, school: spell.school, casting_time: spell.casting_time, range: spell.range, components: spell.components, duration: spell.duration, description: spell.description, classes: spell.classes, campaignId: spell.campaignId, createdAt: (spell as any).createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => spellCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO CustomSpell (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteSpell(id: string) {
    try {
        db.prepare("DELETE FROM CustomSpell WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveSkill(skill: Partial<Skill> & { campaignId: string }) {
    try {
        const id = skill.id || randomUUID();
        const now = new Date().toISOString();
        const skillCols = getTableCols('CustomSkill');
        const d: Record<string, any> = { id, name: skill.name, ability: skill.ability, description: skill.description, campaignId: skill.campaignId, createdAt: (skill as any).createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => skillCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO CustomSkill (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteSkill(id: string) {
    try {
        db.prepare("DELETE FROM CustomSkill WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function bulkImportAction(campaignId: string, data: any) {
    try {
        let count = 0;
        const now = new Date().toISOString();
        
        db.transaction(() => {
            if (data.items) {
                const cols = getTableCols('MagicItem');
                const s = db.prepare(`INSERT OR IGNORE INTO MagicItem (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
                for (const it of data.items) {
                    const d: Record<string, any> = { id: randomUUID(), campaignId, name: it.name, type: it.type || 'Oggetto', rarity: it.rarity || 'Comune', attunement: it.attunement || 'No', description: it.description || '', cost: it.cost || 'N/D', damage: it.damage || '', createdat: now, updatedat: now };
                    s.run(...cols.map(c => d[c.toLowerCase()]));
                    count++;
                }
            }
            if (data.monsters) {
                const cols = getTableCols('Monster');
                const s = db.prepare(`INSERT OR IGNORE INTO Monster (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
                for (const m of data.monsters) {
                    const d: Record<string, any> = { id: randomUUID(), campaignId, name: m.name, type: m.type || 'Mostro', armorclass: m.armorClass || '10', hitpoints: m.hitPoints || '10', challenge: m.challenge || '0', description: m.description || '', createdat: now, updatedat: now };
                    s.run(...cols.map(c => d[c.toLowerCase()]));
                    count++;
                }
            }
            if (data.spells) {
                const cols = getTableCols('CustomSpell');
                const s = db.prepare(`INSERT OR IGNORE INTO CustomSpell (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
                for (const spell of data.spells) {
                    const d: Record<string, any> = { id: randomUUID(), campaignId, name: spell.name, level: spell.level || '0', school: spell.school || 'Univ', casting_time: spell.casting_time || '1 az', range: spell.range || 'Contatto', components: spell.components || 'V, S', duration: spell.duration || 'Ist', description: spell.description || '', classes: spell.classes || '', createdat: now, updatedat: now };
                    s.run(...cols.map(c => d[c.toLowerCase()]));
                    count++;
                }
            }
            if (data.skills) {
                const cols = getTableCols('CustomSkill');
                const s = db.prepare(`INSERT OR IGNORE INTO CustomSkill (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
                for (const sk of data.skills) {
                    const d: Record<string, any> = { id: randomUUID(), campaignId, name: sk.name, ability: sk.ability || 'Varia', description: sk.description || '', createdat: now, updatedat: now };
                    s.run(...cols.map(c => d[c.toLowerCase()]));
                    count++;
                }
            }
        })();
        return actionResponse({ imported: count });
    } catch (e: any) { return actionResponse(null, e.message); }
}

// --- AZIONI CRUD HOMEBREW ---

export async function getHomebrewRules(campaignId: string) {
    try {
        const rules = db.prepare("SELECT * FROM HomebrewRule WHERE campaignId = ? ORDER BY category ASC, title ASC").all(campaignId) as HomebrewRule[];
        return actionResponse(rules);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveHomebrewRule(data: Partial<HomebrewRule> & { campaignId: string }) {
    try {
        const id = data.id || randomUUID();
        const now = new Date().toISOString();
        const cols = getTableCols('HomebrewRule');
        const d: Record<string, any> = { 
            id, 
            campaignId: data.campaignId, 
            title: formatTitleOrTag(data.title), 
            content: formatNarrativeText(data.content), 
            category: data.category || 'Generale', 
            isActive: data.isActive ? 1 : 0, 
            createdAt: data.createdAt || now, 
            updatedAt: now 
        };
        const insertCols = Object.keys(d).filter(c => cols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        db.prepare(`INSERT INTO HomebrewRule (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, category=excluded.category, isActive=excluded.isActive, updatedAt=excluded.updatedAt`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteHomebrewRule(id: string) {
    try {
        db.prepare("DELETE FROM HomebrewRule WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function toggleHomebrewRule(id: string) {
    try {
        const ruleCols = getTableCols('HomebrewRule');
        const hasUpdatedAt = ruleCols.includes('updatedat');
        if (hasUpdatedAt) {
            db.prepare("UPDATE HomebrewRule SET isActive = NOT isActive, updatedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
        } else {
            db.prepare("UPDATE HomebrewRule SET isActive = NOT isActive WHERE id = ?").run(id);
        }
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

// --- AZIONI SYSTEM PROMPTS ---

export async function getAllSystemPrompts() {
    try {
        const data = db.prepare("SELECT * FROM SystemPrompt ORDER BY title ASC").all();
        return actionResponse(data);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateSystemPrompt(slug: string, content: string) {
    try {
        db.prepare("UPDATE SystemPrompt SET content = ?, updatedAt = ? WHERE slug = ?").run(content, new Date().toISOString(), slug);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function resetSystemPrompt(slug: string) {
    try {
        const p = db.prepare("SELECT defaultContent FROM SystemPrompt WHERE slug = ?").get(slug) as any;
        db.prepare("UPDATE SystemPrompt SET content = ?, updatedAt = ? WHERE slug = ?").run(p.defaultContent, new Date().toISOString(), slug);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

// --- ALTRE AZIONI ---

export async function savePlayerCharacter(pc: any) {
    try {
        const id = pc.id || randomUUID();
        const now = new Date().toISOString();
        
        if (pc.id) {
            const existing = db.prepare("SELECT imageUrl FROM PlayerCharacter WHERE id = ?").get(pc.id) as { imageUrl: string };
            if (existing && existing.imageUrl && existing.imageUrl !== pc.imageUrl) {
                deleteAssetFile(existing.imageUrl);
            }
        }

        const cols = getTableCols('PlayerCharacter');
        const d: Record<string, any> = { id, campaignId: pc.campaignId, name: pc.name, race: pc.race ?? null, class: pc.class ?? null, archetype: pc.archetype ?? null, level: pc.level ?? null, hitPoints: pc.hitPoints ?? null, armorClass: pc.armorClass ?? null, strength: pc.strength ?? null, dexterity: pc.dexterity ?? null, constitution: pc.constitution ?? null, intelligence: pc.intelligence ?? null, wisdom: pc.wisdom ?? null, charisma: pc.charisma ?? null, background: pc.background ?? null, imageUrl: pc.imageUrl ?? null, spells: pc.spells ?? null, traits: pc.traits ?? null, ideals: pc.ideals ?? null, bonds: pc.bonds ?? null, flaws: pc.flaws ?? null, createdAt: pc.createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => cols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO PlayerCharacter (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { 
        return actionResponse(null, e.message); 
    }
}

export async function deletePlayerCharacter(id: string) {
    try {
        const pc = db.prepare("SELECT imageUrl FROM PlayerCharacter WHERE id = ?").get(id) as { imageUrl: string };
        if (pc) deleteAssetFile(pc.imageUrl);
        db.prepare("DELETE FROM PlayerCharacter WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function getNpcSummary(campaignId: string) {
    try {
        const npcs = db.prepare("SELECT * FROM Npc WHERE campaignId = ? ORDER BY name ASC").all(campaignId) as Npc[];
        const enriched = npcs.map(n => {
            const details = JSON.parse(n.details) as NpcDetails;
            const last = db.prepare(`SELECT e.*, s.session_number as num, s.title FROM CharacterEvent e JOIN Session s ON e.sessionId = s.id WHERE e.characterId = ? AND e.characterType = 'npc' ORDER BY s.session_number DESC, e.order_index DESC LIMIT 1`).get(n.id) as any;
            return { ...n, details, lastEvent: last ? { sessionNumber: last.num, sessionTitle: last.title, eventDescription: last.eventDescription } : null };
        });
        return actionResponse(enriched);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function getCharacterHistory(charId: string) {
    try {
        const history = db.prepare(`SELECT e.*, s.session_number as sessionNumber, s.title as sessionTitle FROM CharacterEvent e JOIN Session s ON e.sessionId = s.id WHERE e.characterId = ? ORDER BY e.order_index ASC`).all(charId) as any[];
        return actionResponse(history);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateCharacterEvent(eventId: string, description: string) {
    try {
        db.prepare("UPDATE CharacterEvent SET eventDescription = ? WHERE id = ?").run(description, eventId);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteCharacterEvent(eventId: string) {
    try {
        db.prepare("DELETE FROM CharacterEvent WHERE id = ?").run(eventId);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function reorderCharacterEvents(orderedIds: string[]) {
    try {
        db.transaction(() => {
            const updateStmt = db.prepare("UPDATE CharacterEvent SET order_index = ? WHERE id = ?");
            orderedIds.forEach((id, idx) => updateStmt.run(idx, id));
        })();
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function uploadGenericImage(imageData: string, entityName?: string) {
    try {
        const b64 = imageData.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(b64, 'base64');
        const sanitizedName = entityName ? entityName.trim().replace(/\s+/g, '_').replace(/[^\w\d_]/g, '') : 'img';
        const name = `${sanitizedName}_${Date.now()}.jpg`;
        const dir = getAssetDir();
        fs.writeFileSync(path.join(dir, name), buf);
        return actionResponse({ url: `/api/assets/${name}` });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function getBackupData() {
    try {
        const tables = ['Campaign', 'StoryArc', 'Session', 'MagicItem', 'Monster', 'SessionLoot', 'Reward', 'CharacterEvent', 'PlayerCharacter', 'CustomSpell', 'CustomSkill', 'PossessedItems', 'LetterPreset', 'Shop', 'WorldLocation', 'Npc', 'Combat', 'HomebrewRule', 'LoreEntry', 'SystemPrompt', 'ApiUsage'];
        const backup: Record<string, any[]> = {};
        for (const table of tables) {
            try { backup[table] = db.prepare(`SELECT * FROM ${table}`).all(); } catch (err) { backup[table] = []; }
        }
        return actionResponse(backup);
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function getAssetsBackup() {
    try {
        const assets: any[] = [];
        const dir = getAssetDir();
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const content = fs.readFileSync(filePath, { encoding: 'base64' });
                assets.push({ name: file, content });
            }
        }
        return actionResponse({ Assets: assets });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function uploadBatchImages(images: { name: string; content: string }[]) {
    try {
        const dir = getAssetDir();
        let uploadedCount = 0;
        for (const img of images) {
            if (!img.name || !img.content) continue;
            let b64 = img.content;
            const matches = img.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches[2]) {
                b64 = matches[2];
            }
            const buf = Buffer.from(b64, 'base64');
            const sanitizedName = img.name.trim().replace(/\s+/g, '_').replace(/[^\w\d_.-]/g, '');
            fs.writeFileSync(path.join(dir, sanitizedName), buf);
            uploadedCount++;
        }
        return actionResponse({ success: true, uploadedCount });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function restoreBackupData(jsonString: string) {
    try {
        const data = JSON.parse(jsonString);
        if (!data || typeof data !== 'object') throw new Error("Formato backup non valido.");
        if (data.Assets && !data.Campaign && !data.campaigns) {
            const dir = getAssetDir();
            for (const asset of data.Assets) {
                if (asset.name && asset.content) {
                    const buf = Buffer.from(asset.content, 'base64');
                    fs.writeFileSync(path.join(dir, asset.name), buf);
                }
            }
            const activeCamp = db.prepare("SELECT id FROM Campaign ORDER BY updatedAt DESC LIMIT 1").get() as { id: string } | undefined;
            return actionResponse({ success: true, mode: 'assets', campaignId: activeCamp?.id });
        }
        const tableMapping: Record<string, string> = { 
            'campaigns': 'Campaign', 'campaign': 'Campaign', 
            'story_arcs': 'StoryArc', 'storyarc': 'StoryArc', 
            'sessions': 'Session', 'session': 'Session', 
            'magic_items': 'MagicItem', 'magicitem': 'MagicItem', 
            'monsters': 'Monster', 'monster': 'Monster', 
            'rewards': 'Reward', 'reward': 'Reward', 
            'character_events': 'CharacterEvent', 'characterevent': 'CharacterEvent', 
            'player_characters': 'PlayerCharacter', 'playercharacter': 'PlayerCharacter', 'characters': 'PlayerCharacter', 
            'custom_spells': 'CustomSpell', 'customspell': 'CustomSpell', 'spells': 'CustomSpell', 
            'custom_skills': 'CustomSkill', 'customskill': 'CustomSkill', 'skills': 'CustomSkill', 
            'possessed_items': 'PossessedItems', 'possesseditems': 'PossessedItems', 
            'letter_presets': 'LetterPreset', 'letterpreset': 'LetterPreset', 
            'shops': 'Shop', 'shop': 'Shop', 
            'world_locations': 'WorldLocation', 'worldlocation': 'WorldLocation', 
            'npcs': 'Npc', 'npc': 'Npc', 
            'combats': 'Combat', 'combat': 'Combat', 
            'homebrew_rules': 'HomebrewRule', 'homebrewrule': 'HomebrewRule', 'rules': 'HomebrewRule', 
            'lore_entries': 'LoreEntry', 'lore_entry': 'LoreEntry', 'loreentries': 'LoreEntry', 'loreentry': 'LoreEntry', 'lore': 'LoreEntry', 'loreentrys': 'LoreEntry',
            'system_prompts': 'SystemPrompt', 'systemprompt': 'SystemPrompt', 
            'session_loot': 'SessionLoot', 'sessionloot': 'SessionLoot' 
        };
        const columnMapping: Record<string, string> = { 
            'isArchived': 'is_archived', 'isSummarized': 'is_summarized', 'sessionNumber': 'session_number', 
            'xpAward': 'xp_award', 'lootScanned': 'loot_scanned', 'isRead': 'is_read', 
            'activeArcLabel': 'active_arc_label', 'globalCompendium': 'global_compendium', 
            'imageUrl': 'imageUrl', 'image_url': 'imageUrl', 'orderIndex': 'order_index',
            'sourceUrl': 'sourceUrl', 'source_url': 'sourceUrl'
        };
        db.exec("PRAGMA foreign_keys = OFF");
        try {
            db.transaction(() => {
                const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
                for (const table of existingTables) {
                    if (table === 'sqlite_sequence' || table.startsWith('sqlite_')) continue;
                    db.prepare(`DELETE FROM ${table}`).run();
                }
                for (const [key, rows] of Object.entries(data)) {
                    if (key === 'Assets') continue;
                    const targetTable = tableMapping[key.toLowerCase()] || key;
                    if (!existingTables.includes(targetTable) || !Array.isArray(rows)) continue;
                    const tableInfo = db.prepare(`PRAGMA table_info(${targetTable})`).all() as any[];
                    const validColumns = tableInfo.map(c => c.name);
                    for (const row of rows) {
                        if (!row || typeof row !== 'object') continue;
                        const mappedRow: Record<string, any> = {};
                        for (const [colName, colVal] of Object.entries(row)) {
                            const targetCol = columnMapping[colName] || colName;
                            if (validColumns.includes(targetCol)) mappedRow[targetCol] = (colVal !== null && typeof colVal === 'object') ? (typeof colVal === 'string' ? colVal : JSON.stringify(colVal)) : colVal;
                        }
                        if (Object.keys(mappedRow).length === 0) continue;
                        const cols = Object.keys(mappedRow);
                        const placeholders = cols.map(() => '?').join(',');
                        db.prepare(`INSERT OR REPLACE INTO ${targetTable} (${cols.join(',')}) VALUES (${placeholders})`).run(...Object.values(mappedRow));
                    }
                }
            })();
            if (data.Assets && Array.isArray(data.Assets)) {
                const dir = getAssetDir();
                for (const asset of data.Assets) {
                    if (asset.name && asset.content) {
                        const buf = Buffer.from(asset.content, 'base64');
                        fs.writeFileSync(path.join(dir, asset.name), buf);
                    }
                }
            }
            const campaigns = db.prepare("SELECT id FROM Campaign").all() as {id: string}[];
            for (const campaign of campaigns) {
                let activeArc = db.prepare("SELECT id FROM StoryArc WHERE campaignId = ? AND status = 'active'").get(campaign.id) as {id: string};
                if (!activeArc) {
                    const arcId = randomUUID();
                    db.prepare("INSERT INTO StoryArc (id, campaignId, title, status, order_index) VALUES (?, ?, 'Atto Iniziale', 'active', 0)").run(arcId, campaign.id);
                    activeArc = { id: arcId };
                }
                db.prepare("UPDATE Session SET arcId = ? WHERE campaignId = ? AND (arcId IS NULL OR arcId = '')").run(activeArc.id, campaign.id);
            }
        } finally { db.exec("PRAGMA foreign_keys = ON"); }
        const restoredCamp = db.prepare("SELECT id FROM Campaign ORDER BY updatedAt DESC LIMIT 1").get() as { id: string } | undefined;
        return actionResponse({ success: true, mode: 'data', campaignId: restoredCamp?.id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function relinkImagesAction() {
    try {
        const dir = getAssetDir();
        if (!fs.existsSync(dir)) throw new Error("Directory asset non trovata.");
        const files = fs.readdirSync(dir);
        let relinkedCount = 0;
        db.transaction(() => {
            const pcs = db.prepare("SELECT id, name, imageUrl FROM PlayerCharacter").all() as any[];
            for (const pc of pcs) {
                let currentUrl = pc.imageUrl;
                if (!currentUrl) {
                    const match = files.find(f => f.toLowerCase().startsWith(pc.name.toLowerCase().replace(/\s+/g, '_')));
                    if (match) {
                        db.prepare("UPDATE PlayerCharacter SET imageUrl = ? WHERE id = ?").run(`/api/assets/${match}`, pc.id);
                        relinkedCount++;
                    }
                } else if (!currentUrl.startsWith('/api/assets/')) {
                    const parts = currentUrl.split(/[/\\]/);
                    const fileName = parts[parts.length - 1];
                    if (files.includes(fileName)) {
                        db.prepare("UPDATE PlayerCharacter SET imageUrl = ? WHERE id = ?").run(`/api/assets/${fileName}`, pc.id);
                        relinkedCount++;
                    }
                }
            }
            const npcs = db.prepare("SELECT id, name, details FROM Npc").all() as any[];
            for (const npc of npcs) {
                const details = JSON.parse(npc.details) as NpcDetails;
                let currentUrl = details.imageUrl;
                let updated = false;
                if (!currentUrl) {
                    const match = files.find(f => f.toLowerCase().startsWith(npc.name.toLowerCase().replace(/\s+/g, '_')));
                    if (match) {
                        details.imageUrl = `/api/assets/${match}`;
                        updated = true;
                    }
                } else if (currentUrl && !currentUrl.startsWith('/api/assets/')) {
                    const parts = currentUrl.split(/[/\\]/);
                    const fileName = parts[parts.length - 1];
                    if (files.includes(fileName)) {
                        details.imageUrl = `/api/assets/${fileName}`;
                        updated = true;
                    }
                }
                if (updated) {
                    db.prepare("UPDATE Npc SET details = ? WHERE id = ?").run(JSON.stringify(details), npc.id);
                    relinkedCount++;
                }
            }
            const items = db.prepare("SELECT id, name, imageUrl FROM MagicItem").all() as any[];
            for (const it of items) {
                if (it.imageUrl && !it.imageUrl.startsWith('/api/assets/')) {
                    const parts = it.imageUrl.split(/[/\\]/);
                    const fileName = parts[parts.length - 1];
                    if (files.includes(fileName)) {
                        db.prepare("UPDATE MagicItem SET imageUrl = ? WHERE id = ?").run(`/api/assets/${fileName}`, it.id);
                        relinkedCount++;
                    }
                }
            }
        })();
        return actionResponse({ relinkedCount });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function toggleItemPossession(campaignId: string, itemName: string) {
    try {
        const existing = db.prepare("SELECT * FROM PossessedItems WHERE campaignId = ? AND itemName = ?").get(campaignId, itemName);
        if (existing) db.prepare("DELETE FROM PossessedItems WHERE campaignId = ? AND itemName = ?").run(campaignId, itemName);
        else db.prepare("INSERT INTO PossessedItems (campaignId, itemName) VALUES (?, ?)").run(campaignId, itemName);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveLetterPreset(name: string, settings: string) {
    try {
        db.prepare("INSERT INTO LetterPreset (id, name, settings) VALUES (?, ?, ?)").run(randomUUID(), name, settings);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteLetterPreset(id: string) {
    try {
        db.prepare("DELETE FROM LetterPreset WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function uploadCardBackground(imageData: string, target: string) {
    try {
        const b64 = imageData.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(b64, 'base64');
        const dir = getAssetDir();
        fs.writeFileSync(path.join(dir, target), buf);
        const url = `/api/assets/${encodeURIComponent(target)}`;
        return actionResponse({ success: true, url, filename: target });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function quickSaveRewardAction(campaignId: string, name: string, description: string) {
    try {
        const now = new Date().toISOString();
        const rewardCols = getTableCols('Reward');
        const d: Record<string, any> = { id: randomUUID(), campaignId, sessionId: 'manual', name, description, createdAt: now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => rewardCols.includes(c.toLowerCase()));
        db.prepare(`INSERT INTO Reward (${insertCols.join(',')}) VALUES (${insertCols.map(() => '?').join(',')})`).run(...insertCols.map(c => d[c]));
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function updateReward(reward: any) {
    try {
        const rewardCols = getTableCols('Reward');
        const hasUpdatedAt = rewardCols.includes('updatedat');
        if (hasUpdatedAt) {
            db.prepare("UPDATE Reward SET name = ?, description = ?, updatedAt = ? WHERE id = ?").run(reward.name, reward.description, new Date().toISOString(), reward.id);
        } else {
            db.prepare("UPDATE Reward SET name = ?, description = ? WHERE id = ?").run(reward.name, reward.description, reward.id);
        }
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteReward(id: string) {
    try {
        db.prepare("DELETE FROM Reward WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveShop(data: any) {
    try {
        const id = data.id || randomUUID();
        const now = new Date().toISOString();
        const shopCols = getTableCols('Shop');
        const d: Record<string, any> = { id, campaignId: data.campaignId, name: data.name, owner: data.owner, description: data.description, inventory: data.inventory, createdAt: data.createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => shopCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO Shop (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteShop(id: string) {
    try {
        db.prepare("DELETE FROM Shop WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveWorldLocation(data: any) {
    try {
        const id = data.id || randomUUID();
        const now = new Date().toISOString();
        const locCols = getTableCols('WorldLocation');
        const d: Record<string, any> = { id, campaignId: data.campaignId, name: data.name, scale: data.scale, style: data.style, atmosphere: data.atmosphere, details: data.details, createdAt: data.createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => locCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO WorldLocation (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteWorldLocation(id: string) {
    try {
        db.prepare("DELETE FROM WorldLocation WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveNpc(data: any) {
    try {
        const id = data.id || randomUUID();
        const now = new Date().toISOString();
        if (data.id) {
            const npc = db.prepare("SELECT details FROM Npc WHERE id = ?").get(data.id) as { details: string };
            if (npc) {
                const oldDetails = JSON.parse(npc.details);
                const newDetails = JSON.parse(data.details);
                if (oldDetails.imageUrl && oldDetails.imageUrl !== newDetails.imageUrl) {
                    deleteAssetFile(oldDetails.imageUrl);
                }
            }
        }

        const npcCols = getTableCols('Npc');
        const d: Record<string, any> = { id, campaignId: data.campaignId, name: data.name, race: data.race, gender: data.gender, age: data.age, status: data.status, alignment: data.alignment, details: data.details, createdAt: data.createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => npcCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO Npc (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteNpc(id: string) {
    try {
        const npc = db.prepare("SELECT details FROM Npc WHERE id = ?").get(id) as { details: string };
        if (npc) {
            const d = JSON.parse(npc.details);
            deleteAssetFile(d.imageUrl);
        }
        db.prepare("DELETE FROM Npc WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function saveCombat(data: any) {
    try {
        const id = data.id || randomUUID();
        const now = new Date().toISOString();
        const combatCols = getTableCols('Combat');
        const d: Record<string, any> = { id, campaignId: data.campaignId, name: data.name, difficulty: data.difficulty, details: data.details, createdAt: data.createdAt || now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => combatCols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'name', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO Combat (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));
        return actionResponse({ id });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function deleteCombat(id: string) {
    try {
        db.prepare("DELETE FROM Combat WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) { return actionResponse(null, e.message); }
}

export async function migrateOldCharacters(campaignId: string, oldData: string) {
  try {
    const chars = JSON.parse(oldData);
    db.transaction(() => {
      const now = new Date().toISOString();
      const cols = getTableCols('PlayerCharacter');
      for (const char of chars) {
        const id = char.id || randomUUID();
        const d: Record<string, any> = { id, campaignId, name: char.name, class: char.class, archetype: char.archetype, level: char.level, hitPoints: char.hitPoints, armorClass: char.armorClass, strength: char.strength, dexterity: char.dexterity, constitution: char.constitution, intelligence: char.intelligence, wisdom: char.wisdom, charisma: char.charisma, background: char.background, imageUrl: char.imageUrl, spells: char.spells, traits: char.traits, ideals: char.ideals, bonds: char.bonds, flaws: char.flaws, createdAt: now, updatedAt: now };
        const insertCols = Object.keys(d).filter(c => cols.includes(c.toLowerCase()));
        db.prepare(`INSERT OR IGNORE INTO PlayerCharacter (${insertCols.join(',')}) VALUES (${insertCols.map(() => '?').join(',')})`).run(...insertCols.map(c => d[c]));
      }
    })();
    return actionResponse({ success: true });
  } catch (e: any) { return actionResponse(null, e.message); }
}

export async function recordLoreVersion(entryId: string, changeSummary: string = 'Modifica') {
    try {
        const entry = db.prepare("SELECT * FROM LoreEntry WHERE id = ?").get(entryId) as any;
        if (!entry) return null;

        const maxVerRow = db.prepare("SELECT MAX(versionNumber) as maxVer FROM LoreVersion WHERE entryId = ?").get(entryId) as any;
        const nextVer = (maxVerRow?.maxVer || 0) + 1;
        const verId = randomUUID();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO LoreVersion (
                id, entryId, campaignId, versionNumber, title, subtitle, category, content, tags, era, year_dr, changeSummary, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            verId,
            entry.id,
            entry.campaignId,
            nextVer,
            entry.title,
            entry.subtitle || null,
            entry.category,
            entry.content,
            entry.tags || null,
            entry.era || null,
            entry.year_dr || null,
            changeSummary,
            now
        );
        return verId;
    } catch (e) {
        console.error('[recordLoreVersion] Error recording version:', e);
        return null;
    }
}

export async function getLoreVersionsAction(entryId: string) {
    try {
        const rows = db.prepare("SELECT * FROM LoreVersion WHERE entryId = ? ORDER BY versionNumber DESC").all(entryId) as LoreVersion[];
        return actionResponse(rows);
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function rollbackLoreVersionAction(versionId: string) {
    try {
        const version = db.prepare("SELECT * FROM LoreVersion WHERE id = ?").get(versionId) as LoreVersion | undefined;
        if (!version) return actionResponse(null, "Versione storica non trovata.");

        const currentEntry = db.prepare("SELECT * FROM LoreEntry WHERE id = ?").get(version.entryId) as any;
        if (!currentEntry) return actionResponse(null, "Dossier correlato non trovato.");

        // Salva backup dello stato corrente prima del rollback
        await recordLoreVersion(version.entryId, `Backup prima del ripristino alla v${version.versionNumber}`);

        const now = new Date().toISOString();
        db.prepare(`
            UPDATE LoreEntry 
            SET title = ?, subtitle = ?, category = ?, content = ?, tags = ?, era = ?, year_dr = ?, updatedAt = ?
            WHERE id = ?
        `).run(
            version.title,
            version.subtitle || null,
            version.category,
            version.content,
            version.tags || null,
            version.era || null,
            version.year_dr || null,
            now,
            version.entryId
        );

        return actionResponse({ success: true, entryId: version.entryId, restoredVersionNumber: version.versionNumber });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function consolidateLoreEntryAction(entryId: string, instruction?: string) {
    try {
        const entry = db.prepare("SELECT * FROM LoreEntry WHERE id = ?").get(entryId) as any;
        if (!entry) return actionResponse(null, "Dossier non trovato.");

        // Salva snapshot della versione prima del consolidamento
        await recordLoreVersion(entryId, "Snapshot prima del consolidamento e deduplicazione IA");

        const override = await getSystemOverride('lore-gen');
        const res = await runAiWithRetry(() => consolidateAndDeduplicateLore({
            title: entry.title,
            category: entry.category,
            subtitle: entry.subtitle || '',
            content: entry.content,
            tags: entry.tags || '',
            instruction,
            systemOverride: override
        }), 'WORLD');
        await logApiUsage('WORLD', 'success');

        const now = new Date().toISOString();
        db.prepare(`
            UPDATE LoreEntry 
            SET title = ?, category = ?, subtitle = ?, content = ?, tags = ?, era = ?, year_dr = ?, chronology_order = ?, updatedAt = ?
            WHERE id = ?
        `).run(
            res.title,
            res.category,
            res.subtitle || null,
            res.content,
            res.tags || null,
            res.era || null,
            res.year_dr || null,
            res.chronology_order ?? 0,
            now,
            entryId
        );

        // Registra nuova versione post-consolidamento
        await recordLoreVersion(entryId, "Consolidamento, Deduplicazione e Riordino Cronologico IA");

        return actionResponse(res);
    } catch (e: any) {
        await logApiUsage('WORLD', 'error');
        return actionResponse(null, e.message);
    }
}

export async function createLoreNoteAction(campaignId: string, content: string, title?: string) {
    try {
        if (!content.trim()) return actionResponse(null, "Il testo della nota non può essere vuoto.");
        const id = randomUUID();
        const now = new Date().toISOString();
        const safeTitle = formatTitleOrTag(title) || `Nota #${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
        const formattedContent = formatNarrativeText(content);

        db.prepare(`
            INSERT INTO LoreEntry (id, campaignId, title, category, content, status, createdAt, updatedAt)
            VALUES (?, ?, ?, 'generale', ?, 'inbox', ?, ?)
        `).run(id, campaignId, safeTitle, formattedContent, now, now);

        return actionResponse({ id, title: safeTitle, content: formattedContent });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function deleteLoreNoteAction(id: string) {
    try {
        db.prepare("DELETE FROM LoreEntry WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function synthesizeInboxAction(campaignId: string) {
    try {
        const inboxNotes = db.prepare("SELECT * FROM LoreEntry WHERE campaignId = ? AND status = 'inbox'").all(campaignId) as any[];
        if (inboxNotes.length === 0) {
            return actionResponse(null, "Nessuna nota grezza nell'Inbox da sintetizzare.");
        }

        const canonicalEntries = db.prepare("SELECT id, title, category, content FROM LoreEntry WHERE campaignId = ? AND (status = 'canonical' OR status IS NULL)").all(campaignId) as any[];

        const plan = await runAiWithRetry(() => synthesizeInboxNotes(
            inboxNotes.map(n => ({ id: n.id, content: `${n.title ? n.title + ': ' : ''}${n.content}` })),
            canonicalEntries
        ), 'WORLD');
        await logApiUsage('WORLD', 'success');

        const now = new Date().toISOString();
        let newCount = 0;
        let updateCount = 0;

        for (const act of plan.actions) {
            if (act.actionType === 'update' && act.targetEntryId) {
                // Record snapshot before update
                await recordLoreVersion(act.targetEntryId, `Fusione note inbox: ${act.changeSummary}`);
                db.prepare(`
                    UPDATE LoreEntry 
                    SET title = ?, category = ?, subtitle = ?, content = ?, tags = ?, era = ?, year_dr = ?, chronology_order = ?, updatedAt = ?
                    WHERE id = ?
                `).run(
                    act.title,
                    act.category,
                    act.subtitle || null,
                    act.content,
                    act.tags || null,
                    act.era || null,
                    act.year_dr || null,
                    act.chronology_order ?? 0,
                    now,
                    act.targetEntryId
                );
                updateCount++;
            } else {
                const newId = randomUUID();
                db.prepare(`
                    INSERT INTO LoreEntry (id, campaignId, title, category, subtitle, content, tags, era, year_dr, chronology_order, status, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'canonical', ?, ?)
                `).run(
                    newId,
                    campaignId,
                    act.title,
                    act.category,
                    act.subtitle || null,
                    act.content,
                    act.tags || null,
                    act.era || null,
                    act.year_dr || null,
                    act.chronology_order ?? 0,
                    now,
                    now
                );
                await recordLoreVersion(newId, `Creazione da sintesi note: ${act.changeSummary}`);
                newCount++;
            }
        }

        // Clean up processed inbox notes
        db.prepare("DELETE FROM LoreEntry WHERE campaignId = ? AND status = 'inbox'").run(campaignId);

        return actionResponse({
            success: true,
            planSummary: plan.planSummary,
            newCount,
            updateCount,
            processedNotesCount: inboxNotes.length
        });
    } catch (e: any) {
        await logApiUsage('WORLD', 'error');
        return actionResponse(null, e.message);
    }
}

export async function extractLoreAction(input: { rawText?: string; youtubeUrl?: string; promptInstruction?: string }) {
    try {
        const override = await getSystemOverride('lore-gen');
        const res = await runAiWithRetry(() => extractLore({ ...input, systemOverride: override }), 'WORLD');
        await logApiUsage('WORLD', 'success');
        return actionResponse(res);
    } catch (e: any) {
        await logApiUsage('WORLD', 'error');
        return actionResponse(null, e.message);
    }
}

export async function expandLoreAction(entryId: string, instruction: string) {
    try {
        const entry = db.prepare("SELECT * FROM LoreEntry WHERE id = ?").get(entryId) as any;
        if (!entry) return actionResponse(null, "Dossier non trovato.");
        
        // Salva versione storica prima di espandere
        await recordLoreVersion(entryId, `Espansione IA: "${instruction.slice(0, 40)}..."`);

        const override = await getSystemOverride('lore-gen');
        const res = await runAiWithRetry(() => expandLore({
            title: entry.title,
            category: entry.category,
            currentContent: entry.content,
            instruction,
            sourceUrl: entry.sourceUrl,
            systemOverride: override
        }), 'WORLD');
        await logApiUsage('WORLD', 'success');

        const now = new Date().toISOString();
        db.prepare("UPDATE LoreEntry SET content = ?, updatedAt = ? WHERE id = ?").run(res.content, now, entryId);
        return actionResponse({ success: true, content: res.content });
    } catch (e: any) {
        await logApiUsage('WORLD', 'error');
        return actionResponse(null, e.message);
    }
}

export async function refineLoreDraftAction(input: {
    title: string;
    category: 'citta' | 'storia' | 'personaggio' | 'fazione' | 'generale';
    subtitle?: string;
    currentContent: string;
    tags?: string;
    instruction: string;
    sourceUrl?: string;
}) {
    try {
        const override = await getSystemOverride('lore-gen');
        const res = await runAiWithRetry(() => refineLoreDraft({ ...input, systemOverride: override }), 'WORLD');
        await logApiUsage('WORLD', 'success');
        return actionResponse(res);
    } catch (e: any) {
        await logApiUsage('WORLD', 'error');
        return actionResponse(null, e.message);
    }
}

export async function saveLoreEntry(data: any) {
    try {
        const id = data.id || randomUUID();
        const now = new Date().toISOString();

        // Se l'entry esiste già ed è in modifica, registra una versione storica
        if (data.id) {
            await recordLoreVersion(data.id, data.changeSummary || "Modifica manuale del DM");
        }

        const cols = getTableCols('LoreEntry');
        const d: Record<string, any> = {
            id,
            campaignId: data.campaignId,
            title: formatTitleOrTag(data.title),
            category: data.category || 'generale',
            subtitle: formatTitleOrTag(data.subtitle) || '',
            content: formatNarrativeText(data.content) || '',
            tags: formatTitleOrTag(data.tags) || '',
            sourceUrl: data.sourceUrl || '',
            era: data.era || null,
            year_dr: data.year_dr || null,
            chronology_order: data.chronology_order ?? 0,
            status: data.status || 'canonical',
            createdAt: data.createdAt || now,
            updatedAt: now
        };
        const insertCols = Object.keys(d).filter(c => cols.includes(c.toLowerCase()));
        const placeholders = insertCols.map(() => '?').join(',');
        const updateSet = insertCols.filter(c => !['id', 'campaignid', 'createdat'].includes(c.toLowerCase())).map(c => `${c}=excluded.${c}`).join(', ');
        db.prepare(`INSERT INTO LoreEntry (${insertCols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`).run(...insertCols.map(c => d[c]));

        // Se è nuova entry, registra la versione v1 iniziale
        if (!data.id) {
            await recordLoreVersion(id, "Creazione iniziale del dossier");
        }

        return actionResponse({ id });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function deleteLoreEntry(id: string) {
    try {
        db.prepare("DELETE FROM LoreEntry WHERE id = ?").run(id);
        return actionResponse({ success: true });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

// --- AZIONE FORMATTAZIONE GLOBALE DI TUTTI I TESTI SALVATI ---

export async function formatAllSavedTextsAction(campaignId?: string) {
    try {
        let loreUpdated = 0;
        let sessionsUpdated = 0;
        let arcsUpdated = 0;
        let rulesUpdated = 0;
        let campaignsUpdated = 0;
        let locationsUpdated = 0;
        let totalScanned = 0;

        const now = new Date().toISOString();

        db.transaction(() => {
            // 1. Dossier Lore
            const loreQuery = campaignId 
                ? db.prepare("SELECT * FROM LoreEntry WHERE campaignId = ?").all(campaignId) as LoreEntry[]
                : db.prepare("SELECT * FROM LoreEntry").all() as LoreEntry[];
            
            for (const item of loreQuery) {
                totalScanned++;
                const formattedContent = formatNarrativeText(item.content);
                const formattedTitle = formatTitleOrTag(item.title);
                const formattedSubtitle = formatTitleOrTag(item.subtitle);
                const formattedTags = formatTitleOrTag(item.tags);

                if (
                    formattedContent !== item.content ||
                    formattedTitle !== item.title ||
                    (formattedSubtitle || '') !== (item.subtitle || '') ||
                    (formattedTags || '') !== (item.tags || '')
                ) {
                    db.prepare(`
                        UPDATE LoreEntry 
                        SET title = ?, subtitle = ?, content = ?, tags = ?, updatedAt = ? 
                        WHERE id = ?
                    `).run(formattedTitle, formattedSubtitle || null, formattedContent, formattedTags || null, now, item.id);
                    loreUpdated++;
                }
            }

            // 2. Sessioni e Storie
            const sessionQuery = campaignId
                ? db.prepare("SELECT * FROM Session WHERE campaignId = ?").all(campaignId) as Session[]
                : db.prepare("SELECT * FROM Session").all() as Session[];

            for (const sess of sessionQuery) {
                totalScanned++;
                const formattedNotes = sess.notes ? formatNarrativeText(sess.notes) : null;
                const formattedTitle = formatTitleOrTag(sess.title);

                if (
                    (formattedNotes || '') !== (sess.notes || '') ||
                    formattedTitle !== sess.title
                ) {
                    db.prepare("UPDATE Session SET title = ?, notes = ?, updatedAt = ? WHERE id = ?")
                      .run(formattedTitle, formattedNotes, now, sess.id);
                    sessionsUpdated++;
                }
            }

            // 3. Archi Narrativi (Story Arcs)
            const arcQuery = campaignId
                ? db.prepare("SELECT * FROM StoryArc WHERE campaignId = ?").all(campaignId) as StoryArc[]
                : db.prepare("SELECT * FROM StoryArc").all() as StoryArc[];

            for (const arc of arcQuery) {
                totalScanned++;
                const formattedTitle = formatTitleOrTag(arc.title);
                const formattedSummary = arc.summary ? formatNarrativeText(arc.summary) : null;
                const formattedImpact = arc.world_impact ? formatNarrativeText(arc.world_impact) : null;

                if (
                    formattedTitle !== arc.title ||
                    (formattedSummary || '') !== (arc.summary || '') ||
                    (formattedImpact || '') !== (arc.world_impact || '')
                ) {
                    db.prepare("UPDATE StoryArc SET title = ?, summary = ?, world_impact = ?, updatedAt = ? WHERE id = ?")
                      .run(formattedTitle, formattedSummary, formattedImpact, now, arc.id);
                    arcsUpdated++;
                }
            }

            // 4. Regole Homebrew
            const rulesQuery = campaignId
                ? db.prepare("SELECT * FROM HomebrewRule WHERE campaignId = ?").all(campaignId) as HomebrewRule[]
                : db.prepare("SELECT * FROM HomebrewRule").all() as HomebrewRule[];

            for (const rule of rulesQuery) {
                totalScanned++;
                const formattedTitle = formatTitleOrTag(rule.title);
                const formattedContent = formatNarrativeText(rule.content);

                if (
                    formattedTitle !== rule.title ||
                    formattedContent !== rule.content
                ) {
                    db.prepare("UPDATE HomebrewRule SET title = ?, content = ?, updatedAt = ? WHERE id = ?")
                      .run(formattedTitle, formattedContent, now, rule.id);
                    rulesUpdated++;
                }
            }

            // 5. Campagna (Sinossi globale, compendio, ambientazione)
            const campQuery = campaignId
                ? db.prepare("SELECT * FROM Campaign WHERE id = ?").all(campaignId) as Campaign[]
                : db.prepare("SELECT * FROM Campaign").all() as Campaign[];

            for (const camp of campQuery) {
                totalScanned++;
                const formattedSummary = camp.summary ? formatNarrativeText(camp.summary) : null;
                const formattedCompendium = camp.global_compendium ? formatNarrativeText(camp.global_compendium) : null;
                const formattedDesc = camp.description ? formatNarrativeText(camp.description) : null;

                if (
                    (formattedSummary || '') !== (camp.summary || '') ||
                    (formattedCompendium || '') !== (camp.global_compendium || '') ||
                    (formattedDesc || '') !== (camp.description || '')
                ) {
                    db.prepare("UPDATE Campaign SET summary = ?, global_compendium = ?, description = ?, updatedAt = ? WHERE id = ?")
                      .run(formattedSummary, formattedCompendium, formattedDesc, now, camp.id);
                    campaignsUpdated++;
                }
            }

            // 6. Luoghi del Mondo (World Locations)
            const locQuery = campaignId
                ? db.prepare("SELECT * FROM WorldLocation WHERE campaignId = ?").all(campaignId) as WorldLocation[]
                : db.prepare("SELECT * FROM WorldLocation").all() as WorldLocation[];

            for (const loc of locQuery) {
                totalScanned++;
                const formattedDetails = loc.details ? formatNarrativeText(loc.details) : null;
                const formattedAtmosphere = loc.atmosphere ? formatNarrativeText(loc.atmosphere) : null;

                if (
                    (formattedDetails || '') !== (loc.details || '') ||
                    (formattedAtmosphere || '') !== (loc.atmosphere || '')
                ) {
                    db.prepare("UPDATE WorldLocation SET details = ?, atmosphere = ?, updatedAt = ? WHERE id = ?")
                      .run(formattedDetails, formattedAtmosphere, now, loc.id);
                    locationsUpdated++;
                }
            }
        })();

        const totalUpdated = loreUpdated + sessionsUpdated + arcsUpdated + rulesUpdated + campaignsUpdated + locationsUpdated;

        return actionResponse({
            success: true,
            loreUpdated,
            sessionsUpdated,
            arcsUpdated,
            rulesUpdated,
            campaignsUpdated,
            locationsUpdated,
            totalUpdated,
            totalScanned
        });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

/**
 * Ottiene tutte le impostazioni di sistema salvate nel database.
 */
export async function getSystemSettings(): Promise<Record<string, string>> {
    try {
        const rows = db.prepare('SELECT key, value FROM SystemSetting').all() as { key: string, value: string }[];
        const settings: Record<string, string> = {};
        for (const row of rows) {
            settings[row.key] = row.value;
        }
        return settings;
    } catch (e) {
        console.error("Errore nel recupero dei SystemSetting:", e);
        return {};
    }
}

/**
 * Salva o aggiorna un'impostazione di sistema nel database.
 */
export async function saveSystemSetting(key: string, value: string) {
    'use server';
    try {
        db.prepare('INSERT INTO SystemSetting (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP').run(key, value);
        return actionResponse({ success: true });
    } catch (e: any) {
        console.error(`Errore nel salvataggio di SystemSetting ${key}:`, e);
        return actionResponse(null, e.message);
    }
}

/**
 * Registra o aggiorna l'attività di un dispositivo.
 */
export async function registerDeviceAction(id: string, name: string, campaignId?: string, clientIp?: string, clientNetwork?: string, mode?: 'master' | 'player') {
    'use server';
    try {
        let ip = clientIp || '';
        let ua = '';
        try {
            const { headers } = await import('next/headers');
            const headerList = await headers();
            const forwarded = headerList.get('x-forwarded-for');
            if (forwarded) {
                ip = forwarded.split(',')[0].trim();
            } else {
                ip = headerList.get('x-real-ip') || clientIp || '';
            }
            ua = headerList.get('user-agent') || '';
        } catch (eh) {
            // Fallback se headers() non è disponibile in determinati contesti di caricamento
        }

        const existing = db.prepare("SELECT * FROM Device WHERE id = ?").get(id) as any;
        const now = new Date().toISOString();
        if (existing) {
            db.prepare(`
                UPDATE Device 
                SET name = ?, last_active = ?, campaignId = COALESCE(?, campaignId), 
                    ip_address = COALESCE(NULLIF(?, ''), ip_address), 
                    network_name = COALESCE(NULLIF(?, ''), network_name), 
                    userAgent = COALESCE(NULLIF(?, ''), userAgent), 
                    mode = COALESCE(?, mode)
                WHERE id = ?
            `).run(name, now, campaignId || null, ip || null, clientNetwork || null, ua || null, mode || null, id);
        } else {
            db.prepare(`
                INSERT INTO Device (id, name, mode, blocked_views, blocked_npcs, blocked_locations, is_blocked, last_active, campaignId, ip_address, network_name, userAgent, use_custom_views)
                VALUES (?, ?, COALESCE(?, 'player'), '[]', '[]', '[]', 0, ?, ?, ?, ?, ?, 0)
            `).run(id, name, mode || null, now, campaignId || null, ip || null, clientNetwork || null, ua || null);
        }

        const device = db.prepare("SELECT * FROM Device WHERE id = ?").get(id) as any;
        const systemSettings = await getSystemSettings();

        // Calcolo sezioni bloccate effettive per questo dispositivo
        let effectiveBlockedViews: string[] = [];
        if (device.mode === 'master') {
            effectiveBlockedViews = [];
        } else if (Boolean(device.use_custom_views)) {
            try {
                effectiveBlockedViews = JSON.parse(device.blocked_views || '[]');
            } catch {
                effectiveBlockedViews = [];
            }
        } else {
            try {
                const globalViews = systemSettings.blocked_views;
                if (globalViews) {
                    effectiveBlockedViews = JSON.parse(globalViews);
                } else {
                    effectiveBlockedViews = ['storia', 'quest-creator', 'party-xp', 'combattimenti', 'anagrafe', 'tesori', 'manuale-importa', 'bestiario', 'impostazioni', 'sistema'];
                }
            } catch {
                effectiveBlockedViews = [];
            }
        }

        return actionResponse({
            device,
            systemSettings,
            effective_blocked_views: effectiveBlockedViews
        });
    } catch (e: any) {
        console.error("Errore in registerDeviceAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Ottiene tutti i dispositivi registrati.
 */
export async function getDevicesAction() {
    'use server';
    try {
        const devices = db.prepare("SELECT * FROM Device ORDER BY last_active DESC").all();
        return actionResponse(devices);
    } catch (e: any) {
        console.error("Errore in getDevicesAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Aggiorna la configurazione di sicurezza/permessi di un dispositivo specifico.
 */
export async function updateDeviceConfigAction(deviceId: string, data: {
    name?: string;
    mode?: 'master' | 'player';
    blocked_views?: string;
    blocked_npcs?: string;
    blocked_locations?: string;
    is_blocked?: boolean;
    use_custom_views?: boolean | number;
    campaignId?: string | null;
}) {
    'use server';
    try {
        const fields: string[] = [];
        const params: any[] = [];
        
        if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
        if (data.mode !== undefined) { fields.push("mode = ?"); params.push(data.mode); }
        if (data.blocked_views !== undefined) { fields.push("blocked_views = ?"); params.push(data.blocked_views); }
        if (data.blocked_npcs !== undefined) { fields.push("blocked_npcs = ?"); params.push(data.blocked_npcs); }
        if (data.blocked_locations !== undefined) { fields.push("blocked_locations = ?"); params.push(data.blocked_locations); }
        if (data.is_blocked !== undefined) { fields.push("is_blocked = ?"); params.push(data.is_blocked ? 1 : 0); }
        if (data.use_custom_views !== undefined) { fields.push("use_custom_views = ?"); params.push(data.use_custom_views ? 1 : 0); }
        if (data.campaignId !== undefined) { fields.push("campaignId = ?"); params.push(data.campaignId); }
        
        if (fields.length === 0) {
            return actionResponse({ success: true });
        }
        
        fields.push("last_active = ?");
        params.push(new Date().toISOString());
        
        params.push(deviceId);
        
        const query = `UPDATE Device SET ${fields.join(', ')} WHERE id = ?`;
        db.prepare(query).run(...params);
        
        return actionResponse({ success: true });
    } catch (e: any) {
        console.error("Errore in updateDeviceConfigAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Imposta il ruolo di un dispositivo dal pannello Master (master, player o isola).
 */
export async function setDeviceRoleAction(deviceId: string, role: 'master' | 'player' | 'isola') {
    'use server';
    try {
        const now = new Date().toISOString();
        if (role === 'master') {
            db.prepare("UPDATE Device SET mode = 'master', is_blocked = 0, last_active = ? WHERE id = ?").run(now, deviceId);
        } else if (role === 'player') {
            db.prepare("UPDATE Device SET mode = 'player', is_blocked = 0, last_active = ? WHERE id = ?").run(now, deviceId);
        } else if (role === 'isola') {
            db.prepare("UPDATE Device SET is_blocked = 1, last_active = ? WHERE id = ?").run(now, deviceId);
        }
        return actionResponse({ success: true });
    } catch (e: any) {
        console.error("Errore in setDeviceRoleAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Sblocca un dispositivo portandolo a modalità Master se il PIN o la password fornita è corretta.
 */
export async function unlockDeviceToMasterAction(deviceId: string, secret?: string) {
    'use server';
    try {
        const pinRow = db.prepare("SELECT value FROM SystemSetting WHERE key = 'master_pin_hash'").get() as { value: string } | undefined;
        const pwdRow = db.prepare("SELECT value FROM SystemSetting WHERE key = 'master_password_hash'").get() as { value: string } | undefined;

        if (secret) {
            const normalized = secret.trim();
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
            const computedHash = `sigil_${part1}_${part2}`;

            const isPinValid = Boolean(pinRow?.value && computedHash === pinRow.value);
            const isPwdValid = Boolean(pwdRow?.value && computedHash === pwdRow.value);

            // Se il DB ha PIN/pwd registrati ma non corrispondono
            if ((pinRow?.value || pwdRow?.value) && !isPinValid && !isPwdValid) {
                return actionResponse(null, "PIN o Password errati. Accesso negato.");
            }
        }

        const now = new Date().toISOString();
        db.prepare("UPDATE Device SET mode = 'master', is_blocked = 0, last_active = ? WHERE id = ?").run(now, deviceId);
        return actionResponse({ success: true });
    } catch (e: any) {
        console.error("Errore in unlockDeviceToMasterAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Elimina un dispositivo registrato.
 */
export async function deleteDeviceAction(deviceId: string) {
    'use server';
    try {
        db.prepare("DELETE FROM Device WHERE id = ?").run(deviceId);
        return actionResponse({ success: true });
    } catch (e: any) {
        console.error("Errore in deleteDeviceAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Ottiene tutti i luoghi di una campagna.
 */
export async function getWorldLocationsAction(campaignId: string) {
    'use server';
    try {
        const locations = db.prepare("SELECT * FROM WorldLocation WHERE campaignId = ? ORDER BY name ASC").all(campaignId);
        return actionResponse(locations);
    } catch (e: any) {
        console.error("Errore in getWorldLocationsAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Ottiene tutti i PNG di una campagna.
 */
export async function getCampaignNpcsAction(campaignId: string) {
    'use server';
    try {
        const npcs = db.prepare("SELECT * FROM Npc WHERE campaignId = ? ORDER BY name ASC").all(campaignId);
        return actionResponse(npcs);
    } catch (e: any) {
        console.error("Errore in getCampaignNpcsAction:", e);
        return actionResponse(null, e.message);
    }
}

/**
 * Esegue l'ottimizzazione del database SQLite tramite VACUUM e ANALYZE.
 * Restituisce i dettagli delle dimensioni prima e dopo l'operazione.
 */
export async function runVacuumAction() {
    'use server';
    try {
        if (!fs.existsSync(dbPath)) {
            return actionResponse(null, "File database non trovato sul disco.");
        }

        const beforeStats = fs.statSync(dbPath);
        const sizeBefore = beforeStats.size;

        // Esegue il VACUUM e l'ANALYZE per ottimizzare gli indici e liberare lo spazio inutilizzato
        db.prepare('VACUUM').run();
        db.prepare('ANALYZE').run();

        const afterStats = fs.statSync(dbPath);
        const sizeAfter = afterStats.size;

        return actionResponse({
            success: true,
            sizeBefore,
            sizeAfter,
            spaceSaved: Math.max(0, sizeBefore - sizeAfter),
            optimizedAt: new Date().toISOString()
        });
    } catch (e: any) {
        console.error("Errore durante l'ottimizzazione VACUUM del database:", e);
        return actionResponse(null, e.message);
    }
}

// --- AZIONI DI SISTEMA GLOBALI (SCRITTURA PERSISTENTE IN DATA/SYSTEM) ---

function getSystemJsonPath(fileName: string): string {
    const dataDir = path.join(process.cwd(), 'data', 'system');
    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir, { recursive: true });
        } catch (e) {
            console.error('Impossibile creare la cartella data/system:', e);
        }
    }
    const targetPath = path.join(dataDir, fileName);
    // Se non esiste ancora in data/system, facciamo seed iniziale da src/lib/dnd-data
    if (!fs.existsSync(targetPath)) {
        const srcPath = path.join(process.cwd(), 'src', 'lib', 'dnd-data', fileName);
        if (fs.existsSync(srcPath)) {
            try {
                fs.copyFileSync(srcPath, targetPath);
            } catch (copyErr) {
                console.error(`Errore seed ${fileName} in data/system:`, copyErr);
                return srcPath;
            }
        }
    }
    return targetPath;
}

function readSystemJsonFile<T>(fileName: string, key: string): T[] {
    try {
        const filePath = getSystemJsonPath(fileName);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            return parsed[key] || [];
        }
    } catch (err) {
        console.error(`Errore di lettura per il file di sistema ${fileName}:`, err);
    }
    return [];
}

function writeSystemJsonFile<T>(fileName: string, key: string, data: T[]) {
    try {
        const filePath = getSystemJsonPath(fileName);
        fs.writeFileSync(filePath, JSON.stringify({ [key]: data }, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error(`Errore di scrittura per il file di sistema ${fileName}:`, err);
        throw err;
    }
}

export async function getSystemRulesAction() {
    'use server';
    try {
        const rules = readSystemJsonFile<any>('custom-rules.json', 'rules');
        return actionResponse(rules);
    } catch (e: any) {
        return actionResponse([], e.message);
    }
}

export async function importSystemRuleAction(rule: any) {
    'use server';
    try {
        const rules = readSystemJsonFile<any>('custom-rules.json', 'rules');
        const id = rule?.id || `custom-rule-${Date.now()}`;
        const now = new Date().toISOString();
        
        const index = rules.findIndex((r: any) => r.id === id);
        const updatedRule = {
            ...rule,
            id,
            title: formatTitleOrTag(rule?.title) || 'Regola di Sistema',
            updatedAt: now
        };

        if (index > -1) {
            rules[index] = updatedRule;
        } else {
            rules.push(updatedRule);
        }

        writeSystemJsonFile('custom-rules.json', 'rules', rules);
        return actionResponse({ success: true, id });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function importSystemMonsterAction(monster: any) {
    'use server';
    try {
        const monsters = readSystemJsonFile<any>('custom-monsters.json', 'monsters');
        const name = (monster?.name || 'Mostro Sconosciuto').toString().trim();
        const nameKey = name.toLowerCase();
        const now = new Date().toISOString();
        
        const index = monsters.findIndex((m: any) => (m?.name || '').toString().toLowerCase().trim() === nameKey);
        const updatedMonster = {
            ...monster,
            name: formatTitleOrTag(name),
            updatedAt: now
        };

        if (index > -1) {
            monsters[index] = updatedMonster;
        } else {
            monsters.push(updatedMonster);
        }

        writeSystemJsonFile('custom-monsters.json', 'monsters', monsters);
        return actionResponse({ success: true, name });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function importSystemSpellAction(spell: any) {
    'use server';
    try {
        const spells = readSystemJsonFile<any>('custom-spells.json', 'spells');
        const name = (spell?.name || 'Incantesimo Sconosciuto').toString().trim();
        const nameKey = name.toLowerCase();
        const now = new Date().toISOString();
        
        const index = spells.findIndex((s: any) => (s?.name || '').toString().toLowerCase().trim() === nameKey);
        const updatedSpell = {
            ...spell,
            name: formatTitleOrTag(name),
            updatedAt: now
        };

        if (index > -1) {
            spells[index] = updatedSpell;
        } else {
            spells.push(updatedSpell);
        }

        writeSystemJsonFile('custom-spells.json', 'spells', spells);
        return actionResponse({ success: true, name });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function importSystemItemAction(item: any) {
    'use server';
    try {
        const items = readSystemJsonFile<any>('custom-items.json', 'items');
        const name = (item?.name || 'Oggetto Sconosciuto').toString().trim();
        const nameKey = name.toLowerCase();
        const now = new Date().toISOString();
        
        const index = items.findIndex((i: any) => (i?.name || '').toString().toLowerCase().trim() === nameKey);
        const updatedItem = {
            ...item,
            name: formatTitleOrTag(name),
            updatedAt: now
        };

        if (index > -1) {
            items[index] = updatedItem;
        } else {
            items.push(updatedItem);
        }

        writeSystemJsonFile('custom-items.json', 'items', items);
        return actionResponse({ success: true, name });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export type BulkImportPayload = {
    items?: Array<{ item: any; target: 'system' | 'campaign' }>;
    monsters?: Array<{ monster: any; target: 'system' | 'campaign' }>;
    spells?: Array<{ spell: any; target: 'system' | 'campaign' }>;
    skills?: Array<{ skill: any; target: 'system' | 'campaign' }>;
    rules?: Array<{ rule: any; target: 'system' | 'campaign' }>;
};

export async function bulkSaveImportedContentAction(campaignId: string, payload: BulkImportPayload) {
    'use server';
    try {
        let importedCount = 0;
        const now = new Date().toISOString();

        // 1. Salvataggio entità di Campagna nel database SQLite all'interno di un'unica transazione atomica
        db.transaction(() => {
            // A. Oggetti Campagna
            if (payload.items && payload.items.length > 0) {
                const campaignItems = payload.items.filter(i => i.target !== 'system');
                if (campaignItems.length > 0) {
                    const cols = getTableCols('MagicItem');
                    const stmt = db.prepare(`INSERT INTO MagicItem (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, rarity=excluded.rarity, attunement=excluded.attunement, description=excluded.description, cost=excluded.cost, damage=excluded.damage, techType=excluded.techType, updatedAt=excluded.updatedAt`);
                    for (const entry of campaignItems) {
                        const it = entry.item || {};
                        const id = it.id || randomUUID();
                        const d: Record<string, any> = {
                            id,
                            name: formatTitleOrTag(it.name) || 'Oggetto Magico',
                            type: it.type || 'Oggetto',
                            rarity: it.rarity || 'Comune',
                            attunement: it.attunement || 'No',
                            description: it.description || '',
                            cost: it.cost || 'N/D',
                            damage: it.damage || '',
                            techtype: it.techType || 'damage',
                            imageurl: it.imageUrl || null,
                            campaignid: campaignId,
                            createdat: it.createdAt || now,
                            updatedat: now
                        };
                        stmt.run(...cols.map(c => d[c.toLowerCase()]));
                        importedCount++;
                    }
                }
            }

            // B. Mostri Campagna
            if (payload.monsters && payload.monsters.length > 0) {
                const campaignMonsters = payload.monsters.filter(m => m.target !== 'system');
                if (campaignMonsters.length > 0) {
                    const cols = getTableCols('Monster');
                    const stmt = db.prepare(`INSERT INTO Monster (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, armorClass=excluded.armorClass, hitPoints=excluded.hitPoints, challenge=excluded.challenge, description=excluded.description, updatedAt=excluded.updatedAt`);
                    for (const entry of campaignMonsters) {
                        const m = entry.monster || {};
                        const id = m.id || randomUUID();
                        const d: Record<string, any> = {
                            id,
                            name: formatTitleOrTag(m.name) || 'Creatura',
                            type: m.type || 'Mostro',
                            armorclass: m.armorClass || '10',
                            hitpoints: m.hitPoints || '10',
                            challenge: m.challenge || '0',
                            description: m.description || '',
                            imageurl: m.imageUrl || null,
                            campaignid: campaignId,
                            createdat: m.createdAt || now,
                            updatedat: now
                        };
                        stmt.run(...cols.map(c => d[c.toLowerCase()]));
                        importedCount++;
                    }
                }
            }

            // C. Incantesimi Campagna
            if (payload.spells && payload.spells.length > 0) {
                const campaignSpells = payload.spells.filter(s => s.target !== 'system');
                if (campaignSpells.length > 0) {
                    const cols = getTableCols('CustomSpell');
                    const stmt = db.prepare(`INSERT INTO CustomSpell (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, level=excluded.level, school=excluded.school, casting_time=excluded.casting_time, range=excluded.range, components=excluded.components, duration=excluded.duration, description=excluded.description, classes=excluded.classes, updatedAt=excluded.updatedAt`);
                    for (const entry of campaignSpells) {
                        const s = entry.spell || {};
                        const id = s.id || randomUUID();
                        const d: Record<string, any> = {
                            id,
                            name: formatTitleOrTag(s.name) || 'Incantesimo',
                            level: s.level || '0',
                            school: s.school || 'Universale',
                            casting_time: s.casting_time || '1 azione',
                            range: s.range || 'Contatto',
                            components: s.components || 'V, S',
                            duration: s.duration || 'Istantanea',
                            description: s.description || '',
                            classes: s.classes || '',
                            campaignid: campaignId,
                            createdat: s.createdAt || now,
                            updatedat: now
                        };
                        stmt.run(...cols.map(c => d[c.toLowerCase()]));
                        importedCount++;
                    }
                }
            }

            // D. Abilità Campagna
            if (payload.skills && payload.skills.length > 0) {
                const campaignSkills = payload.skills;
                if (campaignSkills.length > 0) {
                    const cols = getTableCols('CustomSkill');
                    const stmt = db.prepare(`INSERT INTO CustomSkill (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, ability=excluded.ability, description=excluded.description, updatedAt=excluded.updatedAt`);
                    for (const entry of campaignSkills) {
                        const sk = entry.skill || {};
                        const id = sk.id || randomUUID();
                        const d: Record<string, any> = {
                            id,
                            name: formatTitleOrTag(sk.name) || 'Abilità',
                            ability: sk.ability || 'Varia',
                            description: sk.description || '',
                            campaignid: campaignId,
                            createdat: sk.createdAt || now,
                            updatedat: now
                        };
                        stmt.run(...cols.map(c => d[c.toLowerCase()]));
                        importedCount++;
                    }
                }
            }

            // E. Regole Homebrew Campagna
            if (payload.rules && payload.rules.length > 0) {
                const campaignRules = payload.rules.filter(r => r.target === 'campaign');
                if (campaignRules.length > 0) {
                    const cols = getTableCols('HomebrewRule');
                    const stmt = db.prepare(`INSERT INTO HomebrewRule (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, category=excluded.category, isActive=excluded.isActive, updatedAt=excluded.updatedAt`);
                    for (const entry of campaignRules) {
                        const r = entry.rule || {};
                        const id = r.id || randomUUID();
                        const d: Record<string, any> = {
                            id,
                            campaignid: campaignId,
                            title: formatTitleOrTag(r.title) || 'Regola Homebrew',
                            content: formatNarrativeText(r.content) || '',
                            category: r.chapterTitle || 'Generale',
                            isactive: 1,
                            createdat: r.createdAt || now,
                            updatedat: now
                        };
                        stmt.run(...cols.map(c => d[c.toLowerCase()]));
                        importedCount++;
                    }
                }
            }
        })();

        // 2. Salvataggio entità di Sistema nei file JSON (archiviati in data/system/ fuori da src per non innescare il watcher di Next.js)
        // A. Regole Sistema
        if (payload.rules && payload.rules.length > 0) {
            const systemRules = payload.rules.filter(r => r.target !== 'campaign');
            if (systemRules.length > 0) {
                const existing = readSystemJsonFile<any>('custom-rules.json', 'rules');
                for (const entry of systemRules) {
                    const r = entry.rule || {};
                    const id = r.id || `custom-rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                    const idx = existing.findIndex((ex: any) => ex.id === id || (ex.title && r.title && ex.title.toLowerCase().trim() === r.title.toLowerCase().trim()));
                    const updated = {
                        ...r,
                        id,
                        title: formatTitleOrTag(r.title) || 'Regola di Sistema',
                        content: r.content || '',
                        sourceBook: r.sourceBook || 'phb',
                        chapterTitle: r.chapterTitle || (r.sourceBook === 'dmg' ? 'Strumenti del DM' : 'Regole Generali'),
                        tags: Array.isArray(r.tags) ? r.tags : [],
                        updatedAt: now
                    };
                    if (idx > -1) {
                        existing[idx] = updated;
                    } else {
                        existing.push(updated);
                    }
                    importedCount++;
                }
                writeSystemJsonFile('custom-rules.json', 'rules', existing);
            }
        }

        // B. Oggetti Sistema
        if (payload.items && payload.items.length > 0) {
            const systemItems = payload.items.filter(i => i.target === 'system');
            if (systemItems.length > 0) {
                const existing = readSystemJsonFile<any>('custom-items.json', 'items');
                for (const entry of systemItems) {
                    const it = entry.item || {};
                    const name = (it.name || 'Oggetto Magico').toString().trim();
                    const nameKey = name.toLowerCase();
                    const idx = existing.findIndex((ex: any) => (ex.name || '').toString().toLowerCase().trim() === nameKey);
                    const updated = {
                        ...it,
                        name: formatTitleOrTag(name),
                        updatedAt: now
                    };
                    if (idx > -1) {
                        existing[idx] = updated;
                    } else {
                        existing.push(updated);
                    }
                    importedCount++;
                }
                writeSystemJsonFile('custom-items.json', 'items', existing);
            }
        }

        // C. Mostri Sistema
        if (payload.monsters && payload.monsters.length > 0) {
            const systemMonsters = payload.monsters.filter(m => m.target === 'system');
            if (systemMonsters.length > 0) {
                const existing = readSystemJsonFile<any>('custom-monsters.json', 'monsters');
                for (const entry of systemMonsters) {
                    const m = entry.monster || {};
                    const name = (m.name || 'Creatura').toString().trim();
                    const nameKey = name.toLowerCase();
                    const idx = existing.findIndex((ex: any) => (ex.name || '').toString().toLowerCase().trim() === nameKey);
                    const updated = {
                        ...m,
                        name: formatTitleOrTag(name),
                        updatedAt: now
                    };
                    if (idx > -1) {
                        existing[idx] = updated;
                    } else {
                        existing.push(updated);
                    }
                    importedCount++;
                }
                writeSystemJsonFile('custom-monsters.json', 'monsters', existing);
            }
        }

        // D. Incantesimi Sistema
        if (payload.spells && payload.spells.length > 0) {
            const systemSpells = payload.spells.filter(s => s.target === 'system');
            if (systemSpells.length > 0) {
                const existing = readSystemJsonFile<any>('custom-spells.json', 'spells');
                for (const entry of systemSpells) {
                    const s = entry.spell || {};
                    const name = (s.name || 'Incantesimo').toString().trim();
                    const nameKey = name.toLowerCase();
                    const idx = existing.findIndex((ex: any) => (ex.name || '').toString().toLowerCase().trim() === nameKey);
                    const updated = {
                        ...s,
                        name: formatTitleOrTag(name),
                        updatedAt: now
                    };
                    if (idx > -1) {
                        existing[idx] = updated;
                    } else {
                        existing.push(updated);
                    }
                    importedCount++;
                }
                writeSystemJsonFile('custom-spells.json', 'spells', existing);
            }
        }

        return actionResponse({ count: importedCount });
    } catch (e: any) {
        console.error("Errore bulkSaveImportedContentAction:", e);
        return actionResponse(null, e.message);
    }
}

export async function deleteSystemRuleAction(id: string) {
    'use server';
    try {
        const rules = readSystemJsonFile<any>('custom-rules.json', 'rules');
        const filtered = rules.filter((r: any) => r.id !== id);
        writeSystemJsonFile('custom-rules.json', 'rules', filtered);
        return actionResponse({ success: true });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function deleteSystemChapterAction(sourceBook: string, chapterTitle: string) {
    'use server';
    try {
        const rules = readSystemJsonFile<any>('custom-rules.json', 'rules');
        const filtered = rules.filter((r: any) => !(r.sourceBook === sourceBook && (r.chapterTitle === chapterTitle || r.chapterId === chapterTitle)));
        writeSystemJsonFile('custom-rules.json', 'rules', filtered);
        return actionResponse({ success: true, count: rules.length - filtered.length });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function clearSystemRulesAction(sourceBook?: 'phb' | 'dmg' | 'all') {
    'use server';
    try {
        if (!sourceBook || sourceBook === 'all') {
            writeSystemJsonFile('custom-rules.json', 'rules', []);
        } else {
            const rules = readSystemJsonFile<any>('custom-rules.json', 'rules');
            const filtered = rules.filter((r: any) => r.sourceBook !== sourceBook);
            writeSystemJsonFile('custom-rules.json', 'rules', filtered);
        }
        return actionResponse({ success: true });
    } catch (e: any) {
        return actionResponse(null, e.message);
    }
}

export async function parsePdfAction(base64Data: string, mimeType: string = 'application/pdf') {
    'use server';
    const isImage = mimeType.startsWith('image/');
    
    // Se è un'immagine, usiamo direttamente l'OCR avanzato di Gemini con retry automatico
    if (isImage) {
        try {
            const textResult = await runAiWithRetry(async () => {
                const genAi = getGenAI();
                const model = getActiveFlashModel();
                const response = await safeGenerateContent(genAi, {
                    model,
                    contents: [
                        {
                            inlineData: {
                                mimeType,
                                data: base64Data
                            }
                        },
                        "Sei un assistente esperto di D&D. Trascrivi fedelmente e in modo dettagliato tutto il testo contenuto in questa immagine, con particolare attenzione alle statistiche dei mostri, descrizioni degli oggetti magici, formule o descrizioni di magie, talenti o regole di gioco."
                    ]
                });
                return response.text;
            }, 'EXTRACTION');
            return actionResponse(textResult || "Nessun testo estratto dall'immagine.");
        } catch (geminiError: any) {
            return actionResponse(null, `Errore estrazione immagine con Gemini: ${geminiError.message}`);
        }
    }

    // Se è un PDF, proviamo prima con il parser locale veloce pdf-parse
    try {
        const pdfModule = await import('pdf-parse');
        const pdfParse = pdfModule.default || pdfModule;
        const buffer = Buffer.from(base64Data, 'base64');
        const data = await pdfParse(buffer);
        if (data && data.text && data.text.trim().length > 50) {
            return actionResponse(data.text);
        }
        throw new Error("Il PDF estratto locale è vuoto o scansionato (senza testo selezionabile).");
    } catch (e: any) {
        console.warn(`[PDF Parser] Fallito parser locale (${e.message}). Provo fallback OCR con Gemini...`);
        if (base64Data.length > 12 * 1024 * 1024) {
            return actionResponse(null, "Il PDF è troppo grande (>10MB) per l'invio in blocco unico a Gemini. Utilizza l'estrazione client per selezionare un intervallo di pagine (es. 1-50) nell'Importatore Intelligente.");
        }
        try {
            const pdfTextResult = await runAiWithRetry(async () => {
                const genAi = getGenAI();
                const model = getActiveFlashModel();
                const response = await safeGenerateContent(genAi, {
                    model,
                    contents: [
                        {
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: base64Data
                            }
                        },
                        "Sei un archivista di D&D. Leggi questo documento PDF ed estrai accuratamente tutto il suo contenuto testuale (regole, statistiche, descrizioni). Mantieni intatta la formattazione logica per permettere la catalogazione automatica."
                    ]
                });
                return response.text;
            }, 'EXTRACTION');
            return actionResponse(pdfTextResult || "Nessun testo estratto dal PDF.");
        } catch (geminiError: any) {
            return actionResponse(null, `Errore durante l'estrazione PDF (locale e fallback Gemini falliti): ${geminiError.message}`);
        }
    }
}

export async function askOracoloAi(prompt: string, history: { role: 'user' | 'model'; text: string }[], campaignId: string) {
    try {
        const genAi = getGenAI();
        const model = getActiveFlashModel('ORACULO');

        const contents = [
            ...history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }]
            })),
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ];

        const systemInstruction = `Sei l'Oracolo del Tessitore, l'intelligenza artificiale di supporto al Dungeon Master, esperto supremo di Dungeons & Dragons Quinta Edizione (D&D 5e) e di tutta la storia, lore, fazioni, cosmologia e geografia dei Forgotten Realms (incluso il Faerûn, la Costa della Spada, divinità, e personaggi iconici).
Il tuo obiettivo principale è aiutare il Master a:
1. Chiarire dubbi e applicare le regole ufficiali di D&D 5e (indicando possibilmente le fonti come PHB, DMG, ecc.).
2. Pianificare e ideare avventure, storie, trame, incontri e quest per la campagna in corso.
3. Improvvisare sul momento PNG, luoghi e dettagli d'atmosfera.

Rispondi sempre in italiano, usando un markdown formattato splendidamente, leggibile, strutturato ed evocativo. Se necessario, includi tabelle, blocchi di citazione o descrizioni narrative suggestive. Mantieni sempre una distinzione chiara tra il testo da leggere ai giocatori e le note riservate al DM.`;

        const res = await safeGenerateContent(genAi, {
            model,
            contents,
            config: {
                systemInstruction,
                temperature: 0.7,
            }
        }, 'ORACULO');

        return actionResponse(res.text || "");
    } catch (e: any) {
        console.error("[Oracolo AI] Error:", e);
        return actionResponse(null, e.message || String(e));
    }
}



