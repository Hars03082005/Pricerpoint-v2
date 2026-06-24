import { useApp } from '../context/AppContext.jsx';
import { formatINR, CAR_IMAGES } from '../utils/mockData.js';
import Icon from '../components/Icon.jsx';

export default function ExplainScreen() {
  const { valuationResult, inputs, setActiveScreen } = useApp();
  const carImage = CAR_IMAGES[`${inputs.brand} ${inputs.model}`] || '/cars/placeholder.png';

  if (!valuationResult) {
    return (
      <div className="screen empty-screen">
        <img src={carImage} alt="Car" style={{ width:'60%', opacity:0.5, margin:'0 auto 16px', display:'block' }} />
        <h2 className="empty-title">Run a valuation first</h2>
        <p className="empty-sub">AI explainability will appear after valuation</p>
        <button className="cd-btn-orange" onClick={() => setActiveScreen('input')}>
          <Icon name="car" size={16} color="white" strokeWidth={2} />
          Start Valuation
        </button>
      </div>
    );
  }

  const { predictedPrice } = valuationResult;
  const shap = valuationResult.shap?.length ? valuationResult.shap : [{ feature: 'CatBoost ML Model', value: 'Market value prediction', contribution: Math.round((predictedPrice || 0) * 0.08) }];
  const counterfactuals = valuationResult.counterfactuals?.length ? valuationResult.counterfactuals : [];
  const maxAbs = Math.max(1, ...shap.map(s => Math.abs(s.contribution || 0)));

  return (
    <div className="screen">
      <div className="section-page-head">
        <h1 className="page-head-title">Why this price?</h1>
        <p className="page-head-sub">AI-powered factor analysis for your {inputs.model}</p>
      </div>

      {/* SHAP chart */}
      <div className="cd-card">
        <div className="shap-header">
          <div className="cd-section-label">
            <Icon name="barChart" size={13} color="#888" strokeWidth={2} />
            Factor Contributions
          </div>
          <div className="shap-legend-row">
            <span className="shap-legend-item">
              <span className="shap-dot-g" />Adds value
            </span>
            <span className="shap-legend-item">
              <span className="shap-dot-r" />Reduces value
            </span>
          </div>
        </div>
        <div className="shap-list">
          {shap.map((item, i) => {
            const isPos = item.contribution >= 0;
            const w     = Math.min(92, (Math.abs(item.contribution) / maxAbs) * 82);
            return (
              <div key={i} className="shap-item" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="shap-item-left">
                  <div className="shap-feat-name">{item.feature}</div>
                  <div className="shap-feat-val">{item.value}</div>
                </div>
                <div className="shap-bar-area">
                  <div className={`shap-bar ${isPos ? 'pos' : 'neg'}`} style={{ width: `${w}%` }} />
                  <span className={`shap-bar-label ${isPos ? 'pos' : 'neg'}`}>
                    {isPos ? '+' : ''}{formatINR(item.contribution)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Counterfactuals */}
      <div className="cd-card">
        <div className="cd-section-label">
          <Icon name="sparkle" size={13} color="#888" strokeWidth={2} />
          What Could Change the Price?
        </div>
        <div className="cf-list">
          {counterfactuals.map((cf, i) => (
            <div key={i} className={`cf-item ${cf.positive ? 'cf-pos' : 'cf-neg'}`}>
              <div className="cf-item-icon-wrap">
                <Icon
                  name={cf.positive ? 'trendUp' : 'trendDown'}
                  size={18}
                  color={cf.positive ? '#00a651' : '#e02020'}
                  strokeWidth={2}
                />
              </div>
              <div className="cf-item-body">
                <div className="cf-item-text">{cf.text}</div>
                <div className="cf-item-detail">{cf.detail}</div>
              </div>
              <div className={`cf-item-impact ${cf.positive ? 'green' : 'red'}`}>
                {cf.impact}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary note */}
      <div className="cd-card summary-card">
        <div className="summary-icon-wrap">
          <Icon name="robot" size={22} color="#007be5" strokeWidth={1.8} />
        </div>
        <div className="summary-text">
          Our <strong>CatBoost ML price model + dealer quote engine</strong> priced your{' '}
          <strong>{inputs.year} {inputs.model}</strong> at{' '}
          <strong>{formatINR(predictedPrice)}</strong>. The primary factors are{' '}
          <strong>{shap[0]?.feature}</strong> and <strong>{shap[1]?.feature}</strong>.
        </div>
      </div>

      <button className="cd-btn-orange cd-btn-full" onClick={() => setActiveScreen('pricing')}>
        See Pricing Intelligence
        <Icon name="arrowRight" size={16} color="white" strokeWidth={2.2} />
      </button>
    </div>
  );
}
