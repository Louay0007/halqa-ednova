import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { t } from './lib/i18n';
import type { Lang } from './lib/api';

// Render immediately. The API is probed in the background and, if it is down,
// a dismissible notice appears — the shell, hero and offline tools still work.
// ponytail: no boot gate. Add one back only if a screen must hard-block on the API.
const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api/v1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/** These banners live outside React, so they cannot use the session context; they
 *  read the same persisted key the provider writes. Text is set with textContent —
 *  the message embeds `base`, which is env-supplied and must not be parsed as HTML. */
const lang = (): Lang => (sessionStorage.getItem('halqa.lang') as Lang) || 'fr';

function banner(text: string, action: { label: string; ariaLabel?: string; onClick: () => void }) {
  const el = document.createElement('div');
  el.className = 'api-notice';
  el.setAttribute('role', 'status');
  const msg = document.createElement('span');
  msg.textContent = text;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = action.label;
  btn.setAttribute('aria-label', action.ariaLabel ?? action.label);
  btn.onclick = action.onClick;
  el.append(msg, btn);
  document.querySelector('.shell')?.prepend(el);
  return el;
}

fetch(`${base}/healthz`, { signal: AbortSignal.timeout(4000) })
  .then((r) => {
    if (!r.ok) throw new Error(String(r.status));
  })
  .catch(() => {
    // Deferred one frame so .shell exists.
    requestAnimationFrame(() =>
      banner(t('api_down', lang(), { base }), { label: '✕', ariaLabel: t('dismiss', lang()), onClick: () => document.querySelector('.api-notice')?.remove() }),
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
    banner(t('sw_newer', lang()), { label: t('reload', lang()), onClick: () => location.reload() });
  },
});
