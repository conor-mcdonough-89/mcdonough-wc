"use client";
import { useState, useTransition, useMemo } from "react";
import type { Match, Team, TeamAdvancement, PoolSettings, AdvancementResult, Stage } from "@/lib/types";
import {
  setPoolStatus,
  setFinalBonus,
  addPlayers,
  updateTeam,
  updateMatch,
  setAdvancement,
  recomputeAdvancement,
  recomputeScores,
  type AddPlayerResult,
} from "./actions";

interface Profile {
  id: string;
  phone: string;
  full_name: string | null;
  entry_name: string | null;
  is_admin: boolean;
  onboarded: boolean;
}

interface Props {
  settings: PoolSettings;
  teams: Team[];
  matches: Match[];
  advancement: TeamAdvancement[];
  entries: { id: string; profile_id: string; entry_picks: { team_id: number }[] }[];
  profiles: Profile[];
}

const STAGE_LABEL: Record<Stage, string> = {
  group: "Group",
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  "3P": "3rd-place",
  F: "Final",
};

export default function AdminClient(props: Props) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <LockSection settings={props.settings} />
      <AddPlayersSection />
      <PlayersSection profiles={props.profiles} entries={props.entries} />
      <TeamsSection teams={props.teams} />
      <MatchesSection matches={props.matches} teams={props.teams} />
      <AdvancementSection teams={props.teams} advancement={props.advancement} />
    </div>
  );
}

// ---------- Lock + final bonus ----------
function LockSection({ settings }: { settings: PoolSettings }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(settings.status);
  const [finalBonus, setFinalBonusLocal] = useState(settings.final_bonus);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle() {
    const next = status === "draft" ? "locked" : "draft";
    start(async () => {
      const r = await setPoolStatus(next);
      if (r.ok) { setStatus(next); setMsg(null); }
      else setMsg(r.error ?? "Failed");
    });
  }

  function saveBonus() {
    start(async () => {
      const r = await setFinalBonus(finalBonus);
      setMsg(r.ok ? "Saved." : r.error ?? "Failed");
    });
  }

  return (
    <Section title="Pool status">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Status: <strong className={status === "locked" ? "text-amber-700" : "text-pitch-700"}>{status}</strong>
        </span>
        <button onClick={toggle} disabled={pending} className="btn-primary">
          {pending ? "…" : status === "draft" ? "Lock drafts" : "Unlock drafts"}
        </button>
        <div className="ml-4 flex items-center gap-2 text-sm">
          <label>Final win base</label>
          <input
            type="number"
            value={finalBonus}
            onChange={(e) => setFinalBonusLocal(parseInt(e.target.value, 10) || 0)}
            className="w-16 rounded border border-neutral-300 px-2 py-1"
          />
          <button onClick={saveBonus} disabled={pending} className="btn-secondary">Save</button>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm text-neutral-600">{msg}</p>}
    </Section>
  );
}

