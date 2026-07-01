from __future__ import annotations

from dataclasses import asdict


def _clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def calculate_decision(vehicle, market_value: float) -> dict:
    """Dealer business layer.

    The ML model predicts market value only. This function converts that ML price
    into acquisition quote, profit, risk, confidence, and final dealer action.
    """
    target_margin_pct = float(getattr(vehicle, "target_margin_pct", 15) or 15)
    repair_buffer = float(getattr(vehicle, "repair_buffer", 25000) or 25000)
    seller_asking = float(getattr(vehicle, "seller_asking_price", 0) or 0)

    age = max(0, 2026 - int(getattr(vehicle, "year", 2021) or 2021))
    km = max(0, float(getattr(vehicle, "odometer_reading", 0) or 0))
    owner = max(1, int(getattr(vehicle, "owner_count", 1) or 1))
    condition = str(getattr(vehicle, "condition", "Good") or "Good").strip().lower()
    fuel = str(getattr(vehicle, "fuel_type", "Petrol") or "Petrol").strip().lower()
    transmission = str(getattr(vehicle, "transmission", "Manual") or "Manual").strip().lower()

    age_risk = _clamp(age * 7.5)
    km_risk = _clamp((km / 150000) * 100)
    owner_risk = {1: 10, 2: 35, 3: 62, 4: 82, 5: 90}.get(owner, 85)
    condition_risk = {
        "excellent": 8,
        "good": 22,
        "average": 55,
        "poor": 85,
    }.get(condition, 45)
    fuel_risk = {"petrol": 18, "diesel": 26, "cng": 31, "electric": 34, "hybrid": 22}.get(fuel, 28)

    risk_score = (
        0.25 * age_risk
        + 0.25 * km_risk
        + 0.20 * owner_risk
        + 0.20 * condition_risk
        + 0.10 * fuel_risk
    )
    risk_score = round(_clamp(risk_score))
    risk_level = "Low" if risk_score < 30 else "Medium" if risk_score < 65 else "High"

    holding_cost = market_value * 0.025
    risk_buffer = market_value * (risk_score / 100) * 0.08
    target_profit = market_value * (target_margin_pct / 100)

    recommended_buy_price = market_value - target_profit - repair_buffer - holding_cost - risk_buffer
    recommended_buy_price = max(market_value * 0.45, recommended_buy_price)

    recommended_sell_price = market_value * 1.05
    expected_profit = recommended_sell_price - recommended_buy_price - repair_buffer - holding_cost
    expected_margin_pct = (expected_profit / max(recommended_buy_price, 1)) * 100

    confidence_score = _clamp(94 - risk_score * 0.42)
    if age <= 3 and km < 45000:
        confidence_score += 4
    if transmission == "automatic":
        confidence_score += 2
    confidence_score = round(_clamp(confidence_score, 40, 96))

    demand_score = round(_clamp(88 - age * 2.5 - (km / 200000) * 35))
    brand_retention_score = round(_clamp(80 - age * 1.2 + (5 if fuel in {"petrol", "hybrid"} else 0)))
    vehicle_health_score = round(_clamp(100 - age * 3 - km / 10000 - (owner - 1) * 8))
    resale_liquidity_score = round(_clamp((demand_score + brand_retention_score + vehicle_health_score) / 3))

    deal_quality_score = (
        0.35 * _clamp(expected_margin_pct * 5)
        + 0.30 * confidence_score
        + 0.35 * (100 - risk_score)
    )
    deal_quality_score = round(_clamp(deal_quality_score))

    urgency_score = round(_clamp(65 + (deal_quality_score - 65) * 0.5 + (100 - risk_score) * 0.15))
    urgency_label = "High" if urgency_score >= 75 else "Medium" if urgency_score >= 55 else "Low"

    if confidence_score < 50:
        action = "MANUAL REVIEW"
    elif deal_quality_score >= 72 and risk_score <= 45:
        action = "BUY"
    elif deal_quality_score >= 50 and risk_score <= 70:
        action = "NEGOTIATE"
    else:
        action = "REJECT"

    positive_factors = []
    negative_factors = []
    if age <= 3:
        positive_factors.append("Newer vehicle age supports resale value")
    elif age >= 8:
        negative_factors.append("Older vehicle age increases depreciation risk")
    if km <= 45000:
        positive_factors.append("Lower odometer reading improves acquisition confidence")
    elif km >= 100000:
        negative_factors.append("High odometer reading may reduce resale demand")
    if owner == 1:
        positive_factors.append("First-owner vehicle improves buyer trust")
    elif owner >= 3:
        negative_factors.append("Multiple owners increase due-diligence risk")
    if condition in {"excellent", "good"}:
        positive_factors.append("Vehicle condition supports faster resale")
    else:
        negative_factors.append("Condition may require reconditioning before resale")
    if expected_margin_pct >= target_margin_pct:
        positive_factors.append("Expected margin meets dealer target")
    else:
        negative_factors.append("Expected margin is below dealer target")
    positive_factors.append("Market value predicted by trained CatBoost ML model")

    if not negative_factors:
        negative_factors.append("No major high-risk signal detected")

    price_min = round(market_value * 0.93 / 500) * 500
    price_max = round(market_value * 1.07 / 500) * 500
    ci = market_value - price_min

    opening_offer = round(recommended_buy_price * 0.97 / 500) * 500
    max_offer = round(recommended_buy_price * 1.03 / 500) * 500
    seller_gap = round((seller_asking - recommended_buy_price) / 500) * 500 if seller_asking else 0

    return {
        "price_min": int(price_min),
        "price_max": int(price_max),
        "ci": int(ci),
        "dealer_acq_price": int(round(recommended_buy_price / 500) * 500),
        "suggested_sell_price": int(round(recommended_sell_price / 500) * 500),
        "margin_pct": round(expected_margin_pct, 1),
        "margin_amt": int(round(expected_profit / 500) * 500),
        "recommended_buy_price": int(round(recommended_buy_price / 500) * 500),
        "recommended_sell_price": int(round(recommended_sell_price / 500) * 500),
        "expected_profit": int(round(expected_profit / 500) * 500),
        "expected_margin_pct": round(expected_margin_pct, 1),
        "opening_offer": int(opening_offer),
        "max_offer": int(max_offer),
        "seller_gap": int(seller_gap),
        "target_margin_pct": target_margin_pct,
        "repair_buffer": int(repair_buffer),
        "holding_cost": int(round(holding_cost)),
        "risk_buffer": int(round(risk_buffer)),
        "action": action,
        "risk_score": int(risk_score),
        "risk_level": risk_level,
        "confidence_score": int(confidence_score),
        "demand_score": int(demand_score),
        "brand_retention_score": int(brand_retention_score),
        "vehicle_health_score": int(vehicle_health_score),
        "resale_liquidity_score": int(resale_liquidity_score),
        "deal_quality_score": int(deal_quality_score),
        "urgency_score": int(urgency_score),
        "urgency_label": urgency_label,
        "positive_factors": positive_factors[:5],
        "negative_factors": negative_factors[:5],
        "quote_message": (
            f"Hi, based on the ML-predicted market value, vehicle age, odometer reading, "
            f"ownership, condition and current resale risk, our best offer is ₹{recommended_buy_price/100000:.2f}L. "
            f"If documents and inspection are clear, we can proceed quickly."
        ),
    }


