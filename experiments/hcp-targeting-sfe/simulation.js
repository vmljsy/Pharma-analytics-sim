/**
 * HCP Prescriber Concentration, Deciles & SFE Territory Alignment
 */
import {
  $,
  fmt,
  fmtPct,
  DARK_LAYOUT,
  computeLorenzAndGini,
  generateHCPUniverse,
  aggregateQuantiles,
  aggregateRegions
} from '../../js/common.js';

export default function init() {
  // Elements
  const specialtySelect = $('specialty-preset');
  const quantileModeSelect = $('quantile-mode');
  const giniSlider = $('gini-slider');
  const giniVal = $('gini-val');
  const targetCutoffSelect = $('target-cutoff-select');
  const repsSlider = $('reps-slider');
  const repsVal = $('reps-val');
  const capacitySlider = $('capacity-slider');
  const capacityVal = $('capacity-val');
  const regionFilterSelect = $('region-filter-select');

  const btnRealign = $('btn-realign-reps');
  const btnReset = $('btn-reset-sfe');

  const sfeStatusBadge = $('sfe-status-badge');
  const valGini = $('val-gini');
  const valTop20Vol = $('val-top20-vol');
  const valTopTierShare = $('val-toptier-share');
  const valRepCapacity = $('val-rep-capacity');
  const valTargetDemand = $('val-target-demand');
  const valReachPct = $('val-reach-pct');
  const valBrandShare = $('val-brand-share');
  const lorenzCrossoverText = $('lorenz-crossover-text');
  const tierTableBody = $('tier-table-body');
  const sfeCalloutText = $('sfe-callout-text');

  // Specialty Presets configuration
  const PRESETS = {
    cardiometabolic: { count: 3200, gini: 0.72, brandShare: 0.34, specialty: 'Cardiometabolic' },
    oncology: { count: 1800, gini: 0.86, brandShare: 0.28, specialty: 'Oncology / Hematology' },
    immunology: { count: 2400, gini: 0.79, brandShare: 0.31, specialty: 'Immunology' },
    rare_disease: { count: 1100, gini: 0.90, brandShare: 0.42, specialty: 'Rare Disease' }
  };

  let currentHcps = [];

  function generateData() {
    const presetKey = specialtySelect.value;
    const cfg = PRESETS[presetKey] || PRESETS.cardiometabolic;
    const gini = parseFloat(giniSlider.value);

    currentHcps = generateHCPUniverse({
      count: cfg.count,
      giniSkew: gini,
      brandBaseShare: cfg.brandShare,
      specialty: cfg.specialty
    });
  }

  function render() {
    const gini = parseFloat(giniSlider.value);
    const reps = parseInt(repsSlider.value, 10);
    const capacity = parseInt(capacitySlider.value, 10);
    const mode = quantileModeSelect.value; // 'decile' or 'quintile'
    const cutoffTier = parseInt(targetCutoffSelect.value, 10);
    const regionFilter = regionFilterSelect.value;

    giniVal.textContent = fmt(gini, 2);
    repsVal.textContent = `${reps} Reps`;
    capacityVal.textContent = `${capacity} calls`;

    // Filter HCPs if specific region selected
    const activeHcps = regionFilter === 'all' 
      ? currentHcps 
      : currentHcps.filter(h => h.region === regionFilter);

    // 1. Compute Lorenz Curve & Gini
    const volumes = activeHcps.map(h => h.marketTRx);
    const lorenz = computeLorenzAndGini(volumes);

    // 2. Aggregate Quantiles / Deciles
    const quantilesData = aggregateQuantiles(activeHcps, mode, cutoffTier);
    const tiers = quantilesData.tiers;

    // 3. Aggregate Regional Territories
    const regionalData = aggregateRegions(activeHcps, reps, capacity, cutoffTier, mode);

    // SFE Call Capacity & Demand Calculation
    const totalMonthlyCapacity = reps * capacity;
    const targetedTiers = tiers.filter(t => t.isTargeted);
    const totalTargetDemand = Math.round(targetedTiers.reduce((acc, t) => acc + t.totalTargetCalls, 0));
    const targetReachPct = totalTargetDemand > 0 
      ? Math.min(100, (totalMonthlyCapacity / totalTargetDemand) * 100) 
      : 100;

    // Update Scorecard
    valGini.textContent = fmt(lorenz.gini, 2);
    valTop20Vol.textContent = fmtPct(lorenz.top20Share, 1);
    
    const topTier = tiers[tiers.length - 1];
    valTopTierShare.textContent = topTier ? fmtPct(topTier.volumeShare, 1) : '—';
    valRepCapacity.textContent = `${totalMonthlyCapacity.toLocaleString()} calls`;
    valTargetDemand.textContent = `${totalTargetDemand.toLocaleString()} calls`;
    valReachPct.textContent = fmtPct(targetReachPct, 1);
    valBrandShare.textContent = fmtPct(quantilesData.overallBrandShare, 1);

    lorenzCrossoverText.textContent = `Top ${fmt(lorenz.crossover80DoctorPct, 1)}% HCPs write 80.0% TRx`;

    // Status Badge & Colors
    if (targetReachPct >= 90) {
      sfeStatusBadge.className = 'badge badge-emerald';
      sfeStatusBadge.textContent = `SFE Balanced (${fmtPct(targetReachPct, 0)} Target Reach)`;
      valReachPct.style.color = '#10b981';
    } else if (targetReachPct >= 75) {
      sfeStatusBadge.className = 'badge badge-amber';
      sfeStatusBadge.textContent = `Capacity Constrained (${fmtPct(targetReachPct, 0)} Target Reach)`;
      valReachPct.style.color = '#f59e0b';
    } else {
      sfeStatusBadge.className = 'badge badge-rose';
      sfeStatusBadge.textContent = `Under-Resourced (${fmtPct(targetReachPct, 0)} Reach — Rep Deficit)`;
      valReachPct.style.color = '#f43f5e';
    }

    // ─────────────────────────────────────────────────────────────
    // Chart 1: Lorenz Curve & Prescriber Concentration
    // ─────────────────────────────────────────────────────────────
    const lorenzTraces = [
      {
        x: [0, 100],
        y: [0, 100],
        mode: 'lines',
        name: 'Line of Absolute Equality (Gini = 0)',
        line: { color: '#71717a', dash: 'dash', width: 1.5 }
      },
      {
        x: lorenz.x,
        y: lorenz.y,
        mode: 'lines',
        name: `Lorenz Curve (Gini = ${fmt(lorenz.gini, 2)})`,
        fill: 'tonexty',
        fillcolor: 'rgba(56, 189, 248, 0.12)',
        line: { color: '#38bdf8', width: 2.5 }
      },
      {
        x: [100 - lorenz.crossover80DoctorPct],
        y: [20],
        mode: 'markers+text',
        name: '80/20 Pareto Inflection Point',
        text: [`80% TRx in top ${fmt(lorenz.crossover80DoctorPct, 1)}% doctors`],
        textposition: 'top left',
        textfont: { color: '#f59e0b', size: 11 },
        marker: { color: '#f59e0b', size: 10, symbol: 'diamond' }
      }
    ];

    const lorenzLayout = {
      ...DARK_LAYOUT,
      title: false,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Cumulative % of Physicians (Ranked by Volume Lowest to Highest)',
        range: [0, 100]
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Cumulative % of Prescription Volume (TRx)',
        range: [0, 100]
      },
      legend: {
        ...DARK_LAYOUT.legend,
        orientation: 'h',
        y: -0.22
      }
    };

    Plotly.react('chart-lorenz-curve', lorenzTraces, lorenzLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 2: Quantile Waterfall & Prescriber Volume Split
    // ─────────────────────────────────────────────────────────────
    const tierLabels = tiers.map(t => t.tier);
    const brandTRxArr = tiers.map(t => t.brandTRx);
    const compTRxArr = tiers.map(t => t.competitorTRx);
    const cumShareArr = tiers.map(t => t.cumVolumeShare);

    const tierTraces = [
      {
        x: tierLabels,
        y: brandTRxArr,
        name: 'Brand TRx Volume',
        type: 'bar',
        marker: { color: '#38bdf8' }
      },
      {
        x: tierLabels,
        y: compTRxArr,
        name: 'Competitor TRx Volume',
        type: 'bar',
        marker: { color: '#27272a', line: { color: '#3f3f46', width: 1 } }
      },
      {
        x: tierLabels,
        y: cumShareArr,
        name: 'Cumulative % Market Volume',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2',
        line: { color: '#10b981', width: 2.2 },
        marker: { color: '#10b981', size: 6 }
      }
    ];

    const tierLayout = {
      ...DARK_LAYOUT,
      barmode: 'stack',
      title: false,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: mode === 'decile' ? 'Prescriber Deciles (D1 Lowest → D10 Superstar)' : 'Prescriber Quintiles (Q1 → Q5)'
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Monthly Total Market Prescriptions (TRx)'
      },
      yaxis2: {
        title: 'Cumulative % Volume',
        titlefont: { color: '#10b981' },
        tickfont: { color: '#10b981' },
        overlaying: 'y',
        side: 'right',
        range: [0, 105],
        gridcolor: 'transparent'
      },
      legend: {
        ...DARK_LAYOUT.legend,
        orientation: 'h',
        y: -0.25
      }
    };

    Plotly.react('chart-tier-breakdown', tierTraces, tierLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 3: Regional Distribution & Territory Performance
    // ─────────────────────────────────────────────────────────────
    const regNames = regionalData.map(r => r.region);
    const regMarketTRx = regionalData.map(r => r.marketTRx);
    const regBrandTRx = regionalData.map(r => r.brandTRx);
    const regCoverage = regionalData.map(r => r.coveragePct);

    const regionalTraces = [
      {
        x: regNames,
        y: regMarketTRx,
        name: 'Total Market TRx',
        type: 'bar',
        marker: { color: '#3f3f46' }
      },
      {
        x: regNames,
        y: regBrandTRx,
        name: 'Brand TRx',
        type: 'bar',
        marker: { color: '#38bdf8' }
      },
      {
        x: regNames,
        y: regCoverage,
        name: 'Target Call Coverage %',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2',
        line: { color: '#f59e0b', width: 2.5 },
        marker: { color: '#f59e0b', size: 8 }
      }
    ];

    const regionalLayout = {
      ...DARK_LAYOUT,
      barmode: 'group',
      title: false,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Commercial Field Sales Territories / Regions'
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Prescription Volume (TRx)'
      },
      yaxis2: {
        title: 'Target Detailing Reach %',
        titlefont: { color: '#f59e0b' },
        tickfont: { color: '#f59e0b' },
        overlaying: 'y',
        side: 'right',
        range: [40, 110],
        gridcolor: 'transparent'
      },
      legend: {
        ...DARK_LAYOUT.legend,
        orientation: 'h',
        y: -0.25
      }
    };

    Plotly.react('chart-regional-performance', regionalTraces, regionalLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Table: Prescriber Tier Details
    // ─────────────────────────────────────────────────────────────
    tierTableBody.innerHTML = '';
    // Reverse tiers in table to show highest volume at top (D10 -> D1)
    const reversedTiers = [...tiers].reverse();

    reversedTiers.forEach(t => {
      const tr = document.createElement('tr');
      const isTarget = t.isTargeted;
      const statusBadge = isTarget 
        ? `<span class="badge badge-emerald" style="font-size: 0.6875rem;">Targeted (${t.recommendedCallsPerHCP}/mo)</span>`
        : `<span class="badge badge-secondary" style="font-size: 0.6875rem;">Omnichannel NPP</span>`;

      tr.innerHTML = `
        <td style="font-weight: 600; color: ${isTarget ? '#38bdf8' : 'var(--muted-foreground)'};">${t.tier}</td>
        <td>${t.hcpCount.toLocaleString()}</td>
        <td>${fmtPct(t.hcpPct, 1)}</td>
        <td style="font-weight: 600;">${Math.round(t.marketTRx).toLocaleString()}</td>
        <td>${fmtPct(t.volumeShare, 1)}</td>
        <td style="color: #38bdf8;">${Math.round(t.brandTRx).toLocaleString()}</td>
        <td style="font-weight: 600;">${fmtPct(t.brandShare, 1)}</td>
        <td>${fmt(t.avgTRx, 1)}</td>
        <td>${t.recommendedCallsPerHCP} calls</td>
        <td>${statusBadge}</td>
      `;
      tierTableBody.appendChild(tr);
    });

    // ─────────────────────────────────────────────────────────────
    // Callout Insight Text
    // ─────────────────────────────────────────────────────────────
    const topTierShareVal = topTier ? topTier.volumeShare : 50;
    let insightHtml = '';

    if (targetReachPct < 80) {
      const repDeficit = Math.ceil((totalTargetDemand - totalMonthlyCapacity) / capacity);
      insightHtml = `
        <strong>Field Detailing Capacity Deficit:</strong> Your current field force of <strong>${reps} sales representatives</strong> delivers ${totalMonthlyCapacity.toLocaleString()} calls/month against a target demand of ${totalTargetDemand.toLocaleString()} calls (${fmtPct(targetReachPct, 1)} reach). 
        You have a shortfall of approximately <strong>${repDeficit} FTE reps</strong> to achieve 100% reach on priority tiers. High-value prescribers in ${topTier.tier} risk under-servicing.
      `;
    } else if (targetReachPct > 115) {
      insightHtml = `
        <strong>Potential Detailing Saturation:</strong> Field capacity of ${totalMonthlyCapacity.toLocaleString()} calls exceeds recommended target tier demand (${totalTargetDemand.toLocaleString()} calls). 
        Consider reallocating surplus rep bandwidth to expand coverage into Tier ${Math.max(1, cutoffTier - 1)} or deploying digital hybrid co-promotion.
      `;
    } else {
      insightHtml = `
        <strong>Optimal Commercial Alignment:</strong> Top prescribers (${topTier.tier}) drive <strong>${fmtPct(topTierShareVal, 1)}</strong> of total therapy volume. 
        Your field force is well-calibrated with <strong>${fmtPct(targetReachPct, 1)} target reach</strong>. In high-density regions like Northeast and Southeast, prioritize sample drop-off and formulary pull-through detailing.
      `;
    }

    sfeCalloutText.innerHTML = insightHtml;
  }

  // Event Listeners
  specialtySelect.addEventListener('change', () => {
    const cfg = PRESETS[specialtySelect.value];
    if (cfg) {
      giniSlider.value = cfg.gini;
    }
    generateData();
    render();
  });

  quantileModeSelect.addEventListener('change', () => {
    const isQuintile = quantileModeSelect.value === 'quintile';
    // Adjust cutoff options
    if (isQuintile) {
      targetCutoffSelect.innerHTML = `
        <option value="4" selected>Target Top 2 Tiers (Q4 - Q5)</option>
        <option value="3">Target Top 3 Tiers (Q3 - Q5)</option>
        <option value="1">Target All Tiers (Full Universe)</option>
      `;
    } else {
      targetCutoffSelect.innerHTML = `
        <option value="8">Target Top 3 Tiers (High Concentration)</option>
        <option value="7" selected>Target Top 4 Tiers (Balanced Reach)</option>
        <option value="5">Target Top 6 Tiers (Broad Coverage)</option>
        <option value="1">Target All Tiers (Full Universe)</option>
      `;
    }
    render();
  });

  giniSlider.addEventListener('input', () => {
    generateData();
    render();
  });

  repsSlider.addEventListener('input', render);
  capacitySlider.addEventListener('input', render);
  targetCutoffSelect.addEventListener('change', render);
  regionFilterSelect.addEventListener('change', render);

  btnRealign.addEventListener('click', () => {
    repsSlider.value = Math.min(150, parseInt(repsSlider.value, 10) + 15);
    render();
  });

  btnReset.addEventListener('click', () => {
    specialtySelect.value = 'cardiometabolic';
    quantileModeSelect.value = 'decile';
    giniSlider.value = '0.76';
    repsSlider.value = '65';
    capacitySlider.value = '110';
    targetCutoffSelect.value = '7';
    regionFilterSelect.value = 'all';
    generateData();
    render();
  });

  // Initial Run
  generateData();
  render();
}

