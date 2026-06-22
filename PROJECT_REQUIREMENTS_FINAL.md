# PricerPoint — Final Prototype Requirements & Checklist

## 1. Problem Statement

Used-car dealership companies need to quote the best acquisition price quickly after a seller presents a vehicle or when a batch of vehicles is being considered. The current manual process is slow, inconsistent, and dependent on individual evaluator judgement. Because competing dealerships may quote faster, delay can lead to lost deals. PricerPoint automates market valuation and dealer quote generation so the dealership can respond faster with a profitable, risk-aware price.

## 2. Scope

Current final prototype scope: dealership/manager internal portal only.

On hold:
- Seller-side portal
- Buyer-side portal
- Separate admin portal
- Computer vision/photo-based condition analysis

## 3. Stakeholders

- Seller: external car owner who wants to sell a used car. Not implemented as separate portal.
- Buyer: future end customer who may buy inventory from dealership. Not implemented.
- Dealer/Manager: main current user. Evaluates cars, runs ML valuation, bulk uploads cars, sees dashboard/analytics, and generates acquisition decisions.
- Admin: future role for higher-level oversight. Removed from current prototype because it duplicated dealer behavior.

## 4. Functional Requirements

- Dealer can log in with demo credentials.
- Dealer can enter single vehicle details.
- Dealer can choose manual condition: Excellent, Good, Average, Poor.
- Dealer can run CatBoost ML valuation.
- Dealer receives market value, buy price, sell price, expected profit, risk score, confidence score, deal quality, urgency, and final action.
- Dealer can bulk upload CSV with multiple vehicles.
- Every CSV row must receive its own ML evaluation and analysis.
- Home page and Analytics must update from live evaluation history.
- No fixed demo analytics should control active dashboard values.
- Photo upload is optional/future only; manual condition is used now.

## 5. ML Requirements

- Use uploaded CarDekho-style dataset ZIP.
- Use cars_details_merges.csv for training.
- Use 70% train, 15% validation, 15% test.
- Use validation set for hyperparameter selection.
- Report train, validation, and test metrics.
- Check overfitting/underfitting using train-validation-test score gaps.
- Use median imputation for skewed numeric variables.
- Use log1p target transformation and expm1 prediction conversion.
- Perform/treat hyperparameter tuning as a documented model-selection process.
- Target R² > 0.90 where possible without faking performance.

## 6. Current ML Result

Selected model: CatBoost Regressor

- Train R²: 0.9137
- Validation R²: 0.9060
- Test R²: 0.9136
- Test MAE: ₹106,364.45
- Test RMSE: ₹216,502.34
- Test MAPE: 14.07%
- Overfitting status: healthy generalization

## 7. Condition Pricing Fix

Issue found: the same car with Poor condition could sometimes receive a higher ML price than Average condition.

Root cause: the dataset does not contain verified inspection-condition labels. Earlier condition was engineered and used as an ML categorical feature, which could cause non-monotonic condition behavior.

Final fix:
- CatBoost predicts base market value without condition.
- Manual condition is applied through monotonic calibration.
- Excellent multiplier: 1.035
- Good multiplier: 1.000
- Average multiplier: 0.940
- Poor multiplier: 0.860

This guarantees Excellent >= Good >= Average >= Poor for the same vehicle.

## 8. Backend APIs

- GET /health
- GET /metadata
- POST /predict
- POST /evaluate
- POST /bulk-evaluate

## 9. Evaluation Formula Summary

ML:
- Base Market Value = CatBoost prediction from uploaded-dataset features
- Final Market Value = Base Market Value × Condition Multiplier

Rule-based dealer engine:
- Target Profit = Market Value × target margin percentage
- Holding Cost = Market Value × 2.5%
- Risk Buffer = Market Value × (Risk Score / 100) × 8%
- Recommended Buy Price = Market Value - Target Profit - Repair Buffer - Holding Cost - Risk Buffer
- Recommended Sell Price = Market Value × 1.05
- Expected Profit = Recommended Sell Price - Recommended Buy Price - Repair Buffer - Holding Cost
- Deal Quality = weighted combination of margin strength, confidence, and low risk
- Final Action = BUY / NEGOTIATE / REJECT / MANUAL REVIEW

## 10. Current Prototype Structure

```text
pricerpoint/
├── backend/
│   ├── main.py
│   ├── decision_engine.py
│   └── requirements.txt
├── ml_training/
│   ├── train_ml_model.py
│   ├── requirements.txt
│   └── data/cardekho_vehicle_dataset.zip
├── model_artifacts/
│   ├── vehicle_price_catboost.cbm
│   ├── model_metadata.json
│   ├── training_report.json
│   └── cleaned_training_sample.csv
├── src/
│   ├── context/
│   ├── screens/
│   ├── utils/
│   ├── components/
│   ├── App.jsx
│   └── App.css
├── README.md
├── README_ML_FINAL.md
└── PROJECT_REQUIREMENTS_FINAL.md
```