# ─────────────────────────────────────────────────────────
# WHEELR UPGRADE FUNCTIONS
# ─────────────────────────────────────────────────────────

def check_disqualifier(vehicle_age: int, odometer: int,
                       owner_count: int, accident_history: str) -> dict:
    """Pre-screening disqualifier gate.
    
    Returns {disqualified: bool, reason: str}
    Disqualify if ANY condition is true:
      vehicle_age > 12
      odometer > 150000
      owner_count >= 4 AND accident_history in ["minor", "major"]
    """
    accident_hist_clean = (accident_history or "none").lower().strip()
    
    if vehicle_age > 12:
        return {"disqualified": True, "reason": "Vehicle age exceeds 12 years"}
    if odometer > 150000:
        return {"disqualified": True, "reason": "Odometer reading exceeds 150,000 km"}
    if owner_count >= 4 and accident_hist_clean in ["minor", "major"]:
        return {"disqualified": True, "reason": f"Multiple owners ({owner_count}) + accident history detected"}
    
    return {"disqualified": False, "reason": "Passes pre-screening"}


def get_seasonal_multiplier(month: int) -> float:
    """Monthly demand multiplier for Indian used car market.
    
    month: 1-12 (January-December)
    Returns float multiplier (e.g., 1.06 for June SUV spike)
    """
    multipliers = {
        1: 0.97, 2: 0.97, 3: 1.04, 4: 0.98, 5: 0.98,
        6: 1.06, 7: 1.06, 8: 0.99, 9: 0.99,
        10: 1.05, 11: 1.05, 12: 0.96
    }
    return multipliers.get(month, 1.0)


