import { mms, cost, compareServers } from '../engine/queues.js';
import { esc, fmt, num, debounce, errorBox, bars, lineChart, table } from './dom.js';

const EXAMPLE = () => ({ lambda: '10', mu: '4', s: '3', cs: '20', cw: '50', basis: 'system', unit: 'hora', sMax: '8' });
const MINUTES = { hora: 60, día: 1440, minuto: 1 };

export function mount(root) {
  let st = EXAMPLE();

  root.innerHTML = `<div class="layout">
    <div class="panel glass">
      <h2>Teoría de colas · M/M/s</h2>
      <p class="lead">Llegadas Poisson (λ), servicio exponencial (μ por servidor) y s servidores en paralelo. Con s = 1 es el modelo M/M/1.</p>
      <div data-form></div>
    </div>
    <div class="stack" data-out></div>
  </div>`;
  const form = root.querySelector('[data-form]');
  const out = root.querySelector('[data-out]');

  const field = (k, label) => `<label>${label}<input data-k="${k}" value="${esc(st[k])}" inputmode="decimal"></label>`;

  function renderForm() {
    form.innerHTML = `
      <h3>Unidad de tiempo</h3>
      <select data-k="unit" aria-label="Unidad de tiempo">${['minuto', 'hora', 'día'].map((u) => `<option${st.unit === u ? ' selected' : ''}>${u}</option>`).join('')}</select>
      <h3>Parámetros del sistema</h3>
      <div class="grid3">
        ${field('lambda', `λ llegadas / ${st.unit}`)}
        ${field('mu', `μ servicios / ${st.unit}`)}
        ${field('s', 'Servidores s')}
      </div>
      <h3>Costos</h3>
      <div class="grid2">
        ${field('cs', `Cs costo por servidor / ${st.unit}`)}
        ${field('cw', `Cw costo de espera por cliente / ${st.unit}`)}
      </div>
      <label style="margin-top:10px">El costo de espera se cobra sobre
        <select data-k="basis">
          <option value="system"${st.basis === 'system' ? ' selected' : ''}>L · clientes en el sistema (cola + servicio)</option>
          <option value="queue"${st.basis === 'queue' ? ' selected' : ''}>Lq · clientes solo en la cola</option>
        </select></label>
      <div style="margin-top:10px">${field('sMax', 'Comparar hasta s =')}</div>
      <div class="actions"><button class="btn ghost" data-reset>Restablecer ejemplo</button></div>`;
  }

  function read() {
    form.querySelectorAll('[data-k]').forEach((el) => (st[el.dataset.k] = el.value));
  }

  function compute() {
    const inputs = [...form.querySelectorAll('input')];
    const v = Object.fromEntries(inputs.map((el) => [el.dataset.k, num(el)]));
    if (Object.values(v).some((x) => !Number.isFinite(x))) return (out.innerHTML = `<div class="panel glass">${errorBox('Completa los campos marcados con un número válido.')}</div>`);
    try {
      if (!Number.isInteger(v.sMax) || v.sMax < 1 || v.sMax > 100) throw new Error('"Comparar hasta s" debe ser un entero entre 1 y 100.');
      const m = mms({ lambda: v.lambda, mu: v.mu, s: v.s });
      const opts = { serverCost: v.cs, waitCost: v.cw, basis: st.basis };
      const cmp = compareServers({ lambda: v.lambda, mu: v.mu, sMax: v.sMax, ...opts });
      out.innerHTML = render(m, cost(m, opts), cmp, st);
    } catch (e) {
      out.innerHTML = `<div class="panel glass">${errorBox(e)}</div>`;
    }
  }

  const update = debounce(() => { read(); compute(); });
  form.addEventListener('input', update);
  form.addEventListener('change', (e) => {
    read();
    if (e.target.dataset.k === 'unit') renderForm(); // actualiza las etiquetas
    compute();
  });
  form.addEventListener('click', (e) => {
    if (!e.target.closest('[data-reset]')) return;
    st = EXAMPLE();
    renderForm();
    compute();
  });

  renderForm();
  compute();
}

