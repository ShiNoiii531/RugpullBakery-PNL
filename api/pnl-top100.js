const BAKERY_APP_URL = "https://www.rugpullbakery.com";
const BAKERY_SOURCE_URL = `${BAKERY_APP_URL}/bakeries`;
const BAKERY_DOCS_PAYOUT_URL = "https://docs.rugpullbakery.com/#s3-payouts";
const ABSTRACT_RPC_URL = process.env.ABSTRACT_RPC_URL || "https://api.mainnet.abs.xyz";

const BAKERY_CONTRACT_ADDRESS = "0xFEB79a841D69C08aFCDC7B2BEEC8a6fbbe46C455";
const BAKERY_BAKE_SELECTOR = "0xb0de262e";
const BAKERY_BAKE_EVENT_TOPIC = "0xdfb2307530b804c690e75bb4df897c4d1ebb5e3e1187ce9e25eb7ed674c66db6";

const LEADERBOARD_BUCKET_PCT = 70;
const ACTIVITY_BUCKET_PCT = 30;
const COST_SAMPLE_BLOCKS = positiveNumber(process.env.BAKERY_COST_SAMPLE_BLOCKS, 180);
const COST_SAMPLE_MAX_TXS = positiveNumber(process.env.BAKERY_COST_SAMPLE_MAX_TXS, 150);

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
      const value = hexToBigInt(transaction.value);
      const rawCookies = decodeLogUint256(log.data, 0);
      const effectiveCookies = decodeLogUint256(log.data, 1);
      const cookies = effectiveCookies > 0n ? effectiveCookies : rawCookies;

      if (gasUsed === 0n || gasPrice === 0n || cookies === 0n) {
        continue;
      }

      sampleCookies += cookies;
      sampleCostWei += gasUsed * gasPrice + value;
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

async function buildDashboard() {
  const seasons = await fetchBakeryTrpc("leaderboard.getActiveSeason", null);
  const activeSeason = seasons.find((season) => season.isActive !== false) || seasons[0];
  if (!activeSeason) {
    throw new Error("No active Bakery season found");
  }

  const leaderboard = await fetchBakeryTrpc("leaderboard.getTopBakeries", { limit: 100 });
  const rows = leaderboard.items.slice(0, 100);
  const addresses = [...new Set(rows
    .map((row) => row.topCook || row.creator || row.leader)
    .filter((address) => typeof address === "string" && address.length > 0)
    .map((address) => address.toLowerCase()))];
  const profiles = addresses.length > 0
    ? await fetchBakeryTrpc("profiles.getByAddresses", { addresses })
    : [];
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
  const costEstimate = await getRpcCostEstimate(activeSeason.id, addresses);
  const estimatedCostPerMillionWei = BigInt(costEstimate.estimatedCostPerMillionWei || "0");

  return {
    updatedAt: new Date().toISOString(),
    seasonId: activeSeason.id,
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
    sourceUrl: BAKERY_SOURCE_URL,
    docsUrl: BAKERY_DOCS_PAYOUT_URL,
    costEstimate,
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
      const estimatedCostWei = estimatedCostPerMillionWei > 0n
        ? safeDivideBigInt(BigInt(cookiesBaked) * estimatedCostPerMillionWei, 1_000_000n).toString()
        : "0";

      return {
        rank,
        bakeryId: row.id,
        bakeryName: row.name,
        chefAddress,
        chefName: profileNameByAddress.get(normalizedChefAddress) || (chefAddress ? shortAddress(chefAddress) : "-"),
        cookiesBaked,
        cookieBalance: row.cookieBalance || row.txCount || "0",
        grossPrizeWei,
        grossPrizeEth: weiToEthNumber(grossPrizeWei),
        prizeBps,
        leaderboardSharePct,
        estimatedCostWei,
        estimatedCostEth: weiToEthNumber(estimatedCostWei)
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