def get_wheelr_risk_deductions(owner_count: int, odometer: int,
                                accident_history: str = "none",
                                registration_state: str = "",
                                sale_state: str = "",
                                loan_outstanding: bool = False,
                                seller_reason: str = "upgrading") -> dict:
    """Wheelr-style extended risk deductions.
    
    Returns {total: int, breakdown: dict, seller_reason_adj: int}
    """
    accident_hist = (accident_history or "none").lower().strip()
    seller_reason_clean = (seller_reason or "upgrading").lower().strip()
    
    # Owner deduction
    owner_deduction = {1: 0, 2: 8000, 3: 18000}.get(owner_count, 30000)
    
    # Odometer deduction
    if odometer < 40000:
        km_deduction = 0
    elif odometer < 80000:
        km_deduction = 5000
    elif odometer < 120000:
        km_deduction = 12000
    else:
        km_deduction = 25000
    
    # Accident deduction
    accident_deduction = {"none": 0, "minor": 10000, "major": 35000}.get(accident_hist, 0)
    
    # State deduction
    state_deduction = 0
    if registration_state and sale_state:
        state_deduction = 0 if registration_state.lower() == sale_state.lower() else 8000
    
    # Loan deduction
    loan_deduction = 5000 if loan_outstanding else 0
    
    # Seller reason adjustment (opening offer only)
    seller_reason_adj = {
        "upgrading": 0,
        "relocating": -5000,
        "financial": -12000,
        "unused": 5000,
        "problem": -8000
    }.get(seller_reason_clean, 0)
    
    total = owner_deduction + km_deduction + accident_deduction + state_deduction + loan_deduction
    
    return {
        "total": int(total),
        "breakdown": {
            "owner_deduction": int(owner_deduction),
            "km_deduction": int(km_deduction),
            "accident_deduction": int(accident_deduction),
            "state_deduction": int(state_deduction),
            "loan_deduction": int(loan_deduction),
        },
        "seller_reason_adj": int(seller_reason_adj),
    }


