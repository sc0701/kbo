/*
  data-loader.js — 데이터 파일 자동 로딩
  ================================================================
  data/ 폴더의 월별 .js 파일을 자동으로 탐색하여 로드합니다.

  ▶ 새 달의 데이터 추가 방법 (예: 2026년 8월)
    1) data/2026-08.js 파일을 만든다.
    2) 파일 내용:
       KBO_RAW.push(
       { "date": "2026-08-01", ... },
       { ... }
       );
    3) 끝! — 이 파일(data-loader.js)이 자동으로 감지합니다.

  원리: 2026-05부터 현재 달까지의 파일명을 자동 생성하고,
        존재하는 파일만 로드합니다 (없으면 무시).
  ================================================================
*/
(function () {
  'use strict';

  /* --- 설정 --- */
  var SPECIAL_FILES = ['2026-03_04.js'];   // 여러 달이 합쳐진 특수 파일
  var SEASON_START_YEAR = 2026;
  var INDIVIDUAL_START_MONTH = 5;           // 5월부터 개별 월 파일

  /* --- 파일 목록 자동 생성 --- */
  function generateMonthFiles() {
    var files = [];
    var now = new Date();
    var curYear = now.getFullYear();
    var curMonth = now.getMonth() + 1;

    for (var y = SEASON_START_YEAR; y <= curYear; y++) {
      var mStart = (y === SEASON_START_YEAR) ? INDIVIDUAL_START_MONTH : 1;
      var mEnd = (y === curYear) ? curMonth : 12;
      for (var m = mStart; m <= mEnd; m++) {
        files.push(y + '-' + String(m).padStart(2, '0') + '.js');
      }
    }
    return files;
  }

  var ALL_FILES = SPECIAL_FILES.concat(generateMonthFiles());
  var pending = ALL_FILES.length;
  var loadedCount = 0;

  function onFileHandled(success) {
    if (success) loadedCount++;
    pending--;
    if (pending <= 0) {
      console.log('[data-loader] ' + loadedCount + '개 데이터 파일 로드 완료 (' + window.KBO_RAW.length + '경기)');

      // 데이터 정규화
      window.KBO_GAMES = normalizeGames(window.KBO_RAW).sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
      // 모달 참조용 인덱스 부여
      window.KBO_GAMES.forEach(function (g, i) { g._idx = i; });

      console.log('[data-loader] 정규화 완료: ' + window.KBO_GAMES.length + '경기');

      // 앱 초기화
      if (typeof window.initApp === 'function') {
        window.initApp();
      }
    }
  }

  /* --- 동적 스크립트 로딩 --- */
  ALL_FILES.forEach(function (file) {
    var s = document.createElement('script');
    s.src = 'data/' + file;
    s.onload = function () { onFileHandled(true); };
    s.onerror = function () { onFileHandled(false); }; // 파일이 없으면 무시
    document.head.appendChild(s);
  });
})();
