// shared.js — não é um módulo ES, é incluído via <script> nas páginas de extensão
// (popup/options) e duplicado manualmente em content.js/background.js,
// já que content scripts do Manifest V3 não importam módulos com facilidade.
// Mantenha os três em sincronia se mudar o formato do config.

const STORAGE_KEY = "bwa_config";
const LOG_KEY = "bwa_log";

const DEFAULT_CONFIG = {
  masterEnabled: false,
  autoDisable: {
    enabled: false,
    durationMinutes: 60,
    disableAt: null // timestamp (ms) de quando vai desligar sozinho, ou null
  },
  pdl: {
    // Batalhas (Bots / Jogadores)
    enabled: false,
    maxSlots: 10,
    rechargeSeconds: 351, // 5:51 — ajuste conforme sua conta
    mode: "continuous", // "continuous" | "scheduled"
    scheduleStart: "00:00",
    scheduleEnd: "06:00",
    // Lista de filtros testados em ordem — quando um não acha alvo, cai
    // pro próximo (ex: Bots primeiro, depois Nível 5, depois Nível 4...).
    // field: "EnemyType" (valor = "Bots" ou "Characters") | "Level" (valor = número)
    filters: [{ field: "EnemyType", value: "Bots" }],
    activeFilterIndex: 0 // qual filtro da lista está em uso agora
  },
  pdb: {
    // Criaturas (Mapa Mundo)
    enabled: false,
    maxSlots: 10,
    rechargeSeconds: 1065, // 17:45 — ajuste conforme sua conta
    mode: "continuous",
    scheduleStart: "00:00",
    scheduleEnd: "06:00",
    targetRegion: "Floresta do Amanhecer",
    targetCreature: "Rato Selvagem"
  },
  safety: {
    // Saúde e Segurança — cura automática via poção quando a vida cai
    enabled: false, // permite compra automática de poção
    minGoldReserve: 0, // gold mínimo a deixar no cofre
    potionTier: "300", // chave em POTION_TIERS
    keepInStock: 1, // quantas poções manter em estoque (usado quando o
    // fluxo de "usar poção do inventário" estiver implementado)
    hpThresholdPercent: 50 // cura quando a vida cair abaixo disso (%)
  },
  work: {
    // Trabalho — bloqueia batalhas/criaturas enquanto ativo, então roda em
    // loop sempre que ligado, sem checar slots de ataque.
    enabled: false,
    durationHours: 1, // chave em WORK_DURATIONS
    wasWorking: false, // rastreia se já estava trabalhando (detecta quando termina)
    schedule: {
      enabled: false,
      repeat: "daily", // "daily" | "weekly"
      daysOfWeek: [1, 2, 3, 4, 5], // 0=Dom..6=Sáb — só usado quando repeat="weekly"
      times: ["22:00"], // um horário por execução do dia
      triggeredToday: { date: null, times: [] } // controla o que já disparou hoje
    }
  },
  training: {
    // Treinamento — gasta gold disponível subindo atributos, na ordem da
    // lista (prioridade), pulando os que não têm gold suficiente.
    enabled: false,
    minGoldReserve: 0, // gold mínimo a deixar no cofre
    stats: [
      { name: "Força", enabled: true },
      { name: "Defesa", enabled: true },
      { name: "Agilidade", enabled: true },
      { name: "Inteligência", enabled: true },
      { name: "Astúcia", enabled: true },
      { name: "Fúria", enabled: true },
      { name: "Resistência", enabled: true }
    ]
  }
};

// Opções de duração do Trabalho — confirmadas no jogo (1h a 12h, cada uma
// com um "cargo" diferente).
const WORK_DURATIONS = {
  1: "Mensageiro da Vila",
  2: "Colher ervas mágicas na floresta",
  3: "Cortar lenha para o acampamento",
  4: "Descarregar mercadorias",
  5: "Auxiliar o alquimista com poções",
  6: "Arquivista da Grande Biblioteca",
  7: "Mineração nas Cavernas",
  8: "Esculpir uma estátua na cidade",
  9: "Aprendiz de Carpinteiro",
  10: "Forja com o Anão",
  11: "Escolta de Caravana",
  12: "Patrulha Noturna do Castelo"
};

// Campos de filtro de Batalhas suportados e seus rótulos exibidos no jogo.
const PDL_FIELD_LABELS = { EnemyType: "Tipo de Oponente", Level: "Nível" };

// Opções válidas do filtro "Tipo de Oponente" — confirmadas no jogo.
const ENEMY_TYPE_OPTIONS = [
  { value: "Bots", label: "Bots" },
  { value: "Characters", label: "Guerreiros" }
];

