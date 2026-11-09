/**
 * Multi-Indication Probabilistic Attribution Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT } from '../../js/common.js';
import { exportToCSV, serializeStateToURL, deserializeStateFromURL } from '../../js/distributions.js';

export default function init() {
  const drugPresetSelect = $('drug-preset-select');
  const linkageSlider = $('linkage-slider');
  const linkageVal = $('linkage-val');
  const specialtyNoiseSlider = $('specialty-noise-slider');
  const specialtyNoiseVal = $('specialty-noise-val');
  const checkInductionDose = $('check-induction-dose');
  const sampleSizeSlider = $('sample-size-slider');
  const sampleSizeVal = $('sample-size-val');

  const btnPinCurve = $('btn-pin-curve');
  const btnExportCSV = $('btn-export-csv');

  const attributionBadge = $('attribution-badge');
  const statWaterfallAcc = $('stat-waterfall-acc');
  const statBayesAcc = $('stat-bayes-acc');
  const statUnattributed = $('stat-unattributed');
  const statMultiIndication = $('stat-multi-indication');
  const statInductionRate = $('stat-induction-rate');
  const attributionCalloutText = $('attribution-callout-text');

  let pinnedAttribution = null;

  const INDICATIONS = ['Rheumatoid Arthritis', 'Plaque Psoriasis', 'Crohn’s / UC'];

  function simulateCohort(N, linkageRate, noise, hasInductionFeature) {
    const patients = [];
    const prior = [0.45, 0.35, 0.20]; // RA, PSO, GI

    for (let i = 0; i < N; i++) {
      const u = Math.abs((Math.sin(i * 17.1 + 8.3) * 1000) % 1);
      let trueInd = 0;
      if (u > prior[0] + prior[1]) trueInd = 2;
      else if (u > prior[0]) trueInd = 1;

      // Multi-indication co-occurrence (e.g. PsA + PSO)
      const isMulti = Math.abs((Math.sin(i * 3.3 + 9.9) * 1000) % 1) < 0.18;

      // 1. Linked Medical Dx Claim in [-90, +30d]
      const hasDxLink = Math.abs((Math.sin(i * 7.7 + 1.1) * 1000) % 1) < linkageRate;
      let linkedDx = null;
      if (hasDxLink) {
        // High fidelity if linked
        const dxNoise = Math.abs((Math.sin(i * 11.2 + 4.4) * 1000) % 1) < 0.05;
        linkedDx = dxNoise ? (trueInd + 1) % 3 : trueInd;
      }

      // 2. Prescriber Specialty Taxonomy
      const hasSpecialtyNoise = Math.abs((Math.sin(i * 13.9 + 5.5) * 1000) % 1) < noise;
      let specialty = trueInd;
      if (hasSpecialtyNoise) {
        specialty = Math.floor(Math.abs((Math.sin(i * 2.2 + 6.6) * 1000) % 1) * 3);
      }

      // 3. Induction Dosing Signature (Loading dose common in GI & Derm)
      let hasInduction = false;
      if (hasInductionFeature) {
        const indProb = trueInd === 2 ? 0.75 : (trueInd === 1 ? 0.45 : 0.08);
        hasInduction = Math.abs((Math.sin(i * 19.3 + 12.1) * 1000) % 1) < indProb;
      }

      // ─── Classification 1: Deterministic Waterfall ───
      let waterfallPred = -1; // Unattributed
      if (linkedDx !== null) {
        waterfallPred = linkedDx;
      } else if (!hasSpecialtyNoise) {
        waterfallPred = specialty;
      } else if (hasInduction) {
        waterfallPred = 2; // Default induction to GI
      }

      // ─── Classification 2: Naive Bayes Soft Attribution ───
      const scores = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        let logProb = Math.log(prior[k]);
        // Dx likelihood
        if (linkedDx !== null) {
          logProb += linkedDx === k ? Math.log(0.92) : Math.log(0.04);
        } else {
          logProb += Math.log(0.33);
        }
        // Specialty likelihood
        logProb += specialty === k ? Math.log(1 - noise * 0.8) : Math.log(noise * 0.4);
        // Induction likelihood
        if (hasInductionFeature) {
          const pInd = k === 2 ? 0.75 : (k === 1 ? 0.45 : 0.08);
          logProb += hasInduction ? Math.log(pInd) : Math.log(1 - pInd);
        }
        scores[k] = Math.exp(logProb);
      }
      const sumScores = scores[0] + scores[1] + scores[2];
      const posterior = scores.map(s => s / (sumScores || 1));
      let bayesPred = 0;
      if (posterior[1] > posterior[0] && posterior[1] > posterior[2]) bayesPred = 1;
      else if (posterior[2] > posterior[0] && posterior[2] > posterior[1]) bayesPred = 2;

      patients.push({
        id: `PAT-IND-${10000 + i}`,
        trueInd,
        isMulti,
        hasDxLink,
        linkedDx,
        specialty,
        hasInduction,
        waterfallPred,
        bayesPred,
        posterior
      });
    }

    return patients;
  }

  function render() {
    const N = parseInt(sampleSizeSlider.value, 10);
    const linkage = parseInt(linkageSlider.value, 10) / 100;
    const noise = parseInt(specialtyNoiseSlider.value, 10) / 100;
    const hasInduction = checkInductionDose.checked;

    linkageVal.textContent = `${Math.round(linkage * 100)}%`;
    specialtyNoiseVal.textContent = `${Math.round(noise * 100)}%`;
    sampleSizeVal.textContent = N.toLocaleString();

    serializeStateToURL({
      drug: drugPresetSelect.value,
      linkage: Math.round(linkage * 100),
      noise: Math.round(noise * 100),
      induction: hasInduction ? 1 : 0,
      n: N
    });

    const cohort = simulateCohort(N, linkage, noise, hasInduction);

    // Accuracy calculations
    const waterfallCorrect = cohort.filter(p => p.waterfallPred === p.trueInd).length;
    const waterfallAcc = (waterfallCorrect / N) * 100;

    const bayesCorrect = cohort.filter(p => p.bayesPred === p.trueInd).length;
    const bayesAcc = (bayesCorrect / N) * 100;

    const unattributedCount = cohort.filter(p => p.waterfallPred === -1).length;
    const unattributedRate = (unattributedCount / N) * 100;

    const multiCount = cohort.filter(p => p.isMulti).length;
    const inductionCount = cohort.filter(p => p.hasInduction).length;

    // Update KPI Scorecard
    statWaterfallAcc.textContent = fmtPct(waterfallAcc, 1);
    statBayesAcc.textContent = fmtPct(bayesAcc, 1);
    statUnattributed.textContent = fmtPct(unattributedRate, 1);
    statMultiIndication.textContent = fmtPct((multiCount / N) * 100, 1);
    statInductionRate.textContent = fmtPct((inductionCount / N) * 100, 1);

    attributionBadge.textContent = `Bayes Accuracy: ${fmtPct(bayesAcc, 1)}`;
    attributionBadge.className = bayesAcc >= 88 ? 'badge badge-emerald' : 'badge badge-amber';

    // ─────────────────────────────────────────────────────────────
    // Chart 1: Attribution Comparison Bar
    // ─────────────────────────────────────────────────────────────
    const trueCounts = [0, 0, 0];
    const waterfallCounts = [0, 0, 0, 0]; // RA, PSO, GI, Unattributed
    const bayesCounts = [0, 0, 0];

    cohort.forEach(p => {
      trueCounts[p.trueInd]++;
      if (p.waterfallPred === -1) waterfallCounts[3]++;
      else waterfallCounts[p.waterfallPred]++;
      bayesCounts[p.bayesPred]++;
    });

    const categories = ['Rheumatoid Arthritis', 'Plaque Psoriasis', 'Crohn’s / UC', 'Unattributed'];
    const truePcts = [...trueCounts.map(c => (c / N) * 100), 0];
    const waterfallPcts = waterfallCounts.map(c => (c / N) * 100);
    const bayesPcts = [...bayesCounts.map(c => (c / N) * 100), 0];

    const traces = [
      {
        x: categories,
        y: truePcts,
        name: 'Ground Truth True Share',
        type: 'bar',
        marker: { color: '#71717a' }
      },
      {
        x: categories,
        y: waterfallPcts,
        name: 'Deterministic Waterfall Rules',
        type: 'bar',
        marker: { color: '#f59e0b' }
      },
      {
        x: categories,
        y: bayesPcts,
        name: 'Naive Bayes Soft Model',
        type: 'bar',
        marker: { color: '#38bdf8' }
      }
    ];

    if (pinnedAttribution) {
      traces.push({
        x: categories,
        y: pinnedAttribution,
        name: 'Pinned Baseline Reference',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#a1a1aa', width: 2, dash: 'dash' }
      });
    }

    const layout = {
      ...DARK_LAYOUT,
      barmode: 'group',
      title: false,
      xaxis: { ...DARK_LAYOUT.xaxis, title: 'Attributed Therapeutic Indication' },
      yaxis: { ...DARK_LAYOUT.yaxis, title: 'Share of Cohort Volume (%)', range: [0, 60] },
      legend: { ...DARK_LAYOUT.legend, orientation: 'h', y: -0.25 }
    };

    Plotly.react('chart-attribution-bars', traces, layout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 2: Confusion Matrix (Truth vs Bayes Predicted)
    // ─────────────────────────────────────────────────────────────
    const confMatrix = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    cohort.forEach(p => {
      confMatrix[p.trueInd][p.bayesPred]++;
    });

    const confPcts = confMatrix.map((row, i) =>
      row.map(val => Math.round((val / (trueCounts[i] || 1)) * 100))
    );

    const heatmapTrace = {
      z: confPcts,
      x: ['Pred RA', 'Pred PSO', 'Pred GI'],
      y: ['True RA', 'True PSO', 'True GI'],
      type: 'heatmap',
      colorscale: [
        [0.0, '#18181b'],
        [0.3, '#0284c7'],
        [0.7, '#38bdf8'],
        [1.0, '#10b981']
      ],
      hoverongaps: false,
      colorbar: { title: '%', thickness: 10, len: 0.85, titlefont: { size: 10, color: '#a1a1aa' } }
    };

    const annotations = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        annotations.push({
          x: ['Pred RA', 'Pred PSO', 'Pred GI'][j],
          y: ['True RA', 'True PSO', 'True GI'][i],
          text: `${confPcts[i][j]}%`,
          font: { color: confPcts[i][j] > 40 ? '#09090b' : '#fafafa', size: 10, weight: 600 },
          showarrow: false
        });
      }
    }

    const confLayout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 25, b: 35, l: 65 },
      xaxis: { ...DARK_LAYOUT.xaxis },
      yaxis: { ...DARK_LAYOUT.yaxis, autorange: 'reversed' },
      annotations
    };

    Plotly.react('chart-confusion-matrix', [heatmapTrace], confLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 3: Signal Attribution Weight by Feature
    // ─────────────────────────────────────────────────────────────
    const featureWeights = [
      { feature: 'Linked Dx Claim', weight: Math.round(linkage * 58) },
      { feature: 'Prescriber Taxonomy', weight: Math.round((1 - noise) * 32) },
      { feature: 'Induction Dose Signature', weight: hasInduction ? 18 : 2 }
    ];

    const weightTrace = {
      x: featureWeights.map(f => f.weight),
      y: featureWeights.map(f => f.feature),
      type: 'bar',
      orientation: 'h',
      marker: { color: ['#10b981', '#38bdf8', '#f59e0b'] }
    };

    const weightLayout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 25, b: 35, l: 140 },
      xaxis: { ...DARK_LAYOUT.xaxis, title: 'Relative Information Gain (Bits / Weight)' },
      yaxis: { ...DARK_LAYOUT.yaxis }
    };

    Plotly.react('chart-feature-weights', [weightTrace], weightLayout, { responsive: true, displayModeBar: false });

    // Insight Callout
    attributionCalloutText.innerHTML = `
      <strong>Indication Attribution Performance:</strong> Deterministic waterfall rules leave <strong>${fmtPct(unattributedRate, 1)}</strong> of pharmacy claims unassigned due to missing ICD-10 medical claims. 
      The <strong>Naive Bayes soft attribution model achieves ${fmtPct(bayesAcc, 1)} accuracy</strong> (+${fmt(bayesAcc - waterfallAcc, 1)}% improvement) by probabilistically integrating prescriber NPI taxonomy and ${hasInduction ? 'induction loading dose signatures' : 'dosing schedules'}.
    `;
  }

  // Event Listeners
  drugPresetSelect.addEventListener('change', render);
  linkageSlider.addEventListener('input', render);
  specialtyNoiseSlider.addEventListener('input', render);
  checkInductionDose.addEventListener('change', render);
  sampleSizeSlider.addEventListener('input', render);

  btnPinCurve.addEventListener('click', () => {
    const N = parseInt(sampleSizeSlider.value, 10);
    const linkage = parseInt(linkageSlider.value, 10) / 100;
    const noise = parseInt(specialtyNoiseSlider.value, 10) / 100;
    const cohort = simulateCohort(N, linkage, noise, checkInductionDose.checked);
    const counts = [0, 0, 0];
    cohort.forEach(p => counts[p.bayesPred]++);
    pinnedAttribution = [...counts.map(c => (c / N) * 100), 0];
    btnPinCurve.textContent = '📌 Attribution Pinned!';
    render();
  });

  btnExportCSV.addEventListener('click', () => {
    const N = parseInt(sampleSizeSlider.value, 10);
    const linkage = parseInt(linkageSlider.value, 10) / 100;
    const noise = parseInt(specialtyNoiseSlider.value, 10) / 100;
    const cohort = simulateCohort(N, linkage, noise, checkInductionDose.checked);
    const records = cohort.map(p => ({
      patient_id: p.id,
      true_indication: INDICATIONS[p.trueInd],
      waterfall_predicted: p.waterfallPred === -1 ? 'Unattributed' : INDICATIONS[p.waterfallPred],
      bayes_predicted: INDICATIONS[p.bayesPred],
      has_linked_dx: p.hasDxLink ? 1 : 0,
      specialty_tax: p.specialty === 0 ? 'Rheumatology' : (p.specialty === 1 ? 'Dermatology' : 'Gastroenterology'),
      induction_detected: p.hasInduction ? 1 : 0
    }));
    exportToCSV(records, 'multi_indication_attribution_export.csv');
  });

  render();
}

