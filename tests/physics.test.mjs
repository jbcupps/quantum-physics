import test from "node:test";
import assert from "node:assert/strict";
import {
  TAU,
  C,
  EPSILON_0,
  MU_0,
  preset,
  sampleSignal,
  analyze,
  signalAt,
  energyFraction,
  electricFlux,
  induction,
  planeWave,
  lightProperties,
  polarization,
  packet,
} from "../public/assets/physics.js";

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} differs from ${expected}`,
  );
}
function integrate(fn, min, max, intervals = 16000) {
  const dx = (max - min) / intervals;
  let sum = 0;
  for (let i = 0; i < intervals; i++) sum += fn(min + (i + 0.5) * dx) * dx;
  return sum;
}
test("Fourier analysis recovers orthogonal mixed frequencies and signed phases", () => {
  const samples = Array.from(
    { length: 512 },
    (_, j) =>
      0.8 * Math.sin((TAU * j) / 512) +
      0.4 * Math.cos((3 * TAU * j) / 512) -
      0.25 * Math.sin((7 * TAU * j) / 512),
  );
  const coefficients = analyze(samples);
  near(coefficients[0].amplitude, 0.8);
  near(coefficients[2].amplitude, 0.4);
  near(coefficients[2].phase, Math.PI / 2);
  near(coefficients[6].amplitude, 0.25);
  near(Math.abs(coefficients[6].phase), Math.PI);
  for (const i of [1, 3, 4, 5, 7, 8]) near(coefficients[i].amplitude, 0);
  for (let j = 0; j < 512; j++)
    near(signalAt(coefficients, j / 512), samples[j]);
});
test("Parseval energy matches measured samples and a low-pass filter removes only excluded energy", () => {
  for (const name of ["pure", "complex", "square", "sawtooth"]) {
    const samples = sampleSignal(preset(name)),
      coefficients = analyze(samples);
    const energy = samples.reduce((sum, s) => sum + s * s, 0) / samples.length;
    near(
      coefficients.reduce((sum, h) => sum + (h.amplitude * h.amplitude) / 2, 0),
      energy,
    );
    const retained = Array.from({ length: 512 }, (_, j) =>
      signalAt(coefficients, j / 512, 3),
    );
    const measured = retained.reduce((sum, s) => sum + s * s, 0) / 512;
    near(energyFraction(coefficients, 3), measured / energy);
    near(energyFraction(coefficients, 9), 1);
  }
  assert.equal(energyFraction(analyze(Array(512).fill(0)), 3), null);
});
test("Square-wave preset has odd harmonics only and converges around a known plateau", () => {
  const square = preset("square");
  near(square[0].amplitude, 4 / Math.PI);
  for (const h of square.filter((h) => h.n % 2 === 0)) near(h.amplitude, 0);
  near(signalAt(square, 0), 0);
  assert.ok(Math.abs(signalAt(square, 0.25) - 1) < 0.07);
});
test("Gauss flux is linear in signed charge", () => {
  near(electricFlux(0), 0);
  near(electricFlux(EPSILON_0), 1);
  near(electricFlux(-EPSILON_0), -1);
});
test("Faraday circulation obeys the flux derivative, including a stationary maximum", () => {
  const R = 1.7,
    amplitude = 0.002,
    phase = 0.41,
    delta = 1e-5;
  const result = induction(amplitude, phase, "faraday", R);
  const flux = (t) => Math.PI * R * R * amplitude * Math.sin(TAU * t);
  const t = phase / TAU,
    derivative = (flux(t + delta) - flux(t - delta)) / (2 * delta);
  near(TAU * R * result.circulating, -derivative, 1e-9);
  near(induction(amplitude, Math.PI / 2, "faraday", R).circulating, 0);
  assert.ok(induction(amplitude, 0, "faraday").circulating < 0);
  assert.ok(induction(amplitude, Math.PI, "faraday").circulating > 0);
});
test("Displacement current produces the Ampere–Maxwell circulation with no conduction current", () => {
  const R = 0.6,
    amplitude = 1e6,
    phase = 0.7;
  const result = induction(amplitude, phase, "ampere", R);
  const displacementCurrent = EPSILON_0 * Math.PI * R * R * result.derivative;
  near(TAU * R * result.circulating, MU_0 * displacementCurrent, 1e-23);
  near(induction(0, phase, "ampere").circulating, 0);
});
test("A vacuum plane wave has E = cB and translates by one wavelength in one period", () => {
  const wavelength = 550e-9,
    period = wavelength / C;
  for (const z of [0, wavelength * 0.17, wavelength * 0.5]) {
    const initial = planeWave(z, 0, wavelength);
    near(initial.E, C * initial.B);
    near(planeWave(z, period, wavelength).E, initial.E);
    near(planeWave(z + wavelength / 4, period / 4, wavelength).E, initial.E);
  }
  near(lightProperties(500).photonEnergyEV, 2.479683968664, 1e-10);
});
test("Malus law yields full, half, and zero transmission and respects axis periodicity", () => {
  near(polarization(20, 20).intensity, 1);
  near(polarization(20, 65).intensity, 0.5);
  near(polarization(20, 110).intensity, 0);
  near(polarization(170, 10).angle, 20);
  near(polarization(20, 200).intensity, 1);
});
test("Gaussian distributions are normalized with the advertised variances and minimum uncertainty", () => {
  for (const sigmaK of [0.35, 0.7, 1.8]) {
    const model = packet(sigmaK);
    const normX = integrate(model.positionDensity, -20, 20);
    const normK = integrate(model.momentumDensity, -20, 30);
    near(normX, 1, 1e-9);
    near(normK, 1, 1e-9);
    const varianceX = integrate(
      (x) => x * x * model.positionDensity(x),
      -20,
      20,
    );
    const varianceK = integrate(
      (k) => (k - 5) ** 2 * model.momentumDensity(k),
      -20,
      30,
    );
    near(Math.sqrt(varianceX), model.sigmaX, 1e-9);
    near(Math.sqrt(varianceK), sigmaK, 1e-9);
    near(Math.sqrt(varianceX * varianceK), 0.5, 1e-9);
    near(model.realPsi(0) ** 2, model.positionDensity(0));
  }
});
