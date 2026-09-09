import {
  TAU,
  C,
  radians,
  preset,
  signalAt,
  sampleSignal,
  analyze,
  energyFraction,
  electricFlux,
  induction,
  planeWave,
  lightProperties,
  polarization,
  packet,
} from "./physics.js";

const $ = (id) => document.getElementById(id);
const colors = {
  cyan: "#70d6e7",
  amber: "#f0bf78",
  coral: "#eb938c",
  lavender: "#b4a4f0",
  white: "#e0e7ed",
  muted: "#8da2b5",
  grid: "#253442",
};
const palette = [
  colors.cyan,
  colors.lavender,
  colors.coral,
  "#8abf98",
  colors.amber,
  "#81acec",
  "#cba2c2",
  "#b5c8a0",
  "#9badd6",
];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const state = {
  harmonics: preset("complex"),
  coefficients: [],
  selected: 1,
  cutoff: 9,
  law: "electric",
  strength: 1,
  fieldPhase: 0,
  fieldPlaying: !reducedMotion.matches,
  lightTime: 0,
  lightPlaying: !reducedMotion.matches,
  wavelength: 550,
  polarAngle: 20,
  analyzer: 65,
  spread: 0.7,
};

// All plots share one renderer. Static plots only repaint on a change; animated
// plots stop when outside the viewport, when paused, or when the tab is hidden.
const plots = new Map();
let frameRequest = 0,
  lastFrame = 0,
  fieldReadoutTime = 0;
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const p = plots.get(entry.target.id);
      p.visible = entry.isIntersecting;
      p.dirty = true;
    }
    schedule();
  },
  { rootMargin: "80px" },
);
const resizeObserver = new ResizeObserver((entries) => {
  for (const e of entries) plots.get(e.target.id).dirty = true;
  schedule();
});
function register(id, draw, animate = () => false) {
  const canvas = $(id);
  plots.set(id, {
    canvas,
    ctx: canvas.getContext("2d"),
    draw,
    animate,
    dirty: true,
    visible: false,
  });
  observer.observe(canvas);
  resizeObserver.observe(canvas);
}
function invalidate(...ids) {
  for (const id of ids) plots.get(id).dirty = true;
  schedule();
}
function schedule() {
  if (!frameRequest && !document.hidden)
    frameRequest = requestAnimationFrame(render);
}
function render(now) {
  frameRequest = 0;
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
  lastFrame = now;
  if (document.hidden) return;
  if (plots.get("light-canvas")?.visible && state.lightPlaying)
    state.lightTime += dt;
  if (plots.get("field-canvas")?.visible && fieldIsMoving()) {
    state.fieldPhase = (state.fieldPhase + (dt * TAU) / 6) % TAU;
    if (now - fieldReadoutTime > 100) {
      updateFieldReadout();
      fieldReadoutTime = now;
    }
  }
  let keepGoing = false;
  for (const p of plots.values()) {
    const moving = p.visible && p.animate();
    if (p.visible && (p.dirty || moving)) {
      const { width, height } = p.canvas.getBoundingClientRect();
      if (width > 0 && height > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pw = Math.round(width * dpr),
          ph = Math.round(height * dpr);
        if (p.canvas.width !== pw || p.canvas.height !== ph) {
          p.canvas.width = pw;
          p.canvas.height = ph;
        }
        p.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        p.ctx.clearRect(0, 0, width, height);
        p.draw(p.ctx, width, height);
      }
      p.dirty = false;
    }
    keepGoing ||= moving;
  }
  if (keepGoing) schedule();
  else lastFrame = 0;
}
document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  schedule();
});
reducedMotion.addEventListener("change", (event) => {
  if (event.matches) {
    state.lightPlaying = false;
    state.fieldPlaying = false;
    updatePlayButtons();
    invalidate("light-canvas", "field-canvas");
  }
});
function text(
  ctx,
  value,
  x,
  y,
  color = colors.muted,
  size = 10,
  align = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function line(ctx, x1, y1, x2, y2, color = colors.grid, width = 1, dash = []) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}
