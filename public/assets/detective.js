import { TAU, radians } from "./physics.js";
import {
  wavePair,
  peakAmplitude,
  fieldVector,
  standingNodes,
  missions,
  evaluateMission,
} from "./interference.js";

const $ = (id) => document.getElementById(id);
const canvas = $("detective-canvas"),
  ctx = canvas.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const color = {
  cyan: "#70d6e7",
  amber: "#f0bf78",
  lavender: "#b4a4f0",
  white: "#e5ebee",
  muted: "#95aabc",
  grid: "#273c4a",
};
const state = {
  stage: 0,
  time: 0.6,
  playing: !reduced.matches,
  camera: 0,
  probe: 1,
  roundness: 1,
  phase: 180,
  ratio: 1,
  direction: -1,
  mission: 0,
  solved: [false, false, false],
  scores: [0, 0, 0],
};
let drawnCamera = 0,
  visible = false,
  dirty = true,
  request = 0,
  last = 0,
  lastReadout = 0;
const stageCopy = [
  {
    kicker: "01 / A FAMILIAR SILHOUETTE",
    title: "One trace.<br><em>Part of the story.</em>",
    description:
      "This sine curve plots one electric-field component along space. A crest is a field value—not the path of a particle. What might a second, hidden component reveal?",
    formulaLabel: "THE VISIBLE COMPONENT",
    formula: "Eᵧ = A sin(kz − ωt)",
    insight:
      "A flat sine trace alone cannot tell you whether the full field is linearly or circularly polarized.",
    caption: "ONE INSTANT IN SPACE · THE PATTERN TRAVELS TO THE RIGHT",
    next: "Reveal the depth",
  },
  {
    kicker: "02 / REVEAL THE HIDDEN COMPONENT",
    title: "A sine wave.<br><em>A new perspective.</em>",
    description:
      "Now reveal a perpendicular field component, a quarter cycle out of step. Their vector tips form a helix across space. At the amber location, the field rotates in a transverse plane.",
    formulaLabel: "TWO PERPENDICULAR COMPONENTS",
    formula: "Eᵧ = A sin θ<br>Eₓ = eA cos θ",
    insight:
      "Rotate back to the flat view: the sine trace returns. Reduce the second component to flatten the polarization ellipse.",
    caption: "THE HELIX JOINS FIELD-VECTOR TIPS · IT IS NOT A PARTICLE PATH",
    next: "Make interference",
  },
  {
    kicker: "03 / A DIFFERENT PHYSICAL SETUP",
    title: "Two waves.<br><em>One shared space.</em>",
    description:
      "Return to a shared linear polarization and add a second wave. Send equal waves in opposite directions to reveal standing loops. Their nodes stay still while the field between them oscillates.",
    formulaLabel: "SUPERPOSITION",
    formula: "y(z,t) = y₁(z,t) + y₂(z,t)",
    insight:
      "The translucent loops mark the full-cycle envelope. Pause and advance a quarter cycle to see the moving trace inside it.",
    caption: "WHITE = INSTANTANEOUS SUM · SHADED LOBES = FULL-CYCLE ENVELOPE",
    next: "Play the three missions",
  },
  {
    kicker: "04 / USE INTERFERENCE AS YOUR TOOL",
    title: "Tune the waves.<br><em>Solve the pattern.</em>",
    description: "",
    formulaLabel: "SCORED OVER THE WHOLE CYCLE",
    formula: "Receiver level = R / (2A)",
    insight: "",
    caption:
      "RECEIVERS MEASURE PEAK OSCILLATION · PAUSING CANNOT CHANGE YOUR SCORE",
    next: "Return to free exploration",
  },
];

