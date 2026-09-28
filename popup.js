let config = null;
let lastOverview = null;

async function load() {
  config = await bwaGetConfig();
  render();
  renderSlots();
  renderLog();
  renderOverview();
}

function render() {
  document.getElementById("masterSwitch").classList.toggle("on", config.masterEnabled);
  renderStatus();

  document.getElementById("autoDisableEnabled").checked = config.autoDisable.enabled;
  document.getElementById("autoDisableMinutes").value = config.autoDisable.durationMinutes;
  document.getElementById("autoDisableTimer").classList.toggle("show", config.autoDisable.enabled);

  document.getElementById("pdbEnabledSwitch").classList.toggle("on", config.pdb.enabled);
  document.getElementById("pdlEnabledSwitch").classList.toggle("on", config.pdl.enabled);

  setSegmented("pdbMode", config.pdb.mode);
  setSegmented("pdlMode", config.pdl.mode);

  document.getElementById("pdbStart").value = config.pdb.scheduleStart;
  document.getElementById("pdbEnd").value = config.pdb.scheduleEnd;
  document.getElementById("pdlStart").value = config.pdl.scheduleStart;
  document.getElementById("pdlEnd").value = config.pdl.scheduleEnd;

  document.getElementById("pdbSchedule").classList.toggle("show", config.pdb.mode === "scheduled");
  document.getElementById("pdlSchedule").classList.toggle("show", config.pdl.mode === "scheduled");

  document.getElementById("pdbRegionChip").textContent = config.pdb.targetRegion || "—";
  document.getElementById("pdbCreatureChip").textContent = config.pdb.targetCreature || "—";

  const filters = config.pdl.filters || [];
  const activeIdx = filters.length ? Math.min(config.pdl.activeFilterIndex || 0, filters.length - 1) : -1;
  const activeFilter = activeIdx >= 0 ? filters[activeIdx] : null;
  document.getElementById("pdlFieldChip").textContent = activeFilter
    ? `${fieldLabel(activeFilter.field)}: ${activeFilter.value}`
    : "—";
  document.getElementById("pdlValueChip").textContent = filters.length
    ? `Filtro ${activeIdx + 1}/${filters.length}`
    : "—";

  document.getElementById("workEnabledSwitch").classList.toggle("on", config.work.enabled);
  document.getElementById("workDurationChip").textContent =
    `${config.work.durationHours}h — ${WORK_DURATIONS[config.work.durationHours] || "?"}`;

  document.getElementById("trainingEnabledSwitch").classList.toggle("on", config.training.enabled);
  const trainingSelected = (config.training.stats || []).filter((s) => s.enabled);
  document.getElementById("trainingStatsChip").textContent = trainingSelected.length
    ? trainingSelected.map((s) => s.name).join(", ")
    : "Nenhum marcado";

  document.getElementById("safetyEnabledSwitch").classList.toggle("on", config.safety.enabled);
  const tier = POTION_TIERS[config.safety.potionTier];
  document.getElementById("safetyTierChip").textContent = tier
    ? `${tier.cost}G → +${tier.hp}HP`
    : "—";
  document.getElementById("safetyThresholdChip").textContent = `< ${config.safety.hpThresholdPercent}%`;
}

