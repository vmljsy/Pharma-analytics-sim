/**
 * rx.sim — Parametric Distributions, Statistical Samplers & Reproducible PRNG
 * 
 * Implements:
 * 1. Mulberry32 & xoshiro128** seedable pseudo-random number generators
 * 2. Parametric samplers: Uniform, Normal, Weibull, Log-Logistic, Gamma, Beta-Binomial, Dirichlet
 * 3. URL state serialization & deserialization helpers
 * 4. Client-side synthetic claims CSV export utility
 */

// ─── 1. Seedable PRNG (Mulberry32) ──────────────────────────────

/**
 * Creates a deterministic Mulberry32 PRNG instance.
 * @param {number|string} seed - Seed value
 * @returns {Function} Callable returning uniform float in [0, 1)
 */
export function createPRNG(seed = 42) {
  let s = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
  if (s === 0) s = 1337;

  return function prng() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Helper to hash an arbitrary string into a 32-bit unsigned integer.
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

/**
 * Parses URL query parameters, extracting an optional ?seed= or returning default.
 */
export function getSeedFromURL(defaultSeed = 42) {
  if (typeof window === 'undefined') return defaultSeed;
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed');
  if (seedParam !== null && seedParam !== '') {
    const parsed = parseInt(seedParam, 10);
    return isNaN(parsed) ? hashString(seedParam) : parsed;
  }
  return defaultSeed;
}

// ─── 2. Parametric Distributions API ─────────────────────────────

/**
 * Continuous Uniform in [min, max).
 */
export function randomUniform(min = 0, max = 1, prng = Math.random) {
  return min + (max - min) * prng();
}

/**
 * Standard Normal via Box-Muller transform: N(mu, sigma^2).
 */
export function randomNormal(mu = 0, sigma = 1, prng = Math.random) {
  let u1 = prng();
  let u2 = prng();
  while (u1 <= 1e-15) u1 = prng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mu + z0 * sigma;
}

/**
 * Weibull distribution: t = lambda * (-ln(1 - U))^(1 / k).
 * @param {number} scale - Lambda (scale parameter)
 * @param {number} shape - k (shape parameter)
 */
export function randomWeibull(scale = 1.0, shape = 1.5, prng = Math.random) {
  let u = prng();
  while (u <= 1e-15 || u >= 1.0) u = prng();
  return scale * Math.pow(-Math.log(1.0 - u), 1.0 / shape);
}

/**
 * Log-Logistic distribution: t = alpha * (U / (1 - U))^(1 / beta).
 * @param {number} scale - Alpha (median/scale parameter)
 * @param {number} shape - Beta (shape parameter)
 */
export function randomLogLogistic(scale = 1.0, shape = 2.0, prng = Math.random) {
  let u = prng();
  while (u <= 1e-15 || u >= 1.0) u = prng();
  return scale * Math.pow(u / (1.0 - u), 1.0 / shape);
}

/**
 * Gamma distribution via Marsaglia and Tsang's method (2000).
 * Valid for shape k > 0.
 * @param {number} shape - k (alpha)
 * @param {number} scale - theta (1 / beta)
 */
export function randomGamma(shape = 2.0, scale = 1.0, prng = Math.random) {
  if (shape < 1.0) {
    // Boost via Weibull/property: Gamma(shape) = Gamma(shape + 1) * U^(1 / shape)
    const u = Math.max(1e-15, prng());
    return randomGamma(shape + 1.0, scale, prng) * Math.pow(u, 1.0 / shape);
  }

  const d = shape - 1.0 / 3.0;
  const c = 1.0 / Math.sqrt(9.0 * d);

  while (true) {
    let z;
    let v;
    do {
      z = randomNormal(0, 1, prng);
      v = 1.0 + c * z;
    } while (v <= 0);

    v = v * v * v;
    const u = prng();

    if (u < 1.0 - 0.0331 * z * z * z * z) {
      return d * v * scale;
    }
    if (Math.log(u) < 0.5 * z * z + d * (1.0 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Beta distribution using ratio of two independent Gamma variables.
 */
export function randomBeta(alpha = 2.0, beta = 2.0, prng = Math.random) {
  const gA = randomGamma(alpha, 1.0, prng);
  const gB = randomGamma(beta, 1.0, prng);
  const total = gA + gB;
  return total > 0 ? gA / total : 0.5;
}

/**
 * Beta-Binomial distribution: simulates latent trait heterogeneity in adherence.
 * @param {number} n - Number of trials (e.g. 12 refill opportunities)
 * @param {number} alpha - Beta shape parameter alpha
 * @param {number} beta - Beta shape parameter beta
 */
export function randomBetaBinomial(n = 12, alpha = 2.0, beta = 2.0, prng = Math.random) {
  const p = randomBeta(alpha, beta, prng);
  let successes = 0;
  for (let i = 0; i < n; i++) {
    if (prng() < p) successes++;
  }
  return successes;
}

/**
 * Dirichlet distribution: samples a vector of proportions summing to 1.
 * Useful for Bayesian uncertainty fan charts on transition matrices.
 * @param {number[]} alphaVector - Vector of concentration parameters
 * @returns {number[]} Vector of probabilities summing to 1.0
 */
export function randomDirichlet(alphaVector = [1, 1, 1], prng = Math.random) {
  const gammas = alphaVector.map(a => randomGamma(Math.max(0.01, a), 1.0, prng));
  const sum = gammas.reduce((acc, g) => acc + g, 0);
  if (sum === 0) {
    const eq = 1.0 / alphaVector.length;
    return alphaVector.map(() => eq);
  }
  return gammas.map(g => g / sum);
}

// ─── 3. URL State Serialization & Counterfactual Pinning ─────────

/**
 * Serializes an object of parameters into the browser's URL query string without reloading.
 */
export function serializeStateToURL(stateObj) {
  if (typeof window === 'undefined' || !window.history) return;
  const url = new URL(window.location.href);
  Object.entries(stateObj).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      url.searchParams.set(key, String(val));
    }
  });
  window.history.replaceState({}, '', url.toString());
}

/**
 * Reads initial state from URL query parameters.
 */
export function deserializeStateFromURL() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const state = {};
  for (const [key, value] of params.entries()) {
    // Attempt numeric parse
    const num = Number(value);
    state[key] = !isNaN(num) && value.trim() !== '' ? num : value;
  }
  return state;
}

// ─── 4. Client-Side Synthetic Claims CSV Export ──────────────────

/**
 * Exports an array of records as a downloadable CSV file.
 * @param {Object[]} records - Array of flat claim/patient objects
 * @param {string} filename - Desired filename (e.g. 'simulated_claims.csv')
 */
export function exportToCSV(records, filename = 'simulated_claims.csv') {
  if (!records || records.length === 0) {
    alert('No records available to export.');
    return;
  }

  const headers = Object.keys(records[0]);
  const rows = [headers.join(',')];

  records.forEach(rec => {
    const values = headers.map(h => {
      const v = rec[h];
      if (v === undefined || v === null) return '';
      const str = String(v).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    });
    rows.push(values.join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

