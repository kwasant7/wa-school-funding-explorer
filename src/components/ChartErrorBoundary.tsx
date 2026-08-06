'use client';

/**
 * Wraps a single chart so its failure degrades to a message instead of
 * taking the whole route down. `error.tsx` catches everything else on a
 * page, but it replaces the entire route - a map that throws on malformed
 * boundary data would hide the stat tiles and every other chart on the same
 * page, none of which had anything wrong with them.
 *
 * Class component because React only supports error boundaries via
 * `componentDidCatch`/`getDerivedStateFromError` - there is no hook
 * equivalent.
 */
import { Component, type ReactNode } from 'react';

export default class ChartErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="card p-5 text-sm text-ink-secondary">
          {this.props.label} couldn&apos;t load. Reloading the page usually
          fixes this.
        </div>
      );
    }
    return this.props.children;
  }
}
