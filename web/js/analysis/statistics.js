// ======== 计算 ========
const state = { info:null, agg:'weighted', wG:0.6, wB:0.1, sortKey:'acc', sortDir:-1, unionShown:false,
                difficulty:'', status:'', filter:'', lbList:[], lbIndex:0,
                accSort:'hard', accDirection:1, judgeSort:'hard', judgeDirection:1 };

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
    else if (key === 'name') primary = titleOf(a).localeCompare(titleOf(b), 'zh-CN') * direction;
    else primary = (accOf(a) - accOf(b)) * direction;
    return primary || accOf(b) - accOf(a) || titleOf(a).localeCompare(titleOf(b), 'zh-CN');
  });
}

function den(s) {
  const sum = s.perfect + s.earlyGood + s.lateGood + s.earlyBad + s.lateBad + s.miss;
  return s.fullComboCount > 0 ? s.fullComboCount : sum;
}
function num(s) { return s.perfect + state.wG * (s.earlyGood + s.lateGood) + state.wB * (s.earlyBad + s.lateBad); }
function accOf(s) { const d = den(s); return d ? num(s) / d : 0; }
function aggAcc(scores) {
  if (!scores.length) return 0;
  if (state.agg === 'mean') {
    let t = 0; for (const s of scores) t += accOf(s);
    return t / scores.length;
  }
  let n = 0, d = 0;
  for (const s of scores) { n += num(s); d += den(s); }
  return d ? n / d : 0;
}
function gradeOf(acc) {
  const a = acc * 100;
  if (a >= 99.7) return ['SSS', '#ffd76a'];
  if (a >= 99.2) return ['SS', '#ffd76a'];
  if (a >= 98.5) return ['S', '#ffb547'];
  if (a >= 98) return ['A+', '#7ee0a1'];
  if (a >= 97) return ['A', '#7ee0a1'];
  if (a >= 95) return ['B', '#6ec9ff'];
  if (a >= 90) return ['C', '#8f97b0'];
  return ['D', '#8f97b0'];
}
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
function fmtPct(x) { return (x * 100).toFixed(2) + '%'; }
function esc(x) { return String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function maskUnion(u) { if (!u) return ''; return u.length <= 12 ? u[0] + '***' : u.slice(0, 6) + '…' + u.slice(-4); }
function filteredScores() {
  if (!state.info) return [];
  const f = state.filter;
  return state.info.scores.filter(s => (state.difficulty === '' || String(s.hard) === state.difficulty) && (!state.status || (state.status === 'ap' ? isAP(s) : state.status === 'fc' ? isZeroMiss(s) : s.miss > 0))).filter(s =>
    (titleOf(s) + ' ' + s.musicName + ' ' + (HARD_NAMES[s.hard] || '') + ' ' + chapterOf(s)).toLowerCase().indexOf(f) >= 0);
}
