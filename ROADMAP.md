# FlowForge Platform Roadmap — Floor → Loop → Ceiling

> A design-led engineering plan to evolve FlowForge from a well-built *agent product*
> into a *self-improving agent platform* — without losing the simplicity and safety
> that make it trustworthy today.
>
> Governing thesis: **the value is in the sequencing, not the feature list.** Every
> item below is worth doing. Done in the wrong order, several of them make the system
> *less* reliable, not more. This document exists to enforce the order.

---

## 0. Design principles (the non-negotiables)

These constrain every decision that follows. When a ticket conflicts with a principle,
the principle wins.

1. **Floor before ceiling.** Never add autonomy (orchestration, sub-agents, auto-send
   breadth) on top of a capability we can't yet test, trace, or make idempotent.
   Autonomy multiplies the blast radius of every unpatched reliability gap.
2. **Simplicity is a safety feature, not a limitation.** The current linear
   Sense → Decide → Act loop is easy to reason about, which is *why* we can trust it in
   regulated verticals. We remove simplicity only when a real customer workflow forces
   it — never speculatively.
3. **Buy the plumbing, build the domain.** Our defensible IP is the policy/governance
   layer, the outcome-attribution model, connector breadth, and curated exemplar sets.
   It is *not* a hand-rolled orchestration graph, judge framework, or dataset store.
   Adopt best-in-class tools for those; spend our engineering on what only we can build.
4. **Every autonomous decision must be reconstructable.** A score, an action, or a
   send is only allowed if we can later answer: *which prompt version, which policy,
   which trace produced this?* Versioning and tracing are preconditions for autonomy,
   not enhancements to it.
5. **The customer's proof is the product.** The ROI story (pending → won) is the moat
   and the sales lever. Everything we build should make that proof more rigorous and
   more visible, not just make the agents cleverer.
6. **Ease of use is bidirectional.** "Easy" means easy for the small-business owner
   *and* easy for the FlowForge operator to run, debug, and evolve. A feature that
   improves agent quality but makes the system unobservable is a net negative.

---

## 1. How 16 items collapse into 3 phases

This plan merges two lists: the **10 platform gaps** (G1–G10, the *floor*) and the
**6 architectural upgrades** (U1–U6, the *ceiling*). Most upgrades are **blocked** by a
gap — they literally cannot work correctly until the gap is closed. The phases below
respect those dependencies.

| Phase | Item | What it is | Blocked by / pairs with |
|-------|------|-----------|--------------------------|
| **1 · Floor** | G1 | Tests on the send/queue decision | — (unblocks everything) |
| **1 · Floor** | G2 | Action idempotency + unique constraint | — |
| **1 · Floor** | G3 | Model abstraction w/ timeout + retry | — |
| **1 · Floor** | G4 | Real job queue for the scheduler | G2 |
| **1 · Floor** | G6 | Error/alert sink (stop silent failures) | — |
| **1 · Floor** | G9a | Tenant-scoped data-access seam | — (foundation for U6) |
| **2 · Loop** | G7 | Async, sampled, TTL'd traces | precondition for U1 |
| **2 · Loop** | G8 | Versioned prompts / policies / configs | precondition for U1, U5 |
| **2 · Loop** | U1 | LLM-as-judge evaluation layer | G7 + G8 |
| **2 · Loop** | U5 | Sophisticated learning loop | G8 + U1 |
| **2 · Loop** | U4a | ROI dashboards + configurable resolution | — (polish of existing) |
| **3 · Ceiling** | U2 | Graph orchestration + typed/versioned state | G2 + G4 + G6 + U1 |
| **3 · Ceiling** | U3 | Dynamic sub-agent delegation | U2 + policy layer |
| **3 · Ceiling** | U6 | MCP hardening + policy-aware exposure | G9 + G10 |
| **3 · Ceiling** | G5 | Split the agent runtime into its own tier | G4 |
| **3 · Ceiling** | G10 | Wire MCP to the real agent platform | U6 |
| **Deferred** | U4b | Counterfactual attribution (holdouts) | science project — see §6 |

---

