function showError(msg) {
  const el = document.getElementById('error');
  el.hidden = false;
  el.textContent = msg;
}
function hideError() { document.getElementById('error').hidden = true; }
function doParse(text) {
  try {
    const bytes = textToBytes(text);
    const info = detectAndParse(bytes);
    state.info = info;
    resetFilters();
    const sb = document.getElementById('searchBox');
    if (sb) sb.value = '';
    hideError();
    renderAll();
  } catch (e) {
    showError('解析失败：' + e.message);
  }
}

// ======== 事件绑定 ========
document.getElementById('parseBtn').onclick = () => doParse(document.getElementById('codeInput').value);
document.getElementById('sampleBtn').onclick = () => {
  document.getElementById('codeInput').value = SAMPLE_CODE;
  doParse(SAMPLE_CODE);
};
document.getElementById('clearBtn').onclick = () => {
  document.getElementById('codeInput').value = '';
  document.getElementById('result').hidden = true;
  hideError();
  state.info = null;
  closeLB();
  resetFilters();
  document.getElementById('fileInput').value = '';
};
document.getElementById('fileInput').onchange = async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    const buf = new Uint8Array(await f.arrayBuffer());
    const info = detectAndParse(buf);
    state.info = info;
    resetFilters();
    hideError();
    renderAll();
  } catch (err) {
    showError('解析失败：' + err.message);
  }
};
document.getElementById('pUnion').onclick = () => {
  const el = document.getElementById('pUnion');
  state.unionShown = !state.unionShown;
  const full = el.dataset.full || '';
  el.textContent = state.unionShown ? (full || '无') : (full ? maskUnion(full) : '无');
};
document.getElementById('searchBox').oninput = (e) => {
  state.filter = e.target.value.trim().toLowerCase();
  if (state.info) { renderCards(); renderTable(); }
};
document.getElementById('posterBtn').onclick = exportPoster;
document.getElementById('copyJsonBtn').onclick = async () => {
  if (!state.info) return;
  const text = JSON.stringify(state.info, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert('已复制 JSON 到剪贴板');
  } catch (e) {
    prompt('自动复制失败，请手动复制：', text);
  }
};
document.getElementById('aggSel').onchange = (e) => { state.agg = e.target.value; if (state.info) renderAll(); };
const wG = document.getElementById('wGRange'), wB = document.getElementById('wBRange');
wG.oninput = () => { state.wG = parseFloat(wG.value); document.getElementById('wGVal').textContent = state.wG.toFixed(2); if (state.info) renderAll(); };
wB.oninput = () => { state.wB = parseFloat(wB.value); document.getElementById('wBVal').textContent = state.wB.toFixed(2); if (state.info) renderAll(); };
let rzTimer = null;
window.addEventListener('resize', () => {
  if (!state.info) return;
  clearTimeout(rzTimer);
  rzTimer = setTimeout(() => { renderAccChart(); renderJudgeChart(); }, 180);
});
(function () {
  const qs = new URLSearchParams(location.search);
  const code = qs.get('code') || (location.hash.indexOf('#code=') === 0 ? decodeURIComponent(location.hash.slice(6)) : '');
  if (code) { document.getElementById('codeInput').value = code; doParse(code); }
})();

function resetFilters() {
  state.filter=''; state.difficulty=''; state.status=''; state.unionShown=false;
  ['searchBox','difficultyFilter','statusFilter'].forEach(id=>document.getElementById(id).value='');
}
['acc', 'judge'].forEach(prefix => {
  const render = prefix === 'acc' ? renderAccChart : renderJudgeChart;
  ['Sort', 'Direction'].forEach(field => {
    document.getElementById(prefix + field).onchange = e => {
      state[prefix + field] = field === 'Direction' ? Number(e.target.value) : e.target.value;
      if (state.info) render();
    };
  });
});
['difficultyFilter','statusFilter'].forEach((id,i)=>{
  document.getElementById(id).onchange=e=>{
    state[i?'status':'difficulty']=e.target.value;
    if(state.info){renderCards();renderTable();}
  };
});

['cardSort','cardDirection'].forEach(id=>{
  document.getElementById(id).onchange=e=>{
    state[id]=id==='cardDirection'?Number(e.target.value):e.target.value;
    if(state.info) renderCards();
  };
});
