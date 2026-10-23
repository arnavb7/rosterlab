export type RawTransactionAssetPick = {
  season?: string | number | null;
  round?: number | null;
  roster_id?: number | null;
  previous_owner_id?: number | null;
  owner_id?: number | null;
};

export type RawTransaction = {
  transaction_id?: string | null;
  type?: string | null;
  status?: string | null;
  roster_ids?: number[] | null;
  consenter_ids?: number[] | null;
  creator?: string | null;
  created?: number | null;
  status_updated?: number | null;
  leg?: number | null;
  settings?: Record<string, unknown> | null;
  metadata?: unknown;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  draft_picks?: RawTransactionAssetPick[] | null;
  waiver_budget?: { sender?: number | null; receiver?: number | null; amount?: number | null }[] | null;
};

export type NormalizedTransactionAsset = {
  kind: "player_add" | "player_drop" | "draft_pick" | "faab";
  sequence: number;
  playerExternalId: string | null;
  rosterId: number | null;
  fromRosterId: number | null;
  toRosterId: number | null;
  pickSeason: string | null;
  pickRound: number | null;
  pickOriginalRosterId: number | null;
  pickPreviousRosterId: number | null;
  pickOwnerRosterId: number | null;
  faabAmount: number | null;
};

export type NormalizedTransaction = {
  externalTransactionId: string;
  type: string;
  status: string;
  executed: boolean;
  week: number | null;
  importedWeek: number;
  rosterIds: number[];
  consenterIds: number[];
  creatorExternalUserId: string | null;
  createdAtSource: Date | null;
  statusUpdatedAtSource: Date | null;
  settings: Record<string, unknown> | null;
  metadata: unknown;
  assets: NormalizedTransactionAsset[];
};

function epochMillis(value: number | null | undefined): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
}

function integerList(value: number[] | null | undefined): number[] {
  if (!value) return [];
  return value.filter((item) => typeof item === "number" && Number.isInteger(item));
}

export function normalizeTransaction(
  transaction: RawTransaction,
  importedWeek: number,
): NormalizedTransaction | null {
  if (!transaction.transaction_id) return null;
  const assets: NormalizedTransactionAsset[] = [];
  let sequence = 0;
  for (const [playerId, rosterId] of Object.entries(transaction.adds ?? {})) {
    assets.push({
      kind: "player_add",
      sequence: sequence++,
      playerExternalId: playerId,
      rosterId,
      fromRosterId: null,
      toRosterId: rosterId,
      pickSeason: null,
      pickRound: null,
      pickOriginalRosterId: null,
      pickPreviousRosterId: null,
      pickOwnerRosterId: null,
      faabAmount: null,
    });
  }
  for (const [playerId, rosterId] of Object.entries(transaction.drops ?? {})) {
    assets.push({
      kind: "player_drop",
      sequence: sequence++,
      playerExternalId: playerId,
      rosterId,
      fromRosterId: rosterId,
      toRosterId: null,
      pickSeason: null,
      pickRound: null,
      pickOriginalRosterId: null,
      pickPreviousRosterId: null,
      pickOwnerRosterId: null,
      faabAmount: null,
    });
  }
  for (const pick of transaction.draft_picks ?? []) {
    assets.push({
      kind: "draft_pick",
      sequence: sequence++,
      playerExternalId: null,
      rosterId: null,
      fromRosterId: pick.previous_owner_id ?? null,
      toRosterId: pick.owner_id ?? null,
      pickSeason: pick.season === undefined || pick.season === null ? null : String(pick.season),
      pickRound: pick.round ?? null,
      pickOriginalRosterId: pick.roster_id ?? null,
      pickPreviousRosterId: pick.previous_owner_id ?? null,
      pickOwnerRosterId: pick.owner_id ?? null,
      faabAmount: null,
    });
  }
  for (const budget of transaction.waiver_budget ?? []) {
    assets.push({
      kind: "faab",
      sequence: sequence++,
      playerExternalId: null,
      rosterId: null,
      fromRosterId: budget.sender ?? null,
      toRosterId: budget.receiver ?? null,
      pickSeason: null,
      pickRound: null,
      pickOriginalRosterId: null,
      pickPreviousRosterId: null,
      pickOwnerRosterId: null,
      faabAmount: budget.amount ?? null,
    });
  }

  const status = transaction.status ?? "unknown";
  return {
    externalTransactionId: transaction.transaction_id,
    type: transaction.type ?? "unknown",
    status,
    executed: status === "complete",
    week: transaction.leg ?? null,
    importedWeek,
    rosterIds: integerList(transaction.roster_ids),
    consenterIds: integerList(transaction.consenter_ids),
    creatorExternalUserId: transaction.creator || null,
    createdAtSource: epochMillis(transaction.created),
    statusUpdatedAtSource: epochMillis(transaction.status_updated),
    settings: transaction.settings ?? null,
    metadata: transaction.metadata ?? null,
    assets,
  };
}
