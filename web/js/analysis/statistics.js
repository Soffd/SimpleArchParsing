// ======== 计算 ========
const state = { info:null, agg:'game', wG:0.6, wB:0, sortKey:'acc', sortDir:-1, unionShown:false,
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
  if (state.agg === 'game') return aggAccGame(scores);
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
const GRADE_T = { P: 1, 'S+': 0.99, S: 0.98, A: 0.96, B: 0.93, C: 0.9, D: 0.85 };
function gradeOf(acc) {
  // 使用未截断的游戏口径 ACC；只有完整 100% 才达到 P。
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
  // Simple 1.2.0: ScoreManager.QueryAverageAcc / TryReplaceBestScore.
  // Best integer ACC per chapter/song/difficulty, then float32 weighted average.
  const best = new Map();
  for (const s of scores) {
    const weight = [1, 2, 4, 8][s.hard];
    if (!weight) continue;
    const d = accDen(s);
    const units = d ? Math.floor((s.perfect * 10 + (s.earlyGood + s.lateGood) * 6) * 1000 / d) : 10000;
    const key = JSON.stringify([s.chapter, s.musicName, s.hard]);
    if (!best.has(key) || units > best.get(key).units) best.set(key, {units, weight});
  }
  let total = 0, weights = 0;
  for (const {units, weight} of best.values()) {
    total = Math.fround(total + Math.fround(Math.fround(units / 10000) * weight));
    weights += weight;
  }
  return weights ? Math.fround(total / weights) : 0;
}
function aggLabel() {
  return state.agg === 'game' ? '游戏口径 · 难度权重 1 / 2 / 4 / 8' : state.agg === 'weighted' ? '按判定数加权（分析）' : '各谱面等权（分析）';
}
function fmtAggPct(x) { return state.agg === 'game' ? (x * 100).toFixed(2) + '%' : fmtPct(x); }
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
