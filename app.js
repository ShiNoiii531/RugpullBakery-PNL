const numberFormatter = new Intl.NumberFormat("en-US");
const COOKIE_RAW_UNITS_PER_COOKIE = 10_000;
const STORAGE_KEYS = {
  activeView: "bakery-public:active-view",
  currencyMode: "bakery-public:currency-mode",
  manualCost: "bakery-public:manual-cost",
  myBakeryQuery: "bakery-public:my-bakery-query",
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
  myBakeryTab: document.getElementById("myBakeryTab"),
  topRugTab: document.getElementById("topRugTab"),
  mostRuggedTab: document.getElementById("mostRuggedTab"),
  simulatorTab: document.getElementById("simulatorTab"),
  dashboardView: document.getElementById("dashboardView"),
  myBakeryView: document.getElementById("myBakeryView"),
  topRugView: document.getElementById("topRugView"),
  mostRuggedView: document.getElementById("mostRuggedView"),
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
  topRuggerValue: document.getElementById("topRuggerValue"),
  topRuggerBakeryValue: document.getElementById("topRuggerBakeryValue"),
  rugLandedValue: document.getElementById("rugLandedValue"),
  rugAttemptsValue: document.getElementById("rugAttemptsValue"),
  rugSuccessValue: document.getElementById("rugSuccessValue"),
  totalRugsValue: document.getElementById("totalRugsValue"),
  totalRugAttemptsValue: document.getElementById("totalRugAttemptsValue"),
  mostRuggedValue: document.getElementById("mostRuggedValue"),
  mostRuggedBakeryValue: document.getElementById("mostRuggedBakeryValue"),
  ruggedAttemptsValue: document.getElementById("ruggedAttemptsValue"),
  ruggedCoverageValue: document.getElementById("ruggedCoverageValue"),
  ruggedSuccessValue: document.getElementById("ruggedSuccessValue"),
  ruggedFailedValue: document.getElementById("ruggedFailedValue"),
  rugReceivedSourceValue: document.getElementById("rugReceivedSourceValue"),
  rugRowCount: document.getElementById("rugRowCount"),
  rugTableBody: document.getElementById("rugTableBody"),
  ruggedRowCount: document.getElementById("ruggedRowCount"),
  ruggedTableBody: document.getElementById("ruggedTableBody"),
  myBakeryInput: document.getElementById("myBakeryInput"),
  myBakeryCard: document.getElementById("myBakeryCard"),
  sharePnlButton: document.getElementById("sharePnlButton"),
  shareStatus: document.getElementById("shareStatus"),
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
let topRugSort = { key: "rugRank", direction: "asc" };
let currentMyBakeryRow = null;

const TOP_RUG_SORT_LABELS = {
  rugRank: "Rug Rank",
  topRank: "Top 100 Rank",
  chef: "Chef",
  bakery: "Bakery",
  successfulRugs: "Successful Rugs",
  attempts: "Attempts",
  success: "Success",
  cookies: "Cookies"
};

try {
  const manualCost = localStorage.getItem(STORAGE_KEYS.manualCost);
  const storedCurrencyMode = localStorage.getItem(STORAGE_KEYS.currencyMode);
  const storedThemeMode = localStorage.getItem(STORAGE_KEYS.themeMode);
  const storedActiveView = localStorage.getItem(STORAGE_KEYS.activeView);
  const storedMyBakeryQuery = localStorage.getItem(STORAGE_KEYS.myBakeryQuery);
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
  if (["dashboard", "my", "rug", "simulator"].includes(storedActiveView)) {
    activeView = storedActiveView;
  }
  if (storedMyBakeryQuery !== null) {
    els.myBakeryInput.value = storedMyBakeryQuery;
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

function shortAddress(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address || "")) {
    return address || "-";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

function formatShortDateTime(value) {
  if (!value) {
    return "unknown time";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
  activeView = ["dashboard", "my", "rug", "simulator"].includes(view) ? view : "dashboard";
  const isDashboard = activeView === "dashboard";
  const isMyBakery = activeView === "my";
  const isRug = activeView === "rug";
  const isRugged = activeView === "rugged";
  const isSimulator = activeView === "simulator";

  els.dashboardView.hidden = !isDashboard;
  els.myBakeryView.hidden = !isMyBakery;
  els.topRugView.hidden = !isRug;
  els.mostRuggedView.hidden = !isRugged;
  els.simulatorView.hidden = !isSimulator;
  els.dashboardTab.setAttribute("aria-pressed", String(isDashboard));
  els.myBakeryTab.setAttribute("aria-pressed", String(isMyBakery));
  els.topRugTab.setAttribute("aria-pressed", String(isRug));
  els.mostRuggedTab.setAttribute("aria-pressed", String(isRugged));
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

function computedAllRows() {
  if (!dashboard) {
    return [];
  }

  const manualCostPerMillion = numericInputValue(els.manualCostInput);

  return (dashboard.rows || [])
    .map((row) => {
      const cookiesBakedRaw = Number(row.cookiesBaked || 0);
      const cookiesBaked = cookiesBakedRaw / COOKIE_RAW_UNITS_PER_COOKIE;
      const cookieBalanceRaw = Number(row.cookieBalance || 0);
      const cookieBalance = cookieBalanceRaw / COOKIE_RAW_UNITS_PER_COOKIE;
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
        cookieBalance: cookieBalanceRaw,
        cookieBalanceDisplay: cookieBalance,
        grossEth,
        costEth,
        pnlEth,
        roi
      };
    });
}

function computedRows() {
  const query = (els.searchInput.value || "").trim().toLowerCase();
  return computedAllRows().filter((row) => {
    if (!query) {
      return true;
    }
    return `${row.chefName} ${row.chefAddress} ${row.bakeryName}`.toLowerCase().includes(query);
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

function abstractPortalProfileUrl(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address || "")) {
    return null;
  }
  return `https://portal.abs.xyz/profile/${encodeURIComponent(address)}`;
}

function chefCell(row, label = "Chef") {
  const td = document.createElement("td");
  td.className = "name-cell chef-cell";
  td.dataset.label = label;

  const portalUrl = abstractPortalProfileUrl(row.chefAddress);
  const wrap = document.createElement(portalUrl ? "a" : "span");
  wrap.className = "player-profile";
  if (portalUrl) {
    wrap.classList.add("player-profile-link");
    wrap.href = portalUrl;
    wrap.target = "_blank";
    wrap.rel = "noopener noreferrer";
    wrap.title = `Open ${row.chefName || row.chefAddress} on Abstract Portal`;
  }

  if (row.profileImageUrl) {
    const img = document.createElement("img");
    img.className = "player-avatar";
    img.src = row.profileImageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => {
      img.remove();
      wrap.classList.add("player-profile-no-avatar");
    }, { once: true });
    wrap.append(img);
  } else {
    wrap.classList.add("player-profile-no-avatar");
  }

  const name = document.createElement("span");
  name.className = "player-name";
  name.textContent = row.chefName || row.chefAddress || "-";
  wrap.append(name);
  td.append(wrap);

  return td;
}

function costSourceLabel(source) {
  if (source === "exact_gas_cache") {
    return "Exact gas cache";
  }
  if (source === "partial_gas_cache") {
    return "Partial gas cache";
  }
  return "RPC estimate";
}

function myBakeryMetric(label, value, className = "") {
  const item = document.createElement("div");
  item.className = `my-bakery-metric${className ? ` ${className}` : ""}`;

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const valueNode = document.createElement("strong");
  valueNode.textContent = value;

  item.append(labelNode, valueNode);
  return item;
}

function findMyBakeryRow(rows) {
  const query = (els.myBakeryInput.value || "").trim().toLowerCase();
  if (!query) {
    return null;
  }

  const normalizedQuery = query.replace(/^@/, "");
  const exact = rows.find((row) => (
    row.chefAddress?.toLowerCase() === normalizedQuery ||
    row.chefName?.toLowerCase() === normalizedQuery ||
    row.bakeryName?.toLowerCase() === normalizedQuery
  ));
  if (exact) {
    return exact;
  }

  return rows.find((row) => (
    `${row.chefName || ""} ${row.chefAddress || ""} ${row.bakeryName || ""}`
      .toLowerCase()
      .includes(normalizedQuery)
  )) || null;
}

function renderMyBakery(rows) {
  const query = (els.myBakeryInput.value || "").trim();
  const row = findMyBakeryRow(rows);
  currentMyBakeryRow = row;
  els.sharePnlButton.disabled = !row;

  els.myBakeryCard.innerHTML = "";
  els.myBakeryCard.className = row
    ? `my-bakery-card ${row.pnlEth >= 0 ? "my-bakery-profit" : "my-bakery-loss"}`
    : "my-bakery-card my-bakery-empty";

  if (!query) {
    const empty = document.createElement("p");
    empty.textContent = "Enter a Top 100 chef, bakery or wallet.";
    els.myBakeryCard.append(empty);
    els.shareStatus.textContent = "";
    return;
  }

  if (!row) {
    const empty = document.createElement("p");
    empty.textContent = "No Top 100 bakery matched this search.";
    els.myBakeryCard.append(empty);
    els.shareStatus.textContent = "";
    return;
  }

  const head = document.createElement("div");
  head.className = "my-bakery-card-head";

  const identity = document.createElement("div");
  identity.className = "my-bakery-identity";
  if (row.profileImageUrl) {
    const avatar = document.createElement("img");
    avatar.className = "my-bakery-avatar";
    avatar.src = row.profileImageUrl;
    avatar.alt = "";
    avatar.loading = "lazy";
    avatar.decoding = "async";
    avatar.referrerPolicy = "no-referrer";
    avatar.addEventListener("error", () => avatar.remove(), { once: true });
    identity.append(avatar);
  }

  const nameWrap = document.createElement("div");
  nameWrap.className = "my-bakery-title";
  const name = document.createElement("strong");
  name.textContent = row.chefName || shortAddress(row.chefAddress);
  const bakery = document.createElement("span");
  bakery.textContent = row.bakeryName || "Bakery";
  nameWrap.append(name, bakery);
  identity.append(nameWrap);

  const rank = document.createElement("div");
  rank.className = "my-bakery-rank";
  rank.textContent = `#${row.rank}`;
  head.append(identity, rank);

  const pnl = document.createElement("div");
  pnl.className = "my-bakery-pnl";
  const pnlLabel = document.createElement("span");
  pnlLabel.textContent = "Projected P&L";
  const pnlValue = document.createElement("strong");
  pnlValue.textContent = moneyLabel(row.pnlEth, { signed: true });
  pnl.append(pnlLabel, pnlValue);

  const metrics = document.createElement("div");
  metrics.className = "my-bakery-metrics";
  metrics.append(
    myBakeryMetric("Cookies", formatCookieCount(row.cookiesBakedDisplay)),
    myBakeryMetric("Remaining", formatCookieCount(row.cookieBalanceDisplay)),
    myBakeryMetric("Reward", moneyLabel(row.grossEth)),
    myBakeryMetric("Gas Cost", moneyLabel(row.costEth)),
    myBakeryMetric("ROI", row.roi === null ? "--" : formatPercent(row.roi)),
    myBakeryMetric("Share", formatShare(row.leaderboardSharePct)),
    myBakeryMetric("Rugs", numberFormatter.format(Number(row.rugLanded || 0))),
    myBakeryMetric("Cost Source", costSourceLabel(row.costSource))
  );

  const footer = document.createElement("p");
  footer.className = "my-bakery-footnote";
  footer.textContent = `Wallet ${shortAddress(row.chefAddress)} - leaderboard rewards only`;

  els.myBakeryCard.append(head, pnl, metrics, footer);
}

function slugify(value) {
  return String(value || "bakery")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "bakery";
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
}

function fitCanvasText(ctx, text, maxWidth, startSize, minSize, weight = 900) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Trebuchet MS, Verdana, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) {
      return size;
    }
    size -= 2;
  } while (size >= minSize);
  return minSize;
}

function drawShareMetric(ctx, label, value, x, y, width) {
  drawRoundRect(ctx, x, y, width, 96, 18);
  ctx.fillStyle = "rgba(255, 250, 242, 0.94)";
  ctx.fill();
  ctx.strokeStyle = "#efc99c";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#7c4329";
  ctx.font = "900 22px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 22, y + 34);
  ctx.fillStyle = "#1e7fa6";
  fitCanvasText(ctx, value, width - 44, 34, 22, 900);
  ctx.fillText(value, x + 22, y + 74);
}

function createPnlShareCanvas(row) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#fff8ee");
  bg.addColorStop(0.55, "#fff1dc");
  bg.addColorStop(1, "#ffe5c0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(185, 111, 66, 0.18)";
  for (let y = 36; y < canvas.height; y += 86) {
    for (let x = 42; x < canvas.width; x += 118) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRoundRect(ctx, 58, 50, 1084, 530, 28);
  ctx.fillStyle = "#fffaf2";
  ctx.fill();
  ctx.strokeStyle = "#e8caa6";
  ctx.lineWidth = 6;
  ctx.stroke();

  drawRoundRect(ctx, 86, 78, 590, 112, 24);
  ctx.fillStyle = "#b96f42";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 48px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText("Rugpull Bakery P&L", 118, 147);

  ctx.fillStyle = "#1e7fa6";
  ctx.font = "900 34px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText(`Top 100 #${row.rank}`, 744, 102);
  ctx.fillStyle = "#493024";
  fitCanvasText(ctx, row.chefName || shortAddress(row.chefAddress), 360, 54, 30, 900);
  ctx.fillText(row.chefName || shortAddress(row.chefAddress), 744, 158);
  ctx.fillStyle = "#7d675a";
  fitCanvasText(ctx, row.bakeryName || "Bakery", 340, 28, 20, 900);
  ctx.fillText(row.bakeryName || "Bakery", 746, 194);

  const pnlColor = Number(row.pnlEth || 0) >= 0 ? "#2d875e" : "#b94b42";
  ctx.fillStyle = pnlColor;
  fitCanvasText(ctx, moneyLabel(row.pnlEth, { signed: true }), 1000, 86, 52, 900);
  ctx.fillText(moneyLabel(row.pnlEth, { signed: true }), 92, 300);
  ctx.fillStyle = "#7c4329";
  ctx.font = "900 28px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText("PROJECTED P&L", 96, 226);

  const metrics = [
    ["Cookies", formatCookieCount(row.cookiesBakedDisplay)],
    ["Remaining", formatCookieCount(row.cookieBalanceDisplay)],
    ["Reward", moneyLabel(row.grossEth)],
    ["Gas Cost", moneyLabel(row.costEth)],
    ["ROI", row.roi === null ? "--" : formatPercent(row.roi)],
    ["Share", formatShare(row.leaderboardSharePct)]
  ];
  metrics.forEach(([label, value], index) => {
    const col = index % 3;
    const rowIndex = Math.floor(index / 3);
    drawShareMetric(ctx, label, value, 92 + col * 338, 334 + rowIndex * 112, 304);
  });

  ctx.fillStyle = "#7d675a";
  ctx.font = "900 22px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText("Projected leaderboard reward - gas cost. Activity rewards not included.", 96, 558);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function shareMyPnlCard() {
  const row = currentMyBakeryRow;
  if (!row) {
    return;
  }

  els.sharePnlButton.disabled = true;
  els.shareStatus.textContent = "Generating share card...";

  try {
    const canvas = createPnlShareCanvas(row);
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      throw new Error("Unable to generate share card");
    }

    const filename = `rugpull-bakery-pnl-${slugify(row.chefName || row.bakeryName || row.chefAddress)}.png`;
    const title = `${row.chefName || "My Bakery"} Rugpull Bakery P&L`;
    if (typeof File !== "undefined" && navigator.canShare && navigator.share) {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text: `${row.chefName || "My Bakery"} projected P&L: ${moneyLabel(row.pnlEth, { signed: true })}`,
          files: [file]
        });
        els.shareStatus.textContent = "Share card ready.";
        return;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    els.shareStatus.textContent = "Share card downloaded.";
  } catch (error) {
    els.shareStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    els.sharePnlButton.disabled = !currentMyBakeryRow;
  }
}

