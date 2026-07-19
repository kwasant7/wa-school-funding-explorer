type SchoolType = 'elementary' | 'middle' | 'high';

/** Base staffing allocations in RCW 28A.150.260. */
const MODELS: Record<SchoolType, {
  label: string;
  grades: string;
  proto: number;
  teachersPerStudent: number;
  perStudent: Record<string, number>;
}> = {
  elementary: {
    label: 'Elementary', grades: 'K–6 · state prototype: 400 students', proto: 400,
    teachersPerStudent: (4 / 7) / 17 + (3 / 7) / 27,
    perStudent: { Principals: 1.253 / 400, Counselors: 0.493 / 400, 'Teacher-librarians': 0.663 / 400, 'Office staff': 2.012 / 400, Custodians: 1.657 / 400, Nurses: 0.076 / 400 },
  },
  middle: {
    label: 'Middle', grades: '7–8 · state prototype: 432 students', proto: 432,
    teachersPerStudent: 1 / 28.53,
    perStudent: { Principals: 1.353 / 432, Counselors: 1.216 / 432, 'Teacher-librarians': 0.519 / 432, 'Office staff': 2.325 / 432, Custodians: 1.942 / 432, Nurses: 0.06 / 432 },
  },
  high: {
    label: 'High school', grades: '9–12 · state prototype: 600 students', proto: 600,
    teachersPerStudent: 1 / 28.74,
    perStudent: { Principals: 1.88 / 600, Counselors: 2.539 / 600, 'Teacher-librarians': 0.523 / 600, 'Office staff': 3.269 / 600, Custodians: 2.965 / 600, Nurses: 0.096 / 600 },
  },
};

function Person({ ghost = false }: { ghost?: boolean }) {
  return <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill={ghost ? '#c3c2b7' : '#2a78d6'} opacity={ghost ? 0.35 : 1} aria-hidden><circle cx="12" cy="6.5" r="4.5" /><path d="M3.5 22c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z" /></svg>;
}

function StaffIcons({ count }: { count: number }) {
  const whole = Math.floor(count);
  const fraction = count - whole;
  const shown = Math.min(whole, 30);
  return <span className="inline-flex flex-wrap items-end gap-[3px] align-middle">
    {Array.from({ length: shown }, (_, i) => <span key={i} className="dot-in" style={{ animationDelay: `${Math.min(i, 30) * 14}ms` }}><Person /></span>)}
    {whole > shown && <span className="text-xs text-ink-muted mx-1">+{whole - shown} more</span>}
    {fraction > 0.005 && <span className="relative inline-block dot-in" title={`${Math.round(fraction * 100)}% of one position`}><Person ghost /><span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.max(fraction * 100, 8)}%` }}><Person /></span></span>}
  </span>;
}

function fmtFte(n: number) {
  return n >= 10 ? String(Math.round(n)) : n >= 1 ? n.toFixed(1) : n.toFixed(2);
}

function ModelCard({ type }: { type: SchoolType }) {
  const model = MODELS[type];
  const teachers = model.proto * model.teachersPerStudent;
  const staff = Object.entries(model.perStudent).map(([role, rate]) => ({ role, fte: model.proto * rate }));
  const totalStaff = teachers + staff.reduce((total, item) => total + item.fte, 0);

  return <article className="border border-line rounded-xl p-4 md:p-5">
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <div><h4 className="text-lg font-bold">{model.label}</h4><p className="mt-0.5 text-xs text-ink-muted">{model.grades}</p></div>
      <p className="text-sm text-ink-secondary"><strong className="text-ink text-lg">{model.proto}</strong> students</p>
    </div>
    <div className="mt-5 space-y-4">
      <div>
        <div className="flex items-baseline gap-2 flex-wrap"><span className="w-36 shrink-0 text-sm font-semibold">Teachers</span><span className="text-sm tabular-nums font-bold text-accent-deep w-12">{fmtFte(teachers)}</span><span className="text-xs text-ink-muted">≈ {Math.round(model.proto / teachers)} students per funded teacher</span></div>
        <div className="mt-1.5 pl-0 md:pl-36"><StaffIcons count={teachers} /></div>
      </div>
      {staff.map(({ role, fte }) => <div key={role}>
        <div className="flex items-baseline gap-2 flex-wrap"><span className="w-36 shrink-0 text-sm font-semibold">{role}</span><span className="text-sm tabular-nums font-bold text-accent-deep w-12">{fmtFte(fte)}</span>
          {role === 'Counselors' && <span className="text-xs text-ink-muted">1 for every {Math.round(model.proto / fte).toLocaleString()} students · experts recommend 1 per 250</span>}
          {role === 'Nurses' && <span className="text-xs text-ink-muted">≈ {(fte * 40).toFixed(1)} hours of nurse time per week</span>}
        </div>
        <div className="mt-1.5 pl-0 md:pl-36"><StaffIcons count={fte} /></div>
      </div>)}
    </div>
    <p className="mt-5 border-t border-line pt-3 text-sm text-ink-secondary"><strong className="text-ink">{fmtFte(totalStaff)} state-funded adults</strong> for {model.proto.toLocaleString()} students</p>
  </article>;
}

export default function SchoolBuilder() {
  return <div className="card p-5 md:p-7">
    <h3 className="text-xl md:text-2xl font-bold">The three model schools, side by side</h3>
    <p className="mt-1 text-sm text-ink-secondary">RCW 28A.150.260 defines a prototype for each grade span. These are the base staffing allocations for all three; faded figures are fractions of a full-time position.</p>
    <div className="mt-6 grid xl:grid-cols-3 gap-4">{(Object.keys(MODELS) as SchoolType[]).map((type) => <ModelCard key={type} type={type} />)}</div>
    <p className="mt-5 text-xs text-ink-muted">Base formula values only. Districts use levies and other available funding to hire beyond these allocations.</p>
  </div>;
}
