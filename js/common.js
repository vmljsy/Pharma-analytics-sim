/**
 * rx.sim — Longitudinal Patient Analytics & Pharma RWE Shared Utilities
 * 
 * Standard algorithms for:
 * 1. Episode Building & Overlap Resolution (Stockpile vs Truncate vs Parallel)
 * 2. Adherence & Compliance Analytics (PDC vs MPR vs Variable MPR)
 * 3. Kaplan-Meier Survival Analysis for Persistence
 * 4. Source of Business (SoB) Classification Engine
 * 5. Line of Therapy (LoT) Sequencing
 * 6. Dark Plotly Theme & DOM Helpers
 */

// ─── DOM Helpers ─────────────────────────────────────────────────

export function $(id) {
  return document.getElementById(id);
}

export function fmt(value, decimals = 1) {
  if (value === undefined || value === null || isNaN(value)) return '—';
  return Number(value).toFixed(decimals);
}

export function fmtPct(value, decimals = 1) {
  if (value === undefined || value === null || isNaN(value)) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

export function linspace(start, end, n) {
  const arr = new Array(n);
  const step = (end - start) / (n - 1);
  for (let i = 0; i < n; i++) {
    arr[i] = start + step * i;
  }
  return arr;
}

export function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

export function std(arr, sample = false) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  const denom = sample ? arr.length - 1 : arr.length;
  return Math.sqrt(sumSq / denom);
}

// ─── Dark Plotly Layout ──────────────────────────────────────────

export const DARK_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#fafafa', family: 'Geist, Inter, sans-serif', size: 12 },
  xaxis: {
    gridcolor: '#27272a',
    zerolinecolor: '#3f3f46',
    linecolor: '#27272a',
    tickfont: { color: '#a1a1aa' },
    titlefont: { color: '#fafafa' },
  },
  yaxis: {
    gridcolor: '#27272a',
    zerolinecolor: '#3f3f46',
    linecolor: '#27272a',
    tickfont: { color: '#a1a1aa' },
    titlefont: { color: '#fafafa' },
  },
  margin: { t: 40, r: 24, b: 45, l: 55 },
  showlegend: true,
  legend: {
    font: { color: '#a1a1aa', size: 11 },
    bgcolor: 'rgba(9, 9, 11, 0.75)',
    bordercolor: '#27272a',
    borderwidth: 1
  },
  bargap: 0.1,
};

// ─── 1. Episode Building Engine ──────────────────────────────────

/**
 * Build continuous treatment episodes from discrete prescription claims.
 * 
 * @param {Array<{id: string|number, startDay: number, daysSupply: number, drug: string}>} rawClaims
 * @param {number} allowableGapDays - Maximum days without supply before episode closes
 * @param {'stockpile'|'truncate'|'parallel'} overlapMethod - Handling of early refills
 * @param {number} studyEndDay - Observation window end (censoring boundary)
 * @returns {{ episodes: Array, adjustedClaims: Array, stats: Object }}
 */
