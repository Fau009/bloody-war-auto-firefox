let config = null;
let pdlFilters = [];
let trainingStats = [];

function createTrainingRow(stat, index) {
  const row = document.createElement("div");
  row.className = "filter-row";
  row.draggable = true;
  row.dataset.index = index;

  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  row.appendChild(handle);

  const label = document.createElement("label");
  label.className = "inline-checkbox";
  label.style.flex = "1";
  label.style.marginBottom = "0";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = stat.enabled;
  checkbox.addEventListener("change", () => {
    trainingStats[index].enabled = checkbox.checked;
  });

  const span = document.createElement("span");
  span.textContent = stat.name;

  label.appendChild(checkbox);
  label.appendChild(span);
  row.appendChild(label);

  row.addEventListener("dragstart", (e) => {
    row.classList.add("dragging");
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-over");
  });
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.classList.remove("drag-over");
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    const toIndex = index;
    if (fromIndex === toIndex || Number.isNaN(fromIndex)) return;
    const [moved] = trainingStats.splice(fromIndex, 1);
    trainingStats.splice(toIndex, 0, moved);
    renderTrainingList();
  });

  return row;
}

function renderTrainingList() {
  const list = document.getElementById("trainingStatList");
  list.innerHTML = "";
  trainingStats.forEach((stat, index) => {
    list.appendChild(createTrainingRow(stat, index));
  });
}

const FIELD_OPTIONS = [
  { value: "EnemyType", label: PDL_FIELD_LABELS.EnemyType },
  { value: "Level", label: PDL_FIELD_LABELS.Level }
];

// Cria o controle de valor certo pro campo: dropdown fechado pra Tipo de
// Oponente (só Bots/Guerreiros são válidos), número positivo pra Nível.
function createValueControl(filter, index) {
  if (filter.field === "EnemyType") {
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione...";
    select.appendChild(placeholder);
    ENEMY_TYPE_OPTIONS.forEach((opt) => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      select.appendChild(optionEl);
    });
    select.value = filter.value || "";
    select.addEventListener("change", () => {
      pdlFilters[index].value = select.value;
    });
    return select;
  }

  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.step = "1";
  input.placeholder = "Ex: 5";
  input.value = filter.value || "";
  input.addEventListener("input", () => {
    const n = Math.max(1, parseInt(input.value, 10) || 0);
    pdlFilters[index].value = n > 0 ? String(n) : "";
  });
  return input;
}

function createFilterRow(filter, index) {
  const row = document.createElement("div");
  row.className = "filter-row";
  row.draggable = true;
  row.dataset.index = index;

  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  row.appendChild(handle);

  const select = document.createElement("select");
  FIELD_OPTIONS.forEach((opt) => {
    const optionEl = document.createElement("option");
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  });
  select.value = filter.field;
  select.addEventListener("change", () => {
    pdlFilters[index].field = select.value;
    pdlFilters[index].value = ""; // controle de valor muda de tipo, reseta
    renderFilterList();
  });
  row.appendChild(select);

  row.appendChild(createValueControl(filter, index));

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-filter-btn";
  removeBtn.textContent = "✕";
  removeBtn.disabled = pdlFilters.length <= 1;
  removeBtn.addEventListener("click", () => {
    pdlFilters.splice(index, 1);
    renderFilterList();
  });
  row.appendChild(removeBtn);

  row.addEventListener("dragstart", (e) => {
    row.classList.add("dragging");
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-over");
  });
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.classList.remove("drag-over");
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    const toIndex = index;
    if (fromIndex === toIndex || Number.isNaN(fromIndex)) return;
    const [moved] = pdlFilters.splice(fromIndex, 1);
    pdlFilters.splice(toIndex, 0, moved);
    renderFilterList();
  });

  return row;
}

function renderFilterList() {
  const list = document.getElementById("pdlFilterList");
  list.innerHTML = "";
  pdlFilters.forEach((filter, index) => {
    list.appendChild(createFilterRow(filter, index));
  });
}

document.getElementById("addFilterBtn").addEventListener("click", () => {
  pdlFilters.push({ field: "EnemyType", value: "" });
  renderFilterList();
});

function setWeekdayCheckboxes(daysOfWeek) {
  document.querySelectorAll(".workWeekdayCheckbox").forEach((cb) => {
    cb.checked = daysOfWeek.includes(Number(cb.value));
  });
}

function getWeekdayCheckboxes() {
  return Array.from(document.querySelectorAll(".workWeekdayCheckbox:checked")).map((cb) =>
    Number(cb.value)
  );
}

