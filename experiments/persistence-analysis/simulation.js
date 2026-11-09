/**
 * Treatment Persistence, Kaplan-Meier & Parametric Survival Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT, computeKaplanMeier } from '../../js/common.js';
import { exportToCSV, serializeStateToURL, deserializeStateFromURL } from '../../js/distributions.js';

export default function init() {
  const extrapolationSelect = $('extrapolation-select');
  const cureSlider = $('cure-slider');
  const cureVal = $('cure-val');
  const gapSlider = $('gap-slider');
  const gapVal = $('gap-val');
  const cohortSlider = $('cohort-slider');
  const cohortVal = $('cohort-val');
  const censorSlider = $('censor-slider');
  const censorVal = $('censor-val');
  const toggleCi = $('toggle-ci');
  const toggleCensorTicks = $('toggle-censor-ticks');

  const btnPinCurve = $('btn-pin-curve');
  const btnExportCSV = $('btn-export-csv');

  const gapBadge = $('gap-badge');
  const statBrandMedian = $('stat-brand-median');
  const statBrandRmst = $('stat-brand-rmst');
  const statCompMedian = $('stat-comp-median');
  const statBrand12m = $('stat-brand-12m');
  const statComp12m = $('stat-comp-12m');
  const statHazardRatio = $('stat-hazard-ratio');
  const atriskTableBody = $('atrisk-table-body');
  const kmInsightText = $('km-insight-text');

  let patientCache = null;
  let pinnedCurve = null;

  // Restore URL state
  const urlState = deserializeStateFromURL();
  if (urlState.gap) gapSlider.value = urlState.gap;
  if (urlState.cohort) cohortSlider.value = urlState.cohort;
  if (urlState.censor) censorSlider.value = urlState.censor;
  if (urlState.extrap) extrapolationSelect.value = urlState.extrap;
  if (urlState.cure) cureSlider.value = urlState.cure;

  function generatePatients(N, censorRate) {
    const brand = [];
    const comp = [];

    for (let i = 0; i < N; i++) {
      const u1 = (Math.sin(i * 14.3 + 9.1) * 1000) % 1;
      const baseDisconBrand = Math.min(365, Math.round(-Math.log(1 - Math.abs(u1) * 0.75) * 280));
      const brandGap = Math.round(20 + Math.abs((Math.sin(i * 3.3 + 1.2) * 1000) % 1) * 40);
      const isCensoredBrand = Math.abs((Math.sin(i * 7.7 + 5.5) * 1000) % 1) < (censorRate / 100);

      brand.push({
        id: i,
        baseTime: baseDisconBrand,
        intermediateGap: brandGap,
        gapOccurredAt: Math.round(baseDisconBrand * 0.4),
        isCensored: isCensoredBrand
      });

      const u2 = (Math.cos(i * 11.2 + 4.3) * 1000) % 1;
      const baseDisconComp = Math.min(365, Math.round(-Math.log(1 - Math.abs(u2) * 0.85) * 190));
      const compGap = Math.round(25 + Math.abs((Math.cos(i * 5.1 + 8.2) * 1000) % 1) * 45);
      const isCensoredComp = Math.abs((Math.cos(i * 9.9 + 2.1) * 1000) % 1) < (censorRate / 100);

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
    const extrapMode = extrapolationSelect.value;
    const cureFrac = parseInt(cureSlider.value, 10) / 100;
    const showCi = toggleCi.checked;
    const showTicks = toggleCensorTicks.checked;

    gapVal.textContent = `${allowableGap} days`;
    cohortVal.textContent = `${N}`;
    censorVal.textContent = `${censorRate}%`;
    cureVal.textContent = `${Math.round(cureFrac * 100)}%`;
    gapBadge.textContent = `Gap Rule: ${allowableGap}-Day Allowance`;

    serializeStateToURL({
      gap: allowableGap,
      cohort: N,
      censor: censorRate,
      extrap: extrapMode,
      cure: Math.round(cureFrac * 100)
    });

    if (!patientCache || patientCache.brand.length !== N) {
      patientCache = generatePatients(N, censorRate);
    }

    const processCohort = (patients) => {
      return patients.map(p => {
        let eventTime = p.baseTime;
        let eventType = p.isCensored ? 0 : 1;

        if (p.intermediateGap > allowableGap && p.gapOccurredAt < eventTime) {
          eventTime = p.gapOccurredAt;
          eventType = 1;
        }

        if (eventTime >= 365) {
          eventTime = 365;
          eventType = 0;
        }

        return { time: Math.max(1, eventTime), event: eventType };
      });
    };

    const brandProcessed = processCohort(patientCache.brand);
    const compProcessed = processCohort(patientCache.comp);

    const kmBrand = computeKaplanMeier(brandProcessed);
    const kmComp = computeKaplanMeier(compProcessed);

    // Convert to percentage values [0, 100]
    let brandSurv = kmBrand.survival.map(s => s * 100);
    let brandLow = kmBrand.lowerCI.map(c => c * 100);
    let brandHigh = kmBrand.upperCI.map(c => c * 100);
    let compSurv = kmComp.survival.map(s => s * 100);

    // Apply Mixture Cure Model: S(t) = pi + (1 - pi)*S_u(t)
    if (cureFrac > 0) {
      brandSurv = brandSurv.map(s => cureFrac * 100 + (1 - cureFrac) * s);
      brandLow = brandLow.map(c => Math.max(0, cureFrac * 100 + (1 - cureFrac) * c));
      brandHigh = brandHigh.map(c => Math.min(100, cureFrac * 100 + (1 - cureFrac) * c));
    }

    const survival12mBrand = brandSurv[brandSurv.length - 1] || 45;
    const survival12mComp = compSurv[compSurv.length - 1] || 30;

    // RMST Calculation over 24 months (730 days)
    let rmstDays = 0;
    for (let d = 1; d <= 730; d++) {
      let survProb = 1.0;
      if (d <= 365) {
        let sIdx = kmBrand.times.findIndex(t => t >= d);
        if (sIdx === -1) sIdx = brandSurv.length - 1;
        survProb = (brandSurv[sIdx] || 50) / 100;
      } else {
        // Extrapolate past 365d
        survProb = Math.max(cureFrac, (survival12mBrand / 100) * Math.exp(-0.002 * (d - 365)));
      }
      rmstDays += survProb;
    }
    const rmstMonths = rmstDays / 30.42;

    // Update KPI Scorecard
    statBrandMedian.textContent = kmBrand.median ? `${kmBrand.median} d` : '> 365 d';
    statBrandRmst.textContent = `${fmt(rmstMonths, 1)} mos`;
    statCompMedian.textContent = kmComp.median ? `${kmComp.median} d` : '> 365 d';
    statBrand12m.textContent = fmtPct(survival12mBrand, 1);
    statComp12m.textContent = fmtPct(survival12mComp, 1);

    const hr = (100 - survival12mBrand) / (100 - survival12mComp + 1e-5);
    statHazardRatio.textContent = fmt(Math.max(0.3, Math.min(1.2, hr)), 2);

    // ─────────────────────────────────────────────────────────────
    // Plotly Traces: KM Steps & Parametric Extrapolations
    // ─────────────────────────────────────────────────────────────
    const traces = [];

    // 1. Greenwood Confidence Bands
    if (showCi) {
      traces.push({
        x: kmBrand.times,
        y: brandHigh,
        type: 'scatter',
        mode: 'lines',
        line: { width: 0, color: 'transparent' },
        showlegend: false,
        hoverinfo: 'skip'
      });
      traces.push({
        x: kmBrand.times,
        y: brandLow,
        type: 'scatter',
        mode: 'lines',
        fill: 'tonexty',
        fillcolor: 'rgba(56, 189, 248, 0.12)',
        line: { width: 0, color: 'transparent' },
        name: 'Brand 95% Greenwood Band',
        hoverinfo: 'skip'
      });
    }

    // 2. Main Step Survival Curves
    traces.push(
      {
        x: kmBrand.times,
        y: brandSurv,
        type: 'scatter',
        mode: 'lines',
        line: { shape: 'hv', color: '#38bdf8', width: 2.8 },
        name: `Brand Alpha (12M: ${fmtPct(survival12mBrand, 1)})`
      },
      {
        x: kmComp.times,
        y: compSurv,
        type: 'scatter',
        mode: 'lines',
        line: { shape: 'hv', color: '#f59e0b', width: 2.2 },
        name: `Competitor Beta (12M: ${fmtPct(survival12mComp, 1)})`
      }
    );

    // 3. Parametric Survival Extrapolations past 365 days up to 730 days (24M)
    const extrapX = [];
    for (let t = 0; t <= 730; t += 10) extrapX.push(t);

    if (extrapMode === 'weibull' || extrapMode === 'all_parametric') {
      // Weibull: S(t) = exp(-(t / lambda)^k)
      const lambdaW = 320;
      const kW = 1.35;
      const weibullY = extrapX.map(t => (cureFrac + (1 - cureFrac) * Math.exp(-Math.pow(t / lambdaW, kW))) * 100);
      traces.push({
        x: extrapX,
        y: weibullY,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#a855f7', width: 2, dash: 'dash' },
        name: 'Weibull Extrapolation (λ=320, k=1.35)'
      });
    }

    if (extrapMode === 'loglogistic' || extrapMode === 'all_parametric') {
      // Log-Logistic: S(t) = 1 / (1 + (t / alpha)^beta)
      const alphaLL = 280;
      const betaLL = 1.6;
      const loglogY = extrapX.map(t => (cureFrac + (1 - cureFrac) * (1.0 / (1.0 + Math.pow(t / alphaLL, betaLL)))) * 100);
      traces.push({
        x: extrapX,
        y: loglogY,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#ec4899', width: 2, dash: 'dot' },
        name: 'Log-Logistic Extrapolation (α=280, β=1.6)'
      });
    }

    if (extrapMode === 'gompertz' || extrapMode === 'all_parametric') {
      // Gompertz: S(t) = exp(-(lambda/gamma) * (exp(gamma*t) - 1))
      const lambdaG = 0.0022;
      const gammaG = 0.0018;
      const gompY = extrapX.map(t => (cureFrac + (1 - cureFrac) * Math.exp(-(lambdaG / gammaG) * (Math.exp(gammaG * t) - 1))) * 100);
      traces.push({
        x: extrapX,
        y: gompY,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#10b981', width: 2, dash: 'dashdot' },
        name: 'Gompertz Extrapolation'
      });
    }

    // Overlay Pinned Ghost Trace
    if (pinnedCurve) {
      traces.push({
        x: pinnedCurve.x,
        y: pinnedCurve.y,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#a1a1aa', width: 2, dash: 'dot' },
        name: 'Pinned Baseline Reference'
      });
    }

    const maxX = (extrapMode !== 'km_only') ? 730 : 365;

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Days from Therapy Initiation (t = 0)',
        range: [0, maxX + 10]
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Persistence Probability Ŝ(t) (%)',
        range: [0, 105]
      },
      legend: {
        ...DARK_LAYOUT.legend,
        orientation: 'h',
        y: -0.22
      }
    };

    Plotly.react('chart-km', traces, layout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Numbers at Risk Table
    // ─────────────────────────────────────────────────────────────
    const getAtRisk = (cohort, t) => cohort.filter(p => p.time >= t).length;
    const intervals = [0, 90, 180, 270, 365];

    const brandRiskCounts = intervals.map(t => getAtRisk(brandProcessed, t));
    const compRiskCounts = intervals.map(t => getAtRisk(compProcessed, t));

    const brandDiscon = brandProcessed.filter(p => p.event === 1).length;
    const brandCens = brandProcessed.filter(p => p.event === 0).length;

    const compDiscon = compProcessed.filter(p => p.event === 1).length;
    const compCens = compProcessed.filter(p => p.event === 0).length;

    atriskTableBody.innerHTML = `
      <tr>
        <td style="font-weight: 600; color: #38bdf8;">Brand Alpha</td>
        ${brandRiskCounts.map(c => `<td>${c}</td>`).join('')}
        <td style="color: #f43f5e; font-weight: 600;">${brandDiscon}</td>
        <td>${brandCens}</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #f59e0b;">Competitor Beta</td>
        ${compRiskCounts.map(c => `<td>${c}</td>`).join('')}
        <td style="color: #f43f5e; font-weight: 600;">${compDiscon}</td>
        <td>${compCens}</td>
      </tr>
    `;

    // Clinical Insight Text
    kmInsightText.innerHTML = `
      <strong>Persistence Sensitivity &amp; HEOR Extrapolation:</strong> 
      Under the <strong>${allowableGap}-day allowable gap threshold</strong>, Brand Alpha exhibits a 12-month persistence of <strong>${fmtPct(kmBrand.survival12m, 1)}</strong> (RMST 24-month horizon: <strong>${fmt(rmstMonths, 1)} months</strong>). 
      ${cureFrac > 0 ? `Mixture Cure Model introduces a plateau at <strong>${fmtPct(cureFrac * 100, 0)}</strong> for permanent therapy responders.` : ''}
      ${extrapMode !== 'km_only' ? `Parametric survival curves extrapolate clinical trial evidence to 24 months for cost-effectiveness Markov health-state transitions.` : ''}
    `;
  }

  // Event Listeners
  extrapolationSelect.addEventListener('change', render);
  cureSlider.addEventListener('input', render);
  gapSlider.addEventListener('input', render);
  cohortSlider.addEventListener('input', render);
  censorSlider.addEventListener('input', render);
  toggleCi.addEventListener('change', render);
  toggleCensorTicks.addEventListener('change', render);

  btnPinCurve.addEventListener('click', () => {
    const allowableGap = parseInt(gapSlider.value, 10);
    const processCohort = (patients) => {
      return patients.map(p => {
        let eventTime = p.baseTime;
        let eventType = p.isCensored ? 0 : 1;
        if (p.intermediateGap > allowableGap && p.gapOccurredAt < eventTime) {
          eventTime = p.gapOccurredAt;
          eventType = 1;
        }
        if (eventTime >= 365) { eventTime = 365; eventType = 0; }
        return { time: Math.max(1, eventTime), event: eventType };
      });
    };
    const km = computeKaplanMeier(processCohort(patientCache.brand));
    pinnedCurve = { x: km.timeline, y: km.survival };
    btnPinCurve.textContent = '📌 Curve Pinned!';
    render();
  });

  btnExportCSV.addEventListener('click', () => {
    const records = patientCache.brand.map((p, idx) => ({
      patient_id: `PAT-BRAND-${1000 + idx}`,
      event_time_days: p.baseTime,
      intermediate_gap_days: p.intermediateGap,
      is_censored: p.isCensored ? 1 : 0,
      study_arm: 'Brand Alpha'
    }));
    exportToCSV(records, 'persistence_survival_export.csv');
  });

  render();
}
