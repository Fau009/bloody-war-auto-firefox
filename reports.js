// reports.js — Aba de Relatórios e Análise (Bloody War Auto)

// ── Paleta (espelha o tema escuro do options.css) ─────────────────────────
const RCC = {
  bg:     '#201A14',
  border: '#3A3126',
  text:   '#E9E1D2',
  muted:  '#948970',
  green:  '#7C9A63',
  orange: '#C1633A',
  red:    '#B4423B',
  gold:   '#C9A468',
  blue:   '#5B8DB8',
  purple: '#8B68B8',
  teal:   '#4EA89A',
};

// ── Infra de canvas ───────────────────────────────────────────────────────

function rSetup(canvas) {
  const parent = canvas.parentElement;
  const w = parent.clientWidth || 500;
  const h = parseInt(canvas.dataset.h) || 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

function rEmpty(ctx, w, h, msg = 'Sem dados') {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = RCC.muted;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, w / 2, h / 2);
}

// ── Donut ─────────────────────────────────────────────────────────────────

function rDonut(canvas, segments) {
  const { ctx, w, h } = rSetup(canvas);
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (!total) { rEmpty(ctx, w, h); return; }

  const legendH = 34;
  const drawH   = h - legendH;
  const cx = w / 2, cy = drawH / 2;
  const r  = Math.min(cx, cy) * 0.8;
  const ir = r * 0.52;

  let angle = -Math.PI / 2;
  segments.forEach(s => {
    const sweep = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.fillStyle = s.color;
    ctx.fill();
    angle += sweep;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, ir, 0, Math.PI * 2);
  ctx.fillStyle = RCC.bg;
  ctx.fill();

  ctx.fillStyle = RCC.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(14, Math.floor(r * 0.28))}px sans-serif`;
  ctx.fillText(total, cx, cy - 7);
  ctx.fillStyle = RCC.muted;
  ctx.font = `${Math.max(9, Math.floor(r * 0.16))}px sans-serif`;
  ctx.fillText('total', cx, cy + 9);

  const lBaseY  = drawH + 6;
  const itemW   = w / segments.length;
  segments.forEach((s, i) => {
    const lx = i * itemW + 8;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.roundRect(lx, lBaseY + 1, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = RCC.muted;
    ctx.font = '9.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const pct = Math.round(s.value / total * 100);
    ctx.fillText(`${s.label}: ${s.value} (${pct}%)`, lx + 13, lBaseY + 1);
  });
}

// ── Barras verticais ──────────────────────────────────────────────────────

function rBar(canvas, labels, values, colors, opts = {}) {
  const { ctx, w, h } = rSetup(canvas);
  const rawMax = Math.max(...values);
  const max = opts.max !== undefined ? opts.max : (rawMax > 0 ? rawMax : 1);
  const fmt = opts.fmt || (v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));
  const pad = { t: 22, b: 30, l: 40, r: 10 };
  const cw  = w - pad.l - pad.r;
  const ch  = h - pad.t - pad.b;
  const n   = labels.length;
  const slot = cw / n;
  const barW = Math.min(36, Math.max(4, slot * 0.65));

  [0, 0.5, 1].forEach(f => {
    const y   = pad.t + ch * (1 - f);
    const val = max * f;
    ctx.strokeStyle = RCC.border; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = RCC.muted; ctx.font = '9px sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val), pad.l - 4, y);
  });

  labels.forEach((label, i) => {
    const v  = values[i] || 0;
    const bh = max > 0 ? (v / max) * ch : 0;
    const x  = pad.l + i * slot + slot / 2 - barW / 2;
    const y  = pad.t + ch - bh;
    const c  = Array.isArray(colors) ? colors[i] : (colors || RCC.green);

    if (bh > 0) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, bh, [3, 3, 0, 0]);
      ctx.fill();
    }

    if (v > 0 && bh >= 14) {
      ctx.fillStyle = RCC.text; ctx.font = '9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(fmt(v), x + barW / 2, y - 1);
    }

    ctx.fillStyle = RCC.muted; ctx.font = '9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(label, x + barW / 2, pad.t + ch + 5);
  });
}

// ── Barras horizontais ────────────────────────────────────────────────────

function rHBar(canvas, labels, values, colors) {
  const { ctx, w, h } = rSetup(canvas);
  if (!labels.length) { rEmpty(ctx, w, h); return; }

  const max  = Math.max(...values, 1);
  const padL = Math.min(160, Math.max(...labels.map(l => l.length)) * 6.5 + 12);
  const padR = 40;
  const cw   = w - padL - padR;
  const rowH = h / labels.length;

  labels.forEach((label, i) => {
    const v  = values[i] || 0;
    const bw = (v / max) * cw;
    const y  = i * rowH;
    const bH = Math.min(rowH * 0.5, 22);
    const bY = y + (rowH - bH) / 2;
    const c  = Array.isArray(colors) ? colors[i] : (colors || RCC.green);

    ctx.fillStyle = RCC.muted; ctx.font = '10px sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const lbl = label.length > 20 ? label.slice(0, 19) + '…' : label;
    ctx.fillText(lbl, padL - 6, y + rowH / 2);

    ctx.fillStyle = RCC.border;
    ctx.beginPath(); ctx.roundRect(padL, bY, cw, bH, 3); ctx.fill();

    if (bw > 0) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.roundRect(padL, bY, bw, bH, 3); ctx.fill();
    }

    ctx.fillStyle = RCC.text; ctx.font = '10px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v, padL + bw + 5, y + rowH / 2);
  });
}

// ── Linha / área ──────────────────────────────────────────────────────────

function rLine(canvas, labels, values, color, opts = {}) {
  const { ctx, w, h } = rSetup(canvas);
  if (!values.length) { rEmpty(ctx, w, h); return; }

  const min   = opts.zeroBase ? 0 : Math.min(...values);
  const max   = Math.max(...values, min + 1);
  const range = max - min || 1;
  const pad   = { t: 22, b: 28, l: 54, r: 14 };
  const cw    = w - pad.l - pad.r;
  const ch    = h - pad.t - pad.b;

  const toX = i => pad.l + (values.length > 1 ? (i / (values.length - 1)) * cw : cw / 2);
  const toY = v => pad.t + ch - ((v - min) / range) * ch;

  [0, 0.5, 1].forEach(f => {
    const val = min + range * f;
    const y   = toY(val);
    ctx.strokeStyle = RCC.border; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = RCC.muted; ctx.font = '9px sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const lbl = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val);
    ctx.fillText(lbl, pad.l - 4, y);
  });

  ctx.beginPath();
  values.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
  ctx.lineTo(toX(values.length - 1), toY(min));
  ctx.lineTo(pad.l, toY(min));
  ctx.closePath();
  ctx.fillStyle = color + '22'; ctx.fill();

  ctx.beginPath();
  values.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  const step = Math.max(1, Math.floor(labels.length / 8));
  ctx.fillStyle = RCC.muted; ctx.font = '9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  labels.forEach((l, i) => {
    if (i % step === 0 || i === labels.length - 1) ctx.fillText(l, toX(i), pad.t + ch + 5);
  });
}

// ── Análise de dados ──────────────────────────────────────────────────────

async function getReportData() {
  const log = await bwaGetLog();
  const byType     = { pdl: 0, pdb: 0, saude: 0, trabalho: 0, treino: 0 };
  const wins       = { pdl: 0, pdb: 0 };
  const losses     = { pdl: 0, pdb: 0 };
  let goldGained   = 0, goldSpent = 0;
  const byHour     = Array(24).fill(0);
  const byDow      = Array(7).fill(0);
  const goldByHour = Array(24).fill(0);
  const winByHour  = Array(24).fill(0);
  const loseByHour = Array(24).fill(0);
  const targetCount = {};
  const goldTimeline = [];
  let cumGold = 0;
  let pdlGoldTotal = 0, pdlGoldCount = 0;
  let pdbGoldTotal = 0, pdbGoldCount = 0;

  const sorted = [...log].sort((a, b) => a.time - b.time);

  sorted.forEach(e => {
    const t = e.type;
    if (t in byType) byType[t]++;
    const d   = new Date(e.time);
    const hr  = d.getHours();
    const dow = d.getDay();
    byHour[hr]++;
    byDow[dow]++;

    if (e.outcome === 'vitoria')  { wins[t]   = (wins[t]   || 0) + 1; winByHour[hr]++;  }
    if (e.outcome === 'derrota')  { losses[t] = (losses[t] || 0) + 1; loseByHour[hr]++; }

    if (typeof e.goldDelta === 'number') {
      if (e.goldDelta > 0) goldGained += e.goldDelta;
      else                 goldSpent  += Math.abs(e.goldDelta);
      goldByHour[hr] += e.goldDelta;
      cumGold        += e.goldDelta;
      goldTimeline.push({ time: e.time, gold: cumGold });
      if (t === 'pdl') { pdlGoldTotal += e.goldDelta; pdlGoldCount++; }
      if (t === 'pdb') { pdbGoldTotal += e.goldDelta; pdbGoldCount++; }
    }

    if (e.target && (t === 'pdl' || t === 'pdb')) {
      targetCount[e.target] = (targetCount[e.target] || 0) + 1;
    }
  });

  const totalWins    = (wins.pdl || 0) + (wins.pdb || 0);
  const totalLosses  = (losses.pdl || 0) + (losses.pdb || 0);
  const totalBattles = totalWins + totalLosses;
  const avgGoldPdl   = pdlGoldCount > 0 ? Math.round(pdlGoldTotal / pdlGoldCount) : 0;
  const avgGoldPdb   = pdbGoldCount > 0 ? Math.round(pdbGoldTotal / pdbGoldCount) : 0;

  return {
    log, byType, wins, losses,
    goldGained, goldSpent, netGold: goldGained - goldSpent,
    byHour, byDow, goldByHour, winByHour, loseByHour,
    goldTimeline, avgGoldPdl, avgGoldPdb,
    totalWins, totalLosses, totalBattles,
    winRate: totalBattles > 0 ? Math.round(totalWins / totalBattles * 100) : 0,
    wrPdl: (wins.pdl + (losses.pdl || 0)) > 0
      ? Math.round(wins.pdl / (wins.pdl + (losses.pdl || 0)) * 100) : 0,
    wrPdb: (wins.pdb + (losses.pdb || 0)) > 0
      ? Math.round(wins.pdb / (wins.pdb + (losses.pdb || 0)) * 100) : 0,
  };
}

function fmtG(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
}

// ── Render principal ──────────────────────────────────────────────────────

async function renderReports() {
  const d = await getReportData();

  document.getElementById('reportsCount').textContent =
    `${d.log.length} registro${d.log.length !== 1 ? 's' : ''}`;

  // ── KPI cards
  const totalActions = Object.values(d.byType).reduce((s, v) => s + v, 0);
  document.getElementById('kpiTotal').textContent = totalActions;

  const kpiWR = document.getElementById('kpiWinRate');
  kpiWR.textContent = d.totalBattles ? `${d.winRate}%` : '—';
  kpiWR.className   = `kpi-value ${d.winRate >= 50 ? 'green' : 'red'}`;

  document.getElementById('kpiBattles').textContent =
    `${d.byType.pdl} PDL · ${d.byType.pdb} PDB`;
  document.getElementById('kpiGoldGained').textContent =
    d.goldGained ? `+${fmtG(d.goldGained)} g` : '—';
  document.getElementById('kpiGoldSpent').textContent =
    d.goldSpent ? `-${fmtG(d.goldSpent)} g` : '—';

  const kpiNet = document.getElementById('kpiNetGold');
  kpiNet.textContent = d.netGold !== 0
    ? `${d.netGold >= 0 ? '+' : ''}${fmtG(d.netGold)} g` : '—';
  kpiNet.className = `kpi-value ${d.netGold >= 0 ? 'green' : 'red'}`;

  document.getElementById('kpiWins').textContent = d.totalWins;
  document.getElementById('kpiLosses').textContent = d.totalLosses;
  document.getElementById('kpiPotions').textContent = d.byType.saude;
  document.getElementById('kpiTrains').textContent  = d.byType.treino;

  // ── Chart 1 — Vitórias vs Derrotas (donut)
  rDonut(document.getElementById('chartWinLoss'), [
    { label: 'Vitórias', value: d.totalWins,   color: RCC.green  },
    { label: 'Derrotas', value: d.totalLosses, color: RCC.red    },
  ]);

  // ── Chart 2 — PDL vs PDB (donut)
  rDonut(document.getElementById('chartPdlPdb'), [
    { label: 'Batalhas PDL', value: d.byType.pdl, color: RCC.orange },
    { label: 'Criaturas PDB', value: d.byType.pdb, color: RCC.teal  },
  ]);

  // ── Chart 3 — Distribuição geral por tipo (donut)
  rDonut(document.getElementById('chartTypeDonut'), [
    { label: 'PDL',      value: d.byType.pdl,      color: RCC.orange },
    { label: 'PDB',      value: d.byType.pdb,      color: RCC.teal   },
    { label: 'Saúde',    value: d.byType.saude,    color: RCC.red    },
    { label: 'Trabalho', value: d.byType.trabalho, color: RCC.gold   },
    { label: 'Treino',   value: d.byType.treino,   color: RCC.purple },
  ]);

  // ── Chart 4 — Ações por hora do dia (barra, full-width)
  const hours = Array.from({ length: 24 }, (_, i) => `${i}h`);
  rBar(document.getElementById('chartByHour'), hours, d.byHour,
    d.byHour.map((_, i) => (i >= 6 && i < 18 ? RCC.gold : RCC.orange)));

  // ── Chart 5 — Evolução do gold ao longo do tempo (linha, full-width)
  const c5 = document.getElementById('chartGoldOverTime');
  if (d.goldTimeline.length > 1) {
    const tl   = d.goldTimeline;
    const step = Math.max(1, Math.floor(tl.length / 80));
    const pts  = tl.filter((_, i) => i % step === 0 || i === tl.length - 1);
    rLine(c5,
      pts.map(p => new Date(p.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
      pts.map(p => p.gold),
      RCC.gold, { zeroBase: false });
  } else {
    const { ctx, w, h } = rSetup(c5);
    rEmpty(ctx, w, h, 'Sem dados de gold ainda');
  }

  // ── Chart 6 — Gold por hora do dia (barra, full-width)
  rBar(document.getElementById('chartGoldByHour'), hours,
    d.goldByHour.map(Math.abs),
    d.goldByHour.map(v => v >= 0 ? RCC.gold : RCC.red));

  // ── Chart 7 — Ações por dia da semana
  rBar(document.getElementById('chartByDow'),
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    d.byDow,
    d.byDow.map((_, i) => (i === 0 || i === 6 ? RCC.muted : RCC.blue)));

  // ── Chart 8 — Taxa de vitória PDL vs PDB (%)
  rBar(document.getElementById('chartWinRate'),
    ['PDL', 'PDB'],
    [d.wrPdl, d.wrPdb],
    [RCC.orange, RCC.teal],
    { max: 100, fmt: v => v + '%' });

  // ── Chart 9 — Gold médio por combate (PDL vs PDB)
  rBar(document.getElementById('chartAvgGold'),
    ['PDL (Batalhas)', 'PDB (Criaturas)'],
    [Math.max(0, d.avgGoldPdl), Math.max(0, d.avgGoldPdb)],
    [RCC.orange, RCC.teal],
    { fmt: v => fmtG(v) + ' g' });

  // ── Sessões
  renderSessions(computeSessions(d.log));
}

// ── Histórico de Sessões ──────────────────────────────────────────────────

function computeSessions(log) {
  if (!log.length) return [];
  const sorted = [...log].sort((a, b) => a.time - b.time);

  const hasMarkers = sorted.some(
    e => e.type === 'sistema' && (e.result === 'ativo' || e.result === 'inativo')
  );

  if (!hasMarkers) {
    // Fallback para dados antigos: agrupa por pausa de 30 min
    const GAP_MS = 30 * 60 * 1000;
    const sessions = [];
    let cur = { start: sorted[0].time, end: sorted[0].time, count: 0, entries: [], active: false };
    for (const e of sorted) {
      if (cur.count > 0 && e.time - cur.end > GAP_MS) {
        sessions.push(cur);
        cur = { start: e.time, end: e.time, count: 0, entries: [], active: false };
      }
      cur.end = e.time;
      cur.count++;
      if (e.type !== 'sistema') cur.entries.push(e);
    }
    sessions.push(cur);
    return sessions.reverse();
  }

  // Baseado em marcos de ativação/desativação
  const sessions = [];
  let sessionStart = null;
  let entries = [];

  for (const e of sorted) {
    if (e.type === 'sistema' && e.result === 'ativo') {
      sessionStart = e.time;
      entries = [];
    } else if (e.type === 'sistema' && e.result === 'inativo') {
      if (sessionStart !== null) {
        sessions.push({ start: sessionStart, end: e.time, entries, active: false });
        sessionStart = null;
        entries = [];
      }
    } else if (sessionStart !== null) {
      entries.push(e);
    }
  }

  // Sessão ainda ativa (sem evento de desativação)
  if (sessionStart !== null) {
    const lastTime = entries.length > 0 ? entries[entries.length - 1].time : sessionStart;
    sessions.push({ start: sessionStart, end: lastTime, entries, active: true });
  }

  return sessions.map(s => ({ ...s, count: s.entries.length })).reverse();
}

function renderSessions(sessions) {
  const el = document.getElementById('sessionList');
  if (!el) return;
  if (!sessions.length) {
    el.innerHTML = '<div class="session-empty">Nenhuma sessão registrada. Ative o sistema para iniciar o registro de sessões.</div>';
    return;
  }

  function fmtDT(ts) {
    return new Date(ts).toLocaleString('pt-BR', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
  function fmtT(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDur(a, b) {
    const diff = Math.max(0, Math.round((b - a) / 60000));
    if (diff < 60) return `${diff}min`;
    const h = Math.floor(diff / 60), m = diff % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  function sessionStats(entries) {
    const c = { pdl: 0, pdb: 0, treino: 0, saude: 0, trabalho: 0 };
    let wins = 0, losses = 0, gold = 0;
    (entries || []).forEach(e => {
      if (e.type in c && e.result === 'ok') c[e.type]++;
      if (e.outcome === 'vitoria') wins++;
      if (e.outcome === 'derrota') losses++;
      if (typeof e.goldDelta === 'number') gold += e.goldDelta;
    });
    return { ...c, wins, losses, gold };
  }

  el.innerHTML = sessions.map((s, i) => {
    const num     = sessions.length - i;
    const sameDay = new Date(s.start).toDateString() === new Date(s.end).toDateString();
    const endStr  = s.active
      ? '<span class="session-badge">Em curso</span>'
      : `encerrada ${sameDay
          ? `às <strong>${fmtT(s.end)}</strong>`
          : `em <strong>${fmtDT(s.end)}</strong>`}`;

    const st = sessionStats(s.entries);

    // Linha de contagem por tipo
    const typeItems = [
      st.pdl      && `<span class="ss-tag ss-bat">⚔ ${st.pdl} batalha${st.pdl !== 1 ? 's' : ''}</span>`,
      st.pdb      && `<span class="ss-tag ss-nat">🌿 ${st.pdb} criatura${st.pdb !== 1 ? 's' : ''}</span>`,
      st.treino   && `<span class="ss-tag ss-trn">🏋 ${st.treino} treino${st.treino !== 1 ? 's' : ''}</span>`,
      st.saude    && `<span class="ss-tag ss-hp">❤ ${st.saude} poção${st.saude !== 1 ? 'ões' : ''}</span>`,
      st.trabalho && `<span class="ss-tag ss-wrk">💼 ${st.trabalho} trabalho${st.trabalho !== 1 ? 's' : ''}</span>`,
    ].filter(Boolean);

    // Linha de resultado: vitórias, derrotas, gold
    const resultItems = [
      (st.wins + st.losses) > 0 &&
        `<span class="ss-win">${st.wins}V</span> <span class="ss-loss">${st.losses}D</span>`,
      st.gold !== 0 &&
        `<span class="${st.gold >= 0 ? 'ss-gold' : 'ss-loss'}">${st.gold >= 0 ? '+' : ''}${fmtG(st.gold)} g</span>`,
    ].filter(Boolean);

    const typeLine   = typeItems.length   ? `<div class="session-types">${typeItems.join('')}</div>`     : '';
    const resultLine = resultItems.length ? `<div class="session-stats">${resultItems.join(' · ')}</div>` : '';

    return `<div class="session-item${s.active ? ' session-active' : ''}">
      <div class="session-num">#${num}</div>
      <div class="session-info">
        <div class="session-date">${fmtDT(s.start)}</div>
        <div class="session-times">
          Iniciada às <strong>${fmtT(s.start)}</strong>
          — ${endStr}
          · <span class="session-dur">${fmtDur(s.start, s.end)}</span>
        </div>
        ${typeLine}
        ${resultLine}
      </div>
      <div class="session-count">${s.count} ações</div>
    </div>`;
  }).join('');
}
