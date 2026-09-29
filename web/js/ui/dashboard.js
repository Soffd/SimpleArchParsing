// ======== 渲染 ========
function renderAll() {
  const info = state.info;
  document.getElementById('result').hidden = false;
  document.getElementById('pName').textContent = info.playerName || '(未命名玩家)';
  document.getElementById('pDevice').textContent = info.deviceInfo ? ('设备：' + info.deviceInfo) : '';
  document.getElementById('pCount').textContent = info.scores.length;
  const pu = document.getElementById('pUnion');
  pu.dataset.full = info.unionId || '';
  pu.textContent = state.unionShown ? (info.unionId || '无') : (info.unionId ? maskUnion(info.unionId) : '无');
  renderInsights();
  renderKpis();
  renderDonut();
  renderAccChart();
  renderJudgeChart();
  renderCards();
  renderTable();
  document.getElementById('formulaHint').textContent =
    '当前公式：ACC = (Perfect + ' + state.wG.toFixed(2) + '×Good + ' + state.wB.toFixed(2) + '×Bad) / 判定总和（分数与评级固定采用游戏公式）';
}

function renderKpis() {
  const scores = state.info.scores;
  const acc = aggAcc(scores);
  const g = gradeOf(aggAccGame(scores));
  let fc = 0, notes = 0, bestLv = null;
  for (const s of scores) {
    if (isZeroMiss(s)) fc++;
    notes += den(s);
    const c = chartOf(s);
    if (c) { const v = lvNum(c.lv); if (bestLv === null || v > bestLv.num) bestLv = {num:v, txt:c.lv}; }
  }
  const kpis = [
    ['平均 ACC', fmtPct(acc) + '<span class="badge" style="background:' + g[1] + '22;color:' + g[1] + '">' + g[0] + '</span>', '按 ' + (state.agg === 'weighted' ? '判定数加权' : '谱面等权') + ' · 评级为参考'],
    ['成绩记录', String(scores.length), '个谱面'],
    ['零 Miss 谱面', String(fc), '有判定且 Miss = 0（参考）'],
    ['总音符数', String(notes), '谱面音符总量'],
    ['最高等级', bestLv ? bestLv.txt : '-', '已游玩谱面最高难度']
  ];
  document.getElementById('kpis').innerHTML = kpis.map(k =>
    '<div class="kpi"><div class="v">' + k[1] + '</div><div class="k">' + k[0] + '<br>' + k[2] + '</div></div>'
  ).join('');
}

function renderDonut() {
  const scores = state.info.scores;
  let P = 0, G = 0, B = 0, M = 0;
  for (const s of scores) { P += s.perfect; G += s.earlyGood + s.lateGood; B += s.earlyBad + s.lateBad; M += s.miss; }
  const total = P + G + B + M;
  const acc = aggAcc(scores);
  const g = gradeOf(aggAccGame(scores));
  const segs = [['Perfect', P, '#a292bd'], ['Good', G, '#6eaaa3'], ['Bad', B, '#c4a46b'], ['Miss', M, '#c18598']];
  const R = 74, CIRC = 2 * Math.PI * R;
  let off = 0, svg = '';
  svg += '<circle cx="95" cy="95" r="' + R + '" fill="none" stroke="#222b44" stroke-width="16"></circle>';
  for (const sg of segs) {
    const nm = sg[0], val = sg[1], color = sg[2];
    if (!val || !total) continue;
    const len = CIRC * val / total;
    svg += '<circle cx="95" cy="95" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="16"' +
      ' stroke-dasharray="' + len + ' ' + (CIRC - len) + '" stroke-dashoffset="' + (-off) + '"' +
      ' transform="rotate(-90 95 95)"><title>' + nm + ' ' + val + '</title></circle>';
    off += len;
  }
  svg += '<text x="95" y="88" text-anchor="middle" fill="#e9edf8" font-size="26" font-weight="700">' + fmtPct(acc) + '</text>';
  svg += '<text x="95" y="110" text-anchor="middle" fill="#8f97b0" font-size="12">平均 ACC</text>';
  svg += '<text x="95" y="132" text-anchor="middle" fill="' + g[1] + '" font-size="15" font-weight="700">' + g[0] + '</text>';
  document.getElementById('donutSvg').innerHTML = svg;
  const pct = v => total ? (v / total * 100).toFixed(2) + '%' : '0%';
  document.getElementById('donutLegend').innerHTML = segs.map(sg =>
    '<span><i style="background:' + sg[2] + '"></i>' + sg[0] + '：' + sg[1] + '（' + pct(sg[1]) + '）</span>'
  ).join('');
}

