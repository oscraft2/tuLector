# TuLector OMR Clean-Room Spec

This document is the implementation contract for TuLector's OMR engine. It is derived from observable behavior and local reference notes, not from copied native code or proprietary model files.

## Scope

The engine must accept camera frames or fixture images, detect the answer sheet, normalize perspective, classify bubbles, read student ID rows, and return deterministic diagnostic output.

## Return Codes

| Code | Name | Meaning |
| --- | --- | --- |
| `1` | `GRADED` | Sheet was detected and graded. |
| `5` | `BRIGHT` | Glare or excessive highlight made regions unreliable. |
| `10` | `CURVE_FAIL` | Sheet geometry indicates curve/fold/strong deformation. |
| `30` | `WRONG_FORMAT` | Expected answer-sheet structure was not found. |
| `100` | `ALIGN_START` | User must align all four corner markers. |
| `106` | `ALIGN_END` | Sheet is aligned but focus/stability is not ready. |
| `1001` | `OUT_OF_FOCUS` | Frame is too blurred or no answers can be trusted. |

## Frame Pipeline

1. Convert the camera frame to a luminance plane.
2. Detect four corner markers by quadrant.
3. Validate quadrilateral geometry.
4. Warp the paper to the canonical `1200x1650` coordinate space.
5. Validate format marks, ID bubbles, and answer grid structure.
6. Score every answer bubble and ID bubble.
7. Reject glare, curve, wrong-format, and no-answer cases before returning final answers.
8. Save debug artifacts when enabled: input frame, corners, warped sheet, scores, and failure reason.

## Canonical Layout (sheet v2)

Defined once in `src/lib/sheet_layout.ts` and consumed by the sheet generator,
the engine, the fixture generator, and mirrored in the native engine.

| Field | Value |
| --- | --- |
| Sheet width / height | `1200` / `1650` |
| Anchors (solid) | 4 corners `(70,70)`,`(1130,70)`,`(1130,1580)`,`(70,1580)`. Edge anchors removed (interfered with corner detection on real photos). |
| Anchor size | `40` (solid filled black) |
| Corner detection | connected-components (Otsu + solid square blobs + extreme points); falls back to grid-blob then center-of-mass |
| Timing track | one solid mark per question row at `x≈120` (left margin) → physical row registration (linear-fit, tolerates missing marks) |
| Questions / Options | `20` / `A-E` (target: parametric, see `hoja-parametrica-spec.md`) |
| Question rows | `cy(q) = 340 + q*60 + 14` |
| Option centers | `x = 200 + o*64` (A..E); `y = timing row, fallback cy(q)` |
| Bubble radius | `15` (outline drawn in light gray, not black) |
| RUT field (Chile) | 8 digit cols + 1 DV col (0-9 + K), `x = 640 + c*40`, `y = 252 + d*27`, r `8`. DV validated by módulo 11 (`readRut`/`computeRutDV`). Replaces the legacy 3×10 ID grid. |

Both engines (web `omr.ts` and native `omr_engine.cpp`) implement: connected-components
corner detection, dest→src homography warp, timing-track + linear-fit registration,
mark calibration (`minPick` 0.05 + dominance 0.02), and RUT reading with DV validation.

## Calibration Constants (single source of truth)

These values live in `src/lib/omr.ts` (`CALIB`) and must be mirrored byte-for-byte
in `mobile/native/omr_engine.cpp` (`CALIB_*`). The web headless test
(`npm run test:omr`) is the regression guard for any change here.

| Constant | Value | Meaning |
| --- | --- | --- |
| `bubbleRadius` | `10` | ROI sampling radius per bubble |
| `relThresh` | `0.55` | mark threshold relative to the question's best score |
| `absThresh` | `0.15` | absolute minimum score to treat an option as marked |
| `minPick` | `0.12` | minimum score to pick the max when nothing clears the threshold |
| `gridSearch` dx/dy/step | `6 / 8 / 2` | local grid-registration search window (px) |

## Local Grid Registration

The 4-corner homography only corrects planar perspective. Paper bow, lens
distortion, or sub-pixel corner error shift mid-page bubbles off the theoretical
coordinates. Before scoring, the engine searches a small `(dx, dy)` offset window
and picks the offset that maximizes concentrated darkness at the expected bubble
centers, then applies it to every bubble ROI. On a geometrically perfect image
the optimum is `(0, 0)`, so the ideal case is unaffected.

## Glare Handling

Per-bubble glare flags only invalidate a question when the glare covers the
*winning* (highest-score) option — i.e. a reflection sitting on the actual mark.
Blank options that merely sample as bright must not turn the whole question into
`?`, and must not by themselves trip the aggregate "too much glare" rejection.

## Clean-Room Compatibility Targets

The current reference notes mention a native CameraX pipeline, SVM-based bubble classifiers, glare detection, and raw image saving for retraining. TuLector should match the behavior and diagnostics with its own implementation:

- Corner detection: adaptive thresholding, morphology/contour grouping, quadrant assignment.
- Bubble classification: local features plus a trained TuLector-owned model.
- Camera: preserve plane stride, pixel stride, rotation, and focus metadata in debug logs.
- Training loop: store warped images and per-bubble features only from TuLector scans.

## Test Requirements

Tests must use the same production modules as the app. Synthetic perfect images are useful only as smoke tests. Release readiness requires fixtures from real printed sheets:

- aligned digital sheet,
- printed straight sheet,
- perspective skew,
- low light,
- shadows,
- faint pencil,
- strong marker,
- glare,
- folded or curved paper,
- wrong sheet format.

Each fixture must include expected answers, expected ID, expected result code, and acceptable corner tolerance.