# Changelog

## v0.1.0 — 2026-10-22

First open-source snapshot of the JavaScript demo.

- Tetrahedral and cubic boards with shape-specific adjacency rules.
- Drag rotation, wheel zoom, selectable cells, flags and safe first click.
- Surface-only manual play and an optional free-exploration mode with slices.
- Complete zero-region expansion and win/loss detection.
- Translucent green clue shells with face-attached, readable numbers.
- Hover focus and pulsing neighbor highlights without clue connection lines.
- Offline, dependency-free browser play, plus an optional local Node.js server.
- Core rule and geometry tests.

Known limits: randomly generated layouts can require guesses, and surface-only play can leave inaccessible safe cells. The renderer is an experimental Canvas 2D projection rather than a full 3D engine.