function text(value, x, y, fill = color.muted, size = 10, align = "left") {
  ctx.fillStyle = fill;
  ctx.font = `${size}px Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function path(points, stroke = color.grid, width = 1, dash = [], fill = null) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (fill) {
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}
function circle(x, y, r, stroke, fill = null, width = 1, dash = []) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.setLineDash([]);
}
function arrow(from, to, stroke, width = 1.3, head = 5) {
  path([from, to], stroke, width);
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  path(
    [
      [to[0] - head * Math.cos(a - 0.5), to[1] - head * Math.sin(a - 0.5)],
      to,
      [to[0] - head * Math.cos(a + 0.5), to[1] - head * Math.sin(a + 0.5)],
    ],
    stroke,
    width,
  );
}
function invalidate() {
  dirty = true;
  schedule();
}
function schedule() {
  if (!request && !document.hidden && visible)
    request = requestAnimationFrame(frame);
}
function frame(now) {
  request = 0;
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
  last = now;
  if (document.hidden || !visible) {
    last = 0;
    return;
  }
  const cameraTarget = state.camera / 100;
  if (reduced.matches) drawnCamera = cameraTarget;
  else drawnCamera += (cameraTarget - drawnCamera) * Math.min(1, dt * 7);
  const movingCamera = Math.abs(drawnCamera - cameraTarget) > 0.0005;
  if (!movingCamera) drawnCamera = cameraTarget;
  if (state.playing) state.time = (state.time + dt * TAU * 0.22) % TAU;
  if (dirty || state.playing || movingCamera) {
    const { width: w, height: h } = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    if (
      canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)
    ) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(w, h);
    dirty = false;
  }
  if (now - lastReadout > 120) {
    updateLiveReadout();
    lastReadout = now;
  }
  if (state.playing || movingCamera) schedule();
  else last = 0;
}
new ResizeObserver(invalidate).observe(canvas);
new IntersectionObserver(
  (entries) => {
    visible = entries[0].isIntersecting;
    last = 0;
    invalidate();
  },
  { rootMargin: "60px" },
).observe(canvas);
document.addEventListener("visibilitychange", () => {
  last = 0;
  schedule();
});
reduced.addEventListener("change", (event) => {
  if (event.matches) state.playing = false;
  syncMotion();
  invalidate();
});

function draw(w, h) {
  const c = drawnCamera,
    interfering = state.stage >= 2,
    small = w < 500;
  const left = small ? 45 : 65,
    right = small ? 40 : 60,
    L = w - left - right;
  const run = L * (1 - 0.28 * c),
    origin = left + (L - run) / 2;
  const baseline = h * (0.47 + 0.12 * c),
    slope = h * 0.22 * c,
    scale = h * (interfering ? 0.135 : 0.24);
  const P = (z, y = 0, x = 0) => [
    origin + (z / 2.5) * run + x * scale * (small ? 0.6 : 0.95) * c,
    baseline - (z / 2.5) * slope - y * scale + x * scale * 0.3 * c,
  ];
  for (let x = 18; x < w; x += 26)
    for (let y = 22; y < h - 20; y += 26) {
      ctx.fillStyle = "#293e4b66";
      ctx.fillRect(x, y, 1, 1);
    }
  const ymax = interfering ? 2 : 1;
  for (let y = -ymax; y <= ymax; y += 1)
    path([P(0, y), P(2.5, y)], "#30485770", 1, [3, 5]);
  for (let z = 0; z <= 2.5; z += 0.5) {
    path([P(z, -ymax), P(z, ymax)], "#30485770", 1, [3, 5]);
    const p = P(z);
    text(
      z.toFixed(1),
      p[0],
      baseline + scale * ymax + 15,
      color.muted,
      small ? 8 : 9,
      "center",
    );
  }
  arrow(P(0), P(2.58), "#8198a9", 1, 4);
  text("z / λ", w - 8, baseline + scale * ymax + 15, color.muted, 9, "right");
  if (!interfering) {
    if (c > 0.02) {
      for (let x = -1; x <= 1; x += 0.5)
        path([P(0, 0, x), P(2.5, 0, x)], "#6b56804a");
      for (let z = 0; z <= 2.5; z += 0.5)
        path([P(z, 0, -1), P(z, 0, 1)], "#6b56804a");
      // The side-wall trace is the y projection of the same field vectors.
      path(
        Array.from({ length: 401 }, (_, i) => {
          const z = (i / 400) * 2.5;
          return P(z, fieldVector(z, state.time).y, 0);
        }),
        `${color.cyan}55`,
        1.3,
        [3, 5],
      );
      for (const z of [0.25, 1.25, 2.25])
        path(
          Array.from({ length: 81 }, (_, i) =>
            P(
              z,
              Math.sin((i / 80) * TAU),
              state.roundness * Math.cos((i / 80) * TAU),
            ),
          ),
          `${color.lavender}38`,
          1,
          [3, 5],
        );
    }
    const points = Array.from({ length: 701 }, (_, i) => {
      const z = (i / 700) * 2.5,
        v = fieldVector(z, state.time, state.roundness);
      return P(z, v.y, v.x);
    });
    for (let i = 0; i <= 45; i++) {
      const z = (i / 45) * 2.5,
        v = fieldVector(z, state.time, state.roundness);
      path([P(z), P(z, v.y, v.x)], `${color.cyan}36`, 0.8);
    }
    ctx.save();
    ctx.shadowColor = "#70d6e745";
    ctx.shadowBlur = 12;
    path(points, color.cyan, 2.3);
    ctx.restore();
    const v = fieldVector(state.probe, state.time, state.roundness),
      base = P(state.probe),
      tip = P(state.probe, v.y, v.x);
    if (c > 0.02)
      path(
        Array.from({ length: 121 }, (_, i) =>
          P(
            state.probe,
            Math.sin((i / 120) * TAU),
            state.roundness * Math.cos((i / 120) * TAU),
          ),
        ),
        `${color.amber}90`,
        1.5,
        [4, 4],
      );
    arrow(base, tip, color.amber, 2.3, 6);
    circle(...tip, 4, color.amber, color.amber);
    circle(...base, 3, color.amber, "#111f29");
    const labelX = Math.max(42, Math.min(w - 60, base[0]));
    text(
      c < 0.02
        ? "ONE FIELD COMPONENT"
        : state.roundness === 0
          ? "LINEAR POLARIZATION"
          : state.roundness === 1
            ? "CIRCULAR POLARIZATION"
            : "ELLIPTICAL POLARIZATION",
      w / 2,
      21,
      color.muted,
      small ? 8 : 9,
      "center",
    );
    text("Inspect", labelX, h - 28, color.amber, 9, "center");
    path(
      [
        [base[0], base[1] + 9],
        [labelX, h - 43],
      ],
      "#f0bf7840",
      1,
      [3, 5],
    );
    if (c > 0.02) {
      text("Eᵧ", ...P(0, 1.2, 0), color.cyan, 10, "center");
      const px = P(0, 0, 1.25);
      text("Eₓ", px[0], px[1] + 15, color.lavender, 10, "center");
    } else {
      text("+A", left - 13, P(0, 1)[1], color.muted, 9, "right");
      text("−A", left - 13, P(0, -1)[1], color.muted, 9, "right");
    }
  } else {
    const phi = radians(state.phase),
      N = 600;
    const amplitude = (z) =>
      peakAmplitude(z, state.ratio, phi, state.direction);
    const upper = Array.from({ length: N + 1 }, (_, i) =>
      P((i / N) * 2.5, amplitude((i / N) * 2.5)),
    );
    const lower = Array.from({ length: N + 1 }, (_, i) =>
      P(((N - i) / N) * 2.5, -amplitude(((N - i) / N) * 2.5)),
    );
    path([...upper, ...lower], "transparent", 0, [], "#f0bf7813");
    path(upper, "#f0bf7870", 1.2, [4, 4]);
    path(lower, "#f0bf7870", 1.2, [4, 4]);
    for (const key of ["first", "second", "sum"]) {
      const points = Array.from({ length: N + 1 }, (_, i) => {
        const z = (i / N) * 2.5;
        return P(
          z,
          wavePair(z, state.time, state.ratio, phi, state.direction)[key],
        );
      });
      path(
        points,
        key === "first"
          ? `${color.cyan}a0`
          : key === "second"
            ? `${color.lavender}a0`
            : color.white,
        key === "sum" ? 2.5 : 1.1,
        key === "sum" ? [] : [5, 4],
      );
    }
    if (state.direction === -1) {
      for (const z of standingNodes(phi, state.ratio)) {
        circle(...P(z), 3.5, color.cyan, "#102731", 1.5);
      }
      text(
        state.ratio === 1
          ? "FIXED NODES · HALF A WAVELENGTH APART"
          : "UNEQUAL WAVES · MINIMA DO NOT REACH ZERO",
        w / 2,
        20,
        color.muted,
        small ? 7 : 9,
        "center",
      );
    } else
      text(
        "CO-PROPAGATING WAVES · UNIFORM COMBINED AMPLITUDE",
        w / 2,
        20,
        color.muted,
        small ? 7 : 9,
        "center",
      );
    const targets =
      state.stage === 3
        ? missions[state.mission].targets
        : [{ z: state.probe, name: "Probe", kind: "inspect" }];
    for (const target of targets) {
      const z = target.z,
        p = P(z),
        fraction = amplitude(z) / 2;
      path([P(z, 2.12), P(z, -2.12)], "#f0bf7890", 1, [3, 5]);
      ctx.save();
      ctx.shadowColor = color.amber;
      ctx.shadowBlur = 20 * fraction;
      circle(
        ...p,
        8,
        color.amber,
        `rgba(240,191,120,${0.12 + 0.7 * fraction})`,
        1.5,
      );
      ctx.restore();
      const tx = p[0],
        ty = Math.min(h - 31, baseline + scale * 2 + 44);
      text(target.name, tx, ty, color.amber, 10, "center");
      if (state.stage === 3)
        text(
          target.kind === "quiet" ? "QUIET" : "ACTIVE",
          tx,
          ty + 13,
          color.muted,
          7,
          "center",
        );
    }
    arrow([w - 88, h - 24], [w - 43, h - 24], color.cyan, 1, 4);
    arrow(
      state.direction === -1 ? [w - 43, h - 12] : [w - 88, h - 12],
      state.direction === -1 ? [w - 88, h - 12] : [w - 43, h - 12],
      color.lavender,
      1,
      4,
    );
  }
}

function syncMotion() {
  $("motion-toggle").textContent = state.playing
    ? "Pause motion"
    : "Play motion";
}
function updateLiveReadout() {
  if (state.stage < 2) {
    const v = fieldVector(state.probe, state.time, state.roundness);
    $("probe-readout").textContent =
      state.stage === 0
        ? `Eᵧ / A = ${v.y.toFixed(3)}`
        : `Eₓ ${v.x.toFixed(2)} · Eᵧ ${v.y.toFixed(2)}`;
    $("readout-label").textContent = `AT z = ${state.probe.toFixed(2)} λ`;
    $("readout-note").textContent =
      state.stage === 0
        ? "The field oscillates at this location as time passes."
        : state.roundness === 1
          ? "The vector rotates with a constant magnitude A. The amber circle is its orbit in field-component space."
          : "The two component amplitudes differ. Their vector tip traces an ellipse; at zero second component, a line.";
  } else if (state.stage === 2) {
    const p = wavePair(
      state.probe,
      state.time,
      state.ratio,
      radians(state.phase),
      state.direction,
    );
    const peak = peakAmplitude(
      state.probe,
      state.ratio,
      radians(state.phase),
      state.direction,
    );
    $("readout-label").textContent = `AT z = ${state.probe.toFixed(2)} λ`;
    $("probe-readout").textContent =
      `${p.first.toFixed(2)} + (${p.second.toFixed(2)}) = ${p.sum.toFixed(2)}`;
    $("readout-note").textContent =
      `The fields add at this instant. Here, the full-cycle peak amplitude is ${peak.toFixed(2)}A.`;
  } else {
    const result = evaluateMission(
      missions[state.mission],
      state.ratio,
      radians(state.phase),
    );
    $("readout-label").textContent = "RECEIVER LEVEL · FRACTION OF 2A";
    $("probe-readout").textContent = result.targets
      .map((t) => `${t.name} ${(t.fraction * 100).toFixed(1)}%`)
      .join(" · ");
    $("readout-note").textContent =
      "Quiet ≤ 4%. Active ≥ 98%. These levels measure the whole cycle, independent of the animation.";
  }
}
function syncControls() {
  $("camera-angle").value = state.camera;
  $("camera-angle").disabled = state.stage === 0;
  $("camera-value").textContent =
    state.camera === 0 ? "Flat trace" : `${state.camera}% depth`;
  $("probe-position").value = state.probe;
  $("probe-value").textContent = state.probe.toFixed(2);
  $("roundness").value = state.roundness;
  $("roundness-value").textContent = state.roundness.toFixed(2);
  $("partner-phase").value = state.phase;
  $("phase-control-value").textContent = `${state.phase}°`;
  $("partner-amplitude").value = state.ratio;
  $("partner-amplitude-value").textContent = state.ratio.toFixed(2);
  $("roundness-control").hidden = state.stage !== 1;
  $("probe-control").hidden = state.stage === 3;
  $("phase-control").hidden = state.stage < 2;
  $("amplitude-control").hidden = state.stage < 2;
  $("direction-control").hidden = state.stage < 2;
  document.querySelector(".lens-controls").dataset.stage = String(state.stage);
  document.querySelectorAll("[data-direction]").forEach((b) => {
    b.setAttribute(
      "aria-pressed",
      String(+b.dataset.direction === state.direction),
    );
    b.disabled = state.stage === 3;
  });
  if (state.stage === 3) updateTargets();
  updateLiveReadout();
  invalidate();
}
function selectStage(stage) {
  state.stage = stage;
  const info = stageCopy[stage];
  document.querySelectorAll("[data-stage]").forEach((button) => {
    if (button.tagName === "BUTTON")
      button.setAttribute(
        "aria-pressed",
        String(+button.dataset.stage === stage),
      );
  });
  $("stage-kicker").textContent = info.kicker;
  $("lens-title").innerHTML = info.title;
  $("stage-description").textContent = info.description;
  $("formula-label").textContent = info.formulaLabel;
  $("stage-formula").innerHTML = info.formula;
  $("stage-insight").textContent = info.insight;
  $("scene-caption").textContent = info.caption;
  $("next-lens").innerHTML = `${info.next} <span>→</span>`;
  $("mission-panel").hidden = stage !== 3;
  state.camera = stage === 0 ? 0 : stage === 1 ? 85 : 45;
  if (stage === 2) {
    state.direction = -1;
    state.phase = 180;
    state.ratio = 1;
  }
  if (stage === 3) {
    state.direction = -1;
    loadMission();
  }
  $("lens-legend").innerHTML =
    stage < 2
      ? '<span><i class="dot cyan"></i>Eᵧ ' +
        (stage === 0 ? "projection" : "& Eₓ") +
        '</span><span><i class="dot amber"></i>Inspection point</span>'
      : '<span><i class="dot cyan"></i>Wave 1</span><span><i class="dot lavender"></i>Wave 2</span><span><i class="dot white"></i>Sum</span>';
  canvas.setAttribute(
    "aria-label",
    stage < 2
      ? stage === 0
        ? "A sine-wave projection along the propagation axis, with an amber inspection marker."
        : "A perspective helix connecting electric-field vector tips in space. An amber transverse ellipse shows the possible vector directions at the inspection position."
      : "Two traveling waves and their instantaneous sum, with a shaded full-cycle envelope. Circular markers identify stationary nodes for equal opposing waves. Amber receivers show the target locations.",
  );
  syncControls();
}
document
  .querySelectorAll("button[data-stage]")
  .forEach((button) =>
    button.addEventListener("click", () => selectStage(+button.dataset.stage)),
  );
$("next-lens").addEventListener("click", () =>
  selectStage(state.stage === 3 ? 2 : state.stage + 1),
);
$("motion-toggle").addEventListener("click", () => {
  state.playing = !state.playing;
  syncMotion();
  invalidate();
});
$("step-time").addEventListener("click", () => {
  state.playing = false;
  state.time = (state.time + TAU / 4) % TAU;
  syncMotion();
  updateLiveReadout();
  invalidate();
});
for (const [id, key] of [
  ["camera-angle", "camera"],
  ["probe-position", "probe"],
  ["roundness", "roundness"],
  ["partner-phase", "phase"],
  ["partner-amplitude", "ratio"],
])
  $(id).addEventListener("input", (event) => {
    state[key] = +event.target.value;
    syncControls();
  });
document.querySelectorAll("[data-direction]").forEach((button) =>
  button.addEventListener("click", () => {
    if (state.stage !== 3) {
      state.direction = +button.dataset.direction;
      syncControls();
    }
  }),
);

function updateTargets() {
  const result = evaluateMission(
    missions[state.mission],
    state.ratio,
    radians(state.phase),
  );
  for (const target of result.targets) {
    $(`target-level-${target.name}`).textContent =
      `${(target.fraction * 100).toFixed(1)}%`;
    $(`target-fill-${target.name}`).style.width = `${target.fraction * 100}%`;
  }
}
function loadMission() {
  const mission = missions[state.mission];
  state.phase = mission.startPhase;
  state.ratio = mission.startRatio;
  state.direction = -1;
  $("mission-kicker").textContent = `MISSION 0${state.mission + 1} / 03`;
  $("mission-title").textContent = mission.title;
  $("mission-description").textContent = mission.description;
  $("stage-description").textContent = mission.description;
  $("stage-insight").textContent =
    "Tune the phase and amplitude below. Then test your pattern in the mission panel. You can retry as often as you like.";
  $("mission-hint").hidden = true;
  $("mission-hint").textContent = mission.hint;
  $("show-hint").textContent = "Show a clue";
  $("mission-feedback").classList.remove("success");
  $("mission-feedback").textContent =
    "Tune the sliders, then test your pattern.";
  $("test-pattern").disabled = state.solved[state.mission];
  $("test-pattern").innerHTML = state.solved[state.mission]
    ? "Mission solved <span>✓</span>"
    : "Test this pattern <span>→</span>";
  $("next-mission").hidden = !state.solved[state.mission];
  $("next-mission").innerHTML =
    state.mission === 2
      ? "Replay the expedition <span>↻</span>"
      : "Next mission <span>→</span>";
  $("target-readouts").innerHTML = mission.targets
    .map(
      (target) =>
        `<div class="target-meter"><div class="target-meter-header"><span>Receiver ${target.name}</span><strong id="target-level-${target.name}">0%</strong></div><div class="target-track"><span id="target-fill-${target.name}"></span></div><p>${target.kind === "quiet" ? "QUIET · ≤ 4%" : "ACTIVE · ≥ 98%"}<br>z = ${target.z.toFixed(3)}λ</p></div>`,
    )
    .join("");
  if (state.solved[state.mission]) {
    $("mission-feedback").classList.add("success");
    $("mission-feedback").textContent =
      `Already solved · ${state.scores[state.mission]} / 100 points. You can explore freely or continue.`;
  }
  updateTargets();
}
$("show-hint").addEventListener("click", () => {
  $("mission-hint").hidden = !$("mission-hint").hidden;
  $("show-hint").textContent = $("mission-hint").hidden
    ? "Show a clue"
    : "Hide the clue";
});
$("test-pattern").addEventListener("click", () => {
  if (state.stage !== 3 || state.solved[state.mission]) return;
  const result = evaluateMission(
    missions[state.mission],
    state.ratio,
    radians(state.phase),
  );
  if (result.passed) {
    state.solved[state.mission] = true;
    state.scores[state.mission] = result.score;
    $("total-score").textContent = state.scores.reduce((a, b) => a + b, 0);
    $("mission-progress").textContent =
      `${state.solved.filter(Boolean).length} of 3 missions solved`;
    $("mission-feedback").classList.add("success");
    $("mission-feedback").textContent =
      `${state.mission === 2 ? "Expedition complete! " : "Pattern solved! "}${result.score} / 100 points. ${missions[state.mission].lesson}`;
    $("test-pattern").disabled = true;
    $("test-pattern").innerHTML = "Mission solved <span>✓</span>";
    $("next-mission").hidden = false;
  } else {
    $("mission-feedback").classList.remove("success");
    const missed = result.targets.filter((t) => !t.passed);
    $("mission-feedback").textContent =
      missed
        .map(
          (t) =>
            `${t.name} is at ${(t.fraction * 100).toFixed(1)}%; aim ${t.kind === "quiet" ? "at or below 4%" : "at or above 98%"}.`,
        )
        .join(" ") + " Keep tuning—there is no retry penalty.";
  }
});
$("next-mission").addEventListener("click", () => {
  if (!state.solved[state.mission]) return;
  if (state.mission === 2) {
    state.mission = 0;
    state.solved = [false, false, false];
    state.scores = [0, 0, 0];
    $("total-score").textContent = "0";
    $("mission-progress").textContent = "0 of 3 missions solved";
  } else state.mission++;
  loadMission();
  syncControls();
});
syncMotion();
selectStage(0);
