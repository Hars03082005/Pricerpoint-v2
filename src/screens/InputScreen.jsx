import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { BRANDS, VIN_DATABASE, CITY_DEMAND, CAR_IMAGES, formatINR } from '../utils/mockData.js';
import { runMLValuation, runBulkMLValuation } from '../utils/apiValuation.js';
import Icon from '../components/Icon.jsx';

const FUELS         = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
const TRANSMISSIONS = ['Manual', 'Automatic', 'CVT', 'DCT'];
const YEARS         = Array.from({ length: 15 }, (_, i) => String(2024 - i));
const CITIES        = Object.keys(CITY_DEMAND);
const OWNER_COUNTS  = ['1', '2', '3', '4'];
const CONDITIONS    = ['Excellent', 'Good', 'Average', 'Poor'];

const FUEL_ICONS = {
  Petrol:   { icon: 'fuelPump',  color: '#e67e22' },
  Diesel:   { icon: 'oilDrop',   color: '#34495e' },
  Electric: { icon: 'lightning', color: '#2980b9' },
  CNG:      { icon: 'leaf',      color: '#27ae60' },
  Hybrid:   { icon: 'recycle',   color: '#16a085' },
};

const TEMPLATE_CSV = `brand,model,year,fuel,transmission,odometer_reading,fuel_efficiency,city,owner_count,engine_cc,condition\nHonda,City,2021,Petrol,Manual,28000,17.5,Mumbai,1,1497,Good\nHyundai,Creta,2020,Diesel,Automatic,45000,18.0,Delhi,2,1493,Good\nToyota,Fortuner,2021,Diesel,Automatic,22000,14.2,Bangalore,1,2755,Excellent`;

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') { current += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = { rowNumber: index + 1 };
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

