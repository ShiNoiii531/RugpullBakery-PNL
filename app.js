const numberFormatter = new Intl.NumberFormat("en-US");
const COOKIE_RAW_UNITS_PER_COOKIE = 10_000;
const STORAGE_KEYS = {
  activeView: "bakery-public:active-view",
  currencyMode: "bakery-public:currency-mode",
  manualCost: "bakery-public:manual-cost",
  simulatorPrizePool: "bakery-public:simulator-prize-pool",
  themeMode: "bakery-public:theme-mode"
};

const els = {
  statusText: document.getElementById("statusText"),
  sourceLink: document.getElementById("sourceLink"),
  docsLink: document.getElementById("docsLink"),
  searchInput: document.getElementById("searchInput"),
  manualCostInput: document.getElementById("manualCostInput"),
  ethPriceStatus: document.getElementById("ethPriceStatus"),
  currencyToggle: document.getElementById("currencyToggle"),
  themeToggle: document.getElementById("themeToggle"),
  refreshButton: document.getElementById("refreshButton"),
  csvButton: document.getElementById("csvButton"),
  dashboardTab: document.getElementById("dashboardTab"),
  simulatorTab: document.getElementById("simulatorTab"),
  dashboardView: document.getElementById("dashboardView"),
  simulatorView: document.getElementById("simulatorView"),
  seasonValue: document.getElementById("seasonValue"),
  updatedValue: document.getElementById("updatedValue"),
  prizePoolValue: document.getElementById("prizePoolValue"),
  payoutSplitValue: document.getElementById("payoutSplitValue"),
  grossValue: document.getElementById("grossValue"),
  costValue: document.getElementById("costValue"),
  costSourceValue: document.getElementById("costSourceValue"),
  pnlValue: document.getElementById("pnlValue"),
  roiValue: document.getElementById("roiValue"),
  cookiesValue: document.getElementById("cookiesValue"),
  tableTitle: document.getElementById("tableTitle"),
  rowCount: document.getElementById("rowCount"),
  tableBody: document.getElementById("tableBody"),
  simPrizePoolInput: document.getElementById("simPrizePoolInput"),
  syncPrizePoolButton: document.getElementById("syncPrizePoolButton"),
  simPrizePoolValue: document.getElementById("simPrizePoolValue"),
  simLeaderboardBucketValue: document.getElementById("simLeaderboardBucketValue"),
  simDeltaValue: document.getElementById("simDeltaValue"),
  simRowCount: document.getElementById("simRowCount"),
  simTableBody: document.getElementById("simTableBody")
};

let dashboard = null;
let activeView = "dashboard";
let currencyMode = "eth";
let themeMode = "light";
let ethPriceUsd = 0;
let ethPriceUpdatedAt = null;
let ethPriceLoading = false;

try {
  const manualCost = localStorage.getItem(STORAGE_KEYS.manualCost);
  const storedCurrencyMode = localStorage.getItem(STORAGE_KEYS.currencyMode);
  const storedThemeMode = localStorage.getItem(STORAGE_KEYS.themeMode);
  const storedActiveView = localStorage.getItem(STORAGE_KEYS.activeView);
  const storedSimulatorPrizePool = localStorage.getItem(STORAGE_KEYS.simulatorPrizePool);
  if (manualCost !== null) {
    els.manualCostInput.value = manualCost;
  }
  if (storedCurrencyMode === "usd") {
    currencyMode = "usd";
  }
  if (storedThemeMode === "dark") {
    themeMode = "dark";
  }
  if (storedActiveView === "simulator") {
    activeView = "simulator";
  }
  if (storedSimulatorPrizePool !== null) {
    els.simPrizePoolInput.value = storedSimulatorPrizePool;
  }
} catch {
  // Optional browser storage.
}

