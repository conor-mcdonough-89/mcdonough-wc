"use client";
import { useMemo, useState } from "react";
import type { Match, Team, Stage } from "@/lib/types";

const STAGE_LABEL: Record<Stage, string> = {
  group: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  "3P": "Third-place match",
  F: "Final",
};

const STAGE_RANK: Record<Stage, number> = {
  group: 0, R32: 1, R16: 2, QF: 3, SF: 4, "3P": 5, F: 6,
};

interface Props {
  matches: Match[];
  teams: Team[];
  myTeamIds: number[];
  pointsByMatch: Record<string, number>;
  myTotal: number;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ScoringClient({ matches, teams, myTeamIds, pointsByMatch, myTotal }: Props) {
  const [myOnly, setMyOnly] = useState(false);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const myTeamSet = useMemo(() => new Set(myTeamIds), [myTeamIds]);

  // Split into scheduled (have a kickoff) and unscheduled. Scheduled go in date-keyed
  // buckets sorted ascending; unscheduled fall back to stage-grouped at the bottom.
  const { byDay, dayKeys, unscheduledByStage } = useMemo(() => {
    const scheduled = matches.filter((m) => !!m.kickoff);
    const unscheduled = matches.filter((m) => !m.kickoff);

    scheduled.sort((a, b) => a.kickoff!.localeCompare(b.kickoff!));
    const byDay = new Map<string, Match[]>();
    for (const m of scheduled) {
      const k = dayKey(m.kickoff!);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(m);
    }
    const dayKeys = Array.from(byDay.keys()).sort();

    const unscheduledByStage = new Map<Stage, Match[]>();
    for (const m of unscheduled) {
      if (!unscheduledByStage.has(m.stage)) unscheduledByStage.set(m.stage, []);
      unscheduledByStage.get(m.stage)!.push(m);
    }
    for (const list of unscheduledByStage.values()) {
      list.sort((a, b) => (a.slot ?? "").localeCompare(b.slot ?? ""));
    }
    return { byDay, dayKeys, unscheduledByStage };
  }, [matches]);

  const visible = (m: Match): boolean => {
    if (!myOnly) return true;
    return (
      (m.home_team_id != null && myTeamSet.has(m.home_team_id)) ||
      (m.away_team_id != null && myTeamSet.has(m.away_team_id))
    );
  };

  const unscheduledStages = Array.from(unscheduledByStage.keys()).sort(
    (a, b) => STAGE_RANK[a] - STAGE_RANK[b],
  );

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

      {dayKeys.map((k) => {
        const rows = byDay.get(k)!.filter(visible);
        if (rows.length === 0) return null;
        return (
          <section key={k} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {formatDayLabel(k)}
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

      {unscheduledStages.length > 0 && (
        <section className="mt-8 border-t border-dashed border-neutral-300 pt-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Unscheduled (date TBD)
          </h2>
          {unscheduledStages.map((stage) => {
            const rows = unscheduledByStage.get(stage)!.filter(visible);
            if (rows.length === 0) return null;
            return (
              <div key={stage} className="mb-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  {STAGE_LABEL[stage]}
                </h3>
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
              </div>
            );
          })}
        </section>
      )}
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
            {match.kickoff ? formatTime(match.kickoff) : match.slot ?? "TBD"}
            {match.group_letter ? ` · Group ${match.group_letter}` : ""}
            {match.stage !== "group" && ` · ${STAGE_LABEL[match.stage]}`}
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
