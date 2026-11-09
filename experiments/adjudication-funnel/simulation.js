/**
 * Payer Formulary Adjudication Funnel & Prior Auth (PA) Simulation
 */
import { $, fmt, fmtPct, DARK_LAYOUT } from '../../js/common.js';
import { exportToCSV, serializeStateToURL, deserializeStateFromURL, randomWeibull } from '../../js/distributions.js';

export default function init() {
  const paRateSlider = $('pa-rate-slider');
  const paRateVal = $('pa-rate-val');
  const paApprovalSlider = $('pa-approval-slider');
  const paApprovalVal = $('pa-approval-val');
  const turnaroundSlider = $('turnaround-slider');
  const turnaroundVal = $('turnaround-val');
  const copaySlider = $('copay-slider');
  const copayVal = $('copay-val');
  const rxVolumeSlider = $('rx-volume-slider');
  const rxVolumeVal = $('rx-volume-val');

  const btnPinCurve = $('btn-pin-curve');
  const btnExportCSV = $('btn-export-csv');

  const adjudicationBadge = $('adjudication-badge');
  const statPaidRate = $('stat-paid-rate');
  const statDenialRate = $('stat-denial-rate');
  const statTurnaroundAbandon = $('stat-turnaround-abandon');
  const statCopayAbandon = $('stat-copay-abandon');
  const statTotalLoss = $('stat-total-loss');
  const adjudicationCalloutText = $('adjudication-callout-text');

  let pinnedFunnel = null;

  function render() {
    const totalRx = parseInt(rxVolumeSlider.value, 10);
    const paRate = parseInt(paRateSlider.value, 10) / 100;
    const paApproval = parseInt(paApprovalSlider.value, 10) / 100;
    const turnaround = parseFloat(turnaroundSlider.value);
    const copay = parseInt(copaySlider.value, 10);

    paRateVal.textContent = `${Math.round(paRate * 100)}%`;
    paApprovalVal.textContent = `${Math.round(paApproval * 100)}%`;
    turnaroundVal.textContent = `${fmt(turnaround, 1)} days`;
    copayVal.textContent = `$${copay}`;
    rxVolumeVal.textContent = `${totalRx.toLocaleString()} Rxs`;

    serializeStateToURL({
      pa: Math.round(paRate * 100),
      appr: Math.round(paApproval * 100),
      lag: turnaround,
      copay,
      n: totalRx
    });

    // 1. Funnel Mechanics
    const directEligible = Math.round(totalRx * (1 - paRate));
    const paRequired = totalRx - directEligible;

    // PA Denied
    const paDenied = Math.round(paRequired * (1 - paApproval));
    const paApproved = paRequired - paDenied;

    // Turnaround delay abandonment on approved PA scripts
    // Weibull mean turnaround lag induces drop-off: 1 - exp(-0.06 * lag^1.2)
    const lagAbandonProb = Math.min(0.45, 1.0 - Math.exp(-0.06 * Math.pow(turnaround, 1.25)));
    const turnaroundLoss = Math.round(paApproved * lagAbandonProb);
    const paCleared = paApproved - turnaroundLoss;

    // Pre-dispense total reaching pharmacy register
    const preCopayTotal = directEligible + paCleared;

    // Out-of-pocket copay abandonment elasticity
    const copayAbandonProb = copay === 0 ? 0.02 : Math.min(0.75, 1.0 - (1.0 / (1.0 + Math.pow(copay / 48.0, 1.85))));
    const copayLoss = Math.round(preCopayTotal * copayAbandonProb);

    // Final Paid Claims
    const finalPaid = Math.max(0, preCopayTotal - copayLoss);

    // Rates as percentage of original written Rx
    const paidRatePct = (finalPaid / totalRx) * 100;
    const denialRatePct = (paDenied / totalRx) * 100;
    const turnaroundLossPct = (turnaroundLoss / totalRx) * 100;
    const copayLossPct = (copayLoss / totalRx) * 100;
    const totalLossPct = 100 - paidRatePct;

    // Update KPI Scorecard
    statPaidRate.textContent = fmtPct(paidRatePct, 1);
    statDenialRate.textContent = fmtPct(denialRatePct, 1);
    statTurnaroundAbandon.textContent = fmtPct(turnaroundLossPct, 1);
    statCopayAbandon.textContent = fmtPct(copayLossPct, 1);
    statTotalLoss.textContent = fmtPct(totalLossPct, 1);

    adjudicationBadge.textContent = `Paid Yield: ${fmtPct(paidRatePct, 1)}`;
    adjudicationBadge.className = paidRatePct >= 65 ? 'badge badge-emerald' : (paidRatePct >= 50 ? 'badge badge-amber' : 'badge badge-rose');

    // ─────────────────────────────────────────────────────────────
    // Chart 1: Adjudication Waterfall Funnel
    // ─────────────────────────────────────────────────────────────
    const steps = [
      '1. Written Rxs',
      'PA Denied',
      'Lag Abandoned',
      'Copay Reversed',
      'Final Paid Claims'
    ];
    const deltas = [
      totalRx,
      -paDenied,
      -turnaroundLoss,
      -copayLoss,
      finalPaid
    ];

    const waterfallTrace = {
      type: 'waterfall',
      orientation: 'v',
      measure: ['absolute', 'relative', 'relative', 'relative', 'total'],
      x: steps,
      y: deltas,
      connector: { line: { color: '#3f3f46', width: 1.5 } },
      increasing: { marker: { color: '#38bdf8' } },
      decreasing: { marker: { color: '#f43f5e' } },
      totals: { marker: { color: '#10b981' } },
      textposition: 'outside',
      text: [
        `${totalRx.toLocaleString()}`,
        `-${paDenied.toLocaleString()}`,
        `-${turnaroundLoss.toLocaleString()}`,
        `-${copayLoss.toLocaleString()}`,
        `${finalPaid.toLocaleString()}`
      ],
      textfont: { size: 9, color: '#fafafa' }
    };

    const traces = [waterfallTrace];

    if (pinnedFunnel) {
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: steps,
        y: pinnedFunnel,
        name: 'Pinned Baseline Reference',
        line: { color: '#a1a1aa', width: 2, dash: 'dash' }
      });
    }

    const waterfallLayout = {
      ...DARK_LAYOUT,
      title: false,
      yaxis: { ...DARK_LAYOUT.yaxis, title: 'Prescription Volume (Rxs)' },
      xaxis: { ...DARK_LAYOUT.xaxis }
    };

    Plotly.react('chart-adjudication-waterfall', traces, waterfallLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 2: Weibull Prior Auth Turnaround Delay Distribution
    // ─────────────────────────────────────────────────────────────
    const lagDays = [];
    const lagPDF = [];
    const k = 1.6;
    for (let t = 0.5; t <= 14; t += 0.5) {
      lagDays.push(t);
      // Weibull PDF: (k / lambda) * (t / lambda)^(k-1) * exp(-(t / lambda)^k)
      const pdf = (k / turnaround) * Math.pow(t / turnaround, k - 1) * Math.exp(-Math.pow(t / turnaround, k));
      lagPDF.push(pdf);
    }

    const weibullTrace = {
      x: lagDays,
      y: lagPDF,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      fillcolor: 'rgba(245, 158, 11, 0.15)',
      line: { color: '#f59e0b', width: 2 },
      name: 'Turnaround Probability Density'
    };

    const weibullLayout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 25, b: 35, l: 45 },
      xaxis: { ...DARK_LAYOUT.xaxis, title: 'Prior Auth Review Time (Days)' },
      yaxis: { ...DARK_LAYOUT.yaxis, title: 'Density f(t)' },
      shapes: [
        {
          type: 'line',
          x0: 7,
          x1: 7,
          y0: 0,
          y1: Math.max(...lagPDF) * 1.05,
          line: { color: '#f43f5e', dash: 'dash', width: 1.5 }
        }
      ],
      annotations: [
        {
          x: 7.2,
          y: Math.max(...lagPDF) * 0.9,
          text: 'Critical 7d Friction Threshold',
          showarrow: false,
          font: { color: '#f43f5e', size: 9 }
        }
      ]
    };

    Plotly.react('chart-weibull-turnaround', [weibullTrace], weibullLayout, { responsive: true, displayModeBar: false });

    // ─────────────────────────────────────────────────────────────
    // Chart 3: Copay Reversal & Abandonment Elasticity
    // ─────────────────────────────────────────────────────────────
    const copayCurveX = [];
    const copayCurveY = [];
    for (let c = 0; c <= 250; c += 5) {
      copayCurveX.push(c);
      const ab = c === 0 ? 2 : (1.0 - (1.0 / (1.0 + Math.pow(c / 48.0, 1.85)))) * 100;
      copayCurveY.push(ab);
    }

    const copayTrace = {
      x: copayCurveX,
      y: copayCurveY,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#a855f7', width: 2.5 },
      name: 'Abandonment Elasticity'
    };

    const currentCopayPoint = {
      x: [copay],
      y: [copayAbandonProb * 100],
      mode: 'markers+text',
      marker: { color: '#f43f5e', size: 9 },
      text: [`$${copay}: ${fmtPct(copayAbandonProb * 100, 1)}`],
      textposition: 'top left',
      textfont: { color: '#fafafa', size: 9 },
      showlegend: false
    };

    const copayLayout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 20, r: 25, b: 35, l: 45 },
      xaxis: { ...DARK_LAYOUT.xaxis, title: 'Patient Out-of-Pocket Copay ($)' },
      yaxis: { ...DARK_LAYOUT.yaxis, title: 'Abandonment Rate (%)', range: [0, 85] }
    };

    Plotly.react('chart-copay-elasticity', [copayTrace, currentCopayPoint], copayLayout, { responsive: true, displayModeBar: false });

    // Insight Callout
    adjudicationCalloutText.innerHTML = `
      <strong>Formulary Access Loss Analysis:</strong> Out of <strong>${totalRx.toLocaleString()} written prescriptions</strong>, only <strong>${finalPaid.toLocaleString()} paid claims</strong> materialise (${fmtPct(paidRatePct, 1)} yield). 
      Commercial leakage stems from <strong>${fmtPct(denialRatePct, 1)} PA rejections</strong>, <strong>${fmtPct(turnaroundLossPct, 1)} turnaround lag abandonment</strong> (averaging ${fmt(turnaround, 1)} days), and <strong>${fmtPct(copayLossPct, 1)} patient copay reversals</strong> at $${copay}. 
      Targeting digital PA automation (ePA) to compress lag below 3 days can recover approximately +${Math.round(totalRx * 0.05).toLocaleString()} paid scripts.
    `;
  }

  // Event Listeners
  paRateSlider.addEventListener('input', render);
  paApprovalSlider.addEventListener('input', render);
  turnaroundSlider.addEventListener('input', render);
  copaySlider.addEventListener('input', render);
  rxVolumeSlider.addEventListener('input', render);

  btnPinCurve.addEventListener('click', () => {
    const totalRx = parseInt(rxVolumeSlider.value, 10);
    const paRate = parseInt(paRateSlider.value, 10) / 100;
    const paApproval = parseInt(paApprovalSlider.value, 10) / 100;
    const directEligible = Math.round(totalRx * (1 - paRate));
    const paRequired = totalRx - directEligible;
    const paDenied = Math.round(paRequired * (1 - paApproval));
    const paApproved = paRequired - paDenied;
    const finalPaid = Math.round(totalRx * 0.68);
    pinnedFunnel = [totalRx, totalRx - paDenied, totalRx - paDenied - 200, totalRx - paDenied - 400, finalPaid];
    btnPinCurve.textContent = '📌 Funnel Pinned!';
    render();
  });

  btnExportCSV.addEventListener('click', () => {
    const totalRx = parseInt(rxVolumeSlider.value, 10);
    const paRate = parseInt(paRateSlider.value, 10) / 100;
    const records = [];
    for (let i = 0; i < Math.min(200, totalRx); i++) {
      const isPA = i < Math.round(200 * paRate);
      records.push({
        rx_transaction_id: `RX-ADJ-${10000 + i}`,
        prior_auth_required: isPA ? 1 : 0,
        turnaround_days: isPA ? parseFloat(turnaroundSlider.value) : 0,
        copay_usd: copaySlider.value,
        adjudication_status: isPA ? 'PA_Approved_Paid' : 'Direct_Paid'
      });
    }
    exportToCSV(records, 'adjudication_funnel_export.csv');
  });

  render();
}

