/**
 * Line of Therapy (LoT) Sequencing Simulation
 */
import { $, fmt, DARK_LAYOUT, computeLineOfTherapy } from '../../js/common.js';

const ONCOLOGY_CASES = {
  onc1: {
    title: 'Patient ONC-01: Advanced NSCLC Triplet → 2L Docetaxel',
    agents: ['Pembrolizumab', 'Carboplatin', 'Pemetrexed', 'Docetaxel'],
    claims: [
      // 1L Triplet (Carbo dropped at Day 84; Pembro + Pemetrexed continued)
      { drug: 'Pembrolizumab', startDay: 0, daysSupply: 21 },
      { drug: 'Carboplatin', startDay: 0, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 0, daysSupply: 21 },

      { drug: 'Pembrolizumab', startDay: 21, daysSupply: 21 },
      { drug: 'Carboplatin', startDay: 21, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 21, daysSupply: 21 },

      { drug: 'Pembrolizumab', startDay: 42, daysSupply: 21 },
      { drug: 'Carboplatin', startDay: 42, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 42, daysSupply: 21 },

      { drug: 'Pembrolizumab', startDay: 63, daysSupply: 21 },
      { drug: 'Carboplatin', startDay: 63, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 63, daysSupply: 21 },

      // Maintenance Pembro + Pemetrexed (Carbo dropped due to cumulative neuropathy/toxicity)
      { drug: 'Pembrolizumab', startDay: 84, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 84, daysSupply: 21 },
      { drug: 'Pembrolizumab', startDay: 105, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 105, daysSupply: 21 },
      { drug: 'Pembrolizumab', startDay: 126, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 126, daysSupply: 21 },
      { drug: 'Pembrolizumab', startDay: 147, daysSupply: 21 },
      { drug: 'Pemetrexed', startDay: 147, daysSupply: 21 },

      // 2L Switch to Docetaxel at Day 180 following radiographic RECIST progression
      { drug: 'Docetaxel', startDay: 180, daysSupply: 21 },
      { drug: 'Docetaxel', startDay: 201, daysSupply: 21 },
      { drug: 'Docetaxel', startDay: 222, daysSupply: 21 },
      { drug: 'Docetaxel', startDay: 243, daysSupply: 21 },
      { drug: 'Docetaxel', startDay: 264, daysSupply: 21 },
    ]
  },
  onc2: {
    title: 'Patient ONC-02: HR+/HER2- Breast Cancer (CDK4/6 Combo → 2L Fulvestrant)',
    agents: ['Palbociclib', 'Letrozole', 'Fulvestrant', 'Alpelisib'],
    claims: [
      // 1L Doublet
      { drug: 'Palbociclib', startDay: 0, daysSupply: 28 },
      { drug: 'Letrozole', startDay: 0, daysSupply: 28 },
      { drug: 'Palbociclib', startDay: 28, daysSupply: 28 },
      { drug: 'Letrozole', startDay: 28, daysSupply: 28 },
      { drug: 'Palbociclib', startDay: 56, daysSupply: 28 },
      { drug: 'Letrozole', startDay: 56, daysSupply: 28 },
      { drug: 'Palbociclib', startDay: 84, daysSupply: 28 },
      { drug: 'Letrozole', startDay: 84, daysSupply: 28 },
      { drug: 'Palbociclib', startDay: 112, daysSupply: 28 },
      { drug: 'Letrozole', startDay: 112, daysSupply: 28 },
      { drug: 'Palbociclib', startDay: 140, daysSupply: 28 },
      { drug: 'Letrozole', startDay: 140, daysSupply: 28 },

      // 2L PIK3CA-directed Switch: Fulvestrant + Alpelisib
      { drug: 'Fulvestrant', startDay: 190, daysSupply: 28 },
      { drug: 'Alpelisib', startDay: 190, daysSupply: 28 },
      { drug: 'Fulvestrant', startDay: 218, daysSupply: 28 },
      { drug: 'Alpelisib', startDay: 218, daysSupply: 28 },
      { drug: 'Fulvestrant', startDay: 246, daysSupply: 28 },
      { drug: 'Alpelisib', startDay: 246, daysSupply: 28 },
    ]
  },
  onc3: {
    title: 'Patient ONC-03: Multiple Myeloma Triplet → Lenalidomide Maint → 2L Dara-Pom',
    agents: ['Bortezomib', 'Lenalidomide', 'Dexamethasone', 'Daratumumab', 'Pomalidomide'],
    claims: [
      // 1L VRd Induction (Day 0 to 84)
      { drug: 'Bortezomib', startDay: 0, daysSupply: 21 },
      { drug: 'Lenalidomide', startDay: 0, daysSupply: 21 },
      { drug: 'Dexamethasone', startDay: 0, daysSupply: 21 },

      { drug: 'Bortezomib', startDay: 21, daysSupply: 21 },
      { drug: 'Lenalidomide', startDay: 21, daysSupply: 21 },
      { drug: 'Dexamethasone', startDay: 21, daysSupply: 21 },

      { drug: 'Bortezomib', startDay: 42, daysSupply: 21 },
      { drug: 'Lenalidomide', startDay: 42, daysSupply: 21 },
      { drug: 'Dexamethasone', startDay: 42, daysSupply: 21 },

      // Maintenance Lenalidomide
      { drug: 'Lenalidomide', startDay: 84, daysSupply: 28 },
      { drug: 'Lenalidomide', startDay: 112, daysSupply: 28 },
      { drug: 'Lenalidomide', startDay: 140, daysSupply: 28 },
      { drug: 'Lenalidomide', startDay: 168, daysSupply: 28 },

      // 2L Dara-Pom-Dex at Day 220
      { drug: 'Daratumumab', startDay: 220, daysSupply: 28 },
      { drug: 'Pomalidomide', startDay: 220, daysSupply: 28 },
      { drug: 'Dexamethasone', startDay: 220, daysSupply: 28 },
      { drug: 'Daratumumab', startDay: 248, daysSupply: 28 },
      { drug: 'Pomalidomide', startDay: 248, daysSupply: 28 },
      { drug: 'Dexamethasone', startDay: 248, daysSupply: 28 },
    ]
  },
  onc4: {
    title: 'Patient ONC-04: Colorectal Cancer (FOLFOX + Bevacizumab → FOLFIRI + Cetuximab)',
    agents: ['Oxaliplatin', 'Fluorouracil', 'Bevacizumab', 'Irinotecan', 'Cetuximab'],
    claims: [
      // 1L Regimen
      { drug: 'Oxaliplatin', startDay: 0, daysSupply: 14 },
      { drug: 'Fluorouracil', startDay: 0, daysSupply: 14 },
      { drug: 'Bevacizumab', startDay: 0, daysSupply: 14 },

      { drug: 'Oxaliplatin', startDay: 14, daysSupply: 14 },
      { drug: 'Fluorouracil', startDay: 14, daysSupply: 14 },
      { drug: 'Bevacizumab', startDay: 14, daysSupply: 14 },

      { drug: 'Oxaliplatin', startDay: 28, daysSupply: 14 },
      { drug: 'Fluorouracil', startDay: 28, daysSupply: 14 },
      { drug: 'Bevacizumab', startDay: 28, daysSupply: 14 },

      { drug: 'Fluorouracil', startDay: 42, daysSupply: 14 },
      { drug: 'Bevacizumab', startDay: 42, daysSupply: 14 },
      { drug: 'Fluorouracil', startDay: 56, daysSupply: 14 },
      { drug: 'Bevacizumab', startDay: 56, daysSupply: 14 },

      // 2L Regimen
      { drug: 'Irinotecan', startDay: 120, daysSupply: 14 },
      { drug: 'Cetuximab', startDay: 120, daysSupply: 14 },
      { drug: 'Irinotecan', startDay: 134, daysSupply: 14 },
      { drug: 'Cetuximab', startDay: 134, daysSupply: 14 },
      { drug: 'Irinotecan', startDay: 148, daysSupply: 14 },
      { drug: 'Cetuximab', startDay: 148, daysSupply: 14 },
    ]
  }
};

