/* app.js — 화면 렌더링 & 이벤트 바인딩 (분석 로직은 analysis.js 참고) */

/* ---------------------------- 공통 유틸 ---------------------------- */
function fmt1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fillSelect(selectEl, items, { includeAll = false, allLabel = "전체" } = {}) {
  selectEl.innerHTML = "";
  if (includeAll) selectEl.innerHTML += `<option value="">${allLabel}</option>`;
  items.forEach((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    selectEl.innerHTML += `<option value="${value}">${label}</option>`;
  });
}

function resultCard(myScore, oppScore) {
  if (myScore > oppScore) return { cls: "win-text", text: "승" };
  if (myScore < oppScore) return { cls: "lose-text", text: "패" };
  return { cls: "draw-text", text: "무" };
}

/* ---------------------------- 경기 상세 모달 ---------------------------- */
function inningCells(innings, totalInnings) {
  let html = "";
  for (let i = 0; i < totalInnings; i++) {
    const val = i < innings.length ? innings[i] : "X"; // 마지막 이닝에 타석에 서지 않은 경우
    html += `<td class="${val === 0 ? "sb-zero" : val === "X" ? "sb-x" : ""}">${val}</td>`;
  }
  return html;
}

function closenessStoryLine(g) {
  if (g.isClose) return "🎯 최종 1점차 이내 접전으로 마무리된 경기입니다.";
  if (g.closeness.ratio >= 0.7)
    return `😮 ${g.closeness.lastCloseInning}회까지 1점차 접전을 유지하다 막판에 승부가 갈렸습니다.`;
  if (g.closeness.ratio <= 0.25)
    return "💨 초반부터 점수차가 크게 벌어진 경기입니다.";
  return `⚖️ ${g.closeness.lastCloseInning}회까지는 접전이었지만 이후 승부가 기울었습니다.`;
}

function buildGameDetailHTML(g) {
  const winnerIsHome = g.homeScore > g.awayScore;
  return `
    <div class="modal-header">
        <div class="modal-date">${g.date} · ${g.stadium}</div>
        <div class="modal-matchup">
            <span class="modal-team ${!winnerIsHome ? "modal-team-win" : ""}">${g.away}</span>
            <span class="modal-final-score">${g.awayScore} : ${g.homeScore}</span>
            <span class="modal-team ${winnerIsHome ? "modal-team-win" : ""}">${g.home}</span>
        </div>
        ${g.isWalkoff ? `<div class="tag tag-success" style="margin-top:0.5rem;">🎉 끝내기 승부</div>` : ""}
    </div>

    <div class="scoreboard-panel">
        <table class="scoreboard-table">
            <thead>
                <tr>
                    <th></th>
                    ${Array.from({ length: g.totalInnings }, (_, i) => `<th>${i + 1}</th>`).join("")}
                    <th class="sb-r-col">R</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="sb-team">${g.away}</td>
                    ${inningCells(g.awayInnings, g.totalInnings)}
                    <td class="sb-r-col sb-total">${g.awayScore}</td>
                </tr>
                <tr>
                    <td class="sb-team">${g.home}</td>
                    ${inningCells(g.homeInnings, g.totalInnings)}
                    <td class="sb-r-col sb-total">${g.homeScore}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <p class="modal-story">${closenessStoryLine(g)}</p>

    <div class="modal-info-grid">
        <div class="modal-info-item">
            <span class="modal-info-label">선발투수</span>
            <span class="modal-info-value">${g.away} ${g.starterAway} · ${g.home} ${g.starterHome}</span>
        </div>
        <div class="modal-info-item">
            <span class="modal-info-label">승 / 패${g.savePitcher ? " / 세" : ""}</span>
            <span class="modal-info-value">
                <span class="win-text">${g.winPitcher}</span> / <span class="lose-text">${g.losePitcher}</span>${g.savePitcher ? ` / <span class="draw-text">${g.savePitcher}</span>` : ""}
            </span>
        </div>
        <div class="modal-info-item modal-info-wide">
            <span class="modal-info-label">결승타</span>
            <span class="modal-info-value">${g.winningHit || "정보 없음"}</span>
        </div>
    </div>
  `;
}

