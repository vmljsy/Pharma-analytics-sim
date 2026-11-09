/**
 * Compliance & Adherence: PDC vs MPR Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT, calculatePDCandMPR } from '../../js/common.js';

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
    { startDay: 124, daysSupply: 30 }, // Ends day 154
    // 76-day summer holiday gap!
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
    // Permanent dropout for remainder of 365-day year!
  ]
};

export default function init() {
  let currentClaims = JSON.parse(JSON.stringify(SCENARIOS.early_hoarder));

  const scenarioSelect = $('adherence-scenario');
  const windowSlider = $('window-length-slider');
  const windowVal = $('window-length-val');
  const btnTriggerEarly = $('btn-trigger-early');
  const btnResetClaims = $('btn-reset-claims');

  const adherentBadge = $('adherent-badge');
  const valPdc = $('val-pdc');
  const valMprUncapped = $('val-mpr-uncapped');
  const valMprCapped = $('val-mpr-capped');
  const valMprVar = $('val-mpr-var');
  const valCoveredDays = $('val-covered-days');
  const valCmsStatus = $('val-cms-status');

  const calendarGrid = $('calendar-grid');
  const adherenceCalloutText = $('adherence-callout-text');

  function render() {
    const windowLength = parseInt(windowSlider.value, 10);
    windowVal.textContent = `${windowLength} days`;

    // Compute metrics
    const metrics = calculatePDCandMPR(currentClaims, 0, windowLength);

    // Update KPI metrics
    valPdc.textContent = fmtPct(metrics.pdc, 1);
    valMprUncapped.textContent = fmtPct(metrics.mprUncapped, 1);
    valMprCapped.textContent = fmtPct(metrics.mprCapped, 1);
    valMprVar.textContent = fmtPct(metrics.mprVariable, 1);
    valCoveredDays.textContent = `${metrics.coveredDaysCount} / ${windowLength} d`;

    if (metrics.isAdherentPDC) {
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

    // Callout insight
    const diff = metrics.mprUncapped - metrics.pdc;
    if (diff > 5) {
      adherenceCalloutText.innerHTML = `
        <strong>Severe MPR Inflation Detected (+${fmt(diff, 1)}%):</strong> Uncapped MPR is <strong>${fmtPct(metrics.mprUncapped, 1)}</strong> 
        because the patient refilled early and stockpiled supply. Under traditional MPR, this patient appears completely adherent or even over-supplied, 
        yet their true <strong>PDC is only ${fmtPct(metrics.pdc, 1)}</strong> due to unaddressed gaps. CMS and PQA use PDC precisely to eliminate this bias.
      `;
    } else if (metrics.mprVariable > metrics.pdc + 20) {
      adherenceCalloutText.innerHTML = `
        <strong>Terminal Gap Omission in Variable MPR:</strong> Variable MPR ignores the terminal discontinuation gap from Day 180 to ${windowLength}, 
        scoring a deceptive <strong>${fmtPct(metrics.mprVariable, 1)}</strong>. PDC evaluates the entire observation interval, correctly reflecting 
        clinical discontinuation with <strong>${fmtPct(metrics.pdc, 1)}</strong>.
      `;
    } else {
      adherenceCalloutText.innerHTML = `
        <strong>Consistent Coverage:</strong> PDC (<strong>${fmtPct(metrics.pdc, 1)}</strong>) and Capped MPR (<strong>${fmtPct(metrics.mprCapped, 1)}</strong>) 
        are well-aligned because refill intervals closely match days of supply with minimal overlapping stockpiles.
      `;
    }

    // Populate 365-Day Calendar Bitmask
    renderCalendarGrid(metrics.dailyStatus, windowLength);

    // Render Plotly Timeline Chart
    renderPlotlyAdherence(currentClaims, metrics, windowLength);
  }

  function renderCalendarGrid(dailyStatus, windowLength) {
    calendarGrid.innerHTML = '';
    for (let day = 0; day < windowLength; day++) {
      const dot = document.createElement('div');
      dot.className = 'calendar-day-dot';
      const status = dailyStatus[day] || 0;

      if (status === 1) {
        dot.classList.add('covered');
        dot.title = `Day ${day + 1}: Covered`;
      } else if (status === 2) {
        dot.classList.add('overlap');
        dot.title = `Day ${day + 1}: Covered (Shifted Overlap)`;
      } else {
        dot.classList.add('gap');
        dot.title = `Day ${day + 1}: Treatment Gap`;
      }

      calendarGrid.appendChild(dot);
    }
  }

  function renderPlotlyAdherence(claims, metrics, windowLength) {
    const shapes = [];
    const annotations = [];

    // Track 1: Raw Claims
    claims.forEach((c, idx) => {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: c.startDay,
        x1: c.startDay + c.daysSupply,
        y0: 1.1,
        y1: 1.6,
        fillcolor: 'rgba(245, 158, 11, 0.25)',
        line: { color: '#f59e0b', width: 1.5 }
      });
      annotations.push({
        x: c.startDay + c.daysSupply / 2,
        y: 1.35,
        text: `Rx ${c.daysSupply}d`,
        showarrow: false,
        font: { color: '#fafafa', size: 9, family: 'Geist Mono, monospace' }
      });
    });

    // Track 0: Shifted Continuous Covered Intervals (PDC Method)
    let inCovered = false;
    let segStart = 0;
    for (let d = 0; d < windowLength; d++) {
      const isCov = metrics.dailyStatus[d] > 0;
      if (isCov && !inCovered) {
        inCovered = true;
        segStart = d;
      } else if (!isCov && inCovered) {
        inCovered = false;
        shapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'y',
          x0: segStart,
          x1: d,
          y0: 0.2,
          y1: 0.7,
          fillcolor: 'rgba(16, 185, 129, 0.35)',
          line: { color: '#10b981', width: 1.5 }
        });
      }
    }
    if (inCovered) {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: segStart,
        x1: windowLength,
        y0: 0.2,
        y1: 0.7,
        fillcolor: 'rgba(16, 185, 129, 0.35)',
        line: { color: '#10b981', width: 1.5 }
      });
    }

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 25, r: 25, b: 35, l: 150 },
      shapes: shapes,
      annotations: annotations,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Measurement Period (Days)',
        range: [-5, windowLength + 10],
        dtick: 30
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        range: [0, 1.8],
        tickvals: [0.45, 1.35],
        ticktext: ['<b>PDC Covered Days</b>', '<b>Raw Dispensed Fills</b>'],
        showgrid: false
      },
      showlegend: false
    };

    const dummyTrace = [{
      x: [0],
      y: [0],
      type: 'scatter',
      mode: 'markers',
      marker: { opacity: 0 }
    }];

    Plotly.react('chart-adherence-timeline', dummyTrace, layout, { responsive: true, displayModeBar: false });
  }

  // Event Listeners
  scenarioSelect.addEventListener('change', () => {
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    render();
  });

  windowSlider.addEventListener('input', render);

  btnResetClaims.addEventListener('click', () => {
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    render();
  });

  btnTriggerEarly.addEventListener('click', () => {
    // Add an aggressive early refill 10 days after the second claim
    if (currentClaims.length >= 2) {
      const earlyDate = currentClaims[1].startDay + 10;
      currentClaims.push({ startDay: earlyDate, daysSupply: 30 });
      currentClaims.sort((a, b) => a.startDay - b.startDay);
      render();
    }
  });

  // Initial render
  render();
}
