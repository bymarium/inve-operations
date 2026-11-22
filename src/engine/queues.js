// Teoría de colas M/M/s (M/M/1 es el caso s = 1) y análisis de costos.
// lambda: tasa de llegada, mu: tasa de servicio por servidor (mismas unidades de tiempo).

export function mms({ lambda, mu, s = 1 }) {
  if (!(lambda > 0) || !(mu > 0)) throw new Error('λ y μ deben ser mayores que 0.');
  if (!Number.isInteger(s) || s < 1) throw new Error('El número de servidores debe ser un entero ≥ 1.');
  const a = lambda / mu; // tráfico ofrecido
  const rho = a / s; // utilización
  if (rho >= 1) return { stable: false, lambda, mu, s, a, rho };

  // term = a^n / n!, calculado iterativamente para no desbordar
  let term = 1, sum = 0;
  for (let n = 0; n < s; n++) {
    sum += term;
    term *= a / (n + 1);
  }
  const tail = term / (1 - rho); // a^s / (s! (1-ρ))
  const P0 = 1 / (sum + tail);
  const Pw = tail * P0; // probabilidad de esperar (Erlang C)
  const Lq = (Pw * rho) / (1 - rho);
  const L = Lq + a;
  const Wq = Lq / lambda;
  const W = Wq + 1 / mu;

  const Pn = (n) => {
    let t = 1;
    for (let k = 1; k <= n; k++) t *= a / Math.min(k, s);
    return t * P0;
  };

  return { stable: true, lambda, mu, s, a, rho, P0, Pw, Lq, L, Wq, W, Pn };
}

// Costo total por unidad de tiempo = s·Cs + (L o Lq)·Cw
export function cost(metrics, { serverCost, waitCost, basis = 'system' }) {
  if (!metrics.stable) return { serviceCost: metrics.s * serverCost, waitingCost: Infinity, total: Infinity };
  const serviceCost = metrics.s * serverCost;
  const waitingCost = (basis === 'queue' ? metrics.Lq : metrics.L) * waitCost;
  return { serviceCost, waitingCost, total: serviceCost + waitingCost };
}

// Compara s = sMin..sMax servidores y señala el de menor costo total.
export function compareServers({ lambda, mu, serverCost, waitCost, basis = 'system', sMax }) {
  if (serverCost < 0 || waitCost < 0) throw new Error('Los costos no pueden ser negativos.');
  const sMin = Math.floor(lambda / mu) + 1; // mínimo estable
  const top = Math.max(sMax ?? sMin + 5, sMin);
  const rows = [];
  for (let s = sMin; s <= top; s++) {
    const m = mms({ lambda, mu, s });
    rows.push({ ...m, ...cost(m, { serverCost, waitCost, basis }) });
  }
  const best = rows.reduce((b, r) => (r.total < b.total ? r : b));
  return { rows, best: best.s };
}
