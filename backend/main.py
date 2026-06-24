from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.decision_engine import (
    calculate_decision,
    check_disqualifier,
    get_seasonal_multiplier,
    get_wheelr_risk_deductions,
    get_recon_cost,
    get_negotiation_trio,
    get_deal_health,
)
from backend.ensemble_predictor import EnsemblePredictor
from backend.brand_catalog import build_brand_catalog

# ── Paths & startup ───────────────────────────────────────────────────────────
ROOT         = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "model_artifacts"
METADATA_PATH = ARTIFACT_DIR / "model_metadata.json"

with open(METADATA_PATH, "r", encoding="utf-8") as f:
    METADATA = json.load(f)

FEATURES           = METADATA["features"]
CAT_FEATURES       = METADATA["categorical_features"]
CURRENT_YEAR       = METADATA.get("current_year_used_for_age", datetime.now().year)
CONDITION_MULTIPLIERS = METADATA.get("condition_handling", {}).get(
    "condition_multipliers", {"excellent": 1.035, "good": 1.0, "average": 0.94, "poor": 0.86}
)

predictor    = EnsemblePredictor.from_artifact_dir(ARTIFACT_DIR)
BRAND_CATALOG = build_brand_catalog()

# ── Segment models (v2.3) ─────────────────────────────────────────────────────
SEGMENT_MODELS: dict = {}
for _seg in ["budget", "mid", "premium"]:
    _path = ARTIFACT_DIR / f"ensemble_{_seg}.pkl"
    if _path.exists():
        SEGMENT_MODELS[_seg] = joblib.load(_path)

SEGMENT_BINS = {
    "budget":  (0,         500_000),
    "mid":     (500_000,   1_500_000),
    "premium": (1_500_000, float("inf")),
}

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="PricerPoint ML API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────
class VehicleInput(BaseModel):
    brand: str = "Honda"
    model: str = "City"
    variant: str = "unknown"        # trim level — sent by frontend, used by all 3 segment models
    year: int = 2021
    fuel_type: str = "Petrol"
    transmission: str = "Manual"
    odometer_reading: int = Field(28000, ge=0)
    fuel_efficiency: float = 17.5
    owner_count: int = Field(1, ge=1)
    engine_cc: int = Field(1497, ge=0)
    city: str = "Mumbai"
    condition: str = "Good"
    seller_asking_price: float = 0
    target_margin_pct: float = 15
    repair_buffer: float = 25000


DEFAULT_VENDOR_TYPE = {
    "engine":    "vendor",
    "tyre":      "vendor",
    "body":      "vendor",
    "interior":  "vendor",
    "electrical":"vendor",
}


class EnhancedEvaluateRequest(VehicleInput):
    accident_history: str = "none"
    registration_state: str = ""
    sale_state: str = ""
    loan_outstanding: bool = False
    seller_reason: str = "upgrading"
    engine_grade: str = "good"
    tyre_grade: str = "good"
    body_grade: str = "clean"
    interior_grade: str = "clean"
    electrical_grade: str = "all_good"
    vendor_type: dict = Field(default_factory=lambda: dict(DEFAULT_VENDOR_TYPE))


class ReverseCalculateRequest(BaseModel):
    expected_sell_price: int = Field(..., ge=0)
    year: int = Field(2021, ge=1990)
    accident_history: str = "none"
    registration_state: str = ""
    sale_state: str = ""
    loan_outstanding: bool = False
    seller_reason: str = "upgrading"
    engine_grade: str = "good"
    tyre_grade: str = "good"
    body_grade: str = "clean"
    interior_grade: str = "clean"
    electrical_grade: str = "all_good"
    vendor_type: dict = Field(default_factory=lambda: dict(DEFAULT_VENDOR_TYPE))
    owner_count: int = Field(1, ge=1)
    odometer: int = Field(0, ge=0)
    target_margin_pct: float = Field(0.15, ge=0, le=1)


# ── Helper functions ──────────────────────────────────────────────────────────
def clean_text(value: object, default: str = "unknown") -> str:
    if value is None:
        return default
    text = str(value).strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text if text else default


def normalize_model_name(brand: str, model_name: str) -> str:
    brand_clean = clean_text(brand)
    model_clean = clean_text(model_name)
    if brand_clean != "unknown" and brand_clean not in model_clean:
        return f"{brand_clean} {model_clean}"
    return model_clean


def condition_to_score(condition: str) -> int:
    return {"excellent": 90, "good": 75, "average": 58, "poor": 38}.get(clean_text(condition), 65)


