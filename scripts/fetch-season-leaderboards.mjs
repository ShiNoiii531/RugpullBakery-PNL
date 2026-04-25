import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BAKERY_APP_URL = "https://www.rugpullbakery.com";

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
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

async function fetchPaginatedLeaderboard({ procedure, seasonId, totalLimit, cursorKey }) {
  const items = [];
  let nextCursor = null;

  while (items.length < totalLimit) {
    const remaining = totalLimit - items.length;
    const pageLimit = Math.min(100, remaining);
    const input = { limit: pageLimit };

    if (seasonId) {
      input.seasonId = seasonId;
    }
    if (nextCursor) {
      input.cursor = nextCursor;
    }

    const page = await fetchBakeryTrpc(procedure, input);
    const pageItems = page?.items || [];
    items.push(...pageItems);

    if (!page?.nextCursor || pageItems.length === 0) {
      return {
        items: items.slice(0, totalLimit),
        nextCursor: page?.nextCursor || null,
        activityCounts: page?.activityCounts || null
      };
    }

    nextCursor = page.nextCursor;
    if (cursorKey && !(cursorKey in nextCursor)) {
      break;
    }
  }

  return {
    items: items.slice(0, totalLimit),
    nextCursor,
    activityCounts: null
  };
}

async function main() {
  const seasonId = positiveInteger(process.env.SEASON_ID, 6);
  const limit = positiveInteger(process.env.LEADERBOARD_LIMIT, 110);
  const outputDir = resolve("data", "season-leaderboards");

  const seasons = await fetchBakeryTrpc("leaderboard.getActiveSeason", null);
  const [bakers, chefs] = await Promise.all([
    fetchPaginatedLeaderboard({
      procedure: "leaderboard.getTopBakeries",
      totalLimit: limit,
      cursorKey: "id"
    }),
    fetchPaginatedLeaderboard({
      procedure: "leaderboard.getTopChefs",
      seasonId,
      totalLimit: limit,
      cursorKey: "address"
    })
  ]);

  const season = (seasons || []).find((entry) => Number(entry.id) === Number(seasonId)) || null;
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    seasonId,
    seasonDisplayId: Math.max(1, seasonId - 2),
    limit,
    season,
    bakers,
    chefs
  };

  const outputPath = resolve(outputDir, `season-${seasonId}-top-${limit}.json`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
  console.log(`Bakers: ${(bakers?.items || []).length} | Chefs: ${(chefs?.items || []).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
