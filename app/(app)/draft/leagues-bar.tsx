"use client";
import { useState, useTransition } from "react";
import { createLeague, joinLeague, leaveLeague } from "../leagues/actions";

export interface LeagueRow {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
}

export default function LeaguesBar({ initialLeagues }: { initialLeagues: LeagueRow[] }) {
  const [leagues, setLeagues] = useState<LeagueRow[]>(initialLeagues);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function onCreate() {
    if (!newName.trim()) return;
    setMsg(null);
    start(async () => {
      const res = await createLeague(newName);
      if (res.ok) {
        setLeagues((prev) => [...prev, { ...res.league, member_count: 1 }]);
        setNewName("");
        setMsg({ kind: "ok", text: `Created "${res.league.name}". Share code ${res.league.invite_code}.` });
      } else {
        setMsg({ kind: "err", text: res.error });
      }
    });
  }

  function onJoin() {
    if (!joinCode.trim()) return;
    setMsg(null);
    start(async () => {
      const res = await joinLeague(joinCode);
      if (res.ok) {
        if (!leagues.some((l) => l.id === res.league.id)) {
          setLeagues((prev) => [
            ...prev,
            { id: res.league.id, name: res.league.name, invite_code: joinCode.trim().toUpperCase(), member_count: 0 },
          ]);
        }
        setJoinCode("");
        setMsg({ kind: "ok", text: `Joined "${res.league.name}".` });
      } else {
        setMsg({ kind: "err", text: res.error });
      }
    });
  }

  function onLeave(id: string) {
    if (!confirm("Leave this league?")) return;
    start(async () => {
      const res = await leaveLeague(id);
      if (res.ok) {
        setLeagues((prev) => prev.filter((l) => l.id !== id));
        setMsg({ kind: "ok", text: "Left league." });
      } else {
        setMsg({ kind: "err", text: res.error ?? "Failed" });
      }
    });
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(code);
        setTimeout(() => setCopied(null), 1500);
      },
      () => undefined,
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Your leagues</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Compete against subsets of players. Same roster, separate leaderboards.
      </p>

      {leagues.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {leagues.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{l.name}</div>
                <div className="text-xs text-neutral-500">
                  Code: <span className="font-mono">{l.invite_code}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => copy(l.invite_code)}
                  className="btn-secondary"
                >
                  {copied === l.invite_code ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => onLeave(l.id)}
                  disabled={pending}
                  className="text-xs text-neutral-500 hover:text-accent"
                >
                  Leave
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">You aren&rsquo;t in any leagues yet.</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">Create a league</label>
          <div className="mt-1 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Khan Crew"
              className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <button onClick={onCreate} disabled={pending || !newName.trim()} className="btn-primary">
              Create
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">Join with a code</label>
          <div className="mt-1 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. KHAN42"
              className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm uppercase"
              maxLength={10}
            />
            <button onClick={onJoin} disabled={pending || !joinCode.trim()} className="btn-secondary">
              Join
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            msg.kind === "ok" ? "bg-pitch-50 text-pitch-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}
