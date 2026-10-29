// Model czynszu za automaty vendingowe w szkołach.
// Ta sama logika co w arkuszu Excel (excel/Model_czynsz_vending_szkoly.xlsx).
// Działa jako zwykły skrypt w przeglądarce (window.VendingModel) i jako moduł Node (testy).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VendingModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Założenia domyślne. `src` to numery źródeł z sources.js.
  const DEFAULTS = {
    penetration:  { min: 0.04, max: 0.07 },  // udział kupujących dziennie
    avgTicket:    { min: 5.0,  max: 6.0 },   // średnia wartość transakcji brutto, zł
    commission:   { min: 0.10, max: 0.15 },  // czynsz jako % obrotu netto
    staffRatio: 0.10,          // personel jako % liczby uczniów
    daysPerMonth: 18,          // dni nauki w miesiącu
    monthsPerYear: 10,         // miesiące nauki w roku
    vat: 0.12,                 // średnia stawka VAT asortymentu
    floorPerMachine: 150,      // minimalny czynsz za 1 automat, zł/mies.
    capacityPerMachine: 120,   // maks. transakcji dziennie na 1 automat
    areaPerMachine: 1.0,       // m² na automat
    kwhPerMonth: 200,          // zużycie energii 1 automatu, kWh/mies.
    energyPrice: 1.0,          // zł/kWh netto
    operatorMargin: 0.40,      // marża brutto operatora (% obrotu netto)
    marginWarning: 0.40,       // próg ostrzeżenia: czynsz / marża operatora
    rounding: 10,              // zaokrąglenie stawek, zł
  };

  // Opisy założeń do formularza w aplikacji.
  const ASSUMPTION_META = [
    { key: 'penetration', label: 'Udział kupujących dziennie', unit: '%', pct: true, scenario: true,
      note: 'Szacunek własny skalibrowany do obrotów automatów w szkołach.', src: [5, 6, 7, 1, 2] },
    { key: 'avgTicket', label: 'Średnia wartość transakcji brutto', unit: 'zł', scenario: true, step: 0.1,
      note: 'Branżowo 5–8 zł; w szkole dolna część przedziału.', src: [4] },
    { key: 'commission', label: 'Czynsz jako % obrotu netto', unit: '%', pct: true, scenario: true,
      note: 'Standardowe lokalizacje 10–20%, galerie 10–15%.', src: [7, 8] },
    { key: 'staffRatio', label: 'Personel jako % liczby uczniów', unit: '%', pct: true,
      note: 'GUS: 511 tys. nauczycieli na ok. 5,3 mln uczących się.', src: [9] },
    { key: 'daysPerMonth', label: 'Dni nauki w miesiącu', unit: 'dni', step: 1,
      note: 'Ok. 178–182 dni nauki w roku 2025/26 / 10 mies.', src: [10] },
    { key: 'monthsPerYear', label: 'Miesiące nauki w roku', unit: 'mies.', step: 1,
      note: 'Wrzesień–czerwiec.', src: [10] },
    { key: 'vat', label: 'Średnia stawka VAT asortymentu', unit: '%', pct: true,
      note: 'Woda 23%, soki/nabiał/żywność 5%.', src: [3] },
    { key: 'floorPerMachine', label: 'Minimalny czynsz za 1 automat', unit: 'zł/mies.', step: 10,
      note: 'Najniższe ceny wywoławcze w przetargach szkolnych ok. 140 zł.', src: [11] },
    { key: 'capacityPerMachine', label: 'Maks. transakcji dziennie na 1 automat', unit: 'szt.', step: 10,
      note: 'Szacunek własny.', src: [] },
    { key: 'areaPerMachine', label: 'Powierzchnia 1 automatu', unit: 'm²', step: 0.1,
      note: 'W przetargach 1–1,5 m².', src: [12, 14, 16, 19] },
    { key: 'kwhPerMonth', label: 'Zużycie energii 1 automatu', unit: 'kWh/mies.', step: 10,
      note: 'Automat chłodzący: 7–14 kWh/dobę wg BSI, nowsze mniej.', src: [17] },
    { key: 'energyPrice', label: 'Cena energii netto', unit: 'zł/kWh', step: 0.05,
      note: 'Taryfy 2026 ok. 0,8–0,9 zł/kWh + opłaty stałe.', src: [18] },
    { key: 'operatorMargin', label: 'Marża brutto operatora', unit: '%', pct: true,
      note: 'Koszt towaru 50–70% przychodu.', src: [6, 7] },
    { key: 'marginWarning', label: 'Próg ostrzeżenia: czynsz / marża', unit: '%', pct: true,
      note: 'Szacunek własny.', src: [] },
    { key: 'rounding', label: 'Zaokrąglenie stawek do', unit: 'zł', step: 1,
      note: '', src: [] },
  ];

  // Współczynniki popytu wg typu szkoły (szacunki własne).
  const SCHOOL_TYPES = [
    { name: 'Szkoła podstawowa', factor: 0.70 },
    { name: 'Liceum ogólnokształcące', factor: 1.00 },
    { name: 'Technikum', factor: 1.05 },
    { name: 'Szkoła branżowa', factor: 0.95 },
    { name: 'Zespół szkół', factor: 0.95 },
    { name: 'Szkoła policealna / dla dorosłych', factor: 1.10 },
  ];
  const DEFAULT_SCHOOL_TYPE = 'Liceum ogólnokształcące';

  const TABLE_STUDENTS = [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2000];

  function schoolFactor(typeName) {
    const t = SCHOOL_TYPES.find((s) => s.name === typeName);
    return t ? t.factor : 1;
  }

  // Excel ROUND: połówki od zera. Korekta epsilon chroni przed błędami typu 174.99999.
  function roundTo(value, step) {
    if (!step) return value;
    const q = value / step;
    return Math.sign(q) * Math.round(Math.abs(q) + 1e-9) * step;
  }

  function scenario(a, sc, users, factor, machines) {
    const demand = users * factor * a.penetration[sc];
    const transactions = Math.min(demand, machines * a.capacityPerMachine);
    const grossDay = transactions * a.avgTicket[sc];
    const grossMonth = grossDay * a.daysPerMonth;
    const netMonth = grossMonth / (1 + a.vat);
    const fromRevenue = netMonth * a.commission[sc];
    const floor = a.floorPerMachine * machines;
    return { demand, transactions, grossDay, grossMonth, netMonth, fromRevenue, floor };
  }

  /**
   * Wylicza stawki czynszu.
   * @param {{students:number, schoolType?:string, machines?:number}} input
   * @param {object} [assumptions] nadpisania DEFAULTS
   */
  function calculate(input, assumptions) {
    const a = mergeAssumptions(assumptions);
    const students = Math.max(0, Number(input.students) || 0);
    const machines = Math.max(1, Math.floor(Number(input.machines) || 1));
    const factor = schoolFactor(input.schoolType || DEFAULT_SCHOOL_TYPE);
    const users = students * (1 + a.staffRatio);

    const lo = scenario(a, 'min', users, factor, machines);
    const hi = scenario(a, 'max', users, factor, machines);

    const rentMin = roundTo(Math.max(lo.fromRevenue, lo.floor), a.rounding);
    const rentMax = roundTo(Math.max(hi.fromRevenue, hi.floor, rentMin), a.rounding);
    const rentMid = roundTo((rentMin + rentMax) / 2, a.rounding);
    const suggestedMachines = Math.max(1, Math.ceil(hi.demand / a.capacityPerMachine - 1e-9));
    const share = (rent, s) => (s.netMonth > 0 ? rent / (s.netMonth * a.operatorMargin) : 0);
    const operatorShare = { min: share(rentMin, lo), max: share(rentMax, hi) };

    return {
      input: { students, machines, schoolType: input.schoolType || DEFAULT_SCHOOL_TYPE },
      users,
      factor,
      scenarios: { min: lo, max: hi },
      rent: { min: rentMin, max: rentMax, mid: rentMid },
      perMachine: { min: rentMin / machines, max: rentMax / machines },
      perM2: { min: rentMin / machines / a.areaPerMachine, max: rentMax / machines / a.areaPerMachine },
      perYear: { min: rentMin * a.monthsPerYear, max: rentMax * a.monthsPerYear },
      per12Months: { min: (rentMin * a.monthsPerYear) / 12, max: (rentMax * a.monthsPerYear) / 12 },
      energyFlat: a.kwhPerMonth * a.energyPrice * machines,
      suggestedMachines,
      tooFewMachines: machines < suggestedMachines,
      operatorShare,
      operatorWarning: Math.max(operatorShare.min, operatorShare.max) > a.marginWarning,
    };
  }

  // Tabela stawek: dla każdej wielkości szkoły przyjmuje sugerowaną liczbę automatów.
  function rateTable(schoolType, assumptions, studentsList) {
    return (studentsList || TABLE_STUDENTS).map((students) => {
      const probe = calculate({ students, schoolType, machines: 1 }, assumptions);
      const machines = probe.suggestedMachines;
      const r = calculate({ students, schoolType, machines }, assumptions);
      return {
        students,
        machines,
        min: r.rent.min,
        max: r.rent.max,
        mid: r.rent.mid,
        minPerMachine: r.perMachine.min,
        maxPerMachine: r.perMachine.max,
      };
    });
  }

  function mergeAssumptions(over) {
    const a = JSON.parse(JSON.stringify(DEFAULTS));
    if (!over) return a;
    for (const key of Object.keys(DEFAULTS)) {
      const v = over[key];
      if (v === undefined || v === null) continue;
      if (typeof DEFAULTS[key] === 'object') {
        for (const sc of ['min', 'max']) {
          const n = Number(v[sc]);
          if (Number.isFinite(n)) a[key][sc] = n;
        }
      } else {
        const n = Number(v);
        if (Number.isFinite(n)) a[key] = n;
      }
    }
    return a;
  }

  return {
    DEFAULTS,
    ASSUMPTION_META,
    SCHOOL_TYPES,
    DEFAULT_SCHOOL_TYPE,
    TABLE_STUDENTS,
    calculate,
    rateTable,
    mergeAssumptions,
    schoolFactor,
    roundTo,
  };
});
