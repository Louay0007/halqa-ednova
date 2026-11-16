import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';

// Render immediately. The API is probed in the background and, if it is down,
// a dismissible notice appears — the shell, hero and offline tools still work.
// ponytail: no boot gate. Add one back only if a screen must hard-block on the API.
const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api/v1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

function notice(msg: string) {
  const el = document.createElement('div');
  el.className = 'api-notice';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${msg}</span><button type="button" aria-label="Dismiss">✕</button>`;
  el.querySelector('button')!.onclick = () => el.remove();
  document.querySelector('.shell')?.prepend(el);
}

fetch(`${base}/healthz`, { signal: AbortSignal.timeout(4000) })
  .then((r) => {
    if (!r.ok) throw new Error(String(r.status));
  })
  .catch(() => {
    // Deferred one frame so .shell exists.
    requestAnimationFrame(() =>
      notice(`API unreachable at <code>${base}</code> — offline tools still work. Notice auto-hides when the API is up.`),
    );
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) {
          clearInterval(id);
          document.querySelector('.api-notice')?.remove();
        }
      } catch {
        /* keep the notice */
      }
    }, 5000);
  });

// The service worker is generated (registerType: 'autoUpdate') but nothing registered it,
// so a deployed build could serve stale assets forever. Prompt instead of silently reloading:
// a learner mid-question would lose the peer window.
registerSW({
  onNeedRefresh() {
    const el = document.createElement('div');
    el.className = 'api-notice';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>A newer version is available.</span><button type="button">Reload</button>';
    el.querySelector('button')!.onclick = () => location.reload();
    document.querySelector('.shell')?.prepend(el);
  },
});
