import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

export function Landing() {
  const { lang } = useSession();
  const [docs, setDocs] = useState<number | null>(null);
  useEffect(() => {
    api
      .kbStats()
      .then((r) => setDocs(r.data.docs))
      .catch(() => undefined);
  }, []);
  return (
    <div className="page">
      <section className="hero">
        <h1>
          الحلقة تعلّم <span className="hero-sep">—</span> No voice left behind.
        </h1>
        <p className="lede">
          {lang === 'fr'
            ? 'Un cercle d’étude où les pairs parlent d’abord, et Nova — médiateur, équipier, tuteur, animateur — équilibre, vérifie et éclaire.'
            : 'A study circle where peers speak first, and Nova — mediator, teammate, tutor, facilitator — balances, verifies and lights the way.'}
        </p>
        <div className="cta-row">
          <Link className="btn" to="/enter?context=solo">
            ▶ Solo — علّم Nova
          </Link>
          <Link className="btn btn-ghost" to="/enter">
            👥 Circle
          </Link>
        </div>
      </section>
      <section className="hats" aria-label="Nova roles">
        {[
          ['Mediator · وسيط', 'Balances voices, invites the quiet, cools dominators.'],
          ['Teammate · زميل', 'Thinks aloud with you — sometimes wrong so you correct it.'],
          ['Tutor · معلّم', 'Explains at your level, style and language, grounded in lessons.'],
          ['Facilitator · مسيّر', 'Runs the clock, the hints, the checks and the close.'],
        ].map(([h, d], i) => (
          <article key={h} className="card hat-card">
            <h2>
              {['🟣', '🟢', '🔵', '🟡'][i]} {h}
            </h2>
            <p>{d}</p>
          </article>
        ))}
      </section>
      <section className="card loop" aria-label="Session loop">
        <h2>① Diagnose → ② Discuss → ③ Do → ④ Debrief</h2>
        <p>3 min · 8 min · 9 min · 5 min — a 25-minute circle that ends with revision notes.</p>
      </section>
      <section className="trust" aria-label="Trust">
        <p>
          <strong className="tnum">{docs ?? 39} synthetic KB chunks</strong> · 4 languages · offline-ready · no signup · anonymous by design.
        </p>
        <p className="muted">Anonymous · synthetic data only · the AI supports teachers, never replaces them. IEEE SB/WIE.</p>
      </section>
    </div>
  );
}