function numericInputValue(input) {
  const value = Number(input?.value || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function numericInputValueOrNull(input) {
  if (!input || input.value === "") {
    return null;
  }

  const value = Number(input.value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatCookieCount(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: numeric >= 1_000 ? 0 : 2
  });
}

function formatEth(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  if (Math.abs(numeric) >= 10) {
    return `${numeric.toFixed(2)} ETH`;
  }
  if (Math.abs(numeric) >= 1) {
    return `${numeric.toFixed(3)} ETH`;
  }
  if (Math.abs(numeric) > 0 && Math.abs(numeric) < 0.001) {
    return `${numeric.toFixed(6)} ETH`;
  }
  return `${numeric.toFixed(4)} ETH`;
}

function formatUsd(value, { signed = false } = {}) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  if (numeric === 0) {
    return "$0";
  }

  const absolute = Math.abs(numeric);
  const sign = signed && numeric > 0 ? "+" : numeric < 0 ? "-" : "";
  const amount = absolute >= 100
    ? numberFormatter.format(Math.round(absolute))
    : absolute >= 1
      ? numberFormatter.format(Number(absolute.toFixed(2)))
      : absolute.toFixed(4);
  return `${sign}$${amount}`;
}

function formatShare(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "--";
  }

  const digits = numeric < 1 ? 3 : Number.isInteger(numeric) ? 0 : 2;
  return `${numeric.toFixed(digits)}%`;
}

function formatPercent(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return `${numeric.toFixed(2)}%`;
}

function currentEthPrice() {
  return Number.isFinite(ethPriceUsd) && ethPriceUsd > 0 ? ethPriceUsd : 0;
}

function updateEthPriceStatus() {
  if (ethPriceLoading) {
    els.ethPriceStatus.textContent = "Loading...";
    return;
  }

  if (currentEthPrice() > 0) {
    els.ethPriceStatus.textContent = formatUsd(ethPriceUsd);
    return;
  }

  els.ethPriceStatus.textContent = "Unavailable";
}

async function refreshEthPrice() {
  if (ethPriceLoading) {
    return;
  }

  ethPriceLoading = true;
  updateEthPriceStatus();

  try {
    const response = await fetch("/api/eth-price");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "ETH price unavailable");
    }

    const price = Number(payload.priceUsd);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("ETH price payload is invalid");
    }

    ethPriceUsd = price;
    ethPriceUpdatedAt = payload.updatedAt || new Date().toISOString();
  } catch (error) {
    ethPriceUsd = 0;
    ethPriceUpdatedAt = null;
    els.statusText.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    ethPriceLoading = false;
    updateEthPriceStatus();
    if (dashboard) {
      renderDashboard();
    }
  }
}

function setCurrencyMode(mode, shouldPersist = true) {
  currencyMode = mode === "usd" ? "usd" : "eth";
  els.currencyToggle.setAttribute("aria-pressed", String(currencyMode === "usd"));
  els.currencyToggle.setAttribute("aria-label", currencyMode === "usd" ? "Showing USD values" : "Showing ETH values");
  els.currencyToggle.title = currencyMode === "usd" ? "Showing USD values" : "Showing ETH values";

  if (shouldPersist) {
    try {
      localStorage.setItem(STORAGE_KEYS.currencyMode, currencyMode);
    } catch {}
  }

  if (dashboard) {
    renderDashboard();
  }
}

function setThemeMode(mode, shouldPersist = true) {
  themeMode = mode === "dark" ? "dark" : "light";
  document.body.dataset.theme = themeMode;
  els.themeToggle.setAttribute("aria-pressed", String(themeMode === "dark"));
  els.themeToggle.setAttribute("aria-label", themeMode === "dark" ? "Dark mode enabled" : "Light mode enabled");
  els.themeToggle.title = themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode";

  if (shouldPersist) {
    try {
      localStorage.setItem(STORAGE_KEYS.themeMode, themeMode);
    } catch {}
  }
}

function setActiveView(view, shouldPersist = true) {
  activeView = view === "simulator" ? "simulator" : "dashboard";
  const isSimulator = activeView === "simulator";

  els.dashboardView.hidden = isSimulator;
  els.simulatorView.hidden = !isSimulator;
  els.dashboardTab.setAttribute("aria-pressed", String(!isSimulator));
  els.simulatorTab.setAttribute("aria-pressed", String(isSimulator));

  if (shouldPersist) {
    try {
      localStorage.setItem(STORAGE_KEYS.activeView, activeView);
    } catch {}
  }

  if (dashboard) {
    renderDashboard();
  }
}