function renderScheduleTimesList(times) {
  const container = document.getElementById("workScheduleTimesList");
  container.innerHTML = "";
  times.forEach((time, i) => {
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = `Execução ${i + 1}`;
    const input = document.createElement("input");
    input.type = "time";
    input.value = time;
    input.className = "workScheduleTimeInput";
    label.appendChild(span);
    label.appendChild(input);
    container.appendChild(label);
  });
}

function updateScheduleTimesCount(count) {
  const currentTimes = Array.from(document.querySelectorAll(".workScheduleTimeInput")).map(
    (i) => i.value
  );
  const times = [];
  for (let i = 0; i < count; i++) {
    times.push(currentTimes[i] || "22:00");
  }
  renderScheduleTimesList(times);
}

function updateWeekdaysVisibility() {
  const isWeekly = document.getElementById("workScheduleRepeat").value === "weekly";
  document.getElementById("workScheduleWeekdaysRow").style.display = isWeekly ? "flex" : "none";
}

document.getElementById("workScheduleRepeat").addEventListener("change", updateWeekdaysVisibility);

document.getElementById("workScheduleCount").addEventListener("input", (e) => {
  const count = Math.max(1, Math.min(12, Number(e.target.value) || 1));
  updateScheduleTimesCount(count);
});

async function load() {
  config = await bwaGetConfig();
  document.getElementById("pdbRegion").value = config.pdb.targetRegion;
  document.getElementById("pdbCreature").value = config.pdb.targetCreature;

  pdlFilters = (config.pdl.filters || []).map((f) => ({ ...f }));
  if (pdlFilters.length === 0) {
    pdlFilters.push({ field: "EnemyType", value: "Bots" });
  }
  renderFilterList();

  document.getElementById("workEnabled").checked = config.work.enabled;
  document.getElementById("workDuration").value = config.work.durationHours;

  const schedule = config.work.schedule;
  document.getElementById("workScheduleEnabled").checked = schedule.enabled;
  document.getElementById("workScheduleRepeat").value = schedule.repeat;
  setWeekdayCheckboxes(schedule.daysOfWeek || []);
  const times = schedule.times && schedule.times.length ? schedule.times : ["22:00"];
  document.getElementById("workScheduleCount").value = times.length;
  renderScheduleTimesList(times);
  updateWeekdaysVisibility();

  document.getElementById("safetyEnabled").checked = config.safety.enabled;
  document.getElementById("safetyMinGold").value = config.safety.minGoldReserve;
  document.getElementById("safetyPotionTier").value = config.safety.potionTier;
  document.getElementById("safetyKeepStock").value = config.safety.keepInStock;
  document.getElementById("safetyHpThreshold").value = config.safety.hpThresholdPercent;

  document.getElementById("trainingEnabled").checked = config.training.enabled;
  document.getElementById("trainingMinGold").value = config.training.minGoldReserve;
  trainingStats = (config.training.stats || []).map((s) => ({ ...s }));
  renderTrainingList();

  renderFlowChart(config);
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  config.pdb.targetRegion = document.getElementById("pdbRegion").value.trim();
  config.pdb.targetCreature = document.getElementById("pdbCreature").value.trim();

  config.pdl.filters = pdlFilters
    .map((f) => ({ field: f.field, value: (f.value || "").trim() }))
    .filter((f) => f.value !== "");
  if (config.pdl.filters.length === 0) {
    config.pdl.filters = [{ field: "EnemyType", value: "Bots" }];
  }
  config.pdl.activeFilterIndex = Math.min(
    config.pdl.activeFilterIndex || 0,
    config.pdl.filters.length - 1
  );

  config.work.enabled = document.getElementById("workEnabled").checked;
  config.work.durationHours = Number(document.getElementById("workDuration").value) || 1;
  const repeat = document.getElementById("workScheduleRepeat").value;
  const scheduleTimes = Array.from(document.querySelectorAll(".workScheduleTimeInput"))
    .map((i) => i.value)
    .filter(Boolean);

  config.work.schedule = {
    ...config.work.schedule,
    enabled: document.getElementById("workScheduleEnabled").checked,
    repeat,
    daysOfWeek: getWeekdayCheckboxes(),
    times: scheduleTimes.length ? scheduleTimes : ["22:00"]
  };

  config.safety.enabled = document.getElementById("safetyEnabled").checked;
  config.safety.minGoldReserve = Math.max(0, Number(document.getElementById("safetyMinGold").value) || 0);
  config.safety.potionTier = document.getElementById("safetyPotionTier").value;
  config.safety.keepInStock = Math.max(0, Number(document.getElementById("safetyKeepStock").value) || 0);
  config.safety.hpThresholdPercent = Math.min(
    99,
    Math.max(1, Number(document.getElementById("safetyHpThreshold").value) || 50)
  );

  config.training.enabled = document.getElementById("trainingEnabled").checked;
  config.training.minGoldReserve = Math.max(0, Number(document.getElementById("trainingMinGold").value) || 0);
  config.training.stats = trainingStats.map((s) => ({ ...s }));

  await bwaSetConfig(config);

  pdlFilters = config.pdl.filters.map((f) => ({ ...f }));
  renderFilterList();
  trainingStats = config.training.stats.map((s) => ({ ...s }));
  renderTrainingList();
  renderFlowChart(config);

  const msg = document.getElementById("savedMsg");
  msg.textContent = "Salvo ✓";
  setTimeout(() => (msg.textContent = ""), 2000);
});

