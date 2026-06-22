import { formatINR } from '../utils/format.js';

export function NegotiationPlaybook({ negotiation, variant = 'enhanced' }) {
  const opening = variant === 'reverse' ? negotiation?.opening : negotiation?.opening_offer;
  const target = variant === 'reverse' ? negotiation?.target : negotiation?.target_offer;
  const walkAway = variant === 'reverse' ? negotiation?.walk_away : negotiation?.walk_away_price;

  return (
    <div className="negotiation-playbook">
      <div className="cd-section-label">Negotiation Playbook</div>
      <div className="negotiation-trio">
        <div className="negotiation-card opening">
          <div className="trio-label">Open at</div>
          <div className="trio-price">{formatINR(opening)}</div>
        </div>
        <div className="negotiation-card target">
          <div className="trio-label">Target close</div>
          <div className="trio-price">{formatINR(target)}</div>
        </div>
        <div className="negotiation-card walk-away">
          <div className="trio-label">Walk away</div>
          <div className="trio-price">{formatINR(walkAway)}</div>
        </div>
      </div>
    </div>
  );
}

export function ExpandableBreakdownTable({ title, rows, totalLabel, totalValue }) {
  return (
    <details className="expand-breakdown">
      <summary>{title}</summary>
      <div className="breakdown-table-wrap">
        <table className="breakdown-table">
          <thead>
            <tr>
              {Object.keys(rows[0] || {}).map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {Object.values(row).map((v, j) => (
                  <td key={j}>{typeof v === 'number' ? formatINR(v) : v}</td>
                ))}
              </tr>
            ))}
            {totalLabel && (
              <tr className="breakdown-total-row">
                <td colSpan={Math.max(1, Object.keys(rows[0] || {}).length - 1)}><strong>{totalLabel}</strong></td>
                <td><strong>{formatINR(totalValue)}</strong></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function DealHealthBanner({ dealHealth, meta }) {
  const info = meta[dealHealth] || meta.yellow;
  return (
    <div className={`deal-health-banner deal-health-${dealHealth}`}>
      <div className="deal-health-badge">{dealHealth?.toUpperCase()}</div>
      <div>
        <div className="deal-health-title">{info.title}</div>
        <div className="deal-health-reason">{info.reason}</div>
      </div>
    </div>
  );
}
