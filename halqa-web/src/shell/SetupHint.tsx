import { t } from '../lib/i18n';
import type { Lang } from '../lib/api';

/** Spec §3.5 boot gate — rendered instead of the app shell when /readyz
 *  fails at startup, so a stopped backend never produces a blank screen. */
export function SetupHint({ lang, onRetry }: { lang: Lang; onRetry: () => void }) {
  return (
    <div className="page narrow setup-hint" role="alert">
      <div className="card">
        <h1>{t('setup_hint', lang)}</h1>
        <p className="muted">{t('setup_hint_body', lang)}</p>
        <p>
          <code className="tnum" translate="no">
            {t('setup_hint_cmd', lang)}
          </code>
        </p>
        <button type="button" className="btn" onClick={onRetry} style={{ minHeight: 44 }}>
          {t('retry', lang)}
        </button>
      </div>
    </div>
  );
}
