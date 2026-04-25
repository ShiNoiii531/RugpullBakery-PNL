import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BAKERY_APP_URL = "https://www.rugpullbakery.com";
const OUTPUT_PATH = resolve("data/season-history/season-5.json");
const TOP_CHEFS_PATH = resolve("season5-api.json");
const ACTIVE_SEASONS_PATH = resolve("active-seasons.json");
const TX_HTML_PATH = resolve("tx-season3-final.html");
const COST_CACHE_PATH = resolve("data/cost-cache.json");
const EXACT_COSTS_PATH = resolve("data/season-history/season-5-exact-costs.json");
const REWARD_TX_HASH = "0x3a9fc1f20a73932940461b92cc55393349c82199f8284dbcdfd037a992bb9ee0";
const TX_COST_USD_MICRO = 12_700n;
const USD_MICRO_SCALE = 1_000_000n;
const WEI_PER_ETH = 1_000_000_000_000_000_000n;

function weiToEthNumber(wei) {
  if (wei === undefined || wei === null) {
    return 0;
  }
  return Number(BigInt(String(wei))) / 1e18;
}

function safeDivideBigInt(numerator, denominator) {
  return denominator === 0n ? 0n : numerator / denominator;
}

function safeDivideRoundedBigInt(numerator, denominator) {
  return denominator === 0n ? 0n : (numerator + denominator / 2n) / denominator;
}

function topicForAddress(address) {
  return `0x${address.toLowerCase()}`;
}

function multiplyWeiByPercent(wei, percent) {
  const scaledPercent = BigInt(Math.round(percent * 1_000_000));
  return safeDivideBigInt(BigInt(wei) * scaledPercent, 100_000_000n).toString();
}

function positiveBigInt(value, fallback = 0n) {
  try {
    const numeric = BigInt(String(value ?? "0"));
    return numeric > 0n ? numeric : fallback;
  } catch {
    return fallback;
  }
}

function publicSeasonId(seasonId) {
  return Math.max(1, Number(seasonId) - 2);
}

