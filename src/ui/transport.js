import { solveTransport } from '../engine/transport.js';
import { esc, fmt, num, debounce, errorBox, bars, color } from './dom.js';

const EXAMPLE = () => ({
  rows: ['Planta 1', 'Planta 2', 'Planta 3'],
  cols: ['Cliente 1', 'Cliente 2', 'Cliente 3', 'Cliente 4'],
  supply: ['7', '9', '18'],
  demand: ['5', '8', '7', '14'],
  costs: [['19', '30', '50', '10'], ['70', '30', '40', '60'], ['40', '8', '70', '20']],
});

export function mount(root) {
  let st = EXAMPLE();

  root.innerHTML = `<div class="layout wide">
    <div class="panel glass">
      <h2>Problema de transporte</h2>
      <p class="lead">Costos unitarios de enviar desde cada origen a cada destino, con su oferta y demanda. Se resuelve con los tres métodos y se comparan.</p>
      <div data-form></div>
    </div>
    <div class="stack" data-out></div>
  </div>`;
  const form = root.querySelector('[data-form]');
  const out = root.querySelector('[data-out]');

  const inp = (k, v, label, cls = '') => `<input data-k="${k}" class="${cls}" value="${esc(v)}" ${cls ? '' : 'inputmode="decimal"'} aria-label="${esc(label)}">`;

  function renderForm() {
    form.innerHTML = `
      <h3>Matriz de costos</h3>
      <div class="scroll"><table class="inputs">
        <thead><tr><th></th>${st.cols.map((c, j) => `<th>${inp(`col${j}`, c, `Nombre destino ${j + 1}`, 'name')}</th>`).join('')}<th>Oferta</th></tr></thead>
        <tbody>
          ${st.rows.map((r, i) => `<tr><th>${inp(`row${i}`, r, `Nombre origen ${i + 1}`, 'name')}</th>
            ${st.costs[i].map((c, j) => `<td>${inp(`c${i}_${j}`, c, `Costo de ${r} a ${st.cols[j]}`)}</td>`).join('')}
            <td>${inp(`s${i}`, st.supply[i], `Oferta de ${r}`)}</td></tr>`).join('')}
          <tr><th>Demanda</th>${st.demand.map((d, j) => `<td>${inp(`d${j}`, d, `Demanda de ${st.cols[j]}`)}</td>`).join('')}<td></td></tr>
        </tbody>
      </table></div>
      <div class="actions">
        <button class="btn" data-act="addRow">+ Origen</button>
        <button class="btn" data-act="delRow"${st.rows.length < 2 ? ' disabled' : ''}>− Origen</button>
        <button class="btn" data-act="addCol">+ Destino</button>
        <button class="btn" data-act="delCol"${st.cols.length < 2 ? ' disabled' : ''}>− Destino</button>
        <button class="btn ghost" data-act="reset">Restablecer ejemplo</button>
      </div>`;
  }

  function read() {
    const v = (k) => form.querySelector(`[data-k="${k}"]`).value;
    st.rows = st.rows.map((_, i) => v(`row${i}`));
    st.cols = st.cols.map((_, j) => v(`col${j}`));
    st.supply = st.rows.map((_, i) => v(`s${i}`));
    st.demand = st.cols.map((_, j) => v(`d${j}`));
    st.costs = st.rows.map((_, i) => st.cols.map((_, j) => v(`c${i}_${j}`)));
  }

  function compute() {
    const fields = [...form.querySelectorAll('input:not(.name)')];
    if (fields.map(num).some((x) => !Number.isFinite(x))) return (out.innerHTML = `<div class="panel glass">${errorBox('Completa los campos marcados con un número válido.')}</div>`);
    const n = (s) => +s.replace(',', '.');
    try {
      out.innerHTML = render(solveTransport({ supply: st.supply.map(n), demand: st.demand.map(n), costs: st.costs.map((r) => r.map(n)) }), st);
    } catch (e) {
      out.innerHTML = `<div class="panel glass">${errorBox(e)}</div>`;
    }
  }

  const update = debounce(() => { read(); compute(); });
  form.addEventListener('input', update);
  form.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'reset') st = EXAMPLE();
    else {
      read();
      if (act === 'addRow') { st.rows.push(`Origen ${st.rows.length + 1}`); st.supply.push('0'); st.costs.push(st.cols.map(() => '0')); }
      if (act === 'delRow') { st.rows.pop(); st.supply.pop(); st.costs.pop(); }
      if (act === 'addCol') { st.cols.push(`Destino ${st.cols.length + 1}`); st.demand.push('0'); st.costs.forEach((r) => r.push('0')); }
      if (act === 'delCol') { st.cols.pop(); st.demand.pop(); st.costs.forEach((r) => r.pop()); }
    }
    renderForm();
    compute();
  });

  renderForm();
  compute();
}

