# 2026 World Cup Pool — Rulebook (v2)

A salary-cap draft pool that rewards portfolio construction. Build a 5-team roster from across the tournament, then collect points as your teams play. No live draft, no team is ever "taken" — picks are independent.

> **What changed from v1** (all tuned against a Monte-Carlo simulation of the tournament):
> - **Underdog multiplier removed.** It barely affected expected value (a doubled C/D-tier knockout run is too rare to matter) and added rules complexity for almost no balancing effect.
> - **Knockout scoring flattened.** The old escalating table (6→22) made the eventual champion worth ~2× any other team and turned the pool into a champion-picking contest — the pool winner owned the champion ~96% of the time. A flat per-win value cuts that to ~67% while keeping the final decisive.
> - **Tiers repriced** so expected points-per-pound is roughly equal across S/A/B/C. Previously the most expensive teams were also the best value, so "buy up to the cap" was the solved optimal play.
> - **Lock-in / pricing timing decoupled**, penalty and extra-time scoring clarified, tiebreakers deepened, and the sample-roster math corrected.

---

## 1. Roster construction

Each participant drafts **5 teams** subject to a **budget of 100 points**. Teams are priced by tier (Section 2).

### Constraints

1. **Maximum one team per WC group.** No two of your teams can come from the same Group A through Group L.
2. **Maximum two teams per confederation.** This guarantees at least three confederations on every roster.
3. **Total cost ≤ 100 points.**

Any 5-team combination satisfying all three rules is legal. There is no minimum spend, but in practice strong rosters use 90+ of the budget.

### Pricing and lock-in timing

- The final tier list is set using the **FIFA ranking released immediately before the tournament** and is **published at least 48 hours before kickoff**, so everyone drafts against final prices.
- Rosters **lock at kickoff of the opening match** (June 11, 2026). You may edit freely until lock-in; no edits afterward.
- Because prices are published before lock-in, every roster must satisfy the ≤100 budget **under the final published prices**. If a team's tier changes in that final ranking, the new price applies — adjust your roster before lock-in if needed.

---

## 2. Tiers and pricing

The 48 teams are bucketed into five tiers by FIFA rating. Each tier has a fixed cost. (Prices below are calibrated so expected points-per-pound is roughly equal across the top four tiers; D-tier is intentionally the cheap, high-variance tier.)

### S-tier — 43 pts

| Team | Confederation | Group |
|---|---|---|
| France | UEFA | I |
| Spain | UEFA | H |
| Argentina | CONMEBOL | J |
| England | UEFA | L |

### A-tier — 29 pts

| Team | Confederation | Group |
|---|---|---|
| Portugal | UEFA | K |
| Brazil | CONMEBOL | C |
| Netherlands | UEFA | F |
| Morocco | CAF | C |
| Belgium | UEFA | G |
| Germany | UEFA | E |
| Croatia | UEFA | L |
| Colombia | CONMEBOL | K |

### B-tier — 17 pts

| Team | Confederation | Group |
|---|---|---|
| Senegal | CAF | I |
| Mexico | CONCACAF | A |
| United States | CONCACAF | D |
| Uruguay | CONMEBOL | H |
| Japan | AFC | F |
| Switzerland | UEFA | B |
| Iran | AFC | G |
| Austria | UEFA | J |
| Ecuador | CONMEBOL | E |
| South Korea | AFC | A |
| Australia | AFC | D |
| Egypt | CAF | G |

### C-tier — 9 pts

| Team | Confederation | Group |
|---|---|---|
| Canada | CONCACAF | B |
| Ivory Coast | CAF | E |
| Qatar | AFC | B |
| Algeria | CAF | J |
| Sweden | UEFA | F |
| Tunisia | CAF | F |
| Czechia | UEFA | A |
| Türkiye | UEFA | D |
| Norway | UEFA | I |
| Scotland | UEFA | C |
| DR Congo | CAF | K |
| Bosnia & Herzegovina | UEFA | B |

### D-tier — 4 pts

| Team | Confederation | Group |
|---|---|---|
| Panama | CONCACAF | L |
| Saudi Arabia | AFC | H |
| South Africa | CAF | A |
| Iraq | AFC | I |
| Uzbekistan | AFC | K |
| Paraguay | CONMEBOL | D |
| Ghana | CAF | L |
| Jordan | AFC | J |
| Cape Verde | CAF | H |
| Curaçao | CONCACAF | E |
| Haiti | CONCACAF | C |
| New Zealand | OFC | G |

