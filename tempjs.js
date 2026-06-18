
// ─── STATE ──────────────────────────────────────────────────────────────────
const state = {
  currentVol: 0,
  endpointVol: null,
  trials: [],
  trialNum: 1,
  simActive: true,
  titrationChart: null,
  chartLabels: [],
  chartData: [],
  params: {
    sampleVol: 10.0,
    kmno4Conc: 0.02,
    dilution: 10,
    density: 1.0,
    claim: 6.0
  }
};

// Molar masses
const M_H2O2 = 34.015;

// Expected titre based on 6% claim
function expectedTitre(claim, sampleVol, kmno4Conc, dilution) {
  // % v/v H2O2 → g/L → mol/L
  const rho = 1.0; // g/mL for dilute H2O2
  const gPerL = claim * 10 * rho; // g/L = %v/v * 10 * density
  const molH2O2 = (gPerL / M_H2O2) * (sampleVol / 1000); // moles in sample
  const molKMnO4 = (2 / 5) * molH2O2 / dilution; // after dilution
  const titre = (molKMnO4 / kmno4Conc) * 1000; // mL
  return titre;
}

// ─── SECTION NAV ────────────────────────────────────────────────────────────
function showSection(id) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.lab-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  if (id === 'simulation' && !state.titrationChart) initChart();
  if (id === 'analysis') runAnalysis();
  if (id === 'report') generateReport();
}

// ─── SETUP ───────────────────────────────────────────────────────────────────
const experiments = {
  h2o2: {
    methods: [{ val: 'kmno4_redox', label: 'KMnO₄ Redox Titration (Permanganometry)' }],
    titrant: 'Potassium Permanganate (KMnO₄)',
    analyte: 'Hydrogen Peroxide (H₂O₂)',
    curve: 'Redox Potential (E vs V)',
    indicator: 'Self-indicating (KMnO₄ purple → colourless)',
    stoich: '5 H₂O₂ : 2 KMnO₄',
    claim: '6% v/v H₂O₂'
  },
  fe2: {
    methods: [{ val: 'kmno4_redox', label: 'KMnO₄ Redox Titration (Permanganometry)' }],
    titrant: 'Potassium Permanganate (KMnO₄)',
    analyte: 'Iron(II) — Fe²⁺',
    curve: 'Redox Potential (E vs V)',
    indicator: 'Self-indicating',
    stoich: '5 Fe²⁺ : 1 KMnO₄',
    claim: '0.1 mol/L Fe²⁺'
  },
  oxalic: {
    methods: [
      { val: 'kmno4_redox', label: 'KMnO₄ Redox Titration (Permanganometry)' },
      { val: 'naoh_acidbase', label: 'NaOH Acid-Base Titration' }
    ],
    titrant: 'Potassium Permanganate (KMnO₄)',
    analyte: 'Oxalic Acid (H₂C₂O₄)',
    curve: 'Redox Potential (E vs V)',
    indicator: 'Self-indicating / Phenolphthalein',
    stoich: '5 H₂C₂O₄ : 2 KMnO₄',
    claim: '0.05 mol/L Oxalic Acid'
  },
  naoh: {
    methods: [
      { val: 'hcl_acidbase', label: 'HCl Acid-Base Titration' },
      { val: 'h2so4_acidbase', label: 'H₂SO₄ Acid-Base Titration' }
    ],
    titrant: 'Hydrochloric Acid (HCl)',
    analyte: 'Sodium Hydroxide (NaOH)',
    curve: 'pH Curve (pH vs V)',
    indicator: 'Phenolphthalein / Universal',
    stoich: '1 NaOH : 1 HCl',
    claim: '0.1 mol/L NaOH'
  },
  hcl: {
    methods: [
      { val: 'naoh_acidbase', label: 'NaOH Acid-Base Titration' }
    ],
    titrant: 'Sodium Hydroxide (NaOH)',
    analyte: 'Hydrochloric Acid (HCl)',
    curve: 'pH Curve (pH vs V)',
    indicator: 'Phenolphthalein',
    stoich: '1 HCl : 1 NaOH',
    claim: '0.1 mol/L HCl'
  }
};

