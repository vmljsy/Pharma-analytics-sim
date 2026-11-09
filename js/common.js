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

// ─── 1. Episode Building & Market Segments Engine ─────────────────

export const MARKET_SEGMENTS = {
  GLP1: {
    id: 'GLP1',
    name: 'GLP-1 RA',
    fullName: 'GLP-1 Receptor Agonists',
    color: '#38bdf8',
    bgLight: 'rgba(56, 189, 248, 0.15)',
    border: '#38bdf8',
    badgeClass: 'badge-blue',
    examples: ['Ozempic', 'Trulicity', 'Rybelsus', 'Victoza'],
    defaultDrug: 'Ozempic (0.5mg)',
    mechanism: 'Incretin GLP-1 receptor mimetic'
  },
  SGLT2: {
    id: 'SGLT2',
    name: 'SGLT-2i',
    fullName: 'SGLT-2 Inhibitors',
    color: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.15)',
    border: '#10b981',
    badgeClass: 'badge-emerald',
    examples: ['Jardiance', 'Farxiga', 'Invokana'],
    defaultDrug: 'Jardiance (10mg)',
    mechanism: 'Renal glucose co-transporter 2 inhibitor'
  },
  DPP4: {
    id: 'DPP4',
    name: 'DPP-4i',
    fullName: 'DPP-4 Inhibitors',
    color: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.15)',
    border: '#f59e0b',
    badgeClass: 'badge-amber',
    examples: ['Januvia', 'Tradjenta', 'Onglyza'],
    defaultDrug: 'Januvia (100mg)',
    mechanism: 'Dipeptidyl peptidase-4 enzyme inhibitor'
  },
  INS: {
    id: 'INS',
    name: 'Basal Insulin',
    fullName: 'Basal Insulin Analogues',
    color: '#a855f7',
    bgLight: 'rgba(168, 85, 247, 0.15)',
    border: '#a855f7',
    badgeClass: 'badge-indigo',
    examples: ['Lantus', 'Tresiba', 'Toujeo'],
    defaultDrug: 'Lantus (20U)',
    mechanism: 'Exogenous basal glycemic control'
  },
  DUAL: {
    id: 'DUAL',
    name: 'Dual GIP/GLP-1',
    fullName: 'Dual GIP & GLP-1 Receptor Agonists',
    color: '#f43f5e',
    bgLight: 'rgba(244, 63, 94, 0.15)',
    border: '#f43f5e',
    badgeClass: 'badge-rose',
    examples: ['Mounjaro', 'Zepbound'],
    defaultDrug: 'Mounjaro (5mg)',
    mechanism: 'Twincretin dual incretin receptor co-agonist'
  },
  MET: {
    id: 'MET',
    name: 'Metformin',
    fullName: 'Biguanides / Metformin Backbone',
    color: '#06b6d4',
    bgLight: 'rgba(6, 182, 212, 0.15)',
    border: '#06b6d4',
    badgeClass: 'badge-cyan',
    examples: ['Glucophage XR', 'Fortamet'],
    defaultDrug: 'Metformin (1000mg)',
    mechanism: 'Suppresses hepatic gluconeogenesis'
  }
};

export const DEFAULT_RESTRICTION_RULES = [
  {
    id: 'rule-glp1-dpp4',
    name: 'GLP-1 RA + DPP-4i Duplication',
    type: 'prohibited_overlap',
    pair: ['GLP1', 'DPP4'],
    severity: 'error',
    title: 'Therapeutic Duplication (Redundant Incretin Target)',
    description: 'GLP-1 receptor agonists and DPP-4 inhibitors share the same incretin pathway. Concurrent overlap provides no incremental glycemic benefit and is disallowed by ADA/EASD and payer formularies.',
    enabled: true
  },
  {
    id: 'rule-glp1-dual',
    name: 'GLP-1 RA + Dual Incretin Duplication',
    type: 'prohibited_overlap',
    pair: ['GLP1', 'DUAL'],
    severity: 'error',
    title: 'Duplicate GLP-1 Mechanism of Action',
    description: 'Dual GIP/GLP-1 co-agonists already contain high GLP-1 receptor potency. Concurrent therapy with another GLP-1 RA is medically duplicative and clinically contraindicated.',
    enabled: true
  },
  {
    id: 'rule-dpp4-dual',
    name: 'DPP-4i + Dual Incretin Duplication',
    type: 'prohibited_overlap',
    pair: ['DPP4', 'DUAL'],
    severity: 'error',
    title: 'Incretin Pathway Duplication',
    description: 'DPP-4 inhibitors combined with dual incretins provide no additive benefit and are contraindicated.',
    enabled: true
  },
  {
    id: 'rule-sglt2-glp1',
    name: 'SGLT-2i + GLP-1 RA Synergistic Add-On',
    type: 'synergistic_combination',
    pair: ['SGLT2', 'GLP1'],
    severity: 'success',
    title: 'Guideline-Recommended Synergistic Combination',
    description: 'Complementary mechanisms provide additive cardiovascular, renal, and weight-loss benefits. Standard approved dual-target combination.',
    enabled: true
  },
  {
    id: 'rule-met-sglt2',
    name: 'Metformin + SGLT-2i Backbone Combination',
    type: 'synergistic_combination',
    pair: ['MET', 'SGLT2'],
    severity: 'success',
    title: 'Standard Dual Backbone Regimen',
    description: 'Well-established guideline foundation for early add-on therapy.',
    enabled: true
  }
];

