import { useApp } from '../context/AppContext.jsx';
import { CAR_IMAGES } from '../utils/mockData.js';
import { formatINR, getSeasonalContext } from '../utils/format.js';
import { DEAL_HEALTH_META, GRADE_OPTIONS } from '../utils/wheelrCosts.js';
import { DealHealthBanner, ExpandableBreakdownTable, NegotiationPlaybook } from '../components/WheelrPanels.jsx';
import Icon from '../components/Icon.jsx';

function actionClass(action) {
  if (action === 'BUY') return 'buy';
  if (action === 'NEGOTIATE') return 'negotiate';
  if (action === 'REJECT') return 'reject';
  return 'review';
}

function gradeLabel(category, value) {
  return GRADE_OPTIONS[category]?.find(o => o.value === value)?.label || value;
}

export default function EnhancedResultScreen() {
  const { enhancedResult, inputs, setActiveScreen, isLoading } = useApp();
  const carImage = CAR_IMAGES[`${inputs.brand} ${inputs.model}`] || '/cars/placeholder.png';
  const seasonal = getSeasonalContext(enhancedResult?.seasonalMonth || new Date().getMonth() + 1);

  if (isLoading) {
    return (
      <div className="screen loading-screen">
        <div className="loading-label">Running enhanced evaluation…</div>
      </div>
    );
  }

  if (!enhancedResult) {
    return (
      <div className="screen empty-screen">
        <img src={carImage} alt="Car" style={{ width: '60%', opacity: 0.5, margin: '0 auto 16px', display: 'block' }} />
        <h2 className="empty-title">No enhanced result yet</h2>
        <p className="empty-sub">Run enhanced valuation with inspection details</p>
        <button className="cd-btn-orange" onClick={() => setActiveScreen('enhanced-input')}>
          <Icon name="zap" size={16} color="white" strokeWidth={2} />
          Enhanced Valuation
        </button>
      </div>
    );
  }

  const {
    predictedPrice, recommendedBuyPrice, riskScore, riskLevel, action, confidenceScore,
    enhancedMaxBuyPrice, recon, wheelrRisk, negotiation, dealHealth, seasonalMultiplier,
  } = enhancedResult;

  const inspection = enhancedResult.inspection || {};
  const reconRows = [
    { Category: 'Engine', Grade: gradeLabel('engine', inspection.engineGrade || 'good'), Type: inspection.vendorType?.engine || 'vendor', Cost: recon?.breakdown?.engine || 0 },
    { Category: 'Tyres', Grade: gradeLabel('tyre', inspection.tyreGrade || 'good'), Type: inspection.vendorType?.tyre || 'vendor', Cost: recon?.breakdown?.tyres || 0 },
    { Category: 'Body & Paint', Grade: gradeLabel('body', inspection.bodyGrade || 'clean'), Type: inspection.vendorType?.body || 'vendor', Cost: recon?.breakdown?.body_paint || 0 },
    { Category: 'Interior', Grade: gradeLabel('interior', inspection.interiorGrade || 'clean'), Type: inspection.vendorType?.interior || 'vendor', Cost: recon?.breakdown?.interior || 0 },
    { Category: 'Electricals', Grade: gradeLabel('electrical', inspection.electricalGrade || 'all_good'), Type: inspection.vendorType?.electrical || 'vendor', Cost: recon?.breakdown?.electricals || 0 },
    { Category: 'Fixed costs', Grade: '—', Type: '—', Cost: recon?.breakdown?.fixed || recon?.fixed_cost || 0 },
  ];

  const riskRows = [
    { Factor: 'Owner no.', Value: inputs.ownerCount, Deduction: wheelrRisk?.breakdown?.owner_deduction || 0 },
    { Factor: 'Odometer', Value: `${Number(inputs.mileage || 0).toLocaleString('en-IN')} km`, Deduction: wheelrRisk?.breakdown?.km_deduction || 0 },
    { Factor: 'Accident', Value: inspection.accidentHistory || 'none', Deduction: wheelrRisk?.breakdown?.accident_deduction || 0 },
    { Factor: 'State', Value: inspection.registrationState || '—', Deduction: wheelrRisk?.breakdown?.state_deduction || 0 },
    { Factor: 'Loan', Value: inspection.loanOutstanding ? 'Yes' : 'No', Deduction: wheelrRisk?.breakdown?.loan_deduction || 0 },
  ];

  return (
    <div className="screen enhanced-screen">
      <DealHealthBanner dealHealth={dealHealth} meta={DEAL_HEALTH_META} />

      <div className="enhanced-result-cards">
        <div className="cd-card">
          <div className="cd-section-label">ML Valuation</div>
          <div className="result-metric-row"><span>Market value</span><strong>{formatINR(predictedPrice)}</strong></div>
          <div className="result-metric-row"><span>Recommended buy price</span><strong>{formatINR(recommendedBuyPrice)}</strong></div>
          <div className="result-metric-row"><span>Risk score</span><strong>{riskScore}/100 · {riskLevel}</strong></div>
          <div className="result-metric-row">
            <span>Action</span>
            <span className={`action-pill action-${actionClass(action)}`}>{action}</span>
          </div>
          <div className="result-metric-row"><span>Confidence</span><strong>{confidenceScore}%</strong></div>
        </div>

        <div className="cd-card">
          <div className="cd-section-label">Wheelr Analysis</div>
          <div className="result-metric-row highlight"><span>Enhanced max buy</span><strong className="orange-text">{formatINR(enhancedMaxBuyPrice)}</strong></div>
          <div className="result-metric-row"><span>Recon cost</span><strong>{formatINR(recon?.total)}</strong></div>
          <div className="result-metric-row"><span>Wheelr risk deductions</span><strong>{formatINR(wheelrRisk?.total)}</strong></div>
          <div className="result-metric-row"><span>Seasonal multiplier</span><strong>{seasonalMultiplier}× ({seasonal.label})</strong></div>
        </div>
      </div>

      <div className="cd-card">
        <NegotiationPlaybook negotiation={negotiation} />
        <ExpandableBreakdownTable title="View reconditioning breakdown" rows={reconRows} totalLabel="Total" totalValue={recon?.total} />
        <ExpandableBreakdownTable title="View risk breakdown" rows={riskRows} totalLabel="Total" totalValue={wheelrRisk?.total} />
      </div>

      <button className="cd-btn-outline cd-btn-full" onClick={() => setActiveScreen('enhanced-input')}>
        <Icon name="arrowLeft" size={16} color="#f75d34" strokeWidth={2} />
        Back to Enhanced Valuation
      </button>
    </div>
  );
}
