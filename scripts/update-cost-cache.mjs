import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_PATH = resolve(ROOT_DIR, "data", "cost-cache.json");
const RANK_CACHE_PATH = resolve(ROOT_DIR, "data", "rank-cache.json");
const SEASON_HISTORY_DIR = resolve(ROOT_DIR, "data", "season-history");

const BAKERY_APP_URL = "https://www.rugpullbakery.com";
const ABSTRACT_RPC_URL = process.env.ABSTRACT_RPC_URL || "https://api.mainnet.abs.xyz";
const BAKERY_CONTRACT_ADDRESS = "0xFEB79a841D69C08aFCDC7B2BEEC8a6fbbe46C455";
const BAKERY_BAKE_EVENT_TOPIC = "0xdfb2307530b804c690e75bb4df897c4d1ebb5e3e1187ce9e25eb7ed674c66db6";
const LEADERBOARD_BUCKET_PCT = 70;
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

const MAX_BLOCKS_PER_RUN = positiveInteger(process.env.COST_CACHE_MAX_BLOCKS, 60_000);
const MAX_TXS_PER_RUN = positiveInteger(process.env.COST_CACHE_MAX_TXS, 30_000);
const LOG_BLOCK_SPAN = BigInt(positiveInteger(process.env.COST_CACHE_LOG_BLOCK_SPAN, 250));
const RECEIPT_BATCH_SIZE = positiveInteger(process.env.COST_CACHE_RECEIPT_BATCH_SIZE, 100);
const BLOCK_RECEIPT_BATCH_SIZE = positiveInteger(process.env.COST_CACHE_BLOCK_RECEIPT_BATCH_SIZE, 20);
const CHECKPOINT_CHUNK_INTERVAL = positiveInteger(process.env.COST_CACHE_CHECKPOINT_CHUNKS, 10);
const THROTTLE_MS = positiveInteger(process.env.COST_CACHE_THROTTLE_MS, 80);
const SEASON_SNAPSHOT_WINDOW_MINUTES = positiveInteger(process.env.SEASON_SNAPSHOT_WINDOW_MINUTES, 90);
const FORCE_SEASON_SNAPSHOT = process.env.SEASON_SNAPSHOT_FORCE === "1";

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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

function safeDivideBigInt(numerator, denominator) {
  return denominator === 0n ? 0n : numerator / denominator;
}

function topicForAddress(address) {
  return `0x000000000000000000000000${address.toLowerCase().replace(/^0x/, "")}`;
}

