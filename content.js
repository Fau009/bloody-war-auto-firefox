// content.js — roda injetado em https://www.thebloodywar.com/*
// Depende de shared.js (carregado antes, via manifest.json) para
// STORAGE_KEY, DEFAULT_CONFIG, bwaGetConfig, bwaAppendLog.

const TICK_INTERVAL_MS = 15000; // checa a cada 15s
const CLICK_DELAY_MS = 700; // pausa entre passos de um fluxo (deixa a UI reagir)

function log(...args) {
  console.log("[BloodyWarAuto]", ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Fecha overlays React Aria do tipo Dialog (diferente de Popover, eles não
// fecham com um novo clique no próprio trigger — só com Escape ou clique
// de verdade fora da área).
function pressEscape() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true })
  );
}

// Define o valor de um input controlado por React (setar .value direto não
// dispara o listener onChange do React — precisa passar pelo setter nativo).
function setNativeValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickButtonWithExactText(text) {
  const buttons = document.querySelectorAll("button");
  for (const b of buttons) {
    if (b.textContent.trim() === text) {
      b.click();
      return true;
    }
  }
  return false;
}

// ---------- Leitura dos slots de energia (PDB/PDL) ----------
// Cada bloco tem: <img alt="icon" src=".../battles-icon-...png"> ou hunt-icon
// seguido de um <p>9/10</p> e, se não estiver cheio, um <p class="text-yellow-500">5:00</p>

function readSlotBlock(iconFilenamePart) {
  const blocks = document.querySelectorAll("div.bg-black.border.border-gray-800");
  for (const block of blocks) {
    const img = block.querySelector('img[alt="icon"]');
    if (img && img.src.includes(iconFilenamePart)) {
      const countP = block.querySelector("div.flex.items-center.gap-1 p");
      const countdownP = block.querySelector("p.text-yellow-500");
      if (!countP) continue;
      const [current, max] = countP.textContent.trim().split("/").map(Number);
      return {
        current,
        max,
        countdown: countdownP ? countdownP.textContent.trim() : null
      };
    }
  }
  return null;
}

function getPDLSlots() {
  return readSlotBlock("battles-icon");
}

function getPDBSlots() {
  return readSlotBlock("hunt-icon");
}

// Espera o quadrinho de slot aparecer/atualizar de verdade (tenta a cada
// 150ms, até 3s) em vez de decidir com uma leitura única que pode pegar a
// tela no meio do carregamento. Só decide (atacar ou abortar) depois de
// confirmar o número.
async function waitForSlotBlock(iconFilenamePart, timeoutMs = 3000) {
  const start = Date.now();
  let slot = readSlotBlock(iconFilenamePart);
  while (!slot && Date.now() - start < timeoutMs) {
    await sleep(150);
    slot = readSlotBlock(iconFilenamePart);
  }
  return slot;
}

// ---------- Navegação entre seções ----------
// Duas variações de layout observadas:
// 1) Sidebar sempre visível (k-left-layout) com <button aria-label="BATALHAS">
// 2) Menu escondido atrás de um botão "Menu" (k-top-layout, páginas de mapa)
//    TODO: não capturamos o HTML do menu (2) aberto — se o passo 2 abaixo
//    não funcionar, precisamos inspecionar o dropdown aberto e ajustar aqui.

// URL de cada seção — a checagem mais confiável de "estou no lugar certo",
// já que várias páginas (ex: Batalhas e Mensageiro) têm estrutura de DOM
// quase idêntica (busca + dropdown + Filtrar) e um seletor genérico pode
// acabar mexendo na página errada.
const PAGE_PATHS = {
  BATALHAS: "/battle",
  "MAPA MUNDO": "/world-map",
  "LOJA DE POÇÕES": "/potions/store",
  INVENTÁRIO: "/characters/inventory",
  MENSAGEIRO: "/messenger",
  TRABALHO: "/work",
  TREINAMENTO: "/training"
};

// Usado como checagem DEFENSIVA (abortar se claramente na página errada) —
// sem path mapeado, não bloqueia (assume que pode estar certo).
function isOnPage(ariaLabel) {
  const path = PAGE_PATHS[ariaLabel];
  if (!path) return true;
  return window.location.pathname === path;
}

// Usado só pra decidir se PULA a navegação (já está lá, não precisa
// clicar em nada) — aqui o padrão tem que ser o oposto: sem confirmação
// de que já está na página certa, NÃO pula (tenta navegar de verdade).
function isConfirmedOnPage(ariaLabel) {
  const path = PAGE_PATHS[ariaLabel];
  return !!path && window.location.pathname === path;
}

async function waitForPage(ariaLabel, timeoutMs = 3000) {
  const start = Date.now();
  while (!isOnPage(ariaLabel) && Date.now() - start < timeoutMs) {
    await sleep(150);
  }
  return isOnPage(ariaLabel);
}

// Telas de resultado de batalha (PvP ou Criatura) escondem a sidebar até
// clicar em "Voltar" — sem isso, qualquer navegação seguinte falha.
async function returnFromResultScreenIfNeeded() {
  const backBtn = document.querySelector("button.back-button");
  if (backBtn) {
    backBtn.click();
    await sleep(CLICK_DELAY_MS);
    return true;
  }
  return false;
}

// A página de uma região (Mapa Mundo → dentro da região atacando
// criaturas) não tem a sidebar/menu disponível — só o "Voltar" próprio da
// região, que leva de volta pro Mapa Mundo.
async function leaveRegionIfNeeded() {
  const backBtn = document.querySelector("section.world-map-battle header button");
  if (backBtn) {
    backBtn.click();
    await sleep(CLICK_DELAY_MS);
    return true;
  }
  return false;
}

