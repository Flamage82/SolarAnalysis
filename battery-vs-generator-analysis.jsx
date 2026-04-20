import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart, Bar
} from "recharts";

const DEFAULT = {
  dailyConsumption: 22,
  batteryPrice: 2299,
  generatorPrice: 2500,
  fuelPricePerLitre: 2.10,
  genEfficiency: 1.6,
  monthsToModel: 12,
  cloudyDayPct: 25,
  numPanels: 8,
};

const PANEL_WATTAGE = 440; // Jinko 440W

// SE QLD average daily solar yield by month (kWh) — baseline per kW of array
// Derived from: 8 panels × 440W = 3.52kW producing [23,22,20,...] kWh
// So per-kW figures are approximately:
const SOLAR_PER_KW_BY_MONTH = [6.53, 6.25, 5.68, 4.83, 3.98, 3.69, 3.69, 4.26, 5.11, 5.68, 6.25, 6.53];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function simulate(params) {
  const {
    dailyConsumption, batteryPrice, generatorPrice,
    fuelPricePerLitre, genEfficiency, monthsToModel, cloudyDayPct, numPanels
  } = params;

  const arrayKw = (numPanels * PANEL_WATTAGE) / 1000;

  const usable2Batt = 8.0;
  const usable1Batt = 4.0;
  const startMonth = new Date().getMonth(); // current month index

  let cumCost2Batt = batteryPrice * 2;
  let cumCost1Batt = batteryPrice + generatorPrice;

  const data = [];
  const monthlyDetail = [];
  let totalGenHours1 = 0, totalGenHours2 = 0;
  let totalFuel1 = 0, totalFuel2 = 0;

  data.push({
    month: "Start",
    twoBatt: Math.round(cumCost2Batt),
    oneBatt: Math.round(cumCost1Batt),
    saving: Math.round(cumCost2Batt - cumCost1Batt),
  });

  for (let m = 0; m < monthsToModel; m++) {
    const mi = (startMonth + m) % 12;
    const days = DAYS_IN_MONTH[mi];
    const avgSolar = SOLAR_PER_KW_BY_MONTH[mi] * arrayKw;

    let genKwh2Batt = 0;
    let genKwh1Batt = 0;

    for (let d = 0; d < days; d++) {
      const isCloudy = (d % Math.round(100 / cloudyDayPct)) === 0;
      const solarToday = isCloudy ? avgSolar * 0.35 : avgSolar * 1.05;

      const deficit = Math.max(0, dailyConsumption - solarToday);

      const gen2 = Math.max(0, deficit - usable2Batt);
      const gen1 = Math.max(0, deficit - usable1Batt);

      genKwh2Batt += gen2;
      genKwh1Batt += gen1;
    }

    const fuelL2 = genKwh2Batt / genEfficiency;
    const fuelL1 = genKwh1Batt / genEfficiency;
    const fuelCost2 = fuelL2 * fuelPricePerLitre;
    const fuelCost1 = fuelL1 * fuelPricePerLitre;

    cumCost2Batt += fuelCost2;
    cumCost1Batt += fuelCost1;

    totalFuel1 += fuelL1;
    totalFuel2 += fuelL2;
    totalGenHours1 += genKwh1Batt / 1.8;
    totalGenHours2 += genKwh2Batt / 1.8;

    const label = `${MONTH_NAMES[mi]} (M${m + 1})`;
    data.push({
      month: label,
      twoBatt: Math.round(cumCost2Batt),
      oneBatt: Math.round(cumCost1Batt),
      saving: Math.round(cumCost2Batt - cumCost1Batt),
      genHrs1: Math.round(genKwh1Batt / 1.8),
      genHrs2: Math.round(genKwh2Batt / 1.8),
      fuelCost1: Math.round(fuelCost1),
      fuelCost2: Math.round(fuelCost2),
    });

    monthlyDetail.push({
      month: MONTH_NAMES[mi],
      genHours1Batt: Math.round(genKwh1Batt / 1.8),
      genHours2Batt: Math.round(genKwh2Batt / 1.8),
      fuelLitres1: Math.round(fuelL1),
      fuelLitres2: Math.round(fuelL2),
    });
  }

  const breakeven = data.findIndex((d, i) => i > 0 && d.saving <= 0);

  return {
    data,
    monthlyDetail,
    breakeven: breakeven === -1 ? null : breakeven,
    totalGenHours1: Math.round(totalGenHours1),
    totalGenHours2: Math.round(totalGenHours2),
    totalFuel1: Math.round(totalFuel1),
    totalFuel2: Math.round(totalFuel2),
    finalCost2: Math.round(cumCost2Batt),
    finalCost1: Math.round(cumCost1Batt),
  };
}