function updateMethodOptions() {
  const sel = document.getElementById('analyte-select').value;
  const exp = experiments[sel];
  const mSel = document.getElementById('method-select');
  mSel.innerHTML = exp.methods.map(m => `<option value="${m.val}">${m.label}</option>`).join('');
  document.getElementById('claim-input').value = exp.claim;
  updateExperimentInfo();
}

function updateExperimentInfo() {
  const sel = document.getElementById('analyte-select').value;
  const exp = experiments[sel];
  document.getElementById('ov-titrant').textContent = exp.titrant;
  document.getElementById('ov-analyte').textContent = exp.analyte;
  document.getElementById('ov-curve').textContent = exp.curve;
  document.getElementById('ov-indicator').textContent = exp.indicator;
  document.getElementById('ov-stoich').textContent = exp.stoich;
}

function initializeExperiment() {
  updateDashboard();
  showSection('prelab');
}

// ─── PRE-LAB ────────────────────────────────────────────────────────────────
function calcPrelab() {
  const sv = parseFloat(document.getElementById('pl-sample-vol').value) || 10;
  const cc = parseFloat(document.getElementById('pl-kmno4-conc').value) || 0.02;
  const df = parseFloat(document.getElementById('pl-dilution').value) || 10;
  const density = parseFloat(document.getElementById('pl-density').value) || 1.0;
  const claim = parseFloat(document.getElementById('pl-claim').value) || 6.0;

  state.params = { sampleVol: sv, kmno4Conc: cc, dilution: df, density, claim };

  // H2O2 concentration from claim
  const gPerL = claim * 10 * density;
  const molH2O2_perL = gPerL / M_H2O2;
  const molH2O2_in_sample = molH2O2_perL * (sv / 1000);
  const molH2O2_diluted = molH2O2_in_sample / df;
  const molKMnO4 = (2 / 5) * molH2O2_diluted;
  const titre = (molKMnO4 / cc) * 1000;
  const massH2O2 = molH2O2_in_sample * M_H2O2;
  const dilMol = molH2O2_diluted / (sv / 1000);

  document.getElementById('pr-titre').textContent = titre.toFixed(2) + ' mL';
  document.getElementById('pr-moles-h2o2').textContent = molH2O2_in_sample.toExponential(3) + ' mol';
  document.getElementById('pr-moles-kmno4').textContent = molKMnO4.toExponential(3) + ' mol';
  document.getElementById('pr-mass-h2o2').textContent = massH2O2.toFixed(4) + ' g';
  document.getElementById('pr-molarity').textContent = molH2O2_perL.toFixed(4) + ' mol/L';
  document.getElementById('pr-dil-molarity').textContent = dilMol.toFixed(4) + ' mol/L';
}

// ─── SIMULATION ──────────────────────────────────────────────────────────────
function initChart() {
  const ctx = document.getElementById('titration-chart').getContext('2d');
  const analyte = document.getElementById('analyte-select').value;
  const isRedox = !['naoh','hcl'].includes(analyte);

  state.chartLabels = [];
  state.chartData = [];
  state.titrationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: state.chartLabels,
      datasets: [{
        label: isRedox ? 'Redox Potential E (mV)' : 'pH',
        data: state.chartData,
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0,229,255,0.08)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointBackgroundColor: '#00e5ff',
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: {
          title: { display: true, text: 'Volume KMnO₄ Added (mL)', color: '#6a9bbf', font: { family: 'Share Tech Mono' } },
          ticks: { color: '#3a5a7a', font: { family: 'Share Tech Mono', size: 10 } },
          grid: { color: 'rgba(0,229,255,0.05)' }
        },
        y: {
          title: { display: true, text: isRedox ? 'E (mV)' : 'pH', color: '#6a9bbf', font: { family: 'Share Tech Mono' } },
          ticks: { color: '#3a5a7a', font: { family: 'Share Tech Mono', size: 10 } },
          grid: { color: 'rgba(0,229,255,0.05)' }
        }
      },
      plugins: {
        legend: { labels: { color: '#6a9bbf', font: { family: 'Share Tech Mono', size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(5,13,26,0.95)',
          borderColor: 'rgba(0,229,255,0.3)',
          borderWidth: 1,
          titleColor: '#00e5ff',
          bodyColor: '#e0f0ff',
          titleFont: { family: 'Share Tech Mono' },
          bodyFont: { family: 'Share Tech Mono' }
        }
      }
    }
  });
}