async function navigateToSection(ariaLabel) {
  if (isConfirmedOnPage(ariaLabel)) return true; // já está na página certa (confirmado pela URL)

  await returnFromResultScreenIfNeeded();

  const leftRegion = await leaveRegionIfNeeded();
  if (leftRegion && ariaLabel === "MAPA MUNDO") {
    return waitForPage(ariaLabel);
  }

  let btn = document.querySelector(`button[aria-label="${ariaLabel}"]`);
  if (btn) {
    btn.click();
    await sleep(CLICK_DELAY_MS);
    if (await waitForPage(ariaLabel)) return true;
  }
  // tenta abrir o menu escondido (layout de mapa)
  const menuTrigger = document.querySelector(".k-navigation-menu-trigger");
  if (menuTrigger) {
    menuTrigger.click();
    await sleep(CLICK_DELAY_MS);
    btn = document.querySelector(`button[aria-label="${ariaLabel}"]`);
    if (btn) {
      btn.click();
      await sleep(CLICK_DELAY_MS);
      if (await waitForPage(ariaLabel)) return true;
    }
  }
  log(`Não consegui navegar até "${ariaLabel}" (URL esperada: ${PAGE_PATHS[ariaLabel] || "?"}, atual: ${window.location.pathname}).`);
  return false;
}

// ---------- Fluxo de Batalhas (PDL) ----------

// O controle de "valor" às vezes é um select (Tipo de Oponente) e às vezes
// um texto puro (Nível) — quando é texto, só existe UM botão de trigger na
// tela (o de campo), não dois. Por isso identificamos o de campo pelo
// aria-label (sempre diferente de "Encontre os inimigos"), nunca por
// posição/índice.
function getFieldTrigger() {
  const triggers = document.querySelectorAll('.k-select button[data-slot="trigger"]');
  return (
    Array.from(triggers).find((t) => t.getAttribute("aria-label") !== "Encontre os inimigos") || null
  );
}

// Botão "Filtros" (classe k-page-list-filter-toggle, confirmada no jogo)
// que recolhe/expande o formulário de campo+valor — o painel às vezes
// começa recolhido e só esse botão revela os dropdowns de novo.
function findFilterToggleButton() {
  const byClass = document.querySelector(".k-page-list-filter-toggle");
  if (byClass) return byClass;
  // fallback pelo desenho do ícone, caso a classe mude num futuro deploy
  const paths = document.querySelectorAll("svg path");
  for (const path of paths) {
    if (path.getAttribute("d") === "M32 144h448M112 256h288M208 368h96") {
      return path.closest("button");
    }
  }
  return null;
}

// A tela às vezes ainda não terminou de renderizar o select logo após
// navegar até "BATALHAS" (ou o formulário está recolhido) — espera e tenta
// revelar em vez de assumir que já está lá.
async function waitForFieldTrigger(timeoutMs = 3000) {
  const start = Date.now();
  let trigger = getFieldTrigger();
  let toggled = false;
  while (!trigger && Date.now() - start < timeoutMs) {
    if (!toggled) {
      const toggleBtn = findFilterToggleButton();
      if (toggleBtn) {
        toggleBtn.click();
        toggled = true;
        await sleep(CLICK_DELAY_MS);
      }
    }
    await sleep(150);
    trigger = getFieldTrigger();
  }
  return trigger;
}

// O jogo empilha os chips de filtro em vez de substituir — sem limpar, um
// filtro novo (ex: Nível) fica cruzando com o anterior (ex: Tipo de
// Oponente), e a busca quase sempre não acha nada. Clica em cada chip
// ativo pra remover antes de aplicar o próximo da cascata.
function clearActiveFilterChips() {
  const container = document.querySelector(".flex.gap-2.flex-wrap.mt-1");
  if (!container) return false;
  const chips = container.querySelectorAll("span.cursor-pointer");
  chips.forEach((chip) => chip.click());
  return chips.length > 0;
}

function getValueLabel(field, rawValue) {
  if (field === "EnemyType") {
    const opt = ENEMY_TYPE_OPTIONS.find((o) => o.value === rawValue);
    return opt ? opt.label : rawValue;
  }
  return rawValue;
}

// O chip do filtro ativo (ex: "Tipo de Oponente : Bots ✕") continua visível
// mesmo quando o formulário de campo/valor está recolhido/escondido — é um
// jeito mais confiável de saber se já está filtrado certo, sem depender de
// achar os dropdowns (que às vezes somem da tela).
function isFilterChipActive(fieldLabel, valueLabel) {
  const container = document.querySelector(".flex.gap-2.flex-wrap.mt-1");
  if (!container) return false;
  const chipText = container.textContent.replace(/\s+/g, " ").trim();
  return chipText.includes(fieldLabel) && chipText.includes(valueLabel);
}

// Lê o que já está selecionado agora, pra comparar com o que queremos
// aplicar e evitar cliques desnecessários (ou detectar que precisa trocar
// de campo/valor).
function getCurrentFilterState(fieldTrigger) {
  const fieldLabel = fieldTrigger
    ? fieldTrigger.querySelector('span[data-slot="value"]')?.textContent.trim() || null
    : null;

  const input = document.querySelector('input[aria-label="Encontre os inimigos"]');
  let valueLabel = null;
  if (input) {
    valueLabel = input.value.trim();
  } else {
    const valueTrigger = document.querySelector(
      'button[data-slot="trigger"][aria-label="Encontre os inimigos"]'
    );
    valueLabel = valueTrigger
      ? valueTrigger.querySelector('span[data-slot="value"]')?.textContent.trim() || null
      : null;
  }
  return { fieldLabel, valueLabel };
}

