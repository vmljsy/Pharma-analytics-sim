/**
 * Brand Switching Matrix & Markov Dynamics Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT } from '../../js/common.js';

export default function init() {
  const retentionSlider = $('retention-slider');
  const retentionVal = $('retention-val');
  const intrusionSlider = $('intrusion-slider');
  const intrusionVal = $('intrusion-val');
  const churnSlider = $('churn-slider');
  const churnVal = $('churn-val');
  const initialShareSlider = $('initial-share-slider');
  const initialShareVal = $('initial-share-val');

  const marketStatusBadge = $('market-status-badge');
  const statM12Share = $('stat-m12-share');
  const statShareDelta = $('stat-share-delta');
  const statRetentionRate = $('stat-retention-rate');
  const statLeakage = $('stat-leakage');
  const statNetRatio = $('stat-net-ratio');
  const switchingCalloutText = $('switching-callout-text');

  function render() {
    const alphaRetention = parseInt(retentionSlider.value, 10) / 100;
    const intrusion = parseInt(intrusionSlider.value, 10) / 100;
    const churn = parseInt(churnSlider.value, 10) / 100;
    const s0Alpha = parseInt(initialShareSlider.value, 10) / 100;

    retentionVal.textContent = `${fmtPct(alphaRetention * 100, 0)}`;
    intrusionVal.textContent = `${fmtPct(intrusion * 100, 0)}`;
    churnVal.textContent = `${fmtPct(churn * 100, 0)}`;
    initialShareVal.textContent = `${fmtPct(s0Alpha * 100, 0)}`;

    // Build Transition Probability Matrix P (4x4)
    // States: [Brand Alpha, Comp Beta, Comp Gamma, Discontinued]
    const leakAlpha = Math.max(0, 1 - alphaRetention - churn);
    const pAlphaToBeta = leakAlpha * 0.6;
    const pAlphaToGamma = leakAlpha * 0.4;

    const pBetaToAlpha = intrusion;
    const pBetaToDiscon = churn + 0.02;
    const pBetaToGamma = 0.06;
    const pBetaRetention = Math.max(0.4, 1 - pBetaToAlpha - pBetaToDiscon - pBetaToGamma);

    const pGammaToAlpha = intrusion * 0.85;
    const pGammaToDiscon = churn + 0.03;
    const pGammaToBeta = 0.05;
    const pGammaRetention = Math.max(0.4, 1 - pGammaToAlpha - pGammaToDiscon - pGammaToBeta);

    const pDisconToAlpha = 0.03;
    const pDisconToBeta = 0.015;
    const pDisconToGamma = 0.015;
    const pDisconStay = 0.94;

    const P = [
      [alphaRetention, pAlphaToBeta, pAlphaToGamma, churn],
      [pBetaToAlpha, pBetaRetention, pBetaToGamma, pBetaToDiscon],
      [pGammaToAlpha, pGammaToBeta, pGammaRetention, pGammaToDiscon],
      [pDisconToAlpha, pDisconToBeta, pDisconToGamma, pDisconStay]
    ];

    // Initial shares
    const remShare = Math.max(0, 1 - s0Alpha);
    let s = [s0Alpha, remShare * 0.55, remShare * 0.45, 0.0];

    const months = [0];
    const trajectoryAlpha = [s[0] * 100];
    const trajectoryBeta = [s[1] * 100];
    const trajectoryGamma = [s[2] * 100];
    const trajectoryDiscon = [s[3] * 100];

    // Simulate 12 Monthly Markov Steps
    for (let m = 1; m <= 12; m++) {
      const nextS = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          nextS[j] += s[i] * P[i][j];
        }
      }
      s = nextS;
      months.push(m);
      trajectoryAlpha.push(s[0] * 100);
      trajectoryBeta.push(s[1] * 100);
      trajectoryGamma.push(s[2] * 100);
      trajectoryDiscon.push(s[3] * 100);
    }

    // Active market share at Month 12 (excluding discontinued)
    const activeTotalM12 = s[0] + s[1] + s[2];
    const activeAlphaM12 = (s[0] / activeTotalM12) * 100;
    const initialActiveAlpha = (s0Alpha / 1.0) * 100;
    const delta = activeAlphaM12 - initialActiveAlpha;

    // Inflow / Outflow for Brand Alpha
    const inflowBeta = (s[1] * pBetaToAlpha) * 100;
    const inflowGamma = (s[2] * pGammaToAlpha) * 100;
    const totalInflow = inflowBeta + inflowGamma;

    const outflowBeta = (s[0] * pAlphaToBeta) * 100;
    const outflowGamma = (s[0] * pAlphaToGamma) * 100;
    const outflowDiscon = (s[0] * churn) * 100;
    const totalOutflow = outflowBeta + outflowGamma;

    const netSwitch = totalInflow - totalOutflow;
    const netRatio = totalOutflow > 0 ? totalInflow / totalOutflow : 1.5;

    // Update Scorecard
    statM12Share.textContent = fmtPct(activeAlphaM12, 1);
    statShareDelta.textContent = `${delta >= 0 ? '+' : ''}${fmt(delta, 1)}%`;
    statShareDelta.style.color = delta >= 0 ? '#10b981' : '#f43f5e';
    statRetentionRate.textContent = fmtPct(alphaRetention * 100, 1);
    statLeakage.textContent = fmtPct(leakAlpha * 100, 1);
    statNetRatio.textContent = `${fmt(netRatio, 2)}x`;
    statNetRatio.style.color = netRatio >= 1.0 ? '#10b981' : '#f43f5e';

    if (netSwitch >= 0) {
      marketStatusBadge.className = 'badge badge-emerald';
      marketStatusBadge.textContent = `Net Inflow Positive (+${fmt(netSwitch, 1)}%)`;
    } else {
      marketStatusBadge.className = 'badge badge-rose';
      marketStatusBadge.textContent = `Net Leakage Negative (${fmt(netSwitch, 1)}%)`;
    }

    switchingCalloutText.innerHTML = `
      <strong>Markov Equilibrium Insight:</strong> Brand Alpha's monthly retention of <strong>${fmtPct(alphaRetention * 100, 0)}</strong> 
      coupled with a <strong>${fmtPct(intrusion * 100, 0)}</strong> conquest rate produces an inflow/outflow ratio of <strong>${fmt(netRatio, 2)}x</strong>. 
      Over 12 months, active market share transitions from <strong>${fmtPct(initialActiveAlpha, 1)}</strong> to <strong>${fmtPct(activeAlphaM12, 1)}</strong> 
      (${delta >= 0 ? '+' : ''}${fmt(delta, 1)}% net gain).
    `;

    // Render Charts
    renderTrajectoryChart(months, trajectoryAlpha, trajectoryBeta, trajectoryGamma, trajectoryDiscon);
    renderMatrixHeatmap(P);
    renderWaterfallChart(inflowBeta, inflowGamma, outflowBeta, outflowGamma, netSwitch);
  }

  function renderTrajectoryChart(months, alpha, beta, gamma, discon) {
    const traces = [
      {
        x: months,
        y: alpha,
        name: 'Brand Alpha',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#38bdf8', width: 3 },
        marker: { size: 6 }
      },
      {
        x: months,
        y: beta,
        name: 'Comp Beta',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#fbbf24', width: 2 }
      },
      {
        x: months,
        y: gamma,
        name: 'Comp Gamma',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#a855f7', width: 2 }
      },
      {
        x: months,
        y: discon,
        name: 'Discontinued',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#71717a', width: 2, dash: 'dot' }
      }
    ];

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 25, r: 25, b: 40, l: 55 },
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Months Forward Projection',
        dtick: 1
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        title: 'Simulated Patient Share (%)',
        range: [0, Math.max(...alpha, ...beta) + 15]
      },
      legend: {
        x: 0.75,
        y: 0.95,
        bgcolor: 'rgba(9, 9, 11, 0.85)',
        bordercolor: '#27272a',
        borderwidth: 1
      }
    };

    Plotly.react('chart-market-share', traces, layout, { responsive: true, displayModeBar: false });
  }

  function renderMatrixHeatmap(P) {
    const labels = ['Alpha', 'Beta', 'Gamma', 'Discon'];
    const zValues = P.map(row => row.map(v => Math.round(v * 100)));

    const trace = {
      z: zValues,
      x: labels,
      y: labels,
      type: 'heatmap',
      colorscale: [
        [0, '#09090b'],
        [0.2, '#1e293b'],
        [0.5, '#0284c7'],
        [1.0, '#38bdf8']
      ],
      showscale: false,
      text: zValues.map(row => row.map(v => `${v}%`)),
      texttemplate: '%{text}',
      textfont: { color: '#fafafa', family: 'Geist Mono, monospace', size: 11 }
    };

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 20, b: 35, l: 60 },
      xaxis: { ...DARK_LAYOUT.xaxis, title: 'To State (t+1)' },
      yaxis: { ...DARK_LAYOUT.yaxis, title: 'From State (t)', autorange: 'reversed' }
    };

    Plotly.react('chart-matrix-heatmap', [trace], layout, { responsive: true, displayModeBar: false });
  }

  function renderWaterfallChart(inflowBeta, inflowGamma, outflowBeta, outflowGamma, netSwitch) {
    const trace = {
      type: "waterfall",
      orientation: "v",
      measure: ["relative", "relative", "relative", "relative", "total"],
      x: ["In: Beta", "In: Gamma", "Out: Beta", "Out: Gamma", "Net Switch"],
      textposition: "outside",
      text: [
        `+${fmt(inflowBeta, 1)}%`,
        `+${fmt(inflowGamma, 1)}%`,
        `-${fmt(outflowBeta, 1)}%`,
        `-${fmt(outflowGamma, 1)}%`,
        `${netSwitch >= 0 ? '+' : ''}${fmt(netSwitch, 1)}%`
      ],
      y: [inflowBeta, inflowGamma, -outflowBeta, -outflowGamma, netSwitch],
      connector: { line: { color: "#3f3f46" } },
      decreasing: { marker: { color: "#f43f5e" } },
      increasing: { marker: { color: "#10b981" } },
      totals: { marker: { color: netSwitch >= 0 ? "#38bdf8" : "#f59e0b" } }
    };

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 20, b: 35, l: 45 },
      xaxis: { ...DARK_LAYOUT.xaxis },
      yaxis: { ...DARK_LAYOUT.yaxis, title: 'Share Delta (%)' },
      showlegend: false
    };

    Plotly.react('chart-net-balance', [trace], layout, { responsive: true, displayModeBar: false });
  }

  // Event Listeners
  retentionSlider.addEventListener('input', render);
  intrusionSlider.addEventListener('input', render);
  churnSlider.addEventListener('input', render);
  initialShareSlider.addEventListener('input', render);

  // Initial render
  render();
}
