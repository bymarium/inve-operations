# Laboratorio de Optimización

Aplicativo web semiautomatizado de Investigación de Operaciones. Toda la lógica corre en el navegador (sin backend).

**Aplicativo en línea:** https://bymarium.github.io/inve-operations/

| Modelo | Qué hace |
|---|---|
| Método gráfico | PL de 2 variables: región factible, vértices, óptimo, holguras |
| Transporte | Esquina Noroeste, Costo Mínimo y Vogel, con comparación |
| Cadenas de Markov | Proyección a n pasos, Pⁿ, ergodicidad y estado estable |
| Teoría de colas | M/M/1 y M/M/s, indicadores y costo de servicio vs. espera |

## Ejecutar localmente

Los módulos ES no cargan desde `file://`, así que se necesita un servidor estático:

```
python -m http.server 5173
```

Luego abrir http://localhost:5173.

## Pruebas del motor

```
npm test
```
