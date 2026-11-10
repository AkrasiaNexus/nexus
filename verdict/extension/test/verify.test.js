const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyTimer, verifyStock, annualCost, workHours } = require('../src/verify.js');
const { parsePrice, parsePeriodPrice, parseTimerSeconds } = require('../src/detectors.js');

const T0 = Date.UTC(2026, 10, 10, 12, 0, 0);

test('first sighting of a timer is recorded as new', () => {
  const r = verifyTimer(undefined, 299, T0);
  assert.equal(r.status, 'new');
  assert.equal(r.record.deadline, T0 + 299000);
});

test('a real timer keeps the same deadline when you come back', () => {
  const first = verifyTimer(undefined, 299, T0).record;
  const r = verifyTimer(first, 239, T0 + 60000);
  assert.equal(r.status, 'consistent');
});

test('a timer that jumps back to full after a reload is proven fake', () => {
  const first = verifyTimer(undefined, 299, T0).record;
  const r = verifyTimer(first, 299, T0 + 60000);
  assert.equal(r.status, 'reset');
  assert.equal(r.record, first, 'keeps the original deadline so later visits still compare against it');
});

test('one second of rounding drift does not count as a reset', () => {
  const first = verifyTimer(undefined, 299, T0).record;
  assert.equal(verifyTimer(first, 290, T0 + 8000).status, 'consistent');
});

test('the same stock count after a full day is flagged as frozen', () => {
  const first = verifyStock(undefined, 2, T0).record;
  assert.equal(verifyStock(first, 2, T0 + 3600e3).status, 'watching');
  assert.equal(verifyStock(first, 2, T0 + 864e5).status, 'frozen');
});

test('a stock count that changes starts a fresh record', () => {
  const first = verifyStock(undefined, 2, T0).record;
  const r = verifyStock(first, 5, T0 + 864e5);
  assert.equal(r.status, 'new');
  assert.equal(r.record.count, 5);
});

test('annual cost and work hours', () => {
  assert.equal(annualCost(59, 'month'), 708);
  assert.equal(annualCost(10, 'week'), 520);
  assert.equal(annualCost(99, 'year'), 99);
  assert.equal(annualCost(5, 'decade'), null);
  assert.equal(workHours(52, 26), 2);
  assert.equal(workHours(52, 0), null);
});

test('price parsing handles currency before or after, and commas', () => {
  assert.equal(parsePrice('Add protection · AED 29'), 29);
  assert.equal(parsePrice('only 1,299.50 AED today'), 1299.5);
  assert.equal(parsePrice('$4.99 upgrade'), 4.99);
  assert.equal(parsePrice('no price here'), null);
});

test('recurring price parsing reads the period', () => {
  assert.deepEqual(parsePeriodPrice('then AED 59 a month'), { price: 59, period: 'month' });
  assert.deepEqual(parsePeriodPrice('$9.99/mo after trial'), { price: 9.99, period: 'month' });
  assert.deepEqual(parsePeriodPrice('£120 per year'), { price: 120, period: 'year' });
  assert.equal(parsePeriodPrice('AED 59 once'), null);
});

test('timer parsing reads mm:ss, h:mm:ss and 1h 30m', () => {
  assert.equal(parseTimerSeconds('ends in 04:59'), 299);
  assert.equal(parseTimerSeconds('ends in 1:02:03'), 3723);
  assert.equal(parseTimerSeconds('offer ends in 1h 30m'), 5400);
  assert.equal(parseTimerSeconds('opens 10:30 am'), null);
});