function addressFromTopic(topic) {
  if (!topic || topic.length !== 66) {
    return null;
  }
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function topicForUint256(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

function multiplyWeiByPercent(wei, percent) {
  const scaledPercent = BigInt(Math.round(percent * 1_000_000));
  return safeDivideBigInt(BigInt(wei) * scaledPercent, 100_000_000n).toString();
}

function getLeaderboardSharePct(rank) {
  return LEADERBOARD_PAYOUTS.find((payout) => rank >= payout.minRank && rank <= payout.maxRank)?.sharePct || 0;
}

function unixSecondsToIso(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000).toISOString() : null;
}

function decodeLogUint256(data, index) {
  const start = 2 + index * 64;
  const word = data.slice(start, start + 64);
  return word.length === 64 ? BigInt(`0x${word}`) : 0n;
}

function logIndex(log) {
  return Number(hexToBigInt(log.logIndex || "0x0"));
}

function blockNumber(log) {
  return Number(hexToBigInt(log.blockNumber || "0x0"));
}

async function fetchJson(url, options = {}, label = "request") {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    let response;
    let text;
    try {
      response = await fetch(url, options);
      text = await response.text();
    } catch (error) {
      if (attempt < 5) {
        await sleep(750 * attempt);
        continue;
      }
      throw new Error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await sleep(500 * attempt);
        continue;
      }
      throw new Error(`${label} failed with ${response.status}: ${text.slice(0, 160)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      if (attempt < 5) {
        await sleep(500 * attempt);
        continue;
      }
      throw new Error(`${label} returned non-JSON: ${text.slice(0, 160)}`);
    }
  }

  throw new Error(`${label} failed after retries`);
}

async function fetchBakeryTrpc(procedure, input) {
  const endpoint = new URL(`${BAKERY_APP_URL}/api/trpc/${procedure}`);
  endpoint.searchParams.set("batch", "1");
  endpoint.searchParams.set("input", JSON.stringify({ "0": { json: input } }));

  const payload = await fetchJson(endpoint, {
    headers: {
      "x-trpc-source": "nextjs-react"
    }
  }, `Bakery ${procedure}`);
  const first = payload[0];
  if (first?.error) {
    throw new Error(first.error.message || `Bakery ${procedure} returned an error`);
  }
  return first?.result?.data?.json;
}

async function rpcCall(method, params = []) {
  const payload = await fetchJson(ABSTRACT_RPC_URL, {
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
  }, `Abstract RPC ${method}`);

  if (payload.error) {
    throw new Error(payload.error.message || `Abstract RPC ${method} returned an error`);
  }
  return payload.result;
}

async function rpcBatch(calls, allowSplit = true) {
  if (calls.length === 0) {
    return [];
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const payload = await fetchJson(ABSTRACT_RPC_URL, {
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
    }, "Abstract RPC batch");

    if (!Array.isArray(payload)) {
      if (allowSplit && calls.length > 1) {
        const middle = Math.ceil(calls.length / 2);
        return [
          ...await rpcBatch(calls.slice(0, middle), true),
          ...await rpcBatch(calls.slice(middle), true)
        ];
      }
      if (attempt < 5) {
        await sleep(500 * attempt);
        continue;
      }
      throw new Error("Abstract RPC batch returned an unexpected payload");
    }

    const hasRetryableError = payload.some((entry) => entry.error);
    if (hasRetryableError && attempt < 5) {
      await sleep(500 * attempt);
      continue;
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

  throw new Error("Abstract RPC batch failed after retries");
}

async function getBlockAtOrAfterTimestamp(timestamp) {
  const target = BigInt(timestamp);
  const latestBlock = hexToBigInt(await rpcCall("eth_blockNumber"));
  let low = 0n;
  let high = latestBlock;

  while (low < high) {
    const middle = (low + high) / 2n;
    const block = await rpcCall("eth_getBlockByNumber", [bigintToHex(middle), false]);
    const blockTimestamp = hexToBigInt(block?.timestamp || "0x0");
    if (blockTimestamp < target) {
      low = middle + 1n;
    } else {
      high = middle;
    }
  }

  return low;
}

async function getBakeLogs(seasonId, addressTopics, fromBlock, toBlock) {
  return rpcCall("eth_getLogs", [{
    address: BAKERY_CONTRACT_ADDRESS,
    fromBlock: bigintToHex(fromBlock),
    toBlock: bigintToHex(toBlock),
    topics: [
      BAKERY_BAKE_EVENT_TOPIC,
      addressTopics,
      topicForUint256(seasonId)
    ]
  }]);
}

async function getBakeLogsAdaptive(seasonId, addressTopics, fromBlock, toBlock) {
  try {
    return await getBakeLogs(seasonId, addressTopics, fromBlock, toBlock);
  } catch (error) {
    if (fromBlock >= toBlock) {
      throw error;
    }
    const middle = (fromBlock + toBlock) / 2n;
    const left = await getBakeLogsAdaptive(seasonId, addressTopics, fromBlock, middle);
    const right = await getBakeLogsAdaptive(seasonId, addressTopics, middle + 1n, toBlock);
    return [...left, ...right];
  }
}

async function readCache() {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return {
      version: 1,
      status: "empty",
      seasonId: null,
      seasonStartBlock: null,
      latestKnownBlock: null,
      updatedAt: null,
      top100AddressCount: 0,
      completeChefCount: 0,
      chefs: {}
    };
  }
}

async function writeCache(cache) {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

async function readRankCache() {
  try {
    return JSON.parse(await readFile(RANK_CACHE_PATH, "utf8"));
  } catch {
    return {
      version: 1,
      seasonId: null,
      updatedAt: null,
      previousUpdatedAt: null,
      currentRanks: {},
      previousRanks: {}
    };
  }
}

async function writeRankSnapshot(seasonId, leaderboardItems) {
  const currentRanks = {};
  (leaderboardItems || []).slice(0, 100).forEach((row, index) => {
    const address = row.topCook || row.creator || row.leader;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address || "")) {
      return;
    }
    currentRanks[address.toLowerCase()] = Number(row.rank ?? index + 1);
  });

  if (Object.keys(currentRanks).length === 0) {
    return;
  }

  const previous = await readRankCache();
  const sameSeason = Number(previous.seasonId) === Number(seasonId);
  const rankCache = {
    version: 1,
    seasonId,
    updatedAt: new Date().toISOString(),
    previousUpdatedAt: sameSeason ? previous.updatedAt || null : null,
    currentRanks,
    previousRanks: sameSeason && previous.currentRanks && typeof previous.currentRanks === "object"
      ? previous.currentRanks
      : {}
  };

  await mkdir(dirname(RANK_CACHE_PATH), { recursive: true });
  await writeFile(RANK_CACHE_PATH, `${JSON.stringify(rankCache, null, 2)}\n`);
}

function seasonSnapshotDecision(activeSeason, nowMs = Date.now()) {
  const endMs = Number(activeSeason?.endTime || 0) * 1000;
  if (!Number.isFinite(endMs) || endMs <= 0) {
    return {
      shouldWrite: false,
      reason: "missing_season_end_time",
      secondsUntilEnd: null
    };
  }

  const secondsUntilEnd = Math.floor((endMs - nowMs) / 1000);
  const windowSeconds = SEASON_SNAPSHOT_WINDOW_MINUTES * 60;
  const isBeforeEndWindow = secondsUntilEnd >= 0 && secondsUntilEnd <= windowSeconds;

  return {
    shouldWrite: FORCE_SEASON_SNAPSHOT || isBeforeEndWindow,
    reason: FORCE_SEASON_SNAPSHOT ? "forced" : isBeforeEndWindow ? "pre_season_end_window" : "outside_snapshot_window",
    secondsUntilEnd
  };
}

async function getProfilesByAddress(addresses) {
  if (addresses.length === 0) {
    return new Map();
  }

  try {
    const profiles = await fetchBakeryTrpc("profiles.getByAddresses", { addresses });
    return new Map((profiles || []).map((entry) => [
      entry.address.toLowerCase(),
      entry.profile?.name || null
    ]));
  } catch (error) {
    console.warn(`Season snapshot profile lookup failed: ${error.message}`);
    return new Map();
  }
}

async function getTopChefStatsByAddress(seasonId) {
  try {
    const topChefs = await fetchBakeryTrpc("leaderboard.getTopChefs", { seasonId, limit: 100 });
    return new Map((topChefs.items || []).map((chef) => [chef.address.toLowerCase(), chef]));
  } catch (error) {
    console.warn(`Season snapshot top chef lookup failed: ${error.message}`);
    return new Map();
  }
}

async function maybeWriteSeasonHistorySnapshot({ activeSeason, leaderboardItems, top100Addresses, cache, latestBlock, startedAt }) {
  const decision = seasonSnapshotDecision(activeSeason);
  if (!decision.shouldWrite) {
    return {
      written: false,
      reason: decision.reason,
      secondsUntilEnd: decision.secondsUntilEnd
    };
  }

  const [profileNameByAddress, topChefStatsByAddress] = await Promise.all([
    getProfilesByAddress(top100Addresses),
    getTopChefStatsByAddress(activeSeason.id)
  ]);

  const snapshotAt = new Date().toISOString();
  const prizePoolWei = activeSeason.finalizedPrizePool || activeSeason.prizePool || "0";
  const leaderboardBucketWei = multiplyWeiByPercent(prizePoolWei, LEADERBOARD_BUCKET_PCT);
  const rows = (leaderboardItems || []).slice(0, 100).map((row, index) => {
    const rank = Number(row.rank ?? index + 1);
    const chefAddress = row.topCook || row.creator || row.leader || "";
    const normalizedChefAddress = chefAddress.toLowerCase();
    const chefStats = topChefStatsByAddress.get(normalizedChefAddress);
    const costEntry = cache.chefs?.[normalizedChefAddress] || null;
    const leaderboardSharePct = getLeaderboardSharePct(rank);
    const grossPrizeWei = leaderboardSharePct > 0
      ? multiplyWeiByPercent(leaderboardBucketWei, leaderboardSharePct)
      : "0";
    const gasCostWei = costEntry?.gasCostWei || "0";

    return {
      rank,
      bakeryId: row.id ?? null,
      bakeryName: row.name || null,
      chefAddress,
      chefName: profileNameByAddress.get(normalizedChefAddress) || null,
      cookiesBaked: row.cookiesBaked || row.rawTxCount || "0",
      cookieBalance: row.cookieBalance || row.txCount || "0",
      leaderboardSharePct,
      grossPrizeWei,
      rugAttempts: Number(chefStats?.rugAttempts || 0),
      rugLanded: Number(chefStats?.rugLanded || 0),
      boostAttempts: Number(chefStats?.boostAttempts || 0),
      boostLanded: Number(chefStats?.boostLanded || 0),
      gasCostWei,
      projectedPnlWei: (BigInt(grossPrizeWei) - BigInt(gasCostWei)).toString(),
      gasCostComplete: costEntry?.complete === true,
      cookTxCount: Number(costEntry?.cookTxCount || 0),
      exactCookiesRaw: costEntry?.cookiesRaw || "0",
      costToBlock: costEntry?.toBlock ?? null
    };
  });

  const snapshot = {
    version: 1,
    type: "pre_season_end",
    seasonId: activeSeason.id,
    snapshotAt,
    snapshotReason: decision.reason,
    secondsUntilSeasonEnd: decision.secondsUntilEnd,
    snapshotWindowMinutes: SEASON_SNAPSHOT_WINDOW_MINUTES,
    season: {
      id: activeSeason.id,
      startTime: activeSeason.startTime ?? null,
      endTime: activeSeason.endTime ?? null,
      startAt: unixSecondsToIso(activeSeason.startTime),
      endAt: unixSecondsToIso(activeSeason.endTime),
      prizePool: activeSeason.prizePool || "0",
      finalizedPrizePool: activeSeason.finalizedPrizePool || null,
      leaderboardBucketPct: LEADERBOARD_BUCKET_PCT,
      leaderboardBucketWei,
      isActive: activeSeason.isActive ?? null
    },
    cache: {
      status: cache.status || "unknown",
      seasonStartBlock: cache.seasonStartBlock ?? null,
      latestKnownBlock: Number(latestBlock),
      completeChefCount: cache.completeChefCount ?? 0,
      top100AddressCount: top100Addresses.length,
      updatedAt: cache.updatedAt || null,
      lastRunStartedAt: startedAt
    },
    rows
  };

  const snapshotPath = resolve(SEASON_HISTORY_DIR, `season-${activeSeason.id}.json`);
  await mkdir(SEASON_HISTORY_DIR, { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  return {
    written: true,
    reason: decision.reason,
    secondsUntilEnd: decision.secondsUntilEnd,
    path: snapshotPath
  };
}

function emptyEntry(address, seasonStartBlock) {
  return {
    address,
    fromBlock: Number(seasonStartBlock),
    toBlock: Number(seasonStartBlock - 1n),
    complete: false,
    cookTxCount: 0,
    cookiesRaw: "0",
    gasCostWei: "0",
    updatedAt: null
  };
}

function normalizeCacheForSeason(cache, seasonId, seasonStartBlock) {
  if (Number(cache.seasonId) !== Number(seasonId)) {
    return {
      version: 1,
      status: "empty",
      seasonId,
      seasonStartBlock: Number(seasonStartBlock),
      latestKnownBlock: null,
      updatedAt: null,
      top100AddressCount: 0,
      completeChefCount: 0,
      chefs: {}
    };
  }

  cache.version = 1;
  cache.seasonId = seasonId;
  cache.seasonStartBlock = cache.seasonStartBlock ?? Number(seasonStartBlock);
  cache.chefs = cache.chefs || {};
  return cache;
}

async function fetchReceiptsByHash(hashes) {
  const receiptsByHash = new Map();
  for (let index = 0; index < hashes.length; index += RECEIPT_BATCH_SIZE) {
    const batch = hashes.slice(index, index + RECEIPT_BATCH_SIZE);
    const receipts = await rpcBatch(batch.map((hash) => ({
      method: "eth_getTransactionReceipt",
      params: [hash]
    })));

    receipts.forEach((receipt, receiptIndex) => {
      receiptsByHash.set(batch[receiptIndex], receipt);
    });

    if (THROTTLE_MS > 0 && index + RECEIPT_BATCH_SIZE < hashes.length) {
      await sleep(THROTTLE_MS);
    }
  }
  return receiptsByHash;
}

async function fetchReceiptsByBlockNumbers(blockNumbers) {
  const receiptsByHash = new Map();
  const uniqueBlockNumbers = [...new Set(blockNumbers)]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  for (let index = 0; index < uniqueBlockNumbers.length; index += BLOCK_RECEIPT_BATCH_SIZE) {
    const batch = uniqueBlockNumbers.slice(index, index + BLOCK_RECEIPT_BATCH_SIZE);
    const blockReceipts = await rpcBatch(batch.map((block) => ({
      method: "eth_getBlockReceipts",
      params: [bigintToHex(BigInt(block))]
    })));

    blockReceipts.forEach((receipts, blockIndex) => {
      if (!Array.isArray(receipts)) {
        throw new Error(`Abstract RPC eth_getBlockReceipts returned no receipts for block ${batch[blockIndex]}`);
      }

      for (const receipt of receipts) {
        const hash = receipt?.transactionHash?.toLowerCase();
        if (hash) {
          receiptsByHash.set(hash, receipt);
        }
      }
    });

    if (THROTTLE_MS > 0 && index + BLOCK_RECEIPT_BATCH_SIZE < uniqueBlockNumbers.length) {
      await sleep(THROTTLE_MS);
    }
  }

  return receiptsByHash;
}

async function fetchReceiptsForLogs(logs, hashes) {
  if (hashes.length === 0) {
    return new Map();
  }

  try {
    const receiptsByHash = await fetchReceiptsByBlockNumbers(logs.map(blockNumber));
    const missingHashes = hashes.filter((hash) => !receiptsByHash.has(hash));
    if (missingHashes.length > 0) {
      const fallbackReceipts = await fetchReceiptsByHash(missingHashes);
      for (const [hash, receipt] of fallbackReceipts.entries()) {
        receiptsByHash.set(hash, receipt);
      }
    }
    return receiptsByHash;
  } catch (error) {
    console.warn(`Block receipt lookup failed, falling back to tx receipts: ${error.message}`);
    return fetchReceiptsByHash(hashes);
  }
}

function receiptGasCostWei(receipt) {
  if (!receipt || receipt.status !== "0x1") {
    return null;
  }
  const gasUsed = hexToBigInt(receipt.gasUsed);
  const gasPrice = hexToBigInt(receipt.effectiveGasPrice || "0x0");
  if (gasUsed === 0n || gasPrice === 0n) {
    return null;
  }
  return gasUsed * gasPrice;
}

function addLogToEntry(entry, log, gasCostWei) {
  const cookiesRaw = decodeLogUint256(log.data || "0x", 0);
  if (cookiesRaw === 0n || gasCostWei === null) {
    return false;
  }

  entry.cookTxCount = Number(entry.cookTxCount || 0) + 1;
  entry.cookiesRaw = (BigInt(entry.cookiesRaw || "0") + cookiesRaw).toString();
  entry.gasCostWei = (BigInt(entry.gasCostWei || "0") + gasCostWei).toString();
  return true;
}

function cacheSummary(cache, top100Addresses, latestBlock) {
  const completeChefCount = top100Addresses.filter((address) => (
    cache.chefs[address]?.complete === true &&
    Number(cache.chefs[address]?.toBlock || 0) >= Number(latestBlock)
  )).length;

  cache.top100AddressCount = top100Addresses.length;
  cache.completeChefCount = completeChefCount;
  cache.status = completeChefCount === top100Addresses.length ? "ready" : "partial";
}

function updateRunMetadata(cache, startedAt, top100Addresses, latestBlock, blocksScanned, txsProcessed, stoppedByBudget) {
  cache.latestKnownBlock = Number(latestBlock);
  cache.updatedAt = new Date().toISOString();
  cache.lastRun = {
    startedAt,
    completedAt: cache.updatedAt,
    blocksScanned,
    txsProcessed,
    stoppedByBudget,
    maxBlocksPerRun: MAX_BLOCKS_PER_RUN,
    maxTxsPerRun: MAX_TXS_PER_RUN,
    blockReceiptBatchSize: BLOCK_RECEIPT_BATCH_SIZE,
    checkpointChunkInterval: CHECKPOINT_CHUNK_INTERVAL
  };
  cacheSummary(cache, top100Addresses, latestBlock);
}

async function main() {
  const startedAt = new Date().toISOString();
  const seasons = await fetchBakeryTrpc("leaderboard.getActiveSeason", null);
  const activeSeason = seasons.find((season) => season.isActive !== false) || seasons[0];
  if (!activeSeason) {
    throw new Error("No active Bakery season found");
  }

  const leaderboard = await fetchBakeryTrpc("leaderboard.getTopBakeries", { limit: 100 });
  await writeRankSnapshot(activeSeason.id, leaderboard.items || []);
  const top100Addresses = [...new Set((leaderboard.items || [])
    .slice(0, 100)
    .map((row) => row.topCook || row.creator || row.leader)
    .filter((address) => /^0x[a-fA-F0-9]{40}$/.test(address || ""))
    .map((address) => address.toLowerCase()))];

  if (top100Addresses.length === 0) {
    throw new Error("No Top 100 chef addresses found");
  }

  const latestBlock = hexToBigInt(await rpcCall("eth_blockNumber"));
  const seasonStartBlock = await getBlockAtOrAfterTimestamp(activeSeason.startTime);
  const cache = normalizeCacheForSeason(await readCache(), activeSeason.id, seasonStartBlock);

  for (const address of top100Addresses) {
    cache.chefs[address] = cache.chefs[address] || emptyEntry(address, seasonStartBlock);
  }

  const pendingAddresses = top100Addresses.filter((address) => {
    const entry = cache.chefs[address];
    return BigInt(entry.toBlock || 0) < latestBlock;
  });

  let blocksScanned = 0;
  let txsProcessed = 0;
  let stoppedByBudget = false;
  let chunksProcessed = 0;

  const groups = new Map();
  for (const address of pendingAddresses) {
    const entry = cache.chefs[address];
    const startBlock = BigInt(entry.toBlock || Number(seasonStartBlock - 1n)) + 1n;
    const key = startBlock.toString();
    const group = groups.get(key) || [];
    group.push(address);
    groups.set(key, group);
  }

  for (const [startBlockText, addresses] of [...groups.entries()].sort((a, b) => Number(BigInt(a[0]) - BigInt(b[0])))) {
    if (stoppedByBudget) {
      break;
    }

    let cursor = BigInt(startBlockText);
    const addressTopics = addresses.map(topicForAddress);

    while (cursor <= latestBlock) {
      if (blocksScanned >= MAX_BLOCKS_PER_RUN || txsProcessed >= MAX_TXS_PER_RUN) {
        stoppedByBudget = true;
        break;
      }

      const remainingBlocks = BigInt(MAX_BLOCKS_PER_RUN - blocksScanned);
      const toBlock = [cursor + LOG_BLOCK_SPAN - 1n, latestBlock, cursor + remainingBlocks - 1n]
        .reduce((min, value) => value < min ? value : min);
      const logs = (await getBakeLogsAdaptive(activeSeason.id, addressTopics, cursor, toBlock))
        .sort((a, b) => blockNumber(a) - blockNumber(b) || logIndex(a) - logIndex(b));
      const hashes = [...new Set(logs.map((log) => log.transactionHash?.toLowerCase()).filter(Boolean))];

      if (hashes.length > 0 && txsProcessed > 0 && txsProcessed + hashes.length > MAX_TXS_PER_RUN) {
        stoppedByBudget = true;
        break;
      }

      const receiptsByHash = await fetchReceiptsForLogs(logs, hashes);
      const seenHashes = new Set();
      let chunkTxs = 0;

      for (const log of logs) {
        const hash = log.transactionHash?.toLowerCase();
        if (!hash || seenHashes.has(hash)) {
          continue;
        }
        seenHashes.add(hash);

        const address = addressFromTopic(log.topics?.[1]);
        const entry = address ? cache.chefs[address] : null;
        if (!entry) {
          continue;
        }

        const gasCostWei = receiptGasCostWei(receiptsByHash.get(hash));
        if (addLogToEntry(entry, log, gasCostWei)) {
          chunkTxs += 1;
        }
      }

      for (const address of addresses) {
        const entry = cache.chefs[address];
        entry.toBlock = Number(toBlock);
        entry.complete = toBlock >= latestBlock;
        entry.updatedAt = new Date().toISOString();
      }

      blocksScanned += Number(toBlock - cursor + 1n);
      txsProcessed += chunkTxs;
      chunksProcessed += 1;
      cursor = toBlock + 1n;

      if (chunksProcessed % CHECKPOINT_CHUNK_INTERVAL === 0) {
        updateRunMetadata(cache, startedAt, top100Addresses, latestBlock, blocksScanned, txsProcessed, stoppedByBudget);
        await writeCache(cache);
      }

      if (THROTTLE_MS > 0) {
        await sleep(THROTTLE_MS);
      }
    }
  }

  updateRunMetadata(cache, startedAt, top100Addresses, latestBlock, blocksScanned, txsProcessed, stoppedByBudget);
  await writeCache(cache);
  const seasonSnapshot = await maybeWriteSeasonHistorySnapshot({
    activeSeason,
    leaderboardItems: leaderboard.items || [],
    top100Addresses,
    cache,
    latestBlock,
    startedAt
  });

  console.log(JSON.stringify({
    status: cache.status,
    seasonId: cache.seasonId,
    latestKnownBlock: cache.latestKnownBlock,
    completeChefCount: cache.completeChefCount,
    top100AddressCount: cache.top100AddressCount,
    blocksScanned,
    txsProcessed,
    stoppedByBudget,
    seasonSnapshot
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