function computedRows() {
  if (!dashboard) {
    return [];
  }

  const manualCostPerMillion = numericInputValue(els.manualCostInput);
  const query = (els.searchInput.value || "").trim().toLowerCase();

  return (dashboard.rows || [])
    .filter((row) => {
      if (!query) {
        return true;
      }
      return `${row.chefName} ${row.chefAddress} ${row.bakeryName}`.toLowerCase().includes(query);
    })
    .map((row) => {
      const cookiesBakedRaw = Number(row.cookiesBaked || 0);
      const cookiesBaked = cookiesBakedRaw / COOKIE_RAW_UNITS_PER_COOKIE;
      const grossEth = Number(row.grossPrizeEth || 0);
      const costEth = manualCostPerMillion > 0
        ? (cookiesBakedRaw / 1_000_000) * manualCostPerMillion
        : Number(row.estimatedCostEth || 0);
      const pnlEth = grossEth - costEth;
      const roi = costEth > 0 ? (pnlEth / costEth) * 100 : null;

      return {
        ...row,
        cookiesBaked: cookiesBakedRaw,
        cookiesBakedDisplay: cookiesBaked,
        grossEth,
        costEth,
        pnlEth,
        roi
      };
    });
}

function moneyLabel(ethValue, options = {}) {
  const numericEth = Number(ethValue || 0);
  if (currencyMode === "usd") {
    const price = currentEthPrice();
    return price > 0 ? formatUsd(numericEth * price, options) : "--";
  }
  return formatEth(numericEth);
}

function cell(text, className = "", label = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (label) {
    td.dataset.label = label;
  }
  if (className) {
    td.className = className;
  }
  return td;
}

function renderTable(rows) {
  els.tableBody.innerHTML = "";
  els.rowCount.textContent = `${rows.length} rows`;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.append(cell("No matching bakeries.", "empty-cell"));
    tr.firstChild.colSpan = 9;
    els.tableBody.append(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = row.pnlEth >= 0 ? "profit-row" : "loss-row";
    tr.append(
      cell(`#${row.rank}`, "rank-cell", "Rank"),
      cell(row.chefName || row.chefAddress || "-", "name-cell", "Chef"),
      cell(row.bakeryName || "-", "name-cell", "Bakery"),
      cell(formatCookieCount(row.cookiesBakedDisplay), "number-cell", "Cookies"),
      cell(formatShare(row.leaderboardSharePct), "number-cell", "Share"),
      cell(moneyLabel(row.grossEth), "number-cell", "Gross"),
      cell(moneyLabel(row.costEth), "number-cell", "Cost"),
      cell(moneyLabel(row.pnlEth, { signed: true }), "number-cell pnl-cell", "P&L"),
      cell(row.roi === null ? "--" : formatPercent(row.roi), "number-cell", "ROI")
    );
    fragment.append(tr);
  }
  els.tableBody.append(fragment);
}

