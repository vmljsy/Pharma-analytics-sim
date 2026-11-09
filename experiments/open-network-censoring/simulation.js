/**
 * Open-Network Censoring & Eligibility Proxy Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT, computeKaplanMeier } from '../../js/common.js';
import { exportToCSV, serializeStateToURL, deserializeStateFromURL } from '../../js/distributions.js';

export default function init() {
  const leakageSlider = $('leakage-slider');
  const leakageVal = $('leakage-val');
  const floorWindowSlider = $('floor-window-slider');
  const floorWindowVal = $('floor-window-val');
  const cohortSizeSlider = $('cohort-size-slider');
  const cohortSizeVal = $('cohort-size-val');

  const checkShowTruth = $('check-show-truth');
  const checkShowNaive = $('check-show-naive');
  const checkShowFloor = $('check-show-floor');

  const btnPinCurve = $('btn-pin-curve');
  const btnExportCSV = $('btn-export-csv');

  const networkBadge = $('network-badge');
  const statTrue12m = $('stat-true-12m');
  const statNaive12m = $('stat-naive-12m');
  const statFloor12m = $('stat-floor-12m');
  const statDownwardBias = $('stat-downward-bias');
  const statBiasRecovery = $('stat-bias-recovery');
  const censoringCalloutText = $('censoring-callout-text');

  let pinnedCurve = null;

  function simulateCohort(N, leakageRate, floorWindow) {
    const patients = [];

    for (let i = 0; i < N; i++) {
      // 1. True Clinical Discontinuation (Median ~ 310 days)
      const u1 = Math.abs((Math.sin(i * 12.3 + 45.6) * 1000) % 1);
      const trueTime = Math.min(365, Math.round(-Math.log(1 - u1 * 0.72) * 290));
      const trueEvent = trueTime < 365 ? 1 : 0; // 1 = Discontinued, 0 = Censored at 365

      // 2. Open Network Leakage (Patient diverted to non-reporting specialty pharmacy)
      const isLeaked = Math.abs((Math.sin(i * 3.45 + 6.78) * 1000) % 1) < leakageRate;
      let leakTime = 365;
      if (isLeaked) {
        // Leakage occurs between day 45 and 200
        leakTime = Math.round(45 + Math.abs((Math.sin(i * 8.9 + 1.2) * 1000) % 1) * 155);
      }

      // 3. Activity Floor: Non-target chronic claims (e.g. Statins/Antihypertensives)
      // Most patients maintain chronic general health fills through retail network
      const hasChronicRetention = Math.abs((Math.sin(i * 9.1 + 3.4) * 1000) % 1) < 0.85;

      // Naive Open Network view: Sees cessation of target claims as a true event
      let naiveTime = trueTime;
      let naiveEvent = trueEvent;
      if (isLeaked && leakTime < trueTime) {
        naiveTime = leakTime;
        naiveEvent = 1; // Naive model FALSELY assumes clinical discontinuation!
      }

      // Activity Floor Adjusted view:
      // If target claims stop but chronic claims continue, we recognize network loss and right-censor!
      let floorTime = trueTime;
      let floorEvent = trueEvent;
      if (isLeaked && leakTime < trueTime) {
        if (hasChronicRetention) {
          floorTime = leakTime;
          floorEvent = 0; // Correctly right-censored!
        } else {
          // If no activity floor either, treated as lost/dropout
          floorTime = leakTime;
          floorEvent = 1;
        }
      }

      patients.push({
        id: `PAT-NET-${1000 + i}`,
        trueTime: Math.max(1, trueTime),
        trueEvent,
        naiveTime: Math.max(1, naiveTime),
        naiveEvent,
        floorTime: Math.max(1, floorTime),
        floorEvent,
        isLeaked,
        leakTime
      });
    }

    return patients;
  }

  function render() {
    const N = parseInt(cohortSizeSlider.value, 10);
    const leakage = parseInt(leakageSlider.value, 10) / 100;
    const floorWindow = parseInt(floorWindowSlider.value, 10);

    leakageVal.textContent = `${Math.round(leakage * 100)}%`;
    floorWindowVal.textContent = `${floorWindow} days`;
    cohortSizeVal.textContent = N.toLocaleString();

    serializeStateToURL({
      leakage: Math.round(leakage * 100),
      floor: floorWindow,
      n: N
    });

    const cohort = simulateCohort(N, leakage, floorWindow);

    const kmTrue = computeKaplanMeier(cohort.map(p => ({ time: p.trueTime, event: p.trueEvent })));
    const kmNaive = computeKaplanMeier(cohort.map(p => ({ time: p.naiveTime, event: p.naiveEvent })));
    const kmFloor = computeKaplanMeier(cohort.map(p => ({ time: p.floorTime, event: p.floorEvent })));

    const true12m = kmTrue.survival12m;
    const naive12m = kmNaive.survival12m;
    const floor12m = kmFloor.survival12m;

    const bias = naive12m - true12m;
    const recovery = (floor12m - naive12m) / (Math.abs(bias) || 1) * 100;

    // Update KPI Scorecard
    statTrue12m.textContent = fmtPct(true12m, 1);
    statNaive12m.textContent = fmtPct(naive12m, 1);
    statFloor12m.textContent = fmtPct(floor12m, 1);
    statDownwardBias.textContent = `${bias >= 0 ? '+' : ''}${fmt(bias, 1)}%`;
    statBiasRecovery.textContent = fmtPct(Math.min(100, Math.max(0, recovery)), 1);

    networkBadge.textContent = `Downward Bias: ${fmt(bias, 1)}%`;
    networkBadge.className = Math.abs(bias) > 15 ? 'badge badge-rose' : 'badge badge-emerald';

    // ─────────────────────────────────────────────────────────────
    // Chart 1: Kaplan-Meier Survival Comparison
    // ─────────────────────────────────────────────────────────────
    const traces = [];

    if (checkShowTruth.checked) {
      traces.push({
        x: kmTrue.timeline,
        y: kmTrue.survival,
        name: `True Closed-Payer Survival (${fmtPct(true12m, 1)})`,
        type: 'scatter',
        mode: 'lines',
        line: { shape: 'hv', color: '#10b981', width: 3 }
      });
    }

    if (checkShowNaive.checked) {
      traces.push({
        x: kmNaive.timeline,
        y: kmNaive.survival,
        name: `Naive Open Network (${fmtPct(naive12m, 1)} — Biased)`,
        type: 'scatter',
        mode: 'lines',
        line: { shape: 'hv', color: '#f43f5e', width: 2.5, dash: 'dot' }
      });
    }

    if (checkShowFloor.checked) {
      traces.push({
        x: kmFloor.timeline,
        y: kmFloor.survival,
        name: `Activity Floor Reconstructed (${fmtPct(floor12m, 1)})`,
        type: 'scatter',
        mode: 'lines',
        line: { shape: 'hv', color: '#38bdf8', width: 2.8 }
      });
    }

    if (pinnedCurve) {
      traces.push({
        x: pinnedCurve.x,
        y: pinnedCurve.y,
        name: 'Pinned Reference Baseline',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#a1a1aa', width: 2, dash: 'dash' }
      });
    }

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      xaxis: { ...DARK_LAYOUT.xaxis, title: 'Days Since Brand Therapy Initiation (t = 0 to 365)' },
      yaxis: { ...DARK_LAYOUT.yaxis, title: 'Observed Persistence Probability Ŝ(t) (%)', range: [0, 105] },
      legend: { ...DARK_LAYOUT.legend, orientation: 'h', y: -0.22 }
    };

    Plotly.react('chart-censoring-km', traces, layout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 2: Claims Stream Architecture Timeline
    // ─────────────────────────────────────────────────────────────
    const samplePatients = cohort.slice(0, 8);
    const streamDays = [];
    const streamY = [];
    const streamColor = [];
    const streamHover = [];

    samplePatients.forEach((p, idx) => {
      // Plot target drug fills every 30 days up to visible end
      const visibleEnd = p.isLeaked ? p.leakTime : p.trueTime;
      for (let day = 0; day <= visibleEnd; day += 30) {
        streamDays.push(day);
        streamY.push(`Patient #${idx + 1}`);
        streamColor.push('#38bdf8');
        streamHover.push(`Day ${day}: Target Brand Rx Claim (In-Network)`);
      }
      // If leaked, plot red ghost fills demonstrating missing data
      if (p.isLeaked && p.leakTime < p.trueTime) {
        for (let day = p.leakTime + 30; day <= p.trueTime; day += 30) {
          streamDays.push(day);
          streamY.push(`Patient #${idx + 1}`);
          streamColor.push('#f43f5e');
          streamHover.push(`Day ${day}: Unobserved Claim (Filled at Non-Reporting Pharmacy)`);
        }
      }
    });

    const streamTrace = {
      x: streamDays,
      y: streamY,
      mode: 'markers',
      type: 'scatter',
      marker: { color: streamColor, size: 10, symbol: 'square' },
      hoverinfo: 'text',
      hovertext: streamHover
    };

    const streamLayout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 25, b: 35, l: 85 },
      xaxis: { ...DARK_LAYOUT.xaxis, title: 'Observation Timeline (Days 0 to 365)' },
      yaxis: { ...DARK_LAYOUT.yaxis, autorange: 'reversed' },
      showlegend: false
    };

    Plotly.react('chart-claim-streams', [streamTrace], streamLayout, { responsive: true, displayModeBar: false });

    // Insight Callout
    censoringCalloutText.innerHTML = `
      <strong>Open-Network Attrition Hazard:</strong> A <strong>${Math.round(leakage * 100)}% network leakage rate</strong> creates an artificial <strong>${fmt(bias, 1)} percentage point downward bias</strong> in 12-month persistence (${fmtPct(true12m, 1)} true vs ${fmtPct(naive12m, 1)} naive). 
      Implementing a <strong>${floorWindow}-day pharmacy activity floor proxy</strong> successfully recovers <strong>${fmtPct(Math.min(100, Math.max(0, recovery)), 1)}</strong> of the distortion, aligning open LRX survival estimates with gold-standard payer closed files.
    `;
  }

  // Event Listeners
  leakageSlider.addEventListener('input', render);
  floorWindowSlider.addEventListener('input', render);
  cohortSizeSlider.addEventListener('input', render);
  checkShowTruth.addEventListener('change', render);
  checkShowNaive.addEventListener('change', render);
  checkShowFloor.addEventListener('change', render);

  btnPinCurve.addEventListener('click', () => {
    const N = parseInt(cohortSizeSlider.value, 10);
    const leakage = parseInt(leakageSlider.value, 10) / 100;
    const floorWindow = parseInt(floorWindowSlider.value, 10);
    const cohort = simulateCohort(N, leakage, floorWindow);
    const km = computeKaplanMeier(cohort.map(p => ({ time: p.floorTime, event: p.floorEvent })));
    pinnedCurve = { x: km.timeline, y: km.survival };
    btnPinCurve.textContent = '📌 Curve Pinned!';
    render();
  });

  btnExportCSV.addEventListener('click', () => {
    const N = parseInt(cohortSizeSlider.value, 10);
    const leakage = parseInt(leakageSlider.value, 10) / 100;
    const floorWindow = parseInt(floorWindowSlider.value, 10);
    const cohort = simulateCohort(N, leakage, floorWindow);
    const records = cohort.map(p => ({
      patient_id: p.id,
      true_time_days: p.trueTime,
      true_discontinued: p.trueEvent,
      naive_time_days: p.naiveTime,
      naive_discontinued: p.naiveEvent,
      activity_floor_time_days: p.floorTime,
      activity_floor_discontinued: p.floorEvent,
      network_leaked: p.isLeaked ? 1 : 0
    }));
    exportToCSV(records, 'open_network_censoring_export.csv');
  });

  render();
}

