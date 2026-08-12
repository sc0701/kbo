/*
  analysis.js
  --------------------------------------------------------------
  window.KBO_GAMES 를 입력으로 받아 화면에서 쓰는 모든 통계를 계산한다.
  이 파일은 순수 계산 로직만 담당하고, DOM 조작은 app.js 에서 한다.
  --------------------------------------------------------------
*/

const TEAMS = ["SSG", "LG", "KIA", "KT", "삼성", "두산", "한화", "롯데", "NC", "키움"];

function teamGames(team) {
  return window.KBO_GAMES.filter((g) => g.home === team || g.away === team);
}

// 특정 팀 시점으로 본 점수차 (양수=승리마진, 음수=패배마진)
function perspectiveDiff(g, team) {
  const my = g.home === team ? g.homeScore : g.awayScore;
  const opp = g.home === team ? g.awayScore : g.homeScore;
  return my - opp;
}

/* ------------------------------------------------------------ *
 * 1. 리더보드: 팀별 1무(1점차 이내) 최다 순위
 * ------------------------------------------------------------ */
function computeLeaderboard() {
  const stats = {};
  TEAMS.forEach((t) => (stats[t] = { name: t, total: 0, close1: 0 }));

  window.KBO_GAMES.forEach((g) => {
    if (stats[g.home]) {
      stats[g.home].total++;
      if (g.isClose) stats[g.home].close1++;
    }
    if (stats[g.away]) {
      stats[g.away].total++;
      if (g.isClose) stats[g.away].close1++;
    }
  });

  return Object.values(stats)
    .map((s) => ({ ...s, rate: s.total > 0 ? (s.close1 / s.total) * 100 : 0 }))
    .sort((a, b) => b.rate - a.rate);
}

/* ------------------------------------------------------------ *
 * 2. 팀 간 상세 전적
 * ------------------------------------------------------------ */
function analyzeMatchup(teamA, teamB) {
  const matches = window.KBO_GAMES.filter(
    (g) => (g.home === teamA && g.away === teamB) || (g.home === teamB && g.away === teamA)
  );

  const stats = { win2Plus: 0, close1: 0, lose2Plus: 0 };
  matches.forEach((g) => {
    const diff = perspectiveDiff(g, teamA);
    if (diff >= 2) stats.win2Plus++;
    else if (Math.abs(diff) <= 1) stats.close1++;
    else if (diff <= -2) stats.lose2Plus++;
  });

  return { matches, stats, total: matches.length };
}

/* ------------------------------------------------------------ *
 * 3. 팀별 "1무 유지력" (Close-Game Persistence)
 *    각 경기의 이닝별 누적 점수차를 따라가며,
 *    몇 회까지 1점차 이내 접전이 유지됐는지(closeness.lastCloseInning)를
 *    팀 단위로 집계한다.
 * ------------------------------------------------------------ */
function computeCloseGamePersistence() {
  const stats = {};
  TEAMS.forEach((t) => {
    stats[t] = {
      name: t,
      games: 0,
      ratioSum: 0,
      success: 0, // 실제로 1무(1점차 이내)로 끝난 경기
      lateBreak: 0, // 7이닝(또는 전체 78% 이상) 유지하다가 막판에 벌어진 경기
      earlyBreak: 0, // 3이닝 이하에서 일찌감치 벌어진 경기
    };
  });

  window.KBO_GAMES.forEach((g) => {
    [g.home, g.away].forEach((team) => {
      if (!stats[team]) return;
      const s = stats[team];
      s.games++;
      s.ratioSum += g.closeness.ratio;
      if (g.isClose) s.success++;
      else if (g.closeness.ratio >= 0.7) s.lateBreak++;
      else if (g.closeness.ratio <= 0.3) s.earlyBreak++;
    });
  });

  return Object.values(stats)
    .map((s) => ({ ...s, avgRatio: s.games > 0 ? (s.ratioSum / s.games) * 100 : 0 }))
    .sort((a, b) => b.avgRatio - a.avgRatio);
}

// 특정 팀의 경기별 접전 유지력 상세 목록 (아쉽게 무산된 경기부터 정렬)
function teamClosenessDetail(team) {
  return teamGames(team)
    .map((g) => {
      const opp = g.home === team ? g.away : g.home;
      const myScore = g.home === team ? g.homeScore : g.awayScore;
      const oppScore = g.home === team ? g.awayScore : g.homeScore;
      return { ...g, opp, myScore, oppScore };
    })
    .sort((a, b) => {
      // 성공(1무)은 제외하고, 아깝게 무산된 순(ratio 높은 순)으로 정렬
      if (a.isClose !== b.isClose) return a.isClose ? 1 : -1;
      return b.closeness.ratio - a.closeness.ratio;
    });
}

