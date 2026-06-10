export type Tier = "S" | "A" | "B" | "C" | "D";
export type Stage = "group" | "R32" | "R16" | "QF" | "SF" | "F" | "3P";
export type MatchStatus = "scheduled" | "final";
export type AdvancementResult = "group_winner" | "runner_up" | "best_third" | "none";
export type PoolStatus = "draft" | "locked";

export interface Team {
  id: number;
  name: string;
  code: string;
  flag: string;
  tier: Tier;
  price: number;
  group_letter: string;
  confederation: string;
  fifa_rank: number | null;
}

export interface Profile {
  id: string;
  phone: string;
  entry_name: string | null;
  full_name: string | null;
  is_admin: boolean;
  onboarded: boolean;
  created_at: string;
}

export interface Entry {
  id: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface EntryPick {
  id: string;
  entry_id: string;
  team_id: number;
}

export interface Match {
  id: string;
  stage: Stage;
  group_letter: string | null;
  kickoff: string | null;
  venue: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  went_to_penalties: boolean;
  penalty_winner_team_id: number | null;
  status: MatchStatus;
  slot: string | null;
}

export interface TeamAdvancement {
  team_id: number;
  result: AdvancementResult;
}

export interface PoolSettings {
  id: number;
  status: PoolStatus;
  invite_code: string | null;
  final_bonus: number;
}

export interface League {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface LeagueMember {
  league_id: string;
  profile_id: string;
  joined_at: string;
}
