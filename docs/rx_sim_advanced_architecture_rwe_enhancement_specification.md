# Rx.sim Platform: Advanced RWE Architecture & Enhancement Specification
**Target LLM Context:** Gemini Flash / LLM Code Generation & Prompt Injection  
**Target Platform:** Pure ES6 JavaScript + Plotly.js Client-Side Single-Page Application (`pharma-sim.22913112.xyz`)  

---

## 1. Executive Summary & Objective
`rx.sim` is an interactive, browser-based longitudinal prescription (LRX) claims simulation engine used to explore deterministic and stochastic health economics and outcomes research (HEOR) methodologies. 

This specification outlines the technical roadmap to transition `rx.sim` from basic deterministic heuristics (e.g., fixed bitmask PDC, static 1st-order Markov switching, and non-parametric Kaplan-Meier survival curves) to an advanced, parametric, and state-dependent RWE simulation suite. The resulting modules must remain lightweight, modular, and client-side executable without backend dependencies.

---

## 2. Core Architectural Requirements & Zero-Dependency Libraries
To ensure high performance and reproducibility across sessions, all random number generation (RNG) and statistical samplers must be self-contained in a single ES6 utility module (`src/distributions.js`).

### A. Seedable PRNG Requirement
* Implement a fast, deterministic PRNG such as **Mulberry32** or **xoshiro128\*\***.
* Every module must accept an optional seed parameter (e.g., `seed = 42`) in its URL query string or state object to guarantee reproducible simulation runs.

### B. Parametric Distribution Utility API (`src/distributions.js`)
The utility module must expose the following pure functions:
1. `randomUniform(min, max, prng)`
2. `randomWeibull(scale \lambda, shape k, prng)` via inverse transform: $t = \lambda \cdot (-\ln(1 - U))^{1/k}$
3. `randomLogLogistic(scale \alpha, shape \beta, prng)` via inverse transform: $t = \alpha \cdot \left(\frac{U}{1 - U}\right)^{1/\beta}$
4. `randomGamma(shape k, scale \theta, prng)` via Marsaglia and Tsang's method.
5. `randomBetaBinomial(n, alpha, beta, prng)` for adherence latent trait simulation.
6. `randomDirichlet(alphaVector, prng)` for market share transition uncertainty.

---

## 3. Detailed Module Expansion Specifications

### Module 1: Advanced Compliance & Adherence (`compliance-adherence`)
* **Current State:** Static bitmask PDC vs. MPR with fixed refill intervals.
* **Enhancements to Build:**
  * **Group-Based Trajectory Modeling (GBTM):** Cluster patient cohorts into 4 latent trajectories (*Early Discontinuers*, *Gradual Decliners*, *Gap-and-Restart*, *Consistent Adherers*) using simulated mixture probabilities.
  * **CMA Taxonomy Toggle:** Allow users to switch between CMA7 (accounting for carry-over within observation windows) and CMA8 (censoring carry-over prior to window start).
  * **Primary Non-Adherence & Copay Elasticity:** Model a pre-adjudication abandonment step where prescription fill probability decreases as a log-logistic function of out-of-pocket copay.

### Module 2: Episode Building & Gap Tolerance (`episode-building`)
* **Current State:** Fixed permissible gap ($30, 45, 60$ days) with simple push-forward logic.
* **Enhancements to Build:**
  * **Støvring Waiting-Time Distribution (WTD) Estimator:** Fit a mixture model of inter-arrival refill densities and uniform incidence densities to empirically determine the optimal permissible gap cut-off at the 95th percentile.
  * **2D Sensitivity Heatmap:** Render an interactive Plotly contour surface plotting Permissible Gap ($15 \text{ to } 120\text{ days}$) vs. Stockpiling Cap ($0 \text{ to } 90\text{ days}$) against 12-month persistence rates.

