import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatINR, getSeasonalContext } from '../utils/format.js';
import {
  INDIAN_STATES,
  SELLER_REASONS,
  DEFAULT_VENDOR_TYPE,
  DEAL_HEALTH_META,
  getReconCost,
} from '../utils/wheelrCosts.js';
import { runReverseCalculate } from '../utils/apiValuation.js';
import { ConditionGradesSection } from '../components/ConditionGradeField.jsx';
import { DealHealthBanner, NegotiationPlaybook } from '../components/WheelrPanels.jsx';
import Icon from '../components/Icon.jsx';

const OWNER_COUNTS = ['1', '2', '3', '4'];

export default function ReverseCalculatorScreen() {
  const { setReverseResult, reverseResult, inputs } = useApp();
  const [expectedSellPrice, setExpectedSellPrice] = useState('950000');
  const [targetMarginPct, setTargetMarginPct] = useState(15);
  const [ownerCount, setOwnerCount] = useState('1');
  const [odometer, setOdometer] = useState('28000');
  const [year, setYear] = useState(inputs.year || '2021');
  const [accidentHistory, setAccidentHistory] = useState('none');
  const [registrationState, setRegistrationState] = useState('Maharashtra');
  const [sameState, setSameState] = useState(true);
  const [loanOutstanding, setLoanOutstanding] = useState(false);
  const [sellerReason, setSellerReason] = useState('upgrading');
  const [grades, setGrades] = useState({
    engine: 'average',
    tyre: 'good',
    body: 'minor',
    interior: 'clean',
    electrical: 'all_good',
  });
  const [vendorType, setVendorType] = useState({ ...DEFAULT_VENDOR_TYPE });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const seasonal = getSeasonalContext(new Date().getMonth() + 1);
  const liveRecon = useMemo(() => getReconCost(grades, vendorType), [grades, vendorType]);
  const profitPreview = Math.round(Number(expectedSellPrice || 0) * (targetMarginPct / 100));

  const handleGradeChange = (category, value) => {
    setGrades(prev => ({ ...prev, [category]: value }));
  };

  const handleVendorChange = (category, value) => {
    setVendorType(prev => ({ ...prev, [category]: value }));
  };

  const handleCalculate = async () => {
    setError('');
    setLoading(true);
    try {
      const saleState = sameState ? registrationState : 'Other State';
      const payload = {
        expected_sell_price: Math.trunc(Number(expectedSellPrice || 0)),
        year: Math.trunc(Number(year)),
        accident_history: accidentHistory,
        registration_state: registrationState,
        sale_state: saleState,
        loan_outstanding: loanOutstanding,
        seller_reason: sellerReason,
        engine_grade: grades.engine,
        tyre_grade: grades.tyre,
        body_grade: grades.body,
        interior_grade: grades.interior,
        electrical_grade: grades.electrical,
        vendor_type: vendorType,
        owner_count: Math.trunc(Number(ownerCount)),
        odometer: Math.trunc(Number(odometer)),
        target_margin_pct: targetMarginPct / 100,
      };
      const result = await runReverseCalculate(payload);
      setReverseResult(result);
    } catch (e) {
      console.error(e);
      setError('Reverse calculation failed. Ensure FastAPI backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen enhanced-screen">
      <div className="section-page-head">
        <h1 className="page-head-title">Reverse Calculator</h1>
        <p className="page-head-sub">Work backwards from expected sell price to max buy price</p>
      </div>

      {error && (
        <div className="vin-error" style={{ marginBottom: 12 }}>
          <Icon name="warning" size={14} color="#e02020" strokeWidth={2} /> {error}
        </div>
      )}

      <div className="enhanced-two-col">
        <div className="enhanced-col-left">
          <div className="cd-card">
            <div className="cd-section-label">Expected selling price</div>
            <input
              type="number"
              className="cd-input reverse-price-input"
              value={expectedSellPrice}
              onChange={e => setExpectedSellPrice(e.target.value)}
              placeholder="950000"
            />
            <p className="helper-text">What price do you expect to sell this car for?</p>
          </div>

          <div className="cd-card">
            <div className="cd-section-label">Target margin — {targetMarginPct}%</div>
            <input
              type="range"
              min="10"
              max="25"
              step="1"
              value={targetMarginPct}
              onChange={e => setTargetMarginPct(Number(e.target.value))}
              className="margin-slider"
            />
            <div className="helper-text">Profit target: {formatINR(profitPreview)}</div>
          </div>

          <div className="cd-card">
            <div className="cd-section-label">Condition grades</div>
            <ConditionGradesSection
              grades={grades}
              vendorType={vendorType}
              onGradeChange={handleGradeChange}
              onVendorChange={handleVendorChange}
            />
            <div className="live-cost-preview" style={{ marginTop: 8 }}>
              Live recon total: {formatINR(liveRecon.total)}
            </div>
          </div>

          <div className="cd-card">
            <div className="cd-section-label">Risk factors</div>
            <div className="spec-grid">
              <div className="spec-field">
                <label className="spec-label">Year</label>
                <input type="number" className="cd-input" value={year} onChange={e => setYear(e.target.value)} />
              </div>
              <div className="spec-field">
                <label className="spec-label">Owner count</label>
                <select className="cd-input" value={ownerCount} onChange={e => setOwnerCount(e.target.value)}>
                  {OWNER_COUNTS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="spec-field">
                <label className="spec-label">Odometer (km)</label>
                <input type="number" className="cd-input" value={odometer} onChange={e => setOdometer(e.target.value)} />
              </div>
            </div>

            <div className="spec-label" style={{ marginTop: 10 }}>Accident history</div>
            <div className="radio-row">
              {['none', 'minor', 'major'].map(v => (
                <label key={v} className={`radio-chip ${accidentHistory === v ? 'active' : ''}`}>
                  <input type="radio" name="rev-accident" value={v} checked={accidentHistory === v} onChange={() => setAccidentHistory(v)} />
                  {v === 'none' ? 'None' : v === 'minor' ? 'Minor' : 'Major'}
                </label>
              ))}
            </div>

            <div className="spec-field" style={{ marginTop: 10 }}>
              <label className="spec-label">Registration state</label>
              <select className="cd-input" value={registrationState} onChange={e => setRegistrationState(e.target.value)}>
                {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="spec-field">
              <label className="spec-label">Sale state vs registration</label>
              <div className="vendor-toggle-row">
                <button type="button" className={`dep-toggle-btn ${sameState ? 'active' : ''}`} onClick={() => setSameState(true)}>Same state</button>
                <button type="button" className={`dep-toggle-btn ${!sameState ? 'active' : ''}`} onClick={() => setSameState(false)}>Different state</button>
              </div>
            </div>

            <div className="spec-field">
              <label className="spec-label">Loan outstanding</label>
              <div className="vendor-toggle-row">
                <button type="button" className={`dep-toggle-btn ${!loanOutstanding ? 'active' : ''}`} onClick={() => setLoanOutstanding(false)}>No</button>
                <button type="button" className={`dep-toggle-btn ${loanOutstanding ? 'active' : ''}`} onClick={() => setLoanOutstanding(true)}>Yes</button>
              </div>
            </div>

            <div className="spec-field">
              <label className="spec-label">Seller reason</label>
              <select className="cd-input" value={sellerReason} onChange={e => setSellerReason(e.target.value)}>
                {SELLER_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <button className="cd-btn-orange cd-btn-full" onClick={handleCalculate} disabled={loading}>
            <Icon name="arrowLeftRight" size={16} color="white" strokeWidth={2} />
            {loading ? 'Calculating…' : 'Calculate Max Buy Price'}
          </button>
        </div>

        <div className="enhanced-col-right">
          <div className="seasonal-banner">
            📅 {seasonal.label} — {seasonal.mult}× {seasonal.note}
          </div>

          {reverseResult?.disqualifier?.disqualified && (
            <div className="prescreen-banner fail">
              <div className="prescreen-title">⚠ This car fails pre-screening</div>
              <div className="prescreen-reason">{reverseResult.disqualifier.reason}</div>
            </div>
          )}

          {reverseResult ? (
            <>
              {reverseResult.dealHealth && (
                <DealHealthBanner dealHealth={reverseResult.dealHealth} meta={DEAL_HEALTH_META} />
              )}

              <div className="cd-card price-waterfall">
                <div className="cd-section-label">Price waterfall</div>
                {(reverseResult.priceBreakdown || []).map((row, i) => (
                  <div key={i} className={`waterfall-row ${row.sign === '=' ? 'total' : ''}`}>
                    <span>{row.label}</span>
                    <strong>{row.sign === '-' ? '−' : ''}{formatINR(row.value)}</strong>
                  </div>
                ))}
                <div className="waterfall-max">
                  Max buy price: {formatINR(reverseResult.maxBuyPrice)}
                </div>
              </div>

              <div className="cd-card">
                <NegotiationPlaybook negotiation={reverseResult.negotiation} variant="reverse" />
              </div>
            </>
          ) : (
            <div className="cd-card empty-panel">
              <p className="helper-text">Enter details and calculate to see the price waterfall and negotiation playbook.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
