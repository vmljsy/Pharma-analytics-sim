# Longitudinal Patient Analytics & Pharma RWE Simulation Specifications

Comprehensive mathematical, clinical, and algorithmic reference for longitudinal patient analytics, prescription claims dynamics (LRX), episode construction, compliance, persistence, and oncology regimen sequencing.

---

## 1. Episode Building & Overlap Resolution

### 1.1 Formal Claims Representation
Let a longitudinal patient prescription claims stream for a given active ingredient or therapeutic class be denoted by an ordered sequence of discrete dispensing events:

$$\mathcal{C} = \left\{ (t_1, d_1), (t_2, d_2), \dots, (t_m, d_m) \right\}$$

Where:
- $t_i \in \mathbb{R}_{\ge 0}$: The dispensing date (day relative to index origin).
- $d_i \in \mathbb{Z}^+$: Days of supply dispensed at event $i$.
- $t_{i} \le t_{i+1}$ (monotonic chronological ordering).

### 1.2 Overlap Resolution Mechanics
When a refill occurs prior to the exhaustion of the prior dispensing event ($t_i < t_{i-1}^{\text{eff}} + d_{i-1}$), three primary heuristic paradigms exist:

#### 1. Push-Forward (Stockpiling)
Assumes the patient preserves unused tablets from the prior fill and consumes medication sequentially without waste:

$$t_i^{\text{eff}} = \max\left(t_i, \; t_{i-1}^{\text{eff}} + d_{i-1}\right)$$
$$\text{End}_i^{\text{eff}} = t_i^{\text{eff}} + d_i$$

#### 2. Truncation (Overwrite / Discard)
Assumes early refills indicate dose adjustments, lost medications, or physician instructions to immediately discard remaining supply:

$$\text{End}_{i-1}^{\text{eff}} = \min\left(t_{i-1} + d_{i-1}, \; t_i\right)$$
$$t_i^{\text{eff}} = t_i, \qquad \text{End}_i^{\text{eff}} = t_i + d_i$$

#### 3. Parallel (Concurrent Consumption)
Fills run concurrently, creating dual coverage days for that interval.

### 1.3 Allowable Gap Tolerance ($G_{\text{allowed}}$)
Between any two consecutive adjusted claims, the unsupplied treatment gap is:

$$\Delta t_i = t_i^{\text{eff}} - \text{End}_{i-1}^{\text{eff}}$$

- If $\Delta t_i \le G_{\text{allowed}}$, the gap is bridged into the active treatment episode $\text{EP}_k$.
- If $\Delta t_i > G_{\text{allowed}}$, $\text{EP}_k$ terminates with an unsupplied discontinuation event at $\text{End}_{i-1}^{\text{eff}}$, and a new episode $\text{EP}_{k+1}$ begins at $t_i^{\text{eff}}$.

---

## 2. Compliance & Adherence: PDC vs MPR

### 2.1 Medication Possession Ratio (MPR)

#### Fixed Interval MPR
Calculated over a fixed observation measurement window of length $T$ (typically 365 days):

$$\text{MPR}_{\text{uncapped}} = \frac{\sum_{i=1}^m d_i}{T} \times 100\%$$

$$\text{MPR}_{\text{capped}} = \min\left(100\%, \; \text{MPR}_{\text{uncapped}}\right)$$

#### Variable Interval MPR
Evaluates possession strictly between the first and last dispensing event, ignoring the terminal year-end discontinuation gap:

$$\text{MPR}_{\text{variable}} = \frac{\sum_{i=1}^{m-1} d_i}{t_m - t_1} \times 100\%$$

### 2.2 Proportion of Days Covered (PDC)
The standard CMS, NCQA (HEDIS), and Pharmacy Quality Alliance (PQA) adherence metric. Overlapping days of supply are shifted forward, creating a binary daily indicator vector:

$$c(t) = \begin{cases} 1 & \text{if medication is in possession on day } t \\ 0 & \text{otherwise} \end{cases}$$

$$\text{PDC} = \frac{\sum_{t=1}^T c(t)}{T} \times 100\%$$

**Adherence Benchmark:** Patients with $\text{PDC} \ge 80\%$ are classified as adherent ($\mathbb{I}_{\text{adherent}} = 1$).

---

## 3. Source of Business (SoB) Dynamics