export function buildTreatmentEpisodes(rawClaims, allowableGapDays = 30, overlapMethod = 'stockpile', studyEndDay = 365) {
  if (!rawClaims || rawClaims.length === 0) {
    return { episodes: [], adjustedClaims: [], stats: { totalEpisodes: 0, meanDuration: 0, persistenceRate: 0 } };
  }

  // Sort claims chronologically
  const sorted = [...rawClaims].sort((a, b) => a.startDay - b.startDay);
  const adjustedClaims = [];

  // Adjust claims based on overlap method
  let currentSuppliedUntil = 0;

  for (let i = 0; i < sorted.length; i++) {
    const claim = { ...sorted[i] };
    let effStart = claim.startDay;
    let effDaysSupply = claim.daysSupply;

    if (overlapMethod === 'stockpile') {
      // Push-forward / Stockpiling: if patient still has supply, new fill starts when old supply runs out
      if (effStart < currentSuppliedUntil) {
        claim.pushedDays = currentSuppliedUntil - effStart;
        effStart = currentSuppliedUntil;
      } else {
        claim.pushedDays = 0;
      }
      claim.effectiveStart = effStart;
      claim.effectiveEnd = effStart + effDaysSupply;
      currentSuppliedUntil = claim.effectiveEnd;
    } else if (overlapMethod === 'truncate') {
      // Truncation / Overwrite: prior fill is truncated on new fill date
      if (i > 0) {
        const prev = adjustedClaims[i - 1];
        if (prev.effectiveEnd > effStart) {
          prev.truncatedDays = prev.effectiveEnd - effStart;
          prev.effectiveEnd = effStart;
        }
      }
      claim.pushedDays = 0;
      claim.effectiveStart = effStart;
      claim.effectiveEnd = effStart + effDaysSupply;
      currentSuppliedUntil = claim.effectiveEnd;
    } else {
      // Parallel / As-is
      claim.pushedDays = 0;
      claim.effectiveStart = effStart;
      claim.effectiveEnd = effStart + effDaysSupply;
      currentSuppliedUntil = Math.max(currentSuppliedUntil, claim.effectiveEnd);
    }

    adjustedClaims.push(claim);
  }

  // Merge adjusted claims into treatment episodes
  const episodes = [];
  let epStart = adjustedClaims[0].effectiveStart;
  let epEnd = adjustedClaims[0].effectiveEnd;
  let epClaims = [adjustedClaims[0]];

  for (let i = 1; i < adjustedClaims.length; i++) {
    const claim = adjustedClaims[i];
    const gap = claim.effectiveStart - epEnd;

    if (gap <= allowableGapDays) {
      // Within grace period: bridge into current episode
      epEnd = Math.max(epEnd, claim.effectiveEnd);
      epClaims.push(claim);
    } else {
      // Gap exceeded: close current episode and start new one
      const isCensored = epEnd >= studyEndDay;
      episodes.push({
        id: `EP-${episodes.length + 1}`,
        startDay: epStart,
        endDay: Math.min(epEnd, studyEndDay),
        duration: Math.min(epEnd, studyEndDay) - epStart,
        claimsCount: epClaims.length,
        claims: [...epClaims],
        censored: isCensored,
        closureReason: isCensored ? 'End of Observation' : `Gap of ${gap} days (> ${allowableGapDays}d)`
      });

      epStart = claim.effectiveStart;
      epEnd = claim.effectiveEnd;
      epClaims = [claim];
    }
  }

  // Close final episode
  const isCensored = epEnd >= studyEndDay;
  episodes.push({
    id: `EP-${episodes.length + 1}`,
    startDay: epStart,
    endDay: Math.min(epEnd, studyEndDay),
    duration: Math.min(epEnd, studyEndDay) - epStart,
    claimsCount: epClaims.length,
    claims: [...epClaims],
    censored: isCensored,
    closureReason: isCensored ? 'End of Observation / Ongoing' : 'Exceeded Study Window'
  });

  const totalDuration = episodes.reduce((acc, ep) => acc + ep.duration, 0);
  const meanDuration = episodes.length > 0 ? totalDuration / episodes.length : 0;
  const ongoing = episodes.some(ep => ep.censored);

  return {
    episodes,
    adjustedClaims,
    stats: {
      totalEpisodes: episodes.length,
      meanDuration,
      totalSupplyDays: adjustedClaims.reduce((acc, c) => acc + c.daysSupply, 0),
      isOngoing: ongoing,
      closureCount: episodes.filter(e => !e.censored).length
    }
  };
}

// ─── 2. Compliance & Adherence (PDC vs MPR) ──────────────────────

/**
 * Calculate Medication Possession Ratio (MPR) and Proportion of Days Covered (PDC).
 * 
 * @param {Array<{startDay: number, daysSupply: number}>} claims
 * @param {number} windowStart - Observation start (typically 0 or index claim)
 * @param {number} windowEnd - Observation end (typically 365)
 * @returns {Object} Adherence metrics and daily calendar bitmask
 */