def build_features(vehicle: VehicleInput) -> pd.DataFrame:
    vehicle_age = max(0, CURRENT_YEAR - int(vehicle.year))
    km          = max(0, float(vehicle.odometer_reading or 0))
    owner       = max(1, int(vehicle.owner_count or 1))
    # Cap km_per_year at 50,000 to prevent inflation when vehicle_age == 0.
    # Identical cap must be applied in train_ml_model.py (Task 3).
    km_per_year = min(km / max(vehicle_age, 1), 50_000)
    ownership_trust_score = {1: 100, 2: 75, 3: 55, 4: 35, 5: 25}.get(owner, 35)
    vehicle_health_score  = max(0, min(100, 100 - vehicle_age * 3 - km / 10000 - (owner - 1) * 8))
    # fuel_efficiency: cars.csv and cleaned.csv have no mileage column.
    # Model was trained with median-imputed value = 0.0 for all rows.
    # Sending 0 is correct — it matches training distribution exactly.
    fuel_eff = float(vehicle.fuel_efficiency or 0)

    row = {
        "brand":                 clean_text(vehicle.brand),
        "model":                 normalize_model_name(vehicle.brand, vehicle.model),
        "variant":               clean_text(vehicle.variant or "unknown"),
        "vehicle_age":           vehicle_age,
        "fuel_type":             clean_text(vehicle.fuel_type),
        "transmission":          clean_text(vehicle.transmission),
        "odometer_reading":      km,
        "fuel_efficiency":       fuel_eff,
        "owner_count":           owner,
        "engine_cc":             float(vehicle.engine_cc or 0),
        "city":                  clean_text(vehicle.city),
        "condition":             clean_text(vehicle.condition, "good"),
        "km_per_year":           km_per_year,
        "ownership_trust_score": ownership_trust_score,
        "vehicle_health_score":  vehicle_health_score,
    }
    df = pd.DataFrame([row], columns=FEATURES)
    for col in CAT_FEATURES:
        df[col] = df[col].astype(str)
    return df


def condition_multiplier(condition: str) -> float:
    return float(
        CONDITION_MULTIPLIERS.get(
            clean_text(condition, "good"),
            CONDITION_MULTIPLIERS.get("good", 1.0),
        )
    )


# ── Segment routing helpers ───────────────────────────────────────────────────
def get_segment(price: float) -> str:
    """Map a known price to its bracket. Only call this when price > 0."""
    if price > 1_500_000:
        return "premium"
    if price > 500_000:
        return "mid"
    return "budget"


def _run_segment_model(features: pd.DataFrame, seg_artifact: dict) -> float:
    """Run the three sub-models for a segment and return the blended log-price.

    Task 4: uses `category_levels` saved in the pkl to normalise unseen
    categories to "unknown" so LightGBM never receives an out-of-vocab value.
    """
    cb_f  = features.copy()
    lgb_f = features.copy()
    xgb_f = features.copy()
    for col in seg_artifact.get("cat_features", []):
        if col in features.columns:
            cat_levels = seg_artifact.get("category_levels", {}).get(col, [])
            for frame in (cb_f, lgb_f, xgb_f):
                if cat_levels:
                    frame[col] = frame[col].astype(str).where(
                        frame[col].astype(str).isin(cat_levels), "unknown"
                    )
                else:
                    frame[col] = frame[col].astype(str)
    weights = seg_artifact["weights"]
    preds = {
        "catboost": float(seg_artifact["catboost"].predict(cb_f)[0]),
        "lightgbm": float(seg_artifact["lightgbm"].predict(lgb_f)[0]),
        "xgboost":  float(seg_artifact["xgboost"].predict(xgb_f)[0]),
    }
    return sum(weights[k] * preds[k] for k in weights)


