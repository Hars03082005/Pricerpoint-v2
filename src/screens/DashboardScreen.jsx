import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatINR } from '../utils/mockData.js';
import Icon from '../components/Icon.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, AreaChart, Area } from 'recharts';

const TABS = ['Market Overview', 'Brand Performance', 'Depreciation & Odometer', 'Profit Opportunities'];
const ACTION_COLORS = { BUY: '#00a651', NEGOTIATE: '#f75d34', REJECT: '#e02020', 'MANUAL REVIEW': '#888' };

function getPriceRangeOk(price, range) {
  if (range === 'Under ₹5L') return price < 500000;
  if (range === '₹5L–₹10L') return price >= 500000 && price <= 1000000;
  if (range === '₹10L–₹30L') return price >= 1000000 && price <= 3000000;
  if (range === 'Above ₹30L') return price > 3000000;
  return true;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label || payload[0]?.payload?.brand || payload[0]?.payload?.action || payload[0]?.payload?.vehicle}</div>
      {payload.map((p, i) => <div key={i}>{p.name}: <strong>{typeof p.value === 'number' && /price|profit|value/i.test(p.name) ? formatINR(p.value) : p.value}</strong></div>)}
    </div>
  );
};

function EmptyAnalytics({ setActiveScreen }) {
  return (
    <div className="cd-card home-empty-card">
      <div className="home-risk-icon"><Icon name="chart" size={20} color="#f75d34" /></div>
      <div>
        <h3>No analytics yet</h3>
        <p>Analytics is now connected to real app evaluations, not demo data. Run a valuation or upload a CSV to populate charts.</p>
        <button className="cd-btn-orange" onClick={() => setActiveScreen('input')}>Run ML Evaluation</button>
      </div>
    </div>
  );
}