function calcPotential(vol) {
  // Simulated redox potential curve for KMnO4/H2O2
  const ep = state.endpointVol || getTheoreticalEndpoint();
  const ratio = vol / ep;
  if (ratio < 0.95) {
    return 300 + ratio * 200; // Rising slowly before EP
  } else if (ratio < 1.05) {
    return 500 + (ratio - 0.95) * 6000; // Steep jump at EP
  } else {
    return 1100 + (ratio - 1.05) * 30; // Flat after EP
  }
}

function calcPH(vol) {
  const ep = state.endpointVol || getTheoreticalEndpoint();
  const ratio = vol / ep;
  if (ratio < 0.95) return 2 + ratio * 5;
  else if (ratio < 1.05) return 7 + (ratio - 0.95) * 50;
  else return 12 + Math.log10(ratio - 0.95 + 0.01) * 0.5;
}

function getTheoreticalEndpoint() {
  const p = state.params;
  return expectedTitre(p.claim, p.sampleVol, p.kmno4Conc, p.dilution);
}

function addTitrant(amount) {
  if (!state.simActive) return;
  if (!state.titrationChart) initChart();

  const ep = getTheoreticalEndpoint();
  const analyte = document.getElementById('analyte-select').value;
  const isRedox = !['naoh','hcl'].includes(analyte);

  // Add some random variation (±2%)
  const variation = 1 + (Math.random() - 0.5) * 0.04;
  const actualEP = ep * variation;
  if (!state.endpointVol) state.endpointVol = actualEP;

  state.currentVol += amount;
  const vol = Math.round(state.currentVol * 100) / 100;

  // Update chart
  state.chartLabels.push(vol.toFixed(2));
  const yVal = isRedox ? calcPotential(vol) : calcPH(vol);
  state.chartData.push(Math.round(yVal * 10) / 10);
  state.titrationChart.update();

  // Update displays
  document.getElementById('sim-vol-added').textContent = vol.toFixed(2) + ' mL';
  document.getElementById('sim-current-vol').textContent = vol.toFixed(2) + ' mL';

  const pct = Math.min(100, Math.round((vol / state.endpointVol) * 100));
  document.getElementById('sim-progress').textContent = pct + '%';
  document.getElementById('prog-fill').style.width = Math.min(100, pct) + '%';

  // Update burette liquid level
  const maxVol = 50;
  const liquidH = Math.max(0, 178 - (vol / maxVol) * 178);
  const liquidY = 6;
  document.getElementById('burette-liquid').setAttribute('height', liquidH);

  // Flask colour change approaching endpoint
  const flaskLiq = document.getElementById('flask-liquid');
  if (pct < 90) {
    flaskLiq.setAttribute('fill', 'rgba(0,255,157,0.25)');
  } else if (pct < 98) {
    flaskLiq.setAttribute('fill', 'rgba(200,200,100,0.35)');
  } else {
    flaskLiq.setAttribute('fill', 'rgba(180,50,255,0.35)');
  }

  // Drop animation
  const drop = document.getElementById('drop');
  drop.setAttribute('opacity', '0.8');
  setTimeout(() => drop.setAttribute('opacity', '0'), 500);

  // Endpoint detection
  if (vol >= state.endpointVol && state.simActive) {
    const ep_msg = document.getElementById('endpoint-msg');
    ep_msg.style.display = 'block';
    document.getElementById('sim-status').textContent = 'ENDPOINT';
    document.getElementById('sim-status').style.color = 'var(--accent-purple)';
    setTimeout(() => { ep_msg.style.display = 'none'; }, 4000);
  }
}

