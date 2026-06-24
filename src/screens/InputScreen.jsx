import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CITY_DEMAND, CAR_IMAGES } from '../utils/mockData.js';
import { fetchBrands, runMLValuation } from '../utils/apiValuation.js';
import SearchableSelect from '../components/SearchableSelect.jsx';
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

// ── Brand display icons (emoji abbreviations) ─────────────────────────────
const BRAND_ICONS = {
  Maruti: '🔵', Honda: '🔴', Hyundai: '🟡', Toyota: '🟢', Tata: '🟠',
  Kia: '⚪', Mahindra: '🟤', BMW: '🔵', 'Mercedes-Benz': '⚫',
  Audi: '⚫', Volkswagen: '⚪', Ford: '🔵', Renault: '🟡', Skoda: '🟢',
  Nissan: '🔴', MG: '🟠', Jeep: '🟤', Volvo: '🔵', Lexus: '⚫',
  Tesla: '🔴', Porsche: '🟡', 'Land Rover': '🟢', Jaguar: '🟤',
};

// ── Common variants per model (curated list for popular models) ───────────
const VARIANT_CATALOG = {
  // Maruti
  'Swift':         ['LXi', 'VXi', 'ZXi', 'ZXi+', 'LDi', 'VDi', 'ZDi', 'ZDi+'],
  'Baleno':        ['Sigma', 'Delta', 'Zeta', 'Alpha', 'Delta Turbo', 'Zeta Turbo', 'Alpha Turbo'],
  'Alto':          ['Std', 'LXi', 'VXi', 'LXi CNG', 'VXi CNG'],
  'WagonR':        ['LXi', 'VXi', 'ZXi', 'ZXi+', 'LXi CNG', 'VXi CNG'],
  'Vitara Brezza': ['LXi', 'VXi', 'ZXi', 'ZXi+'],
  'Grand Vitara':  ['Sigma', 'Delta', 'Zeta', 'Alpha', 'Zeta Hybrid', 'Alpha Hybrid'],
  'Ertiga':        ['LXi', 'VXi', 'ZXi', 'ZXi+', 'LDi', 'VDi', 'ZDi'],
  'Ciaz':          ['Sigma', 'Delta', 'Zeta', 'Alpha'],
  'XL6':           ['Zeta', 'Alpha'],
  // Hyundai
  'Creta':         ['E', 'EX', 'S', 'S+', 'SX', 'SX Tech', 'SX(O)'],
  'i20':           ['Era', 'Magna', 'Sportz', 'Asta', 'Asta(O)', 'N Line N6', 'N Line N8'],
  'Venue':         ['E', 'S', 'S+', 'SX', 'SX(O)', 'N Line N4', 'N Line N8'],
  'Verna':         ['EX', 'S', 'S+', 'SX', 'SX Tech', 'SX(O)'],
  'Alcazar':       ['Prestige', 'Prestige(O)', 'Platinum', 'Platinum(O)'],
  'Tucson':        ['Platinum', 'Signature'],
  'i10':           ['Era', 'Magna', 'Sportz', 'Asta'],
  // Tata
  'Nexon':         ['Smart', 'Smart+', 'Pure', 'Creative', 'Fearless', 'Fearless+'],
  'Nexon EV':      ['Medium Range', 'Long Range', 'Max', 'Max Long Range'],
  'Harrier':       ['Smart', 'Smart+', 'Pure', 'Adventure', 'Fearless', 'Fearless+', 'King Edition'],
  'Safari':        ['Smart', 'Smart+', 'Pure', 'Adventure', 'Fearless', 'Fearless+', 'Gold Edition'],
  'Punch':         ['Pure', 'Adventure', 'Accomplished', 'Creative'],
  'Altroz':        ['XE', 'XM', 'XT', 'XZ', 'XZ+'],
  'Tiago':         ['XE', 'XM', 'XT', 'XZ', 'XZ+', 'XM CNG', 'XZ CNG'],
  // Honda
  'City':          ['SV', 'V', 'VX', 'ZX', 'RS'],
  'Amaze':         ['E', 'S', 'V', 'VX'],
  'Jazz':          ['S', 'V', 'VX'],
  'WR-V':          ['S', 'V', 'VX'],
  'CR-V':          ['15W-4WD', 'Petrol CVT'],
  // Toyota
  'Fortuner':      ['2WD MT', '2WD AT', '4WD AT', 'Legender 2WD AT', 'Legender 4WD AT'],
  'Innova Crysta': ['GX MT', 'GX AT', 'VX MT', 'VX AT', 'ZX AT'],
  'Yaris':         ['J', 'V', 'VX'],
  'Urban Cruiser':  ['Mid', 'High', 'Premium'],
  'Glanza':        ['S', 'G', 'V'],
  // Mahindra
  'Scorpio':       ['S3', 'S5', 'S7', 'S9', 'S11'],
  'Scorpio N':     ['Z2', 'Z4', 'Z6', 'Z8', 'Z8 L'],
  'Thar':          ['AX Opt', 'LX Petrol MT 2WD', 'LX Diesel AT 4WD', 'LX Diesel MT 4WD'],
  'XUV700':        ['MX', 'AX3', 'AX5', 'AX7'],
  'XUV300':        ['W4', 'W6', 'W8', 'W8(O)'],
  'Bolero':        ['B2', 'B4', 'B6', 'B6(O)', 'Power+'],
  // Kia
  'Seltos':        ['HTE', 'HTK', 'HTK+', 'HTX', 'HTX+', 'GTX+'],
  'Sonet':         ['HTE', 'HTK', 'HTK+', 'HTX', 'HTX+', 'GTX+'],
  'Carens':        ['Premium', 'Prestige', 'Prestige+', 'Luxury', 'Luxury+'],
  'EV6':           ['GT Line RWD', 'GT Line AWD'],
  // Volkswagen
  'Polo':          ['Trendline', 'Comfortline', 'Highline', 'GT TSI'],
  'Vento':         ['Comfortline', 'Highline', 'Highline Plus'],
  'Taigun':        ['Trendline', 'Comfortline', 'Topline', 'GT Plus Sport'],
  // Skoda
  'Octavia':       ['Style', 'L&K'],
  'Kushaq':        ['Active', 'Ambition', 'Style', 'Monte Carlo'],
  'Slavia':        ['Active', 'Ambition', 'Style', 'Monte Carlo'],
  // Ford
  'EcoSport':      ['Ambiente', 'Trend', 'Trend+', 'Titanium', 'Titanium+', 'S'],
  'Endeavour':     ['Titanium 2WD AT', 'Titanium+ 4WD AT', 'Sport AT 4WD'],
  // MG
  'Hector':        ['Style', 'Super', 'Smart', 'Sharp', 'Savvy'],
  'ZS EV':         ['Excite', 'Exclusive'],
  // BMW
  '3 Series':      ['320i Sport', '320d Sport', '330i M Sport', 'M340i xDrive'],
  '5 Series':      ['520d Luxury Line', '520d M Sport', '530d M Sport'],
  'X1':            ['sDrive20i', 'xDrive20i'],
  'X3':            ['xDrive20i', 'xDrive20d M Sport'],
  'X5':            ['xDrive40i M Sport', 'xDrive30d M Sport'],
};

