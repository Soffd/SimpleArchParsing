// ======== 成绩海报导出 ========
function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawCoverImg(ctx, im, x, y, w, h) {
  const ir = im.width / im.height, r = w / h;
  let sw, sh, sx, sy;
  if (ir > r) { sh = im.height; sw = sh * r; sx = (im.width - sw) / 2; sy = 0; }
  else { sw = im.width; sh = sw / r; sx = 0; sy = 0; }
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}
async function exportPoster() {
  if (!state.info) return;
  const canvas = document.getElementById('posterCanvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) { alert('当前环境不支持 Canvas 导出'); return; }
  const scores = state.info.scores.slice().sort((a, b) => accOf(b) - accOf(a));
  if (!scores.length) { alert('没有成绩数据'); return; }
  const allAcc = aggAcc(scores);
  const gr = gradeOf(aggAccGame(scores));
  const grades = [...new Set([gr[0], ...scores.map(s => gradeOf(gameAccOf(s))[0])])];
  const rankImages = Object.fromEntries(await Promise.all(grades.map(async grade =>
    [grade, await loadImg(RANK_BASE + '/ScoreLevel_' + gradeKey(grade) + '.png').catch(() => null)]
  )));
  // Contain the original transparent artwork without cropping or stretching it.
  const drawRank = (grade, x, y, width, height) => {
    const im = rankImages[grade];
    ctx.save();
    if (im) {
      const scale = Math.min(width / im.width, height / im.height);
      const w = im.width * scale, h = im.height * scale;
      ctx.drawImage(im, x + (width - w) / 2, y + (height - h) / 2, w, h);
    } else {
      ctx.fillStyle = GRADE_COLOR[grade];
      ctx.font = '500 ' + height + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(grade, x + width / 2, y + height / 2, width);
    }
    ctx.restore();
  };
  const W = 1200, headH = 268, rowH = 170, footH = 64;
  const colors = getComputedStyle(document.documentElement);
  const ink=colors.getPropertyValue('--txt').trim(), muted=colors.getPropertyValue('--dim').trim(), surface=colors.getPropertyValue('--card').trim();
  const H = headH + Math.ceil(scores.length / 3) * rowH + footH;
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = colors.getPropertyValue('--bg').trim(); ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, headH);
  g.addColorStop(0, surface); g.addColorStop(1, surface);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, headH);
  ctx.fillStyle = colors.getPropertyValue('--teal').trim();
  ctx.fillRect(56, 196, W - 112, 2);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = ink; ctx.font = '400 36px SimSun, serif';
  ctx.fillText('Simple · 成绩单', 56, 72);
  ctx.fillStyle = ink; ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillText((state.info.playerName || 'Player') + (state.info.deviceInfo ? '  ·  ' + state.info.deviceInfo : ''), 56, 112, 650);
  ctx.fillStyle = muted; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('生成于 ' + new Date().toLocaleString() + ' · 共 ' + scores.length + ' 个谱面成绩', 56, 150);
  // Two aligned columns: a prominent ACC value and the game's rank artwork.
  ctx.textAlign = 'right';
  ctx.fillStyle = muted; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('平均 ACC', 1012, 55);
  ctx.fillStyle = ink; ctx.font = '300 58px system-ui, sans-serif';
  ctx.fillText(fmtPct(allAcc).slice(0, -1), 981, 116);
  ctx.fillStyle = muted; ctx.font = '300 25px system-ui, sans-serif';
  ctx.fillText('%', 1012, 116);
  ctx.save(); ctx.globalAlpha = 0.25;
  ctx.fillStyle = muted; ctx.fillRect(1036, 44, 1, 102); ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = muted; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('评级', 1098, 55);
  drawRank(gr[0], 1058, 71, 80, 72);
  ctx.textAlign = 'right'; ctx.fillStyle = muted; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(state.agg === 'weighted' ? '按判定数加权' : '各谱面等权', 1012, 146);
  ctx.textAlign = 'left';
  let fc = 0, notes = 0;
  for (const s of scores) { if (isZeroMiss(s)) fc++; notes += den(s); }
  ctx.fillStyle = ink; ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('零 Miss ' + fc + '  ·  总音符 ' + notes + '  ·  ACC 权重 P1 / G' + state.wG + ' / B' + state.wB, 56, 236);
  const imgs = await Promise.all(scores.map(s => {
    const u = thumbOf(s);
    return u ? loadImg(u).catch(() => null) : Promise.resolve(null);
  }));
  scores.forEach((s, i) => {
    const y = headH + Math.floor(i / 3) * rowH;
    ctx.save(); ctx.translate((i % 3) * 386, 0);
    ctx.fillStyle = surface;
    roundRectPath(ctx, 20, y + 8, 376, rowH - 12, 28);
    ctx.fill();
    const im = imgs[i];
    if (im) {
      ctx.save();
      roundRectPath(ctx, 30, y + 22, 96, 80, 25);
      ctx.clip();
      drawCoverImg(ctx, im, 30, y + 22, 96, 80);
      ctx.restore();
    } else {
      ctx.fillStyle = '#1a2236';
      roundRectPath(ctx, 30, y + 22, 96, 80, 25);
      ctx.fill();
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ink; ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(titleOf(s), 140, y + 30, 240);
    const c = chartOf(s);
    ctx.fillStyle = muted; ctx.font = '15px system-ui, sans-serif';
    ctx.fillText((MUSIC_DB[s.musicName] || {}).composer || '曲师未知', 140, y + 51, 230);
    const color = DIFF_COLORS[s.hard] || '#8f97b0';
    ctx.fillStyle = color; ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText((HARD_NAMES[s.hard] || s.hard) + (c ? ' Lv' + c.lv : ''), 140, y + 72);
    if (isZeroMiss(s)) {
      ctx.fillStyle = colors.getPropertyValue('--acc').trim(); ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('零 Miss', 140, y + 95);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = ink; ctx.font = '700 24px ui-monospace, Consolas, monospace';
    ctx.fillText(scoreOf(s).toLocaleString('en-US'), 382, y + 105);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('ACC ' + fmtPct(accOf(s)), 382, y + 130);
    const rank = gradeOf(gameAccOf(s));
    drawRank(rank[0], 34, y + 111, 62, 38);
    ctx.textAlign = 'right';
    ctx.fillStyle = muted; ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.fillText('P' + s.perfect + '  G' + (s.earlyGood + s.lateGood) + '  B' + (s.earlyBad + s.lateBad) + '  M' + s.miss, 382, y + 152);
    ctx.restore();
  });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = muted; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('by SimpleArchParsing', W / 2, H - 26);
  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simple_score_' + (state.info.playerName || 'player').replace(/[\\/:*?"<>|]/g, '_') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    alert('导出失败：当前环境（可能是 file:// 直接打开）不允许合成本地图片。\n请用本地服务器（python3 -m http.server）或云端地址访问后再导出。');
  }
}
