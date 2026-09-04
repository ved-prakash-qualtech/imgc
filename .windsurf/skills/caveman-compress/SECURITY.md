# Security Policy for caveman-compress

## Purpose

This skill compresses natural language files to reduce input tokens. It does not execute code or modify sensitive files.

## File Handling

- Only processes natural language files (.md, .txt, .typ, .typst, .tex, extensionless)
- NEVER modifies: .py, .js, .ts, .json, .yaml, .yml, .toml, .env, .lock, .css, .html, .xml, .sql, .sh
- Original file is backed up as FILE.original.md before overwriting
- Never processes FILE.original.md (skips it)

## Data Privacy

- All processing happens locally via Claude API
- No data is sent to external services other than Claude
- No persistent storage of file contents outside the backup

## Safe Execution

- The compression scripts in `scripts/` are read-only validation scripts
- No code execution beyond calling Claude for compression
- If compression fails after 2 retries, original file is left untouched
