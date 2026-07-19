import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import TabNav from '@/components/TabNav';

export const metadata: Metadata = {
  title: {
    default: 'WA School Funding Explorer',
    template: '%s · WA School Funding Explorer',
  },
  description:
    'How Washington State pays for its public schools: the prototypical funding model explained, funding data for every district, a policy simulator, and ways to take action.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-line bg-surface">
          <div className="max-w-site mx-auto px-4 md:px-6 pt-5 pb-0">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <Link href="/" className="group">
                <span className="text-lg md:text-xl font-bold tracking-tight">
                  WA School Funding <span className="text-accent">Explorer</span>
                </span>
              </Link>
              <span className="text-xs text-ink-muted">
                OSPI data · 2024–25 school year
              </span>
            </div>
            <TabNav />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-surface mt-16">
          <div className="max-w-site mx-auto px-4 md:px-6 py-8 text-sm text-ink-secondary space-y-2">
            <p>
              Data: OSPI Report Card enrollment (2024–25) and F-196 general fund
              revenue actuals (2024–25), via{' '}
              <a
                className="text-accent hover:underline"
                href="https://data.wa.gov"
                target="_blank"
                rel="noopener noreferrer"
              >
                data.wa.gov
              </a>{' '}
              and{' '}
              <a
                className="text-accent hover:underline"
                href="https://ospi.k12.wa.us/safs-data-files"
                target="_blank"
                rel="noopener noreferrer"
              >
                OSPI SAFS data files
              </a>
              .
            </p>
            <p className="text-ink-muted">
              An independent civic education project. Not affiliated with OSPI or
              the Washington State Legislature. Simulator results are educational
              estimates, not official fiscal projections.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
