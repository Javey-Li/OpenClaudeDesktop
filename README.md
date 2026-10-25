# OpenClaudeDesktop · Javey-Li fork

[简体中文](README.zh-CN.md) · English

A community derivative of [oleyyu/OpenClaudeDesktop](https://github.com/oleyyu/OpenClaudeDesktop), working toward a complete everyday alternative to Claude Desktop.

The goal covers conversations, project knowledge, attachments, artifacts, coding and work tasks, tools, browser and desktop interaction, and persistent background work. Development will proceed in stages. These are product goals, not a list of completed features.

## Current state

This fork is in product definition and baseline verification. Its application code is currently inherited from upstream. This fork has no independently verified application release yet.

The upstream code contains an Electron/React application, a DeepSeek Harness bridge, multiple core adapters, file and terminal services, previews, local project and artifact code, and a Chrome bridge. Their presence does not establish complete or equivalent behavior across backends.

A clean source build remains blocked by missing historical `reference/` resources. Full application startup, real-model task execution, and the Cowork VM have not been verified for this fork. There is no supported install-and-run path to recommend yet.

## What this fork is for

- Extend the inherited code workbench toward the wider Claude Desktop workflow.
- Connect conversations, knowledge, artifacts, and task execution through consistent state and permissions.
- Support explicit choices of model and agent backends, with clear data and account boundaries.
- Make builds and functional checks reproducible before claiming a capability is ready.

The intended user is initially the maintainer. The repository is public so its direction, implementation, and limitations can be inspected.

## Read the project

| Document | Purpose |
|---|---|
| [Product requirements](docs/PRD.md) (中文) | Intended users, complete scope, user workflows, and completion criteria |
| [Development guide](docs/DEVELOPMENT.md) (中文) | Source layout, current blockers, and the next implementation steps |
| [Contributing](CONTRIBUTING.md) | How to propose a change and describe what was checked |

## Source layout

- [`new-2.42304.0/`](new-2.42304.0/): active inherited source tree. The folder names its upstream UI reference, not this fork's release version.
- [`old-2.31226.0/`](old-2.31226.0/): historical source retained for comparison.

The READMEs inside those trees are upstream documents. They describe the upstream implementation and may contain claims or setup steps that this fork has not independently verified. The root README describes this fork.

## Upstream and related work

The application foundation comes from [OpenClaudeDesktop](https://github.com/oleyyu/OpenClaudeDesktop). Preserve upstream attribution and distinguish inherited implementation from changes made here.

[Open Claude UI](https://github.com/Caho1/open-claude-ui) is a potential source of components and interaction work. [REA](https://github.com/morluto/rea) supports investigation of observable behavior. [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) provides educational agent examples. Listing these projects does not mean their code is integrated or required to run the application.

## Model access and official services

A model API, a local agent runtime, and a Claude subscription provide different capabilities. Connecting a backend does not automatically provide official account features, cloud sessions, or synchronized data. Each integration must document its authentication, billing, and service limits.

## License and affiliation

The repository retains the upstream [MIT license and copyright notice](LICENSE). Third-party code and extracted resources require their own source and license checks. The root license does not establish permission for every inherited asset.

This is an independent community project. It is not an official Anthropic application or endorsed by Anthropic.