export default function DashboardScreen() {
  const { evaluations, dashFilters, setDashFilters, setActiveScreen, clearEvaluations } = useApp();
  const [activeTab, setActiveTab] = useState('Market Overview');
  const upd = (k, v) => setDashFilters(p => ({ ...p, [k]: v }));

  const brands = useMemo(() => ['All', ...Array.from(new Set(evaluations.map(v => v.brand).filter(Boolean))).sort()], [evaluations]);
  const cities = useMemo(() => ['All', ...Array.from(new Set(evaluations.map(v => v.city).filter(Boolean))).sort()], [evaluations]);
  const priceRanges = ['All', 'Under ₹5L', '₹5L–₹10L', '₹10L–₹30L', 'Above ₹30L'];

  const filtered = useMemo(() => evaluations.filter(v => {
    if (dashFilters.brand !== 'All' && v.brand !== dashFilters.brand) return false;
    if (dashFilters.city !== 'All' && v.city !== dashFilters.city) return false;
    if (!getPriceRangeOk(Number(v.marketValue || 0), dashFilters.priceRange)) return false;
    return true;
  }), [evaluations, dashFilters]);

  const metrics = useMemo(() => {
    const count = filtered.length;
    const avgPrice = count ? Math.round(filtered.reduce((s,v) => s + Number(v.marketValue || 0), 0) / count) : 0;
    const avgMargin = count ? (filtered.reduce((s,v) => s + Number(v.marginPct || 0), 0) / count).toFixed(1) : '0';
    const profit = filtered.reduce((s,v) => s + Number(v.expectedProfit || 0), 0);
    return { count, avgPrice, avgMargin, profit, highRisk: filtered.filter(v => Number(v.riskScore || 0) >= 65).length, buy: filtered.filter(v => v.action === 'BUY').length };
  }, [filtered]);

  const distribution = ['Under ₹5L','₹5L–₹10L','₹10L–₹30L','Above ₹30L'].map(range => ({ range, count: filtered.filter(v => getPriceRangeOk(Number(v.marketValue || 0), range)).length }));

  const brandSummary = useMemo(() => {
    const group = {};
    filtered.forEach(v => {
      group[v.brand] ||= { brand: v.brand, total: 0, count: 0, age: 0, profit: 0 };
      group[v.brand].total += Number(v.marketValue || 0);
      group[v.brand].profit += Number(v.expectedProfit || 0);
      group[v.brand].count += 1;
      group[v.brand].age += Math.max(0, new Date().getFullYear() - Number(v.year || new Date().getFullYear()));
    });
    return Object.values(group).map(g => ({
      brand: g.brand,
      avg_price: Math.round(g.total / g.count),
      count: g.count,
      avg_age: (g.age / g.count).toFixed(1),
      total_profit: Math.round(g.profit),
    })).sort((a,b) => b.avg_price - a.avg_price);
  }, [filtered]);

  const ageCurve = useMemo(() => {
    const group = {};
    filtered.forEach(v => {
      const age = Math.max(0, new Date().getFullYear() - Number(v.year || new Date().getFullYear()));
      group[age] ||= { age, total: 0, count: 0 };
      group[age].total += Number(v.marketValue || 0);
      group[age].count += 1;
    });
    return Object.values(group).map(g => ({ age: g.age, price: Math.round(g.total / g.count) })).sort((a,b) => a.age - b.age);
  }, [filtered]);

  return (
    <div className="screen">
      <div className="section-page-head">
        <h1 className="page-head-title">Live Evaluation Analytics</h1>
        <p className="page-head-sub">Charts are generated from your single and bulk ML evaluations only.</p>
      </div>

      {evaluations.length === 0 ? <EmptyAnalytics setActiveScreen={setActiveScreen} /> : (
        <>
          <div className="dash-filter-row">
            <select className="dash-filter-select" value={dashFilters.brand} onChange={e => upd('brand', e.target.value)}>{brands.map(b => <option key={b}>{b}</option>)}</select>
            <select className="dash-filter-select" value={dashFilters.city} onChange={e => upd('city', e.target.value)}>{cities.map(c => <option key={c}>{c}</option>)}</select>
            <select className="dash-filter-select" value={dashFilters.priceRange} onChange={e => upd('priceRange', e.target.value)}>{priceRanges.map(p => <option key={p}>{p}</option>)}</select>
          </div>

          <div className="analytics-tab-row-light">{TABS.map(tab => <button key={tab} className={`analytics-tab-light ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>

          <div className="kpi-row enhanced">
            <div className="kpi-box"><div className="kpi-icon-wrap blue"><Icon name="coins" size={18} color="#007be5" /></div><div className="kpi-val">{formatINR(metrics.avgPrice)}</div><div className="kpi-name">Avg. ML Market Value</div></div>
            <div className="kpi-box"><div className="kpi-icon-wrap orange"><Icon name="trendUp" size={18} color="#f75d34" /></div><div className="kpi-val">{metrics.avgMargin}%</div><div className="kpi-name">Avg. Margin</div></div>
            <div className="kpi-box"><div className="kpi-icon-wrap green"><Icon name="car" size={18} color="#00a651" /></div><div className="kpi-val">{metrics.count}</div><div className="kpi-name">Filtered Evaluations</div></div>
            <div className="kpi-box"><div className="kpi-icon-wrap orange"><Icon name="warning" size={18} color="#f75d34" /></div><div className="kpi-val">{metrics.highRisk}</div><div className="kpi-name">High Risk</div></div>
          </div>

          {activeTab === 'Market Overview' && (
            <>
              <div className="cd-card chart-card"><div className="cd-section-label">Market Value Distribution</div><ResponsiveContainer width="100%" height={220}><BarChart data={distribution} margin={{ top:5,right:10,left:-25,bottom:0 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="range" tick={{ fill:'#888', fontSize:9 }}/><YAxis allowDecimals={false} tick={{ fill:'#888', fontSize:9 }}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey="count" name="Vehicles" fill="#7ab8ff" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
              <div className="cd-card chart-card"><div className="cd-section-label">Risk vs Market Value</div><ResponsiveContainer width="100%" height={220}><ScatterChart margin={{ top:10,right:15,left:-20,bottom:5 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis type="number" dataKey="riskScore" name="Risk" domain={[0,100]} tick={{ fill:'#888', fontSize:10 }}/><YAxis type="number" dataKey="marketValue" name="Market Price" tick={{ fill:'#888', fontSize:10 }} tickFormatter={v => `${Math.round(v/100000)}L`}/><Tooltip content={<CustomTooltip/>}/><Scatter name="Vehicles" data={filtered} fill="#f75d34"/></ScatterChart></ResponsiveContainer></div>
            </>
          )}

          {activeTab === 'Brand Performance' && (
            <>
              <div className="cd-card chart-card"><div className="cd-section-label">Average ML Market Value by Brand</div><ResponsiveContainer width="100%" height={240}><BarChart data={brandSummary} margin={{ top:5,right:10,left:-25,bottom:0 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="brand" tick={{ fill:'#888', fontSize:9 }}/><YAxis tick={{ fill:'#888', fontSize:9 }} tickFormatter={v => `${Math.round(v/100000)}L`}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey="avg_price" name="Avg Price" fill="#007be5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
              <div className="analytics-table-wrap-light"><table className="analytics-table-light"><thead><tr><th>brand</th><th>avg_price</th><th>count</th><th>avg_age</th><th>total_profit</th></tr></thead><tbody>{brandSummary.map(r => <tr key={r.brand}><td>{r.brand}</td><td>{formatINR(r.avg_price)}</td><td>{r.count}</td><td>{r.avg_age}</td><td>{formatINR(r.total_profit)}</td></tr>)}</tbody></table></div>
            </>
          )}

          {activeTab === 'Depreciation & Odometer' && (
            <>
              <div className="cd-card chart-card"><div className="cd-section-label">Age vs ML Market Value</div><ResponsiveContainer width="100%" height={220}><AreaChart data={ageCurve} margin={{ top:5,right:10,left:-25,bottom:0 }}><defs><linearGradient id="agePrice" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f75d34" stopOpacity={0.25}/><stop offset="95%" stopColor="#f75d34" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="age" tick={{ fill:'#888', fontSize:10 }}/><YAxis tick={{ fill:'#888', fontSize:9 }} tickFormatter={v => `${Math.round(v/100000)}L`}/><Tooltip content={<CustomTooltip/>}/><Area type="monotone" dataKey="price" name="Avg Price" stroke="#f75d34" fill="url(#agePrice)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
              <div className="cd-card chart-card"><div className="cd-section-label">Odometer Reading Impact</div><ResponsiveContainer width="100%" height={220}><ScatterChart margin={{ top:10,right:15,left:-20,bottom:5 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis type="number" dataKey="kmDriven" name="Odometer" tick={{ fill:'#888', fontSize:10 }} tickFormatter={v => `${Math.round(v/1000)}k`}/><YAxis type="number" dataKey="marketValue" name="Market Price" tick={{ fill:'#888', fontSize:10 }} tickFormatter={v => `${Math.round(v/100000)}L`}/><Tooltip content={<CustomTooltip/>}/><Scatter name="Vehicles" data={filtered} fill="#007be5"/></ScatterChart></ResponsiveContainer></div>
            </>
          )}

          {activeTab === 'Profit Opportunities' && (
            <>
              <div className="cd-card projected-profit-card"><div><div className="cd-section-label">Projected Profit From Filtered Evaluations</div><div className="projected-profit-val">{formatINR(metrics.profit)}</div><p>{metrics.highRisk} high-risk vehicles flagged for rejection or manual review.</p></div><div className="profit-ring">₹</div></div>
              <div className="cd-card chart-card"><div className="cd-section-label">Profit Opportunity vs Risk</div><ResponsiveContainer width="100%" height={230}><ScatterChart margin={{ top:10,right:15,left:-20,bottom:5 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis type="number" dataKey="riskScore" name="Risk" tick={{ fill:'#888', fontSize:10 }} domain={[0,100]}/><YAxis type="number" dataKey="expectedProfit" name="Profit" tick={{ fill:'#888', fontSize:10 }} tickFormatter={v => `${Math.round(v/1000)}K`}/><Tooltip content={<CustomTooltip/>}/>{['BUY','NEGOTIATE','REJECT','MANUAL REVIEW'].map(action => <Scatter key={action} name={action} data={filtered.filter(v => v.action === action)} fill={ACTION_COLORS[action]}/>)}</ScatterChart></ResponsiveContainer></div>
              <div className="analytics-table-wrap-light"><table className="analytics-table-light"><thead><tr><th>vehicle</th><th>market_value</th><th>target_buy_price</th><th>sell_price</th><th>expected_profit</th><th>risk_score</th><th>action</th></tr></thead><tbody>{[...filtered].sort((a,b)=>Number(b.expectedProfit||0)-Number(a.expectedProfit||0)).map(r => <tr key={r.id}><td>{r.year} {r.brand} {r.model}</td><td>{formatINR(r.marketValue)}</td><td>{formatINR(r.buyPrice)}</td><td>{formatINR(r.sellPrice)}</td><td>{formatINR(r.expectedProfit)}</td><td>{r.riskScore}</td><td>{r.action}</td></tr>)}</tbody></table></div>
            </>
          )}

          <button className="cd-btn-outline cd-btn-full" onClick={clearEvaluations}>Clear Evaluation History</button>
        </>
      )}
    </div>
  );
}
