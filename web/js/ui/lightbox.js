// ======== 大图查看器 ========
function showLB() {
  const s = state.lbList[state.lbIndex];
  if (!s) return;
  const el = document.getElementById('lightbox');
  el.hidden = false;
  el.style.display = 'flex';
  document.getElementById('lbImg').src = fullOf(s) || thumbOf(s);
  const c = chartOf(s);
  document.getElementById('lbTitle').textContent = titleOf(s) + '  [' + (HARD_NAMES[s.hard] || s.hard) + (c ? ' Lv' + c.lv : '') + ']';
  document.getElementById('lbMeta').textContent = s.musicName + ' · ' + chapterOf(s) + ' · ACC ' + fmtPct(accOf(s)) + ' · ' + (state.lbIndex + 1) + ' / ' + state.lbList.length;
  const a = document.getElementById('lbOrig');
  a.href = origOf(s);
  a.setAttribute('download', (ilOf(s) || 'cover') + '.png');
}
function closeLB() {
  const el = document.getElementById('lightbox');
  el.hidden = true;
  el.style.display = 'none';
  document.getElementById('lbImg').removeAttribute('src');
}
function lbStep(d) {
  const n = state.lbList.length;
  if (!n) return;
  state.lbIndex = (state.lbIndex + d + n) % n;
  showLB();
}
document.addEventListener('click', (e) => {
  const t = e.target;
  const img = (t && t.closest) ? t.closest('img[data-lb]') : null;
  if (!img) return;
  const key = img.getAttribute('data-lb');
  const list = filteredScores().slice().sort((a, b) => accOf(b) - accOf(a));
  const idx = list.findIndex(s => (s.musicName + '|' + s.hard) === key);
  if (idx >= 0) { state.lbList = list; state.lbIndex = idx; showLB(); }
});
document.getElementById('lbClose').onclick = closeLB;
document.getElementById('lbBack').onclick = closeLB;
document.getElementById('lbPrev').onclick = () => lbStep(-1);
document.getElementById('lbNext').onclick = () => lbStep(1);
document.addEventListener('keydown', (e) => {
  if (document.getElementById('lightbox').hidden) return;
  if (e.key === 'Escape') closeLB();
  else if (e.key === 'ArrowLeft') lbStep(-1);
  else if (e.key === 'ArrowRight') lbStep(1);
});
