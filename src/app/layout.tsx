import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import TabNav from '@/components/TabNav';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import SchoolYearSwitcher from '@/components/SchoolYearSwitcher';
import AssistantLauncher from '@/components/assistant/AssistantLauncher';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { SITE_URL } from '@/lib/site-metadata';

const DESCRIPTION =
  'How Washington State pays for its public schools: the prototypical funding model explained, funding data for every district, a policy simulator, and ways to take action.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'WA School Funding Explorer',
    template: '%s · WA School Funding Explorer',
  },
  description: DESCRIPTION,
  /*
    Deliberately no `alternates.canonical` here. Every indexable route sets its
    own through pageMetadata(), and a root-level canonical is inherited rather
    than overridden by children that forget to - which would quietly tell
    crawlers that a district page's canonical URL is the home page. The home
    page now sets its own: it was split into a server page wrapping the client
    explainer precisely so it could.
  */
  /*
    Site-wide fallback so a route that doesn't call pageMetadata() still shares
    with a real title, description, and image instead of a blank card - every
    route used to render identically empty when pasted into Slack, iMessage, or
    a social feed.
  */
  openGraph: {
    title: 'WA School Funding Explorer',
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'WA School Funding Explorer',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WA School Funding Explorer',
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <GoogleAnalytics />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
        >
          Skip to content
        </a>
        <header className="border-b border-line bg-surface">
          <div className="max-w-site mx-auto px-4 md:px-6 pt-5 pb-0">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <Link href="/" className="group">
                <span className="text-lg md:text-xl font-bold tracking-tight">
                  WA School Funding <span className="text-accent">Explorer</span>
                </span>
              </Link>
              <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                <span
                  className="text-xs text-ink-muted"
                  title="OSPI publishes final F-196 revenue actuals for a school year the following December, so 2024-25 is the most recent complete year available."
                >
                  OSPI data · 2019-20 to 2024-25 (most recent published)
                </span>
                <SchoolYearSwitcher />
                <LanguageSwitcher />
              </div>
            </div>
            <TabNav />
          </div>
        </header>
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t border-line bg-surface mt-16">
          <div className="max-w-site mx-auto px-4 md:px-6 py-8 text-sm text-ink-secondary space-y-2">
            <p>
              Data: OSPI Report Card headcount, P-223 funding FTE, and F-196
              general fund revenue actuals, school years 2019-20 through
              2024-25, via{' '}
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
            <p className="text-ink-muted">
              Built by William Yoon, a 12th grader at Interlake High School in the
              Bellevue School District. Corrections:{' '}
              <a
                className="text-accent hover:underline"
                href="mailto:williamyoon777@gmail.com"
              >
                williamyoon777@gmail.com
              </a>
              .
            </p>
          </div>
        </footer>
        <AssistantLauncher />
      </body>
    </html>
  );
}