Evaluates patient origin upon brand initiation at $t_{\text{index}}$ across a lookback window $[t_{\text{index}} - W_{\text{lookback}}, t_{\text{index}})$:

1. **Continuing / Maintenance:** Prior fill of target brand with gap $\le W_{\text{restart}}$.
2. **Restart / Re-initiation:** Prior fill of target brand separated by gap $> W_{\text{restart}}$.
3. **Add-On / Combination:** Concomitant active supply of competitor therapy overlapping $t_{\text{index}}$.
4. **Switch-In:** Discontinued competitor therapy within switch gap $\Delta t \le W_{\text{switch}}$.
5. **New to Brand (Naive):** Zero target or competitor claims in the lookback window.

---

## 4. Treatment Persistence & Kaplan-Meier Survival

### 4.1 Non-Parametric Product-Limit Estimator
For discrete discontinuation event times $t_1 < t_2 < \dots < t_k$:

$$\hat{S}(t) = \prod_{t_i \le t} \left( 1 - \frac{d_i}{n_i} \right)$$

Where $d_i$ is the number of discontinuation events at $t_i$, and $n_i$ is the number of patients remaining at risk immediately prior to $t_i$.

### 4.2 Greenwood Variance Formula
$$\widehat{\text{Var}}(\hat{S}(t)) = [\hat{S}(t)]^2 \sum_{t_i \le t} \frac{d_i}{n_i (n_i - d_i)}$$

$$\text{95\% CI}(S(t)) = \hat{S}(t) \pm 1.96 \sqrt{\widehat{\text{Var}}(\hat{S}(t))}$$

---

## 5. Line of Therapy (LoT) Sequencing

### 5.1 Regimen Identification Window ($W_{\text{regimen}}$)
Multi-agent regimens (e.g., Carboplatin + Pemetrexed + Pembrolizumab) initiated within $W_{\text{regimen}}$ (typically 28 days) are bundled into a single therapeutic regimen:

$$R = \bigcup \left\{ \text{Drug}_j \mid t_j \in [t_{\text{index}}, \; t_{\text{index}} + W_{\text{regimen}}] \right\}$$

### 5.2 Progression & De-escalation Rules
- **Switch:** Core agent replaced by new class after $W_{\text{regimen}} \implies \text{Advance to Next Line } (n+1)\text{L}$.
- **Add-On:** New antineoplastic introduced after $W_{\text{regimen}} \implies \text{Advance to Next Line or Augmentation}$.
- **Drop-to-Maintenance:** Backbone cytotoxic agent discontinued while targeted/immuno agent continues $\implies \text{Remain in Current Line as Maintenance}$.
- **Treatment Holiday:** Therapy-free gap $> W_{\text{holiday}}$ (e.g., 90 days) $\implies \text{Discontinuation of Active Line}$.

---

## 6. Discrete-Time Markov Transition Matrices

Patient state transitions across $M$ competing brands:

$$\mathbf{P} = \begin{bmatrix}
P_{11} & P_{12} & \dots & P_{1M} \\
P_{21} & P_{22} & \dots & P_{2M} \\
\vdots & \vdots & \ddots & \vdots \\
P_{M1} & P_{M2} & \dots & P_{MM}
\end{bmatrix}, \qquad \sum_{j=1}^M P_{ij} = 1$$

Projected market share vector after $k$ cycles:

$$\mathbf{s}_k = \mathbf{s}_0 \mathbf{P}^k$$

---

## 7. HCP Prescriber Concentration, Lorenz Curves & Sales Force Effectiveness (SFE)

### 7.1 Prescriber Volume Skew & Lorenz Formulation
Let $N$ prescribers (HCPs) be sorted monotonically by total prescription volume (TRx/NRx):

$$y_1 \le y_2 \le \dots \le y_N, \qquad Y_k = \sum_{i=1}^k y_i, \qquad Y_N = \sum_{i=1}^N y_i$$

The cumulative physician proportion is $p_k = \frac{k}{N}$, and the cumulative volume proportion is $L(p_k) = \frac{Y_k}{Y_N}$.

### 7.2 Gini Coefficient Calculation
The Gini coefficient measures prescribing concentration relative to perfect equality ($L(p) = p$):

