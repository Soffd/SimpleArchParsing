/* Loaded before the body to avoid a flash of the wrong theme. */
(() => {
  let saved;
  try { saved = localStorage.getItem('simple-theme'); } catch (_) {}
  const media = matchMedia('(prefers-color-scheme: dark)');
  const apply = theme => {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('themeToggle');
    if (button) { button.textContent = theme === 'dark' ? '☀ 日间模式' : '☾ 夜间模式'; button.setAttribute('aria-pressed', String(theme === 'dark')); }
  };
  apply(saved || (media.matches ? 'dark' : 'light'));
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.getElementById('themeToggle').onclick = () => {
      saved = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(saved); try { localStorage.setItem('simple-theme', saved); } catch (_) {}
    };
  });
  media.addEventListener('change', e => { if (!saved) apply(e.matches ? 'dark' : 'light'); });
})();
