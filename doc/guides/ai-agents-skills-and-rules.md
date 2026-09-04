# AI Agents — Skills & Rules (Cursor ↔ Windsurf)

This template ships ready-to-use AI-agent configuration that works the same way
in **Windsurf**, **Cursor**, and **Claude Code**. There are two distinct things:

| Concept         | What it is                                                    | Where it lives                                                               |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Rules**       | Always-/auto-applied coding constraints the agent must follow | **`.cursor/rules/*.mdc`** (canonical) ↔ `.devin/rules/` ↔ `.windsurf/rules/` |
| **Skills**      | Reusable, on-demand capabilities the agent can invoke         | **`.cursor/skills/*/SKILL.md`** ↔ `.devin/skills/` ↔ `.windsurf/skills/`     |
| **Entry point** | What every agent reads first                                  | `AGENTS.md` (re-exported by `CLAUDE.md`)                                     |

> **Single source of truth:** edit in **`.cursor/`**, then mirror into `.devin/` and `.windsurf/`.

---

## 1. The rules

Rules are small `.mdc` files with frontmatter (`description`, `alwaysApply`).

| Rule                            | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `core-engineering-rules.mdc`    | **Start here** — the tight, always-on must-follow set                |
| `security-guardrails.mdc`       | Env/secrets handling and safe terminal use                           |
| `rule-improvement.mdc`          | When and how to evolve other rules for this repo                     |
| `docs-sync.mdc`                 | Keep `doc/` and rules updated when APIs or wiring change             |
| `naming-conventions.mdc`        | camelCase folders, PascalCase component files                        |
| `path-alias-imports.mdc`        | `@/` imports only (no `./` or `../`)                                 |
| `types-and-validators.mdc`      | Types in `src/types`, Zod in feature `validator/`                    |
| `component-size-modularity.mdc` | Keep components small and focused                                    |
| `semantic-html.mdc`             | Native HTML over divs with ARIA roles                                |
| `app-default-constants.mdc`     | Use validated env/config constants                                   |
| `custom-hooks.mdc`              | Hook placement under `src/hooks/` and feature `hooks/` (glob-scoped) |

`alwaysApply: true` rules are injected into every agent turn automatically.

---

## 2. The skills

Skills are folders containing a `SKILL.md` (frontmatter `name` + `description`).

| Skill                   | Invoke with                                               | What it does                                               |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| `nextjs-best-practices` | "follow next.js best practices" / auto on App Router work | Server vs Client, data fetching, routing, caching guidance |
| `caveman`               | `/caveman` (and `lite`/`ultra`/`wenyan`)                  | Compressed responses (~65% fewer tokens)                   |
| `caveman-commit`        | `/caveman-commit`                                         | Terse Conventional Commit messages                         |
| `caveman-compress`      | `/caveman-compress <file>`                                | Compress memory files (e.g. `CLAUDE.md`)                   |
| `caveman-help`          | `/caveman-help`                                           | Cheat sheet of caveman commands                            |
| `cavecrew`              | mention "delegate to subagent"                            | Decision guide for spawning sub-agents                     |

---

## 3. Switching IDEs with the same set

Both IDEs consume the **same formats**, so "switching" is mirroring folders from
**`.cursor/`** (canonical).

```bash
# Propagate .cursor → .devin + .windsurf (manual):
# Copy .cursor/rules/* to .devin/rules/ and .windsurf/rules/
# Copy .cursor/skills/* to .devin/skills/ and .windsurf/skills/
```

After syncing, **reload the IDE window** so it re-reads the config.

### What each IDE reads

| IDE             | Rules                             | Skills                        | Entry file                |
| --------------- | --------------------------------- | ----------------------------- | ------------------------- |
| **Cursor**      | `.cursor/rules/*.mdc` (canonical) | `.cursor/skills/*/SKILL.md`   | `AGENTS.md`               |
| **Devin**       | `.devin/rules/*.mdc` (mirror)     | `.devin/skills/*/SKILL.md`    | `AGENTS.md`               |
| **Windsurf**    | `.windsurf/rules/*.mdc` (mirror)  | `.windsurf/skills/*/SKILL.md` | `AGENTS.md`               |
| **Claude Code** | `AGENTS.md` (+ skills)            | `.../skills/*/SKILL.md`       | `CLAUDE.md` → `AGENTS.md` |

> **Tip:** edit only `.cursor/rules/` and `.cursor/skills/`, then mirror to `.devin/` and `.windsurf/`.
