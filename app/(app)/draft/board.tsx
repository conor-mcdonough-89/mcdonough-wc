"use client";
import { useMemo, useState, useTransition } from "react";
import type { Team, Tier } from "@/lib/types";
import {
  checkRoster,
  BUDGET,
  ROSTER_SIZE,
  MAX_PER_GROUP,
  MAX_PER_CONFEDERATION,
} from "@/lib/scoring";
import { saveRoster } from "./actions";
import teamsSeed from "../../../teams-seed.json";

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];
const TIER_LABEL: Record<Tier, string> = {
  S: "S-tier",
  A: "A-tier",
  B: "B-tier",
  C: "C-tier",
  D: "D-tier",
};

interface Props {
  teams: Team[];
  initialPicks: number[];
  locked: boolean;
}

export default function DraftBoard({ teams, initialPicks, locked }: Props) {
  const [picked, setPicked] = useState<Set<number>>(new Set(initialPicks));
  const [saving, startSave] = useTransition();
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const codeByTeamId = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of teams) map.set(t.id, t.code);
    return map;
  }, [teams]);

  // Map team.code -> group_opponents from the seed so we can render "vs CZE · KOR · RSA".
  const opponentsByCode = useMemo(() => {
    const map = new Map<string, string[]>();
    type SeedRow = { code: string; group_opponents: string[] };
    const rows = (teamsSeed as { teams: SeedRow[] }).teams;
    for (const r of rows) map.set(r.code, r.group_opponents);
    return map;
  }, []);

  const pickedTeams = useMemo(
    () => Array.from(picked).map((id) => teamById.get(id)!).filter(Boolean),
    [picked, teamById],
  );

  const legality = useMemo(
    () => checkRoster(pickedTeams, { allowPartial: true }),
    [pickedTeams],
  );

  const byTier = useMemo(() => {
    const buckets = new Map<Tier, Team[]>();
    for (const tier of TIER_ORDER) buckets.set(tier, []);
    for (const t of teams) buckets.get(t.tier)!.push(t);
    for (const tier of TIER_ORDER) {
      buckets.get(tier)!.sort((a, b) => (a.fifa_rank ?? 999) - (b.fifa_rank ?? 999));
    }
    return buckets;
  }, [teams]);

  function reasonForDisable(t: Team): string | null {
    if (picked.has(t.id)) return null;
    if (locked) return "Locked";
    if (pickedTeams.length >= ROSTER_SIZE) return "Roster full";
    if (legality.budgetUsed + t.price > BUDGET) {
      return `Costs ${t.price} (only ${BUDGET - legality.budgetUsed} left)`;
    }
    const groupCount = pickedTeams.filter((p) => p.group_letter === t.group_letter).length;
    if (groupCount >= MAX_PER_GROUP) return `Already have a team from Group ${t.group_letter}`;
    const confCount = pickedTeams.filter((p) => p.confederation === t.confederation).length;
    if (confCount >= MAX_PER_CONFEDERATION) return `${t.confederation} cap (max ${MAX_PER_CONFEDERATION})`;
    return null;
  }

  function toggle(t: Team) {
    if (locked) return;
    setFlash(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(t.id)) next.delete(t.id);
      else if (!reasonForDisable(t)) next.add(t.id);
      return next;
    });
  }

  function onSave() {
    const final = checkRoster(pickedTeams);
    if (!final.ok) {
      setFlash({ kind: "err", msg: final.errors.join(" ") });
      return;
    }
    startSave(async () => {
      const res = await saveRoster(Array.from(picked));
      setFlash(res.ok ? { kind: "ok", msg: "Saved." } : { kind: "err", msg: res.error ?? "Save failed." });
    });
  }

  const tierPrice: Record<Tier, number> = { S: 43, A: 29, B: 17, C: 9, D: 4 };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      {/* Teams list */}
      <section>
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Build your roster</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Budget <strong>{BUDGET}</strong> · pick <strong>{ROSTER_SIZE}</strong> teams ·
            max 1 per group · max 2 per confederation · prices:{" "}
            {TIER_ORDER.map((t) => `${t} ${tierPrice[t]}`).join(" · ")}
          </p>
        </div>
        {TIER_ORDER.map((tier) => (
          <div key={tier} className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{TIER_LABEL[tier]}</h2>
              <span className="text-sm text-neutral-500">{tierPrice[tier]} pts</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {byTier.get(tier)!.map((t) => {
                const isPicked = picked.has(t.id);
                const disabled = !isPicked && !!reasonForDisable(t);
                const reason = reasonForDisable(t);
                const opponents = opponentsByCode.get(t.code) ?? [];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t)}
                    disabled={disabled && !isPicked}
                    className={[
                      "rounded-lg border px-3 py-2 text-left transition",
                      isPicked
                        ? "border-pitch-500 bg-pitch-50 ring-1 ring-pitch-500"
                        : disabled
                        ? "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-60"
                        : "border-neutral-200 bg-white hover:border-pitch-500",
                    ].join(" ")}
                    title={reason ?? ""}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-2xl">{t.flag}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.name}</div>
                          <div className="text-xs text-neutral-500">
                            #{t.fifa_rank ?? "?"} · Group {t.group_letter} · {t.confederation}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            vs {opponents.join(" · ")}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold">{t.price}</div>
                        {isPicked && <div className="text-[10px] uppercase tracking-wide text-pitch-700">picked</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Roster panel */}
      <aside className="md:sticky md:top-4 md:self-start">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your roster</h2>
            {locked && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Locked
              </span>
            )}
          </div>

          <BudgetMeter used={legality.budgetUsed} />

          <div className="mt-3 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Teams</span>
              <span>{pickedTeams.length} / {ROSTER_SIZE}</span>
            </div>
          </div>

          <ul className="mt-3 space-y-1">
            {pickedTeams.length === 0 && (
              <li className="text-sm text-neutral-500">No teams picked yet.</li>
            )}
            {pickedTeams.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-md bg-neutral-50 px-2 py-1.5 text-sm"
              >
                <span className="truncate">
                  <span className="mr-1.5">{t.flag}</span>
                  {t.name}{" "}
                  <span className="text-xs text-neutral-500">({t.group_letter})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-neutral-600">{t.price}</span>
                  {!locked && (
                    <button
                      onClick={() => toggle(t)}
                      className="text-neutral-400 hover:text-accent"
                      aria-label={`Remove ${t.name}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {legality.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-800">
              {legality.errors.map((e, i) => (
                <li key={i}>· {e}</li>
              ))}
            </ul>
          )}

          {!locked && (
            <button
              onClick={onSave}
              disabled={saving || pickedTeams.length !== ROSTER_SIZE || !legality.ok}
              className="mt-4 w-full rounded-md bg-pitch-600 px-4 py-2 font-medium text-white hover:bg-pitch-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save roster"}
            </button>
          )}

          {flash && (
            <p
              className={[
                "mt-3 rounded-md px-3 py-2 text-sm",
                flash.kind === "ok" ? "bg-pitch-50 text-pitch-700" : "bg-red-50 text-red-700",
              ].join(" ")}
            >
              {flash.msg}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function BudgetMeter({ used }: { used: number }) {
  const pct = Math.min(100, (used / BUDGET) * 100);
  const over = used > BUDGET;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-600">Budget</span>
        <span className={over ? "font-semibold text-accent" : "font-semibold"}>
          {used} / {BUDGET}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={over ? "h-full bg-accent" : "h-full bg-pitch-500"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