function addMobileDetailsToggle(row, visibleCellCount) {
  const cells = [...row.children];
  cells.forEach((td, index) => {
    if (index >= visibleCellCount) {
      td.classList.add("mobile-detail-cell");
    }
  });

  const td = document.createElement("td");
  td.className = "mobile-toggle-cell";
  const button = document.createElement("button");
  button.className = "mobile-detail-button";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Show player details");
  button.title = "Show player details";
  button.innerHTML = '<span class="mobile-detail-chevron" aria-hidden="true"></span>';
  button.addEventListener("click", () => {
    const expanded = row.classList.toggle("mobile-row-expanded");
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", expanded ? "Hide player details" : "Show player details");
    button.title = expanded ? "Hide player details" : "Show player details";
  });
  td.append(button);
  row.append(td);
}

function renderTable(rows) {
  els.tableBody.innerHTML = "";
  els.rowCount.textContent = `${rows.length} rows`;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.append(cell("No matching bakeries.", "empty-cell"));
    tr.firstChild.colSpan = 10;
    els.tableBody.append(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = row.pnlEth >= 0 ? "profit-row" : "loss-row";
    tr.append(
      cell(`#${row.rank}`, "rank-cell", "Rank"),
      chefCell(row),
      cell(row.bakeryName || "-", "name-cell", "Bakery"),
      cell(formatCookieCount(row.cookiesBakedDisplay), "number-cell", "Cookies"),
      cell(formatCookieCount(row.cookieBalanceDisplay), "number-cell", "Remaining"),
      cell(formatShare(row.leaderboardSharePct), "number-cell", "Share"),
      cell(moneyLabel(row.grossEth), "number-cell", "Gross"),
      cell(moneyLabel(row.costEth), "number-cell", "Cost"),
      cell(moneyLabel(row.pnlEth, { signed: true }), "number-cell pnl-cell", "P&L"),
      cell(row.roi === null ? "--" : formatPercent(row.roi), "number-cell", "ROI")
    );
    addMobileDetailsToggle(tr, 3);
    fragment.append(tr);
  }
  els.tableBody.append(fragment);
}

