import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote, SbuRings } from '../components/ui';
import { Reveal, useSectionReveal } from '../lib/motion';
import { t, topicLabel } from '../lib/i18n';

interface CircleCard {
  id: string;
  topic: string;
  S?: number;
  B?: number;
  U?: number;
  needsHuman?: boolean;
  noSession?: boolean;
}

export function Board() {
  const { lang } = useSession();
  const [nicks, setNicks] = useState('');
  const [groups, setGroups] = useState<Array<{ circleId: string; learnerIds: string[]; rationale: string }>>([]);
  const [circles, setCircles] = useState<CircleCard[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    api.board().then((r) => setCircles(r.data.circles)).catch(() => undefined);
  };
  useEffect(() => {
    load();
    const id = setInterval(() => !document.hidden && load(), 5000);
    return () => clearInterval(id);
  }, []);

  const match = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = nicks.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    setErr(null);
    setCreating(true);
    try {
      const r = await api.match(list, 2026);
      setGroups(r.groups);
    } catch (e) {
      setErr(((e as { body?: { user_msg?: Record<string, string> } }).body?.user_msg?.[lang]) ?? '—');
    } finally {
      setCreating(false);
    }
  };

  const reveal = useSectionReveal(1);
  return (
    <div className="page board">
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('board_title', lang)}</h1>
        <p className="muted">{t('board_sub', lang)}</p>
      </Reveal>

      <form onSubmit={match} className="card stack matcher" {...reveal}>
        <label htmlFor="nicks">{t('matcher_label', lang)}</label>
        <textarea id="nicks" rows={4} value={nicks} onChange={(e) => setNicks(e.target.value)} placeholder={'Rim\nAhmed\nNour…'} />
        <button type="submit" className="btn" style={{ minHeight: 44 }} disabled={creating || !nicks.trim()}>
          {creating ? '…' : t('match_btn', lang)}
        </button>
        {groups.map((g, gi) => (
          <div key={g.circleId} className="match-group">
            {/* The matcher returns `C-match-1…`, a position label, not a circle.
                Naming it "group 2" is honest; showing the fake id was not. */}
            <strong>{t('match_group', lang, { n: gi + 1 })}</strong>
            <div className="match-chips">
              {g.learnerIds.map((l) => <span key={l} className="chip" translate="no">{l}</span>)}
            </div>
            <p className="muted" translate="no">{g.rationale}</p>
          </div>
        ))}
        {err && <ErrorNote code="MATCH" msg={err} retryable={false} />}
      </form>

      <section className="board-grid" aria-label={t('circles', lang)}>
        {circles.map((c, i) => (
          <Reveal as="article" key={c.id} className={`card board-card${c.needsHuman ? ' needs-human' : ''}`} index={i + 2}>
            {/* The topic is the circle's name to a human; the id is a reference,
                so it moves to a muted line under it instead of being the <h2>. */}
            <h2>{topicLabel(c.topic, lang)}</h2>
            <p className="hint tnum" translate="no">{c.id}</p>
            {c.noSession ? (
              <span className="muted">{t('no_session', lang)}</span>
            ) : (
              <>
                {/* No measured S-B-U means no rings. The old `?? 0.5` defaults
                    drew a perfectly healthy circle out of missing data — the same
                    visual language the app uses for measured health. */}
                {typeof c.S === 'number' && typeof c.B === 'number' && typeof c.U === 'number' ? (
                  <SbuRings S={c.S} B={c.B} U={c.U} />
                ) : (
                  <span className="muted">{t('no_session', lang)}</span>
                )}
                {c.needsHuman && (
                  <Link className="needs-human-link" to={`/mentor?circleId=${c.id}`}>
                    {t('needs_human_now', lang)} →
                  </Link>
                )}
              </>
            )}
          </Reveal>
        ))}
        {circles.length === 0 && (
          <p className="muted empty-board">{t('no_circles', lang)}</p>
        )}
      </section>
    </div>
  );
}
