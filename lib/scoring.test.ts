import { describe, it, expect } from "vitest";
import {
  pointsForTeamInMatch,
  scoreTeam,
  scoreEntry,
  compareEntryScores,
  checkRoster,
  computeAdvancement,
  BUDGET,
} from "./scoring";
import type { Match, Team } from "./types";

// Convenience builder for matches in tests.
function match(partial: Partial<Match>): Match {
  return {
    id: "m",
    stage: "group",
    group_letter: null,
    kickoff: null,
    venue: null,
    home_team_id: null,
    away_team_id: null,
    home_score: null,
    away_score: null,
    went_to_penalties: false,
    penalty_winner_team_id: null,
    status: "scheduled",
    slot: null,
    ...partial,
  };
}

function team(partial: Partial<Team> & { id: number; code: string }): Team {
  return {
    id: partial.id,
    name: partial.name ?? `Team ${partial.code}`,
    code: partial.code,
    flag: "🏳️",
    tier: partial.tier ?? "C",
    price: partial.price ?? 9,
    group_letter: partial.group_letter ?? "A",
    confederation: partial.confederation ?? "UEFA",
    fifa_rank: partial.fifa_rank ?? null,
  };
}

describe("rulebook examples (v2 §4)", () => {
  it("B-tier wins R32 2–0: 6 + 2 + 1 = 9", () => {
    const m = match({
      stage: "R32",
      status: "final",
      home_team_id: 1,
      away_team_id: 2,
      home_score: 2,
      away_score: 0,
    });
    expect(pointsForTeamInMatch(1, m)).toBe(9);
    expect(pointsForTeamInMatch(2, m)).toBe(0); // loser gets 0
  });

  it("C-tier wins R16 1–0: 6 + 1 + 1 = 8", () => {
    const m = match({
      stage: "R16",
      status: "final",
      home_team_id: 1,
      away_team_id: 2,
      home_score: 1,
      away_score: 0,
    });
    expect(pointsForTeamInMatch(1, m)).toBe(8);
  });

  it("D-tier wins QF 1–1 on penalties (conceded in reg): 6 + 1 + 0 = 7", () => {
    const m = match({
      stage: "QF",
      status: "final",
      home_team_id: 1,
      away_team_id: 2,
      home_score: 1,
      away_score: 1,
      went_to_penalties: true,
      penalty_winner_team_id: 1,
    });
    expect(pointsForTeamInMatch(1, m)).toBe(7);
    expect(pointsForTeamInMatch(2, m)).toBe(0);
  });

  it("Champion wins the Final 2–1: 8 + 2 + 0 = 10", () => {
    const m = match({
      stage: "F",
      status: "final",
      home_team_id: 1,
      away_team_id: 2,
      home_score: 2,
      away_score: 1,
    });
    expect(pointsForTeamInMatch(1, m)).toBe(10);
  });

  it("Wins a 0–0 R32 on penalties: 6 + 0 + 1 = 7", () => {
    const m = match({
      stage: "R32",
      status: "final",
      home_team_id: 1,
      away_team_id: 2,
      home_score: 0,
      away_score: 0,
      went_to_penalties: true,
      penalty_winner_team_id: 1,
    });
    expect(pointsForTeamInMatch(1, m)).toBe(7);
    expect(pointsForTeamInMatch(2, m)).toBe(0);
  });
});

describe("group stage scoring", () => {
  it("win 3-2: 4 + 3 + 0 = 7; loser: 0 + 2 + 0 = 2", () => {
    const m = match({
      stage: "group",
      group_letter: "A",
      status: "final",
      home_team_id: 1,
      away_team_id: 2,
      home_score: 3,
      away_score: 2,
    });
    expect(pointsForTeamInMatch(1, m)).toBe(7);
    expect(pointsForTeamInMatch(2, m)).toBe(2);
  });

  it("draw 0-0: each side gets 2 + 0 + 1 = 3", () => {
    const m = match({
      stage: "group",
      group_letter: "A",
      status: "final",
      home_team_id: 1,
      away_team_id: 2,
      home_score: 0,
      away_score: 0,
    });
    expect(pointsForTeamInMatch(1, m)).toBe(3);
    expect(pointsForTeamInMatch(2, m)).toBe(3);
  });

  it("scheduled match returns 0", () => {
    const m = match({ stage: "group", home_team_id: 1, away_team_id: 2 });
    expect(pointsForTeamInMatch(1, m)).toBe(0);
  });
});

describe("scoreTeam + advancement bonus", () => {
  it("sums group, knockout, and adds advancement bonus", () => {
    const teamId = 1;
    const matches: Match[] = [
      match({
        id: "g1",
        stage: "group",
        status: "final",
        home_team_id: 1,
        away_team_id: 2,
        home_score: 2,
        away_score: 0,
      }), // 4 + 2 + 1 = 7
      match({
        id: "k1",
        stage: "R32",
        status: "final",
        home_team_id: 1,
        away_team_id: 3,
        home_score: 1,
        away_score: 0,
      }), // 6 + 1 + 1 = 8
    ];
    const s = scoreTeam(teamId, matches, "group_winner");
    expect(s.group_points).toBe(7);
    expect(s.knockout_points).toBe(8);
    expect(s.advancement_points).toBe(10);
    expect(s.total).toBe(25);
  });
});

