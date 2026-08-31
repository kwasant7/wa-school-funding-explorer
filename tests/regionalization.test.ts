import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import regionalizationJson from '@/data/regionalization.json';
import districtsJson from '@/data/districts.json';

const { years, districts } = regionalizationJson;

describe('regionalization factors (LEAP Document 3)', () => {
  test('covers every district on the site, charters included', () => {
    for (const d of districtsJson.districts) {
      assert.ok(
        (districts as Record<string, unknown>)[d.code],
        `${d.code} ${d.name} missing from regionalization.json`
      );
    }
  });

  test('includes the model year the profile tiles default to', () => {
    assert.ok(years.includes(districtsJson.schoolYear));
  });

  test('factors are sane: 1.00 to 1.35, one per year, both categories', () => {
    for (const [code, d] of Object.entries(districts)) {
      assert.equal(d.cis.length, years.length, code);
      assert.equal(d.cas.length, years.length, code);
      assert.equal(d.exp.length, years.length, code);
      for (const f of [...d.cis, ...d.cas]) {
        assert.ok(f >= 1 && f <= 1.35, `${code}: ${f}`);
      }
      // The italic experience-adjustment marker only makes sense on a
      // factor that is actually adjusted above the base.
      d.exp.forEach((flag, i) => {
        if (flag) assert.ok(d.cis[i] > 1, code);
      });
    }
  });

  test('spot checks against the published document', () => {
    const seattle = districts['17001'];
    const spokane = districts['32081'];
    const i = years.indexOf('2024-25');
    assert.equal(seattle.cis[i], 1.18);
    assert.equal(seattle.cas[i], 1.18);
    assert.equal(spokane.cis[i], 1);
  });
});
