import test from "node:test";
import assert from "node:assert/strict";
import { TAU, radians } from "../public/assets/physics.js";
import {
  wavePair,
  peakAmplitude,
  fieldVector,
  standingNodes,
  missions,
  evaluateMission,
} from "../public/assets/interference.js";
const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} differs from ${expected}`,
  );

test("The circular field has a sine projection and constant magnitude; removing the second component gives linear polarization", () => {
  for (const time of [0, 0.2, 1.7, Math.PI])
    for (const z of [0, 0.25, 0.51, 1.8]) {
      const circular = fieldVector(z, time);
      near(circular.y, Math.sin(TAU * z - time));
      near(Math.hypot(circular.x, circular.y), 1);
      near(fieldVector(z, time, 0).x, 0);
      near(fieldVector(z, time, 0.5).y, circular.y);
      near(fieldVector(z, time, 0.5).x, circular.x / 2);
    }
});
test("Rotating vector at a fixed location traces a circle, while the spatial phase repeats after one wavelength", () => {
  const a = fieldVector(0.17, 0.4),
    b = fieldVector(0.17, 0.4 + Math.PI / 2),
    c = fieldVector(1.17, 0.4);
  near(a.x * b.x + a.y * b.y, 0);
  near(a.x, c.x);
  near(a.y, c.y);
});
test("Equal opposing waves reproduce the standing-wave identity and fixed half-wavelength nodes", () => {
  const nodes = standingNodes(Math.PI, 1);
  assert.deepEqual(nodes, [0, 0.5, 1, 1.5, 2, 2.5]);
  for (const time of [0, 0.42, Math.PI / 2, 2.1, Math.PI]) {
    for (const z of nodes) near(wavePair(z, time, 1, Math.PI).sum, 0);
    for (const z of [0.13, 0.25, 0.76, 1.12])
      near(
        wavePair(z, time, 1, Math.PI).sum,
        2 * Math.sin(TAU * z) * Math.cos(time),
      );
  }
  assert.equal(standingNodes(Math.PI, 0.99).length, 0);
});
test("The analytic envelope equals the measured RMS peak for both propagation directions", () => {
  for (const direction of [-1, 1])
    for (const ratio of [0, 0.3, 1])
      for (const phase of [0, 0.9, Math.PI])
        for (const z of [0.1, 0.75, 1.25]) {
          let squared = 0;
          for (let i = 0; i < 1024; i++)
            squared +=
              wavePair(z, (TAU * i) / 1024, ratio, phase, direction).sum ** 2;
          near(
            peakAmplitude(z, ratio, phase, direction) ** 2,
            (2 * squared) / 1024,
          );
        }
});
test("Co-propagating waves cancel everywhere at opposite phase and reinforce everywhere in phase", () => {
  for (const z of [0, 0.31, 1.75]) {
    near(peakAmplitude(z, 1, Math.PI, 1), 0);
    near(peakAmplitude(z, 1, 0, 1), 2);
    near(peakAmplitude(z, 0.3, Math.PI, 1), 0.7);
  }
});
test("All three missions have reachable perfect solutions and unsolved starting configurations", () => {
  for (const [i, phase] of [0, 90, 90].entries()) {
    const result = evaluateMission(missions[i], 1, radians(phase));
    assert.ok(result.passed);
    assert.equal(result.score, 100);
    assert.equal(
      evaluateMission(
        missions[i],
        missions[i].startRatio,
        radians(missions[i].startPhase),
      ).passed,
      false,
    );
  }
});
test("A momentarily flat standing wave cannot solve a quiet-target mission", () => {
  // At a quarter period the entire instantaneous trace is zero, including
  // an antinode. Scoring still sees its nonzero full-cycle peak amplitude.
  near(wavePair(0.75, Math.PI / 2, 1, Math.PI).sum, 0);
  const result = evaluateMission(missions[0], 1, Math.PI);
  near(result.targets[0].fraction, 1);
  assert.equal(result.passed, false);
});
test("Zeroing the second wave does not pass cancellation or reinforcement targets", () => {
  for (const mission of missions)
    assert.equal(evaluateMission(mission, 0, 0).passed, false);
});
