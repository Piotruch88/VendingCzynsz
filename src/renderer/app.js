(() => {
  'use strict';

  const M = window.VendingModel;
  const S = window.VendingSources;

  const KEY_INPUTS = 'vc.inputs';
  const KEY_ASSUMPTIONS = 'vc.assumptions';

  // localStorage tylko na wygodę (zapamiętanie danych) – aplikacja działa i bez niego.
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* brak zapisu */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* brak zapisu */ }
    },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const nf = (digits) => new Intl.NumberFormat('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: true });
  const zl = (v, digits = 0) => `${nf(digits).format(v)} zł`;
  const num = (v, digits = 0) => nf(digits).format(v);
  const pct = (v) => new Intl.NumberFormat('pl-PL', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
  const range = (a, b, digits = 0) => (Math.round(a * 100) === Math.round(b * 100) ? zl(a, digits) : `${nf(digits).format(a)} – ${zl(b, digits)}`);

  let assumptions = M.mergeAssumptions(store.get(KEY_ASSUMPTIONS, null));
  let inputs = Object.assign(
    { students: 500, schoolType: M.DEFAULT_SCHOOL_TYPE, machines: 1 },
    store.get(KEY_INPUTS, {}),
  );
  if (!M.SCHOOL_TYPES.some((t) => t.name === inputs.schoolType)) inputs.schoolType = M.DEFAULT_SCHOOL_TYPE;
  let lastResult = null;

  // ------------------------------------------------------------ zakładki
  function showView(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    window.scrollTo(0, 0);
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

  // ------------------------------------------------------------ dane wejściowe
  const elStudents = $('#students');
  const elRange = $('#students-range');
  const elType = $('#school-type');
  const elTableType = $('#table-type');
  const elMachines = $('#machines');

  for (const sel of [elType, elTableType]) {
    sel.innerHTML = M.SCHOOL_TYPES.map((t) => `<option>${esc(t.name)}</option>`).join('');
  }

  function syncInputs() {
    elStudents.value = inputs.students;
    elRange.value = Math.min(inputs.students, Number(elRange.max));
    elType.value = inputs.schoolType;
    elTableType.value = inputs.schoolType;
    elMachines.value = inputs.machines;
  }

  function setInputs(patch) {
    inputs = Object.assign({}, inputs, patch);
    inputs.students = Math.max(0, Math.min(10000, Math.round(Number(inputs.students) || 0)));
    inputs.machines = Math.max(1, Math.min(20, Math.round(Number(inputs.machines) || 1)));
    store.set(KEY_INPUTS, inputs);
    render();
  }

  elStudents.addEventListener('input', () => {
    if (elStudents.value === '') return;
    setInputs({ students: elStudents.value });
    elRange.value = Math.min(inputs.students, Number(elRange.max));
  });
  elStudents.addEventListener('change', syncInputs);
  elRange.addEventListener('input', () => {
    setInputs({ students: elRange.value });
    elStudents.value = inputs.students;
  });
  elType.addEventListener('change', () => { setInputs({ schoolType: elType.value }); elTableType.value = inputs.schoolType; });
  elTableType.addEventListener('change', () => { setInputs({ schoolType: elTableType.value }); elType.value = inputs.schoolType; });
  elMachines.addEventListener('input', () => { if (elMachines.value !== '') setInputs({ machines: elMachines.value }); });
  elMachines.addEventListener('change', syncInputs);
  $('#machines-dec').addEventListener('click', () => { setInputs({ machines: inputs.machines - 1 }); syncInputs(); });
  $('#machines-inc').addEventListener('click', () => { setInputs({ machines: inputs.machines + 1 }); syncInputs(); });

  // ------------------------------------------------------------ kalkulator
  function setStatus(el, ok, text) {
    el.className = `status ${ok ? 'ok' : 'warn'}`;
    el.textContent = text;
  }

  function setMeter(fillId, valId, value) {
    const fill = $(fillId);
    fill.style.width = `${Math.min(100, value * 100)}%`;
    fill.classList.toggle('warn', value > assumptions.marginWarning);
    $(valId).textContent = pct(value);
  }

  function renderCalc() {
    const r = M.calculate(inputs, assumptions);
    lastResult = r;
    const a = assumptions;

    $('#rent-min').textContent = zl(r.rent.min);
    $('#rent-max').textContent = zl(r.rent.max);
    $('#rent-mid').textContent = zl(r.rent.mid);

    $('#t-machine').textContent = range(r.perMachine.min, r.perMachine.max);
    $('#t-m2').textContent = range(r.perM2.min, r.perM2.max);
    $('#t-year').textContent = range(r.perYear.min, r.perYear.max);
    $('#t-year-sub').textContent = `${num(a.monthsPerYear)} mies. nauki`;
    $('#t-12').textContent = range(r.per12Months.min, r.per12Months.max);
    $('#t-energy').textContent = zl(r.energyFlat);
    $('#t-suggest').textContent = num(r.suggestedMachines);
    setStatus($('#s-suggest'), !r.tooFewMachines,
      r.tooFewMachines ? 'Popyt przekracza wydajność automatów' : 'Liczba automatów wystarczająca');

    setMeter('#m-min', '#mv-min', r.operatorShare.min);
    setMeter('#m-max', '#mv-max', r.operatorShare.max);
    for (const id of ['#m-limit-1', '#m-limit-2']) $(id).style.left = `${Math.min(100, a.marginWarning * 100)}%`;
    setStatus($('#s-operator'), !r.operatorWarning, r.operatorWarning ? 'Ryzyko braku ofert' : 'Stawki realne dla operatora');
    $('#operator-hint').textContent = r.operatorWarning
      ? `Czynsz pochłania ponad ${pct(a.marginWarning)} marży brutto operatora – operatorzy mogą nie składać ofert. Linia = próg ostrzeżenia.`
      : `Czynsz mieści się poniżej progu ${pct(a.marginWarning)} marży brutto operatora (linia na wykresie).`;

    const lo = r.scenarios.min;
    const hi = r.scenarios.max;
    const rows = [
      ['Osoby korzystające (uczniowie + personel)', num(r.users), num(r.users)],
      ['Współczynnik typu szkoły', num(r.factor, 2), num(r.factor, 2)],
      ['Udział kupujących dziennie', pct(a.penetration.min), pct(a.penetration.max)],
      ['Transakcje dziennie – popyt', num(lo.demand, 1), num(hi.demand, 1)],
      ['Transakcje dziennie – po limicie wydajności', num(lo.transactions, 1), num(hi.transactions, 1)],
      ['Średnia wartość transakcji brutto', zl(a.avgTicket.min, 2), zl(a.avgTicket.max, 2)],
      ['Obrót dzienny brutto', zl(lo.grossDay), zl(hi.grossDay)],
      ['Obrót miesięczny brutto', zl(lo.grossMonth), zl(hi.grossMonth)],
      ['Obrót miesięczny netto', zl(lo.netMonth), zl(hi.netMonth)],
      ['Czynsz jako % obrotu netto', pct(a.commission.min), pct(a.commission.max)],
      ['Czynsz wyliczony z obrotu', zl(lo.fromRevenue), zl(hi.fromRevenue)],
      ['Próg minimalny (× liczba automatów)', zl(lo.floor), zl(hi.floor)],
      ['Czynsz miesięczny (zaokrąglony)', zl(r.rent.min), zl(r.rent.max), true],
    ];
    $('#calc-details').innerHTML = rows
      .map(([label, v1, v2, strong]) => `<tr${strong ? ' class="strong"' : ''}><td>${esc(label)}</td><td>${esc(v1)}</td><td>${esc(v2)}</td></tr>`)
      .join('');
  }

  // ------------------------------------------------------------ tabela
  function renderTable() {
    const rows = M.rateTable(inputs.schoolType, assumptions);
    // Podświetl wiersz najbliższy wpisanej liczbie uczniów.
    let nearest = 0;
    rows.forEach((row, i) => {
      if (Math.abs(row.students - inputs.students) < Math.abs(rows[nearest].students - inputs.students)) nearest = i;
    });
    $('#rate-table tbody').innerHTML = rows.map((row, i) => `
      <tr${i === nearest ? ' class="current"' : ''}>
        <td>${num(row.students)}</td>
        <td>${num(row.machines)}</td>
        <td>${zl(row.min)}</td>
        <td>${zl(row.max)}</td>
        <td><strong>${zl(row.mid)}</strong></td>
        <td>${zl(row.minPerMachine)}</td>
        <td>${zl(row.maxPerMachine)}</td>
      </tr>`).join('');
  }

  // ------------------------------------------------------------ założenia
  const defaults = M.DEFAULTS;

  function toDisplay(meta, v) { return meta.pct ? +(v * 100).toFixed(4) : v; }
  function fromDisplay(meta, v) { return meta.pct ? v / 100 : v; }

  function buildAssumptions() {
    $('#assumptions-body').innerHTML = M.ASSUMPTION_META.map((meta) => {
      const step = meta.step ?? (meta.pct ? 0.5 : 1);
      const cell = (sc) => `<input type="number" step="${step}" data-key="${meta.key}"${sc ? ` data-sc="${sc}"` : ''}>`;
      const chips = meta.src.length
        ? meta.src.map((n) => `<button type="button" class="src-chip" data-src="${n}">Ź${n}</button>`).join('')
        : '<span class="muted">szacunek własny</span>';
      return `<tr>
        <td>${esc(meta.label)}</td>
        <td>${cell(meta.scenario ? 'min' : '')}</td>
        <td>${meta.scenario ? cell('max') : ''}</td>
        <td>${esc(meta.unit)}</td>
        <td class="note">${esc(meta.note)}</td>
        <td>${chips}</td>
      </tr>`;
    }).join('');

    $('#types-body').innerHTML = M.SCHOOL_TYPES
      .map((t) => `<tr><td>${esc(t.name)}</td><td>${num(t.factor, 2)}</td></tr>`).join('');

    $$('#assumptions-body input').forEach((inp) => {
      inp.addEventListener('input', () => {
        if (inp.value === '') return;
        const meta = M.ASSUMPTION_META.find((m) => m.key === inp.dataset.key);
        const value = fromDisplay(meta, Number(inp.value));
        if (!Number.isFinite(value)) return;
        const next = JSON.parse(JSON.stringify(assumptions));
        if (inp.dataset.sc) next[meta.key][inp.dataset.sc] = value;
        else next[meta.key] = value;
        assumptions = M.mergeAssumptions(next);
        store.set(KEY_ASSUMPTIONS, assumptions);
        markModified(inp, meta);
        render();
      });
      inp.addEventListener('change', fillAssumptions);
    });

    $$('#assumptions-body .src-chip').forEach((b) => b.addEventListener('click', () => goToSource(b.dataset.src)));
  }

  function markModified(inp, meta) {
    const sc = inp.dataset.sc;
    const cur = sc ? assumptions[meta.key][sc] : assumptions[meta.key];
    const def = sc ? defaults[meta.key][sc] : defaults[meta.key];
    inp.classList.toggle('modified', Math.abs(cur - def) > 1e-9);
  }

  function fillAssumptions() {
    $$('#assumptions-body input').forEach((inp) => {
      const meta = M.ASSUMPTION_META.find((m) => m.key === inp.dataset.key);
      const v = inp.dataset.sc ? assumptions[meta.key][inp.dataset.sc] : assumptions[meta.key];
      inp.value = toDisplay(meta, v);
      markModified(inp, meta);
    });
  }

  $('#reset-assumptions').addEventListener('click', () => {
    assumptions = M.mergeAssumptions(null);
    store.remove(KEY_ASSUMPTIONS);
    fillAssumptions();
    render();
    toast('Przywrócono założenia domyślne');
  });

  // ------------------------------------------------------------ źródła
  function buildSources() {
    $('#sources-list').innerHTML = S.SOURCES.map((s) => `
      <li id="src-${s.id}">
        <span class="src-id">Ź${s.id}</span>
        <div>
          <div class="src-topic">${esc(s.topic)} · ${esc(s.date)}</div>
          <div class="src-name"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a></div>
          <div class="src-facts">${esc(s.facts)}</div>
          <div class="src-use">W modelu: ${esc(s.use)}</div>
        </div>
      </li>`).join('');
    $('#own-list').innerHTML = S.OWN_ESTIMATES.map((t) => `<li>${esc(t)}</li>`).join('');
  }

  function goToSource(id) {
    showView('sources');
    const li = $(`#src-${id}`);
    if (!li) return;
    li.scrollIntoView({ block: 'center' });
    li.classList.add('flash');
    setTimeout(() => li.classList.remove('flash'), 1600);
  }

  // ------------------------------------------------------------ kopiowanie
  function summaryText() {
    const r = lastResult;
    return [
      `Czynsz za automaty vendingowe – ${r.input.schoolType}, ${num(r.input.students)} uczniów, automatów: ${r.input.machines}`,
      `Czynsz miesięczny netto: ${zl(r.rent.min)} – ${zl(r.rent.max)}`,
      `Stawka wyjściowa do przetargu: ${zl(r.rent.mid)}`,
      `Na 1 automat: ${range(r.perMachine.min, r.perMachine.max)}`,
      `Za 1 m²: ${range(r.perM2.min, r.perM2.max)}`,
      `Za rok szkolny (${num(assumptions.monthsPerYear)} mies.): ${range(r.perYear.min, r.perYear.max)}`,
      `Ryczałt za energię (osobno): ${zl(r.energyFlat)} / mies.`,
      'Kwoty netto, do czynszu dolicza się 23% VAT.',
    ].join('\n');
  }

  $('#copy-summary').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summaryText());
      toast('Skopiowano podsumowanie do schowka');
    } catch {
      toast('Nie udało się skopiować');
    }
  });

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ------------------------------------------------------------ start
  function render() {
    renderCalc();
    renderTable();
  }

  buildAssumptions();
  buildSources();
  syncInputs();
  fillAssumptions();
  render();
})();
