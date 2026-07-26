import * as XLSX from "xlsx";
import { fmtJalali } from "./jalali";

// ---------- خروجی اکسل ----------
export function exportExcel(filename: string, sheets: { name: string; rows: any[][] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws["!cols"] = (s.rows[0] || []).map((_: any, i: number) => ({
      wch: Math.min(40, Math.max(...s.rows.map(r => String(r[i] ?? "").length + 2), 10)),
    }));
    if (!wb.Workbook) wb.Workbook = {};
    if (!wb.Workbook.Views) wb.Workbook.Views = [];
    wb.Workbook.Views[0] = { RTL: true };
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ---------- خروجی PDF (پنجره چاپ با قالب برند Different Agency) ----------
export function printPdf(title: string, subtitle: string, bodyHtml: string) {
  const w = window.open("", "_blank");
  if (!w) { alert("مرورگر پنجره چاپ را مسدود کرد."); return; }
  w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="/fonts/vazirmatn.css">
<style>
*{font-family:Vazirmatn,Tahoma,sans-serif;box-sizing:border-box}
body{margin:24px;color:#0F1A16}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #00563C;padding-bottom:12px;margin-bottom:18px}
.head h1{font-size:19px;margin:0}.head .sub{font-size:11px;color:#777;margin-top:4px}
.brand{text-align:left;font-size:10px;color:#777}
.logo{width:38px;height:38px;border-radius:10px;background:#002366;color:#fff;display:grid;place-items:center;font-weight:900;font-size:18px;margin-bottom:4px;margin-right:auto}
h2{font-size:14px;border-right:4px solid #002366;padding-right:8px;margin:20px 0 8px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}
th{background:#EEF2F1;padding:6px 8px;text-align:right;font-size:10px}
td{padding:6px 8px;border-bottom:1px solid #E3E9E7}
.num{font-weight:800}.ok{color:#00805C}.bad{color:#BE2E2E}
.kpis{display:flex;gap:10px;margin-bottom:14px}
.kpi{flex:1;border:1px solid #E3E9E7;border-radius:12px;padding:10px;text-align:center}
.kpi .l{font-size:10px;color:#777}.kpi .v{font-size:14px;font-weight:900;margin-top:4px}
.sign{display:flex;justify-content:space-around;margin-top:40px;border-top:1px solid #E3E9E7;padding-top:20px;font-size:12px;text-align:center}
pre{white-space:pre-wrap;font-size:12px;line-height:2;border:1px solid #E3E9E7;border-radius:12px;padding:14px}
.chart{border:1px solid #E3E9E7;border-radius:12px;padding:12px;margin:10px 0;page-break-inside:avoid;break-inside:avoid}
.ct{font-size:12px;font-weight:900;margin-bottom:8px;color:#0F1A16}
.lg{display:flex;flex-wrap:wrap;gap:14px;font-size:10px;color:#555;margin-top:8px;align-items:center}
.lg span{display:flex;align-items:center;gap:5px}
.lg i{width:14px;height:8px;border-radius:2px;display:inline-block}
.hb{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:10px}
.hn{width:180px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ht{flex:1;height:14px;background:#EDF1F0;border-radius:4px;overflow:hidden;display:block}
.ht b{display:block;height:100%;border-radius:4px}
.hv{width:130px;text-align:left;direction:ltr;font-weight:800}
svg{max-width:100%}
@page{size:A4;margin:12mm}
@media print{.noprint{display:none}}
</style></head><body>
<div class="head">
  <div><h1>${title}</h1><div class="sub">${subtitle}</div></div>
  <div class="brand"><div class="logo">V</div><b style="font-size:11px;color:#00563C">DIFFERENT</b><br>Different Agency<br>تاریخ: ${fmtJalali(new Date().toISOString())}</div>
</div>
${bodyHtml}
<button class="noprint" style="margin-top:20px;padding:8px 20px" onclick="print()">چاپ / ذخیره PDF</button>
<script>setTimeout(()=>window.print(),800)</script>
</body></html>`);
  w.document.close();
}

export const tbl = (headers: string[], rows: (string | number)[][]) =>
  `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.map(r => `<tr>${r.map(c => `<td>${c ?? "—"}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;

export const kpis = (items: [string, string][]) =>
  `<div class="kpis">${items.map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join("")}</div>`;

export const faN = (n: any) => (n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("fa-IR"));
export { fmtJalali as faD } from "./jalali";

/* ================================================================
   نمودارهای SVG برای خروجی PDF
   بدون وابستگی خارجی — مستقیم در پنجره چاپ رندر و پرینت می‌شوند
   ================================================================ */
export const CH = {
  primary: "#00563C", accent: "#002366", ok: "#00805C", danger: "#BE2E2E",
  ink: "#0F1A16", line: "#E3E9E7", muted: "#7A8794", grid: "#EDF1F0",
  palette: ["#00563C", "#002366", "#12A97A", "#BE2E2E", "#2F6BD8", "#0A7C63", "#5B95F2", "#7A8794"],
};

const esc = (s: any) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / p * 2) / 2 * p;
};
/** عدد کوتاه‌شده برای محور: میلیارد / میلیون */
export const shortNum = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + " میلیارد";
  if (a >= 1e6) return (v / 1e6).toLocaleString("fa-IR", { maximumFractionDigits: 0 }) + " م";
  if (a >= 1e3) return (v / 1e3).toLocaleString("fa-IR", { maximumFractionDigits: 0 }) + " هـ";
  return v.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
};
const wrap = (title: string, svg: string) =>
  `<div class="chart"><div class="ct">${esc(title)}</div>${svg}</div>`;
const legend = (items: { name: string; color: string }[]) =>
  `<div class="lg">${items.map(i => `<span><i style="background:${i.color}"></i>${esc(i.name)}</span>`).join("")}</div>`;

/** نمودار میله‌ای گروهی — مثلاً برنامه‌ای در برابر واقعی */
export function svgBars(title: string, labels: string[], series: { name: string; color: string; values: number[] }[], unit = "") {
  if (!labels.length) return "";
  const W = 760, H = 300, ml = 78, mr = 12, mt = 14, mb = 76;
  const pw = W - ml - mr, ph = H - mt - mb;
  const max = nice(Math.max(1, ...series.flatMap(s => s.values.map(v => Math.abs(v)))));
  const band = pw / labels.length, bw = Math.max(3, (band * 0.66) / series.length);
  const y = (v: number) => mt + ph - (Math.abs(v) / max) * ph;
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const yy = mt + (ph / 4) * i, val = max - (max / 4) * i;
    g += `<line x1="${ml}" y1="${yy}" x2="${W - mr}" y2="${yy}" stroke="${CH.grid}" stroke-width="1"/>
          <text x="${ml - 6}" y="${yy + 4}" font-size="9" fill="${CH.muted}" text-anchor="end">${shortNum(val)}</text>`;
  }
  let bars = "";
  labels.forEach((l, i) => {
    const x0 = ml + band * i + band * 0.17;
    series.forEach((s, j) => {
      const v = s.values[i] || 0, yy = y(v);
      bars += `<rect x="${x0 + j * bw}" y="${yy}" width="${bw - 2}" height="${Math.max(0, mt + ph - yy)}" rx="2" fill="${s.color}"/>`;
    });
    const cx = ml + band * i + band / 2;
    bars += `<text x="${cx}" y="${mt + ph + 12}" font-size="9" fill="${CH.ink}" text-anchor="end"
      transform="rotate(-35 ${cx} ${mt + ph + 12})">${esc(l.length > 26 ? l.slice(0, 25) + "…" : l)}</text>`;
  });
  return wrap(title + (unit ? ` (${unit})` : ""),
    `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}
      <line x1="${ml}" y1="${mt + ph}" x2="${W - mr}" y2="${mt + ph}" stroke="${CH.line}"/>${bars}</svg>`
    + legend(series.map(s => ({ name: s.name, color: s.color }))));
}

/** نمودار خطی — مثلاً منحنی S یا جریان نقدی */
export function svgLines(title: string, labels: string[], series: { name: string; color: string; values: number[] }[], unit = "") {
  if (labels.length < 2) return "";
  const W = 760, H = 290, ml = 78, mr = 12, mt = 14, mb = 60;
  const pw = W - ml - mr, ph = H - mt - mb;
  const max = nice(Math.max(1, ...series.flatMap(s => s.values.map(v => Math.abs(v)))));
  const x = (i: number) => ml + (pw / (labels.length - 1)) * i;
  const y = (v: number) => mt + ph - (Math.abs(v) / max) * ph;
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const yy = mt + (ph / 4) * i;
    g += `<line x1="${ml}" y1="${yy}" x2="${W - mr}" y2="${yy}" stroke="${CH.grid}"/>
          <text x="${ml - 6}" y="${yy + 4}" font-size="9" fill="${CH.muted}" text-anchor="end">${shortNum(max - (max / 4) * i)}</text>`;
  }
  const lines = series.map(s => {
    const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const dots = s.values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="${s.color}"/>`).join("");
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`;
  }).join("");
  const step = Math.ceil(labels.length / 12);
  const xl = labels.map((l, i) => i % step ? "" :
    `<text x="${x(i)}" y="${mt + ph + 14}" font-size="8.5" fill="${CH.ink}" text-anchor="middle" direction="ltr">${esc(l)}</text>`).join("");
  return wrap(title + (unit ? ` (${unit})` : ""),
    `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}
      <line x1="${ml}" y1="${mt + ph}" x2="${W - mr}" y2="${mt + ph}" stroke="${CH.line}"/>${lines}${xl}</svg>`
    + legend(series.map(s => ({ name: s.name, color: s.color }))));
}

/** نمودار دایره‌ای (دونات) با راهنما */
export function svgPie(title: string, items: { name: string; value: number }[]) {
  const data = items.filter(i => Number(i.value) > 0);
  if (!data.length) return "";
  const total = data.reduce((s, i) => s + Number(i.value), 0);
  const cx = 150, cy = 150, r = 120, ri = 62;
  let a0 = -Math.PI / 2, paths = "";
  data.forEach((it, i) => {
    const a1 = a0 + (Number(it.value) / total) * Math.PI * 2;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang: number, rr: number) => `${cx + rr * Math.cos(ang)},${cy + rr * Math.sin(ang)}`;
    paths += `<path d="M ${p(a0, r)} A ${r} ${r} 0 ${big} 1 ${p(a1, r)} L ${p(a1, ri)} A ${ri} ${ri} 0 ${big} 0 ${p(a0, ri)} Z"
      fill="${CH.palette[i % CH.palette.length]}" stroke="#fff" stroke-width="1.5"/>`;
    a0 = a1;
  });
  const lg = data.map((it, i) =>
    `<span><i style="background:${CH.palette[i % CH.palette.length]}"></i>${esc(it.name)} — ${Math.round(Number(it.value) / total * 100).toLocaleString("fa-IR")}٪</span>`).join("");
  return `<div class="chart"><div class="ct">${esc(title)}</div>
    <div style="display:flex;align-items:center;gap:16px">
      <svg viewBox="0 0 300 300" width="230" height="230">${paths}
        <text x="${cx}" y="${cy - 4}" font-size="13" fill="${CH.muted}" text-anchor="middle">جمع</text>
        <text x="${cx}" y="${cy + 16}" font-size="15" font-weight="900" fill="${CH.ink}" text-anchor="middle">${shortNum(total)}</text>
      </svg>
      <div class="lg" style="flex-direction:column;align-items:flex-start;gap:6px">${lg}</div>
    </div></div>`;
}

/** میله افقی — پارتو، مقایسه ساده */
export function svgHBars(title: string, items: { name: string; value: number; color?: string; note?: string }[]) {
  if (!items.length) return "";
  const max = Math.max(1, ...items.map(i => Math.abs(i.value)));
  const rows = items.map(i => `<div class="hb">
      <span class="hn">${esc(i.name)}</span>
      <span class="ht"><b style="width:${Math.max(1, (Math.abs(i.value) / max) * 100)}%;background:${i.color || CH.primary}"></b></span>
      <span class="hv">${i.note ?? faN(i.value)}</span></div>`).join("");
  return `<div class="chart"><div class="ct">${esc(title)}</div>${rows}</div>`;
}

/** نمودار گانت — با میله برنامه مصوب (Baseline) و درصد پیشرفت */
export function svgGantt(title: string, rows: { name: string; start?: string; end?: string; bStart?: string; bEnd?: string; progress?: number }[]) {
  const d = rows.filter(r => r.start && r.end);
  if (!d.length) return "";
  const all = d.flatMap(r => [r.start, r.end, r.bStart, r.bEnd]).filter(Boolean) as string[];
  const min = Math.min(...all.map(x => +new Date(x))), max = Math.max(...all.map(x => +new Date(x)));
  const span = Math.max(max - min, 86400000);
  const W = 760, ml = 200, mr = 12, rowH = 22, mt = 26;
  const H = mt + d.length * rowH + 12, pw = W - ml - mr;
  // در RTL محور زمان از راست به چپ پیش می‌رود
  const xr = (t: string) => ml + pw - ((+new Date(t) - min) / span) * pw;
  const now = Date.now();
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const xx = ml + (pw / 4) * i, t = new Date(max - (span / 4) * i);
    g += `<line x1="${xx}" y1="${mt - 6}" x2="${xx}" y2="${H - 8}" stroke="${CH.grid}"/>
          <text x="${xx}" y="${mt - 12}" font-size="8" fill="${CH.muted}" text-anchor="middle">${fmtJalali(t.toISOString())}</text>`;
  }
  const today = now >= min && now <= max
    ? `<line x1="${ml + pw - ((now - min) / span) * pw}" y1="${mt - 6}" x2="${ml + pw - ((now - min) / span) * pw}" y2="${H - 8}" stroke="${CH.danger}" stroke-width="1.5" stroke-dasharray="3 2"/>` : "";
  const bars = d.map((r, i) => {
    const y0 = mt + i * rowH;
    const x1 = xr(r.end!), x2 = xr(r.start!), w = Math.max(2, x2 - x1);
    const base = r.bStart && r.bEnd
      ? `<rect x="${xr(r.bEnd)}" y="${y0 + 1}" width="${Math.max(2, xr(r.bStart) - xr(r.bEnd))}" height="4" rx="2" fill="${CH.muted}" opacity=".45"/>` : "";
    const pw2 = (w * Math.min(100, r.progress || 0)) / 100;
    return `<text x="${ml - 6}" y="${y0 + 13}" font-size="9" fill="${CH.ink}" text-anchor="end">${esc(r.name.length > 30 ? r.name.slice(0, 29) + "…" : r.name)}</text>
      ${base}<rect x="${x1}" y="${y0 + 6}" width="${w}" height="10" rx="3" fill="${CH.primary}" opacity=".28"/>
      <rect x="${x2 - pw2}" y="${y0 + 6}" width="${pw2}" height="10" rx="3" fill="${CH.accent}"/>`;
  }).join("");
  return wrap(title, `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}${today}${bars}</svg>`)
    + `<div class="lg"><span><i style="background:${CH.accent}"></i>پیشرفت واقعی</span>
       <span><i style="background:${CH.primary};opacity:.28"></i>بازه برنامه</span>
       <span><i style="background:${CH.muted};opacity:.45"></i>برنامه مصوب (Baseline)</span>
       <span><i style="background:${CH.danger}"></i>امروز</span></div>`;
}
