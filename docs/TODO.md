# StoryState TODO

This file collects non-critical defects and small UX corrections so they can be fixed together in the next sensible maintenance update instead of forcing a new plugin build for every individual report.

## Phase 2 / Phase 3 scan cleanup

- **Do not trigger an extraction merely by switching automatic scans back on.** Changing the update mode must never itself queue a scan. Automatic extraction should be scheduled only by a newly saved narrator reply after automatic scanning is enabled.
- **Rename the update-mode UI to match its actual behavior.** `Manual` currently means automatic scans are disabled; `Scan Now` is available regardless of mode. Prefer wording such as `Automatic scans: On / Off` with helper text that `Scan Now` always remains available.
- **Never silently skip an unscanned backlog.** Normal scans must process backlog in bounded sequential batches or advance the scan cursor only through messages actually processed.
- **Add a safe existing-chat bootstrap/history workflow.** A first scan in a long existing chat currently examines only a recent bounded window. Provide an explicit backfill/history scan that walks older story messages in manageable batches instead of sending an entire long chat in one model request.
- **Clarify scan coverage in the UI.** Explain that normal scans process new/unscanned narrative messages, with bounded batch sizes, rather than claiming to scan the entire conversation.
- **Review cadence semantics.** `postsSinceScan` currently advances on both visible user and narrator story messages while automatic scheduling occurs after an assistant message. Make the UI wording match that behavior or change the counter to the intended unit.
- **Add a scan timeout/watchdog.** A hung `tavo.generate(...)` extraction request can leave `meta.scanStatus = running` indefinitely because there is currently no timeout around the extractor call.
- **Recover stale `running` state on panel/chat reload.** If no live scan is actually in flight but persisted state still says `running`, StoryState should safely reset it to an error/idle recovery state instead of disabling Scan Now forever.
- **Add a user-facing Reset Scan control.** It should clear a stale scan request/status without changing NPC, relationship, campaign, or other semantic StoryState data.

## Phase 3 navigation / UI cleanup

- **Open StoryState directly to its main page from the Tavo sidebar action.** Keep the single-tap StoryState launcher behavior.
- **Close Tavo's native sidebar automatically if/when Tavo exposes a supported plugin API for sidebar dismissal.** Do not use brittle DOM hacks against Tavo's internal UI.

## Maintenance rule

Batch these items with the next reasonable maintenance release unless one causes data loss, corruption, generation collisions, or another blocking failure that requires an immediate hotfix.
