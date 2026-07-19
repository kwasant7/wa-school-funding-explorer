import Link from 'next/link';
import data from '@/data/districts.json';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import CountUp from '@/components/interactive/CountUp';
import DistrictQuickFind from '@/components/interactive/DistrictQuickFind';
import GuessQuiz from '@/components/interactive/GuessQuiz';
import SchoolBuilder from '@/components/interactive/SchoolBuilder';
import ClassSizeViz from '@/components/interactive/ClassSizeViz';
import McClearyTimeline from '@/components/interactive/McClearyTimeline';
import { fmtMoneyFull } from '@/lib/format';

const STEPS = [
  {
    title: 'Count the students',
    body: 'Each district reports how many full-time students it serves, by grade.',
  },
  {
    title: 'Imagine prototypical schools',
    body: 'The state pretends every district is built from identical model schools — 400-student elementaries, 432-student middles, 600-student highs.',
  },
  {
    title: 'Generate staff positions',
    body: 'Formulas turn those imaginary schools into funded jobs: teachers from class sizes, plus set fractions of principals, counselors, nurses, and custodians.',
  },
  {
    title: 'Multiply by salaries',
    body: 'Each funded job × a state-set salary (plus benefits). Expensive labor markets get a “regionalization” boost up to ~18%.',
  },
  {
    title: 'Add money for stuff',
    body: 'MSOC — about $1,600 per student for materials, utilities, insurance, and tech, with extra for high schoolers.',
  },
  {
    title: 'Add extra-need dollars',
    body: 'More money follows students who need more: special education, learning assistance, bilingual programs, highly capable services.',
  },
  {
    title: 'Cap the local levies',
    body: 'Voters can add local “enrichment” levies — but the state caps them, and they legally can’t pay for basic education.',
  },
];

