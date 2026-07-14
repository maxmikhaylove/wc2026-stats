/* Тотализатор ЧМ-2026 — рендер из stats.json */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function ptsChip(p) {
    if (p === null || p === undefined) return '<span class="pts-chip p0">·</span>';
    const cls = p === 3 ? "p3" : p === 2 ? "p2" : p === 1 ? "p1" : p <= -1 ? "pn" : "p0";
    const sign = p > 0 ? "+" + p : String(p);
    return `<span class="pts-chip ${cls}">${sign}</span>`;
  }

  function renderTable(data) {
    const wrap = el("div", "board glass");
    if (!data.participants || !data.participants.length) {
      wrap.appendChild(el("div", "empty-state", "Пока нет участников."));
      return wrap;
    }
    data.participants.forEach((p) => {
      const top = p.rank === 1 ? "top1" : p.rank === 2 ? "top2" : p.rank === 3 ? "top3" : "";
      const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : p.rank;
      const row = el("div", `lrow ${top}`);
      row.innerHTML =
        `<div class="rank">${medal}</div>` +
        `<div class="who">${esc(p.name)}</div>` +
        `<div class="pts">${p.total}</div>`;
      wrap.appendChild(row);
    });
    return wrap;
  }

  function renderDaysFirst(data) {
    const rows = data.days_first || [];
    if (!rows.length) return null;
    const wrap = el("div");
    wrap.appendChild(el("h2", "group-title", "👑 Дней на 1-м месте"));
    const board = el("div", "board glass");
    rows.forEach((r, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
      const row = el("div", `lrow ${i === 0 ? "top1" : ""}`);
      row.innerHTML =
        `<div class="rank">${medal}</div>` +
        `<div class="who">${esc(r.name)}</div>` +
        `<div class="pts">${r.days}</div>`;
      board.appendChild(row);
    });
    wrap.appendChild(board);
    return wrap;
  }

  function matchCard(m) {
    const card = el("article", "match glass");

    let stateChip, stateCls;
    if (m.finished) { stateChip = "Сыграл"; stateCls = "done"; }
    else if (m.started) { stateChip = "Идёт"; stateCls = "live"; }
    else { stateChip = "Приём открыт"; stateCls = "soon"; }

    const stage = [m.stage, m.group].filter(Boolean).join(" ");
    const top = el("div", "match-top");
    top.innerHTML =
      `<span class="chip ${stateCls}">${stateChip}</span>` +
      (stage ? `<span class="chip">${esc(stage)}</span>` : "") +
      `<span class="chip">№${m.match_no}</span>` +
      `<span class="match-time">${esc(m.kickoff_msk)} МСК</span>`;
    card.appendChild(top);

    const scoreHtml = m.score
      ? `<div class="score">${m.score.home}:${m.score.away}</div>`
      : `<div class="score empty">vs</div>`;
    const teams = el("div", "teams");
    teams.innerHTML =
      `<div class="team home">${esc(m.home)}</div>` + scoreHtml +
      `<div class="team away">${esc(m.away)}</div>`;
    card.appendChild(teams);

    if (!m.started) {
      card.appendChild(el("div", "bets-hidden", "🔒 Ставки скрыты до начала матча"));
    } else if (!m.bets || !m.bets.length) {
      card.appendChild(el("div", "bets-hidden", "Никто не поставил на этот матч"));
    } else {
      const bets = el("div", "bets");
      m.bets.forEach((b) => {
        const row = el("div", "bet");
        row.innerHTML =
          `<span class="bname">${esc(b.name)}</span>` +
          `<span class="bpred">${b.ph}:${b.pa}</span>` +
          ptsChip(b.points);
        bets.appendChild(row);
      });
      card.appendChild(bets);
    }
    return card;
  }

  function renderMatches(data) {
    const wrap = el("div");
    const ms = data.matches || [];
    if (!ms.length) {
      const e = el("div", "glass"); e.appendChild(el("div", "empty-state",
        "Расписание ещё не загружено."));
      wrap.appendChild(e); return wrap;
    }
    const live = ms.filter((m) => m.started && !m.finished);
    const soon = ms.filter((m) => !m.started).sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    const done = ms.filter((m) => m.finished).sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc));

    const groups = [["🔴 Идут сейчас", live], ["🟢 Предстоящие", soon], ["✅ Сыграно", done]];
    groups.forEach(([title, list]) => {
      if (!list.length) return;
      wrap.appendChild(el("h2", "group-title", title));
      list.forEach((m) => wrap.appendChild(matchCard(m)));
    });
    return wrap;
  }

  let _chart = null;
  function renderGraph(prog) {
    const canvas = document.getElementById("progressChart");
    const empty = document.getElementById("chart-empty");
    if (_chart) { _chart.destroy(); _chart = null; }
    const ok = prog && prog.labels && prog.labels.length && prog.series && prog.series.length;
    canvas.hidden = !ok;
    empty.hidden = ok;
    if (!ok || typeof Chart === "undefined") return;

    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const fg = dark ? "#E6E8EC" : "#1c1c1e";
    const grid = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

    const datasets = prog.series.map((s) => ({
      label: `${s.name} (${s.total >= 0 ? "+" : ""}${s.total})`,
      data: s.cumulative,
      borderColor: s.color,
      backgroundColor: s.color,
      tension: 0.3, borderWidth: 2.6,
      pointRadius: 3, pointHoverRadius: 6, pointBorderWidth: 0,
    }));

    _chart = new Chart(canvas, {
      type: "line",
      data: { labels: prog.labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { color: fg, usePointStyle: true,
                    pointStyle: "circle", padding: 14, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              title: (items) => (prog.labels_full && prog.labels_full[items[0].dataIndex]) || items[0].label,
              label: (it) => ` ${it.dataset.label.replace(/\s\([^)]*\)$/, "")}: ${it.parsed.y}`,
            },
          },
        },
        scales: {
          x: { grid: { color: grid }, ticks: { color: fg, font: { size: 12 } } },
          y: { grid: { color: grid }, ticks: { color: fg, font: { size: 12 }, precision: 0 } },
        },
      },
    });
  }

  function renderRules() {
    const wrap = el("div", "rules glass");
    wrap.innerHTML = `
      <h2>Как считаются очки</h2>
      <div class="score-table">
        <div class="sr"><span class="b p3">+3</span><span class="d">Точный счёт</span></div>
        <div class="sr"><span class="b p2">+2</span><span class="d">Угадал победителя и разницу мячей</span></div>
        <div class="sr"><span class="b p1">+1</span><span class="d">Угадал победителя (разница другая) или что будет ничья</span></div>
        <div class="sr"><span class="b p0">0</span><span class="d">Поставил ничью, а была победа — или наоборот</span></div>
        <div class="sr"><span class="b pn">−1</span><span class="d">Назвал победителем не ту команду</span></div>
      </div>
      <h2 style="margin-top:22px">Правила</h2>
      <p>• Ставим на точный счёт каждого матча через Telegram-бота.<br>
         • Приём ставки закрывается в момент начала матча (МСК). После старта ставку не изменить.<br>
         • Ставки соперников на матч раскрываются только после его начала.<br>
         • В плей-офф учитывается счёт основного времени (90 минут), без овертайма и пенальти.<br>
         • Последняя присланная ставка — финальная.</p>`;
    return wrap;
  }

  function setupTabs() {
    const btns = document.querySelectorAll(".seg-btn");
    btns.forEach((btn) => btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      $("#tab-" + btn.dataset.tab).classList.add("active");
    }));
  }

  function render(data) {
    $("#updated").textContent = "Обновлено: " + (data.updated_msk || "—") + " МСК";
    if (data.source && data.source.url) {
      const a = $("#src"); a.href = data.source.url; a.textContent = data.source.name || "API-Football";
    }
    const t = $("#tab-table"); t.innerHTML = ""; t.appendChild(renderTable(data));
    const df = renderDaysFirst(data); if (df) t.appendChild(df);
    const mt = $("#tab-matches"); mt.innerHTML = ""; mt.appendChild(renderMatches(data));
    const r = $("#tab-rules"); r.innerHTML = ""; r.appendChild(renderRules());
    renderGraph(data.progression);
  }

  async function load() {
    setupTabs();
    try {
      const res = await fetch("stats.json?_=" + Date.now());
      if (!res.ok) throw new Error("HTTP " + res.status);
      render(await res.json());
    } catch (e) {
      $("#updated").textContent = "Не удалось загрузить данные";
      $("#tab-table").innerHTML =
        '<div class="glass"><div class="empty-state">Файл stats.json ещё не сформирован.<br>' +
        "Бот создаст его после первой синхронизации.</div></div>";
      // правила доступны всегда
      const r = $("#tab-rules"); r.innerHTML = ""; r.appendChild(renderRules());
    }
  }

  document.addEventListener("DOMContentLoaded", load);
})();
