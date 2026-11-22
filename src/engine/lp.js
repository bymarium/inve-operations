// Programación lineal de 2 variables por el método gráfico (enumeración de vértices).
// constraints: [{ a: [a1, a2], op: '<=' | '>=' | '=', b }]
// objective: { c: [c1, c2], sense: 'max' | 'min' }

const EPS = 1e-9;

const satisfies = ({ a, op, b }, [x, y]) => {
  const lhs = a[0] * x + a[1] * y;
  const tol = 1e-7 * Math.max(1, Math.abs(b));
  if (op === '<=') return lhs <= b + tol;
  if (op === '>=') return lhs >= b - tol;
  return Math.abs(lhs - b) <= tol;
};

const intersect = (p, q) => {
  const det = p.a[0] * q.a[1] - p.a[1] * q.a[0];
  if (Math.abs(det) < EPS) return null; // paralelas
  return [(p.b * q.a[1] - p.a[1] * q.b) / det, (p.a[0] * q.b - p.b * q.a[0]) / det];
};

const dedupe = (pts) =>
  pts.filter((p, i) => pts.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-7) === i);

// Vértices de la región definida por `cons` (todas las intersecciones factibles de pares de rectas).
function vertices(cons) {
  const pts = [];
  for (let i = 0; i < cons.length; i++)
    for (let j = i + 1; j < cons.length; j++) {
      const p = intersect(cons[i], cons[j]);
      if (p && cons.every((c) => satisfies(c, p))) pts.push(p);
    }
  return dedupe(pts);
}

// Ordena puntos de un polígono convexo en sentido antihorario (para dibujarlo).
function sortPolygon(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [...pts].sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
}

const box = (M, nonNegative) => [
  { a: [1, 0], op: '<=', b: M },
  { a: [0, 1], op: '<=', b: M },
  { a: [1, 0], op: '>=', b: nonNegative ? 0 : -M },
  { a: [0, 1], op: '>=', b: nonNegative ? 0 : -M },
];

const validate = (objective, constraints) => {
  const bad = (v) => typeof v !== 'number' || !Number.isFinite(v);
  if (!objective || objective.c?.length !== 2 || objective.c.some(bad)) throw new Error('Función objetivo inválida: se requieren 2 coeficientes numéricos.');
  if (!['max', 'min'].includes(objective.sense)) throw new Error("El sentido debe ser 'max' o 'min'.");
  constraints.forEach((c, i) => {
    if (c.a?.length !== 2 || c.a.some(bad) || bad(c.b)) throw new Error(`Restricción ${i + 1}: coeficientes inválidos.`);
    if (!['<=', '>=', '='].includes(c.op)) throw new Error(`Restricción ${i + 1}: operador inválido.`);
    if (Math.abs(c.a[0]) < EPS && Math.abs(c.a[1]) < EPS) throw new Error(`Restricción ${i + 1}: ambos coeficientes son 0.`);
  });
};

export function solveGraphical({ objective, constraints, nonNegative = true }) {
  validate(objective, constraints);
  const sign = objective.sense === 'max' ? 1 : -1;
  const z = ([x, y]) => objective.c[0] * x + objective.c[1] * y;

  // Caja grande que contiene todas las intersecciones e interceptos: sirve para dibujar
  // regiones no acotadas y para resolver casos sin vértices propios.
  const coords = [];
  const lines = [...constraints, { a: [1, 0], b: 0 }, { a: [0, 1], b: 0 }];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const p = intersect(lines[i], lines[j]);
      if (p) coords.push(Math.abs(p[0]), Math.abs(p[1]));
    }
  const M = Math.max(10, 1.5 * Math.max(0, ...coords));

  const real = [...constraints, ...(nonNegative ? box(Infinity, true).slice(2) : [])];
  const clipped = [...constraints, ...box(M, nonNegative)];
  const region = vertices(clipped);
  const realVertices = vertices(real).map((p) => ({ x: p[0], y: p[1], z: z(p) }));

  const base = { realVertices, region: region.length ? sortPolygon(region) : [], bound: M };
  if (!region.length) return { status: 'infeasible', ...base };

  // ¿No acotado? Existe dirección d en el cono de recesión con c·d > 0 (en sentido de mejora).
  const recession = constraints.map(({ a, op }) => ({ a, op, b: 0 }));
  const dirBox = [...recession, ...box(1, nonNegative)];
  const best = Math.max(...vertices(dirBox).map((d) => sign * z(d)));
  if (best > 1e-7) return { status: 'unbounded', ...base };

  // Óptimo: mejor punto de la región recortada (contiene todo vértice real).
  const scored = region.map((p) => ({ x: p[0], y: p[1], z: z(p) }));
  const opt = Math.max(...scored.map((v) => sign * v.z));
  const tol = 1e-7 * Math.max(1, Math.abs(opt));
  const ties = scored.filter((v) => Math.abs(sign * v.z - opt) <= tol);
  // Preferimos reportar un vértice real (no uno creado por la caja de dibujo).
  const optimum = ties.find((t) => realVertices.some((r) => Math.hypot(r.x - t.x, r.y - t.y) < 1e-7)) ?? ties[0];

  return { status: 'optimal', optimum, z: optimum.z, multipleOptima: ties.length > 1, ...base };
}