function renderAccChart() {
  const box = document.getElementById('accBox');
  const W = Math.max(560, box.clientWidth || 860);
  const scores = sortedChartScores(state.info.scores, state.accSort, state.accDirection);
  if (!scores.length) { document.getElementById('accChart').innerHTML = ''; return; }
  const rowH = 30, top = 6, bottom = 30;
  const padL = Math.min(330, Math.max(170, W * 0.36));
  const padR = 64;
  let minA = 1; for (const s of scores) minA = Math.min(minA, accOf(s));
  const lo = Math.max(0, Math.min(90, Math.floor(minA * 100) - 1)) / 100;
  const hi = 1;
  const plotW = W - padL - padR;
  const H = top + scores.length * rowH + bottom;
  const X = v => padL + (v - lo) / (hi - lo) * plotW;
  let g = '';
  const ticks = [lo, (lo + hi) / 2, hi];
  for (const t of ticks) {
    const x = X(t);
    g += '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (H - bottom) + '" stroke="#232c47" stroke-width="1"></line>';
    g += '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle" fill="#8f97b0" font-size="11">' + (t * 100).toFixed(1) + '%</text>';
  }
  scores.forEach((s, i) => {
    const y = top + i * rowH + 5;
    const h = rowH - 12;
    const acc = accOf(s);
    const c = chartOf(s);
    const color = DIFF_COLORS[s.hard] || '#8f97b0';
    const x2 = X(acc);
    g += '<rect x="' + padL + '" y="' + y + '" width="' + Math.max(2, x2 - padL) + '" height="' + h + '" rx="5" fill="' + color + '" opacity="0.85"><title>' + esc(titleOf(s)) + ' ' + fmtPct(acc) + '</title></rect>';
    const lv = c ? (' Lv' + c.lv) : '';
    g += '<text x="' + (padL - 10) + '" y="' + (y + h - 3) + '" text-anchor="end" fill="#cdd6f0" font-size="12.5">' + esc(titleOf(s)) + ' <tspan fill="' + color + '">[' + (HARD_NAMES[s.hard] || s.hard) + lv + ']</tspan></text>';
    g += '<text x="' + (x2 + 8) + '" y="' + (y + h - 3) + '" fill="#e9edf8" font-size="12.5" font-weight="600">' + fmtPct(acc) + '</text>';
  });
  document.getElementById('accChart').setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  document.getElementById('accChart').innerHTML = g;
  document.getElementById('diffLegend').innerHTML = [0,1,2,3].map(h2 =>
    '<span><i style="background:' + DIFF_COLORS[h2] + '"></i>' + HARD_NAMES[h2] + '</span>'
  ).join('');
}

