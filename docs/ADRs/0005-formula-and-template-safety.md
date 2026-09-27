# ADR-0005: Safe formula & template execution

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Tenants configure payroll formulas (`BASIC = CTC * 0.4`) and author document/email templates with
placeholders. These are **tenant-authored inputs** executed server-side — a code-injection risk if
handled naively.

## Decision

- **Payroll formula engine:** parse expressions to an **AST** with a restricted grammar — arithmetic,
  comparisons, a whitelisted function set (`min`, `max`, `round`, `if`, …), and a fixed set of bound
  variables (salary components, config). Evaluate the AST in a pure interpreter. **No `eval`/`Function`.**
  Detect circular component dependencies at validation time. Every evaluation returns a step-by-step
  **explanation** (inputs → intermediate values → result) for auditability.
- **Templates:** a logic-less/limited interpolation engine (whitelisted `{{path}}` variables + a small
  set of safe helpers/conditionals/loops), with output escaping appropriate to the target (HTML/PDF vs
  email). **No arbitrary code** from template content. Variables are validated against a declared schema.

## Consequences

- Formula/template capability grows by adding whitelisted functions/helpers deliberately, never by
  opening a general execution path.
- Money math in formulas uses the `Money`/decimal rules (no float); rounding is explicit.
- Generated legal documents are rendered from a **data snapshot** and stored immutably (never
  re-rendered from current data). See product docs §24/§89.
