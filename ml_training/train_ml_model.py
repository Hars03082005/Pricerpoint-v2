"""Train the PricerPoint ML valuation model.

Final training pipeline for the dealership/manager prototype:
- Uses the uploaded CarDekho-style vehicle dataset ZIP or extracted CSV.
- Uses a 70/15/15 train/validation/test split.
- Trains CatBoost, LightGBM, and XGBoost base learners.
- Blends base learners with validation-optimized ensemble weights to improve R².
- Reports train, validation, and test metrics to check overfitting/underfitting.
- Uses median imputation for skewed numeric vehicle features.
- Predicts base market value only; dealer quote/risk/action are calculated by the backend decision engine.
- Applies vehicle condition as a calibrated post-ML adjustment because the dataset does not contain a verified real inspection-condition label.
"""

from __future__ import annotations

import json
import math
import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
import lightgbm as lgb
import xgboost as xgb
from scipy.optimize import minimize
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
DATA_ZIP = Path(__file__).resolve().parent / "data" / "cardekho_vehicle_dataset.zip"
DATA_CSV = Path(__file__).resolve().parent / "data" / "cars.csv"
ARTIFACT_DIR = ROOT / "model_artifacts"
ARTIFACT_DIR.mkdir(exist_ok=True)

CURRENT_YEAR = datetime.now().year
RANDOM_STATE = 42

FEATURES = [
    "brand",
    "model",
    "variant",
    "vehicle_age",
    "fuel_type",
    "transmission",
    "odometer_reading",
    "fuel_efficiency",
    "owner_count",
    "engine_cc",
    "city",
    "km_per_year",
    "ownership_trust_score",
    "vehicle_health_score",
    # ex_showroom_price and depreciation_ratio excluded: any proxy derived from
    # selling_price causes target leakage. Re-enable only if a real
    # ex_showroom_price column is present in the dataset.
]
CAT_FEATURES = ["brand", "model", "variant", "fuel_type", "transmission", "city"]
NUMERIC_FEATURES = [c for c in FEATURES if c not in CAT_FEATURES]

# Condition is not used as a raw CatBoost feature because the uploaded dataset does not contain
# a verified inspection-condition label. The app accepts condition from the dealer and applies this
# monotonic calibration after ML prediction so Poor can never produce a higher final value than Average
# for the same car.
CONDITION_MULTIPLIERS = {
    "excellent": 1.035,
    "good": 1.000,
    "average": 0.940,
    "poor": 0.860,
}


def clean_text(value: object, default: str = "unknown") -> str:
    if pd.isna(value):
        return default
    text = str(value).strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text if text else default


def parse_number(value: object) -> float:
    if pd.isna(value):
        return np.nan
    if isinstance(value, (int, float, np.number)):
        return float(value)
    text = str(value).replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group()) if match else np.nan


def parse_owner(value: object) -> float:
    text = clean_text(value, "first")
    if text in {"first", "1", "1st", "first owner"} or "first" in text:
        return 1
    if text in {"second", "2", "2nd", "second owner"} or "second" in text:
        return 2
    if text in {"third", "3", "3rd", "third owner"} or "third" in text:
        return 3
    if text in {"fourth", "4", "4th", "fourth owner"} or "fourth" in text:
        return 4
    if "more" in text or "fifth" in text or "5" in text:
        return 5
    return 1


def load_raw_dataset(zip_path: Path) -> pd.DataFrame:
    # 1. Try the merged CarDekho CSV extracted alongside the ZIP
    csv_path = zip_path.parent / "cardekho_vehicle_dataset" / "cars_details_merges.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path, low_memory=False)
    # 2. Try cars.csv (PricerPoint native dataset)
    if DATA_CSV.exists():
        return pd.read_csv(DATA_CSV, low_memory=False)
    # 3. Try the ZIP
    if zip_path.exists():
        with zipfile.ZipFile(zip_path) as zf:
            preferred = "cars_details_merges.csv"
            name = preferred if preferred in zf.namelist() else zf.namelist()[0]
            with zf.open(name) as f:
                return pd.read_csv(f, low_memory=False)
    raise FileNotFoundError(
        f"Dataset not found. Tried:\n"
        f"  CSV  : {csv_path}\n"
        f"  cars : {DATA_CSV}\n"
        f"  ZIP  : {zip_path}"
    )


