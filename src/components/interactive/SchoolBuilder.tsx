'use client';

import type { District } from '@/lib/data';
import allocationData from '@/data/allocation.json';
import SourceShareBar from '@/components/charts/SourceShareBar';
import { fmtMoney, fmtMoneyFull } from '@/lib/format';
import { LATEST } from '@/lib/years';
import {
  CLASS_SIZE,
  ELEMENTARY_BAND_SPLIT,
  PROTOTYPES,
  STAFF_ROLES,
  teacherUnits,
  type SchoolType,
} from '@/lib/prototypical-model';

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

function fmtFteLong(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Funded teachers for one prototype.
 *
 * Elementary spans two class-size bands, so it is summed from the district's
 * own K-3 and grades 4-6 funding FTE; with no district selected it falls back
 * to the statutory four-of-seven grade split. Every level is then grossed up
 * for planning time, which is the half of RCW 28A.150.260(4)(a)(i) that a bare
 * enrollment-over-class-size division leaves out.
 */
function fundedTeachers(type: SchoolType, fte: number, district?: District | null) {
  const { planningTime } = PROTOTYPES[type];
  if (type === 'elementary') {
    const k3 = district ? district.fundingFte.k3 : fte * ELEMENTARY_BAND_SPLIT.k3;
    const grades46 = district ? district.fundingFte.grades46 : fte * ELEMENTARY_BAND_SPLIT.grades46;
    return (
      teacherUnits(k3, CLASS_SIZE.k3, planningTime) +
      teacherUnits(grades46, CLASS_SIZE.grades46, planningTime)
    );
  }
  const classSize = type === 'middle' ? CLASS_SIZE.grades78 : CLASS_SIZE.grades912;
  return teacherUnits(fte, classSize, planningTime);
}

function modelStaff(type: SchoolType, district?: District | null) {
  const model = PROTOTYPES[type];
  const fundingFte = district ? district.fundingFte[type] : model.proto;
  const teachers = fundedTeachers(type, fundingFte, district);
  const staff = STAFF_ROLES.map((row) => ({
    role: row.label,
    statutory: row.statutory,
    conditional: 'conditional' in row && row.conditional === true,
    fte: (fundingFte * row[type]) / model.proto,
  }));
  const totalStaff = teachers + staff.reduce((total, item) => total + item.fte, 0);
  return { fundingFte, teachers, staff, totalStaff };
}

function ModelCard({
  type,
  district,
}: {
  type: SchoolType;
  district?: District | null;
}) {
  const model = PROTOTYPES[type];
  const { fundingFte, teachers, staff, totalStaff } = modelStaff(type, district);
  const modelSchools = fundingFte / model.proto;
  const modelSchoolLabel =
    type === 'high' ? 'high schools' : `${model.label.toLowerCase()} schools`;
  const nurseRate = STAFF_ROLES.find((r) => r.label === 'Nurses')![type] / model.proto;

  return <article className="border border-line rounded-xl p-4 md:p-5">
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <div>
        <h4 className="text-lg font-bold">{model.label}</h4>
        <p className="mt-0.5 text-xs text-ink-muted">
          {model.grades} · {model.proto}-FTE state prototype
        </p>
      </div>
      <p className="text-sm text-ink-secondary">
        <strong className="text-ink text-lg">{fmtFteLong(fundingFte)}</strong>{' '}
        {district ? 'funding FTE' : 'students'}
      </p>
    </div>
    {district && (
      <p className="mt-2 text-sm font-medium text-accent-deep">
        ≈ {modelSchools.toFixed(2)} prototypical {modelSchoolLabel}
      </p>
    )}
    <div className="mt-5 space-y-4">
      <div>
        {/*
          Two ratios live here and they are not the same number. The funded
          class size is students in a room; students per funded teacher is
          lower, because the formula also pays for the teachers covering
          everyone else's planning period. Showing the class size in this slot
          - which this card did until the planning-time factor was added -
          told readers the state funds 29 students per high school teacher
          when it funds about 24.
        */}
        <div className="flex items-baseline gap-2 flex-wrap"><span className="w-36 shrink-0 text-sm font-semibold">Teachers</span><span className="text-sm tabular-nums font-bold text-accent-deep w-12">{fmtFte(teachers)}</span><span className="text-xs text-ink-muted">≈ {Math.round(fundingFte / teachers)} students per funded teacher, after planning time</span></div>
        <div className="mt-1.5 pl-0 md:pl-36"><StaffIcons count={teachers} /></div>
      </div>
      {staff.map(({ role, fte, conditional, statutory }) => <div key={role}>
        <div className="flex items-baseline gap-2 flex-wrap"><span className="w-36 shrink-0 text-sm font-semibold" title={statutory}>{role}{conditional && <span className="text-accent-deep" title="Funded only in proportion to the staff the district actually employs - RCW 28A.150.260(5)(b)">*</span>}</span><span className="text-sm tabular-nums font-bold text-accent-deep w-12">{fmtFte(fte)}</span>
          {role === 'Counselors' && fte > 0 && <span className="text-xs text-ink-muted">1 for every {Math.round(fundingFte / fte).toLocaleString()} students · the American School Counselor Association recommends 1 per 250</span>}
          {/*
            Stated per prototypical school, not per district: the district-wide
            total ("1,574 hours a week" for Seattle) is a true number that tells
            a reader nothing. The rate below is the same at any district size.
          */}
          {role === 'Nurses' && <span className="text-xs text-ink-muted">≈ {Math.round(nurseRate * model.proto * 40)} hours of nurse time a week in a {model.proto}-student school</span>}
        </div>
        <div className="mt-1.5 pl-0 md:pl-36"><StaffIcons count={fte} /></div>
      </div>)}
    </div>
    <p className="mt-5 border-t border-line pt-3 text-sm text-ink-secondary">
      <strong className="text-ink">{fmtFte(totalStaff)} school-level staff FTE</strong>{' '}
      for {fmtFteLong(fundingFte)} {district ? 'funding FTE' : 'students'}
    </p>
  </article>;
}

type SmallSchool = (typeof allocationData.districts)[keyof typeof allocationData.districts]['smallSchool'];
const ALLOCATION = allocationData.districts as Record<string, { smallSchool: SmallSchool }>;

/*
  The provisions in the budget's small-school subsection (2024 supplemental,
  ESSB 5950 sec. 502(13)), in the words a reader needs to recognize their own
  district. OSPI's apportionment flags which ones a district qualifies under.
*/
const SMALL_SCHOOL_KINDS: Record<string, { label: string; description: string }> = {
  smallHigh: {
    label: 'Small high school',
    description: 'fewer than 300 students in grades 9-12',
  },
  smallDistrict: {
    label: 'Small district',
    description: '100 or fewer students in grades K-8',
  },
  remoteNecessary: {
    label: 'Remote and necessary school',
    description: 'an isolated school OSPI has judged remote and necessary',
  },
  nonHigh: {
    label: 'Non-high district',
    description: 'runs no high school of its own',
  },
};

/**
 * Staff the state funds on top of the prototype recipe for schools too small
 * for it. The recipe scales staff down with enrollment, so a 51-student high
 * school earns about two and a half teachers - not enough to offer a high
 * school's courses. The budget guarantees a minimum instead (nine certificated
 * instructional units and half an administrator for a high school's first 60
 * students) and pays the difference. Without this card the builder showed a
 * district like Inchelium only its recipe staff, then told readers anything
 * beyond that was local money, when the state was paying for 6.4 more
 * certificated staff.
 */
function SmallSchoolCard({
  units,
  district,
  year,
  formulaStaff,
}: {
  units: SmallSchool;
  district: District;
  year: string;
  formulaStaff: number;
}) {
  const total = units.cis + units.cas + units.cls;
  // `label`, not `role`: the translation collector only reads string values
  // under the property names in its TEXT_PROPERTIES list.
  const rows = [
    {
      label: 'Certificated instructional staff',
      detail: 'teachers, librarians, counselors and other certificated staff',
      fte: units.cis,
    },
    {
      label: 'Certificated administrators',
      detail: 'principals and other administrators',
      fte: units.cas,
    },
    {
      label: 'Classified staff',
      detail: 'office, custodial, paraeducator and other support staff',
      fte: units.cls,
    },
  ];

  return <article className="mt-4 rounded-xl border border-accent-soft bg-accent-wash p-4 md:p-5">
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <h4 className="text-lg font-bold">Small-school staffing</h4>
      <p className="text-sm text-ink-secondary">
        <strong className="text-ink text-lg">+{fmtFte(total)}</strong> staff units
      </p>
    </div>
    <p className="mt-2 text-sm text-ink-secondary">
      The prototype recipe cannot staff a very small school, so the state
      budget guarantees a minimum and pays the difference on top of the model
      schools above. <span data-no-translate>{district.name}</span> qualifies
      as:
    </p>
    <ul className="mt-2 space-y-1 text-sm text-ink-secondary">
      {units.kinds.map((kind) => {
        const k = SMALL_SCHOOL_KINDS[kind];
        return k ? <li key={kind}>
          <strong className="text-ink">{k.label}</strong> - {k.description}
        </li> : null;
      })}
    </ul>
    <div className="mt-4 space-y-4">
      {rows.filter((r) => r.fte > 0).map(({ label, detail, fte }) => <div key={label}>
        <div className="flex items-baseline gap-2 flex-wrap"><span className="w-36 shrink-0 text-sm font-semibold">{label}</span><span className="text-sm tabular-nums font-bold text-accent-deep w-12">{fmtFte(fte)}</span><span className="text-xs text-ink-muted">{detail}</span></div>
        <div className="mt-1.5 pl-0 md:pl-36"><StaffIcons count={fte} /></div>
      </div>)}
    </div>
    <p className="mt-5 border-t border-accent-soft pt-3 text-sm text-ink-secondary">
      <strong className="text-ink">{fmtFte(total)} more state-funded staff units</strong>{' '}
      on top of the roughly {fmtFte(formulaStaff)} the model schools above
      generate.
    </p>
    <p className="mt-2 text-xs text-ink-muted">
      Units from OSPI&apos;s {year} apportionment, already net of the formula
      staff above. Their salaries and benefits are part of the state
      allocation below. Source: the{' '}
      <a
        href="https://lawfilesext.leg.wa.gov/biennium/2023-24/Pdf/Bills/Session%20Laws/Senate/5950-S.SL.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-accent underline underline-offset-2"
      >
        2024 supplemental budget ↗
      </a>
      , section 502(13).
    </p>
  </article>;
}

export default function SchoolBuilder({
  district,
  year = LATEST,
}: {
  district?: District | null;
  year?: string;
}) {
  const modelSchoolTotal = district
    ? district.fundingFte.elementary / PROTOTYPES.elementary.proto +
      district.fundingFte.middle / PROTOTYPES.middle.proto +
      district.fundingFte.high / PROTOTYPES.high.proto
    : 0;
  // Small-school units are an apportionment figure for one year, so they are
  // only shown when the builder is on that year.
  const smallSchool =
    district && year === allocationData.schoolYear
      ? ALLOCATION[district.code]?.smallSchool ?? null
      : null;
  const hasSmallSchool =
    smallSchool != null && smallSchool.cis + smallSchool.cas + smallSchool.cls > 0;
  const formulaStaff = (Object.keys(PROTOTYPES) as SchoolType[]).reduce(
    (total, type) => total + modelStaff(type, district).totalStaff,
    0
  );

  return <div className="card p-5 md:p-7">
    <h3 className="text-xl md:text-2xl font-bold">
      {district
        ? `${district.name}'s model-school calculation`
        : 'The three model schools, side by side'}
    </h3>
    <p className="mt-1 text-sm text-ink-secondary">
      {district
        ? `The state applies the same prototype recipe to ${district.name}'s actual ${year} funding FTE by grade span. The results below are formula equivalents - not the district's literal number of buildings or employees.`
        : 'RCW 28A.150.260 defines a prototype for each grade span. These are the school-level staffing allocations for all three; faded figures are fractions of a full-time position.'}
    </p>

    {district && (
      <div className="mt-5 rounded-xl border border-accent-soft bg-accent-wash p-4 md:p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-ink-secondary">
              Actual general-fund total ({year})
            </p>
            <p className="mt-0.5 text-xl font-bold">{fmtMoney(district.rev.total)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-secondary">Funding per FTE</p>
            <p className="mt-0.5 text-xl font-bold">{fmtMoneyFull(district.perPupil)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-secondary">On-campus K-12 funding FTE</p>
            <p className="mt-0.5 text-xl font-bold">
              {fmtFteLong(
                district.fundingFte.elementary +
                district.fundingFte.middle +
                district.fundingFte.high
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-secondary">Equivalent model schools</p>
            <p className="mt-0.5 text-xl font-bold">{modelSchoolTotal.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4">
          <SourceShareBar slices={district.rev} />
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Actual revenue · includes funding outside the prototype formula.
        </p>
        <details className="mt-2 text-xs text-ink-muted">
          <summary className="cursor-pointer font-semibold text-accent hover:underline">
            Calculation notes
          </summary>
          <p className="mt-2">
            Running Start college enrollment: {fmtFteLong(district.fundingFte.runningStart)} FTE.
            Funded separately from the on-campus prototype calculation.
          </p>
        </details>
      </div>
    )}

    {/*
      The staff counts below are generated by a state formula and paid for with
      state dollars. Saying so here keeps them from being read as a headcount of
      everyone the district employs, which local levy and federal money also pay
      for.
    */}
    <p className="mt-6 rounded-lg border border-accent-soft bg-accent-wash px-4 py-3 text-sm text-ink-secondary">
      <strong className="text-ink">This is state funding.</strong> The staff
      below are what Washington&apos;s formula allocates and pays for, including
      the extra staff very small and remote schools get. Anything a district
      staffs beyond these numbers comes out of local levy, federal, or other
      money.
    </p>

    <div className="mt-4 grid xl:grid-cols-3 gap-4">
      {(Object.keys(PROTOTYPES) as SchoolType[]).map((type) => (
        <ModelCard key={type} type={type} district={district} />
      ))}
    </div>
    {district && hasSmallSchool && (
      <SmallSchoolCard
        units={smallSchool}
        district={district}
        year={year}
        formulaStaff={formulaStaff}
      />
    )}
    <p className="mt-5 text-xs text-ink-muted">
      School-level staff only, from RCW 28A.150.260(4) and (5). Roles marked *
      are funded in proportion to the staff a district can show it employs.
    </p>
  </div>;
}
