import type { Metadata } from 'next';
import CopyBlock from '@/components/CopyBlock';

export const metadata: Metadata = {
  title: 'Take Action',
  description:
    'Contact your Washington legislators about K-12 school funding: find your district, use ready-made email and testimony templates, and track current bills.',
};

const EMAIL_TEMPLATE = `Subject: A constituent's perspective on K-12 school funding

Dear [Senator/Representative Last Name],

My name is [YOUR NAME], and I'm a [student/parent/community member] in [YOUR SCHOOL DISTRICT] in your district.

I'm writing about K-12 school funding. [ONE OR TWO SENTENCES ABOUT WHAT YOU'VE SEEN FIRSTHAND — a counselor shared across three schools, outdated materials, a program cut, a class of 32.]

Washington's prototypical school model funds [PICK YOUR ISSUE: e.g., less than one-tenth of a nurse per elementary school / class sizes well above what research recommends / materials budgets that haven't kept pace with costs].

I'm asking you to [YOUR ASK: e.g., support increased special education funding / support smaller funded class sizes / support more counselors and nurses in the prototypical model] this session.

Students notice these gaps every day, and we vote — now or soon.

Thank you for your time and your service.

[YOUR NAME]
[YOUR CITY], WA
[YOUR SCHOOL OR DISTRICT]`;

const TESTIMONY_TEMPLATE = `Good [morning/afternoon], Chair [NAME] and members of the committee.

For the record, my name is [YOUR NAME], and I am a [student at X high school / parent in Y district / resident of Z].

I am testifying [in support of / with concerns about] [BILL NUMBER].

[YOUR STORY — 2 to 3 sentences. What you have personally seen. Specific beats general: "My school shares one counselor with two other buildings" lands harder than "schools need more funding."]

[YOUR ASK — 1 sentence. What you want the committee to do.]

Thank you.`;

const BILLS: {
  bill: string;
  name: string;
  status: string;
  passed: boolean;
  summary: string;
  url: string;
}[] = [
  {
    bill: 'SB 5263',
    name: 'Special education funding',
    status: 'Passed, 2025',
    passed: true,
    summary:
      'Roughly $750M over four years for special education; removed the cap on how many students a district can receive special ed funding for.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5263&Year=2025',
  },
  {
    bill: 'SB 5192',
    name: 'Materials, supplies & operating costs',
    status: 'Passed, 2025',
    passed: true,
    summary:
      'Raised MSOC to $1,614 per student (plus ~$215 extra per high schooler) — about $213M more for school operating costs.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5192&Year=2025',
  },
  {
    bill: 'HB 2049',
    name: 'Local levy authority',
    status: 'Passed, 2025',
    passed: true,
    summary:
      'Gradually raises the per-student cap on local enrichment levies, letting districts ask voters for more local support.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2049&Year=2025',
  },
];

const STEPS = [
  {
    title: 'Find your legislators',
    body: 'Every Washingtonian has three: one senator and two representatives. Enter your address in the official district finder to get their names, emails, and offices.',
    link: { href: 'https://app.leg.wa.gov/DistrictFinder/', label: 'app.leg.wa.gov/DistrictFinder' },
    extra: 'Or call the Legislative Hotline at 1-800-562-6000 and leave a message for all three at once.',
  },
  {
    title: 'Write to them',
    body: 'Short, personal, specific. A real story from your school beats statistics — legislators hear budgets all day; they remember people. Use the template below as a starting point, not a script.',
  },
  {
    title: 'Testify — yes, you can',
    body: 'Anyone can testify on a bill, including students — remotely or in Olympia. When a school funding bill gets a hearing, sign in through the Committee Sign-In page. You usually get 1–2 minutes; the testimony template below fits in one.',
    link: { href: 'https://app.leg.wa.gov/csi', label: 'Committee Sign-In (app.leg.wa.gov/csi)' },
    extra: 'Not ready to speak? You can also sign in "pro" or "con" without testifying — those counts get read into the record.',
  },
];

export default function TakeActionPage() {
  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Take Action</h1>
      <p className="mt-3 max-w-2xl text-ink-secondary">
        The funding formula isn&apos;t weather — people wrote it, and people
        change it almost every session. Here&apos;s how to be one of those
        people, even before you can vote.
      </p>

      {/* Steps */}
      <ol className="mt-8 grid gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card p-5 md:p-6 flex gap-4">
            <span className="shrink-0 w-9 h-9 rounded-full bg-accent text-white font-bold flex items-center justify-center tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-lg">{step.title}</h2>
              <p className="mt-1 text-ink-secondary">{step.body}</p>
              {step.link && (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-accent font-medium hover:underline"
                >
                  {step.link.label} ↗
                </a>
              )}
              {step.extra && (
                <p className="mt-2 text-sm text-ink-muted">{step.extra}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Talking points */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold">Talking points that hold up</h2>
        <p className="mt-2 text-ink-secondary max-w-2xl">
          Every claim below is backed by data on this site — link it or quote it.
        </p>
        <ul className="mt-4 grid md:grid-cols-2 gap-3 text-sm md:text-base">
          {[
            'The state funds less than one-tenth of a school nurse per prototypical elementary school.',
            'Funded class sizes for grades 4–12 are about 27–29 students per teacher.',
            'Per-student funding varies by thousands of dollars between neighboring districts.',
            'Local levies legally cannot pay for basic education — but districts still lean on them for staff the formula doesn’t cover.',
            'The Legislature moved on all three of 2025’s big funding bills — pressure works.',
            'The constitution calls education the state’s paramount duty — funding it is not optional.',
          ].map((point) => (
            <li key={point} className="card px-4 py-3 text-ink-secondary">
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* Templates */}
      <section className="mt-10 grid lg:grid-cols-2 gap-4 items-start">
        <CopyBlock title="Email template" text={EMAIL_TEMPLATE} />
        <CopyBlock title="Public testimony template (~1 minute)" text={TESTIMONY_TEMPLATE} />
      </section>
      <p className="mt-3 text-sm text-ink-muted">
        Replace everything in [brackets]. Legislator emails follow the pattern{' '}
        <code className="text-ink-secondary">firstname.lastname@leg.wa.gov</code>.
      </p>

      {/* Bill tracker */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold">Recent funding legislation</h2>
        <p className="mt-2 text-ink-secondary max-w-2xl">
          The 2025 session was a landmark one for school funding. Click any bill
          for its official page — and watch the{' '}
          <a
            href="https://app.leg.wa.gov/bi/report/topicalindex/?biennium=2025-26"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Legislature&apos;s topical index ↗
          </a>{' '}
          for new K-12 funding bills each session.
        </p>
        <div className="mt-4 card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-line">
                <th className="px-4 py-3 font-medium">Bill</th>
                <th className="px-4 py-3 font-medium">What it does</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {BILLS.map((b) => (
                <tr key={b.bill} className="border-t border-line align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent hover:underline"
                    >
                      {b.bill}
                    </a>
                    <div className="text-xs text-ink-muted mt-0.5">{b.name}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{b.summary}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                        b.passed
                          ? 'bg-accent-wash text-accent-deep'
                          : 'bg-paper text-ink-secondary'
                      }`}
                    >
                      {b.passed ? '✓' : '•'} {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