def summarize_distribution(df: pd.DataFrame, columns: list[str]) -> dict:
    summary = {}
    for col in columns:
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.empty:
            continue
        summary[col] = {
            "count": int(s.count()),
            "mean": round(float(s.mean()), 3),
            "median": round(float(s.median()), 3),
            "std": round(float(s.std()), 3),
            "skewness": round(float(s.skew()), 3),
            "q1": round(float(s.quantile(0.25)), 3),
            "q3": round(float(s.quantile(0.75)), 3),
            "min": round(float(s.min()), 3),
            "max": round(float(s.max()), 3),
        }
    return summary


def prepare_dataset(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = raw.copy()

    # ── Selling price ──────────────────────────────────────────────────────
    if "dynx_totalvalue_y" in df.columns:
        df["selling_price"] = pd.to_numeric(df["dynx_totalvalue_y"], errors="coerce")
    elif "listed_price" in df.columns:
        df["selling_price"] = pd.to_numeric(df["listed_price"], errors="coerce")
    elif "price" in df.columns:
        df["selling_price"] = df["price"].map(parse_number)
    else:
        raise ValueError("No selling price column found")

    # ── Brand / model ─────────────────────────────────────────────────────
    _brand_raw = df.get("brand_name", df.get("oem", "unknown"))
    df["brand"] = _brand_raw.map(clean_text)
    _model_raw = df.get("model_name", df.get("model", "unknown"))
    df["model"] = _model_raw.map(clean_text)

    # -- variant (Change 2 & 3) -------------------------------------------
    if "variant" not in df.columns:
        df["variant"] = "unknown"
    df["variant"] = df["variant"].astype(str).str.lower().str.strip()
    df["variant"] = df["variant"].replace("nan", "unknown")
    df["variant"] = df["variant"].replace("", "unknown")

    # ── Vehicle age ───────────────────────────────────────────────────────
    # Prefer an explicit year column; fall back to car_age already in the file.
    if "car_age" in df.columns:
        df["vehicle_age"] = pd.to_numeric(df["car_age"], errors="coerce").clip(lower=0, upper=35)
        df["year"] = CURRENT_YEAR - df["vehicle_age"]
    else:
        year_source = df.get("model_year", df.get("myear", df.get("model_year_new", np.nan)))
        df["year"] = pd.to_numeric(year_source, errors="coerce")
        df["vehicle_age"] = (CURRENT_YEAR - df["year"]).clip(lower=0, upper=35)

    # ── Fuel / transmission / city / owner ────────────────────────────────
    _fuel_raw = df.get("fuel_type", df.get("fuel_type_new", df.get("ft", df.get("fuel", "unknown"))))
    df["fuel_type"] = _fuel_raw.map(clean_text)

    _tx_raw = df.get("transmission_type", df.get("transmission_type_new", df.get("tt", df.get("transmission", "unknown"))))
    df["transmission"] = _tx_raw.map(clean_text)

    _city_raw = df.get("city_name_new", df.get("city_y", df.get("City", df.get("city_x", "unknown"))))
    df["city"] = _city_raw.map(clean_text)

    _owner_raw = df.get("owner_type", df.get("owner_type_new", "first"))
    df["owner_count"] = _owner_raw.map(parse_owner)

    # ── Odometer / mileage / engine ───────────────────────────────────────
    _km_raw = df.get("km_driven", df.get("km", np.nan))
    df["odometer_reading"] = pd.to_numeric(pd.Series(_km_raw).map(parse_number), errors="coerce")

    _mileage_raw = df.get("mileage_new", df.get("mileage", np.nan))
    df["fuel_efficiency"] = pd.to_numeric(pd.Series(_mileage_raw).map(parse_number), errors="coerce")

    _disp_raw = df.get("Displacement", df.get("displacement", np.nan))
    df["engine_cc"] = pd.Series(_disp_raw).map(parse_number)
    if "engine_cc" in raw.columns:
        df["engine_cc"] = df["engine_cc"].fillna(pd.Series(raw["engine_cc"]).map(parse_number))

    # ── Ex-showroom price & depreciation ratio ──────────────────────────────
    # Proxy ex-showroom using reverse depreciation curve (~15% annual depreciation).
    # This gives real per-row variance so models can learn from it.
    # If the dataset ever gains a real ex_showroom_price column, prefer that instead.
    if "ex_showroom_price" in df.columns:
        _real = pd.to_numeric(df["ex_showroom_price"], errors="coerce")
    else:
        _real = pd.Series(np.nan, index=df.index)

    _proxy = df["selling_price"] / (0.85 ** df["vehicle_age"]).clip(lower=0.15)
    df["ex_showroom_price"] = _real.fillna(_proxy)

    # Depreciation ratio using proxy ex-showroom
    df["depreciation_ratio"] = (
        df["selling_price"] / df["ex_showroom_price"]
    ).clip(0.05, 1.20)

    raw_distribution = summarize_distribution(df, ["selling_price", "vehicle_age", "odometer_reading", "fuel_efficiency", "engine_cc", "owner_count"])

    # Clean invalid records first.
    df = df.drop_duplicates()
    df = df[df["selling_price"].between(50_000, 20_000_000)]
    df = df[df["year"].between(1990, CURRENT_YEAR)]

    imputation_values = {}
    for col in ["odometer_reading", "fuel_efficiency", "engine_cc", "owner_count", "vehicle_age"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        median = df[col].median()
        if pd.isna(median):
            median = 0
        imputation_values[col] = float(median)
        df[col] = df[col].fillna(median)

    df = df[df["odometer_reading"].between(100, 600_000)]

    # Remove extreme target outliers only. This prevents luxury/outlier listings from dominating a student prototype model.
    lower = df["selling_price"].quantile(0.005)
    upper = df["selling_price"].quantile(0.995)
    df = df[df["selling_price"].between(lower, upper)]

    # Cap km_per_year at 50,000 to avoid inflated values when vehicle_age == 0.
    # Identical cap is applied in main.py build_features() — must stay in sync.
    df["km_per_year"] = (df["odometer_reading"] / df["vehicle_age"].replace(0, 1)).clip(upper=50_000)
    df["ownership_trust_score"] = df["owner_count"].map({1: 100, 2: 75, 3: 55, 4: 35, 5: 25}).fillna(35)
    df["vehicle_health_score"] = (
        100
        - df["vehicle_age"] * 3
        - df["odometer_reading"] / 10000
        - (df["owner_count"] - 1) * 8
    ).clip(0, 100)

    # ── Price segment column ──────────────────────────────────────────────────
    # Added after outlier filtering so bins reflect clean-data price ranges.
    df["price_segment"] = pd.cut(
        df["selling_price"],
        bins=[0, 500_000, 1_500_000, 100_000_000],
        labels=["budget", "mid", "premium"],
    )
    df = df.dropna(subset=["price_segment"])
    df["price_segment"] = df["price_segment"].astype(str)

    for col in CAT_FEATURES:
        df[col] = df[col].map(clean_text).astype(str)

    clean_distribution = summarize_distribution(df, ["selling_price", "vehicle_age", "odometer_reading", "fuel_efficiency", "engine_cc", "owner_count", "km_per_year", "vehicle_health_score"])

    report = {
        "raw_rows": int(len(raw)),
        "rows_after_cleaning": int(len(df)),
        "target_outlier_bounds": {"lower": round(float(lower), 2), "upper": round(float(upper), 2)},
        "imputation_strategy": {
            "numeric": "median",
            "categorical": "cleaned text value; missing becomes 'unknown'",
            "reason": "Median is robust for right-skewed used-car features such as price, odometer reading, engine capacity, and mileage because extreme outliers can distort the mean.",
        },
        "imputation_values": imputation_values,
        "raw_distribution": raw_distribution,
        "clean_distribution": clean_distribution,
    }

    return df[FEATURES + ["selling_price", "price_segment"]].reset_index(drop=True), report


def metrics(y_true_log: pd.Series, pred_log: np.ndarray) -> dict:
    actual = np.expm1(y_true_log)
    pred = np.expm1(pred_log)
    return {
        "mae": round(float(mean_absolute_error(actual, pred)), 2),
        "rmse": round(float(math.sqrt(mean_squared_error(actual, pred))), 2),
        "mape": round(float(np.mean(np.abs((actual - pred) / np.maximum(actual, 1))) * 100), 2),
        "r2": round(float(r2_score(actual, pred)), 4),
    }


def build_category_levels(train_df: pd.DataFrame) -> dict:
    category_levels = {}
    for col in CAT_FEATURES:
        levels = sorted(train_df[col].astype(str).unique().tolist())
        if "unknown" not in levels:
            levels.append("unknown")
        category_levels[col] = levels
    return category_levels


def encode_xgboost_frame(df: pd.DataFrame, category_levels: dict) -> pd.DataFrame:
    frame = df[FEATURES].copy()
    for col in CAT_FEATURES:
        mapping = {category: idx for idx, category in enumerate(category_levels[col])}
        normalized = df[col].astype(str).where(df[col].astype(str).isin(category_levels[col]), "unknown")
        frame[col] = normalized.map(mapping).astype(int)
    return frame


def prepare_model_frames(df: pd.DataFrame, category_levels: dict | None = None) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Return CatBoost, LightGBM, and XGBoost-ready feature frames."""
    if category_levels is None:
        category_levels = build_category_levels(df)

    catboost_frame = df[FEATURES].copy()
    lgb_frame = df[FEATURES].copy()
    for col in CAT_FEATURES:
        normalized = df[col].astype(str).where(df[col].astype(str).isin(category_levels[col]), "unknown")
        catboost_frame[col] = normalized.astype(str)
        lgb_frame[col] = pd.Categorical(normalized, categories=category_levels[col])

    xgb_frame = encode_xgboost_frame(df, category_levels)
    return catboost_frame, lgb_frame, xgb_frame


def optimize_ensemble_weights(
    y_val: pd.Series,
    val_predictions: Dict[str, np.ndarray],
) -> Dict[str, float]:
    model_names = list(val_predictions.keys())
    matrix = np.column_stack([val_predictions[name] for name in model_names])

    def negative_r2(weights: np.ndarray) -> float:
        normalized = np.asarray(weights, dtype=float)
        normalized = normalized / normalized.sum()
        blended = matrix @ normalized
        return -float(r2_score(y_val, blended))

    initial = np.full(len(model_names), 1.0 / len(model_names))
    result = minimize(
        negative_r2,
        initial,
        method="SLSQP",
        bounds=[(0.0, 1.0)] * len(model_names),
        constraints={"type": "eq", "fun": lambda weights: float(np.sum(weights) - 1.0)},
    )
    optimized = result.x / result.x.sum()
    return {name: round(float(weight), 4) for name, weight in zip(model_names, optimized)}


def blend_predictions(weights: Dict[str, float], predictions: Dict[str, np.ndarray]) -> np.ndarray:
    blended = np.zeros_like(next(iter(predictions.values())), dtype=float)
    for name, weight in weights.items():
        blended += weight * predictions[name]
    return blended


def train_catboost(X_train: pd.DataFrame, y_train: pd.Series, X_val: pd.DataFrame, y_val: pd.Series) -> CatBoostRegressor:
    params = {"iterations": 800, "learning_rate": 0.03, "depth": 5, "l2_leaf_reg": 5}
    model = CatBoostRegressor(
        loss_function="RMSE",
        random_seed=RANDOM_STATE,
        verbose=False,
        allow_writing_files=False,
        thread_count=4,
        max_ctr_complexity=1,
        early_stopping_rounds=80,
        **params,
    )
    model.fit(X_train, y_train, cat_features=CAT_FEATURES, eval_set=(X_val, y_val), use_best_model=True)
    return model


def train_lightgbm(X_train: pd.DataFrame, y_train: pd.Series, X_val: pd.DataFrame, y_val: pd.Series) -> lgb.Booster:
    train_set = lgb.Dataset(X_train, label=y_train, categorical_feature=CAT_FEATURES, free_raw_data=False)
    val_set = lgb.Dataset(X_val, label=y_val, categorical_feature=CAT_FEATURES, reference=train_set, free_raw_data=False)
    params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.03,
        "num_leaves": 31,
        "max_depth": 5,
        "min_data_in_leaf": 40,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.85,
        "bagging_freq": 1,
        "lambda_l2": 5.0,
        "verbosity": -1,
        "seed": RANDOM_STATE,
    }
    return lgb.train(
        params,
        train_set,
        num_boost_round=800,
        valid_sets=[val_set],
        callbacks=[lgb.early_stopping(80, verbose=False), lgb.log_evaluation(0)],
    )


def train_xgboost(X_train: pd.DataFrame, y_train: pd.Series, X_val: pd.DataFrame, y_val: pd.Series) -> xgb.XGBRegressor:
    model = xgb.XGBRegressor(
        objective="reg:squarederror",
        learning_rate=0.03,
        max_depth=5,
        min_child_weight=40,
        subsample=0.85,
        colsample_bytree=0.9,
        reg_lambda=5.0,
        n_estimators=800,
        random_state=RANDOM_STATE,
        early_stopping_rounds=80,
        tree_method="hist",
        n_jobs=4,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    return model


def train() -> None:
    raw = load_raw_dataset(DATA_ZIP)
    df, data_report = prepare_dataset(raw)

    # ── Single global model (kept for fallback / legacy) ─────────────────────
    X = df[FEATURES]
    y = np.log1p(df["selling_price"])

    X_train_val, X_test, y_train_val, y_test = train_test_split(X, y, test_size=0.15, random_state=RANDOM_STATE)
    validation_ratio_from_train_val = 0.15 / 0.85
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=validation_ratio_from_train_val, random_state=RANDOM_STATE
    )

    train_idx = X_train.index
    val_idx   = X_val.index
    test_idx  = X_test.index

    category_levels = build_category_levels(df.loc[train_idx])
    cb_train, lgb_train, xgb_train = prepare_model_frames(df.loc[train_idx], category_levels)
    cb_val,   lgb_val,   xgb_val   = prepare_model_frames(df.loc[val_idx],   category_levels)
    cb_test,  lgb_test,  xgb_test  = prepare_model_frames(df.loc[test_idx],  category_levels)

    print("\n" + "="*60)
    print("GLOBAL MODEL (legacy fallback)")
    print("="*60)
    print("Training CatBoost...")
    catboost_model  = train_catboost(cb_train,  y_train, cb_val, y_val)
    print("Training LightGBM...")
    lightgbm_model  = train_lightgbm(lgb_train, y_train, lgb_val, y_val)
    print("Training XGBoost...")
    xgboost_model   = train_xgboost(xgb_train,  y_train, xgb_val, y_val)

    base_models  = {"catboost": catboost_model, "lightgbm": lightgbm_model, "xgboost": xgboost_model}
    base_frames  = {
        "catboost": {"train": cb_train, "validation": cb_val, "test": cb_test},
        "lightgbm": {"train": lgb_train, "validation": lgb_val, "test": lgb_test},
        "xgboost":  {"train": xgb_train, "validation": xgb_val, "test": xgb_test},
    }

    def predict_with_model(name: str, frame: pd.DataFrame) -> np.ndarray:
        return np.asarray(base_models[name].predict(frame))

    individual_results = {}
    val_predictions    = {}
    split_targets      = {"train": y_train, "validation": y_val, "test": y_test}
    for name in base_models:
        split_metrics = {}
        for split_name, y_split in split_targets.items():
            preds = predict_with_model(name, base_frames[name][split_name])
            split_metrics[f"{split_name}_metrics"] = metrics(y_split, preds)
            if split_name == "validation":
                val_predictions[name] = preds
        individual_results[name] = split_metrics

    ensemble_weights = optimize_ensemble_weights(y_val, val_predictions)
    ensemble_result  = {"name": "stacked_catboost_lightgbm_xgboost", "weights": ensemble_weights}
    for split_name, y_split in split_targets.items():
        split_preds = {name: predict_with_model(name, base_frames[name][split_name]) for name in base_models}
        blended = blend_predictions(ensemble_weights, split_preds)
        ensemble_result[f"{split_name}_metrics"] = metrics(y_split, blended)

    # Save global model files (legacy / fallback)
    catboost_model.save_model(str(ARTIFACT_DIR / "vehicle_price_catboost.cbm"))
    lightgbm_model.save_model(str(ARTIFACT_DIR / "vehicle_price_lightgbm.txt"))
    xgboost_model.save_model(str(ARTIFACT_DIR  / "vehicle_price_xgboost.json"))

    feature_importance = [
        {"feature": f, "importance": round(float(v), 4)}
        for f, v in sorted(zip(FEATURES, catboost_model.get_feature_importance()), key=lambda x: x[1], reverse=True)
    ]

    train_r2       = ensemble_result["train_metrics"]["r2"]
    val_r2         = ensemble_result["validation_metrics"]["r2"]
    test_r2        = ensemble_result["test_metrics"]["r2"]
    catboost_test_r2 = individual_results["catboost"]["test_metrics"]["r2"]
    overfit_gap    = round(train_r2 - val_r2, 4)
    overfitting_status = (
        "possible_overfitting"   if overfit_gap > 0.08 else
        "possible_underfitting"  if train_r2 < 0.70 and val_r2 < 0.70 else
        "healthy_generalization"
    )

    # ── Segmented models ─────────────────────────────────────────────────────
    PRICE_BINS = {
        "budget":  [0,         500_000],
        "mid":     [500_000,   1_500_000],
        "premium": [1_500_000, 100_000_000],
    }
    SEGMENTS      = list(PRICE_BINS.keys())
    segment_models  = {}
    segment_metrics = {}

    for segment in SEGMENTS:
        print(f"\n{'='*50}")
        print(f"Training segment: {segment.upper()}")

        seg_df = df[df["price_segment"] == segment].copy()
        print(f"Rows in {segment}: {len(seg_df)}")

        if len(seg_df) < 50:
            print(f"  Skipping {segment} — too few rows ({len(seg_df)})")
            continue

        # Stratify by brand+model; drop combos with fewer than 2 rows
        seg_df["strat_key"] = seg_df["brand"] + "_" + seg_df["model"]
        key_counts = seg_df["strat_key"].value_counts()
        valid_keys = key_counts[key_counts >= 2].index
        seg_df = seg_df[seg_df["strat_key"].isin(valid_keys)]

        X_seg = seg_df[FEATURES]
        y_seg = np.log1p(seg_df["selling_price"])

        X_tv, X_test_s, y_tv, y_test_s = train_test_split(
            X_seg, y_seg, test_size=0.15,
            random_state=RANDOM_STATE,
            stratify=seg_df.loc[X_seg.index, "strat_key"],
        )
        X_tr, X_vl, y_tr, y_vl = train_test_split(
            X_tv, y_tv, test_size=0.176, random_state=RANDOM_STATE
        )

        seg_train_idx = X_tr.index
        seg_val_idx   = X_vl.index
        seg_test_idx  = X_test_s.index

        seg_cat_levels = build_category_levels(seg_df.loc[seg_train_idx])

        s_cb_tr,  s_lgb_tr,  s_xgb_tr  = prepare_model_frames(seg_df.loc[seg_train_idx], seg_cat_levels)
        s_cb_vl,  s_lgb_vl,  s_xgb_vl  = prepare_model_frames(seg_df.loc[seg_val_idx],   seg_cat_levels)
        s_cb_te,  s_lgb_te,  s_xgb_te  = prepare_model_frames(seg_df.loc[seg_test_idx],  seg_cat_levels)

        print(f"  Training CatBoost [{segment}]...")
        s_cat = train_catboost(s_cb_tr, y_tr, s_cb_vl, y_vl)
        print(f"  Training LightGBM [{segment}]...")
        s_lgb = train_lightgbm(s_lgb_tr, y_tr, s_lgb_vl, y_vl)
        print(f"  Training XGBoost  [{segment}]...")
        s_xgb = train_xgboost(s_xgb_tr, y_tr, s_xgb_vl, y_vl)

        s_base_models = {"catboost": s_cat, "lightgbm": s_lgb, "xgboost": s_xgb}
        s_val_frames  = {"catboost": s_cb_vl,  "lightgbm": s_lgb_vl, "xgboost": s_xgb_vl}
        s_test_frames = {"catboost": s_cb_te,  "lightgbm": s_lgb_te, "xgboost": s_xgb_te}

        s_val_preds = {
            name: np.asarray(mdl.predict(s_val_frames[name]))
            for name, mdl in s_base_models.items()
        }
        s_weights = optimize_ensemble_weights(y_vl, s_val_preds)

        s_test_preds = {
            name: np.asarray(mdl.predict(s_test_frames[name]))
            for name, mdl in s_base_models.items()
        }
        blended_test = blend_predictions(s_weights, s_test_preds)
        seg_m = metrics(y_test_s, blended_test)

        segment_metrics[segment] = {
            "rows":      len(seg_df),
            "test_r2":   seg_m["r2"],
            "test_mae":  seg_m["mae"],
            "test_mape": seg_m["mape"],
        }
        segment_models[segment] = {
            "catboost":        s_cat,
            "lightgbm":        s_lgb,
            "xgboost":         s_xgb,
            "weights":         s_weights,
            "category_levels": seg_cat_levels,
        }
        print(f"  {segment.upper()} -> R2: {seg_m['r2']:.4f} | MAE: Rs.{seg_m['mae']:,.0f} | MAPE: {seg_m['mape']:.2f}%")

    # ── Save segmented artifacts ──────────────────────────────────────────────
    for segment, models in segment_models.items():
        artifact = {
            "catboost":        models["catboost"],
            "lightgbm":        models["lightgbm"],
            "xgboost":         models["xgboost"],
            "weights":         models["weights"],
            "features":        FEATURES,
            "cat_features":    CAT_FEATURES,
            "segment":         segment,
            "price_bins":      PRICE_BINS,
            # Task 4: save per-segment category levels so main.py can normalise
            # unseen brands/variants to "unknown" instead of crashing LightGBM.
            "category_levels": models["category_levels"],
        }
        path = ARTIFACT_DIR / f"ensemble_{segment}.pkl"
        joblib.dump(artifact, path)
        print(f"Saved: {path}")

    # ── Metadata & report ─────────────────────────────────────────────────────
    metadata = {
        "model_name": "CatBoost+LightGBM+XGBoost Ensemble (v2.3 Segmented)",
        "target": "selling_price",
        "target_transform": "log1p during training, expm1 during prediction",
        "prediction_unit": "INR",
        "trained_on": "PricerPoint cars.csv dataset",
        "portal_scope": "Dealership/manager internal portal only.",
        "current_year_used_for_age": CURRENT_YEAR,
        "features": FEATURES,
        "categorical_features": CAT_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "split_strategy": {
            "train": 0.70, "validation": 0.15, "test": 0.15,
            "purpose": "Train set learns model patterns, validation selects ensemble weights, test set reports final unbiased performance.",
        },
        "ensemble": {
            "enabled": True,
            "strategy": "validation-optimized weighted average of CatBoost, LightGBM, and XGBoost log-price predictions",
            "weights": ensemble_weights,
            "category_levels": category_levels,
            "base_models": individual_results,
            "r2_improvement_vs_catboost": round(test_r2 - catboost_test_r2, 4),
        },
        "selected_model": ensemble_result,
        "metrics": ensemble_result["test_metrics"],
        "train_metrics":      ensemble_result["train_metrics"],
        "validation_metrics": ensemble_result["validation_metrics"],
        "test_metrics":       ensemble_result["test_metrics"],
        "catboost_only_test_metrics": individual_results["catboost"]["test_metrics"],
        "overfitting_check": {
            "train_r2":  train_r2,
            "validation_r2": val_r2,
            "test_r2":   test_r2,
            "catboost_only_test_r2": catboost_test_r2,
            "train_validation_r2_gap": overfit_gap,
            "status": overfitting_status,
        },
        "condition_handling": {
            "used_in_catboost_training": False,
            "reason": "The uploaded dataset does not contain a verified inspection-condition label.",
            "solution": "Monotonic condition calibration multiplier applied post-prediction.",
            "condition_multipliers": CONDITION_MULTIPLIERS,
        },
        "segmented_models": segment_metrics,
        "segment_price_bins": {
            "budget":  "\u20b90 \u2013 \u20b95L",
            "mid":     "\u20b95L \u2013 \u20b915L",
            "premium": "\u20b915L+",
        },
        "data_report": data_report,
        "feature_importance": feature_importance,
        "notes": [
            "Model predicts base market value from the uploaded used-car dataset.",
            "Final displayed market value is condition-calibrated to ensure consistent dealer logic.",
            "Quote, risk, profit, urgency, and BUY/NEGOTIATE/REJECT are calculated by the backend decision engine.",
            "Computer vision is kept on hold; manual condition input is used for the final prototype.",
            "variant feature added in v2.1",
            "ex_showroom_price and depreciation_ratio excluded (target leakage without real column).",
            "v2.3 — segmented models by price bracket (budget/mid/premium).",
        ],
    }

    with open(ARTIFACT_DIR / "model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    with open(ARTIFACT_DIR / "training_report.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    df.sample(min(500, len(df)), random_state=RANDOM_STATE).to_csv(
        ARTIFACT_DIR / "cleaned_training_sample.csv", index=False
    )

    # ── Summary table ─────────────────────────────────────────────────────────
    PREV_MAPE = 11.93
    global_mape = ensemble_result["test_metrics"]["mape"]
    print(json.dumps({
        "global_model": {
            "ensemble_weights": ensemble_weights,
            "test_metrics": ensemble_result["test_metrics"],
            "overfitting_check": metadata["overfitting_check"],
        },
        "segmented_models": segment_metrics,
        "mape_comparison": {
            "single_model_baseline_mape": PREV_MAPE,
            "global_model_mape": global_mape,
        },
    }, indent=2))

    print("\n" + "="*60)
    print("SEGMENTED MODEL RESULTS vs SINGLE MODEL")
    print("="*60)
    print(f"Single model MAPE:  {PREV_MAPE}%")
    for seg, m in segment_metrics.items():
        print(f"{seg.upper():<10} MAPE: {m['test_mape']}%   MAE: Rs.{m['test_mae']:>12,.0f}   R2: {m['test_r2']}   ({m['rows']} rows)")
    print("="*60)


if __name__ == "__main__":
    train()