def get_recon_cost(engine_grade: str = "good", tyre_grade: str = "good",
                   body_grade: str = "clean", interior_grade: str = "clean",
                   electrical_grade: str = "all_good",
                   vendor_type: dict = None,
                   rc_transfer_cost: int = 3500) -> dict:
    """Reconditioning cost calculator with vendor vs in-house options.
    
    rc_transfer_cost: RC transfer fee entered by dealer (default 3500).
    fixed_cost = rc_transfer_cost + 2500 (detailing) + 2000 (ops)
    """
    if vendor_type is None:
        vendor_type = {
            "engine": "vendor",
            "tyre": "vendor",
            "body": "vendor",
            "interior": "vendor",
            "electrical": "vendor",
        }
    
    engine_grade = (engine_grade or "good").lower().strip()
    tyre_grade = (tyre_grade or "good").lower().strip()
    body_grade = (body_grade or "clean").lower().strip()
    interior_grade = (interior_grade or "clean").lower().strip()
    electrical_grade = (electrical_grade or "all_good").lower().strip()
    
    engine_costs = {
        "good": {"inhouse": 0, "vendor": 0},
        "average": {"inhouse": 4000, "vendor": 8000},
        "poor": {"inhouse": 18000, "vendor": 35000},
        "critical": {"inhouse": 45000, "vendor": 80000},
    }
    engine_cost = engine_costs.get(engine_grade, engine_costs["good"])[vendor_type.get("engine", "vendor")]
    
    tyre_costs = {
        "good": {"inhouse": 0, "vendor": 0},
        "two_bad": {"inhouse": 4000, "vendor": 6000},
        "all_bad": {"inhouse": 8000, "vendor": 12000},
    }
    tyre_cost = tyre_costs.get(tyre_grade, tyre_costs["good"])[vendor_type.get("tyre", "vendor")]
    
    body_costs = {
        "clean": {"inhouse": 0, "vendor": 0},
        "minor": {"inhouse": 3000, "vendor": 5000},
        "major": {"inhouse": 10000, "vendor": 18000},
        "accident": {"inhouse": 22000, "vendor": 40000},
    }
    body_cost = body_costs.get(body_grade, body_costs["clean"])[vendor_type.get("body", "vendor")]
    
    interior_costs = {
        "clean": {"inhouse": 0, "vendor": 0},
        "needs_cleaning": {"inhouse": 1500, "vendor": 3000},
        "full_refurb": {"inhouse": 6000, "vendor": 10000},
    }
    interior_cost = interior_costs.get(interior_grade, interior_costs["clean"])[vendor_type.get("interior", "vendor")]
    
    electrical_costs = {
        "all_good": {"inhouse": 0, "vendor": 0},
        "ac_fault": {"inhouse": 4500, "vendor": 8000},
        "multi_fault": {"inhouse": 8000, "vendor": 15000},
    }
    electrical_cost = electrical_costs.get(electrical_grade, electrical_costs["all_good"])[vendor_type.get("electrical", "vendor")]
    
    # fixed_cost = rc_transfer (dealer-entered) + detailing (2500) + platform_ops (2000)
    rc_transfer_cost = max(0, int(rc_transfer_cost or 3500))
    detailing_cost = 2500
    ops_cost = 2000
    fixed_cost = rc_transfer_cost + detailing_cost + ops_cost
    total = engine_cost + tyre_cost + body_cost + interior_cost + electrical_cost + fixed_cost
    
    return {
        "engine_cost": int(engine_cost),
        "tyre_cost": int(tyre_cost),
        "body_cost": int(body_cost),
        "interior_cost": int(interior_cost),
        "electrical_cost": int(electrical_cost),
        "fixed_cost": int(fixed_cost),
        "rc_transfer_cost": int(rc_transfer_cost),
        "total": int(total),
        "breakdown": {
            "engine": int(engine_cost),
            "tyres": int(tyre_cost),
            "body_paint": int(body_cost),
            "interior": int(interior_cost),
            "electricals": int(electrical_cost),
            "fixed": int(fixed_cost),
        },
    }


def get_negotiation_trio(max_buy_price: int, seller_reason_adj: int = 0) -> dict:
    """Negotiation price trio: opening, target, walk-away."""
    opening_offer = max(0, max_buy_price - 15000 + seller_reason_adj)
    target_offer = max_buy_price - 8000
    walk_away_price = max_buy_price
    
    return {
        "opening_offer": int(opening_offer),
        "target_offer": int(target_offer),
        "walk_away_price": int(walk_away_price),
    }


def get_deal_health(ml_market_value: int, recon_total: int,
                    profit_target: int, owner_count: int,
                    odometer: int, accident_history: str = "none") -> str:
    """Deal health score: green / yellow / red."""
    if ml_market_value <= 0:
        return "red"
    
    margin_pct = profit_target / ml_market_value if ml_market_value > 0 else 0
    recon_pct = recon_total / ml_market_value if ml_market_value > 0 else 0
    accident_hist = (accident_history or "none").lower().strip()
    
    # Green: strong deal
    if (margin_pct >= 0.20 and recon_pct <= 0.15 and
        owner_count <= 2 and accident_hist == "none"):
        return "green"
    
    # Red: weak deal
    if margin_pct < 0.12 or recon_pct > 0.35:
        return "red"
    
    # Yellow: everything else (moderate)
    return "yellow"
