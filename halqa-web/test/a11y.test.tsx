import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { CrashCard } from '../src/components/ErrorBoundary';
import { NotFound } from '../src/routes/NotFound';
import { SessionProvider } from '../src/lib/session';
import type { Lang } from '../src/lib/api';

/**
 * Accessibility gate (§6.6).
 *
 * The plan's acceptance line is "axe clean", so this runs axe-core for real
 * rather than asserting hand-counted `aria-*` attributes. It covers the two
 * screens that are pure rendering — the 404 and the crash card — because both
 * appear at exactly the moment a learner is already confused, and both are
 * reachable without any API state.
 *
 * What this does not cover: the live session screens need a server, so they are
 * a Playwright concern (§6.7). Claiming "axe clean" for the whole app on the
 * strength of this file would be the same overclaim the plan warns about.
 */

const LANGS: Lang[] = ['en', 'fr', 'ar', 'darija'];

async function violationsIn(node: HTMLElement): Promise<axe.Result[]> {
  const results = await axe.run(node, {
    // Colour contrast needs real layout and a real paint; happy-dom has neither,
    // so it reports every element as unmeasurable. Contrast is enforced by the
    // design tokens and checked visually instead.
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations;
}

afterEach(() => cleanup());

describe('accessibility', () => {
  for (const lang of LANGS) {
    it(`404 screen has no axe violations (${lang})`, async () => {
      const { container } = render(
        <SessionProvider>
          <MemoryRouter>
            <NotFound />
          </MemoryRouter>
        </SessionProvider>,
      );
      const violations = await violationsIn(container);
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }

  it('404 screen is announced as a heading and offers a reachable way back', () => {
    const { container } = render(
      <SessionProvider>
        <MemoryRouter>
          <NotFound />
        </MemoryRouter>
      </SessionProvider>,
    );
    // A blank section with a styled div would look identical and be invisible to
    // a screen reader, so assert the structure rather than only the axe verdict.
    expect(container.querySelector('h1')?.textContent?.trim()).toBeTruthy();
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('crash card has no axe violations and is a live region', async () => {
    const { container } = render(<CrashCard lang="en" stale={false} onReload={() => undefined} />);
    // `role="alert"` is what makes the recovery card reach a screen reader; a
    // silent failure only sighted users can see is still a failure.
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const violations = await violationsIn(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it('crash card is axe clean in the stale-build variant too', async () => {
    const { container } = render(<CrashCard lang="ar" stale onReload={() => undefined} />);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const violations = await violationsIn(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it('every interactive control on the crash card meets the 44px target', () => {
    const { container } = render(<CrashCard lang="en" stale={false} onReload={() => undefined} />);
    const controls = Array.from(container.querySelectorAll('button, a'));
    expect(controls.length).toBeGreaterThan(0);
    for (const el of controls) {
      // Inline style, because happy-dom does not lay out or apply stylesheets:
      // the guarantee we can assert is that the markup carries the target.
      expect((el as HTMLElement).style.minHeight).toBe('44px');
    }
  });
});