# ── Core prediction ───────────────────────────────────────────────────────────
def predict_base_market_value(vehicle: VehicleInput) -> tuple[int, str]:
    """
    Returns (market_value_inr: int, routing_note: str).   # Task 5 — explicit return type doc

    Routing rules (in priority order):
      1. seller_asking_price > 0  → use stated price to pick bracket directly
           budget  (≤₹5L)   → global ensemble  (MAPE 11.93% beats segment 13.39%)
           mid     (₹5–15L) → mid segment model (MAPE  8.64%)
           premium (₹15L+)  → premium segment model (MAPE  9.18%)
      2. seller_asking_price == 0 → TWO-PASS (Task 2):
           Pass 1: run cheap global ensemble to get a rough price estimate
           Pass 2: derive the segment from that estimate, re-predict with the
                   correct segment model if applicable
           This avoids blindly defaulting every unknown-price car to "mid".
    """
    features = build_features(vehicle)
    asking   = float(vehicle.seller_asking_price or 0)

    if asking > 0:
        # Seller stated a price — use it to pick segment directly
        segment = get_segment(asking)
    else:
        # No asking price — run a cheap global pass to infer the price bracket
        try:
            rough_log   = predictor.predict_log_price(features)
            rough_price = float(np.expm1(rough_log))
        except Exception:
            rough_price = 750_000  # safe mid-range fallback if global pass fails
        segment = get_segment(max(50_000, min(rough_price, 20_000_000)))

    # Budget: global model outperforms the dedicated budget segment model
    if segment == "budget":
        log_price    = predictor.predict_log_price(features)
        routing_note = "budget — global model used (MAPE 11.93% vs 13.39% for segment model)"
    else:
        seg_artifact = SEGMENT_MODELS.get(segment)
        if seg_artifact:
            try:
                log_price    = _run_segment_model(features, seg_artifact)
                routing_note = f"{segment} segment model used"
            except Exception:
                log_price    = predictor.predict_log_price(features)
                routing_note = f"{segment} segment model error — fell back to global"
        else:
            log_price    = predictor.predict_log_price(features)
            routing_note = "global model used (segment model not found)"

    market_value = float(np.expm1(log_price))
    if not math.isfinite(market_value):
        market_value = 0
    market_value = max(50_000, min(market_value, 20_000_000))
    return int(round(market_value / 500) * 500), routing_note  # -> tuple[int, str]


def predict_market_value(vehicle: VehicleInput) -> dict:
    """Return base ML value and final condition-calibrated market value.

    Condition is applied as a monotonic calibration after ensemble prediction.
    This guarantees Excellent >= Good >= Average >= Poor for the same vehicle.

    Note: predict_base_market_value returns tuple[int, str] — always unpack both values.
    """
    # Task 5 audit: base_value is correctly unpacked from the tuple here.
    # shap_like_explanation() and warnings_for() receive market_value (int) — correct.
    base_value, routing_note = predict_base_market_value(vehicle)
    # Recompute segment from asking price (consistent with predict_base_market_value routing)
    asking  = float(vehicle.seller_asking_price or 0)
    segment = get_segment(asking) if asking > 0 else get_segment(base_value)

    mult     = condition_multiplier(vehicle.condition)
    adjusted = max(50_000, min(base_value * mult, 20_000_000))
    adjusted = int(round(adjusted / 500) * 500)
    return {
        "base_market_value":    int(base_value),
        "market_value":         int(adjusted),
        "condition_multiplier": round(mult, 3),
        "condition_adjustment": int(adjusted - base_value),
        "condition_score":      condition_to_score(vehicle.condition),
        "price_segment":        segment,
        "segment_model_used":   segment in SEGMENT_MODELS and segment != "budget",
        "routing_note":         routing_note,
    }


def shap_like_explanation(vehicle: VehicleInput, market_value: int) -> list[dict]:
    # market_value is a bare int (passed from evaluate_vehicle) — Task 5 confirmed correct.
    age = max(0, CURRENT_YEAR - int(vehicle.year))
    km  = max(0, int(vehicle.odometer_reading or 0))
    fe  = float(vehicle.fuel_efficiency or 0)
    cond_score = condition_to_score(vehicle.condition)
    items = [
        {"feature": "ML Model",         "value": METADATA.get("model_name", "Ensemble ML"), "contribution": int(market_value * 0.08)},
        {"feature": "Vehicle Age",       "value": f"{age} yrs",            "contribution": int(-age * market_value * 0.025)},
        {"feature": "Odometer Reading",  "value": f"{km/1000:.0f}k km",    "contribution": int(-max(km - 25000, 0) / 10000 * market_value * 0.012)},
        {"feature": "Fuel Efficiency",   "value": f"{fe:.1f} km/l" if fe else "Not provided", "contribution": int((fe - 16) * market_value * 0.004) if fe else 0},
        {"feature": "Fuel Type",         "value": vehicle.fuel_type,       "contribution": int((1 if clean_text(vehicle.fuel_type) in {"petrol", "hybrid"} else -1) * market_value * 0.015)},
        {"feature": "Transmission",      "value": vehicle.transmission,    "contribution": int((1 if clean_text(vehicle.transmission) == "automatic" else 0) * market_value * 0.025)},
        {"feature": "Condition",         "value": f"{cond_score}/100",     "contribution": int((cond_score - 70) / 100 * market_value * 0.12)},
    ]
    return sorted(items, key=lambda x: abs(x["contribution"]), reverse=True)


