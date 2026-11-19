import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../lib/i18n';
import type { Lang } from '../lib/api';

/**
 * A deploy replaces the hashed chunks the current tab has not loaded yet, so the
 * next navigation fails to import rather than throwing inside a component. That
 * is the single most common production failure for a lazily-routed SPA, and a
 * retry cannot fix it — only a reload fetches the new manifest.
 */
function isStaleBuild(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = `${e.name} ${e.message}`;
  return /ChunkLoadError|Loading chunk \d+ failed|dynamically imported module|Importing a module script failed/i.test(
    msg,
  );
}

interface Props {
  children: ReactNode;
  lang: Lang;
  /** Route key, so navigating elsewhere clears a previous failure. */
  boundaryId?: string;
}

interface State {
  error: Error | null;
  /** The boundaryId the error belongs to, so a later navigation clears it
   *  without a setState-in-update cycle. */
  atId?: string;
}

/**
 * Catches render/lazy-import failures below it and shows a localized recovery
 * card instead of a blank page. Deliberately a class component: React has no
 * hook equivalent for `componentDidCatch`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No error tracker is wired yet (plan §7.5). Until then the console is the
    // only record, and it must carry the component stack to be actionable.
    console.error('[halqa] render error', error, info.componentStack);
    this.setState({ atId: this.props.boundaryId });
  }

  private reload = () => window.location.reload();

  render(): ReactNode {
    const { error, atId } = this.state;
    // A navigation should not leave the previous route's error on screen: if the
    // failure belongs to a route we have since left, drop it during render.
    if (!error || atId !== this.props.boundaryId) return this.props.children;
    return <CrashCard lang={this.props.lang} stale={isStaleBuild(error)} onReload={this.reload} />;
  }
}

/**
 * The recovery card itself, split out so it can be rendered and audited without
 * throwing inside a boundary.
 *
 * React 19 re-throws a boundary-caught error out of whatever scope rendered it,
 * so a test that mounts a throwing child to inspect the fallback fails on the
 * fixture rather than on the assertion. Extracting the presentational half keeps
 * the a11y gate (§6.6) honest: it checks the card that actually ships, not a
 * hand-written replica of it.
 */
export function CrashCard({ lang, stale, onReload }: { lang: Lang; stale: boolean; onReload: () => void }): ReactNode {
  return (
    <section className="card" role="alert" style={{ margin: '24px auto', maxWidth: 560 }}>
      <h2>{t('error_title', lang)}</h2>
      <p className="muted">{stale ? t('error_stale_build', lang) : t('error_body', lang)}</p>
      <div className="row">
        <button type="button" className="btn" style={{ minHeight: 44 }} onClick={onReload}>
          {t('reload', lang)}
        </button>
        <a className="btn btn-ghost" style={{ minHeight: 44 }} href="/">
          {t('back_home', lang)}
        </a>
      </div>
    </section>
  );
}
