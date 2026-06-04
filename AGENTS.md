# Agent Instructions

Load compact context first:
- `.agent/tf.ctx`
- `.agent/spec.idx`
- changed files
- nearby tests

Do not load by default:
- `session-ses_*.md`
- `specs/session-ses_*.md`
- `docs/archive/`
- `.opencode/node_modules/`
- `Volumes/`
- `node_modules/`

Use verbose specs only when named by `.agent/spec.idx` or directly relevant.
