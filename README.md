# PricerPoint — Final Dealership ML Prototype

PricerPoint is a dealership/manager-side used-car acquisition and quotation system. It helps a used-car dealership evaluate vehicles quickly and generate a competitive, profitable, risk-aware acquisition quote before competitors.

## Problem Statement

Used-car dealerships need to quote the best acquisition price quickly when a seller brings a vehicle or when multiple vehicles are being evaluated. The current manual process depends on human judgement, market checking, negotiation experience, and rough estimation. This makes quoting slow, inconsistent, and risky. PricerPoint automates the workflow using ML market-value prediction plus a dealer decision engine for quote, risk, profit, and action recommendation.

## Current Prototype Scope

This final prototype focuses on the dealership/manager internal portal only.

- Seller portal: on hold
- Buyer portal: on hold
- Separate admin portal: on hold/removed because it duplicated dealer functionality
- Computer vision/photo condition analysis: on hold; manual condition input is used

## Technologies

Frontend:
- React + Vite
- JavaScript/JSX
- CSS3
- React Context API
- Recharts

Backend:
- Python
- FastAPI
- Uvicorn
- Pydantic
- CORS middleware

Machine Learning:
- CatBoost Regressor
- Pandas
- NumPy
- Scikit-learn metrics

## ML Training Improvements Included

- Uses the uploaded CarDekho-style dataset ZIP: `ml_training/data/cardekho_vehicle_dataset.zip`
- Uses `cars_details_merges.csv` for training
- Uses 70/15/15 split:
  - 70% train
  - 15% validation
  - 15% test
- Uses validation-based hyperparameter selection
- Includes train/validation/test metrics to check overfitting and underfitting
- Uses median imputation for numeric missing values because used-car data is skewed and outlier-heavy
- Uses log transformation: `log1p(selling_price)` during training and `expm1()` during prediction
- Reached test R² > 0.90 in the selected prototype model

## Final Model Metrics

Current selected model:

- Model: CatBoost Regressor
- Train R²: 0.9137
- Validation R²: 0.9060
- Test R²: 0.9136
- Test MAE: ₹106,364.45
- Test RMSE: ₹216,502.34
- Test MAPE: 14.07%

Overfitting check:

- Train-validation R² gap: 0.0077
- Status: healthy generalization

## Condition Handling Fix

The dataset does not contain a verified real inspection-condition label. Earlier, using engineered condition directly as an ML categorical feature could cause non-monotonic results, for example Poor condition sometimes producing a higher price than Average for the same vehicle.

Final fix:

1. CatBoost predicts a base market value using dataset-backed vehicle features.
2. A monotonic condition calibration is applied after prediction:
   - Excellent: 1.035
   - Good: 1.000
   - Average: 0.940
   - Poor: 0.860
3. This guarantees that for the same car:
   - Excellent >= Good >= Average >= Poor

## Run Backend

```bash
cd pricerpoint
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Backend docs:

```text
http://localhost:8000/docs
```

## Run Frontend

```bash
cd pricerpoint
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Demo Login

```text
dealer@pricerpoint.ai / dealer123
```

## CSV Bulk Upload Format

```csv
brand,model,year,fuel,transmission,odometer_reading,fuel_efficiency,city,owner_count,engine_cc,condition,seller_asking_price
Honda,City,2021,Petrol,Manual,28000,17.5,Mumbai,1,1497,Good,850000
Hyundai,Creta,2020,Diesel,Automatic,45000,18.0,Delhi,2,1493,Average,1050000
Toyota,Fortuner,2021,Diesel,Automatic,22000,14.2,Bangalore,1,2755,Excellent,3050000
```

## API Endpoints

- `GET /health`
- `GET /metadata`
- `POST /predict`
- `POST /evaluate`
- `POST /bulk-evaluate`

## Evaluation Flow

```text
Vehicle details
→ FastAPI backend
→ CatBoost base market value prediction
→ Condition calibration
→ Dealer decision engine
→ Recommended buy price / sell price / profit / risk / action
→ Home and Analytics update from live evaluation history
```

## Important Explanation

The ML model predicts base market value. The dealer decision engine calculates recommended buy price, sell price, expected profit, risk score, confidence score, deal quality score, urgency score, and BUY/NEGOTIATE/REJECT recommendation.
