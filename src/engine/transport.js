// Problema de transporte: solución inicial por Esquina Noroeste, Costo Mínimo y Vogel.
// supply: [s1..sm], demand: [d1..dn], costs: matriz m×n

function balance({ supply, demand, costs }) {
  const m = supply.length, n = demand.length;
  if (!m || !n) throw new Error('Se requiere al menos una oferta y una demanda.');
  if (costs.length !== m || costs.some((r) => r.length !== n)) throw new Error(`La matriz de costos debe ser ${m}×${n}.`);
  const nums = [...supply, ...demand, ...costs.flat()];
  if (nums.some((v) => typeof v !== 'number' || !Number.isFinite(v))) throw new Error('Todos los valores deben ser numéricos.');
  if ([...supply, ...demand].some((v) => v < 0)) throw new Error('Oferta y demanda no pueden ser negativas.');

  const S = supply.reduce((a, b) => a + b, 0), D = demand.reduce((a, b) => a + b, 0);
  const p = { supply: [...supply], demand: [...demand], costs: costs.map((r) => [...r]), dummy: null };
  if (S > D) {
    p.demand.push(S - D);
    p.costs.forEach((r) => r.push(0));
    p.dummy = { type: 'column', index: n, amount: S - D };
  } else if (D > S) {
    p.supply.push(D - S);
    p.costs.push(Array(n).fill(0));
    p.dummy = { type: 'row', index: m, amount: D - S };
  }
  return p;
}

// Ejecuta el método: `pick(state)` devuelve la celda [i, j] a asignar.
function run(problem, pick) {
  const s = [...problem.supply], d = [...problem.demand];
  const m = s.length, n = d.length;
  const alloc = Array.from({ length: m }, () => Array(n).fill(0));
  const rowDone = Array(m).fill(false), colDone = Array(n).fill(false);
  const steps = [];

  while (rowDone.includes(false) && colDone.includes(false)) {
    const { cell: [i, j], note } = pick({ s, d, rowDone, colDone, costs: problem.costs });
    const q = Math.min(s[i], d[j]);
    alloc[i][j] += q;
    s[i] -= q;
    d[j] -= q;
    steps.push({ row: i, col: j, qty: q, cost: problem.costs[i][j], note });
    if (s[i] === 0) rowDone[i] = true;
    if (d[j] === 0) colDone[j] = true;
  }

  const total = alloc.reduce((t, r, i) => t + r.reduce((u, q, j) => u + q * problem.costs[i][j], 0), 0);
  return { allocation: alloc, totalCost: total, steps };
}

const active = (done) => done.flatMap((x, k) => (x ? [] : [k]));

const northwest = ({ rowDone, colDone }) => ({
  cell: [rowDone.indexOf(false), colDone.indexOf(false)],
  note: 'Celda superior izquierda disponible',
});

const minCost = ({ s, d, rowDone, colDone, costs }) => {
  let best = null;
  for (const i of active(rowDone))
    for (const j of active(colDone)) {
      const c = costs[i][j], q = Math.min(s[i], d[j]);
      // Empate en costo: la celda que permite asignar más.
      if (!best || c < best.c || (c === best.c && q > best.q)) best = { c, q, cell: [i, j] };
    }
  return { cell: best.cell, note: `Menor costo disponible (${best.c})` };
};

const penalty = (vals) => {
  const [a, b] = [...vals].sort((x, y) => x - y);
  return b === undefined ? a : b - a;
};

const vogel = ({ s, d, rowDone, colDone, costs }) => {
  const rows = active(rowDone), cols = active(colDone);
  const lines = [
    ...rows.map((i) => ({ kind: 'fila', k: i, cells: cols.map((j) => [i, j]) })),
    ...cols.map((j) => ({ kind: 'columna', k: j, cells: rows.map((i) => [i, j]) })),
  ].map((l) => {
    const cs = l.cells.map(([i, j]) => costs[i][j]);
    return { ...l, pen: penalty(cs), min: Math.min(...cs) };
  });
  // Mayor penalización; empate → menor costo mínimo en la línea.
  const line = lines.reduce((b, l) => (l.pen > b.pen || (l.pen === b.pen && l.min < b.min) ? l : b));
  const cell = line.cells.reduce((b, c) => {
    const cb = costs[b[0]][b[1]], cc = costs[c[0]][c[1]];
    return cc < cb || (cc === cb && Math.min(s[c[0]], d[c[1]]) > Math.min(s[b[0]], d[b[1]])) ? c : b;
  });
  return {
    cell,
    note: `Mayor penalización ${line.pen} en ${line.kind} ${line.k + 1}`,
    penalties: lines.map(({ kind, k, pen }) => ({ kind, k, pen })),
  };
};

export const METHODS = { northwest, minCost, vogel };
export const METHOD_NAMES = { northwest: 'Esquina Noroeste', minCost: 'Costo Mínimo', vogel: 'Aproximación de Vogel' };

export function solveTransport(input) {
  const problem = balance(input);
  const results = Object.fromEntries(Object.entries(METHODS).map(([k, pick]) => [k, { name: METHOD_NAMES[k], ...run(problem, pick) }]));
  const best = Object.keys(results).reduce((b, k) => (results[k].totalCost < results[b].totalCost ? k : b));
  return { problem, results, best };
}
