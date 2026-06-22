const API_BASE_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:8000';

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const match = String(value).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  const n = match ? Number(match[0]) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseOwnerCount(value, fallback = 1) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  if (/\b1\b|1st|first/.test(text)) return 1;
  if (/\b2\b|2nd|second/.test(text)) return 2;
  if (/\b3\b|3rd|third/.test(text)) return 3;
  if (/\b4\b|4th|fourth/.test(text)) return 4;
  if (/more|fifth|5/.test(text)) return 5;
  return toNumber(value, fallback);
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '')
    .join(' ');
}

function normalizeFuel(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('diesel')) return 'Diesel';
  if (text.includes('electric') || text.includes('ev')) return 'Electric';
  if (text.includes('cng')) return 'CNG';
  if (text.includes('hybrid')) return 'Hybrid';
  return 'Petrol';
}

function normalizeTransmission(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('auto') || text.includes('cvt') || text.includes('dct')) return 'Automatic';
  return 'Manual';
}

function normalizeCondition(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('excellent')) return 'Excellent';
  if (text.includes('poor')) return 'Poor';
  if (text.includes('average') || text.includes('fair')) return 'Average';
  return 'Good';
}

export function payloadFromInputs(inputs) {
  return {
    brand: titleCase(inputs.brand || 'Unknown'),
    model: titleCase(inputs.model || 'Unknown'),
    year: Math.trunc(toNumber(inputs.year, 2021)),
    fuel_type: normalizeFuel(inputs.fuel || inputs.fuel_type),
    transmission: normalizeTransmission(inputs.transmission),
    odometer_reading: Math.trunc(toNumber(inputs.mileage ?? inputs.odometer_reading, 0)),
    fuel_efficiency: toNumber(inputs.fuelEfficiency ?? inputs.fuel_efficiency, 0),
    owner_count: parseOwnerCount(inputs.ownerCount ?? inputs.owner_count, 1),
    engine_cc: Math.trunc(toNumber(inputs.engineCc ?? inputs.engine_cc, 0)),
    city: titleCase(inputs.city || 'Unknown'),
    condition: normalizeCondition(inputs.condition),
    seller_asking_price: 0,
    target_margin_pct: toNumber(inputs.targetMarginPct ?? inputs.target_margin_pct, 15),
    repair_buffer: toNumber(inputs.repairBuffer ?? inputs.repair_buffer, 25000),
  };
}

function buildCounterfactuals(inputs, data) {
  const km = toNumber(inputs.mileage ?? inputs.odometer_reading, 0);
  const age = new Date().getFullYear() - toNumber(inputs.year, new Date().getFullYear());
  const condition = normalizeCondition(inputs.condition);
  const items = [];
  if (km > 80000) {
    items.push({ positive: true, text: 'Lower odometer band would improve quote quality', detail: 'High km reduces resale confidence and increases risk buffer.', impact: '+value' });
  } else {
    items.push({ positive: true, text: 'Current odometer reading supports stronger resale confidence', detail: 'Lower usage helps maintain dealer margin.', impact: '+confidence' });
  }
  if (age > 6) {
    items.push({ positive: false, text: 'Older vehicle age is reducing the market value', detail: 'More age generally increases depreciation and holding risk.', impact: '-price' });
  } else {
    items.push({ positive: true, text: 'Newer vehicle age supports better acquisition quality', detail: 'Lower depreciation improves buy/sell spread.', impact: '+deal' });
  }
  if (condition === 'Poor' || condition === 'Average') {
    items.push({ positive: true, text: 'Improving condition before resale can increase margin', detail: `Current condition is ${condition}; repair/reconditioning can improve buyer confidence.`, impact: '+margin' });
  } else {
    items.push({ positive: true, text: 'Good condition is supporting the recommendation', detail: 'Condition keeps repair buffer and acquisition risk lower.', impact: '+risk' });
  }
  return items.slice(0, 4);
}