function renderJudgeChart() {
  const box = document.getElementById('judgeBox');
  const W = Math.max(560, box.clientWidth || 860);
  const scores = sortedChartScores(state.info.scores, state.judgeSort, state.judgeDirection);
  if (!scores.length) { document.getElementById('judgeChart').innerHTML = ''; return; }
  const rowH = 26, top = 6, bottom = 8;
  const padL = Math.min(330, Math.max(170, W * 0.36));
  const padR = 16;
  const plotW = W - padL - padR;
  const H = top + scores.length * rowH + bottom;
  let g = '';
  scores.forEach((s, i) => {
    const y = top + i * rowH + 4;
    const h = rowH - 10;
    const total = s.perfect + s.earlyGood + s.lateGood + s.earlyBad + s.lateBad + s.miss;
    if (!total) return;
    const parts = [
      [s.perfect, '#a292bd'],
      [s.earlyGood + s.lateGood, '#6eaaa3'],
      [s.earlyBad + s.lateBad, '#c4a46b'],
      [s.miss, '#c18598']
    ];
    let x = padL;
    for (const part of parts) {
      const v = part[0], color = part[1];
      if (!v) continue;
      const w2 = plotW * v / total;
      g += '<rect x="' + x + '" y="' + y + '" width="' + w2 + '" height="' + h + '" fill="' + color + '" opacity="0.9"><title>' + v + '</title></rect>';
      x += w2;
    }
    const chart = chartOf(s);
    g += '<text x="' + (padL - 10) + '" y="' + (y + h - 2) + '" text-anchor="end" fill="#cdd6f0" font-size="12">' + esc(titleOf(s)) + ' <tspan fill="#8f97b0">' + (HARD_NAMES[s.hard] || s.hard) + (chart ? ' Lv' + esc(chart.lv) : ' Lv未知') + '</tspan></text>';
  });
  document.getElementById('judgeChart').setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  document.getElementById('judgeChart').innerHTML = g;
}

function renderCards() {
  const el = document.getElementById('scorecards');
  const scores = sortedChartScores(filteredScores(), state.cardSort, state.cardDirection);
  document.getElementById('filterCount').textContent = scores.length + ' / ' + state.info.scores.length + ' 谱面';
  if (!scores.length) { el.innerHTML = '<div class="hint">' + (state.info.scores.length ? '没有匹配的成绩' : '没有成绩数据') + '</div>'; return; }
  el.innerHTML = scores.map((s, i) => {
    const c = chartOf(s);
    const color = DIFF_COLORS[s.hard] || '#8f97b0';
    const cover = thumbOf(s);
    const total = (s.perfect + s.earlyGood + s.lateGood + s.earlyBad + s.lateBad + s.miss) || 1;
    const seg = (v, col) => v ? '<i style="width:' + (v / total * 100) + '%;background:' + col + '"></i>' : '';
    const bar = seg(s.perfect, '#a292bd') + seg(s.earlyGood + s.lateGood, '#6eaaa3') +
                seg(s.earlyBad + s.lateBad, '#c4a46b') + seg(s.miss, '#c18598');
    return '<div class="scorecard" style="--diff:' + color + '">' +
      '<div class="sc-img">' +
      (cover ? '<img src="' + cover + '" loading="lazy" alt="" data-lb="' + esc(s.musicName) + '|' + s.hard + '" onerror="this.style.display=&quot;none&quot;">' : '') +
      (isZeroMiss(s) ? '<span class="sc-fc">' + (isAP(s) ? 'AP' : '零 Miss') + '</span>' : '') +
      '<span class="sc-lv" style="color:' + color + '">' + (HARD_NAMES[s.hard] || s.hard) + (c ? ' Lv' + esc(c.lv) : '') + '</span>' +
      '</div>' +
      '<div class="sc-body">' + '<div class="sc-rank">#' + String(i+1).padStart(2,'0') + ' / RECORD</div>' +
      '<div class="sc-song"><span class="song-diamond" aria-hidden="true"></span><div><div class="sc-title" title="' + esc(titleOf(s)) + '">' + esc(titleOf(s)) + '</div>' +
      '<div class="sc-sub">' + esc((MUSIC_DB[s.musicName] || {}).composer || chapterOf(s)) + '</div></div></div>' +
      '<div class="sc-score"><div><small>SCORE</small><strong>' + scoreOf(s).toLocaleString('en-US') + '</strong></div>' + rankImg(gradeOf(gameAccOf(s))[0], 48) + '</div>' +
      '<div class="sc-row"><span class="diffbadge" style="color:' + color + ';border-color:' + color + '55;background:' + color + '18">' + (HARD_NAMES[s.hard] || s.hard) + (c ? ' Lv' + esc(c.lv) : '') + '</span>' +
      '<span class="sc-acc">' + fmtPct(accOf(s)) + '</span></div>' +
      '<div class="sc-bar">' + bar + '</div>' + '<div class="sc-detail">P ' + s.perfect + ' · G ' + (s.earlyGood+s.lateGood) + ' · B ' + (s.earlyBad+s.lateBad) + ' · M ' + s.miss + '</div>' +
      '</div></div>';
  }).join('');
}