export default function HomePage() {
  const s = data.statewide;
  return (
    <div className="max-w-site mx-auto px-4 md:px-6">
      {/* Hero */}
      <section className="pt-10 md:pt-14 pb-8">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          How it works · play with everything on this page
        </p>
        <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">
          Washington runs its schools on an{' '}
          <span className="text-accent">imaginary school</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
          The state doesn&apos;t fund the schools that exist — it funds a
          make-believe &ldquo;prototypical school&rdquo; and uses it as a recipe
          for real money. A lot of it:
        </p>
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="This year's funding"
            value={<CountUp value={s.revenues.total} kind="money" />}
            note="general fund, 2024–25"
          />
          <StatTile
            label="Students"
            value={<CountUp value={s.enrollment} kind="int" />}
          />
          <StatTile
            label="Districts & charters"
            value={<CountUp value={s.districts} kind="plain" />}
          />
          <StatTile
            label="Average per student"
            value={<CountUp value={s.avgPerPupil} kind="moneyFull" />}
            note={`range: ${fmtMoneyFull(s.minPerPupil)}–${fmtMoneyFull(s.maxPerPupil)}`}
          />
        </div>
      </section>

      {/* Personalize */}
      <section className="pb-8">
        <DistrictQuickFind />
      </section>

      {/* Money sources */}
      <section className="pb-8">
        <div className="card p-5 md:p-6">
          <h2 className="text-lg md:text-xl font-bold">Follow the money</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            For every dollar Washington&apos;s schools spend, about 78¢ comes
            from the state — that wasn&apos;t always true, and a lawsuit is the
            reason. Hover the bar.
          </p>
          <div className="mt-4">
            <SourceShareBar slices={s.revenues} />
          </div>
        </div>
      </section>

      {/* Quiz -> builder */}
      <section className="py-6">
        <h2 className="text-2xl md:text-3xl font-bold max-w-2xl">
          The formula decides who works at your school
        </h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
          The prototypical model turns student counts into staff. Before you try
          it — a quick bet:
        </p>
        <div className="mt-5 grid gap-5">
          <GuessQuiz
            question="How much school-nurse time does the state fund for a 400-student elementary school?"
            options={[
              'Two full-time nurses',
              'One full-time nurse',
              'About half a nurse',
              '8% of one nurse',
            ]}
            correctIndex={3}
            reveal={
              <p>
                The base formula funds <strong>0.076 of a nurse</strong> — about
                3 hours a week for 400 kids. Districts that want a real school
                nurse pay for the rest with local levy dollars. Try it yourself
                below. ↓
              </p>
            }
          />
          <SchoolBuilder />
          <ClassSizeViz />
        </div>
      </section>

      {/* Steps */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          The whole machine in 7 steps
        </h2>
        <ol className="mt-6 grid md:grid-cols-2 gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card p-4 md:p-5 flex gap-3.5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-accent text-white font-bold flex items-center justify-center tabular-nums text-sm">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-ink-secondary text-sm">{step.body}</p>
              </div>
            </li>
          ))}
          <li className="card p-4 md:p-5 flex gap-3.5 bg-accent-wash border-accent-soft">
            <span className="shrink-0 w-8 h-8 rounded-full bg-accent-deep text-white font-bold flex items-center justify-center text-sm">
              =
            </span>
            <div>
              <h3 className="font-semibold">Your district&apos;s budget</h3>
              <p className="mt-1 text-ink-secondary text-sm">
                Sum it all up and you get the dollars in the{' '}
                <Link href="/districts" className="text-accent font-medium hover:underline">
                  District Explorer
                </Link>
                . Don&apos;t like the recipe? Rewrite it in the{' '}
                <Link href="/simulator" className="text-accent font-medium hover:underline">
                  Simulator
                </Link>
                .
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Constitution + McCleary */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold max-w-2xl">
          Why the state pays: a lawsuit and one sentence
        </h2>
        <div className="mt-5 card p-5 md:p-6 bg-accent-wash border-accent-soft">
          <blockquote className="border-l-4 border-accent pl-4 text-lg md:text-xl">
            &ldquo;It is the paramount duty of the state to make ample provision
            for the education of all children residing within its
            borders&hellip;&rdquo;
          </blockquote>
          <p className="mt-2 text-sm text-ink-secondary">
            — Washington Constitution, Article IX, Section 1.{' '}
            <strong className="text-ink">Paramount</strong> = before everything
            else. No other state says it this bluntly.
          </p>
        </div>
        <div className="mt-5 grid gap-5">
          <GuessQuiz
            question="When the Legislature moved too slowly on school funding, what did the state Supreme Court do?"
            options={[
              'Sent a strongly worded letter',
              'Nothing — courts can’t touch budgets',
              'Fined the state $100,000 per day',
              'Shut down the schools',
            ]}
            correctIndex={2}
            reveal={
              <p>
                Starting in 2015 the court fined Washington{' '}
                <strong>$100,000 every single day</strong> — over $100 million
                total — until lawmakers rebuilt the funding system. Step through
                the whole saga below.
              </p>
            }
          />
          <McClearyTimeline />
        </div>
      </section>

      {/* What's unresolved */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          Still unresolved (this is where you come in)
        </h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold">The funding-vs-reality gap</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Real schools employ far more people than the formula funds — the
              difference comes from capped levies, cuts, or bigger classes.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Zip codes still matter</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Levies are capped and partially equalized, but a wealthy tax base
              still raises more, more easily. Compare local shares in the{' '}
              <Link href="/districts" className="text-accent hover:underline">
                District Explorer
              </Link>
              .
            </p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Special education</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Districts spent more than the state provided for decades. 2025&apos;s
              SB 5263 added ~$750M and removed the enrollment cap — advocacy did
              that.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-8">
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/districts" className="card p-5 hover:border-accent transition-colors group">
            <p className="text-xs text-ink-muted">Next up</p>
            <h3 className="mt-1 font-bold group-hover:text-accent">
              Explore your district&apos;s numbers →
            </h3>
          </Link>
          <Link href="/simulator" className="card p-5 hover:border-accent transition-colors group">
            <p className="text-xs text-ink-muted">Experiment</p>
            <h3 className="mt-1 font-bold group-hover:text-accent">
              Rewrite the formula yourself →
            </h3>
          </Link>
          <Link href="/take-action" className="card p-5 hover:border-accent transition-colors group">
            <p className="text-xs text-ink-muted">Get involved</p>
            <h3 className="mt-1 font-bold group-hover:text-accent">
              Tell your legislators what you think →
            </h3>
          </Link>
        </div>
      </section>
    </div>
  );
}
