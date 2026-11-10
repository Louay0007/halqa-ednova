import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './lib/session';
import { Shell } from './shell/Shell';
import { Landing } from './routes/Landing';
import './styles/tokens.css';
import './components/ui.css';
import './shell/shell.css';
import './styles/pages.css';

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

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Shell>
          <Suspense fallback={<div className="skel" style={{ height: 120 }} role="status" aria-label="Loading…" />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/enter" element={<Enter />} />
              <Route path="/dna" element={<Dna />} />
              <Route path="/solo" element={<Solo />} />
              <Route path="/circles/new" element={<CirclesNew />} />
              <Route path="/circles/join" element={<CirclesJoin />} />
              <Route path="/c/:circleId" element={<Lobby />} />
              <Route path="/c/:circleId/s/:sessionId" element={<SessionRoom />} />
              <Route path="/c/:circleId/s/:sessionId/debrief" element={<Debrief />} />
              <Route path="/board" element={<Board />} />
              <Route path="/mentor" element={<Mentor />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/lab" element={<Lab />} />
              <Route path="/me" element={<Me />} />
              <Route path="*" element={<Landing />} />
            </Routes>
          </Suspense>
        </Shell>
      </SessionProvider>
    </BrowserRouter>
  );
}