*Tier assignments above are provisional (based on the April 1, 2026 ranking). The list is re-bucketed and finalized using the pre-tournament FIFA ranking, published ≥48h before lock-in.*

---

## 3. Group stage scoring

Each team on your roster earns points independently.

| Action | Points |
|---|---|
| Win | 4 |
| Draw | 2 |
| Each goal scored | 1 |
| Each clean sheet (no goals conceded) | 1 |
| Advance as group winner | +10 |
| Advance as group runner-up | +7 |
| Advance as best third-place qualifier | +4 |

Goals and clean sheets apply regardless of result. A team that loses 3–2 still earns 3 pts for its goals.

---

## 4. Knockout scoring

Every knockout win is worth the same flat base, plus a point per goal scored and a clean-sheet bonus. The Final carries a small premium; the third-place match a small discount. **There is no underdog multiplier** — tier no longer affects knockout scoring.

| Round | Win base | + per goal scored | + clean sheet |
|---|---|---|---|
| Round of 32 | 6 | +1 | +1 |
| Round of 16 | 6 | +1 | +1 |
| Quarter-final | 6 | +1 | +1 |
| Semi-final | 6 | +1 | +1 |
| Final win (champion) | 8 | +1 | +1 |
| Third-place match win | 4 | +1 | +1 |

**Losing teams score zero for that match.** The final is still decisive between the two finalists: the loser earns nothing, so winning it is worth a full win plus goals and any clean sheet.

### Goals, extra time, and penalties

- **Goals scored** counts goals in **regulation and extra time**. Penalty-shootout goals do **not** count.
- **Clean sheet** is awarded only if the team concedes no goals in regulation or extra time (shootout kicks are ignored).
- These bonuses count **only for the winning team** in each knockout match.

**Examples:**
- B-tier wins R32 2–0: 6 + 2 + 1 = **9 pts**
- C-tier wins R16 1–0: 6 + 1 + 1 = **8 pts**
- D-tier wins QF 1–1 on penalties (conceded in regulation): 6 + 1 + 0 = **7 pts**
- Champion wins the Final 2–1: 8 + 2 + 0 = **10 pts**
- A team wins a 0–0 R32 on penalties: 6 + 0 + 1 = **7 pts**

---

## 5. Tiebreakers

If two rosters finish on identical totals, in order:

1. Higher total from group-stage points alone
2. More teams advanced past the group stage
3. More total goals scored across all your teams (group + knockout)
4. Coin flip

---

## 6. Sample legal rosters

All three satisfy max-one-per-group, max-two-per-confederation, and budget ≤ 100, priced under the v2 tiers.

**Balanced portfolio — 97 pts**
Netherlands (A, Group F) · Uruguay (B, Group H) · Mexico (B, Group A) · Senegal (B, Group I) · Australia (B, Group D)
*5 confederations, 5 groups — one A-tier anchor, four solid B-tier.*

**Two stars and lottery tickets — 98 pts**
France (S, Group I) · Argentina (S, Group J) · South Africa (D, Group A) · Saudi Arabia (D, Group H) · New Zealand (D, Group G)
*5 confederations, 5 groups — two title contenders, three cheap upside picks.*

**Mid-heavy value — 93 pts**
Brazil (A, Group C) · Netherlands (A, Group F) · United States (B, Group D) · Norway (C, Group I) · Algeria (C, Group J)
*4 confederations (UEFA twice), 5 groups.*

---

## 7. Quick reference

- **Budget:** 100 pts
- **Roster size:** 5 teams
- **Max per WC group:** 1
- **Max per confederation:** 2
- **Tier prices:** S 43 · A 29 · B 17 · C 9 · D 4
- **Knockout win:** 6 base (Final 8, third-place 4) + 1/goal + 1 clean sheet, no multiplier
- **Lock-in:** kickoff June 11, 2026
- **Final tier list:** published ≥48h before lock-in, from the pre-tournament FIFA ranking

---

*Note: tier prices and the Final premium were tuned by simulation against provisional ratings. Re-derive both from the final June FIFA ranking before publishing — the structure holds, but the exact numbers will shift slightly with the real strengths and the host-nation effect for the USA, Mexico, and Canada.*