/* ------------------------------------------------------------ *
 * 4. 선발투수 분석
 *    특정 팀의 특정 선발투수가 등판했을 때 그 팀의 경기 결과 분포
 * ------------------------------------------------------------ */
function listStartersForTeam(team) {
  const counts = {};
  teamGames(team).forEach((g) => {
    const starter = g.home === team ? g.starterHome : g.starterAway;
    counts[starter] = (counts[starter] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, starts]) => ({ name, starts }))
    .sort((a, b) => b.starts - a.starts);
}

function analyzeStarter(team, starterName) {
  const games = teamGames(team).filter((g) => (g.home === team ? g.starterHome : g.starterAway) === starterName);

  const stats = { win2Plus: 0, close1: 0, lose2Plus: 0, runsFor: 0, runsAgainst: 0 };
  games.forEach((g) => {
    const my = g.home === team ? g.homeScore : g.awayScore;
    const opp = g.home === team ? g.awayScore : g.homeScore;
    const diff = my - opp;
    if (diff >= 2) stats.win2Plus++;
    else if (Math.abs(diff) <= 1) stats.close1++;
    else if (diff <= -2) stats.lose2Plus++;
    stats.runsFor += my;
    stats.runsAgainst += opp;
  });

  const total = games.length;
  return {
    starterName,
    team,
    total,
    stats,
    rates: {
      win2Plus: total ? (stats.win2Plus / total) * 100 : 0,
      close1: total ? (stats.close1 / total) * 100 : 0,
      lose2Plus: total ? (stats.lose2Plus / total) * 100 : 0,
    },
    avgRunsFor: total ? stats.runsFor / total : 0,
    avgRunsAgainst: total ? stats.runsAgainst / total : 0,
    games: games
      .map((g) => {
        const opp = g.home === team ? g.away : g.home;
        const myScore = g.home === team ? g.homeScore : g.awayScore;
        const oppScore = g.home === team ? g.awayScore : g.homeScore;
        return { ...g, opp, myScore, oppScore };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

/* ------------------------------------------------------------ *
 * 5. 추가 분석 (1): 승부처 이닝 - 접전이 깨지는 시점 히스토그램
 *    (최종적으로 1무가 아니었던 경기만 대상으로,
 *     몇 회에 마지막으로 1점차 이내였는지를 집계)
 * ------------------------------------------------------------ */
function computeDecisiveInningHistogram(team) {
  const pool = team ? teamGames(team) : window.KBO_GAMES;
  const broken = pool.filter((g) => !g.isClose);

  const buckets = {}; // inning -> count ("0" = 시작부터 벌어짐)
  broken.forEach((g) => {
    const key = g.closeness.lastCloseInning;
    buckets[key] = (buckets[key] || 0) + 1;
  });

  const maxInning = Math.max(9, ...pool.map((g) => g.totalInnings));
  const rows = [];
  for (let i = 0; i <= maxInning; i++) {
    if (buckets[i]) rows.push({ inning: i, count: buckets[i] });
  }
  return { rows, totalBroken: broken.length, maxCount: Math.max(1, ...rows.map((r) => r.count)) };
}

/* ------------------------------------------------------------ *
 * 6. 추가 분석 (2): 끝내기(walk-off) 승부 기록
 * ------------------------------------------------------------ */
function computeWalkoffs(team) {
  const pool = team ? teamGames(team) : window.KBO_GAMES;
  const games = pool.filter((g) => g.isWalkoff).sort((a, b) => (a.date < b.date ? 1 : -1));

  const byTeam = {};
  TEAMS.forEach((t) => (byTeam[t] = { name: t, walkoffWins: 0 }));
  window.KBO_GAMES.forEach((g) => {
    if (g.isWalkoff && byTeam[g.home]) byTeam[g.home].walkoffWins++;
  });

  return {
    games,
    ranking: Object.values(byTeam).sort((a, b) => b.walkoffWins - a.walkoffWins),
  };
}

/* ------------------------------------------------------------ *
 * 7. 추가 분석 (3): 월별 접전(1무) 비율 추이
 * ------------------------------------------------------------ */
function computeMonthlyCloseTrend() {
  const buckets = {}; // "2026-03" -> {total, close}
  window.KBO_GAMES.forEach((g) => {
    const month = g.date.slice(0, 7);
    if (!buckets[month]) buckets[month] = { month, total: 0, close: 0 };
    buckets[month].total++;
    if (g.isClose) buckets[month].close++;
  });
  return Object.values(buckets)
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((b) => ({ ...b, rate: b.total ? (b.close / b.total) * 100 : 0 }));
}

/* ------------------------------------------------------------ *
 * 8. 월별 트렌드 (2): 팀별 x 월별 1무 비율 매트릭스 (히트맵용)
 * ------------------------------------------------------------ */
function computeTeamMonthlyTrend() {
  const months = [...new Set(window.KBO_GAMES.map((g) => g.date.slice(0, 7)))].sort();

  const teamData = {};
  TEAMS.forEach((t) => {
    teamData[t] = { name: t, byMonth: {}, total: 0, close: 0 };
    months.forEach((m) => (teamData[t].byMonth[m] = { total: 0, close: 0 }));
  });

  window.KBO_GAMES.forEach((g) => {
    const month = g.date.slice(0, 7);
    [g.home, g.away].forEach((team) => {
      if (!teamData[team]) return;
      const t = teamData[team];
      t.total++;
      t.byMonth[month].total++;
      if (g.isClose) {
        t.close++;
        t.byMonth[month].close++;
      }
    });
  });

  const teams = Object.values(teamData)
    .map((t) => ({
      ...t,
      overallRate: t.total ? (t.close / t.total) * 100 : 0,
      byMonth: Object.fromEntries(
        Object.entries(t.byMonth).map(([m, v]) => [m, { ...v, rate: v.total ? (v.close / v.total) * 100 : null }])
      ),
    }))
    .sort((a, b) => b.overallRate - a.overallRate);

  return { months, teams };
}

/* ------------------------------------------------------------ *
 * 9. 월별 트렌드 (3): 최근 흐름 - 최근 N경기 접전 비율 vs 시즌 평균
 * ------------------------------------------------------------ */
function computeRecentForm(n = 10) {
  return TEAMS.map((team) => {
    const games = teamGames(team).sort((a, b) => (a.date < b.date ? 1 : -1)); // 최신순
    const recent = games.slice(0, n);
    const recentClose = recent.filter((g) => g.isClose).length;
    const recentRate = recent.length ? (recentClose / recent.length) * 100 : 0;

    const seasonTotal = games.length;
    const seasonClose = games.filter((g) => g.isClose).length;
    const seasonRate = seasonTotal ? (seasonClose / seasonTotal) * 100 : 0;

    return {
      name: team,
      recentCount: recent.length,
      recentClose,
      recentRate,
      seasonRate,
      delta: recentRate - seasonRate,
      recentGames: recent,
    };
  }).sort((a, b) => b.recentRate - a.recentRate);
}

/* ------------------------------------------------------------ *
 * 10. 오늘의 승부 예측 — 팀 상대전적 + 선발투수 기록 + 리그 평균을
 *      가중평균으로 종합해 "2점차 이상 승 / 1무(접전) / 2점차 이상 패"
 *      3가지 결과의 확률을 추정한다.
 *
 *      설계 개념 (가중치 = 표본 크기):
 *        1) 리그 전체 평균   — 항상 포함되는 최소 기준선 (고정 가중치)
 *        2) 팀 간 상대전적   — 두 팀이 실제로 맞붙은 경기들
 *        3) 원정팀 선발투수  — 그 투수가 등판했을 때 원정팀의 결과 분포
 *        4) 홈팀 선발투수    — 그 투수가 등판했을 때 홈팀의 결과 분포
 *           (홈팀 관점 지표이므로 원정팀 관점으로 승/패를 뒤집어서 사용)
 *
 *      선발투수 기록이 없는 경우(신인 등판 등)는 3)/4) 대신
 *      해당 팀의 "시즌 전체 평균 결과 분포"로 대체하되,
 *      투수 개인 기록보다는 신뢰도가 낮으므로 가중치를 낮게 잡는다.
 *      표본이 아예 없을 때도 리그 평균이 항상 섞여 있어 0%/100% 같은
 *      극단적인 결과가 나오지 않도록 스무딩 역할을 한다.
 * ------------------------------------------------------------ */

// 팀 하나의 시즌 전체 결과 분포 (2점차+승 / 1무 / 2점차+패)
function computeTeamOverallOutcomeRates(team) {
  const games = teamGames(team);
  const stats = { win2Plus: 0, close1: 0, lose2Plus: 0 };
  games.forEach((g) => {
    const diff = perspectiveDiff(g, team);
    if (diff >= 2) stats.win2Plus++;
    else if (Math.abs(diff) <= 1) stats.close1++;
    else if (diff <= -2) stats.lose2Plus++;
  });
  const total = games.length;
  return {
    total,
    stats,
    rates: {
      win2Plus: total ? stats.win2Plus / total : 1 / 3,
      close1: total ? stats.close1 / total : 1 / 3,
      lose2Plus: total ? stats.lose2Plus / total : 1 / 3,
    },
  };
}

// 리그 전체 결과 분포 (모든 팀 관점을 합산 — 항상 존재하는 기준선)
function computeLeagueOverallOutcomeRates() {
  const stats = { win2Plus: 0, close1: 0, lose2Plus: 0 };
  let total = 0;
  TEAMS.forEach((team) => {
    teamGames(team).forEach((g) => {
      const diff = perspectiveDiff(g, team);
      total++;
      if (diff >= 2) stats.win2Plus++;
      else if (Math.abs(diff) <= 1) stats.close1++;
      else if (diff <= -2) stats.lose2Plus++;
    });
  });
  return {
    total,
    rates: {
      win2Plus: total ? stats.win2Plus / total : 1 / 3,
      close1: total ? stats.close1 / total : 1 / 3,
      lose2Plus: total ? stats.lose2Plus / total : 1 / 3,
    },
  };
}

// 원정/홈 한 쪽의 예측 소스를 만든다. 선발투수 기록이 있으면 그걸 쓰고,
// 없으면(신인/기록없음) 팀 시즌 평균으로 대체한다.
// convert: 홈팀 지표를 원정팀 관점으로 뒤집을 때 사용하는 변환 함수
function buildStarterSource(team, starterName, convert) {
  const identity = (r) => r;
  const flip = convert || identity;

  if (starterName) {
    const s = analyzeStarter(team, starterName);
    if (s.total > 0) {
      const rates = flip({
        win2Plus: s.rates.win2Plus / 100,
        close1: s.rates.close1 / 100,
        lose2Plus: s.rates.lose2Plus / 100,
      });
      return {
        label: `${team} 선발 ${starterName}`,
        weight: s.total,
        rates,
        note: `${starterName} 등판 ${s.total}경기 기록 기준`,
      };
    }
  }

  // 선발투수 기록이 없음 → 팀 시즌 평균으로 대체 (신뢰도 낮춰서 가중치 상한 5)
  const t = computeTeamOverallOutcomeRates(team);
  const rates = flip(t.rates);
  return {
    label: `${team} 팀 시즌 평균`,
    weight: Math.min(t.total, 5),
    rates,
    note: starterName
      ? `'${starterName}' 등판 기록이 없어 ${team} 팀 시즌 평균(${t.total}경기)으로 대체`
      : `선발투수 미지정 — ${team} 팀 시즌 평균(${t.total}경기) 사용`,
  };
}

function predictMatchup(awayTeam, homeTeam, awayStarter, homeStarter) {
  const sources = [];

  // 1) 리그 전체 평균 (항상 포함되는 기준선, 고정 가중치)
  const league = computeLeagueOverallOutcomeRates();
  sources.push({
    label: "리그 전체 평균",
    weight: 4,
    rates: league.rates,
    note: `전체 ${league.total}팀-경기 기준 (기본 스무딩 값)`,
  });

  // 2) 두 팀 간 상대전적
  const h2h = analyzeMatchup(awayTeam, homeTeam);
  if (h2h.total > 0) {
    sources.push({
      label: `${awayTeam} vs ${homeTeam} 상대전적`,
      weight: h2h.total,
      rates: {
        win2Plus: h2h.stats.win2Plus / h2h.total,
        close1: h2h.stats.close1 / h2h.total,
        lose2Plus: h2h.stats.lose2Plus / h2h.total,
      },
      note: `역대 맞대결 ${h2h.total}경기`,
    });
  }

  // 3) 원정팀 선발투수 (없으면 팀 평균)
  sources.push(buildStarterSource(awayTeam, awayStarter, null));

  // 4) 홈팀 선발투수 (없으면 팀 평균) — 원정팀 관점으로 뒤집어서 사용
  const flipToAwayView = (r) => ({ win2Plus: r.lose2Plus, close1: r.close1, lose2Plus: r.win2Plus });
  sources.push(buildStarterSource(homeTeam, homeStarter, flipToAwayView));

  // 가중 평균으로 종합
  const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0) || 1;
  const combined = { win2Plus: 0, close1: 0, lose2Plus: 0 };
  sources.forEach((s) => {
    combined.win2Plus += s.rates.win2Plus * s.weight;
    combined.close1 += s.rates.close1 * s.weight;
    combined.lose2Plus += s.rates.lose2Plus * s.weight;
  });
  ["win2Plus", "close1", "lose2Plus"].forEach((k) => (combined[k] /= totalWeight));

  // 반올림 오차 보정을 위한 정규화
  const sum = combined.win2Plus + combined.close1 + combined.lose2Plus;
  ["win2Plus", "close1", "lose2Plus"].forEach((k) => (combined[k] = sum > 0 ? combined[k] / sum : 1 / 3));

  const outcomes = [
    { key: "away", label: `${awayTeam} 2점차 이상 승`, prob: combined.win2Plus * 100 },
    { key: "close", label: `1점차 이내 접전 (1무)`, prob: combined.close1 * 100 },
    { key: "home", label: `${homeTeam} 2점차 이상 승`, prob: combined.lose2Plus * 100 },
  ].sort((a, b) => b.prob - a.prob);

  return { awayTeam, homeTeam, awayStarter, homeStarter, outcomes, sources, totalWeight };
}
