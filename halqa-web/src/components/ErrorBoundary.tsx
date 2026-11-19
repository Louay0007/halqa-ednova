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

    const { lang } = this.props;
    const stale = isStaleBuild(error);

    return (
      <section className="card" role="alert" style={{ margin: '24px auto', maxWidth: 560 }}>
        <h2>{t('error_title', lang)}</h2>
        <p className="muted">{stale ? t('error_stale_build', lang) : t('error_body', lang)}</p>
        <div className="row">
          <button type="button" className="btn" style={{ minHeight: 44 }} onClick={this.reload}>
            {t('reload', lang)}
          </button>
          <a className="btn btn-ghost" style={{ minHeight: 44 }} href="/">
            {t('back_home', lang)}
          </a>
        </div>
      </section>
    );
  }
}
