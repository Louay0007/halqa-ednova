import { Suspense, lazy, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/session';
import { t } from './lib/i18n';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Shell } from './shell/Shell';
import { Landing } from './routes/Landing';
import { NotFound } from './routes/NotFound';
// Order matters: Tailwind is layered, so unlayered app CSS always outranks it.
import './styles/tailwind.css';
import './styles/tokens.css';
import './components/ui.css';
import './shell/shell.css';
import './styles/pages.css';
import './styles/night.css';
import './styles/night.fixes.css';

const Enter = lazy(() => import('./routes/Enter').then((m) => ({ default: m.Enter })));
const Dna = lazy(() => import('./routes/Dna').then((m) => ({ default: m.Dna })));
const Solo = lazy(() => import('./routes/Solo').then((m) => ({ default: m.Solo })));
const CirclesNew = lazy(() => import('./routes/CirclesNew').then((m) => ({ default: m.CirclesNew })));
const CirclesJoin = lazy(() => import('./routes/CirclesJoin').then((m) => ({ default: m.CirclesJoin })));
const Lobby = lazy(() => import('./routes/Lobby').then((m) => ({ default: m.Lobby })));
const SessionRoom = lazy(() => import('./routes/Session').then((m) => ({ default: m.SessionRoom })));
const Debrief = lazy(() => import('./routes/Debrief').then((m) => ({ default: m.Debrief })));
const Board = lazy(() => import('./routes/Board').then((m) => ({ default: m.Board })));
const Mentor = lazy(() => import('./routes/Mentor').then((m) => ({ default: m.Mentor })));
const Dashboard = lazy(() => import('./routes/Dashboard').then((m) => ({ default: m.Dashboard })));
const Lab = lazy(() => import('./routes/Lab').then((m) => ({ default: m.Lab })));
const Me = lazy(() => import('./routes/Me').then((m) => ({ default: m.Me })));

/**
 * Everything past the entry screen needs a token: the API is default-deny, so an
 * anonymous deep link would only render 401s. Bounce to `/enter` and remember
 * where they were heading so the flow resumes after sign-in.
 */
function RequireAuth({ children }: { children: ReactElement }) {
  const { authed } = useSession();
  const { pathname, search } = useLocation();
  if (!authed) return <Navigate to={`/enter?next=${encodeURIComponent(pathname + search)}`} replace />;
  return children;
}

/** Lazy route chunk placeholder — announced in the learner's own language, not
 *  a hardcoded English string read out by a screen reader mid-flow. */
function RouteFallback() {
  const { lang } = useSession();
  return <div className="skel" style={{ height: 120 }} role="status" aria-label={t('loading', lang)} />;
}

/**
 * Wraps the routed subtree so a render or lazy-chunk failure shows a recovery
 * card instead of blanking the app. Keyed by pathname so navigating away clears
 * the previous route's error rather than pinning it to the screen.
 */
function RouteBoundary({ children }: { children: ReactElement }) {
  const { lang } = useSession();
  const { pathname } = useLocation();
  return (
    <ErrorBoundary lang={lang} boundaryId={pathname}>
      {children}
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Shell>
          <RouteBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/enter" element={<Enter />} />
                <Route path="/dna" element={<RequireAuth>{<Dna />}</RequireAuth>} />
                <Route path="/solo" element={<RequireAuth>{<Solo />}</RequireAuth>} />
                <Route path="/circles/new" element={<RequireAuth>{<CirclesNew />}</RequireAuth>} />
                <Route path="/circles/join" element={<RequireAuth>{<CirclesJoin />}</RequireAuth>} />
                <Route path="/c/:circleId" element={<RequireAuth>{<Lobby />}</RequireAuth>} />
                <Route path="/c/:circleId/s/:sessionId" element={<RequireAuth>{<SessionRoom />}</RequireAuth>} />
                <Route path="/c/:circleId/s/:sessionId/debrief" element={<RequireAuth>{<Debrief />}</RequireAuth>} />
                {/* These three read mentor/admin surfaces. The API is default-deny for
                    them too (§3.4); the router should not render an admin screen to an
                    anonymous visitor just because it used to. */}
                <Route path="/board" element={<RequireAuth>{<Board />}</RequireAuth>} />
                <Route path="/mentor" element={<RequireAuth>{<Mentor />}</RequireAuth>} />
                <Route path="/dashboard" element={<RequireAuth>{<Dashboard />}</RequireAuth>} />
                {/* /lab is a demo/chaos surface: a build flag, not a role, because the
                    bundle itself must not ship the chaos console to the public. */}
                {import.meta.env.DEV && <Route path="/lab" element={<Lab />} />}
                <Route path="/me" element={<RequireAuth>{<Me />}</RequireAuth>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RouteBoundary>
        </Shell>
      </SessionProvider>
    </BrowserRouter>
  );
}
