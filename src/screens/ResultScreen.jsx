import { useApp } from '../context/AppContext.jsx';
import { formatINR } from '../utils/mockData.js';
import Icon from '../components/Icon.jsx';

function actionClass(action) {
  if (action === 'BUY') return 'buy';
  if (action === 'NEGOTIATE') return 'negotiate';
  if (action === 'REJECT') return 'reject';
  return 'review';
}

export default function ResultScreen() {
  const { valuationResult, inputs, setActiveScreen, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="screen loading-screen">
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
        <h2 className="empty-title">No valuation yet</h2>
        <p className="empty-sub">Fill in vehicle details to get instant AI pricing</p>
        <button className="cd-btn-orange" onClick={() => setActiveScreen('input')}>
          <Icon name="car" size={16} color="white" strokeWidth={2} />
          Start Valuation
        </button>
      </div>
    );
  }

  const {
    action, confidenceScore,
    recommendedBuyPrice, recommendedSellPrice,
    expectedProfit, expectedMarginPct,
    openingOffer, maxOffer,
    positiveFactors, negativeFactors, warnings,
  } = valuationResult;

  // Buy range: opening offer (target) → recommended buy price (ceiling)
  const buyLow  = openingOffer || Math.round(recommendedBuyPrice * 0.97);
  const buyHigh = recommendedBuyPrice;

  const aClass = actionClass(action);
  const actionColors = { buy: '#00a651', negotiate: '#f7941d', reject: '#e02020', review: '#888' };
  const actionColor = actionColors[aClass] || '#888';

  return (
    <div className="screen">
      {/* Vehicle header */}
      <div className="result-hero" style={{ marginBottom: 16 }}>
        <div className="result-hero-details">
          <div className="result-hero-name">{inputs.year} {inputs.model}</div>
          <div className="result-hero-spec">
            {inputs.brand} · {inputs.fuel} · {inputs.transmission} · {Number(inputs.mileage || 0).toLocaleString('en-IN')} km
          </div>
          <div className="result-hero-city">
            <Icon name="mapPin" size={12} color="#007be5" strokeWidth={2} />
            {inputs.city}
          </div>
        </div>
      </div>

      {/* ── ACTION BANNER ── */}
      <div className="cd-card" style={{
        background: `linear-gradient(135deg, ${actionColor}18 0%, ${actionColor}08 100%)`,
        border: `2px solid ${actionColor}40`,
        padding: '20px 18px',
        marginBottom: 12,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Acquisition Recommendation
        </div>
        <div className={`action-badge ${aClass}`} style={{ fontSize: 28, padding: '10px 28px', display: 'inline-block' }}>
          {action}
        </div>
        <div style={{ marginTop: 12 }}>
          <span className={`confidence-pill ${confidenceScore >= 75 ? 'good' : confidenceScore >= 55 ? 'medium' : 'bad'}`}>
            <Icon name="shield" size={12} color={confidenceScore >= 75 ? '#00a651' : confidenceScore >= 55 ? '#f7941d' : '#e02020'} strokeWidth={2} />
            {confidenceScore}% Confidence
          </span>
        </div>
      </div>

      {/* ── PRICE DECISION GRID ── */}
      <div className="cd-card" style={{ marginBottom: 12 }}>
        <div className="cd-section-label" style={{ marginBottom: 12 }}>
          <Icon name="coins" size={13} color="#f75d34" strokeWidth={2} /> Pricing Decision
        </div>
        {/* Buy range — full width */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '16px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="coins" size={11} color="#00a651" strokeWidth={2} />
            Buy Price Range
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Start offer at</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#00a651' }}>{formatINR(buyLow)}</div>
            </div>
            {/* Range bar */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #00a651 0%, #f7941d 100%)', position: 'relative', margin: '4px 0' }}>
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#00a651', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#f7941d', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>negotiation window</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Walk away at</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#f7941d' }}>{formatINR(buyHigh)}</div>
            </div>
          </div>
        </div>

        {/* Sell price */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
            Sell at
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#007be5' }}>
            {formatINR(recommendedSellPrice)}
          </div>
        </div>
        <div style={{ marginTop: 12, background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Expected profit</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: expectedProfit > 0 ? '#00a651' : '#e02020' }}>
            {formatINR(expectedProfit)}
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginLeft: 6 }}>({expectedMarginPct}% margin)</span>
          </span>
        </div>
      </div>

      {/* ── FACTORS ── */}
      {((positiveFactors?.length > 0) || (negativeFactors?.length > 0)) && (
        <div className="two-col result-factors-row" style={{ marginBottom: 12 }}>
          {positiveFactors?.length > 0 && (
            <div className="cd-card factor-card positive">
              <div className="cd-section-label">
                <Icon name="trendUp" size={13} color="#00a651" strokeWidth={2} /> Positives
              </div>
              {positiveFactors.slice(0, 3).map((f, i) => (
                <div key={i} className="factor-row">+ {f}</div>
              ))}
            </div>
          )}
          {negativeFactors?.length > 0 && (
            <div className="cd-card factor-card negative">
              <div className="cd-section-label">
                <Icon name="trendDown" size={13} color="#e02020" strokeWidth={2} /> Watch out
              </div>
              {negativeFactors.slice(0, 3).map((f, i) => (
                <div key={i} className="factor-row">− {f}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── WARNINGS ── */}
      {warnings?.length > 0 && (
        <div className="cd-card warn-card" style={{ marginBottom: 12 }}>
          <div className="cd-section-label">
            <Icon name="warning" size={13} color="#f75d34" strokeWidth={2} /> Points to Note
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="warn-row">
              <Icon name="warning" size={13} color="#f75d34" strokeWidth={2} />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* ── CTAs ── */}
      <div className="cta-pair">
        <button className="cd-btn-outline flex1" onClick={() => setActiveScreen('enhanced-input')}>
          <Icon name="zap" size={15} color="#f75d34" strokeWidth={2} />
          Full Analysis
        </button>
        <button className="cd-btn-orange flex1" onClick={() => setActiveScreen('explain')}>
          <Icon name="brain" size={15} color="white" strokeWidth={2} />
          Why this price?
        </button>
      </div>
    </div>
  );
}
