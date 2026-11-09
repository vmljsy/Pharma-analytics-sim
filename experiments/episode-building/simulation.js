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
import { exportToCSV, serializeStateToURL, deserializeStateFromURL } from '../../js/distributions.js';

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

// Helper: Convert hex string to rgba with given alpha
function hexToRgba(hex, alpha = 0.2) {
  let c = (hex || '#38bdf8').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper: Build default clinical restriction matrix from active segment keys
function createClinicalRestrictionMatrix(segments) {
  const matrix = {};
  const keys = Object.keys(segments);
  for (const s1 of keys) {
    matrix[s1] = {};
    for (const s2 of keys) {
      if (s1 === s2) {
        matrix[s1][s2] = 'self';
      } else {
        const rule = DEFAULT_RESTRICTION_RULES.find(r =>
          (r.pair[0] === s1 && r.pair[1] === s2) ||
          (r.pair[1] === s1 && r.pair[0] === s2)
        );
        if (rule) {
          matrix[s1][s2] = rule.type === 'prohibited_overlap' ? 'restricted' : 'synergistic';
        } else {
          matrix[s1][s2] = 'allowed';
        }
      }
    }
  }
  return matrix;
}

export default function init() {
  // Application State
  let currentClaims = JSON.parse(JSON.stringify(SCENARIOS.synergistic_combo));
  let selectedClaimId = currentClaims[0]?.id || 1;
  let enforceHard = false;
  let maxConcurrentSegments = 2;
  let episodeViewMode = 'regimen'; // 'regimen' | 'segment'

  // Dynamic Market Segments state (seeded with built-in classes)
  let currentMarketSegments = JSON.parse(JSON.stringify(MARKET_SEGMENTS));

  // Dynamic Multi-Market Restriction Matrix state (M x M)
  let restrictionMatrix = createClinicalRestrictionMatrix(currentMarketSegments);

  // Dragging state for timeline canvas handles
  let dragMode = null; // 'left' (pull start), 'right' (pull duration), 'move' (shift start)
  let draggingClaimId = null;
  let dragStartX = 0;
  let dragInitialStartDay = 0;
  let dragInitialSupply = 0;

  // Zoom and Viewport State
  let zoomLevel = 1.0; // 0.6x to 3.5x

  // DOM elements: Scenario and Parameters
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

  // Matrix toolbar & table elements
  const restrictionMatrixTable = $('restriction-matrix-table');
  const btnMatrixAllowAll = $('btn-matrix-allow-all');
  const btnMatrixDisallowAll = $('btn-matrix-disallow-all');
  const btnMatrixResetGuidelines = $('btn-matrix-reset-guidelines');

  // View mode toggle
  const btnViewRegimen = $('btn-view-regimen');
  const btnViewSegment = $('btn-view-segment');

  // Market legend & Add Segment Modal
  const legendMarketChips = $('legend-market-chips');
  const btnOpenAddSegment = $('btn-open-add-segment');
  const modalAddSegment = $('modal-add-segment');
  const btnCloseModal = $('btn-close-modal');
  const btnCancelAddSegment = $('btn-cancel-add-segment');
  const btnSaveAddSegment = $('btn-save-add-segment');
  const inputSegId = $('input-seg-id');
  const inputSegName = $('input-seg-name');
  const inputSegFullName = $('input-seg-fullname');
  const inputSegDrug = $('input-seg-drug');
  const inputSegColor = $('input-seg-color');
  const colorSwatchesContainer = $('color-swatches-container');

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

  // ─── Main Render Function ───
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

    // Run episode building engine with multi-market options & restriction matrix
    const result = buildTreatmentEpisodes(currentClaims, allowableGap, overlapMethod, studyEnd, {
      restrictionMatrix: restrictionMatrix,
      enforceHard: enforceHard,
      maxConcurrentSegments: maxConcurrentSegments
    });
    const { episodes, segmentEpisodes, adjustedClaims, stats, overlapIntervals } = result;

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

    // Render Restriction Matrix (M x M)
    renderRestrictionMatrix();

    // Render Market Legend Chips
    renderMarketLegendChips();

    // Dynamic Clinical Insight Callout
    renderInsightCallout(adjustedClaims, overlapIntervals, overlapMethod);

    // Render Inspector Card for selected claim
    renderInspectorCard(adjustedClaims);

    // Populate Editable Claims & Episode Data Table
    renderClaimsTable(adjustedClaims, episodes, allowableGap);

    // Render Interactive SVG Timeline Track with Draggable Handles
    renderInteractiveSvgTimeline(adjustedClaims, episodes, segmentEpisodes, overlapIntervals, studyEnd);

    // Render Macro Plotly Timeline
    renderPlotlyTimeline(adjustedClaims, episodes, segmentEpisodes, overlapIntervals, studyEnd, allowableGap);
  }

  // ─── Render Restriction Matrix (M x M) ───
  function renderRestrictionMatrix() {
    if (!restrictionMatrixTable) return;
    const segKeys = Object.keys(currentMarketSegments);

    let html = '<thead><tr><th style="padding: 0.35rem; font-size: 0.65rem; color: var(--muted-foreground); text-align: left;">Segment</th>';
    for (const s of segKeys) {
      const seg = currentMarketSegments[s];
      html += `<th style="padding: 0.35rem 0.3rem; font-size: 0.65rem; color: ${seg?.color || 'var(--foreground)'}; text-align: center;" title="${seg?.fullName || s}">${s}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const s1 of segKeys) {
      const seg1 = currentMarketSegments[s1];
      html += `<tr><th style="padding: 0.35rem 0.4rem; font-size: 0.65rem; color: ${seg1?.color || 'var(--foreground)'}; text-align: left;" title="${seg1?.fullName || s1}">${s1}</th>`;
      for (const s2 of segKeys) {
        if (s1 === s2) {
          html += `<td class="matrix-cell matrix-cell-self" title="${s1} Self-Refill: managed by stockpiling vs truncation">—</td>`;
        } else {
          const status = restrictionMatrix[s1]?.[s2] || 'allowed';
          let cellClass = 'matrix-cell-allowed';
          let icon = '✓';
          let tip = `${s1} + ${s2}: Allowed concurrent overlap (Click to cycle)`;

          if (status === 'restricted') {
            cellClass = 'matrix-cell-restricted';
            icon = '✕';
            tip = `${s1} + ${s2}: Restricted Therapeutic Duplication (Click to cycle)`;
          } else if (status === 'synergistic') {
            cellClass = 'matrix-cell-synergy';
            icon = '★';
            tip = `${s1} + ${s2}: Guideline-Recommended Synergistic Add-On (Click to cycle)`;
          }

          html += `<td class="matrix-cell ${cellClass}" data-s1="${s1}" data-s2="${s2}" title="${tip}">${icon}</td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody>';
    restrictionMatrixTable.innerHTML = html;
  }

  // Toggle restriction matrix cell symmetrically: allowed -> restricted -> synergistic -> allowed
  function toggleMatrixCell(s1, s2) {
    if (s1 === s2 || !restrictionMatrix[s1] || !restrictionMatrix[s2]) return;
    const current = restrictionMatrix[s1][s2] || 'allowed';
    let next = 'restricted';
    if (current === 'allowed') {
      next = 'restricted';
    } else if (current === 'restricted') {
      next = 'synergistic';
    } else if (current === 'synergistic') {
      next = 'allowed';
    }
    restrictionMatrix[s1][s2] = next;
    restrictionMatrix[s2][s1] = next;
    render();
  }

  // Click handler on matrix table
  restrictionMatrixTable?.addEventListener('click', e => {
    const cell = e.target.closest('.matrix-cell');
    if (!cell || cell.classList.contains('matrix-cell-self')) return;
    const s1 = cell.getAttribute('data-s1');
    const s2 = cell.getAttribute('data-s2');
    if (s1 && s2) {
      toggleMatrixCell(s1, s2);
    }
  });

  // Matrix toolbar button listeners
  btnMatrixAllowAll?.addEventListener('click', () => {
    const keys = Object.keys(currentMarketSegments);
    for (const s1 of keys) {
      if (!restrictionMatrix[s1]) restrictionMatrix[s1] = {};
      for (const s2 of keys) {
        if (s1 !== s2) {
          restrictionMatrix[s1][s2] = 'allowed';
        }
      }
    }
    render();
  });

  btnMatrixDisallowAll?.addEventListener('click', () => {
    const keys = Object.keys(currentMarketSegments);
    for (const s1 of keys) {
      if (!restrictionMatrix[s1]) restrictionMatrix[s1] = {};
      for (const s2 of keys) {
        if (s1 !== s2) {
          restrictionMatrix[s1][s2] = 'restricted';
        }
      }
    }
    render();
  });

  btnMatrixResetGuidelines?.addEventListener('click', () => {
    restrictionMatrix = createClinicalRestrictionMatrix(currentMarketSegments);
    render();
  });

  // ─── Render Market Legend Chips ───
  function renderMarketLegendChips() {
    if (!legendMarketChips) return;
    let html = '';
    for (const [id, seg] of Object.entries(currentMarketSegments)) {
      html += `
        <span class="segment-chip ${seg.isCustom ? 'segment-chip-custom' : ''}" 
              style="background: ${seg.bgLight}; border-color: ${seg.color}; color: ${seg.color}; font-size: 0.72rem; padding: 0.2rem 0.5rem;"
              title="${seg.fullName} (${seg.mechanism || ''})">
          <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${seg.color}; margin-right: 4px;"></span>
          ${seg.name}
          ${seg.isCustom ? `<span class="chip-delete-btn" data-delete-seg="${id}" title="Delete Custom Segment ${id}">&times;</span>` : ''}
        </span>
      `;
    }
    legendMarketChips.innerHTML = html;
  }

  // Legend chip click handler (delete custom segment)
  legendMarketChips?.addEventListener('click', e => {
    const delBtn = e.target.closest('.chip-delete-btn');
    if (delBtn) {
      const segId = delBtn.getAttribute('data-delete-seg');
      if (segId) {
        deleteCustomMarketSegment(segId);
      }
    }
  });

  // Add Custom Market Segment API
  function addCustomMarketSegment(customSeg) {
    const id = (customSeg.id || '').toUpperCase().trim();
    if (!id || !/^[A-Z0-9_-]+$/.test(id)) {
      alert('Please enter a valid alphanumeric Segment ID (e.g. MRA, TZD, PCSK9).');
      return false;
    }
    if (currentMarketSegments[id]) {
      alert(`Market Segment "${id}" already exists.`);
      return false;
    }

    const color = customSeg.color || '#ec4899';
    const name = customSeg.name?.trim() || `${id} Class`;
    const fullName = customSeg.fullName?.trim() || `${name} Mechanism`;
    const defaultDrug = customSeg.defaultDrug?.trim() || `${name} (Standard)`;

    currentMarketSegments[id] = {
      id,
      name,
      fullName,
      color,
      bgLight: hexToRgba(color, 0.15),
      border: color,
      badgeClass: 'badge-outline',
      examples: [defaultDrug],
      defaultDrug,
      mechanism: fullName,
      isCustom: true
    };

    // Expand restriction matrix for the new segment
    restrictionMatrix[id] = {};
    for (const s of Object.keys(currentMarketSegments)) {
      if (s === id) {
        restrictionMatrix[id][s] = 'self';
      } else {
        restrictionMatrix[id][s] = 'allowed';
        if (!restrictionMatrix[s]) restrictionMatrix[s] = {};
        restrictionMatrix[s][id] = 'allowed';
      }
    }

    render();
    return true;
  }

  // Delete Custom Market Segment API
  function deleteCustomMarketSegment(segId) {
    if (!currentMarketSegments[segId] || !currentMarketSegments[segId].isCustom) return false;
    delete currentMarketSegments[segId];

    // Remove from matrix
    delete restrictionMatrix[segId];
    for (const s of Object.keys(restrictionMatrix)) {
      delete restrictionMatrix[s][segId];
    }

    // Fallback any claims currently using this segment to first remaining segment
    const fallbackSeg = Object.keys(currentMarketSegments)[0] || 'GLP1';
    currentClaims.forEach(c => {
      if (c.marketSegments && c.marketSegments.includes(segId)) {
        c.marketSegments = c.marketSegments.filter(s => s !== segId);
        if (c.marketSegments.length === 0) {
          c.marketSegments = [fallbackSeg];
          c.drug = currentMarketSegments[fallbackSeg]?.defaultDrug || 'Prescription Claim';
        }
      }
    });

    render();
    return true;
  }

  // ─── Modal Dialog Event Handlers ───
  btnOpenAddSegment?.addEventListener('click', () => {
    if (inputSegId) inputSegId.value = '';
    if (inputSegName) inputSegName.value = '';
    if (inputSegFullName) inputSegFullName.value = '';
    if (inputSegDrug) inputSegDrug.value = '';
    if (inputSegColor) inputSegColor.value = '#ec4899';

    // Reset swatch active class
    const swatches = colorSwatchesContainer?.querySelectorAll('.color-swatch-item');
    swatches?.forEach(s => s.classList.remove('active'));
    if (swatches && swatches[0]) swatches[0].classList.add('active');

    modalAddSegment?.classList.add('active');
  });

  btnCloseModal?.addEventListener('click', () => {
    modalAddSegment?.classList.remove('active');
  });

  btnCancelAddSegment?.addEventListener('click', () => {
    modalAddSegment?.classList.remove('active');
  });

  // Modal swatch click
  colorSwatchesContainer?.addEventListener('click', e => {
    const item = e.target.closest('.color-swatch-item');
    if (item) {
      colorSwatchesContainer.querySelectorAll('.color-swatch-item').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const c = item.getAttribute('data-color');
      if (inputSegColor && c) inputSegColor.value = c;
    }
  });

  inputSegColor?.addEventListener('input', () => {
    colorSwatchesContainer?.querySelectorAll('.color-swatch-item').forEach(s => s.classList.remove('active'));
  });

  // Modal save button
  btnSaveAddSegment?.addEventListener('click', () => {
    const id = inputSegId?.value?.toUpperCase().trim();
    const name = inputSegName?.value?.trim() || (id ? `${id} Class` : '');
    const fullName = inputSegFullName?.value?.trim() || `${name} Mechanism`;
    const defaultDrug = inputSegDrug?.value?.trim() || `${name} (Standard)`;
    const color = inputSegColor?.value || '#ec4899';

    const success = addCustomMarketSegment({ id, name, fullName, defaultDrug, color });
    if (success) {
      modalAddSegment?.classList.remove('active');
    }
  });

  // ─── View Mode Toggle ───
  btnViewRegimen?.addEventListener('click', () => {
    episodeViewMode = 'regimen';
    btnViewRegimen.classList.add('active');
    btnViewSegment?.classList.remove('active');
    render();
  });

  btnViewSegment?.addEventListener('click', () => {
    episodeViewMode = 'segment';
    btnViewSegment.classList.add('active');
    btnViewRegimen?.classList.remove('active');
    render();
  });

  // ─── Clinical Insight Callout ───
  function renderInsightCallout(claims, intervals, overlapMethod) {
    const conflicts = intervals.filter(i => i.type === 'conflict' || i.type === 'cap_exceeded');
    const synergies = intervals.filter(i => i.type === 'synergy');

    if (conflicts.length > 0) {
      calloutBox.className = 'callout-insight callout-conflict';
      const c = conflicts[0];
      const segNames = c.segments.map(s => currentMarketSegments[s]?.name || s).join(' + ');
      calloutText.innerHTML = `
        <strong>Therapeutic Duplication Conflict Detected:</strong> Between Day ${c.start} and Day ${c.end}, 
        concurrent overlap of <strong>${segNames}</strong> occurs. ${c.description || 'This combination violates guideline restrictions.'}
        ${enforceHard ? '<span style="color: #fff; font-weight: 600;"> [Hard Enforcement Mode will truncate or block this pairing]</span>' : ''}
      `;
    } else if (synergies.length > 0) {
      calloutBox.className = 'callout-insight callout-synergy';
      const s = synergies[0];
      const segNames = s.segments.map(sg => currentMarketSegments[sg]?.name || sg).join(' + ');
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

  // ─── Inspector Card ───
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
      const segDef = currentMarketSegments[segKey] || { name: segKey, color: '#38bdf8', bgLight: 'rgba(56,189,248,0.15)' };
      segChipsHtml += `
        <span class="segment-chip" style="background: ${segDef.bgLight}; border-color: ${segDef.color}; color: ${segDef.color};">
          ${segDef.name}
          ${curSegs.length > 1 ? `<span class="chip-remove" data-action="remove-seg" data-claim-id="${claim.id}" data-seg="${segKey}">&times;</span>` : ''}
        </span>
      `;
    });
    inspectorSegmentBadges.innerHTML = segChipsHtml;

    // Render live compatibility pills for all available market segments
    let compatHtml = '';
    Object.keys(currentMarketSegments).forEach(segKey => {
      const isSelected = curSegs.includes(segKey);
      const segDef = currentMarketSegments[segKey];
      const compat = checkMarketCompatibility(curSegs, segKey, restrictionMatrix, enforceHard);

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

  // ─── Claims & Episodes Data Table ───
  function renderClaimsTable(claims, episodes, allowableGap) {
    let tableHtml = '';

    claims.forEach(claim => {
      const isSelected = claim.id === selectedClaimId;
      const curSegs = claim.marketSegments || ['GLP1'];
      const ep = episodes.find(e => e.claims.some(c => c.id === claim.id));
      const epLabel = ep ? `<span class="badge ${ep.hasConflict ? 'badge-rose' : 'badge-emerald'}" style="font-size: 0.75rem;">${ep.id}</span>` : '—';

      // Market Segment pills in table row
      let segChips = '';
      curSegs.forEach(s => {
        const def = currentMarketSegments[s] || { name: s, color: '#38bdf8', bgLight: 'rgba(56,189,248,0.15)' };
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
              <button class="handle-btn btn-table-seg-toggle" data-id="${claim.id}" style="padding: 0.1rem 0.35rem; font-size: 0.65rem;" title="Cycle Market Segment">✎</button>
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
  function renderInteractiveSvgTimeline(claims, episodes, segmentEpisodes, overlapIntervals, studyEnd) {
    const isFullscreen = interactiveTimelineBox?.classList.contains('is-fullscreen');
    const baseWidth = Math.max(canvasContainer.clientWidth || 800, 750);
    const svgWidth = Math.round(baseWidth * zoomLevel);

    // Dynamic height calculation based on view mode (regimen vs multi-segment lanes)
    const presentSegments = Object.keys(segmentEpisodes || {});
    const segTrackCount = (episodeViewMode === 'segment' && presentSegments.length > 0) ? presentSegments.length : 1;
    const epTrackH = 34;
    const epSectionH = segTrackCount * (epTrackH + 6) + 20;

    const lanesCount = Math.min(claims.length, 4) || 1;
    const barHeight = isFullscreen ? 26 : 22;
    const claimSpacing = barHeight + 8;
    const claimsSectionH = lanesCount * claimSpacing + 30;

    const svgHeight = isFullscreen ? Math.max(window.innerHeight - 130, epSectionH + claimsSectionH + 100) : (epSectionH + claimsSectionH + 70);

    timelineSvg.setAttribute('width', svgWidth);
    timelineSvg.setAttribute('height', svgHeight);
    if (zoomLevelBadge) zoomLevelBadge.textContent = `${Math.round(zoomLevel * 100)}%`;

    const marginL = 120;
    const marginR = 50;
    const chartW = svgWidth - marginL - marginR;
    const maxDay = Math.max(studyEnd + 30, 420);

    const scaleX = day => marginL + (day / maxDay) * chartW;
    const unscaleX = px => Math.max(0, Math.round(((px - marginL) / chartW) * maxDay));

    // 1. Time Axis & Observation Window Line
    const axisGroup = $('svg-time-axis');
    let axisHtml = `
      <line x1="${marginL}" y1="28" x2="${marginL + chartW}" y2="28" stroke="var(--border)" stroke-width="1.5"/>
    `;
    const tickInterval = maxDay > 500 ? 60 : 30;
    for (let d = 0; d <= maxDay; d += tickInterval) {
      const x = scaleX(d);
      axisHtml += `
        <line x1="${x}" y1="24" x2="${x}" y2="28" stroke="var(--border-hover)" stroke-width="1"/>
        <text x="${x}" y="20" font-size="10" font-family="Geist Mono, monospace" fill="var(--muted-foreground)" text-anchor="middle">Day ${d}</text>
        <line x1="${x}" y1="28" x2="${x}" y2="${svgHeight - 10}" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="3,3"/>
      `;
    }

    // Study End Boundary Line
    const xEnd = scaleX(studyEnd);
    axisHtml += `
      <line x1="${xEnd}" y1="10" x2="${xEnd}" y2="${svgHeight - 10}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,4"/>
      <text x="${xEnd}" y="12" font-size="9" font-family="Geist, sans-serif" fill="#f87171" text-anchor="middle" font-weight="600">Study End (${studyEnd}d)</text>
    `;
    axisGroup.innerHTML = axisHtml;

    // 2. Overlap Conflict & Synergy Shading Bands
    const conflictGroup = $('svg-conflict-zones');
    let conflictHtml = '';
    overlapIntervals.forEach(iv => {
      const x0 = scaleX(iv.start);
      const x1 = scaleX(iv.end);
      const w = Math.max(3, x1 - x0);
      const isConflict = iv.type === 'conflict' || iv.type === 'cap_exceeded';

      conflictHtml += `
        <rect x="${x0}" y="30" width="${w}" height="${svgHeight - 40}" 
              fill="${isConflict ? 'url(#conflict-hatch)' : 'url(#grad-synergy)'}" 
              opacity="0.75">
          <title>${isConflict ? '⚠️ Overlap Conflict' : '✨ Synergistic Combination'}: Day ${iv.start} - Day ${iv.end} (${iv.title})</title>
        </rect>
      `;
    });
    conflictGroup.innerHTML = conflictHtml;

    // 3. Track 0: Treatment Episodes (Unified Regimen vs Segment-Specific Episodes)
    const epGroup = $('svg-episodes-track');
    let epTrackHtml = '';
    const epBaseY = 40;

    if (episodeViewMode === 'regimen') {
      epTrackHtml += `
        <text x="10" y="${epBaseY + 16}" font-size="11" font-weight="600" font-family="Geist, sans-serif" fill="var(--foreground)">Unified Episodes</text>
        <text x="10" y="${epBaseY + 28}" font-size="9" font-family="Geist Mono, monospace" fill="var(--muted-foreground)">(Regimen Track)</text>
      `;

      episodes.forEach(ep => {
        const x0 = scaleX(ep.startDay);
        const x1 = scaleX(ep.endDay);
        const w = Math.max(6, x1 - x0);
        const isCensored = ep.censored;
        const color = ep.hasConflict ? '#f43f5e' : (isCensored ? '#10b981' : '#38bdf8');
        const fill = ep.hasConflict ? 'rgba(244, 63, 94, 0.25)' : (isCensored ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)');

        epTrackHtml += `
          <rect x="${x0}" y="${epBaseY}" width="${w}" height="${epTrackH}" rx="5"
                fill="${fill}" stroke="${color}" stroke-width="2">
            <title>${ep.id}: Day ${ep.startDay} - Day ${ep.endDay} (${ep.duration}d) [${ep.regimenType}]. ${ep.closureReason}</title>
          </rect>
          <text x="${x0 + w / 2}" y="${epBaseY + epTrackH / 2 + 4}" font-size="10" font-family="Geist, sans-serif" fill="#fafafa" text-anchor="middle" font-weight="500">
            ${ep.id} &middot; ${ep.duration}d (${ep.regimenType})
          </text>
        `;

        if (!isCensored) {
          epTrackHtml += `
            <polygon points="${x1},${epBaseY - 6} ${x1 - 5},${epBaseY} ${x1 + 5},${epBaseY}" fill="#f43f5e"/>
            <text x="${x1}" y="${epBaseY - 10}" font-size="9" font-family="Geist, sans-serif" fill="#f87171" text-anchor="middle">Discontinued</text>
          `;
        }
      });
    } else {
      // Segment-Specific View Mode: Show distinct continuous tracks for each market segment!
      epTrackHtml += `
        <text x="10" y="${epBaseY + 14}" font-size="11" font-weight="600" font-family="Geist, sans-serif" fill="var(--foreground)">Segment Episodes</text>
        <text x="10" y="${epBaseY + 26}" font-size="9" font-family="Geist Mono, monospace" fill="var(--muted-foreground)">(Class Overlaps)</text>
      `;

      presentSegments.forEach((seg, sIdx) => {
        const segDef = currentMarketSegments[seg] || { name: seg, color: '#38bdf8' };
        const segY = epBaseY + sIdx * (epTrackH + 6);
        const sEps = segmentEpisodes[seg] || [];

        epTrackHtml += `
          <text x="10" y="${segY + epTrackH / 2 + 4}" font-size="10" font-family="Geist Mono, monospace" fill="${segDef.color}" font-weight="600">${seg}</text>
        `;

        sEps.forEach(ep => {
          const x0 = scaleX(ep.startDay);
          const x1 = scaleX(ep.endDay);
          const w = Math.max(6, x1 - x0);
          const fill = hexToRgba(segDef.color, 0.25);

          epTrackHtml += `
            <rect x="${x0}" y="${segY}" width="${w}" height="${epTrackH}" rx="4"
                  fill="${fill}" stroke="${segDef.color}" stroke-width="1.8">
              <title>${ep.id}: Day ${ep.startDay} - Day ${ep.endDay} (${ep.duration}d). ${ep.claimsCount} fill(s)</title>
            </rect>
            <text x="${x0 + w / 2}" y="${segY + epTrackH / 2 + 4}" font-size="9.5" font-family="Geist, sans-serif" fill="#fafafa" text-anchor="middle" font-weight="500">
              ${ep.id} &middot; ${ep.duration}d
            </text>
          `;
        });
      });
    }
    epGroup.innerHTML = epTrackHtml;

    // 4. Track 1 & 2: Claims Swimmer Bars & Interactive Drag Handles
    const claimsBaseY = epBaseY + epSectionH;
    const claimsGroup = $('svg-claims-track');
    const handlesGroup = $('svg-handles-layer');
    let claimsHtml = `
      <text x="10" y="${claimsBaseY + 12}" font-size="11" font-weight="600" font-family="Geist, sans-serif" fill="var(--foreground)">Prescription Claims</text>
      <text x="10" y="${claimsBaseY + 25}" font-size="9" font-family="Geist Mono, monospace" fill="var(--muted-foreground)">(Drag handles)</text>
    `;
    let handlesHtml = '';

    // Assign vertical lanes to claims based on stagger
    claims.forEach((claim, idx) => {
      const isSelected = claim.id === selectedClaimId;
      const x0 = scaleX(claim.startDay);
      const x1 = scaleX(claim.startDay + claim.daysSupply);
      const w = Math.max(6, x1 - x0);

      const y = claimsBaseY + (idx % lanesCount) * claimSpacing;

      const primSeg = claim.marketSegments?.[0] || 'GLP1';
      const segDef = currentMarketSegments[primSeg] || { color: '#38bdf8', bgLight: 'rgba(56,189,248,0.2)' };
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

    const chartWidth = (timelineSvg.clientWidth || 800) - 170;
    const maxDay = Math.max(parseInt(windowSlider.value, 10) + 30, 420);
    const dayPerPx = maxDay / chartWidth;
    const deltaDays = Math.round((e.clientX - dragStartX) * dayPerPx);

    if (dragMode === 'left') {
      const newStart = Math.max(0, dragInitialStartDay + deltaDays);
      claim.startDay = newStart;
    } else if (dragMode === 'right') {
      const newSupply = Math.max(5, dragInitialSupply + deltaDays);
      claim.daysSupply = newSupply;
    } else if (dragMode === 'move') {
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
  function renderPlotlyTimeline(claims, episodes, segmentEpisodes, intervals, studyEnd, allowableGap) {
    const shapes = [];
    const annotations = [];

    if (episodeViewMode === 'regimen') {
      // Track 0: Unified Regimen Treatment Episodes
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
    } else {
      // Segment Episodes Mode: Render per-segment tracks
      const segKeys = Object.keys(segmentEpisodes || {});
      segKeys.forEach((seg, idx) => {
        const segDef = currentMarketSegments[seg] || { color: '#38bdf8' };
        const sEps = segmentEpisodes[seg] || [];
        const yCenter = 0.45;

        sEps.forEach(ep => {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'y',
            x0: ep.startDay,
            x1: ep.endDay,
            y0: 0.15,
            y1: 0.75,
            fillcolor: hexToRgba(segDef.color, 0.28),
            line: { color: segDef.color, width: 2 }
          });

          annotations.push({
            x: (ep.startDay + ep.endDay) / 2,
            y: yCenter,
            text: `<b>${ep.id}</b> (${ep.duration}d)`,
            showarrow: false,
            font: { color: '#fafafa', size: 9.5, family: 'Geist, sans-serif' }
          });
        });
      });
    }

    // Track 1: Multi-Market Swimmer Bars
    claims.forEach(claim => {
      const origStart = claim.startDay;
      const origEnd = claim.startDay + claim.daysSupply;
      const primSeg = claim.marketSegments?.[0] || 'GLP1';
      const segDef = currentMarketSegments[primSeg] || { color: '#38bdf8' };
      const isSelected = claim.id === selectedClaimId;

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: origStart,
        x1: origEnd,
        y0: 1.05,
        y1: 1.55,
        fillcolor: isSelected ? 'rgba(255,255,255,0.2)' : hexToRgba(segDef.color, 0.15),
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

    const epTrackLabel = episodeViewMode === 'regimen' ? '<b>Resulting Episode</b>' : '<b>Segment Episodes</b>';

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
        ticktext: [epTrackLabel, '<b>Multi-Market Claims</b>', '<b>Overlap / Conflicts</b>'],
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

    // ─── Støvring Waiting-Time Distribution (WTD) Estimator ───
    if ($('chart-wtd')) {
      const wtdDays = [];
      const wtdDensity = [];
      const pi = 0.82; // Regular refill component proportion
      for (let d = 5; d <= 120; d += 2) {
        wtdDays.push(d);
        // Normal component centered at 30 days
        const norm = (1.0 / (4.8 * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((d - 30.5) / 4.8, 2));
        const unif = 1.0 / 120.0;
        wtdDensity.push(pi * norm + (1 - pi) * unif);
      }

      const wtdTraces = [
        {
          x: wtdDays,
          y: wtdDensity,
          type: 'scatter',
          mode: 'lines',
          fill: 'tozeroy',
          fillcolor: 'rgba(56, 189, 248, 0.15)',
          line: { color: '#38bdf8', width: 2 },
          name: 'Støvring Refill Mixture Density'
        },
        {
          x: [58, 58],
          y: [0, Math.max(...wtdDensity) * 1.05],
          type: 'scatter',
          mode: 'lines+text',
          text: ['G95 Cutoff (58d)'],
          textposition: 'top right',
          line: { color: '#f43f5e', dash: 'dash', width: 2 },
          name: '95th Percentile Cut-off'
        }
      ];

      const wtdLayout = {
        ...DARK_LAYOUT,
        margin: { t: 15, r: 15, b: 35, l: 45 },
        xaxis: { ...DARK_LAYOUT.xaxis, title: 'Inter-Refill Gap (Days)' },
        yaxis: { ...DARK_LAYOUT.yaxis, title: 'Density f(Δt)' },
        showlegend: false
      };

      Plotly.react('chart-wtd', wtdTraces, wtdLayout, { responsive: true, displayModeBar: false });
    }

    // ─── 2D Gap vs. Stockpiling Sensitivity Contour Heatmap ───
    if ($('chart-sensitivity-heatmap')) {
      const gapValues = [15, 30, 45, 60, 75, 90, 105, 120];
      const stockpileValues = [0, 15, 30, 45, 60, 75, 90];
      const zMatrix = [];

      for (let sIdx = 0; sIdx < stockpileValues.length; sIdx++) {
        const s = stockpileValues[sIdx];
        const row = [];
        for (let gIdx = 0; gIdx < gapValues.length; gIdx++) {
          const g = gapValues[gIdx];
          // Persistence rate increases with permissible gap and stockpiling
          const basePersist = 42;
          const gapGain = Math.min(45, (g / 120) * 45);
          const stockGain = Math.min(15, (s / 90) * 15);
          row.push(Math.min(98, Math.round(basePersist + gapGain + stockGain)));
        }
        zMatrix.push(row);
      }

      const contourTrace = {
        z: zMatrix,
        x: gapValues,
        y: stockpileValues,
        type: 'contour',
        colorscale: [
          [0.0, '#18181b'],
          [0.3, '#0369a1'],
          [0.6, '#0284c7'],
          [0.8, '#38bdf8'],
          [1.0, '#10b981']
        ],
        contours: {
          coloring: 'heatmap',
          showlabels: true,
          labelfont: { family: 'Geist Mono', size: 10, color: '#fafafa' }
        },
        colorbar: {
          title: 'Persist %',
          titlefont: { size: 10, color: '#a1a1aa' },
          tickfont: { size: 9, color: '#a1a1aa' },
          thickness: 10,
          len: 0.85
        }
      };

      const contourLayout = {
        ...DARK_LAYOUT,
        margin: { t: 15, r: 40, b: 35, l: 45 },
        xaxis: { ...DARK_LAYOUT.xaxis, title: 'Permissible Gap (Days)' },
        yaxis: { ...DARK_LAYOUT.yaxis, title: 'Stockpile Cap (Days)' }
      };

      Plotly.react('chart-sensitivity-heatmap', [contourTrace], contourLayout, { responsive: true, displayModeBar: false });
    }
  }

  // ─── Pin Current Timeline & Export CSV Actions ───
  $('btn-pin-timeline')?.addEventListener('click', () => {
    alert('Pinned current episode timeline as counterfactual baseline reference.');
  });

  $('btn-export-claims-csv')?.addEventListener('click', () => {
    const records = currentClaims.map((c, idx) => ({
      patient_id: 'PAT-SIM-01',
      claim_id: c.id,
      dispense_day: c.startDay,
      days_supply: c.daysSupply,
      drug_name: c.drug,
      market_segment: c.marketSegments.join(' + '),
      adjudicated_status: 'Paid'
    }));
    exportToCSV(records, 'episode_claims_export.csv');
  });

  // ─── Event Listeners: Sidebar & Parameters ───
  scenarioSelect?.addEventListener('change', () => {
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect.value]));
    selectedClaimId = currentClaims[0]?.id || 1;
    render();
  });

  overlapSelect?.addEventListener('change', render);
  gapSlider?.addEventListener('input', render);
  windowSlider?.addEventListener('input', render);

  switchHardRestrictions?.addEventListener('change', render);
  selectMaxSegments?.addEventListener('change', render);

  btnReset?.addEventListener('click', () => {
    if (gapSlider) gapSlider.value = 30;
    if (overlapSelect) overlapSelect.value = 'stockpile';
    if (windowSlider) windowSlider.value = 365;
    if (switchHardRestrictions) switchHardRestrictions.checked = false;
    if (selectMaxSegments) selectMaxSegments.value = '2';
    episodeViewMode = 'regimen';
    btnViewRegimen?.classList.add('active');
    btnViewSegment?.classList.remove('active');

    currentMarketSegments = JSON.parse(JSON.stringify(MARKET_SEGMENTS));
    restrictionMatrix = createClinicalRestrictionMatrix(currentMarketSegments);
    currentClaims = JSON.parse(JSON.stringify(SCENARIOS[scenarioSelect?.value || 'synergistic_combo']));
    selectedClaimId = currentClaims[0]?.id || 1;
    render();
  });

  btnAddClaim?.addEventListener('click', () => {
    const lastClaim = currentClaims[currentClaims.length - 1];
    const newStart = lastClaim ? lastClaim.startDay + 35 : 0;
    const defaultSegKey = Object.keys(currentMarketSegments)[0] || 'GLP1';
    const defaultDrug = currentMarketSegments[defaultSegKey]?.defaultDrug || 'Prescription Claim';

    const newClaim = {
      id: (currentClaims.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1,
      startDay: newStart,
      daysSupply: 30,
      drug: defaultDrug,
      marketSegments: [defaultSegKey]
    };
    currentClaims.push(newClaim);
    selectedClaimId = newClaim.id;
    render();
  });

  // ─── Inspector Push/Pull Handle Buttons ───
  btnPull10?.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay = Math.max(0, claim.startDay - 10);
      render();
    }
  });

  btnPull5?.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay = Math.max(0, claim.startDay - 5);
      render();
    }
  });

  btnPush5?.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay += 5;
      render();
    }
  });

  btnPush10?.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.startDay += 10;
      render();
    }
  });

  btnShrink15?.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.daysSupply = Math.max(5, claim.daysSupply - 15);
      render();
    }
  });

  btnExtend15?.addEventListener('click', () => {
    const claim = getSelectedClaim();
    if (claim) {
      claim.daysSupply += 15;
      render();
    }
  });

  // Market Compatibility Pill Click in Inspector (add/remove segment)
  inspectorCard?.addEventListener('click', e => {
    const btn = e.target.closest('.market-compat-btn');
    if (btn) {
      const claimId = parseInt(btn.getAttribute('data-claim-id'), 10);
      const segKey = btn.getAttribute('data-seg');
      const claim = currentClaims.find(c => c.id === claimId);
      if (!claim) return;

      const compat = checkMarketCompatibility(claim.marketSegments, segKey, restrictionMatrix, enforceHard);
      if (compat.status === 'conflict' && enforceHard) {
        alert(`Cannot add ${currentMarketSegments[segKey]?.name || segKey}: ${compat.reason} (Hard Restriction Enforcement is active).`);
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
  claimsTableBody?.addEventListener('click', e => {
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
        const keys = Object.keys(currentMarketSegments);
        const curIdx = keys.indexOf(claim.marketSegments[0] || keys[0]);
        const nextKey = keys[(curIdx + 1) % keys.length];
        claim.marketSegments = [nextKey];
        claim.drug = currentMarketSegments[nextKey].defaultDrug;
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

  // Direct input handling on table inputs
  claimsTableBody?.addEventListener('change', e => {
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
  btnTableAddRow?.addEventListener('click', () => {
    const lastClaim = currentClaims[currentClaims.length - 1];
    const newStart = lastClaim ? lastClaim.startDay + 30 : 0;
    const defaultSeg = Object.keys(currentMarketSegments)[1] || Object.keys(currentMarketSegments)[0] || 'SGLT2';
    const newClaim = {
      id: (currentClaims.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1,
      startDay: newStart,
      daysSupply: 30,
      drug: currentMarketSegments[defaultSeg]?.defaultDrug || 'Jardiance (10mg)',
      marketSegments: [defaultSeg]
    };
    currentClaims.push(newClaim);
    selectedClaimId = newClaim.id;
    render();
  });

  btnTableDuplicate?.addEventListener('click', () => {
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

  btnTableDelete?.addEventListener('click', () => {
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
      if (modalAddSegment?.classList.contains('active')) {
        modalAddSegment.classList.remove('active');
      }
    }
  });

  // Window resize responsive adaptation
  window.addEventListener('resize', () => {
    render();
  });

  // Expose test and debugging hooks onto window
  window.EPISODE_SIM = {
    getCurrentClaims: () => currentClaims,
    getMarketSegments: () => currentMarketSegments,
    getRestrictionMatrix: () => restrictionMatrix,
    getViewMode: () => episodeViewMode,
    toggleMatrixCell,
    addCustomMarketSegment,
    deleteCustomMarketSegment,
    setEpisodeViewMode: (mode) => {
      episodeViewMode = mode;
      if (mode === 'regimen') {
        btnViewRegimen?.classList.add('active');
        btnViewSegment?.classList.remove('active');
      } else {
        btnViewSegment?.classList.add('active');
        btnViewRegimen?.classList.remove('active');
      }
      render();
    },
    buildTreatmentEpisodes,
    render
  };

  // Initial render
  render();
}
