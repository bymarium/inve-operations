// Utilidades compartidas por las pantallas: formato, lectura de campos y gráficas SVG.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function fmt(v, d = 4) {
  if (v === Infinity) return '∞';
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  const r = Math.abs(v) < 1e-10 ? 0 : v;
  return r.toLocaleString('es-CO', { maximumFractionDigits: d });
}

// Acepta "0,5" o "0.5". Marca el campo como inválido si no es número.
export function num(input) {
  const raw = input.value.trim().replace(',', '.');
  const v = raw === '' ? NaN : Number(raw);
  input.classList.toggle('invalid', !Number.isFinite(v));
  return v;
}

export const debounce = (fn, ms = 150) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export const color = (i) => `var(--s${(i % 8) + 1})`;

export const errorBox = (e) => `<div class="error" role="alert">${esc(e.message ?? e)}</div>`;

// Ejes "bonitos": paso 1, 2 o 5 × 10^k
export function ticks(min, max, count = 6) {
  const span = max - min || 1;
  const raw = span / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

// Gráfica de líneas. series: [{ name, values, color }], x = índice (o xs si se da).
export function lineChart({ series, xs, xLabel = '', yLabel = '', yMin, yMax, highlightX }) {
  const W = 640, H = 300, L = 52, R = 16, T = 14, B = 40;
  const n = series[0].values.length;
  const X = xs ?? series[0].values.map((_, i) => i);
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const lo = yMin ?? Math.min(0, ...all), hi = yMax ?? (Math.max(...all) * 1.08 || 1);
  const x0 = X[0], x1 = X[n - 1] === x0 ? x0 + 1 : X[n - 1];
  const sx = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const yt = ticks(lo, hi, 5), xt = n > 12 ? ticks(x0, x1, 8) : X;
  const svg = [`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)} vs ${esc(xLabel)}">`];
  yt.forEach((v) => svg.push(`<line class="gridline" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${fmt(v, 3)}</text>`));
  xt.forEach((v) => svg.push(`<text x="${sx(v)}" y="${H - B + 16}" text-anchor="middle">${fmt(v, 2)}</text>`));
  svg.push(`<line class="axis" x1="${L}" x2="${W - R}" y1="${sy(lo)}" y2="${sy(lo)}"/><line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>`);
  if (highlightX !== undefined) svg.push(`<line x1="${sx(highlightX)}" x2="${sx(highlightX)}" y1="${T}" y2="${H - B}" stroke="var(--good)" stroke-dasharray="4 4" stroke-width="1.5"/>`);
  series.forEach((s) => {
    const pts = s.values.map((v, i) => (Number.isFinite(v) ? `${sx(X[i])},${sy(v)}` : null)).filter(Boolean);
    svg.push(`<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" points="${pts.join(' ')}"/>`);
    if (n <= 30) s.values.forEach((v, i) => Number.isFinite(v) && svg.push(`<circle cx="${sx(X[i])}" cy="${sy(v)}" r="3.5" fill="${s.color}"><title>${esc(s.name)} (${fmt(X[i])}): ${fmt(v)}</title></circle>`));
  });
  svg.push(`<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${esc(xLabel)}</text>`);
  svg.push(`<text transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text></svg>`);
  return svg.join('') + legend(series);
}

export const legend = (series) =>
  `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;

// Barras horizontales. items: [{ label, value, color }]
export function bars(items, { max, digits = 4 } = {}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1e-12);
  return `<div class="bars">${items.map((it, k) => `
    <div class="bar"><span>${esc(it.label)}</span>
      <div class="track"><div class="fill" style="width:${Math.max(0, (it.value / top) * 100)}%;background:${it.color ?? color(k)}"></div></div>
      <b>${fmt(it.value, digits)}</b></div>`).join('')}</div>`;
}

// Tabla simple a partir de encabezados y filas (strings ya escapados o números).
export function table(head, rows, { hl = () => false } = {}) {
  return `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r, i) => `<tr${hl(i) ? ' class="hl"' : ''}>${r.map((c) => `<td>${typeof c === 'number' ? fmt(c) : c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}