function renderDashboard() {
  if (!dashboard) {
    return;
  }

  const rows = computedRows();
  const allRows = (dashboard.rows || []).map((row) => {
    const cookiesBakedRaw = Number(row.cookiesBaked || 0);
    const cookiesBaked = cookiesBakedRaw / COOKIE_RAW_UNITS_PER_COOKIE;
    const grossEth = Number(row.grossPrizeEth || 0);
    const manualCostPerMillion = numericInputValue(els.manualCostInput);
    const costEth = manualCostPerMillion > 0
      ? (cookiesBakedRaw / 1_000_000) * manualCostPerMillion
      : Number(row.estimatedCostEth || 0);
    return { cookiesBaked, grossEth, costEth, pnlEth: grossEth - costEth };
  });
  const totalGrossEth = allRows.reduce((total, row) => total + row.grossEth, 0);
  const totalCostEth = allRows.reduce((total, row) => total + row.costEth, 0);
  const totalPnlEth = allRows.reduce((total, row) => total + row.pnlEth, 0);
  const totalCookies = allRows.reduce((total, row) => total + row.cookiesBaked, 0);
  const totalRoi = totalCostEth > 0 ? (totalPnlEth / totalCostEth) * 100 : null;
  const manualCostPerMillion = numericInputValue(els.manualCostInput);

  els.statusText.textContent = `Live data refreshed ${new Date(dashboard.updatedAt).toLocaleString()}`;
  els.seasonValue.textContent = `Season ${dashboard.seasonId ?? "--"}`;
  els.updatedValue.textContent = dashboard.seasonEndsAt
    ? `Ends ${new Date(dashboard.seasonEndsAt).toLocaleString()}`
    : "Active season";
  els.prizePoolValue.textContent = moneyLabel(dashboard.prizePoolEth);
  els.payoutSplitValue.textContent =
    `Leaderboard ${formatShare(dashboard.leaderboardBucketPct)} / Activity ${formatShare(dashboard.activityBucketPct)}`;
  els.grossValue.textContent = moneyLabel(totalGrossEth);
  els.costValue.textContent = moneyLabel(totalCostEth);
  els.pnlValue.textContent = moneyLabel(totalPnlEth, { signed: true });
  els.roiValue.textContent = totalRoi === null ? "ROI --" : `ROI ${formatPercent(totalRoi)}`;
  els.cookiesValue.textContent = formatCookieCount(totalCookies);

  if (manualCostPerMillion > 0) {
    els.costSourceValue.textContent = `${moneyLabel(manualCostPerMillion)} / 1M manual`;
  } else if (dashboard.costEstimate?.status === "ok") {
    els.costSourceValue.textContent =
      `${moneyLabel(dashboard.costEstimate.estimatedCostPerMillionEth)} / 1M raw from ${dashboard.costEstimate.sampleTxCount} RPC txs`;
  } else {
    els.costSourceValue.textContent = "RPC estimate unavailable";
  }

  if (dashboard.sourceUrl) {
    els.sourceLink.href = dashboard.sourceUrl;
  }
  if (dashboard.docsUrl) {
    els.docsLink.href = dashboard.docsUrl;
  }
  renderTable(rows);
  renderSimulator(rows);
}

function simulatorPrizePoolEth() {
  const inputValue = numericInputValueOrNull(els.simPrizePoolInput);
  if (inputValue !== null) {
    return inputValue;
  }
  return Number(dashboard?.prizePoolEth || 0);
}

function syncSimulatorPrizePool() {
  if (!dashboard) {
    return;
  }

  const livePrizePool = Number(dashboard.prizePoolEth || 0);
  if (Number.isFinite(livePrizePool) && livePrizePool > 0) {
    els.simPrizePoolInput.value = String(Number(livePrizePool.toFixed(6)));
    try {
      localStorage.setItem(STORAGE_KEYS.simulatorPrizePool, els.simPrizePoolInput.value);
    } catch {}
  }
  renderDashboard();
}

function renderSimulator(rows) {
  if (!dashboard) {
    return;
  }

  if (!els.simPrizePoolInput.value) {
    const livePrizePool = Number(dashboard.prizePoolEth || 0);
    if (Number.isFinite(livePrizePool) && livePrizePool > 0) {
      els.simPrizePoolInput.value = String(Number(livePrizePool.toFixed(6)));
    }
  }

  const simulatedPrizePoolEth = simulatorPrizePoolEth();
  const simulatedLeaderboardBucketEth = simulatedPrizePoolEth * ((dashboard.leaderboardBucketPct || 70) / 100);
  const liveGrossEth = rows.reduce((total, row) => total + Number(row.grossEth || 0), 0);
  const simulatedGrossEth = rows.reduce((total, row) => (
    total + simulatedLeaderboardBucketEth * (Number(row.leaderboardSharePct || 0) / 100)
  ), 0);
  const deltaEth = simulatedGrossEth - liveGrossEth;

  els.simPrizePoolValue.textContent = moneyLabel(simulatedPrizePoolEth);
  els.simLeaderboardBucketValue.textContent = moneyLabel(simulatedLeaderboardBucketEth);
  els.simDeltaValue.textContent = moneyLabel(deltaEth, { signed: true });
  els.simRowCount.textContent = `${rows.length} rows`;

  els.simTableBody.innerHTML = "";
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.append(cell("No matching bakeries.", "empty-cell"));
    tr.firstChild.colSpan = 7;
    els.simTableBody.append(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const simulatedGross = simulatedLeaderboardBucketEth * (Number(row.leaderboardSharePct || 0) / 100);
    const delta = simulatedGross - Number(row.grossEth || 0);
    const tr = document.createElement("tr");
    tr.className = delta >= 0 ? "profit-row" : "loss-row";
    tr.append(
      cell(`#${row.rank}`, "rank-cell", "Rank"),
      cell(row.chefName || row.chefAddress || "-", "name-cell", "Chef"),
      cell(row.bakeryName || "-", "name-cell", "Bakery"),
      cell(formatShare(row.leaderboardSharePct), "number-cell", "Share"),
      cell(moneyLabel(row.grossEth), "number-cell", "Live Gross"),
      cell(moneyLabel(simulatedGross), "number-cell", "Simulated Gross"),
      cell(moneyLabel(delta, { signed: true }), "number-cell pnl-cell", "Delta")
    );
    fragment.append(tr);
  }
  els.simTableBody.append(fragment);
}

