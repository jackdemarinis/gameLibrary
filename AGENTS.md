# Repository conventions

Read `STANDARDS.md` before editing this repository. It is a vendored copy of
webMaster's standards; edit the source there and run `scripts/syncStandards.py`
to update copies. Explicit user instructions take precedence.

- Use camelCase for new projects, folders, files, functions, variables, and CSS
  classes, except required framework/tool filenames and established APIs.
- Use the vendored `theme.css` tokens for UI colors, fonts, shapes, and shadows.
  Never edit the vendored theme directly: update `webMaster/shared/theme.css`
  and run `scripts/sync_theme.py`.
- Keep existing working architecture; consult `MIGRATION.md` for documented
  exceptions. Do not rename existing public contracts solely for consistency.
- Keep secrets and local runtime data out of Git. Preserve unrelated changes.
- Check relevant behavior and the documented build before reporting completion.