function showGameModal(idx) {
  const g = window.KBO_GAMES[idx];
  if (!g) return;
  document.getElementById("gameModalContent").innerHTML = buildGameDetailHTML(g);
  document.getElementById("gameModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function hideGameModal() {
  document.getElementById("gameModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideGameModal();
});

/* ---------------------------- 탭 네비게이션 ---------------------------- */
const HEADER_DESC = {
  leaderboardView: "KBO 팀들의 1무(1점차 이내) 승부 랭킹을 확인하세요.",
  detailView: "두 팀 간의 역대 전적 결과를 분석합니다.",
  closenessView: "이닝별 접전 유지력을 팀별로 비교합니다.",
  starterView: "선발투수별 경기 결과 분포를 분석합니다.",
  trendView: "월별 · 팀별 1무 흐름과 최근 접전 트렌드를 확인합니다.",
  extraView: "승부처 이닝과 끝내기 승부를 살펴봅니다.",
};

function switchView(viewId) {
  document.querySelectorAll(".view-section").forEach((el) => (el.style.display = "none"));
  document.querySelectorAll(".tab-btn").forEach((el) => el.classList.toggle("active", el.dataset.view === viewId));

  const target = document.getElementById(viewId);
  target.style.display = "block";
  target.classList.remove("fade-in");
  void target.offsetWidth;
  target.classList.add("fade-in");

  document.getElementById("header-desc").innerText = HEADER_DESC[viewId] || "";
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

/* ============================================================
   1. 리더보드
   ============================================================ */
function renderLeaderboard() {
  const rows = computeLeaderboard();
  const tbody = document.getElementById("leaderboardBody");
  tbody.innerHTML = rows
    .map((ts, idx) => {
      const rankClass = idx < 3 ? `rank-${idx + 1}` : "";
      return `
        <tr class="${rankClass}">
            <td><span class="rank-badge">${idx + 1}</span></td>
            <td class="t-name">${ts.name}</td>
            <td>${ts.total}경기</td>
            <td class="highlight-num">${ts.close1}회</td>
            <td class="highlight-rate">${fmt1(ts.rate)}%</td>
        </tr>`;
    })
    .join("");
}

/* ============================================================
   2. 상대 전적
   ============================================================ */
const teamASelect = document.getElementById("teamA");
const teamBSelect = document.getElementById("teamB");
fillSelect(teamASelect, TEAMS);
fillSelect(teamBSelect, TEAMS);
teamBSelect.selectedIndex = 1;

function analyzeMatch() {
  const teamA = teamASelect.value;
  const teamB = teamBSelect.value;
  const resultDiv = document.getElementById("matchResult");

  if (teamA === teamB) {
    alert("서로 다른 두 팀을 선택해주세요!");
    return;
  }

  const { matches, stats, total } = analyzeMatchup(teamA, teamB);

  if (total === 0) {
    resultDiv.innerHTML = `<div class="no-data">조건에 맞는 경기 기록이 없습니다.</div>`;
    resultDiv.style.display = "block";
    return;
  }

  const winRate = fmt1((stats.win2Plus / total) * 100);
  const closeRate = fmt1((stats.close1 / total) * 100);
  const loseRate = fmt1((stats.lose2Plus / total) * 100);

  let html = `
    <h3 class="analysis-title">${teamA} vs ${teamB} 분석 결과</h3>
    <div class="stats-cards">
        <div class="stat-card win">
            <h3>${teamA} 2점차 이상 승</h3>
            <div class="stat-value">${stats.win2Plus}회</div>
            <div class="stat-rate">${winRate}%</div>
        </div>
        <div class="stat-card draw">
            <h3>1무 (1점차 이내)</h3>
            <div class="stat-value">${stats.close1}회</div>
            <div class="stat-rate">${closeRate}%</div>
        </div>
        <div class="stat-card lose">
            <h3>${teamA} 2점차 이상 패</h3>
            <div class="stat-value">${stats.lose2Plus}회</div>
            <div class="stat-rate">${loseRate}%</div>
        </div>
    </div>
    <div class="history-section">
        <h3>최근 맞대결 상세 (최근순)</h3>
        <div class="history-list">
  `;

  [...matches]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach((g) => {
      const isHome = g.home === teamA;
      const myScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      const r = resultCard(myScore, oppScore);
      html += `
        <div class="history-item clickable-game" onclick="showGameModal(${g._idx})" tabindex="0">
            <div class="history-date">${g.date} (${isHome ? "홈" : "원정"})</div>
            <div class="history-score">
                <div class="team-col"><span class="team-name ${myScore > oppScore ? "winner" : ""}">${teamA}</span></div>
                <span class="score-box ${r.cls}">${myScore} : ${oppScore}</span>
                <div class="team-col"><span class="team-name ${oppScore > myScore ? "winner" : ""}">${teamB}</span></div>
            </div>
            <div class="history-result ${r.cls}">${r.text}</div>
        </div>`;
    });

  html += `</div></div>`;
  resultDiv.innerHTML = html;
  resultDiv.style.display = "block";
  resultDiv.classList.remove("fade-in");
  void resultDiv.offsetWidth;
  resultDiv.classList.add("fade-in");
}

/* ============================================================
   3. 접전 유지력 (Close-Game Persistence)
   ============================================================ */
function renderClosenessLeaderboard() {
  const rows = computeCloseGamePersistence();
  const tbody = document.getElementById("closenessBody");
  tbody.innerHTML = rows
    .map((ts, idx) => {
      const rankClass = idx < 3 ? `rank-${idx + 1}` : "";
      return `
        <tr class="${rankClass}">
            <td><span class="rank-badge">${idx + 1}</span></td>
            <td class="t-name">${ts.name}</td>
            <td>${ts.games}경기</td>
            <td class="highlight-rate">${fmt1(ts.avgRatio)}%</td>
            <td class="highlight-num">${ts.success}회</td>
            <td>${ts.lateBreak}회</td>
            <td>${ts.earlyBreak}회</td>
        </tr>`;
    })
    .join("");
}

function renderClosenessDetail(team) {
  const box = document.getElementById("closenessDetail");
  if (!team) {
    box.innerHTML = "";
    return;
  }
  const games = teamClosenessDetail(team);

  let html = `<div class="history-section"><h3>${team} 경기별 접전 유지력 (아쉽게 무산된 경기 순)</h3><div class="history-list">`;
  games.forEach((g) => {
    const r = resultCard(g.myScore, g.oppScore);
    const tag = g.isClose
      ? `<span class="tag tag-success">1무 성공</span>`
      : `<span class="tag tag-neutral">${g.closeness.lastCloseInning}/${g.closeness.totalInnings}회 유지</span>`;
    html += `
      <div class="history-item clickable-game" onclick="showGameModal(${g._idx})" tabindex="0">
          <div class="history-date">${g.date}</div>
          <div class="history-score">
              <div class="team-col"><span class="team-name ${g.myScore > g.oppScore ? "winner" : ""}">${team}</span></div>
              <span class="score-box ${r.cls}">${g.myScore} : ${g.oppScore}</span>
              <div class="team-col"><span class="team-name ${g.oppScore > g.myScore ? "winner" : ""}">${g.opp}</span></div>
          </div>
          <div class="closeness-bar-wrap">
              <div class="closeness-bar-track"><div class="closeness-bar-fill" style="width:${fmt1(g.closeness.ratio * 100)}%"></div></div>
              ${tag}
          </div>
      </div>`;
  });
  html += `</div></div>`;
  box.innerHTML = html;
}

function initClosenessView() {
  renderClosenessLeaderboard();
  const sel = document.getElementById("closenessTeamSelect");
  fillSelect(sel, TEAMS, { includeAll: true, allLabel: "팀을 선택하세요" });
  sel.addEventListener("change", () => renderClosenessDetail(sel.value));
}

/* ============================================================
   4. 선발투수 분석
   ============================================================ */
function renderStarterResult(team, pitcher) {
  const box = document.getElementById("starterResult");
  if (!team || !pitcher) {
    box.innerHTML = "";
    return;
  }
  const r = analyzeStarter(team, pitcher);

  if (r.total === 0) {
    box.innerHTML = `<div class="no-data">등판 기록이 없습니다.</div>`;
    return;
  }

  let html = `
    <h3 class="analysis-title">${team} · 선발 ${pitcher} 등판 시 경기 결과 (${r.total}경기)</h3>
    <div class="stats-cards">
        <div class="stat-card win">
            <h3>2점차 이상 승</h3>
            <div class="stat-value">${r.stats.win2Plus}회</div>
            <div class="stat-rate">${fmt1(r.rates.win2Plus)}%</div>
        </div>
        <div class="stat-card draw">
            <h3>1무 (1점차 이내)</h3>
            <div class="stat-value">${r.stats.close1}회</div>
            <div class="stat-rate">${fmt1(r.rates.close1)}%</div>
        </div>
        <div class="stat-card lose">
            <h3>2점차 이상 패</h3>
            <div class="stat-value">${r.stats.lose2Plus}회</div>
            <div class="stat-rate">${fmt1(r.rates.lose2Plus)}%</div>
        </div>
    </div>
    <p class="extra-desc">경기당 평균 득점 <b>${fmt1(r.avgRunsFor)}점</b> · 평균 실점 <b>${fmt1(r.avgRunsAgainst)}점</b></p>
    <div class="history-section"><h3>등판 경기 목록</h3><div class="history-list">
  `;

  r.games.forEach((g) => {
    const res = resultCard(g.myScore, g.oppScore);
    html += `
      <div class="history-item clickable-game" onclick="showGameModal(${g._idx})" tabindex="0">
          <div class="history-date">${g.date} (${g.home === team ? "홈" : "원정"})</div>
          <div class="history-score">
              <div class="team-col"><span class="team-name ${g.myScore > g.oppScore ? "winner" : ""}">${team}</span></div>
              <span class="score-box ${res.cls}">${g.myScore} : ${g.oppScore}</span>
              <div class="team-col"><span class="team-name ${g.oppScore > g.myScore ? "winner" : ""}">${g.opp}</span></div>
          </div>
          <div class="history-result ${res.cls}">${res.text}</div>
      </div>`;
  });

  html += `</div></div>`;
  box.innerHTML = html;
  box.classList.remove("fade-in");
  void box.offsetWidth;
  box.classList.add("fade-in");
}

function initStarterView() {
  const teamSel = document.getElementById("starterTeamSelect");
  const pitcherSel = document.getElementById("starterPitcherSelect");
  fillSelect(teamSel, TEAMS);

  function refreshPitchers() {
    const starters = listStartersForTeam(teamSel.value);
    fillSelect(
      pitcherSel,
      starters.map((s) => ({ value: s.name, label: `${s.name} (${s.starts}경기)` }))
    );
    renderStarterResult(teamSel.value, pitcherSel.value);
  }

  teamSel.addEventListener("change", refreshPitchers);
  pitcherSel.addEventListener("change", () => renderStarterResult(teamSel.value, pitcherSel.value));

  refreshPitchers();
}

/* ============================================================
   5. 추가 분석
   ============================================================ */
function renderDecisiveChart(team) {
  const { rows, totalBroken, maxCount } = computeDecisiveInningHistogram(team || null);
  const el = document.getElementById("decisiveChart");
  if (totalBroken === 0) {
    el.innerHTML = `<div class="no-data">데이터가 없습니다.</div>`;
    return;
  }
  el.innerHTML = rows
    .map((r) => {
      const label = r.inning === 0 ? "초반부터" : `${r.inning}회`;
      const widthPct = (r.count / maxCount) * 100;
      return `
        <div class="bar-row">
            <div class="bar-label">${label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${widthPct}%"></div></div>
            <div class="bar-count">${r.count}경기</div>
        </div>`;
    })
    .join("");
}

function renderWalkoffs(team) {
  const { games, ranking } = computeWalkoffs(team || null);

  const rankBox = document.getElementById("walkoffRanking");
  rankBox.innerHTML = ranking
    .filter((r) => r.walkoffWins > 0)
    .slice(0, 5)
    .map((r) => `<span class="mini-rank-chip">${r.name} <b>${r.walkoffWins}회</b></span>`)
    .join("");

  const listBox = document.getElementById("walkoffList");
  if (games.length === 0) {
    listBox.innerHTML = `<div class="no-data">끝내기 승부 기록이 없습니다.</div>`;
    return;
  }
  listBox.innerHTML = games
    .map(
      (g) => `
      <div class="history-item clickable-game" onclick="showGameModal(${g._idx})" tabindex="0">
          <div class="history-date">${g.date}</div>
          <div class="history-score">
              <div class="team-col"><span class="team-name">${g.away}</span></div>
              <span class="score-box lose-text">${g.awayScore} : ${g.homeScore}</span>
              <div class="team-col"><span class="team-name winner">${g.home}</span></div>
          </div>
          <div class="walkoff-badge">🎉 끝내기</div>
      </div>`
    )
    .join("");
}

function initExtraView() {
  const decisiveSel = document.getElementById("decisiveTeamSelect");
  const walkoffSel = document.getElementById("walkoffTeamSelect");
  fillSelect(decisiveSel, TEAMS, { includeAll: true, allLabel: "전체 리그" });
  fillSelect(walkoffSel, TEAMS, { includeAll: true, allLabel: "전체 리그" });

  decisiveSel.addEventListener("change", () => renderDecisiveChart(decisiveSel.value));
  walkoffSel.addEventListener("change", () => renderWalkoffs(walkoffSel.value));

  renderDecisiveChart("");
  renderWalkoffs("");
}

/* ============================================================
   6. 월별 트렌드
   ============================================================ */
function renderMonthlyTrend() {
  const rows = computeMonthlyCloseTrend();
  const el = document.getElementById("monthlyTrend");
  const maxRate = Math.max(1, ...rows.map((r) => r.rate));
  el.innerHTML = rows
    .map(
      (r) => `
      <div class="trend-row">
          <div class="trend-label">${r.month}</div>
          <div class="bar-track"><div class="bar-fill trend-fill" style="width:${(r.rate / maxRate) * 100}%"></div></div>
          <div class="trend-count">${r.close}/${r.total}경기 (${fmt1(r.rate)}%)</div>
      </div>`
    )
    .join("");
}

function heatColor(rate) {
  if (rate === null) return "transparent";
  // 0% -> 옅은 배경, 100% -> 진한 그린
  const alpha = 0.08 + (rate / 100) * 0.72;
  return `rgba(27, 107, 69, ${alpha.toFixed(2)})`;
}

function renderTeamMonthlyHeatmap() {
  const { months, teams } = computeTeamMonthlyTrend();
  const el = document.getElementById("teamMonthlyHeatmap");

  let html = `<table class="heatmap-table"><thead><tr><th class="heatmap-team-col">팀</th>`;
  months.forEach((m) => (html += `<th>${m.slice(5)}월</th>`));
  html += `<th class="heatmap-total-col">전체</th></tr></thead><tbody>`;

  teams.forEach((t) => {
    html += `<tr><td class="heatmap-team-col t-name">${t.name}</td>`;
    months.forEach((m) => {
      const cell = t.byMonth[m];
      const label = cell.total > 0 ? `${fmt1(cell.rate)}%` : "-";
      html += `<td class="heatmap-cell" style="background:${heatColor(cell.rate)}" title="${m} ${t.name}: ${cell.close}/${cell.total}경기">${label}</td>`;
    });
    html += `<td class="heatmap-total-col highlight-rate">${fmt1(t.overallRate)}%</td></tr>`;
  });

  html += `</tbody></table>`;
  el.innerHTML = html;
}

function renderRecentForm() {
  const rows = computeRecentForm(10);
  const el = document.getElementById("recentForm");

  el.innerHTML = rows
    .map((r) => {
      let trendIcon = "▬";
      let trendCls = "trend-flat";
      if (r.delta >= 8) {
        trendIcon = "▲";
        trendCls = "trend-up";
      } else if (r.delta <= -8) {
        trendIcon = "▼";
        trendCls = "trend-down";
      }
      return `
        <div class="recent-form-row">
            <div class="recent-form-team t-name">${r.name}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${r.recentRate}%"></div></div>
            <div class="recent-form-stats">
                <span class="highlight-rate">${fmt1(r.recentRate)}%</span>
                <span class="recent-form-sub">(최근 ${r.recentCount}경기 중 ${r.recentClose}회)</span>
                <span class="trend-chip ${trendCls}">${trendIcon} 시즌평균 ${fmt1(r.seasonRate)}%</span>
            </div>
        </div>`;
    })
    .join("");
}

function initTrendView() {
  renderMonthlyTrend();
  renderTeamMonthlyHeatmap();
  renderRecentForm();
}

/* ============================================================
   초기화
   ============================================================ */
renderLeaderboard();
initClosenessView();
initStarterView();
initExtraView();
initTrendView();