function render({ problem, results, best }, st) {
  const rows = [...st.rows], cols = [...st.cols];
  if (problem.dummy?.type === 'row') rows.push('Ficticio');
  if (problem.dummy?.type === 'column') cols.push('Ficticio');
  const isDummyR = (i) => problem.dummy?.type === 'row' && i === problem.dummy.index;
  const isDummyC = (j) => problem.dummy?.type === 'column' && j === problem.dummy.index;
  const S = problem.supply.reduce((a, b) => a + b, 0);

  const balanceNote = problem.dummy
    ? `<span class="badge warn">Desbalanceado</span><p class="note">La ${problem.dummy.type === 'column' ? 'oferta supera a la demanda' : 'demanda supera a la oferta'} en ${fmt(problem.dummy.amount)} unidades. Se agregó un${problem.dummy.type === 'column' ? ' destino' : ' origen'} <b>ficticio</b> con costo 0 para balancear${problem.dummy.type === 'column' ? ' (lo asignado allí es oferta que no se envía)' : ' (lo asignado allí es demanda que queda sin atender)'}.</p>`
    : `<span class="badge good">Balanceado</span><p class="note">Oferta total = demanda total = ${fmt(S)} unidades.</p>`;

  const order = Object.keys(results);
  const ranking = bars(order.map((k, i) => ({ label: results[k].name, value: results[k].totalCost, color: k === best ? 'var(--good)' : color(i) })), { digits: 2 });
  const worst = Math.max(...order.map((k) => results[k].totalCost));
  const saving = worst - results[best].totalCost;

  const card = (k) => {
    const r = results[k];
    const used = r.allocation.flat().filter((q) => q > 0).length;
    const m = rows.length, n = cols.length;
    return `<div class="panel glass">
      <div class="card-title"><h2>${esc(r.name)}</h2>${k === best ? '<span class="badge good">Menor costo</span>' : ''}</div>
      <div class="headline"><span class="big">${fmt(r.totalCost, 2)}</span><span class="note" style="margin:0">costo total</span></div>
      <div class="scroll"><table>
        <thead><tr><th></th>${cols.map((c, j) => `<th class="${isDummyC(j) ? 'dummy' : ''}">${esc(c)}</th>`).join('')}<th>Oferta</th></tr></thead>
        <tbody>${r.allocation.map((row, i) => `<tr><td class="${isDummyR(i) ? 'dummy' : ''}"><b>${esc(rows[i])}</b></td>${row
          .map((q, j) => `<td class="${q > 0 ? 'alloc' : ''} ${isDummyR(i) || isDummyC(j) ? 'dummy' : ''}">${q > 0 ? fmt(q) : '·'}<small>c=${fmt(problem.costs[i][j])}</small></td>`)
          .join('')}<td>${fmt(problem.supply[i])}</td></tr>`).join('')}
          <tr><td><b>Demanda</b></td>${problem.demand.map((d) => `<td>${fmt(d)}</td>`).join('')}<td></td></tr>
        </tbody></table></div>
      <p class="note">Celdas básicas: ${used} de m + n − 1 = ${m + n - 1}${used < m + n - 1 ? ' (solución degenerada)' : ''}.</p>
      <details><summary>Ver el paso a paso (${r.steps.length} asignaciones)</summary>
        <ol class="steps">${r.steps.map((s) => `<li><b>${esc(rows[s.row])} → ${esc(cols[s.col])}</b>: asignar ${fmt(s.qty)} × ${fmt(s.cost)} = ${fmt(s.qty * s.cost)}. <i>${esc(s.note)}</i></li>`).join('')}</ol>
      </details>
    </div>`;
  };

  return `
    <div class="panel glass"><h2>Comparación de métodos</h2>
      <div class="headline">${balanceNote}</div>
      ${ranking}
      <p class="note">El método de <b>${esc(results[best].name)}</b> da la solución inicial más barata (${fmt(results[best].totalCost, 2)})${saving > 0 ? `, ${fmt(saving, 2)} menos que la más costosa (${fmt((saving / worst) * 100, 1)} % de ahorro)` : ''}. Esquina Noroeste ignora los costos, por eso suele ser la más cara; Vogel considera el costo de oportunidad (penalización) y normalmente queda más cerca del óptimo.</p>
    </div>
    <div class="cards">${order.map(card).join('')}</div>`;
}
