# Contributing

Read the [project README](README.md) and [product requirements](docs/PRD.md) before proposing a change. This is a maintainer-led derivative project in early development.

For a substantial change, open an issue that explains the user problem, the inherited behavior, and the intended result. A small, focused fix can go directly to a pull request.

## A useful pull request

- Connect the change to a user workflow or a reproducible bug.
- Name the affected source tree and any upstream change or external code you reused.
- Describe the checks you ran and what they establish.
- State any missing build inputs or behavior you did not verify.

Keep the full product scope intact while limiting each change to the problem it solves. Reuse existing services before adding another execution path or framework.

Develop against new-2.42304.0. Retain old-2.31226.0 as historical reference unless the change specifically concerns it. See the [development guide](docs/DEVELOPMENT.md) for the current build blocker and source layout.

Preserve upstream copyright notices and include the source and license for new third-party material. Do not commit credentials, personal sessions, local research logs, or resource copies with unresolved distribution rights.

Do not describe a mock, screenshot, or unit test as a successful real-model or full-application run. A change can document an unresolved problem without pretending to solve it.
