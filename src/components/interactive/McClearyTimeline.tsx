type TimelineEvent = {
  year: string;
  label: string;
  title: string;
  body: string;
};

const EVENTS: TimelineEvent[] = [
  {
    year: '2007',
    label: 'The problem',
    title: 'Families sue',
    body: 'Families said the state was not paying enough, so districts had to use local taxes for basic school needs.',
  },
  {
    year: '2012',
    label: 'The ruling',
    title: 'The court agrees',
    body: 'Washington’s Supreme Court ruled that the state was not fully funding basic education.',
  },
  {
    year: '2014-15',
    label: 'The pressure',
    title: 'The court pushes harder',
    body: 'Progress was too slow. The court held the state in contempt and added a $100,000 daily fine.',
  },
  {
    year: '2017',
    label: 'The response',
    title: 'Lawmakers change the system',
    body: 'The state added billions for schools, increased salary funding, and put tighter limits on local levies.',
  },
  {
    year: '2018',
    label: 'The result',
    title: 'The case closes',
    body: 'The court accepted the plan. State funding had grown - but that did not solve every school funding problem.',
  },
];

function EventIcon({ index }: { index: number }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (index === 0) {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2.5 19c.5-3.5 2.4-5.5 5.5-5.5s5 2 5.5 5.5M14 14c3.8-.8 6.6 1 7.2 5" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <path d="M4 20h16M7 17h10M9 17V9h6v8M6 9h12L12 4z" />
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg {...common}>
        <path d="m14 5 5 5M12 7l5 5M3 21l9-9M9 4l11 11M4 9l5-5M15 20l5-5" />
      </svg>
    );
  }
  if (index === 3) {
    return (
      <svg {...common}>
        <path d="M5 3h11l3 3v15H5zM16 3v4h4M8 11h8M8 15h8" />
        <path d="m8 7 1 1 2-2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16.5 9" />
    </svg>
  );
}

export default function McClearyTimeline() {
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
          ?
        </span>
        <div>
          <h3 className="text-lg font-bold">The question behind the lawsuit</h3>
          <p className="mt-1 max-w-3xl text-sm text-ink-secondary">
            If public school is a state responsibility, why were local communities
            paying for so many basic needs? Here is how that question changed
            Washington school funding.
          </p>
        </div>
      </div>

      <ol
        className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-5 md:gap-0"
        aria-label="Five key events in the McCleary school funding case"
      >
        {EVENTS.map((event, index) => (
          <li
            key={event.year}
            className={`relative pl-14 md:px-3 md:pl-3 md:pt-14 ${
              index > 0
                ? 'before:absolute before:left-5 before:-top-5 before:h-5 before:w-px before:bg-accent-soft md:before:left-auto md:before:right-1/2 md:before:top-5 md:before:h-px md:before:w-full'
                : ''
            }`}
          >
            <span className="absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent bg-accent-wash text-accent-deep md:left-1/2 md:-translate-x-1/2">
              <EventIcon index={index} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
              {event.label}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">{event.year}</p>
            <h4 className="mt-1 font-semibold">{event.title}</h4>
            <p className="mt-1.5 text-sm text-ink-secondary">{event.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-7 rounded-xl border border-accent-soft bg-accent-wash p-4 md:flex md:items-center md:gap-4">
        <p className="font-semibold text-accent-deep md:shrink-0">The big idea</p>
        <p className="mt-1 text-sm text-ink-secondary md:mt-0">
          McCleary made the state pay a larger share of basic education and rely
          less on local levies. It changed who pays - but schools still debate
          whether the formula covers their real costs.
        </p>
      </div>
    </div>
  );
}
