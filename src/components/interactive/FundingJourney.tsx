import type { District } from '@/lib/data';
import { fmtInt, fmtMoney } from '@/lib/format';

function StepIcon({ index }: { index: number }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'h-8 w-8',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (index === 0)
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (index === 1)
    return (
      <svg {...common}>
        <path d="m3 10 9-6 9 6M5 9v10h14V9M9 19v-5h6v5M8 11h.01M16 11h.01" />
      </svg>
    );
  if (index === 2)
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="8.5" r="2.5" />
        <path d="M2.5 19c.5-3.5 2.4-5.5 5.5-5.5s5 2 5.5 5.5M14 14c3.8-.8 6.6 1 7.2 5" />
      </svg>
    );
  if (index === 3)
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 8.5c-.7-.6-1.6-.9-2.7-.9-1.6 0-2.8.8-2.8 2s1 1.8 3 2.3 3 1.2 3 2.4-1.3 2.1-3.1 2.1c-1.2 0-2.3-.4-3.1-1.1M12 5.5v13" />
      </svg>
    );
  if (index === 4)
    return (
      <svg {...common}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M4 6.5v14M8 8h8M8 12h6" />
      </svg>
    );
  if (index === 5)
    return (
      <svg {...common}>
        <path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 7.5h16v11H4zM6 7.5V5h12v2.5M4 11h16M16.5 15h.01" />
    </svg>
  );
}

/** A little cluster of people icons - a wordless "staff" visual. */
function PeopleCluster() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-5 w-5" fill="#2a78d6">
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
        </svg>
      ))}
    </span>
  );
}

type Step = {
  headline: string;
  blurb: string;
  visual: (district: District) => React.ReactNode;
};

/** Big number + tiny caption - the scannable payoff for each step. */
function Stat({ big, cap }: { big: string; cap: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-bold text-accent-deep tabular-nums leading-none">
        {big}
      </div>
      <div className="mt-1 text-xs text-ink-muted">{cap}</div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    headline: 'Count students by time',
    blurb: 'Part-time counts as part of one.',
    visual: (d) => <Stat big={fmtInt(Math.round(d.fundingEnrollment))} cap={`funding FTE (not ${fmtInt(d.enrollment)} kids)`} />,
  },
  {
    headline: 'Make model schools',
    blurb: 'Same yardstick everywhere.',
    visual: (d) => {
      const models =
        d.fundingFte.elementary / 400 + d.fundingFte.middle / 432 + d.fundingFte.high / 600;
      return <Stat big={models.toFixed(0)} cap="pretend model schools" />;
    },
  },
  {
    headline: 'Add staff to each',
    blurb: 'Teachers, nurses, admin, custodians.',
    visual: () => (
      <div>
        <PeopleCluster />
        <div className="mt-1 text-xs text-ink-muted">a staff recipe per school</div>
      </div>
    ),
  },
  {
    headline: 'Turn staff into money',
    blurb: 'Positions × salaries.',
    visual: (d) => <Stat big={fmtMoney(d.rev.state)} cap="state $, mostly staff" />,
  },
  {
    headline: 'Add supply money',
    blurb: 'Books, power, internet.',
    visual: () => <Stat big="$1,600+" cap="per student for supplies" />,
  },
  {
    headline: 'Extra for extra needs',
    blurb: 'Some students bring more.',
    visual: (d) => {
      const pct = (n: number) => Math.round((n / d.enrollment) * 100);
      const chips = [
        [`${pct(d.demo.sped)}%`, 'special ed'],
        [`${pct(d.demo.ell)}%`, 'multilingual'],
        [`${pct(d.demo.lowIncome)}%`, 'low-income'],
      ];
      return (
        <div className="flex flex-wrap gap-2">
          {chips.map(([n, label]) => (
            <span key={label} className="rounded-lg bg-accent-soft px-2.5 py-1 text-center">
              <span className="block text-lg font-bold text-accent-deep tabular-nums leading-none">{n}</span>
              <span className="block text-[10px] text-ink-muted">{label}</span>
            </span>
          ))}
        </div>
      );
    },
  },
  {
    headline: 'Add it all up',
    blurb: 'State + local + federal.',
    visual: (d) => <Stat big={fmtMoney(d.rev.total)} cap="total district budget" />,
  },
];

export default function FundingJourney({ district }: { district: District }) {
  return (
    <div className="mt-6">
      <ol aria-label="Seven steps in school funding">
        {STEPS.map((item, index) => {
          const isLast = index === STEPS.length - 1;
          return (
            <li key={item.headline} className="relative flex gap-4 md:gap-5">
              {/* Rail: big numbered icon + connecting line */}
              <div className="flex flex-col items-center">
                <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <StepIcon index={index} />
                  <span className="absolute -top-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent-deep text-xs font-bold text-white ring-2 ring-surface">
                    {index + 1}
                  </span>
                </span>
                {!isLast && <span className="w-0.5 flex-1 bg-accent-soft my-1" aria-hidden />}
              </div>

              {/* Content: short headline + big visual */}
              <div className={`min-w-0 flex-1 ${isLast ? 'pb-1' : 'pb-6'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-line bg-surface p-4">
                  <div className="min-w-0">
                    <h3 className="text-lg md:text-xl font-bold leading-tight">{item.headline}</h3>
                    <p className="mt-0.5 text-sm text-ink-secondary">{item.blurb}</p>
                  </div>
                  <div className="shrink-0 sm:text-right sm:pl-4">{item.visual(district)}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
