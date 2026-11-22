import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveGraphical } from '../src/engine/lp.js';
import { solveTransport } from '../src/engine/transport.js';
import { solveMarkov } from '../src/engine/markov.js';
import { mms, compareServers } from '../src/engine/queues.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('PL: Wyndor (max 3x+5y) → (2,6), Z=36', () => {
  const r = solveGraphical({
    objective: { c: [3, 5], sense: 'max' },
    constraints: [
      { a: [1, 0], op: '<=', b: 4 },
      { a: [0, 2], op: '<=', b: 12 },
      { a: [3, 2], op: '<=', b: 18 },
    ],
  });
  assert.equal(r.status, 'optimal');
  near(r.optimum.x, 2); near(r.optimum.y, 6); near(r.z, 36);
  assert.equal(r.realVertices.length, 5);
  assert.equal(r.multipleOptima, false);
});

test('PL: minimización con ≥ (región no acotada, óptimo finito)', () => {
  const r = solveGraphical({
    objective: { c: [2, 3], sense: 'min' },
    constraints: [
      { a: [1, 1], op: '>=', b: 4 },
      { a: [1, 3], op: '>=', b: 6 },
    ],
  });
  assert.equal(r.status, 'optimal');
  near(r.optimum.x, 3); near(r.optimum.y, 1); near(r.z, 9);
});

test('PL: no acotado, infactible y óptimos múltiples', () => {
  const unb = solveGraphical({ objective: { c: [1, 1], sense: 'max' }, constraints: [{ a: [1, -1], op: '<=', b: 2 }] });
  assert.equal(unb.status, 'unbounded');
  const inf = solveGraphical({ objective: { c: [1, 1], sense: 'max' }, constraints: [{ a: [1, 1], op: '<=', b: 2 }, { a: [1, 1], op: '>=', b: 5 }] });
  assert.equal(inf.status, 'infeasible');
  const mult = solveGraphical({ objective: { c: [1, 1], sense: 'max' }, constraints: [{ a: [1, 1], op: '<=', b: 4 }] });
  assert.equal(mult.status, 'optimal');
  near(mult.z, 4);
  assert.equal(mult.multipleOptima, true);
});

test('Transporte: ejemplo clásico 3×4 (NO=1015, CM=814, Vogel=779)', () => {
  const r = solveTransport({
    supply: [7, 9, 18],
    demand: [5, 8, 7, 14],
    costs: [[19, 30, 50, 10], [70, 30, 40, 60], [40, 8, 70, 20]],
  });
  assert.equal(r.results.northwest.totalCost, 1015);
  assert.equal(r.results.minCost.totalCost, 814);
  assert.equal(r.results.vogel.totalCost, 779);
  assert.equal(r.best, 'vogel');
  // Cada asignación respeta oferta y demanda
  for (const { allocation } of Object.values(r.results)) {
    allocation.forEach((row, i) => assert.equal(row.reduce((a, b) => a + b), r.problem.supply[i]));
    r.problem.demand.forEach((d, j) => assert.equal(allocation.reduce((a, row) => a + row[j], 0), d));
  }
});

test('Transporte: desbalanceado agrega columna ficticia', () => {
  const r = solveTransport({ supply: [30, 20], demand: [25, 15], costs: [[2, 3], [4, 1]] });
  assert.deepEqual(r.problem.dummy, { type: 'column', index: 2, amount: 10 });
  assert.equal(r.problem.demand.length, 3);
});

test('Markov: estado estable y proyección', () => {
  const r = solveMarkov({ P: [[0.9, 0.1], [0.5, 0.5]], pi0: [1, 0], steps: 2 });
  near(r.steadyState[0], 5 / 6); near(r.steadyState[1], 1 / 6);
  near(r.final[0], 0.86); near(r.final[1], 0.14); // [1,0]·P² = [0.86, 0.14]
  assert.equal(r.ergodic, true);
  const periodic = solveMarkov({ P: [[0, 1], [1, 0]], pi0: [1, 0], steps: 3 });
  assert.equal(periodic.ergodic, false);
  assert.throws(() => solveMarkov({ P: [[0.5, 0.4], [0.5, 0.5]], pi0: [1, 0], steps: 1 }), /debe sumar 1/);
});

test('Colas: M/M/1 λ=2 μ=3', () => {
  const m = mms({ lambda: 2, mu: 3 });
  near(m.rho, 2 / 3); near(m.L, 2); near(m.Lq, 4 / 3); near(m.W, 1); near(m.Wq, 2 / 3); near(m.P0, 1 / 3);
  near(m.Pn(2), (1 / 3) * (2 / 3) ** 2);
});

test('Colas: M/M/2 λ=2 μ=3, inestable y comparación de costos', () => {
  const m = mms({ lambda: 2, mu: 3, s: 2 });
  near(m.P0, 0.5); near(m.Lq, 1 / 12);
  assert.equal(mms({ lambda: 5, mu: 2, s: 2 }).stable, false);
  const c = compareServers({ lambda: 10, mu: 4, serverCost: 20, waitCost: 50 });
  assert.equal(c.rows[0].s, 3);
  assert.ok(c.rows.every((r) => r.total >= c.rows.find((x) => x.s === c.best).total));
});
