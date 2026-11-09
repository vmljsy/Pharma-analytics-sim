/**
 * Treatment Persistence & Kaplan-Meier Survival Analysis Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT, computeKaplanMeier } from '../../js/common.js';

export default function init() {
  const gapSlider = $('gap-slider');
  const gapVal = $('gap-val');
  const cohortSlider = $('cohort-slider');
  const cohortVal = $('cohort-val');
  const censorSlider = $('censor-slider');
  const censorVal = $('censor-val');
  const toggleCi = $('toggle-ci');
  const toggleCensorTicks = $('toggle-censor-ticks');

  const gapBadge = $('gap-badge');
  const statBrandMedian = $('stat-brand-median');
  const statCompMedian = $('stat-comp-median');
  const statBrand12m = $('stat-brand-12m');
  const statComp12m = $('stat-comp-12m');
  const statHazardRatio = $('stat-hazard-ratio');
  const atriskTableBody = $('atrisk-table-body');
  const kmInsightText = $('km-insight-text');

  // Pre-generate patient profiles with temporary gap risks
  let patientCache = null;

  function generatePatients(N, censorRate) {
    const brand = [];
    const comp = [];

    // Seeded-like reproducible generation
    for (let i = 0; i < N; i++) {
      // Brand: higher base retention (mean ~ 300 days)
      const u1 = Math.random();
      const baseDisconBrand = Math.min(365, Math.round(-Math.log(1 - u1 * 0.75) * 280));
      // Brand patients experience occasional refill gaps (e.g. 20-55 days)
      const brandGap = Math.round(20 + Math.random() * 40);
      const isCensoredBrand = Math.random() < (censorRate / 100);

      brand.push({
        id: i,
        baseTime: baseDisconBrand,
        intermediateGap: brandGap,
        gapOccurredAt: Math.round(baseDisconBrand * 0.4),
        isCensored: isCensoredBrand
      });

      // Competitor: lower retention (mean ~ 180 days)
      const u2 = Math.random();
      const baseDisconComp = Math.min(365, Math.round(-Math.log(1 - u2 * 0.85) * 190));
      const compGap = Math.round(25 + Math.random() * 45);
      const isCensoredComp = Math.random() < (censorRate / 100);

      comp.push({
        id: i,
        baseTime: baseDisconComp,
        intermediateGap: compGap,
        gapOccurredAt: Math.round(baseDisconComp * 0.4),
        isCensored: isCensoredComp
      });
    }

    return { brand, comp };
  }

  function render() {
    const allowableGap = parseInt(gapSlider.value, 10);
    const N = parseInt(cohortSlider.value, 10);
    const censorRate = parseInt(censorSlider.value, 10);
    const showCi = toggleCi.checked;
    const showTicks = toggleCensorTicks.checked;

    gapVal.textContent = `${allowableGap} days`;
    cohortVal.textContent = `${N}`;
    censorVal.textContent = `${censorRate}%`;
    gapBadge.textContent = `Gap Rule: ${allowableGap}-Day Allowance`;

    // Regenerate cache if N or censorRate changed
    if (!patientCache || patientCache.brand.length !== N) {
      patientCache = generatePatients(N, censorRate);
    }

    // Process patient survival times under current allowableGap rule
    const processCohort = (patients) => {
      return patients.map(p => {
        let eventTime = p.baseTime;
        let eventType = p.isCensored ? 0 : 1;

        // If intermediate refill gap exceeded allowable gap, patient discontinued early at the gap!
        if (p.intermediateGap > allowableGap && p.gapOccurredAt < eventTime) {
          eventTime = p.gapOccurredAt;
          eventType = 1; // Discontinued due to gap
        }

        // End of study censoring at Day 365
        if (eventTime >= 365) {
          eventTime = 365;
          eventType = 0; // Censored
        }

        return { time: eventTime, event: eventType };
      });
    };

    const brandData = processCohort(patientCache.brand);
    const compData = processCohort(patientCache.comp);

    const kmBrand = computeKaplanMeier(brandData);
    const kmComp = computeKaplanMeier(compData);

    // Calculate 12-month persistence
    const brand12m = kmBrand.survival[kmBrand.survival.length - 1] * 100;
    const comp12m = kmComp.survival[kmComp.survival.length - 1] * 100;

    statBrandMedian.textContent = `${kmBrand.median} d`;
    statCompMedian.textContent = `${kmComp.median} d`;
    statBrand12m.textContent = fmtPct(brand12m, 1);
    statComp12m.textContent = fmtPct(comp12m, 1);

    // Hazard Ratio approximation
    const brandEvents = brandData.filter(d => d.event === 1).length;
    const compEvents = compData.filter(d => d.event === 1).length;
    const hr = compEvents > 0 ? (brandEvents / compEvents) * 0.95 : 0.70;
    statHazardRatio.textContent = fmt(hr, 2);

    // Update Domain Insight
    kmInsightText.innerHTML = `
      <strong>Gap Sensitivity Impact:</strong> At <strong>${allowableGap} days</strong> allowable gap, Target Brand shows 
      <strong>${fmt(kmBrand.median, 0)} days</strong> median persistence vs <strong>${fmt(kmComp.median, 0)} days</strong> for Competitor SoC 
      (HR = <strong>${fmt(hr, 2)}</strong>). Widening the permissible gap allows temporary supply interruptions to be bridged, shifting the Kaplan-Meier curve upward.
    `;

    // Populate At-Risk Table
    const milestones = [0, 90, 180, 270, 365];
    const getAtRiskAt = (km, t) => {
      for (let i = km.times.length - 1; i >= 0; i--) {
        if (km.times[i] <= t) {
          const atRisk = Math.round(km.survival[i] * N);
          return Math.max(0, atRisk);
        }
      }
      return N;
    };

    atriskTableBody.innerHTML = `
      <tr>
        <td style="color: #38bdf8; font-weight: 600;">Target Brand</td>
        ${milestones.map(t => `<td>${getAtRiskAt(kmBrand, t)}</td>`).join('')}
        <td style="color: #f43f5e;">${brandEvents}</td>
        <td style="color: #a1a1aa;">${N - brandEvents}</td>
      </tr>
      <tr>
        <td style="color: #f59e0b; font-weight: 600;">Competitor SoC</td>
        ${milestones.map(t => `<td>${getAtRiskAt(kmComp, t)}</td>`).join('')}
        <td style="color: #f43f5e;">${compEvents}</td>
        <td style="color: #a1a1aa;">${N - compEvents}</td>
      </tr>
    `;

    // Plotly Chart
    renderPlotlyKM(kmBrand, kmComp, brandData, compData, showCi, showTicks);
  }

  function renderPlotlyKM(kmBrand, kmComp, brandData, compData, showCi, showTicks) {
    const traces = [];

    // 1. Target Brand Curve
    traces.push({
      x: kmBrand.times,
      y: kmBrand.survival,
      type: 'scatter',
      mode: 'lines',
      name: 'Target Brand',
      line: { color: '#38bdf8', width: 2.5, shape: 'hv' }
    });

    // Brand CI Band
    if (showCi) {
      traces.push({
        x: kmBrand.times.concat([...kmBrand.times].reverse()),
        y: kmBrand.upperCI.concat([...kmBrand.lowerCI].reverse()),
        fill: 'toself',
        fillcolor: 'rgba(56, 189, 248, 0.12)',
        line: { color: 'transparent' },
        name: 'Brand 95% CI',
        showlegend: false,
        hoverinfo: 'skip'
      });
    }

    // 2. Competitor Curve
    traces.push({
      x: kmComp.times,
      y: kmComp.survival,
      type: 'scatter',
      mode: 'lines',
      name: 'Competitor SoC',
      line: { color: '#f59e0b', width: 2.5, shape: 'hv' }
    });

    // Comp CI Band
    if (showCi) {
      traces.push({
        x: kmComp.times.concat([...kmComp.times].reverse()),
        y: kmComp.upperCI.concat([...kmComp.lowerCI].reverse()),
        fill: 'toself',
        fillcolor: 'rgba(245, 158, 11, 0.10)',
        line: { color: 'transparent' },
        name: 'Comp 95% CI',
        showlegend: false,
        hoverinfo: 'skip'
      });
    }

    // 3. Censored Ticks
    if (showTicks) {
      const censoredBrand = brandData.filter(d => d.event === 0);
      const censoredComp = compData.filter(d => d.event === 0);

      // Find survival height for each censored time
      const getSurv = (km, t) => {
        for (let i = km.times.length - 1; i >= 0; i--) {
          if (km.times[i] <= t) return km.survival[i];
        }
        return 1.0;
      };

      traces.push({
        x: censoredBrand.map(d => d.time),
        y: censoredBrand.map(d => getSurv(kmBrand, d.time)),
        type: 'scatter',
        mode: 'markers',
        name: 'Brand Censored (+)',
        marker: { symbol: 'cross-thin', size: 7, color: '#38bdf8', line: { width: 1.5, color: '#38bdf8' } }
      });

      traces.push({
        x: censoredComp.map(d => d.time),
        y: censoredComp.map(d => getSurv(kmComp, d.time)),
        type: 'scatter',
        mode: 'markers',
        name: 'Comp Censored (+)',
        marker: { symbol: 'cross-thin', size: 7, color: '#f59e0b', line: { width: 1.5, color: '#f59e0b' } }
      });
    }

    // Layout with 50% Median Line
    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 30, r: 25, b: 45, l: 60 },
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Time Since Initiation (Days)',
        range: [0, 370],
        dtick: 60
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Probability of Treatment Persistence S(t)',
        range: [0, 1.05],
        tickformat: '.0%'
      },
      shapes: [
        {
          type: 'line',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          x1: 1,
          y0: 0.5,
          y1: 0.5,
          line: { color: '#52525b', width: 1.5, dash: 'dash' }
        }
      ],
      annotations: [
        {
          xref: 'paper',
          yref: 'y',
          x: 0.98,
          y: 0.52,
          text: '50% Median Persistence',
          showarrow: false,
          font: { color: '#a1a1aa', size: 10, family: 'Geist Mono, monospace' }
        }
      ],
      legend: {
        x: 0.72,
        y: 0.95,
        bgcolor: 'rgba(9, 9, 11, 0.85)',
        bordercolor: '#27272a',
        borderwidth: 1
      }
    };

    Plotly.react('chart-km', traces, layout, { responsive: true, displayModeBar: false });
  }

  // Event Listeners
  gapSlider.addEventListener('input', render);
  cohortSlider.addEventListener('input', () => { patientCache = null; render(); });
  censorSlider.addEventListener('input', () => { patientCache = null; render(); });
  toggleCi.addEventListener('change', render);
  toggleCensorTicks.addEventListener('change', render);

  // Initial render
  render();
}
