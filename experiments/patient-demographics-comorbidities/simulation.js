/**
 * Patient Demographics, Comorbidity Matrix & Risk Quintiles Simulation
 */
import {
  $,
  fmt,
  fmtPct,
  mean,
  DARK_LAYOUT,
  generatePatientCohort,
  computeComorbidityHeatmap,
  aggregateCohortByQuintile
} from '../../js/common.js';

export default function init() {
  // Elements
  const cohortPresetSelect = $('cohort-preset');
  const cohortSizeSlider = $('cohort-size-slider');
  const cohortSizeVal = $('cohort-size-val');
  const ageSlider = $('age-slider');
  const ageVal = $('age-val');
  const comorbMultiplierSlider = $('comorb-multiplier-slider');
  const comorbMultiplierVal = $('comorb-multiplier-val');
  const payerShiftSelect = $('payer-shift-select');

  const btnAgingShift = $('btn-aging-shift');
  const btnResetCohort = $('btn-reset-cohort');

  const cohortStatusBadge = $('cohort-status-badge');
  const valTotalPts = $('val-total-pts');
  const valMeanAge = $('val-mean-age');
  const valFemaleRatio = $('val-female-ratio');
  const valMeanCCI = $('val-mean-cci');
  const valHighRiskShare = $('val-high-risk-share');
  const valMedicareShare = $('val-medicare-share');
  const valAdherentShare = $('val-adherent-share');
  const quintileTableBody = $('quintile-table-body');
  const cohortCalloutText = $('cohort-callout-text');

  const PRESETS = {
    t2d_metabolic: { age: 62, multiplier: 1.0, payerShift: 0 },
    oncology: { age: 68, multiplier: 1.5, payerShift: 1 },
    autoimmune: { age: 51, multiplier: 0.9, payerShift: -1 },
    heart_failure: { age: 73, multiplier: 1.7, payerShift: 1 }
  };

  const AGE_BANDS = ['18-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+'];

  function getAgeBand(age) {
    if (age < 30) return '18-29';
    if (age < 40) return '30-39';
    if (age < 50) return '40-49';
    if (age < 60) return '50-59';
    if (age < 70) return '60-69';
    if (age < 80) return '70-79';
    return '80+';
  }

  let currentPatients = [];

  function generateData() {
    const size = parseInt(cohortSizeSlider.value, 10);
    const meanAge = parseInt(ageSlider.value, 10);
    const multiplier = parseFloat(comorbMultiplierSlider.value);
    const preset = cohortPresetSelect.value;
    const payerShift = parseInt(payerShiftSelect.value, 10);

    currentPatients = generatePatientCohort({
      count: size,
      meanAge,
      comorbidityMultiplier: multiplier,
      cohortPreset: preset,
      payerShift
    });
  }

  function render() {
    const size = parseInt(cohortSizeSlider.value, 10);
    const age = parseInt(ageSlider.value, 10);
    const multiplier = parseFloat(comorbMultiplierSlider.value);

    cohortSizeVal.textContent = size.toLocaleString();
    ageVal.textContent = `${age} yrs`;
    comorbMultiplierVal.textContent = `${fmt(multiplier, 1)}×`;

    const n = currentPatients.length;
    if (n === 0) return;

    // 1. Cohort Demographics Calculation
    const meanActualAge = mean(currentPatients.map(p => p.age));
    const femaleCount = currentPatients.filter(p => p.sex === 'Female').length;
    const femalePct = (femaleCount / n) * 100;
    const meanCCI = mean(currentPatients.map(p => p.cci));
    const highRiskPts = currentPatients.filter(p => p.riskQuintile >= 4);
    const highRiskShare = (highRiskPts.length / n) * 100;
    const medicarePts = currentPatients.filter(p => p.payer.includes('Medicare'));
    const medicareShare = (medicarePts.length / n) * 100;
    const adherentPts = currentPatients.filter(p => p.isAdherent);
    const adherentShare = (adherentPts.length / n) * 100;

    // Update Scorecard
    valTotalPts.textContent = n.toLocaleString();
    valMeanAge.textContent = `${fmt(meanActualAge, 1)} yrs`;
    valFemaleRatio.textContent = fmtPct(femalePct, 1);
    valMeanCCI.textContent = fmt(meanCCI, 2);
    valHighRiskShare.textContent = fmtPct(highRiskShare, 1);
    valMedicareShare.textContent = fmtPct(medicareShare, 1);
    valAdherentShare.textContent = fmtPct(adherentShare, 1);

    // Status Badge
    cohortStatusBadge.className = meanCCI >= 3.0 ? 'badge badge-rose' : (meanCCI >= 2.0 ? 'badge badge-amber' : 'badge badge-emerald');
    cohortStatusBadge.textContent = `Cohort CCI: ${fmt(meanCCI, 2)} (${highRiskShare > 40 ? 'Severe Multimorbidity' : 'Standard Cohort'})`;

    // ─────────────────────────────────────────────────────────────
    // Chart 1: Bidirectional Age-Sex Demographic Pyramid
    // ─────────────────────────────────────────────────────────────
    const maleBandCounts = {};
    const femaleBandCounts = {};
    AGE_BANDS.forEach(b => {
      maleBandCounts[b] = 0;
      femaleBandCounts[b] = 0;
    });

    currentPatients.forEach(p => {
      const band = getAgeBand(p.age);
      if (p.sex === 'Male') maleBandCounts[band]++;
      else femaleBandCounts[band]++;
    });

    const malePcts = AGE_BANDS.map(b => -((maleBandCounts[b] / n) * 100));
    const femalePcts = AGE_BANDS.map(b => (femaleBandCounts[b] / n) * 100);

    const pyramidTraces = [
      {
        y: AGE_BANDS,
        x: malePcts,
        name: 'Male Cohort',
        type: 'bar',
        orientation: 'h',
        marker: { color: '#38bdf8' },
        hoverinfo: 'y+text',
        hovertext: malePcts.map(v => `Male: ${fmt(Math.abs(v), 1)}% of cohort`)
      },
      {
        y: AGE_BANDS,
        x: femalePcts,
        name: 'Female Cohort',
        type: 'bar',
        orientation: 'h',
        marker: { color: '#f43f5e' },
        hoverinfo: 'y+text',
        hovertext: femalePcts.map(v => `Female: ${fmt(v, 1)}% of cohort`)
      }
    ];

    const maxSide = Math.max(...malePcts.map(Math.abs), ...femalePcts) * 1.25;

    const pyramidLayout = {
      ...DARK_LAYOUT,
      title: false,
      barmode: 'relative',
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Percentage of Cohort (%) — Males (Left) vs Females (Right)',
        range: [-maxSide, maxSide],
        tickvals: [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25],
        ticktext: ['25%', '20%', '15%', '10%', '5%', '0%', '5%', '10%', '15%', '20%', '25%']
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Age Bracket (Years)'
      },
      legend: {
        ...DARK_LAYOUT.legend,
        orientation: 'h',
        y: -0.22
      }
    };

    Plotly.react('chart-age-pyramid', pyramidTraces, pyramidLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 2: Comorbidity Co-Occurrence Heatmap
    // ─────────────────────────────────────────────────────────────
    const conditionKeys = ['t2d_uncomplicated', 'htn', 'dyslipidemia', 'obesity', 'ckd_mod_sev', 'chf', 'mi', 'copd'];
    const heatmapData = computeComorbidityHeatmap(currentPatients, conditionKeys);

    const shortLabels = [
      'Type 2 Diabetes',
      'Hypertension',
      'Dyslipidemia',
      'Obesity (BMI≥30)',
      'Chronic Kidney (CKD)',
      'Heart Failure (CHF)',
      'Myocardial Inf (CAD)',
      'Pulmonary (COPD)'
    ];

    const heatmapTrace = {
      z: heatmapData.matrix,
      x: shortLabels,
      y: shortLabels,
      type: 'heatmap',
      colorscale: [
        [0.0, '#18181b'],
        [0.2, '#1e293b'],
        [0.5, '#0284c7'],
        [0.8, '#38bdf8'],
        [1.0, '#10b981']
      ],
      hoverongaps: false,
      hovertemplate: '%{y} + %{x}<br>Joint Prevalence: %{z:.1f}%<extra></extra>',
      colorbar: {
        title: 'Joint %',
        titlefont: { color: '#a1a1aa', size: 11 },
        tickfont: { color: '#a1a1aa', size: 10 },
        thickness: 14,
        len: 0.85
      }
    };

    // Text annotations on heatmap cells
    const annotations = [];
    for (let i = 0; i < shortLabels.length; i++) {
      for (let j = 0; j < shortLabels.length; j++) {
        const val = heatmapData.matrix[i][j];
        annotations.push({
          x: shortLabels[j],
          y: shortLabels[i],
          text: `${fmt(val, 1)}%`,
          font: { color: val > 45 ? '#09090b' : '#fafafa', size: 9 },
          showarrow: false
        });
      }
    }

    const heatmapLayout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 40, b: 90, l: 120 },
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        tickangle: -35,
        tickfont: { size: 10, color: '#a1a1aa' }
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        tickfont: { size: 10, color: '#a1a1aa' },
        autorange: 'reversed'
      },
      annotations
    };

    Plotly.react('chart-comorbidity-heatmap', [heatmapTrace], heatmapLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 3: Clinical Outcomes by Risk Quintile
    // ─────────────────────────────────────────────────────────────
    const quintiles = aggregateCohortByQuintile(currentPatients);

    const qLabels = quintiles.map(q => q.quintile);
    const qPDC = quintiles.map(q => q.avgPDC);
    const qDiscon = quintiles.map(q => q.disconRate);
    const qHosp = quintiles.map(q => q.avgHospRisk);

    const outcomeTraces = [
      {
        x: qLabels,
        y: qPDC,
        name: 'Mean Adherence (PDC %)',
        type: 'bar',
        marker: { color: '#10b981' }
      },
      {
        x: qLabels,
        y: qDiscon,
        name: '12-Month Discontinuation %',
        type: 'bar',
        marker: { color: '#f59e0b' }
      },
      {
        x: qLabels,
        y: qHosp,
        name: 'Annual Inpatient Hospitalization Risk %',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2',
        line: { color: '#f43f5e', width: 2.5 },
        marker: { color: '#f43f5e', size: 8 }
      }
    ];

    const outcomeLayout = {
      ...DARK_LAYOUT,
      title: false,
      barmode: 'group',
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Charlson Comorbidity Risk Quintiles (Q1 Minimal → Q5 Severe)'
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Rate (%)',
        range: [0, 100]
      },
      yaxis2: {
        title: 'Hospitalization Hazard %',
        titlefont: { color: '#f43f5e' },
        tickfont: { color: '#f43f5e' },
        overlaying: 'y',
        side: 'right',
        range: [0, 100],
        gridcolor: 'transparent'
      },
      shapes: [
        {
          type: 'line',
          x0: -0.5,
          x1: 4.5,
          y0: 80,
          y1: 80,
          line: { color: '#10b981', width: 1.5, dash: 'dot' }
        }
      ],
      annotations: [
        {
          x: 0.1,
          y: 83,
          text: 'PQA 80% Adherence Threshold',
          showarrow: false,
          font: { color: '#10b981', size: 10 }
        }
      ],
      legend: {
        ...DARK_LAYOUT.legend,
        orientation: 'h',
        y: -0.25
      }
    };

    Plotly.react('chart-quintile-outcomes', outcomeTraces, outcomeLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Table: Risk Quintile Summary
    // ─────────────────────────────────────────────────────────────
    quintileTableBody.innerHTML = '';
    quintiles.forEach(q => {
      const tr = document.createElement('tr');
      const isHighRisk = q.quintile === 'Q4' || q.quintile === 'Q5';
      const badgeClass = isHighRisk ? 'badge-rose' : (q.quintile === 'Q3' ? 'badge-amber' : 'badge-emerald');

      tr.innerHTML = `
        <td style="font-weight: 600; color: ${isHighRisk ? '#f43f5e' : '#38bdf8'};">${q.label}</td>
        <td>${q.count.toLocaleString()}</td>
        <td>${fmtPct(q.pctOfCohort, 1)}</td>
        <td>${fmt(q.avgAge, 1)} yrs</td>
        <td>${fmtPct(q.femaleShare, 1)}</td>
        <td style="font-weight: 600;">${fmt(q.avgCCI, 2)}</td>
        <td style="color: ${q.avgPDC >= 80 ? '#10b981' : '#f59e0b'}; font-weight: 600;">${fmtPct(q.avgPDC, 1)}</td>
        <td><span class="badge ${badgeClass}" style="font-size: 0.6875rem;">${fmtPct(q.adherentShare, 1)}</span></td>
        <td style="color: #f59e0b;">${fmtPct(q.disconRate, 1)}</td>
        <td style="color: #f43f5e; font-weight: 600;">${fmtPct(q.avgHospRisk, 1)}</td>
      `;
      quintileTableBody.appendChild(tr);
    });

    // ─────────────────────────────────────────────────────────────
    // Callout Insight Text
    // ─────────────────────────────────────────────────────────────
    const q1 = quintiles[0];
    const q5 = quintiles[4];
    const pdcDrop = q1 && q5 ? q1.avgPDC - q5.avgPDC : 0;
    const hospJump = q1 && q5 ? q5.avgHospRisk - q1.avgHospRisk : 0;

    cohortCalloutText.innerHTML = `
      <strong>Clinical Epidemiology Insight:</strong> In this simulated cohort of <strong>${n.toLocaleString()} patients</strong> (mean age ${fmt(meanActualAge, 1)} years, ${fmtPct(femalePct, 1)} female), 
      multimorbidity creates a substantial adherence barrier. Between <strong>Q1 (CCI 0)</strong> and <strong>Q5 (Severe Multi-morbid, CCI ≥5)</strong>, average 12-month Proportion of Days Covered (PDC) drops by <strong>${fmt(pdcDrop, 1)} percentage points</strong> (${fmtPct(q1.avgPDC, 1)} down to ${fmtPct(q5.avgPDC, 1)}), while annual hospitalization hazard increases by <strong>+${fmt(hospJump, 1)}%</strong>. 
      Patients crossing the age 65 boundary shift abruptly into Medicare Advantage/FFS, requiring specialized patient support programs (PSPs) and co-pay assistance navigation.
    `;
  }

  // Event Listeners
  cohortPresetSelect.addEventListener('change', () => {
    const p = PRESETS[cohortPresetSelect.value];
    if (p) {
      ageSlider.value = p.age;
      comorbMultiplierSlider.value = p.multiplier;
      payerShiftSelect.value = p.payerShift;
    }
    generateData();
    render();
  });

  cohortSizeSlider.addEventListener('input', () => {
    generateData();
    render();
  });

  ageSlider.addEventListener('input', () => {
    generateData();
    render();
  });

  comorbMultiplierSlider.addEventListener('input', () => {
    generateData();
    render();
  });

  payerShiftSelect.addEventListener('change', () => {
    generateData();
    render();
  });

  btnAgingShift.addEventListener('click', () => {
    ageSlider.value = Math.min(78, parseInt(ageSlider.value, 10) + 8);
    comorbMultiplierSlider.value = (parseFloat(comorbMultiplierSlider.value) * 1.4).toFixed(1);
    generateData();
    render();
  });

  btnResetCohort.addEventListener('click', () => {
    cohortPresetSelect.value = 't2d_metabolic';
    cohortSizeSlider.value = '3500';
    ageSlider.value = '62';
    comorbMultiplierSlider.value = '1.0';
    payerShiftSelect.value = '0';
    generateData();
    render();
  });

  // Initial Run
  generateData();
  render();
}

