/**
 * Episode Building & Overlap Resolution Simulation
 */
import { $, fmt, DARK_LAYOUT, buildTreatmentEpisodes } from '../../js/common.js';

// Pre-configured clinical scenarios
const SCENARIOS = {
  early_refills: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Target Rx' },
    { id: 2, startDay: 20, daysSupply: 30, drug: 'Target Rx' }, // 10-day early refill
    { id: 3, startDay: 45, daysSupply: 30, drug: 'Target Rx' }, // 5-day early refill against pushed supply
    { id: 4, startDay: 110, daysSupply: 30, drug: 'Target Rx' },
    { id: 5, startDay: 150, daysSupply: 60, drug: 'Target Rx' },
    { id: 6, startDay: 235, daysSupply: 30, drug: 'Target Rx' },
    { id: 7, startDay: 280, daysSupply: 60, drug: 'Target Rx' },
  ],
  gap_discontinuation: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Target Rx' },
    { id: 2, startDay: 32, daysSupply: 30, drug: 'Target Rx' },
    { id: 3, startDay: 65, daysSupply: 30, drug: 'Target Rx' },
    { id: 4, startDay: 160, daysSupply: 30, drug: 'Target Rx' }, // 65-day treatment gap!
    { id: 5, startDay: 195, daysSupply: 30, drug: 'Target Rx' },
    { id: 6, startDay: 230, daysSupply: 30, drug: 'Target Rx' },
  ],
  regular_adherence: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Target Rx' },
    { id: 2, startDay: 32, daysSupply: 30, drug: 'Target Rx' },
    { id: 3, startDay: 64, daysSupply: 30, drug: 'Target Rx' },
    { id: 4, startDay: 96, daysSupply: 30, drug: 'Target Rx' },
    { id: 5, startDay: 128, daysSupply: 30, drug: 'Target Rx' },
    { id: 6, startDay: 160, daysSupply: 30, drug: 'Target Rx' },
    { id: 7, startDay: 192, daysSupply: 30, drug: 'Target Rx' },
    { id: 8, startDay: 224, daysSupply: 30, drug: 'Target Rx' },
    { id: 9, startDay: 256, daysSupply: 30, drug: 'Target Rx' },
    { id: 10, startDay: 288, daysSupply: 30, drug: 'Target Rx' },
    { id: 11, startDay: 320, daysSupply: 30, drug: 'Target Rx' },
  ],
  volatile_claims: [
    { id: 1, startDay: 0, daysSupply: 60, drug: 'Target Rx' },
    { id: 2, startDay: 45, daysSupply: 30, drug: 'Target Rx' }, // 15-day early overlap
    { id: 3, startDay: 75, daysSupply: 90, drug: 'Target Rx' }, // 90-day supply bulk refill
    { id: 4, startDay: 210, daysSupply: 30, drug: 'Target Rx' },
    { id: 5, startDay: 255, daysSupply: 30, drug: 'Target Rx' },
    { id: 6, startDay: 290, daysSupply: 60, drug: 'Target Rx' },
  ]
};