function rugSuccessRate(row) {
  const attempts = Number(row.rugAttempts || 0);
  const landed = Number(row.rugLanded || 0);
  return attempts > 0 ? (landed / attempts) * 100 : null;
}

function defaultTopRugRows(rows) {
  return [...rows].sort((a, b) => {
    const landedDelta = Number(b.rugLanded || 0) - Number(a.rugLanded || 0);
    if (landedDelta !== 0) {
      return landedDelta;
    }

    const successA = rugSuccessRate(a) || 0;
    const successB = rugSuccessRate(b) || 0;
    if (successB !== successA) {
      return successB - successA;
    }

    return Number(a.rank || 0) - Number(b.rank || 0);
  });
}

function defaultTopRugSortDirection(key) {
  return ["rugRank", "topRank", "chef", "bakery"].includes(key) ? "asc" : "desc";
}

function topRugSortValue(row, key) {
  if (key === "topRank") {
    return Number(row.rank || 0);
  }
  if (key === "chef") {
    return row.chefName || row.chefAddress || "";
  }
  if (key === "bakery") {
    return row.bakeryName || "";
  }
  if (key === "successfulRugs") {
    return Number(row.rugLanded || 0);
  }
  if (key === "attempts") {
    return Number(row.rugAttempts || 0);
  }
  if (key === "success") {
    return rugSuccessRate(row) || 0;
  }
  if (key === "cookies") {
    return Number(row.cookiesBakedDisplay ?? row.cookiesBaked ?? 0);
  }
  return 0;
}

