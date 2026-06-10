// Scoring engine — single source of truth, per rulebook v2.
// Pure functions. No I/O. Used by the scoring page, the leaderboard,
// and the admin "recompute" action.

import type { Match, Team, TeamAdvancement, Stage, AdvancementResult } from "./types";

// --- Knockout base points -----------------------------------------------
// Per rulebook v2: R32/R16/QF/SF flat 6, Final 8, third-place 4.
// The Final base is also exposed via pool_settings.final_bonus so a commissioner
// can tweak it — pass it in as `finalBase` to keep this module pure.
export function knockoutBase(stage: Stage, finalBase: number = 8): number {
  switch (stage) {
    case "R32":
    case "R16":
    case "QF":
    case "SF":
      return 6;
    case "F":
      return finalBase;
    case "3P":
      return 4;
    case "group":
      return 0;
  }
}

// --- Advancement bonus --------------------------------------------------
export function advancementBonus(result: AdvancementResult): number {
  switch (result) {
    case "group_winner":
      return 10;
    case "runner_up":
      return 7;
    case "best_third":
      return 4;
    case "none":
      return 0;
  }
}

// --- Per-match per-team points -----------------------------------------
//
// Returns 0 for matches that aren't final or where the team didn't play.
// Group: W=4, D=2, +1/goal, +1 clean sheet (regardless of result).
// Knockout: winner gets base + goals + clean sheet (reg+ET only — shootout kicks
// are excluded by `home_score` / `away_score` representing only reg+ET).
// Losers in KO get 0. Penalty winner is the winner if went_to_penalties.
export function pointsForTeamInMatch(
  teamId: number,
  match: Match,
  finalBase: number = 8,
): number {
  if (match.status !== "final") return 0;
  if (teamId !== match.home_team_id && teamId !== match.away_team_id) return 0;
  if (match.home_score == null || match.away_score == null) return 0;

  const isHome = teamId === match.home_team_id;
  const teamGoals = isHome ? match.home_score : match.away_score;
  const oppGoals = isHome ? match.away_score : match.home_score;

  if (match.stage === "group") {
    let pts = 0;
    if (teamGoals > oppGoals) pts += 4;
    else if (teamGoals === oppGoals) pts += 2;
    pts += teamGoals;          // +1 per goal
    if (oppGoals === 0) pts += 1; // clean sheet
    return pts;
  }

  // Knockout — determine winner from match-level scores (not per-team view).
  let winnerId: number | null;
  if (match.home_score === match.away_score) {
    winnerId = match.went_to_penalties ? match.penalty_winner_team_id : null;
  } else {
    winnerId = match.home_score > match.away_score ? match.home_team_id : match.away_team_id;
  }
  if (winnerId !== teamId) return 0;

  // Winner-only bonuses, reg+ET only (we don't model shootout kicks in scores).
  let pts = knockoutBase(match.stage, finalBase);
  pts += teamGoals;
  if (oppGoals === 0) pts += 1;
  return pts;
}

// --- Roster total -------------------------------------------------------
export interface TeamScoreBreakdown {
  team_id: number;
  group_points: number;
  knockout_points: number;
  advancement_points: number;
  total: number;
}

export function scoreTeam(
  teamId: number,
  matches: Match[],
  advancement: AdvancementResult,
  finalBase: number = 8,
): TeamScoreBreakdown {
  let group = 0;
  let ko = 0;
  for (const m of matches) {
    if (m.home_team_id !== teamId && m.away_team_id !== teamId) continue;
    const pts = pointsForTeamInMatch(teamId, m, finalBase);
    if (m.stage === "group") group += pts;
    else ko += pts;
  }
  const adv = advancementBonus(advancement);
  return {
    team_id: teamId,
    group_points: group,
    knockout_points: ko,
    advancement_points: adv,
    total: group + ko + adv,
  };
}