export default function init() {
  let currentClaims = JSON.parse(JSON.stringify(SCENARIOS.early_refills));

  // DOM elements
  const scenarioSelect = $('scenario-select');
  const overlapSelect = $('overlap-select');
  const gapSlider = $('gap-slider');
  const gapVal = $('gap-val');
  const windowSlider = $('window-slider');
  const windowVal = $('window-val');
  const btnAddClaim = $('btn-add-claim');
  const btnReset = $('btn-reset');

  const badgeStatus = $('badge-status');
  const calloutText = $('callout-text');
  const claimsTableBody = $('claims-table-body');

  const statEpisodes = $('stat-episodes');
  const statMeanDuration = $('stat-mean-duration');
  const statSupplyDays = $('stat-supply-days');
  const statClosures = $('stat-closures');
  const statOngoing = $('stat-ongoing');

  function render() {
    const allowableGap = parseInt(gapSlider.value, 10);
    const overlapMethod = overlapSelect.value;
    const studyEnd = parseInt(windowSlider.value, 10);

    gapVal.textContent = `${allowableGap} days`;
    windowVal.textContent = `${studyEnd} days`;

    // Run episode building engine
    const result = buildTreatmentEpisodes(currentClaims, allowableGap, overlapMethod, studyEnd);
    const { episodes, adjustedClaims, stats } = result;

    // Update statistics
    statEpisodes.textContent = stats.totalEpisodes;
    statMeanDuration.textContent = `${fmt(stats.meanDuration, 1)} d`;
    statSupplyDays.textContent = `${stats.totalSupplyDays} d`;
    statClosures.textContent = stats.closureCount;
    statOngoing.textContent = stats.isOngoing ? 'Yes' : 'No';

    // Badge styling & labels
    if (overlapMethod === 'stockpile') {
      badgeStatus.className = 'badge badge-blue';
      badgeStatus.textContent = 'Push-Forward Stockpiling';
    } else if (overlapMethod === 'truncate') {
      badgeStatus.className = 'badge badge-rose';
      badgeStatus.textContent = 'Truncation / Overwrite';
    } else {
      badgeStatus.className = 'badge badge-amber';
      badgeStatus.textContent = 'Parallel Concurrent';
    }

    // Dynamic Clinical Insight
    if (overlapMethod === 'stockpile') {
      const pushedClaims = adjustedClaims.filter(c => c.pushedDays > 0);
      calloutText.innerHTML = `<strong>Stockpiling Logic:</strong> ${pushedClaims.length} early refill(s) accumulated remaining supply. New fills were pushed forward by an aggregate of <strong>${pushedClaims.reduce((s, c) => s + c.pushedDays, 0)} days</strong>, preserving patient days-of-supply and preventing artificial gap closures.`;
    } else if (overlapMethod === 'truncate') {
      const truncClaims = adjustedClaims.filter(c => c.truncatedDays > 0);
      calloutText.innerHTML = `<strong>Truncation Logic:</strong> Early refills overwrote existing prescription coverage. A total of <strong>${truncClaims.reduce((s, c) => s + c.truncatedDays, 0)} supply days</strong> were discarded upon earlier refills, assuming dose adjustment or discarded medication.`;
    } else {
      calloutText.innerHTML = `<strong>Parallel Mode:</strong> Fills are plotted without adjustment, resulting in concurrent coverage periods during early refill intervals.`;
    }

    // Populate Table
    let tableHtml = '';
    adjustedClaims.forEach((claim, idx) => {
      const origEnd = claim.startDay + claim.daysSupply;
      let actionText = '<span style="color: var(--muted-foreground);">Normal</span>';
      if (claim.pushedDays > 0) {
        actionText = `<span style="color: var(--chart-blue); font-weight: 500;">Pushed +${claim.pushedDays}d</span>`;
      } else if (claim.truncatedDays > 0) {
        actionText = `<span style="color: var(--chart-rose); font-weight: 500;">Truncated -${claim.truncatedDays}d</span>`;
      }

      // Check which episode it belongs to
      const ep = episodes.find(e => e.claims.some(c => c.id === claim.id));
      const epLabel = ep ? `<span class="badge badge-emerald" style="font-size: 0.75rem;">${ep.id}</span>` : '—';

      // Gap to prior
      let gapText = '—';
      if (idx > 0) {
        const prev = adjustedClaims[idx - 1];
        const gap = claim.effectiveStart - prev.effectiveEnd;
        if (gap > 0) {
          gapText = gap <= allowableGap ? `<span style="color: var(--chart-amber);">${gap}d (Bridged)</span>` : `<span style="color: var(--chart-rose); font-weight: 600;">${gap}d (Exceeded)</span>`;
        } else if (gap < 0) {
          gapText = `<span style="color: var(--chart-blue);">${Math.abs(gap)}d Overlap</span>`;
        } else {
          gapText = '<span style="color: var(--chart-emerald);">0d (Seamless)</span>';
        }
      }

      tableHtml += `
        <tr>
          <td>#${claim.id}</td>
          <td>Day ${claim.startDay}</td>
          <td>${claim.daysSupply} days</td>
          <td>Day ${claim.startDay} – ${origEnd}</td>
          <td>${actionText}</td>
          <td>Day ${claim.effectiveStart} – ${claim.effectiveEnd}</td>
          <td>${gapText}</td>
          <td>${epLabel}</td>
        </tr>
      `;
    });
    claimsTableBody.innerHTML = tableHtml;

    // Render Plotly Timeline Chart
    renderPlotlyTimeline(adjustedClaims, episodes, studyEnd, allowableGap);
  }

  function renderPlotlyTimeline(claims, episodes, studyEnd, allowableGap) {
    const shapes = [];
    const annotations = [];

    // Track 2: Raw Dispensing Claims (Discreet pills)
    claims.forEach((claim, idx) => {
      const origStart = claim.startDay;
      const origEnd = claim.startDay + claim.daysSupply;
      const effStart = claim.effectiveStart;
      const effEnd = claim.effectiveEnd;

      // Original dispense bar (subtle outline)
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: origStart,
        x1: origEnd,
        y0: 1.65,
        y1: 2.15,
        fillcolor: 'rgba(56, 189, 248, 0.15)',
        line: { color: '#38bdf8', width: 1.5, dash: (claim.pushedDays > 0 ? 'dot' : 'solid') }
      });

      // Label for claim
      annotations.push({
        x: (origStart + origEnd) / 2,
        y: 1.9,
        text: `Rx #${claim.id} (${claim.daysSupply}d)`,
        showarrow: false,
        font: { color: '#fafafa', size: 10, family: 'Geist Mono, monospace' }
      });

      // If pushed, show pushed arrow/bar
      if (claim.pushedDays > 0) {
        shapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'y',
          x0: effStart,
          x1: effEnd,
          y0: 1.05,
          y1: 1.45,
          fillcolor: 'rgba(168, 85, 247, 0.25)',
          line: { color: '#a855f7', width: 1.5 }
        });
        annotations.push({
          x: (effStart + effEnd) / 2,
          y: 1.25,
          text: `Shifted (+${claim.pushedDays}d)`,
          showarrow: false,
          font: { color: '#c084fc', size: 9, family: 'Geist Mono, monospace' }
        });
      }
    });

    // Track 0: Resulting Episodes
    episodes.forEach(ep => {
      const isCensored = ep.censored;
      const color = isCensored ? '#10b981' : '#3b82f6';
      const fillColor = isCensored ? 'rgba(16, 185, 129, 0.28)' : 'rgba(59, 130, 246, 0.28)';

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: ep.startDay,
        x1: ep.endDay,
        y0: 0.15,
        y1: 0.75,
        fillcolor: fillColor,
        line: { color: color, width: 2 }
      });

      annotations.push({
        x: (ep.startDay + ep.endDay) / 2,
        y: 0.45,
        text: `<b>${ep.id}</b> &middot; ${ep.duration} days (${ep.claimsCount} fills)`,
        showarrow: false,
        font: { color: '#fafafa', size: 11, family: 'Geist, sans-serif' }
      });

      // Closure reason marker
      if (!isCensored) {
        annotations.push({
          x: ep.endDay,
          y: 0.85,
          text: `▲ Discontinued`,
          showarrow: false,
          font: { color: '#f43f5e', size: 10, family: 'Geist, sans-serif' }
        });
      }
    });

    // Vertical Observation Window End Line (Censoring)
    shapes.push({
      type: 'line',
      xref: 'x',
      yref: 'paper',
      x0: studyEnd,
      x1: studyEnd,
      y0: 0,
      y1: 1,
      line: { color: '#ef4444', width: 2, dash: 'dash' }
    });

    annotations.push({
      x: studyEnd,
      y: 2.3,
      text: `End of Study (Day ${studyEnd})`,
      showarrow: false,
      font: { color: '#f87171', size: 10 }
    });

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 25, r: 25, b: 40, l: 150 },
      shapes: shapes,
      annotations: annotations,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Timeline (Days from Index Rx Claim)',
        range: [-15, Math.max(studyEnd + 30, 400)],
        dtick: 30
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        range: [-0.1, 2.5],
        tickvals: [0.45, 1.25, 1.9],
        ticktext: ['<b>Resulting Episode</b>', 'Adjusted Supply', '<b>Raw Dispense Claims</b>'],
        showgrid: false
      },
      showlegend: false
    };

    // Empty trace to anchor Plotly
    const data = [{
      x: [0],
      y: [0],
      type: 'scatter',
      mode: 'markers',
      marker: { opacity: 0 }
    }];

    Plotly.react('chart-timeline', data, layout, { responsive: true, displayModeBar: false });
  }

  // Event Listeners
  scenarioSelect.addEventListener('change', () => {
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    render();
  });

  overlapSelect.addEventListener('change', render);
  gapSlider.addEventListener('input', render);
  windowSlider.addEventListener('input', render);

  btnReset.addEventListener('click', () => {
    gapSlider.value = 30;
    overlapSelect.value = 'stockpile';
    windowSlider.value = 365;
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    render();
  });

  btnAddClaim.addEventListener('click', () => {
    const lastClaim = currentClaims[currentClaims.length - 1];
    const newStart = lastClaim ? lastClaim.startDay + 35 : 0;
    const newClaim = {
      id: currentClaims.length + 1,
      startDay: newStart,
      daysSupply: 30,
      drug: 'Target Rx'
    };
    currentClaims.push(newClaim);
    render();
  });

  // Initial render
  render();
}
