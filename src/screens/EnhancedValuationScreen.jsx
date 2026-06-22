import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { BRANDS, CITY_DEMAND } from '../utils/mockData.js';
import { formatINR, getSeasonalContext } from '../utils/format.js';
import {
  INDIAN_STATES,
  SELLER_REASONS,
  checkDisqualifier,
  getReconCost,
} from '../utils/wheelrCosts.js';
import { runEnhancedEvaluation } from '../utils/apiValuation.js';
import { ConditionGradesSection } from '../components/ConditionGradeField.jsx';
import Icon from '../components/Icon.jsx';

const FUELS = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
const TRANSMISSIONS = ['Manual', 'Automatic', 'CVT', 'DCT'];
const YEARS = Array.from({ length: 15 }, (_, i) => String(2024 - i));
const CITIES = Object.keys(CITY_DEMAND);
const OWNER_COUNTS = ['1', '2', '3', '4'];
const CONDITIONS = ['Excellent', 'Good', 'Average', 'Poor'];

function inspectionGrades(inspection) {
  return {
    engine: inspection.engineGrade,
    tyre: inspection.tyreGrade,
    body: inspection.bodyGrade,
    interior: inspection.interiorGrade,
    electrical: inspection.electricalGrade,
  };
}

export default function EnhancedValuationScreen() {
  const {
    inputs, updateInput,
    enhancedInspection, updateEnhancedInspection, updateVendorType,
    setEnhancedResult, setActiveScreen, setIsLoading, addEvaluation,
  } = useApp();

  const [error, setError] = useState('');

  const brands = Object.keys(BRANDS);
  const models = BRANDS[inputs.brand] || [];
  const vehicleAge = new Date().getFullYear() - Number(inputs.year || 2021);
  const odometer = Number(inputs.mileage || 0);
  const ownerCount = Number(inputs.ownerCount || 1);
  const grades = inspectionGrades(enhancedInspection);
  const recon = useMemo(
    () => getReconCost(grades, enhancedInspection.vendorType),
    [grades, enhancedInspection.vendorType],
  );
  const disqualifier = useMemo(
    () => checkDisqualifier(vehicleAge, odometer, ownerCount, enhancedInspection.accidentHistory),
    [vehicleAge, odometer, ownerCount, enhancedInspection.accidentHistory],
  );
  const seasonal = getSeasonalContext(new Date().getMonth() + 1);

  const handleGradeChange = (category, value) => {
    const map = {
      engine: 'engineGrade',
      tyre: 'tyreGrade',
      body: 'bodyGrade',
      interior: 'interiorGrade',
      electrical: 'electricalGrade',
    };
    updateEnhancedInspection(map[category], value);
  };

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    setEnhancedResult(null);
    setActiveScreen('enhanced-result');
    try {
      const result = await runEnhancedEvaluation(inputs, enhancedInspection);
      setEnhancedResult({ ...result, inspection: { ...enhancedInspection } });
      addEvaluation({ ...inputs }, result, 'Enhanced Valuation');
    } catch (e) {
      console.error(e);
      setActiveScreen('enhanced-input');
      setError('Enhanced evaluation failed. Start FastAPI: uvicorn backend.main:app --reload');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = inputs.brand && inputs.model && inputs.year && inputs.mileage;

  return (
    <div className="screen enhanced-screen">
      <div className="section-page-head">
        <h1 className="page-head-title">Enhanced Valuation</h1>
        <p className="page-head-sub">Wheelr inspection + ML valuation combined</p>
      </div>

      {error && (
        <div className="vin-error" style={{ marginBottom: 12 }}>
          <Icon name="warning" size={14} color="#e02020" strokeWidth={2} /> {error}
        </div>
      )}

      <div className="enhanced-three-col">
        <div className="enhanced-col-vehicle">
          <div className="cd-card">
            <div className="cd-section-label">Vehicle Details</div>
            <div className="spec-field" style={{ marginBottom: 10 }}>
              <label className="spec-label">Brand</label>
              <select className="cd-input" value={inputs.brand} onChange={e => updateInput('brand', e.target.value)}>
                {brands.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="spec-field" style={{ marginBottom: 10 }}>
              <label className="spec-label">Model</label>
              <select className="cd-input" value={inputs.model} onChange={e => updateInput('model', e.target.value)}>
                {models.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="spec-grid">
              <div className="spec-field">
                <label className="spec-label">Year</label>
                <select className="cd-input" value={inputs.year} onChange={e => updateInput('year', e.target.value)}>
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="spec-field">
                <label className="spec-label">Fuel type</label>
                <select className="cd-input" value={inputs.fuel} onChange={e => updateInput('fuel', e.target.value)}>
                  {FUELS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="spec-field">
                <label className="spec-label">Transmission</label>
                <select className="cd-input" value={inputs.transmission} onChange={e => updateInput('transmission', e.target.value)}>
                  {TRANSMISSIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="spec-field">
                <label className="spec-label">Odometer (km)</label>
                <input type="number" className="cd-input" value={inputs.mileage} onChange={e => updateInput('mileage', e.target.value)} />
              </div>
              <div className="spec-field">
                <label className="spec-label">Fuel efficiency (km/l)</label>
                <input type="number" step="0.1" className="cd-input" value={inputs.fuelEfficiency} onChange={e => updateInput('fuelEfficiency', e.target.value)} />
              </div>
              <div className="spec-field">
                <label className="spec-label">Owner count</label>
                <select className="cd-input" value={inputs.ownerCount} onChange={e => updateInput('ownerCount', e.target.value)}>
                  {OWNER_COUNTS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="spec-field">
                <label className="spec-label">Engine CC</label>
                <input type="number" className="cd-input" value={inputs.engineCc} onChange={e => updateInput('engineCc', e.target.value)} />
              </div>
              <div className="spec-field">
                <label className="spec-label">City</label>
                <select className="cd-input" value={inputs.city} onChange={e => updateInput('city', e.target.value)}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="spec-field">
                <label className="spec-label">Condition</label>
                <select className="cd-input" value={inputs.condition} onChange={e => updateInput('condition', e.target.value)}>
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="spec-field">
                <label className="spec-label">Target margin %</label>
                <input type="number" className="cd-input" min="5" max="30" value={inputs.targetMarginPct} onChange={e => updateInput('targetMarginPct', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="enhanced-col-inspection">
          <div className="cd-card">
            <div className="cd-section-label">Inspection Details</div>
            <div className="spec-label">Accident history</div>
            <div className="radio-row">
              {['none', 'minor', 'major'].map(v => (
                <label key={v} className={`radio-chip ${enhancedInspection.accidentHistory === v ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="accident"
                    value={v}
                    checked={enhancedInspection.accidentHistory === v}
                    onChange={() => updateEnhancedInspection('accidentHistory', v)}
                  />
                  {v === 'none' ? 'None' : v === 'minor' ? 'Minor' : 'Major'}
                </label>
              ))}
            </div>

            <div className="spec-field" style={{ marginTop: 12 }}>
              <label className="spec-label">Loan outstanding</label>
              <div className="vendor-toggle-row">
                <button type="button" className={`dep-toggle-btn ${!enhancedInspection.loanOutstanding ? 'active' : ''}`} onClick={() => updateEnhancedInspection('loanOutstanding', false)}>No</button>
                <button type="button" className={`dep-toggle-btn ${enhancedInspection.loanOutstanding ? 'active' : ''}`} onClick={() => updateEnhancedInspection('loanOutstanding', true)}>Yes</button>
              </div>
            </div>

            <div className="spec-field">
              <label className="spec-label">Registration state</label>
              <select className="cd-input" value={enhancedInspection.registrationState} onChange={e => updateEnhancedInspection('registrationState', e.target.value)}>
                {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="spec-field">
              <label className="spec-label">Seller reason</label>
              <select className="cd-input" value={enhancedInspection.sellerReason} onChange={e => updateEnhancedInspection('sellerReason', e.target.value)}>
                {SELLER_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="cd-section-label" style={{ marginTop: 16 }}>Condition grades</div>
            <ConditionGradesSection
              grades={grades}
              vendorType={enhancedInspection.vendorType}
              onGradeChange={handleGradeChange}
              onVendorChange={updateVendorType}
            />
          </div>

          <button
            className={`cd-btn-orange cd-btn-full ${!isFormValid ? 'disabled' : ''}`}
            onClick={handleSubmit}
            disabled={!isFormValid}
          >
            <Icon name="zap" size={16} color="white" strokeWidth={2} />
            Enhanced Evaluate
          </button>
        </div>

        <div className="enhanced-col-analysis">
          <div className="enhanced-analysis-sticky">
            <div className={`prescreen-banner ${disqualifier.disqualified ? 'fail' : 'pass'}`}>
              {disqualifier.disqualified ? (
                <>
                  <div className="prescreen-title">⚠ This car fails pre-screening</div>
                  <div className="prescreen-reason">{disqualifier.reason}</div>
                </>
              ) : (
                <div className="prescreen-title">✓ Car passes pre-screening</div>
              )}
            </div>

            <div className="seasonal-banner">
              📅 {seasonal.label} — {seasonal.mult}× market demand
              <div className="seasonal-note">{seasonal.note}</div>
            </div>

            <div className="cd-card recon-live-card">
              <div className="cd-section-label">Live reconditioning total</div>
              <div className="recon-live-total">{formatINR(recon.total)}</div>
              <div className="recon-live-breakdown">
                <div><span>Categories</span><strong>{formatINR(recon.total - recon.fixed_cost)}</strong></div>
                <div><span>Fixed (RC + detail + ops)</span><strong>{formatINR(recon.fixed_cost)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
