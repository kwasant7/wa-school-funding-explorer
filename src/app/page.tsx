import Link from 'next/link';
import data from '@/data/districts.json';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import { fmtInt, fmtMoney, fmtMoneyFull } from '@/lib/format';

const PROTO_SCHOOLS = [
  {
    name: 'Prototypical Elementary',
    grades: 'Grades K–6',
    students: 400,
    staff: [
      ['Principals', '1.25'],
      ['Counselors', '0.49'],
      ['Teacher-librarians', '0.66'],
      ['Nurses', '0.08'],
      ['Custodians', '1.66'],
    ],
  },
  {
    name: 'Prototypical Middle School',
    grades: 'Grades 7–8',
    students: 432,
    staff: [
      ['Principals', '1.35'],
      ['Counselors', '1.22'],
      ['Teacher-librarians', '0.52'],
      ['Nurses', '0.06'],
      ['Custodians', '1.94'],
    ],
  },
  {
    name: 'Prototypical High School',
    grades: 'Grades 9–12',
    students: 600,
    staff: [
      ['Principals', '1.88'],
      ['Counselors', '2.54'],
      ['Teacher-librarians', '0.52'],
      ['Nurses', '0.10'],
      ['Custodians', '2.97'],
    ],
  },
];

const CLASS_SIZES = [
  ['Kindergarten – Grade 3', '17'],
  ['Grade 4', '27'],
  ['Grades 5–6', '27'],
  ['Grades 7–8', '28.5'],
  ['Grades 9–12', '28.7'],
  ['Career & technical ed.', '≈23'],
];

const STEPS = [
  {
    title: 'Count the students',
    body: 'Everything starts with enrollment. Each district reports how many full-time students it serves, by grade level.',
  },
  {
    title: 'Imagine prototypical schools',
    body: 'The state pretends every district is made of identical "prototypical" schools: elementaries of 400, middle schools of 432, high schools of 600. A district with 4,000 K–6 students = 10 prototypical elementaries.',
  },
  {
    title: 'Generate staff positions',
    body: 'Formulas turn those imaginary schools into funded jobs: teachers from class-size ratios, plus set numbers of principals, counselors, librarians, nurses, office staff, and custodians per school.',
  },
  {
    title: 'Multiply by salary allocations',
    body: 'Each funded position is multiplied by a state-set salary (plus benefits). Districts in expensive labor markets get a "regionalization" boost of up to about 18%.',
  },
  {
    title: 'Add money for stuff',
    body: 'MSOC — materials, supplies, and operating costs — adds about $1,600 per student for curriculum, utilities, insurance, and technology, with extra for high schoolers.',
  },
  {
    title: 'Add categorical programs',
    body: 'Extra dollars follow students with extra needs: special education, the Learning Assistance Program, bilingual education, and highly capable services.',
  },
  {
    title: 'Districts add local levies',
    body: "Voters can approve local 'enrichment' levies — but the state caps how much a district may collect, and these dollars legally can't pay for basic education.",
  },
];

const MCCLEARY = [
  ['2007', 'The McCleary and Venema families sue, arguing the state underfunds its schools.'],
  ['2012', 'The state Supreme Court agrees: Washington is violating its paramount duty.'],
  ['2015', 'Progress is too slow — the Court holds the state in contempt, fining it $100,000 per day.'],
  ['2017', 'The Legislature passes a landmark fix: billions more in state funding, a higher state property tax, and caps on local levies.'],
  ['2018', 'The Court accepts the plan and closes the case.'],
];

