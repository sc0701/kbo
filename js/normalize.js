/*
  normalize.js
  --------------------------------------------------------------
  KBO_RAW (여러 월별 파일에서 push된 원본 JSON 객체들) 을
  분석하기 쉬운 표준 스키마로 변환해서 window.KBO_GAMES 에 저장한다.

  표준 게임 객체:
  {
    date, stadium,
    home, away,                // 팀명
    homeScore, awayScore,
    homeInnings, awayInnings,  // 이닝별 득점 배열
    totalInnings,              // = awayInnings.length (원정팀은 항상 마지막 이닝까지 타석에 섬)
    diff,                      // 최종 점수차 절대값
    isClose,                   // 최종 diff <= 1 (=1무, 1점차 이내 승부)
    winPitcher, losePitcher, savePitcher,
    starterHome, starterAway,
    winningHit,
    closeness: { lastCloseInning, ratio, isActuallyClose },
    isWalkoff
  }
  --------------------------------------------------------------
*/

function computeCloseness(homeInnings, awayInnings) {
  const totalInnings = awayInnings.length; // 화면(테이블) 렌더링을 위해 기존 값 유지
  const totalHalfInnings = awayInnings.length + homeInnings.length; // 예: 9 + 8 = 17 (8.5이닝)

  let cumHome = 0;
  let cumAway = 0;
  let closeHalfInnings = 0; // 1점 차 이내였던 반 이닝(초/말) 누적 횟수
  let lastCloseInning = 0;

  for (let i = 0; i < awayInnings.length; i++) {
    // 초 (원정팀 공격 후 점수 확인)
    cumAway += awayInnings[i];
    if (Math.abs(cumHome - cumAway) <= 1) {
      closeHalfInnings++;
      lastCloseInning = i + 1;
    }

    // 말 (홈팀 공격 후 점수 확인)
    if (i < homeInnings.length) {
      cumHome += homeInnings[i];
      if (Math.abs(cumHome - cumAway) <= 1) {
        closeHalfInnings++;
        lastCloseInning = i + 1;
      }
    }
  }

  // 4.0이닝 / 8.5이닝 == 8번 / 17번 (결과 비율은 동일하게 계산됨)
  const ratio = totalHalfInnings > 0 ? closeHalfInnings / totalHalfInnings : 0;
  return { lastCloseInning, totalInnings, ratio };
}

function computeIsWalkoff(homeScore, awayScore, homeInnings, awayInnings) {
  if (homeInnings.length !== awayInnings.length) return false;
  return homeScore > awayScore;
}

function normalizeGames(rawList) {
  return rawList.map((g) => {
    const home = g.homeTeam.name;
    const away = g.awayTeam.name;
    const homeScore = g.homeTeam.score;
    const awayScore = g.awayTeam.score;
    const homeInnings = g.scoreboard.home;
    const awayInnings = g.scoreboard.away;

    const diff = Math.abs(homeScore - awayScore);
    const isClose = diff <= 1;
    const closeness = computeCloseness(homeInnings, awayInnings);
    const isWalkoff = computeIsWalkoff(homeScore, awayScore, homeInnings, awayInnings);

    return {
      date: g.date,
      stadium: g.stadium,
      home,
      away,
      homeScore,
      awayScore,
      homeInnings,
      awayInnings,
      totalInnings: closeness.totalInnings,
      diff,
      isClose,
      winPitcher: g.pitchers.win,
      losePitcher: g.pitchers.lose,
      savePitcher: g.pitchers.save,
      starterHome: g.pitchers.starter.home,
      starterAway: g.pitchers.starter.away,
      winningHit: g.winningHit,
      closeness: { ...closeness, isActuallyClose: isClose },
      isWalkoff,
    };
  });
}

// 날짜순 정렬 후 표준 스키마로 변환, 전역에 저장
window.KBO_GAMES = normalizeGames(window.KBO_RAW).sort((a, b) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : 0
);