function formatRegistrationNumber(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 11);
}

function getValidFuelsForModel(brand, model, year) {
  if (!model) return ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
  const brandLower = (brand || '').toLowerCase().trim();
  const modelLower = model.toLowerCase().trim();
  const yearNum = Number(year);

  // 1. Maruti 800, Alto, Nano → Petrol only
  if (modelLower === 'maruti 800' || modelLower === '800' || modelLower === 'alto' || modelLower === 'nano') {
    return ['Petrol'];
  }
  // 2. All EVs → Electric only
  const isEv = brandLower === 'tesla' ||
    modelLower.split(/[\s\-_]+/).some(w => w.startsWith('ev')) ||
    modelLower.includes('electric') || modelLower.endsWith('ev');
  if (isEv) return ['Electric'];

  // 3. Fortuner, Endeavour, Scorpio → Diesel, Petrol only
  if (modelLower === 'fortuner' || modelLower === 'endeavour' || modelLower === 'scorpio') {
    return ['Diesel', 'Petrol'];
  }
  // 4. Common hatchbacks before 2015 → Petrol, CNG only
  const hatchbacks = [
    'swift', 'baleno', 'wagonr', 'ignis', 'celerio', 's-presso', 'alto k10',
    'i10', 'i20', 'santro', 'tiago', 'altroz', 'bolt', 'indica', 'jazz',
    'glanza', 'kwid', 'micra', 'polo', 'figo', 'liva', 'etios liva', 'brio',
    'zen', 'estilo', 'zen estilo', 'ritz', 'a-star', 'beat', 'spark', 'kuv100',
  ];
  if (hatchbacks.includes(modelLower) && yearNum < 2015) return ['Petrol', 'CNG'];

  return ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
}

