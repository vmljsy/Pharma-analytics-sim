# rx.sim — Longitudinal Patient Analytics & Pharma RWE Lab

Interactive visual simulation platform for longitudinal prescription claims (LRX), patient episode construction, compliance, persistence, oncology lines of therapy (LoT), and commercial market dynamics. High-precision numerical models executed directly client-side in your browser.

🌐 **Profile**: [vmljsy.github.io](https://vmljsy.github.io)  
📦 **Repository**: [github.com/vmljsy/patient-analytics-simulations](https://github.com/vmljsy/patient-analytics-simulations)

---

## Available Modules (6 Clinical & Commercial Simulators)

### Claims & Episode Dynamics
| Module | Status | Key Concepts & Features |
|---|---|---|
| [**Episode Building & Overlap Resolution**](experiments/episode-building/) | ✅ Live | Converts discrete dispensing claims $(t_i, d_i)$ into continuous treatment episodes. Implements push-forward stockpiling, early refill truncation/overwrite, concurrent parallel coverage, and dynamic gap tolerance thresholds ($G_{\text{allowed}}$). |
| [**Compliance: PDC vs MPR Simulator**](experiments/compliance-adherence/) | ✅ Live | Interactive 365-day daily coverage bitmask demonstrating why CMS and PQA standardized on Proportion of Days Covered (PDC) over Medication Possession Ratio (MPR) to eliminate stockpiling bias and terminal gap omissions. |

### Commercial Flow & Market Dynamics
| Module | Status | Key Concepts & Features |
|---|---|---|
| [**Source of Business (SoB) Dynamics**](experiments/source-of-business/) | ✅ Live | Longitudinal patient classification into New to Brand (Naive), Competitor Switch-In, Add-On Combinations, Restarts, and Continuing Maintenance. Features interactive Sankey patient flows and individual patient journey trace inspections. |
| [**Brand Switching Matrix & Markov Chains**](experiments/switching-matrix/) | ✅ Live | First-order discrete-time Markov chain transition modeling ($P_{ij}$), 12-month forward share projections ($\mathbf{s}_k = \mathbf{s}_0 \mathbf{P}^k$), and net switching balance waterfalls (inflow vs outflow). |

### Biostatistics & Oncology Sequences
| Module | Status | Key Concepts & Features |
|---|---|---|
| [**Treatment Persistence & Kaplan-Meier**](experiments/persistence-analysis/) | ✅ Live | Non-parametric Kaplan-Meier product-limit estimator $\hat{S}(t) = \prod (1 - d_i/n_i)$, Greenwood's standard error confidence bands, right-censoring ticks, at-risk tables, and the permissible gap sensitivity paradox. |
| [**Line of Therapy (LoT) Sequencing**](experiments/line-of-therapy/) | ✅ Live | Multi-agent oncology combination bundling via regimen definition windows (e.g. 28 days), progression switch triggers, drop-to-maintenance de-escalation logic, and interactive clinical swimmer plots across solid and hematologic tumors. |

---

## Tech Stack & Architecture

- **Vanilla JavaScript (ES6 Modules)** — Clean, zero-build-step client-side execution.
- **HTML5 & Pure CSS3** — Minimalist interface inspired by the shadcn/ui zinc palette with specialized healthcare status tokens.
- **Plotly.js (v2.35.2 via CDN)** — High-performance interactive timelines, Sankey flows, Gantt swimmer plots, and survival step curves.
- **KaTeX (v0.16.11 via CDN)** — Fast client-side LaTeX mathematical typesetting.
- **Static Deployment** — Fully compatible with Cloudflare Pages, GitHub Pages, or any static host.

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
│   └── common.js                              # Shared patient analytics algorithms & Plotly theme
├── docs/
│   └── patient_analytics_specs.md             # In-depth algorithmic & mathematical specifications
├── experiments/
│   ├── episode-building/                      # Module 1: Episode Building & Overlaps
│   ├── source-of-business/                    # Module 2: Source of Business & Patient Flow
│   ├── persistence-analysis/                  # Module 3: Treatment Persistence (Kaplan-Meier)
│   ├── line-of-therapy/                       # Module 4: Line of Therapy Sequencing (LoT)
│   ├── compliance-adherence/                  # Module 5: Compliance: PDC vs MPR
│   └── switching-matrix/                      # Module 6: Switching Matrix & Markov Chains
├── test_runner.py                             # Automated CDP test suite for all modules
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
