import { solveMarkov } from '../engine/markov.js';
import { esc, fmt, num, debounce, errorBox, bars, color, lineChart, table } from './dom.js';

const EXAMPLE = () => ({
  names: ['Marca A', 'Marca B', 'Marca C'],
  P: [['0.8', '0.1', '0.1'], ['0.2', '0.7', '0.1'], ['0.1', '0.3', '0.6']],
  pi0: ['0.4', '0.3', '0.3'],
  steps: '5',
});

const MAX_STATES = 8, MAX_STEPS = 200;
const n = (s) => +String(s).replace(',', '.');

export function mount(root) {
  let st = EXAMPLE();

  root.innerHTML = `<div class="layout">
    <div class="panel glass">
      <h2>Cadenas de Markov</h2>
      <p class="lead">Cada fila de la matriz es el estado actual y cada columna el estado siguiente; cada fila debe sumar 1.</p>
      <div data-form></div>
    </div>
    <div class="stack" data-out></div>
  </div>`;
  const form = root.querySelector('[data-form]');
  const out = root.querySelector('[data-out]');

  const inp = (k, v, label, cls = '') => `<input data-k="${k}" class="${cls}" value="${esc(v)}" ${cls ? '' : 'inputmode="decimal"'} aria-label="${esc(label)}">`;

  function renderForm() {
    const k = st.names.length;
    form.innerHTML = `
      <h3>Estados</h3>
      <div class="grid2">${st.names.map((s, i) => `<label>Estado ${i + 1}${inp(`name${i}`, s, `Nombre del estado ${i + 1}`, 'name')}</label>`).join('')}</div>
      <div class="actions">
        <button class="btn" data-act="add"${k >= MAX_STATES ? ' disabled' : ''}>+ Estado</button>
        <button class="btn" data-act="del"${k <= 2 ? ' disabled' : ''}>− Estado</button>
      </div>
      <h3>Matriz de transición P</h3>
      <div class="scroll"><table class="inputs">
        <thead><tr><th>de \\ a</th>${st.names.map((s) => `<th>${esc(s)}</th>`).join('')}<th>Σ fila</th></tr></thead>
        <tbody>${st.P.map((row, i) => `<tr><th>${esc(st.names[i])}</th>${row.map((v, j) => `<td>${inp(`p${i}_${j}`, v, `Probabilidad de ${st.names[i]} a ${st.names[j]}`)}</td>`).join('')}<td data-sum="${i}"></td></tr>`).join('')}</tbody>
      </table></div>
      <h3>Vector inicial π(0)</h3>
      <div class="scroll"><table class="inputs"><tbody><tr>${st.pi0.map((v, i) => `<td><label>${esc(st.names[i])}${inp(`pi${i}`, v, `Probabilidad inicial de ${st.names[i]}`)}</label></td>`).join('')}<td data-sum="pi"></td></tr></tbody></table></div>
      <h3>Proyección</h3>
      <label>Número de pasos (períodos) n${inp('steps', st.steps, 'Número de pasos')}</label>
      <div class="actions"><button class="btn ghost" data-act="reset">Restablecer ejemplo</button></div>`;
  }

  function read() {
    const v = (k) => form.querySelector(`[data-k="${k}"]`).value;
    st.names = st.names.map((_, i) => v(`name${i}`));
    st.P = st.P.map((r, i) => r.map((_, j) => v(`p${i}_${j}`)));
    st.pi0 = st.pi0.map((_, i) => v(`pi${i}`));
    st.steps = v('steps');
  }

  // Muestra la suma de cada fila junto a la matriz mientras se escribe.
  function showSums() {
    const mark = (cell, s) => {
      const ok = Math.abs(s - 1) < 1e-6;
      cell.innerHTML = Number.isFinite(s) ? `<span class="badge ${ok ? 'good' : 'bad'}">${ok ? '✓ 1' : fmt(s)}</span>` : '';
    };
    st.P.forEach((r, i) => mark(form.querySelector(`[data-sum="${i}"]`), r.reduce((a, b) => a + n(b), 0)));
    mark(form.querySelector('[data-sum="pi"]'), st.pi0.reduce((a, b) => a + n(b), 0));
  }

  function compute() {
    showSums();
    const fields = [...form.querySelectorAll('input:not(.name)')];
    if (fields.map(num).some((x) => !Number.isFinite(x))) return (out.innerHTML = `<div class="panel glass">${errorBox('Completa los campos marcados con un número válido.')}</div>`);
    const steps = n(st.steps);
    if (!Number.isInteger(steps) || steps < 0 || steps > MAX_STEPS) return (out.innerHTML = `<div class="panel glass">${errorBox(`El número de pasos debe ser un entero entre 0 y ${MAX_STEPS}.`)}</div>`);
    try {
      out.innerHTML = render(solveMarkov({ P: st.P.map((r) => r.map(n)), pi0: st.pi0.map(n), steps }), st.names, steps);
    } catch (e) {
      out.innerHTML = `<div class="panel glass">${errorBox(e)}</div>`;
    }
  }

  const update = debounce(() => { read(); compute(); });
  form.addEventListener('input', update);
  form.addEventListener('change', (e) => { if (e.target.classList.contains('name')) { read(); renderForm(); compute(); } });
  form.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'reset') st = EXAMPLE();
    else {
      read();
      if (act === 'add') {
        const k = st.names.length;
        st.names.push(`Estado ${k + 1}`);
        st.P.forEach((r) => r.push('0'));
        st.P.push(Array.from({ length: k + 1 }, (_, j) => (j === k ? '1' : '0')));
        st.pi0.push('0');
      }
      if (act === 'del') {
        st.names.pop(); st.P.pop(); st.P.forEach((r) => r.pop()); st.pi0.pop();
      }
    }
    renderForm();
    compute();
  });

  renderForm();
  compute();
}