function recordTrial() {
  const titre = state.currentVol;
  if (titre < 0.1) { alert('Add some titrant first!'); return; }

  state.trials.push({
    num: state.trialNum,
    initial: 0.00,
    final: titre,
    titre: titre,
    include: true
  });

  renderTrialTable();
  state.trialNum++;
  updateDashboard();

  // Reset sim for next trial
  state.currentVol = 0;
  state.endpointVol = null;
  state.simActive = true;
  state.chartLabels = [];
  state.chartData = [];
  if (state.titrationChart) {
    state.titrationChart.data.labels = [];
    state.titrationChart.data.datasets[0].data = [];
    state.titrationChart.update();
  }
  document.getElementById('sim-vol-added').textContent = '0.00 mL';
  document.getElementById('sim-current-vol').textContent = '0.00 mL';
  document.getElementById('sim-progress').textContent = '0%';
  document.getElementById('prog-fill').style.width = '0%';
  document.getElementById('sim-status').textContent = 'Titrating';
  document.getElementById('sim-status').style.color = 'var(--accent-green)';
  document.getElementById('flask-liquid').setAttribute('fill', 'rgba(0,255,157,0.25)');
  document.getElementById('burette-liquid').setAttribute('height', '50');
  document.getElementById('trial-num').textContent = state.trialNum;
  document.getElementById('endpoint-msg').style.display = 'none';
}

function resetSim() {
  state.currentVol = 0;
  state.endpointVol = null;
  state.simActive = true;
  state.chartLabels = [];
  state.chartData = [];
  if (state.titrationChart) {
    state.titrationChart.data.labels = [];
    state.titrationChart.data.datasets[0].data = [];
    state.titrationChart.update();
  }
  document.getElementById('sim-vol-added').textContent = '0.00 mL';
  document.getElementById('sim-current-vol').textContent = '0.00 mL';
  document.getElementById('sim-progress').textContent = '0%';
  document.getElementById('prog-fill').style.width = '0%';
  document.getElementById('sim-status').textContent = 'Titrating';
  document.getElementById('sim-status').style.color = 'var(--accent-green)';
  document.getElementById('flask-liquid').setAttribute('fill', 'rgba(0,255,157,0.25)');
  document.getElementById('burette-liquid').setAttribute('height', '50');
  document.getElementById('endpoint-msg').style.display = 'none';
}

function renderTrialTable() {
  const tbody = document.getElementById('trial-tbody');
  if (!state.trials.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:1.5rem">No trials recorded yet</td></tr>';
    return;
  }
  tbody.innerHTML = state.trials.map((t, i) => `
    <tr>
      <td style="color:var(--accent-cyan)">${t.num}</td>
      <td>${t.initial.toFixed(2)}</td>
      <td>${t.final.toFixed(2)}</td>
      <td style="color:var(--accent-green)">${t.titre.toFixed(2)}</td>
      <td>
        <input type="checkbox" ${t.include ? 'checked' : ''}
          onchange="toggleTrial(${i}, this.checked)"
          style="accent-color:var(--accent-cyan);width:16px;height:16px">
      </td>
    </tr>
  `).join('');
}

function toggleTrial(i, checked) {
  state.trials[i].include = checked;
  updateDashboard();
}

