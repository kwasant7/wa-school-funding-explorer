import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  HIGH_POVERTY_THRESHOLD,
  LAP_COMP,
  calculateBenefits,
  highPovertyLapTeacherFte,
  lapFor,
  lapTeacherFte,
} from '@/lib/lap';
import { SIMULATOR_CONTROLS } from '@/lib/simulator-config';
import lapInputs from '@/data/lap-inputs.json';
import allocationJson from '@/data/allocation.json';

describe('LAP statutory formula', () => {
  test('matches the simplified per-eligible-student constant', () => {
    // 2.3975 hrs/week x 36 weeks / (15 per group x 900 annual hours)
    const perEligible = lapTeacherFte(1, 1);
    assert.ok(Math.abs(perEligible - 0.0063933333) < 1e-9);
  });

  test('a 0% poverty rate generates 0 base LAP FTE', () => {
    assert.equal(lapTeacherFte(10_000, 0), 0);
  });

  test('higher poverty means more base LAP funding, enrollment held constant', () => {
    const lo = lapTeacherFte(5_000, 0.2);
    const hi = lapTeacherFte(5_000, 0.4);
    assert.ok(hi > lo);
    // Dollars are FTE x fixed compensation, so the ordering carries through.
    assert.ok(
      hi * LAP_COMP.certificatedSalary + calculateBenefits(hi * LAP_COMP.certificatedSalary) >
        lo * LAP_COMP.certificatedSalary + calculateBenefits(lo * LAP_COMP.certificatedSalary)
    );
  });

  test('a larger district gets more LAP, poverty held constant', () => {
    assert.ok(lapTeacherFte(20_000, 0.3) > lapTeacherFte(2_000, 0.3));
  });

  test('High-Poverty LAP is zero below the 50% threshold', () => {
    assert.equal(highPovertyLapTeacherFte(10_000, 0.4999), 0);
    assert.ok(highPovertyLapTeacherFte(10_000, HIGH_POVERTY_THRESHOLD) > 0);
  });
});

describe('LAP per district', () => {
  test('changes when the district changes', () => {
    const seattle = lapFor('17001');
    const aberdeen = lapFor('14005');
    assert.ok(seattle && aberdeen);
    assert.ok(seattle.totalTeacherFte > 0 && aberdeen.totalTeacherFte > 0);
    assert.notEqual(seattle.totalFunding, aberdeen.totalFunding);
  });

  test('high-poverty add-on only where the district-wide share qualifies', () => {
    for (const [code, input] of Object.entries(lapInputs.districts)) {
      const lap = lapFor(code);
      assert.ok(lap);
      if (input.poverty < HIGH_POVERTY_THRESHOLD) {
        assert.equal(lap.highPovertyTeacherFte, 0);
        assert.equal(lap.qualifiesHighPoverty, false);
      }
    }
  });

  test('takes no simulator state - the model is a function of the code alone', () => {
    // Same call twice, byte-identical result: nothing else can move it.
    assert.deepEqual(lapFor('17001'), lapFor('17001'));
    assert.equal(lapFor.length, 1);
  });
});

describe('LAP calibration', () => {
  test('statewide modeled total matches the actual statewide allocation', () => {
    let modeled = 0;
    let actual = 0;
    for (const code of Object.keys(lapInputs.districts)) {
      const lap = lapFor(code);
      if (!lap || lap.actualAllocation == null) continue;
      modeled += lap.totalFunding;
      actual += lap.actualAllocation;
    }
    // By construction; a drift here means the inputs and the extract have
    // been regenerated out of step with each other.
    assert.ok(Math.abs(modeled - actual) / actual < 1e-6);
    assert.ok(actual > 400e6, 'statewide LAP should be hundreds of millions');
  });

  test('benefit rate is the extract’s own funded rate', () => {
    let salaries = 0;
    let benefits = 0;
    for (const d of Object.values(allocationJson.districts)) {
      salaries += d.salaries;
      benefits += d.benefits;
    }
    assert.ok(Math.abs(LAP_COMP.benefitRate - benefits / salaries) < 1e-9);
  });
});

describe('LAP is not a slider', () => {
  test('no simulator control mentions LAP', () => {
    for (const control of SIMULATOR_CONTROLS) {
      assert.ok(!/lap|learningAssistance/i.test(control.id));
    }
  });
});