function render(m, c, cmp, st) {
  const u = st.unit;
  const toMin = (t) => (u === 'minuto' ? '' : ` <em>≈ ${fmt(t * MINUTES[u], 2)} min</em>`);
  const money = (x) => `$ ${fmt(x, 2)}`;
  const kpi = (label, value, extra = '') => `<div class="kpi"><span>${label}</span><b>${value}</b>${extra}</div>`;

  let main;
  if (!m.stable) {
    main = `<div class="panel glass"><h2>Resultado</h2>
      <div class="headline"><span class="badge bad">Sistema inestable</span></div>
      <p class="note">ρ = λ / (s·μ) = ${fmt(m.rho)} ≥ 1: llegan más clientes de los que se pueden atender y la cola crece sin límite. Se necesitan al menos <b>${Math.floor(m.a) + 1}</b> servidores.</p></div>`;
  } else {
    const model = m.s === 1 ? 'M/M/1' : `M/M/${m.s}`;
    const N = Math.max(10, Math.ceil(m.L * 3));
    const pn = Array.from({ length: Math.min(N, 30) + 1 }, (_, k) => m.Pn(k));
    const rest = 1 - pn.reduce((a, b) => a + b, 0);
    main = `<div class="panel glass"><h2>Medidas de desempeño · ${model}</h2>
      <div class="headline"><span class="badge good">Sistema estable</span><span class="note" style="margin:0">ρ = ${fmt(m.rho)} &lt; 1</span></div>
      <div class="kpis">
        ${kpi('ρ utilización', `${fmt(m.rho * 100, 2)} %`)}
        ${kpi('P₀ sistema vacío', `${fmt(m.P0 * 100, 2)} %`)}
        ${kpi('Pw prob. de esperar', `${fmt(m.Pw * 100, 2)} %`)}
        ${kpi('L clientes en sistema', fmt(m.L))}
        ${kpi('Lq clientes en cola', fmt(m.Lq))}
        ${kpi(`W tiempo en sistema (${u}s)`, fmt(m.W), toMin(m.W))}
        ${kpi(`Wq tiempo en cola (${u}s)`, fmt(m.Wq), toMin(m.Wq))}
      </div>
      <p class="note">En promedio hay ${fmt(m.L, 2)} clientes en el sistema y cada uno espera ${fmt(m.Wq, 4)} ${u}s antes de ser atendido. Se cumple la ley de Little: L = λ·W = ${fmt(m.lambda)} × ${fmt(m.W)} = ${fmt(m.lambda * m.W)}.</p>
    </div>
    <div class="panel glass"><h2>Distribución del número de clientes Pₙ</h2>
      ${bars([...pn.map((p, k) => ({ label: `n = ${k}`, value: p, color: 'var(--s1)' })), { label: `n > ${pn.length - 1}`, value: Math.max(0, rest), color: 'var(--s8)' }])}
    </div>
    <div class="panel glass"><h2>Costo con s = ${m.s}</h2>
      <div class="kpis">
        ${kpi(`Servicio s·Cs / ${u}`, money(c.serviceCost))}
        ${kpi(`Espera ${st.basis === 'queue' ? 'Lq' : 'L'}·Cw / ${u}`, money(c.waitingCost))}
        ${kpi(`Costo total / ${u}`, money(c.total))}
      </div></div>`;
  }

  const best = cmp.rows.find((r) => r.s === cmp.best);
  const current = cmp.rows.find((r) => r.s === m.s);
  const verdict = current
    ? current.s === best.s
      ? `Los ${m.s} servidores actuales ya son la opción más económica.`
      : `Cambiar de ${m.s} a <b>${best.s}</b> servidores ahorra ${money(current.total - best.total)} por ${u}.`
    : `Con ${m.s} servidores el sistema es inestable o está fuera del rango comparado.`;

  const xs = cmp.rows.map((r) => r.s);
  return `${main}
    <div class="panel glass"><h2>Servicio vs. espera: ¿cuántos servidores?</h2>
      <div class="headline"><span class="badge good">Óptimo: s = ${best.s}</span><span class="big" style="font-size:22px">${money(best.total)} / ${u}</span></div>
      <p class="lead">Más servidores suben el costo de servicio pero bajan el de espera. ${verdict}</p>
      ${cmp.rows.length > 1 ? lineChart({
        xs,
        series: [
          { name: 'Costo de servicio', values: cmp.rows.map((r) => r.serviceCost), color: 'var(--s1)' },
          { name: 'Costo de espera', values: cmp.rows.map((r) => r.waitingCost), color: 'var(--s2)' },
          { name: 'Costo total', values: cmp.rows.map((r) => r.total), color: 'var(--s3)' },
        ],
        xLabel: 'Servidores s',
        yLabel: `$ / ${u}`,
        highlightX: best.s,
      }) : ''}
      ${table(['s', 'ρ', 'L', 'Lq', `Wq (${u}s)`, 'Servicio', 'Espera', 'Total'],
        cmp.rows.map((r) => [String(r.s), r.rho, r.L, r.Lq, r.Wq, money(r.serviceCost), money(r.waitingCost), `<b>${money(r.total)}</b>`]),
        { hl: (i) => cmp.rows[i].s === best.s })}
      <p class="note">Se comparan desde el mínimo número de servidores que hace estable el sistema (s &gt; λ/μ = ${fmt(m.a)}).</p>
    </div>`;
}
