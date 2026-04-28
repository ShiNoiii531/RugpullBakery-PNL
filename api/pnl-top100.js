import { readFile, readdir } from "node:fs/promises";

const BAKERY_APP_URL = "https://www.rugpullbakery.com";
const BAKERY_SOURCE_URL = `${BAKERY_APP_URL}/bakeries`;
const BAKERY_DOCS_S3_PAYOUT_URL = "https://docs.rugpullbakery.com/#s3-payouts";
const BAKERY_DOCS_S4_PAYOUT_URL = "https://docs.rugpullbakery.com/#s4-payouts";
const ABSTRACT_RPC_URL = process.env.ABSTRACT_RPC_URL || "https://api.mainnet.abs.xyz";
const ABSTRACT_PROFILE_API_URL = "https://backend.portal.abs.xyz/api/user/address";
const ABSTRACT_ASSET_URL = "https://abstract-assets.abs.xyz";

const BAKERY_CONTRACT_ADDRESS = "0xFEB79a841D69C08aFCDC7B2BEEC8a6fbbe46C455";
const BAKERY_BAKE_SELECTOR = "0xb0de262e";
const BAKERY_BAKE_EVENT_TOPIC = "0xdfb2307530b804c690e75bb4df897c4d1ebb5e3e1187ce9e25eb7ed674c66db6";
const COST_CACHE_URL = new URL("../data/cost-cache.json", import.meta.url);
const RANK_CACHE_URL = new URL("../data/rank-cache.json", import.meta.url);
const RUG_CACHE_URL = new URL("../data/rug-cache.json", import.meta.url);
const SEASON_HISTORY_DIR_URL = new URL("../data/season-history/", import.meta.url);
const PUBLIC_SEASON_ID_OFFSET = 2;

const DEFAULT_BOARD_KEY = "standard";
const COST_SAMPLE_BLOCKS = positiveNumber(process.env.BAKERY_COST_SAMPLE_BLOCKS, 180);
const COST_SAMPLE_MAX_TXS = positiveNumber(process.env.BAKERY_COST_SAMPLE_MAX_TXS, 150);
const GLOBAL_ACTIVITY_FEED_LIMIT = 100;
const BAKERY_ACTIVITY_FEED_LIMIT = 100;
const BAKERY_ACTIVITY_BATCH_SIZE = Math.max(
  1,
  Math.floor(positiveNumber(process.env.BAKERY_ACTIVITY_BATCH_SIZE, 12))
);
const ABSTRACT_PROFILE_BATCH_SIZE = Math.max(
  1,
  Math.floor(positiveNumber(process.env.ABSTRACT_PROFILE_BATCH_SIZE, 16))
);
const MOST_RUGGED_ENABLED = true;

const S3_LEADERBOARD_PAYOUTS = [
  { minRank: 1, maxRank: 1, sharePct: 7.5 },
  { minRank: 2, maxRank: 2, sharePct: 5.5 },
  { minRank: 3, maxRank: 3, sharePct: 4.5 },
  { minRank: 4, maxRank: 4, sharePct: 3.5 },
  { minRank: 5, maxRank: 5, sharePct: 3 },
  { minRank: 6, maxRank: 6, sharePct: 2.7 },
  { minRank: 7, maxRank: 7, sharePct: 2.4 },
  { minRank: 8, maxRank: 8, sharePct: 2.1 },
  { minRank: 9, maxRank: 9, sharePct: 1.9 },
  { minRank: 10, maxRank: 10, sharePct: 1.7 },
  { minRank: 11, maxRank: 25, sharePct: 1.4666666666666666 },
  { minRank: 26, maxRank: 50, sharePct: 0.88 },
  { minRank: 51, maxRank: 100, sharePct: 0.424 }
];

const STANDARD_ACTIVITY_TIERS = [
  { tier: "Tier 1", sharePct: 50 },
  { tier: "Tier 2", sharePct: 30 },
  { tier: "Tier 3", sharePct: 20 }
];

const S4_STANDARD_LEADERBOARD_PAYOUTS = [
  { minRank: 1, maxRank: 1, sharePct: 10 },
  { minRank: 2, maxRank: 2, sharePct: 8 },
  { minRank: 3, maxRank: 3, sharePct: 6 },
  { minRank: 4, maxRank: 10, sharePct: 3.2 },
  { minRank: 11, maxRank: 25, sharePct: 1.6 },
  { minRank: 26, maxRank: 50, sharePct: 0.6 },
  { minRank: 51, maxRank: 100, sharePct: 0.28 }
];

const S4_OPEN_LEADERBOARD_PAYOUTS = [
  { minRank: 1, maxRank: 1, sharePct: 12 },
  { minRank: 2, maxRank: 2, sharePct: 9 },
  { minRank: 3, maxRank: 3, sharePct: 7 },
  { minRank: 4, maxRank: 4, sharePct: 5.5 },
  { minRank: 5, maxRank: 5, sharePct: 4.5 },
  { minRank: 6, maxRank: 6, sharePct: 4 },
  { minRank: 7, maxRank: 7, sharePct: 3.5 },
  { minRank: 8, maxRank: 8, sharePct: 3 },
  { minRank: 9, maxRank: 9, sharePct: 2.7 },
  { minRank: 10, maxRank: 10, sharePct: 2.4 },
  { minRank: 11, maxRank: 25, sharePct: 2.24 },
  { minRank: 26, maxRank: 50, sharePct: 0.625 }
];

let memoryCache = null;

