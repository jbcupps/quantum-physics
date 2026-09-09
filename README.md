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

Edit public/index.html and public/assets/. Run npm run build to validate. Preview with python -m http.server 4173 --directory public.

## Network

- Home: https://spacetimemanifolds.com/ (spacetimemanifolds)
- Theories: https://theories.spacetimemanifolds.com/ (existing jbcupps/Wireframe, Vercel wireframe)
- Newtonian: https://newtonian.spacetimemanifolds.com/ (newtonian-physics)
- Relativity: https://relativity.spacetimemanifolds.com/ (relativity-physics)
- Quantum and electromagnetism: https://quantum.spacetimemanifolds.com/ (quantum-physics)

The landing page and launch game were adapted from the existing Wireframe work. The game assumes uniform Earth gravity, no air resistance, and level ground. Scoring uses the analytic landing time, independent of frame rate.
