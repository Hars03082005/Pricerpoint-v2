# PricerPoint — Dealership ML Valuation System

> **Scope:** Dealership / manager internal portal only.  
> Seller portal · Buyer portal · Computer vision — all on hold.

PricerPoint automates used-car acquisition decisions for dealerships. A dealer enters vehicle details, the system predicts the market value using an ML ensemble, applies a condition calibration, runs a rule-based dealer decision engine, and returns a complete acquisition recommendation — buy price, sell price, profit, risk score, and BUY / NEGOTIATE / REJECT action — in under a second.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [How It Works](#2-how-it-works)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [ML Pipeline](#5-ml-pipeline)
6. [Model Performance](#6-model-performance)
7. [Segmented Models](#7-segmented-models)
8. [Backend API](#8-backend-api)
9. [Decision Engine Formula](#9-decision-engine-formula)
10. [Frontend Screens](#10-frontend-screens)
11. [Setup & Run](#11-setup--run)
12. [Demo Login](#12-demo-login)
13. [Known Issues & Next Improvements](#13-known-issues--next-improvements)
14. [Version History](#14-version-history)

---

## 1. Problem Statement

Used-car dealerships must quote a competitive acquisition price the moment a seller walks in. The manual process — market lookup, negotiation experience, rough estimation — is slow, inconsistent, and risky. A competing dealership can win the deal simply by quoting faster.

PricerPoint solves this by:
- Predicting market value from vehicle features using a trained ML ensemble
- Routing predictions to price-bracket-specific models for accuracy
- Generating a complete dealer decision (price, profit, risk, action) instantly

---

## 2. How It Works

```
Dealer enters vehicle details
        ↓
FastAPI backend receives request
        ↓
get_segment() routes to correct price bracket model
    Budget (≤₹5L)   → Global ensemble  (MAPE 11.93%)
    Mid    (₹5–15L) → Mid segment model (MAPE  8.64%)
    Premium (₹15L+) → Premium segment model (MAPE 9.18%)
        ↓
Base market value predicted (log1p → expm1)
        ↓
Condition multiplier applied (Excellent/Good/Average/Poor)
        ↓
Dealer decision engine calculates:
    - Recommended buy price
    - Recommended sell price
    - Expected profit
    - Risk score / Confidence score / Deal quality
    - Negotiation trio (opening / target / walk-away)
    - BUY / NEGOTIATE / REJECT action
        ↓
Response returned to React frontend
```

---

## 3. Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework and build tool |
| JavaScript / JSX | Component logic |
| CSS3 | Styling (no Tailwind) |
| React Context API | Global app state |
| Recharts | Analytics charts |

### Mobile
| Technology | Purpose |
|---|---|
| Flutter | Android / iOS shell |
| WebView | Wraps the React frontend |
| `npm run build:mobile` | Builds the bundle for Flutter |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.13 | Runtime |
| FastAPI | REST API framework |
| Uvicorn | ASGI server |
| Pydantic | Request / response validation |
| Joblib | Segment model loading |

### Machine Learning
| Technology | Purpose |
|---|---|
| CatBoost | Base learner (handles categoricals natively) |
| LightGBM | Base learner (dominant ensemble weight) |
| XGBoost | Base learner |
| Scikit-learn | Metrics, train/val/test split |
| SciPy | Ensemble weight optimisation (SLSQP) |
| Pandas / NumPy | Data cleaning and feature engineering |

---

## 4. Project Structure

```
pricerpoint-v2/
├── backend/
│   ├── main.py                  # FastAPI app, segment routing, prediction
│   ├── decision_engine.py       # Rule-based dealer logic
│   ├── ensemble_predictor.py    # Global ensemble loader
│   ├── brand_catalog.py         # Brand/model lookup
│   ├── __init__.py
│   └── requirements.txt
│
├── ml_training/
│   ├── train_ml_model.py        # Full training pipeline
│   ├── clean_data.py            # Standalone data cleaning script
│   ├── requirements.txt
│   └── data/
│       ├── cars.csv             # Raw dataset – gitignored (36,956 rows, 46 OEMs)
│       ├── cleaned.csv          # Output of clean_data.py – gitignored
│       └── brand_stats.csv      # Per-brand depreciation stats (tracked)
│
├── model_artifacts/             # All large binaries are gitignored; retrain to reproduce
│   ├── vehicle_price_lightgbm.txt     # Global LightGBM (tracked, ~2.5 MB)
│   ├── model_metadata.json            # Training metadata + metrics (tracked)
│   └── cleaned_training_sample.csv    # 500-row sample for inspection (tracked)
│
├── src/
│   ├── screens/
│   │   ├── AuthScreen.jsx             # Login
│   │   ├── HomeScreen.jsx             # Dashboard overview
│   │   ├── InputScreen.jsx            # Vehicle input form
│   │   ├── ResultScreen.jsx           # ML result + decision
│   │   ├── EnhancedResultScreen.jsx   # Wheelr enrichment result
│   │   ├── EnhancedValuationScreen.jsx
│   │   ├── DashboardScreen.jsx        # Analytics
│   │   ├── ExplainScreen.jsx          # SHAP-style explanation
│   │   ├── PricingScreen.jsx          # Pricing breakdown
│   │   ├── ReverseCalculatorScreen.jsx # Reverse price calculator
│   │   └── AssistantScreen.jsx        # AI assistant
│   ├── components/
│   │   ├── SearchableSelect.jsx
│   │   └── WheelrPanels.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── utils/
│   │   └── apiValuation.js
│   ├── App.jsx
│   └── App.css
│
├── mobile/                       # Flutter shell (WebView wraps the React build)
│   ├── lib/
│   ├── pubspec.yaml
│   └── README.md
├── scripts/
│   └── bundle-web-for-mobile.ps1 # Copies dist/ into Flutter assets
├── public/
├── dist/                         # Production build output – gitignored
├── index.html
├── vite.config.js
├── eslint.config.js
├── package.json
└── README.md
```

---

## 5. ML Pipeline

### Dataset
| Metric | Value |
|---|---|
| Source | `ml_training/data/cars.csv` |
| Raw rows | 36,956 |
| Clean rows | 36,439 |
| OEM brands | 46 |
| Price range (clean) | ₹50,343 – ₹9.55 Cr |

### Features Used (14)
| Feature | Type | Notes |
|---|---|---|
| `brand` | Categorical | OEM name |
| `model` | Categorical | Model name |
| `variant` | Categorical | Trim/variant level |
| `vehicle_age` | Numeric | `2026 - year` |
| `fuel_type` | Categorical | Petrol/Diesel/CNG/Electric |
| `transmission` | Categorical | Manual/Automatic |
| `odometer_reading` | Numeric | km driven |
| `fuel_efficiency` | Numeric | km/L (median-imputed) |
| `owner_count` | Numeric | Number of previous owners |
| `engine_cc` | Numeric | Engine displacement |
| `city` | Categorical | Listing city |
| `km_per_year` | Numeric | `odometer / max(age, 1)` |
| `ownership_trust_score` | Numeric | 100→25 by owner count |
| `vehicle_health_score` | Numeric | `100 - age×3 - km/10000 - (owners-1)×8` |

### Training Split
```
Total: 36,439 rows
  ├── Train:      70%  (~25,507 rows)
  ├── Validation: 15%  (~5,466 rows)  ← ensemble weight optimisation
  └── Test:       15%  (~5,466 rows)  ← final unbiased metrics
```

### Ensemble Strategy
- Three base learners trained independently: CatBoost, LightGBM, XGBoost
- Ensemble weights optimised on the validation set using SLSQP (maximise R²)
- Final prediction: `w_cb × pred_cb + w_lgb × pred_lgb + w_xgb × pred_xgb`
- Target transform: `log1p(selling_price)` → `expm1()` at inference

### Condition Calibration (post-ML)
Applied after ensemble prediction to enforce monotonicity:
| Condition | Multiplier |
|---|---|
| Excellent | 1.035 |
| Good | 1.000 |
| Average | 0.940 |
| Poor | 0.860 |

---

## 6. Model Performance

### Global Ensemble (all price ranges, legacy fallback)
| Split | R² | MAE | RMSE | MAPE |
|---|---|---|---|---|
| Train | 0.9504 | ₹73,429 | ₹1,62,674 | 10.37% |
| Validation | 0.9364 | ₹86,145 | ₹1,93,193 | 11.84% |
| **Test** | **0.9312** | **₹84,531** | **₹1,94,993** | **11.93%** |

**Overfitting gap:** 0.014 → `healthy_generalization` ✅

### Ensemble Weights (Global)
| Model | Weight |
|---|---|
| LightGBM | 85.5% |
| CatBoost | 9.5% |
| XGBoost | 5.1% |

---

## 7. Brand-Class Models

Four separate ensembles trained per brand class — routing is done by brand name, which is always known at inference time (no price estimation pass needed):

| Class | Brands | Routing |
|---|---|---|
| **Budget** | Maruti, Datsun, Chevrolet, Fiat, Force, Ashok Leyland... | `brand` maps to `budget` |
| **Mid** | Hyundai, Honda, Tata, Ford, Mahindra, Renault, Nissan... | `brand` maps to `mid` |
| **Premium** | Volkswagen, Skoda, Toyota, MG, Kia, Jeep, Volvo, Lexus... | `brand` maps to `premium` |
| **Luxury** | BMW, Mercedes-Benz, Audi, Jaguar, Land Rover, Porsche... | `brand` maps to `luxury` |

### Why brand-class instead of price-bracket?
- Price bracket required a two-pass hack (estimate price → re-route). Brand is always known.
- Within a class, feature → price relationships are far more consistent (depreciation curves, mileage premiums, etc.)
- Luxury brands get their own model instead of being lumped into "Premium"
- Unknown brands default to `mid` (safe prior)

### Routing Logic
```python
brand_class = BRAND_CLASS_MAP.get(brand.lower(), "mid")  # always O(1)
model       = BRAND_CLASS_MODELS[brand_class]             # direct lookup, no estimation
```

API response includes:
```json
{
  "brand_class": "mid",
  "class_model_used": true,
  "routing_note": "mid class model used"
}
```

---

## 8. Backend API

### Base URL
```
http://localhost:8000
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server + model status |
| GET | `/metadata` | Full model metadata + metrics |
| GET | `/api/brands` | Brand catalog for frontend dropdowns |
| POST | `/predict` | Market value prediction |
| POST | `/evaluate` | Full dealer evaluation (value + decision) |
| POST | `/evaluate-enhanced` | Wheelr enrichment (recon, risk, negotiation) |
| POST | `/reverse-calculate` | Given sell price → max buy price |
| POST | `/bulk-evaluate` | Array of vehicles, one evaluation each |

### Sample Request — `/evaluate`
```json
{
  "brand": "Honda",
  "model": "City",
  "year": 2021,
  "fuel_type": "Petrol",
  "transmission": "Manual",
  "odometer_reading": 28000,
  "fuel_efficiency": 17.5,
  "owner_count": 1,
  "engine_cc": 1497,
  "city": "Mumbai",
  "condition": "Good",
  "seller_asking_price": 750000,
  "target_margin_pct": 15,
  "repair_buffer": 25000
}
```

### Sample Response — `/evaluate`
```json
{
  "base_market_value": 735000,
  "market_value": 735000,
  "condition_multiplier": 1.0,
  "condition_adjustment": 0,
  "condition_score": 75,
  "price_segment": "mid",
  "segment_model_used": true,
  "routing_note": "mid segment model used",
  "recommended_buy_price": 580000,
  "recommended_sell_price": 771750,
  "expected_profit": 91500,
  "risk_score": 22,
  "confidence_score": 78,
  "deal_quality_score": 81,
  "urgency_score": 65,
  "action": "BUY",
  "shap": [...],
  "warnings": []
}
```

---

## 9. Decision Engine Formula

```
Final Market Value   = Base ML Value × Condition Multiplier
Target Profit        = Market Value × target_margin_pct %
Holding Cost         = Market Value × 2.5%
Risk Buffer          = Market Value × (risk_score / 100) × 8%
Recommended Buy      = Market Value − Target Profit − Repair Buffer − Holding Cost − Risk Buffer
Recommended Sell     = Market Value × 1.05
Expected Profit      = Recommended Sell − Recommended Buy − Repair Buffer − Holding Cost

Action thresholds:
  BUY        → confidence ≥ 65 AND risk < 55
  NEGOTIATE  → confidence 50–64 OR risk 55–74
  REJECT     → confidence < 50 OR risk ≥ 75
```

---

## 10. Frontend Screens

| Screen | Purpose |
|---|---|
| `AuthScreen` | Demo login (`dealer@pricerpoint.ai / dealer123`) |
| `HomeScreen` | Live dashboard with recent evaluations |
| `InputScreen` | Vehicle details form (brand, model, specs, condition) |
| `ResultScreen` | Market value + BUY/NEGOTIATE/REJECT result |
| `EnhancedResultScreen` | Wheelr enrichment: recon cost, risk deductions, negotiation trio |
| `EnhancedValuationScreen` | Combined valuation with enrichment panel |
| `DashboardScreen` | Analytics: volume, MAPE trends, brand breakdown |
| `ExplainScreen` | SHAP-style feature contribution breakdown |
| `PricingScreen` | Price waterfall breakdown |
| `ReverseCalculatorScreen` | Enter desired sell price → calculate max buy |
| `AssistantScreen` | AI assistant (Q&A about the evaluation) |

---

## 11. Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip, npm

### 1. Install ML dependencies & train models
```bash
pip install -r ml_training/requirements.txt

# Clean the dataset (outputs ml_training/data/cleaned.csv)
python ml_training/clean_data.py

# Train all models (global + 3 segments, ~3 minutes)
# On Windows, set PYTHONUTF8=1 to avoid encoding errors in the training log
set PYTHONUTF8=1 && python ml_training/train_ml_model.py
```

### 2. Run backend
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```
API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Run frontend
```bash
npm install
npm run dev
```
App: [http://localhost:5173](http://localhost:5173)

### 4. Mobile (Flutter)
```bash
npm run build:mobile
cd mobile
flutter pub get
flutter run
```
See `mobile/README.md` for device-specific instructions.

---

## 12. Demo Login

```
Email:    dealer@pricerpoint.ai
Password: dealer123
```

---

## 13. Known Issues & Next Improvements

### 🟡 Medium
- Physical features (`Seats`, `No of Cylinder`, `power_to_weight_ratio`) exist in `cleaned.csv` but are not yet in `FEATURES` — adding them would further improve per-class accuracy
- `km_per_year` is uncapped — `car_age = 0` inflates this feature to the raw odometer value
- Luxury class row count (~1,500) is thin; if test R² for luxury is low, consider merging with Premium as fallback

### 🟢 Low
- Add `sys.stdout.reconfigure(encoding='utf-8')` at the top of the training script so it works on Windows without the `PYTHONUTF8=1` env var
- Add model versioning (timestamp suffix on artifacts) so retrains don't silently overwrite previous metrics
- `training_report.json` and `model_metadata.json` are identical writes in the training script — one can be removed

---

## 14. Version History

| Version | Change | Test MAPE |
|---|---|---|
| v2.0 | Baseline: CatBoost + LightGBM + XGBoost ensemble | 12.31% |
| v2.1 | Added `variant` as categorical feature | **11.93%** |
| v2.2 | `ex_showroom_price` + `depreciation_ratio` — **reverted** (target leakage) | 11.93% |
| v2.3 | Price-bracket segmented models (budget / mid / premium) | Mid: **8.64%** · Premium: **9.18%** |
| v2.4 | Fixed variant wiring, saved category levels in segment pkls, & added two-pass routing fallback | Global: **11.93%** · Mid: **8.64%** · Premium: **9.18%** |

---

*PricerPoint is a dealership-internal prototype. All predictions are ML estimates and should be reviewed by an experienced dealer before finalising any acquisition.*