### Module 3: Brand Switching & Market Dynamics (`switching-matrix`)
* **Current State:** Time-homogeneous 1st-order Markov chain ($\mathbf{s}_{t+1} = \mathbf{s}_t \mathbf{P}$).
* **Enhancements to Build:**
  * **Mover-Stayer Model:** Partition the transition matrix $\mathbf{P}$ into a diagonal loyalty vector $\mathbf{S}$ (clinical "Stayers") and a switching matrix $\mathbf{M}$ ("Movers").
  * **Dirichlet-Multinomial Uncertainty:** Generate Bayesian credible fan charts around market share convergence curves by sampling transition probabilities from a Dirichlet distribution.

### Module 4: Persistence & Kaplan-Meier Survival (`persistence-analysis`)
* **Current State:** Non-parametric product-limit estimator with Greenwood standard errors.
* **Enhancements to Build:**
  * **Parametric Survival Extrapolation:** Fit Weibull, Log-Logistic, and Gompertz survival curves alongside non-parametric KM steps.
  * **Mixture Cure Models:** Implement $S(t) = \pi + (1-\pi)S_u(t)$ to model long-term functional responders ($\pi$) who never discontinue therapy.
  * **Restricted Mean Survival Time (RMST):** Calculate area-under-the-curve persistence up to a 24-month horizon $\tau$.

---

## 4. Four New High-Impact Modules to Implement

### A. Module 7: Multi-Indication Probabilistic Attribution (`indication-splitting`)
* **Goal:** Simulate drugs with multiple FDA indications (e.g., Rheumatology, Dermatology, Gastroenterology) where pharmacy LRX claims lack ICD-10 diagnosis codes.
* **Mechanics:** Compare a deterministic waterfall rule (ICD-10 match $\to$ Prescriber Specialty $\to$ Induction Dosing signature) against a Naive Bayes / Soft-Attribution model outputting posterior indication probabilities $P(\text{Indication}_k \mid \text{Rx, Dx, HCP})$.

### B. Module 8: Open-Network Censoring & Eligibility Proxy (`open-network-censoring`)
* **Goal:** Demonstrate how open commercial LRX networks lose visibility when patients switch to non-reporting specialty pharmacies.
* **Mechanics:** Toggle between strict closed-payer enrollment files and open-network Pharmacy Activity Floors (requiring at least 1 claim of *any* class within $[-180, -30]$ and $[+30, +180]$ days). Show how ignoring activity floors biases KM persistence downward.

### C. Module 9: Payer Formulary Adjudication Funnel (`adjudication-funnel`)
* **Goal:** Model the drop-off between written prescriptions and paid dispensary claims.
* **Mechanics:** Simulate a stochastic state machine: $\text{Written Rx} \to \text{Prior Auth Required} \to \text{Step Therapy Edit} \to \text{Paid / Reversed / Abandoned}$. Model Weibull-distributed PA turnaround lags and copay elasticity curves.

### D. Module 10: Synthetic Control & Target Trial Emulation (`synthetic-control`)
* **Goal:** Showcase why naive observational persistence comparisons fail due to confounding by indication.
* **Mechanics:** Simulate two treatment arms with baseline confounding (age, Charlson Comorbidity Index). Toggle between unadjusted KM, Inverse Probability of Treatment Weighting (IPTW), and Clone-Censor-Weight (CCW) trial emulation.

---

## 5. UI, State Serialization & Code Quality Standards

1. **Single-File Mandate for React/HTML Components:** If generating interactive UI widgets or mini-apps, everything must reside in a single self-contained HTML/JS file using Tailwind CSS and Plotly.js via CDN.
2. **URL State Serialization:** Automatically serialize active slider values, distribution choices, and PRNG seeds into URL query parameters to support shareable scenario deep-links.
3. **Delta Mode (Baseline vs. Counterfactual):** Enable a "Pin Current Curve" feature in Plotly charts to overlay ghost comparison traces when adjusting simulation parameters.
4. **Synthetic Data Export:** Include a "Download Simulated Claims CSV (`patient_id`, `fill_date`, `days_supply`, `ndc`, `paid_status`)" utility in every module.
