"use client";

import { useState } from "react";

import { formatPoints } from "@/lib/utils";
import type { TeamView } from "@/server/queries/team-view";

const TABS = ["Roster", "Matchups", "Drafts", "Transactions"] as const;

export function TeamExplorer({ view }: { view: TeamView }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Roster");
  const [week, setWeek] = useState(view.matchups.at(-1)?.week ?? null);
  const [draftId, setDraftId] = useState(view.drafts[0]?.externalId ?? "");
  const [onlyRoster, setOnlyRoster] = useState(true);
  const matchup = view.matchups.find((item) => item.week === week) ?? null;
  const draft = view.drafts.find((item) => item.externalId === draftId) ?? view.drafts[0];
  const transactions = view.transactions.filter((item) => (onlyRoster ? item.selectedTeam : true));

  return (
    <div>
      <div role="tablist" aria-label="Imported league data" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`rounded-md border px-3 py-1.5 text-sm ${tab === item ? "border-teal text-foreground" : "border-line text-muted"}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4" role="tabpanel">
        {tab === "Roster" ? <RosterTab view={view} /> : null}
        {tab === "Matchups" ? <MatchupTab view={view} week={week} onWeek={setWeek} matchup={matchup} /> : null}
        {tab === "Drafts" ? <DraftTab view={view} draft={draft} onDraft={setDraftId} /> : null}
        {tab === "Transactions" ? (
          <TransactionTab transactions={transactions} onlyRoster={onlyRoster} onToggle={setOnlyRoster} />
        ) : null}
      </div>
    </div>
  );
}

function RosterTab({ view }: { view: TeamView }) {
  if (!view.rosterFound) return <Empty>This roster was not in the imported league.</Empty>;
  return (
    <div className="space-y-4">
      {view.incompleteReason ? <p className="text-sm text-muted">{view.incompleteReason}</p> : null}
      {view.groups.map((group) => (
        <section key={group.label}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{group.label}</h3>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {group.players.map((player) => (
              <li key={`${group.label}-${player.playerId}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span>
                  {player.name}
                  {player.unresolved ? <span className="ml-2 text-xs text-amber">Unresolved</span> : null}
                </span>
                <span className="font-mono text-sm text-muted">
                  {[player.position, player.nflTeam].filter(Boolean).join(" · ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MatchupTab({
  view,
  week,
  onWeek,
  matchup,
}: {
  view: TeamView;
  week: number | null;
  onWeek: (week: number) => void;
  matchup: TeamView["matchups"][number] | null;
}) {
  if (view.matchups.length === 0) return <Empty>No matchup weeks were imported.</Empty>;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {view.matchups.map((item) => (
          <button
            key={item.week}
            type="button"
            className={`rounded-md border px-2 py-1 font-mono text-sm ${item.week === week ? "border-teal" : "border-line text-muted"}`}
            onClick={() => onWeek(item.week)}
          >
            W{item.week}
            {item.partial ? " · partial" : ""}
            {item.seasonType === "post" ? " · post" : ""}
          </button>
        ))}
      </div>
      {matchup ? (
        <div className="mt-4 rounded-lg border border-line p-4">
          <p className="text-sm text-muted">
            {matchup.seasonType === "post" ? "Postseason" : "Regular season"}
            {matchup.partial ? " · partial current week" : ""}
          </p>
          <p className="mt-2 text-2xl font-semibold">{formatPoints(matchup.points)}</p>
          {matchup.customPoints !== null ? (
            <p className="text-sm text-amber">Commissioner override recorded: {formatPoints(matchup.customPoints)}</p>
          ) : null}
          <p className="mt-2 text-sm">
            {matchup.opponent
              ? `Opponent: ${matchup.opponent.name} (${formatPoints(matchup.opponent.points)})`
              : "No opponent was recorded for this matchup id."}
          </p>
          {!matchup.pointsAligned ? (
            <p className="mt-2 text-sm text-amber">Starter points were not aligned with the starter list, so they are omitted.</p>
          ) : null}
          <ul className="mt-3 divide-y divide-line">
            {matchup.starters.map((player) => (
              <li key={player.playerId} className="flex justify-between gap-3 py-2 text-sm">
                <span>
                  {player.name}
                  {player.unresolved ? <span className="ml-2 text-xs text-amber">Unresolved</span> : null}
                </span>
                <span className="font-mono">{matchup.pointsAligned ? formatPoints(player.points) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DraftTab({
  view,
  draft,
  onDraft,
}: {
  view: TeamView;
  draft: TeamView["drafts"][number] | undefined;
  onDraft: (id: string) => void;
}) {
  if (!draft) return <Empty>No drafts were imported.</Empty>;
  const slotCount = Math.max(draft.slots.length, 1);
  return (
    <div>
      {view.drafts.length > 1 ? (
        <label className="text-sm text-muted">
          Draft
          <select
            className="ml-2 rounded-md border border-line bg-background px-2 py-1"
            value={draft.externalId}
            onChange={(event) => onDraft(event.target.value)}
          >
            {view.drafts.map((item) => (
              <option key={item.externalId} value={item.externalId}>
                {item.season} {item.type} ({item.status})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-muted">
          {draft.season} {draft.type} · {draft.status}
        </p>
      )}
      <p className="mt-2 text-sm text-muted">
        Highlighted picks use Sleeper roster attribution. A draft slot is not a roster id.
      </p>
      <div className="mt-4 overflow-x-auto">
        <div
          className="grid min-w-[640px] gap-2"
          style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(140px, 1fr))` }}
        >
          {draft.slots.map((slot) => (
            <div key={`head-${slot}`} className="px-2 text-xs uppercase tracking-wide text-muted">
              Slot {slot}
            </div>
          ))}
          {draft.rounds.flatMap((round) =>
            draft.slots.map((slot) => {
              const pick = draft.picks.find((item) => item.round === round && item.draftSlot === slot);
              return (
                <article
                  key={`${round}-${slot}`}
                  className={`rounded-md border p-2 text-sm ${pick?.selectedTeam ? "border-teal bg-teal/10" : "border-line"}`}
                >
                  {pick ? (
                    <>
                      <p className="font-mono text-xs text-muted">
                        {pick.pickNo ?? "?"} · R{pick.round} · roster {pick.rosterId ?? "—"}
                      </p>
                      <p className="mt-1">{pick.name}</p>
                      <p className="text-xs text-muted">{[pick.position, pick.nflTeam].filter(Boolean).join(" · ")}</p>
                      {pick.irregularities.length > 0 ? (
                        <p className="mt-1 text-xs text-amber">{pick.irregularities.join(", ")}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">{pick.attributionSource}</p>
                    </>
                  ) : (
                    <p className="text-muted">No pick</p>
                  )}
                </article>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionTab({
  transactions,
  onlyRoster,
  onToggle,
}: {
  transactions: TeamView["transactions"];
  onlyRoster: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyRoster} onChange={(event) => onToggle(event.target.checked)} />
        This roster only
      </label>
      {transactions.length === 0 ? <Empty>No transactions were imported for this filter.</Empty> : null}
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
        {transactions.map((transaction) => (
          <li key={transaction.externalId} className="px-3 py-3 text-sm">
            <p className="font-mono text-xs text-muted">
              Week {transaction.week ?? "—"} · {transaction.type} · {transaction.status}
              {transaction.executed ? "" : " · not an executed decision"}
            </p>
            <p className="mt-1">{transaction.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-sm text-muted">{children}</p>;
}