function renderTable() {
  const heads = [
    ['name', '曲目'], ['chapter', '章节'], ['hard', '难度'], ['lv', 'Lv'], ['acc', 'ACC'], ['score', '分数'], ['grade', '评级'],
    ['perfect', 'Perfect'], ['good', 'Good'], ['bad', 'Bad'], ['miss', 'Miss'], ['maxCombo', 'MaxCombo'], ['fc', '状态']
  ];
  const scores = filteredScores().slice();
  const key = state.sortKey, dir = state.sortDir;
  const val = s => {
    const c = chartOf(s);
    switch (key) {
      case 'name': return titleOf(s).toLowerCase();
      case 'chapter': return s.chapter;
      case 'hard': return s.hard;
      case 'lv': return c ? lvNum(c.lv) : -1;
      case 'acc': return accOf(s);
      case 'score': return scoreOf(s);
      case 'grade': return gradeValue(s);
      case 'good': return s.earlyGood + s.lateGood;
      case 'bad': return s.earlyBad + s.lateBad;
      case 'maxCombo': return s.maxComboCount;
      case 'fc': return isZeroMiss(s) ? 1 : 0;
      default: return s[key] || 0;
    }
  };
  scores.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  document.querySelector('#detail thead').innerHTML = '<tr>' + heads.map(h =>
    '<th data-key="' + h[0] + '"' + (h[0] === key ? ' class="sorted"' : '') + '>' + h[1] + '</th>'
  ).join('') + '</tr>';
  document.querySelector('#detail tbody').innerHTML = scores.map(s => {
    const c = chartOf(s);
    const color = DIFF_COLORS[s.hard] || '#8f97b0';
    const cover = thumbOf(s);
    return '<tr>' +
      '<td class="sname"><div class="sname-in">' +
      (cover ? '<img class="thumb" src="' + cover + '" loading="lazy" alt="" data-lb="' + esc(s.musicName) + '|' + s.hard + '" onerror="this.style.display=&quot;none&quot;">' : '<div class="thumb"></div>') +
      '<div><div class="t1">' + esc(titleOf(s)) + '</div><div class="t2">' + esc((MUSIC_DB[s.musicName] || {}).composer || '曲师未知') + '</div></div>' +
      '</div></td>' +
      '<td>' + esc(chapterOf(s)) + '</td>' +
      '<td style="color:' + color + '">' + (HARD_NAMES[s.hard] || s.hard) + '</td>' +
      '<td>' + (c ? esc(c.lv) : '-') + '</td>' +
      '<td><b>' + fmtPct(accOf(s)) + '</b></td>' +
      '<td>' + scoreOf(s).toLocaleString('en-US') + '</td><td>' + rankImg(gradeOf(gameAccOf(s))[0], 28) + '</td>' +
      '<td>' + s.perfect + '</td>' +
      '<td title="早' + s.earlyGood + ' / 晚' + s.lateGood + '">' + (s.earlyGood + s.lateGood) + '</td>' +
      '<td title="早' + s.earlyBad + ' / 晚' + s.lateBad + '">' + (s.earlyBad + s.lateBad) + '</td>' +
      '<td>' + s.miss + '</td>' +
      '<td>' + s.maxComboCount + '</td>' +
      '<td>' + (isZeroMiss(s) ? '<span class="chip fc">零 Miss</span>' : '<span class="chip">-</span>') + '</td>' +
      '</tr>';
  }).join('');
  document.querySelectorAll('#detail th').forEach(th => {
    th.onclick = () => {
      const k = th.dataset.key;
      if (state.sortKey === k) state.sortDir = -state.sortDir;
      else { state.sortKey = k; state.sortDir = (k === 'name' ? 1 : -1); }
      renderTable();
    };
  });
}
