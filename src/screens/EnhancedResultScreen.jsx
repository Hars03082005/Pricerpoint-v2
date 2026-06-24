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

// ─── Connector arrow between pipeline steps ────────────────
function PipelineArrow() {
  return (
    <div className="pipeline-connector">
      <span className="pipeline-connector-arrow">▼</span>
    </div>
  );
}

// ─── Single pipeline step card ──────────────────────────────
function PipelineStep({ icon, iconClass, bodyClass, label, amount, amountClass, barPct, barClass, subRows, ruleTags, description }) {
  return (
    <div className="pipeline-step">
      <div className={`pipeline-icon ${iconClass}`}>{icon}</div>
      <div className={`pipeline-body ${bodyClass || ''}`}>
        <div className="pipeline-step-top">
          <div className="pipeline-step-label">{label}</div>
          <div className={`pipeline-step-amount ${amountClass}`}>{amount}</div>
        </div>
        {description && (
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, lineHeight: 1.5 }}>
            {description}
          </div>
        )}
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
        {ruleTags && ruleTags.length > 0 && (
          <div className="pipeline-rule-tags">
            {ruleTags.map((tag, i) => (
              <span key={i} className={`pipeline-rule-tag ${tag.cls}`}>{tag.text}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profit composition waterfall bar ──────────────────────
function ProfitWaterfall({ buyPrice, reconTotal, riskTotal, holdingCost, expectedProfit, sellPrice }) {
  const total = Math.max(sellPrice || (buyPrice + reconTotal + riskTotal + holdingCost + expectedProfit), 1);
  const buyPct = (buyPrice / total) * 100;
  const reconPct = (reconTotal / total) * 100;
  const riskPct = (riskTotal / total) * 100;
  const holdPct = (holdingCost / total) * 100;
  const profPct = (expectedProfit / total) * 100;
  return (
    <div className="profit-waterfall">
      <div className="profit-wf-track">
        <div className="profit-wf-segment buy" style={{ width: `${buyPct}%` }}>Buy</div>
        <div className="profit-wf-segment recon" style={{ width: `${reconPct}%` }}>Recon</div>
        <div className="profit-wf-segment risk" style={{ width: `${riskPct}%` }}>Risk</div>
        <div className="profit-wf-segment hold" style={{ width: `${holdPct}%` }}>Hold</div>
        <div className="profit-wf-segment prof" style={{ width: `${profPct}%` }}>Profit</div>
      </div>
      <div className="profit-wf-labels">
        {[
          { cls: 'buy', color: 'var(--green)', label: 'Buy Price' },
          { cls: 'recon', color: 'var(--orange)', label: 'Recon' },
          { cls: 'risk', color: '#e05020', label: 'Risk Deductions' },
          { cls: 'hold', color: '#888', label: 'Holding Cost' },
          { cls: 'prof', color: 'var(--blue)', label: 'Target Profit' },
        ].map(item => (
          <div key={item.cls} className="profit-wf-lbl">
            <div className="profit-wf-dot" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
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

  // Health color
  const healthColor = dealHealth === 'green' ? 'green' : dealHealth === 'yellow' ? 'yellow' : 'red';
  const healthIcon = dealHealth === 'green' ? '✅' : dealHealth === 'yellow' ? '⚠️' : '🔴';
  const healthMsg = DEAL_HEALTH_META[dealHealth]?.title || 'Deal health unknown';

  // Recon sub-rows
  const reconBreakdown = recon?.breakdown || {};
  const reconSubRows = [
    reconBreakdown.engine > 0 && { label: '🔧 Engine', value: formatINR(reconBreakdown.engine), color: 'var(--red)' },
    reconBreakdown.tyres > 0 && { label: '🔄 Tyres', value: formatINR(reconBreakdown.tyres), color: 'var(--red)' },
    reconBreakdown.body_paint > 0 && { label: '🎨 Body & Paint', value: formatINR(reconBreakdown.body_paint), color: 'var(--red)' },
    reconBreakdown.interior > 0 && { label: '🪑 Interior', value: formatINR(reconBreakdown.interior), color: 'var(--red)' },
    reconBreakdown.electricals > 0 && { label: '⚡ Electricals', value: formatINR(reconBreakdown.electricals), color: 'var(--red)' },
    { label: '📋 Fixed (RC + detail + ops)', value: formatINR(reconBreakdown.fixed || 8000), color: 'var(--text-3)' },
  ].filter(Boolean);

  // Wheelr risk sub-rows
  const riskBreakdown = wheelrRisk?.breakdown || {};
  const riskSubRows = [
    riskBreakdown.owner_deduction > 0 && { label: `👤 Owner #${inputs.ownerCount}`, value: `−${formatINR(riskBreakdown.owner_deduction)}`, color: 'var(--red)' },
    riskBreakdown.km_deduction > 0 && { label: '🛣️ High odometer', value: `−${formatINR(riskBreakdown.km_deduction)}`, color: 'var(--red)' },
    riskBreakdown.accident_deduction > 0 && { label: '💥 Accident history', value: `−${formatINR(riskBreakdown.accident_deduction)}`, color: 'var(--red)' },
    riskBreakdown.state_deduction > 0 && { label: '🗺️ Out-of-state', value: `−${formatINR(riskBreakdown.state_deduction)}`, color: 'var(--red)' },
    riskBreakdown.loan_deduction > 0 && { label: '🏦 Loan outstanding', value: `−${formatINR(riskBreakdown.loan_deduction)}`, color: 'var(--red)' },
  ].filter(Boolean);
  if (riskSubRows.length === 0) riskSubRows.push({ label: '✔ No risk deductions applied', value: '₹0', color: 'var(--green)' });

  return (
    <div className="cd-card" style={{ padding: '16px' }}>
      {/* Section header */}
      <div className="pipeline-section-head">
        <div>
          <div className="pipeline-section-title">Rule-Based Pricing Pipeline</div>
          <div className="pipeline-section-sub">
            How the ML base price flows through every rule to reach your final buy price
          </div>
        </div>
        <div className="pipeline-badge">⚙️ 6-Stage Rules</div>
      </div>

      {/* Deal health banner */}
      <div className={`pipeline-health-row ${healthColor}`} style={{ marginBottom: 14 }}>
        <span>{healthIcon}</span>
        <span>{healthMsg}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.75 }}>
          {DEAL_HEALTH_META[dealHealth]?.reason}
        </span>
      </div>

      {/* ── PIPELINE STEPS ── */}
      <div className="pricing-pipeline">

        {/* STEP 1 — ML Base Market Value */}
        <PipelineStep
          icon="🤖"
          iconClass="start"
          bodyClass="start-body"
          label="Stage 1 · ML Base Market Value"
          amount={formatINR(mlBasePrice)}
          amountClass="blue"
          barPct={100}
          barClass="blue"
          description="CatBoost model predicts fair market value from vehicle specs, odometer, age, fuel, transmission and city demand."
          ruleTags={[
            { text: 'CatBoost ML', cls: 'blue' },
            { text: `${confidenceScore}% Confidence`, cls: 'blue' },
          ]}
        />

        <PipelineArrow />

        {/* STEP 2 — Reconditioning Cost */}
        <PipelineStep
          icon="🔧"
          iconClass="deduct"
          label="Stage 2 · Reconditioning Cost (Recon)"
          amount={`−${formatINR(reconTotal)}`}
          amountClass="red"
          barPct={(reconTotal / mlBasePrice) * 100}
          barClass="red"
          description="Deducted for physical repairs needed before the vehicle can be resold. Calculated from field inspection grades."
          subRows={reconSubRows}
          ruleTags={[
            { text: 'Field Inspection', cls: 'orange' },
            { text: reconTotal > mlBasePrice * 0.2 ? 'High Recon' : 'Low Recon', cls: reconTotal > mlBasePrice * 0.2 ? 'red' : 'green' },
          ]}
        />

        <PipelineArrow />

        {/* STEP 3 — Wheelr Risk Deductions */}
        <PipelineStep
          icon="⚠️"
          iconClass="deduct"
          label="Stage 3 · Wheelr Risk Deductions"
          amount={`−${formatINR(wheelrRiskTotal)}`}
          amountClass="red"
          barPct={(wheelrRiskTotal / mlBasePrice) * 100}
          barClass="red"
          description="Rule-based deductions for owner count, high odometer, accident history, out-of-state registration, and loan outstanding."
          subRows={riskSubRows}
          ruleTags={[
            { text: 'Owner Risk', cls: 'orange' },
            { text: 'Accident History', cls: 'orange' },
            { text: 'State Transfer', cls: 'orange' },
          ]}
        />

        <PipelineArrow />

        {/* STEP 4 — Holding Cost */}
        <PipelineStep
          icon="📦"
          iconClass="deduct"
          label="Stage 4 · Holding Cost (2.5% of market value)"
          amount={`−${formatINR(hCost)}`}
          amountClass="orange"
          barPct={(hCost / mlBasePrice) * 100}
          barClass="orange"
          description="Fixed 2.5% holding buffer for the time the vehicle sits in inventory before resale (insurance, parking, depreciation)."
          ruleTags={[
            { text: 'Rule: 2.5% × Market Value', cls: 'orange' },
          ]}
        />

        <PipelineArrow />

        {/* STEP 5 — Risk Buffer */}
        <PipelineStep
          icon="🛡️"
          iconClass="deduct"
          label="Stage 5 · Risk Buffer (risk score × 8%)"
          amount={`−${formatINR(rBuf)}`}
          amountClass="red"
          barPct={(rBuf / mlBasePrice) * 100}
          barClass="red"
          description={`Dynamic buffer based on vehicle risk score (${riskScore}/100 · ${riskLevel}). Higher risk = larger buffer deducted from buy price.`}
          subRows={[
            { label: '📊 Risk score', value: `${riskScore}/100 (${riskLevel})` },
            { label: '📐 Formula', value: `Market × (${riskScore}/100) × 8%` },
          ]}
          ruleTags={[
            { text: `Risk: ${riskLevel}`, cls: riskLevel === 'Low' ? 'green' : riskLevel === 'Medium' ? 'orange' : 'red' },
            { text: 'Rule: Dynamic Buffer', cls: 'orange' },
          ]}
        />

        <PipelineArrow />

        {/* STEP 6 — Target Profit Margin */}
        <PipelineStep
          icon="💰"
          iconClass="margin"
          label={`Stage 6 · Target Profit Margin (${targetMPct}%)`}
          amount={`−${formatINR(targetProfit)}`}
          amountClass="amber"
          barPct={targetMPct}
          barClass="amber"
          description={`Dealer's target margin (${targetMPct}%) is pre-deducted from market value to set a profitable buy price ceiling.`}
          subRows={[
            { label: '🎯 Target margin', value: `${targetMPct}%` },
            { label: '💵 Profit at sell price', value: formatINR(expectedProfit || targetProfit), color: 'var(--green)' },
            { label: '📈 Actual margin', value: `${marginPct.toFixed(1)}%`, color: marginPct >= targetMPct ? 'var(--green)' : 'var(--red)' },
          ]}
          ruleTags={[
            { text: `Target: ${targetMPct}%`, cls: 'blue' },
            { text: marginPct >= targetMPct ? 'Meets Target ✓' : 'Below Target ✗', cls: marginPct >= targetMPct ? 'green' : 'red' },
          ]}
        />

      </div>

      {/* ── Final buy price result box ── */}
      <div className="pipeline-final-box">
        <div className="pipeline-final-left">
          <div className="pipeline-final-label">✅ Recommended Buy Price</div>
          <div className="pipeline-final-price">{formatINR(finalBuyPrice)}</div>
          <div className="pipeline-final-sub">
            Sell at {formatINR(sellPrice)} · Net profit {formatINR(expectedProfit)}
          </div>
        </div>
        <div className="pipeline-final-right">
          <div className="pipeline-final-margin-label">Actual Margin</div>
          <div className="pipeline-final-margin-pct">{marginPct.toFixed(1)}%</div>
          <div className="pipeline-final-margin-tag">Target: {targetMPct}%</div>
        </div>
      </div>

      {/* Margin gauge */}
      <div className="pipeline-margin-gauge" style={{ marginTop: 12 }}>
        <div className="pipeline-mg-track">
          <div className="pipeline-mg-fill" style={{ width: `${Math.min(100, (marginPct / 30) * 100)}%` }} />
        </div>
        <div className="pipeline-mg-label">{marginPct.toFixed(1)}%</div>
        <div className="pipeline-mg-target">/ {targetMPct}% target</div>
      </div>

      {/* Profit composition waterfall bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
          Sell Price Composition
        </div>
        <ProfitWaterfall
          buyPrice={finalBuyPrice}
          reconTotal={reconTotal}
          riskTotal={wheelrRiskTotal}
          holdingCost={hCost}
          expectedProfit={expectedProfit || targetProfit}
          sellPrice={sellPrice}
        />
      </div>
    </div>
  );
}

// ─── Main Enhanced Result Screen ────────────────────────────
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

      {/* ── RULE-BASED PRICING PIPELINE ── */}
      <RuleBasedPricingPipeline
        result={enhancedResult}
        inputs={inputs}
      />

      <div className="cd-card">
        <NegotiationPlaybook negotiation={negotiation} confidenceScore={confidenceScore} />
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