function compareTopRugValues(valueA, valueB) {
  if (typeof valueA === "string" || typeof valueB === "string") {
    return String(valueA || "").localeCompare(String(valueB || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }
  return Number(valueA || 0) - Number(valueB || 0);
}

function topRugRows(rows) {
  const defaultRows = defaultTopRugRows(rows);
  if (topRugSort.key === "rugRank") {
    return topRugSort.direction === "asc" ? defaultRows : [...defaultRows].reverse();
  }

  const defaultRank = new Map(defaultRows.map((row, index) => [row, index]));
  const directionMultiplier = topRugSort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const result = compareTopRugValues(
      topRugSortValue(a, topRugSort.key),
      topRugSortValue(b, topRugSort.key)
    );
    if (result !== 0) {
      return result * directionMultiplier;
    }
    return (defaultRank.get(a) || 0) - (defaultRank.get(b) || 0);
  });
}

function updateTopRugSortButtons() {
  document.querySelectorAll("[data-rug-sort]").forEach((button) => {
    const key = button.dataset.rugSort;
    const active = key === topRugSort.key;
    const th = button.closest("th");
    const label = TOP_RUG_SORT_LABELS[key] || "column";
    const orderLabel = topRugSort.direction === "asc" ? "ascending" : "descending";
    button.classList.toggle("sort-active", active);
    button.dataset.direction = active ? topRugSort.direction : "none";
    button.setAttribute("aria-label", active ? `${label}, sorted ${orderLabel}` : `Sort by ${label}`);
    th?.setAttribute("aria-sort", active ? orderLabel : "none");
  });
}