export default function InputScreen() {
  const {
    inputs, updateInput,
    setValuationResult, setActiveScreen, setIsLoading,
    addEvaluation,
  } = useApp();

  const [brandCatalog, setBrandCatalog] = useState({});
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError,   setBrandsError]   = useState('');
  const [valuationError, setValuationError] = useState('');

  const brandOptions = useMemo(
    () => Object.keys(brandCatalog).sort((a, b) => a.localeCompare(b)),
    [brandCatalog],
  );
  const modelOptions = useMemo(
    () => brandCatalog[inputs.brand] || [],
    [brandCatalog, inputs.brand],
  );
  // Variant options: use VARIANT_CATALOG key = model (strip brand prefix if present)
  const variantOptions = useMemo(() => {
    if (!inputs.model) return [];
    // Try exact key first, then strip brand prefix
    const direct = VARIANT_CATALOG[inputs.model];
    if (direct) return direct;
    const stripped = inputs.model.replace(new RegExp(`^${inputs.brand}\\s+`, 'i'), '');
    return VARIANT_CATALOG[stripped] || [];
  }, [inputs.brand, inputs.model]);

  const validFuels = useMemo(
    () => getValidFuelsForModel(inputs.brand, inputs.model, inputs.year),
    [inputs.brand, inputs.model, inputs.year],
  );
  const carImage = CAR_IMAGES[`${inputs.brand} ${inputs.model}`] || '/cars/placeholder.png';
  const brandIcon = BRAND_ICONS[inputs.brand] || '🚗';

  useEffect(() => {
    let active = true;
    fetchBrands()
      .then((brands) => { if (active) setBrandCatalog(brands); })
      .catch((error) => {
        console.error(error);
        if (active) setBrandsError('Could not load brand list. Start FastAPI with: uvicorn backend.main:app --reload');
      })
      .finally(() => { if (active) setBrandsLoading(false); });
    return () => { active = false; };
  }, []);

  const handleBrandChange = (brand) => {
    updateInput('brand', brand);
    const models = brandCatalog[brand] || [];
    updateInput('model', models[0] || '');
  };

  const handleRegistrationChange = (value) => {
    updateInput('vin', formatRegistrationNumber(value));
  };

  const handleSubmit = async () => {
    setValuationError('');
    setIsLoading(true);
    setValuationResult(null);
    setActiveScreen('result');
    try {
      // Pass variant as suffix to model for more accurate ML lookup
      const payload = {
        ...inputs,
        model: inputs.variant ? `${inputs.model} ${inputs.variant}` : inputs.model,
      };
      const result = await runMLValuation(payload);
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

  const isFormValid = inputs.brand && inputs.model && inputs.year && inputs.mileage && !brandsLoading;

  return (
    <div className="screen">
      <div className="car-hero-banner">
        <div className="car-hero-info">
          <div className="car-hero-badge">
            <Icon name="tag" size={10} color="white" strokeWidth={2} />
            Dealer Quote Engine
          </div>
          <h1 className="car-hero-title">
            {inputs.year} {inputs.model}
            {inputs.variant && <span className="car-hero-variant"> · {inputs.variant}</span>}
          </h1>
          <p className="car-hero-sub">{inputs.fuel} · {inputs.transmission} · {inputs.city}</p>
        </div>
        <div className="car-hero-img-wrap">
          <img key={carImage} src={carImage} alt={`${inputs.brand} ${inputs.model}`} className="car-hero-img" />
        </div>
      </div>

      {valuationError && (
        <div className="vin-error" style={{ marginBottom: 12 }}>
          <Icon name="warning" size={14} color="#e02020" strokeWidth={2} /> {valuationError}
        </div>
      )}
      {brandsError && (
        <div className="vin-error" style={{ marginBottom: 12 }}>
          <Icon name="warning" size={14} color="#e02020" strokeWidth={2} /> {brandsError}
        </div>
      )}

      <div className="valuation-desktop-layout">
        <div className="valuation-col-left">
          <div className="cd-card valuation-picker-card">
            <div className="cd-section-label">
              <Icon name="search" size={13} color="#f75d34" strokeWidth={2} />
              Select Vehicle
            </div>

            <div className="vehicle-select-stack">
              {/* ── Brand ───────────────────────────────────── */}
              <SearchableSelect
                label="Brand"
                icon={brandIcon}
                sublabel={brandOptions.length > 0 ? `${brandOptions.length} brands` : ''}
                value={inputs.brand}
                options={brandOptions}
                placeholder={brandsLoading ? 'Loading brands…' : 'Search brand…'}
                disabled={brandsLoading || brandOptions.length === 0}
                onChange={handleBrandChange}
              />

              {/* ── Model ───────────────────────────────────── */}
              <SearchableSelect
                label="Model"
                sublabel={modelOptions.length > 0 ? `${modelOptions.length} models` : ''}
                value={inputs.model}
                options={modelOptions}
                placeholder={inputs.brand ? 'Search model…' : 'Select brand first'}
                disabled={!inputs.brand || modelOptions.length === 0}
                onChange={(model) => updateInput('model', model)}
              />

              {/* ── Variant ─────────────────────────────────── */}
              <SearchableSelect
                label="Variant"
                sublabel="Optional — improves accuracy"
                value={inputs.variant || ''}
                options={variantOptions}
                placeholder={inputs.model ? (variantOptions.length > 0 ? 'Search variant…' : 'Type variant manually') : 'Select model first'}
                disabled={!inputs.model}
                onChange={(v) => updateInput('variant', v)}
              />

              {/* Manual variant input when no catalog entries exist */}
              {inputs.model && variantOptions.length === 0 && (
                <div className="spec-field" style={{ marginTop: 4 }}>
                  <label className="spec-label">Variant (manual entry)</label>
                  <input
                    className="cd-input"
                    placeholder="e.g. VXi, ZXi+, Titanium"
                    value={inputs.variant || ''}
                    onChange={e => updateInput('variant', e.target.value)}
                  />
                </div>
              )}

              {/* Variant accuracy badge */}
              {inputs.variant && (
                <div className="variant-badge">
                  <Icon name="sparkle" size={11} color="#007be5" strokeWidth={2} />
                  Variant-specific pricing enabled
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="valuation-col-right">
          <div className="valuation-form-scroll">
            <div className="cd-card">
              <div className="cd-card-head">
                <div className="card-icon-circle blue">
                  <Icon name="clipboard" size={16} color="#007be5" strokeWidth={2} />
                </div>
                <div>
                  <div className="cd-card-title">Registration Number</div>
                  <div className="cd-card-sub">Enter reg number for reference — fill vehicle details manually below</div>
                </div>
              </div>
              <input
                className="cd-input"
                placeholder="e.g. MH02AB1234"
                value={inputs.vin || ''}
                onChange={e => handleRegistrationChange(e.target.value)}
                maxLength={11}
                autoCapitalize="characters"
                spellCheck={false}
              />
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
                    {OWNER_COUNTS.map(o => (
                      <option key={o} value={o}>
                        {o}{o === '1' ? 'st' : o === '2' ? 'nd' : o === '3' ? 'rd' : 'th'} Owner
                      </option>
                    ))}
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
                {FUELS.filter(f => validFuels.includes(f)).map(f => {
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
              {inputs.model && !validFuels.includes(inputs.fuel) && (
                <div className="vin-error" style={{ marginTop: 8 }}>
                  ⚠ {inputs.model} was not available in {inputs.fuel} variant. Please verify before proceeding.
                </div>
              )}
            </div>
          </div>

          <div className="valuation-sticky-footer">
            <button
              className={`cd-btn-orange cd-btn-full ${!isFormValid ? 'disabled' : ''}`}
              onClick={handleSubmit}
              disabled={!isFormValid}
            >
              <Icon name="sparkle" size={16} color="white" strokeWidth={1.8} />
              Get AI Valuation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
