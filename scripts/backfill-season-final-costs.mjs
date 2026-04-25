import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOP_CHEFS_PATH = resolve(ROOT_DIR, "season5-api.json");
const ACTIVE_SEASONS_PATH = resolve(ROOT_DIR, "active-seasons.json");
const OUTPUT_PATH = resolve(ROOT_DIR, "data", "season-history", "season-5-exact-costs.json");

const ABSTRACT_RPC_URL = process.env.ABSTRACT_RPC_URL || "https://api.mainnet.abs.xyz";
const BAKERY_CONTRACT_ADDRESS = "0xFEB79a841D69C08aFCDC7B2BEEC8a6fbbe46C455";
const BAKERY_BAKE_EVENT_TOPIC = "0xdfb2307530b804c690e75bb4df897c4d1ebb5e3e1187ce9e25eb7ed674c66db6";

const LOG_BLOCK_SPAN = positiveInteger(process.env.HISTORICAL_COST_LOG_BLOCK_SPAN, 2_000);
const BLOCK_RECEIPT_BATCH_SIZE = positiveInteger(process.env.HISTORICAL_COST_BLOCK_RECEIPT_BATCH_SIZE, 100);
const RECEIPT_BATCH_SIZE = positiveInteger(process.env.HISTORICAL_COST_RECEIPT_BATCH_SIZE, 250);
const THROTTLE_MS = positiveInteger(process.env.HISTORICAL_COST_THROTTLE_MS, 20);

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