/**
 * Check whether a candidate market segment can be added given currently active segments.
 * 
 * @param {string[]} currentSegments - Array of segment IDs currently selected
 * @param {string} candidateSegment - Segment ID being considered
 * @param {Array} rules - Restriction rules list
 * @param {boolean} enforceHard - Whether hard restrictions are strictly enforced
 * @returns {{ allowed: boolean, status: 'compatible'|'synergistic'|'conflict', rule: Object|null, reason: string }}
 */
export function checkMarketCompatibility(currentSegments = [], candidateSegment, rules = DEFAULT_RESTRICTION_RULES, enforceHard = false) {
  if (!candidateSegment) return { allowed: true, status: 'compatible', rule: null, reason: 'Valid market segment' };
  if (currentSegments.includes(candidateSegment)) {
    return { allowed: true, status: 'compatible', rule: null, reason: 'Already selected in regimen' };
  }

  // Check prohibited overlap rules
  for (const seg of currentSegments) {
    const conflictRule = rules.find(r => r.enabled && r.type === 'prohibited_overlap' && (
      (r.pair[0] === seg && r.pair[1] === candidateSegment) ||
      (r.pair[1] === seg && r.pair[0] === candidateSegment)
    ));
    if (conflictRule) {
      return {
        allowed: !enforceHard,
        status: 'conflict',
        rule: conflictRule,
        reason: conflictRule.title
      };
    }
  }

  // Check synergistic combination rules
  for (const seg of currentSegments) {
    const synergyRule = rules.find(r => r.enabled && r.type === 'synergistic_combination' && (
      (r.pair[0] === seg && r.pair[1] === candidateSegment) ||
      (r.pair[1] === seg && r.pair[0] === candidateSegment)
    ));
    if (synergyRule) {
      return {
        allowed: true,
        status: 'synergistic',
        rule: synergyRule,
        reason: synergyRule.title
      };
    }
  }

  return { allowed: true, status: 'compatible', rule: null, reason: 'Compatible therapy' };
}

/**
 * Build continuous treatment episodes from discrete prescription claims with multi-market segment resolution.
 * 
 * @param {Array<{id: string|number, startDay: number, daysSupply: number, drug: string, marketSegments?: string[]}>} rawClaims
 * @param {number} allowableGapDays - Maximum days without supply before episode closes
 * @param {'stockpile'|'truncate'|'parallel'} overlapMethod - Handling of early refills
 * @param {number} studyEndDay - Observation window end (censoring boundary)
 * @param {Object} [options] - Multi-market segment options & rules
 * @returns {{ episodes: Array, adjustedClaims: Array, stats: Object, overlapIntervals: Array }}
 */
