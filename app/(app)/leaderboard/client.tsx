"use client";
import { useState, useMemo } from "react";
import type { Team } from "@/lib/types";
import type { EntryScore } from "@/lib/scoring";

export interface LeaderboardRow {
  entry_id: string;
  profile_id: string;
  entry_name: string;
  full_name: string;
  team_ids: number[];
  score: EntryScore;
}

interface Props {
  rows: LeaderboardRow[];
  teams: Team[];
  currentUserId: string;
  locked: boolean;
}

export default function LeaderboardClient({ rows, teams, currentUserId, locked }: Props) {
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="mt-4 text-sm text-neutral-600">No entries yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Ties broken by group-stage points → teams advanced → total goals.
      </p>
      {!locked && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Pool is still in draft — other players&rsquo; rosters are hidden until the commissioner locks the pool.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {rows.map((row, i) => {
          const isMe = row.profile_id === currentUserId;
          const isOpen = expanded.has(row.entry_id);
          return (
            <li
              key={row.entry_id}
              className={[
                "overflow-hidden rounded-lg border bg-white",
                isMe ? "border-pitch-500 ring-1 ring-pitch-500/30" : "border-neutral-200",
              ].join(" ")}
            >
              <button
                onClick={() => toggle(row.entry_id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 text-right text-sm font-semibold text-neutral-500">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {row.entry_name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-pitch-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-pitch-700">
                          you
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-neutral-500">{row.full_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{row.score.total}</div>
                    <div className="text-[10px] uppercase tracking-wide text-neutral-500">pts</div>
                  </div>
                  <span className={`text-neutral-400 transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                  {!locked && !isMe ? (
                    <p className="text-sm text-neutral-500">
                      Picks hidden until the pool locks.
                    </p>
                  ) : (
                  <>
                  <div className="mb-2 grid grid-cols-3 gap-2 text-xs text-neutral-600">
                    <div>Group <strong className="text-neutral-900">{row.score.group_points}</strong></div>
                    <div>Knockout <strong className="text-neutral-900">{row.score.knockout_points}</strong></div>
                    <div>Advancement <strong className="text-neutral-900">{row.score.advancement_points}</strong></div>
                  </div>
                  <ul className="space-y-1">
                    {row.score.team_scores.map((ts) => {
                      const t = teamById.get(ts.team_id);
                      if (!t) return null;
                      return (
                        <li
                          key={ts.team_id}
                          className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-sm"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span className="text-lg">{t.flag}</span>
                            <span className="truncate">{t.name}</span>
                            <span className="text-xs text-neutral-500">({t.group_letter})</span>
                          </span>
                          <span className="flex items-center gap-3 text-xs text-neutral-500">
                            <span>G {ts.group_points}</span>
                            <span>K {ts.knockout_points}</span>
                            <span>A {ts.advancement_points}</span>
                            <span className="text-sm font-semibold text-neutral-900">{ts.total}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