// ---------- Add players ----------
function AddPlayersSection() {
  const [csv, setCsv] = useState("");
  const [results, setResults] = useState<AddPlayerResult[]>([]);
  const [pending, start] = useTransition();

  function submit() {
    const rows = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l, i) => !(i === 0 && /phone/i.test(l)))
      .map((line) => {
        const [phone, full_name, entry_name] = line.split(",").map((s) => s.trim());
        return { phone, full_name, entry_name: entry_name || undefined };
      })
      .filter((r) => r.phone && r.full_name);
    if (rows.length === 0) return;
    start(async () => {
      const res = await addPlayers(rows);
      setResults(res);
    });
  }

  return (
    <Section title="Add players">
      <p className="mb-2 text-sm text-neutral-600">
        Paste lines as <code>phone, full_name [, entry_name]</code> (header optional). Phones get normalized to E.164.
      </p>
      <textarea
        rows={5}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="555-123-4567, Jane Smith, JS Picks"
        className="w-full rounded border border-neutral-300 p-2 font-mono text-sm"
      />
      <div className="mt-2">
        <button onClick={submit} disabled={pending} className="btn-primary">
          {pending ? "Creating…" : "Create accounts"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded border border-neutral-200 bg-neutral-50 p-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Invite list (copy to send)
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Phone</th>
                <th className="px-2 py-1">Temp password</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t border-neutral-200">
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1 font-mono">{r.phone}</td>
                  <td className="px-2 py-1 font-mono">{r.password ?? "—"}</td>
                  <td className="px-2 py-1">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---------- Players list ----------
function PlayersSection({
  profiles,
  entries,
}: {
  profiles: Profile[];
  entries: { profile_id: string; entry_picks: { team_id: number }[] }[];
}) {
  const picksByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.profile_id, e.entry_picks.length);
    return map;
  }, [entries]);
  return (
    <Section title={`Players (${profiles.length})`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Entry</th>
              <th className="px-2 py-1">Phone</th>
              <th className="px-2 py-1">Onboarded</th>
              <th className="px-2 py-1">Picks</th>
              <th className="px-2 py-1">Admin</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const n = picksByProfile.get(p.id) ?? 0;
              const complete = n === 5;
              return (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-2 py-1">{p.full_name ?? "—"}</td>
                  <td className="px-2 py-1">{p.entry_name ?? "—"}</td>
                  <td className="px-2 py-1 font-mono text-xs">{p.phone}</td>
                  <td className="px-2 py-1">{p.onboarded ? "yes" : "no"}</td>
                  <td className={`px-2 py-1 ${complete ? "text-pitch-700" : "text-amber-700"}`}>
                    {n}/5
                  </td>
                  <td className="px-2 py-1">{p.is_admin ? "yes" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ---------- Teams (price / tier / rank) ----------
function TeamsSection({ teams }: { teams: Team[] }) {
  return (
    <Section title="Teams (price · tier · FIFA rank)">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="px-2 py-1">Team</th>
              <th className="px-2 py-1">Group</th>
              <th className="px-2 py-1">Tier</th>
              <th className="px-2 py-1">Price</th>
              <th className="px-2 py-1">FIFA rank</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => <TeamRow key={t.id} team={t} />)}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TeamRow({ team }: { team: Team }) {
  const [tier, setTier] = useState(team.tier);
  const [price, setPrice] = useState(team.price);
  const [rank, setRank] = useState<number | "">(team.fifa_rank ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    start(async () => {
      const r = await updateTeam(team.id, {
        tier,
        price: Number(price),
        fifa_rank: rank === "" ? null : Number(rank),
      });
      setMsg(r.ok ? "✓" : r.error ?? "err");
    });
  }

  return (
    <tr className="border-t border-neutral-100">
      <td className="px-2 py-1"><span className="mr-1">{team.flag}</span>{team.name}</td>
      <td className="px-2 py-1">{team.group_letter}</td>
      <td className="px-2 py-1">
        <select value={tier} onChange={(e) => setTier(e.target.value as Team["tier"])} className="rounded border border-neutral-300 px-1">
          {["S","A","B","C","D"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <input type="number" value={price} onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)} className="w-16 rounded border border-neutral-300 px-1" />
      </td>
      <td className="px-2 py-1">
        <input type="number" value={rank} onChange={(e) => setRank(e.target.value === "" ? "" : parseInt(e.target.value, 10))} className="w-16 rounded border border-neutral-300 px-1" />
      </td>
      <td className="px-2 py-1">
        <button onClick={save} disabled={pending} className="btn-secondary">Save</button>
        {msg && <span className="ml-2 text-xs">{msg}</span>}
      </td>
    </tr>
  );
}

// ---------- Matches ----------
function MatchesSection({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  const [stage, setStage] = useState<Stage>("group");
  const filtered = matches.filter((m) => m.stage === stage);

  return (
    <Section title="Match results">
      <div className="mb-2 flex flex-wrap gap-1 text-sm">
        {(["group","R32","R16","QF","SF","3P","F"] as Stage[]).map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={[
              "rounded-md px-3 py-1",
              stage === s ? "bg-pitch-600 text-white" : "bg-neutral-100 hover:bg-neutral-200",
            ].join(" ")}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {filtered.map((m) => <MatchEditor key={m.id} match={m} teams={teams} />)}
      </ul>
    </Section>
  );
}

function MatchEditor({ match, teams }: { match: Match; teams: Team[] }) {
  const [home, setHome] = useState<number | null>(match.home_team_id);
  const [away, setAway] = useState<number | null>(match.away_team_id);
  const [hs, setHs] = useState<number | "">(match.home_score ?? "");
  const [as_, setAs] = useState<number | "">(match.away_score ?? "");
  const [pens, setPens] = useState(match.went_to_penalties);
  const [penWinner, setPenWinner] = useState<number | null>(match.penalty_winner_team_id);
  const [status, setStatus] = useState(match.status);
  const [kickoff, setKickoff] = useState(match.kickoff ? match.kickoff.slice(0, 16) : "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    start(async () => {
      const r = await updateMatch(match.id, {
        home_team_id: home,
        away_team_id: away,
        home_score: hs === "" ? null : Number(hs),
        away_score: as_ === "" ? null : Number(as_),
        went_to_penalties: pens,
        penalty_winner_team_id: pens ? penWinner : null,
        status,
        kickoff: kickoff ? new Date(kickoff).toISOString() : null,
      });
      setMsg(r.ok ? "✓ saved" : r.error ?? "err");
    });
  }

  return (
    <li className="rounded-md border border-neutral-200 bg-white p-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-center">
        <TeamSelect value={home} onChange={setHome} teams={teams} placeholder="Home" />
        <TeamSelect value={away} onChange={setAway} teams={teams} placeholder="Away" />
        <div className="flex items-center gap-1">
          <input type="number" value={hs} onChange={(e) => setHs(e.target.value === "" ? "" : parseInt(e.target.value, 10))} className="w-12 rounded border border-neutral-300 px-1" />
          <span>–</span>
          <input type="number" value={as_} onChange={(e) => setAs(e.target.value === "" ? "" : parseInt(e.target.value, 10))} className="w-12 rounded border border-neutral-300 px-1" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as Match["status"])} className="rounded border border-neutral-300 px-1 text-sm">
          <option value="scheduled">scheduled</option>
          <option value="final">final</option>
        </select>
        <button onClick={save} disabled={pending} className="btn-secondary">Save</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={pens} onChange={(e) => setPens(e.target.checked)} />
          Pens
        </label>
        {pens && (
          <TeamSelect value={penWinner} onChange={setPenWinner} teams={teams.filter((t) => t.id === home || t.id === away)} placeholder="Winner" small />
        )}
        <label className="flex items-center gap-1">
          Kickoff
          <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="rounded border border-neutral-300 px-1" />
        </label>
        {match.slot && <span>slot {match.slot}</span>}
        {match.group_letter && <span>Group {match.group_letter}</span>}
        {msg && <span>{msg}</span>}
      </div>
    </li>
  );
}

function TeamSelect({
  value,
  onChange,
  teams,
  placeholder,
  small,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  teams: Team[];
  placeholder: string;
  small?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className={`rounded border border-neutral-300 px-1 ${small ? "text-xs" : "text-sm"}`}
    >
      <option value="">{placeholder}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.flag} {t.name}</option>
      ))}
    </select>
  );
}