function mostRuggedRows(rows) {
  return [...rows]
    .filter((row) => Number(row.recentRugAttemptsReceived || 0) > 0 || Number(row.recentRugsReceived || 0) > 0)
    .sort((a, b) => {
      const attemptsDelta = Number(b.recentRugAttemptsReceived || 0) - Number(a.recentRugAttemptsReceived || 0);
      if (attemptsDelta !== 0) {
        return attemptsDelta;
      }

      const receivedDelta = Number(b.recentRugsReceived || 0) - Number(a.recentRugsReceived || 0);
      if (receivedDelta !== 0) {
        return receivedDelta;
      }

      const sentDelta = Number(b.rugLanded || 0) - Number(a.rugLanded || 0);
      if (sentDelta !== 0) {
        return sentDelta;
      }

      return Number(a.rank || 0) - Number(b.rank || 0);
    });
}

function incomingRugSuccessRate(row) {
  const attempts = Number(row.recentRugAttemptsReceived || 0);
  const received = Number(row.recentRugsReceived || 0);
  return attempts > 0 ? (received / attempts) * 100 : null;
}

function rugReceivedSourceText(source, totalSuccessful, totalAttempts) {
  if (source.label === "top100_bakery_activity_feeds") {
    return `Incoming rug attempts against Top 100 bakeries from up to ${numberFormatter.format(source.eventLimitPerBakery || 100)} recent events per bakery. Events scanned: ${numberFormatter.format(source.scannedEvents || 0)} / ${numberFormatter.format(source.maxEvents || 0)}. Successful received: ${numberFormatter.format(totalSuccessful)} / ${numberFormatter.format(totalAttempts)} attempts.`;
  }

  return `Incoming rug attempts against Top 100 bakeries from the latest ${numberFormatter.format(source.eventLimit || 100)} global activity events. Successful received: ${numberFormatter.format(totalSuccessful)} / ${numberFormatter.format(totalAttempts)} attempts.`;
}

