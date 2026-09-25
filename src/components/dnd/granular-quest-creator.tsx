'use client';

import React, { useState, useMemo } from 'react';
import { 
  CampaignWithRelations, 
  Session, 
  PlayerCharacter, 
  Npc, 
  MagicItem, 
  WorldLocation,
  GranularQuestConfig, 
  SelectedPcConfig, 
  SelectedNpcConfig, 
  SelectedItemConfig, 
  SelectedSpellConfig, 
  SelectedSkillConfig, 
  SelectedLocationConfig, 
  SelectedPreviousQuestLink,
  NpcQuestRole,
  ItemQuestRole
} from '@/lib/types';
import { generateGranularQuestAction, createSession } from '@/lib/actions';
import { PartyXpManager } from '@/components/dnd/party-xp-manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Sparkles, 
  Wand2, 
  Scroll, 
  Users, 
  UserCheck, 
  Shield, 
  Swords, 
  MapPin, 
  BookOpen, 
  Link2, 
  Trophy, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Compass, 
  Flame, 
  Save, 
  Layers, 
  Eye, 
  Edit3, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2,
  HelpCircle,
  Clock,
  Zap,
  Send,
  ArrowLeft,
  Sliders,
  Check,
  X
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

export function getDefaultRoleForNpc(npc: Npc): NpcQuestRole {
  try {
    const parsed = typeof npc.details === 'string' ? JSON.parse(npc.details || '{}') : (npc.details || {});
    const fullText = [
      npc.name,
      npc.alignment,
      npc.status,
      parsed.role,
      parsed.relationship,
      parsed.disposition,
      parsed.attitude,
      parsed.occupation,
      parsed.personality,
      parsed.mannerism,
      parsed.secret,
      parsed.encounterHook,
      parsed.alignment,
      parsed.faction,
      parsed.history
    ].filter(Boolean).join(' ').toLowerCase();

    if (fullText.match(/doppiogioch|doppio gi|traditor|spia|ingann|infiltrat/i)) {
      return 'doppiogiochista';
    }

    if (fullText.match(/compagno|spalla|guardia del corpo|seguace|membro del party/i)) {
      return 'compagno_party';
    }

    if (
      fullText.match(/nemico|ostile|antagonista|rivale|boss|malvagio|bandito|assassino|mostro|minaccia|avversario|criminale/i) ||
      (npc.alignment && npc.alignment.toLowerCase().includes('malvagio')) ||
      (parsed.alignment && parsed.alignment.toLowerCase().includes('malvagio'))
    ) {
      return 'nemico';
    }

    if (
      fullText.match(/amico|alleato|guida|committente|sostenitore|protettore|benefattore|re|duca|taverniere|mercat/i) ||
      (npc.alignment && npc.alignment.toLowerCase().includes('buono')) ||
      (parsed.alignment && parsed.alignment.toLowerCase().includes('buono'))
    ) {
      return 'amico';
    }
  } catch (e) {
    // fallback
  }

  return 'amico';
}