function rowsToCsv(rows) {
  const useUsd = currencyMode === "usd";
  const currencyLabel = useUsd ? "USD" : "ETH";
  const currencyValue = (ethValue) => {
    if (!useUsd) {
      return ethValue;
    }
    const price = currentEthPrice();
    return price > 0 ? ethValue * price : "";
  };
  const header = ["Rank", "Chef", "Bakery", "Cookies", "Share %", `Gross ${currencyLabel}`, `Cost ${currencyLabel}`, `P&L ${currencyLabel}`, "ROI %"];
  const records = rows.map((row) => [
    row.rank,
    row.chefName || row.chefAddress || "",
    row.bakeryName || "",
    row.cookiesBakedDisplay,
    row.leaderboardSharePct,
    currencyValue(row.grossEth),
    currencyValue(row.costEth),
    currencyValue(row.pnlEth),
    row.roi === null ? "" : row.roi
  ]);
  return [header, ...records]
    .map((record) => record.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function downloadCsv() {
  const rows = computedRows();
  const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakery-top100-pnl-season-${dashboard?.seasonId || "current"}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function refreshDashboard() {
  els.refreshButton.disabled = true;
  els.statusText.textContent = "Loading live leaderboard...";
  try {
    const response = await fetch("/api/pnl-top100");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to load Bakery P&L");
    }

    dashboard = payload;
    renderDashboard();
  } catch (error) {
    els.statusText.textContent = error instanceof Error ? error.message : String(error);
    els.tableBody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.append(cell("Unable to load the public Bakery P&L right now.", "empty-cell"));
    tr.firstChild.colSpan = 9;
    els.tableBody.append(tr);
  } finally {
    els.refreshButton.disabled = false;
  }
}

for (const input of [els.searchInput, els.manualCostInput]) {
  input.addEventListener("input", () => {
    try {
      localStorage.setItem(STORAGE_KEYS.manualCost, els.manualCostInput.value);
    } catch {}
    renderDashboard();
  });
}

els.simPrizePoolInput.addEventListener("input", () => {
  try {
    localStorage.setItem(STORAGE_KEYS.simulatorPrizePool, els.simPrizePoolInput.value);
  } catch {}
  renderDashboard();
});

els.syncPrizePoolButton.addEventListener("click", () => {
  syncSimulatorPrizePool();
});

els.dashboardTab.addEventListener("click", () => {
  setActiveView("dashboard");
});

els.simulatorTab.addEventListener("click", () => {
  setActiveView("simulator");
});

els.currencyToggle.addEventListener("click", async () => {
  const nextMode = currencyMode === "usd" ? "eth" : "usd";
  setCurrencyMode(nextMode);
  if (nextMode === "usd" && currentEthPrice() === 0) {
    await refreshEthPrice();
  }
});

els.themeToggle.addEventListener("click", () => {
  setThemeMode(themeMode === "dark" ? "light" : "dark");
});

els.refreshButton.addEventListener("click", () => {
  refreshDashboard();
});

els.csvButton.addEventListener("click", () => {
  downloadCsv();
});

setThemeMode(themeMode, false);
setCurrencyMode(currencyMode, false);
setActiveView(activeView, false);
refreshEthPrice();
refreshDashboard();