async function applyBattleFilter(field, value) {
  if (!isOnPage("BATALHAS")) {
    log(`Não está na página de Batalhas (atual: ${window.location.pathname}) — abortando filtro.`);
    return false;
  }

  const desiredFieldLabel = PDL_FIELD_LABELS[field] || field;
  const desiredValueLabel = getValueLabel(field, value);

  // já está filtrado certo (confirmado pelo chip) — nem precisa procurar
  // os dropdowns, que às vezes ficam recolhidos/escondidos na tela.
  if (isFilterChipActive(desiredFieldLabel, desiredValueLabel)) {
    return true;
  }

  // vai trocar de filtro — limpa qualquer chip antigo primeiro, senão o
  // próximo filtro cruza com o anterior em vez de substituir.
  if (clearActiveFilterChips()) {
    await sleep(CLICK_DELAY_MS);
  }

  const fieldTrigger = await waitForFieldTrigger();
  if (!fieldTrigger) {
    log("Dropdown de campo de filtro não encontrado.");
    return false;
  }
  const current = getCurrentFilterState(fieldTrigger);

  if (current.fieldLabel === desiredFieldLabel && current.valueLabel === desiredValueLabel) {
    return true; // já está filtrado exatamente assim, nada a fazer
  }

  // 1. troca o campo (Nível/Tipo de Oponente/...) só se for diferente do atual
  if (current.fieldLabel !== desiredFieldLabel) {
    fieldTrigger.click();
    await sleep(CLICK_DELAY_MS);

    const option = document.querySelector(`li[data-key="${field}"]`);
    if (!option) {
      log(`Opção de filtro "${field}" não encontrada.`);
      return false;
    }
    option.click();
    // troca de campo remonta o controle de valor (texto <-> select) — um
    // respiro maior aqui evita expor uma race condition no código do jogo
    // (visto travando com "toLowerCase is not a function" quando trocamos
    // de filtro rápido demais).
    await sleep(CLICK_DELAY_MS + 400);
  }

  // 2. preenche o valor — campo de texto (Nível) ou dropdown de seleção
  // (Tipo de Oponente)
  const input = document.querySelector('input[aria-label="Encontre os inimigos"]');
  if (input) {
    setNativeValue(input, value);
    await sleep(300);
  } else {
    const valueTrigger = document.querySelector(
      'button[data-slot="trigger"][aria-label="Encontre os inimigos"]'
    );
    if (!valueTrigger) {
      log("Campo de valor (texto ou seleção) não encontrado.");
      return false;
    }
    valueTrigger.click();
    await sleep(CLICK_DELAY_MS);
    const valueOption = document.querySelector(`li[data-key="${value}"]`);
    if (!valueOption) {
      log(`Valor "${value}" não encontrado nas opções do filtro.`);
      return false;
    }
    valueOption.click();
    await sleep(CLICK_DELAY_MS);
  }

  // 3. clica em Filtrar
  const applied = clickButtonWithExactText("Filtrar");
  await sleep(CLICK_DELAY_MS);
  return applied;
}

// Testa os filtros configurados em ordem, a partir do que estava ativo da
// última vez — quando um não acha alvo (adversários já derrotados, sem
// repetir), cai pro próximo da lista automaticamente.
async function runBattleAttack(cfg) {
  const pdlConfig = cfg.pdl;
  const filters =
    pdlConfig.filters && pdlConfig.filters.length
      ? pdlConfig.filters
      : [{ field: "EnemyType", value: "Bots" }];
  const startIndex = Math.min(pdlConfig.activeFilterIndex || 0, filters.length - 1);

  const navigated = await navigateToSection("BATALHAS");
  if (!navigated) return false;

  for (let offset = 0; offset < filters.length; offset++) {
    const idx = (startIndex + offset) % filters.length;
    const filter = filters[idx];

    const filtered = await applyBattleFilter(filter.field, filter.value);
    if (!filtered) {
      log(`Filtro "${filter.field}=${filter.value}" não aplicou — tentando o próximo.`);
      continue;
    }

    const card = document.querySelector(".page-list-card .submit-button");
    if (!card) {
      log(`Sem alvos para "${filter.field}=${filter.value}" — tentando o próximo filtro.`);
      continue;
    }

    if (idx !== pdlConfig.activeFilterIndex) {
      pdlConfig.activeFilterIndex = idx;
      await bwaSetConfig(cfg);
      log(`Trocou pro filtro "${filter.field}=${filter.value}".`);
    }

    const nameEl = card
      .closest(".page-list-card")
      .querySelector(".kcard-content-front p");
    const name = nameEl ? nameEl.textContent.trim() : "desconhecido";

    // reconfere o slot na hora H — o valor lido no início do ciclo pode
    // estar desatualizado depois de navegar + aplicar filtro.
    // espera o quadrinho confirmar o número antes de decidir — só aborta
    // se CONFIRMAR zero; se nem depois de esperar conseguir ler, segue em
    // frente em vez de travar por causa de uma leitura que nunca chegou.
    const freshPdlSlots = await waitForSlotBlock("battles-icon");
    if (freshPdlSlots && freshPdlSlots.current <= 0) {
      log("Sem slots de Batalha no momento do ataque — abortando.");
      return false;
    }

    const goldBefore = readGold();
    card.click();

    // sabemos que gastou 1 slot — atualiza o número mostrado no popup (e
    // no painel de Visão Geral) na hora, sem esperar o próximo ciclo/reload
    // terminar de confirmar.
    // freshPdlSlots pode ser null (não deu tempo de ler) — só decrementa
    // se tiver um valor de verdade, senão deixa como estava.
    const decrementedPdl = freshPdlSlots
      ? { ...freshPdlSlots, current: Math.max(0, freshPdlSlots.current - 1) }
      : null;
    if (decrementedPdl) {
      const currentSlotsAfterPdl = await bwaGetSlots();
      await bwaSetSlots({ ...currentSlotsAfterPdl, pdl: decrementedPdl });
      const overviewAfterPdl = (await bwaGetOverview()) || {};
      await bwaSetOverview({ ...overviewAfterPdl, pdlSlots: decrementedPdl });
    }

    await sleep(CLICK_DELAY_MS);
    const characterName = await resolveCharacterName();
    const { outcome, gold: goldAfter } = await waitForBattleResult(characterName, goldBefore);
    const goldDelta = sanitizeGoldDelta(
      goldBefore !== null && goldAfter !== null ? goldAfter - goldBefore : null,
      outcome
    );
    const outcomeLabel = outcome === "vitoria" ? "Vitória" : outcome === "derrota" ? "Derrota" : null;

    log(`Atacou (Batalha): ${name}${outcomeLabel ? ` — ${outcomeLabel}` : ""}${formatGoldDelta(goldDelta)}`);
    await bwaAppendLog({ type: "pdl", result: "ok", target: name, outcome, goldDelta });

    if (goldDelta === null && goldBefore !== null) {
      await bwaSetPendingGold({ before: goldBefore, outcome, savedAt: Date.now() });
    }

    // o jogo demora pra atualizar o contador de slot na tela depois de um
    // ataque (o React não reflete o gasto na hora) — recarregar força
    // buscar o estado real do servidor, garantindo que o próximo ciclo não
    // ataque achando que ainda tem energia quando já foi toda usada. Isso
    // também resolve sozinho a tela de resultado do PvP (que exigiria
    // clicar em Voltar pra sair).
    log("Recarregando a página pra garantir o slot atualizado...");
    window.location.reload();
    return true;
  }

  log("Nenhum filtro de Batalhas encontrou alvos neste ciclo.");
  await bwaAppendLog({ type: "pdl", result: "sem_alvo" });
  return false;
}