function getFirst(row, keys) {
  for (const key of keys) {
    const v = row[normalizeKey(key)];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function numberFrom(value, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  const match = String(value).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? match[0] : fallback;
}

function titleCase(value) {
  return String(value || '').trim().split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
}

function inferBrandModel(row, defaults) {
  const brandRaw = getFirst(row, ['brand', 'make', 'oem', 'brand_name', 'manufacturer']);
  const modelRaw = getFirst(row, ['model', 'car_model', 'model_name']);
  const carName = getFirst(row, ['car_name', 'name', 'full_name', 'vehicle_name']);
  let brand = brandRaw || defaults.brand;
  let model = modelRaw || defaults.model;
  if (carName && (!brandRaw || !modelRaw)) {
    const parts = carName.split(/\s+/);
    if (!brandRaw && parts[0]) brand = parts[0];
    if (!modelRaw && parts.length > 1) model = parts.slice(1).join(' ');
  }
  return { brand: titleCase(brand), model: titleCase(model) };
}

function parseOwner(value, fallback) {
  const text = String(value || '').toLowerCase();
  if (/first|1st|\b1\b/.test(text)) return '1';
  if (/second|2nd|\b2\b/.test(text)) return '2';
  if (/third|3rd|\b3\b/.test(text)) return '3';
  if (/fourth|4th|\b4\b/.test(text)) return '4';
  if (/more|fifth|\b5\b/.test(text)) return '5';
  return numberFrom(value, fallback);
}

function rowToInputs(row, defaults) {
  const { brand, model } = inferBrandModel(row, defaults);
  const vehicleAge = numberFrom(getFirst(row, ['vehicle_age', 'age']), '');
  const yearValue = getFirst(row, ['year', 'manufacturing_year', 'mfg_year', 'model_year', 'myear']) || (vehicleAge ? String(new Date().getFullYear() - Number(vehicleAge)) : defaults.year);
  const odometer = getFirst(row, ['odometer_reading', 'odometer', 'km_driven', 'kms_driven', 'kilometers_driven', 'driven_kms', 'distance_travelled']);
  const fuelEfficiency = getFirst(row, ['fuel_efficiency', 'mileage_kmpl', 'kmpl', 'mileage_new', 'fuel_efficiency_kmpl', 'mileage']);
  const owner = getFirst(row, ['owner_count', 'owners', 'owner', 'owner_type', 'owner_type_new']);

  return {
    ...defaults,
    brand,
    model,
    year: numberFrom(yearValue, defaults.year),
    fuel: titleCase(getFirst(row, ['fuel', 'fuel_type', 'fuel_type_new', 'ft']) || defaults.fuel),
    transmission: titleCase(getFirst(row, ['transmission', 'transmission_type', 'transmission_type_new', 'tt']) || defaults.transmission),
    mileage: numberFrom(odometer, defaults.mileage),
    fuelEfficiency: numberFrom(fuelEfficiency, defaults.fuelEfficiency),
    city: titleCase(getFirst(row, ['city', 'location', 'city_name', 'city_name_new', 'city_y', 'city_x']) || defaults.city),
    ownerCount: parseOwner(owner, defaults.ownerCount),
    engineCc: numberFrom(getFirst(row, ['engine_cc', 'engine_capacity', 'engine', 'displacement', 'engine_capacity_new']), defaults.engineCc),
    condition: titleCase(getFirst(row, ['condition', 'vehicle_condition']) || defaults.condition),
  };
}

export default function InputScreen() {
  const {
    inputs, updateInput, fillFromVIN,
    uploadedImage, handleImageUpload,
    setValuationResult, setActiveScreen, setIsLoading,
    addEvaluation, addBulkEvaluations,
  } = useApp();

  const [vinInput, setVinInput]     = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  const [vinStatus, setVinStatus]   = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [step, setStep]             = useState(1);
  const [bulkRows, setBulkRows]     = useState([]);
  const [bulkError, setBulkError]   = useState('');
  const [valuationError, setValuationError] = useState('');

  const brands   = Object.keys(BRANDS);
  const models   = BRANDS[inputs.brand] || [];
  const carImage = CAR_IMAGES[`${inputs.brand} ${inputs.model}`] || '/cars/placeholder.png';

  const handleVinLookup = () => {
    if (!vinInput.trim()) return;
    setVinLoading(true);
    setVinStatus(null);
    setTimeout(() => {
      const data = VIN_DATABASE[vinInput.trim().toUpperCase()];
      if (data) { fillFromVIN(data); setVinStatus('ok'); }
      else       { setVinStatus('error'); }
      setVinLoading(false);
    }, 1200);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleImageUpload(file);
  };

  const handleSubmit = async () => {
    setValuationError('');
    setIsLoading(true);
    setValuationResult(null);
    setActiveScreen('result');
    try {
      const result = await runMLValuation({ ...inputs });
      setValuationResult(result);
      addEvaluation({ ...inputs }, result, 'Single Vehicle');
    } catch (error) {
      console.error(error);
      setActiveScreen('input');
      setValuationError('ML backend is not running or could not evaluate this car. Please start FastAPI with: uvicorn backend.main:app --reload');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkError('');
    setBulkRows([]);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setBulkError('Please upload a CSV file.');
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        setBulkError('CSV is empty or missing rows.');
        return;
      }
      const results = await runBulkMLValuation(rows, inputs, rowToInputs);
      setBulkRows(results);
      addBulkEvaluations(results);
    } catch (error) {
      console.error(error);
      setBulkError('Bulk ML evaluation failed. Please make sure the FastAPI backend is running and the CSV has valid vehicle columns.');
    }
  };

  const isFormValid = inputs.brand && inputs.model && inputs.year && inputs.mileage;
  const totalProfit = bulkRows.reduce((sum, r) => sum + (r.expectedProfit || 0), 0);
  const buyCount = bulkRows.filter(r => r.action === 'BUY').length;
  const negotiateCount = bulkRows.filter(r => r.action === 'NEGOTIATE').length;

  return (
    <div className="screen">
      {/* Hero car display */}
      <div className="car-hero-banner">
        <div className="car-hero-info">
          <div className="car-hero-badge">
            <Icon name="tag" size={10} color="white" strokeWidth={2} />
            Dealer Quote Engine
          </div>
          <h1 className="car-hero-title">
            {inputs.year} {inputs.brand} {inputs.model}
          </h1>
          <p className="car-hero-sub">{inputs.fuel} · {inputs.transmission} · {inputs.city}</p>
        </div>
        <div className="car-hero-img-wrap">
          <img key={carImage} src={carImage} alt={`${inputs.brand} ${inputs.model}`} className="car-hero-img" />
        </div>
      </div>

      {/* Step tabs */}
      <div className="step-tabs">
        <button className={`step-tab ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>
          <span className="step-num">1</span> Single Vehicle
        </button>
        <button className={`step-tab ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}>
          <span className="step-num">2</span> Bulk CSV
        </button>
        <button className={`step-tab ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>
          <span className="step-num">3</span> Upload Photos
        </button>
      </div>

      {valuationError && (
        <div className="vin-error" style={{ marginBottom: 12 }}>
          <Icon name="warning" size={14} color="#e02020" strokeWidth={2} /> {valuationError}
        </div>
      )}

      {step === 1 && (
        <div className="valuation-desktop-layout">
          <div className="valuation-col-left">
            <div className="cd-card valuation-picker-card">
              <div className="cd-section-label">Select Vehicle</div>
              <div className="brand-scroll brand-scroll-vertical">
                {brands.map(b => (
                  <button key={b} className={`brand-pill ${inputs.brand === b ? 'active' : ''}`} onClick={() => updateInput('brand', b)}>
                    {b}
                  </button>
                ))}
              </div>
              <div className="model-grid model-grid-desktop">
                {models.map(m => (
                  <button
                    key={m}
                    className={`model-tile ${inputs.model === m ? 'active' : ''}`}
                    onClick={() => updateInput('model', m)}
                  >
                    <img src={CAR_IMAGES[`${inputs.brand} ${m}`] || '/cars/placeholder.png'} alt={m} className="model-tile-img" />
                    <span className="model-tile-name">{m}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="valuation-col-right">
            <div className="valuation-form-scroll">
              <div className="cd-card">
                <div className="cd-card-head">
                  <div className="card-icon-circle blue">
                    <Icon name="search" size={16} color="#007be5" strokeWidth={2} />
                  </div>
                  <div>
                    <div className="cd-card-title">Quick Registration / VIN Lookup</div>
                    <div className="cd-card-sub">Auto-fill car details from registration number or VIN</div>
                  </div>
                </div>
                <div className="vin-row">
                  <input
                    className="cd-input vin-input"
                    placeholder="Enter Reg No. / VIN (e.g. VIN-HONDA-2021)"
                    value={vinInput}
                    onChange={e => { setVinInput(e.target.value); setVinStatus(null); }}
                    onKeyDown={e => e.key === 'Enter' && handleVinLookup()}
                  />
                  <button
                    className={`cd-btn-orange vin-lookup-btn ${vinLoading ? 'loading' : ''}`}
                    onClick={handleVinLookup}
                    disabled={vinLoading}
                  >
                    {vinLoading
                      ? <span className="cd-spinner" />
                      : <Icon name="search" size={15} color="white" strokeWidth={2.2} />
                    }
                    {!vinLoading && <span>Lookup</span>}
                  </button>
                </div>
                {vinStatus === 'ok'    && (
                  <div className="vin-success">
                    <Icon name="check" size={14} color="#00a651" strokeWidth={2} /> Vehicle details auto-filled!
                  </div>
                )}
                {vinStatus === 'error' && (
                  <div className="vin-error">
                    <Icon name="warning" size={14} color="#e02020" strokeWidth={2} /> Not found. Try: VIN-TESLA-2023
                  </div>
                )}
                <div className="vin-samples">
                  {['VIN-HONDA-2021','VIN-TESLA-2023','VIN-BMW-2022'].map(v => (
                    <button key={v} className="vin-sample-chip" onClick={() => { setVinInput(v); setVinStatus(null); }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cd-card">
                <div className="cd-section-label">Vehicle Specifications</div>
                <div className="spec-grid">
                  <div className="spec-field">
                    <label className="spec-label">Year of Manufacture</label>
                    <select className="cd-input" value={inputs.year} onChange={e => updateInput('year', e.target.value)}>
                      {YEARS.map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="spec-field">
                    <label className="spec-label">City</label>
                    <select className="cd-input" value={inputs.city} onChange={e => updateInput('city', e.target.value)}>
                      {CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="spec-field">
                    <label className="spec-label">Odometer Reading (km)</label>
                    <input
                      type="number"
                      className="cd-input"
                      placeholder="e.g. 28000"
                      value={inputs.mileage}
                      onChange={e => updateInput('mileage', e.target.value)}
                    />
                  </div>
                  <div className="spec-field">
                    <label className="spec-label">Fuel Efficiency (km/l)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="cd-input"
                      placeholder="e.g. 17.5"
                      value={inputs.fuelEfficiency}
                      onChange={e => updateInput('fuelEfficiency', e.target.value)}
                    />
                  </div>
                  <div className="spec-field">
                    <label className="spec-label">Transmission</label>
                    <select className="cd-input" value={inputs.transmission} onChange={e => updateInput('transmission', e.target.value)}>
                      {TRANSMISSIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="spec-field">
                    <label className="spec-label">Ownership Count</label>
                    <select className="cd-input" value={inputs.ownerCount} onChange={e => updateInput('ownerCount', e.target.value)}>
                      {OWNER_COUNTS.map(o => <option key={o} value={o}>{o}{o === '1' ? 'st' : o === '2' ? 'nd' : o === '3' ? 'rd' : 'th'} Owner</option>)}
                    </select>
                  </div>
                  <div className="spec-field">
                    <label className="spec-label">Engine Capacity (cc)</label>
                    <input
                      type="number"
                      className="cd-input"
                      placeholder="e.g. 1497"
                      value={inputs.engineCc}
                      onChange={e => updateInput('engineCc', e.target.value)}
                    />
                  </div>
                  <div className="spec-field">
                    <label className="spec-label">Condition</label>
                    <select className="cd-input" value={inputs.condition} onChange={e => updateInput('condition', e.target.value)}>
                      {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="spec-label" style={{ marginTop: 12 }}>Fuel Type</div>
                <div className="fuel-pills">
                  {FUELS.map(f => {
                    const fi = FUEL_ICONS[f];
                    const isActive = inputs.fuel === f;
                    return (
                      <button
                        key={f}
                        className={`fuel-pill ${isActive ? 'active' : ''}`}
                        onClick={() => updateInput('fuel', f)}
                      >
                        <Icon name={fi.icon} size={15} color={isActive ? '#f75d34' : fi.color} strokeWidth={1.8} />
                        <span>{f}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="valuation-sticky-footer">
              <button
                className={`cd-btn-orange cd-btn-full ${!isFormValid ? 'disabled' : ''}`}
                onClick={() => setStep(2)}
                disabled={!isFormValid}
              >
                Next: Upload Photos
                <Icon name="arrowRight" size={16} color="white" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="cd-card">
            <div className="cd-card-head">
              <div className="card-icon-circle orange">
                <Icon name="clipboard" size={16} color="#f75d34" strokeWidth={2} />
              </div>
              <div>
                <div className="cd-card-title">Bulk Dealer Valuation</div>
                <div className="cd-card-sub">Upload a CSV to evaluate multiple cars for a dealership inventory or acquisition list</div>
              </div>
            </div>
            <div className="upload-zone" onClick={() => document.getElementById('bulk-csv-input').click()}>
              <input id="bulk-csv-input" type="file" accept=".csv,text/csv" style={{ display:'none' }} onChange={handleBulkUpload} />
              <div className="upload-empty">
                <div className="upload-icon-circle">
                  <Icon name="upload" size={28} color="#f75d34" strokeWidth={1.8} />
                </div>
                <div className="upload-title">Upload Vehicle CSV</div>
                <div className="upload-desc">Accepted columns: brand, model, year, fuel, transmission, odometer_reading, fuel_efficiency, city, owner_count, engine_cc, condition</div>
                <div className="upload-cta">Browse CSV</div>
              </div>
            </div>
            <a
              className="vin-sample-chip"
              style={{ display:'inline-flex', marginTop: 12, textDecoration:'none' }}
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
              download="pricerpoint_bulk_template.csv"
            >
              Download sample CSV template
            </a>
            {bulkError && (
              <div className="vin-error" style={{ marginTop: 10 }}>
                <Icon name="warning" size={14} color="#e02020" strokeWidth={2} /> {bulkError}
              </div>
            )}
          </div>

          {bulkRows.length > 0 && (
            <>
              <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-label">Cars Processed</div><div className="kpi-value">{bulkRows.length}</div></div>
                <div className="kpi-card"><div className="kpi-label">BUY Recommendations</div><div className="kpi-value">{buyCount}</div></div>
                <div className="kpi-card"><div className="kpi-label">NEGOTIATE</div><div className="kpi-value">{negotiateCount}</div></div>
                <div className="kpi-card"><div className="kpi-label">Projected Profit</div><div className="kpi-value">{formatINR(totalProfit)}</div></div>
              </div>

              <div className="cd-card">
                <div className="cd-section-label">Bulk Valuation Results</div>
                <div className="bulk-table-wrap">
                  <table className="bulk-table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>City</th>
                        <th>Odometer</th>
                        <th>Market Value</th>
                        <th>Buy Price</th>
                        <th>Sell Price</th>
                        <th>Profit</th>
                        <th>Risk</th>
                        <th>Deal Quality</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map(r => (
                        <tr key={r.rowNumber}>
                          <td>{r.vehicle}</td>
                          <td>{r.city}</td>
                          <td>{Number.isFinite(r.odometer) ? `${(r.odometer/1000).toFixed(0)}k km` : '—'}</td>
                          <td>{formatINR(r.marketValue)}</td>
                          <td>{formatINR(r.buyPrice)}</td>
                          <td>{formatINR(r.sellPrice)}</td>
                          <td>{formatINR(r.expectedProfit)}</td>
                          <td>{r.riskScore}/100</td>
                          <td>{r.dealQualityScore}/100</td>
                          <td><span className={`action-pill action-${String(r.action).toLowerCase().replace(' ', '-')}`}>{r.action}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cd-card">
                <div className="cd-section-label">Vehicle-wise ML Analysis</div>
                <div className="bulk-analysis-list">
                  {bulkRows.map(r => (
                    <div className="bulk-analysis-card" key={`analysis-${r.rowNumber}`}>
                      <div className="bulk-analysis-top">
                        <strong>{r.vehicle}</strong>
                        <span className={`action-pill action-${String(r.action).toLowerCase().replace(' ', '-')}`}>{r.action}</span>
                      </div>
                      <div className="bulk-analysis-grid">
                        <div><span>Market</span><b>{formatINR(r.marketValue)}</b></div>
                        <div><span>Buy</span><b>{formatINR(r.buyPrice)}</b></div>
                        <div><span>Sell</span><b>{formatINR(r.sellPrice)}</b></div>
                        <div><span>Profit</span><b>{formatINR(r.expectedProfit)}</b></div>
                        <div><span>Risk</span><b>{r.riskScore}/100</b></div>
                        <div><span>Deal Quality</span><b>{r.dealQualityScore}/100</b></div>
                      </div>
                      <p className="bulk-analysis-note">
                        {r.positiveFactors?.[0] || 'CatBoost ML market value prediction used.'}
                        {r.negativeFactors?.[0] ? ` Risk note: ${r.negativeFactors[0]}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div className="cd-card">
            <div className="cd-card-head">
              <div className="card-icon-circle orange">
                <Icon name="camera" size={16} color="#f75d34" strokeWidth={2} />
              </div>
              <div>
                <div className="cd-card-title">Vehicle Photos</div>
                <div className="cd-card-sub">Optional photo upload for future CV inspection; current evaluation uses manual condition</div>
              </div>
            </div>

            <div
              className={`upload-zone ${isDragOver ? 'dragover' : ''} ${uploadedImage ? 'uploaded' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('photo-input').click()}
            >
              <input id="photo-input" type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileInput} />
              {uploadedImage ? (
                <div className="upload-preview">
                  <img src={uploadedImage.url} alt="Uploaded vehicle" className="preview-img" />
                  <div className="preview-meta">
                    <div className="preview-name">{uploadedImage.name}</div>
                    <div className="preview-change">Tap to replace</div>
                  </div>
                </div>
              ) : (
                <div className="upload-empty">
                  <div className="upload-icon-circle">
                    <Icon name="upload" size={28} color="#f75d34" strokeWidth={1.8} />
                  </div>
                  <div className="upload-title">Add Vehicle Photos</div>
                  <div className="upload-desc">Front, side, rear views · JPG/PNG up to 10MB</div>
                  <div className="upload-cta">Browse Photos</div>
                </div>
              )}
            </div>

            <div className="upload-tips">
              <div className="upload-tip">
                <Icon name="check" size={13} color="#00a651" strokeWidth={2.2} />
                Computer vision condition analysis is on hold for this final prototype
              </div>
              <div className="upload-tip">
                <Icon name="check" size={13} color="#00a651" strokeWidth={2.2} />
                Manual condition field is currently used for CatBoost valuation and risk scoring
              </div>
            </div>
          </div>

          <div className="step-back-row">
            <button className="cd-btn-outline" onClick={() => setStep(1)}>
              <Icon name="arrowLeft" size={16} color="#f75d34" strokeWidth={2} />
              Back
            </button>
            <button className="cd-btn-orange" onClick={handleSubmit} disabled={!isFormValid}>
              <Icon name="sparkle" size={16} color="white" strokeWidth={1.8} />
              Get AI Valuation
            </button>
          </div>
        </>
      )}
    </div>
  );
}
