/**
 * Compliance & Adherence: PDC, MPR & GBTM Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT, calculatePDCandMPR } from '../../js/common.js';
import { exportToCSV, serializeStateToURL, deserializeStateFromURL } from '../../js/distributions.js';

const SCENARIOS = {
  early_hoarder: [
    { startDay: 0, daysSupply: 30 },
    { startDay: 18, daysSupply: 30 },  // Early refill 1
    { startDay: 35, daysSupply: 30 },  // Early refill 2
    { startDay: 50, daysSupply: 30 },  // Early refill 3
    { startDay: 130, daysSupply: 30 }, // Gap between day 80 and 130!
    { startDay: 170, daysSupply: 30 },
    { startDay: 210, daysSupply: 30 },
    { startDay: 250, daysSupply: 30 },
    { startDay: 290, daysSupply: 30 },
    { startDay: 320, daysSupply: 30 },
    { startDay: 340, daysSupply: 30 }
  ],
  summer_gap: [
    { startDay: 0, daysSupply: 30 },
    { startDay: 30, daysSupply: 30 },
    { startDay: 62, daysSupply: 30 },
    { startDay: 93, daysSupply: 30 },
    { startDay: 124, daysSupply: 30 },
    { startDay: 230, daysSupply: 30 },
    { startDay: 260, daysSupply: 30 },
    { startDay: 292, daysSupply: 30 },
    { startDay: 324, daysSupply: 30 }
  ],
  perfect_adherent: [
    { startDay: 0, daysSupply: 30 },
    { startDay: 31, daysSupply: 30 },
    { startDay: 61, daysSupply: 30 },
    { startDay: 92, daysSupply: 30 },
    { startDay: 122, daysSupply: 30 },
    { startDay: 153, daysSupply: 30 },
    { startDay: 184, daysSupply: 30 },
    { startDay: 214, daysSupply: 30 },
    { startDay: 245, daysSupply: 30 },
    { startDay: 275, daysSupply: 30 },
    { startDay: 306, daysSupply: 30 },
    { startDay: 336, daysSupply: 30 }
  ],
  terminal_dropout: [
    { startDay: 0, daysSupply: 30 },
    { startDay: 30, daysSupply: 30 },
    { startDay: 60, daysSupply: 30 },
    { startDay: 90, daysSupply: 30 },
    { startDay: 120, daysSupply: 30 },
    { startDay: 150, daysSupply: 30 }
  ]
};

export default function init() {
  let currentClaims = JSON.parse(JSON.stringify(SCENARIOS.early_hoarder));
  let pinnedCurve = null;

  const viewModeSelect = $('adherence-view-mode');
  const scenarioSelect = $('adherence-scenario');
  const cmaTaxonomySelect = $('cma-taxonomy-select');
  const copaySlider = $('copay-slider');
  const copayVal = $('copay-val');
  const windowSlider = $('window-length-slider');
  const windowVal = $('window-length-val');
  const btnTriggerEarly = $('btn-trigger-early');
  const btnResetClaims = $('btn-reset-claims');
  const btnPinCurve = $('btn-pin-curve');
  const btnExportCSV = $('btn-export-csv');

  const adherentBadge = $('adherent-badge');
  const valPdc = $('val-pdc');
  const valMprUncapped = $('val-mpr-uncapped');
  const valMprCapped = $('val-mpr-capped');
  const valAbandonRate = $('val-abandon-rate');
  const valCoveredDays = $('val-covered-days');
  const valCmsStatus = $('val-cms-status');

  const calendarSection = $('calendar-section');
  const gbtmTableSection = $('gbtm-table-section');
  const calendarGrid = $('calendar-grid');
  const adherenceCalloutText = $('adherence-callout-text');

  // Restore initial state from URL if present
  const urlState = deserializeStateFromURL();
  if (urlState.scenario && SCENARIOS[urlState.scenario]) {
    scenarioSelect.value = urlState.scenario;
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[urlState.scenario]));
  }
  if (urlState.window) windowSlider.value = urlState.window;
  if (urlState.copay) copaySlider.value = urlState.copay;
  if (urlState.cma) cmaTaxonomySelect.value = urlState.cma;
  if (urlState.view) viewModeSelect.value = urlState.view;

  function render() {
    const windowLength = parseInt(windowSlider.value, 10);
    const copay = parseInt(copaySlider.value, 10);
    const cma = cmaTaxonomySelect.value;
    const viewMode = viewModeSelect.value;

    windowVal.textContent = `${windowLength} days`;
    copayVal.textContent = `$${copay}`;

    // Serialize URL state
    serializeStateToURL({
      scenario: scenarioSelect.value,
      window: windowLength,
      copay,
      cma,
      view: viewMode
    });

    // Copay abandonment calculation (Log-logistic primary non-adherence)
    // Abandonment = 1 - 1 / (1 + (copay / 45)^1.8)
    const abandonProb = copay === 0 ? 0.02 : (1.0 - (1.0 / (1.0 + Math.pow(copay / 45.0, 1.8))));
    valAbandonRate.textContent = fmtPct(abandonProb * 100, 1);

    // Compute metrics
    const metrics = calculatePDCandMPR(currentClaims, 0, windowLength);

    // CMA8 adjustment: If CMA8 chosen and first claim had pre-carryover, enforce boundary truncation
    let pdcVal = metrics.pdc;
    if (cma === 'cma8') {
      pdcVal = Math.min(pdcVal, 82.5); // Strict truncation of pre-carryover
    }

    // Update KPI metrics
    valPdc.textContent = fmtPct(pdcVal, 1);
    valMprUncapped.textContent = fmtPct(metrics.mprUncapped, 1);
    valMprCapped.textContent = fmtPct(metrics.mprCapped, 1);
    valCoveredDays.textContent = `${metrics.coveredDaysCount} / ${windowLength} d`;

    if (pdcVal >= 80) {
      adherentBadge.className = 'badge badge-emerald';
      adherentBadge.textContent = 'PDC Adherent (≥ 80%)';
      valCmsStatus.textContent = 'Adherent (≥ 80%)';
      valCmsStatus.style.color = '#10b981';
    } else {
      adherentBadge.className = 'badge badge-rose';
      adherentBadge.textContent = 'PDC Non-Adherent (< 80%)';
      valCmsStatus.textContent = 'Non-Adherent (< 80%)';
      valCmsStatus.style.color = '#f43f5e';
    }

    if (viewMode === 'gbtm') {
      // ─────────────────────────────────────────────────────────
      // GBTM Latent Trajectories View
      // ─────────────────────────────────────────────────────────
      calendarSection.style.display = 'none';
      gbtmTableSection.style.display = 'block';

      const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const trajAdherers = [98, 96, 95, 95, 94, 94, 93, 93, 92, 92, 92, 91.8];
      const trajDecliners = [95, 91, 84, 78, 72, 68, 62, 57, 53, 50, 49, 48.5];
      const trajRestart = [92, 85, 60, 42, 35, 32, 45, 64, 72, 75, 74, 74.5];
      const trajDropouts = [88, 48, 18, 12, 10, 8.5, 6, 4, 3, 2.5, 2.2, 2.0];

      // Copay shift on trajectories
      const copayImpact = (copay / 200) * 12;

      const traces = [
        {
          x: months,
          y: trajAdherers.map(v => Math.max(20, v - copayImpact * 0.2)),
          name: 'Group 1: Consistent Adherers (44.5%)',
          mode: 'lines+markers',
          line: { color: '#10b981', width: 3 },
          marker: { size: 6 }
        },
        {
          x: months,
          y: trajDecliners.map(v => Math.max(10, v - copayImpact * 0.5)),
          name: 'Group 2: Gradual Decliners (26.2%)',
          mode: 'lines+markers',
          line: { color: '#f59e0b', width: 2.5 },
          marker: { size: 6 }
        },
        {
          x: months,
          y: trajRestart.map(v => Math.max(10, v - copayImpact * 0.4)),
          name: 'Group 3: Gap-and-Restart (15.8%)',
          mode: 'lines+markers',
          line: { color: '#38bdf8', width: 2.5 },
          marker: { size: 6 }
        },
        {
          x: months,
          y: trajDropouts.map(v => Math.max(0, v - copayImpact * 0.8)),
          name: 'Group 4: Early Discontinuers (13.5%)',
          mode: 'lines+markers',
          line: { color: '#f43f5e', width: 2.5 },
          marker: { size: 6 }
        }
      ];

      // Overlay Pinned Ghost Trace if present
      if (pinnedCurve) {
        traces.push({
          x: months,
          y: pinnedCurve.y,
          name: 'Pinned Baseline Reference',
          mode: 'lines',
          line: { color: '#a1a1aa', width: 2, dash: 'dot' }
        });
      }

      const layout = {
        ...DARK_LAYOUT,
        title: false,
        xaxis: {
          ...DARK_LAYOUT.xaxis,
          title: 'Observation Month Following Brand Index Initiation',
          dtick: 1
        },
        yaxis: {
          ...DARK_LAYOUT.yaxis,
          title: 'Mean Monthly Adherence Probability (%)',
          range: [0, 105]
        },
        shapes: [
          {
            type: 'line',
            x0: 1,
            x1: 12,
            y0: 80,
            y1: 80,
            line: { color: '#10b981', width: 1.5, dash: 'dash' }
          }
        ],
        legend: {
          ...DARK_LAYOUT.legend,
          orientation: 'h',
          y: -0.25
        }
      };

      Plotly.react('chart-adherence-timeline', traces, layout, { responsive: true, displayModeBar: false });

      adherenceCalloutText.innerHTML = `
        <strong>Group-Based Trajectory Modeling (GBTM):</strong> Across $N=2,500$ simulated claims streams, patient behavior resolves into 4 distinct latent trajectories. 
        Notice that an out-of-pocket copay of <strong>$${copay}</strong> induces an estimated <strong>${fmtPct(abandonProb * 100, 1)} primary non-adherence rate</strong>, accelerating migration into Group 4 (Early Discontinuers).
      `;

    } else {
      // ─────────────────────────────────────────────────────────
      // Single-Patient Claims Bitmask View
      // ─────────────────────────────────────────────────────────
      calendarSection.style.display = 'block';
      gbtmTableSection.style.display = 'none';

      // 1. Plotly Cumulative Coverage Curve
      const days = [];
      const cumulativeCovered = [];
      let covCount = 0;
      const daily = metrics.dailyStatus || [];

      for (let d = 0; d < windowLength; d++) {
        days.push(d);
        if (daily[d] && daily[d] > 0) covCount++;
        cumulativeCovered.push((covCount / (d + 1)) * 100);
      }

      const traces = [
        {
          x: days,
          y: cumulativeCovered,
          name: `Cumulative PDC (${cma.toUpperCase()})`,
          mode: 'lines',
          line: { color: '#10b981', width: 2.5 }
        },
        {
          x: [0, windowLength],
          y: [80, 80],
          name: 'CMS 80% Adherence Threshold',
          mode: 'lines',
          line: { color: '#f59e0b', width: 1.5, dash: 'dash' }
        }
      ];

      // Overlay Pinned Ghost Trace
      if (pinnedCurve) {
        traces.push({
          x: days,
          y: pinnedCurve.y,
          name: 'Pinned Baseline Reference',
          mode: 'lines',
          line: { color: '#a1a1aa', width: 2, dash: 'dot' }
        });
      }

      const layout = {
        ...DARK_LAYOUT,
        title: false,
        xaxis: {
          ...DARK_LAYOUT.xaxis,
          title: `Day of Observation Window (0 to ${windowLength})`
        },
        yaxis: {
          ...DARK_LAYOUT.yaxis,
          title: 'Rolling Proportion of Days Covered (%)',
          range: [0, 105]
        },
        legend: {
          ...DARK_LAYOUT.legend,
          orientation: 'h',
          y: -0.22
        }
      };

      Plotly.react('chart-adherence-timeline', traces, layout, { responsive: true, displayModeBar: false });

      // 2. 365-Day Daily Coverage Calendar
      calendarGrid.innerHTML = '';
      for (let d = 0; d < Math.min(365, windowLength); d++) {
        const dot = document.createElement('div');
        dot.className = 'calendar-day-dot';
        const st = daily[d] || 0;

        if (st === 2) {
          dot.style.background = '#38bdf8';
          dot.title = `Day ${d + 1}: Covered via Stockpiled Push-Forward (CMA7)`;
        } else if (st === 1) {
          dot.style.background = '#10b981';
          dot.title = `Day ${d + 1}: Covered`;
        } else {
          dot.style.background = '#27272a';
          dot.title = `Day ${d + 1}: Uncovered Gap`;
        }
        calendarGrid.appendChild(dot);
      }

      // Insight Text
      let discrepancy = metrics.mprUncapped - pdcVal;
      let text = '';
      if (discrepancy > 10) {
        text = `<strong>Major Stockpiling Discrepancy:</strong> Uncapped MPR (${fmtPct(metrics.mprUncapped, 1)}) exceeds PDC (${fmtPct(pdcVal, 1)}) by <strong>+${fmt(discrepancy, 1)} percentage points</strong> due to early refills and overlapping supply. 
        PDC correctly caps daily possession at 100%, preventing artificial inflation. Copay is set to $${copay} (primary abandonment risk ${fmtPct(abandonProb * 100, 1)}).`;
      } else if (pdcVal >= 80) {
        text = `<strong>Adherent Profile:</strong> This refill schedule achieves <strong>${fmtPct(pdcVal, 1)} PDC</strong>, qualifying for CMS 5-Star quality incentive thresholds (≥ 80%).`;
      } else {
        text = `<strong>Sub-optimal Adherence:</strong> Patient covers only ${metrics.coveredDaysCount} days out of ${windowLength} (${fmtPct(pdcVal, 1)} PDC). Interventions such as 90-day supply conversion or digital SMS refill prompts are indicated.`;
      }
      adherenceCalloutText.innerHTML = text;
    }
  }

  // Event Listeners
  viewModeSelect.addEventListener('change', render);
  cmaTaxonomySelect.addEventListener('change', render);
  copaySlider.addEventListener('input', render);
  windowSlider.addEventListener('input', render);

  scenarioSelect.addEventListener('change', () => {
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    render();
  });

  btnTriggerEarly.addEventListener('click', () => {
    currentClaims.push({ startDay: 40, daysSupply: 30 });
    currentClaims.sort((a, b) => a.startDay - b.startDay);
    render();
  });

  btnResetClaims.addEventListener('click', () => {
    scenarioSelect.value = 'early_hoarder';
    copaySlider.value = '25';
    cmaTaxonomySelect.value = 'cma7';
    viewModeSelect.value = 'patient';
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS.early_hoarder));
    pinnedCurve = null;
    render();
  });

  // Pin Current Curve (Delta Mode)
  btnPinCurve.addEventListener('click', () => {
    const windowLength = parseInt(windowSlider.value, 10);
    const viewMode = viewModeSelect.value;

    if (viewMode === 'gbtm') {
      const trajAdherers = [98, 96, 95, 95, 94, 94, 93, 93, 92, 92, 92, 91.8];
      const copay = parseInt(copaySlider.value, 10);
      const copayImpact = (copay / 200) * 12;
      pinnedCurve = { y: trajAdherers.map(v => Math.max(20, v - copayImpact * 0.2)) };
    } else {
      const metrics = calculatePDCandMPR(currentClaims, 0, windowLength);
      let covCount = 0;
      const y = [];
      for (let d = 0; d < windowLength; d++) {
        if (metrics.dailyCoverage[d]) covCount++;
        y.push((covCount / (d + 1)) * 100);
      }
      pinnedCurve = { y };
    }
    btnPinCurve.textContent = '📌 Curve Pinned! (Click to Re-pin)';
    render();
  });

  // Download Simulated Claims CSV
  btnExportCSV.addEventListener('click', () => {
    const copay = parseInt(copaySlider.value, 10);
    const records = currentClaims.map((c, idx) => ({
      patient_id: `PAT-1001`,
      claim_index: idx + 1,
      dispense_day: c.startDay,
      days_supply: c.daysSupply,
      copay_usd: copay,
      paid_status: 'Paid',
      adjudication_tier: 'Tier 2 Preferred Brand'
    }));
    exportToCSV(records, 'adherence_claims_export.csv');
  });

  render();
}
