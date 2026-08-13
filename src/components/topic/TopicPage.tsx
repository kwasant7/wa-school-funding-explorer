import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/site-metadata';
import type { RankedDistrict } from '@/lib/topic-stats';
import { fmtInt, fmtMoneyFull, fmtSignedMoney } from '@/lib/format';

/**
 * Shared chrome for the six topic explainers: breadcrumb, H1, structured data,
 * and the related-reading block. Each page supplies its own body.
 *
 * One component rather than six near-copies so the heading hierarchy, the
 * breadcrumb trail and the JSON-LD stay identical across the set - the places
 * where hand-copied SEO markup usually drifts first.
 */

export type Related = { href: string; title: string; blurb: string };

export function TopicPage({
  title,
  h1,
  description,
  path,
  lede,
  children,
  related,
}: {
  title: string;
  /** Visible heading, when it should read shorter than the <title> tag. */
  h1?: string;
  description: string;
  path: string;
  lede: React.ReactNode;
  children: React.ReactNode;
  related: Related[];
}) {
  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pb-16">
      <JsonLd
        data={[
          webPageJsonLd({ title, description, path }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: h1 ?? title, path },
          ]),
        ]}
      />

      <nav aria-label="Breadcrumb" className="pt-6 text-sm text-ink-secondary">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="text-accent hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {h1 ?? title}
          </li>
        </ol>
      </nav>

      <article className="pt-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight max-w-3xl">
          {h1 ?? title}
        </h1>
        <div className="mt-4 text-lg text-ink-secondary">{lede}</div>
        {children}
      </article>

      <section aria-labelledby="related" className="pt-12">
        <h2 id="related" className="text-xl md:text-2xl font-bold tracking-tight">
          Related
        </h2>
        <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {related.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="card block p-4 h-full hover:border-accent transition-colors"
              >
                <p className="font-semibold">{r.title}</p>
                <p className="mt-1 text-sm text-ink-secondary">{r.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TopicSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="pt-10">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-4 max-w-3xl space-y-4 text-ink-secondary">{children}</div>
    </section>
  );
}

/** A statewide allocation-vs-actual comparison, stated once and reused. */
export function GapSummary({
  program,
  allocated,
  spent,
  gap,
  districtsAbove,
  districtsCompared,
}: {
  program: string;
  allocated: number;
  spent: number;
  gap: number;
  districtsAbove: number;
  districtsCompared: number;
}) {
  return (
    <div className="mt-4 grid sm:grid-cols-3 gap-3">
      <div className="card p-4">
        <div className="stat-label">State allocation</div>
        <div className="text-2xl font-semibold">{fmtMoneyFull(allocated)}</div>
        <p className="mt-1 text-xs text-ink-muted">Statewide, {program}</p>
      </div>
      <div className="card p-4">
        <div className="stat-label">Districts actually spent</div>
        <div className="text-2xl font-semibold">{fmtMoneyFull(spent)}</div>
        <p className="mt-1 text-xs text-ink-muted">General fund only</p>
      </div>
      <div className="card p-4">
        <div className="stat-label">Difference</div>
        <div className="text-2xl font-semibold">{fmtSignedMoney(gap)}</div>
        <p className="mt-1 text-xs text-ink-muted">
          {districtsAbove} of {districtsCompared} districts spent more than allocated
        </p>
      </div>
    </div>
  );
}

/** Ranked-district table shared by the three program pages. */
export function GapTable({
  rows,
  caption,
}: {
  rows: RankedDistrict[];
  caption: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="py-2 pr-4 font-semibold">District</th>
            <th scope="col" className="py-2 pr-4 font-semibold text-right">Funded students</th>
            <th scope="col" className="py-2 pr-4 font-semibold text-right">Above allocation</th>
            <th scope="col" className="py-2 font-semibold text-right">Per student</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-line/60">
              <th scope="row" className="py-2 pr-4 text-left font-medium">
                <Link href={r.href} className="text-accent hover:underline">
                  {r.name}
                </Link>
              </th>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtInt(Math.round(r.fte))}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtSignedMoney(r.gap)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {fmtSignedMoney(Math.round(r.gapPerPupil))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