export function buildTreatmentEpisodes(rawClaims, allowableGapDays = 30, overlapMethod = 'stockpile', studyEndDay = 365, options = {}) {
  if (!rawClaims || rawClaims.length === 0) {
    return {
      episodes: [],
      adjustedClaims: [],
      overlapIntervals: [],
      stats: { totalEpisodes: 0, meanDuration: 0, persistenceRate: 0, conflictCount: 0, synergyCount: 0, activeSegmentsCount: 0 }
    };
  }

  const rules = options.rules || DEFAULT_RESTRICTION_RULES;
  const maxSegments = options.maxConcurrentSegments ?? 2;
  const enforceHard = options.enforceHard ?? false;

  // Normalize claims and ensure marketSegments array
  const sorted = [...rawClaims]
    .map(c => {
      const segs = Array.isArray(c.marketSegments) && c.marketSegments.length > 0 
        ? [...c.marketSegments]
        : (c.segment ? [c.segment] : ['GLP1']);
      return {
        ...c,
        marketSegments: segs,
        pushedDays: 0,
        truncatedDays: 0,
        conflicts: [],
        synergies: []
      };
    })
    .sort((a, b) => a.startDay - b.startDay);

  const adjustedClaims = [];

  // Track supply horizons per market segment so refills of the SAME segment stockpile,
  // while distinct market segments can run concurrently
  const segmentHorizons = new Map();
  let globalSuppliedUntil = 0;

  for (let i = 0; i < sorted.length; i++) {
    const claim = { ...sorted[i] };
    let effStart = claim.startDay;
    let effDaysSupply = claim.daysSupply;
    const primarySeg = claim.marketSegments[0] || 'DEFAULT';

    if (overlapMethod === 'stockpile') {
      // Per-segment stockpiling allows multi-market combinations while stockpiling refills of the same segment
      const segHorizon = segmentHorizons.get(primarySeg) || 0;
      if (effStart < segHorizon) {
        claim.pushedDays = segHorizon - effStart;
        effStart = segHorizon;
      } else {
        claim.pushedDays = 0;
      }
      claim.effectiveStart = effStart;
      claim.effectiveEnd = effStart + effDaysSupply;
      segmentHorizons.set(primarySeg, claim.effectiveEnd);
      globalSuppliedUntil = Math.max(globalSuppliedUntil, claim.effectiveEnd);
    } else if (overlapMethod === 'truncate') {
      // Truncation: truncate previous claim of the same segment if it overlaps
      const prevSameSeg = [...adjustedClaims].reverse().find(c => c.marketSegments.includes(primarySeg));
      if (prevSameSeg && prevSameSeg.effectiveEnd > effStart) {
        prevSameSeg.truncatedDays = prevSameSeg.effectiveEnd - effStart;
        prevSameSeg.effectiveEnd = effStart;
      }
      claim.pushedDays = 0;
      claim.effectiveStart = effStart;
      claim.effectiveEnd = effStart + effDaysSupply;
      segmentHorizons.set(primarySeg, claim.effectiveEnd);
      globalSuppliedUntil = Math.max(globalSuppliedUntil, claim.effectiveEnd);
    } else {
      // Parallel / As-is
      claim.pushedDays = 0;
      claim.effectiveStart = effStart;
      claim.effectiveEnd = effStart + effDaysSupply;
      segmentHorizons.set(primarySeg, Math.max(segmentHorizons.get(primarySeg) || 0, claim.effectiveEnd));
      globalSuppliedUntil = Math.max(globalSuppliedUntil, claim.effectiveEnd);
    }

    adjustedClaims.push(claim);
  }

  // ── Multi-Market Segment Overlap & Restriction Collision Detection ──
  const overlapIntervals = [];

  for (let i = 0; i < adjustedClaims.length; i++) {
    for (let j = i + 1; j < adjustedClaims.length; j++) {
      const c1 = adjustedClaims[i];
      const c2 = adjustedClaims[j];

      const overlapStart = Math.max(c1.effectiveStart, c2.effectiveStart);
      const overlapEnd = Math.min(c1.effectiveEnd, c2.effectiveEnd);

      if (overlapStart < overlapEnd) {
        // They overlap in time! Check their market segments
        const segs1 = c1.marketSegments;
        const segs2 = c2.marketSegments;
        const combinedSegs = Array.from(new Set([...segs1, ...segs2]));

        // Check pairwise rules
        let foundConflict = false;
        let foundSynergy = false;

        for (const s1 of segs1) {
          for (const s2 of segs2) {
            if (s1 === s2) continue; // Same segment overlap is handled by stockpile/truncate

            // 1. Prohibited Overlap / Duplication rule
            const conflictRule = rules.find(r => r.enabled && r.type === 'prohibited_overlap' && (
              (r.pair[0] === s1 && r.pair[1] === s2) ||
              (r.pair[1] === s1 && r.pair[0] === s2)
            ));

            if (conflictRule) {
              foundConflict = true;
              c1.conflicts.push({ rule: conflictRule, withClaimId: c2.id, segment: s2, start: overlapStart, end: overlapEnd });
              c2.conflicts.push({ rule: conflictRule, withClaimId: c1.id, segment: s1, start: overlapStart, end: overlapEnd });
              overlapIntervals.push({
                start: overlapStart,
                end: overlapEnd,
                duration: overlapEnd - overlapStart,
                claims: [c1.id, c2.id],
                segments: [s1, s2],
                type: 'conflict',
                severity: 'error',
                rule: conflictRule,
                title: conflictRule.title,
                description: conflictRule.description
              });
            }

            // 2. Synergistic Combination rule
            const synergyRule = rules.find(r => r.enabled && r.type === 'synergistic_combination' && (
              (r.pair[0] === s1 && r.pair[1] === s2) ||
              (r.pair[1] === s1 && r.pair[0] === s2)
            ));

            if (synergyRule && !foundConflict) {
              foundSynergy = true;
              c1.synergies.push({ rule: synergyRule, withClaimId: c2.id, segment: s2, start: overlapStart, end: overlapEnd });
              c2.synergies.push({ rule: synergyRule, withClaimId: c1.id, segment: s1, start: overlapStart, end: overlapEnd });
              overlapIntervals.push({
                start: overlapStart,
                end: overlapEnd,
                duration: overlapEnd - overlapStart,
                claims: [c1.id, c2.id],
                segments: [s1, s2],
                type: 'synergy',
                severity: 'success',
                rule: synergyRule,
                title: synergyRule.title,
                description: synergyRule.description
              });
            }
          }
        }

        // 3. Max Concurrent Segments cap rule
        if (maxSegments > 0 && combinedSegs.length > maxSegments) {
          overlapIntervals.push({
            start: overlapStart,
            end: overlapEnd,
            duration: overlapEnd - overlapStart,
            claims: [c1.id, c2.id],
            segments: combinedSegs,
            type: 'cap_exceeded',
            severity: 'warning',
            title: `Concurrent Cap Exceeded (${combinedSegs.length} > ${maxSegments} max)`,
            description: `Regimen exceeds the maximum allowable ${maxSegments} concurrent active drug classes.`
          });
        }
      }
    }
  }

  // ── Construct Continuous Treatment Episodes ──
  const episodes = [];
  let epStart = adjustedClaims[0].effectiveStart;
  let epEnd = adjustedClaims[0].effectiveEnd;
  let epClaims = [adjustedClaims[0]];

  for (let i = 1; i < adjustedClaims.length; i++) {
    const claim = adjustedClaims[i];
    const gap = claim.effectiveStart - epEnd;

    if (gap <= allowableGapDays) {
      // Within allowable gap tolerance: bridge into current episode
      epEnd = Math.max(epEnd, claim.effectiveEnd);
      epClaims.push(claim);
    } else {
      // Gap exceeded: close current episode and start new one
      const isCensored = epEnd >= studyEndDay;
      const episodeSegs = Array.from(new Set(epClaims.flatMap(c => c.marketSegments)));
      const epConflicts = epClaims.flatMap(c => c.conflicts);
      const epSynergies = epClaims.flatMap(c => c.synergies);

      let regimenType = 'Monotherapy';
      if (epConflicts.length > 0) regimenType = 'Restricted Duplication';
      else if (epSynergies.length > 0) regimenType = 'Dual Synergistic Combination';
      else if (episodeSegs.length > 1) regimenType = 'Multi-Segment Regimen';

      episodes.push({
        id: `EP-${episodes.length + 1}`,
        startDay: epStart,
        endDay: Math.min(epEnd, studyEndDay),
        duration: Math.min(epEnd, studyEndDay) - epStart,
        claimsCount: epClaims.length,
        claims: [...epClaims],
        marketSegments: episodeSegs,
        regimenType,
        hasConflict: epConflicts.length > 0,
        hasSynergy: epSynergies.length > 0,
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
  const episodeSegs = Array.from(new Set(epClaims.flatMap(c => c.marketSegments)));
  const epConflicts = epClaims.flatMap(c => c.conflicts);
  const epSynergies = epClaims.flatMap(c => c.synergies);

  let regimenType = 'Monotherapy';
  if (epConflicts.length > 0) regimenType = 'Restricted Duplication';
  else if (epSynergies.length > 0) regimenType = 'Dual Synergistic Combination';
  else if (episodeSegs.length > 1) regimenType = 'Multi-Segment Regimen';

  episodes.push({
    id: `EP-${episodes.length + 1}`,
    startDay: epStart,
    endDay: Math.min(epEnd, studyEndDay),
    duration: Math.min(epEnd, studyEndDay) - epStart,
    claimsCount: epClaims.length,
    claims: [...epClaims],
    marketSegments: episodeSegs,
    regimenType,
    hasConflict: epConflicts.length > 0,
    hasSynergy: epSynergies.length > 0,
    censored: isCensored,
    closureReason: isCensored ? 'End of Observation / Ongoing' : 'Exceeded Study Window'
  });

  const totalDuration = episodes.reduce((acc, ep) => acc + ep.duration, 0);
  const meanDuration = episodes.length > 0 ? totalDuration / episodes.length : 0;
  const ongoing = episodes.some(ep => ep.censored);

  const uniqueActiveSegments = Array.from(new Set(adjustedClaims.flatMap(c => c.marketSegments)));
  const totalConflicts = overlapIntervals.filter(o => o.type === 'conflict' || o.type === 'cap_exceeded').length;
  const totalSynergies = overlapIntervals.filter(o => o.type === 'synergistic_combination' || o.type === 'synergy').length;

  return {
    episodes,
    adjustedClaims,
    overlapIntervals,
    stats: {
      totalEpisodes: episodes.length,
      meanDuration,
      totalSupplyDays: adjustedClaims.reduce((acc, c) => acc + c.daysSupply, 0),
      isOngoing: ongoing,
      closureCount: episodes.filter(e => !e.censored).length,
      activeSegmentsCount: uniqueActiveSegments.length,
      conflictCount: totalConflicts,
      synergyCount: totalSynergies
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

