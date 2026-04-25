import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUG_CACHE_PATH = resolve(ROOT_DIR, "data", "rug-cache.json");
const BAKERY_APP_URL = "https://www.rugpullbakery.com";
const PAGE_LIMIT = positiveInteger(process.env.RUG_CACHE_PAGE_LIMIT, 100);
const HISTORY_PAGE_BUDGET = positiveInteger(process.env.RUG_CACHE_HISTORY_PAGE_BUDGET, 250);
const HEAD_PAGE_BUDGET = positiveInteger(process.env.RUG_CACHE_HEAD_PAGE_BUDGET, 8);
const THROTTLE_MS = positiveInteger(process.env.RUG_CACHE_THROTTLE_MS, 30);

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function eventKey(event) {
  return [
    event?.type || "",
    event?.timestamp || "",
    event?.user || "",
    event?.bakeryId || "",
    event?.eventBakeryId || "",
    event?.success === true ? "1" : "0",
    event?.event || "",
    event?.boostTypeName || ""
  ].join("|");
}

function normalizeCursor(cursor) {
  if (!cursor || typeof cursor !== "object") {
    return null;
  }
  if (!cursor.timestamp || !cursor.requestId) {
    return null;
  }
  return {
    timestamp: String(cursor.timestamp),
    requestId: String(cursor.requestId)
  };
}

async function sleep(ms) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
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

  return first?.result?.data?.json;
}

async function readCache() {
  try {
    const payload = JSON.parse(await readFile(RUG_CACHE_PATH, "utf8"));
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid rug cache payload");
    }
    return payload;
  } catch {
    return {
      version: 1,
      seasonId: null,
      status: "idle",
      updatedAt: null,
      complete: false,
      latestSeenKey: null,
      latestSeenTimestamp: null,
      oldestCursor: null,
      scannedEvents: 0,
      importedEvents: 0,
      bakeries: {}
    };
  }
}

async function writeCache(cache) {
  await mkdir(dirname(RUG_CACHE_PATH), { recursive: true });
  await writeFile(RUG_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function emptyBakeryStats() {
  return {
    attempts: 0,
    successful: 0,
    failed: 0
  };
}

function mergeRugEvent(cache, event) {
  if (event?.type !== "rug" || !event?.eventBakeryId) {
    return false;
  }

  const bakeryId = String(event.eventBakeryId);
  const stats = cache.bakeries[bakeryId] || emptyBakeryStats();
  stats.attempts += 1;
  if (event.success) {
    stats.successful += 1;
  } else {
    stats.failed += 1;
  }
  cache.bakeries[bakeryId] = stats;
  cache.importedEvents += 1;
  return true;
}

async function fetchActivityPage(cursor = null) {
  const input = { limit: PAGE_LIMIT };
  if (cursor) {
    input.cursor = cursor;
  }
  return fetchBakeryTrpc("leaderboard.getGlobalActivityFeed", input);
}

async function syncRecentHead(cache) {
  let cursor = null;
  let pages = 0;
  let reachedKnownHead = false;
  let newestSeenKey = cache.latestSeenKey || null;
  let newestSeenTimestamp = cache.latestSeenTimestamp || null;
  let continuationCursor = normalizeCursor(cache.oldestCursor);

  while (pages < HEAD_PAGE_BUDGET) {
    const page = await fetchActivityPage(cursor);
    const items = Array.isArray(page?.items) ? page.items : [];
    if (items.length === 0) {
      break;
    }

    if (!newestSeenKey) {
      newestSeenKey = eventKey(items[0]);
      newestSeenTimestamp = String(items[0]?.timestamp || "");
    }

    let stop = false;
    for (const event of items) {
      const key = eventKey(event);
      if (cache.latestSeenKey && key === cache.latestSeenKey) {
        reachedKnownHead = true;
        stop = true;
        break;
      }
      mergeRugEvent(cache, event);
    }

    cache.scannedEvents += items.length;
    pages += 1;
    const nextCursor = normalizeCursor(page?.nextCursor);
    if (stop || !nextCursor) {
      continuationCursor = nextCursor;
      break;
    }
    continuationCursor = nextCursor;
    cursor = nextCursor;
    await sleep(THROTTLE_MS);
  }

  if (newestSeenKey) {
    cache.latestSeenKey = newestSeenKey;
    cache.latestSeenTimestamp = newestSeenTimestamp;
  }
  if (!cache.oldestCursor && continuationCursor) {
    cache.oldestCursor = continuationCursor;
  }
  if (!continuationCursor && !cache.complete) {
    cache.complete = reachedKnownHead || pages < HEAD_PAGE_BUDGET;
  }

  return reachedKnownHead;
}

async function backfillOlderHistory(cache) {
  let cursor = normalizeCursor(cache.oldestCursor);
  if (cache.complete === true) {
    return;
  }

  let pages = 0;
  while (pages < HISTORY_PAGE_BUDGET) {
    const page = await fetchActivityPage(cursor);
    const items = Array.isArray(page?.items) ? page.items : [];
    if (items.length === 0) {
      cache.complete = true;
      cache.oldestCursor = null;
      break;
    }

    for (const event of items) {
      mergeRugEvent(cache, event);
    }

    cache.scannedEvents += items.length;
    pages += 1;

    const nextCursor = normalizeCursor(page?.nextCursor);
    if (!nextCursor) {
      cache.complete = true;
      cache.oldestCursor = null;
      break;
    }

    cache.oldestCursor = nextCursor;
    cursor = nextCursor;
    await sleep(THROTTLE_MS);
  }

  if (!cache.oldestCursor && cache.complete !== true) {
    cache.complete = true;
  }
}

async function main() {
  const seasons = await fetchBakeryTrpc("leaderboard.getActiveSeason", null);
  const activeSeason = (seasons || []).find((season) => season.isActive !== false) || seasons?.[0] || null;
  if (!activeSeason) {
    throw new Error("No active Bakery season found");
  }

  let cache = await readCache();
  if (Number(cache.seasonId) !== Number(activeSeason.id)) {
    cache = {
      version: 1,
      seasonId: Number(activeSeason.id),
      status: "syncing",
      updatedAt: null,
      complete: false,
      latestSeenKey: null,
      latestSeenTimestamp: null,
      oldestCursor: null,
      scannedEvents: 0,
      importedEvents: 0,
      bakeries: {}
    };
  }

  cache.status = cache.complete ? "updating" : "syncing";
  await syncRecentHead(cache);
  await backfillOlderHistory(cache);
  cache.status = cache.complete ? "complete" : "partial";
  cache.updatedAt = new Date().toISOString();

  await writeCache(cache);
  console.log(JSON.stringify({
    status: cache.status,
    seasonId: cache.seasonId,
    complete: cache.complete,
    scannedEvents: cache.scannedEvents,
    importedEvents: cache.importedEvents,
    bakeryCount: Object.keys(cache.bakeries || {}).length,
    latestSeenTimestamp: cache.latestSeenTimestamp,
    oldestCursor: cache.oldestCursor
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
