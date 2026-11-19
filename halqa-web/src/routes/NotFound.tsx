import { Link } from 'react-router-dom';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';

/**
 * A mistyped or expired deep link used to fall through to the landing page, so
 * "no such circle" and "welcome" rendered identically. Say what happened and
 * offer the way back.
 */
export function NotFound() {
  const { lang } = useSession();
  return (
    <section className="card" style={{ margin: '24px auto', maxWidth: 560 }}>
      <h1>{t('not_found_title', lang)}</h1>
      <p className="muted">{t('not_found_body', lang)}</p>
      <Link className="btn" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }} to="/">
        {t('back_home', lang)}
      </Link>
    </section>
  );
}