function renderTopRug(rows) {
  const sortedRows = topRugRows(rows);
  const rugRankRows = defaultTopRugRows(rows);
  const rugRankMap = new Map(rugRankRows.map((row, index) => [row, index + 1]));
  const ruggedRows = mostRuggedRows(rows);
  const topRow = rugRankRows[0] || null;
  const mostRuggedRow = ruggedRows[0] || null;
  const totalRugs = rows.reduce((total, row) => total + Number(row.rugLanded || 0), 0);
  const totalAttempts = rows.reduce((total, row) => total + Number(row.rugAttempts || 0), 0);
  const totalReceived = rows.reduce((total, row) => total + Number(row.recentRugsReceived || 0), 0);
  const totalReceivedAttempts = rows.reduce((total, row) => total + Number(row.recentRugAttemptsReceived || 0), 0);
  const totalReceivedFailed = rows.reduce((total, row) => total + Number(row.recentRugFailsReceived || 0), 0);
  const topSuccessRate = topRow ? rugSuccessRate(topRow) : null;

  els.topRuggerValue.textContent = topRow ? (topRow.chefName || topRow.chefAddress || "-") : "--";
  els.topRuggerBakeryValue.textContent = topRow ? `${topRow.bakeryName || "-"} · Top 100 #${topRow.rank}` : "Waiting";
  els.rugLandedValue.textContent = topRow ? numberFormatter.format(Number(topRow.rugLanded || 0)) : "--";
  els.rugAttemptsValue.textContent = topRow ? numberFormatter.format(Number(topRow.rugAttempts || 0)) : "--";
  els.rugSuccessValue.textContent = topSuccessRate === null ? "Success rate --" : `Success rate ${formatPercent(topSuccessRate)}`;
  els.totalRugsValue.textContent = numberFormatter.format(totalRugs);
  els.totalRugAttemptsValue.textContent = `${numberFormatter.format(totalAttempts)} attempts`;
  els.mostRuggedValue.textContent = mostRuggedRow ? numberFormatter.format(Number(mostRuggedRow.recentRugAttemptsReceived || 0)) : "--";
  els.mostRuggedBakeryValue.textContent = mostRuggedRow
    ? `${mostRuggedRow.bakeryName || "-"} · ${numberFormatter.format(Number(mostRuggedRow.recentRugsReceived || 0))} landed`
    : "Incoming rugs received";
  els.ruggedAttemptsValue.textContent = numberFormatter.format(totalReceivedAttempts);
  els.ruggedCoverageValue.textContent = dashboard.rugReceivedSource?.scannedEvents
    ? `${numberFormatter.format(dashboard.rugReceivedSource.scannedEvents)} events scanned`
    : "Scanning Top 100 bakeries";
  els.ruggedSuccessValue.textContent = numberFormatter.format(totalReceived);
  els.ruggedFailedValue.textContent = numberFormatter.format(totalReceivedFailed);
  const rugReceivedSource = dashboard.rugReceivedSource || {};
  els.rugReceivedSourceValue.textContent = rugReceivedSourceText(rugReceivedSource, totalReceived, totalReceivedAttempts);
  els.rugRowCount.textContent = `${sortedRows.length} rows`;
  els.ruggedRowCount.textContent = `${ruggedRows.length} active rows`;
  updateTopRugSortButtons();

  els.rugTableBody.innerHTML = "";
  els.ruggedTableBody.innerHTML = "";
  if (sortedRows.length === 0) {
    const tr = document.createElement("tr");
    tr.append(cell("No matching bakeries.", "empty-cell"));
    tr.firstChild.colSpan = 8;
    els.rugTableBody.append(tr);

    const ruggedTr = document.createElement("tr");
    ruggedTr.append(cell("No matching bakeries.", "empty-cell"));
    ruggedTr.firstChild.colSpan = 10;
    els.ruggedTableBody.append(ruggedTr);
    return;
  }

  const fragment = document.createDocumentFragment();
  sortedRows.forEach((row, index) => {
    const successRate = rugSuccessRate(row);
    const rugRank = rugRankMap.get(row) || index + 1;
    const tr = document.createElement("tr");
    tr.append(
      cell(`#${rugRank}`, "rank-cell", "Rug Rank"),
      cell(`#${row.rank}`, "rank-cell", "Top 100 Rank"),
      chefCell(row),
      cell(row.bakeryName || "-", "name-cell", "Bakery"),
      cell(numberFormatter.format(Number(row.rugLanded || 0)), "number-cell pnl-cell", "Successful Rugs"),
      cell(numberFormatter.format(Number(row.rugAttempts || 0)), "number-cell", "Attempts"),
      cell(successRate === null ? "--" : formatPercent(successRate), "number-cell", "Success"),
      cell(formatCookieCount(row.cookiesBakedDisplay), "number-cell", "Cookies")
    );
    addMobileDetailsToggle(tr, 4);
    fragment.append(tr);
  });
  els.rugTableBody.append(fragment);

  if (ruggedRows.length === 0) {
    const ruggedTr = document.createElement("tr");
    ruggedTr.append(cell("No incoming rug attempts found for the current Top 100 window.", "empty-cell"));
    ruggedTr.firstChild.colSpan = 10;
    els.ruggedTableBody.append(ruggedTr);
    return;
  }

  const ruggedFragment = document.createDocumentFragment();
  ruggedRows.forEach((row, index) => {
    const receivedSuccessRate = incomingRugSuccessRate(row);
    const tr = document.createElement("tr");
    tr.append(
      cell(`#${index + 1}`, "rank-cell", "Rugged Rank"),
      cell(`#${row.rank}`, "rank-cell", "Top 100 Rank"),
      chefCell(row),
      cell(row.bakeryName || "-", "name-cell", "Bakery"),
      cell(numberFormatter.format(Number(row.recentRugAttemptsReceived || 0)), "number-cell pnl-cell", "Incoming Attempts"),
      cell(numberFormatter.format(Number(row.recentRugsReceived || 0)), "number-cell", "Successful Received"),
      cell(numberFormatter.format(Number(row.recentRugFailsReceived || 0)), "number-cell", "Failed / Blocked"),
      cell(receivedSuccessRate === null ? "--" : formatPercent(receivedSuccessRate), "number-cell", "Received Success"),
      cell(numberFormatter.format(Number(row.rugLanded || 0)), "number-cell", "Rugs Sent"),
      cell(formatCookieCount(row.cookiesBakedDisplay), "number-cell", "Cookies")
    );
    addMobileDetailsToggle(tr, 4);
    ruggedFragment.append(tr);
  });
  els.ruggedTableBody.append(ruggedFragment);
}

