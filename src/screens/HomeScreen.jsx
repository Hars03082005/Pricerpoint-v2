import { useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatINR } from '../utils/mockData.js';
import Icon from '../components/Icon.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const PULSE_COLORS = ['#f75d34', '#007be5', '#00a651', '#f7941d', '#9b59b6', '#16a085', '#e67e22', '#2c7be5'];

function HomeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tip"><div className="chart-tip-label">{label}</div>{payload.map((p,i)=><div key={i}>{p.name}: <strong>{p.value}L</strong></div>)}</div>;
}

function EmptyHome({ setActiveScreen }) {
  return (
    <div className="cd-card home-empty-card">
      <div className="home-risk-icon"><Icon name="car" size={20} color="#f75d34" /></div>
      <div>
        <h3>No evaluations yet</h3>
        <p>Run a single vehicle valuation or upload a bulk CSV. Your Home and Analytics dashboards will update automatically from those ML evaluations.</p>
        <button className="cd-btn-orange" onClick={() => setActiveScreen('input')}>Start ML Evaluation</button>
      </div>
    </div>
  );
}

export default function HomeScreen() {
  const { setActiveScreen, evaluations } = useApp();

  const data = useMemo(() => {
    const records = [...evaluations];
    const topOpportunities = records
      .filter(v => v.marketValue > 0)
      .sort((a,b) => (b.dealQualityScore || 0) - (a.dealQualityScore || 0))
      .slice(0, 5);

    const brandAgg = {};
    records.forEach(v => {
      if (!v.brand || !v.marketValue) return;
      brandAgg[v.brand] ||= { brand: v.brand, total: 0, count: 0 };
      brandAgg[v.brand].total += Number(v.marketValue || 0);
      brandAgg[v.brand].count += 1;
    });
    const marketPulse = Object.values(brandAgg)
      .map(b => ({ brand: b.brand, avgResaleL: +(b.total / b.count / 100000).toFixed(1) }))
      .sort((a,b) => a.avgResaleL - b.avgResaleL);

    const projectedProfit = records.reduce((s,v) => s + Number(v.expectedProfit || 0), 0);
    const pipeline = records.reduce((s,v) => s + Number(v.marketValue || 0), 0);
    return {
      topOpportunities,
      marketPulse,
      riskAlerts: records.filter(v => Number(v.riskScore || 0) >= 65),
      recent: records.slice(0, 8),
      kpis: {
        evaluations: records.length,
        buy: records.filter(v => v.action === 'BUY').length,
        avgProfit: records.length ? Math.round(projectedProfit / records.length) : 0,
        pipelineL: +(pipeline / 100000).toFixed(1),
      }
    };
  }, [evaluations]);

  return (
    <div className="screen home-screen">
      <div className="home-hero-card">
        <div className="home-hero-content">
          <div className="car-hero-badge">LIVE ML WORKSPACE</div>
          <h1 className="home-title">PricerPoint</h1>
          <p className="home-subtitle">Every evaluation you run now updates this dashboard automatically.</p>
          <div className="home-hero-actions">
            <button className="cd-btn-orange" onClick={() => setActiveScreen('input')}>
              <Icon name="car" size={15} color="white" strokeWidth={2} />
              New Valuation
            </button>
            <button className="cd-btn-outline" onClick={() => setActiveScreen('dashboard')}>
              <Icon name="chart" size={15} color="#f75d34" strokeWidth={2} />
              View Analytics
            </button>
          </div>
        </div>
        <div className="home-live-pill">CatBoost ML</div>
      </div>

      <div className="home-kpi-grid-light">
        <div className="home-kpi-light"><div className="home-kpi-light-head"><span>Total Evaluations</span><Icon name="clipboard" size={15} color="#007be5" /></div><strong>{data.kpis.evaluations}</strong><small>Single + bulk</small></div>
        <div className="home-kpi-light"><div className="home-kpi-light-head"><span>BUY Recommendations</span><Icon name="shield" size={15} color="#00a651" /></div><strong>{data.kpis.buy}</strong><small>ML + decision engine</small></div>
        <div className="home-kpi-light"><div className="home-kpi-light-head"><span>Avg Profit</span><Icon name="coins" size={15} color="#f75d34" /></div><strong>{formatINR(data.kpis.avgProfit)}</strong><small>From evaluated cars</small></div>
        <div className="home-kpi-light"><div className="home-kpi-light-head"><span>Pipeline</span><Icon name="lightning" size={15} color="#f7941d" /></div><strong>₹{data.kpis.pipelineL}L</strong><small>Active ML valuations</small></div>
      </div>

      {evaluations.length === 0 ? <EmptyHome setActiveScreen={setActiveScreen} /> : (
        <>
          <div className="home-charts-row">
            <div className="cd-card home-pulse-card">
              <div className="cd-section-label"><Icon name="trendUp" size={13} color="#888" /> Market Pulse <span className="home-chart-caption">Avg ML Market Value (₹L)</span></div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.marketPulse} layout="vertical" margin={{ top:5,right:15,left:-10,bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                  <XAxis type="number" tick={{ fill:'#888',fontSize:10 }}/>
                  <YAxis dataKey="brand" type="category" tick={{ fill:'#444',fontSize:10 }} width={75}/>
                  <Tooltip content={<HomeTooltip/>}/>
                  <Bar dataKey="avgResaleL" name="Avg Market Value" radius={[0,6,6,0]}>{data.marketPulse.map((e,i)=><Cell key={e.brand} fill={PULSE_COLORS[i%PULSE_COLORS.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="home-alerts-col">
              <div className="cd-card home-risk-card">
                <div className="home-risk-left"><div className="home-risk-icon"><Icon name="warning" size={18} color="#f7941d" /></div><div><div className="home-risk-title">Risk Alerts Active</div><div className="home-risk-sub">{data.riskAlerts.length} evaluated vehicles flagged — Risk ≥ 65</div></div></div>
                <button className="cd-btn-outline home-small-btn" onClick={() => setActiveScreen('dashboard')}>Inspect</button>
              </div>
              {data.riskAlerts.slice(0, 4).map(v => (
                <div className="cd-card home-alert-item" key={v.id}>
                  <div className="home-alert-name">{v.brand} {v.model}</div>
                  <div className="home-alert-meta">{v.year} · Risk {v.riskScore}/100</div>
                </div>
              ))}
            </div>
          </div>

          <div className="home-opportunity-head"><h3>Top Opportunities</h3><button onClick={() => setActiveScreen('input')}>Evaluate more</button></div>
          <div className="cd-card home-opportunity-table-wrap">
            <table className="home-opportunity-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Year</th>
                  <th>Fuel</th>
                  <th>Odometer</th>
                  <th>Source</th>
                  <th>Market Value</th>
                  <th>Action</th>
                  <th>Deal Quality</th>
                </tr>
              </thead>
              <tbody>
                {data.topOpportunities.map(v => (
                  <tr key={v.id}>
                    <td className="home-opp-vehicle">{v.brand} {v.model}</td>
                    <td>{v.year}</td>
                    <td>{v.fuel}</td>
                    <td>{(Number(v.kmDriven || 0)/1000).toFixed(0)}k km</td>
                    <td>{v.source}</td>
                    <td className="home-opp-price">{formatINR(v.marketValue)}</td>
                    <td><span className={`home-action-pill ${String(v.action).toLowerCase()}`}>{v.action}</span></td>
                    <td>{v.dealQualityScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
