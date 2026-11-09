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
 * @param {Array|Object} rulesOrMatrix - Restriction rules list OR restriction matrix map [segA][segB]
 * @param {boolean} enforceHard - Whether hard restrictions are strictly enforced
 * @returns {{ allowed: boolean, status: 'compatible'|'synergistic'|'conflict', rule: Object|null, reason: string }}
 */
export function checkMarketCompatibility(currentSegments = [], candidateSegment, rulesOrMatrix = DEFAULT_RESTRICTION_RULES, enforceHard = false) {
  if (!candidateSegment) return { allowed: true, status: 'compatible', rule: null, reason: 'Valid market segment' };
  if (currentSegments.includes(candidateSegment)) {
    return { allowed: true, status: 'compatible', rule: null, reason: 'Already selected in regimen' };
  }

  // 1. Check via Restriction Matrix mapping [segA][segB] -> 'restricted' | 'synergistic' | 'allowed'
  if (rulesOrMatrix && typeof rulesOrMatrix === 'object' && !Array.isArray(rulesOrMatrix)) {
    const matrix = rulesOrMatrix;
    for (const seg of currentSegments) {
      const status = matrix[seg]?.[candidateSegment] || matrix[candidateSegment]?.[seg] || 'allowed';
      if (status === 'restricted' || status === 'prohibited') {
        return {
          allowed: !enforceHard,
          status: 'conflict',
          rule: {
            id: `rule-${seg}-${candidateSegment}`,
            name: `${seg} + ${candidateSegment} Restriction`,
            type: 'prohibited_overlap',
            title: `Therapeutic Duplication (${seg} + ${candidateSegment})`,
            description: `Restricted combination in active multi-market restriction matrix.`
          },
          reason: `Restricted overlap with active ${seg}`
        };
      }
      if (status === 'synergistic') {
        return {
          allowed: true,
          status: 'synergistic',
          rule: {
            id: `rule-${seg}-${candidateSegment}`,
            name: `${seg} + ${candidateSegment} Synergy`,
            type: 'synergistic_combination',
            title: `Synergistic Combination (${seg} + ${candidateSegment})`,
            description: `Guideline-approved combination in restriction matrix.`
          },
          reason: `Synergistic combination with ${seg}`
        };
      }
    }
    return { allowed: true, status: 'compatible', rule: null, reason: 'Compatible therapy' };
  }

  // 2. Fallback to Array of Restriction Rules
  const rules = Array.isArray(rulesOrMatrix) ? rulesOrMatrix : DEFAULT_RESTRICTION_RULES;

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
 * @returns {{ episodes: Array, segmentEpisodes: Object, adjustedClaims: Array, stats: Object, overlapIntervals: Array }}
 */
export function buildTreatmentEpisodes(rawClaims, allowableGapDays = 30, overlapMethod = 'stockpile', studyEndDay = 365, options = {}) {
  if (!rawClaims || rawClaims.length === 0) {
    return {
      episodes: [],
      segmentEpisodes: {},
      adjustedClaims: [],
      overlapIntervals: [],
      stats: { totalEpisodes: 0, meanDuration: 0, persistenceRate: 0, conflictCount: 0, synergyCount: 0, activeSegmentsCount: 0, totalSupplyDays: 0, isOngoing: false, closureCount: 0 }
    };
  }

  const rules = options.rules || DEFAULT_RESTRICTION_RULES;
  const matrix = options.restrictionMatrix || null;
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

        // Check pairwise restrictions
        let foundConflict = false;
        let foundSynergy = false;

        for (const s1 of segs1) {
          for (const s2 of segs2) {
            if (s1 === s2) continue; // Same segment overlap is handled by stockpile/truncate

            let isRestricted = false;
            let isSynergistic = false;
            let ruleObj = null;

            if (matrix) {
              const status = matrix[s1]?.[s2] || matrix[s2]?.[s1] || 'allowed';
              if (status === 'restricted' || status === 'prohibited') {
                isRestricted = true;
                ruleObj = {
                  id: `rule-${s1}-${s2}`,
                  name: `${s1} + ${s2} Restriction`,
                  type: 'prohibited_overlap',
                  title: `Therapeutic Duplication (${s1} + ${s2})`,
                  description: `Disallowed concurrent overlap in restriction matrix.`
                };
              } else if (status === 'synergistic') {
                isSynergistic = true;
                ruleObj = {
                  id: `rule-${s1}-${s2}`,
                  name: `${s1} + ${s2} Synergy`,
                  type: 'synergistic_combination',
                  title: `Synergistic Combination (${s1} + ${s2})`,
                  description: `Guideline-recommended combination in restriction matrix.`
                };
              }
            } else {
              const conflictRule = rules.find(r => r.enabled && r.type === 'prohibited_overlap' && (
                (r.pair[0] === s1 && r.pair[1] === s2) ||
                (r.pair[1] === s1 && r.pair[0] === s2)
              ));
              if (conflictRule) {
                isRestricted = true;
                ruleObj = conflictRule;
              } else {
                const synergyRule = rules.find(r => r.enabled && r.type === 'synergistic_combination' && (
                  (r.pair[0] === s1 && r.pair[1] === s2) ||
                  (r.pair[1] === s1 && r.pair[0] === s2)
                ));
                if (synergyRule) {
                  isSynergistic = true;
                  ruleObj = synergyRule;
                }
              }
            }

            // 1. Prohibited Overlap / Duplication
            if (isRestricted) {
              foundConflict = true;

              // If Hard Restrictions are enforced: truncate prior conflicting therapy on switch!
              if (enforceHard) {
                if (c1.effectiveStart < c2.effectiveStart && c1.effectiveEnd > c2.effectiveStart) {
                  const truncAmt = c1.effectiveEnd - c2.effectiveStart;
                  c1.truncatedDays = (c1.truncatedDays || 0) + truncAmt;
                  c1.effectiveEnd = c2.effectiveStart;
                } else if (c2.effectiveStart < c1.effectiveStart && c2.effectiveEnd > c1.effectiveStart) {
                  const truncAmt = c2.effectiveEnd - c1.effectiveStart;
                  c2.truncatedDays = (c2.truncatedDays || 0) + truncAmt;
                  c2.effectiveEnd = c1.effectiveStart;
                }
              }

              c1.conflicts.push({ rule: ruleObj, withClaimId: c2.id, segment: s2, start: overlapStart, end: overlapEnd });
              c2.conflicts.push({ rule: ruleObj, withClaimId: c1.id, segment: s1, start: overlapStart, end: overlapEnd });
              overlapIntervals.push({
                start: overlapStart,
                end: overlapEnd,
                duration: overlapEnd - overlapStart,
                claims: [c1.id, c2.id],
                segments: [s1, s2],
                type: 'conflict',
                severity: 'error',
                rule: ruleObj,
                title: ruleObj.title,
                description: ruleObj.description
              });
            }

            // 2. Synergistic Combination
            if (isSynergistic && !foundConflict) {
              foundSynergy = true;
              c1.synergies.push({ rule: ruleObj, withClaimId: c2.id, segment: s2, start: overlapStart, end: overlapEnd });
              c2.synergies.push({ rule: ruleObj, withClaimId: c1.id, segment: s1, start: overlapStart, end: overlapEnd });
              overlapIntervals.push({
                start: overlapStart,
                end: overlapEnd,
                duration: overlapEnd - overlapStart,
                claims: [c1.id, c2.id],
                segments: [s1, s2],
                type: 'synergy',
                severity: 'success',
                rule: ruleObj,
                title: ruleObj.title,
                description: ruleObj.description
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

  // Ensure claims are sorted chronologically after all adjustments
  const chronoSorted = [...adjustedClaims].sort((a, b) => {
    if (a.effectiveStart !== b.effectiveStart) return a.effectiveStart - b.effectiveStart;
    return a.effectiveEnd - b.effectiveEnd;
  });

  // ── Construct Continuous Treatment Episodes (Unified Regimen) ──
  const episodes = [];
  let epStart = chronoSorted[0].effectiveStart;
  let epEnd = chronoSorted[0].effectiveEnd;
  let epClaims = [chronoSorted[0]];

  for (let i = 1; i < chronoSorted.length; i++) {
    const claim = chronoSorted[i];
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

  // ── Construct Segment-Specific Treatment Episodes ──
  const segmentEpisodes = {};
  const presentSegments = Array.from(new Set(chronoSorted.flatMap(c => c.marketSegments)));

  for (const seg of presentSegments) {
    const segClaims = chronoSorted.filter(c => c.marketSegments.includes(seg));
    if (segClaims.length === 0) continue;

    const sEps = [];
    let sStart = segClaims[0].effectiveStart;
    let sEnd = segClaims[0].effectiveEnd;
    let sList = [segClaims[0]];

    for (let i = 1; i < segClaims.length; i++) {
      const c = segClaims[i];
      const gap = c.effectiveStart - sEnd;
      if (gap <= allowableGapDays) {
        sEnd = Math.max(sEnd, c.effectiveEnd);
        sList.push(c);
      } else {
        sEps.push({
          id: `${seg}-EP-${sEps.length + 1}`,
          segment: seg,
          startDay: sStart,
          endDay: Math.min(sEnd, studyEndDay),
          duration: Math.min(sEnd, studyEndDay) - sStart,
          claimsCount: sList.length,
          claims: [...sList],
          censored: sEnd >= studyEndDay
        });
        sStart = c.effectiveStart;
        sEnd = c.effectiveEnd;
        sList = [c];
      }
    }
    sEps.push({
      id: `${seg}-EP-${sEps.length + 1}`,
      segment: seg,
      startDay: sStart,
      endDay: Math.min(sEnd, studyEndDay),
      duration: Math.min(sEnd, studyEndDay) - sStart,
      claimsCount: sList.length,
      claims: [...sList],
      censored: sEnd >= studyEndDay
    });
    segmentEpisodes[seg] = sEps;
  }

  const totalDuration = episodes.reduce((acc, ep) => acc + ep.duration, 0);
  const meanDuration = episodes.length > 0 ? totalDuration / episodes.length : 0;
  const ongoing = episodes.some(ep => ep.censored);

  const uniqueActiveSegments = Array.from(new Set(adjustedClaims.flatMap(c => c.marketSegments)));
  const totalConflicts = overlapIntervals.filter(o => o.type === 'conflict' || o.type === 'cap_exceeded').length;
  const totalSynergies = overlapIntervals.filter(o => o.type === 'synergistic_combination' || o.type === 'synergy').length;

  return {
    episodes,
    segmentEpisodes,
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

// ─── 7. Prescriber Concentration, Deciles & SFE Analytics ────────

/**
 * Computes Lorenz Curve coordinates, Gini Coefficient, and Concentration Ratios.
 * @param {number[]} values - Array of prescriber volumes (TRx or NRx)
 * @returns {Object} Lorenz points, Gini, and concentration benchmarks
 */
export function computeLorenzAndGini(values) {
  if (!values || values.length === 0) {
    return { x: [0, 1], y: [0, 1], gini: 0, top10Share: 0, top20Share: 0, crossover80DoctorPct: 20 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let totalSum = 0;
  for (let i = 0; i < n; i++) totalSum += sorted[i];

  if (totalSum === 0) {
    return { x: [0, 1], y: [0, 1], gini: 0, top10Share: 0, top20Share: 0, crossover80DoctorPct: 20 };
  }

  // Sample ~100 points for smooth plot rendering
  const step = Math.max(1, Math.floor(n / 100));
  const x = [0];
  const y = [0];
  let runningSum = 0;
  let areaUnderLorenz = 0;
  let prevX = 0;
  let prevY = 0;

  for (let i = 0; i < n; i++) {
    runningSum += sorted[i];
    const currX = (i + 1) / n;
    const currY = runningSum / totalSum;

    // Trapezoidal area calculation for exact Gini
    areaUnderLorenz += ((prevY + currY) / 2) * (currX - prevX);
    prevX = currX;
    prevY = currY;

    if ((i + 1) % step === 0 || i === n - 1) {
      x.push(currX * 100);
      y.push(currY * 100);
    }
  }

  const gini = Math.max(0, Math.min(1, 1 - 2 * areaUnderLorenz));

  // Top 10% and Top 20% volume shares
  const idx90 = Math.floor(n * 0.9);
  const idx80 = Math.floor(n * 0.8);
  
  let sumTop10 = 0;
  for (let i = idx90; i < n; i++) sumTop10 += sorted[i];
  const top10Share = (sumTop10 / totalSum) * 100;

  let sumTop20 = 0;
  for (let i = idx80; i < n; i++) sumTop20 += sorted[i];
  const top20Share = (sumTop20 / totalSum) * 100;

  // Crossover: What percentage of top doctors produce 80% of volume?
  let sumFromTop = 0;
  let crossover80DoctorPct = 20;
  for (let i = n - 1; i >= 0; i--) {
    sumFromTop += sorted[i];
    if (sumFromTop >= totalSum * 0.8) {
      crossover80DoctorPct = ((n - i) / n) * 100;
      break;
    }
  }

  return {
    x,
    y,
    gini,
    top10Share,
    top20Share,
    crossover80DoctorPct,
    totalVolume: totalSum,
    hcpCount: n
  };
}

export const REGIONS_LIST = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West'];

/**
 * Generates a realistic synthetic prescriber universe with customizable Gini skew.
 */
export function generateHCPUniverse({ count = 2500, giniSkew = 0.75, brandBaseShare = 0.32, specialty = 'Cardiometabolic' } = {}) {
  // Approximate log-normal sigma from target Gini: Gini ~ erf(sigma / 2) => sigma ~ 2 * erf_inv(Gini)
  // For quick approximation: sigma ~ 1.77 * giniSkew / (1 - 0.45 * giniSkew)
  const sigma = Math.max(0.3, Math.min(2.8, (1.8 * giniSkew) / (1 - 0.48 * giniSkew)));
  const mu = 2.8; // Baseline volume scaling

  // PRNG seed or Box-Muller for reproducible distribution
  const hcps = [];
  const regionWeights = [0.24, 0.28, 0.20, 0.14, 0.14]; // NE, SE, MW, SW, W

  for (let i = 0; i < count; i++) {
    // Standard normal via Box-Muller
    const u1 = Math.max(1e-7, (Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1);
    const u2 = Math.max(1e-7, (Math.cos(i * 4.898 + 12.233) * 23421.631) % 1);
    const z0 = Math.sqrt(-2.0 * Math.log(Math.abs(u1))) * Math.cos(2.0 * Math.PI * Math.abs(u2));
    
    // Log-normal monthly TRx volume
    const rawVolume = Math.exp(mu + sigma * z0);
    const marketTRx = Math.max(1, Math.round(rawVolume));

    // Assign region based on cumulative weights
    const rVal = Math.abs((Math.sin(i * 37.1 + 19.3) * 10000) % 1);
    let region = REGIONS_LIST[0];
    let cumW = 0;
    for (let r = 0; r < REGIONS_LIST.length; r++) {
      cumW += regionWeights[r];
      if (rVal <= cumW) {
        region = REGIONS_LIST[r];
        break;
      }
    }

    // Regional share variation (e.g. Northeast and Midwest slightly higher brand adoption)
    let regShareModifier = 1.0;
    if (region === 'Northeast') regShareModifier = 1.15;
    else if (region === 'West') regShareModifier = 0.88; // HMO/managed care restriction
    else if (region === 'Southeast') regShareModifier = 1.05;

    // Doctor brand loyalty skew
    const doctorPreference = 0.8 + 0.4 * (Math.abs(Math.sin(i * 7.7 + 3.1) * 100) % 1);
    const brandShare = Math.min(0.92, Math.max(0.04, brandBaseShare * regShareModifier * doctorPreference));
    const brandTRx = Math.round(marketTRx * brandShare);
    const competitorTRx = marketTRx - brandTRx;

    hcps.push({
      id: `HCP-${10000 + i}`,
      specialty,
      region,
      marketTRx,
      brandTRx,
      competitorTRx,
      brandShare: (brandTRx / marketTRx) * 100
    });
  }

  // Sort by marketTRx ascending to assign deciles and quintiles
  hcps.sort((a, b) => a.marketTRx - b.marketTRx);

  for (let i = 0; i < hcps.length; i++) {
    const pct = (i + 1) / hcps.length;
    // Decile: 1 to 10
    const decile = Math.min(10, Math.floor(pct * 10) + 1);
    // Quintile: 1 to 5
    const quintile = Math.min(5, Math.floor(pct * 5) + 1);
    
    hcps[i].decile = decile;
    hcps[i].quintile = quintile;

    // Recommended target calls based on decile
    const decileCalls = {
      10: 3.0, 9: 2.5, 8: 2.0, 7: 1.5, 6: 1.0, 5: 0.5, 4: 0.2, 3: 0.1, 2: 0.05, 1: 0.0
    };
    hcps[i].targetMonthlyCalls = decileCalls[decile] || 0.1;
  }

  return hcps;
}

/**
 * Aggregates HCP universe into Deciles (10) or Quintiles (5).
 */
export function aggregateQuantiles(hcps, mode = 'decile', cutoffTier = 7) {
  const isQuintile = mode === 'quintile';
  const numTiers = isQuintile ? 5 : 10;
  const tiers = [];

  const totalMarketTRx = hcps.reduce((acc, h) => acc + h.marketTRx, 0);
  const totalBrandTRx = hcps.reduce((acc, h) => acc + h.brandTRx, 0);

  let runningCumTRx = 0;

  for (let t = 1; t <= numTiers; t++) {
    const tierHcps = hcps.filter(h => (isQuintile ? h.quintile : h.decile) === t);
    const count = tierHcps.length;
    const tierMarketTRx = tierHcps.reduce((acc, h) => acc + h.marketTRx, 0);
    const tierBrandTRx = tierHcps.reduce((acc, h) => acc + h.brandTRx, 0);
    const tierCompTRx = tierMarketTRx - tierBrandTRx;

    runningCumTRx += tierMarketTRx;

    const volumeShare = totalMarketTRx > 0 ? (tierMarketTRx / totalMarketTRx) * 100 : 0;
    const cumVolumeShare = totalMarketTRx > 0 ? (runningCumTRx / totalMarketTRx) * 100 : 0;
    const brandShare = tierMarketTRx > 0 ? (tierBrandTRx / tierMarketTRx) * 100 : 0;
    const avgTRx = count > 0 ? tierMarketTRx / count : 0;

    const recommendedCallsPerHCP = isQuintile 
      ? [0.1, 0.5, 1.2, 2.0, 3.0][t - 1]
      : [0.05, 0.1, 0.2, 0.4, 0.8, 1.2, 1.6, 2.2, 2.6, 3.2][t - 1];

    const isTargeted = t >= cutoffTier;

    tiers.push({
      tier: isQuintile ? `Quintile ${t}` : `Decile ${t}`,
      tierNumber: t,
      hcpCount: count,
      hcpPct: (count / hcps.length) * 100,
      marketTRx: tierMarketTRx,
      brandTRx: tierBrandTRx,
      competitorTRx: tierCompTRx,
      volumeShare,
      cumVolumeShare,
      brandShare,
      avgTRx,
      recommendedCallsPerHCP,
      totalTargetCalls: count * recommendedCallsPerHCP,
      isTargeted
    });
  }

  return {
    tiers,
    totalMarketTRx,
    totalBrandTRx,
    overallBrandShare: totalMarketTRx > 0 ? (totalBrandTRx / totalMarketTRx) * 100 : 0,
    totalHCPs: hcps.length
  };
}

/**
 * Aggregates territory performance by geographic region.
 */
export function aggregateRegions(hcps, repHeadcount = 60, callsPerRepMonth = 110, cutoffTier = 7, mode = 'decile') {
  const isQuintile = mode === 'quintile';
  const totalReps = Math.max(1, repHeadcount);
  const repAllocationByRegion = {
    'Northeast': Math.round(totalReps * 0.26),
    'Southeast': Math.round(totalReps * 0.28),
    'Midwest': Math.round(totalReps * 0.20),
    'Southwest': Math.round(totalReps * 0.14),
    'West': Math.max(1, totalReps - Math.round(totalReps * 0.26) - Math.round(totalReps * 0.28) - Math.round(totalReps * 0.20) - Math.round(totalReps * 0.14))
  };

  const regions = [];

  for (const regName of REGIONS_LIST) {
    const regHcps = hcps.filter(h => h.region === regName);
    const count = regHcps.length;
    const marketTRx = regHcps.reduce((acc, h) => acc + h.marketTRx, 0);
    const brandTRx = regHcps.reduce((acc, h) => acc + h.brandTRx, 0);
    const brandShare = marketTRx > 0 ? (brandTRx / marketTRx) * 100 : 0;

    const targetHcps = regHcps.filter(h => (isQuintile ? h.quintile : h.decile) >= cutoffTier);
    const targetHcpCount = targetHcps.length;

    // Target call demand
    let monthlyCallDemand = 0;
    targetHcps.forEach(h => {
      monthlyCallDemand += h.targetMonthlyCalls || 1.5;
    });

    const reps = repAllocationByRegion[regName] || 1;
    const capacityCalls = reps * callsPerRepMonth;
    const deliveredCalls = Math.min(capacityCalls, monthlyCallDemand);
    const coveragePct = monthlyCallDemand > 0 ? Math.min(100, (deliveredCalls / monthlyCallDemand) * 100) : 100;

    // Simulated Share of Voice (SOV)
    const sov = Math.min(45, Math.max(12, (coveragePct / 100) * 36 + (reps / totalReps) * 10));
    
    // Quota attainment %
    const quotaBase = marketTRx * 0.32;
    const quotaAttainment = quotaBase > 0 ? Math.min(135, Math.max(65, (brandTRx / quotaBase) * 100)) : 100;

    regions.push({
      region: regName,
      hcpCount: count,
      targetHcpCount,
      marketTRx,
      brandTRx,
      brandShare,
      reps,
      capacityCalls,
      monthlyCallDemand,
      deliveredCalls,
      coveragePct,
      sov,
      quotaAttainment
    });
  }

  return regions;
}

// ─── 8. Patient Demographics, Comorbidities & CCI Scoring ────────

export const CHARLSON_DEFINITIONS = [
  { id: 'mi', label: 'Myocardial Infarction', weight: 1, category: 'Cardiovascular' },
  { id: 'chf', label: 'Congestive Heart Failure', weight: 1, category: 'Cardiovascular' },
  { id: 'pvd', label: 'Peripheral Vascular Disease', weight: 1, category: 'Vascular' },
  { id: 'cevd', label: 'Cerebrovascular Disease / TIA', weight: 1, category: 'Neurological' },
  { id: 'dementia', label: 'Dementia / Cognitive Decline', weight: 1, category: 'Neurological' },
  { id: 'copd', label: 'Chronic Pulmonary Disease (COPD)', weight: 1, category: 'Respiratory' },
  { id: 'rheum', label: 'Rheumatologic / Connective Tissue', weight: 1, category: 'Autoimmune' },
  { id: 't2d_uncomplicated', label: 'Diabetes without Complications', weight: 1, category: 'Endocrine' },
  { id: 't2d_complicated', label: 'Diabetes with Chronic Damage', weight: 2, category: 'Endocrine' },
  { id: 'ckd_mod_sev', label: 'Moderate/Severe CKD (Stage 3-5)', weight: 2, category: 'Renal' },
  { id: 'malignancy', label: 'Solid Tumor Malignancy', weight: 2, category: 'Oncology' },
  { id: 'htn', label: 'Essential Hypertension', weight: 0, category: 'Cardiovascular' }, // Non-CCI standard chronic
  { id: 'obesity', label: 'Obesity (BMI ≥ 30)', weight: 0, category: 'Metabolic' },       // Common real-world co-occurring
  { id: 'dyslipidemia', label: 'Dyslipidemia / Hyperlipidemia', weight: 0, category: 'Metabolic' }
];

/**
 * Calculates Charlson Comorbidity Index (CCI) for a given set of condition flags.
 */
export function calculateCCI(conditionsMap) {
  let score = 0;
  if (conditionsMap.mi) score += 1;
  if (conditionsMap.chf) score += 1;
  if (conditionsMap.pvd) score += 1;
  if (conditionsMap.cevd) score += 1;
  if (conditionsMap.dementia) score += 1;
  if (conditionsMap.copd) score += 1;
  if (conditionsMap.rheum) score += 1;

  // Diabetes mutual exclusion: complicated (+2) supersedes uncomplicated (+1)
  if (conditionsMap.t2d_complicated) {
    score += 2;
  } else if (conditionsMap.t2d_uncomplicated) {
    score += 1;
  }

  if (conditionsMap.ckd_mod_sev) score += 2;
  if (conditionsMap.malignancy) score += 2;

  return score;
}

/**
 * Generates synthetic longitudinal patient cohort with demographics, payer mix, and comorbidities.
 */
export function generatePatientCohort({
  count = 3000,
  meanAge = 62,
  comorbidityMultiplier = 1.0,
  cohortPreset = 't2d_metabolic',
  payerShift = 0 // -1 Commercial biased, +1 Medicare biased
} = {}) {
  const patients = [];
  const ageStd = 10.5;

  for (let i = 0; i < count; i++) {
    // 1. Age generation (normal clipped between 18 and 92)
    const u1 = Math.max(1e-7, (Math.sin(i * 19.123 + 45.67) * 43758.5) % 1);
    const u2 = Math.max(1e-7, (Math.cos(i * 8.765 + 12.34) * 23421.6) % 1);
    const z0 = Math.sqrt(-2.0 * Math.log(Math.abs(u1))) * Math.cos(2.0 * Math.PI * Math.abs(u2));
    const age = Math.min(92, Math.max(18, Math.round(meanAge + z0 * ageStd)));

    // 2. Sex determination
    // Females have higher life expectancy in older age brackets
    const femaleProb = age > 75 ? 0.58 : 0.49;
    const isFemale = ((Math.sin(i * 3.33 + 7.11) * 1000) % 1) < femaleProb;
    const sex = isFemale ? 'Female' : 'Male';

    // 3. Payer Mix (Driven by Medicare age 65 threshold)
    let payer = 'Commercial';
    const payerRand = Math.abs((Math.sin(i * 14.7 + 89.2) * 1000) % 1);

    if (age >= 65) {
      // 65+ CMS Medicare dominance
      const medAdvantageProb = 0.52 + payerShift * 0.1;
      const medFFSProb = 0.40 - payerShift * 0.05;
      if (payerRand < medAdvantageProb) payer = 'Medicare Advantage';
      else if (payerRand < medAdvantageProb + medFFSProb) payer = 'Medicare FFS';
      else if (payerRand < 0.97) payer = 'Medicaid Dual';
      else payer = 'VA / Cash';
    } else {
      // < 65 Commercial dominance
      const commProb = Math.max(0.45, 0.72 - payerShift * 0.15);
      const medicaidProb = 0.20;
      if (payerRand < commProb) payer = 'Commercial';
      else if (payerRand < commProb + medicaidProb) payer = 'Medicaid';
      else payer = 'Employer Self-Insured';
    }

    // 4. Comorbidities Generation (Correlated Cardiorenal-Metabolic & Age-Dependent)
    const ageFactor = Math.max(0.4, (age - 35) / 35);
    const cm = comorbidityMultiplier;

    // Baseline chronic conditions
    const hasHTN = ((Math.sin(i * 2.1 + 11.2) * 500) % 1) < Math.min(0.92, (0.55 + 0.3 * ageFactor) * cm);
    const hasDyslip = ((Math.sin(i * 4.3 + 19.5) * 500) % 1) < Math.min(0.88, (0.50 + 0.25 * ageFactor) * cm);
    const hasObesity = ((Math.sin(i * 6.5 + 23.1) * 500) % 1) < Math.min(0.75, (0.42 - 0.05 * (age > 75 ? 1 : 0)) * cm);

    // Diabetes (Uncomplicated vs Complicated)
    const t2dBaseProb = cohortPreset === 't2d_metabolic' ? 0.95 : (cohortPreset === 'heart_failure' ? 0.48 : 0.22);
    const hasDiabetes = ((Math.sin(i * 8.7 + 31.8) * 500) % 1) < Math.min(0.98, t2dBaseProb * cm);
    const isComplicated = hasDiabetes && (((Math.sin(i * 9.9 + 5.5) * 500) % 1) < (0.35 * ageFactor));

    // Cardiorenal Comorbidities (clustering with Diabetes & HTN)
    const cardiorenalSynergy = (hasHTN ? 1.4 : 1.0) * (hasDiabetes ? 1.6 : 1.0);
    const hasCKD = ((Math.sin(i * 11.1 + 41.2) * 500) % 1) < Math.min(0.85, (0.12 * ageFactor * cardiorenalSynergy) * cm);
    const hasCHF = ((Math.sin(i * 13.3 + 53.6) * 500) % 1) < Math.min(0.80, (0.08 * ageFactor * cardiorenalSynergy) * cm);
    const hasCAD = ((Math.sin(i * 15.5 + 67.9) * 500) % 1) < Math.min(0.75, (0.14 * ageFactor * (hasHTN ? 1.3 : 1.0)) * cm);
    const hasCOPD = ((Math.sin(i * 17.7 + 79.1) * 500) % 1) < Math.min(0.60, (0.10 * ageFactor) * cm);
    const hasMalignancy = ((Math.sin(i * 19.9 + 83.4) * 500) % 1) < Math.min(0.50, (0.06 * ageFactor + (cohortPreset === 'oncology' ? 0.70 : 0)) * cm);

    const conditions = {
      htn: hasHTN,
      dyslipidemia: hasDyslip,
      obesity: hasObesity,
      t2d_uncomplicated: hasDiabetes && !isComplicated,
      t2d_complicated: isComplicated,
      ckd_mod_sev: hasCKD,
      chf: hasCHF,
      mi: hasCAD && (((Math.sin(i * 1.5 + 2.7) * 200) % 1) < 0.4),
      pvd: hasCAD && (((Math.sin(i * 3.8 + 4.9) * 200) % 1) < 0.35),
      cevd: ((Math.sin(i * 5.1 + 8.2) * 200) % 1) < (0.06 * ageFactor),
      dementia: age > 75 && (((Math.sin(i * 7.3 + 9.1) * 200) % 1) < 0.14),
      copd: hasCOPD,
      rheum: ((Math.sin(i * 12.2 + 3.4) * 200) % 1) < (cohortPreset === 'autoimmune' ? 0.85 : 0.05),
      malignancy: hasMalignancy
    };

    const cci = calculateCCI(conditions);

    // Risk Quintile assignment
    let riskQuintile = 1;
    if (cci === 0) riskQuintile = 1;
    else if (cci === 1) riskQuintile = 2;
    else if (cci === 2) riskQuintile = 3;
    else if (cci >= 3 && cci <= 4) riskQuintile = 4;
    else riskQuintile = 5;

    // 12-Month Adherence (PDC %) simulation
    // Multimorbidity & age cause polypharmacy burden, diminishing adherence
    const basePDC = 0.88;
    const cciAdherencePenalty = cci * 0.038;
    const ageAdherenceFactor = age > 80 ? -0.06 : (age > 65 ? 0.02 : 0);
    const noise = (((Math.sin(i * 22.3 + 14.5) * 1000) % 1) - 0.5) * 0.12;
    const pdc = Math.max(0.20, Math.min(1.0, basePDC - cciAdherencePenalty + ageAdherenceFactor + noise));

    // 12-Month Persistence (Discontinuation Rate)
    const baseDiscontinuation = 0.18;
    const discontinuationRate = Math.min(0.85, Math.max(0.08, baseDiscontinuation + cci * 0.065 - (pdc > 0.8 ? 0.1 : 0)));

    // Inpatient Hospitalization Risk %
    const hospRisk = Math.min(95, Math.max(3, 4 + cci * 7.5 + (hasCHF ? 14 : 0) + (hasCKD ? 10 : 0)));

    patients.push({
      id: `PAT-${100000 + i}`,
      age,
      sex,
      payer,
      conditions,
      cci,
      riskQuintile,
      pdc: pdc * 100,
      isAdherent: pdc >= 0.80,
      discontinued: (((Math.sin(i * 29.1 + 9.8) * 1000) % 1) < discontinuationRate),
      hospRisk
    });
  }

  return patients;
}

/**
 * Computes symmetric co-occurrence and correlation matrix for key comorbidities.
 */
export function computeComorbidityHeatmap(patients, conditionKeys) {
  const n = patients.length;
  const labels = conditionKeys.map(k => {
    const found = CHARLSON_DEFINITIONS.find(d => d.id === k);
    return found ? found.label : k;
  });

  const matrix = [];
  const jaccardMatrix = [];

  for (let i = 0; i < conditionKeys.length; i++) {
    const rowCoCount = [];
    const rowJaccard = [];
    const keyA = conditionKeys[i];

    for (let j = 0; j < conditionKeys.length; j++) {
      const keyB = conditionKeys[j];
      let bothCount = 0;
      let eitherCount = 0;

      patients.forEach(p => {
        const hasA = p.conditions[keyA] || false;
        const hasB = p.conditions[keyB] || false;
        if (hasA && hasB) bothCount++;
        if (hasA || hasB) eitherCount++;
      });

      const coPct = n > 0 ? (bothCount / n) * 100 : 0;
      const jaccard = eitherCount > 0 ? bothCount / eitherCount : 0;

      rowCoCount.push(coPct);
      rowJaccard.push(jaccard);
    }
    matrix.push(rowCoCount);
    jaccardMatrix.push(rowJaccard);
  }

  return { labels, matrix, jaccardMatrix };
}

/**
 * Aggregates patient cohort by Risk Quintile (Q1 to Q5).
 */
export function aggregateCohortByQuintile(patients) {
  const quintiles = [];
  const quintileLabels = [
    'Q1 (Minimal Risk, CCI 0)',
    'Q2 (Mild Risk, CCI 1)',
    'Q3 (Moderate Risk, CCI 2)',
    'Q4 (High Risk, CCI 3-4)',
    'Q5 (Severe Multimorbid, CCI 5+)'
  ];

  for (let q = 1; q <= 5; q++) {
    const group = patients.filter(p => p.riskQuintile === q);
    const count = group.length;
    const pctOfCohort = (count / patients.length) * 100;
    const avgAge = count > 0 ? mean(group.map(p => p.age)) : 0;
    const femaleShare = count > 0 ? (group.filter(p => p.sex === 'Female').length / count) * 100 : 0;
    const avgCCI = count > 0 ? mean(group.map(p => p.cci)) : 0;
    const avgPDC = count > 0 ? mean(group.map(p => p.pdc)) : 0;
    const adherentShare = count > 0 ? (group.filter(p => p.isAdherent).length / count) * 100 : 0;
    const disconRate = count > 0 ? (group.filter(p => p.discontinued).length / count) * 100 : 0;
    const avgHospRisk = count > 0 ? mean(group.map(p => p.hospRisk)) : 0;

    quintiles.push({
      quintile: `Q${q}`,
      label: quintileLabels[q - 1],
      count,
      pctOfCohort,
      avgAge,
      femaleShare,
      avgCCI,
      avgPDC,
      adherentShare,
      disconRate,
      avgHospRisk
    });
  }

  return quintiles;
}


