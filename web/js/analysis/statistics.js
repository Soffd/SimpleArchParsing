// ======== 计算 ========
const state = { info:null, agg:'weighted', wG:0.6, wB:0, sortKey:'acc', sortDir:-1, unionShown:false,
                difficulty:'', status:'', filter:'', lbList:[], lbIndex:0,
                cardSort:'acc', cardDirection:-1, accSort:'hard', accDirection:1, judgeSort:'hard', judgeDirection:1 };

// Copy before sorting. Missing levels always follow known levels in both directions.
function sortedChartScores(scores, key, direction) {
  const compareLevel = (a, b) => {
    const x = lvNum(chartOf(a)?.lv), y = lvNum(chartOf(b)?.lv);
    const xKnown = Number.isFinite(x) && x >= 0;
    const yKnown = Number.isFinite(y) && y >= 0;
    if (xKnown !== yKnown) return xKnown ? -1 : 1;
    return xKnown ? (x - y) * direction : 0;
  };
  return scores.slice().sort((a, b) => {
    let primary = 0;
    if (key === 'hard') primary = (a.hard - b.hard) * direction || compareLevel(a, b);
    else if (key === 'lv') primary = compareLevel(a, b);
    else if (key === 'score') primary = (scoreOf(a) - scoreOf(b)) * direction;
    else if (key === 'grade') primary = (gradeValue(a) - gradeValue(b)) * direction;
    else if (key === 'name') primary = titleOf(a).localeCompare(titleOf(b), 'zh-CN') * direction;
    else primary = (accOf(a) - accOf(b)) * direction;
    return primary || accOf(b) - accOf(a) || titleOf(a).localeCompare(titleOf(b), 'zh-CN');
  });
}

function noteDen(s) {
  const sum = s.perfect + s.earlyGood + s.lateGood + s.earlyBad + s.lateBad + s.miss;
  return s.fullComboCount > 0 ? s.fullComboCount : sum;
}
function num(s) { return s.perfect + state.wG * (s.earlyGood + s.lateGood) + state.wB * (s.earlyBad + s.lateBad); }
function accOf(s) { const d = accDen(s); return d ? num(s) / d : 0; }
function aggAcc(scores) {
  if (!scores.length) return 0;
  if (state.agg === 'mean') {
    let t = 0; for (const s of scores) t += accOf(s);
    return t / scores.length;
  }
  let n = 0, d = 0;
  for (const s of scores) { n += num(s); d += accDen(s); }
  return d ? n / d : 0;
}
const GRADE_COLOR = { 'P':'#7a5cff', 'S+':'#a88bfa', 'S':'#f3d935', 'A':'#f07c46', 'B':'#2ab831', 'C':'#2a6fb8', 'D':'#b82a2a', 'F':'#6c6c6c' };
const GRADE_T = Object.assign({ P: 0.999, 'S+': 0.99, S: 0.98, A: 0.9, B: 0.8, C: 0.7, D: 0.6 }, META.GRADE_THRESHOLDS || {});
function gradeOf(acc) {
  // 游戏评级：阈值逆向推测（已用两例真实结算校准：97.75%→A、99.85%→S+）
  for (const g of ['P', 'S+', 'S', 'A', 'B', 'C', 'D']) {
    if (acc >= GRADE_T[g]) return [g, GRADE_COLOR[g]];
  }
  return ['F', GRADE_COLOR['F']];
}
function scoreOf(s) {
  // SCORE = ⌊(P + 0.6×G)×10000 / 音符总数⌋×100 + ⌊最大连击×100000 / 音符总数⌋
  // （分项截断取整；三例真实结算验证精确：1,004,615 / 1,098,500 / 1,044,574）
  const n = noteDen(s);
  if (!n) return 0;
  const numInt5 = s.perfect * 5 + (s.earlyGood + s.lateGood) * 3; // (P + 0.6G) × 5，整数化避免浮点误差
  const judge = Math.floor(numInt5 * 2000 / n) * 100;
  const combo = Math.floor(Math.min(s.maxComboCount, n) * 100000 / n);
  return Math.max(0, judge + combo);
}
function gameAccOf(s) {
  // 游戏口径 ACC：ACC = (Perfect + 0.6×Good) / 判定总和（Bad/Miss 不计分）
  const n = accDen(s);
  if (!n) return 0;
  return (s.perfect + 0.6 * (s.earlyGood + s.lateGood)) / n;
}
function aggAccGame(scores) {
  let n = 0, d = 0;
  for (const s of scores) {
    d += accDen(s);
    n += s.perfect + 0.6 * (s.earlyGood + s.lateGood);
  }
  return d ? n / d : 0;
}
function gradeKey(g) { return g === 'S+' ? 'SP' : g; }
function rankImg(grade, h) {
  return '<span class="rk"><img style="height:' + h + 'px" src="' + RANK_BASE + '/ScoreLevel_' + gradeKey(grade) + '.png" alt="' + grade + '" onerror="this.parentNode.textContent=this.alt"></span>';
}

function gradeValue(s) { return ['F','D','C','B','A','S','S+','P'].indexOf(gradeOf(gameAccOf(s))[0]); }
function den(s) { return noteDen(s); }
function accDen(s) { return s.perfect+s.earlyGood+s.lateGood+s.earlyBad+s.lateBad+s.miss; }
function lvNum(lv) { if (lv === undefined || lv === null || lv === '') return -1; const s = String(lv); return parseFloat(s) + (s.indexOf('+') >= 0 ? 0.5 : 0); }
function chartOf(s) { return CHART_DB[s.musicName + '|' + (HARD_NAMES[s.hard] || s.hard)] || null; }
function titleOf(s) { const m = MUSIC_DB[s.musicName]; return (m && m.title) || s.musicName || '(未知曲目)'; }
function chapterOf(s) { return CHAPTER_CN[String(s.chapter)] || CHAPTER_NAMES[s.chapter] || ('#' + s.chapter); }
function ilOf(s) { const m = MUSIC_DB[s.musicName]; return (m && m.il) || ''; }
function coverURL(s, size) {
  const il = ilOf(s);
  if (!il) return '';
  return COVER_BASE + '/' + size + '/' + il + (size === 'original' ? '.png' : '.webp');
}
function thumbOf(s) { return coverURL(s, 'thumb'); }
function fullOf(s) { return coverURL(s, 'full'); }
function origOf(s) { return coverURL(s, 'original'); }
function fmtPct(x) { return (Math.floor(x * 10000 + 1e-6) / 100).toFixed(2) + '%'; }
function esc(x) { return String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function maskUnion(u) { if (!u) return ''; return u.length <= 12 ? u[0] + '***' : u.slice(0, 6) + '…' + u.slice(-4); }
function filteredScores() {
  if (!state.info) return [];
  const f = state.filter;
  return state.info.scores.filter(s => (state.difficulty === '' || String(s.hard) === state.difficulty) && (!state.status || (state.status === 'ap' ? isAP(s) : state.status === 'fc' ? isZeroMiss(s) : s.miss > 0))).filter(s =>
    (titleOf(s) + ' ' + s.musicName + ' ' + (HARD_NAMES[s.hard] || '') + ' ' + chapterOf(s)).toLowerCase().indexOf(f) >= 0);
}
