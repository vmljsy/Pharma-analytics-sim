/**
 * Multi-Market Episode Building, Advanced Restrictions & Interactive Push-Pull Engine
 */
import {
  $,
  fmt,
  DARK_LAYOUT,
  buildTreatmentEpisodes,
  MARKET_SEGMENTS,
  DEFAULT_RESTRICTION_RULES,
  checkMarketCompatibility
} from '../../js/common.js';

// Pre-configured multi-market clinical scenarios
const SCENARIOS = {
  synergistic_combo: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 2, startDay: 30, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 3, startDay: 45, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] }, // Synergistic add-on at Day 45
    { id: 4, startDay: 60, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 5, startDay: 75, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] },
    { id: 6, startDay: 90, daysSupply: 60, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 7, startDay: 105, daysSupply: 60, drug: 'Ozempic (1.0mg)', marketSegments: ['GLP1'] },
  ],
  duplication_conflict: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Januvia (100mg)', marketSegments: ['DPP4'] },
    { id: 2, startDay: 30, daysSupply: 30, drug: 'Januvia (100mg)', marketSegments: ['DPP4'] },
    { id: 3, startDay: 40, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] }, // Incompatible overlap with DPP4!
    { id: 4, startDay: 70, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] },
    { id: 5, startDay: 130, daysSupply: 60, drug: 'Ozempic (1.0mg)', marketSegments: ['GLP1'] },
  ],
  early_refills: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] },
    { id: 2, startDay: 20, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] }, // 10-day early refill
    { id: 3, startDay: 45, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] }, // 5-day early refill against pushed supply
    { id: 4, startDay: 50, daysSupply: 30, drug: 'Lantus (20U)', marketSegments: ['INS'] }, // Concurrent Basal Insulin
    { id: 5, startDay: 110, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] },
    { id: 6, startDay: 150, daysSupply: 60, drug: 'Ozempic (1.0mg)', marketSegments: ['GLP1'] },
    { id: 7, startDay: 170, daysSupply: 30, drug: 'Lantus (20U)', marketSegments: ['INS'] },
  ],
  triple_therapy: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Metformin (1000mg)', marketSegments: ['MET'] },
    { id: 2, startDay: 20, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 3, startDay: 30, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] }, // 3rd class active: exceeds max cap of 2
    { id: 4, startDay: 60, daysSupply: 30, drug: 'Metformin (1000mg)', marketSegments: ['MET'] },
    { id: 5, startDay: 60, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 6, startDay: 60, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] },
  ],
  gap_discontinuation: [
    { id: 1, startDay: 0, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 2, startDay: 32, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 3, startDay: 65, daysSupply: 30, drug: 'Jardiance (10mg)', marketSegments: ['SGLT2'] },
    { id: 4, startDay: 160, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] }, // 65-day gap, switches to GLP-1
    { id: 5, startDay: 195, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] },
    { id: 6, startDay: 230, daysSupply: 30, drug: 'Ozempic (0.5mg)', marketSegments: ['GLP1'] },
  ]
};

