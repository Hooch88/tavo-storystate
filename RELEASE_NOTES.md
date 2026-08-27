# StoryState Release Notes

## 0.8.0-dev.2

Tavo 1.x compatibility maintenance release based directly on the verified `0.8.0-dev.1` plugin package.

### Fixed

- Replaced legacy browser/WebView JSON export handling with Tavo's native file API.
- Replaced legacy hidden file-input JSON import handling with Tavo's native file picker and file loading API.
- Added the required `file` permission to the plugin manifest.

### Preserved

- No changes to automatic scan scheduling or extraction behavior.
- No changes to NPC, relationship, Knowledge, World Arc, Activity, or Settings behavior.
- No changes to StoryState schema or campaign data.
- No changes to the Phase 4 Knowledge & Secrets, Phase 5 adapter, Phase 6 World Arc, or Structured NPC Hint features.

### Validation

Verified on Tavo 1.2.7:

- StoryState panel opens with the current six-section mobile UI.
- JSON export produces a populated `tavo-storystate` file.
- Exported state includes schema version 12 data, NPCs, relationships, knowledge, arcs, diagnostics, and scan metadata.
- JSON import successfully restores the exported state.
- Existing StoryState campaign state remains intact after updating the plugin.

### Compatibility note

A prior experimental `0.2.0-dev.2` package was built from stale repository source and is not a valid successor to the 0.8.x line. Use `0.8.0-dev.2` or later.