export function calculatePDCandMPR(claims, windowStart = 0, windowEnd = 365) {
  const windowLength = windowEnd - windowStart;
  if (!claims || claims.length === 0 || windowLength <= 0) {
    return {
      mprUncapped: 0,
      mprCapped: 0,
      mprVariable: 0,
      pdc: 0,
      isAdherentPDC: false,
      coveredDaysCount: 0,
      totalDispensedDays: 0,
      dailyStatus: new Array(windowLength).fill(0)
    };
  }

  // Sort claims by dispense date
  const sorted = [...claims].sort((a, b) => a.startDay - b.startDay);
  
  // Total days of supply dispensed
  const totalDispensedDays = sorted.reduce((sum, c) => sum + c.daysSupply, 0);

  // 1. Uncapped MPR = sum(days of supply) / total window days
  const mprUncapped = (totalDispensedDays / windowLength) * 100;

  // 2. Capped MPR = min(100%, Uncapped MPR)
  const mprCapped = Math.min(100, mprUncapped);

  // 3. Variable MPR = sum(supply of all fills except last) / (date of last fill - date of first fill)
  let mprVariable = 0;
  if (sorted.length >= 2) {
    const firstFill = sorted[0].startDay;
    const lastFill = sorted[sorted.length - 1].startDay;
    const variableSpan = lastFill - firstFill;
    if (variableSpan > 0) {
      const supplyMinusLast = sorted.slice(0, -1).reduce((s, c) => s + c.daysSupply, 0);
      mprVariable = Math.min(150, (supplyMinusLast / variableSpan) * 100);
    }
  } else {
    mprVariable = mprCapped;
  }

  // 4. PDC Calculation (Standard CMS/PQA method):
  // Shift overlapping days forward, then fill daily coverage vector
  const dailyStatus = new Array(windowLength).fill(0); // 0: Gap, 1: Covered, 2: Shifted overlap
  let nextAvailableDay = sorted[0].startDay;

  sorted.forEach(claim => {
    let fillStart = Math.max(claim.startDay, nextAvailableDay);
    let supplyRemaining = claim.daysSupply;

    for (let d = fillStart; d < fillStart + supplyRemaining; d++) {
      if (d >= windowStart && d < windowEnd) {
        const idx = d - windowStart;
        if (dailyStatus[idx] === 0) {
          dailyStatus[idx] = (claim.startDay < nextAvailableDay) ? 2 : 1;
        }
      }
    }
    nextAvailableDay = fillStart + supplyRemaining;
  });

  const coveredDaysCount = dailyStatus.filter(s => s > 0).length;
  const pdc = (coveredDaysCount / windowLength) * 100;
  const isAdherentPDC = pdc >= 80.0; // Standard 80% threshold

  return {
    mprUncapped,
    mprCapped,
    mprVariable,
    pdc,
    isAdherentPDC,
    coveredDaysCount,
    totalDispensedDays,
    windowLength,
    dailyStatus
  };
}

// ─── 3. Kaplan-Meier Survival Estimator ───────────────────────────

/**
 * Compute Kaplan-Meier survival curves for treatment persistence.
 * 
 * @param {Array<{time: number, event: number, cohort?: string}>} sampleData
 * @returns {Object} Survival curve coordinates, at-risk tables, median persistence
 */
export function computeKaplanMeier(sampleData) {
  if (!sampleData || sampleData.length === 0) {
    return { times: [0], survival: [1.0], lowerCI: [1.0], upperCI: [1.0], median: 0, atRisk: [], events: [] };
  }

  // Sort by time ascending
  const sorted = [...sampleData].sort((a, b) => a.time - b.time);

  // Group by unique time points
  const timeMap = new Map();
  sorted.forEach(d => {
    if (!timeMap.has(d.time)) {
      timeMap.set(d.time, { time: d.time, events: 0, censored: 0 });
    }
    const entry = timeMap.get(d.time);
    if (d.event === 1) entry.events++;
    else entry.censored++;
  });

  const uniqueTimes = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);

  let nAtRisk = sorted.length;
  let s_t = 1.0;
  let greenwoodSum = 0;

  const times = [0];
  const survival = [1.0];
  const lowerCI = [1.0];
  const upperCI = [1.0];
  const atRiskList = [nAtRisk];
  const eventList = [0];

  let median = null;

  for (const item of uniqueTimes) {
    const d_i = item.events;
    const c_i = item.censored;
    const currentN = nAtRisk;

    if (currentN <= 0) break;

    // KM step
    if (d_i > 0) {
      s_t = s_t * (1 - d_i / currentN);
      if (currentN - d_i > 0) {
        greenwoodSum += d_i / (currentN * (currentN - d_i));
      }
    }

    const se = s_t * Math.sqrt(greenwoodSum);
    const low = Math.max(0, s_t - 1.96 * se);
    const high = Math.min(1, s_t + 1.96 * se);

    times.push(item.time);
    survival.push(s_t);
    lowerCI.push(low);
    upperCI.push(high);
    atRiskList.push(currentN);
    eventList.push(d_i);

    if (median === null && s_t <= 0.5) {
      median = item.time;
    }

    nAtRisk -= (d_i + c_i);
  }

  return {
    times,
    survival,
    lowerCI,
    upperCI,
    median: median ?? times[times.length - 1],
    uniqueTimes,
    totalCount: sorted.length
  };
}