function topicForUint256(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

function addressFromTopic(topic) {
  if (!topic || topic.length !== 66) {
    return null;
  }
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function decodeLogUint256(data, index) {
  const start = 2 + index * 64;
  const word = data.slice(start, start + 64);
  return word.length === 64 ? BigInt(`0x${word}`) : 0n;
}

function blockNumber(log) {
  return Number(hexToBigInt(log.blockNumber || "0x0"));
}

function logIndex(log) {
  return Number(hexToBigInt(log.logIndex || "0x0"));
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
      throw new Error(`${label} failed with ${response.status}: ${text.slice(0, 200)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      if (attempt < 5) {
        await sleep(500 * attempt);
        continue;
      }
      throw new Error(`${label} returned non-JSON: ${text.slice(0, 200)}`);
    }
  }

  throw new Error(`${label} failed after retries`);
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

function createEntry(address) {
  return {
    chefAddress: address,
    cookTxCount: 0,
    cookiesRaw: "0",
    gasCostWei: "0",
    firstBakeBlock: null,
    lastBakeBlock: null,
    missingReceiptCount: 0
  };
}

function addLogToEntry(entry, log, gasCostWei) {
  const cookiesRaw = decodeLogUint256(log.data || "0x", 0);
  if (cookiesRaw === 0n) {
    return false;
  }

  entry.cookTxCount += 1;
  entry.cookiesRaw = (BigInt(entry.cookiesRaw) + cookiesRaw).toString();
  if (gasCostWei !== null) {
    entry.gasCostWei = (BigInt(entry.gasCostWei) + gasCostWei).toString();
  } else {
    entry.missingReceiptCount += 1;
  }

  const block = blockNumber(log);
  entry.firstBakeBlock = entry.firstBakeBlock === null ? block : Math.min(entry.firstBakeBlock, block);
  entry.lastBakeBlock = entry.lastBakeBlock === null ? block : Math.max(entry.lastBakeBlock, block);
  return true;
}

async function main() {
  const [topChefBatch, seasonsBatch] = await Promise.all([
    readFile(TOP_CHEFS_PATH, "utf8"),
    readFile(ACTIVE_SEASONS_PATH, "utf8")
  ]);

  const topChefPayload = JSON.parse(topChefBatch);
  const seasonsPayload = JSON.parse(seasonsBatch);

  const topChefs = topChefPayload?.[1]?.result?.data?.json?.items || [];
  const season = seasonsPayload?.[0]?.result?.data?.json?.find((entry) => Number(entry.id) === 5);
  if (!season) {
    throw new Error("Season 5 metadata not found");
  }
  if (topChefs.length === 0) {
    throw new Error("Final top chefs payload is empty");
  }

  const startBlock = await getBlockAtOrAfterTimestamp(season.startTime);
  const endExclusiveBlock = await getBlockAtOrAfterTimestamp(BigInt(season.endTime) + 1n);
  const endBlock = endExclusiveBlock > 0n ? endExclusiveBlock - 1n : 0n;

  const addresses = [...new Set(topChefs.slice(0, 100).map((chef) => chef.address.toLowerCase()))];
  const addressTopics = addresses.map(topicForAddress);
  const existingPayload = await readFile(OUTPUT_PATH, "utf8")
    .then((text) => JSON.parse(text))
    .catch(() => null);
  const entries = Object.fromEntries(addresses.map((address) => [
    address,
    existingPayload?.chefs?.[address]
      ? {
          ...createEntry(address),
          ...existingPayload.chefs[address]
        }
      : createEntry(address)
  ]));

  let cursor = existingPayload?.nextBlockCursor
    ? BigInt(existingPayload.nextBlockCursor)
    : startBlock;
  let chunkCount = Number(existingPayload?.chunkCount || 0);
  let totalLogs = Number(existingPayload?.totalLogs || 0);

  async function persist(status) {
    const payload = {
      version: 1,
      status,
      seasonId: Number(season.id),
      seasonDisplayId: Math.max(1, Number(season.id) - 2),
      generatedAt: new Date().toISOString(),
      contractAddress: BAKERY_CONTRACT_ADDRESS.toLowerCase(),
      bakeEventTopic: BAKERY_BAKE_EVENT_TOPIC,
      seasonStartTime: Number(season.startTime),
      seasonEndTime: Number(season.endTime),
      startBlock: Number(startBlock),
      endBlock: Number(endBlock),
      nextBlockCursor: cursor <= endBlock ? Number(cursor) : null,
      chunkCount,
      totalLogs,
      playerCount: addresses.length,
      totals: Object.values(entries).reduce((acc, entry) => {
        acc.cookTxCount += entry.cookTxCount;
        acc.cookiesRaw = (BigInt(acc.cookiesRaw) + BigInt(entry.cookiesRaw)).toString();
        acc.gasCostWei = (BigInt(acc.gasCostWei) + BigInt(entry.gasCostWei)).toString();
        acc.missingReceiptCount += entry.missingReceiptCount;
        return acc;
      }, {
        cookTxCount: 0,
        cookiesRaw: "0",
        gasCostWei: "0",
        missingReceiptCount: 0
      }),
      chefs: entries
    };

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  }

  while (cursor <= endBlock) {
    const toBlock = [cursor + BigInt(LOG_BLOCK_SPAN) - 1n, endBlock].reduce((min, value) => value < min ? value : min);
    const logs = (await getBakeLogsAdaptive(season.id, addressTopics, cursor, toBlock))
      .sort((a, b) => blockNumber(a) - blockNumber(b) || logIndex(a) - logIndex(b));
    const hashes = [...new Set(logs.map((log) => log.transactionHash?.toLowerCase()).filter(Boolean))];
    const receiptsByHash = await fetchReceiptsForLogs(logs, hashes);
    const seenHashes = new Set();

    for (const log of logs) {
      const hash = log.transactionHash?.toLowerCase();
      if (!hash || seenHashes.has(hash)) {
        continue;
      }
      seenHashes.add(hash);

      const address = addressFromTopic(log.topics?.[1]);
      const entry = address ? entries[address] : null;
      if (!entry) {
        continue;
      }

      addLogToEntry(entry, log, receiptGasCostWei(receiptsByHash.get(hash)));
    }

    totalLogs += logs.length;
    chunkCount += 1;
    console.log(`Processed blocks ${cursor} -> ${toBlock} | logs ${logs.length} | unique tx ${hashes.length}`);
    cursor = toBlock + 1n;
    await persist("partial");

    if (THROTTLE_MS > 0 && cursor <= endBlock) {
      await sleep(THROTTLE_MS);
    }
  }

  await persist("complete");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
