-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "SleeperUser" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatar" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleeperUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueSeason" (
    "id" TEXT NOT NULL,
    "externalLeagueId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "seasonType" TEXT,
    "previousLeagueId" TEXT,
    "primaryDraftId" TEXT,
    "avatar" TEXT,
    "totalRosters" INTEGER,
    "rosterPositions" JSONB NOT NULL,
    "scoringSettings" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "leagueMetadata" JSONB,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'sleeper',
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "dataCompleteness" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMembership" (
    "id" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "sleeperUserId" TEXT,
    "externalUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "teamName" TEXT,
    "avatar" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterSnapshot" (
    "id" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "externalRosterId" INTEGER NOT NULL,
    "ownerExternalUserId" TEXT,
    "coOwnerExternalUserIds" TEXT[],
    "players" TEXT[],
    "starters" TEXT[],
    "reserve" TEXT[],
    "taxi" TEXT[],
    "keepers" JSONB,
    "settings" JSONB NOT NULL,
    "snapshotKind" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "incomplete" BOOLEAN NOT NULL DEFAULT true,
    "incompleteReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchupTeamWeek" (
    "id" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "externalRosterId" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "seasonType" TEXT NOT NULL,
    "matchupId" INTEGER,
    "points" DOUBLE PRECISION,
    "customPoints" DOUBLE PRECISION,
    "players" TEXT[],
    "starters" TEXT[],
    "startersPoints" JSONB,
    "playersPoints" JSONB,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchupTeamWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueTransaction" (
    "id" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "externalTransactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL,
    "week" INTEGER,
    "importedWeek" INTEGER NOT NULL,
    "rosterIds" INTEGER[],
    "consenterIds" INTEGER[],
    "creatorExternalUserId" TEXT,
    "createdAtSource" TIMESTAMP(3),
    "statusUpdatedAtSource" TIMESTAMP(3),
    "settings" JSONB,
    "metadata" JSONB,
    "source" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAsset" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "playerExternalId" TEXT,
    "rosterId" INTEGER,
    "fromRosterId" INTEGER,
    "toRosterId" INTEGER,
    "pickSeason" TEXT,
    "pickRound" INTEGER,
    "pickOriginalRosterId" INTEGER,
    "pickPreviousRosterId" INTEGER,
    "pickOwnerRosterId" INTEGER,
    "faabAmount" INTEGER,

    CONSTRAINT "TransactionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "externalDraftId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "draftOrder" JSONB,
    "slotToRosterId" JSONB,
    "startTime" TIMESTAMP(3),
    "source" TEXT NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "pickNo" INTEGER,
    "round" INTEGER,
    "draftSlot" INTEGER,
    "rosterId" INTEGER,
    "attributionSource" TEXT NOT NULL,
    "playerExternalId" TEXT,
    "pickedByExternalUserId" TEXT,
    "isKeeper" BOOLEAN,
    "playerName" TEXT,
    "position" TEXT,
    "nflTeam" TEXT,
    "irregularities" TEXT[],

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradedPick" (
    "id" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "originalRosterId" INTEGER NOT NULL,
    "previousOwnerRosterId" INTEGER,
    "ownerRosterId" INTEGER NOT NULL,

    CONSTRAINT "TradedPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sleeperId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "position" TEXT,
    "fantasyPositions" TEXT[],
    "team" TEXT,
    "status" TEXT,
    "injuryStatus" TEXT,
    "searchRank" INTEGER,
    "directoryFetchedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'sleeper',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerIdentityMapping" (
    "id" TEXT NOT NULL,
    "sleeperId" TEXT,
    "source" TEXT NOT NULL,
    "sourcePlayerId" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerIdentityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCapability" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "availableMetrics" JSONB NOT NULL,
    "supportedSeasons" JSONB NOT NULL,
    "latestDataTimestamp" TIMESTAMP(3),
    "updateFrequency" TEXT NOT NULL,
    "licenseNotes" TEXT NOT NULL,
    "operationalStatus" TEXT NOT NULL,
    "limitations" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalLeagueId" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "correction" BOOLEAN NOT NULL DEFAULT false,
    "stage" TEXT NOT NULL,
    "completedUnits" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER,
    "cacheHits" INTEGER NOT NULL DEFAULT 0,
    "cursor" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "retryAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawPayload" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawPayload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SleeperUser_externalId_key" ON "SleeperUser"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSeason_externalLeagueId_key" ON "LeagueSeason"("externalLeagueId");

-- CreateIndex
CREATE INDEX "LeagueSeason_season_idx" ON "LeagueSeason"("season");

-- CreateIndex
CREATE INDEX "LeagueSeason_previousLeagueId_idx" ON "LeagueSeason"("previousLeagueId");

-- CreateIndex
CREATE INDEX "LeagueMembership_externalUserId_idx" ON "LeagueMembership"("externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_leagueSeasonId_externalUserId_key" ON "LeagueMembership"("leagueSeasonId", "externalUserId");

-- CreateIndex
CREATE INDEX "RosterSnapshot_leagueSeasonId_idx" ON "RosterSnapshot"("leagueSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSnapshot_leagueSeasonId_externalRosterId_snapshotKind_key" ON "RosterSnapshot"("leagueSeasonId", "externalRosterId", "snapshotKind");

-- CreateIndex
CREATE INDEX "MatchupTeamWeek_leagueSeasonId_week_idx" ON "MatchupTeamWeek"("leagueSeasonId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "MatchupTeamWeek_leagueSeasonId_week_externalRosterId_key" ON "MatchupTeamWeek"("leagueSeasonId", "week", "externalRosterId");

-- CreateIndex
CREATE INDEX "LeagueTransaction_leagueSeasonId_importedWeek_idx" ON "LeagueTransaction"("leagueSeasonId", "importedWeek");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueTransaction_leagueSeasonId_externalTransactionId_key" ON "LeagueTransaction"("leagueSeasonId", "externalTransactionId");

-- CreateIndex
CREATE INDEX "TransactionAsset_transactionId_idx" ON "TransactionAsset"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionAsset_playerExternalId_idx" ON "TransactionAsset"("playerExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_externalDraftId_key" ON "Draft"("externalDraftId");

-- CreateIndex
CREATE INDEX "Draft_leagueSeasonId_idx" ON "Draft"("leagueSeasonId");

-- CreateIndex
CREATE INDEX "DraftPick_draftId_rosterId_idx" ON "DraftPick"("draftId", "rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftId_ordinal_key" ON "DraftPick"("draftId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "TradedPick_leagueSeasonId_season_round_originalRosterId_key" ON "TradedPick"("leagueSeasonId", "season", "round", "originalRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sleeperId_key" ON "Player"("sleeperId");

-- CreateIndex
CREATE INDEX "Player_position_idx" ON "Player"("position");

-- CreateIndex
CREATE INDEX "PlayerIdentityMapping_sleeperId_idx" ON "PlayerIdentityMapping"("sleeperId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerIdentityMapping_source_sourcePlayerId_key" ON "PlayerIdentityMapping"("source", "sourcePlayerId");

-- CreateIndex
CREATE INDEX "ImportJob_status_createdAt_idx" ON "ImportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_externalLeagueId_status_idx" ON "ImportJob"("externalLeagueId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RawPayload_provider_resource_externalKey_key" ON "RawPayload"("provider", "resource", "externalKey");

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_sleeperUserId_fkey" FOREIGN KEY ("sleeperUserId") REFERENCES "SleeperUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSnapshot" ADD CONSTRAINT "RosterSnapshot_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupTeamWeek" ADD CONSTRAINT "MatchupTeamWeek_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTransaction" ADD CONSTRAINT "LeagueTransaction_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAsset" ADD CONSTRAINT "TransactionAsset_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LeagueTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradedPick" ADD CONSTRAINT "TradedPick_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