// ---------- Advancement ----------
function AdvancementSection({
  teams,
  advancement,
}: {
  teams: Team[];
  advancement: TeamAdvancement[];
}) {
  const byId = useMemo(() => new Map(advancement.map((a) => [a.team_id, a.result])), [advancement]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function recompute() {
    start(async () => {
      const r = await recomputeAdvancement();
      setMsg(r.ok ? `Recomputed ${r.updated} rows.` : r.error ?? "err");
    });
  }
  function bust() {
    start(async () => {
      await recomputeScores();
      setMsg("Caches busted.");
    });
  }

  return (
    <Section title="Team advancement">
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={recompute} disabled={pending} className="btn-primary">
          {pending ? "…" : "Recompute from group results"}
        </button>
        <button onClick={bust} disabled={pending} className="btn-secondary">
          Recompute scores (bust cache)
        </button>
        {msg && <span className="self-center text-sm text-neutral-600">{msg}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="px-2 py-1">Team</th>
              <th className="px-2 py-1">Group</th>
              <th className="px-2 py-1">Result</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <AdvancementRow key={t.id} team={t} current={byId.get(t.id) ?? "none"} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function AdvancementRow({ team, current }: { team: Team; current: AdvancementResult }) {
  const [val, setVal] = useState<AdvancementResult>(current);
  const [pending, start] = useTransition();
  function onChange(next: AdvancementResult) {
    setVal(next);
    start(async () => {
      await setAdvancement(team.id, next);
    });
  }
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-2 py-1"><span className="mr-1">{team.flag}</span>{team.name}</td>
      <td className="px-2 py-1">{team.group_letter}</td>
      <td className="px-2 py-1">
        <select
          value={val}
          onChange={(e) => onChange(e.target.value as AdvancementResult)}
          disabled={pending}
          className="rounded border border-neutral-300 px-1 text-sm"
        >
          <option value="none">none</option>
          <option value="group_winner">group winner (+10)</option>
          <option value="runner_up">runner-up (+7)</option>
          <option value="best_third">best third (+4)</option>
        </select>
      </td>
    </tr>
  );
}

// ---------- shared ----------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