function path(ctx, points, color, width = 2, dash = [], fill = null) {
  if (!points.length) return;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (fill) {
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}
function circle(ctx, x, y, r, color, fill = null, width = 1, dash = []) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.setLineDash([]);
}
function arrow(ctx, x1, y1, x2, y2, color, width = 1.4, head = 5) {
  line(ctx, x1, y1, x2, y2, color, width);
  const theta = Math.atan2(y2 - y1, x2 - x1);
  path(
    ctx,
    [
      [x2 - head * Math.cos(theta - 0.5), y2 - head * Math.sin(theta - 0.5)],
      [x2, y2],
      [x2 - head * Math.cos(theta + 0.5), y2 - head * Math.sin(theta + 0.5)],
    ],
    color,
    width,
  );
}
function graph(
  ctx,
  w,
  h,
  {
    xmin = 0,
    xmax = 1,
    ymin = -1.5,
    ymax = 1.5,
    xticks = [0, 0.25, 0.5, 0.75, 1],
    yticks = [-1, 0, 1],
    xformat = String,
    yformat = String,
  } = {},
) {
  const left = 36,
    right = w - 12,
    top = 23,
    bottom = h - 27;
  const X = (x) => left + ((x - xmin) / (xmax - xmin)) * (right - left);
  const Y = (y) => bottom - ((y - ymin) / (ymax - ymin)) * (bottom - top);
  for (const x of xticks) {
    line(ctx, X(x), top, X(x), bottom, "#20303d", 1, [2, 5]);
    text(ctx, xformat(x), X(x), bottom + 15, colors.muted, 9, "center");
  }
  for (const y of yticks) {
    line(
      ctx,
      left,
      Y(y),
      right,
      Y(y),
      y === 0 ? "#4a5e70" : "#20303d",
      1,
      y === 0 ? [] : [2, 5],
    );
    text(ctx, yformat(y), left - 10, Y(y), colors.muted, 9, "right");
  }
  return { X, Y, left, right, top, bottom };
}
function plotFunction(
  ctx,
  fn,
  g,
  xmin,
  xmax,
  color,
  width = 2,
  dash = [],
  fill = false,
) {
  const points = Array.from({ length: 601 }, (_, i) => {
    const x = xmin + ((xmax - xmin) * i) / 600;
    return [g.X(x), g.Y(fn(x))];
  });
  if (fill)
    path(
      ctx,
      [[g.X(xmin), g.Y(0)], ...points, [g.X(xmax), g.Y(0)]],
      "transparent",
      0,
      [],
      `${color}12`,
    );
  path(ctx, points, color, width, dash);
}

