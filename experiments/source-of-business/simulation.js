/**
 * Source of Business (SoB) Dynamics Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT, classifySourceOfBusiness } from '../../js/common.js';

// 8 Rich Longitudinal Patient Journey Profiles
const PATIENT_PROFILES = [
  {
    id: 'P001',
    label: 'P001: True Naive Starter',
    description: 'Zero claims in lookback window',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 240, daysSupply: 30 },
    ]
  },
  {
    id: 'P002',
    label: 'P002: Competitor A Switch-In',
    description: 'Discontinued Comp A 40d ago',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Competitor A', startDay: 80, daysSupply: 30 },
      { drug: 'Competitor A', startDay: 110, daysSupply: 30 }, // Ends day 140 -> gap to 180 = 40d
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
    ]
  },
  {
    id: 'P003',
    label: 'P003: Brand Alpha Restart',
    description: 'Prior brand use with 150d gap',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Brand Alpha', startDay: 0, daysSupply: 30 }, // Ends day 30 -> gap to 180 = 150d
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
    ]
  },
  {
    id: 'P004',
    label: 'P004: Add-On Combination',
    description: 'Ongoing Comp B concurrent therapy',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Competitor B', startDay: 90, daysSupply: 60 },
      { drug: 'Competitor B', startDay: 150, daysSupply: 60 }, // Active through day 210!
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 }, // Initiated on top of Comp B
      { drug: 'Competitor B', startDay: 210, daysSupply: 60 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
    ]
  },
  {
    id: 'P005',
    label: 'P005: Continuing Maintenance',
    description: 'Continuous fills of Brand Alpha',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Brand Alpha', startDay: 90, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 120, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 150, daysSupply: 30 }, // Ends day 180 -> 0 gap
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
    ]
  },
  {
    id: 'P006',
    label: 'P006: Comp B Switch-In',
    description: 'Discontinued Comp B 25d ago',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Competitor B', startDay: 95, daysSupply: 30 },
      { drug: 'Competitor B', startDay: 125, daysSupply: 30 }, // Ends day 155 -> gap = 25d
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
    ]
  },
  {
    id: 'P007',
    label: 'P007: Experienced Naive',
    description: 'Old Comp A use (gap > switch window)',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Competitor A', startDay: 20, daysSupply: 30 }, // Ends day 50 -> gap to 180 = 130d
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
    ]
  },
  {
    id: 'P008',
    label: 'P008: Borderline Maintenance / Restart',
    description: 'Brand gap of 75 days',
    indexDay: 180,
    targetBrand: 'Brand Alpha',
    claims: [
      { drug: 'Brand Alpha', startDay: 75, daysSupply: 30 }, // Ends day 105 -> gap to 180 = 75d
      { drug: 'Brand Alpha', startDay: 180, daysSupply: 30 },
      { drug: 'Brand Alpha', startDay: 210, daysSupply: 30 },
    ]
  }
];

export default function init() {
  let activePatientId = 'P001';

  // DOM Elements
  const lookbackSlider = $('lookback-slider');
  const lookbackVal = $('lookback-val');
  const switchSlider = $('switch-slider');
  const switchVal = $('switch-val');
  const restartSlider = $('restart-slider');
  const restartVal = $('restart-val');
  const marketPreset = $('market-preset');

  const shareNtb = $('share-ntb');
  const shareSwitch = $('share-switch');
  const shareAddon = $('share-addon');
  const shareRestart = $('share-restart');
  const shareCont = $('share-cont');

  const pillsContainer = $('patient-pills-container');
  const inspectorBadge = $('inspector-badge');
  const inspectorRationale = $('inspector-rationale');

  // Build Patient Selection Pills
  pillsContainer.innerHTML = '';
  PATIENT_PROFILES.forEach(p => {
    const btn = document.createElement('button');
    btn.className = `patient-pill ${p.id === activePatientId ? 'active' : ''}`;
    btn.id = `pill-${p.id}`;
    btn.textContent = p.id;
    btn.title = p.label;
    btn.addEventListener('click', () => {
      activePatientId = p.id;
      document.querySelectorAll('.patient-pill').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
    pillsContainer.appendChild(btn);
  });

  function render() {
    const lookbackDays = parseInt(lookbackSlider.value, 10);
    const switchDays = parseInt(switchSlider.value, 10);
    const restartDays = parseInt(restartSlider.value, 10);
    const market = marketPreset.value;

    lookbackVal.textContent = `${lookbackDays} days`;
    switchVal.textContent = `${switchDays} days`;
    restartVal.textContent = `${restartDays} days`;

    // 1. Evaluate Population Distribution based on market preset & parameters
    const pop = computePopulationShares(market, lookbackDays, switchDays, restartDays);
    shareNtb.textContent = fmtPct(pop.ntb, 1);
    shareSwitch.textContent = fmtPct(pop.switchIn, 1);
    shareAddon.textContent = fmtPct(pop.addon, 1);
    shareRestart.textContent = fmtPct(pop.restart, 1);
    shareCont.textContent = fmtPct(pop.cont, 1);

    // Render Sankey / Flow Chart
    renderSankeyChart(pop);

    // 2. Evaluate currently selected patient
    const patient = PATIENT_PROFILES.find(p => p.id === activePatientId);
    const result = classifySourceOfBusiness(
      patient.claims,
      patient.targetBrand,
      patient.indexDay,
      lookbackDays,
      switchDays,
      restartDays
    );

    inspectorBadge.className = `badge ${result.badgeClass}`;
    inspectorBadge.textContent = `${patient.id}: ${result.category}`;
    inspectorRationale.innerHTML = `<strong>Domain Evaluation:</strong> ${result.rationale}`;

    // Render Patient Journey Swimmer Plot
    renderPatientJourney(patient, result, lookbackDays);
  }

  function computePopulationShares(market, lookback, switchGap, restartGap) {
    // Model how changing lookback, switch window, and restart threshold alters market share
    // E.g. Wider lookback window detects more prior competitor/brand claims -> reduces true naive!
    const lookbackFactor = (lookback - 90) / (365 - 90); // 0 to 1
    const switchFactor = (switchGap - 15) / (120 - 15);
    const restartFactor = (restartGap - 45) / (180 - 45);

    let baseNtb, baseSwitch, baseAddon, baseRestart, baseCont;

    if (market === 'launch') {
      baseNtb = 45 - 15 * lookbackFactor;
      baseSwitch = 30 + 10 * switchFactor;
      baseAddon = 15;
      baseRestart = 2 + 5 * (1 - restartFactor);
      baseCont = 8;
    } else if (market === 'mature') {
      baseNtb = 15 - 5 * lookbackFactor;
      baseSwitch = 15 + 5 * switchFactor;
      baseAddon = 15;
      baseRestart = 15 + 10 * (1 - restartFactor);
      baseCont = 40;
    } else {
      // Balanced
      baseNtb = 30 - 10 * lookbackFactor;
      baseSwitch = 22 + 8 * switchFactor;
      baseAddon = 16;
      baseRestart = 12 + 6 * (1 - restartFactor);
      baseCont = 20;
    }

    const total = baseNtb + baseSwitch + baseAddon + baseRestart + baseCont;
    return {
      ntb: (baseNtb / total) * 100,
      switchIn: (baseSwitch / total) * 100,
      addon: (baseAddon / total) * 100,
      restart: (baseRestart / total) * 100,
      cont: (baseCont / total) * 100
    };
  }

  function renderSankeyChart(pop) {
    // Sankey Nodes:
    // 0: Prior Naive Pool
    // 1: Prior Competitor Pool
    // 2: Prior Brand Pool
    // 3: New to Brand (Naive)
    // 4: Switch-In
    // 5: Add-On Combo
    // 6: Brand Restarts
    // 7: Continuing Maintenance

    const data = [{
      type: "sankey",
      orientation: "h",
      node: {
        pad: 15,
        thickness: 18,
        line: { color: "#27272a", width: 1 },
        label: [
          "No Prior Therapy",
          "Prior Competitor",
          "Prior Brand Use",
          `Naive (${fmt(pop.ntb, 0)}%)`,
          `Switch-In (${fmt(pop.switchIn, 0)}%)`,
          `Add-On (${fmt(pop.addon, 0)}%)`,
          `Restart (${fmt(pop.restart, 0)}%)`,
          `Continuing (${fmt(pop.cont, 0)}%)`
        ],
        color: [
          "#38bdf8", "#f59e0b", "#10b981",
          "#38bdf8", "#f59e0b", "#a855f7", "#06b6d4", "#10b981"
        ]
      },
      link: {
        source: [0, 1, 1, 2, 2],
        target: [3, 4, 5, 6, 7],
        value: [pop.ntb, pop.switchIn, pop.addon, pop.restart, pop.cont],
        color: [
          "rgba(56, 189, 248, 0.3)",
          "rgba(245, 158, 11, 0.3)",
          "rgba(168, 85, 247, 0.3)",
          "rgba(6, 182, 212, 0.3)",
          "rgba(16, 185, 129, 0.3)"
        ]
      }
    }];

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 25, b: 25, l: 25 },
      font: { color: '#fafafa', family: 'Geist, sans-serif', size: 11 }
    };

    Plotly.react('chart-sob-flow', data, layout, { responsive: true, displayModeBar: false });
  }

  function renderPatientJourney(patient, result, lookbackDays) {
    const indexDay = patient.indexDay;
    const windowStart = indexDay - lookbackDays;

    const shapes = [];
    const annotations = [];

    // Shaded Lookback Window
    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: windowStart,
      x1: indexDay,
      y0: 0,
      y1: 1,
      fillcolor: 'rgba(255, 255, 255, 0.04)',
      line: { color: '#3f3f46', width: 1, dash: 'dot' }
    });

    annotations.push({
      x: (windowStart + indexDay) / 2,
      y: 1.8,
      text: `${lookbackDays}-Day Lookback Window`,
      showarrow: false,
      font: { color: '#a1a1aa', size: 10, family: 'Geist Mono, monospace' }
    });

    // Vertical Index Fill Marker
    shapes.push({
      type: 'line',
      xref: 'x',
      yref: 'paper',
      x0: indexDay,
      x1: indexDay,
      y0: 0,
      y1: 1,
      line: { color: '#38bdf8', width: 2 }
    });

    annotations.push({
      x: indexDay,
      y: 2.2,
      text: 'Index Fill Day 180',
      showarrow: false,
      font: { color: '#38bdf8', size: 10, family: 'Geist Mono, monospace' }
    });

    // Draw Claims
    patient.claims.forEach(c => {
      const isTarget = c.drug === patient.targetBrand;
      const yPos = isTarget ? 0.6 : 1.3;
      const barColor = isTarget ? '#38bdf8' : '#f59e0b';
      const fillColor = isTarget ? 'rgba(56, 189, 248, 0.3)' : 'rgba(245, 158, 11, 0.3)';

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: c.startDay,
        x1: c.startDay + c.daysSupply,
        y0: yPos - 0.25,
        y1: yPos + 0.25,
        fillcolor: fillColor,
        line: { color: barColor, width: 1.5 }
      });

      annotations.push({
        x: c.startDay + c.daysSupply / 2,
        y: yPos,
        text: `${c.drug} (${c.daysSupply}d)`,
        showarrow: false,
        font: { color: '#fafafa', size: 10, family: 'Geist, sans-serif' }
      });
    });

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 25, r: 25, b: 35, l: 140 },
      shapes: shapes,
      annotations: annotations,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Timeline (Days)',
        range: [-15, 300],
        dtick: 30
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        range: [0, 2.4],
        tickvals: [0.6, 1.3],
        ticktext: ['<b>Target Brand</b>', '<b>Competitor Rx</b>'],
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

    Plotly.react('chart-patient-journey', dummyTrace, layout, { responsive: true, displayModeBar: false });
  }

  // Event Listeners
  lookbackSlider.addEventListener('input', render);
  switchSlider.addEventListener('input', render);
  restartSlider.addEventListener('input', render);
  marketPreset.addEventListener('change', render);

  // Initial render
  render();
}
