# rx.sim — Longitudinal Patient Analytics & Pharma RWE Lab

Interactive visual simulation platform for longitudinal prescription claims (LRX), patient episode construction, compliance, persistence, oncology lines of therapy (LoT), and commercial market dynamics. High-precision numerical models executed directly client-side in your browser.

🌐 **Profile**: [vmljsy.github.io](https://vmljsy.github.io)  
📦 **Repository**: [github.com/vmljsy/patient-analytics-simulations](https://github.com/vmljsy/patient-analytics-simulations)

---

## Available Modules (12 Clinical, Commercial & Causal Simulators)

### Claims, Demographics & Network Censoring
| Module | Status | Key Concepts & Features |
|---|---|---|
| [**Episode Building & Overlap Resolution**](experiments/episode-building/) | ✅ Live | Converts discrete dispensing claims into continuous episodes. Features Støvring Waiting-Time Distribution (WTD) 95th percentile cut-off estimators and 2D gap-stockpiling persistence surface contours. |
| [**Compliance: PDC, MPR & GBTM Trajectories**](experiments/compliance-adherence/) | ✅ Live | Group-Based Trajectory Modeling (GBTM) with 4 latent clusters, CMA7 vs CMA8 carryover taxonomy, and log-logistic out-of-pocket copay abandonment elasticity. |
| [**Patient Demographics & Comorbidity Matrix**](experiments/patient-demographics-comorbidities/) | ✅ Live | Population age-sex demographic pyramids, Medicare age 65 transition cliff, Charlson Comorbidity Index (CCI) weighting, co-occurrence heatmaps ($P(A \cap B)$), and adherence degradation across risk quintiles ($Q_1\text{--}Q_5$). |
| [**Open-Network Censoring & Eligibility Proxy**](experiments/open-network-censoring/) | ✅ Live | Quantifies artificial downward persistence bias in open commercial LRX switch networks when patients fill via unlinked specialty pharmacies, and demonstrates bias recovery via pharmacy activity floors. |

### Commercial Flow, SFE & Payer Access
| Module | Status | Key Concepts & Features |
|---|---|---|
| [**Source of Business (SoB) Dynamics**](experiments/source-of-business/) | ✅ Live | Longitudinal patient classification into New to Brand (Naive), Competitor Switch-In, Add-On Combinations, Restarts, and Continuing Maintenance. Features interactive Sankey patient flows. |
| [**Brand Switching Matrix & Markov Chains**](experiments/switching-matrix/) | ✅ Live | First-order discrete-time Markov chains, clinical Mover-Stayer decomposition ($\mathbf{P} = \text{diag}(\mathbf{S}) + \text{diag}(\mathbf{1}-\mathbf{S})\mathbf{M}$), and Dirichlet-Multinomial Bayesian credible fan charts. |
| [**HCP Prescriber Concentration & SFE Alignment**](experiments/hcp-targeting-sfe/) | ✅ Live | Models physician volume skew via Lorenz concentration curves, Gini index ($\text{Gini} \approx 0.75$), doctor decile/quintile segmentation, detailing response curves, sales rep capacity (FTEs), and regional territory coverage. |
| [**Payer Formulary Adjudication Funnel**](experiments/adjudication-funnel/) | ✅ Live | Models written prescription attrition through Prior Authorization (PA) hurdles, Weibull-distributed turnaround delays, and copay abandonment curves ($P(\text{Abandon} \mid \text{Copay})$). |

### Biostatistics, Causal Inference & Oncology
| Module | Status | Key Concepts & Features |
|---|---|---|
| [**Treatment Persistence & Parametric Survival**](experiments/persistence-analysis/) | ✅ Live | Non-parametric Kaplan-Meier estimator with Greenwood confidence bands, Weibull/Log-Logistic/Gompertz parametric extrapolations, Mixture Cure models ($S(t) = \pi + (1-\pi)S_u(t)$), and 24-month RMST. |
| [**Line of Therapy (LoT) Sequencing**](experiments/line-of-therapy/) | ✅ Live | Multi-agent oncology combination bundling via regimen definition windows (e.g. 28 days), progression switch triggers, drop-to-maintenance de-escalation logic, and interactive clinical swimmer plots. |
| [**Multi-Indication Probabilistic Attribution**](experiments/indication-splitting/) | ✅ Live | Dissects unlabelled pharmacy claims across multi-indication biologics by comparing deterministic waterfall rules against Naive Bayes soft attribution models. |
| [**Synthetic Control & Target Trial Emulation**](experiments/synthetic-control/) | ✅ Live | Eliminates confounding by indication using Inverse Probability of Treatment Weighting (IPTW), Clone-Censor-Weight trial emulation, and Love Plot covariate balance (SMD $< 0.1$). |

---

## Tech Stack & Architecture

- **Vanilla JavaScript (ES6 Modules)** — Clean, zero-build-step client-side execution.
- **Parametric Distributions Engine (`src/distributions.js`)** — Seedable Mulberry32 PRNG, Weibull, Log-Logistic, Gamma, Beta-Binomial, and Dirichlet samplers.
- **HTML5 & Pure CSS3** — Minimalist interface inspired by the shadcn/ui zinc palette with specialized healthcare status tokens.
- **Plotly.js (v2.35.2 via CDN)** — High-performance interactive timelines, Sankey flows, Gantt swimmer plots, and survival step curves.
- **KaTeX (v0.16.11 via CDN)** — Fast client-side LaTeX mathematical typesetting.
- **State Serialization & Data Export** — Instant URL parameter sharing deep-links, Delta Mode curve pinning, and synthetic claims CSV export.

---

## Project Structure

```
patient-analytics-simulations/
├── index.html                                 # Main catalog & module showcase
├── 404.html                                   # Custom 404 error page
├── _headers                                   # Cloudflare/hosting headers
├── .gitignore                                 # Git ignore rules
├── css/
│   └── style.css                              # Design system tokens & specialized pharma styles
├── js/
│   ├── common.js                              # Shared patient analytics algorithms & Plotly theme
│   └── distributions.js                       # Seedable PRNG & parametric distribution samplers
├── src/
│   └── distributions.js                       # Spec re-export
├── docs/
│   ├── patient_analytics_specs.md             # In-depth algorithmic & mathematical specifications
│   └── rx_sim_advanced_architecture_rwe_enhancement_specification.md
├── experiments/
│   ├── episode-building/                      # Module 1: Episode Building, WTD & Sensitivity
│   ├── compliance-adherence/                  # Module 2: Compliance: PDC, MPR & GBTM
│   ├── source-of-business/                    # Module 3: Source of Business & Patient Flow
│   ├── switching-matrix/                      # Module 4: Switching Matrix & Mover-Stayer
│   ├── persistence-analysis/                  # Module 5: Treatment Persistence & Parametric Extrap
│   ├── line-of-therapy/                       # Module 6: Line of Therapy Sequencing (LoT)
│   ├── hcp-targeting-sfe/                     # Module 7: HCP Concentration & SFE Alignment
│   ├── patient-demographics-comorbidities/    # Module 8: Patient Demographics & Comorbidities
│   ├── indication-splitting/                  # Module 9: Multi-Indication Attribution
│   ├── open-network-censoring/                # Module 10: Open-Network Censoring & Activity Floors
│   ├── adjudication-funnel/                   # Module 11: Payer Formulary Adjudication Funnel
│   └── synthetic-control/                     # Module 12: Synthetic Control & Target Trial Emulation
├── test_runner.py                             # Automated CDP test suite for all 12 modules
└── README.md
```

---

## Running Locally

Serve the directory with any standard static HTTP server:

```bash
# Python 3
python -m http.server 8080

# Node / npx
npx serve .
```

Then open `http://localhost:8080` in any modern web browser.

---

## Automated Verification Suite

Run the headless Chrome DevTools Protocol (CDP) test runner:

```bash
python test_runner.py
```

This automates:
- HTTP 200 response validation across all endpoints
- DOM node mounting and KaTeX math element validation
- Plotly SVG / WebGL canvas rendering assertions
- Real-time parameter slider sweeps and zero console error verification.

---

## Author

**Vimal Joshy**  
Data Scientist at IQVIA | NIT Calicut Graduate  
Specializing in Longitudinal Patient Data (LRX), Machine Learning, and Generative AI.  
🌐 [vmljsy.github.io](https://vmljsy.github.io)

