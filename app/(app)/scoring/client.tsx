"use client";
import { useMemo, useState } from "react";
import type { Match, Team, Stage } from "@/lib/types";

const STAGE_ORDER: Stage[] = ["group", "R32", "R16", "QF", "SF", "3P", "F"];
const STAGE_LABEL: Record<Stage, string> = {
  group: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  "3P": "Third-place match",
  F: "Final",
};

interface Props {
  matches: Match[];
  teams: Team[];
  myTeamIds: number[];
  pointsByMatch: Record<string, number>;
  myTotal: number;
}

export default function ScoringClient({ matches, teams, myTeamIds, pointsByMatch, myTotal }: Props) {
  const [myOnly, setMyOnly] = useState(false);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const myTeamSet = useMemo(() => new Set(myTeamIds), [myTeamIds]);

  const grouped = useMemo(() => {
    const map = new Map<Stage, Match[]>();
    for (const s of STAGE_ORDER) map.set(s, []);
    for (const m of matches) map.get(m.stage)!.push(m);
    for (const s of STAGE_ORDER) {
      map.get(s)!.sort((a, b) => {
        if (a.kickoff && b.kickoff) return a.kickoff.localeCompare(b.kickoff);
        if (a.kickoff) return -1;
        if (b.kickoff) return 1;
        return (a.slot ?? "").localeCompare(b.slot ?? "");
      });
    }
    return map;
  }, [matches]);

  const visible = (m: Match): boolean => {
    if (!myOnly) return true;
    return (
      (m.home_team_id != null && myTeamSet.has(m.home_team_id)) ||
      (m.away_team_id != null && myTeamSet.has(m.away_team_id))
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Scoring</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Your running total: <strong className="text-pitch-700">{myTotal}</strong> pts
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={myOnly}
            onChange={(e) => setMyOnly(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-pitch-600 focus:ring-pitch-500"
          />
          My matches only
        </label>
      </div>

      {STAGE_ORDER.map((stage) => {
        const rows = grouped.get(stage)!.filter(visible);
        if (rows.length === 0) return null;
        return (
          <section key={stage} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {STAGE_LABEL[stage]}
            </h2>
            <ul className="space-y-1">
              {rows.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  teamById={teamById}
                  myTeamSet={myTeamSet}
                  myPoints={pointsByMatch[m.id] ?? 0}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MatchRow({
  match,
  teamById,
  myTeamSet,
  myPoints,
}: {
  match: Match;
  teamById: Map<number, Team>;
  myTeamSet: Set<number>;
  myPoints: number;
}) {
  const home = match.home_team_id ? teamById.get(match.home_team_id) ?? null : null;
  const away = match.away_team_id ? teamById.get(match.away_team_id) ?? null : null;
  const involvesMine =
    (match.home_team_id != null && myTeamSet.has(match.home_team_id)) ||
    (match.away_team_id != null && myTeamSet.has(match.away_team_id));
  const final = match.status === "final" && match.home_score != null && match.away_score != null;

  return (
    <li
      className={[
        "rounded-md border bg-white px-3 py-2",
        involvesMine ? "border-pitch-500 ring-1 ring-pitch-500/40" : "border-neutral-200",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-neutral-500">
            {match.kickoff ? new Date(match.kickoff).toLocaleString() : match.slot ?? "TBD"}
            {match.group_letter ? ` · Group ${match.group_letter}` : ""}
            {match.venue ? ` · ${match.venue}` : ""}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <TeamCell team={home} isMine={!!home && myTeamSet.has(home.id)} />
            {final ? (
              <span className="font-mono font-semibold">
                {match.home_score}–{match.away_score}
                {match.went_to_penalties && (
                  <span className="ml-1 text-xs font-normal text-neutral-500">(pens)</span>
                )}
              </span>
            ) : (
              <span className="text-xs text-neutral-400">vs</span>
            )}
            <TeamCell team={away} isMine={!!away && myTeamSet.has(away.id)} reverse />
          </div>
        </div>
        <div className="shrink-0 text-right">
          {final ? (
            <span
              className={[
                "rounded-md px-2 py-0.5 text-xs font-semibold",
                myPoints > 0
                  ? "bg-pitch-100 text-pitch-700"
                  : involvesMine
                  ? "bg-neutral-100 text-neutral-500"
                  : "text-neutral-300",
              ].join(" ")}
            >
              {myPoints > 0 ? `+${myPoints}` : involvesMine ? "0" : "—"}
            </span>
          ) : (
            <span className="text-xs text-neutral-300">—</span>
          )}
        </div>
      </div>
    </li>
  );
}

function TeamCell({ team, isMine, reverse }: { team: Team | null; isMine: boolean; reverse?: boolean }) {
  if (!team) return <span className="text-xs text-neutral-400">TBD</span>;
  return (
    <span
      className={[
        "flex min-w-0 items-center gap-1.5 truncate",
        reverse ? "flex-row-reverse text-right" : "",
        isMine ? "font-semibold" : "",
      ].join(" ")}
    >
      <span className="text-lg">{team.flag}</span>
      <span className="truncate">{team.code}</span>
    </span>
  );
}
