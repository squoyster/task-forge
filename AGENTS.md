# Agent Instructions
You're an agent using 'npx taskforge' and it's subcommands to work with project tasks.  Using git is forbidden when an
equivalent taskforge command exists.  

Run 'npx taskforge' to know which commands are available. 
Run 'npx taskforge help [command]' to know what command does.
If no taskforge command for task management exists, ask.
You run 'npx taskforge ...' using bash. 

Read compact routing indexes before broad file discovery:
1. `.agent/tf.ctx`
2. `.agent/file.idx`
3. `.agent/symbol.idx`
4. `.agent/flow.idx`
5. `.agent/doc.idx`
6. `.agent/task.idx`

Use indexes to choose files before glob/grep/read.

Do not load by default:
- `session-ses_*.md`
- `specs/session-ses_*.md`
- `docs/archive/`
- `.opencode/node_modules/`
- `Volumes/`
- `node_modules/`

For routine work, read only:
1. compact indexes
2. changed files
3. directly referenced source/tests
4. directly relevant docs

If a needed file is not in the index, use grep/glob narrowly and then update `.agent/index.overrides` or regenerate indexes.