const HISTORY_TYPE_LABELS = {
  pdl: "Batalha",
  pdb: "Criatura",
  saude: "Saúde",
  trabalho: "Trabalho",
  treino: "Treino"
};

function formatHistoryEntry(entry) {
  const typeLabel = HISTORY_TYPE_LABELS[entry.type] || entry.type;
  const outcomeText =
    entry.outcome === "vitoria" ? "Vitória" : entry.outcome === "derrota" ? "Derrota" : null;
  const ok = entry.outcome ? entry.outcome === "vitoria" : entry.result === "ok";

  const parts = [];
  if (entry.target) parts.push(entry.target);
  if (outcomeText) parts.push(outcomeText);
  if (typeof entry.goldDelta === "number") {
    parts.push(`${entry.goldDelta >= 0 ? "+" : ""}${entry.goldDelta}g`);
  }
  if (parts.length === 0) parts.push(entry.result);

  const title = `${typeLabel} — ${parts.join(" · ")}`;
  const sub = !outcomeText && entry.result && entry.result !== "ok" ? entry.result : "";
  const time = new Date(entry.time).toLocaleString("pt-BR");

  return { title, sub, time, ok };
}

async function renderHistory() {
  const log = await bwaGetLog();
  const countEl = document.getElementById("historyCount");
  const listEl = document.getElementById("historyList");

  countEl.textContent = `${log.length} registro${log.length === 1 ? "" : "s"}`;

  if (log.length === 0) {
    listEl.innerHTML = '<div class="history-empty">Nenhuma ação registrada ainda.</div>';
    return;
  }

  listEl.innerHTML = log
    .map((entry) => {
      const { title, sub, time, ok } = formatHistoryEntry(entry);
      return `<div class="history-row ${ok ? "ok" : "bad"}">
        <div class="history-main">
          <div class="history-title">${bwaEscapeHtml(title)}</div>
          ${sub ? `<div class="history-sub">${bwaEscapeHtml(sub)}</div>` : ""}
        </div>
        <div class="history-time">${bwaEscapeHtml(time)}</div>
      </div>`;
    })
    .join("");
}

document.getElementById("historyRefreshBtn").addEventListener("click", renderHistory);
document.getElementById("historyClearBtn").addEventListener("click", async () => {
  if (!confirm("Limpar todo o histórico? Essa ação não pode ser desfeita.")) return;
  await bwaClearLog();
  await renderHistory();
});

// ---------- Abas ----------

function activateTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  if (btn) btn.classList.add("active");
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.add("active");
  if (name === "reports") setTimeout(renderReports, 0);
}