// Poções de vida disponíveis na Loja de Poções (confirmadas no jogo).
const POTION_TIERS = {
  "300": { cost: 300, hp: 100 },
  "1000": { cost: 1000, hp: 300 },
  "2000": { cost: 2000, hp: 500 },
  "5000": { cost: 5000, hp: 1000 },
  "20000": { cost: 20000, hp: 3000 }
};

// Nome exibido no card do Inventário pra cada tier — confirmados no jogo.
const POTION_INVENTORY_NAMES = {
  100: "Poção de Vida Pequena",
  300: "Poção de Vida Média",
  500: "Poção de Vida Grande",
  1000: "Poção de Vida Suprema",
  3000: "Poção de Vida Divina"
};

async function bwaGetConfig() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const stored = data[STORAGE_KEY];
  if (!stored) return structuredClone(DEFAULT_CONFIG);
  // merge raso por seção — garante que configs salvas antes de uma seção
  // nova existir (ex: safety) não quebrem o acesso a ela.
  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...stored,
    autoDisable: { ...DEFAULT_CONFIG.autoDisable, ...stored.autoDisable },
    pdl: { ...DEFAULT_CONFIG.pdl, ...stored.pdl },
    pdb: { ...DEFAULT_CONFIG.pdb, ...stored.pdb },
    safety: { ...DEFAULT_CONFIG.safety, ...stored.safety },
    work: {
      ...DEFAULT_CONFIG.work,
      ...stored.work,
      schedule: {
        ...DEFAULT_CONFIG.work.schedule,
        ...(stored.work && stored.work.schedule)
      }
    },
    training: { ...DEFAULT_CONFIG.training, ...stored.training }
  };
}

async function bwaSetConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

async function bwaAppendLog(entry) {
  const data = await chrome.storage.local.get(LOG_KEY);
  const log = data[LOG_KEY] || [];
  log.unshift({ ...entry, time: Date.now() });
  await chrome.storage.local.set({ [LOG_KEY]: log });
}

async function bwaGetLog() {
  const data = await chrome.storage.local.get(LOG_KEY);
  return data[LOG_KEY] || [];
}

async function bwaClearLog() {
  await chrome.storage.local.set({ [LOG_KEY]: [] });
}

// Gold pendente de uma luta — salvo antes do reload da página, resolvido no
// próximo tick quando a UI já voltou ao normal e o gold é legível.
const PENDING_GOLD_KEY = "bwa_pending_gold";

async function bwaSetPendingGold(data) {
  await chrome.storage.local.set({ [PENDING_GOLD_KEY]: data });
}

async function bwaGetPendingGold() {
  const d = await chrome.storage.local.get(PENDING_GOLD_KEY);
  return d[PENDING_GOLD_KEY] || null;
}

async function bwaClearPendingGold() {
  await chrome.storage.local.remove(PENDING_GOLD_KEY);
}

// Aplica goldDelta no registro de batalha mais recente que ainda não tem esse
// campo (goldDelta == null), sem sobrescrever os demais campos do registro.
async function bwaPatchLastBattleLog(goldDelta) {
  if (goldDelta === null || goldDelta === undefined) return;
  const data = await chrome.storage.local.get(LOG_KEY);
  const log = data[LOG_KEY] || [];
  const idx = log.findIndex(
    (e) => (e.type === "pdl" || e.type === "pdb") && e.goldDelta == null
  );
  if (idx === -1) return;
  log[idx] = { ...log[idx], goldDelta };
  await chrome.storage.local.set({ [LOG_KEY]: log });
}

// Nomes de inimigos/jogadores vêm do jogo (texto controlado por outros
// usuários) e acabam inseridos via innerHTML nas listas de histórico —
// escapa antes de interpolar pra não abrir brecha de HTML/script injetado.
function bwaEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Estado ao vivo dos slots, escrito pelo content.js a cada ciclo,
// pra que o popup consiga mostrar sem precisar acessar a aba do jogo.
const SLOTS_KEY = "bwa_slots";

async function bwaSetSlots(slots) {
  await chrome.storage.local.set({ [SLOTS_KEY]: slots });
}

async function bwaGetSlots() {
  const data = await chrome.storage.local.get(SLOTS_KEY);
  return data[SLOTS_KEY] || { pdl: null, pdb: null };
}

// Visão geral do personagem (nome, nível, HP, XP, slots de batalha),
// escrita pelo content.js a cada ciclo, pra o popup mostrar sem acessar a
// aba do jogo. Formato: { name, level, hp: {current,max}, xp: {current,max}, pdlSlots }
const OVERVIEW_KEY = "bwa_overview";

async function bwaSetOverview(overview) {
  await chrome.storage.local.set({ [OVERVIEW_KEY]: overview });
}

async function bwaGetOverview() {
  const data = await chrome.storage.local.get(OVERVIEW_KEY);
  return data[OVERVIEW_KEY] || null;
}