// ─── 4. Source of Business (SoB) Classification Engine ────────────

/**
 * Longitudinal Source of Business Classifier.
 * Classifies an index prescription fill into:
 * - New to Brand (Naive)
 * - Switch-In (from Competitor)
 * - Add-On / Augmentation (added to existing therapy)
 * - Restart (re-initiation after discontinuation)
 * - Continuing / Maintenance
 * 
 * @param {Array<{drug: string, startDay: number, daysSupply: number}>} patientHistory
 * @param {string} targetBrand
 * @param {number} indexDay
 * @param {number} lookbackDays
 * @param {number} switchWindowDays
 * @param {number} restartThresholdDays
 * @returns {Object} Classification result and domain reasoning
 */
export function classifySourceOfBusiness(
  patientHistory,
  targetBrand = 'Target Brand',
  indexDay = 180,
  lookbackDays = 180,
  switchWindowDays = 60,
  restartThresholdDays = 90
) {
  const windowStart = indexDay - lookbackDays;

  // Filter history strictly within lookback window prior to indexDay
  const priorClaims = patientHistory
    .filter(c => c.startDay >= windowStart && c.startDay < indexDay)
    .sort((a, b) => b.startDay - a.startDay); // newest first

  const priorBrandClaims = priorClaims.filter(c => c.drug === targetBrand);
  const priorCompetitorClaims = priorClaims.filter(c => c.drug !== targetBrand);

  // 1. Check for Continuing Maintenance
  if (priorBrandClaims.length > 0) {
    const lastBrandClaim = priorBrandClaims[0];
    const daysSinceSupplyEnded = indexDay - (lastBrandClaim.startDay + lastBrandClaim.daysSupply);

    if (daysSinceSupplyEnded <= restartThresholdDays) {
      return {
        category: 'Continuing / Maintenance',
        code: 'CONT',
        color: '#10b981',
        badgeClass: 'badge-emerald',
        rationale: `Patient received continuous refills of ${targetBrand}. Gap of ${Math.max(0, daysSinceSupplyEnded)} days is within the maintenance threshold (≤ ${restartThresholdDays}d).`,
        evidence: { priorBrandFills: priorBrandClaims.length, lastBrandDay: lastBrandClaim.startDay }
      };
    } else {
      return {
        category: 'Restart / Re-initiation',
        code: 'RST',
        color: '#06b6d4',
        badgeClass: 'badge-cyan',
        rationale: `Patient previously used ${targetBrand}, but had a treatment gap of ${daysSinceSupplyEnded} days (> ${restartThresholdDays}d restart threshold) before re-initiating.`,
        evidence: { priorBrandFills: priorBrandClaims.length, gapDays: daysSinceSupplyEnded }
      };
    }
  }

  // If no prior brand claims in lookback window:
  if (priorCompetitorClaims.length === 0) {
    return {
      category: 'New to Brand (Naive)',
      code: 'NTB',
      color: '#38bdf8',
      badgeClass: 'badge-blue',
      rationale: `Zero prescription claims for either ${targetBrand} or competing therapies in the ${lookbackDays}-day lookback window. True naive starter.`,
      evidence: { priorFills: 0, lookbackDays }
    };
  }

  // Patient had competitor claims. Check if Add-On or Switch-In:
  const lastCompetitorClaim = priorCompetitorClaims[0];
  const competitorSupplyEnd = lastCompetitorClaim.startDay + lastCompetitorClaim.daysSupply;
  const daysSinceCompetitorSupply = indexDay - competitorSupplyEnd;

  // Check if competitor continued post-index (Add-On / Combination)
  const concurrentCompetitorPost = patientHistory.some(
    c => c.drug !== targetBrand && c.startDay >= indexDay && c.startDay <= indexDay + 45
  );

  if (competitorSupplyEnd >= indexDay || concurrentCompetitorPost) {
    return {
      category: 'Add-On / Combination',
      code: 'ADD',
      color: '#a855f7',
      badgeClass: 'badge-violet',
      rationale: `Patient maintained active supply of competitor therapy (${lastCompetitorClaim.drug}) at the time ${targetBrand} was initiated, indicating combination therapy.`,
      evidence: { competitorDrug: lastCompetitorClaim.drug, overlap: true }
    };
  }

  if (daysSinceCompetitorSupply <= switchWindowDays) {
    return {
      category: 'Switch-In',
      code: 'SWT',
      color: '#f59e0b',
      badgeClass: 'badge-amber',
      rationale: `Patient discontinued competitor therapy (${lastCompetitorClaim.drug}) within ${daysSinceCompetitorSupply} days (≤ ${switchWindowDays}d switch window) and transitioned to ${targetBrand}.`,
      evidence: { competitorDrug: lastCompetitorClaim.drug, switchGapDays: daysSinceCompetitorSupply }
    };
  }

  // Prior competitor was older than switch window
  return {
    category: 'New to Brand (Experienced Naive)',
    code: 'NTB_EXP',
    color: '#38bdf8',
    badgeClass: 'badge-blue',
    rationale: `Patient had competitor therapy history (${lastCompetitorClaim.drug}), but the discontinuation occurred ${daysSinceCompetitorSupply} days ago (> ${switchWindowDays}d switch window). Treated as new initiation.`,
    evidence: { competitorDrug: lastCompetitorClaim.drug, daysSinceCompetitorSupply }
  };
}

