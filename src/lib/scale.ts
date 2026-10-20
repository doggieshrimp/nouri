/** A round step (1, 2, 2.5 or 5 × a power of ten) giving roughly `target` intervals. */
export function niceStep(span: number, target: number): number {
  if (span <= 0) return 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  // Nearest round step, so the axis doesn't overshoot the data by a whole extra step.
  const nice = fraction < 1.5 ? 1 : fraction < 2.25 ? 2 : fraction < 3.5 ? 2.5 : fraction < 7.5 ? 5 : 10;
  return nice * power;
}

/** Axis ticks with clean values covering [min, max]. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  const step = niceStep(max - min, target);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Linear mapping from a data domain to a pixel range. */
export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}
