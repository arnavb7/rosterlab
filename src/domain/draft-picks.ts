export type RawDraftPick = {
  player_id?: string | null;
  picked_by?: string | null;
  roster_id?: string | number | null;
  round?: number | null;
  draft_slot?: number | null;
  pick_no?: number | null;
  metadata?: Record<string, unknown> | null;
  is_keeper?: boolean | null;
};

export type NormalizedDraftPick = {
  ordinal: number;
  pickNo: number | null;
  round: number | null;
  draftSlot: number | null;
  rosterId: number | null;
  attributionSource: "pick.roster_id" | "slot_to_roster_id" | "unresolved";
  playerExternalId: string | null;
  pickedByExternalUserId: string | null;
  isKeeper: boolean | null;
  playerName: string | null;
  position: string | null;
  nflTeam: string | null;
  irregularities: string[];
};

function parseRosterId(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function text(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function normalizeDraftPicks(
  picks: readonly RawDraftPick[],
  slotToRosterId: Record<string, number> | null,
): NormalizedDraftPick[] {
  const ordered = picks.map((pick, index) => ({ pick, index }));
  ordered.sort((left, right) => {
    const leftPick = left.pick.pick_no ?? Number.MAX_SAFE_INTEGER;
    const rightPick = right.pick.pick_no ?? Number.MAX_SAFE_INTEGER;
    if (leftPick !== rightPick) return leftPick - rightPick;
    return left.index - right.index;
  });

  const pickNumbers = new Map<number, number>();
  for (const { pick } of ordered) {
    if (typeof pick.pick_no === "number") {
      pickNumbers.set(pick.pick_no, (pickNumbers.get(pick.pick_no) ?? 0) + 1);
    }
  }

  return ordered.map(({ pick }, ordinal) => {
    const irregularities: string[] = [];
    const reportedRosterId = parseRosterId(pick.roster_id);
    const draftSlot = typeof pick.draft_slot === "number" && Number.isInteger(pick.draft_slot) ? pick.draft_slot : null;
    let rosterId: number | null = null;
    let attributionSource: NormalizedDraftPick["attributionSource"] = "unresolved";

    if (reportedRosterId !== null) {
      rosterId = reportedRosterId;
      attributionSource = "pick.roster_id";
    } else if (draftSlot !== null && slotToRosterId && slotToRosterId[String(draftSlot)] !== undefined) {
      rosterId = slotToRosterId[String(draftSlot)] ?? null;
      attributionSource = "slot_to_roster_id";
    } else {
      irregularities.push("unresolved_roster");
    }

    if (pick.roster_id !== undefined && pick.roster_id !== null && pick.roster_id !== "" && reportedRosterId === null) {
      irregularities.push("invalid_roster_id");
    }
    if (typeof pick.pick_no !== "number") irregularities.push("missing_pick_no");
    if (typeof pick.pick_no === "number" && (pickNumbers.get(pick.pick_no) ?? 0) > 1) {
      irregularities.push("duplicate_pick_no");
    }
    const playerExternalId = typeof pick.player_id === "string" && pick.player_id !== "" ? pick.player_id : null;
    if (!playerExternalId) irregularities.push("missing_player_id");

    const first = text(pick.metadata, "first_name");
    const last = text(pick.metadata, "last_name");
    const playerName = [first, last].filter(Boolean).join(" ") || null;
    const pickedBy = typeof pick.picked_by === "string" && pick.picked_by !== "" ? pick.picked_by : null;

    return {
      ordinal,
      pickNo: typeof pick.pick_no === "number" ? pick.pick_no : null,
      round: typeof pick.round === "number" ? pick.round : null,
      draftSlot,
      rosterId,
      attributionSource,
      playerExternalId,
      pickedByExternalUserId: pickedBy,
      isKeeper: typeof pick.is_keeper === "boolean" ? pick.is_keeper : null,
      playerName,
      position: text(pick.metadata, "position"),
      nflTeam: text(pick.metadata, "team"),
      irregularities,
    };
  });
}