## 2. Phase 1 — Floor: make it safe to build on

**Goal:** stop the system from being able to do harm, and remove the invisibility that
hides when it does. Nothing here is customer-visible. This phase is measured in weeks,
not months, and it unblocks everything after it.

**Why first:** Phases 2 and 3 add scoring, learning, and autonomy *on top of* the
money-path (the auto-send-vs-queue decision in `app/api/agents/run/route.ts`). That path
today has zero test coverage, no idempotency, and swallows its own errors. Building on it
untouched means building on sand.

### Workstreams

- **G1 — Test the money-path.** ✅ **DONE** (`4ec33d0`) — vitest importing the real modules (39 tests) + ESLint flat config; `npm run check` gates typecheck + lint + test. _Original plan:_ Deterministic unit/integration tests around
  `policyBlocks`, the auto-send branch, `resolveOutcomes`, and the queue insert. Golden
  fixtures for each of the six agents. This is the single highest-floor-raising change.
- **G2 — Action idempotency.** A stable idempotency key per proposed action
  (`client_id | agent | ref | day`) and a **unique constraint** on the approvals/outcomes
  tables so overlapping cron + manual runs cannot double-queue or double-send. Move
  `lib/idempotency.ts` off in-memory to the DB (or Upstash) so it survives across
  serverless instances.
- **G3 — Model abstraction.** One `callModel()` seam replacing the 10 hardcoded
  `"gpt-4o-mini"` call sites, with per-call **timeout (AbortController)**, bounded
  **retry**, and a config-driven model choice. This is also the seam that later lets us
  route quality-sensitive drafting to a stronger model and cheap classification to a
  small one — the foundation of cost control.
- **G4 — Real queue.** Replace the sequential `for`-loop scheduler
  (`app/api/cron/run-agents/route.ts`, `MAX_PER_RUN = 50`, blocking self-`fetch`) with a
  managed queue (QStash / Inngest / SQS): per-client fan-out, backoff, dead-letter. One
  slow client must never block the rest, and "50 due" must never silently starve client 51.
- **G6 — Error visibility.** An error sink (Sentry or equivalent) plus a metric that
  distinguishes "0 results because nothing to do" from "0 results because the connector
  token expired." Keep the resilient `catch {}` behavior — but *report* before you swallow.
- **G9a — Data-access seam.** A thin tenant-scoped repository layer so a `client_id`
  filter is structurally impossible to forget. This is the seam U6 (policy-aware tool
  exposure) will later build on.

### Exit criteria (Definition of Done)

- [ ] The auto-send/queue decision has test coverage with green CI gating merges.
- [ ] A replayed webhook or overlapping run **cannot** produce a duplicate send (proven by test).
- [ ] Every model call has a timeout and retry; a hung provider degrades gracefully, observably.
- [ ] The scheduler runs on a queue with retry + DLQ; no hard client cap.
- [ ] A failed connector pull raises an alert within minutes, not a churn ticket next month.

---

## 3. Phase 2 — Loop: build the moat

**Goal:** turn the existing tracing flywheel into a genuine **self-improving loop** and
make the ROI proof visible to customers. This is the phase that matters most. A company
that shipped only Phases 1 and 2 would already be meaningfully differentiated.

**The loop we are building:**

```
real traffic ─▶ traces (async, sampled)
                   │
                   ▼
        LLM-as-judge scoring ─── joined to ──▶ prompt/policy VERSION
        (trajectory + component)                      │
                   │                                  │
                   ▼                                  ▼
        realized OUTCOMES (pending→won) ◀── proves ── which version won
                   │
                   ▼
     curated exemplars (best approved drafts) ─▶ back into agent context
                   │
                   ▼
            measurably better agents ─▶ more realized ROI ─▶ (repeat)
```

### Workstreams

- **G7 — Fix traces so they can carry the judge layer.** ✅ **DONE** (`9f1266b`) — sampled + always-keep-interesting; `shouldPersistTrace` pure + tested. _Original plan:_ Make trace writes
  **async/fire-and-forget**, **sampled** (cheap checks on 100%, expensive CoT judges on a
  sample), and **TTL'd/partitioned** so the table doesn't become the most expensive thing
  we own. Judges run *on* traces — if traces stay synchronous and unbounded, the judge
  layer amplifies the exact cost problem in G7. **Do G7 and U1 as one build.**