// ---------- Fluxo de Criaturas (PDB) ----------

// Depois de atacar, o jogo continua na mesma tela da região (não navega
// pra lugar nenhum) — então, antes de ir pro Mapa Mundo, checa se já não
// estamos na região certa e evita a viagem toda (clicar marcador de novo).
function getCurrentRegionTitle() {
  const header = document.querySelector("section.world-map-battle header");
  if (!header) return null;
  const titleEl = header.querySelector("p.text-xl");
  return titleEl ? titleEl.textContent.trim() : null;
}

// data-slot="content" também é usado pelo popover de Estatísticas (HP/XP) —
// se ele ficar meio aberto na hora errada, um querySelector genérico pode
// pegar o popover errado. O popover de região sempre tem o botão "Entrar"
// dentro, então usamos isso pra achar o content certo.
function getOpenRegionPopoverTitle() {
  const contents = document.querySelectorAll('div[data-slot="content"]');
  for (const content of contents) {
    const hasEnterBtn = Array.from(content.querySelectorAll("button")).some(
      (b) => b.textContent.trim() === "Entrar"
    );
    if (!hasEnterBtn) continue;
    const titleEl = content.querySelector("p");
    return titleEl ? titleEl.textContent.trim() : null;
  }
  return null;
}

async function findAndEnterRegion(targetRegionName) {
  if (getCurrentRegionTitle() === targetRegionName) {
    return true;
  }

  // limpeza defensiva — se algum popover de marcador ficou preso aberto de
  // um ciclo anterior (escurecendo a tela), fecha antes de começar. Esse
  // popover não fecha com Escape, então reclica em qualquer marcador que
  // esteja com aria-expanded="true" (toggle) pra fechar de verdade.
  document
    .querySelectorAll('button.absolute.rounded-full.bg-red-500[aria-expanded="true"]')
    .forEach((m) => m.click());
  pressEscape();
  await sleep(300);

  const navigated = await navigateToSection("MAPA MUNDO");
  if (!navigated) return false;

  const markers = document.querySelectorAll(
    "button.absolute.rounded-full.bg-red-500"
  );
  for (const marker of markers) {
    marker.click();
    await sleep(CLICK_DELAY_MS);

    const title = getOpenRegionPopoverTitle();

    if (title === targetRegionName) {
      const entered = clickButtonWithExactText("Entrar");
      await sleep(CLICK_DELAY_MS);
      return entered;
    }
    // fecha o popover antes de tentar o próximo marcador — esse popover
    // específico não fecha com Escape (confirmado: ficavam vários abertos
    // ao mesmo tempo), então reclica no próprio marcador (toggle) e ainda
    // manda Escape por garantia extra.
    marker.click();
    pressEscape();
    await sleep(300);
  }
  pressEscape(); // garante que nada fica preso aberto se nenhuma bateu
  await sleep(300);
  log(`Região "${targetRegionName}" não encontrada nos marcadores.`);
  return false;
}

async function runCreatureAttack(pdbConfig) {
  const inRegion = await findAndEnterRegion(pdbConfig.targetRegion);
  if (!inRegion) return false;

  const cards = document.querySelectorAll(".world-map-battle-grid > div");
  for (const card of cards) {
    const nameEl = card.querySelector(".kcard-content-front p");
    const name = nameEl ? nameEl.textContent.trim() : null;
    if (name !== pdbConfig.targetCreature) continue;

    const container = card.querySelector(".flip-card-container");
    if (container && container.classList.contains("disabled")) {
      log(`Criatura "${name}" está bloqueada, pulando.`);
      await bwaAppendLog({ type: "pdb", result: "bloqueado", target: name });
      return false;
    }
    const attackBtn = card.querySelector("button.submit-button");
    if (!attackBtn) return false;

    // reconfere o slot na hora H — o valor lido no início do ciclo pode
    // estar desatualizado depois de navegar até a região.
    // espera o quadrinho confirmar o número antes de decidir — só aborta
    // se CONFIRMAR zero; se nem depois de esperar conseguir ler, segue em
    // frente em vez de travar por causa de uma leitura que nunca chegou.
    const freshPdbSlots = await waitForSlotBlock("hunt-icon");
    if (freshPdbSlots && freshPdbSlots.current <= 0) {
      log("Sem slots de Criatura no momento do ataque — abortando.");
      return false;
    }

    const goldBefore = readGold();
    attackBtn.click();

    // sabemos que gastou 1 slot — atualiza o número mostrado no popup (e
    // no painel de Visão Geral) na hora, sem esperar o próximo ciclo/reload
    // terminar de confirmar.
    // freshPdbSlots pode ser null (não deu tempo de ler) — só decrementa
    // se tiver um valor de verdade, senão deixa como estava.
    const decrementedPdb = freshPdbSlots
      ? { ...freshPdbSlots, current: Math.max(0, freshPdbSlots.current - 1) }
      : null;
    if (decrementedPdb) {
      const currentSlotsAfterPdb = await bwaGetSlots();
      await bwaSetSlots({ ...currentSlotsAfterPdb, pdb: decrementedPdb });
      const overviewAfterPdb = (await bwaGetOverview()) || {};
      await bwaSetOverview({ ...overviewAfterPdb, pdbSlots: decrementedPdb });
    }

    await sleep(CLICK_DELAY_MS);
    const characterName = await resolveCharacterName();
    const { outcome, gold: goldAfter } = await waitForBattleResult(characterName, goldBefore);
    const goldDelta = sanitizeGoldDelta(
      goldBefore !== null && goldAfter !== null ? goldAfter - goldBefore : null,
      outcome
    );
    const outcomeLabel = outcome === "vitoria" ? "Vitória" : outcome === "derrota" ? "Derrota" : null;

    log(`Atacou (Criatura): ${name}${outcomeLabel ? ` — ${outcomeLabel}` : ""}${formatGoldDelta(goldDelta)}`);
    await bwaAppendLog({ type: "pdb", result: "ok", target: name, outcome, goldDelta });

    if (goldDelta === null && goldBefore !== null) {
      await bwaSetPendingGold({ before: goldBefore, outcome, savedAt: Date.now() });
    }

    // o jogo demora pra atualizar o contador de slot na tela depois de um
    // ataque — recarregar força buscar o estado real do servidor, evitando
    // atacar de novo achando que ainda tem energia. Perde a otimização de
    // "ficar na mesma região" (o próximo ciclo entra de novo via marcador),
    // mas vale pela segurança de não gastar/tentar gastar energia errada.
    log("Recarregando a página pra garantir o slot atualizado...");
    window.location.reload();
    return true;
  }
  log(`Criatura "${pdbConfig.targetCreature}" não encontrada nesta região.`);
  await bwaAppendLog({ type: "pdb", result: "sem_alvo" });
  return false;
}

