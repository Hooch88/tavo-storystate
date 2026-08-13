# StoryState TODO

This file collects non-critical defects and small UX corrections so they can be fixed together in the next sensible maintenance update instead of forcing a new plugin build for every individual report.

## Phase 2 scan / update-mode cleanup

- **Do not trigger an extraction merely by switching automatic scans back on.** Changing the update mode must never itself queue a scan. Automatic extraction should be scheduled only by a newly saved narrator reply after automatic scanning is enabled.
- **Rename the update-mode UI to match its actual behavior.** `Manual` currently means automatic scans are disabled; `Scan Now` is available regardless of mode. Prefer wording such as `Automatic scans: On / Off` with helper text that `Scan Now` always remains available.
- **Never silently skip an unscanned backlog.** The current bounded scan window can discard older unscanned messages when the gap is larger than the scan window. A future scan must process backlog in bounded sequential batches or advance the scan cursor only through messages actually processed.
- **Add a safe existing-chat bootstrap/history workflow.** A first scan in a long existing chat currently examines only a recent bounded window. Provide an explicit backfill/history scan that walks older story messages in manageable batches instead of sending an entire long chat in one model request.
- **Clarify scan coverage in the UI.** Explain that normal scans process new/unscanned narrative messages, with bounded batch sizes, rather than claiming to scan the entire conversation.
- **Review cadence semantics.** `postsSinceScan` currently advances on both visible user and narrator story messages while automatic scheduling occurs after an assistant message. Make the UI wording match that behavior or change the counter to the intended unit.

## Maintenance rule

Batch these items with the next reasonable Phase 2 maintenance release unless one causes data loss, corruption, generation collisions, or another blocking failure that requires an immediate hotfix.