function renderDashboard() {
  if (!dashboard) {
    return;
  }

  const rows = computedRows();
  const myRows = computedAllRows();
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
  } else if ((dashboard.rows || []).some((row) => row.costSource === "exact_gas_cache" || row.costSource === "partial_gas_cache")) {
    const exactRows = (dashboard.rows || []).filter((row) => row.costSource === "exact_gas_cache").length;
    const partialRows = (dashboard.rows || []).filter((row) => row.costSource === "partial_gas_cache").length;
    els.costSourceValue.textContent = partialRows > 0
      ? `Gas cache ${exactRows} exact / ${partialRows} partial · ${formatShortDateTime(dashboard.costCache?.updatedAt)}`
      : `Exact gas cache ${exactRows}/${(dashboard.rows || []).length} · ${formatShortDateTime(dashboard.costCache?.updatedAt)}`;
  } else if (dashboard.costCache?.status === "partial") {
    els.costSourceValue.textContent =
      `Exact gas cache syncing ${dashboard.costCache.completeChefCount || 0}/${dashboard.costCache.top100AddressCount || 100} · estimate fallback`;
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
  renderMyBakery(myRows);
  renderTopRug(rows);
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
      chefCell(row),
      cell(row.bakeryName || "-", "name-cell", "Bakery"),
      cell(formatShare(row.leaderboardSharePct), "number-cell", "Share"),
      cell(moneyLabel(row.grossEth), "number-cell", "Live Gross"),
      cell(moneyLabel(simulatedGross), "number-cell", "Simulated Gross"),
      cell(moneyLabel(delta, { signed: true }), "number-cell pnl-cell", "Delta")
    );
    addMobileDetailsToggle(tr, 3);
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
  const header = ["Rank", "Chef", "Bakery", "Cookies", "Remaining Cookies", "Share %", `Gross ${currencyLabel}`, `Cost ${currencyLabel}`, `P&L ${currencyLabel}`, "ROI %"];
  const records = rows.map((row) => [
    row.rank,
    row.chefName || row.chefAddress || "",
    row.bakeryName || "",
    row.cookiesBakedDisplay,
    row.cookieBalanceDisplay,
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
    els.rugTableBody.innerHTML = "";
    els.ruggedTableBody.innerHTML = "";
    els.myBakeryCard.innerHTML = "";
    els.shareStatus.textContent = "";
    els.sharePnlButton.disabled = true;
    els.simTableBody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.append(cell("Unable to load the public Bakery P&L right now.", "empty-cell"));
    tr.firstChild.colSpan = 10;
    els.tableBody.append(tr);
    const rugTr = document.createElement("tr");
    rugTr.append(cell("Unable to load the public Bakery rug stats right now.", "empty-cell"));
    rugTr.firstChild.colSpan = 8;
    els.rugTableBody.append(rugTr);
    const ruggedTr = document.createElement("tr");
    ruggedTr.append(cell("Unable to load the public Bakery received rug stats right now.", "empty-cell"));
    ruggedTr.firstChild.colSpan = 10;
    els.ruggedTableBody.append(ruggedTr);
    const simTr = document.createElement("tr");
    simTr.append(cell("Unable to load the simulator data right now.", "empty-cell"));
    simTr.firstChild.colSpan = 7;
    els.simTableBody.append(simTr);
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

els.myBakeryInput.addEventListener("input", () => {
  try {
    localStorage.setItem(STORAGE_KEYS.myBakeryQuery, els.myBakeryInput.value);
  } catch {}
  if (dashboard) {
    renderMyBakery(computedAllRows());
  }
});

els.dashboardTab.addEventListener("click", () => {
  setActiveView("dashboard");
});

els.myBakeryTab.addEventListener("click", () => {
  setActiveView("my");
});

els.topRugTab.addEventListener("click", () => {
  setActiveView("rug");
});

els.mostRuggedTab.addEventListener("click", () => {
  setActiveView("rugged");
});

els.simulatorTab.addEventListener("click", () => {
  setActiveView("simulator");
});

document.querySelectorAll("[data-rug-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.rugSort;
    if (!key) {
      return;
    }
    const direction = topRugSort.key === key
      ? (topRugSort.direction === "asc" ? "desc" : "asc")
      : defaultTopRugSortDirection(key);
    topRugSort = { key, direction };
    renderDashboard();
  });
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

els.sharePnlButton.addEventListener("click", () => {
  shareMyPnlCard();
});

setThemeMode(themeMode, false);
setCurrencyMode(currencyMode, false);
setActiveView(activeView, false);
refreshEthPrice();
refreshDashboard();
