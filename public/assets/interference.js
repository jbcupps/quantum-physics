import { TAU } from "./physics.js";

// z is in wavelengths; time and phase are in radians. Both waves have the same
// frequency. Their direction changes only the spatial phase, not the clock.
export function wavePair(z, time, ratio, phase, direction = -1) {
  const first = Math.sin(TAU * z - time);
  const second = ratio * Math.sin(direction * TAU * z - time + phase);
  return { first, second, sum: first + second };
}
export function peakAmplitude(z, ratio, phase, direction = -1) {
  return Math.sqrt(
    Math.max(
      0,
      1 +
        ratio * ratio +
        2 * ratio * Math.cos((direction - 1) * TAU * z + phase),
    ),
  );
}
export function fieldVector(z, time, ellipticity = 1) {
  const angle = TAU * z - time;
  return { x: ellipticity * Math.cos(angle), y: Math.sin(angle) };
}
export function standingNodes(phase, ratio, limit = 2.5) {
  if (Math.abs(ratio - 1) > 1e-9) return [];
  const result = [];
  for (let m = -10; m <= 10; m++) {
    const z = (phase - Math.PI - m * TAU) / (2 * TAU);
    if (z >= -1e-9 && z <= limit + 1e-9) result.push(Math.max(0, z));
  }
  return result.sort((a, b) => a - b);
}
export const missions = [
  {
    title: "Find the quiet.",
    description:
      "Silence receiver A. Adjust phase and amplitude until it stays quiet for the whole cycle.",
    targets: [{ z: 0.75, kind: "quiet", name: "A" }],
    startPhase: 70,
    startRatio: 0.55,
    hint: "Equal amplitudes are needed for complete cancellation. Slide the phase until the two waves oppose each other at A.",
    lesson:
      "A is now a node: its two fields cancel at every instant, not just at a zero crossing.",
  },
  {
    title: "Wake the beacon.",
    description:
      "Make receiver B as active as possible. Align the waves there so their amplitudes add.",
    targets: [{ z: 1.125, kind: "active", name: "B" }],
    startPhase: 250,
    startRatio: 0.4,
    hint: "Use the full second-wave amplitude. Find the phase where the two component waves rise and fall together at B.",
    lesson:
      "At B, the fields reinforce one another. Two equal amplitudes combine to give a peak of 2A.",
  },
  {
    title: "One pattern. Two outcomes.",
    description:
      "Keep receiver A quiet while receiver B oscillates strongly. Position a node and an antinode using the same pair of waves.",
    targets: [
      { z: 0.375, kind: "quiet", name: "A" },
      { z: 1.125, kind: "active", name: "B" },
    ],
    startPhase: 210,
    startRatio: 0.7,
    hint: "With equal amplitudes, nodes and antinodes alternate every quarter wavelength. These receivers are three quarters of a wavelength apart.",
    lesson:
      "The same waves cancel at one location and reinforce at the other. Interference depends on relative phase at each point in space.",
  },
];
export function evaluateMission(mission, ratio, phase) {
  const targets = mission.targets.map((target) => {
    const fraction = peakAmplitude(target.z, ratio, phase, -1) / 2;
    const error = target.kind === "quiet" ? fraction : Math.abs(1 - fraction);
    return {
      ...target,
      fraction,
      error,
      passed: target.kind === "quiet" ? fraction <= 0.04 : fraction >= 0.98,
    };
  });
  return {
    targets,
    passed: targets.every((target) => target.passed),
    score: Math.round(
      100 *
        (1 -
          targets.reduce((sum, target) => sum + target.error, 0) /
            targets.length),
    ),
  };
}