function costFromCache(costCache, seasonId, chefAddress) {
  const normalizedAddress = chefAddress?.toLowerCase();
  const entry = costCache?.chefs?.[normalizedAddress];
  if (
    !entry ||
    Number(costCache?.seasonId) !== Number(seasonId) ||
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

function estimatedTxPerMillionCookiesFromCachedCost(cachedCost) {
  const cookiesRaw = positiveBigInt(cachedCost?.cookiesRaw, 0n);
  const cookTxCount = positiveBigInt(cachedCost?.cookTxCount, 0n);
  if (cookiesRaw <= 0n || cookTxCount <= 0n) {
    return 0n;
  }

  return safeDivideRoundedBigInt(cookTxCount * 1_000_000n, cookiesRaw);
}

function deriveEstimatedTxPerMillionCookies(costCache, seasonId) {
  let totalCookiesRaw = 0n;
  let totalCookTxCount = 0n;

  for (const entry of Object.values(costCache?.chefs || {})) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const matchesSeason = Number(costCache?.seasonId) === Number(seasonId);
    if (!matchesSeason) {
      continue;
    }

    const cookiesRaw = positiveBigInt(entry.cookiesRaw, 0n);
    const cookTxCount = positiveBigInt(entry.cookTxCount, 0n);
    if (cookiesRaw <= 0n || cookTxCount <= 0n) {
      continue;
    }

    totalCookiesRaw += cookiesRaw;
    totalCookTxCount += cookTxCount;
  }

  return totalCookiesRaw > 0n
    ? safeDivideRoundedBigInt(totalCookTxCount * 1_000_000n, totalCookiesRaw)
    : 0n;
}

function parseUsdToMicro(valueText) {
  const normalized = String(valueText || "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();
  if (!normalized) {
    return 0n;
  }

  const [wholePartRaw, fractionalRaw = ""] = normalized.split(".");
  const wholePart = wholePartRaw || "0";
  const fractional = `${fractionalRaw}000000`.slice(0, 6);
  return BigInt(wholePart) * USD_MICRO_SCALE + BigInt(fractional);
}

function usdMicroToNumber(value) {
  return Number(value) / Number(USD_MICRO_SCALE);
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
  if (!first?.result?.data || !("json" in first.result.data)) {
    throw new Error(`Bakery ${procedure} returned an unexpected payload`);
  }

  return first.result.data.json;
}

function parseRewardTransaction(html) {
  const senderMatch = html.match(/id="ContentPlaceHolder1_hdnFromAddress" value="(0x[a-fA-F0-9]{40})"/);
  const actionContractMatch = html.match(/on <span data-highlight-value data-highlight-target="(0x[a-fA-F0-9]{40})"/);
  const timestampMatch = html.match(/Success \| ([A-Za-z]{3}-\d{2}-\d{4} \d{2}:\d{2}:\d{2} [AP]M \(UTC\))/);
  const ethUsdMatch = html.match(/received\s*<\/span>\s*([0-9.]+)\s*<span class='text-muted'>\(\$([0-9.,]+)\)<\/span>ETH/i);

  const logBlocks = [...html.matchAll(
    /<div class='d-flex ps-1 py-2 overflow-x-auto scrollbar-custom' id='logI_(\d+)'.*?(?=<hr class='my-4'><div class='d-flex ps-1 py-2 overflow-x-auto scrollbar-custom' id='logI_|<script>)/gs
  )];

  const payouts = [];
  let prizePoolAddress = null;

  for (const block of logBlocks) {
    const text = block[0];
    if (!text.includes("PrizeClaimed")) {
      continue;
    }

    const poolMatch = text.match(/Rugpull Bakery: Prize Pool \((0x[a-fA-F0-9]{40})\)/);
    if (poolMatch) {
      prizePoolAddress = poolMatch[1].toLowerCase();
    }

    const addressMatch = text.match(/chunk_decode_\d+_2'><a[^>]*>(0x[a-fA-F0-9]{40})<\/a>/);
    const amountMatch = text.match(/amount \(uint256\).*?>(\d+)<\/span>/s);
    if (!addressMatch || !amountMatch) {
      continue;
    }

    payouts.push({
      logIndex: Number(block[1]),
      address: addressMatch[1].toLowerCase(),
      amountWei: amountMatch[1]
    });
  }

  const totalDistributedWei = payouts.reduce((total, payout) => total + BigInt(payout.amountWei), 0n).toString();

  return {
    rewardTxHash: REWARD_TX_HASH,
    rewardSender: senderMatch?.[1]?.toLowerCase() || null,
    rewardContract: actionContractMatch?.[1]?.toLowerCase() || null,
    rewardPoolAddress: prizePoolAddress,
    rewardTimestampText: timestampMatch?.[1] || null,
    payoutEthUsdMicro: ethUsdMatch
      ? safeDivideRoundedBigInt(parseUsdToMicro(ethUsdMatch[2]) * WEI_PER_ETH, BigInt(Math.round(Number(ethUsdMatch[1]) * 1e18)))
      : 0n,
    payouts,
    totalDistributedWei
  };
}

async function main() {
  const [topChefBatch, seasonsBatch, txHtml, costCacheRaw, exactCostsRaw] = await Promise.all([
    readFile(TOP_CHEFS_PATH, "utf8"),
    readFile(ACTIVE_SEASONS_PATH, "utf8"),
    readFile(TX_HTML_PATH, "utf8"),
    readFile(COST_CACHE_PATH, "utf8"),
    readFile(EXACT_COSTS_PATH, "utf8").catch(() => null)
  ]);

  const topChefPayload = JSON.parse(topChefBatch);
  const seasonsPayload = JSON.parse(seasonsBatch);
  const costCache = JSON.parse(costCacheRaw);
  const exactCostsPayload = exactCostsRaw ? JSON.parse(exactCostsRaw) : null;
  const exactCosts = exactCostsPayload?.status === "complete" ? exactCostsPayload : null;

  const topChefs = topChefPayload?.[1]?.result?.data?.json?.items || [];
  const season = seasonsPayload?.[0]?.result?.data?.json?.find((entry) => Number(entry.id) === 5);
  if (!season) {
    throw new Error("Season 5 metadata not found");
  }

  const rewardTx = parseRewardTransaction(txHtml);
  const payoutsByAddress = new Map(rewardTx.payouts.map((payout) => [payout.address, payout.amountWei]));
  const exactCostsByAddress = new Map(Object.entries(exactCosts?.chefs || {}).map(([address, entry]) => [
    address.toLowerCase(),
    entry
  ]));
  const addresses = topChefs.map((chef) => chef.address.toLowerCase());
  const profiles = await fetchBakeryTrpc("profiles.getByAddresses", { addresses });
  const profilesByAddress = new Map(
    (profiles || []).map((entry) => [entry.address.toLowerCase(), entry.profile || null])
  );

  const estimatedTxPerMillionCookies = deriveEstimatedTxPerMillionCookies(costCache, season.id);
  const prizePoolWei = season.finalizedPrizePool || season.prizePool || "0";
  const payoutEthUsdMicro = rewardTx.payoutEthUsdMicro > 0n ? rewardTx.payoutEthUsdMicro : 0n;

  const rows = topChefs.slice(0, 100).map((chef, index) => {
    const rank = index + 1;
    const address = chef.address.toLowerCase();
    const payoutWei = payoutsByAddress.get(address) || "0";
    const profile = profilesByAddress.get(address);
    const cachedCost = costFromCache(costCache, season.id, address);
    const exactCost = exactCostsByAddress.get(address) || null;
    const cookiesRaw = chef.effectiveTxCount || chef.bakedTxCount || "0";
    const ownEstimatedTxPerMillionCookies = estimatedTxPerMillionCookiesFromCachedCost(cachedCost);
    const fallbackEstimatedTxPerMillionCookies = ownEstimatedTxPerMillionCookies > 0n
      ? ownEstimatedTxPerMillionCookies
      : estimatedTxPerMillionCookies;
    const estimatedCookTxCount = fallbackEstimatedTxPerMillionCookies > 0n
      ? safeDivideRoundedBigInt(BigInt(cookiesRaw) * fallbackEstimatedTxPerMillionCookies, 1_000_000n)
      : 0n;
    const estimatedCostUsdMicro = estimatedCookTxCount * TX_COST_USD_MICRO;
    const estimatedCostWei = payoutEthUsdMicro > 0n
      ? safeDivideRoundedBigInt(estimatedCostUsdMicro * WEI_PER_ETH, payoutEthUsdMicro).toString()
      : "0";
    const finalCostWei = typeof exactCost?.gasCostWei === "string" ? exactCost.gasCostWei : estimatedCostWei;
    const finalCostEth = weiToEthNumber(finalCostWei);
    const finalCostUsd = payoutEthUsdMicro > 0n
      ? usdMicroToNumber(safeDivideRoundedBigInt(BigInt(finalCostWei) * payoutEthUsdMicro, WEI_PER_ETH))
      : usdMicroToNumber(estimatedCostUsdMicro);
    const actualSharePct = Number(prizePoolWei) > 0
      ? Number((BigInt(payoutWei) * 100000000n) / BigInt(prizePoolWei)) / 1000000
      : 0;

    return {
      rank,
      bakeryId: Number(chef.bakeryId || 0),
      bakeryName: chef.bakeryName || "Bakery",
      chefAddress: address,
      chefName: profile?.name || address,
      profileImageUrl: profile?.profilePictureUrl || null,
      rankMovement: {
        direction: "same",
        previousRank: null,
        delta: 0
      },
      cookiesBaked: cookiesRaw,
      cookieBalance: chef.txCount || "0",
      rugAttempts: Number(chef.rugAttempts || 0),
      rugLanded: Number(chef.rugLanded || 0),
      recentRugsReceived: 0,
      recentRugAttemptsReceived: 0,
      recentRugFailsReceived: 0,
      boostAttempts: Number(chef.boostAttempts || 0),
      boostLanded: Number(chef.boostLanded || 0),
      grossPrizeWei: payoutWei,
      grossPrizeEth: weiToEthNumber(payoutWei),
      prizeBps: Math.round(actualSharePct * 100),
      leaderboardSharePct: actualSharePct,
      estimatedCostWei: finalCostWei,
      estimatedCostEth: finalCostEth,
      estimatedCostUsd: finalCostUsd,
      estimatedCookTxCount: Number(estimatedCookTxCount),
      observedCookTxCount: exactCost?.cookTxCount ?? cachedCost?.cookTxCount ?? 0,
      costSource: exactCost
        ? "historical_exact_gas"
        : ownEstimatedTxPerMillionCookies > 0n
          ? "tx_usd_rate_own_ratio"
          : "tx_usd_rate_global_ratio",
      exactCookTxCount: exactCost?.cookTxCount ?? cachedCost?.cookTxCount ?? null,
      exactCostUpdatedAt: exactCost?.generatedAt || exactCosts?.generatedAt || cachedCost?.updatedAt || null,
      exactCostToBlock: exactCost?.lastBakeBlock ?? exactCosts?.endBlock ?? cachedCost?.toBlock ?? null
    };
  });

  const payload = {
    version: 1,
    type: "finalized_onchain_rewards",
    updatedAt: new Date().toISOString(),
    isHistorical: true,
    isFinalized: true,
    seasonId: season.id,
    seasonDisplayId: publicSeasonId(season.id),
    seasonEndsAt: season.endTime ? new Date(Number(season.endTime) * 1000).toISOString() : null,
    prizePoolWei,
    prizePoolEth: weiToEthNumber(prizePoolWei),
    leaderboardBucketPct: 70,
    leaderboardBucketWei: multiplyWeiByPercent(prizePoolWei, 70),
    leaderboardBucketEth: weiToEthNumber(multiplyWeiByPercent(prizePoolWei, 70)),
    activityBucketPct: 30,
    activityBucketWei: multiplyWeiByPercent(prizePoolWei, 30),
    activityBucketEth: weiToEthNumber(multiplyWeiByPercent(prizePoolWei, 30)),
    totalTop100CookiesBaked: rows.reduce((total, row) => total + BigInt(row.cookiesBaked), 0n).toString(),
    rewardTx: {
      hash: rewardTx.rewardTxHash,
      sender: rewardTx.rewardSender,
      contract: rewardTx.rewardContract,
      poolAddress: rewardTx.rewardPoolAddress,
      timestampText: rewardTx.rewardTimestampText,
      payoutEthUsd: usdMicroToNumber(payoutEthUsdMicro),
      totalDistributedWei: rewardTx.totalDistributedWei,
      totalDistributedEth: weiToEthNumber(rewardTx.totalDistributedWei)
    },
    costModel: {
      kind: exactCosts ? "historical_exact_gas" : "tx_usd_rate",
      txUsd: Number(TX_COST_USD_MICRO) / Number(USD_MICRO_SCALE),
      payoutEthUsd: usdMicroToNumber(payoutEthUsdMicro),
      estimatedTxPerMillionCookies: Number(estimatedTxPerMillionCookies),
      exactBackfillGeneratedAt: exactCosts?.generatedAt || null,
      exactBackfillStartBlock: exactCosts?.startBlock ?? null,
      exactBackfillEndBlock: exactCosts?.endBlock ?? null,
      exactBackfillPlayerCount: exactCosts?.playerCount ?? null
    },
    sourceUrl: "https://www.rugpullbakery.com/bakeries",
    docsUrl: "https://docs.rugpullbakery.com/#s3-payouts",
    rows
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
