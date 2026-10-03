# Codex Workflows Runner

Source: https://github.com/scasella/claude-dynamic-workflows-codex
Commit: 16524bea870a51ac7bfb3dc7dce77e333c7a56e1 (0.2.0)
Copyright (c) 2026 Stephen Casella. MIT; see LICENSE.

Local modifications: bounded metadata evaluation, actual-slot lifecycle start and structured errors, nested adapter propagation, camelCase retry codes, defensive rejection, early completion buffering/transport cleanup, client process cleanup. Local integration is independent of the upstream CLI, viewer and skill. VM is not an OS security boundary. Application accepts only explicitly selected local workflow scripts.