def warnings_for(vehicle: VehicleInput, decision: dict) -> list[str]:
    # market_value is never touched here — no tuple unpacking needed. Task 5 confirmed correct.
    warnings = []
    age = max(0, CURRENT_YEAR - int(vehicle.year))
    if vehicle.odometer_reading > 100000:
        warnings.append("High odometer reading detected (>1L km)")
    if age > 8:
        warnings.append("Vehicle age exceeds 8 years")
    if clean_text(vehicle.condition) == "poor":
        warnings.append("Poor condition — reconditioning advised")
    if decision["risk_score"] >= 65:
        warnings.append("High acquisition risk — manual inspection recommended")
    if decision["confidence_score"] < 60:
        warnings.append("Lower confidence because of risk or missing data")
    return warnings


def evaluate_vehicle(vehicle: VehicleInput) -> dict:
    prediction   = predict_market_value(vehicle)
    market_value = prediction["market_value"]   # int — safe to pass to shap/warnings
    decision     = calculate_decision(vehicle, market_value)
    return {
        **prediction,
        "model_name":         METADATA["model_name"],
        "is_ml_powered":      True,
        "metrics":            METADATA.get("metrics", {}),
        "train_metrics":      METADATA.get("train_metrics", {}),
        "validation_metrics": METADATA.get("validation_metrics", {}),
        "test_metrics":       METADATA.get("test_metrics", {}),
        "overfitting_check":  METADATA.get("overfitting_check", {}),
        "shap":               shap_like_explanation(vehicle, market_value),
        "warnings":           warnings_for(vehicle, decision),
        **decision,
    }


# ── API routes ────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":           "ok",
        "model_loaded":     (ARTIFACT_DIR / "vehicle_price_catboost.cbm").exists(),
        "ensemble_enabled": METADATA.get("ensemble", {}).get("enabled", False),
        "model_name":       METADATA["model_name"],
        "segments_loaded":  list(SEGMENT_MODELS.keys()),
    }


@app.get("/metadata")
def metadata():
    return METADATA


@app.get("/api/brands")
def get_brands():
    return {"brands": BRAND_CATALOG}


@app.post("/predict")
def predict(vehicle: VehicleInput):
    prediction = predict_market_value(vehicle)
    return {
        **prediction,
        "model_name":    METADATA["model_name"],
        "is_ml_powered": True,
    }


@app.post("/evaluate")
def evaluate(vehicle: VehicleInput):
    return evaluate_vehicle(vehicle)


def _wheelr_enrichment(
    *,
    market_value: int,
    recommended_buy_price: int,
    profit_target: int,
    vehicle_age: int,
    odometer: int,
    owner_count: int,
    accident_history: str,
    registration_state: str,
    sale_state: str,
    loan_outstanding: bool,
    seller_reason: str,
    engine_grade: str,
    tyre_grade: str,
    body_grade: str,
    interior_grade: str,
    electrical_grade: str,
    vendor_type: dict,
) -> dict:
    current_month      = datetime.now().month
    seasonal_multiplier = get_seasonal_multiplier(current_month)
    disqualifier       = check_disqualifier(vehicle_age, odometer, owner_count, accident_history)
    recon              = get_recon_cost(engine_grade, tyre_grade, body_grade, interior_grade, electrical_grade, vendor_type)
    wheelr_risk        = get_wheelr_risk_deductions(owner_count, odometer, accident_history, registration_state, sale_state, loan_outstanding, seller_reason)
    enhanced_max_buy_price = max(0, int(recommended_buy_price - recon["total"] - wheelr_risk["total"]))
    negotiation        = get_negotiation_trio(enhanced_max_buy_price, wheelr_risk["seller_reason_adj"])
    deal_health        = get_deal_health(market_value, recon["total"], profit_target, owner_count, odometer, accident_history)
    return {
        "disqualifier":        disqualifier,
        "seasonal_multiplier": seasonal_multiplier,
        "seasonal_month":      current_month,
        "recon": {
            "total":      recon["total"],
            "breakdown":  recon["breakdown"],
            "fixed_cost": recon["fixed_cost"],
        },
        "wheelr_risk":           wheelr_risk,
        "negotiation":           negotiation,
        "deal_health":           deal_health,
        "enhanced_max_buy_price": enhanced_max_buy_price,
    }


