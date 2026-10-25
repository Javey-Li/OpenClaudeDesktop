# Repository guidance

Read the root README for this fork's status, docs/PRD.md for product scope, and docs/DEVELOPMENT.md for the current implementation task. Source-tree READMEs describe upstream behavior.

Develop in new-2.42304.0. Preserve old-2.31226.0 for historical comparison. Trace callers before changing protocols or shared services. Reuse existing implementations before adding dependencies or new layers.

Keep product goals, inherited code, implemented changes, and verified behavior distinct. A mock, source assertion, or component build is not a real-model or full-application run. Do not use placeholder assets to claim a complete build.

Preserve attribution and license notices. Keep credentials, personal sessions, local research, and resource copies with unresolved distribution rights out of commits. Do not modify the official Claude installation or a user's daily browser profile during investigation.

Use checks that match the change. Record the commands, results, and unverified behavior in the change description. Update product requirements only when product decisions change.
