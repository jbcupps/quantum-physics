# Quantum & electromagnetic

Independent website at https://quantum.spacetimemanifolds.com/.

## Ownership and deployment

- GitHub: https://github.com/jbcupps/quantum-physics
- Vercel project: quantum-physics, team jim-cupps-projects
- Production branch: main
- Framework: Other (static HTML, CSS, JavaScript)
- Build: npm run build; output: public
- DNS provider: Squarespace. Use the exact records shown in this project's Vercel Domains settings.

This repository owns only this site. It has no shared build, runtime, environment variables, or deployment dependency on the other physics sites. Pushes to main deploy only this project. Preview branches can be reviewed before merging.

## Edit and preview

Edit `public/index.html`, `public/wave-detective.html`, and `public/assets/`. Run `npm run build` to validate the static assets and page links, check JavaScript syntax, and run the numerical tests. Preview with `python scripts/serve.py`; this supports Vercel’s extensionless HTML routes at http://127.0.0.1:4175. No external packages or font/CDN requests are required.

## Waves & Fields studio

The homepage contains five interactive studies:

1. **Fourier lab** — nine editable harmonics, four presets, a 512-sample Fourier decomposition, and a low-pass reconstruction with measured energy retention.
2. **Maxwell’s atlas** — four selectable laws with a signed point charge, circular magnetic field lines, Faraday induction, and displacement current inside a capacitor gap.
3. **Anatomy of light** — a perspective vacuum plane wave with perpendicular E and B fields, a wavelength control, frequency, and photon energy.
4. **Polarization** — field-vector projection through an ideal analyzer and Malus-law transmission.
5. **Quantum packets** — a normalized Gaussian Fourier pair showing the reciprocal position and momentum widths.

`public/assets/physics.js` contains the numerical models; `studio.js` handles controls and canvas rendering. Tests check Fourier recovery and Parseval energy, flux/circulation laws, plane-wave translation, Malus’s law, and Gaussian normalization/variances. Build failures stop deployment.

The site labels its physical assumptions and links to MIT OpenCourseWare and OpenStax. The changing-flux demonstrations are quasistatic idealizations; the light wave is a vacuum plane-wave solution. Quantum coordinates are dimensionless, and the Gaussian is a snapshot at t = 0. Colors, field-line spacing, perspective, and animation rates are illustrative. The electric and magnetic fields in the light drawing use E and cB so they can share a visual amplitude scale.

Animations pause when offscreen or when the page is hidden. The operating-system reduced-motion preference disables automatic motion, and each moving experiment has a pause control. Native keyboard-operable inputs, plot descriptions, and a live Fourier data table provide alternatives to the canvas graphics.

## Wave Detective

The linked `/wave-detective` page moves from a sine-component projection to a perspective polarization helix, then changes to a shared linear polarization for interference. A view-angle control and quarter-cycle step let visitors examine the geometry and stationary nodes. Standing-wave envelopes are explicitly distinguished from circular-polarization orbits.

Three game missions ask visitors to cancel, reinforce, and jointly cancel/reinforce receivers by adjusting the second wave’s amplitude and phase. Scoring uses the analytic full-cycle amplitude, independent of animation time, frame rate, or the pause control. All missions have tested, attainable perfect solutions. Progress is held in memory for the visit, with replay available after completion.

`interference.js` supplies the models and scoring; `detective.js` draws and operates the page. Added tests check polarization geometry, the standing-wave identity, envelope/RMS agreement, stationary nodes, puzzle solvability, and protection against a paused-frame scoring shortcut.

## Network

- Home: https://spacetimemanifolds.com/ (spacetimemanifolds)
- Theories: https://theories.spacetimemanifolds.com/ (existing jbcupps/Wireframe, Vercel wireframe)
- Newtonian: https://newtonian.spacetimemanifolds.com/ (newtonian-physics)
- Relativity: https://relativity.spacetimemanifolds.com/ (relativity-physics)
- Quantum and electromagnetism: https://quantum.spacetimemanifolds.com/ (quantum-physics)

The main site's launch game is managed in the separate `spacetimemanifolds` repository.