function activateTabFromHash() {
  const hash = window.location.hash.slice(1);
  const valid = ["home", "flow", "battles", "dev", "health", "history", "reports"];
  if (valid.includes(hash)) activateTab(hash);
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

// ---------- Home ----------

async function renderHome() {
  const overview = await bwaGetOverview();

  const avatarEl = document.getElementById("homeAvatar");
  const nameEl = document.getElementById("homeName");
  const levelEl = document.getElementById("homeLevel");
  const updatedEl = document.getElementById("homeUpdatedAt");
  const xpEl = document.getElementById("homeXP");
  const xpBarEl = document.getElementById("homeXPBar");
  const hpEl = document.getElementById("homeHP");
  const hpBarEl = document.getElementById("homeHPBar");
  const goldEl = document.getElementById("homeGold");
  const pdbEl = document.getElementById("homePDB");
  const pdlEl = document.getElementById("homePDL");

  if (!overview) {
    nameEl.textContent = "—";
    levelEl.textContent = "Nível —";
    updatedEl.textContent = "Sem dados ainda — abra o jogo com a extensão ativa.";
    avatarEl.style.visibility = "hidden";
    xpEl.textContent = "—";
    hpEl.textContent = "—";
    goldEl.textContent = "—";
    pdbEl.textContent = "—";
    pdlEl.textContent = "—";
    return;
  }

  if (overview.avatarUrl) {
    avatarEl.src = overview.avatarUrl;
    avatarEl.style.visibility = "visible";
  } else {
    avatarEl.style.visibility = "hidden";
  }

  nameEl.textContent = overview.name || "—";
  levelEl.textContent = overview.level ? `Nível ${overview.level}` : "Nível —";
  updatedEl.textContent = overview.updatedAt
    ? `Atualizado em ${new Date(overview.updatedAt).toLocaleString("pt-BR")}`
    : "Sem dados ainda";

  xpEl.textContent = overview.xp ? `${overview.xp.current}/${overview.xp.max}` : "—";
  xpBarEl.style.width = overview.xp ? `${(overview.xp.current / overview.xp.max) * 100}%` : "0%";

  hpEl.textContent = overview.hp ? `${overview.hp.current}/${overview.hp.max}` : "—";
  hpBarEl.style.width = overview.hp ? `${(overview.hp.current / overview.hp.max) * 100}%` : "0%";

  goldEl.textContent = typeof overview.gold === "number" ? overview.gold.toLocaleString("pt-BR") : "—";
  pdbEl.textContent = overview.pdbSlots ? `${overview.pdbSlots.current}/${overview.pdbSlots.max}` : "—";
  pdlEl.textContent = overview.pdlSlots ? `${overview.pdlSlots.current}/${overview.pdlSlots.max}` : "—";
}

document.getElementById("homeRefreshBtn").addEventListener("click", renderHome);

// ---------- Fluxo Real ----------

const FLOW_STEPS_DEF = [
  {
    icon: "❤",
    title: "Saúde e Segurança",
    desc: "A cada ciclo, checa a vida — se cair abaixo do limite, usa poção do estoque ou compra uma nova.",
    isActive: (cfg) => cfg.safety.enabled
  },
  {
    icon: "💼",
    title: "Trabalho",
    desc: "Se já estiver trabalhando (ou a rotina disparar agora), continua/inicia o trabalho.",
    isActive: (cfg) => cfg.work.enabled || cfg.work.schedule.enabled,
    decision: "◇ Trabalho está ativo agora? Se sim, pula Batalhas/Criaturas/Treino neste ciclo."
  },
  {
    icon: "⚔",
    title: "Batalhas (PDL)",
    desc: "Aplica o primeiro filtro da lista que achar alvo e ataca.",
    isActive: (cfg) => cfg.pdl.enabled,
    decision: "◇ Só ataca se houver slot de batalha disponível."
  },
  {
    icon: "🌿",
    title: "Criaturas (PDB)",
    desc: "Entra na região configurada e ataca a criatura alvo.",
    isActive: (cfg) => cfg.pdb.enabled,
    decision: "◇ Só ataca se houver slot de criatura disponível."
  },
  {
    icon: "🏋",
    title: "Treinamento",
    desc: "Compra os atributos marcados, na ordem de prioridade, enquanto sobrar gold acima da reserva mínima.",
    isActive: (cfg) => cfg.training.enabled
  }
];

function renderFlowChart(cfg) {
  const container = document.getElementById("flowChart");
  const activeSteps = FLOW_STEPS_DEF.filter((s) => s.isActive(cfg));

  if (activeSteps.length === 0) {
    container.innerHTML =
      '<div class="flow-empty">Nenhuma automação ativa agora — ligue algo em Lutas, Desenvolvimento ou Saúde pra ver o fluxo aqui.</div>';
    return;
  }

  container.innerHTML = activeSteps
    .map((step, i) => {
      const isLast = i === activeSteps.length - 1;
      const node = `<div class="flow-node">
        <div class="flow-icon">${step.icon}</div>
        <div class="flow-body">
          <div class="flow-title">${bwaEscapeHtml(step.title)}</div>
          <div class="flow-desc">${bwaEscapeHtml(step.desc)}</div>
          ${step.decision ? `<div class="flow-decision">${bwaEscapeHtml(step.decision)}</div>` : ""}
        </div>
      </div>`;
      return isLast ? node : `${node}<div class="flow-arrow">↓</div>`;
    })
    .join("");
}

document.getElementById("reportsRefreshBtn").addEventListener("click", () => renderReports());

load();
renderHistory();
renderHome();
activateTabFromHash();
setInterval(renderHome, 5000);