// ---------- Saúde e Segurança (HP / Gold / Poções) ----------
// Vida só é visível dentro do popover de estatísticas (avatar no topo),
// que abre/fecha como toggle (mesmo padrão React Aria do popover do mapa).

function readHPFromDOM() {
  const lifeIcon = document.querySelector('img[src*="life-icon"]');
  if (!lifeIcon) return null;
  const bar = lifeIcon.parentElement.querySelector('[role="progressbar"]');
  if (!bar) return null;
  const current = Number(bar.getAttribute("aria-valuenow"));
  const max = Number(bar.getAttribute("aria-valuemax"));
  if (!max) return null;
  return { current, max };
}

function readXPFromDOM() {
  const xpIcon = document.querySelector('img[src*="xp-icon"]');
  if (!xpIcon) return null;
  const bar = xpIcon.parentElement.querySelector('[role="progressbar"]');
  if (!bar) return null;
  const current = Number(bar.getAttribute("aria-valuenow"));
  const max = Number(bar.getAttribute("aria-valuemax"));
  if (!max) return null;
  return { current, max };
}

// Nome e nível ficam sempre visíveis no próprio botão do avatar, sem
// precisar abrir o popover.
function readNameLevelFromDOM() {
  const trigger = document.querySelector(".k-stats-menu-wrapper button[data-slot='trigger']");
  if (!trigger) return { name: null, level: null };
  const paragraphs = trigger.querySelectorAll("p");
  const name = paragraphs[0] ? paragraphs[0].textContent.trim() : null;
  const levelText = paragraphs[1] ? paragraphs[1].textContent.trim() : null; // "Nível 7"
  const level = levelText ? Number(levelText.replace(/\D/g, "")) : null;
  return { name, level };
}

// Vida e XP moram no mesmo popover de estatísticas — abre uma vez só,
// lê os dois, fecha de novo (toggle, mesmo padrão do popover do mapa).
async function readCharacterStats() {
  const { name, level } = readNameLevelFromDOM();

  // Em telas com sidebar (ex: Batalhas) HP/XP já ficam visíveis direto na
  // página, sem popover — tenta ler assim primeiro, sem clicar em nada.
  let hp = readHPFromDOM();
  let xp = readXPFromDOM();

  if (!hp || !xp) {
    const trigger = document.querySelector(".k-stats-menu-wrapper button[data-slot='trigger']");
    if (trigger) {
      const alreadyOpen = trigger.getAttribute("aria-expanded") === "true";
      if (!alreadyOpen) {
        trigger.click();
        await sleep(CLICK_DELAY_MS);
      }
      hp = hp || readHPFromDOM();
      xp = xp || readXPFromDOM();
      if (!alreadyOpen) {
        pressEscape();
        await sleep(300);
      }
    }
  }

  return { name, level, hp, xp };
}