- **G8 — Version everything that shapes a decision.** ✅ **DONE** (`9f1266b`) — prompt-version registry; every `agent.run` trace records `prompt_version`. Prompt **bodies** now live in the registry too (`lib/prompts.ts`), moved verbatim (git-diff-verified, zero drift) out of runtime.ts. _Remaining:_ versioning policies/configs (per-tenant DB, larger). _Original plan:_ Prompts, policies, and agent
  configs become versioned data, not inline `const`s. Every trace records the version
  that produced it. Without this, a judge score is unattributable and the learning loop
  is unauditable. This is a precondition, not a nicety.
- **U1 — LLM-as-judge evaluation layer.** ✅ **CORE SHIPPED** (`c3ee79e`) — deterministic component checks (100%) + a sampled CoT rubric (grounding/appropriateness/tone/safety, safety+grounding gating), harvested off the hot path by `/api/cron/judge` into the `judgements` table keyed to `prompt_version`. _Hardened (`555a1b2`): a routing/component judge (deterministic, wired into the cron) + a judge-the-judges meta-eval (`lib/judge-meta.ts`) + an in-process flywheel e2e test. **Now complete** — span-level `trajectoryChecks` over the full Sense→Decide→Act cycle, linked decision↔trace via a `run_id` in existing jsonb (no migration) and merged in the judge cron; plus the auto-built dataset export at `/api/admin/judgements?format=eval`._ _Original plan:_ On the flywheel, tiered for cost:
  - **Trajectory judges** — score the full Sense → Decide → Act cycle, not just the final draft.
  - **Component judges** — routing/label correctness, guardrail effectiveness, tool-use
    correctness, context-grounding quality (did it invent hours/prices?).
  - **Method** — G-Eval/CoT + structured multi-criteria rubrics, few-shot from approved
    exemplars.
  - **Judge the judges** — a small human-labeled meta-eval set validates the judges
    periodically. A judge you don't meta-evaluate is just a second thing to distrust.
  - **Harvest datasets automatically** — the tracing system populates LangSmith/Braintrust-
    style datasets from real traffic. (Adopt the tool; don't build the store — Principle 3.)
- **U5 — Learning loop sophistication.** ✅ **DONE** (`43b9fbb`) — `loadExemplars` curates few-shot examples by judge score (fails dropped, edited > approved), includes rejected drafts as negatives, agent-specific; `agent_feedback.approval_id` (migration 0005) joins judgements. _Now that U1 exists:_
  - Use judges to **curate** which approved exemplars are highest-value to keep in context
    (prevent context bloat — an ease-of-use *and* cost win).
  - Add **negative exemplars** (rejected drafts) *with the reason for rejection*.
  - Make exemplar selection **agent-specific / workflow-specific**, not one global pool.
- **U4a — Attribution polish + ROI dashboards.** ✅ **DONE** (`43b9fbb`) — `resolveOutcomes` grace is now per action type (carts 6h → invoices 24h → reviews 3d) with a per-tenant override hook; the customer ROI dashboard already exists (`lib/portal.ts` + `PortalDashboard`). _Original plan:_ Make `resolveOutcomes` resolution
  **configurable per action-type and per tenant** (grace periods differ for a cart vs a
  60-day invoice). Then surface the pending→won proof in a **customer-facing ROI
  dashboard** — this is the retention and upsell lever, and it costs little now that the
  data exists. (Counterfactual attribution is explicitly *not* here — see §6.)

### Exit criteria

- [ ] Traces are async, sampled, and retention-bounded; adding a judge does not spike hot-path latency.
- [ ] Any agent decision can be joined to the exact prompt/policy version that produced it.
- [ ] A prompt change can be quantitatively shown to improve or regress judged quality *and* realized ROI before it ships.
- [ ] Exemplar context is judge-curated, agent-specific, and includes explained negatives.
- [ ] Customers can see a live "$ we made you" dashboard backed by resolved outcomes.

---

## 4. Phase 3 — Ceiling: orchestration, when (and only when) workflows demand it

**Goal:** support genuinely more complex workflows — *after* the floor makes them safe
and the loop lets us prove they don't regress.

**The trigger gate:** Do **not** start U2/U3 speculatively. Start them when a real,
named customer workflow requires a supervisor routing across sub-agents that does not
exist today. Until then, build only the *seam* (a typed, versioned action/state schema in
Phase 2) so this phase is additive rather than a rewrite.

### Workstreams

- **U2 — Graph orchestration + state.** ▶ **SLICE 1 SHIPPED** (`lib/orchestrator.ts`, `/api/workflow/concierge`) — the **New-Lead Concierge** supervisor: qualify → conditional routing (hot/warm/cold) → parallel order side-quest → reducer-merged typed/versioned state, sub-agents injected (DI = graph nodes), every step human-gated, traced with `run_id` for the U1 trajectory judge. **SLICE 2** adds the real LLM lead-qualification sub-agent (wired into the DI seam, guarded by `OPENAI_API_KEY`) and **persistence** — steps upsert into the approval queue (tenant-scoped, idempotent, mapped onto the nearest agent lane) so the existing decide/policy/judge/learning-loop machinery runs on orchestrated steps unchanged. 12 tests, driven live. **SLICE 3** adds approval notifications on persist, a warm-lead nurture cadence (day-3 + day-7 touches via `dueInDays`), and review-vs-AR side-quest routing by order state. 18 tests, driven live. _Next:_ durable time-fired scheduling of the queued follow-up/check-in touches; adopt LangGraph.js only if node count/durability demands it. _Original plan:_ Introduce explicit supervisor/worker orchestration
  (adopt a graph library — Principle 3), **dynamic parallelism** for concurrent tool pulls
  merged safely, and **typed, versioned, persistent state with reducers** for safe merges
  across parallel branches. This is only safe because Phase 1 made actions idempotent (G2)
  and observable (G6).
- **U3 — Dynamic sub-agent delegation.** A supervisor that spawns/delegates to specialized
  sub-agents within one workflow — pairing with the policy layer (every delegated action
  still passes governance), the MCP server (sub-agents can call external tools), and the
  learning loop (approved sub-agent behaviors become new exemplars). Safe only because U1
  now lets us prove a delegated trajectory met quality bars.
- **U6 + G10 — MCP as a real platform surface.** Tool **schema validation, versioning, and
  capability discovery**; **rate-limiting + cost attribution per external caller**; and
  **policy-aware exposure** (some tools only for certain callers or under human gate —
  built on the G9 data-access seam). Then *wire MCP to the actual agents* so a customer's
  own Claude can trigger their FlowForge agents and read their approval queue,
  authenticated — closing the gap where today's MCP endpoint exposes only marketing data.
- **G5 — Split the runtime tier.** Move the agent runtime, cron, and webhooks off the
  web/marketing deployment so agent bursts can't degrade page loads, and each tier scales
  independently.

### Exit criteria

- [ ] A multi-step, multi-agent workflow runs with parallel branches merged via reducers, fully traced and idempotent.
- [ ] Every delegated sub-agent action still passes the policy/approval gate.
- [ ] External MCP callers are authenticated, rate-limited, cost-attributed, and see only policy-permitted tools.
- [ ] Agent load and web load scale independently.

---

## 5. Buy vs. build decisions

Spending engineering on the wrong layer is the most likely way this roadmap fails.

| Capability | Decision | Rationale |
|-----------|----------|-----------|
| Job queue / scheduler (G4) | **Buy** (QStash / Inngest) | Solved problem; our version would be worse. |
| Trace store + eval datasets (G7, U1) | **Buy** (LangSmith / Braintrust / Phoenix) | Don't hand-roll a dataset platform. |
| Graph orchestration (U2) | **Buy** the engine, **build** the graphs | The library is commodity; the workflows are ours. |
| Error/alerting (G6) | **Buy** (Sentry) | Commodity. |
| Model abstraction (G3) | **Build** (thin) | Small, domain-shaped, must stay ours. |
| Policy/governance layer | **Build** — this is the moat | Nobody else has our approval-gated, tenant-configurable policy model. |
| Outcome attribution (U4) | **Build** — this is the moat | The pending→won proof is our differentiator. |
| Exemplar curation (U5) | **Build** on a bought judge | The curation logic is domain IP; the judge runtime is not. |

---

## 6. What we are explicitly NOT doing yet (and why)

Discipline is the plan. These are deliberately deferred:

- **Graph orchestration / sub-agents before Phase 3.** The current linearity is a safety
  asset. Adding a supervisor to route traffic that doesn't exist yet is complexity with no
  payoff and real risk. Build the seam, defer the machinery.
- **Counterfactual attribution (U4b).** Real counterfactuals need holdout/control groups —
  deliberately *not* acting on a slice of a paying customer's leads to measure the delta.
  That is statistically correct and commercially painful ("you let my hot leads go cold to
  prove a point?"). Scope it far later as an opt-in "measurement mode." Until then, the
  honest pending→won proxy is enough to sell on.
- **Hand-rolling any framework in the Buy column.** A six-agent agency rebuilding LangGraph
  or LangSmith is how six months disappear with nothing shipped.
- **Full CoT judges on 100% of traffic.** Cost-prohibitive and unnecessary. Cheap
  deterministic checks everywhere; expensive judges on a sample.

---

## 7. Success metrics

| Phase | Leading indicator | Lagging indicator |
|-------|-------------------|-------------------|
| 1 · Floor | Money-path test coverage; duplicate-send rate = 0 in load test | Zero production double-sends; MTTR on connector failure in minutes |
| 2 · Loop | % traces judged; prompt changes gated by judge+ROI delta | Realized ROI per client trending up; exemplar context size flat while quality rises |
| 3 · Ceiling | # workflows using orchestration; % delegated actions passing policy | New workflow complexity shipped without quality regression; web latency flat under agent bursts |

---

## 8. Immediate next actions (Phase 1 starter backlog)

Ordered. The first three are the highest-floor-raising work in the whole roadmap.

1. ~~**G2 + G1 together:** idempotency key + unique DB constraint on approvals/outcomes, and
   the test proving an overlapping run cannot double-send.~~ **DONE** (`151e856`) — dedupe key
   + unique index + claim-before-send + an idempotency test — now running on vitest against the
   real modules (see G1, done).
2. ~~**G3:** introduce `callModel()` with timeout + retry; migrate the 10 call sites behind it.~~
   **DONE** (`e9d8f65`) — `lib/model.ts` seam with per-purpose model routing, 20s timeout, bounded
   retry; all 10 sites migrated.
3. ~~**G6:** wire an error sink; add the "empty-because-error vs empty-because-idle" metric.~~
   **DONE** (`ad279b0`) — `lib/report.ts` (console + optional webhook + `error_events` table);
   connector pulls now flag `source_error`, model fallbacks and the run-route 500 report.
4. ~~**G4:** move the scheduler onto a managed queue with retry + DLQ.~~
   **DONE** (`ab23c11`) — `lib/scheduler.ts` (oldest-due-first, no cap; bounded-concurrency
   pool with retry); QStash dispatch when configured, in-process fallback otherwise. 14-assertion test.
5. ~~**G9a:** extract the tenant-scoped data-access seam.~~
   **DONE** (`f35cdcb`) — `lib/tenant.ts` `clientScope()` (reads pre-filtered, writes inject
   client_id); adopted in `policy.ts` + `outcomes.ts`. 10-assertion test. Broad migration of the
   remaining service-role queries (the agents/run route, integrations, agency) is follow-up.

---

### One-line summary

**Harden the floor (Phase 1), build the self-improving loop that is the real moat
(Phase 2), and add orchestration only when a real workflow demands it (Phase 3) —
buying the plumbing and building the domain throughout.** The list is not the plan;
the order is the plan.