const AGENT_COLORS = {
  'Pembrolizumab': '#38bdf8',
  'Carboplatin': '#94a3b8',
  'Pemetrexed': '#60a5fa',
  'Docetaxel': '#f43f5e',
  'Palbociclib': '#38bdf8',
  'Letrozole': '#10b981',
  'Fulvestrant': '#f59e0b',
  'Alpelisib': '#ec4899',
  'Bortezomib': '#a855f7',
  'Lenalidomide': '#38bdf8',
  'Dexamethasone': '#64748b',
  'Daratumumab': '#06b6d4',
  'Pomalidomide': '#f59e0b',
  'Oxaliplatin': '#38bdf8',
  'Fluorouracil': '#818cf8',
  'Bevacizumab': '#10b981',
  'Irinotecan': '#f59e0b',
  'Cetuximab': '#ec4899'
};

export default function init() {
  const caseSelect = $('case-select');
  const windowSlider = $('window-slider');
  const windowVal = $('window-val');
  const holidaySlider = $('holiday-slider');
  const holidayVal = $('holiday-val');
  const toggleMaintenance = $('toggle-maintenance');

  const lotCaseBadge = $('lot-case-badge');
  const statTotalLines = $('stat-total-lines');
  const stat1lDuration = $('stat-1l-duration');
  const stat2lDuration = $('stat-2l-duration');
  const statTotalHorizon = $('stat-total-horizon');
  const statProgStatus = $('stat-prog-status');

  const lotTableBody = $('lot-table-body');
  const lotCalloutText = $('lot-callout-text');

  function render() {
    const caseKey = caseSelect.value;
    const currentCase = ONCOLOGY_CASES[caseKey];
    const regimenWindow = parseInt(windowSlider.value, 10);
    const holidayGap = parseInt(holidaySlider.value, 10);
    const allowMaintenance = toggleMaintenance.checked;

    windowVal.textContent = `${regimenWindow} days`;
    holidayVal.textContent = `${holidayGap} days`;
    lotCaseBadge.textContent = currentCase.title.split(':')[0];

    // Compute Lines of Therapy
    const lines = computeLineOfTherapy(currentCase.claims, regimenWindow, holidayGap);

    // Update Statistics
    statTotalLines.textContent = `${lines.length} Line${lines.length > 1 ? 's' : ''}`;
    const l1 = lines.find(l => l.line === '1L');
    const l2 = lines.find(l => l.line === '2L');

    stat1lDuration.textContent = l1 ? `${l1.duration} d` : '—';
    stat2lDuration.textContent = l2 ? `${l2.duration} d` : '—';

    const totalDays = lines.reduce((acc, l) => acc + l.duration, 0);
    statTotalHorizon.textContent = `${totalDays} d`;
    statProgStatus.textContent = lines.length > 1 ? 'Switched to 2L' : 'Maintained 1L';
    statProgStatus.style.color = lines.length > 1 ? '#f43f5e' : '#10b981';

    // Populate Table
    let tableHtml = '';
    lines.forEach(l => {
      const badgeStyle = l.line === '1L' ? 'badge-blue' : (l.line === '2L' ? 'badge-violet' : 'badge-rose');
      tableHtml += `
        <tr>
          <td><span class="badge ${badgeStyle}">${l.line}</span></td>
          <td style="font-weight: 500; color: #fafafa;">${l.regimen}</td>
          <td>Day ${l.startDay}</td>
          <td>Day ${l.endDay}</td>
          <td>${l.duration} days</td>
          <td style="color: var(--muted-foreground);">${l.transitionReason}</td>
        </tr>
      `;
    });
    lotTableBody.innerHTML = tableHtml;

    // Callout narrative
    lotCalloutText.innerHTML = `
      <strong>Clinical Sequence Rationale:</strong> In this patient case, the ${regimenWindow}-day definition window successfully captured 
      the baseline combination regimen <strong>(${l1 ? l1.regimen : ''})</strong>. When disease progression occurred, the patient transitioned to 
      <strong>${l2 ? l2.regimen : 'maintenance'}</strong> at Day ${l2 ? l2.startDay : '—'}, establishing clear progression-free survival (PFS) boundaries for health economics models.
    `;

    // Render Swimmer Plot
    renderSwimmerPlot(currentCase, lines, regimenWindow);
  }

  function renderSwimmerPlot(currentCase, lines, regimenWindow) {
    const agents = currentCase.agents;
    const shapes = [];
    const annotations = [];

    // Top Track: Assigned Line of Therapy (y = agents.length + 0.5)
    const lotY = agents.length + 0.5;

    lines.forEach(line => {
      const is1L = line.line === '1L';
      const color = is1L ? '#3b82f6' : '#8b5cf6';
      const fill = is1L ? 'rgba(59, 130, 246, 0.35)' : 'rgba(139, 92, 246, 0.35)';

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: line.startDay,
        x1: line.endDay,
        y0: lotY - 0.35,
        y1: lotY + 0.35,
        fillcolor: fill,
        line: { color: color, width: 2 }
      });

      annotations.push({
        x: (line.startDay + line.endDay) / 2,
        y: lotY,
        text: `<b>${line.line}: ${line.regimen}</b> (${line.duration}d)`,
        showarrow: false,
        font: { color: '#fafafa', size: 11, family: 'Geist, sans-serif' }
      });
    });

    // Vertical Regimen Definition Window Shading (First 28 days of 1L)
    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: 0,
      x1: regimenWindow,
      y0: 0,
      y1: 1,
      fillcolor: 'rgba(56, 189, 248, 0.05)',
      line: { color: '#38bdf8', width: 1, dash: 'dot' }
    });

    annotations.push({
      x: regimenWindow / 2,
      y: lotY + 0.9,
      text: `${regimenWindow}d Regimen Window`,
      showarrow: false,
      font: { color: '#38bdf8', size: 9, family: 'Geist Mono, monospace' }
    });

    // Agent Dispense Tracks
    agents.forEach((agent, agentIdx) => {
      const yVal = agents.length - 1 - agentIdx;
      const agentClaims = currentCase.claims.filter(c => c.drug === agent);
      const color = AGENT_COLORS[agent] || '#38bdf8';

      agentClaims.forEach(claim => {
        shapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'y',
          x0: claim.startDay,
          x1: claim.startDay + claim.daysSupply,
          y0: yVal - 0.25,
          y1: yVal + 0.25,
          fillcolor: color,
          opacity: 0.85,
          line: { color: '#fafafa', width: 0.5 }
        });
      });
    });

    const yTicks = agents.map((_, i) => agents.length - 1 - i);
    const yLabels = [...agents];

    yTicks.push(lotY);
    yLabels.push('<b>Assigned LoT</b>');

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 30, r: 25, b: 40, l: 150 },
      shapes: shapes,
      annotations: annotations,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Timeline (Days from Index Cancer Diagnosis/Rx)',
        range: [-10, 320],
        dtick: 30
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        range: [-0.5, agents.length + 1.2],
        tickvals: yTicks,
        ticktext: yLabels,
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

    Plotly.react('chart-swimmer', dummyTrace, layout, { responsive: true, displayModeBar: false });
  }

  // Event Listeners
  caseSelect.addEventListener('change', render);
  windowSlider.addEventListener('input', render);
  holidaySlider.addEventListener('input', render);
  toggleMaintenance.addEventListener('change', render);

  // Initial render
  render();
}