function drawHero(ctx, w, h) {
  const left = 15,
    right = w - 12;
  for (let x = left; x < right; x += 32)
    for (let y = 48; y < h - 47; y += 26) {
      ctx.fillStyle = "#304655";
      ctx.fillRect(x, y, 1, 1);
    }
  const row = (h - 100) / 4;
  const components = [
    { n: 1, amplitude: 0.8, phase: 0 },
    { n: 2, amplitude: 0.45, phase: 0.7 },
    { n: 3, amplitude: 0.3, phase: -1 },
  ];
  for (let k = 0; k < 4; k++) {
    const cy = 70 + k * row,
      color = k === 3 ? colors.amber : palette[k];
    line(ctx, left, cy, right, cy, "#344451", 1, [2, 5]);
    const pts = Array.from({ length: 400 }, (_, i) => {
      const t = i / 399;
      return [
        left + t * (right - left),
        cy -
          signalAt(k === 3 ? components : [components[k]], t * 1.5) *
            row *
            0.42,
      ];
    });
    path(ctx, pts, color, k === 3 ? 2.4 : 1.4);
    text(
      ctx,
      k === 3 ? "Σ" : `0${k + 1}`,
      right - 5,
      cy - row * 0.4,
      color,
      10,
      "right",
    );
  }
}
function drawComponents(ctx, w, h) {
  let active = state.harmonics.filter((harmonic) => harmonic.amplitude > 1e-8);
  if (!active.length) {
    text(
      ctx,
      "Silence. Raise an amplitude to begin.",
      w / 2,
      h / 2,
      colors.muted,
      10,
      "center",
    );
    return;
  }
  const pad = 33,
    row = (h - 35) / active.length;
  for (let i = 0; i < active.length; i++) {
    const harmonic = active[i],
      cy = 10 + row * (i + 0.5),
      color = palette[harmonic.n - 1];
    line(ctx, pad, cy, w - 12, cy, "#2b3b48", 1, [2, 4]);
    for (let t = 0.25; t < 1; t += 0.25)
      line(
        ctx,
        pad + t * (w - pad - 12),
        cy - row * 0.43,
        pad + t * (w - pad - 12),
        cy + row * 0.43,
        "#1d2b37",
      );
    text(ctx, `${harmonic.n}f`, 4, cy, color, 10);
    const scale = Math.min(row * 0.3, 29);
    path(
      ctx,
      Array.from({ length: 601 }, (_, j) => [
        pad + (j / 600) * (w - pad - 12),
        cy - signalAt([harmonic], j / 600) * scale,
      ]),
      color,
      harmonic.n === state.selected ? 2.4 : 1.5,
    );
  }
  text(ctx, "0", pad, h - 9, colors.muted, 9);
  text(ctx, "1", w - 12, h - 9, colors.muted, 9, "right");
}
function drawSum(ctx, w, h) {
  const samples = sampleSignal(state.harmonics),
    range = Math.max(
      1.5,
      Math.ceil(Math.max(...samples.map(Math.abs)) * 2) / 2 + 0.25,
    );
  const g = graph(ctx, w, h, {
    ymin: -range,
    ymax: range,
    yticks: [-Math.floor(range), 0, Math.floor(range)],
  });
  plotFunction(
    ctx,
    (t) => signalAt(state.harmonics, t),
    g,
    0,
    1,
    colors.amber,
    2.4,
    [],
    true,
  );
  // The reconstruction uses measured coefficients, not the input sliders.
  plotFunction(
    ctx,
    (t) => signalAt(state.coefficients, t, state.cutoff),
    g,
    0,
    1,
    colors.cyan,
    1.5,
    [5, 5],
  );
}
function drawSpectrum(ctx, w, h) {
  const g = graph(ctx, w, h, {
    xmin: 0.5,
    xmax: 9.5,
    ymin: 0,
    ymax: 1.45,
    xticks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    yticks: [0, 0.7, 1.4],
  });
  const barWidth = ((g.right - g.left) / 9) * 0.5;
  for (const coefficient of state.coefficients) {
    const active = coefficient.n <= state.cutoff,
      selected = coefficient.n === state.selected;
    const color = selected ? colors.amber : colors.cyan;
    ctx.fillStyle = active ? `${color}aa` : "#334351";
    const bh = g.Y(0) - g.Y(coefficient.amplitude);
    ctx.fillRect(
      g.X(coefficient.n) - barWidth / 2,
      g.Y(coefficient.amplitude),
      barWidth,
      Math.max(bh, 2),
    );
    if (active)
      line(
        ctx,
        g.X(coefficient.n) - barWidth / 2,
        g.Y(coefficient.amplitude),
        g.X(coefficient.n) + barWidth / 2,
        g.Y(coefficient.amplitude),
        color,
        2,
      );
    if (selected)
      text(
        ctx,
        coefficient.amplitude.toFixed(2),
        g.X(coefficient.n),
        Math.max(12, g.Y(coefficient.amplitude) - 12),
        colors.amber,
        9,
        "center",
      );
  }
  text(ctx, "Aₙ", 5, 12, colors.muted, 10);
  text(ctx, "harmonic n", w - 10, 11, colors.muted, 9, "right");
}
function syncHarmonicControls() {
  const h = state.harmonics[state.selected - 1];
  $("harmonic").value = String(state.selected);
  $("amplitude").value = h.amplitude;
  $("phase").value = Math.round((h.phase * 180) / Math.PI);
  $("amplitude-value").textContent = h.amplitude.toFixed(2);
  $("phase-value").textContent = `${Math.round((h.phase * 180) / Math.PI)}°`;
}
function updateFourier() {
  state.coefficients = analyze(sampleSignal(state.harmonics));
  const selected = state.coefficients[state.selected - 1];
  const active = state.harmonics.filter((h) => h.amplitude > 1e-8).length;
  $("component-count").textContent =
    `${active} active harmonic${active === 1 ? "" : "s"}`;
  $("cutoff-value").textContent = state.cutoff;
  $("projection-n").textContent = state.selected;
  const energy = energyFraction(state.coefficients, state.cutoff);
  $("energy-value").innerHTML =
    energy === null ? "—" : `${(100 * energy).toFixed(1)}<span>%</span>`;
  $("filter-note").textContent =
    energy === null
      ? "The signal is zero: there is no energy to retain."
      : state.cutoff === 9
        ? "All nine frequencies are available to the reconstruction."
        : `The cyan curve keeps frequencies up to ${state.cutoff}/T. Gray spectrum bars are excluded.`;
  const clean = (number) => (Math.abs(number) < 0.0005 ? 0 : number).toFixed(3);
  $("coefficients").textContent =
    `a${selected.n} = ${clean(selected.a)} · b${selected.n} = ${clean(selected.b)}`;
  $("measured-phase").textContent =
    selected.amplitude < 1e-8
      ? "No amplitude · phase undefined"
      : `${((selected.phase * 180) / Math.PI).toFixed(1)}° recovered`;
  $("fourier-data").innerHTML = state.coefficients
    .map(
      (h) =>
        `<tr><td>${h.n}</td><td>${h.amplitude.toFixed(4)}</td><td>${h.amplitude < 1e-8 ? "—" : ((h.phase * 180) / Math.PI).toFixed(1) + "°"}</td><td>${h.n <= state.cutoff ? "Yes" : "No"}</td></tr>`,
    )
    .join("");
  invalidate("components-canvas", "sum-canvas", "spectrum-canvas");
}
document.querySelectorAll("[data-preset]").forEach((button) =>
  button.addEventListener("click", () => {
    state.harmonics = preset(button.dataset.preset);
    state.cutoff = 9;
    state.selected = 1;
    $("cutoff").value = "9";
    document
      .querySelectorAll("[data-preset]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    $("fourier-shape").textContent = button.textContent;
    syncHarmonicControls();
    updateFourier();
  }),
);
$("harmonic").addEventListener("change", (event) => {
  state.selected = +event.target.value;
  syncHarmonicControls();
  updateFourier();
});
for (const id of ["amplitude", "phase"])
  $(id).addEventListener("input", () => {
    const h = state.harmonics[state.selected - 1];
    h.amplitude = +$("amplitude").value;
    h.phase = radians(+$("phase").value);
    $("amplitude-value").textContent = h.amplitude.toFixed(2);
    $("phase-value").textContent = `${$("phase").value}°`;
    document
      .querySelectorAll("[data-preset]")
      .forEach((b) => b.setAttribute("aria-pressed", "false"));
    $("fourier-shape").textContent = "Your custom wave";
    updateFourier();
  });
$("cutoff").addEventListener("input", (event) => {
  state.cutoff = +event.target.value;
  updateFourier();
});

const lawContent = {
  electric: {
    title: "A POINT CHARGE IN SPACE",
    control: "Charge Q",
    result: "FLUX THROUGH THE SPHERE",
    explanation:
      "Field lines point away from a positive charge and toward a negative one. The dashed circle is a section through a spherical Gaussian surface. Every enclosing sphere has the same total electric flux.",
  },
  magnetic: {
    title: "CLOSED MAGNETIC FIELD LINES",
    control: "Wire current I",
    result: "NET FLUX THROUGH ANY CLOSED SURFACE",
    explanation:
      "A long straight wire carries current perpendicular to the screen. Its magnetic field circles the wire. Through a closed surface, magnetic flux entering equals magnetic flux leaving: there is no isolated magnetic charge.",
  },
  faraday: {
    title: "A CHANGING MAGNETIC FLUX",
    control: "Magnetic amplitude B₀",
    result: "INDUCED ELECTRIC FIELD AT r = 1 m",
    explanation:
      "The amber symbols show an axial magnetic field: a dot points out of the screen; a cross points in. Cyan arrows show the circulating electric field. The minus sign makes its circulation oppose the change in magnetic flux.",
  },
  ampere: {
    title: "INSIDE A CAPACITOR GAP",
    control: "Electric amplitude E₀",
    result: "INDUCED MAGNETIC FIELD AT r = 1 m",
    explanation:
      "Look along a circular capacitor’s axis. Its changing electric flux produces a circulating magnetic field, even though no conduction current crosses the vacuum gap. This is Maxwell’s displacement-current term.",
  },
};
function dynamicLaw() {
  return state.law === "faraday" || state.law === "ampere";
}
function fieldIsMoving() {
  return dynamicLaw() && state.fieldPlaying;
}
function fieldValues() {
  return induction(
    state.strength * (state.law === "faraday" ? 1e-3 : 1e6),
    state.fieldPhase,
    state.law,
  );
}
function updatePlayButtons() {
  $("light-play").textContent = state.lightPlaying
    ? "Pause motion"
    : "Play motion";
  $("field-play").disabled = !dynamicLaw();
  $("field-play").textContent = !dynamicLaw()
    ? "Static field"
    : state.fieldPlaying
      ? "Pause cycle"
      : "Play cycle";
}
function updateFieldReadout() {
  const unit = { electric: "nC", magnetic: "A", faraday: "mT", ampere: "MV/m" }[
    state.law
  ];
  $("field-strength-value").textContent =
    `${state.strength > 0 ? "+" : ""}${state.strength.toFixed(1)} ${unit}`;
  if (state.law === "electric")
    $("field-result").textContent =
      `${electricFlux(state.strength * 1e-9).toFixed(2)} N·m²/C`;
  else if (state.law === "magnetic")
    $("field-result").textContent = "ΦB = 0 Wb";
  else {
    const values = fieldValues();
    const value = values.circulating * (state.law === "faraday" ? 1e3 : 1e12);
    const direction =
      Math.abs(value) < 0.0005
        ? "zero"
        : value > 0
          ? "counterclockwise"
          : "clockwise";
    $("field-result").textContent =
      `${Math.abs(value).toFixed(2)} ${state.law === "faraday" ? "mV/m" : "pT"} · ${direction}`;
    const degrees = Math.round((state.fieldPhase * 180) / Math.PI);
    $("field-time").value = degrees;
    $("field-time-value").textContent = `${degrees}°`;
  }
}
function selectLaw(law) {
  state.law = law;
  state.strength = 1;
  state.fieldPhase = 0;
  const content = lawContent[law];
  $("field-title").textContent = content.title;
  $("field-result-label").textContent = content.result;
  $("field-explanation").textContent = content.explanation;
  // Preserve the associated output element while updating the visible label.
  $("field-control-label").firstChild.textContent = content.control + " ";
  $("field-strength").value = "1";
  $("field-strength").min = dynamicLaw() ? "0" : "-3";
  $("field-time-control").hidden = !dynamicLaw();
  document
    .querySelectorAll("[data-law]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.law === law)),
    );
  updatePlayButtons();
  updateFieldReadout();
  invalidate("field-canvas");
}
document
  .querySelectorAll("[data-law]")
  .forEach((button) =>
    button.addEventListener("click", () => selectLaw(button.dataset.law)),
  );
$("field-strength").addEventListener("input", (event) => {
  state.strength = +event.target.value;
  updateFieldReadout();
  invalidate("field-canvas");
});
$("field-time").addEventListener("input", (event) => {
  state.fieldPlaying = false;
  state.fieldPhase = radians(+event.target.value);
  updatePlayButtons();
  updateFieldReadout();
  invalidate("field-canvas");
});
$("field-time").addEventListener("focus", () => {
  state.fieldPlaying = false;
  updatePlayButtons();
});
$("field-play").addEventListener("click", () => {
  state.fieldPlaying = !state.fieldPlaying;
  updatePlayButtons();
  invalidate("field-canvas");
});
function circularArrows(
  ctx,
  cx,
  cy,
  radius,
  direction,
  color,
  count = 8,
  opacity = 1,
) {
  if (!direction) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  circle(ctx, cx, cy, radius, `${color}50`);
  for (let i = 0; i < count; i++) {
    // Screen y points down. A positive physical theta therefore decreases it.
    const a = (i * TAU) / count;
    const b = a + direction * 0.22;
    arrow(
      ctx,
      cx + radius * Math.cos(a),
      cy - radius * Math.sin(a),
      cx + radius * Math.cos(b),
      cy - radius * Math.sin(b),
      color,
      1.5,
      5,
    );
  }
  ctx.restore();
}
function axialSymbols(ctx, cx, cy, radius, value, color) {
  const opacity = Math.min(1, Math.abs(value));
  ctx.save();
  ctx.globalAlpha = opacity;
  for (let x = -radius + 14; x < radius; x += 28)
    for (let y = -radius + 14; y < radius; y += 28) {
      if (x * x + y * y > (radius - 10) ** 2) continue;
      circle(ctx, cx + x, cy + y, 5, `${color}80`);
      if (value > 0) circle(ctx, cx + x, cy + y, 1.2, color, color);
      else {
        line(ctx, cx + x - 2, cy + y - 2, cx + x + 2, cy + y + 2, color);
        line(ctx, cx + x + 2, cy + y - 2, cx + x - 2, cy + y + 2, color);
      }
    }
  ctx.restore();
}
function drawField(ctx, w, h) {
  const cx = w / 2,
    cy = h * 0.48,
    radius = Math.min(w * 0.28, h * 0.34);
  for (let x = 20; x < w; x += 26)
    for (let y = 20; y < h - 22; y += 26) {
      ctx.fillStyle = "#22333f";
      ctx.fillRect(x, y, 1, 1);
    }
  if (state.law === "electric") {
    const q = state.strength;
    circle(ctx, cx, cy, radius * 0.78, "#a4b8c6", "#70d6e704", 1, [4, 5]);
    if (q !== 0)
      for (let i = 0; i < 18; i++) {
        const a = (i * TAU) / 18,
          r0 = 24,
          r1 = radius * 1.2;
        const color = q > 0 ? colors.cyan : colors.coral;
        ctx.save();
        ctx.globalAlpha = Math.min(1, 0.35 + Math.abs(q) * 0.22);
        line(
          ctx,
          cx + r0 * Math.cos(a),
          cy + r0 * Math.sin(a),
          cx + r1 * Math.cos(a),
          cy + r1 * Math.sin(a),
          `${color}80`,
        );
        for (const r of [radius * 0.45, radius]) {
          const length = 7 + 3 * Math.abs(q),
            end = r + Math.sign(q) * length;
          arrow(
            ctx,
            cx + r * Math.cos(a),
            cy + r * Math.sin(a),
            cx + end * Math.cos(a),
            cy + end * Math.sin(a),
            color,
            1.2,
            4,
          );
        }
        ctx.restore();
      }
    circle(ctx, cx, cy, 19, q < 0 ? colors.coral : colors.cyan, "#17333e", 1.5);
    text(
      ctx,
      q === 0 ? "0" : q > 0 ? "+" : "−",
      cx,
      cy,
      colors.white,
      23,
      "center",
    );
    text(
      ctx,
      "Gaussian sphere · section",
      cx,
      h - 24,
      colors.muted,
      10,
      "center",
    );
    text(
      ctx,
      "E",
      cx + radius * 0.9,
      cy - radius * 0.82,
      q < 0 ? colors.coral : colors.cyan,
      14,
    );
  } else if (state.law === "magnetic") {
    for (const fraction of [0.36, 0.64, 0.92, 1.15])
      circularArrows(
        ctx,
        cx,
        cy,
        radius * fraction,
        Math.sign(state.strength),
        colors.coral,
        8,
        Math.min(1, 0.2 + Math.abs(state.strength) * 0.3),
      );
    const bx = cx + radius * 0.15,
      by = cy - radius * 0.65,
      bw = radius * 0.64,
      bh = radius * 1.3;
    path(
      ctx,
      [
        [bx, by],
        [bx + bw, by],
        [bx + bw, by + bh],
        [bx, by + bh],
        [bx, by],
      ],
      "#c1c9d1",
      1,
      [4, 5],
    );
    circle(ctx, cx, cy, 17, colors.amber, "#2e2a23");
    text(
      ctx,
      state.strength > 0 ? "⊙" : state.strength < 0 ? "⊗" : "0",
      cx,
      cy,
      colors.amber,
      22,
      "center",
    );
    text(ctx, "I", cx - 28, cy, colors.amber, 13, "right");
    text(
      ctx,
      "Closed surface · section",
      cx,
      h - 24,
      colors.muted,
      10,
      "center",
    );
  } else {
    const faraday = state.law === "faraday";
    const { field, derivative, circulating } = fieldValues();
    const fieldUnit = faraday ? 1e-3 : 1e6;
    const sourceColor = faraday ? colors.amber : colors.cyan,
      inducedColor = faraday ? colors.cyan : colors.coral;
    circle(
      ctx,
      cx,
      cy - 10,
      radius * 0.76,
      `${sourceColor}90`,
      `${sourceColor}08`,
      1,
      [4, 5],
    );
    axialSymbols(
      ctx,
      cx,
      cy - 10,
      radius * 0.76,
      field / fieldUnit,
      sourceColor,
    );
    const strength = Math.abs(derivative / (TAU * fieldUnit * 3));
    if (strength > 1e-7)
      circularArrows(
        ctx,
        cx,
        cy - 10,
        radius,
        Math.sign(circulating),
        inducedColor,
        9,
        0.2 + 0.8 * strength,
      );
    else circle(ctx, cx, cy - 10, radius, "#324450", null, 1, [3, 5]);
    text(
      ctx,
      faraday ? "Eθ" : "Bθ",
      cx + radius + 8,
      cy - 10,
      inducedColor,
      11,
    );
    text(
      ctx,
      `${faraday ? "B" : "E"} = ${(field / fieldUnit).toFixed(2)} ${faraday ? "mT" : "MV/m"}`,
      cx,
      21,
      sourceColor,
      10,
      "center",
    );
    // Signal and induced field are a quarter cycle apart. A cursor links time
    // to both the field direction above and the numerical result below.
    const x0 = Math.max(28, cx - 140),
      x1 = Math.min(w - 28, cx + 140),
      y0 = h - 37;
    line(ctx, x0, y0, x1, y0, "#354757");
    const amp = state.strength === 0 ? 0 : 12;
    path(
      ctx,
      Array.from({ length: 201 }, (_, i) => [
        x0 + ((x1 - x0) * i) / 200,
        y0 - amp * Math.sin((TAU * i) / 200),
      ]),
      sourceColor,
      1.5,
    );
    path(
      ctx,
      Array.from({ length: 201 }, (_, i) => [
        x0 + ((x1 - x0) * i) / 200,
        y0 - amp * (faraday ? -1 : 1) * Math.cos((TAU * i) / 200),
      ]),
      inducedColor,
      1.5,
      [3, 3],
    );
    const x = x0 + ((x1 - x0) * state.fieldPhase) / TAU;
    line(ctx, x, y0 - 19, x, y0 + 19, colors.white, 1);
    text(ctx, "Source", x0, h - 11, sourceColor, 8);
    text(ctx, "Induced · normalized", x1, h - 11, inducedColor, 8, "right");
  }
}

function drawLight(ctx, w, h) {
  const mobile = w < 500;
  const left = mobile ? 68 : 110,
    length = w - left - (mobile ? 36 : 90),
    baseline = h * 0.62,
    slope = h * 0.18,
    amp = h * 0.24;
  const P = (z, E = 0, B = 0) => [
    left + z * length - B * amp * 0.6,
    baseline - z * slope - E * amp + B * amp * 0.47,
  ];
  for (const v of [-1, -0.5, 0, 0.5, 1]) {
    path(ctx, [P(0, v, 0), P(1, v, 0)], "#2c42524d", 1);
    path(ctx, [P(0, 0, v), P(1, 0, v)], "#463e4a60", 1);
  }
  for (let i = 0; i <= 12; i++) {
    path(ctx, [P(i / 12, -1, 0), P(i / 12, 1, 0)], "#273c4c70", 1);
    path(ctx, [P(i / 12, 0, -1), P(i / 12, 0, 1)], "#423a4670", 1);
  }
  // The same tested SI solution drives the drawing; the time conversion slows
  // a 550 nm wave to 0.4 visible cycles per second, without changing phase speed.
  const value = (z) =>
    planeWave(
      z * 1800e-9,
      (state.lightTime * 0.4 * 550e-9) / C,
      state.wavelength * 1e-9,
    ).E;
  const count = 220;
  for (const magnetic of [true, false]) {
    const color = magnetic ? colors.coral : colors.cyan;
    const endpoint = (z) => (magnetic ? P(z, 0, value(z)) : P(z, value(z), 0));
    for (let i = 0; i < count; i++) {
      const z0 = i / count,
        z1 = (i + 1) / count;
      path(
        ctx,
        [P(z0), endpoint(z0), endpoint(z1), P(z1)],
        "transparent",
        0,
        [],
        `${color}13`,
      );
    }
    path(
      ctx,
      Array.from({ length: count + 1 }, (_, i) => endpoint(i / count)),
      color,
      2.2,
    );
    for (let i = 0; i <= 42; i++) {
      const z = i / 42,
        a = P(z),
        b = endpoint(z);
      if (Math.abs(value(z)) > 0.06)
        arrow(ctx, ...a, ...b, `${color}99`, 0.9, 3);
    }
  }
  arrow(ctx, ...P(0), ...P(1.035), "#c2d1dc", 1.2, 5);
  arrow(ctx, ...P(0, -1.05, 0), ...P(0, 1.2, 0), "#597b8c", 1, 4);
  arrow(ctx, ...P(0, 0, -1.03), ...P(0, 0, 1.18), "#8c626a", 1, 4);
  text(ctx, "E · x", ...P(0, 1.38, 0), colors.cyan, 11, "center");
  const magneticLabel = P(0, 0, 1.35);
  text(
    ctx,
    "cB · y",
    Math.max(30, magneticLabel[0]),
    magneticLabel[1],
    colors.coral,
    10,
    "center",
  );
  text(ctx, "+z", ...P(1.07), colors.white, 11, "center");
  const labelX = w * 0.63,
    labelY = h - 35;
  arrow(ctx, labelX - 28, labelY, labelX + 60, labelY, colors.white, 1.2, 5);
  text(
    ctx,
    "Energy flow · E × B",
    labelX + 16,
    labelY + 17,
    colors.muted,
    9,
    "center",
  );
  text(
    ctx,
    "E ⟂ B ⟂ direction of travel",
    w / 2,
    28,
    colors.muted,
    mobile ? 9 : 10,
    "center",
  );
}
function updateLight() {
  const result = lightProperties(state.wavelength);
  $("wavelength-value").textContent = `${state.wavelength} nm`;
  $("frequency-value").innerHTML =
    `${(result.frequency / 1e12).toFixed(0)}<span>THz</span>`;
  $("photon-value").innerHTML =
    `${result.photonEnergyEV.toFixed(2)}<span>eV</span>`;
  invalidate("light-canvas");
}
$("wavelength").addEventListener("input", (event) => {
  state.wavelength = +event.target.value;
  updateLight();
});
$("light-play").addEventListener("click", () => {
  state.lightPlaying = !state.lightPlaying;
  updatePlayButtons();
  invalidate("light-canvas");
});

function drawPolar(ctx, w, h) {
  const cx = w / 2,
    cy = h * 0.37,
    r = Math.min(w * 0.26, h * 0.26);
  const a = radians(state.polarAngle),
    b = radians(state.analyzer),
    result = polarization(state.polarAngle, state.analyzer);
  const P = (angle, length) => [
    cx + Math.cos(angle) * length,
    cy - Math.sin(angle) * length,
  ];
  for (const fraction of [0.5, 1])
    circle(ctx, cx, cy, r * fraction, "#2b3e4d", null, 1, [3, 5]);
  line(ctx, cx - r - 18, cy, cx + r + 18, cy, "#354654");
  line(ctx, cx, cy - r - 15, cx, cy + r + 15, "#354654");
  text(ctx, "0°", cx + r + 24, cy, colors.muted, 9);
  text(ctx, "90°", cx, cy - r - 25, colors.muted, 9, "center");
  path(ctx, [P(b, -r * 1.13), P(b, r * 1.13)], colors.lavender, 2, [5, 5]);
  const tip = P(a, r),
    projected = P(b, r * result.projection);
  path(ctx, [tip, projected], "#b4a4f090", 1, [3, 4]);
  arrow(ctx, cx, cy, ...tip, colors.cyan, 2.5, 7);
  if (Math.abs(result.projection) > 0.005)
    arrow(ctx, cx, cy, ...projected, colors.amber, 3, 6);
  circle(ctx, cx, cy, 3, colors.white, colors.white);
  const legendY = cy + r + 35;
  text(ctx, "E in", cx - r, legendY, colors.cyan, 9);
  text(ctx, "Analyzer", cx, legendY, colors.lavender, 9, "center");
  text(ctx, "E passed", cx + r, legendY, colors.amber, 9, "right");
  const beamY = h - 63,
    start = 32,
    finish = w - 32,
    filterX = w * 0.5;
  const gradient = ctx.createLinearGradient(start, 0, filterX, 0);
  gradient.addColorStop(0, "#70d6e708");
  gradient.addColorStop(1, "#70d6e755");
  ctx.fillStyle = gradient;
  ctx.fillRect(start, beamY - 14, filterX - start, 28);
  const out = ctx.createLinearGradient(filterX, 0, finish, 0);
  out.addColorStop(0, `rgba(240,191,120,${result.intensity * 0.6})`);
  out.addColorStop(1, `rgba(240,191,120,${result.intensity * 0.15})`);
  ctx.fillStyle = out;
  ctx.fillRect(filterX, beamY - 14, finish - filterX, 28);
  arrow(ctx, start, beamY, filterX - 8, beamY, colors.cyan, 1.3, 5);
  if (result.intensity > 0.0001) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.1, result.intensity);
    arrow(ctx, filterX + 10, beamY, finish, beamY, colors.amber, 1.3, 5);
    ctx.restore();
  }
  path(
    ctx,
    [
      [filterX - 9, beamY - 28],
      [filterX + 9, beamY - 21],
      [filterX + 9, beamY + 28],
      [filterX - 9, beamY + 21],
      [filterX - 9, beamY - 28],
    ],
    colors.lavender,
    1.3,
    [],
    "#211e36",
  );
  for (let y = -16; y <= 16; y += 8)
    line(
      ctx,
      filterX - 4,
      beamY + y - 2,
      filterX + 4,
      beamY + y + 1,
      "#b4a4f090",
    );
  text(ctx, "I₀ = 100%", start, beamY + 37, colors.muted, 9);
  text(
    ctx,
    `I = ${(result.intensity * 100).toFixed(1)}%`,
    finish,
    beamY + 37,
    colors.amber,
    9,
    "right",
  );
}
function updatePolar() {
  const result = polarization(state.polarAngle, state.analyzer);
  $("polar-angle-value").textContent = `${state.polarAngle}°`;
  $("analyzer-angle-value").textContent = `${state.analyzer}°`;
  $("angle-difference").textContent = `${result.angle.toFixed(0)}°`;
  $("intensity-value").textContent = `${(100 * result.intensity).toFixed(1)}%`;
  $("intensity-fill").style.width = `${100 * result.intensity}%`;
  invalidate("polar-canvas");
}
$("polar-angle").addEventListener("input", (event) => {
  state.polarAngle = +event.target.value;
  updatePolar();
});
$("analyzer-angle").addEventListener("input", (event) => {
  state.analyzer = +event.target.value;
  updatePolar();
});
$("cross-polarizers").addEventListener("click", () => {
  state.analyzer = (state.polarAngle + 90) % 180;
  $("analyzer-angle").value = state.analyzer;
  updatePolar();
});