// ─── 5. Line of Therapy (LoT) Sequencing Engine ──────────────────

/**
 * Line of Therapy Engine for Oncology and Chronic Multi-Agent Therapies.
 * 
 * @param {Array<{drug: string, startDay: number, daysSupply: number}>} claims
 * @param {number} regimenWindowDays - Window from index claim to identify multi-drug regimens (e.g. 28 days)
 * @param {number} allowableGapDays - Maximum allowable treatment holiday before discontinuation (e.g. 90 days)
 * @returns {Array<Object>} Assigned lines of therapy (1L, 2L, 3L) with regimens and start/end dates
 */
export function computeLineOfTherapy(claims, regimenWindowDays = 28, allowableGapDays = 90) {
  if (!claims || claims.length === 0) return [];

  const sorted = [...claims].sort((a, b) => a.startDay - b.startDay);
  const lines = [];

  let currentLineIndex = 1;
  let lineStart = sorted[0].startDay;
  let regimenWindowEnd = lineStart + regimenWindowDays;

  // Identify baseline regimen drugs in initial window
  let initialDrugs = new Set();
  sorted.filter(c => c.startDay >= lineStart && c.startDay <= regimenWindowEnd)
        .forEach(c => initialDrugs.add(c.drug));

  let currentRegimenName = Array.from(initialDrugs).sort().join(' + ');
  let lineEnd = Math.max(...sorted.filter(c => initialDrugs.has(c.drug)).map(c => c.startDay + c.daysSupply));
  let lineClaims = sorted.filter(c => c.startDay <= lineEnd && initialDrugs.has(c.drug));

  let i = 0;
  while (i < sorted.length) {
    const claim = sorted[i];

    // Check if claim belongs to current regimen
    if (initialDrugs.has(claim.drug)) {
      lineEnd = Math.max(lineEnd, claim.startDay + claim.daysSupply);
      i++;
      continue;
    }

    // New drug introduced after regimen definition window
    if (claim.startDay > regimenWindowEnd) {
      // Check if it's an immediate switch or an addition
      const isSwitch = claim.startDay <= lineEnd + allowableGapDays;

      // Close current line
      lines.push({
        line: `${currentLineIndex}L`,
        regimen: currentRegimenName,
        startDay: lineStart,
        endDay: Math.min(lineEnd, claim.startDay),
        duration: Math.min(lineEnd, claim.startDay) - lineStart,
        transitionReason: `Switched to ${claim.drug}`
      });

      // Advance to next Line
      currentLineIndex++;
      lineStart = claim.startDay;
      regimenWindowEnd = lineStart + regimenWindowDays;

      initialDrugs = new Set([claim.drug]);
      // Capture any companion drugs in the new 28-day window
      sorted.filter(c => c.startDay >= lineStart && c.startDay <= regimenWindowEnd)
            .forEach(c => initialDrugs.add(c.drug));

      currentRegimenName = Array.from(initialDrugs).sort().join(' + ');
      lineEnd = Math.max(...sorted.filter(c => initialDrugs.has(c.drug)).map(c => c.startDay + c.daysSupply));
    }

    i++;
  }

  // Push final open line
  lines.push({
    line: `${currentLineIndex}L`,
    regimen: currentRegimenName,
    startDay: lineStart,
    endDay: lineEnd,
    duration: lineEnd - lineStart,
    transitionReason: 'Ongoing / Censored'
  });

  return lines;
}
