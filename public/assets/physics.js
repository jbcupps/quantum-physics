// SI constants. Models below are independent of the renderer and frame rate.
export const TAU = 2 * Math.PI;
export const C = 299792458;
export const H = 6.62607015e-34;
export const ELECTRON_VOLT = 1.602176634e-19;
export const EPSILON_0 = 8.8541878188e-12;
export const MU_0 = 1 / (EPSILON_0 * C * C);
export const radians = (degrees) => (degrees * Math.PI) / 180;

export function preset(name, count = 9) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    let amplitude = 0,
      phase = 0;
    if (name === "pure") amplitude = n === 1 ? 1 : 0;
    if (name === "square") amplitude = n % 2 ? 4 / (Math.PI * n) : 0;
    if (name === "sawtooth") {
      amplitude = 2 / (Math.PI * n);
      phase = n % 2 ? 0 : Math.PI;
    }
    if (name === "complex") {
      amplitude = { 1: 0.8, 2: 0.45, 3: 0.3, 5: 0.2 }[n] || 0;
      phase = radians({ 1: 0, 2: 40, 3: -60, 5: 75 }[n] || 0);
    }
    return { n, amplitude, phase };
  });
}
export function signalAt(harmonics, t, cutoff = Infinity) {
  return harmonics.reduce(
    (sum, h) =>
      h.n <= cutoff
        ? sum + h.amplitude * Math.sin(TAU * h.n * t + h.phase)
        : sum,
    0,
  );
}
export function sampleSignal(harmonics, count = 512) {
  return Array.from({ length: count }, (_, j) =>
    signalAt(harmonics, j / count),
  );
}
export function analyze(samples, count = 9) {
  const N = samples.length;
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    let a = 0,
      b = 0;
    for (let j = 0; j < N; j++) {
      a += samples[j] * Math.cos((TAU * n * j) / N);
      b += samples[j] * Math.sin((TAU * n * j) / N);
    }
    a *= 2 / N;
    b *= 2 / N;
    const amplitude = Math.hypot(a, b);
    return {
      n,
      a,
      b,
      amplitude,
      phase: amplitude < 1e-10 ? 0 : Math.atan2(a, b),
    };
  });
}
export function energyFraction(coefficients, cutoff) {
  const total = coefficients.reduce((sum, h) => sum + h.amplitude ** 2, 0);
  const retained = coefficients.reduce(
    (sum, h) => sum + (h.n <= cutoff ? h.amplitude ** 2 : 0),
    0,
  );
  return total < 1e-20 ? null : retained / total;
}
export const electricFlux = (chargeCoulombs) => chargeCoulombs / EPSILON_0;
export function induction(amplitude, phase, mode, radius = 1) {
  // A 1 Hz prescribed axial field. At the disk rim, the induced circulation
  // follows the integral law. Positive theta is counterclockwise from +z.
  const field = amplitude * Math.sin(phase);
  const derivative = TAU * amplitude * Math.cos(phase);
  const circulating =
    mode === "faraday"
      ? (-radius * derivative) / 2
      : (MU_0 * EPSILON_0 * radius * derivative) / 2;
  return { field, derivative, circulating };
}
export function lightProperties(wavelengthNm) {
  const frequency = C / (wavelengthNm * 1e-9);
  return { frequency, photonEnergyEV: (H * frequency) / ELECTRON_VOLT };
}
export function planeWave(z, time, wavelength, amplitude = 1) {
  const E = amplitude * Math.cos((TAU * (z - C * time)) / wavelength);
  return { E, B: E / C };
}
export function polarization(incomingDeg, analyzerDeg) {
  const projection = Math.cos(radians(incomingDeg - analyzerDeg));
  return {
    projection,
    intensity: projection ** 2,
    angle: (Math.acos(Math.min(1, Math.abs(projection))) * 180) / Math.PI,
  };
}
export function packet(sigmaK, k0 = 5) {
  return {
    sigmaX: 1 / (2 * sigmaK),
    momentumDensity: (k) =>
      Math.exp(-(((k - k0) / sigmaK) ** 2) / 2) / (Math.sqrt(TAU) * sigmaK),
    positionDensity: (x) =>
      Math.sqrt(2 / Math.PI) * sigmaK * Math.exp(-2 * sigmaK ** 2 * x ** 2),
    realPsi: (x) =>
      ((2 * sigmaK ** 2) / Math.PI) ** 0.25 *
      Math.exp(-(sigmaK ** 2) * x ** 2) *
      Math.cos(k0 * x),
  };
}