const roleBadgeLabels: Record<NpcQuestRole, { label: string; colorClass: string }> = {
  amico: { label: 'Amico', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  nemico: { label: 'Nemico', colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  doppiogiochista: { label: 'Doppiogiochista', colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  da_amico_a_nemico: { label: 'Traditore', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  da_nemico_a_amico: { label: 'Redento', colorClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  compagno_party: { label: 'Spalla', colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' }
};

interface GranularQuestCreatorProps {
  campaign: CampaignWithRelations;
  onQuestSaved?: (newSession: Session) => void;
  onBackToStories?: () => void;
  onPcsUpdated?: (updatedPcs: PlayerCharacter[]) => void;
}

export function GranularQuestCreator({
  campaign,
  onQuestSaved,
  onBackToStories,
  onPcsUpdated,
}: GranularQuestCreatorProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'prompt' | 'context' | 'pcs' | 'npcs' | 'items' | 'lore_places' | 'links' | 'output'>('prompt');

  // Prompt and Core Narrative Directives
  const [customPrompt, setCustomPrompt] = useState('');
  const [questTitleProposal, setQuestTitleProposal] = useState('');
  const [narrativeTone, setNarrativeTone] = useState<GranularQuestConfig['narrativeTone']>('Epico ed Eroico');
  const [primaryEncounterType, setPrimaryEncounterType] = useState<GranularQuestConfig['primaryEncounterType']>('Bilanciato (Combattimento + Sociale + Esplorazione)');
  const [targetDifficulty, setTargetDifficulty] = useState<GranularQuestConfig['targetDifficulty']>('Medio');
  const [pacingSpeed, setPacingSpeed] = useState<GranularQuestConfig['pacingSpeed']>('Regolare');
  const [plotTwistLikelihood, setPlotTwistLikelihood] = useState<GranularQuestConfig['plotTwistLikelihood']>('Colpo di Scena Moderato');
  const [specificThreatsOrMonsters, setSpecificThreatsOrMonsters] = useState('');

  // Context Switches (Homebrew & Setting enabled by default)
  const [includeCampaignSummary, setIncludeCampaignSummary] = useState(true);
  const [includeRecentSessionsSummary, setIncludeRecentSessionsSummary] = useState(true);
  const [includeGlobalLore, setIncludeGlobalLore] = useState(true);
  const [includeHomebrewRules, setIncludeHomebrewRules] = useState(true);

  // Selected PCs (Optional additions - 100% independent and individual)
  const [selectedPcs, setSelectedPcs] = useState<SelectedPcConfig[]>([]);

  // Selected NPCs (Optional additions - 100% independent and individual)
  const [selectedNpcs, setSelectedNpcs] = useState<SelectedNpcConfig[]>([]);

  // Selected Items (Optional additions - 100% independent and individual)
  const [selectedItems, setSelectedItems] = useState<SelectedItemConfig[]>([]);

  // Selected Spells & Skills (Optional additions)
  const [selectedSpells, setSelectedSpells] = useState<SelectedSpellConfig[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkillConfig[]>([]);

  // Selected Locations (Optional additions - 100% independent and individual)
  const [selectedLocations, setSelectedLocations] = useState<SelectedLocationConfig[]>([]);

  // Previous Quest Links (Optional additions - 100% independent and individual)
  const [previousQuestLinks, setPreviousQuestLinks] = useState<SelectedPreviousQuestLink[]>([]);

  // Quick Inline Drawer in Tab 1
  const [quickPickerCategory, setQuickPickerCategory] = useState<'none' | 'pcs' | 'npcs' | 'items' | 'locations' | 'links'>('none');

  // Generation & AI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedStory, setGeneratedStory] = useState('');
  const [generatedXp, setGeneratedXp] = useState(0);
  const [xpDetails, setXpDetails] = useState<any>(null);
  const [modificationRequest, setModificationRequest] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [showXpManager, setShowXpManager] = useState(false);
  const [isManualEditing, setIsManualEditing] = useState(false);

  // Helper count of selected items across tabs for badge indicators
  const pcsCount = selectedPcs.length;
  const npcsCount = selectedNpcs.length;
  const itemsCount = selectedItems.length;
  const spellsAndSkillsCount = selectedSpells.length + selectedSkills.length;
  const locationsCount = selectedLocations.length;
  const linksCount = previousQuestLinks.length;

  // Toggle PC selection
  const handleTogglePc = (pc: PlayerCharacter) => {
    setSelectedPcs(prev => {
      const exists = prev.some(p => p.pcId === pc.id);
      if (exists) {
        return prev.filter(p => p.pcId !== pc.id);
      } else {
        return [
          ...prev,
          {
            pcId: pc.id,
            name: pc.name,
            includeIdeals: true,
            includeBonds: true,
            includeFlaws: true,
            includeStats: true,
            includeSpellsAndSkills: true,
            customFocus: '',
          },
        ];
      }
    });
  };

  const handleSelectAllPcs = () => {
    setSelectedPcs(
      (campaign.playerCharacters || []).map(pc => ({
        pcId: pc.id,
        name: pc.name,
        includeIdeals: true,
        includeBonds: true,
        includeFlaws: true,
        includeStats: true,
        includeSpellsAndSkills: true,
        customFocus: '',
      }))
    );
  };

  const handleDeselectAllPcs = () => {
    setSelectedPcs([]);
  };

  const handleUpdatePcConfig = (pcId: string, updates: Partial<SelectedPcConfig>) => {
    setSelectedPcs(prev => prev.map(p => (p.pcId === pcId ? { ...p, ...updates } : p)));
  };

  // Item filter state (Tutti, Base, Creati)
  const [itemSourceFilter, setItemSourceFilter] = useState<'all' | 'base' | 'created'>('all');

  const filteredMagicItems = useMemo(() => {
    const items = campaign.magicItems || [];
    if (itemSourceFilter === 'base') {
      return items.filter(i => i.source === 'base' || (!i.source && !i.campaignId));
    }
    if (itemSourceFilter === 'created') {
      return items.filter(i => i.source === 'created' || !!i.campaignId);
    }
    return items;
  }, [campaign.magicItems, itemSourceFilter]);

  // Toggle NPC selection
  const handleToggleNpc = (npc: Npc) => {
    const parsed = typeof npc.details === 'string' ? JSON.parse(npc.details || '{}') : npc.details;
    const name = parsed?.name || npc.name || 'PNG Senza Nome';
    const defaultRole = getDefaultRoleForNpc(npc);
    setSelectedNpcs(prev => {
      const exists = prev.some(n => n.npcId === npc.id);
      if (exists) {
        return prev.filter(n => n.npcId !== npc.id);
      } else {
        return [
          ...prev,
          {
            npcId: npc.id,
            name,
            role: defaultRole,
            customGoal: '',
          },
        ];
      }
    });
  };

  const handleSelectAllNpcs = () => {
    setSelectedNpcs(
      (campaign.npcs || []).map(npc => {
        const parsed = typeof npc.details === 'string' ? JSON.parse(npc.details || '{}') : npc.details;
        const defaultRole = getDefaultRoleForNpc(npc);
        return {
          npcId: npc.id,
          name: parsed?.name || npc.name || 'PNG Senza Nome',
          role: defaultRole,
          customGoal: '',
        };
      })
    );
  };

  const handleDeselectAllNpcs = () => {
    setSelectedNpcs([]);
  };

  const handleUpdateNpcRole = (npcId: string, role: NpcQuestRole, customGoal?: string) => {
    setSelectedNpcs(prev =>
      prev.map(n => (n.npcId === npcId ? { ...n, role, customGoal: customGoal !== undefined ? customGoal : n.customGoal } : n))
    );
  };

  // Toggle Item selection
  const handleToggleItem = (item: MagicItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.itemId === item.id);
      if (exists) {
        return prev.filter(i => i.itemId !== item.id);
      } else {
        return [
          ...prev,
          {
            itemId: item.id,
            name: item.name,
            role: 'trovato',
            notes: '',
          },
        ];
      }
    });
  };

  const handleSelectAllItems = () => {
    setSelectedItems(
      filteredMagicItems.map(item => ({
        itemId: item.id || item.name,
        name: item.name,
        role: 'trovato',
        notes: '',
      }))
    );
  };

  const handleDeselectAllItems = () => {
    setSelectedItems([]);
  };

  const handleUpdateItemRole = (itemId: string, role: ItemQuestRole, notes?: string) => {
    setSelectedItems(prev =>
      prev.map(i => (i.itemId === itemId ? { ...i, role, notes: notes !== undefined ? notes : i.notes } : i))
    );
  };

  // Toggle Location selection
  const handleToggleLocation = (loc: WorldLocation) => {
    setSelectedLocations(prev => {
      const exists = prev.some(l => l.locationId === loc.id);
      if (exists) {
        return prev.filter(l => l.locationId !== loc.id);
      } else {
        return [
          ...prev,
          {
            locationId: loc.id,
            name: loc.name,
            role: 'destinazione',
            atmosphere: loc.atmosphere || '',
          },
        ];
      }
    });
  };

  const handleSelectAllLocations = () => {
    setSelectedLocations(
      (campaign.worldLocations || []).map(loc => ({
        locationId: loc.id,
        name: loc.name,
        role: 'destinazione',
        atmosphere: loc.atmosphere || '',
      }))
    );
  };

  const handleDeselectAllLocations = () => {
    setSelectedLocations([]);
  };

  // Toggle Session Link
  const handleToggleSessionLink = (session: Session) => {
    setPreviousQuestLinks(prev => {
      const exists = prev.some(l => l.sessionId === session.id);
      if (exists) {
        return prev.filter(l => l.sessionId !== session.id);
      } else {
        return [
          ...prev,
          {
            sessionId: session.id,
            sessionNumber: session.session_number,
            title: session.title,
            linkType: 'conseguenza_diretta',
            customHookNote: '',
          },
        ];
      }
    });
  };

  const handleSelectAllSessionLinks = () => {
    setPreviousQuestLinks(
      (campaign.sessions || []).map(sess => ({
        sessionId: sess.id,
        sessionNumber: sess.session_number,
        title: sess.title,
        linkType: 'conseguenza_diretta',
        customHookNote: '',
      }))
    );
  };

  const handleDeselectAllSessionLinks = () => {
    setPreviousQuestLinks([]);
  };

  const handleClearAllOptionalModules = () => {
    setSelectedPcs([]);
    setSelectedNpcs([]);
    setSelectedItems([]);
    setSelectedLocations([]);
    setSelectedSpells([]);
    setSelectedSkills([]);
    setPreviousQuestLinks([]);
    toast.info('Tutti gli elementi opzionali sono stati deselezionati.');
  };

  // Apply Quick Preset Templates
  const handleApplyPresetTemplate = (preset: {
    title: string;
    prompt: string;
    tone: GranularQuestConfig['narrativeTone'];
    encounterType: GranularQuestConfig['primaryEncounterType'];
    difficulty: GranularQuestConfig['targetDifficulty'];
    pacing: GranularQuestConfig['pacingSpeed'];
    plotTwist: GranularQuestConfig['plotTwistLikelihood'];
  }) => {
    setQuestTitleProposal(preset.title);
    setCustomPrompt(preset.prompt);
    setNarrativeTone(preset.tone);
    setPrimaryEncounterType(preset.encounterType);
    setTargetDifficulty(preset.difficulty);
    setPacingSpeed(preset.pacing);
    setPlotTwistLikelihood(preset.plotTwist);
    toast.info(`Preset "${preset.title}" applicato!`);
  };

  // Build Payload
  const buildConfig = (): GranularQuestConfig => {
    return {
      campaignId: campaign.id,
      customPrompt: customPrompt.trim() || undefined,
      questTitleProposal: questTitleProposal.trim() || undefined,
      narrativeTone,
      primaryEncounterType,
      targetDifficulty,
      pacingSpeed,
      plotTwistLikelihood,
      specificThreatsOrMonsters: specificThreatsOrMonsters.trim() || undefined,
      includeCampaignSummary,
      includeRecentSessionsSummary,
      includeGlobalLore,
      includeHomebrewRules,
      selectedPcs,
      selectedNpcs,
      selectedItems,
      selectedSpells,
      selectedSkills,
      selectedLocations,
      previousQuestLinks,
    };
  };

  // Generate Quest
  const handleGenerateQuest = async () => {
    if (!customPrompt.trim()) {
      toast.error('Inserisci prima uno spunto o prompt libero per la quest.');
      setActiveTab('prompt');
      return;
    }
    setIsGenerating(true);
    setActiveTab('output');
    try {
      const config = buildConfig();
      const res = await generateGranularQuestAction(config);
      if (res.data) {
        setGeneratedTitle(res.data.titleProposal || questTitleProposal || 'Nuova Quest');
        setGeneratedStory(res.data.sessionOutline || '');
        setGeneratedXp(res.data.xpAward || 300);
        setXpDetails(res.data.xpDetails || null);
        toast.success('Quest generata con successo!');
      } else {
        throw new Error(res.error || 'Errore nella generazione della quest');
      }
    } catch (e: any) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Refine / Modify with AI
  const handleModifyQuest = async () => {
    if (!modificationRequest.trim() || !generatedStory) return;
    setIsModifying(true);
    try {
      const config = buildConfig();
      const res = await generateGranularQuestAction(config, {
        storyToModify: generatedStory,
        request: modificationRequest,
      });
      if (res.data) {
        setGeneratedTitle(res.data.titleProposal || generatedTitle);
        setGeneratedStory(res.data.sessionOutline || generatedStory);
        if (res.data.xpAward) setGeneratedXp(res.data.xpAward);
        if (res.data.xpDetails) setXpDetails(res.data.xpDetails);
        setModificationRequest('');
        toast.success('Bozza della quest aggiornata!');
      } else {
        throw new Error(res.error || 'Errore nella modifica della quest');
      }
    } catch (e: any) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setIsModifying(false);
    }
  };

  // Save Session into Campaign
  const handleSaveAsSession = async () => {
    if (!generatedStory) return;
    setIsSavingSession(true);
    try {
      const highestNum = (campaign.sessions || []).reduce((max, s) => Math.max(max, s.session_number || 0), 0);
      const sessionData: Partial<Session> = {
        campaignId: campaign.id,
        session_number: highestNum + 1,
        title: generatedTitle || `Sessione ${highestNum + 1}`,
        notes: generatedStory,
        xp_award: generatedXp || 300,
        is_read: false,
        is_archived: false,
      };

      const res = await createSession(sessionData);
      if (res.data) {
        toast.success('Quest salvata ufficialmente nelle Cronache della campagna!');
        if (onQuestSaved) onQuestSaved(res.data as Session);
      } else {
        throw new Error(res.error || 'Impossibile salvare la sessione');
      }
    } catch (e: any) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setIsSavingSession(false);
    }
  };

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      {/* Top Header Card - Fully Responsive for Mobile & Desktop */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top bar with Navigation & Quick Actions */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-3">
          {onBackToStories ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToStories}
              className="bg-slate-950 border-slate-700 hover:bg-slate-800 text-slate-300 text-xs h-8 px-2.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Torna a Storie
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowXpManager(true)}
              variant="outline"
              size="sm"
              className="bg-amber-950/30 border-amber-500/40 text-amber-300 hover:bg-amber-900/50 font-semibold text-xs h-8 px-2.5"
            >
              <Trophy className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Gestione PX Party
            </Button>
          </div>
        </div>

        {/* Title and Action Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                Centro Creazione Quest & Storie
              </h1>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] sm:text-xs">
                D&D 5e Story Engine
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Crea storie partendo dal tuo prompt e dalle regole homebrew. Tutte le opzioni granulari (PG, PNG, Oggetti, Luoghi) sono 100% opzionali.
            </p>
          </div>

          <div className="shrink-0 w-full sm:w-auto">
            <Button
              onClick={handleGenerateQuest}
              disabled={isGenerating || !customPrompt.trim()}
              title={!customPrompt.trim() ? 'Inserisci uno spunto/prompt libero per abilitare la generazione' : undefined}
              className={`w-full sm:w-auto font-bold text-xs sm:text-sm h-10 px-5 shadow-lg transition-all ${
                !customPrompt.trim()
                  ? 'bg-slate-800 text-slate-400 border border-slate-700/80 cursor-not-allowed opacity-60 shadow-none hover:bg-slate-800'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-amber-950/50 cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <>
                  <Wand2 className="w-4 h-4 mr-2 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  ✨ Genera Quest Ora
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">
              Template Rapidi per Master (1 tap per caricare):
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                handleApplyPresetTemplate({
                  title: "L'Infiltrazione alla Fortezza di Roccanera",
                  prompt: "Il party deve infiltrarsi silenziosamente durante la festa del plenilunio per recuperare una reliquia prima che venga sacrificata una prigioniera innocente.",
                  tone: 'Investigativo & Mistero',
                  encounterType: 'Furtivo & Infiltrazione',
                  difficulty: 'Difficile',
                  pacing: 'Veloce & Incalzante',
                  plotTwist: 'Colpo di Scena Moderato',
                })
              }
              className="bg-slate-950 border-slate-700 hover:bg-amber-950/40 hover:border-amber-500/40 text-slate-300 text-xs whitespace-nowrap h-7 shrink-0"
            >
              🏰 Infiltrazione Notturna
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                handleApplyPresetTemplate({
                  title: 'Il Risveglio della Cripta Sommersa',
                  prompt: 'Esplorazione di un tempio allagato celato nelle profondità della palude, protetto da enigmi arcanici legati all\'acqua e guardiani non-morti.',
                  tone: 'Cupo & Horror',
                  encounterType: 'Dungeon Crawl & Enigmi',
                  difficulty: 'Medio',
                  pacing: 'Disteso & Esplorativo',
                  plotTwist: 'Rivelazione Sconvolgente',
                })
              }
              className="bg-slate-950 border-slate-700 hover:bg-amber-950/40 hover:border-amber-500/40 text-slate-300 text-xs whitespace-nowrap h-7 shrink-0"
            >
              🌊 Cripta & Enigmi
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                handleApplyPresetTemplate({
                  title: 'La Congiura dei Mercanti di Sangue',
                  prompt: 'Durante il banchetto del Gran Consiglio cittadino, un misterioso veleno colpisce uno dei diplomatici e il party è sospettato se non smaschera il vero colpevole prima dell\'alba.',
                  tone: 'Politico & Intrigo',
                  encounterType: 'Investigativo & Sociale',
                  difficulty: 'Medio',
                  pacing: 'Veloce & Incalzante',
                  plotTwist: 'Rivelazione Sconvolgente',
                })
              }
              className="bg-slate-950 border-slate-700 hover:bg-amber-950/40 hover:border-amber-500/40 text-slate-300 text-xs whitespace-nowrap h-7 shrink-0"
            >
              👑 Intrigo a Corte
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                handleApplyPresetTemplate({
                  title: "L'Ultima Difesa del Valico Innevato",
                  prompt: 'Il party deve difendere un convoglio di profughi attraverso una gola ghiacciata assediata da un branco di giganti o lupi dell\'inverno affamati.',
                  tone: 'Survival & Tattico',
                  encounterType: 'Prevalentemente Combattimento',
                  difficulty: 'Mortale',
                  pacing: 'Veloce & Incalzante',
                  plotTwist: 'Nessun Colpo di Scena',
                })
              }
              className="bg-slate-950 border-slate-700 hover:bg-amber-950/40 hover:border-amber-500/40 text-slate-300 text-xs whitespace-nowrap h-7 shrink-0"
            >
              ❄️ Survival & Battaglia
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar - Responsive Horizontal Scroll */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'prompt'
              ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          1. Prompt & Base
        </button>

        <button
          onClick={() => setActiveTab('context')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'context'
              ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          2. Contesto & Homebrew
        </button>

        <button
          onClick={() => setActiveTab('pcs')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'pcs'
              ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          3. PG ({pcsCount})
        </button>

        <button
          onClick={() => setActiveTab('links')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'links'
              ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          4. Agganci ({linksCount})
        </button>

        <button
          onClick={() => setActiveTab('npcs')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'npcs'
              ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          5. PNG & Ruoli ({npcsCount})
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'items'
              ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          6. Oggetti ({itemsCount})
        </button>

        <button
          onClick={() => setActiveTab('lore_places')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'lore_places'
              ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          7. Luoghi & Magie ({locationsCount + spellsAndSkillsCount})
        </button>

        <button
          onClick={() => setActiveTab('output')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap shrink-0 ml-auto ${
            activeTab === 'output'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
              : generatedStory
              ? 'text-amber-400 font-semibold hover:bg-slate-900'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Bozza {generatedStory ? '✨' : ''}
        </button>
      </div>

      {/* Tab 1: Direttive & Prompt (Base Primaria) */}
      {activeTab === 'prompt' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 space-y-5">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  Spunto / Direttive del Dungeon Master
                </Label>
                <span className="text-[10px] sm:text-xs text-amber-400/80 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded">
                  Base Principale
                </span>
              </div>
              <Textarea
                rows={4}
                placeholder="Descrivi l'incipit dell'avventura, l'obiettivo principale, le sfide che i giocatori dovranno affrontare o il bivio morale su cui si troveranno..."
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                className={`bg-slate-950 border text-slate-100 placeholder:text-slate-600 text-xs sm:text-sm leading-relaxed transition-all ${
                  !customPrompt.trim() ? 'border-amber-500/40 focus:border-amber-400' : 'border-emerald-500/40 focus:border-emerald-400'
                }`}
              />
              <div className="flex items-center justify-between mt-1 text-[11px]">
                {!customPrompt.trim() ? (
                  <span className="text-amber-400/90 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    Inserisci uno spunto libero o clicca su uno dei template rapidi in alto per abilitare il pulsante di generazione.
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    Prompt compilato e pronto per la generazione ({customPrompt.trim().length} caratteri)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Proposta Titolo Avventura (opzionale)
                </Label>
                <Input
                  type="text"
                  placeholder="Es. Il Segreto della Torre d'Ossidiana"
                  value={questTitleProposal}
                  onChange={e => setQuestTitleProposal(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-200 text-xs sm:text-sm h-9"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Minacce / Mostri Specifici Richiesti (opzionale)
                </Label>
                <Input
                  type="text"
                  placeholder="Es. 1 Mind Flayer, 3 Cultisti dell'Ombra, Trappola a veleno"
                  value={specificThreatsOrMonsters}
                  onChange={e => setSpecificThreatsOrMonsters(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-200 text-xs sm:text-sm h-9"
                />
              </div>
            </div>
          </div>

          {/* Quick Parameters Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-slate-800">
            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                Tono Narrativo
              </Label>
              <select
                value={narrativeTone}
                onChange={e => setNarrativeTone(e.target.value as any)}
                className="w-full h-8 sm:h-9 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 focus:outline-none focus:border-amber-500"
              >
                <option value="Epico ed Eroico">Epico ed Eroico</option>
                <option value="Cupo & Horror">Cupo & Horror</option>
                <option value="Investigativo & Mistero">Investigativo & Mistero</option>
                <option value="Survival & Tattico">Survival & Tattico</option>
                <option value="Divertente & Leggero">Divertente & Leggero</option>
                <option value="Politico & Intrigo">Politico & Intrigo</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                Tipologia Prevalente d&apos;Incontro
              </Label>
              <select
                value={primaryEncounterType}
                onChange={e => setPrimaryEncounterType(e.target.value as any)}
                className="w-full h-8 sm:h-9 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 focus:outline-none focus:border-amber-500"
              >
                <option value="Bilanciato (Combattimento + Sociale + Esplorazione)">Bilanciato (Tutti gli aspetti)</option>
                <option value="Prevalentemente Combattimento">Prevalentemente Combattimento</option>
                <option value="Investigativo & Sociale">Investigativo & Sociale</option>
                <option value="Dungeon Crawl & Enigmi">Dungeon Crawl & Enigmi</option>
                <option value="Furtivo & Infiltrazione">Furtivo & Infiltrazione</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                Grado di Sfida / Difficoltà D&D 5e
              </Label>
              <select
                value={targetDifficulty}
                onChange={e => setTargetDifficulty(e.target.value as any)}
                className="w-full h-8 sm:h-9 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 focus:outline-none focus:border-amber-500"
              >
                <option value="Facile">Facile (Incontri leggeri)</option>
                <option value="Medio">Medio (Bilanciato per il party)</option>
                <option value="Difficile">Difficile (Risorse consumate)</option>
                <option value="Mortale">Mortale (Alto rischio letale)</option>
              </select>
            </div>
          </div>

          {/* Quick Overview & Interactive Selector of Optional Independent Modules */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Opzioni Granulari Indipendenti (Tutte 100% Facoltative)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Puoi selezionare indipendentemente 1 singolo PNG, 1 oggetto, 1 luogo o nessun elemento.
                </p>
              </div>

              {(pcsCount > 0 || npcsCount > 0 || itemsCount > 0 || locationsCount > 0 || linksCount > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllOptionalModules}
                  className="text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-7 px-2 self-start sm:self-auto"
                >
                  <X className="w-3 h-3 mr-1" />
                  Deseleziona Tutto
                </Button>
              )}
            </div>
            
            {/* Quick Picker Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQuickPickerCategory(quickPickerCategory === 'pcs' ? 'none' : 'pcs')}
                className={`p-2 rounded-lg border text-left transition-all flex items-center justify-between ${
                  quickPickerCategory === 'pcs'
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                    : pcsCount > 0
                    ? 'bg-slate-900 border-amber-500/40 text-slate-200'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <span className="font-semibold">👥 PG Party</span>
                <Badge variant="outline" className={`text-[10px] ${pcsCount > 0 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-500 border-slate-800'}`}>
                  {pcsCount}/{campaign.playerCharacters?.length || 0}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setQuickPickerCategory(quickPickerCategory === 'npcs' ? 'none' : 'npcs')}
                className={`p-2 rounded-lg border text-left transition-all flex items-center justify-between ${
                  quickPickerCategory === 'npcs'
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                    : npcsCount > 0
                    ? 'bg-slate-900 border-amber-500/40 text-slate-200'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <span className="font-semibold">🎭 PNG</span>
                <Badge variant="outline" className={`text-[10px] ${npcsCount > 0 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-500 border-slate-800'}`}>
                  {npcsCount}/{campaign.npcs?.length || 0}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setQuickPickerCategory(quickPickerCategory === 'items' ? 'none' : 'items')}
                className={`p-2 rounded-lg border text-left transition-all flex items-center justify-between ${
                  quickPickerCategory === 'items'
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                    : itemsCount > 0
                    ? 'bg-slate-900 border-amber-500/40 text-slate-200'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <span className="font-semibold">🗡️ Oggetti</span>
                <Badge variant="outline" className={`text-[10px] ${itemsCount > 0 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-500 border-slate-800'}`}>
                  {itemsCount}/{campaign.magicItems?.length || 0}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setQuickPickerCategory(quickPickerCategory === 'locations' ? 'none' : 'locations')}
                className={`p-2 rounded-lg border text-left transition-all flex items-center justify-between ${
                  quickPickerCategory === 'locations'
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                    : locationsCount > 0
                    ? 'bg-slate-900 border-amber-500/40 text-slate-200'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <span className="font-semibold">🗺️ Luoghi</span>
                <Badge variant="outline" className={`text-[10px] ${locationsCount > 0 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-500 border-slate-800'}`}>
                  {locationsCount}/{campaign.worldLocations?.length || 0}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setQuickPickerCategory(quickPickerCategory === 'links' ? 'none' : 'links')}
                className={`p-2 rounded-lg border text-left transition-all flex items-center justify-between col-span-2 sm:col-span-1 ${
                  quickPickerCategory === 'links'
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                    : linksCount > 0
                    ? 'bg-slate-900 border-amber-500/40 text-slate-200'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <span className="font-semibold">🔗 Agganci</span>
                <Badge variant="outline" className={`text-[10px] ${linksCount > 0 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-500 border-slate-800'}`}>
                  {linksCount}/{campaign.sessions?.length || 0}
                </Badge>
              </button>
            </div>

            {/* Inline Quick Selector Content Drawer */}
            {quickPickerCategory !== 'none' && (
              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    {quickPickerCategory === 'pcs' && '🧙‍♂️ Seleziona Personaggi Giocanti (PG)'}
                    {quickPickerCategory === 'npcs' && '👥 Seleziona PNG Singoli'}
                    {quickPickerCategory === 'items' && '🗡️ Seleziona Oggetti Magici'}
                    {quickPickerCategory === 'locations' && '🗺️ Seleziona Luoghi del Mondo'}
                    {quickPickerCategory === 'links' && '🔗 Seleziona Agganci alle Sessioni'}
                  </span>

                  <div className="flex items-center gap-2">
                    {quickPickerCategory === 'pcs' && (
                      <>
                        <button type="button" onClick={handleSelectAllPcs} className="text-[10px] text-amber-400 hover:underline">Tutti</button>
                        <span className="text-slate-600">•</span>
                        <button type="button" onClick={handleDeselectAllPcs} className="text-[10px] text-slate-400 hover:underline">Nessuno</button>
                      </>
                    )}
                    {quickPickerCategory === 'npcs' && (
                      <>
                        <button type="button" onClick={handleSelectAllNpcs} className="text-[10px] text-amber-400 hover:underline">Tutti</button>
                        <span className="text-slate-600">•</span>
                        <button type="button" onClick={handleDeselectAllNpcs} className="text-[10px] text-slate-400 hover:underline">Nessuno</button>
                      </>
                    )}
                    {quickPickerCategory === 'items' && (
                      <>
                        <button type="button" onClick={handleSelectAllItems} className="text-[10px] text-amber-400 hover:underline">Tutti</button>
                        <span className="text-slate-600">•</span>
                        <button type="button" onClick={handleDeselectAllItems} className="text-[10px] text-slate-400 hover:underline">Nessuno</button>
                      </>
                    )}
                    {quickPickerCategory === 'locations' && (
                      <>
                        <button type="button" onClick={handleSelectAllLocations} className="text-[10px] text-amber-400 hover:underline">Tutti</button>
                        <span className="text-slate-600">•</span>
                        <button type="button" onClick={handleDeselectAllLocations} className="text-[10px] text-slate-400 hover:underline">Nessuno</button>
                      </>
                    )}
                    {quickPickerCategory === 'links' && (
                      <>
                        <button type="button" onClick={handleSelectAllSessionLinks} className="text-[10px] text-amber-400 hover:underline">Tutti</button>
                        <span className="text-slate-600">•</span>
                        <button type="button" onClick={handleDeselectAllSessionLinks} className="text-[10px] text-slate-400 hover:underline">Nessuno</button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickPickerCategory('none')}
                      className="h-5 w-5 p-0 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* List items for Quick Picker */}
                {quickPickerCategory === 'pcs' && (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {(!campaign.playerCharacters || campaign.playerCharacters.length === 0) ? (
                      <span className="text-xs text-slate-500">Nessun PG disponibile</span>
                    ) : (
                      campaign.playerCharacters.map(pc => {
                        const isSel = selectedPcs.some(p => p.pcId === pc.id);
                        return (
                          <button
                            key={pc.id}
                            type="button"
                            onClick={() => handleTogglePc(pc)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                              isSel
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span>{isSel ? '✓' : '+'}</span>
                            <span>{pc.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {quickPickerCategory === 'npcs' && (
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                    {(!campaign.npcs || campaign.npcs.length === 0) ? (
                      <span className="text-xs text-slate-500">Nessun PNG registrato</span>
                    ) : (
                      campaign.npcs.map(npc => {
                        const parsed = typeof npc.details === 'string' ? JSON.parse(npc.details || '{}') : npc.details;
                        const name = parsed?.name || npc.name || 'PNG Senza Nome';
                        const selConfig = selectedNpcs.find(n => n.npcId === npc.id);
                        const isSel = !!selConfig;
                        const assignedRole = selConfig?.role || getDefaultRoleForNpc(npc);
                        const roleInfo = roleBadgeLabels[assignedRole] || roleBadgeLabels.amico;

                        return (
                          <div
                            key={npc.id}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                              isSel
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleNpc(npc)}
                              className="flex items-center gap-1.5 hover:opacity-80"
                            >
                              <span>{isSel ? '✓' : '+'}</span>
                              <span>{name}</span>
                            </button>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 cursor-default ${roleInfo.colorClass}`}
                            >
                              {roleInfo.label}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {quickPickerCategory === 'items' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1.5 gap-1">
                      <span>Filtra origine oggetti:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setItemSourceFilter('all')}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${itemSourceFilter === 'all' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'hover:bg-slate-800 text-slate-400'}`}
                        >
                          Tutti ({campaign.magicItems?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemSourceFilter('base')}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${itemSourceFilter === 'base' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'hover:bg-slate-800 text-slate-400'}`}
                        >
                          🛡️ Base
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemSourceFilter('created')}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${itemSourceFilter === 'created' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'hover:bg-slate-800 text-slate-400'}`}
                        >
                          ✨ Custom
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                      {(filteredMagicItems.length === 0) ? (
                        <span className="text-xs text-slate-500">Nessun oggetto corrispondente ai filtri</span>
                      ) : (
                        filteredMagicItems.map(item => {
                          const isSel = selectedItems.some(i => i.itemId === item.id);
                          const isCreated = item.source === 'created' || !!item.campaignId;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleToggleItem(item)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                isSel
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <span>{isSel ? '✓' : '+'}</span>
                              <span>{item.name}</span>
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${isCreated ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-slate-700 text-slate-400'}`}>
                                {isCreated ? '✨ Custom' : '🛡️ Base'}
                              </Badge>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {quickPickerCategory === 'locations' && (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {(!campaign.worldLocations || campaign.worldLocations.length === 0) ? (
                      <span className="text-xs text-slate-500">Nessun luogo registrato</span>
                    ) : (
                      campaign.worldLocations.map(loc => {
                        const isSel = selectedLocations.some(l => l.locationId === loc.id);
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => handleToggleLocation(loc)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                              isSel
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span>{isSel ? '✓' : '+'}</span>
                            <span>{loc.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {quickPickerCategory === 'links' && (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {(!campaign.sessions || campaign.sessions.length === 0) ? (
                      <span className="text-xs text-slate-500">Nessuna sessione registrata</span>
                    ) : (
                      campaign.sessions.map(sess => {
                        const isSel = previousQuestLinks.some(l => l.sessionId === sess.id);
                        return (
                          <button
                            key={sess.id}
                            type="button"
                            onClick={() => handleToggleSessionLink(sess)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                              isSel
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span>{isSel ? '✓' : '+'}</span>
                            <span>Sess. {sess.session_number}: {sess.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('context')}
              className="bg-slate-950 border-slate-700 text-slate-300 text-xs h-9"
            >
              Configura Contesto & Homebrew <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

            <Button
              type="button"
              onClick={handleGenerateQuest}
              disabled={isGenerating || !customPrompt.trim()}
              title={!customPrompt.trim() ? 'Inserisci uno spunto/prompt libero per abilitare la generazione' : undefined}
              className={`font-bold text-xs h-9 shadow-lg transition-all ${
                !customPrompt.trim()
                  ? 'bg-slate-800 text-slate-400 border border-slate-700/80 cursor-not-allowed opacity-60 shadow-none hover:bg-slate-800'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-amber-950/40 cursor-pointer'
              }`}
            >
              <Wand2 className="w-4 h-4 mr-1.5" />
              Genera Quest Ora
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: Contesto & Homebrew */}
      {activeTab === 'context' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 space-y-4">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              Inclusione Selettiva del Contesto e dei Riassunti (Opzionali)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Decidi se l&apos;IA deve tener conto della visione a lungo termine della campagna, delle ultime sessioni, del dossier di Lore o delle regole Homebrew.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label className="font-semibold text-slate-200 text-xs sm:text-sm">Riassunto Generale Campagna</Label>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Fornisce il quadro d&apos;insieme della trama principale e della premessa della cronaca.
                </p>
              </div>
              <Switch
                checked={includeCampaignSummary}
                onCheckedChange={setIncludeCampaignSummary}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label className="font-semibold text-slate-200 text-xs sm:text-sm">Ultime Sessioni Recenti</Label>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Include la sintesi delle ultime 3 sessioni per continuità narrativa immediata.
                </p>
              </div>
              <Switch
                checked={includeRecentSessionsSummary}
                onCheckedChange={setIncludeRecentSessionsSummary}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label className="font-semibold text-slate-200 text-xs sm:text-sm">Dossier Lore & Enciclopedia Mondo</Label>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Inietta l&apos;almanacco delle città, fazioni e storia del mondo.
                </p>
              </div>
              <Switch
                checked={includeGlobalLore}
                onCheckedChange={setIncludeGlobalLore}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label className="font-semibold text-slate-200 text-xs sm:text-sm">Regole della Casa (Homebrew)</Label>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Impone il rispetto delle regole personalizzate attive nella campagna.
                </p>
              </div>
              <Switch
                checked={includeHomebrewRules}
                onCheckedChange={setIncludeHomebrewRules}
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('prompt')}
              className="bg-slate-950 border-slate-700 text-slate-300 text-xs"
            >
              Indietro
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab('pcs')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              Schede PG ({pcsCount}) <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Schede Personaggi (PG) */}
      {activeTab === 'pcs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                Controllo Granulare Schede PG ({campaign.playerCharacters?.length || 0} nel Party)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Opzionale: seleziona quali personaggi e dettagli (Ideali, Legami, Difetti) guidano la trama.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="outline" className={`text-[10px] ${pcsCount > 0 ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'}`}>
                {pcsCount} di {campaign.playerCharacters?.length || 0} selezionati
              </Badge>
              {campaign.playerCharacters && campaign.playerCharacters.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllPcs}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Tutti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllPcs}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800"
                  >
                    Nessuno
                  </Button>
                </div>
              )}
            </div>
          </div>

          {(!campaign.playerCharacters || campaign.playerCharacters.length === 0) ? (
            <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-xs">
              Nessun personaggio giocante trovato nella campagna. Puoi comunque generare la quest.
            </div>
          ) : (
            <div className="space-y-3">
              {campaign.playerCharacters.map(pc => {
                const config = selectedPcs.find(p => p.pcId === pc.id);
                const isSelected = !!config;

                return (
                  <div
                    key={pc.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={`pc-check-${pc.id}`}
                          checked={isSelected}
                          onChange={() => handleTogglePc(pc)}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                        <label htmlFor={`pc-check-${pc.id}`} className="cursor-pointer">
                          <span className="font-bold text-slate-100 text-xs sm:text-sm">{pc.name}</span>
                          <span className="text-[11px] sm:text-xs text-slate-400 ml-1.5">
                            ({pc.race || 'Razza'} {pc.class || 'Classe'} - Liv. {pc.level || 1})
                          </span>
                        </label>
                      </div>

                      <Badge variant="outline" className={`text-[10px] w-fit ${isSelected ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-slate-700 text-slate-500'}`}>
                        {isSelected ? 'Incluso nella Quest' : 'Escluso'}
                      </Badge>
                    </div>

                    {isSelected && config && (
                      <div className="pt-2.5 space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px]">
                          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                            <input
                              type="checkbox"
                              checked={config.includeIdeals}
                              onChange={e => handleUpdatePcConfig(pc.id, { includeIdeals: e.target.checked })}
                              className="rounded text-amber-500 bg-slate-950"
                            />
                            <span>Ideali</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                            <input
                              type="checkbox"
                              checked={config.includeBonds}
                              onChange={e => handleUpdatePcConfig(pc.id, { includeBonds: e.target.checked })}
                              className="rounded text-amber-500 bg-slate-950"
                            />
                            <span>Legami</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                            <input
                              type="checkbox"
                              checked={config.includeFlaws}
                              onChange={e => handleUpdatePcConfig(pc.id, { includeFlaws: e.target.checked })}
                              className="rounded text-amber-500 bg-slate-950"
                            />
                            <span>Difetti</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                            <input
                              type="checkbox"
                              checked={config.includeStats}
                              onChange={e => handleUpdatePcConfig(pc.id, { includeStats: e.target.checked })}
                              className="rounded text-amber-500 bg-slate-950"
                            />
                            <span>Statistiche</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer bg-slate-900/80 p-1.5 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
                            <input
                              type="checkbox"
                              checked={config.includeSpellsAndSkills}
                              onChange={e => handleUpdatePcConfig(pc.id, { includeSpellsAndSkills: e.target.checked })}
                              className="rounded text-amber-500 bg-slate-950"
                            />
                            <span>Magie & Abilità</span>
                          </label>
                        </div>

                        <div>
                          <Label className="text-[10px] text-slate-400 block mb-1">
                            Focus Narrativo per {pc.name} (opzionale):
                          </Label>
                          <Input
                            type="text"
                            placeholder="Es. Il nemico conosce il suo passato; crea un dilemma morale."
                            value={config.customFocus || ''}
                            onChange={e => handleUpdatePcConfig(pc.id, { customFocus: e.target.value })}
                            className="h-7 bg-slate-900 border-slate-800 text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('context')}
              className="bg-slate-950 border-slate-700 text-slate-300 text-xs"
            >
              Indietro
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab('links')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              Agganci ({linksCount}) <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Tab 4: Agganci a Sessioni Precedenti */}
      {activeTab === 'links' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-400" />
                Agganci a Sessioni e Quest Precedenti (Opzionale)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seleziona indipendentemente se far scaturire conseguenze da sessioni passate.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="outline" className={`text-[10px] ${linksCount > 0 ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'}`}>
                {linksCount} di {campaign.sessions?.length || 0} selezionati
              </Badge>
              {campaign.sessions && campaign.sessions.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllSessionLinks}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Tutti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllSessionLinks}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800"
                  >
                    Nessuno
                  </Button>
                </div>
              )}
            </div>
          </div>

          {(!campaign.sessions || campaign.sessions.length === 0) ? (
            <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-xs">
              Nessuna sessione registrata in precedenza. Questa sarà la prima quest della campagna!
            </div>
          ) : (
            <div className="space-y-2.5">
              {campaign.sessions.map(sess => {
                const link = previousQuestLinks.find(l => l.sessionId === sess.id);
                const isLinked = !!link;

                return (
                  <div
                    key={sess.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isLinked
                        ? 'bg-slate-950 border-amber-500/40'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={`link-${sess.id}`}
                          checked={isLinked}
                          onChange={() => handleToggleSessionLink(sess)}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                        <label htmlFor={`link-${sess.id}`} className="cursor-pointer">
                          <span className="font-bold text-slate-200 text-xs sm:text-sm">
                            Sess. {sess.session_number}: {sess.title}
                          </span>
                        </label>
                      </div>

                      {isLinked && (
                        <div className="flex items-center gap-2">
                          <select
                            value={link.linkType}
                            onChange={e =>
                              setPreviousQuestLinks(prev =>
                                prev.map(l => (l.sessionId === sess.id ? { ...l, linkType: e.target.value as any } : l))
                              )
                            }
                            className="h-7 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2"
                          >
                            <option value="conseguenza_diretta">Conseguenza Diretta</option>
                            <option value="gancio_irrisolto">Gancio Irrisolto</option>
                            <option value="vendetta_o_debito">Vendetta o Debito</option>
                            <option value="ritorno_sul_luogo">Ritorno sul Luogo</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {isLinked && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80">
                        <Input
                          type="text"
                          placeholder="Note specifiche sull'aggancio (es. Il nemico sconfitto ha mandato rinforzi)"
                          value={link.customHookNote || ''}
                          onChange={e =>
                            setPreviousQuestLinks(prev =>
                              prev.map(l => (l.sessionId === sess.id ? { ...l, customHookNote: e.target.value } : l))
                            )
                          }
                          className="h-7 bg-slate-900 border-slate-800 text-xs text-slate-300"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('pcs')}
              className="bg-slate-950 border-slate-700 text-slate-300 text-xs"
            >
              Indietro
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab('npcs')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              PNG & Ruoli ({npcsCount}) <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Tab 5: PNG & Ruoli Narrativi */}
      {activeTab === 'npcs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                PNG e Assegnazione Ruolo nella Quest (Opzionale)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Facoltativo: definisci se un PNG agisce da alleato, nemico, traditore o spalla temporanea.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="outline" className={`text-[10px] ${npcsCount > 0 ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'}`}>
                {npcsCount} di {campaign.npcs?.length || 0} selezionati
              </Badge>
              {campaign.npcs && campaign.npcs.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllNpcs}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Tutti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllNpcs}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800"
                  >
                    Nessuno
                  </Button>
                </div>
              )}
            </div>
          </div>

          {(!campaign.npcs || campaign.npcs.length === 0) ? (
            <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-xs">
              Nessun PNG registrato nella campagna. Puoi crearne dalla sezione PNG o lasciare che l&apos;IA li crei al volo.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campaign.npcs.map(npc => {
                const parsed = typeof npc.details === 'string' ? JSON.parse(npc.details || '{}') : npc.details;
                const name = parsed?.name || 'PNG Senza Nome';
                const role = parsed?.role || parsed?.occupation || 'Abitante';
                const selected = selectedNpcs.find(n => n.npcId === npc.id);
                const isSelected = !!selected;

                return (
                  <div
                    key={npc.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={`npc-${npc.id}`}
                          checked={isSelected}
                          onChange={() => handleToggleNpc(npc)}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                        <label htmlFor={`npc-${npc.id}`} className="cursor-pointer">
                          <span className="font-bold text-slate-200 text-xs sm:text-sm">{name}</span>
                          <span className="text-[11px] text-slate-400 block">{role}</span>
                        </label>
                      </div>

                      {isSelected && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                          Attivo
                        </Badge>
                      )}
                    </div>

                    {isSelected && selected && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div>
                          <Label className="text-[10px] text-slate-400 block mb-1">
                            Ruolo nella Quest:
                          </Label>
                          <select
                            value={selected.role}
                            onChange={e => handleUpdateNpcRole(npc.id, e.target.value as any)}
                            className="w-full h-7 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 font-medium"
                          >
                            <option value="amico">🟢 Amico / Alleato sincero</option>
                            <option value="nemico">🔴 Antagonista / Nemico</option>
                            <option value="doppiogiochista">🟣 Doppiogiochista (Traditore)</option>
                            <option value="da_amico_a_nemico">🟠 Da Amico a Nemico (Voltafaccia)</option>
                            <option value="da_nemico_a_amico">🔵 Da Nemico ad Amico (Redenzione)</option>
                            <option value="compagno_party">🟡 Compagno di Party / Spalla</option>
                          </select>
                        </div>

                        <div>
                          <Label className="text-[10px] text-slate-400 block mb-1">
                            Note o Obiettivo Segreto (opzionale):
                          </Label>
                          <Input
                            type="text"
                            placeholder="Es. Cerca una reliquia ma finge cooperazione."
                            value={selected.customGoal || ''}
                            onChange={e => handleUpdateNpcRole(npc.id, selected.role, e.target.value)}
                            className="h-7 bg-slate-900 border-slate-800 text-xs text-slate-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('links')}
              className="bg-slate-950 border-slate-700 text-slate-300 text-xs"
            >
              Indietro
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab('items')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              Oggetti & Armi ({itemsCount}) <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Tab 6: Oggetti & Armi */}
      {activeTab === 'items' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                Oggetti, Armi & Reliquie (Opzionale)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Specifica se un oggetto magico deve essere trovato, rubato o usato come chiave per risolvere la quest.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="outline" className={`text-[10px] ${itemsCount > 0 ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'}`}>
                {itemsCount} di {campaign.magicItems?.length || 0} selezionati
              </Badge>
              {campaign.magicItems && campaign.magicItems.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllItems}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Tutti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllItems}
                    className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800"
                  >
                    Nessuno
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Source Filter Bar for Items */}
          {campaign.magicItems && campaign.magicItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Filtro Origine Oggetti:</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant={itemSourceFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setItemSourceFilter('all')}
                  className={`h-7 px-2.5 text-xs ${itemSourceFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                >
                  Tutti ({campaign.magicItems.length})
                </Button>
                <Button
                  type="button"
                  variant={itemSourceFilter === 'base' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setItemSourceFilter('base')}
                  className={`h-7 px-2.5 text-xs ${itemSourceFilter === 'base' ? 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                >
                  🛡️ Solo Base (SRD)
                </Button>
                <Button
                  type="button"
                  variant={itemSourceFilter === 'created' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setItemSourceFilter('created')}
                  className={`h-7 px-2.5 text-xs ${itemSourceFilter === 'created' ? 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                >
                  ✨ Solo Creati (Custom)
                </Button>
              </div>
            </div>
          )}

          {(filteredMagicItems.length === 0) ? (
            <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-xs">
              Nessun oggetto magico corrisponde ai filtri selezionati.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredMagicItems.map(item => {
                const selected = selectedItems.find(i => i.itemId === item.id);
                const isSelected = !!selected;
                const isCreated = item.source === 'created' || !!item.campaignId;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={`item-${item.id}`}
                          checked={isSelected}
                          onChange={() => handleToggleItem(item)}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                        <label htmlFor={`item-${item.id}`} className="cursor-pointer">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-200 text-xs sm:text-sm">{item.name}</span>
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${isCreated ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-slate-700 text-slate-400'}`}>
                              {isCreated ? '✨ Custom' : '🛡️ Base'}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-slate-400 block">{item.type || 'Oggetto Magico'} - {item.rarity || 'Comune'}</span>
                        </label>
                      </div>
                    </div>

                    {isSelected && selected && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div>
                          <Label className="text-[10px] text-slate-400 block mb-1">
                            Ruolo dell&apos;Oggetto:
                          </Label>
                          <select
                            value={selected.role}
                            onChange={e => handleUpdateItemRole(item.id, e.target.value as any)}
                            className="w-full h-7 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 font-medium"
                          >
                            <option value="necessario">🔑 Necessario per proseguire / Chiave</option>
                            <option value="trovato">🎁 Ricompensa / Trovato nella quest</option>
                            <option value="rubato">🗡️ Rubato / Da recuperare</option>
                            <option value="in_possesso">🛡️ In possesso del party</option>
                          </select>
                        </div>

                        <div>
                          <Label className="text-[10px] text-slate-400 block mb-1">
                            Note aggiuntive (opzionale):
                          </Label>
                          <Input
                            type="text"
                            placeholder="Es. L'amuleto reagisce alla presenza del portale."
                            value={selected.notes || ''}
                            onChange={e => handleUpdateItemRole(item.id, selected.role || 'trovato', e.target.value)}
                            className="h-7 bg-slate-900 border-slate-800 text-xs text-slate-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('npcs')}
              className="bg-slate-950 border-slate-700 text-slate-300 text-xs"
            >
              Indietro
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab('lore_places')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              Luoghi & Magie ({locationsCount}) <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Tab 7: Luoghi, Magie & Abilità */}
      {activeTab === 'lore_places' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  Luoghi & Ambientazioni Specifiche (Opzionale)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seleziona indipendentemente i luoghi registrati che faranno da sfondo all&apos;avventura.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge variant="outline" className={`text-[10px] ${locationsCount > 0 ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'}`}>
                  {locationsCount} di {campaign.worldLocations?.length || 0} selezionati
                </Badge>
                {campaign.worldLocations && campaign.worldLocations.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllLocations}
                      className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Tutti
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAllLocations}
                      className="h-7 px-2 text-[11px] bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800"
                    >
                      Nessuno
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {(!campaign.worldLocations || campaign.worldLocations.length === 0) ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-xs">
                Nessun luogo salvato nella mappa del mondo.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {campaign.worldLocations.map(loc => {
                  const selected = selectedLocations.find(l => l.locationId === loc.id);
                  const isSelected = !!selected;

                  return (
                    <div
                      key={loc.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-slate-950 border-amber-500/40'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            id={`loc-${loc.id}`}
                            checked={isSelected}
                            onChange={() => handleToggleLocation(loc)}
                            className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                          />
                          <label htmlFor={`loc-${loc.id}`} className="cursor-pointer">
                            <span className="font-bold text-slate-200 text-xs sm:text-sm">{loc.name}</span>
                            <span className="text-[11px] text-slate-400 block">{loc.scale || loc.style || 'Luogo'}</span>
                          </label>
                        </div>

                        {isSelected && (
                          <select
                            value={selected.role}
                            onChange={e =>
                              setSelectedLocations(prev =>
                                prev.map(l => (l.locationId === loc.id ? { ...l, role: e.target.value as any } : l))
                              )
                            }
                            className="h-7 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2"
                          >
                            <option value="punto_partenza">Partenza</option>
                            <option value="destinazione">Destinazione</option>
                            <option value="luogo_segreto">Luogo Segreto</option>
                            <option value="zona_pericolo">Pericolo</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('items')}
              className="bg-slate-950 border-slate-700 text-slate-300 text-xs"
            >
              Indietro
            </Button>
            <Button
              type="button"
              onClick={handleGenerateQuest}
              disabled={isGenerating || !customPrompt.trim()}
              title={!customPrompt.trim() ? 'Inserisci uno spunto/prompt libero per abilitare la generazione' : undefined}
              className={`font-bold text-xs transition-all ${
                !customPrompt.trim()
                  ? 'bg-slate-800 text-slate-400 border border-slate-700/80 cursor-not-allowed opacity-60 hover:bg-slate-800'
                  : 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/40 cursor-pointer'
              }`}
            >
              <Wand2 className="w-4 h-4 mr-1.5" />
              Genera Ora la Quest
            </Button>
          </div>
        </div>
      )}

      {/* Tab 8: Output & Revisione Bozza (Rifiniture Post-Creazione) */}
      {activeTab === 'output' && (
        <div className="space-y-4 sm:space-y-6">
          {isGenerating ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 animate-pulse">
                <Wand2 className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100">Generazione della Quest in corso...</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  L&apos;IA sta componendo la storia integrando il tuo prompt, le regole homebrew e calcolando i PX D&D 5e.
                </p>
              </div>
            </div>
          ) : !generatedStory ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <Scroll className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Nessuna bozza generata al momento. Inserisci uno spunto e clicca su &quot;Genera Quest Ora&quot;.
              </p>
              <Button
                onClick={() => setActiveTab('prompt')}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Vai alle Direttive
              </Button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 md:p-6 shadow-xl space-y-4 sm:space-y-6">
              {/* Header with Title & Action Toolbar */}
              <div className="flex flex-col gap-3 border-b border-slate-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] mb-1.5">
                      Bozza Quest Pronta
                    </Badge>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                      {generatedTitle}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-right">
                      <span className="text-[9px] sm:text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">PX D&D 5e</span>
                      <span className="text-base sm:text-lg font-bold text-amber-400">{generatedXp.toLocaleString()} PX</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={() => setShowXpManager(true)}
                    variant="outline"
                    size="sm"
                    className="bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 font-semibold text-xs h-9"
                  >
                    <Trophy className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                    Assegna PX ai PG
                  </Button>

                  <Button
                    onClick={() => setIsManualEditing(!isManualEditing)}
                    variant="outline"
                    size="sm"
                    className="bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-9"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                    {isManualEditing ? 'Visualizza Formattato' : 'Modifica Testo a Mano'}
                  </Button>

                  <Button
                    onClick={handleSaveAsSession}
                    disabled={isSavingSession}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 shadow-lg shadow-emerald-900/30 ml-auto"
                  >
                    {isSavingSession ? (
                      'Salvataggio...'
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Salva come Nuova Sessione
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* XP Breakdown Grid */}
              {xpDetails && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[9px]">Combattimento</span>
                    <span className="font-bold text-rose-400 text-xs sm:text-sm">+{xpDetails.combatXp || 0} PX</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[9px]">Traguardi Quest</span>
                    <span className="font-bold text-amber-400 text-xs sm:text-sm">+{xpDetails.questMilestoneXp || 0} PX</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[9px]">Esplorazione & Segreti</span>
                    <span className="font-bold text-cyan-400 text-xs sm:text-sm">+{xpDetails.explorationXp || 0} PX</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[9px]">Roleplay & Scelte</span>
                    <span className="font-bold text-emerald-400 text-xs sm:text-sm">+{xpDetails.roleplayDilemmaXp || 0} PX</span>
                  </div>
                </div>
              )}

              {/* Story Narrative Output or Manual Editor */}
              {isManualEditing ? (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-slate-300">
                    Modifica Manuale del Testo della Quest:
                  </Label>
                  <Textarea
                    rows={14}
                    value={generatedStory}
                    onChange={e => setGeneratedStory(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-100 text-xs sm:text-sm leading-relaxed font-mono"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsManualEditing(false);
                        toast.success('Modifiche manuali applicate!');
                      }}
                      className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Fatto
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-6 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs sm:text-sm leading-relaxed overflow-x-auto">
                  <MarkdownRenderer content={generatedStory} />
                </div>
              )}

              {/* Post-Creation AI Refinement Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  Raffina o Modifica con IA (Istruzioni di Revisione)
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="text"
                    placeholder="Es. Rendi l'inseguimento più teso, oppure aggiungi un dialogo con il PNG..."
                    value={modificationRequest}
                    onChange={e => setModificationRequest(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-xs text-slate-200 h-9"
                  />
                  <Button
                    onClick={handleModifyQuest}
                    disabled={isModifying || !modificationRequest.trim()}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs shrink-0 h-9 px-4"
                  >
                    {isModifying ? (
                      'Revisione in corso...'
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Applica Modifiche
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Modal Party XP Manager */}
      {showXpManager && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            <PartyXpManager
              campaignId={campaign.id}
              playerCharacters={campaign.playerCharacters || []}
              initialBaseXp={generatedXp || 300}
              initialReason={generatedTitle ? `Quest: ${generatedTitle}` : 'Completamento Quest'}
              onPcsUpdated={pcs => {
                if (onPcsUpdated) onPcsUpdated(pcs);
              }}
              onClose={() => setShowXpManager(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
