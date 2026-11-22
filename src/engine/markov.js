// Cadenas de Markov: proyección a n pasos y estado estable (cadena ergódica).

const TOL = 1e-6;

export function validateMatrix(P) {
  const n = P.length;
  if (!n || P.some((r) => r.length !== n)) throw new Error('La matriz de transición debe ser cuadrada.');
  P.forEach((r, i) => {
    if (r.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)) throw new Error(`Fila ${i + 1}: las probabilidades deben estar entre 0 y 1.`);
    const s = r.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > TOL) throw new Error(`Fila ${i + 1}: suma ${s.toFixed(4)}, debe sumar 1.`);
  });
}

const step = (pi, P) => P[0].map((_, j) => pi.reduce((s, p, i) => s + p * P[i][j], 0));

export const matMul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));

export function matPow(P, k) {
  let R = P.map((r, i) => r.map((_, j) => +(i === j)));
  for (let t = 0; t < k; t++) R = matMul(R, P);
  return R;
}

// Distribución en cada paso 0..n desde el vector inicial pi0.
export function project(P, pi0, n) {
  validateMatrix(P);
  if (pi0.length !== P.length) throw new Error('El vector inicial debe tener un valor por estado.');
  if (pi0.some((v) => v < 0) || Math.abs(pi0.reduce((a, b) => a + b, 0) - 1) > TOL) throw new Error('El vector inicial debe sumar 1 y no tener negativos.');
  if (!Number.isInteger(n) || n < 0) throw new Error('El número de pasos debe ser un entero ≥ 0.');
  const out = [pi0];
  for (let t = 0; t < n; t++) out.push(step(out[t], P));
  return out;
}

// Ergódica (regular) ⇔ alguna potencia P^k es estrictamente positiva; basta k ≤ (n-1)²+1 (Wielandt).
export function isErgodic(P) {
  const n = P.length;
  const B = P.map((r) => r.map((v) => v > 0));
  let R = B;
  for (let k = 1; k <= (n - 1) ** 2 + 1; k++) {
    if (R.every((r) => r.every(Boolean))) return true;
    R = R.map((r) => B[0].map((_, j) => r.some((v, m) => v && B[m][j])));
  }
  return false;
}

// Resuelve π = πP, Σπ = 1 por eliminación gaussiana. Devuelve null si no hay solución única.
export function steadyState(P) {
  validateMatrix(P);
  const n = P.length;
  // Filas: (P^T - I) π = 0, reemplazando la última ecuación por Σπ = 1.
  const A = P.map((_, i) => [...P.map((r, k) => r[i] - (i === k ? 1 : 0)), 0]);
  A[n - 1] = [...Array(n).fill(1), 1];
  for (let c = 0; c < n; c++) {
    const p = A.slice(c).reduce((b, r, k) => (Math.abs(r[c]) > Math.abs(A[b][c]) ? k + c : b), c);
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
}

export function solveMarkov({ P, pi0, steps }) {
  const trajectory = project(P, pi0, steps);
  const ergodic = isErgodic(P);
  const pi = steadyState(P);
  return {
    trajectory,
    final: trajectory[steps],
    Pn: matPow(P, steps),
    ergodic,
    steadyState: pi,
    // Tiempo medio de recurrencia μ_ii = 1/π_i
    recurrence: pi?.map((p) => (p > 1e-12 ? 1 / p : Infinity)) ?? null,
  };
}