function drawMomentum(ctx, w, h) {
  const model = packet(state.spread);
  const g = graph(ctx, w, h, {
    xmin: -1,
    xmax: 11,
    ymin: 0,
    ymax: 1.3,
    xticks: [0, 2, 4, 6, 8, 10],
    yticks: [0, 0.5, 1],
  });
  ctx.fillStyle = "#b4a4f015";
  ctx.fillRect(
    g.X(5 - state.spread),
    g.top,
    g.X(5 + state.spread) - g.X(5 - state.spread),
    g.bottom - g.top,
  );
  plotFunction(
    ctx,
    model.momentumDensity,
    g,
    -1,
    11,
    colors.lavender,
    2.4,
    [],
    true,
  );
  line(ctx, g.X(5), g.top, g.X(5), g.bottom, "#b4a4f080", 1, [3, 5]);
  text(ctx, "k₀ = 5", g.X(5), 11, colors.lavender, 9, "center");
  text(
    ctx,
    `Δk = ${state.spread.toFixed(2)}`,
    w - 12,
    11,
    colors.lavender,
    9,
    "right",
  );
}
function drawPosition(ctx, w, h) {
  const model = packet(state.spread);
  const g = graph(ctx, w, h, {
    xmin: -5,
    xmax: 5,
    ymin: -1.2,
    ymax: 1.65,
    xticks: [-4, -2, 0, 2, 4],
    yticks: [-1, 0, 1],
  });
  ctx.fillStyle = "#f0bf7810";
  ctx.fillRect(
    g.X(-model.sigmaX),
    g.top,
    g.X(model.sigmaX) - g.X(-model.sigmaX),
    g.bottom - g.top,
  );
  plotFunction(ctx, model.realPsi, g, -5, 5, colors.cyan, 1.3);
  plotFunction(
    ctx,
    model.positionDensity,
    g,
    -5,
    5,
    colors.amber,
    2.5,
    [],
    true,
  );
  text(
    ctx,
    `Δx = ${model.sigmaX.toFixed(3)}`,
    w - 12,
    11,
    colors.amber,
    9,
    "right",
  );
}
$("spread").addEventListener("input", (event) => {
  state.spread = +event.target.value;
  $("spread-value").textContent = state.spread.toFixed(2);
  $("position-spread").textContent = packet(state.spread).sigmaX.toFixed(3);
  invalidate("momentum-canvas", "position-canvas");
});

register("hero-canvas", drawHero);
register("components-canvas", drawComponents);
register("sum-canvas", drawSum);
register("spectrum-canvas", drawSpectrum);
register("field-canvas", drawField, fieldIsMoving);
register("light-canvas", drawLight, () => state.lightPlaying);
register("polar-canvas", drawPolar);
register("momentum-canvas", drawMomentum);
register("position-canvas", drawPosition);
syncHarmonicControls();
updateFourier();
updateFieldReadout();
updateLight();
updatePolar();
updatePlayButtons();
schedule();