$$G = 1 - 2 \int_0^1 L(p) \, dp = \frac{\sum_{i=1}^N (2i - N - 1) y_i}{N \sum_{i=1}^N y_i}$$

In specialty therapeutics (Oncology, Immunology, Rare Disease), $G \in [0.70, 0.90]$, reflecting high volume concentration where the top $15\%\text{--}20\%$ of physicians generate $\ge 80\%$ of volume.

### 7.3 Decile / Quintile Segmentation
Prescribers are categorized into $K$ quantiles (Deciles $D_{1\dots10}$ or Quintiles $Q_{1\dots5}$):

- **Count Deciles:** Each bin contains $\frac{N}{10}$ physicians ranked by volume.
- **Volume Deciles (IQVIA Standard):** Each bin accounts for $\approx 10\%$ of total market TRx.
- **Detailing Allocation:**
  $$\text{Target Demand (Calls/Mo)} = \sum_{d \ge d_{\text{cutoff}}} N_d \times \text{Frequency}_d \times \text{Reach}_d$$
  $$\text{Required FTEs} = \frac{\text{Target Demand}}{\text{Rep Call Capacity (e.g. 110 calls/month)}}$$

### 7.4 Territory & Regional Alignment
Field representatives are balanced across geographic regions ($r \in \{\text{NE}, \text{SE}, \text{MW}, \text{SW}, \text{W}\}$):

$$\text{Coverage}_r = \min\left(100\%, \; \frac{\text{Reps}_r \times \text{Capacity}}{\text{Call Demand}_r} \times 100\%\right)$$

---

## 8. Patient Demographics, Payer Mix & Charlson Comorbidity Index (CCI)

### 8.1 Age-Sex Distribution & Medicare Age 65 Transition
Longitudinal claims cohorts exhibit distinct insurance channel eligibility cliffs. At age $t = 65$, patient coverage shifts discontinuously from Commercial / Employer-sponsored plans to Medicare Advantage (Part C) or Fee-for-Service Medicare (Parts A, B, and D):

$$\text{Payer}(t) = \begin{cases}
\text{Commercial (70\%) } \mid \text{Medicaid (20\%) } \mid \text{Cash/VA (10\%)}, & t < 65 \\
\text{Medicare Advantage (52\%) } \mid \text{Medicare FFS (40\%) } \mid \text{Dual (8\%)}, & t \ge 65
\end{cases}$$

### 8.2 Charlson Comorbidity Index (CCI) Scoring
Comorbid burden is quantified via standard clinical weights $w_k$:

$$\text{CCI} = \sum_{k=1}^K w_k \cdot x_k$$

Where:
- $w = 1$: Myocardial Infarction, Congestive Heart Failure, Peripheral Vascular Disease, Cerebrovascular Disease, Dementia, COPD, Rheumatologic Disease, Uncomplicated Diabetes.
- $w = 2$: Hemiplegia, Moderate/Severe Chronic Kidney Disease (CKD), Complicated Diabetes with end-organ damage, Solid Tumor Malignancy, Leukemia/Lymphoma.
- $w = 3$: Moderate to Severe Liver Disease.
- $w = 6$: Metastatic Solid Tumor, AIDS/HIV.

### 8.3 Comorbidity Co-occurrence & Clustering
Pairwise joint prevalence and Jaccard similarity index:

$$J(C_i, C_j) = \frac{|C_i \cap C_j|}{|C_i \cup C_j|}$$

Cardiorenal-metabolic conditions (Type 2 Diabetes, Hypertension, Dyslipidemia, Chronic Kidney Disease, and Heart Failure) exhibit high phenotypic clustering ($J > 0.35$).

### 8.4 Risk Quintile Stratification & Adherence Penalty
Patients are stratified into Risk Quintiles ($Q_1: \text{CCI}=0, \; Q_2: \text{CCI}=1, \; Q_3: \text{CCI}=2, \; Q_4: \text{CCI}=3\text{--}4, \; Q_5: \text{CCI} \ge 5$).

Polypharmacy and multimorbidity impose an empirical adherence penalty:

$$\text{PDC}(Q) = \text{PDC}_0 - \beta \cdot \overline{\text{CCI}}_Q + \epsilon$$

With higher risk quintiles demonstrating elevated treatment discontinuation rates and exponential increases in 12-month inpatient hospitalization hazard.


