# CRQ Frontend Dashboard Update & Restyling

## Step 0 — Bank Site Design System Inspection
Before modifying the CRQ frontend, the actual bank site's CSS (`apps/bank-web/src/App.css`) was inspected. The design language defines the following variables:
- **Navy (Primary Text/Accents):** `#17243b`
- **Muted (Secondary Text):** `#7b879d`
- **Line (Borders):** `#e7ebf2`
- **Background (App Shell):** `#f6f8fc`
- **Blue (Brand/Primary Buttons):** `#2864f0`
- **Green (Positive/Risk Low):** `#0e9f72`
- **Coral (Accents):** `#ef806d`
- **Shadow:** `0 12px 35px rgba(28,47,84,.06)`

**Typography**:
- Sans-serif: `'Trebuchet MS', 'Segoe UI', sans-serif`
- Serif (Headings): `Georgia, serif`

These values have been deliberately overridden into the CRQ `tailwind.config.ts`, overriding the previous "navy/slate + teal" palette defined in `architecture.md §5.4`. `bg-surfaceCard` was mapped to `#ffffff`, and borders/backgrounds aligned to use `#e7ebf2` and `#f6f8fc` respectively to blend perfectly with the bank site components.

## Part 1 — F2.1 Gaps Filled
- **[BUDonutChart] (F2.1.5):** Implemented a Recharts donut chart summarizing EAL by Business Unit. **Mocked** - The endpoint for BU-scoped queries doesn't exist yet, so this uses static hardcoded segments. Clearly labeled as `Mocked`.
- **[RiskReductionOpportunities] (F2.1.4):** Implemented the top 10 risk reduction opportunities table (Action, Est. Cost, Δ EAL, ROSI). **Mocked** - The `/api/v1/optimize` endpoint is a phase B3.2 stub. Clearly labeled as `Mocked`.
- **[CompliancePlaceholder] (F2.1.6):** Implemented a visually matching "Coming Soon" card for compliance scores since phase B5.1 is not built.

## Part 2 — F4.1 NL Query Upgraded to Chat
- **[NLChatInterface]:** Replaced the single-input search with a full chat thread layout.
- **Message List & Input:** Shows history of questions and answers. Maintains the suggestion chips to easily populate queries.
- **Citation Badges:** Small, clickable `[C1]` badges embedded directly in text to back claims with underlying data rows/vulnerabilities.
- **Grounding Indicator:** Added visual badges underneath assistant messages. The mocked response explicitly demonstrates a successful grounded state ("Grounded in CRQ Data") and an unverified state ("Unverified Claim" with reason), reflecting the LLM interaction safety constraints.
- **History Sidebar:** Added a toggleable sidebar listing recent queries.

## Part 3 — Visual Consistency Pass
- All executive dashboard components (`EALCard`, `RiskContributorsTable`, `RiskTrendChart`, `InvestmentCurve`) as well as `VulnerabilityReportForm` were bulk-updated to replace the dark-mode slate classes with the new light-mode navy/brand classes.
- `text-white` and `text-slate-*` were globally swept and mapped to `text-navy` or `text-muted`.
- Verified that **₹ Lakhs/Crores formatting** and `tabular-nums` tracking survived the restyle and are fully intact, as defined in `src/lib/formatters.ts`.

## Deliverables Status
- All deliverables from the prompt were met.
- The `CRQ Frontend` is verified to build without lint errors via `npm run build`.
