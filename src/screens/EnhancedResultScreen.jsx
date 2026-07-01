import { useApp } from '../context/AppContext.jsx';
import { CAR_IMAGES } from '../utils/mockData.js';
import { formatINR, getSeasonalContext } from '../utils/format.js';
import { DEAL_HEALTH_META, GRADE_OPTIONS } from '../utils/wheelrCosts.js';
import { NegotiationPlaybook, ExpandableBreakdownTable } from '../components/WheelrPanels.jsx';
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

// ─── IDV Comparison Banner ─────────────────────────────────
function IDVBanner({ idvAnalysis }) {
  if (!idvAnalysis) return null;
  const { idv_value, ml_value, idv_gap_pct, flag, flag_type } = idvAnalysis;
  const sign = idv_gap_pct >= 0 ? '+' : '';
  const bgColor = flag_type === 'warning' ? '#fff3e0' : flag_type === 'positive' ? '#e8f5e9' : '#f5f5f5';
  const borderColor = flag_type === 'warning' ? '#f7941d' : flag_type === 'positive' ? '#00a651' : '#ccc';
  const textColor = flag_type === 'warning' ? '#b45309' : flag_type === 'positive' ? '#15803d' : '#555';
  const icon = flag_type === 'warning' ? '⚠️' : flag_type === 'positive' ? '✅' : 'ℹ️';

  return (
    <div style={{
      background: bgColor,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
        IDV vs ML Valuation
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
        IDV: {formatINR(idv_value)} &nbsp;|&nbsp; ML Value: {formatINR(ml_value)} &nbsp;|&nbsp;
        <span style={{ color: flag_type === 'warning' ? '#b45309' : flag_type === 'positive' ? '#15803d' : '#555', fontWeight: 700 }}>
          Gap: {sign}{idv_gap_pct}%
        </span>
      </div>
      <div style={{ fontSize: 12, color: textColor, fontWeight: 500 }}>
        {icon} {flag}
      </div>
      {flag_type === 'warning' && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
          ₹15,000 additional risk deduction applied to max buy price
        </div>
      )}
    </div>
  );
}

// ─── Connector arrow between pipeline steps ────────────────
function PipelineArrow() {
  return (
    <div className="pipeline-connector">
      <span className="pipeline-connector-arrow">▼</span>
    </div>
  );
}

// ─── Single pipeline step — simplified (numbers only, no verbose descriptions) ──
function PipelineStep({ icon, iconClass, bodyClass, label, amount, amountClass, barPct, barClass, subRows }) {
  return (
    <div className="pipeline-step">
      <div className={`pipeline-icon ${iconClass}`}>{icon}</div>
      <div className={`pipeline-body ${bodyClass || ''}`}>
        <div className="pipeline-step-top">
          <div className="pipeline-step-label">{label}</div>
          <div className={`pipeline-step-amount ${amountClass}`}>{amount}</div>
        </div>
        {subRows && subRows.length > 0 && (
          <div className="pipeline-sub-rows">
            {subRows.map((row, i) => (
              <div key={i} className="pipeline-sub-row">
                <span>{row.label}</span>
                <strong style={{ color: row.color || undefined }}>{row.value}</strong>
              </div>
            ))}
          </div>
        )}
        {barPct !== undefined && (
          <div className="pipeline-bar-wrap">
            <div className="pipeline-bar-track">
              <div className={`pipeline-bar-fill ${barClass}`} style={{ width: `${Math.min(100, Math.max(2, barPct))}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Pricing Pipeline section ─────────────────────────
function RuleBasedPricingPipeline({ result, inputs }) {
  const {
    predictedPrice,
    recommendedBuyPrice,
    recommendedSellPrice,
    expectedProfit,
    expectedMarginPct,
    targetMarginPct,
    riskScore,
    riskLevel,
    recon,
    wheelrRisk,
    holdingCost,
    riskBuffer,
    repairBuffer,
    dealHealth,
    confidenceScore,
  } = result;

  const mlBasePrice = predictedPrice || 0;
  const reconTotal = recon?.total || repairBuffer || 0;
  const wheelrRiskTotal = wheelrRisk?.total || 0;
  const hCost = holdingCost || Math.round(mlBasePrice * 0.025);
  const rBuf = riskBuffer || Math.round(mlBasePrice * (riskScore / 100) * 0.08);
  const targetProfit = Math.round(mlBasePrice * ((targetMarginPct || 15) / 100));
  const finalBuyPrice = recommendedBuyPrice || 0;
  const sellPrice = recommendedSellPrice || Math.round(mlBasePrice * 1.05);
  const marginPct = expectedMarginPct || 0;
  const targetMPct = targetMarginPct || 15;

  const healthColor = dealHealth === 'green' ? 'green' : dealHealth === 'yellow' ? 'yellow' : 'red';
  const healthIcon = dealHealth === 'green' ? '✅' : dealHealth === 'yellow' ? '⚠️' : '🔴';
  const healthMsg = DEAL_HEALTH_META[dealHealth]?.title || 'Deal health unknown';

  const reconBreakdown = recon?.breakdown || {};
  const reconSubRows = [
    reconBreakdown.engine > 0 && { label: '🔧 Engine', value: formatINR(reconBreakdown.engine), color: 'var(--red)' },
    reconBreakdown.tyres > 0 && { label: '🔄 Tyres', value: formatINR(reconBreakdown.tyres), color: 'var(--red)' },
    reconBreakdown.body_paint > 0 && { label: '🎨 Body & Paint', value: formatINR(reconBreakdown.body_paint), color: 'var(--red)' },
    reconBreakdown.interior > 0 && { label: '🪑 Interior', value: formatINR(reconBreakdown.interior), color: 'var(--red)' },
    reconBreakdown.electricals > 0 && { label: '⚡ Electricals', value: formatINR(reconBreakdown.electricals), color: 'var(--red)' },
    { label: '📋 RC + detailing + ops', value: formatINR(recon?.rc_transfer_cost != null ? reconBreakdown.fixed : (reconBreakdown.fixed || 8000)), color: 'var(--text-3)' },
  ].filter(Boolean);

  const riskBreakdown = wheelrRisk?.breakdown || {};
  const riskSubRows = [
    riskBreakdown.owner_deduction > 0 && { label: `👤 Owner #${inputs.ownerCount}`, value: `−${formatINR(riskBreakdown.owner_deduction)}`, color: 'var(--red)' },
    riskBreakdown.km_deduction > 0 && { label: '🛣️ High odometer', value: `−${formatINR(riskBreakdown.km_deduction)}`, color: 'var(--red)' },
    riskBreakdown.accident_deduction > 0 && { label: '💥 Accident history', value: `−${formatINR(riskBreakdown.accident_deduction)}`, color: 'var(--red)' },
    riskBreakdown.state_deduction > 0 && { label: '🗺️ Out-of-state', value: `−${formatINR(riskBreakdown.state_deduction)}`, color: 'var(--red)' },
    riskBreakdown.loan_deduction > 0 && { label: '🏦 Loan outstanding', value: `−${formatINR(riskBreakdown.loan_deduction)}`, color: 'var(--red)' },
  ].filter(Boolean);
  if (riskSubRows.length === 0) riskSubRows.push({ label: '✔ No risk deductions', value: '₹0', color: 'var(--green)' });

  return (
    <div className="cd-card" style={{ padding: '16px', marginBottom: 12 }}>
      <div className="pipeline-section-head">
        <div>
          <div className="pipeline-section-title">Pricing Pipeline</div>
          <div className="pipeline-section-sub">How the ML price flows to your buy price</div>
        </div>
      </div>

      <div className={`pipeline-health-row ${healthColor}`} style={{ marginBottom: 14 }}>
        <span>{healthIcon}</span>
        <span>{healthMsg}</span>
      </div>

      <div className="pricing-pipeline">
        <PipelineStep
          icon="🤖" iconClass="start" bodyClass="start-body"
          label="ML Market Value"
          amount={formatINR(mlBasePrice)} amountClass="blue"
          barPct={100} barClass="blue"
        />
        <PipelineArrow />
        <PipelineStep
          icon="🔧" iconClass="deduct"
          label="Recon Cost"
          amount={`−${formatINR(reconTotal)}`} amountClass="red"
          barPct={(reconTotal / mlBasePrice) * 100} barClass="red"
          subRows={reconSubRows}
        />
        <PipelineArrow />
        <PipelineStep
          icon="⚠️" iconClass="deduct"
          label="Risk Deductions"
          amount={`−${formatINR(wheelrRiskTotal)}`} amountClass="red"
          barPct={(wheelrRiskTotal / mlBasePrice) * 100} barClass="red"
          subRows={riskSubRows}
        />
        <PipelineArrow />
        <PipelineStep
          icon="📦" iconClass="deduct"
          label="Holding Cost"
          amount={`−${formatINR(hCost)}`} amountClass="orange"
          barPct={(hCost / mlBasePrice) * 100} barClass="orange"
        />
        <PipelineArrow />
        <PipelineStep
          icon="🛡️" iconClass="deduct"
          label="Risk Buffer"
          amount={`−${formatINR(rBuf)}`} amountClass="red"
          barPct={(rBuf / mlBasePrice) * 100} barClass="red"
        />
        <PipelineArrow />
        <PipelineStep
          icon="💰" iconClass="margin"
          label={`Target Profit (${targetMPct}%)`}
          amount={`−${formatINR(targetProfit)}`} amountClass="amber"
          barPct={targetMPct} barClass="amber"
          subRows={[
            { label: '💵 Profit at sell', value: formatINR(expectedProfit || targetProfit), color: 'var(--green)' },
            { label: '📈 Actual margin', value: `${marginPct.toFixed(1)}%`, color: marginPct >= targetMPct ? 'var(--green)' : 'var(--red)' },
          ]}
        />
      </div>

      <div className="pipeline-final-box">
        <div className="pipeline-final-left">
          <div className="pipeline-final-label">✅ Recommended Buy Price</div>
          <div className="pipeline-final-price">{formatINR(finalBuyPrice)}</div>
          <div className="pipeline-final-sub">Sell at {formatINR(sellPrice)} · Net profit {formatINR(expectedProfit)}</div>
        </div>
        <div className="pipeline-final-right">
          <div className="pipeline-final-margin-label">Actual Margin</div>
          <div className="pipeline-final-margin-pct">{marginPct.toFixed(1)}%</div>
          <div className="pipeline-final-margin-tag">Target: {targetMPct}%</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Enhanced Result Screen ────────────────────────────
export default function EnhancedResultScreen() {
  const { enhancedResult, inputs, setActiveScreen, isLoading } = useApp();
  const carImage = CAR_IMAGES[`${inputs.brand} ${inputs.model}`] || '/cars/placeholder.png';

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
    predictedPrice, recommendedBuyPrice, action, confidenceScore,
    enhancedMaxBuyPrice, recon, wheelrRisk, negotiation, dealHealth,
    idvAnalysis,
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

  const actionColors = { buy: '#00a651', negotiate: '#f7941d', reject: '#e02020', review: '#888' };
  const aClass = actionClass(action);
  const actionColor = actionColors[aClass] || '#888';

  return (
    <div className="screen enhanced-screen">
      {/* ── IDV Banner (only when IDV was provided) ── */}
      <IDVBanner idvAnalysis={idvAnalysis} />

      {/* ── Action + Key Numbers ── */}
      <div className="cd-card" style={{
        background: `linear-gradient(135deg, ${actionColor}18 0%, ${actionColor}08 100%)`,
        border: `2px solid ${actionColor}40`,
        padding: '16px 18px',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              Recommendation
            </div>
            <div className={`action-badge ${aClass}`}>{action}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Confidence</div>
            <span className={`confidence-pill ${confidenceScore >= 75 ? 'good' : confidenceScore >= 55 ? 'medium' : 'bad'}`}>
              {confidenceScore}%
            </span>
          </div>
        </div>
        {/* ML value row */}
        <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>ML Market Value</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#007be5' }}>{formatINR(predictedPrice)}</div>
        </div>

        {/* Buy range row */}
        <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '12px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12 }}>💰</span> Buy Price Range
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Open at</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#00a651' }}>{formatINR(negotiation?.opening_offer || Math.round((enhancedMaxBuyPrice || recommendedBuyPrice) * 0.95))}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'linear-gradient(90deg, #00a651 0%, #f7941d 100%)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: '#00a651', border: '2px solid white' }} />
                <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: '#f7941d', border: '2px solid white' }} />
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-3)', marginTop: 4 }}>window</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Walk away</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f7941d' }}>{formatINR(enhancedMaxBuyPrice)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Inspection Deductions breakdown ── */}
      <div className="enhanced-result-cards" style={{ marginBottom: 12 }}>
        <div className="cd-card" style={{ borderLeft: '3px solid #f7941d' }}>
          <div className="cd-section-label">Inspection Deductions</div>
          <div className="result-metric-row">
            <span>Recon cost</span>
            <strong>{formatINR(recon?.total)}</strong>
          </div>
          <div className="result-metric-row">
            <span>Risk deductions</span>
            <strong>{formatINR(wheelrRisk?.total)}</strong>
          </div>
        </div>
      </div>

      {/* ── Negotiation Playbook ── */}
      <div className="cd-card" style={{ marginBottom: 12 }}>
        <NegotiationPlaybook negotiation={negotiation} confidenceScore={confidenceScore} />
      </div>

      {/* ── Rule-Based Pricing Pipeline ── */}
      <RuleBasedPricingPipeline result={enhancedResult} inputs={inputs} />

      {/* ── Expandable breakdown tables ── */}
      <div className="cd-card" style={{ marginBottom: 12 }}>
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