// --- Entry total + tiebreakers -----------------------------------------
export interface EntryScore {
  total: number;
  group_points: number;
  knockout_points: number;
  advancement_points: number;
  teams_advanced: number;
  total_goals: number;
  team_scores: TeamScoreBreakdown[];
}

export function scoreEntry(
  teamIds: number[],
  matches: Match[],
  advancementByTeam: Map<number, AdvancementResult>,
  finalBase: number = 8,
): EntryScore {
  const team_scores = teamIds.map((id) =>
    scoreTeam(id, matches, advancementByTeam.get(id) ?? "none", finalBase),
  );
  const total = team_scores.reduce((s, t) => s + t.total, 0);
  const group_points = team_scores.reduce((s, t) => s + t.group_points, 0);
  const knockout_points = team_scores.reduce((s, t) => s + t.knockout_points, 0);
  const advancement_points = team_scores.reduce((s, t) => s + t.advancement_points, 0);

  let teams_advanced = 0;
  for (const id of teamIds) {
    const adv = advancementByTeam.get(id) ?? "none";
    if (adv !== "none") teams_advanced += 1;
  }

  let total_goals = 0;
  for (const m of matches) {
    if (m.status !== "final" || m.home_score == null || m.away_score == null) continue;
    for (const id of teamIds) {
      if (m.home_team_id === id) total_goals += m.home_score;
      else if (m.away_team_id === id) total_goals += m.away_score;
    }
  }

  return {
    total,
    group_points,
    knockout_points,
    advancement_points,
    teams_advanced,
    total_goals,
    team_scores,
  };
}

// Tiebreakers (rulebook v2 §5):
//   1) total
//   2) group_points
//   3) teams_advanced
//   4) total_goals
//   5) coin flip (left to caller / leave stable)
export function compareEntryScores(a: EntryScore, b: EntryScore): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.group_points !== b.group_points) return b.group_points - a.group_points;
  if (a.teams_advanced !== b.teams_advanced) return b.teams_advanced - a.teams_advanced;
  if (a.total_goals !== b.total_goals) return b.total_goals - a.total_goals;
  return 0;
}

// --- Roster legality (used in draft validation AND server save) ---------
export interface LegalityResult {
  ok: boolean;
  errors: string[];
  budgetUsed: number;
  budgetRemaining: number;
}

export const BUDGET = 100;
export const ROSTER_SIZE = 5;
export const MAX_PER_GROUP = 1;
export const MAX_PER_CONFEDERATION = 2;

export function checkRoster(
  pickedTeams: Team[],
  opts: { allowPartial?: boolean } = {},
): LegalityResult {
  const errors: string[] = [];
  const budgetUsed = pickedTeams.reduce((s, t) => s + t.price, 0);

  if (!opts.allowPartial && pickedTeams.length !== ROSTER_SIZE) {
    errors.push(`Roster must have exactly ${ROSTER_SIZE} teams (have ${pickedTeams.length}).`);
  }
  if (pickedTeams.length > ROSTER_SIZE) {
    errors.push(`Too many teams (max ${ROSTER_SIZE}).`);
  }
  if (budgetUsed > BUDGET) {
    errors.push(`Over budget by ${budgetUsed - BUDGET} (used ${budgetUsed} of ${BUDGET}).`);
  }

  const byGroup = new Map<string, number>();
  const byConf = new Map<string, number>();
  for (const t of pickedTeams) {
    byGroup.set(t.group_letter, (byGroup.get(t.group_letter) ?? 0) + 1);
    byConf.set(t.confederation, (byConf.get(t.confederation) ?? 0) + 1);
  }
  for (const [g, n] of byGroup) {
    if (n > MAX_PER_GROUP) errors.push(`Group ${g} has ${n} teams (max ${MAX_PER_GROUP}).`);
  }
  for (const [c, n] of byConf) {
    if (n > MAX_PER_CONFEDERATION) errors.push(`${c} has ${n} teams (max ${MAX_PER_CONFEDERATION}).`);
  }

  return {
    ok: errors.length === 0,
    errors,
    budgetUsed,
    budgetRemaining: BUDGET - budgetUsed,
  };
}

