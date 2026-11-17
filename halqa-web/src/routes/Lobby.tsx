import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote, SbuRings } from '../components/ui';
import { Reveal } from '../lib/motion';
import { t } from '../lib/i18n';
import { iconFor } from '../lib/avatars';

interface Member {
  learnerId: string;
  role: string;
  nickname?: string;
  avatarKey?: string;
}

export function Lobby() {
  const { circleId = '' } = useParams();
  const nav = useNavigate();
  const { lang, learnerId, setCircleId, setSessionId } = useSession();
  const [circle, setCircle] = useState<{ topic: string; members: Member[]; joinCode: string; windowS: number } | null>(null);
  const [cards, setCards] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setCircleId(circleId);
    api
      .circleGet(circleId)
      .then(async (r) => {
        setCircle(r.data);
        const next: Record<string, string> = {};
        for (const m of r.data.members) {
          try {
            const c = await api.explainCard(m.learnerId);
            if (c.data.visible) next[m.learnerId] = c.data.card;
          } catch {
            /* opt-in: hidden cards stay hidden */
          }
        }
        setCards(next);
      })
      .catch((e: ApiFailure) => setErr(e.body?.user_msg?.[lang] ?? '—'));
  }, [circleId, lang, setCircleId]);

  const start = async () => {
    setStarting(true);
    setErr(null);
    try {
      const r = await api.sessionStart(circleId);
      setSessionId(r.sessionId);
      nav(`/c/${circleId}/s/${r.sessionId}`);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? '—');
    } finally {
      setStarting(false);
    }
  };

  if (err) return <div className="page narrow"><ErrorNote code="LOBBY" msg={err} retryable onRetry={() => location.reload()} /></div>;
  if (!circle) return <div className="page narrow"><div className="skel" style={{ height: 120 }} /><div className="skel" style={{ height: 80 }} /></div>;

  const isHost = circle.members.some((m) => m.learnerId === learnerId && (m.role === 'host' || m.role === 'HOST'));
  const shareUrl = `${location.origin}/circles/join?code=${circle.joinCode}`;

  return (
    <div className="page lobby">
      <Reveal as="header" className="lobby-head card" index={0}>
        <div>
          <h1 translate="no">{circle.topic}</h1>
          <p className="muted tnum">
            {t('code_label', lang)} <strong translate="no">{circle.joinCode}</strong> · {t('peer_window', lang)} <strong>{circle.windowS}s</strong>
          </p>
        </div>
        <SbuRings S={0.3} B={0.5} U={0.5} />
      </Reveal>

      <Reveal as="section" className="card lobby-share" index={1}>
        <p className="hint">{t('share_hint', lang)}</p>
        <code className="tnum" translate="no">{shareUrl}</code>
        <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} onClick={() => {
          navigator.clipboard?.writeText(circle.joinCode).catch(() => undefined);
          setCopied(true);
        }}>
          {copied ? t('copied', lang) : t('code_copy', lang)}
        </button>
      </Reveal>

      <Reveal as="section" className="card lobby-roster" index={2}>
        <h2>{t('members', lang)} ({circle.members.length})</h2>
        <ul className="members roster">
          {circle.members.map((m) => {
            const host = m.role === 'host' || m.role === 'HOST';
            return (
              <li key={m.learnerId} className={`card member roster-member${host ? ' roster-host' : ''}`}>
                <span className="member-glyph" aria-hidden="true" translate="no">{iconFor(m.avatarKey)}</span>
                <strong translate="no">{m.nickname ?? m.learnerId}</strong>
                {host && <span className="host-crown" title={t('host', lang)} aria-label={t('host', lang)}>♛</span>}
                <span className="muted" translate="no">{m.role}</span>
                {cards[m.learnerId] && (
                  <blockquote className="explain-card roster-explain" translate="no">{cards[m.learnerId]}</blockquote>
                )}
              </li>
            );
          })}
        </ul>
      </Reveal>

      <Reveal as="section" className="card lobby-agenda" index={3}>
        <h2>{t('agenda_preview', lang)}</h2>
        <ol className="agenda">
          {['goal', 'explain', 'challenge', 'teachback', 'recap'].map((s, i) => (
            <li key={s}><span className="agenda-tick tnum">{i + 1}</span><span translate="no">{s}</span></li>
          ))}
        </ol>
      </Reveal>

      <div className="lobby-actions">
        {isHost ? (
          <button type="button" className="btn" style={{ minHeight: 44 }} onClick={start} disabled={starting}>
            {starting ? '…' : t('start_session', lang)}
          </button>
        ) : (
          <p className="hint waiting-host">{t('waiting_host', lang)}</p>
        )}
      </div>
    </div>
  );
}