function render(r, names, steps) {
  const series = names.map((s, i) => ({ name: s, values: r.trajectory.map((p) => p[i]), color: color(i) }));
  const top = r.final.indexOf(Math.max(...r.final));

  const ergodic = r.ergodic
    ? `<span class="badge good">Cadena ergódica (regular)</span><p class="note">Alguna potencia de P tiene todas sus entradas positivas: a largo plazo el sistema converge al mismo estado estable sin importar dónde empiece.</p>`
    : `<span class="badge warn">Cadena no ergódica</span><p class="note">La cadena es periódica o tiene estados que no se comunican entre sí; la distribución puede no converger o depender del estado inicial.${r.steadyState ? ' El vector estacionario mostrado es solución de π = πP, pero no necesariamente el límite.' : ''}</p>`;

  const steady = r.steadyState
    ? `<div class="panel glass"><h2>Largo plazo · estado estable π</h2>
        <p class="lead">Solución de π = π·P con Σπ = 1. Es la proporción del tiempo que el sistema pasa en cada estado.</p>
        ${bars(names.map((s, i) => ({ label: s, value: r.steadyState[i], color: color(i) })), { max: 1 })}
        ${table(['Estado', 'π (estable)', `π(${steps})`, 'Diferencia', 'Tiempo medio de retorno μ = 1/π'], names.map((s, i) => [esc(s), r.steadyState[i], r.final[i], r.final[i] - r.steadyState[i], r.recurrence[i]]))}
      </div>`
    : `<div class="panel glass"><h2>Largo plazo</h2><p class="note">No existe un único estado estable (hay varias clases cerradas).</p></div>`;

  return `
    <div class="panel glass"><h2>Proyección a ${steps} ${steps === 1 ? 'paso' : 'pasos'}</h2>
      <div class="headline">${ergodic}</div>
      <p class="lead">π(${steps}) = π(0) · P<sup>${steps}</sup>. Tras ${steps} períodos el estado más probable es <b>${esc(names[top])}</b> (${fmt(r.final[top] * 100, 2)} %).</p>
      ${bars(names.map((s, i) => ({ label: s, value: r.final[i], color: color(i) })), { max: 1 })}
    </div>
    <div class="panel glass"><h2>Evolución de la distribución</h2>
      ${lineChart({ series, xLabel: 'Paso n', yLabel: 'Probabilidad', yMin: 0, yMax: 1 })}
      <details><summary>Ver la tabla paso a paso</summary>
        ${table(['n', ...names.map(esc)], r.trajectory.map((p, t) => [String(t), ...p]))}
      </details>
    </div>
    <div class="panel glass"><h2>Matriz de transición a ${steps} pasos · P<sup>${steps}</sup></h2>
      <p class="lead">Probabilidad de estar en la columna dentro de ${steps} pasos si hoy se está en la fila.</p>
      ${table(['de \\ a', ...names.map(esc)], r.Pn.map((row, i) => [`<b>${esc(names[i])}</b>`, ...row]))}
    </div>
    ${steady}`;
}
