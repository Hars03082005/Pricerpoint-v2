import { useApp } from '../context/AppContext.jsx';
import { formatINR, CAR_IMAGES, getConditionLabel } from '../utils/mockData.js';
import Icon from '../components/Icon.jsx';

function ConditionRing({ score }) {
  const r = 36, cx = 44, cy = 44, sw = 7;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ * 0.75;
  const { label, color } = getConditionLabel(score);
  return (
    <div className="cond-ring-wrap">
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth={sw} strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${filled} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x={cx} y={cy - 3} textAnchor="middle" fill="#24272c" fontSize="14" fontWeight="700" fontFamily="Inter,sans-serif">{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#888" fontSize="8" fontFamily="Inter,sans-serif">/100</text>
      </svg>
      <div className="cond-ring-label" style={{ color }}>{label}</div>
    </div>
  );
}


function actionClass(action) {
  if (action === 'BUY') return 'buy';
  if (action === 'NEGOTIATE') return 'negotiate';
  if (action === 'REJECT') return 'reject';
  return 'review';
}

function PriceBar({ min, mid, max }) {
  const pct = ((mid - min) / (max - min)) * 100;
  return (
    <div className="price-bar-wrap">
      <div className="price-bar-track">
        <div className="price-bar-pin" style={{ left: `${Math.max(5, Math.min(95, pct))}%` }}>
          <div className="pin-line" />
          <div className="pin-label">{formatINR(mid)}</div>
        </div>
      </div>
      <div className="price-bar-ends">
        <span>{formatINR(min)}</span>
        <span className="price-bar-ci">Prediction Range</span>
        <span>{formatINR(max)}</span>
      </div>
    </div>
  );
}

export default function ResultScreen() {
  const { valuationResult, inputs, conditionScore, setActiveScreen, isLoading } = useApp();
  const carImage = CAR_IMAGES[`${inputs.brand} ${inputs.model}`] || '/cars/placeholder.png';

  if (isLoading) {
    return (
      <div className="screen loading-screen">
        <div className="loading-car">
          <img src={carImage} alt="Analyzing" className="loading-car-img" />
          <div className="loading-road" />
        </div>
        <div className="loading-label">Analysing your vehicle…</div>
        <div className="loading-steps-list">
          {[
            { text: 'Reading vehicle specifications', icon: 'clipboard' },
            { text: 'Checking market comparables', icon: 'barChart' },
            { text: 'Running AI valuation models', icon: 'robot' },
            { text: 'Calculating condition score', icon: 'gauge' },
          ].map((s, i) => (
            <div key={i} className="loading-step-item" style={{ animationDelay: `${i * 0.5}s` }}>
              <Icon name={s.icon} size={14} color="#f75d34" strokeWidth={1.8} />
              {s.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!valuationResult) {
    return (
      <div className="screen empty-screen">
        <img src={carImage} alt="Car" style={{ width: '60%', opacity: 0.5, margin: '0 auto 16px', display: 'block' }} />
        <h2 className="empty-title">No valuation yet</h2>
        <p className="empty-sub">Fill in vehicle details to get instant AI pricing</p>
        <button className="cd-btn-orange" onClick={() => setActiveScreen('input')}>
          <Icon name="car" size={16} color="white" strokeWidth={2} />
          Start Valuation
        </button>
      </div>
    );
  }

  const { predictedPrice, baseMarketValue, conditionAdjustment, conditionMultiplier,
    priceMin, priceMax, ci90Low, ci90High,
    models, warnings, action, confidenceScore, riskScore, riskLevel,
    dealQualityScore, urgencyScore, recommendedBuyPrice, recommendedSellPrice,
    expectedProfit, expectedMarginPct, positiveFactors, negativeFactors,
    isMLPowered, modelName, modelMetrics } = valuationResult;
  const displayedConditionScore = valuationResult.conditionScore || conditionScore;
  const rangeLow  = ci90Low  ?? priceMin;
  const rangeHigh = ci90High ?? priceMax;

  return (
    <div className="screen">
      {/* Hero */}
      <div className="result-hero">
        <div className="result-hero-img-wrap">
          <img src={carImage} alt={`${inputs.brand} ${inputs.model}`} className="result-hero-img" />
        </div>
        <div className="result-hero-details">
          <div className="result-hero-name">{inputs.year} {inputs.model}</div>
          <div className="result-hero-spec">{inputs.fuel} · {inputs.transmission} · Odometer {(parseInt(inputs.mileage) / 1000).toFixed(0)}k km · {inputs.fuelEfficiency || '—'} km/l</div>
          <div className="result-hero-city">
            <Icon name="mapPin" size={12} color="#007be5" strokeWidth={2} />
            {inputs.city}
          </div>
        </div>
      </div>

      <div className="result-cards-row">
        {/* Price card */}
        <div className="cd-card price-card">
          <div className="price-card-label">Fair Market Value</div>
          <div className="ml-powered-row">
            <span className={`ml-badge ${isMLPowered ? 'on' : 'fallback'}`}>
              <Icon name="robot" size={12} color={isMLPowered ? '#00a651' : '#f7941d'} strokeWidth={2} />
              {isMLPowered ? `ML Powered · ${modelName || 'CatBoost'}` : 'ML Backend Required'}
            </span>
            {modelMetrics?.r2 && <span className="ml-metric-mini">R² {modelMetrics.r2} · MAPE {modelMetrics.mape}%</span>}
          </div>
          <div className="price-big">{formatINR(predictedPrice)}</div>
          {baseMarketValue && baseMarketValue !== predictedPrice && (
            <div className="condition-adjust-note">Base ML value {formatINR(baseMarketValue)} · Condition multiplier {conditionMultiplier} · Adjustment {formatINR(conditionAdjustment)}</div>
          )}
          <PriceBar min={rangeLow} mid={predictedPrice} max={rangeHigh} />
          <div className="price-confidence-row">
            <span className={`confidence-pill ${confidenceScore >= 75 ? 'good' : confidenceScore >= 55 ? 'medium' : 'bad'}`}>
              <Icon name="shield" size={12} color={confidenceScore >= 75 ? '#00a651' : confidenceScore >= 55 ? '#f7941d' : '#e02020'} strokeWidth={2} />
              {confidenceScore}% Confidence
            </span>
            <span className="price-updated">Updated today</span>
          </div>
          {/* Low / High estimate row — prominent */}
          <div className="price-range-lowhigh">
            <div className="price-range-lowhigh-item">
              <span className="price-range-lowhigh-label">Low estimate</span>
              <span className="price-range-lowhigh-val">{formatINR(rangeLow)}</span>
            </div>
            <div className="price-range-lowhigh-divider" />
            <div className="price-range-lowhigh-item">
              <span className="price-range-lowhigh-label">High estimate</span>
              <span className="price-range-lowhigh-val">{formatINR(rangeHigh)}</span>
            </div>
          </div>
          {/* One-line confidence summary */}
          <div className="price-range-summary">
            Model is <strong>{confidenceScore}% confident</strong> the fair market price falls between{' '}
            <strong>{formatINR(rangeLow)}</strong> and <strong>{formatINR(rangeHigh)}</strong>
          </div>
        </div>

        {/* Original PricerPoint decision cards */}
        <div className="cd-card decision-hero-card">
          <div className="decision-top-row">
            <div>
              <div className="cd-section-label">Acquisition Recommendation</div>
              <div className={`action-badge ${actionClass(action)}`}>{action}</div>
            </div>
            <div className="decision-score">
              <span>{dealQualityScore}</span>
              <small>Deal Quality</small>
            </div>
          </div>
          <div className="decision-grid">
            <div className="decision-metric"><span>Buy Price</span><strong>{formatINR(recommendedBuyPrice)}</strong></div>
            <div className="decision-metric"><span>Sell Price</span><strong>{formatINR(recommendedSellPrice)}</strong></div>
            <div className="decision-metric"><span>Expected Profit</span><strong>{formatINR(expectedProfit)}</strong><em>{expectedMarginPct}% margin</em></div>
            <div className="decision-metric"><span>Risk</span><strong>{riskScore}/100</strong><em>{riskLevel}</em></div>
            <div className="decision-metric"><span>Urgency</span><strong>{urgencyScore}/100</strong><em>Respond fast</em></div>
          </div>
        </div>
      </div>

      <div className="two-col result-factors-row">
        <div className="cd-card factor-card positive">
          <div className="cd-section-label"><Icon name="trendUp" size={13} color="#00a651" strokeWidth={2} /> Positive Factors</div>
          {(positiveFactors?.length ? positiveFactors : ['No strong positive factor detected']).map((f, i) => <div key={i} className="factor-row">+ {f}</div>)}
        </div>
        <div className="cd-card factor-card negative">
          <div className="cd-section-label"><Icon name="trendDown" size={13} color="#e02020" strokeWidth={2} /> Risk Factors</div>
          {(negativeFactors?.length ? negativeFactors : ['No major risk factor detected']).map((f, i) => <div key={i} className="factor-row">− {f}</div>)}
        </div>
      </div>

      <div className="cd-card cond-card" style={{ maxWidth: 320 }}>
        <div className="cd-section-label">Condition</div>
        <ConditionRing score={displayedConditionScore} />
      </div>

      {/* Model breakdown */}
      <div className="cd-card">
        <div className="cd-section-label">
          <Icon name="robot" size={13} color="#888" strokeWidth={1.8} />
          Valuation Engine Breakdown
        </div>
        <div className="model-breakdown">
          {models.map((m, i) => (
            <div key={i} className="mb-row">
              <div className="mb-name">{m.name}</div>
              <div className="mb-bar-track">
                <div className="mb-bar-fill" style={{ width: `${m.weight * 3}%` }} />
              </div>
              <div className="mb-price">{formatINR(m.price)}</div>
              <div className="mb-pct">{m.weight}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="cd-card warn-card">
          <div className="cd-section-label">
            <Icon name="warning" size={13} color="#f75d34" strokeWidth={2} />
            Points to Note
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="warn-row">
              <Icon name="warning" size={13} color="#f75d34" strokeWidth={2} />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="cta-pair">
        <button className="cd-btn-outline flex1" onClick={() => setActiveScreen('explain')}>
          <Icon name="brain" size={15} color="#f75d34" strokeWidth={2} />
          AI Explainability
        </button>
        <button className="cd-btn-orange flex1" onClick={() => setActiveScreen('pricing')}>
          <Icon name="coins" size={15} color="white" strokeWidth={2} />
          Pricing Intel
        </button>
      </div>
    </div>
  );
}