export default function HomePage() {
  const s = data.statewide;
  return (
    <div className="max-w-site mx-auto px-4 md:px-6">
      {/* Hero */}
      <section className="pt-10 md:pt-14 pb-8">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          How it works
        </p>
        <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">
          How does Washington pay for its public schools?
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
          Washington doesn&apos;t fund the schools that exist. It funds an{' '}
          <em>imaginary</em> school — the &ldquo;prototypical school&rdquo; — and
          uses it as a recipe to send {fmtMoney(s.revenues.total)} a year to{' '}
          {s.districts} districts. Here&apos;s the whole system, explained.
        </p>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Total school funding" value={fmtMoney(s.revenues.total)} note="general fund, 2024–25" />
          <StatTile label="Public school students" value={fmtInt(s.enrollment)} />
          <StatTile label="Districts & charters" value={String(s.districts)} />
          <StatTile label="Average per student" value={fmtMoneyFull(s.avgPerPupil)} note={`district range: ${fmtMoneyFull(s.minPerPupil)}–${fmtMoneyFull(s.maxPerPupil)}`} />
        </div>
        <div className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-ink-secondary mb-3">
            Where the money comes from
          </h2>
          <SourceShareBar
            slices={s.revenues}
            caption="Hover a segment to see what each source covers."
          />
        </div>
      </section>

      {/* Paramount duty */}
      <section className="py-8">
        <div className="card p-6 md:p-8 bg-accent-wash border-accent-soft">
          <h2 className="text-xl md:text-2xl font-bold">
            It starts with the state constitution
          </h2>
          <blockquote className="mt-4 border-l-4 border-accent pl-4 text-lg md:text-xl">
            &ldquo;It is the paramount duty of the state to make ample provision
            for the education of all children residing within its borders&hellip;&rdquo;
          </blockquote>
          <p className="mt-3 text-sm text-ink-secondary">
            — Washington State Constitution, Article IX, Section 1
          </p>
          <p className="mt-4 max-w-2xl text-ink-secondary">
            <strong className="text-ink">Paramount</strong> means before anything
            else — roads, prisons, parks, everything. No other state constitution
            puts education first this explicitly, and this one sentence has shaped
            decades of school funding fights, including the McCleary case below.
          </p>
        </div>
      </section>

      {/* Prototypical model */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          The big idea: the prototypical school
        </h2>
        <p className="mt-3 max-w-2xl text-ink-secondary">
          Since 2011, state funding has been built on a simple thought experiment:
          <strong className="text-ink"> if a typical school had this many students, what would it need?</strong>{' '}
          The Legislature wrote its answer into law (RCW 28A.150.260) as three
          model schools. Real schools don&apos;t have to look like this — the
          model only decides how much money a district receives, and districts
          decide how to actually spend it.
        </p>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {PROTO_SCHOOLS.map((school) => (
            <div key={school.name} className="card p-5">
              <h3 className="font-bold">{school.name}</h3>
              <p className="text-sm text-ink-muted">{school.grades}</p>
              <p className="mt-3 text-3xl font-semibold">
                {school.students}
                <span className="text-base font-normal text-ink-secondary"> students</span>
              </p>
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">
                  Funded staff for a {school.name.toLowerCase()}
                </caption>
                <tbody>
                  {school.staff.map(([role, fte]) => (
                    <tr key={role} className="border-t border-line">
                      <td className="py-1.5 text-ink-secondary">{role}</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">{fte}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-muted max-w-2xl">
          Funded full-time positions per school — base values from RCW
          28A.150.260. Yes, that&apos;s <strong>8% of one nurse</strong> for a
          400-student elementary school. The Legislature has nudged some of these
          up since (e.g., HB 1664 in 2022 added counselors, nurses, and social
          workers), but the shape of the model is unchanged.
        </p>
      </section>

      {/* Steps */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          The formula, step by step
        </h2>
        <ol className="mt-6 grid gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card p-5 flex gap-4">
              <span className="shrink-0 w-9 h-9 rounded-full bg-accent text-white font-bold flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-ink-secondary text-sm md:text-base">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Class sizes */}
      <section className="py-8 grid md:grid-cols-2 gap-6 items-start">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">
            What class sizes does the state pay for?
          </h2>
          <p className="mt-3 text-ink-secondary">
            Teachers — the biggest cost in any school — are funded through
            class-size ratios. Smaller funded classes in K–3 reflect research
            that early grades benefit most from individual attention. Note these
            are <strong className="text-ink">funding assumptions</strong>, not
            class-size limits: a district paid for one teacher per 17
            kindergartners can still choose to run classes of 24.
          </p>
          <p className="mt-3 text-ink-secondary">
            Want to see what changing these ratios would cost?{' '}
            <Link href="/simulator" className="text-accent font-medium hover:underline">
              Try the policy simulator →
            </Link>
          </p>
        </div>
        <table className="card w-full text-sm md:text-base overflow-hidden">
          <caption className="sr-only">Funded students per teacher by grade band</caption>
          <thead>
            <tr className="text-left text-ink-secondary border-b border-line">
              <th className="px-4 py-3 font-medium">Grade band</th>
              <th className="px-4 py-3 font-medium text-right">Students per funded teacher</th>
            </tr>
          </thead>
          <tbody>
            {CLASS_SIZES.map(([band, size]) => (
              <tr key={band} className="border-t border-line">
                <td className="px-4 py-2.5">{band}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* McCleary */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          McCleary: the lawsuit that rewrote the checkbook
        </h2>
        <p className="mt-3 max-w-2xl text-ink-secondary">
          For decades, districts papered over state underfunding with local levy
          dollars — which meant richer zip codes could paper better. The McCleary
          case forced the state to own the bill for basic education.
        </p>
        <ol className="mt-6 space-y-0">
          {MCCLEARY.map(([year, event]) => (
            <li key={year} className="flex gap-4 md:gap-6">
              <div className="flex flex-col items-center">
                <span className="shrink-0 w-16 text-right md:text-center font-bold text-accent tabular-nums">{year}</span>
                <span className="w-px flex-1 bg-line my-1" aria-hidden />
              </div>
              <p className="pb-6 text-ink-secondary max-w-xl">{event}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Equity + levies */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          What the model still doesn&apos;t settle
        </h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold">The funding-vs-actual gap</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Districts routinely employ more staff than the model funds — real
              schools need more than 0.08 nurses. The difference comes out of
              levies, cuts, or larger classes elsewhere.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Property wealth still matters</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Levies are capped and equalized (&ldquo;Local Effort
              Assistance&rdquo; tops up property-poor districts), but a rich tax
              base still raises more, more easily. Compare districts&apos; local
              shares in the{' '}
              <Link href="/districts" className="text-accent hover:underline">
                District Explorer
              </Link>
              .
            </p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Special education</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Districts long spent more on special education than the state
              provided. 2025&apos;s SB 5263 added roughly $750&nbsp;million over
              four years and removed the enrollment cap — a major shift advocates
              had sought for years.
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
              Change the formula yourself →
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