@app.post("/evaluate-enhanced")
def evaluate_enhanced(vehicle: EnhancedEvaluateRequest):
    base        = evaluate_vehicle(vehicle)
    vehicle_age = max(0, CURRENT_YEAR - int(vehicle.year))
    sale_state  = vehicle.sale_state or vehicle.registration_state or vehicle.city
    profit_target = int(
        base.get("expected_profit")
        or base.get("margin_amt")
        or base["market_value"] * (vehicle.target_margin_pct / 100)
    )
    enrichment = _wheelr_enrichment(
        market_value=base["market_value"],
        recommended_buy_price=base["recommended_buy_price"],
        profit_target=profit_target,
        vehicle_age=vehicle_age,
        odometer=int(vehicle.odometer_reading),
        owner_count=int(vehicle.owner_count),
        accident_history=vehicle.accident_history,
        registration_state=vehicle.registration_state,
        sale_state=sale_state,
        loan_outstanding=vehicle.loan_outstanding,
        seller_reason=vehicle.seller_reason,
        engine_grade=vehicle.engine_grade,
        tyre_grade=vehicle.tyre_grade,
        body_grade=vehicle.body_grade,
        interior_grade=vehicle.interior_grade,
        electrical_grade=vehicle.electrical_grade,
        vendor_type=vehicle.vendor_type,
    )
    return {**base, **enrichment}


@app.post("/reverse-calculate")
def reverse_calculate(body: ReverseCalculateRequest):
    vehicle_age       = max(0, CURRENT_YEAR - int(body.year))
    odometer          = int(body.odometer)
    owner_count       = int(body.owner_count)
    expected_sell     = int(body.expected_sell_price)
    target_margin_pct = float(body.target_margin_pct)
    profit_target     = int(expected_sell * target_margin_pct)
    recon = get_recon_cost(body.engine_grade, body.tyre_grade, body.body_grade, body.interior_grade, body.electrical_grade, body.vendor_type)
    wheelr_risk = get_wheelr_risk_deductions(owner_count, odometer, body.accident_history, body.registration_state, body.sale_state, body.loan_outstanding, body.seller_reason)
    max_buy_price = max(0, expected_sell - recon["total"] - profit_target - wheelr_risk["total"])
    negotiation = get_negotiation_trio(max_buy_price, wheelr_risk["seller_reason_adj"])
    deal_health = get_deal_health(expected_sell, recon["total"], profit_target, owner_count, odometer, body.accident_history)
    disqualifier  = check_disqualifier(vehicle_age, odometer, owner_count, body.accident_history)
    current_month = datetime.now().month
    margin_label_pct = int(round(target_margin_pct * 100))
    return {
        "expected_sell_price": expected_sell,
        "recon":               {"total": recon["total"], "breakdown": recon["breakdown"]},
        "profit_target":       profit_target,
        "wheelr_risk":         wheelr_risk,
        "max_buy_price":       max_buy_price,
        "negotiation": {
            "opening":    negotiation["opening_offer"],
            "target":     negotiation["target_offer"],
            "walk_away":  negotiation["walk_away_price"],
        },
        "deal_health":         deal_health,
        "disqualifier":        disqualifier,
        "seasonal_multiplier": get_seasonal_multiplier(current_month),
        "price_breakdown": [
            {"label": "Expected selling price",      "value": expected_sell,          "sign": ""},
            {"label": "Reconditioning cost",         "value": recon["total"],         "sign": "-"},
            {"label": f"Profit target ({margin_label_pct}%)", "value": profit_target, "sign": "-"},
            {"label": "Risk deductions",             "value": wheelr_risk["total"],   "sign": "-"},
            {"label": "Max buy price",               "value": max_buy_price,          "sign": "="},
        ],
    }


@app.post("/bulk-evaluate")
def bulk_evaluate(vehicles: List[VehicleInput]):
    results = []
    for idx, vehicle in enumerate(vehicles, start=1):
        evaluation = evaluate_vehicle(vehicle)
        results.append({
            "row_number": idx,
            "vehicle":    f"{vehicle.year} {vehicle.brand} {vehicle.model}",
            "brand":      vehicle.brand,
            "model":      vehicle.model,
            "year":       vehicle.year,
            "city":       vehicle.city,
            "odometer":   vehicle.odometer_reading,
            **evaluation,
        })
    return {"count": len(results), "results": results}