// --- Group-stage advancement computation -------------------------------
// Computes the top-2-per-group + best-3 calculation given final group matches.
// Returns the suggested advancement for every team that played group games.
// Admins can override per-team in the admin panel; this is only the pre-fill.
//
// Tiebreak: group points → goal difference → goals for. Ties beyond that
// surface as a deterministic order by code (the admin can override).
export interface GroupStanding {
  team_id: number;
  played: number;
  pts: number;
  gd: number;
  gf: number;
}

export function computeAdvancement(
  teams: Team[],
  groupMatches: Match[],
): Map<number, AdvancementResult> {
  const teamsByGroup = new Map<string, Team[]>();
  for (const t of teams) {
    if (!teamsByGroup.has(t.group_letter)) teamsByGroup.set(t.group_letter, []);
    teamsByGroup.get(t.group_letter)!.push(t);
  }

  const out = new Map<number, AdvancementResult>();
  const thirdPlace: Array<{ team_id: number; standing: GroupStanding }> = [];

  for (const [g, gTeams] of teamsByGroup) {
    const standings = new Map<number, GroupStanding>();
    for (const t of gTeams) {
      standings.set(t.id, { team_id: t.id, played: 0, pts: 0, gd: 0, gf: 0 });
    }
    for (const m of groupMatches) {
      if (m.status !== "final" || m.group_letter !== g) continue;
      if (m.home_score == null || m.away_score == null) continue;
      if (m.home_team_id == null || m.away_team_id == null) continue;
      const h = standings.get(m.home_team_id);
      const a = standings.get(m.away_team_id);
      if (!h || !a) continue;
      h.played++; a.played++;
      h.gf += m.home_score; a.gf += m.away_score;
      h.gd += m.home_score - m.away_score;
      a.gd += m.away_score - m.home_score;
      if (m.home_score > m.away_score) h.pts += 3;
      else if (m.home_score < m.away_score) a.pts += 3;
      else { h.pts += 1; a.pts += 1; }
    }

    const sorted = gTeams
      .map((t) => ({ team: t, st: standings.get(t.id)! }))
      .sort((x, y) => {
        if (y.st.pts !== x.st.pts) return y.st.pts - x.st.pts;
        if (y.st.gd !== x.st.gd) return y.st.gd - x.st.gd;
        if (y.st.gf !== x.st.gf) return y.st.gf - x.st.gf;
        return x.team.code.localeCompare(y.team.code);
      });

    if (sorted[0]) out.set(sorted[0].team.id, "group_winner");
    if (sorted[1]) out.set(sorted[1].team.id, "runner_up");
    if (sorted[2]) thirdPlace.push({ team_id: sorted[2].team.id, standing: sorted[2].st });
    for (let i = 3; i < sorted.length; i++) out.set(sorted[i].team.id, "none");
  }

  // Best 8 of 12 third-place teams advance (rulebook spec for 48-team format).
  thirdPlace.sort((a, b) => {
    if (b.standing.pts !== a.standing.pts) return b.standing.pts - a.standing.pts;
    if (b.standing.gd !== a.standing.gd) return b.standing.gd - a.standing.gd;
    if (b.standing.gf !== a.standing.gf) return b.standing.gf - a.standing.gf;
    return a.team_id - b.team_id;
  });
  for (let i = 0; i < thirdPlace.length; i++) {
    out.set(thirdPlace[i].team_id, i < 8 ? "best_third" : "none");
  }

  return out;
}

// Re-export for callers that prefer working with arrays.
export function advancementMapFromRows(rows: TeamAdvancement[]): Map<number, AdvancementResult> {
  return new Map(rows.map((r) => [r.team_id, r.result]));
}