describe("roster legality", () => {
  const teams = {
    NED: team({ id: 1, code: "NED", tier: "A", price: 29, group_letter: "F", confederation: "UEFA" }),
    URU: team({ id: 2, code: "URU", tier: "B", price: 17, group_letter: "H", confederation: "CONMEBOL" }),
    MEX: team({ id: 3, code: "MEX", tier: "B", price: 17, group_letter: "A", confederation: "CONCACAF" }),
    SEN: team({ id: 4, code: "SEN", tier: "B", price: 17, group_letter: "I", confederation: "CAF" }),
    AUS: team({ id: 5, code: "AUS", tier: "B", price: 17, group_letter: "D", confederation: "AFC" }),
    // Conflicting picks for failure cases:
    GER: team({ id: 6, code: "GER", tier: "A", price: 29, group_letter: "E", confederation: "UEFA" }),
    ECU: team({ id: 7, code: "ECU", tier: "B", price: 17, group_letter: "E", confederation: "CONMEBOL" }),
  };

  it("legal 5-team roster passes (balanced portfolio, 97 pts)", () => {
    const r = checkRoster([teams.NED, teams.URU, teams.MEX, teams.SEN, teams.AUS]);
    expect(r.ok).toBe(true);
    expect(r.budgetUsed).toBe(29 + 17 + 17 + 17 + 17);
    expect(r.budgetUsed).toBeLessThanOrEqual(BUDGET);
  });

  it("fails when two teams share a group", () => {
    const r = checkRoster([teams.NED, teams.GER, teams.ECU, teams.MEX, teams.AUS]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Group E"))).toBe(true);
  });

  it("fails when 3 teams share a confederation", () => {
    const tooManyUefa = [
      team({ id: 10, code: "FRA", tier: "S", price: 43, group_letter: "I", confederation: "UEFA" }),
      team({ id: 11, code: "ESP", tier: "S", price: 43, group_letter: "H", confederation: "UEFA" }),
      team({ id: 12, code: "ENG", tier: "S", price: 43, group_letter: "L", confederation: "UEFA" }),
      teams.MEX,
      teams.AUS,
    ];
    const r = checkRoster(tooManyUefa);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("UEFA"))).toBe(true);
  });

  it("fails over budget", () => {
    const overBudget = [
      team({ id: 1, code: "A", tier: "S", price: 43, group_letter: "A", confederation: "UEFA" }),
      team({ id: 2, code: "B", tier: "S", price: 43, group_letter: "B", confederation: "UEFA" }),
      team({ id: 3, code: "C", tier: "B", price: 17, group_letter: "C", confederation: "AFC" }),
      team({ id: 4, code: "D", tier: "C", price: 9, group_letter: "D", confederation: "CAF" }),
      team({ id: 5, code: "E", tier: "D", price: 4, group_letter: "E", confederation: "CONMEBOL" }),
    ];
    const r = checkRoster(overBudget);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Over budget"))).toBe(true);
  });
});

describe("entry score + tiebreakers", () => {
  it("totals across teams and applies tiebreaks", () => {
    const teamIds = [1, 2];
    const matches: Match[] = [
      match({ stage: "group", status: "final", home_team_id: 1, away_team_id: 99, home_score: 2, away_score: 0 }),
      match({ stage: "group", status: "final", home_team_id: 2, away_team_id: 98, home_score: 1, away_score: 1 }),
    ];
    const adv = new Map([[1, "group_winner" as const], [2, "none" as const]]);
    const s = scoreEntry(teamIds, matches, adv);
    // team 1: 4+2+1 = 7 group, +10 advancement → 17
    // team 2: 2+1+0 = 3 group
    expect(s.total).toBe(17 + 3);
    expect(s.teams_advanced).toBe(1);
    expect(s.total_goals).toBe(3); // 2 + 1
  });

  it("compareEntryScores cascades through tiebreakers", () => {
    const a = { total: 50, group_points: 30, knockout_points: 20, advancement_points: 0, teams_advanced: 3, total_goals: 10, team_scores: [] };
    const b = { total: 50, group_points: 25, knockout_points: 25, advancement_points: 0, teams_advanced: 3, total_goals: 10, team_scores: [] };
    expect(compareEntryScores(a, b)).toBeLessThan(0); // a wins on group points
  });
});

describe("group advancement computation", () => {
  it("picks group winner + runner-up by points then GD", () => {
    const t1 = team({ id: 1, code: "AAA", group_letter: "A" });
    const t2 = team({ id: 2, code: "BBB", group_letter: "A" });
    const t3 = team({ id: 3, code: "CCC", group_letter: "A" });
    const t4 = team({ id: 4, code: "DDD", group_letter: "A" });
    const m = (h: number, a: number, hs: number, as_: number): Match =>
      match({ stage: "group", group_letter: "A", status: "final", home_team_id: h, away_team_id: a, home_score: hs, away_score: as_ });
    const matches: Match[] = [
      m(1, 2, 2, 0), m(1, 3, 1, 0), m(1, 4, 3, 0), // t1: 9 pts
      m(2, 3, 2, 1), m(2, 4, 1, 0),               // t2: 6 pts
      m(3, 4, 1, 0),                               // t3: 3 pts
    ];
    const adv = computeAdvancement([t1, t2, t3, t4], matches);
    expect(adv.get(1)).toBe("group_winner");
    expect(adv.get(2)).toBe("runner_up");
    // With only 1 group available and best-8-of-12 logic, the lone third-place
    // team trivially advances. With 12 groups this would compete.
    expect(adv.get(3)).toBe("best_third");
    expect(adv.get(4)).toBe("none");
  });
});