// ─── CALCULATIONS ────────────────────────────────────────────────────────────
function getIncludedTitres() {
  return state.trials.filter(t => t.include).map(t => t.titre);
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = average(arr);
  const sq = arr.map(x => (x - avg) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

function concFromTitre(titre) {
  const p = state.params;
  // n(KMnO4) = C * V/1000
  const nKMnO4 = p.kmno4Conc * (titre / 1000);
  // n(H2O2) = 5/2 * n(KMnO4)
  const nH2O2 = (5 / 2) * nKMnO4 * p.dilution;
  // mass H2O2 in sample
  const massH2O2 = nH2O2 * M_H2O2;
  // % v/v = (mass / (density * vol_sample)) * 100
  const pct = (massH2O2 / (p.density * p.sampleVol)) * 100;
  return pct;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function updateDashboard() {
  const titres = getIncludedTitres();
  document.getElementById('dash-runs').textContent = state.trials.length;
  if (!titres.length) return;
  const avg = average(titres);
  const conc = concFromTitre(avg);
  const acc = (100 - Math.abs((conc - state.params.claim) / state.params.claim * 100)).toFixed(1);
  document.getElementById('dash-titre').textContent = avg.toFixed(2);
  document.getElementById('dash-conc').textContent = conc.toFixed(2);
  document.getElementById('dash-acc').textContent = acc + '%';
}

// ─── ANALYSIS ────────────────────────────────────────────────────────────────
function runAnalysis() {
  const titres = getIncludedTitres();
  if (!titres.length) return;

  const avg = average(titres);
  const sd = stdDev(titres);
  const conc = concFromTitre(avg);
  const claim = state.params.claim;
  const absErr = Math.abs(conc - claim);
  const relErr = absErr / claim;
  const pctErr = relErr * 100;
  const accuracy = 100 - pctErr;
  const rsd = titres.length > 1 ? (sd / avg) * 100 : 0;

  // Update stat cards
  document.getElementById('an-avg-titre').textContent = avg.toFixed(2);
  document.getElementById('an-exp-conc').textContent = conc.toFixed(2) + '%';
  document.getElementById('an-std-dev').textContent = sd.toFixed(3);
  document.getElementById('an-accuracy').textContent = accuracy.toFixed(1) + '%';

  // Colour accuracy
  const accEl = document.getElementById('an-accuracy');
  if (accuracy >= 95) accEl.style.color = 'var(--accent-green)';
  else if (accuracy >= 85) accEl.style.color = 'var(--accent-amber)';
  else accEl.style.color = 'var(--accent-red)';

  // Post-lab content
  document.getElementById('postlab-content').innerHTML = `
    <div class="data-chip mb-2"><span class="chip-label">Average Titre</span><span class="chip-value">${avg.toFixed(2)} mL</span></div>
    <div class="data-chip mb-2"><span class="chip-label">Experimental [H₂O₂]</span><span class="chip-value">${conc.toFixed(3)} % v/v</span></div>
    <div class="data-chip mb-2"><span class="chip-label">Manufacturer Claim</span><span class="chip-value">${claim.toFixed(1)} % v/v</span></div>
    <div class="data-chip mb-2"><span class="chip-label">Number of Included Trials</span><span class="chip-value">${titres.length}</span></div>
    <div class="data-chip mb-2"><span class="chip-label">Std Dev (s)</span><span class="chip-value">${sd.toFixed(4)} mL</span></div>
    <div class="data-chip"><span class="chip-label">Relative Std Dev (%)</span><span class="chip-value">${rsd.toFixed(2)}%</span></div>
  `;

  const errBadge = pctErr <= 2 ? 'badge-green' : pctErr <= 5 ? 'badge-amber' : 'badge-red';
  const errLabel = pctErr <= 2 ? 'Excellent' : pctErr <= 5 ? 'Acceptable' : 'High Error';
  document.getElementById('error-content').innerHTML = `
    <div class="data-chip mb-2">
      <span class="chip-label">Absolute Error</span>
      <span class="chip-value">${absErr.toFixed(3)} % v/v</span>
    </div>
    <div class="data-chip mb-2">
      <span class="chip-label">Relative Error</span>
      <span class="chip-value">${relErr.toFixed(4)}</span>
    </div>
    <div class="data-chip mb-2">
      <span class="chip-label">Percentage Error</span>
      <span class="chip-value">${pctErr.toFixed(2)}%</span>
    </div>
    <div class="data-chip mb-2">
      <span class="chip-label">Accuracy</span>
      <span class="chip-value">${accuracy.toFixed(2)}%</span>
    </div>
    <div class="mt-2">
      <span class="lab-badge ${errBadge}"><i class="fas fa-circle me-1"></i>${errLabel} — ${pctErr <= 2 ? 'Error within ±2%' : pctErr <= 5 ? 'Error within ±5%' : 'Error exceeds ±5%'}</span>
    </div>
  `;

  // Summary table
  const tbody = document.getElementById('analysis-tbody');
  const rows = [
    ['Sample Volume', 'V_s', state.params.sampleVol.toFixed(1), 'mL'],
    ['KMnO₄ Concentration', 'C(KMnO₄)', state.params.kmno4Conc.toFixed(4), 'mol/L'],
    ['Dilution Factor', 'DF', state.params.dilution.toFixed(0), '—'],
    ['Average Titre', 'V̄_t', avg.toFixed(2), 'mL'],
    ['Std Deviation', 's', sd.toFixed(4), 'mL'],
    ['Moles KMnO₄ (avg)', 'n(KMnO₄)', (state.params.kmno4Conc * avg / 1000).toExponential(3), 'mol'],
    ['Moles H₂O₂', 'n(H₂O₂)', (2.5 * state.params.kmno4Conc * avg / 1000 * state.params.dilution).toExponential(3), 'mol'],
    ['Experimental [H₂O₂]', 'c_exp', conc.toFixed(3), '% v/v'],
    ['Manufacturer Claim', 'c_claim', claim.toFixed(1), '% v/v'],
    ['Absolute Error', '|Δc|', absErr.toFixed(3), '% v/v'],
    ['Percentage Error', '%E', pctErr.toFixed(2), '%'],
    ['Accuracy', 'A', accuracy.toFixed(2), '%']
  ];
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r[0]}</td>
      <td class="mono" style="color:var(--accent-cyan)">${r[1]}</td>
      <td class="mono" style="color:var(--accent-green)">${r[2]}</td>
      <td class="mono" style="color:var(--text-secondary)">${r[3]}</td>
    </tr>
  `).join('');

  // Store for report
  state.analysis = { avg, sd, conc, claim, absErr, relErr, pctErr, accuracy, rsd, titres };
}

// ─── REPORT ──────────────────────────────────────────────────────────────────
function generateReport() {
  const titres = getIncludedTitres();
  if (!titres.length) return;
  if (!state.analysis) runAnalysis();
  const a = state.analysis;
  if (!a) return;

  const date = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const verdict = a.accuracy >= 95 ? 'VERIFIED' : a.accuracy >= 85 ? 'APPROXIMATELY VERIFIED' : 'NOT VERIFIED';
  const verdictBadge = a.accuracy >= 95 ? 'badge-green' : a.accuracy >= 85 ? 'badge-amber' : 'badge-red';

  // Summary table
  const summaryRows = [
    ['Average Titre', `${a.avg.toFixed(2)} mL`, a.titres.length >= 2 ? '✓ Concordant' : '— Single trial'],
    ['Experimental [H₂O₂]', `${a.conc.toFixed(3)} % v/v`, `±${a.absErr.toFixed(3)}`],
    ['Manufacturer Claim', `${a.claim.toFixed(1)} % v/v`, 'Reference value'],
    ['Percentage Error', `${a.pctErr.toFixed(2)} %`, a.pctErr <= 2 ? '✓ Excellent' : a.pctErr <= 5 ? '⚠ Acceptable' : '✗ High'],
    ['Accuracy', `${a.accuracy.toFixed(2)} %`, verdict],
    ['Std Deviation', `${a.sd.toFixed(4)} mL`, a.rsd < 1 ? '✓ Precise' : '⚠ Review']
  ];

  document.getElementById('rpt-tbody').innerHTML = summaryRows.map(r => `
    <tr>
      <td>${r[0]}</td>
      <td class="mono" style="color:var(--accent-cyan)">${r[1]}</td>
      <td class="mono" style="color:var(--text-secondary)">${r[2]}</td>
      <td><span class="lab-badge ${verdictBadge}" style="font-size:0.65rem">${verdict}</span></td>
    </tr>
  `).join('');

  document.getElementById('rpt-results').innerHTML =
    `A total of <strong style="color:var(--accent-cyan)">${state.trials.length} trial(s)</strong> were conducted, of which <strong style="color:var(--accent-cyan)">${a.titres.length}</strong> were included in the final calculation. The individual titres ranged from <strong>${Math.min(...a.titres).toFixed(2)}</strong> to <strong>${Math.max(...a.titres).toFixed(2)} mL</strong>, giving an average titre of <strong style="color:var(--accent-green)">${a.avg.toFixed(2)} ± ${a.sd.toFixed(3)} mL</strong>. Using the stoichiometric relationship 2 KMnO₄ : 5 H₂O₂, the experimental hydrogen peroxide concentration was calculated as <strong style="color:var(--accent-green)">${a.conc.toFixed(3)}% v/v</strong>, compared to the manufacturer's claimed value of <strong>${a.claim.toFixed(1)}% v/v</strong>.`;

  document.getElementById('rpt-discussion').innerHTML =
    `The permanganometric titration produced ${a.accuracy >= 90 ? 'reproducible and accurate' : 'variable'} results. The self-indicating nature of KMnO₄ eliminates additional indicator error, though the endpoint (first persistent pink) is subjective. The percentage error of <strong style="color:var(--accent-amber)">${a.pctErr.toFixed(2)}%</strong> may be attributed to: (1) endpoint detection subjectivity; (2) H₂O₂ decomposition in the acidified solution; (3) burette reading parallax error; and (4) temperature effects on solution density. The relative standard deviation of ${a.rsd.toFixed(2)}% reflects the precision of the method. In acidic H₂SO₄ medium, the reduction of MnO₄⁻ (purple) to Mn²⁺ (pale pink/colourless) proceeds spontaneously and cleanly, supporting the quantitative basis of the method.`;

  document.getElementById('rpt-conclusion').innerHTML =
    `The experimental determination yielded an H₂O₂ concentration of <strong style="color:var(--accent-cyan)">${a.conc.toFixed(3)}% v/v</strong> (accuracy: ${a.accuracy.toFixed(1)}%). The manufacturer's claim of ${a.claim.toFixed(1)}% v/v is <span class="lab-badge ${verdictBadge}">${verdict}</span> at the ±${a.pctErr <= 5 ? '5' : '10'}% tolerance level. Permanganometry proved to be a ${a.accuracy >= 90 ? 'reliable, sensitive, and cost-effective' : 'measurable but imprecise'} method for the quantitative determination of hydrogen peroxide in commercial solutions.`;
}

function exportPDF() {
  const content = document.getElementById('report-content');
  const printWin = window.open('', '_blank', 'width=900,height=700');
  printWin.document.write(`
    <html><head><title>Lab Report - Analytical Chemistry Simulator</title>
    <style>
      body{font-family:'Georgia',serif;color:#111;max-width:800px;margin:2cm auto;padding:0 1cm}
      h1{color:#1a3a5c;font-size:1.3rem;border-bottom:2px solid #1a3a5c;padding-bottom:0.5rem}
      h4{color:#1a3a5c;font-size:1rem;margin-top:1.5rem}
      p{line-height:1.75;font-size:0.9rem}
      table{width:100%;border-collapse:collapse;font-size:0.82rem;margin:1rem 0}
      th{background:#1a3a5c;color:white;padding:0.5rem 0.7rem;text-align:left}
      td{border-bottom:1px solid #ddd;padding:0.5rem 0.7rem}
      .header{text-align:center;margin-bottom:2rem;border-bottom:3px double #1a3a5c;padding-bottom:1rem}
    </style></head><body>
    <div class="header">
      <h1>ANALYTICAL CHEMISTRY LABORATORY REPORT</h1>
      <p><strong>Experiment:</strong> Determination of H₂O₂ by KMnO₄ Permanganometry</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})}</p>
    </div>
    ${content.innerHTML}
    </body></html>
  `);
  printWin.document.close();
  setTimeout(() => { printWin.print(); printWin.close(); }, 500);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
calcPrelab();
updateDashboard();

