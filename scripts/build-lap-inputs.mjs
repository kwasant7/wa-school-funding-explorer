import fs from 'node:fs/promises';
import path from 'node:path';

/*
  The LAP statute funds the CURRENT year from the PRIOR year's numbers: RCW
  28A.150.260(10)(a) allocates learning-assistance hours "based on the
  district's percentage of students in grades K-12 who were eligible for free
  or reduced-price meals in the prior school year", applied to prior-year
  enrollment. history.json holds every year, but it weighs a megabyte, and the
  simulator - the only consumer - needs exactly two numbers per district. This
  emits them at ~10KB, the same reasoning as enrollment-baseline.json.

  Re-run after `npm run fetch-data` refreshes history.json:

      node scripts/build-lap-inputs.mjs
*/

const ROOT = process.cwd();
const history = JSON.parse(
  await fs.readFile(path.join(ROOT, 'src/data/history.json'), 'utf8')
);

const modelYear = history.latest;
const years = history.years;
const priorYear = years[years.indexOf(modelYear) - 1];
if (!priorYear) throw new Error(`No prior year before ${modelYear}`);

const prior = history.byYear[priorYear];
const districts = {};
for (const d of prior.districts) {
  districts[d.code] = {
    /** Prior-year annual-average FTE enrollment - the statute's student base. */
    aafte: Math.round(d.fundingEnrollment * 100) / 100,
    /**
     * Prior-year low-income share of October headcount. Report Card
     * "Low-Income" is students eligible for free or reduced-price meals, the
     * same population the statute's FRPM percentage counts.
     */
    poverty:
      d.enrollment > 0
        ? Math.round((d.demo.lowIncome / d.enrollment) * 10000) / 10000
        : 0,
  };
}

const out = {
  modelYear,
  priorYear,
  source:
    'Derived from history.json (OSPI Report Card enrollment and low-income headcount, P-223 funding FTE). See scripts/build-lap-inputs.mjs.',
  districts,
};

await fs.writeFile(
  path.join(ROOT, 'src/data/lap-inputs.json'),
  JSON.stringify(out)
);
console.log(
  `Wrote lap-inputs.json: ${Object.keys(districts).length} districts, ${priorYear} inputs for the ${modelYear} model year`
);