function requestUrl(request) {
  const raw = typeof request?.url === "string" ? request.url : "/";
  return new URL(raw, "http://localhost");
}

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeBoardKey(value) {
  return value === "open" ? "open" : DEFAULT_BOARD_KEY;
}

function publicSeasonId(seasonId) {
  const numeric = Number(seasonId);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(1, numeric - PUBLIC_SEASON_ID_OFFSET);
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function weiToEthNumber(wei) {
  if (wei === undefined || wei === null) {
    return 0;
  }

  return Number(BigInt(String(wei))) / 1e18;
}

function multiplyWeiByPercent(wei, percent) {
  const scaledPercent = BigInt(Math.round(percent * 1_000_000));
  return safeDivideBigInt(BigInt(wei) * scaledPercent, 100_000_000n).toString();
}

function safeDivideBigInt(numerator, denominator) {
  return denominator === 0n ? 0n : numerator / denominator;
}

function getLeaderboardSharePct(rank, payouts) {
  return payouts.find((payout) => rank >= payout.minRank && rank <= payout.maxRank)?.sharePct || 0;
}

function buildLeaderboardOptions(seasonId) {
  if (Number(seasonId) === 6) {
    return [
      { key: "standard", label: "Standard Top 110" },
      { key: "open", label: "Open Top 110" }
    ];
  }

  return [
    { key: "overall", label: "Final Top 100" }
  ];
}

function seasonRuleConfig(seasonId, boardKey = DEFAULT_BOARD_KEY) {
  const normalizedBoardKey = normalizeBoardKey(boardKey);

  if (Number(seasonId) === 6) {
    const shared = {
      boardKey: normalizedBoardKey,
      availableLeaderboards: buildLeaderboardOptions(seasonId),
      rowLimit: 110,
      topChefLimit: 500,
      activityTiers: STANDARD_ACTIVITY_TIERS,
      payoutSummaryText: "Standard leaderboard 25% / Standard activity 35% / Open leaderboard 40%",
      payoutDocsUrl: BAKERY_DOCS_S4_PAYOUT_URL,
      globalLeaderboardLabel: "Top 110",
      dynamicLeaderboardLabel: normalizedBoardKey === "open" ? "Open Top 110" : "Standard Top 110",
      countLabel: "Top 110",
      rowLabel: "bakeries",
      referenceLabel: normalizedBoardKey === "open" ? "Open leaderboard" : "Standard leaderboard",
      leaderboardKind: "live_tiered"
    };

    if (normalizedBoardKey === "open") {
      return {
        ...shared,
        boardName: "Open",
        tierId: 2,
        leaderboardBucketPct: 40,
        activityBucketPct: 0,
        leaderboardPayouts: S4_OPEN_LEADERBOARD_PAYOUTS,
        bucketProjectionLabel: "Open leaderboard bucket projection",
        grossLabel: "Open Gross",
        costLabel: "Open Cost",
        pnlLabel: "Open P&L"
      };
    }

    return {
      ...shared,
      boardName: "Standard",
      tierId: 1,
      leaderboardBucketPct: 25,
      activityBucketPct: 35,
      leaderboardPayouts: S4_STANDARD_LEADERBOARD_PAYOUTS,
      bucketProjectionLabel: "Standard leaderboard bucket projection",
      grossLabel: "Standard Gross",
      costLabel: "Standard Cost",
      pnlLabel: "Standard P&L"
    };
  }

  return {
    boardKey: "overall",
    boardName: "Leaderboard",
    tierId: null,
    rowLimit: 100,
    topChefLimit: 220,
    leaderboardBucketPct: 70,
    activityBucketPct: 30,
    leaderboardPayouts: S3_LEADERBOARD_PAYOUTS,
    activityTiers: STANDARD_ACTIVITY_TIERS,
    payoutSummaryText: "Leaderboard 70% / Activity 30%",
    payoutDocsUrl: BAKERY_DOCS_S3_PAYOUT_URL,
    bucketProjectionLabel: "Leaderboard bucket projection",
    grossLabel: "Top 100 Gross",
    costLabel: "Top 100 Cost",
    pnlLabel: "Top 100 P&L",
    globalLeaderboardLabel: "Top 100",
    dynamicLeaderboardLabel: "Top 100",
    countLabel: "Top 100",
    rowLabel: "bakeries",
    referenceLabel: "Leaderboard",
    leaderboardKind: "live_default",
    availableLeaderboards: [{ key: "overall", label: "Top 100" }]
  };
}

function bigintToHex(value) {
  return `0x${value.toString(16)}`;
}

function hexToBigInt(value) {
  if (!value || value === "0x") {
    return 0n;
  }

  return BigInt(value);
}

function topicForAddress(address) {
  return `0x000000000000000000000000${address.toLowerCase().replace(/^0x/, "")}`;
}

function topicForUint256(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

function decodeLogUint256(data, index) {
  const start = 2 + index * 64;
  const word = data.slice(start, start + 64);
  return word.length === 64 ? BigInt(`0x${word}`) : 0n;
}

async function fetchBakeryTrpc(procedure, input) {
  const endpoint = new URL(`${BAKERY_APP_URL}/api/trpc/${procedure}`);
  endpoint.searchParams.set("batch", "1");
  endpoint.searchParams.set("input", JSON.stringify({ "0": { json: input } }));

  const response = await fetch(endpoint, {
    headers: {
      "x-trpc-source": "nextjs-react"
    }
  });

  if (!response.ok) {
    throw new Error(`Bakery ${procedure} failed with ${response.status}`);
  }

  const payload = await response.json();
  const first = payload[0];
  if (first?.error) {
    throw new Error(first.error.message || `Bakery ${procedure} returned an error`);
  }

  if (!first?.result?.data || !("json" in first.result.data)) {
    throw new Error(`Bakery ${procedure} returned an unexpected payload`);
  }

  return first.result.data.json;
}

async function fetchBakeryTrpcBatch(procedure, inputs) {
  if (inputs.length === 0) {
    return [];
  }

  const endpoint = new URL(`${BAKERY_APP_URL}/api/trpc/${inputs.map(() => procedure).join(",")}`);
  const batchedInput = {};
  inputs.forEach((input, index) => {
    batchedInput[index] = { json: input };
  });
  endpoint.searchParams.set("batch", "1");
  endpoint.searchParams.set("input", JSON.stringify(batchedInput));

  const response = await fetch(endpoint, {
    headers: {
      "x-trpc-source": "nextjs-react"
    }
  });

  if (!response.ok) {
    throw new Error(`Bakery ${procedure} batch failed with ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`Bakery ${procedure} batch returned an unexpected payload`);
  }

  return payload.map((entry) => {
    if (entry?.error) {
      throw new Error(entry.error.message || `Bakery ${procedure} batch entry returned an error`);
    }

    if (!entry?.result?.data || !("json" in entry.result.data)) {
      throw new Error(`Bakery ${procedure} batch entry returned an unexpected payload`);
    }

    return entry.result.data.json;
  });
}

async function fetchPaginatedBakeryLeaderboard({ procedure, baseInput = {}, totalLimit, cursorKey }) {
  const items = [];
  let nextCursor = null;

  while (items.length < totalLimit) {
    const pageLimit = Math.min(100, totalLimit - items.length);
    const input = {
      ...baseInput,
      limit: pageLimit
    };

    if (nextCursor) {
      input.cursor = nextCursor;
    }

    const page = await fetchBakeryTrpc(procedure, input);
    const pageItems = Array.isArray(page?.items) ? page.items : [];
    items.push(...pageItems);

    if (!page?.nextCursor || pageItems.length === 0) {
      break;
    }

    nextCursor = page.nextCursor;
    if (cursorKey && !(cursorKey in nextCursor)) {
      break;
    }
  }

  return {
    items: items.slice(0, totalLimit),
    nextCursor
  };
}

function abstractProfileImageUrl(user) {
  if (typeof user?.overrideProfilePictureUrl === "string" && user.overrideProfilePictureUrl) {
    return user.overrideProfilePictureUrl;
  }

  const avatar = user?.avatar;
  if (avatar && avatar.season && avatar.tier && avatar.key) {
    return `${ABSTRACT_ASSET_URL}/avatars/${avatar.season}-${avatar.tier}-${avatar.key}.png`;
  }

  return null;
}

async function fetchAbstractProfile(address) {
  const response = await fetch(`${ABSTRACT_PROFILE_API_URL}/${address}`, {
    headers: {
      "accept": "application/json",
      "user-agent": "Bakery Public PnL"
    },
    signal: AbortSignal.timeout(2500)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Abstract profile failed with ${response.status}`);
  }

  const payload = await response.json();
  return payload?.user || null;
}

async function getAbstractProfilesByAddress(addresses) {
  const normalizedAddresses = [...new Set(addresses
    .filter((address) => /^0x[a-fA-F0-9]{40}$/.test(address))
    .map((address) => address.toLowerCase()))];
  const profilesByAddress = new Map();
  const profileBatchPromises = [];

  for (let index = 0; index < normalizedAddresses.length; index += ABSTRACT_PROFILE_BATCH_SIZE) {
    const batch = normalizedAddresses.slice(index, index + ABSTRACT_PROFILE_BATCH_SIZE);
    profileBatchPromises.push(Promise.all(batch.map(async (address) => {
      try {
        return [address, await fetchAbstractProfile(address)];
      } catch {
        return [address, null];
      }
    })));
  }

  const results = (await Promise.all(profileBatchPromises)).flat();
  for (const [address, profile] of results) {
    if (profile) {
      profilesByAddress.set(address, profile);
    }
  }

  return profilesByAddress;
}

async function loadCostCache() {
  try {
    const payload = JSON.parse(await readFile(COST_CACHE_URL, "utf8"));
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function loadRankCache() {
  try {
    const payload = JSON.parse(await readFile(RANK_CACHE_URL, "utf8"));
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function loadRugCache() {
  try {
    const payload = JSON.parse(await readFile(RUG_CACHE_URL, "utf8"));
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function loadSeasonHistoryEntries() {
  try {
    const files = await readdir(SEASON_HISTORY_DIR_URL);
    const entries = [];

    for (const file of files) {
      if (!/^season-\d+\.json$/i.test(file)) {
        continue;
      }

      try {
        const payload = JSON.parse(await readFile(new URL(file, SEASON_HISTORY_DIR_URL), "utf8"));
        if (!payload || typeof payload !== "object") {
          continue;
        }
        entries.push(payload);
      } catch {
        // Ignore invalid snapshots.
      }
    }

    return entries.sort((a, b) => Number(b.seasonId || 0) - Number(a.seasonId || 0));
  } catch {
    return [];
  }
}

function buildSeasonOptions(historyEntries, activeSeason = null) {
  const options = historyEntries.map((entry) => ({
    id: Number(entry.seasonId),
    displayId: Number(entry.seasonDisplayId || publicSeasonId(entry.seasonId)),
    label: `Season ${entry.seasonDisplayId || publicSeasonId(entry.seasonId)} Final`,
    isHistorical: true,
    isFinalized: true,
    isActive: false
  }));

  if (
    activeSeason &&
    !options.some((option) => Number(option.id) === Number(activeSeason.id))
  ) {
    options.unshift({
      id: Number(activeSeason.id),
      displayId: Number(publicSeasonId(activeSeason.id)),
      label: `Season ${publicSeasonId(activeSeason.id)} Live`,
      isHistorical: false,
      isFinalized: activeSeason.finalized === true,
      isActive: activeSeason.isActive !== false
    });
  }

  return options.sort((a, b) => Number(b.id) - Number(a.id));
}

function rankMovementFromCache(rankCache, seasonId, chefAddress, currentRank) {
  const normalizedAddress = chefAddress?.toLowerCase();
  const previousRank = Number(rankCache?.previousRanks?.[normalizedAddress] || 0);
  if (
    !normalizedAddress ||
    Number(rankCache?.seasonId) !== Number(seasonId) ||
    !Number.isFinite(previousRank) ||
    previousRank <= 0
  ) {
    return {
      direction: "same",
      previousRank: null,
      delta: 0
    };
  }

  const delta = previousRank - Number(currentRank || 0);
  return {
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    previousRank,
    delta
  };
}

function costFromCache(costCache, seasonId, chefAddress) {
  const normalizedAddress = chefAddress?.toLowerCase();
  const entry = costCache?.chefs?.[normalizedAddress];
  if (
    !entry ||
    Number(costCache.seasonId) !== Number(seasonId) ||
    typeof entry.gasCostWei !== "string"
  ) {
    return null;
  }

  const latestKnownBlock = Number(costCache.latestKnownBlock || 0);
  const toBlock = Number(entry.toBlock ?? latestKnownBlock ?? 0);
  const effectivelyComplete = entry.complete === true && latestKnownBlock > 0 && toBlock >= latestKnownBlock;

  return {
    costWei: entry.gasCostWei,
    costEth: weiToEthNumber(entry.gasCostWei),
    complete: effectivelyComplete,
    cookTxCount: Number(entry.cookTxCount || 0),
    cookiesRaw: entry.cookiesRaw || "0",
    updatedAt: costCache.updatedAt || entry.updatedAt || null,
    toBlock: entry.toBlock ?? costCache.latestKnownBlock ?? null
  };
}

function seasonUsesScoreRanking(seasonId) {
  return Number(seasonId) >= 6;
}

function rawScoreValue(row) {
  if (row && row.score !== undefined && row.score !== null) {
    try {
      return BigInt(row.score);
    } catch {}
  }

  return 0n;
}

function sortRowsForDisplay(rows, seasonId) {
  if (!seasonUsesScoreRanking(seasonId)) {
    return rows.map((row, index) => ({
      ...row,
      displayRank: Number(row.rank ?? index + 1) || index + 1
    }));
  }

  return [...rows]
    .sort((a, b) => {
      const scoreDelta = rawScoreValue(b) - rawScoreValue(a);
      if (scoreDelta !== 0n) {
        return scoreDelta > 0n ? 1 : -1;
      }

      const fallbackRankDelta = Number(a.rank ?? 0) - Number(b.rank ?? 0);
      if (fallbackRankDelta !== 0) {
        return fallbackRankDelta;
      }

      return Number(a.id ?? 0) - Number(b.id ?? 0);
    })
    .map((row, index) => ({
      ...row,
      displayRank: index + 1
    }));
}

function estimatedCostPerMillionFromCachedCost(cachedCost) {
  const cookiesRaw = BigInt(cachedCost?.cookiesRaw || "0");
  const costWei = BigInt(cachedCost?.costWei || "0");
  if (cookiesRaw <= 0n || costWei <= 0n) {
    return 0n;
  }

  return safeDivideBigInt(costWei * 1_000_000n, cookiesRaw);
}

async function rpcCall(method, params = []) {
  const response = await fetch(ABSTRACT_RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`Abstract RPC ${method} failed with ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || `Abstract RPC ${method} returned an error`);
  }

  return payload.result;
}

async function rpcBatch(calls) {
  if (calls.length === 0) {
    return [];
  }

  const response = await fetch(ABSTRACT_RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(calls.map((call, index) => ({
      jsonrpc: "2.0",
      id: index + 1,
      method: call.method,
      params: call.params
    })))
  });

  if (!response.ok) {
    throw new Error(`Abstract RPC batch failed with ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    const fallbackResults = [];
    for (let index = 0; index < calls.length; index += 20) {
      const batch = calls.slice(index, index + 20);
      fallbackResults.push(...await Promise.all(batch.map((call) => rpcCall(call.method, call.params))));
    }
    return fallbackResults;
  }

  return payload
    .sort((a, b) => a.id - b.id)
    .map((entry) => {
      if (entry.error) {
        throw new Error(entry.error.message || "Abstract RPC batch entry returned an error");
      }
      return entry.result;
    });
}

async function getBakeLogs(latestBlock, seasonId, addressTopics) {
  let blockSpan = BigInt(Math.max(25, COST_SAMPLE_BLOCKS));
  let lastError = null;

  while (blockSpan >= 25n) {
    try {
      const fromBlock = latestBlock > blockSpan ? latestBlock - blockSpan : 0n;
      const logs = await rpcCall("eth_getLogs", [{
        address: BAKERY_CONTRACT_ADDRESS,
        fromBlock: bigintToHex(fromBlock),
        toBlock: bigintToHex(latestBlock),
        topics: [
          BAKERY_BAKE_EVENT_TOPIC,
          addressTopics,
          topicForUint256(seasonId)
        ]
      }]);

      return { logs, fromBlock, toBlock: latestBlock };
    } catch (error) {
      lastError = error;
      blockSpan = blockSpan > 1n ? blockSpan / 2n : 0n;
    }
  }

  throw lastError || new Error("Unable to fetch Bakery bake logs");
}

function unavailableCostEstimate(message) {
  return {
    status: "unavailable",
    source: "abstract_rpc_recent_sample",
    updatedAt: new Date().toISOString(),
    fromBlock: null,
    toBlock: null,
    sampleTxCount: 0,
    sampleCookies: "0",
    sampleCostWei: "0",
    estimatedCostPerMillionWei: "0",
    estimatedCostPerMillionEth: 0,
    error: message
  };
}

async function getRpcCostEstimate(seasonId, chefAddresses) {
  const normalizedChefAddresses = [...new Set(chefAddresses
    .filter((address) => /^0x[a-fA-F0-9]{40}$/.test(address))
    .map((address) => address.toLowerCase()))];

  if (normalizedChefAddresses.length === 0) {
    return unavailableCostEstimate("No chef addresses to sample");
  }

  try {
    const latestBlock = hexToBigInt(await rpcCall("eth_blockNumber"));
    const addressTopics = normalizedChefAddresses.map(topicForAddress);
    const { logs, fromBlock, toBlock } = await getBakeLogs(latestBlock, seasonId, addressTopics);
    const latestLogsByHash = new Map();

    for (const log of logs) {
      latestLogsByHash.set(log.transactionHash.toLowerCase(), log);
    }

    const sampledLogs = [...latestLogsByHash.values()].slice(-COST_SAMPLE_MAX_TXS);
    const hashes = sampledLogs.map((log) => log.transactionHash);
    const [transactions, receipts] = await Promise.all([
      rpcBatch(hashes.map((hash) => ({ method: "eth_getTransactionByHash", params: [hash] }))),
      rpcBatch(hashes.map((hash) => ({ method: "eth_getTransactionReceipt", params: [hash] })))
    ]);

    let sampleCookies = 0n;
    let sampleCostWei = 0n;
    let sampleTxCount = 0;

    for (let index = 0; index < sampledLogs.length; index += 1) {
      const log = sampledLogs[index];
      const transaction = transactions[index];
      const receipt = receipts[index];

      if (!transaction || !receipt || receipt.status !== "0x1") {
        continue;
      }

      if (transaction.to?.toLowerCase() !== BAKERY_CONTRACT_ADDRESS.toLowerCase()) {
        continue;
      }

      if (!transaction.input?.toLowerCase().startsWith(BAKERY_BAKE_SELECTOR)) {
        continue;
      }

      const gasUsed = hexToBigInt(receipt.gasUsed);
      const gasPrice = hexToBigInt(receipt.effectiveGasPrice || transaction.gasPrice);
      const rawCookies = decodeLogUint256(log.data, 0);

      if (gasUsed === 0n || gasPrice === 0n || rawCookies === 0n) {
        continue;
      }

      sampleCookies += rawCookies;
      sampleCostWei += gasUsed * gasPrice;
      sampleTxCount += 1;
    }

    if (sampleTxCount === 0 || sampleCookies === 0n) {
      return unavailableCostEstimate("No usable Bakery bake transactions found in the recent RPC sample");
    }

    const estimatedCostPerMillionWei = safeDivideBigInt(sampleCostWei * 1_000_000n, sampleCookies);

    return {
      status: "ok",
      source: "abstract_rpc_recent_sample",
      updatedAt: new Date().toISOString(),
      fromBlock: Number(fromBlock),
      toBlock: Number(toBlock),
      sampleTxCount,
      sampleCookies: sampleCookies.toString(),
      sampleCostWei: sampleCostWei.toString(),
      estimatedCostPerMillionWei: estimatedCostPerMillionWei.toString(),
      estimatedCostPerMillionEth: weiToEthNumber(estimatedCostPerMillionWei)
    };
  } catch (error) {
    return unavailableCostEstimate(error instanceof Error ? error.message : String(error));
  }
}

function emptyIncomingRugStats() {
  return {
    attempts: 0,
    successful: 0,
    failed: 0
  };
}

function countIncomingRugs(activityFeed) {
  const stats = emptyIncomingRugStats();

  for (const event of activityFeed || []) {
    if (event.type !== "rug" || event.isOutgoing !== false) {
      continue;
    }

    stats.attempts += 1;
    if (event.success) {
      stats.successful += 1;
    } else {
      stats.failed += 1;
    }
  }

  return stats;
}

function rugStatsFromCache(rugCache, seasonId, rows) {
  if (!rugCache || Number(rugCache.seasonId) !== Number(seasonId)) {
    return null;
  }

  const rugReceivedStatsByBakeryId = new Map();
  for (const row of rows) {
    const bakeryId = Number(row.id);
    const cached = rugCache.bakeries?.[String(bakeryId)] || null;
    rugReceivedStatsByBakeryId.set(bakeryId, {
      attempts: Number(cached?.attempts || 0),
      successful: Number(cached?.successful || 0),
      failed: Number(cached?.failed || 0)
    });
  }

  return {
    rugReceivedStatsByBakeryId,
    rugReceivedSource: {
      label: "season_rug_cache",
      updatedAt: rugCache.updatedAt || null,
      status: rugCache.status || "unknown",
      scannedEvents: Number(rugCache.scannedEvents || 0),
      importedEvents: Number(rugCache.importedEvents || 0),
      latestSeenTimestamp: rugCache.latestSeenTimestamp || null,
      oldestCursor: rugCache.oldestCursor || null,
      complete: rugCache.complete === true
    }
  };
}

async function getGlobalRugsReceivedByBakeryId() {
  const globalActivityFeed = await fetchBakeryTrpc(
    "leaderboard.getGlobalActivityFeed",
    { limit: GLOBAL_ACTIVITY_FEED_LIMIT }
  );
  const rugReceivedStatsByBakeryId = new Map();

  for (const event of globalActivityFeed || []) {
    if (event.type !== "rug" || !event.eventBakeryId) {
      continue;
    }

    const bakeryId = Number(event.eventBakeryId);
    const stats = rugReceivedStatsByBakeryId.get(bakeryId) || emptyIncomingRugStats();
    stats.attempts += 1;
    if (event.success) {
      stats.successful += 1;
    } else {
      stats.failed += 1;
    }
    rugReceivedStatsByBakeryId.set(bakeryId, stats);
  }

  return {
    rugReceivedStatsByBakeryId,
    rugReceivedSource: {
      label: "recent_global_activity_feed",
      eventLimit: GLOBAL_ACTIVITY_FEED_LIMIT,
      scannedEvents: Array.isArray(globalActivityFeed) ? globalActivityFeed.length : 0,
      updatedAt: new Date().toISOString()
    }
  };
}

async function getBakeryRugsReceived(rows, seasonId) {
  const bakeries = rows
    .map((row) => ({ bakeryId: Number(row.id) }))
    .filter((row) => Number.isFinite(row.bakeryId) && row.bakeryId > 0);

  if (bakeries.length === 0) {
    return getGlobalRugsReceivedByBakeryId();
  }

  try {
    const inputs = bakeries.map((row) => ({
      bakeryId: row.bakeryId,
      seasonId,
      limit: BAKERY_ACTIVITY_FEED_LIMIT
    }));
    const feedBatchPromises = [];

    for (let index = 0; index < inputs.length; index += BAKERY_ACTIVITY_BATCH_SIZE) {
      const batchInputs = inputs.slice(index, index + BAKERY_ACTIVITY_BATCH_SIZE);
      feedBatchPromises.push(fetchBakeryTrpcBatch("leaderboard.getActivityFeed", batchInputs));
    }
    const feeds = (await Promise.all(feedBatchPromises)).flat();

    const rugReceivedStatsByBakeryId = new Map();
    let scannedEvents = 0;
    for (let index = 0; index < bakeries.length; index += 1) {
      const bakeryId = bakeries[index].bakeryId;
      const feed = feeds[index] || [];
      scannedEvents += Array.isArray(feed) ? feed.length : 0;
      rugReceivedStatsByBakeryId.set(bakeryId, countIncomingRugs(feed));
    }

    return {
      rugReceivedStatsByBakeryId,
      rugReceivedSource: {
        label: "leaderboard_bakery_activity_feeds",
        bakeryCount: bakeries.length,
        eventLimitPerBakery: BAKERY_ACTIVITY_FEED_LIMIT,
        maxEvents: bakeries.length * BAKERY_ACTIVITY_FEED_LIMIT,
        scannedEvents,
        updatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    const fallback = await getGlobalRugsReceivedByBakeryId();
    fallback.rugReceivedSource.fallbackReason = error instanceof Error ? error.message : String(error);
    return fallback;
  }
}

function getDisabledRugReceivedData() {
  return {
    rugReceivedStatsByBakeryId: new Map(),
    rugReceivedSource: {
      label: "disabled",
      updatedAt: new Date().toISOString()
    }
  };
}

async function buildDashboard({ activeSeason, boardKey = DEFAULT_BOARD_KEY }) {
  if (!activeSeason) {
    throw new Error("No active Bakery season found");
  }

  const rules = seasonRuleConfig(activeSeason.id, boardKey);
  const bakeryInput = {};
  if (Number.isFinite(Number(rules.tierId)) && Number(rules.tierId) > 0) {
    bakeryInput.tierId = Number(rules.tierId);
  }

  const [leaderboard, topChefs] = await Promise.all([
    fetchPaginatedBakeryLeaderboard({
      procedure: "leaderboard.getTopBakeries",
      baseInput: bakeryInput,
      totalLimit: rules.rowLimit,
      cursorKey: "id"
    }),
    fetchPaginatedBakeryLeaderboard({
      procedure: "leaderboard.getTopChefs",
      baseInput: { seasonId: activeSeason.id },
      totalLimit: rules.topChefLimit,
      cursorKey: "address"
    })
  ]);
  const rows = sortRowsForDisplay((leaderboard.items || []).slice(0, rules.rowLimit), activeSeason.id);
  const topChefStatsByAddress = new Map(
    (topChefs.items || []).map((chef) => [chef.address.toLowerCase(), chef])
  );
  const addresses = [...new Set(rows
    .map((row) => row.topCook || row.creator || row.leader)
    .filter((address) => typeof address === "string" && address.length > 0)
    .map((address) => address.toLowerCase()))];
  const [profiles, abstractProfilesByAddress, costEstimate, costCache, rankCache, rugCache] = await Promise.all([
    addresses.length > 0
      ? fetchBakeryTrpc("profiles.getByAddresses", { addresses })
      : Promise.resolve([]),
    getAbstractProfilesByAddress(addresses),
    getRpcCostEstimate(activeSeason.id, addresses),
    loadCostCache(),
    loadRankCache(),
    loadRugCache()
  ]);
  const rugReceivedData = MOST_RUGGED_ENABLED
    ? rugStatsFromCache(rugCache, activeSeason.id, rows) || await getBakeryRugsReceived(rows, activeSeason.id)
    : getDisabledRugReceivedData();
  const { rugReceivedStatsByBakeryId, rugReceivedSource } = rugReceivedData;
  const profileNameByAddress = new Map(
    profiles.map((entry) => [entry.address.toLowerCase(), entry.profile?.name || null])
  );

  const prizePoolWei = activeSeason.finalizedPrizePool || activeSeason.prizePool || "0";
  const leaderboardBucketWei = multiplyWeiByPercent(prizePoolWei, rules.leaderboardBucketPct);
  const activityBucketWei = multiplyWeiByPercent(prizePoolWei, rules.activityBucketPct);
  const totalLeaderboardCookiesBaked = rows.reduce(
    (total, row) => total + BigInt(row.cookiesBaked || row.rawTxCount || "0"),
    0n
  ).toString();
  const estimatedCostPerMillionWei = BigInt(costEstimate.estimatedCostPerMillionWei || "0");

  return {
    updatedAt: new Date().toISOString(),
    seasonId: activeSeason.id,
    seasonDisplayId: publicSeasonId(activeSeason.id),
    seasonEndsAt: activeSeason.endTime ? new Date(Number(activeSeason.endTime) * 1000).toISOString() : null,
    leaderboardKey: rules.boardKey,
    leaderboardName: rules.boardName,
    leaderboardTitle: rules.dynamicLeaderboardLabel,
    globalLeaderboardLabel: rules.globalLeaderboardLabel,
    countLabel: rules.countLabel,
    rowLabel: rules.rowLabel,
    bucketProjectionLabel: rules.bucketProjectionLabel,
    grossLabel: rules.grossLabel,
    costLabel: rules.costLabel,
    pnlLabel: rules.pnlLabel,
      payoutSummaryText: rules.payoutSummaryText,
      availableLeaderboards: rules.availableLeaderboards,
      rankingMetric: seasonUsesScoreRanking(activeSeason.id) ? "score" : "cookies",
      prizePoolWei,
    prizePoolEth: weiToEthNumber(prizePoolWei),
    leaderboardBucketPct: rules.leaderboardBucketPct,
    leaderboardBucketWei,
    leaderboardBucketEth: weiToEthNumber(leaderboardBucketWei),
    activityBucketPct: rules.activityBucketPct,
    activityBucketWei,
    activityBucketEth: weiToEthNumber(activityBucketWei),
    leaderboardPayouts: rules.leaderboardPayouts,
    activityTiers: rules.activityTiers,
    totalLeaderboardCookiesBaked,
    rugReceivedSource,
    sourceUrl: BAKERY_SOURCE_URL,
    docsUrl: rules.payoutDocsUrl,
    costEstimate,
    costCache: costCache
      ? {
        status: costCache.status || "unknown",
        updatedAt: costCache.updatedAt || null,
        latestKnownBlock: costCache.latestKnownBlock ?? null,
        completeChefCount: costCache.completeChefCount ?? 0,
        top100AddressCount: costCache.top100AddressCount ?? 0
      }
      : null,
    rankCache: rankCache
      ? {
        updatedAt: rankCache.updatedAt || null,
        previousUpdatedAt: rankCache.previousUpdatedAt || null
      }
      : null,
      rows: rows.map((row, index) => {
        const rank = Number(row.displayRank ?? row.rank ?? index + 1) || index + 1;
        const chefAddress = row.topCook || row.creator || row.leader || "";
        const normalizedChefAddress = chefAddress.toLowerCase();
        const leaderboardSharePct = getLeaderboardSharePct(rank, rules.leaderboardPayouts);
        const prizeBps = leaderboardSharePct * 100;
        const grossPrizeWei = leaderboardSharePct > 0
          ? multiplyWeiByPercent(leaderboardBucketWei, leaderboardSharePct)
          : "0";
        const cookiesBaked = row.cookiesBaked || row.rawTxCount || "0";
        const score = row.score || row.effectiveTxCount || "0";
        const topChefStats = topChefStatsByAddress.get(normalizedChefAddress);
        const rugReceivedStats = rugReceivedStatsByBakeryId.get(Number(row.id)) || emptyIncomingRugStats();
        const abstractProfile = abstractProfilesByAddress.get(normalizedChefAddress);
      const cachedCost = costFromCache(costCache, activeSeason.id, normalizedChefAddress);
      const estimatedCostWei = estimatedCostPerMillionWei > 0n
        ? safeDivideBigInt(BigInt(cookiesBaked) * estimatedCostPerMillionWei, 1_000_000n).toString()
        : "0";
      const cacheCookiesRaw = BigInt(cachedCost?.cookiesRaw || "0");
      const missingCookiesRaw = cachedCost?.complete
        ? 0n
        : BigInt(cookiesBaked) > cacheCookiesRaw
          ? BigInt(cookiesBaked) - cacheCookiesRaw
          : 0n;
      const ownEstimatedCostPerMillionWei = estimatedCostPerMillionFromCachedCost(cachedCost);
      const fallbackEstimatedCostPerMillionWei = ownEstimatedCostPerMillionWei > 0n
        ? ownEstimatedCostPerMillionWei
        : estimatedCostPerMillionWei;
      const estimatedMissingCostWei = estimatedCostPerMillionWei > 0n
        ? safeDivideBigInt(missingCookiesRaw * fallbackEstimatedCostPerMillionWei, 1_000_000n)
        : 0n;
      const costWei = cachedCost
        ? (BigInt(cachedCost.costWei || "0") + estimatedMissingCostWei).toString()
        : estimatedCostWei;

      return {
        rank,
        bakeryId: row.id,
        bakeryName: row.name,
        chefAddress,
          chefName: profileNameByAddress.get(normalizedChefAddress) || abstractProfile?.name || (chefAddress ? shortAddress(chefAddress) : "-"),
          profileImageUrl: abstractProfileImageUrl(abstractProfile),
          rankMovement: rankMovementFromCache(rankCache, activeSeason.id, normalizedChefAddress, rank),
          score,
          cookiesBaked,
          cookieBalance: row.cookieBalance || row.txCount || "0",
        rugAttempts: Number(topChefStats?.rugAttempts || 0),
        rugLanded: Number(topChefStats?.rugLanded || 0),
        recentRugsReceived: rugReceivedStats.successful,
        recentRugAttemptsReceived: rugReceivedStats.attempts,
        recentRugFailsReceived: rugReceivedStats.failed,
        boostAttempts: Number(topChefStats?.boostAttempts || 0),
        boostLanded: Number(topChefStats?.boostLanded || 0),
        grossPrizeWei,
        grossPrizeEth: weiToEthNumber(grossPrizeWei),
        prizeBps,
        leaderboardSharePct,
        estimatedCostWei: costWei,
        estimatedCostEth: weiToEthNumber(costWei),
        costSource: cachedCost
          ? cachedCost.complete ? "exact_gas_cache" : "partial_gas_cache"
          : "abstract_rpc_recent_sample",
        exactCookTxCount: cachedCost?.cookTxCount || null,
        exactCostUpdatedAt: cachedCost?.updatedAt || null,
        exactCostToBlock: cachedCost?.toBlock ?? null
      };
    })
  };
}

export default async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  response.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");

  try {
    const url = requestUrl(request);
    const requestedSeasonId = Number(url.searchParams.get("season") || 0) || null;
    const requestedBoardKey = normalizeBoardKey(url.searchParams.get("board"));
    const cacheKey = requestedSeasonId
      ? `season:${requestedSeasonId}:board:${requestedBoardKey}`
      : `default:board:${requestedBoardKey}`;

    if (memoryCache && memoryCache.key === cacheKey && memoryCache.expiresAt > Date.now()) {
      response.status(200).json(memoryCache.payload);
      return;
    }

    const seasons = await fetchBakeryTrpc("leaderboard.getActiveSeason", null);
    const activeSeason = seasons.find((season) => season.isActive !== false) || seasons[0] || null;
    const historyEntries = await loadSeasonHistoryEntries();
    const seasonOptions = buildSeasonOptions(historyEntries, activeSeason);
    const requestedHistory = requestedSeasonId
      ? historyEntries.find((entry) => Number(entry.seasonId) === requestedSeasonId)
      : null;
    const activeSeasonHistory = activeSeason
      ? historyEntries.find((entry) => Number(entry.seasonId) === Number(activeSeason.id))
      : null;

    let payload;
    if (requestedHistory) {
      payload = {
        ...requestedHistory,
        availableLeaderboards: buildLeaderboardOptions(requestedHistory.seasonId),
        leaderboardKey: "overall",
        leaderboardName: "Final",
        leaderboardTitle: requestedHistory.globalLeaderboardLabel || "Top 100",
        globalLeaderboardLabel: requestedHistory.globalLeaderboardLabel || "Top 100",
        countLabel: requestedHistory.globalLeaderboardLabel || "Top 100",
        rowLabel: "bakeries",
        payoutSummaryText: "Leaderboard 70% / Activity 30%",
        availableSeasons: seasonOptions,
        selectedSeasonId: Number(requestedHistory.seasonId),
        selectedLeaderboardKey: "overall",
        seasonSource: "history"
      };
    } else if (!requestedSeasonId && activeSeasonHistory && activeSeason?.finalized === true) {
      payload = {
        ...activeSeasonHistory,
        availableLeaderboards: buildLeaderboardOptions(activeSeasonHistory.seasonId),
        leaderboardKey: "overall",
        leaderboardName: "Final",
        leaderboardTitle: activeSeasonHistory.globalLeaderboardLabel || "Top 100",
        globalLeaderboardLabel: activeSeasonHistory.globalLeaderboardLabel || "Top 100",
        countLabel: activeSeasonHistory.globalLeaderboardLabel || "Top 100",
        rowLabel: "bakeries",
        payoutSummaryText: "Leaderboard 70% / Activity 30%",
        availableSeasons: seasonOptions,
        selectedSeasonId: Number(activeSeasonHistory.seasonId),
        selectedLeaderboardKey: "overall",
        seasonSource: "history"
      };
    } else {
      payload = await buildDashboard({
        activeSeason,
        boardKey: requestedBoardKey
      });
      payload.availableSeasons = seasonOptions;
      payload.selectedSeasonId = Number(payload.seasonId);
      payload.selectedLeaderboardKey = payload.leaderboardKey;
      payload.seasonSource = "live";
    }

    memoryCache = {
      key: cacheKey,
      expiresAt: Date.now() + 120_000,
      payload
    };
    response.status(200).json(payload);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
