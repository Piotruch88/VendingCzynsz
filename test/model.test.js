// Wartości oczekiwane pochodzą z arkusza Excel przeliczonego w Excelu.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/model');

test('liceum, 500 uczniów, 1 automat – zgodnie z Excelem', () => {
  const r = M.calculate({ students: 500, schoolType: 'Liceum ogólnokształcące', machines: 1 });
  assert.equal(r.rent.min, 180);
  assert.equal(r.rent.max, 560);
  assert.equal(r.rent.mid, 370);
  assert.equal(r.perYear.min, 1800);
  assert.equal(r.perYear.max, 5600);
  assert.equal(r.energyFlat, 200);
  assert.equal(r.suggestedMachines, 1);
  assert.equal(r.operatorWarning, false);
  assert.ok(Math.abs(r.operatorShare.min - 0.255) < 0.001);
  assert.ok(Math.abs(r.operatorShare.max - 0.377) < 0.001);
});

test('tabela stawek – zgodnie z arkuszem Tabela', () => {
  const expected = {
    50: [1, 150, 150, 150], 100: [1, 150, 150, 150], 150: [1, 150, 170, 160],
    200: [1, 150, 220, 190], 250: [1, 150, 280, 220], 300: [1, 150, 330, 240],
    400: [1, 150, 450, 300], 500: [1, 180, 560, 370], 600: [1, 210, 670, 440],
    700: [1, 250, 780, 520], 800: [1, 280, 890, 590], 900: [1, 320, 1000, 660],
    1000: [1, 350, 1110, 730], 1200: [1, 420, 1340, 880], 1500: [1, 530, 1670, 1100],
    2000: [2, 710, 2230, 1470],
  };
  for (const row of M.rateTable('Liceum ogólnokształcące')) {
    assert.deepEqual([row.machines, row.min, row.max, row.mid], expected[row.students], `uczniów: ${row.students}`);
  }
});

test('mała szkoła – działa próg minimalny', () => {
  const r = M.calculate({ students: 50, machines: 1 });
  assert.equal(r.rent.min, 150);
  assert.equal(r.rent.max, 150);
});

test('limit wydajności i sugerowana liczba automatów', () => {
  const r = M.calculate({ students: 3000, machines: 1 });
  assert.equal(r.scenarios.max.transactions, 120);
  assert.ok(r.scenarios.max.demand > 120);
  assert.equal(r.suggestedMachines, 2);
  assert.equal(r.tooFewMachines, true);
});

test('typ szkoły obniża popyt', () => {
  const lo = M.calculate({ students: 1000, schoolType: 'Liceum ogólnokształcące' });
  const sp = M.calculate({ students: 1000, schoolType: 'Szkoła podstawowa' });
  assert.ok(sp.rent.max < lo.rent.max);
  assert.equal(sp.factor, 0.7);
});

test('nadpisanie założeń', () => {
  const r = M.calculate({ students: 500 }, { commission: { min: 0.2, max: 0.2 } });
  assert.ok(r.rent.min > 180);
  const d = M.mergeAssumptions({ vat: 'abc' });
  assert.equal(d.vat, M.DEFAULTS.vat);
});

test('brak uczniów nie psuje obliczeń', () => {
  const r = M.calculate({ students: 0 });
  assert.equal(r.rent.min, 150);
  assert.equal(r.operatorShare.min, 0);
});