function Slider({ label, value, onChange, min, max, step, unit, description }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", fontFamily: "monospace" }}>
          {unit === "$" ? `$${value.toLocaleString()}` : `${value}${unit}`}
        </span>
      </div>
      {description && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{description}</div>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#2563eb" }}
      />
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "white", borderRadius: 10, padding: "12px 16px",
      border: `2px solid ${color}22`, flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function BatteryAnalysis() {
  const [consumption, setConsumption] = useState(DEFAULT.dailyConsumption);
  const [batteryPrice, setBatteryPrice] = useState(DEFAULT.batteryPrice);
  const [genPrice, setGenPrice] = useState(DEFAULT.generatorPrice);
  const [fuelPrice, setFuelPrice] = useState(DEFAULT.fuelPricePerLitre);
  const [genEff, setGenEff] = useState(DEFAULT.genEfficiency);
  const [months, setMonths] = useState(DEFAULT.monthsToModel);
  const [cloudyPct, setCloudyPct] = useState(DEFAULT.cloudyDayPct);
  const [numPanels, setNumPanels] = useState(DEFAULT.numPanels);

  const arrayKw = ((numPanels * PANEL_WATTAGE) / 1000).toFixed(1);

  const result = useMemo(() => simulate({
    dailyConsumption: consumption,
    batteryPrice,
    generatorPrice: genPrice,
    fuelPricePerLitre: fuelPrice,
    genEfficiency: genEff,
    monthsToModel: months,
    cloudyDayPct: cloudyPct,
    numPanels,
  }), [consumption, batteryPrice, genPrice, fuelPrice, genEff, months, cloudyPct, numPanels]);

  const diff = result.finalCost2 - result.finalCost1;
  const breakevenMsg = result.breakeven
    ? `${result.breakeven} months`
    : diff > 0 ? `Not within ${months} months` : "Immediate (2-batt is cheaper)";

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "24px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Battery Storage vs Generator Analysis
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Calvert Property — Comparing 2 batteries (no generator) vs 1 battery + Honda EU22i generator
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard
            label="2 Batteries — Total Cost"
            value={`$${result.finalCost2.toLocaleString()}`}
            sub={`${result.totalGenHours2}h generator · ${result.totalFuel2}L fuel`}
            color="#2563eb"
          />
          <StatCard
            label="1 Battery + Generator — Total Cost"
            value={`$${result.finalCost1.toLocaleString()}`}
            sub={`${result.totalGenHours1}h generator · ${result.totalFuel1}L fuel`}
            color="#dc2626"
          />
          <StatCard
            label="Breakeven Point"
            value={breakevenMsg}
            sub={diff > 0
              ? `2-batt costs $${diff.toLocaleString()} more after ${months}mo`
              : `2-batt saves $${Math.abs(diff).toLocaleString()} after ${months}mo`}
            color="#059669"
          />
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>

          <div style={{ flex: "1 1 280px", minWidth: 280 }}>
            <div style={{
              background: "white", borderRadius: 12, padding: 20,
              border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#334155", margin: "0 0 16px", borderBottom: "2px solid #e2e8f0", paddingBottom: 8 }}>
                Assumptions
              </h3>
              <Slider label="Daily Consumption" value={consumption} onChange={setConsumption}
                min={10} max={35} step={1} unit=" kWh" description="Average household daily usage" />
              <Slider label="Solar Panels" value={numPanels} onChange={setNumPanels}
                min={4} max={16} step={1} unit={` × 440W (${arrayKw}kW)`}
                description="Jinko 440W panels — array size scales solar production" />
              <Slider label="Battery Unit Price" value={batteryPrice} onChange={setBatteryPrice}
                min={700} max={3000} step={50} unit="$" description="Per 48V 100Ah LiFePO4 battery" />
              <Slider label="Generator Price" value={genPrice} onChange={setGenPrice}
                min={1000} max={4000} step={100} unit="$" description="Honda EU22i or similar inverter gen" />
              <Slider label="Fuel Price" value={fuelPrice} onChange={setFuelPrice}
                min={1.5} max={3.0} step={0.1} unit=" $/L" description="Unleaded petrol per litre" />
              <Slider label="Generator Efficiency" value={genEff} onChange={setGenEff}
                min={1.0} max={2.5} step={0.1} unit=" kWh/L"
                description="Usable kWh stored per litre of fuel" />
              <Slider label="Cloudy Day %" value={cloudyPct} onChange={setCloudyPct}
                min={5} max={50} step={5} unit="%" description="% of days with very low solar (~35% of average)" />
              <Slider label="Months to Model" value={months} onChange={setMonths}
                min={3} max={24} step={1} unit=" mo" />
            </div>
          </div>

          <div style={{ flex: "2 1 500px", minWidth: 400 }}>
            <div style={{
              background: "white", borderRadius: 12, padding: 20,
              border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#334155", margin: "0 0 12px" }}>
                Cumulative Cost Over Time
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={result.data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v, name) => [`$${v.toLocaleString()}`, name === "twoBatt" ? "2 Batteries" : "1 Battery + Gen"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={v => v === "twoBatt" ? "2 Batteries (no gen)" : "1 Battery + Generator"}
                  />
                  <Line type="monotone" dataKey="twoBatt" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="oneBatt" stroke="#dc2626" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              background: "white", borderRadius: 12, padding: 20,
              border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#334155", margin: "0 0 12px" }}>
                Monthly Generator Hours
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={result.data.slice(1)} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v, name) => [`${v} hrs`, name === "genHrs2" ? "2 Batteries" : "1 Battery + Gen"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={v => v === "genHrs2" ? "2 Batteries" : "1 Battery + Gen"}
                  />
                  <Bar dataKey="genHrs1" fill="#dc262644" stroke="#dc2626" strokeWidth={1} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="genHrs2" fill="#2563eb44" stroke="#2563eb" strokeWidth={1} radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{
          background: "#fffbeb", borderRadius: 10, padding: 16, marginTop: 20,
          border: "1px solid #fde68a", fontSize: 12, color: "#92400e", lineHeight: 1.6,
        }}>
          <strong>Model notes:</strong> This is a simplified simulation. Solar production uses SE QLD monthly averages
          scaled to the selected array size ({numPanels} × {PANEL_WATTAGE}W = {arrayKw}kW). Cloudy days produce ~35% of average yield. The model assumes the battery bank
          is fully cycled each day (charged during sun, depleted overnight). Generator runtime assumes the
          Honda EU22i's ~1.8kW continuous output. Real-world results will vary with actual weather patterns,
          usage habits, and seasonal changes. The 2-battery scenario assumes a generator is available but
          only used when both batteries and solar can't cover demand.
        </div>
      </div>
    </div>
  );
}
