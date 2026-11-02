/*
 * M Aurora ver2 · Option 9 (2 Nov 2026): layout finder + compare logic.
 * Framework-free. The ONE source of unit data, instalment maths, budget brackets and matching for the
 * quiz, the Compare all 5 section and the sticky bar. Nothing else on the page carries these numbers.
 * From the design handoff's finder-logic.js; plan paths and the alternative badge rule adjusted here.
 * 2 Nov 2026 (Justin): a couple counts Type A's +1 study as their second room, so a 1+1 fits a couple. The handoff
 * flagged it "Too small for couple", which steered budget couples away from the only layout in their range.
 * 2 Nov 2026 (Justin): only Types C, D and E have a balcony (as the page's FAQ says), so 'Balcony' now counts in the match.
 *
 *   var r = MAFinder.match({ household: 'family', bracket: 'b3', must: { bath3: true } });
 *   r.best.id -> 'D'   r.runner.id -> 'C'   r.bestTag -> 'best'
 *
 * Tests: node --test tests/   (the four verified outputs from IMPLEMENTATION.md section 4)
 */
(function (root) {
  'use strict';

  // ---- Unit data (m-aurora.com.my/floor-plans and the client price list of 2026-08-21) ----
  var UNITS = [
    { id: 'A', bed: '1+1', beds: 1, bath: 1, sqft: 556,  price: 339000, study: true,  balcony: false, plan: '_plan-A.jpg' },
    { id: 'B', bed: '2',   beds: 2, bath: 2, sqft: 737,  price: 516000, study: false, balcony: false, plan: '_plan-B.jpg' },
    { id: 'C', bed: '3',   beds: 3, bath: 2, sqft: 858,  price: 601000, study: false, balcony: true,  plan: '_plan-C.jpg' },
    { id: 'D', bed: '3',   beds: 3, bath: 3, sqft: 916,  price: 616000, study: false, balcony: true,  plan: '_plan-D.jpg' },
    { id: 'E', bed: '4',   beds: 4, bath: 3, sqft: 1019, price: 682000, study: false, balcony: true,  plan: '_plan-E.jpg' }
  ];

  // ---- Loan assumptions: the same as the calculator this section replaced ----
  var LOAN = { margin: 0.9, years: 35, rate: 0.036 };

  function monthly(price) {
    var r = LOAN.rate / 12, n = LOAN.years * 12, p = price * LOAN.margin;
    return Math.round(p * r / (1 - Math.pow(1 + r, -n)));
  }
  // A 1,279 · B 1,946 · C 2,267 · D 2,324 · E 2,572

  function fmt(n) { return Math.round(n).toLocaleString('en-MY'); }

  // ---- Quiz options ----
  var HOUSEHOLD = [
    { key: 'me',     label: 'Just me',            minBeds: 1 },
    { key: 'couple', label: 'Couple',             minBeds: 2, studyCounts: true },  // the +1 study is their 2nd room
    { key: 'family', label: 'Family with kids',   minBeds: 3 },
    { key: 'multi',  label: '3 generations',      minBeds: 4 },
    { key: 'invest', label: 'Buying to rent out', minBeds: 1 }
  ];
  // Cut-offs chosen so each bracket separates the types. Re-check if LOAN changes.
  var BRACKETS = [
    { key: 'b1', label: 'Under RM 1,500',  max: 1500 },
    { key: 'b2', label: 'RM 1,500–2,200',  max: 2200 },
    { key: 'b3', label: 'RM 2,200–2,500',  max: 2500 },
    { key: 'b4', label: 'Above RM 2,500',  max: Infinity }
  ];
  // high floor is passed to sales only; it does not change the match.
  var MUST = [
    { key: 'balcony', label: 'Balcony',            affectsMatch: true },
    { key: 'bath3',   label: '3 bathrooms',        affectsMatch: true },
    { key: 'office',  label: 'Home-office corner', affectsMatch: true },
    { key: 'high',    label: 'High floor',         affectsMatch: false }
  ];

  function find(list, key) { for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i]; return null; }
  // rooms a household can use: bedrooms, plus the +1 study where that household counts it (couple only)
  function rooms(u, hh) { return u.beds + (hh && hh.studyCounts && u.study ? 1 : 0); }
  function unit(id) { for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === id) return UNITS[i]; return null; }

  function evaluate(answers) {
    answers = answers || {};
    var hh = find(HOUSEHOLD, answers.household);
    var br = find(BRACKETS, answers.bracket);
    var must = answers.must || {};
    var need = hh ? hh.minBeds : 1;
    var max = br ? br.max : Infinity;
    return UNITS.map(function (u) {
      var m = monthly(u.price), issues = [];
      if (rooms(u, hh) < need) issues.push(answers.household === 'multi' ? 'Too small for 3 generations' : 'Too small for ' + (hh ? hh.label.toLowerCase() : 'you'));
      else {
        if (must.balcony && !u.balcony) issues.push('No balcony');
        if (must.bath3 && u.bath < 3) issues.push('No 3rd bathroom');
        if (must.office && !(u.study || u.beds > need)) issues.push('No spare room for a home office');
      }
      var out = {};
      for (var k in u) if (u.hasOwnProperty(k)) out[k] = u[k];
      out.monthly = m; out.within = m <= max; out.over = out.within ? 0 : m - max;
      out.fits = issues.length === 0; out.issue = issues.join(' · ');
      return out;
    });
  }

  function match(answers) {
    var units = evaluate(answers);
    var hh = find(HOUSEHOLD, answers.household), need = (hh || { minBeds: 1 }).minBeds;
    var bySqDesc = function (a, b) { return b.sqft - a.sqft; };
    var byMonthlyAsc = function (a, b) { return a.monthly - b.monthly; };

    var fitWithin = units.filter(function (u) { return u.fits && u.within; }).sort(bySqDesc);
    var fitOver = units.filter(function (u) { return u.fits && !u.within; }).sort(byMonthlyAsc);
    var best, tag;
    if (fitWithin.length) { best = fitWithin[0]; tag = 'best'; }                 // most space inside budget
    else if (fitOver.length) { best = fitOver[0]; tag = 'closest_above_budget'; } // cheapest that fits needs
    else { best = units.filter(function (u) { return u.within; }).sort(function (a, b) { return b.beds - a.beds; })[0] || units[0]; tag = 'closest'; }

    var pool = units.filter(function (u) { return u.id !== best.id; });
    var runner = pool.filter(function (u) { return u.fits && u.within; }).sort(bySqDesc)[0]
      || pool.filter(function (u) { return u.within && rooms(u, hh) >= need; }).sort(bySqDesc)[0]
      || pool.filter(function (u) { return u.fits; }).sort(byMonthlyAsc)[0]
      || pool.filter(function (u) { return u.within; }).sort(bySqDesc)[0]
      || pool[0];

    return { best: best, bestTag: tag, runner: runner, runnerFits: runner.fits, units: units };
  }

  // "RM 57/mo less, 1 fewer bathroom"
  function diffLine(best, other) {
    var bits = [], dm = other.monthly - best.monthly, db = other.bath - best.bath;
    if (dm !== 0) bits.push('RM ' + fmt(Math.abs(dm)) + '/mo ' + (dm < 0 ? 'less' : 'more'));
    if (db !== 0) bits.push(Math.abs(db) + ' ' + (db < 0 ? 'fewer' : 'more') + ' bathroom' + (Math.abs(db) > 1 ? 's' : ''));
    else if (other.sqft !== best.sqft) bits.push(fmt(Math.abs(other.sqft - best.sqft)) + ' sq ft ' + (other.sqft < best.sqft ? 'smaller' : 'bigger'));
    return bits.join(', ');
  }

  // Badge copy (IMPLEMENTATION.md section 4): the alternative card
  function runnerBadge(runner) {
    if (runner.fits && runner.within) return 'ALSO FITS YOU';
    if (runner.fits) return 'WORTH A STRETCH';
    return 'CLOSEST ALTERNATIVE';
  }
  function bestBadge(tag) {
    return tag === 'best' ? 'YOUR BEST MATCH' : (tag === 'closest_above_budget' ? 'CLOSEST MATCH · ABOVE YOUR RANGE' : 'CLOSEST MATCH');
  }
  // one-line reason under the best-match card
  function bestReason(best, answers) {
    var br = find(BRACKETS, (answers || {}).bracket), must = (answers || {}).must || {};
    var s = best.within ? 'Most space within your ' + (br ? br.label : 'budget') + ' range' : 'Most affordable layout that fits your needs';
    var asked = [];
    if (must.bath3 && best.bath >= 3) asked.push('the 3 bathrooms');
    if (must.balcony && best.balcony) asked.push('a balcony');
    return s + (asked.length ? ', with ' + asked.join(' and ') + ' you asked for.' : '.');
  }
  // answer chips for the finder bar, and the string that goes with the lead
  function answerLabels(answers) {
    answers = answers || {};
    var hh = find(HOUSEHOLD, answers.household), br = find(BRACKETS, answers.bracket), must = answers.must || {};
    var m = MUST.filter(function (x) { return must[x.key]; }).map(function (x) { return x.label; });
    return { household: hh ? hh.label : '', bracket: br ? br.label : '', must: m,
      chips: [hh ? hh.label : '', br ? br.label : ''].concat(m).filter(Boolean) };
  }
  function finderString(answers) {
    var a = answerLabels(answers);
    return [a.household, a.bracket, a.must.join(', ')].filter(Boolean).join(' | ');
  }

  root.MAFinder = { UNITS: UNITS, LOAN: LOAN, HOUSEHOLD: HOUSEHOLD, BRACKETS: BRACKETS, MUST: MUST,
    monthly: monthly, fmt: fmt, unit: unit, find: find, evaluate: evaluate, match: match, diffLine: diffLine,
    runnerBadge: runnerBadge, bestBadge: bestBadge, bestReason: bestReason, answerLabels: answerLabels, finderString: finderString };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MAFinder;
})(typeof window !== 'undefined' ? window : globalThis);
