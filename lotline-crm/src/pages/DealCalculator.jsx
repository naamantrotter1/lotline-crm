import { useState } from 'react';
import { Calculator } from 'lucide-react';

const defaultValues = {
  mobileHome: 75000,
  hudEngineer: 500,
  percTest: 2000,
  survey: 1500,
  footers: 6000,
  setup: 9000,
  water: 10000,
  septic: 7500,
  electric: 2000,
  hvac: 4500,
  underpinning: 5650,
  decks: 3500,
  driveway: 1200,
  landscaping: 2500,
  waterSewer: 1500,
  mailbox: 170,
  mobileTax: 300,
  arv: 230000,
  sellingCostPct: 4.5,
  holdingPerMonth: 250,
  holdingMonths: 4,
  desiredProfitPct: 23,
};

const costFields = [
  { key: 'mobileHome', label: 'Mobile Home' },
  { key: 'hudEngineer', label: 'HUD Engineer' },
  { key: 'percTest', label: 'Perc Test / Permit' },
  { key: 'survey', label: 'Land Survey' },
  { key: 'footers', label: 'Footers' },
  { key: 'setup', label: 'Setup' },
  { key: 'water', label: 'Water' },
  { key: 'septic', label: 'Septic' },
  { key: 'electric', label: 'Electric / Power Pole' },
  { key: 'hvac', label: 'HVAC' },
  { key: 'underpinning', label: 'Underpinning' },
  { key: 'decks', label: 'Decks Installed' },
  { key: 'driveway', label: 'Driveway' },
  { key: 'landscaping', label: 'Landscaping / Final Grading' },
  { key: 'waterSewer', label: 'Water / Sewer Hook Up' },
  { key: 'mailbox', label: 'Mailbox' },
  { key: 'mobileTax', label: 'Mobile Home Tax' },
];

function fmt(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

export default function DealCalculator() {
  const [vals, setVals] = useState(defaultValues);

  const set = (key, val) => setVals((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }));

  const buildCost = costFields.reduce((sum, f) => sum + (vals[f.key] || 0), 0);
  const sellingCosts = vals.arv * (vals.sellingCostPct / 100);
  const holdingCosts = vals.holdingMonths * vals.holdingPerMonth;
  const totalAllIn = buildCost + sellingCosts + holdingCosts;
  const projectedProfit = vals.arv - totalAllIn;
  const projectedROI = totalAllIn > 0 ? ((projectedProfit / totalAllIn) * 100).toFixed(1) : '0';
  const maxOffer = vals.arv - (buildCost - (vals.survey || 0) - (vals.footers || 0)) - sellingCosts - holdingCosts - (vals.arv * (vals.desiredProfitPct / 100));

  // Scenarios
  const scenarios = [
    {
      label: 'Cash',
      capital: buildCost,
      profit: projectedProfit,
      roi: totalAllIn > 0 ? ((projectedProfit / buildCost) * 100).toFixed(1) : '0',
    },
    {
      label: 'Hard Money',
      capital: buildCost * 0.2,
      profit: projectedProfit - (buildCost * 0.8 * 0.12 * (vals.holdingMonths / 12)),
      roi: null,
    },
    {
      label: 'HM (Land + Home)',
      capital: buildCost * 0.1,
      profit: projectedProfit - (buildCost * 0.9 * 0.12 * (vals.holdingMonths / 12)),
      roi: null,
    },
    {
      label: 'Line of Credit',
      capital: buildCost * 0.1,
      profit: projectedProfit,
      roi: null,
    },
  ].map((s) => ({
    ...s,
    roi: s.roi || (s.capital > 0 ? ((s.profit / s.capital) * 100).toFixed(1) : '0'),
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <Calculator size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Deal Calculator</h1>
          <p className="text-sm text-gray-500">Real-time deal analysis and scenario comparison</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sidebar mb-3">Cost Inputs</h3>
            <div className="space-y-2">
              {costFields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-600 flex-1">{f.label}</label>
                  <div className="relative w-32">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={vals[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="w-full pl-5 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sidebar mb-3">Deal Parameters</h3>
            <div className="space-y-2">
              {[
                { key: 'arv', label: 'Estimated ARV', prefix: '$' },
                { key: 'sellingCostPct', label: 'Selling Costs %', suffix: '%' },
                { key: 'holdingPerMonth', label: 'Holding Cost / Month', prefix: '$' },
                { key: 'holdingMonths', label: 'Est. Months to Sell', suffix: 'mo' },
                { key: 'desiredProfitPct', label: 'Desired Profit Margin %', suffix: '%' },
              ].map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-600 flex-1">{f.label}</label>
                  <div className="relative w-32">
                    {f.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{f.prefix}</span>}
                    <input
                      type="number"
                      value={vals[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={`w-full py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right ${f.prefix ? 'pl-5 pr-2' : 'pl-2 pr-6'}`}
                    />
                    {f.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{f.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <div className="bg-sidebar rounded-xl shadow-sm p-5 text-white">
            <h3 className="font-semibold mb-4 text-white/80 text-sm uppercase tracking-wide">Results</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Build Cost', value: fmt(buildCost) },
                { label: 'Selling Costs', value: fmt(sellingCosts) },
                { label: 'Holding Costs', value: fmt(holdingCosts) },
                { label: 'Total All-In Cost', value: fmt(totalAllIn), highlight: true },
                { label: 'Max Offer for Land', value: fmt(maxOffer), highlight: true, accent: true },
                { label: 'Projected Profit', value: fmt(projectedProfit), profit: true },
                { label: 'Projected ROI', value: `${projectedROI}%`, profit: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex justify-between items-center ${item.highlight ? 'pt-2 border-t border-white/20 font-semibold' : ''}`}
                >
                  <span className="text-white/70 text-sm">{item.label}</span>
                  <span className={`text-base font-bold ${item.profit ? 'text-green-400' : item.accent ? 'text-accent' : 'text-white'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario Comparison */}
          <div className="bg-card rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sidebar mb-3">Financing Scenario Comparison</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="text-left pb-2">Scenario</th>
                  <th className="text-right pb-2">Capital In</th>
                  <th className="text-right pb-2">Profit</th>
                  <th className="text-right pb-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.label} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 font-medium text-gray-700">{s.label}</td>
                    <td className="py-2 text-right text-gray-600">{fmt(s.capital)}</td>
                    <td className={`py-2 text-right font-semibold ${s.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmt(s.profit)}
                    </td>
                    <td className="py-2 text-right text-accent font-semibold">{s.roi}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-card rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sidebar mb-3">ARV Breakdown</h3>
            <div className="space-y-2">
              {[
                { label: 'ARV', value: vals.arv, pct: 100, color: 'bg-blue-400' },
                { label: 'Build Cost', value: buildCost, pct: (buildCost / vals.arv) * 100, color: 'bg-orange-400' },
                { label: 'Selling Costs', value: sellingCosts, pct: vals.sellingCostPct, color: 'bg-yellow-400' },
                { label: 'Net Profit', value: projectedProfit, pct: (projectedProfit / vals.arv) * 100, color: 'bg-green-400' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{item.label}</span>
                    <span className="font-medium">{fmt(item.value)} ({Math.round(item.pct)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full`} style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
