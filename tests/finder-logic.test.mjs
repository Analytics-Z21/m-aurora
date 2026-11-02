// Option 9 finder logic: the verified outputs from the design handoff (IMPLEMENTATION.md section 4).
//   node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const F = require('../_finder.js');

test('instalment: 90% loan, 35 years, 3.6% p.a.', () => {
  const m = Object.fromEntries(F.UNITS.map(u => [u.id, F.monthly(u.price)]));
  assert.deepEqual(m, { A: 1279, B: 1946, C: 2267, D: 2324, E: 2572 });
});

test('family, RM 2,200-2,500, 3 bathrooms -> best D, alt C (RM 57/mo less, 1 fewer bathroom)', () => {
  const r = F.match({ household: 'family', bracket: 'b3', must: { bath3: true } });
  assert.equal(r.best.id, 'D');
  assert.equal(r.bestTag, 'best');
  assert.equal(r.runner.id, 'C');
  assert.equal(F.diffLine(r.best, r.runner), 'RM 57/mo less, 1 fewer bathroom');
  // C lacks the 3rd bathroom that was asked for, so it is the closest alternative, not a fit
  assert.equal(r.runner.fits, false);
  assert.equal(F.runnerBadge(r.runner), 'CLOSEST ALTERNATIVE');
  const r2 = F.match({ household: 'family', bracket: 'b3', must: {} });
  assert.equal(r2.best.id, 'D');
  assert.equal(r2.runner.id, 'C');
  assert.equal(F.runnerBadge(r2.runner), 'ALSO FITS YOU');
  assert.equal(F.bestReason(r.best, { bracket: 'b3', must: { bath3: true } }), 'Most space within your RM 2,200–2,500 range, with the 3 bathrooms you asked for.');
});

// 2 Nov 2026 (Justin): a couple counts the +1 study, so Type A fits a couple (the handoff had B with C as a stretch here)
test('couple, RM 1,500-2,200 -> best B, alt A (ALSO FITS YOU)', () => {
  const r = F.match({ household: 'couple', bracket: 'b2', must: {} });
  assert.equal(r.best.id, 'B');
  assert.equal(r.bestTag, 'best');
  assert.equal(r.runner.id, 'A');
  assert.equal(F.runnerBadge(r.runner), 'ALSO FITS YOU');
  assert.equal(F.diffLine(r.best, r.runner), 'RM 667/mo less, 1 fewer bathroom');
});

test('couple, under RM 1,500 -> best A within budget, alt B (WORTH A STRETCH)', () => {
  const r = F.match({ household: 'couple', bracket: 'b1', must: {} });
  assert.equal(r.best.id, 'A');
  assert.equal(r.bestTag, 'best');
  assert.equal(r.runner.id, 'B');
  assert.equal(F.runnerBadge(r.runner), 'WORTH A STRETCH');
});

test('the study counts for a couple only', () => {
  const a = h => F.evaluate({ household: h }).find(x => x.id === 'A');
  assert.equal(a('couple').fits, true);
  assert.equal(a('couple').issue, '');
  assert.equal(a('family').issue, 'Too small for family with kids');
  assert.equal(a('multi').issue, 'Too small for 3 generations');
  assert.equal(a('me').fits, true);
  // a couple asking for a home-office corner: the study is the office, A still fits
  assert.equal(F.evaluate({ household: 'couple', must: { office: true } }).find(x => x.id === 'A').fits, true);
});

test('just me, under RM 1,500 -> best A, alt B', () => {
  const r = F.match({ household: 'me', bracket: 'b1', must: {} });
  assert.equal(r.best.id, 'A');
  assert.equal(r.runner.id, 'B');
});

test('3 generations, RM 2,200-2,500 -> closest above budget E, alt D', () => {
  const r = F.match({ household: 'multi', bracket: 'b3', must: {} });
  assert.equal(r.best.id, 'E');
  assert.equal(r.bestTag, 'closest_above_budget');
  assert.equal(F.bestBadge(r.bestTag), 'CLOSEST MATCH · ABOVE YOUR RANGE');
  assert.equal(r.runner.id, 'D');
  assert.equal(F.runnerBadge(r.runner), 'CLOSEST ALTERNATIVE');
});

test('budget evaluation without a quiz: bracket only', () => {
  const u = F.evaluate({ bracket: 'b2' });
  assert.deepEqual(u.map(x => x.within), [true, true, false, false, false]);
  assert.equal(u[2].over, 67);
});

test('finder string and chips for the lead', () => {
  const a = { household: 'family', bracket: 'b3', must: { balcony: true, bath3: true } };
  assert.equal(F.finderString(a), 'Family with kids | RM 2,200–2,500 | Balcony, 3 bathrooms');
  assert.deepEqual(F.answerLabels(a).chips, ['Family with kids', 'RM 2,200–2,500', 'Balcony', '3 bathrooms']);
});
