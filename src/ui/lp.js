import { solveGraphical } from '../engine/lp.js';
import { esc, fmt, num, debounce, color, errorBox, ticks, table } from './dom.js';

const EXAMPLE = () => ({
  sense: 'max',
  c: ['3', '5'],
  cons: [
    { a: ['1', '0'], op: '<=', b: '4' },
    { a: ['0', '2'], op: '<=', b: '12' },
    { a: ['3', '2'], op: '<=', b: '18' },
  ],
  nonNeg: true,
});

const OPS = { '<=': '≤', '>=': '≥', '=': '=' };

const term = (a, v, first) => {
  if (a === 0) return '';
  const sign = a < 0 ? '− ' : first ? '' : '+ ';
  const k = Math.abs(a) === 1 ? '' : fmt(Math.abs(a));
  return `${sign}${k}${v} `;
};
export const exprText = (a1, a2) => (term(a1, 'x', true) + term(a2, 'y', a1 === 0)).trim() || '0';

export function mount(root) {
  let st = EXAMPLE();

  root.innerHTML = `<div class="layout">
    <div class="panel glass">
      <h2>Programación lineal · Método gráfico</h2>
      <p class="lead">Problemas de dos variables (x, y). Define la función objetivo y las restricciones.</p>
      <div data-form></div>
    </div>
    <div class="stack" data-out></div>
  </div>`;
  const form = root.querySelector('[data-form]');
  const out = root.querySelector('[data-out]');

  function renderForm() {
    form.innerHTML = `
      <h3>Función objetivo</h3>
      <div class="objective">
        <select data-k="sense" aria-label="Sentido">
          <option value="max"${st.sense === 'max' ? ' selected' : ''}>Max Z =</option>
          <option value="min"${st.sense === 'min' ? ' selected' : ''}>Min Z =</option>
        </select>
        <input data-k="c0" value="${esc(st.c[0])}" inputmode="decimal" aria-label="Coeficiente de x"><span>x +</span>
        <input data-k="c1" value="${esc(st.c[1])}" inputmode="decimal" aria-label="Coeficiente de y"><span>y</span>
      </div>
      <h3>Restricciones</h3>
      ${st.cons.map((c, i) => `
        <div class="constraint" data-i="${i}">
          <input data-k="a0" value="${esc(c.a[0])}" inputmode="decimal" aria-label="R${i + 1}: coeficiente de x"><span>x +</span>
          <input data-k="a1" value="${esc(c.a[1])}" inputmode="decimal" aria-label="R${i + 1}: coeficiente de y"><span>y</span>
          <select data-k="op" aria-label="R${i + 1}: tipo">${Object.entries(OPS).map(([v, t]) => `<option value="${v}"${c.op === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
          <input data-k="b" value="${esc(c.b)}" inputmode="decimal" aria-label="R${i + 1}: lado derecho">
          <button class="btn icon ghost" data-del="${i}" aria-label="Eliminar restricción ${i + 1}" title="Eliminar">×</button>
        </div>`).join('')}
      <label class="check"><input type="checkbox" data-k="nonNeg"${st.nonNeg ? ' checked' : ''}> x ≥ 0, y ≥ 0 (no negatividad)</label>
      <div class="actions">
        <button class="btn" data-add>+ Restricción</button>
        <button class="btn ghost" data-reset>Restablecer ejemplo</button>
      </div>`;
  }

  function read() {
    st.sense = form.querySelector('[data-k="sense"]').value;
    st.c = [0, 1].map((k) => form.querySelector(`[data-k="c${k}"]`).value);
    st.nonNeg = form.querySelector('[data-k="nonNeg"]').checked;
    st.cons = [...form.querySelectorAll('.constraint')].map((row) => ({
      a: [0, 1].map((k) => row.querySelector(`[data-k="a${k}"]`).value),
      op: row.querySelector('[data-k="op"]').value,
      b: row.querySelector('[data-k="b"]').value,
    }));
  }

  function compute() {
    const fields = [...form.querySelectorAll('input:not([type=checkbox])')];
    const vals = fields.map(num);
    if (vals.some((v) => !Number.isFinite(v))) return (out.innerHTML = `<div class="panel glass">${errorBox('Completa los campos marcados con un número válido.')}</div>`);
    const objective = { c: st.c.map((v) => +v.replace(',', '.')), sense: st.sense };
    const constraints = st.cons.map((c) => ({ a: c.a.map((v) => +v.replace(',', '.')), op: c.op, b: +c.b.replace(',', '.') }));
    try {
      out.innerHTML = render(solveGraphical({ objective, constraints, nonNegative: st.nonNeg }), objective, constraints, st.nonNeg);
    } catch (e) {
      out.innerHTML = `<div class="panel glass">${errorBox(e)}</div>`;
    }
  }

  const update = debounce(() => { read(); compute(); });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { read(); st.cons.push({ a: ['1', '1'], op: '<=', b: '10' }); }
    else if (e.target.closest('[data-del]')) { read(); st.cons.splice(+e.target.closest('[data-del]').dataset.del, 1); }
    else if (e.target.closest('[data-reset]')) st = EXAMPLE();
    else return;
    renderForm();
    compute();
  });

  renderForm();
  compute();
}

function render(r, objective, constraints, nonNeg) {
  const label = (c, i) => `R${i + 1}: ${exprText(c.a[0], c.a[1])} ${OPS[c.op]} ${fmt(c.b)}`;
  let head;
  if (r.status === 'infeasible') head = `<span class="badge bad">Sin solución factible</span><p class="note">Las restricciones se contradicen: no existe ningún punto que las cumpla todas.</p>`;
  else if (r.status === 'unbounded') head = `<span class="badge warn">Solución no acotada</span><p class="note">La región factible es abierta en la dirección que mejora Z: Z puede ${objective.sense === 'max' ? 'crecer' : 'decrecer'} indefinidamente.</p>`;
  else head = `
    <div class="headline">
      <span class="badge good">Solución óptima</span>
      ${r.multipleOptima ? '<span class="badge info">Óptimos múltiples</span>' : ''}
    </div>
    <div class="headline">
      <span class="big">Z* = ${fmt(r.z)}</span>
      <span class="big" style="font-size:20px">x = ${fmt(r.optimum.x)} · y = ${fmt(r.optimum.y)}</span>
    </div>
    ${r.multipleOptima ? '<p class="note">La recta de la función objetivo es paralela a un lado de la región: todos los puntos de ese lado dan el mismo Z.</p>' : ''}`;

  let analysis = '';
  if (r.status === 'optimal') {
    const p = [r.optimum.x, r.optimum.y];
    const rows = constraints.map((c, i) => {
      const lhs = c.a[0] * p[0] + c.a[1] * p[1];
      const slack = c.op === '>=' ? lhs - c.b : c.b - lhs;
      const active = Math.abs(slack) < 1e-7 * Math.max(1, Math.abs(c.b));
      return [esc(label(c, i)), lhs, Math.abs(slack) < 1e-9 ? 0 : slack, active ? '<span class="badge info">Activa</span>' : 'Con holgura'];
    });
    analysis = `<div class="panel glass"><h2>Análisis de restricciones en el óptimo</h2>
      <p class="lead">Las restricciones <b>activas</b> se cumplen con igualdad y limitan la solución; las que tienen holgura tienen recurso sobrante (≤) o excedente (≥).</p>
      ${table(['Restricción', 'Lado izq.', 'Holgura / excedente', 'Estado'], rows)}</div>`;
  }

  const opt = r.optimum;
  const vt = r.realVertices.length
    ? table(['Vértice', 'x', 'y', 'Z'], r.realVertices.map((v, i) => [String.fromCharCode(65 + (i % 26)), v.x, v.y, v.z]), {
        hl: (i) => opt && Math.hypot(r.realVertices[i].x - opt.x, r.realVertices[i].y - opt.y) < 1e-7,
      })
    : '<p class="note">La región no tiene vértices.</p>';

  return `
    <div class="panel glass"><h2>Resultado</h2>${head}</div>
    <div class="panel glass"><h2>Región factible</h2>${plot(r, objective, constraints, nonNeg, label)}</div>
    <div class="panel glass"><h2>Vértices de la región factible</h2>
      <p class="lead">El óptimo de un problema lineal siempre está en un vértice: se evalúa Z en cada uno.</p>${vt}</div>
    ${analysis}`;
}

function lineThrough({ a, b }, [x0, x1], [y0, y1]) {
  if (Math.abs(a[1]) > 1e-12) return [[x0, (b - a[0] * x0) / a[1]], [x1, (b - a[0] * x1) / a[1]]];
  return [[b / a[0], y0], [b / a[0], y1]];
}

function plot(r, objective, constraints, nonNeg, label) {
  const W = 640, H = 460, L = 48, R = 16, T = 14, B = 36;
  const xs = [0], ys = [0];
  r.realVertices.forEach((v) => { xs.push(v.x); ys.push(v.y); });
  constraints.forEach(({ a, b }) => {
    if (Math.abs(a[0]) > 1e-12) xs.push(b / a[0]);
    if (Math.abs(a[1]) > 1e-12) ys.push(b / a[1]);
  });
  const span = (arr) => {
    let lo = Math.min(...arr), hi = Math.max(...arr);
    if (nonNeg) lo = 0;
    if (hi - lo < 1e-9) hi = lo + 10;
    const pad = (hi - lo) * 0.15;
    return [nonNeg ? 0 : lo - pad, hi + pad];
  };
  const X = span(xs), Y = span(ys);
  const sx = (x) => L + ((x - X[0]) / (X[1] - X[0])) * (W - L - R);
  const sy = (y) => T + (1 - (y - Y[0]) / (Y[1] - Y[0])) * (H - T - B);
  const P = (p) => `${sx(p[0])},${sy(p[1])}`;
  const id = 'clip' + Math.random().toString(36).slice(2, 8);

  const s = [`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de la región factible">
    <defs><clipPath id="${id}"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></clipPath></defs>`];
  ticks(X[0], X[1], 8).forEach((v) => s.push(`<line class="gridline" x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${H - B}"/><text x="${sx(v)}" y="${H - B + 16}" text-anchor="middle">${fmt(v, 2)}</text>`));
  ticks(Y[0], Y[1], 7).forEach((v) => s.push(`<line class="gridline" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${fmt(v, 2)}</text>`));
  s.push(`<g clip-path="url(#${id})">`);
  if (r.region.length >= 3) s.push(`<polygon points="${r.region.map(P).join(' ')}" fill="var(--text)" fill-opacity="0.13" stroke="var(--text)" stroke-opacity="0.35"/>`);
  if (X[0] < 0) s.push(`<line class="axis" x1="${sx(0)}" x2="${sx(0)}" y1="${T}" y2="${H - B}"/>`);
  if (Y[0] < 0) s.push(`<line class="axis" x1="${L}" x2="${W - R}" y1="${sy(0)}" y2="${sy(0)}"/>`);
  constraints.forEach((c, i) => {
    const [p, q] = lineThrough(c, X, Y);
    s.push(`<line x1="${sx(p[0])}" y1="${sy(p[1])}" x2="${sx(q[0])}" y2="${sy(q[1])}" stroke="${color(i)}" stroke-width="2.2"/>`);
  });
  if (r.status === 'optimal') {
    const [p, q] = lineThrough({ a: objective.c, b: r.z }, X, Y);
    s.push(`<line x1="${sx(p[0])}" y1="${sy(p[1])}" x2="${sx(q[0])}" y2="${sy(q[1])}" stroke="var(--text)" stroke-width="1.6" stroke-dasharray="6 5" opacity=".7"/>`);
  }
  r.realVertices.forEach((v, i) => s.push(`<circle cx="${sx(v.x)}" cy="${sy(v.y)}" r="4.5" fill="var(--text)"><title>(${fmt(v.x)}, ${fmt(v.y)}) Z = ${fmt(v.z)}</title></circle>
    <text x="${sx(v.x) + 7}" y="${sy(v.y) - 7}" style="fill:var(--text);font-weight:700">${String.fromCharCode(65 + (i % 26))}</text>`));
  if (r.status === 'optimal') s.push(`<circle cx="${sx(r.optimum.x)}" cy="${sy(r.optimum.y)}" r="9" fill="none" stroke="var(--good)" stroke-width="3"/>`);
  s.push(`</g><line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/><line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>
    <text x="${W - R}" y="${H - 4}" text-anchor="end">x</text><text x="${L - 30}" y="${T + 8}">y</text></svg>`);

  const items = constraints.map((c, i) => `<span><i style="background:${color(i)}"></i>${esc(label(c, i))}</span>`);
  items.push(`<span><i style="background:var(--text);opacity:.25;height:10px"></i>Región factible</span>`);
  if (r.status === 'optimal') items.push(`<span><i style="background:var(--text);opacity:.6"></i>Z = ${fmt(r.z)} (recta objetivo en el óptimo)</span>`);
  return s.join('') + `<div class="legend">${items.join('')}</div>`;
}
