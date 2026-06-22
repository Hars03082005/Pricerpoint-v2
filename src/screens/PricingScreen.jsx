import { useApp } from '../context/AppContext.jsx';
import { formatINR, CAR_IMAGES } from '../utils/mockData.js';
import Icon from '../components/Icon.jsx';

export default function PricingScreen() {
  const { valuationResult, inputs, setActiveScreen, evaluations } = useApp();
  const carImage = CAR_IMAGES[`${inputs.brand} ${inputs.model}`] || '/cars/placeholder.png';

  if (!valuationResult) {
    return (
      <div className="screen empty-screen">
        <img src={carImage} alt="Car" style={{ width:'60%', opacity:0.5, margin:'0 auto 16px', display:'block' }} />
        <h2 className="empty-title">No pricing data yet</h2>
        <p className="empty-sub">Run a valuation first to see pricing intelligence</p>
        <button className="cd-btn-orange" onClick={() => setActiveScreen('input')}>
          <Icon name="car" size={16} color="white" strokeWidth={2} />
          Start Valuation
        </button>
      </div>
    );
  }

  const { predictedPrice, dealerAcqPrice, suggestedSellPrice, marginPct, marginAmt, priceMin, priceMax, recommendedBuyPrice, recommendedSellPrice, expectedProfit, expectedMarginPct, openingOffer, maxOffer, quoteMessage, riskBuffer, repairBuffer, holdingCost } = valuationResult;
  const finalBuyPrice = recommendedBuyPrice || dealerAcqPrice;
  const finalSellPrice = recommendedSellPrice || suggestedSellPrice;
  const finalProfit = expectedProfit || marginAmt;
  const finalMarginPct = expectedMarginPct || marginPct;
  const comparables = evaluations.filter(t => t.brand === inputs.brand && !(t.year === Number(inputs.year) && t.model === inputs.model && t.marketValue === predictedPrice)).slice(0, 5);

  return (
    <div className="screen">
      <div className="section-page-head">
        <h1 className="page-head-title">Pricing Intelligence</h1>
        <p className="page-head-sub">Dealer acquisition view · {inputs.year} {inputs.brand} {inputs.model}</p>
      </div>

      <div className="role-notice">
        <Icon name="store" size={14} color="#f75d34" strokeWidth={1.8} />
        Showing dealer acquisition, margin and negotiation view
      </div>

      <div className="pricing-cards-row">
        <div className="cd-card">
          <div className="cd-section-label">
            <Icon name="trendUp" size={13} color="#888" strokeWidth={2} />
            Deal Strategy
          </div>
          <div className="price-trio">
            <div className="price-trio-box buy">
              <div className="trio-icon"><Icon name="tag" size={16} color="#888" strokeWidth={1.8} /></div>
              <div className="trio-label">Buy At (Max)</div>
              <div className="trio-price">{formatINR(finalBuyPrice)}</div>
              <div className="trio-sub">Acquisition price</div>
            </div>
            <div className="price-trio-box margin">
              <div className="trio-icon"><Icon name="trendUp" size={16} color="#f75d34" strokeWidth={2} /></div>
              <div className="trio-label">Margin</div>
              <div className="trio-price orange">{finalMarginPct}%</div>
              <div className="trio-sub">{formatINR(finalProfit)} profit</div>
            </div>
            <div className="price-trio-box sell">
              <div className="trio-icon"><Icon name="coins" size={16} color="#888" strokeWidth={1.8} /></div>
              <div className="trio-label">Sell At</div>
              <div className="trio-price">{formatINR(finalSellPrice)}</div>
              <div className="trio-sub">Suggested listing</div>
            </div>
          </div>
          <div className="margin-visual">
            <div className="margin-vis-track">
              <div className="margin-vis-fill" style={{ width: `${(finalBuyPrice/finalSellPrice)*100}%` }} />
            </div>
            <div className="margin-vis-labels">
              <span>Cost: {formatINR(finalBuyPrice)}</span>
              <span className="margin-pill">{finalMarginPct}% margin</span>
              <span>Revenue: {formatINR(finalSellPrice)}</span>
            </div>
          </div>
        </div>

        <div className="cd-card">
          <div className="cd-section-label">
            <Icon name="tag" size={13} color="#888" strokeWidth={2} />
            Negotiation Guidance
          </div>
          <div className="negotiation-grid negotiation-grid-trio">
            <div><span>Opening Offer</span><strong>{formatINR(openingOffer || finalBuyPrice * 0.97)}</strong></div>
            <div><span>Recommended Offer</span><strong>{formatINR(finalBuyPrice)}</strong></div>
            <div><span>Max Offer</span><strong>{formatINR(maxOffer || finalBuyPrice * 1.03)}</strong></div>
          </div>
        </div>
      </div>

      <div className="pricing-secondary-row">
        <div className="cd-card quote-message-card">
          <div className="cd-section-label">
            <Icon name="clipboard" size={13} color="#888" strokeWidth={2} />
            Seller-Ready Quote Message
          </div>
          <p>{quoteMessage}</p>
        </div>

        <div className="cd-card cost-breakdown-card">
          <div className="cd-section-label">
            <Icon name="coins" size={13} color="#888" strokeWidth={2} />
            Quote Calculation Logic
          </div>
          <div className="cost-breakdown-row"><span>Repair buffer</span><strong>{formatINR(repairBuffer || 0)}</strong></div>
          <div className="cost-breakdown-row"><span>Holding cost</span><strong>{formatINR(holdingCost || 0)}</strong></div>
          <div className="cost-breakdown-row"><span>Risk buffer</span><strong>{formatINR(riskBuffer || 0)}</strong></div>
        </div>
      </div>

      {/* Confidence interval */}
      <div className="cd-card">
        <div className="cd-section-label">
          <Icon name="gauge" size={13} color="#888" strokeWidth={2} />
          Price Confidence Interval
        </div>
        <div className="ci-row">
          <div className="ci-box low">
            <div className="ci-box-label">Floor</div>
            <div className="ci-box-val">{formatINR(priceMin)}</div>
          </div>
          <Icon name="arrowRight" size={16} color="#ccc" strokeWidth={1.8} />
          <div className="ci-box mid">
            <div className="ci-box-label">Predicted</div>
            <div className="ci-box-val orange">{formatINR(predictedPrice)}</div>
          </div>
          <Icon name="arrowRight" size={16} color="#ccc" strokeWidth={1.8} />
          <div className="ci-box high">
            <div className="ci-box-label">Ceiling</div>
            <div className="ci-box-val">{formatINR(priceMax)}</div>
          </div>
        </div>
      </div>

      {/* Comparable transactions */}
      <div className="cd-card">
        <div className="cd-section-label">
          <Icon name="refresh" size={13} color="#888" strokeWidth={2} />
          Similar Vehicles Sold
        </div>
        <div className="comp-list">
          {comparables.length === 0 && <div className="empty-sub">No similar evaluated vehicles yet. Run more valuations or upload a bulk CSV to build live comparables.</div>}
          {comparables.map(tx => (
            <div key={tx.id} className="comp-item">
              <img src={carImage} alt={tx.model} className="comp-item-img" />
              <div className="comp-item-info">
                <div className="comp-item-name">{tx.brand} {tx.model} {tx.year}</div>
                <div className="comp-item-spec">
                  <Icon name="mapPin" size={10} color="#aaa" strokeWidth={2} />
                  Odometer {(Number(tx.mileage || tx.kmDriven || 0)/1000).toFixed(0)}k km · {tx.city}
                </div>
                <div className={`comp-cond cond-${String(tx.condition || 'Good').toLowerCase()}`}>{tx.condition || 'Good'}</div>
              </div>
              <div className="comp-item-price">{formatINR(tx.marketValue || tx.predictedPrice)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