export default function init() {
  let currentClaims = JSON.parse(JSON.stringify(SCENARIOS.synergistic_combo));
  let selectedClaimId = currentClaims[0]?.id || 1;
  let activeRules = JSON.parse(JSON.stringify(DEFAULT_RESTRICTION_RULES));
  let enforceHard = false;
  let maxConcurrentSegments = 2;

  // Dragging state for timeline canvas handles
  let dragMode = null; // 'left' (pull start), 'right' (pull duration), 'move' (shift start)
  let draggingClaimId = null;
  let dragStartX = 0;
  let dragInitialStartDay = 0;
  let dragInitialSupply = 0;

  // Zoom and Viewport State
  let zoomLevel = 1.0; // 0.6x to 3.5x

  // DOM elements
  const scenarioSelect = $('scenario-select');
  const overlapSelect = $('overlap-select');
  const gapSlider = $('gap-slider');
  const gapVal = $('gap-val');
  const windowSlider = $('window-slider');
  const windowVal = $('window-val');
  const btnAddClaim = $('btn-add-claim');
  const btnReset = $('btn-reset');

  const badgeStatus = $('badge-status');
  const badgeRestrictionsStatus = $('badge-restrictions-status');
  const calloutBox = $('callout-box');
  const calloutText = $('callout-text');
  const claimsTableBody = $('claims-table-body');

  const statEpisodes = $('stat-episodes');
  const statMeanDuration = $('stat-mean-duration');
  const statSupplyDays = $('stat-supply-days');
  const statMarketSegments = $('stat-market-segments');
  const statSynergies = $('stat-synergies');
  const statConflicts = $('stat-conflicts');
  const statClosures = $('stat-closures');
  const statOngoing = $('stat-ongoing');

  // Restrictions panel elements
  const switchHardRestrictions = $('switch-hard-restrictions');
  const selectMaxSegments = $('select-max-segments');
  const ruleCheckGlp1Dpp4 = $('rule-check-glp1-dpp4');
  const ruleCheckGlp1Dual = $('rule-check-glp1-dual');
  const ruleCheckSglt2Glp1 = $('rule-check-sglt2-glp1');

  // Inspector card elements
  const inspectorCard = $('inspector-card');
  const inspectorClaimId = $('inspector-claim-id');
  const inspectorDrugName = $('inspector-drug-name');
  const inspectorSegmentBadges = $('inspector-segment-badges');
  const inspectorCompatibilityPills = $('inspector-compatibility-pills');
  const inspectorCollisionAlert = $('inspector-collision-alert');

  const btnPull10 = $('btn-pull-10');
  const btnPull5 = $('btn-pull-5');
  const btnPush5 = $('btn-push-5');
  const btnPush10 = $('btn-push-10');
  const btnShrink15 = $('btn-shrink-15');
  const btnExtend15 = $('btn-extend-15');

  // Table action buttons
  const btnTableAddRow = $('btn-table-add-row');
  const btnTableDuplicate = $('btn-table-duplicate');
  const btnTableDelete = $('btn-table-delete');

  // SVG & Zoom/Fullscreen containers
  const interactiveTimelineBox = $('interactive-timeline-box');
  const canvasContainer = $('canvas-container');
  const timelineSvg = $('timeline-svg');
  const btnZoomIn = $('btn-zoom-in');
  const btnZoomOut = $('btn-zoom-out');
  const btnZoomReset = $('btn-zoom-reset');
  const zoomLevelBadge = $('zoom-level-badge');
  const btnToggleFullscreen = $('btn-toggle-fullscreen');
  const fullscreenText = $('fullscreen-text');

  // Plotly chart fullscreen elements
  const chartContainer = $('chart-container');
  const btnPlotlyFullscreen = $('btn-plotly-fullscreen');
  const plotlyFullscreenText = $('plotly-fullscreen-text');

  function getSelectedClaim() {
    return currentClaims.find(c => c.id === selectedClaimId) || currentClaims[0];
  }

  function syncRulesFromUI() {
    enforceHard = switchHardRestrictions?.checked ?? false;
    maxConcurrentSegments = parseInt(selectMaxSegments?.value, 10) || 2;

    const rGlp1Dpp4 = activeRules.find(r => r.id === 'rule-glp1-dpp4');
    if (rGlp1Dpp4 && ruleCheckGlp1Dpp4) rGlp1Dpp4.enabled = ruleCheckGlp1Dpp4.checked;

    const rGlp1Dual = activeRules.find(r => r.id === 'rule-glp1-dual');
    if (rGlp1Dual && ruleCheckGlp1Dual) rGlp1Dual.enabled = ruleCheckGlp1Dual.checked;

    const rSglt2Glp1 = activeRules.find(r => r.id === 'rule-sglt2-glp1');
    if (rSglt2Glp1 && ruleCheckSglt2Glp1) rSglt2Glp1.enabled = ruleCheckSglt2Glp1.checked;

    if (badgeRestrictionsStatus) {
      if (enforceHard) {
        badgeRestrictionsStatus.className = 'badge badge-rose';
        badgeRestrictionsStatus.textContent = 'Hard Restrict (Blocking)';
      } else {
        badgeRestrictionsStatus.className = 'badge badge-emerald';
        badgeRestrictionsStatus.textContent = 'Restrictions Active';
      }
    }
  }

  function render() {
    syncRulesFromUI();

    const allowableGap = parseInt(gapSlider.value, 10);
    const overlapMethod = overlapSelect.value;
    const studyEnd = parseInt(windowSlider.value, 10);

    gapVal.textContent = `${allowableGap} days`;
    windowVal.textContent = `${studyEnd} days`;

    // Ensure selected claim exists
    if (!currentClaims.some(c => c.id === selectedClaimId) && currentClaims.length > 0) {
      selectedClaimId = currentClaims[0].id;
    }

    // Run episode building engine with multi-market options
    const result = buildTreatmentEpisodes(currentClaims, allowableGap, overlapMethod, studyEnd, {
      rules: activeRules,
      enforceHard: enforceHard,
      maxConcurrentSegments: maxConcurrentSegments
    });
    const { episodes, adjustedClaims, stats, overlapIntervals } = result;

    // Update statistics
    statEpisodes.textContent = stats.totalEpisodes;
    statMeanDuration.textContent = `${fmt(stats.meanDuration, 1)} d`;
    statSupplyDays.textContent = `${stats.totalSupplyDays} d`;
    statMarketSegments.textContent = `${stats.activeSegmentsCount} class${stats.activeSegmentsCount === 1 ? '' : 'es'}`;
    statSynergies.textContent = `${stats.synergyCount} combo${stats.synergyCount === 1 ? '' : 's'}`;
    statConflicts.textContent = `${stats.conflictCount} violation${stats.conflictCount === 1 ? '' : 's'}`;
    statClosures.textContent = stats.closureCount;
    statOngoing.textContent = stats.isOngoing ? 'Yes' : 'No';

    // Badge styling
    if (overlapMethod === 'stockpile') {
      badgeStatus.className = 'badge badge-blue';
      badgeStatus.textContent = 'Push-Forward Stockpiling';
    } else if (overlapMethod === 'truncate') {
      badgeStatus.className = 'badge badge-rose';
      badgeStatus.textContent = 'Truncation / Overwrite';
    } else {
      badgeStatus.className = 'badge badge-amber';
      badgeStatus.textContent = 'Parallel Concurrent';
    }

    // Dynamic Clinical Insight Callout
    renderInsightCallout(adjustedClaims, overlapIntervals, overlapMethod);

    // Render Inspector Card for selected claim
    renderInspectorCard(adjustedClaims);

    // Populate Editable Claims & Episode Data Table
    renderClaimsTable(adjustedClaims, episodes, allowableGap);

    // Render Interactive SVG Timeline Track with Draggable Handles
    renderInteractiveSvgTimeline(adjustedClaims, episodes, overlapIntervals, studyEnd);

    // Render Macro Plotly Timeline
    renderPlotlyTimeline(adjustedClaims, episodes, overlapIntervals, studyEnd, allowableGap);
  }

  function renderInsightCallout(claims, intervals, overlapMethod) {
    const conflicts = intervals.filter(i => i.type === 'conflict' || i.type === 'cap_exceeded');
    const synergies = intervals.filter(i => i.type === 'synergy');

    if (conflicts.length > 0) {
      calloutBox.className = 'callout-insight callout-conflict';
      const c = conflicts[0];
      const segNames = c.segments.map(s => MARKET_SEGMENTS[s]?.name || s).join(' + ');
      calloutText.innerHTML = `
        <strong>Therapeutic Duplication Conflict Detected:</strong> Between Day ${c.start} and Day ${c.end}, 
        concurrent overlap of <strong>${segNames}</strong> occurs. ${c.description || 'This combination violates guideline restrictions.'}
        ${enforceHard ? '<span style="color: #fff; font-weight: 600;"> [Hard Enforcement Mode will prevent this pairing]</span>' : ''}
      `;
    } else if (synergies.length > 0) {
      calloutBox.className = 'callout-insight callout-synergy';
      const s = synergies[0];
      const segNames = s.segments.map(sg => MARKET_SEGMENTS[sg]?.name || sg).join(' + ');
      calloutText.innerHTML = `
        <strong>Guideline-Approved Synergistic Combination:</strong> Patient receives concurrent 
        <strong>${segNames}</strong> therapy from Day ${s.start} to Day ${s.end} (${s.duration} days). 
        ${s.description}
      `;
    } else {
      calloutBox.className = 'callout-insight';
      if (overlapMethod === 'stockpile') {
        const pushed = claims.filter(c => c.pushedDays > 0);
        const sumPushed = pushed.reduce((acc, c) => acc + c.pushedDays, 0);
        calloutText.innerHTML = `
          <strong>Push-Forward Stockpiling Active:</strong> ${pushed.length} refill(s) accumulated remaining pills within their respective market segments.
          New fills were pushed forward by an aggregate of <strong>${sumPushed} days</strong>, preserving patient days-of-supply.
        `;
      } else if (overlapMethod === 'truncate') {
        const trunc = claims.filter(c => c.truncatedDays > 0);
        const sumTrunc = trunc.reduce((acc, c) => acc + c.truncatedDays, 0);
        calloutText.innerHTML = `
          <strong>Truncation Logic:</strong> Early refills truncated previous prescription coverage by 
          <strong>${sumTrunc} supply days</strong>, reflecting dose escalation or discarded surplus.
        `;
      } else {
        calloutText.innerHTML = `
          <strong>Parallel Mode:</strong> Prescription claims run concurrently without shifting, resulting in multi-market overlap days.
        `;
      }
    }
  }

  function renderInspectorCard(adjustedClaims) {
    const claim = adjustedClaims.find(c => c.id === selectedClaimId) || adjustedClaims[0];
    if (!claim) {
      inspectorCard.style.display = 'none';
      return;
    }
    inspectorCard.style.display = 'flex';
    inspectorCard.classList.add('active-selection');

    inspectorClaimId.textContent = `Claim #${claim.id} Selected`;
    inspectorDrugName.textContent = `${claim.drug} (Day ${claim.startDay}, ${claim.daysSupply}d supply)`;

    // Render active segment chips
    const curSegs = claim.marketSegments || ['GLP1'];
    let segChipsHtml = '';
    curSegs.forEach(segKey => {
      const segDef = MARKET_SEGMENTS[segKey] || { name: segKey, color: '#38bdf8', bgLight: 'rgba(56,189,248,0.15)' };
      segChipsHtml += `
        <span class="segment-chip" style="background: ${segDef.bgLight}; border-color: ${segDef.color}; color: ${segDef.color};">
          ${segDef.name}
          ${curSegs.length > 1 ? `<span class="chip-remove" data-action="remove-seg" data-claim-id="${claim.id}" data-seg="${segKey}">&times;</span>` : ''}
        </span>
      `;
    });
    inspectorSegmentBadges.innerHTML = segChipsHtml;

    // Render live compatibility pills: which other markets can be added to this claim?
    let compatHtml = '';
    Object.keys(MARKET_SEGMENTS).forEach(segKey => {
      const isSelected = curSegs.includes(segKey);
      const segDef = MARKET_SEGMENTS[segKey];
      const compat = checkMarketCompatibility(curSegs, segKey, activeRules, enforceHard);

      if (isSelected) {
        compatHtml += `
          <span class="segment-chip" style="background: ${segDef.color}; color: #09090b; border-color: ${segDef.color}; font-weight: 600;" title="Active in this claim">
            ✓ ${segDef.name}
          </span>
        `;
      } else if (compat.status === 'conflict') {
        compatHtml += `
          <span class="segment-chip market-compat-btn ${enforceHard ? 'is-disabled' : ''}" 
                data-claim-id="${claim.id}" data-seg="${segKey}"
                style="background: rgba(244,63,94,0.15); border-color: #f43f5e; color: #fb7185; cursor: ${enforceHard ? 'not-allowed' : 'pointer'};" 
                title="${compat.reason} (Click to ${enforceHard ? 'view rule' : 'add with conflict'})">
            🚫 ${segDef.name} (${compat.reason})
          </span>
        `;
      } else if (compat.status === 'synergistic') {
        compatHtml += `
          <span class="segment-chip market-compat-btn" 
                data-claim-id="${claim.id}" data-seg="${segKey}"
                style="background: rgba(16,185,129,0.15); border-color: #10b981; color: #34d399; cursor: pointer;" 
                title="${compat.reason} (Click to add as synergistic combo)">
            ✨ + ${segDef.name} (Synergistic)
          </span>
        `;
      } else {
        compatHtml += `
          <span class="segment-chip market-compat-btn" 
                data-claim-id="${claim.id}" data-seg="${segKey}"
                style="background: rgba(255,255,255,0.04); border-color: var(--border); color: var(--muted-foreground); cursor: pointer;" 
                title="Compatible: Click to add">
            + ${segDef.name}
          </span>
        `;
      }
    });
    inspectorCompatibilityPills.innerHTML = compatHtml;

    // Live collision alerts for selected claim
    if (claim.conflicts && claim.conflicts.length > 0) {
      const c = claim.conflicts[0];
      inspectorCollisionAlert.innerHTML = `<span style="color: #f43f5e; font-weight: 600;">⚠️ Incompatible with Claim #${c.withClaimId} (${c.rule.title})</span>`;
    } else if (claim.synergies && claim.synergies.length > 0) {
      const s = claim.synergies[0];
      inspectorCollisionAlert.innerHTML = `<span style="color: #10b981; font-weight: 600;">✅ Synergistic combo with Claim #${s.withClaimId} (${s.rule.name})</span>`;
    } else {
      inspectorCollisionAlert.innerHTML = `<span style="color: var(--muted-subtle);">No active conflicts on this claim</span>`;
    }
  }

  function renderClaimsTable(claims, episodes, allowableGap) {
    let tableHtml = '';

    claims.forEach((claim, idx) => {
      const isSelected = claim.id === selectedClaimId;
      const curSegs = claim.marketSegments || ['GLP1'];
      const ep = episodes.find(e => e.claims.some(c => c.id === claim.id));
      const epLabel = ep ? `<span class="badge ${ep.hasConflict ? 'badge-rose' : 'badge-emerald'}" style="font-size: 0.75rem;">${ep.id}</span>` : '—';

      // Market Segment pills in table row
      let segChips = '';
      curSegs.forEach(s => {
        const def = MARKET_SEGMENTS[s] || { name: s, color: '#38bdf8', bgLight: 'rgba(56,189,248,0.15)' };
        segChips += `
          <span class="segment-chip" style="background: ${def.bgLight}; border-color: ${def.color}; color: ${def.color}; font-size: 0.65rem; padding: 0.15rem 0.4rem;">
            ${def.name}
          </span>
        `;
      });

      // Overlap & Restriction Status badge
      let statusBadge = '<span style="color: var(--muted-foreground);">Normal</span>';
      if (claim.conflicts && claim.conflicts.length > 0) {
        statusBadge = `<span class="badge badge-rose" title="${claim.conflicts[0].rule.title}">⚠️ Duplication</span>`;
      } else if (claim.synergies && claim.synergies.length > 0) {
        statusBadge = `<span class="badge badge-emerald" title="${claim.synergies[0].rule.name}">✅ Synergistic</span>`;
      } else if (claim.pushedDays > 0) {
        statusBadge = `<span class="badge badge-blue">Pushed +${claim.pushedDays}d</span>`;
      } else if (claim.truncatedDays > 0) {
        statusBadge = `<span class="badge badge-rose">Truncated -${claim.truncatedDays}d</span>`;
      }

      tableHtml += `
        <tr class="${isSelected ? 'selected-row' : ''}" data-claim-id="${claim.id}">
          <td style="text-align: center;">
            <input type="radio" name="table-sel" ${isSelected ? 'checked' : ''} class="claim-radio" data-id="${claim.id}">
          </td>
          <td>
            <span class="badge badge-outline" style="font-size: 0.75rem; font-family: var(--font-mono);">#${claim.id}</span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap;">
              ${segChips}
              <button class="handle-btn btn-table-seg-toggle" data-id="${claim.id}" style="padding: 0.1rem 0.35rem; font-size: 0.65rem;" title="Change Market Segment">✎</button>
            </div>
          </td>
          <td>
            <input type="text" class="table-num-input input-drug-name" data-id="${claim.id}" value="${claim.drug}" style="width: 130px; text-align: left;">
          </td>
          <td>
            <div class="table-input-group">
              <button class="table-stepper-btn btn-row-pull-5" data-id="${claim.id}" title="Pull 5 days earlier">‹</button>
              <input type="number" class="table-num-input input-start-day" data-id="${claim.id}" min="0" max="730" value="${claim.startDay}">
              <button class="table-stepper-btn btn-row-push-5" data-id="${claim.id}" title="Push 5 days later">›</button>
            </div>
          </td>
          <td>
            <div class="table-input-group">
              <button class="table-stepper-btn btn-row-shrink-15" data-id="${claim.id}" title="Shrink 15 days">‹</button>
              <input type="number" class="table-num-input input-days-supply" data-id="${claim.id}" min="5" max="180" step="5" value="${claim.daysSupply}">
              <button class="table-stepper-btn btn-row-extend-15" data-id="${claim.id}" title="Extend 15 days">›</button>
            </div>
          </td>
          <td>
            <span style="font-family: var(--font-mono); font-size: 0.75rem;">Day ${claim.effectiveStart} – ${claim.effectiveEnd}</span>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td>
            ${epLabel}
          </td>
          <td style="text-align: center;">
            <button class="handle-btn btn-row-delete" data-id="${claim.id}" style="color: #f43f5e; padding: 0.15rem 0.35rem;" title="Delete Claim">🗑️</button>
          </td>
        </tr>
      `;
    });

    claimsTableBody.innerHTML = tableHtml;
  }

  // ─── Render Interactive SVG Timeline Track with Draggable Handles ───
  function renderInteractiveSvgTimeline(claims, episodes, overlapIntervals, studyEnd) {
    const isFullscreen = interactiveTimelineBox?.classList.contains('is-fullscreen');
    const baseWidth = Math.max(canvasContainer.clientWidth || 800, 750);
    const svgWidth = Math.round(baseWidth * zoomLevel);
    const svgHeight = isFullscreen ? Math.max(window.innerHeight - 130, 520) : 260;

    timelineSvg.setAttribute('width', svgWidth);
    timelineSvg.setAttribute('height', svgHeight);
    timelineSvg.style.width = `${svgWidth}px`;
    timelineSvg.style.height = `${svgHeight}px`;

    if (zoomLevelBadge) {
      zoomLevelBadge.textContent = `${Math.round(zoomLevel * 100)}%`;
    }

    const marginLeft = 80;
    const marginRight = 40;
    const chartWidth = svgWidth - marginLeft - marginRight;
    const maxDay = Math.max(studyEnd + 30, 420);

    const scaleX = day => marginLeft + (day / maxDay) * chartWidth;
    const unscaleX = px => Math.max(0, Math.round(((px - marginLeft) / chartWidth) * maxDay));

    // Dynamic vertical coordinates for Fullscreen vs Normal mode
    const axisY = isFullscreen ? svgHeight - 35 : 230;
    const epTrackY = isFullscreen ? 40 : 32;
    const epTrackH = isFullscreen ? 32 : 26;
    const conflictY = isFullscreen ? 85 : 85;
    const conflictH = isFullscreen ? (svgHeight - 135) : 140;
    const claimsBaseY = isFullscreen ? 120 : 115;
    const claimSpacing = isFullscreen ? 44 : 36;
    const barHeight = isFullscreen ? 32 : 28;
    const lanesCount = isFullscreen ? 5 : 3;

    // 1. Time Axis
    const axisGroup = $('svg-time-axis');
    let axisHtml = `<line x1="${marginLeft}" y1="${axisY}" x2="${svgWidth - marginRight}" y2="${axisY}" stroke="var(--border)" stroke-width="1"/>`;
    const tickStep = zoomLevel >= 2.0 ? 15 : (zoomLevel >= 1.5 ? 20 : 30);

    for (let d = 0; d <= maxDay; d += tickStep) {
      const x = scaleX(d);
      axisHtml += `
        <line x1="${x}" y1="${axisY - 5}" x2="${x}" y2="${axisY + 5}" stroke="var(--border)" stroke-width="1"/>
        <text x="${x}" y="${axisY + 18}" font-size="10" font-family="Geist Mono, monospace" fill="var(--muted-foreground)" text-anchor="middle">D${d}</text>
      `;
    }

    if (zoomLevel >= 1.5) {
      const subStep = zoomLevel >= 2.5 ? 2 : 5;
      for (let d = 0; d <= maxDay; d += subStep) {
        if (d % tickStep !== 0) {
          const x = scaleX(d);
          axisHtml += `<line x1="${x}" y1="${axisY - 2}" x2="${x}" y2="${axisY + 2}" stroke="var(--border-subtle)" stroke-width="1"/>`;
        }
      }
    }

    // Observation window vertical line
    const censorX = scaleX(studyEnd);
    axisHtml += `
      <line x1="${censorX}" y1="15" x2="${censorX}" y2="${axisY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4"/>
      <text x="${censorX}" y="28" font-size="9" font-family="Geist, sans-serif" fill="#f87171" text-anchor="middle">End Study (${studyEnd}d)</text>
    `;
    axisGroup.innerHTML = axisHtml;

    // 2. Overlap Conflict & Synergy Background Regions
    const conflictGroup = $('svg-conflict-zones');
    let overlapHtml = '';
    overlapIntervals.forEach(iv => {
      const x0 = scaleX(iv.start);
      const x1 = scaleX(iv.end);
      const w = Math.max(4, x1 - x0);

      if (iv.type === 'conflict' || iv.type === 'cap_exceeded') {
        overlapHtml += `
          <rect x="${x0}" y="${conflictY}" width="${w}" height="${conflictH}" class="conflict-rect" rx="2">
            <title>${iv.title}: ${iv.description}</title>
          </rect>
          <text x="${x0 + w / 2}" y="${conflictY + 14}" font-size="9" font-family="Geist, sans-serif" fill="#f43f5e" text-anchor="middle" font-weight="600">⚠️ Collision</text>
        `;
      } else if (iv.type === 'synergy') {
        overlapHtml += `
          <rect x="${x0}" y="${conflictY}" width="${w}" height="${conflictH}" class="synergy-rect" rx="2">
            <title>${iv.title}</title>
          </rect>
          <text x="${x0 + w / 2}" y="${conflictY + 14}" font-size="9" font-family="Geist, sans-serif" fill="#10b981" text-anchor="middle" font-weight="600">✨ Synergistic</text>
        `;
      }
    });
    conflictGroup.innerHTML = overlapHtml;

    // 3. Track 0: Continuous Treatment Episodes Track
    const epGroup = $('svg-episodes-track');
    let epTrackHtml = `
      <text x="10" y="${epTrackY + 14}" font-size="11" font-weight="600" font-family="Geist, sans-serif" fill="var(--foreground)">Treatment Episodes</text>
    `;
    episodes.forEach(ep => {
      const x0 = scaleX(ep.startDay);
      const x1 = scaleX(ep.endDay);
      const w = Math.max(6, x1 - x0);
      const isCensored = ep.censored;
      const strokeColor = ep.hasConflict ? '#f43f5e' : (isCensored ? '#10b981' : '#38bdf8');
      const fillColor = ep.hasConflict ? 'rgba(244, 63, 94, 0.25)' : (isCensored ? 'rgba(16, 185, 129, 0.22)' : 'rgba(56, 189, 248, 0.22)');

      epTrackHtml += `
        <rect x="${x0}" y="${epTrackY}" width="${w}" height="${epTrackH}" rx="4" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8"/>
        <text x="${x0 + w / 2}" y="${epTrackY + epTrackH / 2 + 4}" font-size="10" font-family="Geist, sans-serif" fill="#fafafa" text-anchor="middle" font-weight="500">
          ${ep.id} &middot; ${ep.duration}d (${ep.regimenType})
        </text>
      `;

      if (!isCensored) {
        epTrackHtml += `
          <polygon points="${x1},${epTrackY - 6} ${x1 - 5},${epTrackY} ${x1 + 5},${epTrackY}" fill="#f43f5e"/>
          <text x="${x1}" y="${epTrackY - 10}" font-size="9" font-family="Geist, sans-serif" fill="#f87171" text-anchor="middle">Discontinued</text>
        `;
      }
    });
    epGroup.innerHTML = epTrackHtml;

    // 4. Track 1 & 2: Claims Swimmer Bars & Interactive Drag Handles
    const claimsGroup = $('svg-claims-track');
    const handlesGroup = $('svg-handles-layer');
    let claimsHtml = `
      <text x="10" y="${claimsBaseY + 12}" font-size="11" font-weight="600" font-family="Geist, sans-serif" fill="var(--foreground)">Prescription Claims</text>
      <text x="10" y="${claimsBaseY + 25}" font-size="9" font-family="Geist Mono, monospace" fill="var(--muted-foreground)">(Drag handles)</text>
    `;
    let handlesHtml = '';

    // Assign vertical lanes to claims based on their primary market segment or stagger
    claims.forEach((claim, idx) => {
      const isSelected = claim.id === selectedClaimId;
      const x0 = scaleX(claim.startDay);
      const x1 = scaleX(claim.startDay + claim.daysSupply);
      const w = Math.max(6, x1 - x0);

      // Stagger vertical lanes for clarity
      const y = claimsBaseY + (idx % lanesCount) * claimSpacing;

      const primSeg = claim.marketSegments?.[0] || 'GLP1';
      const segDef = MARKET_SEGMENTS[primSeg] || { color: '#38bdf8', bgLight: 'rgba(56,189,248,0.2)' };
      const barColor = segDef.color;
      const barBg = isSelected ? segDef.color : segDef.bgLight;

      claimsHtml += `
        <!-- Claim Bar Body (Click to select, drag to shift) -->
        <g class="interactive-bar ${isSelected ? 'is-selected' : ''}" data-claim-id="${claim.id}">
          <rect x="${x0}" y="${y}" width="${w}" height="${barHeight}" rx="4"
                fill="${barBg}" stroke="${barColor}" stroke-width="${isSelected ? 2.5 : 1.5}"
                fill-opacity="${isSelected ? 0.4 : 0.25}">
            <title>Rx #${claim.id}: ${claim.drug} (Day ${claim.startDay} - ${claim.startDay + claim.daysSupply}, ${claim.daysSupply}d)</title>
          </rect>
          <!-- Center Move Grip Cue -->
          <text x="${x0 + w / 2}" y="${y + barHeight / 2 + 4}" font-size="10" font-family="Geist Mono, monospace" fill="#ffffff" text-anchor="middle" font-weight="500" style="pointer-events: none;">
            ✥ #${claim.id} ${claim.drug.split(' ')[0]} (${claim.daysSupply}d)
          </text>
        </g>
      `;

      // Draw interactive handles on selected claim or all claims
      if (isSelected || claims.length <= 10) {
        // Left Handle (Push/Pull Start Day)
        handlesHtml += `
          <g class="drag-handle-left-grp" data-claim-id="${claim.id}" title="Drag to pull start earlier or push later">
            <circle cx="${x0}" cy="${y + barHeight / 2}" r="${isFullscreen ? 6.5 : 5.5}" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" class="drag-handle-left"/>
          </g>
        `;
        // Right Handle (Pull/Extend Days Supply)
        handlesHtml += `
          <g class="drag-handle-right-grp" data-claim-id="${claim.id}" title="Drag to pull/extend duration or shrink">
            <circle cx="${x1}" cy="${y + barHeight / 2}" r="${isFullscreen ? 6.5 : 5.5}" fill="#c084fc" stroke="#ffffff" stroke-width="1.5" class="drag-handle-right"/>
          </g>
        `;
      }
    });

    claimsGroup.innerHTML = claimsHtml;
    handlesGroup.innerHTML = handlesHtml;

    // Attach event listeners for SVG dragging
    attachSvgDragListeners(scaleX, unscaleX);
  }

  function attachSvgDragListeners(scaleX, unscaleX) {
    // 1. Bar selection & move drag
    const bars = timelineSvg.querySelectorAll('.interactive-bar');
    bars.forEach(bar => {
      bar.addEventListener('mousedown', e => {
        const id = parseInt(bar.getAttribute('data-claim-id'), 10);
        selectedClaimId = id;
        dragMode = 'move';
        draggingClaimId = id;
        dragStartX = e.clientX;
        const claim = currentClaims.find(c => c.id === id);
        dragInitialStartDay = claim.startDay;
        dragInitialSupply = claim.daysSupply;
        render();
        e.stopPropagation();
      });
    });

    // 2. Left Handle Drag (Start Day)
    const leftHandles = timelineSvg.querySelectorAll('.drag-handle-left');
    leftHandles.forEach(h => {
      h.addEventListener('mousedown', e => {
        const id = parseInt(h.parentElement.getAttribute('data-claim-id'), 10);
        selectedClaimId = id;
        dragMode = 'left';
        draggingClaimId = id;
        dragStartX = e.clientX;
        const claim = currentClaims.find(c => c.id === id);
        dragInitialStartDay = claim.startDay;
        dragInitialSupply = claim.daysSupply;
        e.stopPropagation();
      });
    });

    // 3. Right Handle Drag (Supply Duration)
    const rightHandles = timelineSvg.querySelectorAll('.drag-handle-right');
    rightHandles.forEach(h => {
      h.addEventListener('mousedown', e => {
        const id = parseInt(h.parentElement.getAttribute('data-claim-id'), 10);
        selectedClaimId = id;
        dragMode = 'right';
        draggingClaimId = id;
        dragStartX = e.clientX;
        const claim = currentClaims.find(c => c.id === id);
        dragInitialStartDay = claim.startDay;
        dragInitialSupply = claim.daysSupply;
        e.stopPropagation();
      });
    });
  }

  // Window-level mousemove & mouseup for drag handles
  window.addEventListener('mousemove', e => {
    if (!dragMode || draggingClaimId === null) return;
    const claim = currentClaims.find(c => c.id === draggingClaimId);
    if (!claim) return;

    const chartWidth = (timelineSvg.clientWidth || 800) - 120;
    const maxDay = Math.max(parseInt(windowSlider.value, 10) + 30, 420);
    const dayPerPx = maxDay / chartWidth;
    const deltaDays = Math.round((e.clientX - dragStartX) * dayPerPx);

    if (dragMode === 'left') {
      // Pull or push start day
      const newStart = Math.max(0, dragInitialStartDay + deltaDays);
      claim.startDay = newStart;
    } else if (dragMode === 'right') {
      // Pull/push days of supply
      const newSupply = Math.max(5, dragInitialSupply + deltaDays);
      claim.daysSupply = newSupply;
    } else if (dragMode === 'move') {
      // Shift entire claim along timeline
      const newStart = Math.max(0, dragInitialStartDay + deltaDays);
      claim.startDay = newStart;
    }

    render();
  });

  window.addEventListener('mouseup', () => {
    dragMode = null;
    draggingClaimId = null;
  });

  // ─── Macro Plotly Timeline Chart ───
  function renderPlotlyTimeline(claims, episodes, intervals, studyEnd, allowableGap) {
    const shapes = [];
    const annotations = [];

    // Track 0: Resulting Episodes
    episodes.forEach(ep => {
      const isCensored = ep.censored;
      const color = ep.hasConflict ? '#f43f5e' : (isCensored ? '#10b981' : '#38bdf8');
      const fillColor = ep.hasConflict ? 'rgba(244, 63, 94, 0.28)' : (isCensored ? 'rgba(16, 185, 129, 0.28)' : 'rgba(56, 189, 248, 0.28)');

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: ep.startDay,
        x1: ep.endDay,
        y0: 0.15,
        y1: 0.75,
        fillcolor: fillColor,
        line: { color: color, width: 2 }
      });

      annotations.push({
        x: (ep.startDay + ep.endDay) / 2,
        y: 0.45,
        text: `<b>${ep.id}</b> &middot; ${ep.duration}d (${ep.claimsCount} fills)`,
        showarrow: false,
        font: { color: '#fafafa', size: 10, family: 'Geist, sans-serif' }
      });

      if (!isCensored) {
        annotations.push({
          x: ep.endDay,
          y: 0.85,
          text: `▲ Discontinued`,
          showarrow: false,
          font: { color: '#f43f5e', size: 9, family: 'Geist, sans-serif' }
        });
      }
    });

    // Track 1: Multi-Market Swimmer Bars
    claims.forEach(claim => {
      const origStart = claim.startDay;
      const origEnd = claim.startDay + claim.daysSupply;
      const primSeg = claim.marketSegments?.[0] || 'GLP1';
      const segDef = MARKET_SEGMENTS[primSeg] || { color: '#38bdf8' };
      const isSelected = claim.id === selectedClaimId;

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: origStart,
        x1: origEnd,
        y0: 1.05,
        y1: 1.55,
        fillcolor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(56, 189, 248, 0.15)',
        line: { color: segDef.color, width: isSelected ? 2.5 : 1.5 }
      });

      annotations.push({
        x: (origStart + origEnd) / 2,
        y: 1.3,
        text: `#${claim.id} ${claim.drug.split(' ')[0]} (${claim.daysSupply}d)`,
        showarrow: false,
        font: { color: '#fafafa', size: 9, family: 'Geist Mono, monospace' }
      });
    });

    // Track 2: Overlap Collisions / Synergies
    intervals.forEach(iv => {
      const isConflict = iv.type === 'conflict' || iv.type === 'cap_exceeded';
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: iv.start,
        x1: iv.end,
        y0: 1.7,
        y1: 2.1,
        fillcolor: isConflict ? 'rgba(244, 63, 94, 0.35)' : 'rgba(16, 185, 129, 0.35)',
        line: { color: isConflict ? '#f43f5e' : '#10b981', width: 1.5, dash: 'dot' }
      });

      annotations.push({
        x: (iv.start + iv.end) / 2,
        y: 1.9,
        text: isConflict ? '⚠️ Duplication Conflict' : '✨ Synergistic Combo',
        showarrow: false,
        font: { color: isConflict ? '#fb7185' : '#34d399', size: 9, family: 'Geist, sans-serif' }
      });
    });

    // Observation Window End Line
    shapes.push({
      type: 'line',
      xref: 'x',
      yref: 'paper',
      x0: studyEnd,
      x1: studyEnd,
      y0: 0,
      y1: 1,
      line: { color: '#ef4444', width: 2, dash: 'dash' }
    });

    annotations.push({
      x: studyEnd,
      y: 2.3,
      text: `End of Study (Day ${studyEnd})`,
      showarrow: false,
      font: { color: '#f87171', size: 10 }
    });

    const layout = {
      ...DARK_LAYOUT,
      title: false,
      margin: { t: 25, r: 25, b: 40, l: 150 },
      shapes: shapes,
      annotations: annotations,
      xaxis: {
        ...DARK_LAYOUT.xaxis,
        title: 'Timeline (Days from Index Rx Claim)',
        range: [-15, Math.max(studyEnd + 30, 400)],
        dtick: 30
      },
      yaxis: {
        ...DARK_LAYOUT.yaxis,
        range: [-0.1, 2.4],
        tickvals: [0.45, 1.3, 1.9],
        ticktext: ['<b>Resulting Episode</b>', '<b>Multi-Market Claims</b>', '<b>Overlap / Conflicts</b>'],
        showgrid: false
      },
      showlegend: false
    };

    const data = [{
      x: [0],
      y: [0],
      type: 'scatter',
      mode: 'markers',
      marker: { opacity: 0 }
    }];

    Plotly.react('chart-timeline', data, layout, {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });
  }

  // ─── Event Listeners: Sidebar & Parameters ───
  scenarioSelect.addEventListener('change', () => {
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    selectedClaimId = currentClaims[0]?.id || 1;
    render();
  });

  overlapSelect.addEventListener('change', render);
  gapSlider.addEventListener('input', render);
  windowSlider.addEventListener('input', render);

  switchHardRestrictions.addEventListener('change', render);
  selectMaxSegments.addEventListener('change', render);
  ruleCheckGlp1Dpp4.addEventListener('change', render);
  ruleCheckGlp1Dual.addEventListener('change', render);
  ruleCheckSglt2Glp1.addEventListener('change', render);

  btnReset.addEventListener('click', () => {
    gapSlider.value = 30;
    overlapSelect.value = 'stockpile';
    windowSlider.value = 365;
    switchHardRestrictions.checked = false;
    selectMaxSegments.value = '2';
    activeRules = JSON.parse(JSON.stringify(DEFAULT_RESTRICTION_RULES));
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    selectedClaimId = currentClaims[0]?.id || 1;
    render();
  });

  btnAddClaim.addEventListener('click', () => {
    const lastClaim = currentClaims[currentClaims.length - 1];
    const newStart = lastClaim ? lastClaim.startDay + 35 : 0;
    const newClaim = {
      id: (currentClaims.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1,
      startDay: newStart,
      daysSupply: 30,
      drug: 'Ozempic (0.5mg)',
      marketSegments: ['GLP1']
    };
    currentClaims.push(newClaim);
    selectedClaimId = newClaim.id;
    render();
  });

  // ─── Inspector Push/Pull Handle Buttons ───
  btnPull10.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay = Math.max(0, claim.startDay - 10);
      render();
    }
  });

  btnPull5.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay = Math.max(0, claim.startDay - 5);
      render();
    }
  });

  btnPush5.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay += 5;
      render();
    }
  });

  btnPush10.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay += 10;
      render();
    }
  });

  btnShrink15.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.daysSupply = Math.max(5, claim.daysSupply - 15);
      render();
    }
  });

  btnExtend15.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.daysSupply += 15;
      render();
    }
  });

  // Market Compatibility Pill Click in Inspector (add/remove segment)
  inspectorCard.addEventListener('click', e => {
    const btn = e.target.closest('.market-compat-btn');
    if (btn) {
      const claimId = parseInt(btn.getAttribute('data-claim-id'), 10);
      const segKey = btn.getAttribute('data-seg');
      const claim = currentClaims.find(c => c.id === claimId);
      if (!claim) return;

      const compat = checkMarketCompatibility(claim.marketSegments, segKey, activeRules, enforceHard);
      if (compat.status === 'conflict' && enforceHard) {
        alert(`Cannot add ${MARKET_SEGMENTS[segKey]?.name}: ${compat.reason} (Hard Restriction Enforcement is active).`);
        return;
      }

      if (!claim.marketSegments.includes(segKey)) {
        claim.marketSegments.push(segKey);
        render();
      }
      return;
    }

    const removeBtn = e.target.closest('.chip-remove');
    if (removeBtn) {
      const claimId = parseInt(removeBtn.getAttribute('data-claim-id'), 10);
      const segKey = removeBtn.getAttribute('data-seg');
      const claim = currentClaims.find(c => c.id === claimId);
      if (claim && claim.marketSegments.length > 1) {
        claim.marketSegments = claim.marketSegments.filter(s => s !== segKey);
        render();
      }
    }
  });

  // ─── Table Inline Editing & Steppers ───
  claimsTableBody.addEventListener('click', e => {
    // 1. Radio / Row selection
    const row = e.target.closest('tr');
    if (row && !e.target.closest('button') && !e.target.closest('input')) {
      const claimId = parseInt(row.getAttribute('data-claim-id'), 10);
      selectedClaimId = claimId;
      render();
      return;
    }

    const radio = e.target.closest('.claim-radio');
    if (radio) {
      selectedClaimId = parseInt(radio.getAttribute('data-id'), 10);
      render();
      return;
    }

    // 2. Row Steppers: Pull/Push start day
    const btnPull = e.target.closest('.btn-row-pull-5');
    if (btnPull) {
      const id = parseInt(btnPull.getAttribute('data-id'), 10);
      const claim = currentClaims.find(c => c.id === id);
      if (claim) {
        claim.startDay = Math.max(0, claim.startDay - 5);
        render();
      }
      return;
    }

    const btnPush = e.target.closest('.btn-row-push-5');
    if (btnPush) {
      const id = parseInt(btnPush.getAttribute('data-id'), 10);
      const claim = currentClaims.find(c => c.id === id);
      if (claim) {
        claim.startDay += 5;
        render();
      }
      return;
    }

    // 3. Row Steppers: Shrink/Extend supply
    const btnShrink = e.target.closest('.btn-row-shrink-15');
    if (btnShrink) {
      const id = parseInt(btnShrink.getAttribute('data-id'), 10);
      const claim = currentClaims.find(c => c.id === id);
      if (claim) {
        claim.daysSupply = Math.max(5, claim.daysSupply - 15);
        render();
      }
      return;
    }

    const btnExtend = e.target.closest('.btn-row-extend-15');
    if (btnExtend) {
      const id = parseInt(btnExtend.getAttribute('data-id'), 10);
      const claim = currentClaims.find(c => c.id === id);
      if (claim) {
        claim.daysSupply += 15;
        render();
      }
      return;
    }

    // 4. Change market segment quick toggle
    const btnSeg = e.target.closest('.btn-table-seg-toggle');
    if (btnSeg) {
      const id = parseInt(btnSeg.getAttribute('data-id'), 10);
      const claim = currentClaims.find(c => c.id === id);
      if (claim) {
        // Cycle to next available compatible market segment
        const keys = Object.keys(MARKET_SEGMENTS);
        const curIdx = keys.indexOf(claim.marketSegments[0] || 'GLP1');
        const nextKey = keys[(curIdx + 1) % keys.length];
        claim.marketSegments = [nextKey];
        claim.drug = MARKET_SEGMENTS[nextKey].defaultDrug;
        render();
      }
      return;
    }

    // 5. Delete row
    const btnDel = e.target.closest('.btn-row-delete');
    if (btnDel) {
      const id = parseInt(btnDel.getAttribute('data-id'), 10);
      if (currentClaims.length > 1) {
        currentClaims = currentClaims.filter(c => c.id !== id);
        if (selectedClaimId === id) selectedClaimId = currentClaims[0].id;
        render();
      } else {
        alert('Cannot delete the last remaining prescription claim.');
      }
      return;
    }
  });

  // Direct input handling on table inputs (Dispense Day, Supply, Drug Name)
  claimsTableBody.addEventListener('change', e => {
    const target = e.target;
    const id = parseInt(target.getAttribute('data-id'), 10);
    const claim = currentClaims.find(c => c.id === id);
    if (!claim) return;

    if (target.classList.contains('input-start-day')) {
      claim.startDay = Math.max(0, parseInt(target.value, 10) || 0);
      render();
    } else if (target.classList.contains('input-days-supply')) {
      claim.daysSupply = Math.max(5, parseInt(target.value, 10) || 30);
      render();
    } else if (target.classList.contains('input-drug-name')) {
      claim.drug = target.value.trim() || 'Prescription Claim';
      render();
    }
  });

  // Table toolbar actions
  btnTableAddRow.addEventListener('click', () => {
    const lastClaim = currentClaims[currentClaims.length - 1];
    const newStart = lastClaim ? lastClaim.startDay + 30 : 0;
    const newClaim = {
      id: (currentClaims.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1,
      startDay: newStart,
      daysSupply: 30,
      drug: 'Jardiance (10mg)',
      marketSegments: ['SGLT2']
    };
    currentClaims.push(newClaim);
    selectedClaimId = newClaim.id;
    render();
  });

  btnTableDuplicate.addEventListener('click', () => {
    const sel = getSelectedClaim();
    if (!sel) return;
    const newClaim = {
      ...JSON.parse(JSON.stringify(sel)),
      id: (currentClaims.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1,
      startDay: sel.startDay + 30
    };
    currentClaims.push(newClaim);
    selectedClaimId = newClaim.id;
    render();
  });

  btnTableDelete.addEventListener('click', () => {
    if (currentClaims.length <= 1) {
      alert('Cannot delete the only remaining prescription claim.');
      return;
    }
    currentClaims = currentClaims.filter(c => c.id !== selectedClaimId);
    selectedClaimId = currentClaims[0]?.id || 1;
    render();
  });

  // ─── Zoom & Viewport Controls ───
  btnZoomIn?.addEventListener('click', () => {
    zoomLevel = Math.min(3.5, Math.round((zoomLevel + 0.25) * 100) / 100);
    render();
  });

  btnZoomOut?.addEventListener('click', () => {
    zoomLevel = Math.max(0.6, Math.round((zoomLevel - 0.25) * 100) / 100);
    render();
  });

  btnZoomReset?.addEventListener('click', () => {
    zoomLevel = 1.0;
    if (canvasContainer) canvasContainer.scrollLeft = 0;
    render();
  });

  // Ctrl + Wheel Zoom on Timeline Canvas
  canvasContainer?.addEventListener('wheel', e => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomLevel = Math.min(3.5, Math.round((zoomLevel + 0.15) * 100) / 100);
      } else {
        zoomLevel = Math.max(0.6, Math.round((zoomLevel - 0.15) * 100) / 100);
      }
      render();
    }
  }, { passive: false });

  // ─── Fullscreen Modes ───
  function toggleTimelineFullscreen() {
    if (!interactiveTimelineBox) return;
    const isFull = interactiveTimelineBox.classList.toggle('is-fullscreen');
    if (fullscreenText) {
      fullscreenText.textContent = isFull ? 'Exit' : 'Fullscreen';
    }
    render();
  }

  btnToggleFullscreen?.addEventListener('click', toggleTimelineFullscreen);

  function togglePlotlyFullscreen() {
    if (!chartContainer) return;
    const isFull = chartContainer.classList.toggle('is-fullscreen');
    if (plotlyFullscreenText) {
      plotlyFullscreenText.textContent = isFull ? 'Exit Fullscreen' : 'Expand Chart';
    }
    Plotly.Plots.resize('chart-timeline');
  }

  btnPlotlyFullscreen?.addEventListener('click', togglePlotlyFullscreen);

  // ESC key to exit active fullscreen
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (interactiveTimelineBox?.classList.contains('is-fullscreen')) {
        interactiveTimelineBox.classList.remove('is-fullscreen');
        if (fullscreenText) fullscreenText.textContent = 'Fullscreen';
        render();
      }
      if (chartContainer?.classList.contains('is-fullscreen')) {
        chartContainer.classList.remove('is-fullscreen');
        if (plotlyFullscreenText) plotlyFullscreenText.textContent = 'Expand Chart';
        Plotly.Plots.resize('chart-timeline');
      }
    }
  });

  // Window resize responsive adaptation
  window.addEventListener('resize', () => {
    render();
  });

  // Initial render
  render();
}