function readGold() {
  // o mesmo componente de gold é reaproveitado dentro do popover de
  // estatísticas — se ele estiver aberto por acaso, existem 2 cópias na
  // tela. Pula qualquer uma que esteja dentro de um popover/dialog e busca
  // o <p> dentro do container do ícone (mais robusto que nextElementSibling,
  // que pode apontar pro elemento errado se a estrutura mudar um pouco).
  const icons = document.querySelectorAll('img[src*="gold-icon"]');
  for (const icon of icons) {
    if (icon.closest('[data-slot="content"]')) continue;
    const p = icon.parentElement ? icon.parentElement.querySelector("p") : null;
    if (!p) continue;
    const n = Number(p.textContent.replace(/\D/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// O contador de gold às vezes ainda não renderizou (mesma defasagem já
// vista nos slots e no resultado de batalha) — espera uma leitura
// confirmada antes de deixar quem chamou decidir com base num null.
async function waitForGold(timeoutMs = 2000) {
  const start = Date.now();
  let gold = readGold();
  while (gold === null && Date.now() - start < timeoutMs) {
    await sleep(150);
    gold = readGold();
  }
  return gold;
}

// Tenta identificar vitória/derrota pela tela "Vencedor/Derrotado" que
// aparece às vezes depois de um ataque (PvP sempre, criatura nem sempre).
// Quando não aparece, retorna null — o chamador cai pro delta de gold.
function readBattleOutcome(characterName) {
  if (!characterName) return null;
  const paragraphs = Array.from(document.querySelectorAll("p"));
  const winnerIdx = paragraphs.findIndex((p) => p.textContent.trim() === "Vencedor");
  if (winnerIdx === -1) return null;

  for (let i = winnerIdx; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (p.style && p.style.fontFamily && p.style.fontFamily.includes("MedievalSharp")) {
      return p.textContent.trim() === characterName ? "vitoria" : "derrota";
    }
  }
  return null;
}

// O nome do personagem no botão de estatísticas às vezes vem vazio (layout
// só com ícone, sem texto) — cai pro último nome confirmado guardado na
// Visão Geral em vez de desistir de identificar vitória/derrota.
async function resolveCharacterName() {
  const live = readNameLevelFromDOM().name;
  if (live) return live;
  const overview = (await bwaGetOverview()) || {};
  return overview.name || null;
}

// O jogo demora a atualizar a tela de resultado (Vencedor/Derrotado) e o
// gold depois de um ataque — igual ao slot, uma leitura única logo após o
// clique pode pegar tudo cedo demais. Espera até 2s, checando a cada
// 150ms, até o resultado aparecer E o gold mudar (ou esgotar o tempo).
async function waitForBattleResult(characterName, goldBefore, timeoutMs = 2000) {
  const start = Date.now();
  let outcome = readBattleOutcome(characterName);
  let gold = readGold();
  while (Date.now() - start < timeoutMs && (outcome === null || gold === goldBefore)) {
    await sleep(150);
    if (outcome === null) outcome = readBattleOutcome(characterName);
    if (gold === goldBefore) gold = readGold();
  }
  return { outcome, gold };
}

// O tamanho do ganho/perda varia demais (depende do quanto o oponente tem)
// pra usar um limite fixo como sinal de erro. O que não faz sentido é a
// direção contradizer o resultado — "Vitória" rouba gold (delta >= 0),
// "Derrota" não deveria render gold (delta <= 0). Quando bate errado,
// descarta em vez de mostrar um valor claramente errado.
function sanitizeGoldDelta(delta, outcome) {
  if (delta === null || delta === undefined) return null;
  if (outcome === "vitoria" && delta < 0) return null;
  if (outcome === "derrota" && delta > 0) return null;
  return delta;
}

function formatGoldDelta(delta) {
  if (delta === null || delta === undefined) return "";
  if (delta === 0) return " (+0 gold)";
  return delta > 0 ? ` (+${delta} gold)` : ` (${delta} gold)`;
}

function findPotionCardByHP(hpAmount) {
  const cards = document.querySelectorAll(".page-list-card");
  for (const card of cards) {
    const match = Array.from(card.querySelectorAll("p")).find(
      (p) => p.textContent.trim() === `+${hpAmount} HP`
    );
    if (match) return card;
  }
  return null;
}

async function buyPotion(hpAmount) {
  const navigated = await navigateToSection("LOJA DE POÇÕES");
  if (!navigated) return false;
  await sleep(CLICK_DELAY_MS);

  const card = findPotionCardByHP(hpAmount);
  if (!card) {
    log(`Poção de +${hpAmount} HP não encontrada na loja.`);
    return false;
  }
  const buyBtn = card.querySelector("button");
  if (!buyBtn || buyBtn.disabled) {
    log(`Compra da poção +${hpAmount} HP indisponível (botão desabilitado).`);
    return false;
  }
  buyBtn.click();
  await sleep(CLICK_DELAY_MS);
  return true;
}

// TODO: falta o HTML da tela de Inventário (botão de usar uma poção já
function findInventoryItemCard(itemName) {
  const caption = Array.from(document.querySelectorAll("p")).find(
    (p) => p.textContent.trim() === itemName
  );
  if (!caption) return null;
  return caption.closest(".page-list-card") || caption.parentElement;
}

// Comprar só deixa a poção no Inventário — precisa entrar lá, selecionar
// (clicar na imagem) e clicar em "Usar poção" pra realmente recuperar vida.
async function usePotionFromInventory(hpAmount) {
  const itemName = POTION_INVENTORY_NAMES[hpAmount];
  if (!itemName) {
    log(`Nome do item de +${hpAmount} HP no Inventário ainda não configurado — não dá pra usar do estoque.`);
    return false;
  }

  const navigated = await navigateToSection("INVENTÁRIO");
  if (!navigated) return false;
  await sleep(CLICK_DELAY_MS);

  const card = findInventoryItemCard(itemName);
  if (!card) {
    log(`Nenhuma "${itemName}" no estoque.`);
    return false;
  }

  const img = card.querySelector("img");
  if (!img) return false;
  img.click();
  await sleep(CLICK_DELAY_MS);

  const used = clickButtonWithExactText("Usar poção");
  if (!used) {
    log('Selecionei a poção mas não achei o botão "Usar poção".');
    return false;
  }
  await sleep(CLICK_DELAY_MS);
  return true;
}

async function runHealthSafety(cfg, hp) {
  if (!cfg.safety.enabled) return;
  if (cfg.work.wasWorking) return; // não interrompe trabalho para comprar/usar poção
  if (!hp || !hp.max) return;

  const hpPercent = (hp.current / hp.max) * 100;
  if (hpPercent >= cfg.safety.hpThresholdPercent) return;

  const tier = POTION_TIERS[cfg.safety.potionTier];
  if (!tier) return;

  const usedFromStock = await usePotionFromInventory(tier.hp);
  if (usedFromStock) {
    log(`Vida baixa (${hp.current}/${hp.max}) — usou poção do estoque.`);
    await bwaAppendLog({ type: "saude", result: "ok", target: "poção usada (estoque)" });
    return;
  }

  const gold = await waitForGold();
  if (gold === null) {
    log(`Vida baixa (${hp.current}/${hp.max}) mas não foi possível confirmar o gold — tenta de novo no próximo ciclo.`);
    return;
  }
  if (gold - tier.cost < cfg.safety.minGoldReserve) {
    log(`Vida baixa (${hp.current}/${hp.max}) mas gold insuficiente (reserva mínima).`);
    await bwaAppendLog({ type: "saude", result: "sem_gold" });
    return;
  }

  const bought = await buyPotion(tier.hp);
  if (bought) {
    log(`Vida baixa (${hp.current}/${hp.max}) — comprou poção de +${tier.hp} HP.`);
    await bwaAppendLog({ type: "saude", result: "ok", target: `comprou poção +${tier.hp}HP` });
  } else {
    log(`Vida baixa (${hp.current}/${hp.max}) — falha ao comprar poção.`);
    await bwaAppendLog({ type: "saude", result: "falha_compra" });
  }
}

// ---------- Treinamento ----------
// Cada atributo é um card com o nome, uma barra de progresso e um botão
// "[ícone gold] custo" — clicar sobe o atributo em 1 e o custo sobe pro
// próximo nível. Compra na ordem de prioridade configurada, pulando quem
// não tem gold suficiente, até esgotar o que dá pra comprar nessa visita.

function findTrainingStatCard(statName) {
  const label = Array.from(document.querySelectorAll("span")).find(
    (s) => s.textContent.trim() === statName
  );
  if (!label) return null;
  return label.closest('div[tabindex="-1"]');
}

function readTrainingStatCost(card) {
  const btn = card.querySelector("button");
  if (!btn) return null;
  const costP = btn.querySelector("p");
  if (!costP) return null;

  // com desconto de clã, o preço vem como dois números — o original
  // riscado (.line-through) e o valor de verdade logo depois. Sem separar
  // os dois, textContent junta tudo num número gigante sem sentido.
  const strikethrough = costP.querySelector(".line-through");
  if (strikethrough) {
    const spans = Array.from(costP.querySelectorAll("span"));
    const actualSpan = spans[spans.indexOf(strikethrough) + 1];
    if (actualSpan) {
      const discounted = Number(actualSpan.textContent.replace(/\D/g, ""));
      return Number.isFinite(discounted) ? discounted : null;
    }
  }

  const n = Number(costP.textContent.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function runTraining(cfg) {
  if (!cfg.training.enabled) return;

  const priorities = (cfg.training.stats || []).filter((s) => s.enabled).map((s) => s.name);
  if (priorities.length === 0) return;

  const navigated = await navigateToSection("TREINAMENTO");
  if (!navigated) return;
  await sleep(CLICK_DELAY_MS);

  const maxPurchasesPerVisit = 20; // trava de segurança, não é praticamente um limite
  for (let i = 0; i < maxPurchasesPerVisit; i++) {
    const gold = readGold();
    if (gold === null) break;

    let bought = false;
    for (const statName of priorities) {
      const card = findTrainingStatCard(statName);
      if (!card) continue;

      const btn = card.querySelector("button");
      if (!btn || btn.disabled) continue;

      const cost = readTrainingStatCost(card);
      if (cost === null || gold - cost < cfg.training.minGoldReserve) continue;

      btn.click();
      await sleep(CLICK_DELAY_MS);
      log(`Treinou "${statName}" por ${cost} gold.`);
      await bwaAppendLog({ type: "treino", result: "ok", target: statName, goldDelta: -cost });
      bought = true;
      break;
    }

    if (!bought) break; // nada afordável agora, encerra
  }
}

// ---------- Trabalho ----------
// Enquanto trabalha, o personagem não pode atacar — por isso o config diz
// pra rodar em loop sempre que ligado, sem checar slots de Batalha/Criatura.

// A tela mostra "TEMPO RESTANTE" + um botão "Cancelar Trabalho" enquanto o
// trabalho está em andamento — texto exclusivo dessa situação.
function isWorking() {
  return Array.from(document.querySelectorAll("button")).some(
    (b) => b.textContent.trim() === "Cancelar Trabalho"
  );
}

function selectWorkDuration(hours) {
  const buttons = document.querySelectorAll("button.work-hour-option");
  for (const btn of buttons) {
    const label = btn.getAttribute("aria-label") || "";
    if (label.startsWith(`${hours} hora`)) {
      if (btn.getAttribute("aria-pressed") !== "true") {
        btn.click();
      }
      return true;
    }
  }
  return false;
}

async function startWork() {
  const clicked = clickButtonWithExactText("Começar a Trabalhar");
  await sleep(CLICK_DELAY_MS);
  return clicked;
}

// Data LOCAL (não UTC) — toISOString() usa UTC, o que faz "hoje" trocar no
// meio da tarde/noite em fusos negativos (ex: Brasil) e quebra a trava de
// "já disparou hoje" pra trabalhos longos que cruzam esse horário.
function todayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Janela de tolerância do "despertador" — só dispara se o horário
// configurado já passou há pouco tempo (não "a qualquer hora depois
// disso"). Cobre folgas de tick (15s) sem virar um alarme atrasado o dia
// inteiro.
const WORK_SCHEDULE_WINDOW_MINUTES = 5;

// Rotina: liga o Trabalho sozinho nos horários configurados (Diário ou
// Semanal, com uma ou mais execuções por dia), como um despertador — só no
// minuto certo, não fica disparando atrasado o resto do dia. Retorna o
// horário (HH:MM) que disparou, ou null se nenhum estiver de pé agora.
function dueWorkScheduleTime(work) {
  const schedule = work.schedule;
  if (!schedule || !schedule.enabled || work.enabled) return null;

  const now = new Date();
  const todayStr = todayDateStr();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (schedule.repeat === "weekly") {
    const dow = now.getDay(); // 0=Dom..6=Sáb
    if (!schedule.daysOfWeek || !schedule.daysOfWeek.includes(dow)) return null;
  }

  const triggeredTimes =
    schedule.triggeredToday && schedule.triggeredToday.date === todayStr
      ? schedule.triggeredToday.times
      : [];

  const times = (schedule.times && schedule.times.length ? schedule.times : []).slice().sort();
  let candidate = null;
  for (const time of times) {
    const [h, m] = time.split(":").map(Number);
    const slotMinutes = h * 60 + m;
    const withinWindow =
      nowMinutes >= slotMinutes && nowMinutes < slotMinutes + WORK_SCHEDULE_WINDOW_MINUTES;
    if (withinWindow && !triggeredTimes.includes(time)) {
      candidate = time; // fica com o mais tardio ainda elegível
    }
  }
  return candidate;
}

// Retorna true se o personagem está (ou acabou de ficar) trabalhando —
// usado pelo tick() pra pular Batalhas/Criaturas nesse caso (o jogo não
// deixa fazer as duas coisas ao mesmo tempo). Sempre reconfere isWorking()
// de verdade depois de qualquer ação — nunca presume que um clique deu
// certo, pra não liberar ataques enquanto ainda está trabalhando de fato.
async function runWork(cfg) {
  const navigated = await navigateToSection("TRABALHO");
  if (!navigated) {
    // não deu pra nem verificar — por segurança, assume que pode estar
    // trabalhando ainda (não libera Batalhas/Criaturas às cegas).
    return cfg.work.wasWorking;
  }
  await sleep(CLICK_DELAY_MS);

  let working = isWorking();
  const previouslyWasWorking = cfg.work.wasWorking;

  // usuário desligou o toggle manualmente enquanto ainda trabalhava —
  // tenta cancelar de verdade no jogo (perde a recompensa).
  if (!cfg.work.enabled && working) {
    const cancelled = clickButtonWithExactText("Cancelar Trabalho");
    if (cancelled) {
      await sleep(CLICK_DELAY_MS);
      const confirmed = clickButtonWithExactText("Confirmar cancelamento");
      await sleep(CLICK_DELAY_MS);
      if (confirmed) {
        log("Trabalho cancelado no jogo (desativado manualmente no app).");
        await bwaAppendLog({ type: "trabalho", result: "cancelado" });
      } else {
        log("Cliquei em Cancelar Trabalho mas não achei o botão de confirmar — tenta de novo no próximo ciclo.");
      }
    }
    working = isWorking(); // reconfere de verdade, não presume
  }

  cfg.work.wasWorking = working;

  if (working) {
    await bwaSetConfig(cfg);
    return true;
  }

  // não está mais trabalhando — se tiver a tela "Pronto pra resgatar",
  // resgata o pagamento antes de seguir (senão a recompensa fica presa).
  const claimed = clickButtonWithExactText("Resgatar Pagamento");
  if (claimed) {
    await sleep(CLICK_DELAY_MS);
    log("Resgatou o pagamento do trabalho.");
    await bwaAppendLog({ type: "trabalho", result: "resgatado" });
  }

  // não está trabalhando agora — se estava (e o toggle segue ligado), foi
  // conclusão natural: desliga sozinho em vez de iniciar outra sessão.
  if (cfg.work.enabled && previouslyWasWorking) {
    cfg.work.enabled = false;
    await bwaSetConfig(cfg);
    log("Trabalho concluído — desativando automação de Trabalho.");
    await bwaAppendLog({ type: "trabalho", result: "concluido" });
    return false;
  }

  if (!cfg.work.enabled) {
    const dueTime = dueWorkScheduleTime(cfg.work);
    if (!dueTime) {
      await bwaSetConfig(cfg);
      return false;
    }
    cfg.work.enabled = true;
    const todayStr = todayDateStr();
    const schedule = cfg.work.schedule;
    if (!schedule.triggeredToday || schedule.triggeredToday.date !== todayStr) {
      schedule.triggeredToday = { date: todayStr, times: [] };
    }
    schedule.triggeredToday.times.push(dueTime);
    log(`Rotina de Trabalho: ativando automaticamente (horário ${dueTime}).`);
  }

  // cfg.work.enabled está true aqui (manual ou pela rotina) e não está
  // trabalhando ainda — inicia uma sessão nova
  const selected = selectWorkDuration(cfg.work.durationHours);
  if (!selected) {
    log(`Opção de trabalho de ${cfg.work.durationHours}h não encontrada.`);
    await bwaSetConfig(cfg);
    return false;
  }
  await sleep(CLICK_DELAY_MS);

  const started = await startWork();
  if (started) {
    log(`Começou a trabalhar (${cfg.work.durationHours}h).`);
    await bwaAppendLog({ type: "trabalho", result: "ok", target: `${cfg.work.durationHours}h` });
  }
  cfg.work.wasWorking = isWorking(); // reconfere de novo antes de decidir o retorno
  await bwaSetConfig(cfg);
  return cfg.work.wasWorking;
}

// ---------- Loop principal ----------

function withinSchedule(section) {
  if (section.mode !== "scheduled") return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = section.scheduleStart.split(":").map(Number);
  const [eh, em] = section.scheduleEnd.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start <= end) return cur >= start && cur < end;
  return cur >= start || cur < end; // janela que cruza a meia-noite
}

let busy = false;
let tickIntervalId = null;
let tickCount = 0;
// ler HP/XP abre e fecha um popover na tela — sem "Saúde e Segurança"
// ativado, não há necessidade de checar toda hora (evita ficar piscando).
const STATS_REFRESH_EVERY_N_TICKS = 4; // ~1min com ticks de 15s

async function resolvePendingGoldDelta() {
  const pending = await bwaGetPendingGold();
  if (!pending) return;
  if (Date.now() - pending.savedAt > 2 * 60 * 1000) {
    await bwaClearPendingGold();
    return;
  }
  const currentGold = readGold();
  if (currentGold === null) return;
  const rawDelta = currentGold - pending.before;
  const delta = sanitizeGoldDelta(rawDelta, pending.outcome);
  await bwaPatchLastBattleLog(delta);
  await bwaClearPendingGold();
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    await resolvePendingGoldDelta();

    const cfg = await bwaGetConfig();
    if (!cfg.masterEnabled) return;

    const pdlSlots = getPDLSlots();
    const pdbSlots = getPDBSlots();
    await bwaSetSlots({ pdl: pdlSlots, pdb: pdbSlots });

    tickCount++;
    const shouldReadStats =
      cfg.safety.enabled || tickCount % STATS_REFRESH_EVERY_N_TICKS === 1;
    if (shouldReadStats) {
      const stats = await readCharacterStats();
      const prevOverview = (await bwaGetOverview()) || {};
      const avatarUrl =
        document.querySelector('img.k-avatar__image[alt="Avatar"]')?.src || prevOverview.avatarUrl || null;
      await bwaSetOverview({
        name: stats.name || prevOverview.name || null,
        level: stats.level || prevOverview.level || null,
        hp: stats.hp || prevOverview.hp || null,
        xp: stats.xp || prevOverview.xp || null,
        gold: readGold(),
        avatarUrl,
        pdlSlots: pdlSlots || prevOverview.pdlSlots || null,
        pdbSlots: pdbSlots || prevOverview.pdbSlots || null,
        updatedAt: Date.now()
      });
      await runHealthSafety(cfg, stats.hp || prevOverview.hp);
    }

    const working = await runWork(cfg);

    if (working) {
      log("Trabalho em andamento — pulando Batalhas/Criaturas neste ciclo.");
    } else {
      if (cfg.pdl.enabled && withinSchedule(cfg.pdl)) {
        if (pdlSlots && pdlSlots.current > 0) {
          await runBattleAttack(cfg);
        }
      }
      if (cfg.pdb.enabled && withinSchedule(cfg.pdb)) {
        if (pdbSlots && pdbSlots.current > 0) {
          await runCreatureAttack(cfg.pdb);
        }
      }
      await runTraining(cfg);
    }
  } catch (err) {
    if (err && String(err.message).includes("Extension context invalidated")) {
      log("A extensão foi recarregada — atualize esta página (F5) para reconectar.");
      if (tickIntervalId) clearInterval(tickIntervalId);
    } else {
      log("Erro no ciclo:", err);
    }
  } finally {
    busy = false;
  }
}

log("content.js carregado.");
tickIntervalId = setInterval(tick, TICK_INTERVAL_MS);
tick();
