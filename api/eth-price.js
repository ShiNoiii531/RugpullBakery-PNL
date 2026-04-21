const PRICE_SOURCES = [
  {
    name: "coinbase",
    url: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    parse(payload) {
      return Number(payload?.data?.amount);
    }
  },
  {
    name: "coingecko",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    parse(payload) {
      return Number(payload?.ethereum?.usd);
    }
  }
];

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Price source returned ${response.status}`);
  }

  return response.json();
}

async function getEthPrice() {
  const errors = [];

  for (const source of PRICE_SOURCES) {
    try {
      const payload = await fetchJson(source.url);
      const priceUsd = source.parse(payload);
      if (Number.isFinite(priceUsd) && priceUsd > 0) {
        return {
          priceUsd,
          source: source.name,
          updatedAt: new Date().toISOString()
        };
      }
      errors.push(`${source.name}: invalid payload`);
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join("; "));
}

export default async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  try {
    response.status(200).json(await getEthPrice());
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