function normalizeApiResult(data, inputs) {
  const predictedPrice = data.market_value ?? 0;
  const baseMarketValue = data.base_market_value ?? predictedPrice;
  const recommendedBuyPrice = data.recommended_buy_price ?? data.dealer_acq_price ?? 0;
  const recommendedSellPrice = data.recommended_sell_price ?? data.suggested_sell_price ?? 0;
  const expectedProfit = data.expected_profit ?? data.margin_amt ?? 0;
  const expectedMarginPct = data.expected_margin_pct ?? data.margin_pct ?? 0;
  const priceMin = data.price_min ?? Math.round(predictedPrice * 0.93);
  const priceMax = data.price_max ?? Math.round(predictedPrice * 1.07);

  return {
    predictedPrice,
    baseMarketValue,
    conditionMultiplier: data.condition_multiplier ?? 1,
    conditionAdjustment: data.condition_adjustment ?? 0,
    conditionScore: data.condition_score ?? 75,
    priceMin,
    priceMax,
    ci: data.ci ?? (predictedPrice - priceMin),
    dealerAcqPrice: data.dealer_acq_price ?? recommendedBuyPrice,
    suggestedSellPrice: data.suggested_sell_price ?? recommendedSellPrice,
    marginPct: data.margin_pct ?? expectedMarginPct,
    marginAmt: data.margin_amt ?? expectedProfit,
    recommendedBuyPrice,
    recommendedSellPrice,
    expectedProfit,
    expectedMarginPct,
    openingOffer: data.opening_offer ?? Math.round(recommendedBuyPrice * 0.97),
    maxOffer: data.max_offer ?? Math.round(recommendedBuyPrice * 1.03),
    sellerGap: data.seller_gap ?? 0,
    targetMarginPct: data.target_margin_pct ?? toNumber(inputs.targetMarginPct, 15),
    repairBuffer: data.repair_buffer ?? toNumber(inputs.repairBuffer, 25000),
    holdingCost: data.holding_cost ?? 0,
    riskBuffer: data.risk_buffer ?? 0,
    action: data.action ?? 'MANUAL REVIEW',
    riskScore: data.risk_score ?? 0,
    riskLevel: data.risk_level ?? 'Medium',
    confidenceScore: data.confidence_score ?? 0,
    demandScore: data.demand_score ?? 0,
    brandRetentionScore: data.brand_retention_score ?? 0,
    vehicleHealthScore: data.vehicle_health_score ?? 0,
    resaleLiquidityScore: data.resale_liquidity_score ?? 0,
    dealQualityScore: data.deal_quality_score ?? 0,
    urgencyScore: data.urgency_score ?? 0,
    urgencyLabel: data.urgency_label ?? 'Medium',
    positiveFactors: data.positive_factors ?? [],
    negativeFactors: data.negative_factors ?? [],
    quoteMessage: data.quote_message ?? '',
    warnings: data.warnings ?? [],
    shap: data.shap ?? [],
    counterfactuals: buildCounterfactuals(inputs, data),
    damageBoxes: [],
    models: [
      { name: 'CatBoost Base Market Value', price: baseMarketValue, weight: 65 },
      { name: 'Condition Calibration Layer', price: predictedPrice, weight: 15 },
      { name: 'Quote & Risk Decision Engine', price: recommendedBuyPrice, weight: 20 },
    ],
    modelName: data.model_name || 'CatBoostRegressor',
    isMLPowered: data.is_ml_powered ?? true,
    modelMetrics: data.metrics || {},
    trainMetrics: data.train_metrics || {},
    validationMetrics: data.validation_metrics || {},
    testMetrics: data.test_metrics || {},
    overfittingCheck: data.overfitting_check || {},
    valuationSource: 'CatBoost ML Backend',
  };
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`ML API error ${response.status}${message ? `: ${message}` : ''}`);
  }
  return response.json();
}

export async function runMLValuation(inputs) {
  const data = await postJson('/evaluate', payloadFromInputs(inputs));
  return normalizeApiResult(data, inputs);
}

export async function runBulkMLValuation(rows, defaults, rowToInputs) {
  const mapped = rows.map(row => rowToInputs(row, defaults));
  const payload = mapped.map(payloadFromInputs);
  const data = await postJson('/bulk-evaluate', payload);

  return (data.results || []).map((r, idx) => {
    const input = mapped[idx];
    const normalized = normalizeApiResult(r, input);
    return {
      ...normalized,
      id: `bulk-${Date.now()}-${idx}`,
      rowNumber: rows[idx]?.rowNumber ?? r.row_number ?? idx + 1,
      vehicle: r.vehicle || `${input.year} ${input.brand} ${input.model}`,
      brand: input.brand,
      model: input.model,
      year: input.year,
      fuel: input.fuel,
      transmission: input.transmission,
      city: r.city || input.city,
      odometer: r.odometer ?? toNumber(input.mileage, 0),
      fuelEfficiency: input.fuelEfficiency,
      ownerCount: input.ownerCount,
      engineCc: input.engineCc,
      condition: input.condition,
      input,
      marketValue: normalized.predictedPrice,
      buyPrice: normalized.recommendedBuyPrice,
      sellPrice: normalized.recommendedSellPrice,
      source: 'CatBoost ML',
    };
  });
}

function normalizeEnhancedResult(data, inputs) {
  const base = normalizeApiResult(data, inputs);
  return {
    ...base,
    disqualifier: data.disqualifier,
    seasonalMultiplier: data.seasonal_multiplier,
    seasonalMonth: data.seasonal_month,
    recon: data.recon,
    wheelrRisk: data.wheelr_risk,
    negotiation: data.negotiation,
    dealHealth: data.deal_health,
    enhancedMaxBuyPrice: data.enhanced_max_buy_price,
  };
}

export function enhancedPayloadFromInputs(inputs, inspection) {
  return {
    ...payloadFromInputs(inputs),
    accident_history: inspection.accidentHistory || 'none',
    registration_state: inspection.registrationState || '',
    sale_state: inspection.saleState || inputs.city || '',
    loan_outstanding: Boolean(inspection.loanOutstanding),
    seller_reason: inspection.sellerReason || 'upgrading',
    engine_grade: inspection.engineGrade || 'good',
    tyre_grade: inspection.tyreGrade || 'good',
    body_grade: inspection.bodyGrade || 'clean',
    interior_grade: inspection.interiorGrade || 'clean',
    electrical_grade: inspection.electricalGrade || 'all_good',
    vendor_type: inspection.vendorType || {
      engine: 'vendor',
      tyre: 'vendor',
      body: 'vendor',
      interior: 'vendor',
      electrical: 'vendor',
    },
  };
}

export async function runEnhancedEvaluation(inputs, inspection) {
  const data = await postJson('/evaluate-enhanced', enhancedPayloadFromInputs(inputs, inspection));
  return normalizeEnhancedResult(data, inputs);
}

export async function runReverseCalculate(payload) {
  const data = await postJson('/reverse-calculate', payload);
  return {
    expectedSellPrice: data.expected_sell_price,
    recon: data.recon,
    profitTarget: data.profit_target,
    wheelrRisk: data.wheelr_risk,
    maxBuyPrice: data.max_buy_price,
    negotiation: data.negotiation,
    dealHealth: data.deal_health,
    disqualifier: data.disqualifier,
    seasonalMultiplier: data.seasonal_multiplier,
    priceBreakdown: data.price_breakdown,
  };
}
