import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

async function boot() {
  // Boot gate: backend must answer /healthz before the shell renders.
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api/v1';
  try {
    const r = await fetch(`${base}/healthz`);
    if (!r.ok) throw new Error();
  } catch {
    const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api/v1';
    document.getElementById('root')!.innerHTML =
      `<main style="padding:2rem;font-family:system-ui"><h1>Backend unreachable</h1><p>Start halqa-api first, set <code>VITE_API_BASE=${base}</code> in <code>halqa-web/.env.local</code>, then reload.</p></main>`;
    return;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