function renderStatus() {
  const el = document.getElementById("statusLine");
  let text;

  if (!config.masterEnabled) {
    text = "Parado";
  } else if (config.autoDisable.enabled && config.autoDisable.disableAt) {
    const remainingMs = config.autoDisable.disableAt - Date.now();
    if (remainingMs <= 0) {
      text = "Ativo — desligando...";
    } else {
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      text = `Ativo — desliga automaticamente em ${mins}min ${secs}s`;
    }
  } else {
    text = "Ativo";
  }

  if (lastOverview && lastOverview.updatedAt) {
    const time = new Date(lastOverview.updatedAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    text += ` · atualizado às ${time}`;
  }

  el.textContent = text;
}

// Cria/atualiza o alarme do Chrome que desliga tudo sozinho. Roda mesmo
// com o popup fechado, porque é o background.js (não esta página) que
// escuta o alarme disparar.
async function scheduleAutoDisable() {
  await chrome.alarms.clear("bwa_auto_disable");

  if (!config.masterEnabled || !config.autoDisable.enabled) {
    config.autoDisable.disableAt = null;
    return;
  }
  const minutes = Math.max(1, Number(config.autoDisable.durationMinutes) || 60);
  config.autoDisable.durationMinutes = minutes;
  config.autoDisable.disableAt = Date.now() + minutes * 60000;
  await chrome.alarms.create("bwa_auto_disable", { delayInMinutes: minutes });
}

function fieldLabel(field) {
  const map = {
    Name: "Nome",
    Level: "Nível",
    EnemyType: "Tipo de Oponente",
    "Race.Type": "Tipo da Raça",
    RaceId: "Raça"
  };
  return map[field] || field;
}

function setSegmented(containerId, value) {
  const container = document.getElementById(containerId);
  container.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
}

async function renderOverview() {
  const overview = await bwaGetOverview();
  lastOverview = overview;

  const ovName = document.getElementById("ovName");
  const ovLevel = document.getElementById("ovLevel");
  const ovGold = document.getElementById("ovGold");
  const ovXP = document.getElementById("ovXP");
  const ovHP = document.getElementById("ovHP");
  const ovPDBSlots = document.getElementById("ovPDBSlots");
  const ovPDLSlots = document.getElementById("ovPDLSlots");

  const hpCountEl = document.getElementById("hpCount");
  const hpBarEl = document.getElementById("hpBar");
  const hpHintEl = document.getElementById("hpHint");

  if (!overview) {
    ovName.textContent = "—";
    ovLevel.textContent = "Nível —";
    ovGold.textContent = "🪙 —";
    ovXP.textContent = "—";
    ovHP.textContent = "—";
    ovPDBSlots.textContent = "—";
    ovPDLSlots.textContent = "—";
    hpCountEl.textContent = "—";
    hpBarEl.style.width = "0%";
    hpHintEl.textContent = "Ative abaixo pra monitorar.";
    return;
  }

  ovName.textContent = overview.name || "—";
  ovLevel.textContent = overview.level ? `Nível ${overview.level}` : "Nível —";
  ovGold.textContent =
    typeof overview.gold === "number" ? `🪙 ${overview.gold.toLocaleString("pt-BR")}` : "🪙 —";
  ovXP.textContent = overview.xp ? `${overview.xp.current}/${overview.xp.max}` : "—";
  ovPDBSlots.textContent = overview.pdbSlots
    ? `${overview.pdbSlots.current}/${overview.pdbSlots.max}`
    : "—";
  ovPDLSlots.textContent = overview.pdlSlots
    ? `${overview.pdlSlots.current}/${overview.pdlSlots.max}`
    : "—";

  if (overview.hp && overview.hp.max) {
    ovHP.textContent = `${overview.hp.current}/${overview.hp.max}`;
    hpCountEl.textContent = `${overview.hp.current} / ${overview.hp.max}`;
    hpBarEl.style.width = `${(overview.hp.current / overview.hp.max) * 100}%`;
    hpHintEl.textContent = "";
  } else {
    ovHP.textContent = "—";
    hpCountEl.textContent = "—";
    hpBarEl.style.width = "0%";
    hpHintEl.textContent = "Ative abaixo pra monitorar.";
  }
}

async function renderSlots() {
  const slots = await bwaGetSlots();
  fillSlot("pdb", slots.pdb, "nat");
  fillSlot("pdl", slots.pdl, "bat");
}

function fillSlot(prefix, data, cls) {
  const countEl = document.getElementById(`${prefix}SlotCount`);
  const barEl = document.getElementById(`${prefix}Bar`);
  const cdEl = document.getElementById(`${prefix}Countdown`);
  if (!data) {
    countEl.textContent = "—";
    barEl.style.width = "0%";
    cdEl.textContent = "Abra o jogo em uma aba para ver os slots.";
    return;
  }
  countEl.textContent = `${data.current} / ${data.max}`;
  barEl.style.width = `${(data.current / data.max) * 100}%`;
  cdEl.textContent = data.countdown ? `próximo slot em ${data.countdown}` : "cheio";
}

async function renderLog() {
  const log = await bwaGetLog();
  const list = document.getElementById("logList");
  if (log.length === 0) {
    list.innerHTML = '<div class="log-empty">Nenhuma ação ainda.</div>';
    return;
  }
  list.innerHTML = log
    .slice(0, 8)
    .map((entry) => {
      const ok = entry.outcome ? entry.outcome === "vitoria" : entry.result === "ok";
      const outcomeText =
        entry.outcome === "vitoria" ? " · Vitória" : entry.outcome === "derrota" ? " · Derrota" : "";
      const goldText =
        typeof entry.goldDelta === "number" ? ` · ${entry.goldDelta >= 0 ? "+" : ""}${entry.goldDelta}g` : "";
      const label = bwaEscapeHtml((entry.target || entry.result) + outcomeText + goldText);
      const minsAgo = Math.max(0, Math.round((Date.now() - entry.time) / 60000));
      return `<div class="log-item">
        <div class="log-icon ${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"}</div>
        <div class="log-text">${bwaEscapeHtml(entry.type.toUpperCase())} — ${label}</div>
        <div class="log-time">${minsAgo}min</div>
      </div>`;
    })
    .join("");
}

async function save() {
  await bwaSetConfig(config);
}

// ---------- eventos ----------

document.getElementById("masterSwitch").addEventListener("click", async () => {
  config.masterEnabled = !config.masterEnabled;
  await scheduleAutoDisable();
  render();
  await save();
  await bwaAppendLog({
    type: "sistema",
    result: config.masterEnabled ? "ativo" : "inativo",
    target: config.masterEnabled ? "ativado manualmente" : "desativado manualmente"
  });
});

document.getElementById("autoDisableEnabled").addEventListener("change", async (e) => {
  config.autoDisable.enabled = e.target.checked;
  await scheduleAutoDisable();
  render();
  await save();
});

document.getElementById("autoDisableMinutes").addEventListener("change", async (e) => {
  config.autoDisable.durationMinutes = Math.max(1, Number(e.target.value) || 60);
  await scheduleAutoDisable();
  render();
  await save();
});

document.getElementById("pdbEnabledSwitch").addEventListener("click", async () => {
  config.pdb.enabled = !config.pdb.enabled;
  render();
  await save();
});
document.getElementById("pdlEnabledSwitch").addEventListener("click", async () => {
  config.pdl.enabled = !config.pdl.enabled;
  render();
  await save();
});
document.getElementById("workEnabledSwitch").addEventListener("click", async () => {
  config.work.enabled = !config.work.enabled;
  render();
  await save();
});
document.getElementById("trainingEnabledSwitch").addEventListener("click", async () => {
  config.training.enabled = !config.training.enabled;
  render();
  await save();
});
document.getElementById("safetyEnabledSwitch").addEventListener("click", async () => {
  config.safety.enabled = !config.safety.enabled;
  render();
  await save();
});

["pdbMode", "pdlMode"].forEach((id) => {
  document.getElementById(id).addEventListener("click", async (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    const key = id.startsWith("pdb") ? "pdb" : "pdl";
    config[key].mode = btn.dataset.value;
    render();
    await save();
  });
});

[
  ["pdbStart", "pdb", "scheduleStart"],
  ["pdbEnd", "pdb", "scheduleEnd"],
  ["pdlStart", "pdl", "scheduleStart"],
  ["pdlEnd", "pdl", "scheduleEnd"]
].forEach(([id, section, key]) => {
  document.getElementById(id).addEventListener("change", async (e) => {
    config[section][key] = e.target.value;
    await save();
  });
});

document.querySelectorAll("[data-toggle]").forEach((head) => {
  head.addEventListener("click", () => {
    head.closest(".section").classList.toggle("open");
  });
});

load();
setInterval(renderSlots, 5000);
setInterval(renderLog, 5000);
setInterval(renderStatus, 1000);
setInterval(renderOverview, 5000);
