import { readFile } from "node:fs/promises";

const BAKERY_APP_URL = "https://www.rugpullbakery.com";
const BAKERY_SOURCE_URL = `${BAKERY_APP_URL}/bakeries`;
const BAKERY_DOCS_PAYOUT_URL = "https://docs.rugpullbakery.com/#s3-payouts";
const ABSTRACT_RPC_URL = process.env.ABSTRACT_RPC_URL || "https://api.mainnet.abs.xyz";
const ABSTRACT_PROFILE_API_URL = "https://backend.portal.abs.xyz/api/user/address";
const ABSTRACT_ASSET_URL = "https://abstract-assets.abs.xyz";

const BAKERY_CONTRACT_ADDRESS = "0xFEB79a841D69C08aFCDC7B2BEEC8a6fbbe46C455";
const BAKERY_BAKE_SELECTOR = "0xb0de262e";
const BAKERY_BAKE_EVENT_TOPIC = "0xdfb2307530b804c690e75bb4df897c4d1ebb5e3e1187ce9e25eb7ed674c66db6";
const COST_CACHE_URL = new URL("../data/cost-cache.json", import.meta.url);
const RANK_CACHE_URL = new URL("../data/rank-cache.json", import.meta.url);
const PUBLIC_SEASON_ID_OFFSET = 2;

const LEADERBOARD_BUCKET_PCT = 70;
const ACTIVITY_BUCKET_PCT = 30;
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
const MOST_RUGGED_ENABLED = process.env.BAKERY_ENABLE_MOST_RUGGED === "1";

const LEADERBOARD_PAYOUTS = [
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

const ACTIVITY_TIERS = [
  { tier: "Tier 1", sharePct: 50 },
  { tier: "Tier 2", sharePct: 30 },
  { tier: "Tier 3", sharePct: 20 }
];

let memoryCache = null;

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
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

function getLeaderboardSharePct(rank) {
  return LEADERBOARD_PAYOUTS.find((payout) => rank >= payout.minRank && rank <= payout.maxRank)?.sharePct || 0;
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

  return {
    costWei: entry.gasCostWei,
    costEth: weiToEthNumber(entry.gasCostWei),
    complete: entry.complete === true,
    cookTxCount: Number(entry.cookTxCount || 0),
    cookiesRaw: entry.cookiesRaw || "0",
    updatedAt: costCache.updatedAt || entry.updatedAt || null,
    toBlock: entry.toBlock ?? costCache.latestKnownBlock ?? null
  };
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

async function getTop100BakeryRugsReceived(rows, seasonId) {
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
        label: "top100_bakery_activity_feeds",
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

async function buildDashboard() {
  const seasons = await fetchBakeryTrpc("leaderboard.getActiveSeason", null);
  const activeSeason = seasons.find((season) => season.isActive !== false) || seasons[0];
  if (!activeSeason) {
    throw new Error("No active Bakery season found");
  }

  const [leaderboard, topChefs] = await Promise.all([
    fetchBakeryTrpc("leaderboard.getTopBakeries", { limit: 100 }),
    fetchBakeryTrpc("leaderboard.getTopChefs", { seasonId: activeSeason.id, limit: 100 })
  ]);
  const rows = leaderboard.items.slice(0, 100);
  const topChefStatsByAddress = new Map(
    (topChefs.items || []).map((chef) => [chef.address.toLowerCase(), chef])
  );
  const addresses = [...new Set(rows
    .map((row) => row.topCook || row.creator || row.leader)
    .filter((address) => typeof address === "string" && address.length > 0)
    .map((address) => address.toLowerCase()))];
  const [rugReceivedData, profiles, abstractProfilesByAddress, costEstimate, costCache, rankCache] = await Promise.all([
    MOST_RUGGED_ENABLED
      ? getTop100BakeryRugsReceived(rows, activeSeason.id)
      : Promise.resolve(getDisabledRugReceivedData()),
    addresses.length > 0
      ? fetchBakeryTrpc("profiles.getByAddresses", { addresses })
      : Promise.resolve([]),
    getAbstractProfilesByAddress(addresses),
    getRpcCostEstimate(activeSeason.id, addresses),
    loadCostCache(),
    loadRankCache()
  ]);
  const { rugReceivedStatsByBakeryId, rugReceivedSource } = rugReceivedData;
  const profileNameByAddress = new Map(
    profiles.map((entry) => [entry.address.toLowerCase(), entry.profile?.name || null])
  );

  const prizePoolWei = activeSeason.finalizedPrizePool || activeSeason.prizePool || "0";
  const leaderboardBucketWei = multiplyWeiByPercent(prizePoolWei, LEADERBOARD_BUCKET_PCT);
  const activityBucketWei = multiplyWeiByPercent(prizePoolWei, ACTIVITY_BUCKET_PCT);
  const totalTop100CookiesBaked = rows.reduce(
    (total, row) => total + BigInt(row.cookiesBaked || row.rawTxCount || "0"),
    0n
  ).toString();
  const estimatedCostPerMillionWei = BigInt(costEstimate.estimatedCostPerMillionWei || "0");

  return {
    updatedAt: new Date().toISOString(),
    seasonId: activeSeason.id,
    seasonDisplayId: publicSeasonId(activeSeason.id),
    seasonEndsAt: activeSeason.endTime ? new Date(Number(activeSeason.endTime) * 1000).toISOString() : null,
    prizePoolWei,
    prizePoolEth: weiToEthNumber(prizePoolWei),
    leaderboardBucketPct: LEADERBOARD_BUCKET_PCT,
    leaderboardBucketWei,
    leaderboardBucketEth: weiToEthNumber(leaderboardBucketWei),
    activityBucketPct: ACTIVITY_BUCKET_PCT,
    activityBucketWei,
    activityBucketEth: weiToEthNumber(activityBucketWei),
    leaderboardPayouts: LEADERBOARD_PAYOUTS,
    activityTiers: ACTIVITY_TIERS,
    totalTop100CookiesBaked,
    rugReceivedSource,
    sourceUrl: BAKERY_SOURCE_URL,
    docsUrl: BAKERY_DOCS_PAYOUT_URL,
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
      const rank = row.rank ?? index + 1;
      const chefAddress = row.topCook || row.creator || row.leader || "";
      const normalizedChefAddress = chefAddress.toLowerCase();
      const leaderboardSharePct = getLeaderboardSharePct(rank);
      const prizeBps = leaderboardSharePct * 100;
      const grossPrizeWei = leaderboardSharePct > 0
        ? multiplyWeiByPercent(leaderboardBucketWei, leaderboardSharePct)
        : "0";
      const cookiesBaked = row.cookiesBaked || row.rawTxCount || "0";
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
      const estimatedMissingCostWei = estimatedCostPerMillionWei > 0n
        ? safeDivideBigInt(missingCookiesRaw * estimatedCostPerMillionWei, 1_000_000n)
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
    if (memoryCache && memoryCache.expiresAt > Date.now()) {
      response.status(200).json(memoryCache.payload);
      return;
    }

    const payload = await buildDashboard();
    memoryCache = {
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
