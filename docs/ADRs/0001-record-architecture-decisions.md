# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

This is a large, long-lived, multi-contributor (human + AI) system. Significant decisions need a
durable, reviewable record so future sessions understand *why*, not just *what*.

## Decision

We keep Architecture Decision Records in `docs/ADRs/NNNN-title.md`, using the lightweight format:
**Context → Decision → Consequences → Status**. One decision per file, numbered, immutable once
Accepted (supersede with a new ADR rather than editing history).

## Consequences

- Reviewers and future Claude Code sessions can trace rationale.
- Superseded ADRs remain for historical context and link to their replacement.
