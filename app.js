const numberFormatter = new Intl.NumberFormat("en-US");
const COOKIE_RAW_UNITS_PER_COOKIE = 10_000;
const STORAGE_KEYS = {
  activeView: "bakery-public:active-view",
  currencyMode: "bakery-public:currency-mode",
  manualCost: "bakery-public:manual-cost",
  pnlCardBackground: "bakery-public:pnl-card-background",
  myBakeryQuery: "bakery-public:my-bakery-query",
  simulatorPrizePool: "bakery-public:simulator-prize-pool",
  themeMode: "bakery-public:theme-mode",
  selectedSeasonId: "bakery-public:selected-season-id",
  selectedLeaderboardKey: "bakery-public:selected-leaderboard-key"
};

const els = {
  statusText: document.getElementById("statusText"),
  sourceLink: document.getElementById("sourceLink"),
  docsLink: document.getElementById("docsLink"),
  seasonSelect: document.getElementById("seasonSelect"),
  leaderboardSelect: document.getElementById("leaderboardSelect"),
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
  topFailTab: document.getElementById("topFailTab"),
  hallPainTab: document.getElementById("hallPainTab"),
  mostRuggedTab: document.getElementById("mostRuggedTab"),
  simulatorTab: document.getElementById("simulatorTab"),
  dashboardView: document.getElementById("dashboardView"),
  myBakeryView: document.getElementById("myBakeryView"),
  topRugView: document.getElementById("topRugView"),
  topFailView: document.getElementById("topFailView"),
  hallPainView: document.getElementById("hallPainView"),
  mostRuggedView: document.getElementById("mostRuggedView"),
  simulatorView: document.getElementById("simulatorView"),
  seasonValue: document.getElementById("seasonValue"),
  updatedValue: document.getElementById("updatedValue"),
  prizePoolValue: document.getElementById("prizePoolValue"),
  payoutSplitValue: document.getElementById("payoutSplitValue"),
  grossLabel: document.getElementById("grossLabel"),
  grossValue: document.getElementById("grossValue"),
  grossValueNote: document.getElementById("grossValueNote"),
  costLabel: document.getElementById("costLabel"),
  costValue: document.getElementById("costValue"),
  costSourceValue: document.getElementById("costSourceValue"),
  pnlLabel: document.getElementById("pnlLabel"),
  pnlValue: document.getElementById("pnlValue"),
  roiValue: document.getElementById("roiValue"),
  cookiesValue: document.getElementById("cookiesValue"),
  cookiesNote: document.getElementById("cookiesNote"),
  tableTitle: document.getElementById("tableTitle"),
  tableNote: document.getElementById("tableNote"),
  rowCount: document.getElementById("rowCount"),
  tableBody: document.getElementById("tableBody"),
  topRuggerValue: document.getElementById("topRuggerValue"),
  topRuggerBakeryValue: document.getElementById("topRuggerBakeryValue"),
  rugLandedValue: document.getElementById("rugLandedValue"),
  rugLandedNote: document.getElementById("rugLandedNote"),
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
  topFailRowCount: document.getElementById("topFailRowCount"),
  topFailPodium: document.getElementById("topFailPodium"),
  topFailTableCount: document.getElementById("topFailTableCount"),
  topFailTableBody: document.getElementById("topFailTableBody"),
  hallPainRowCount: document.getElementById("hallPainRowCount"),
  hallPainPodium: document.getElementById("hallPainPodium"),
  myBakerySearchLabel: document.getElementById("myBakerySearchLabel"),
  totalRugsLabel: document.getElementById("totalRugsLabel"),
  topRugRankHeader: document.getElementById("topRugRankHeader"),
  ruggedRankHeader: document.getElementById("ruggedRankHeader"),
  pnlCardBackgroundPicker: document.getElementById("pnlCardBackgroundPicker"),
  myBakeryInput: document.getElementById("myBakeryInput"),
  myBakeryCard: document.getElementById("myBakeryCard"),
  sharePnlButton: document.getElementById("sharePnlButton"),
  shareStatus: document.getElementById("shareStatus"),
  simPrizePoolInput: document.getElementById("simPrizePoolInput"),
  syncPrizePoolButton: document.getElementById("syncPrizePoolButton"),
  simPrizePoolValue: document.getElementById("simPrizePoolValue"),
  simBucketLabel: document.getElementById("simBucketLabel"),
  simBucketNote: document.getElementById("simBucketNote"),
  simLeaderboardBucketValue: document.getElementById("simLeaderboardBucketValue"),
  simDeltaLabel: document.getElementById("simDeltaLabel"),
  simDeltaValue: document.getElementById("simDeltaValue"),
  simDeltaNote: document.getElementById("simDeltaNote"),
  simLiveGrossHeader: document.getElementById("simLiveGrossHeader"),
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
let pnlCardBackground = "bg1";
let selectedSeasonId = null;
let selectedLeaderboardKey = "standard";

const PNL_CARD_BACKGROUNDS = [
  { id: "bg1", label: "Megaphone Chef", imageUrl: "/assets/pnl-card-bg-1.png" },
  { id: "bg2", label: "Baking Chef", imageUrl: "/assets/pnl-card-bg-2.png" },
  { id: "bg3", label: "Cookie Tasting", imageUrl: "/assets/pnl-card-bg-3.png" },
  { id: "bg4", label: "Kitchen Panic", imageUrl: "/assets/pnl-card-bg-4.png" },
  { id: "bg5", label: "Bad Cookie", imageUrl: "/assets/pnl-card-bg-5.png" }
];

const TOP_RUG_SORT_LABELS = {
  rugRank: "Rug Rank",
  topRank: "Leaderboard Rank",
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
  const storedPnlCardBackground = localStorage.getItem(STORAGE_KEYS.pnlCardBackground);
  const storedMyBakeryQuery = localStorage.getItem(STORAGE_KEYS.myBakeryQuery);
  const storedSimulatorPrizePool = localStorage.getItem(STORAGE_KEYS.simulatorPrizePool);
  const storedSelectedSeasonId = localStorage.getItem(STORAGE_KEYS.selectedSeasonId);
  const storedSelectedLeaderboardKey = localStorage.getItem(STORAGE_KEYS.selectedLeaderboardKey);
  if (manualCost !== null) {
    els.manualCostInput.value = manualCost;
  }
  if (storedCurrencyMode === "usd") {
    currencyMode = "usd";
  }
  if (storedThemeMode === "dark") {
    themeMode = "dark";
  }
  if (PNL_CARD_BACKGROUNDS.some((background) => background.id === storedPnlCardBackground)) {
    pnlCardBackground = storedPnlCardBackground;
  }
  if (["dashboard", "my", "rug", "fail", "pain", "rugged", "simulator"].includes(storedActiveView)) {
    activeView = storedActiveView;
  }
  if (storedMyBakeryQuery !== null) {
    els.myBakeryInput.value = storedMyBakeryQuery;
  }
  if (storedSimulatorPrizePool !== null) {
    els.simPrizePoolInput.value = storedSimulatorPrizePool;
  }
  if (storedSelectedSeasonId !== null) {
    const numericSeasonId = Number(storedSelectedSeasonId);
    if (Number.isFinite(numericSeasonId) && numericSeasonId > 0) {
      selectedSeasonId = numericSeasonId;
    }
  }
  if (["standard", "open", "overall"].includes(storedSelectedLeaderboardKey || "")) {
    selectedLeaderboardKey = storedSelectedLeaderboardKey;
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
  activeView = ["dashboard", "my", "rug", "fail", "pain", "rugged", "simulator"].includes(view) ? view : "dashboard";
  const isDashboard = activeView === "dashboard";
  const isMyBakery = activeView === "my";
  const isRug = activeView === "rug";
  const isFail = activeView === "fail";
  const isPain = activeView === "pain";
  const isRugged = activeView === "rugged";
  const isSimulator = activeView === "simulator";

  els.dashboardView.hidden = !isDashboard;
  els.myBakeryView.hidden = !isMyBakery;
  els.topRugView.hidden = !isRug;
  els.topFailView.hidden = !isFail;
  els.hallPainView.hidden = !isPain;
  els.mostRuggedView.hidden = !isRugged;
  els.simulatorView.hidden = !isSimulator;
  els.dashboardTab.setAttribute("aria-pressed", String(isDashboard));
  els.myBakeryTab.setAttribute("aria-pressed", String(isMyBakery));
  els.topRugTab.setAttribute("aria-pressed", String(isRug));
  els.topFailTab.setAttribute("aria-pressed", String(isFail));
  els.hallPainTab.setAttribute("aria-pressed", String(isPain));
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
        const scoreRaw = Number(row.score || 0);
        const scoreDisplay = scoreRaw / COOKIE_RAW_UNITS_PER_COOKIE;
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
          score: scoreRaw,
          scoreDisplay,
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

function seasonLabel() {
  const displayId = dashboard?.seasonDisplayId ?? null;
  const fallbackId = dashboard?.seasonId ?? null;
  return `Season ${displayId ?? fallbackId ?? "--"}`;
}

function leaderboardLabel() {
  return dashboard?.leaderboardTitle || dashboard?.globalLeaderboardLabel || "Leaderboard";
}

function currentBoardLabel() {
  return dashboard?.leaderboardName || "Leaderboard";
}

function seasonOptionLabel(option) {
  if (!option) {
    return "Season --";
  }
  return option.label || `Season ${option.displayId || option.id || "--"}`;
}

function syncSeasonSelector() {
  if (!els.seasonSelect) {
    return;
  }

  const availableSeasons = Array.isArray(dashboard?.availableSeasons) ? dashboard.availableSeasons : [];
  els.seasonSelect.innerHTML = "";

  if (availableSeasons.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Season --";
    els.seasonSelect.append(option);
    els.seasonSelect.disabled = true;
    return;
  }

  const effectiveSelectedSeasonId = Number(dashboard?.selectedSeasonId || selectedSeasonId || availableSeasons[0].id);
  availableSeasons.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = String(optionData.id);
    option.textContent = seasonOptionLabel(optionData);
    option.selected = Number(optionData.id) === effectiveSelectedSeasonId;
    els.seasonSelect.append(option);
  });
  els.seasonSelect.disabled = availableSeasons.length <= 1;
}

function syncLeaderboardSelector() {
  if (!els.leaderboardSelect) {
    return;
  }

  const availableLeaderboards = Array.isArray(dashboard?.availableLeaderboards) ? dashboard.availableLeaderboards : [];
  els.leaderboardSelect.innerHTML = "";

  if (availableLeaderboards.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Leaderboard --";
    els.leaderboardSelect.append(option);
    els.leaderboardSelect.disabled = true;
    return;
  }

  const effectiveKey = dashboard?.selectedLeaderboardKey || dashboard?.leaderboardKey || selectedLeaderboardKey || availableLeaderboards[0].key;
  availableLeaderboards.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = String(optionData.key);
    option.textContent = optionData.label || optionData.key;
    option.selected = optionData.key === effectiveKey;
    els.leaderboardSelect.append(option);
  });
  els.leaderboardSelect.disabled = availableLeaderboards.length <= 1 || dashboard?.isHistorical === true;
}

function selectedPnlCardBackground() {
  return PNL_CARD_BACKGROUNDS.find((background) => background.id === pnlCardBackground) || PNL_CARD_BACKGROUNDS[0];
}

function applyPnlCardBackground() {
  const background = selectedPnlCardBackground();
  els.myBakeryCard.style.setProperty("--pnl-card-bg-image", `url("${background.imageUrl}")`);
}

function renderPnlCardBackgroundPicker() {
  els.pnlCardBackgroundPicker.innerHTML = "";
  const fragment = document.createDocumentFragment();

  PNL_CARD_BACKGROUNDS.forEach((background, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pnl-card-background-button";
    button.dataset.backgroundId = background.id;
    button.setAttribute("aria-pressed", String(background.id === pnlCardBackground));
    button.setAttribute("aria-label", `Use ${background.label} background`);
    button.title = background.label;

    const image = document.createElement("img");
    image.className = "pnl-card-background-thumb";
    image.src = background.imageUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";

    const badge = document.createElement("span");
    badge.className = "pnl-card-background-badge";
    badge.textContent = String(index + 1);

    button.append(image, badge);
    button.addEventListener("click", () => {
      setPnlCardBackground(background.id);
    });
    fragment.append(button);
  });

  els.pnlCardBackgroundPicker.append(fragment);
}

function setPnlCardBackground(nextBackground, shouldPersist = true) {
  if (!PNL_CARD_BACKGROUNDS.some((background) => background.id === nextBackground)) {
    return;
  }

  pnlCardBackground = nextBackground;
  renderPnlCardBackgroundPicker();
  applyPnlCardBackground();
  if (dashboard) {
    renderMyBakery(computedAllRows());
  }

  if (shouldPersist) {
    try {
      localStorage.setItem(STORAGE_KEYS.pnlCardBackground, pnlCardBackground);
    } catch {}
  }
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

function rankMovementBadge(row) {
  const movement = row?.rankMovement || {};
  const direction = ["up", "down", "same"].includes(movement.direction) ? movement.direction : "same";
  const delta = Number(movement.delta || 0);
  const previousRank = Number(movement.previousRank || 0);
  const absDelta = Math.abs(delta);
  const badge = document.createElement("span");
  badge.className = `rank-move rank-move-${direction}`;

  if (direction === "up") {
    badge.textContent = "↑";
    badge.title = previousRank
      ? `Up ${absDelta} rank${absDelta > 1 ? "s" : ""} since last snapshot (was #${previousRank})`
      : "Rank up since last snapshot";
  } else if (direction === "down") {
    badge.textContent = "↓";
    badge.title = previousRank
      ? `Down ${absDelta} rank${absDelta > 1 ? "s" : ""} since last snapshot (was #${previousRank})`
      : "Rank down since last snapshot";
  } else {
    badge.textContent = "=";
    badge.title = previousRank ? `No rank change since last snapshot (#${previousRank})` : "No previous rank snapshot yet";
  }

  return badge;
}

function rankCell(row, label = "Rank") {
  const td = document.createElement("td");
  td.className = "rank-cell";
  td.dataset.label = label;

  const wrap = document.createElement("span");
  wrap.className = "rank-cell-inner";

  const value = document.createElement("span");
  value.textContent = `#${row.rank}`;
  wrap.append(value, rankMovementBadge(row));
  td.append(wrap);

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

function mobileSummaryCell(row) {
  const td = document.createElement("td");
  td.className = "mobile-summary-cell";
  td.dataset.label = "Player";

  const portalUrl = abstractPortalProfileUrl(row.chefAddress);
  const profile = document.createElement(portalUrl ? "a" : "span");
  profile.className = "mobile-summary-profile";
  if (portalUrl) {
    profile.href = portalUrl;
    profile.target = "_blank";
    profile.rel = "noopener noreferrer";
    profile.title = `Open ${row.chefName || row.chefAddress} on Abstract Portal`;
  }

  if (row.profileImageUrl) {
    const img = document.createElement("img");
    img.className = "mobile-summary-avatar";
    img.src = row.profileImageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => img.remove(), { once: true });
    profile.append(img);
  } else {
    profile.classList.add("mobile-summary-profile-no-avatar");
  }

  const text = document.createElement("span");
  text.className = "mobile-summary-title";

  const name = document.createElement("strong");
  name.textContent = row.chefName || shortAddress(row.chefAddress);

  const bakery = document.createElement("span");
  bakery.textContent = row.bakeryName || "Bakery";

  text.append(name, bakery);
  profile.append(text);

  const rank = document.createElement("span");
  rank.className = "mobile-summary-rank";
  rank.append(`#${row.rank}`, rankMovementBadge(row));

  const stats = document.createElement("div");
  stats.className = "mobile-summary-stats";
  [
    ["P&L", moneyLabel(row.pnlEth, { signed: true }), row.pnlEth >= 0 ? "positive" : "negative"],
    ["Score", scoreLabel(row), ""],
    ["Remaining", formatCookieCount(row.cookieBalanceDisplay), ""]
  ].forEach(([label, value, tone]) => {
    const item = document.createElement("span");
    item.className = tone ? `mobile-summary-stat ${tone}` : "mobile-summary-stat";
    const itemLabel = document.createElement("small");
    itemLabel.textContent = label;
    const itemValue = document.createElement("strong");
    itemValue.textContent = value;
    item.append(itemLabel, itemValue);
    stats.append(item);
  });

  td.append(profile, rank, stats);
  return td;
}

function costSourceLabel(source) {
  if (source === "historical_exact_gas") {
    return "Historical exact gas";
  }
  if (source === "exact_gas_cache") {
    return "Exact gas cache";
  }
  if (source === "partial_gas_cache") {
    return "Partial gas cache";
  }
  if (source === "tx_usd_rate_own_ratio") {
    return "TX estimate (own ratio)";
  }
  if (source === "tx_usd_rate_global_ratio") {
    return "TX estimate (global ratio)";
  }
  return "RPC estimate";
}

function scoreLabel(row) {
  return Number(row?.score || 0) > 0 ? formatCookieCount(row.scoreDisplay) : "--";
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
  applyPnlCardBackground();

  els.myBakeryCard.innerHTML = "";
  els.myBakeryCard.className = row
    ? `my-bakery-card ${row.pnlEth >= 0 ? "my-bakery-profit" : "my-bakery-loss"}`
    : "my-bakery-card my-bakery-empty";

  if (!query) {
    const empty = document.createElement("p");
    empty.textContent = `Enter a ${leaderboardLabel().toLowerCase()} chef, bakery or wallet.`;
    els.myBakeryCard.append(empty);
    els.shareStatus.textContent = "";
    return;
  }

  if (!row) {
    const empty = document.createElement("p");
    empty.textContent = `No ${leaderboardLabel().toLowerCase()} bakery matched this search.`;
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
  rank.append(`#${row.rank}`, rankMovementBadge(row));
  head.append(identity, rank);

  const body = document.createElement("div");
  body.className = "my-bakery-body";

  const hero = document.createElement("div");
  hero.className = "my-bakery-hero";

  const details = document.createElement("div");
  details.className = "my-bakery-details";

  const pnl = document.createElement("div");
  pnl.className = "my-bakery-pnl";
  const pnlLabel = document.createElement("span");
  pnlLabel.textContent = dashboard?.isHistorical ? "Final P&L" : "Projected P&L";
  const pnlValue = document.createElement("strong");
  pnlValue.textContent = moneyLabel(row.pnlEth, { signed: true });
  pnl.append(pnlLabel, pnlValue);

  const metrics = document.createElement("div");
  metrics.className = "my-bakery-metrics";
  metrics.append(
    myBakeryMetric("Cookies", formatCookieCount(row.cookiesBakedDisplay), "my-bakery-metric-primary"),
    myBakeryMetric("Remaining", formatCookieCount(row.cookieBalanceDisplay), "my-bakery-metric-primary"),
    myBakeryMetric("Reward", moneyLabel(row.grossEth)),
    myBakeryMetric("Gas Cost", moneyLabel(row.costEth)),
    myBakeryMetric("ROI", row.roi === null ? "--" : formatPercent(row.roi)),
    myBakeryMetric("Share", formatShare(row.leaderboardSharePct)),
    myBakeryMetric("Rugs", numberFormatter.format(Number(row.rugLanded || 0))),
    myBakeryMetric("Cost Source", costSourceLabel(row.costSource), "my-bakery-metric-source")
  );

  const footer = document.createElement("p");
  footer.className = "my-bakery-footnote";
  footer.textContent = dashboard?.isHistorical
    ? dashboard?.costModel?.kind === "tx_usd_rate"
      ? `Wallet ${shortAddress(row.chefAddress)} - final on-chain reward minus estimated tx fees`
      : `Wallet ${shortAddress(row.chefAddress)} - final on-chain reward minus gas cost`
    : `Wallet ${shortAddress(row.chefAddress)} - leaderboard rewards only`;

  details.append(pnl, metrics, footer);
  body.append(hero, details);
  els.myBakeryCard.append(head, body);
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
  drawRoundRect(ctx, x, y, width, 82, 14);
  ctx.fillStyle = "rgba(51, 31, 23, 0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(195, 129, 72, 0.44)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#d8ad70";
  ctx.font = "900 12px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 14, y + 24);
  ctx.fillStyle = "#73d8ff";
  fitCanvasText(ctx, value, width - 28, 26, 16, 900);
  ctx.fillText(value, x + 14, y + 58);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    image.decoding = "async";
    image.src = src;
  });
}

function drawImageCover(ctx, image, x, y, width, height, focusX = 0.5, focusY = 0.5) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const overflowX = Math.max(0, drawWidth - width);
  const overflowY = Math.max(0, drawHeight - height);
  const offsetX = x - overflowX * Math.min(Math.max(focusX, 0), 1);
  const offsetY = y - overflowY * Math.min(Math.max(focusY, 0), 1);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawImageContain(ctx, image, x, y, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

async function createPnlShareCanvas(row) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  const background = selectedPnlCardBackground();
  const page = ctx.createLinearGradient(0, 0, 0, canvas.height);
  page.addColorStop(0, "#1b120f");
  page.addColorStop(1, "#120b09");
  ctx.fillStyle = page;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRoundRect(ctx, 34, 34, 1132, 562, 24);
  ctx.fillStyle = "#2b1b14";
  ctx.fill();
  ctx.strokeStyle = "#6b432d";
  ctx.lineWidth = 3;
  ctx.stroke();

  if (row.profileImageUrl) {
    try {
      const avatar = await loadImage(row.profileImageUrl);
      ctx.save();
      drawRoundRect(ctx, 54, 52, 36, 36, 18);
      ctx.clip();
      ctx.drawImage(avatar, 54, 52, 36, 36);
      ctx.restore();
      ctx.strokeStyle = "#8d5a39";
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 54, 52, 36, 36, 18);
      ctx.stroke();
    } catch {}
  }

  ctx.fillStyle = "#f7e7d7";
  fitCanvasText(ctx, row.chefName || shortAddress(row.chefAddress), 250, 34, 24, 900);
  ctx.fillText(row.chefName || shortAddress(row.chefAddress), 106, 75);
  ctx.fillStyle = "#b99b85";
  ctx.font = "900 15px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText(row.bakeryName || "Bakery", 106, 96);

  drawRoundRect(ctx, 1060, 46, 70, 42, 10);
  ctx.fillStyle = "#35a8d6";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 24px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText(`#${row.rank}`, 1074, 74);

  const movement = row?.rankMovement?.direction || "same";
  ctx.beginPath();
  ctx.arc(1110, 67, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 12px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText(movement === "up" ? "↑" : movement === "down" ? "↓" : "=", 1106, 71);

  ctx.save();
  drawRoundRect(ctx, 54, 110, 520, 408, 12);
  ctx.clip();
  try {
    const heroImage = await loadImage(background.imageUrl);
    drawImageContain(ctx, heroImage, 54, 110, 520, 408);
  } catch {
    ctx.fillStyle = "#603827";
    ctx.fillRect(54, 110, 520, 408);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(195, 129, 72, 0.48)";
  ctx.lineWidth = 2;
  drawRoundRect(ctx, 54, 110, 520, 408, 12);
  ctx.stroke();

  drawRoundRect(ctx, 590, 110, 542, 104, 12);
  ctx.fillStyle = "rgba(51, 31, 23, 0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(195, 129, 72, 0.44)";
  ctx.stroke();

  ctx.fillStyle = "#d8ad70";
  ctx.font = "900 12px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText("PROJECTED P&L", 610, 139);

  const pnlColor = Number(row.pnlEth || 0) >= 0 ? "#2d875e" : "#b94b42";
  ctx.fillStyle = Number(row.pnlEth || 0) >= 0 ? "#7fe2a7" : "#ff8687";
  fitCanvasText(ctx, moneyLabel(row.pnlEth, { signed: true }), 500, 60, 36, 900);
  ctx.fillText(moneyLabel(row.pnlEth, { signed: true }), 610, 190);

  const metrics = [
    ["Cookies", formatCookieCount(row.cookiesBakedDisplay)],
    ["Remaining", formatCookieCount(row.cookieBalanceDisplay)],
    ["Reward", moneyLabel(row.grossEth)],
    ["Gas Cost", moneyLabel(row.costEth)],
    ["ROI", row.roi === null ? "--" : formatPercent(row.roi)],
    ["Share", formatShare(row.leaderboardSharePct)]
  ];
  metrics.forEach(([label, value], index) => {
    const col = index % 4;
    const rowIndex = Math.floor(index / 4);
    drawShareMetric(ctx, label, value, 590 + col * 136, 230 + rowIndex * 90, 128);
  });

  drawRoundRect(ctx, 590, 500, 542, 18, 9);
  ctx.fillStyle = "rgba(195, 129, 72, 0.12)";
  ctx.fill();
  ctx.fillStyle = "#b99b85";
  ctx.font = "900 16px Trebuchet MS, Verdana, sans-serif";
  ctx.fillText(`Wallet ${shortAddress(row.chefAddress)} - leaderboard rewards only`, 610, 514);
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
    const canvas = await createPnlShareCanvas(row);
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      throw new Error("Unable to generate share card");
    }

    const filename = `rugpull-bakery-pnl-card-${slugify(row.chefName || row.bakeryName || row.chefAddress)}.png`;
    const title = `${row.chefName || "P&L Card"} Rugpull Bakery P&L`;
    if (typeof File !== "undefined" && navigator.canShare && navigator.share) {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text: `${row.chefName || "P&L Card"} projected P&L: ${moneyLabel(row.pnlEth, { signed: true })}`,
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
      tr.firstChild.colSpan = 11;
    els.tableBody.append(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = row.pnlEth >= 0 ? "profit-row" : "loss-row";
    tr.append(
      mobileSummaryCell(row),
        rankCell(row),
        chefCell(row),
        cell(row.bakeryName || "-", "name-cell", "Bakery"),
        cell(scoreLabel(row), "number-cell", "Score"),
        cell(formatCookieCount(row.cookiesBakedDisplay), "number-cell", "Cookies"),
        cell(formatCookieCount(row.cookieBalanceDisplay), "number-cell", "Remaining"),
        cell(formatShare(row.leaderboardSharePct), "number-cell", "Share"),
      cell(moneyLabel(row.grossEth), "number-cell", "Gross"),
      cell(moneyLabel(row.costEth), "number-cell", "Cost"),
      cell(moneyLabel(row.pnlEth, { signed: true }), "number-cell pnl-cell", "P&L"),
      cell(row.roi === null ? "--" : formatPercent(row.roi), "number-cell", "ROI")
    );
    addMobileDetailsToggle(tr, 1);
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

function boostFailCount(row) {
  const attempts = Number(row.boostAttempts || 0);
  const landed = Number(row.boostLanded || 0);
  return Math.max(0, attempts - landed);
}

function boostSuccessRate(row) {
  const attempts = Number(row.boostAttempts || 0);
  const landed = Number(row.boostLanded || 0);
  return attempts > 0 ? (landed / attempts) * 100 : null;
}

function boostFailRate(row) {
  const attempts = Number(row.boostAttempts || 0);
  const fails = boostFailCount(row);
  return attempts > 0 ? (fails / attempts) * 100 : null;
}

function rugReceivedSourceText(source, totalSuccessful, totalAttempts) {
  const targetLabel = (dashboard?.leaderboardTitle || "leaderboard").toLowerCase();
  if (source.label === "season_rug_cache") {
    const statusLabel = source.complete ? "complete season history" : (source.status || "partial sync");
    return `Incoming rug attempts against ${targetLabel} bakeries from the ${statusLabel} cache. Events scanned: ${numberFormatter.format(source.scannedEvents || 0)}. Successful received: ${numberFormatter.format(totalSuccessful)} / ${numberFormatter.format(totalAttempts)} attempts.`;
  }

  if (source.label === "leaderboard_bakery_activity_feeds") {
    return `Incoming rug attempts against ${targetLabel} bakeries from up to ${numberFormatter.format(source.eventLimitPerBakery || 100)} recent events per bakery. Events scanned: ${numberFormatter.format(source.scannedEvents || 0)} / ${numberFormatter.format(source.maxEvents || 0)}. Successful received: ${numberFormatter.format(totalSuccessful)} / ${numberFormatter.format(totalAttempts)} attempts.`;
  }

  return `Incoming rug attempts against ${targetLabel} bakeries from the latest ${numberFormatter.format(source.eventLimit || 100)} global activity events. Successful received: ${numberFormatter.format(totalSuccessful)} / ${numberFormatter.format(totalAttempts)} attempts.`;
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
  els.topRuggerBakeryValue.textContent = topRow ? `${topRow.bakeryName || "-"} · ${currentBoardLabel()} #${topRow.rank}` : "Waiting";
  els.rugLandedValue.textContent = topRow ? numberFormatter.format(Number(topRow.rugLanded || 0)) : "--";
  els.rugLandedNote.textContent = dashboard?.isHistorical
    ? `Most landed in final ${leaderboardLabel()}`
    : `Most landed in current ${leaderboardLabel()}`;
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
    : `Scanning ${leaderboardLabel().toLowerCase()} bakeries`;
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
      rankCell(row, "Leaderboard Rank"),
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
    ruggedTr.append(cell(`No incoming rug attempts found for the selected ${leaderboardLabel().toLowerCase()}.`, "empty-cell"));
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
      rankCell(row, "Leaderboard Rank"),
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

function hallOfPainRows(rows) {
  return [...rows]
    .filter((row) => Number.isFinite(Number(row.roi)))
    .sort((a, b) => Number(a.roi) - Number(b.roi))
    .slice(0, 3);
}

function painPodiumAvatar(row, place) {
  const portalUrl = abstractPortalProfileUrl(row.chefAddress);
  const wrap = document.createElement(portalUrl ? "a" : "span");
  wrap.className = "pain-profile";
  if (portalUrl) {
    wrap.href = portalUrl;
    wrap.target = "_blank";
    wrap.rel = "noopener noreferrer";
    wrap.title = `Open ${row.chefName || row.chefAddress} on Abstract Portal`;
  }

  if (place === 1) {
    const crown = document.createElement("span");
    crown.className = "pain-crown";
    crown.setAttribute("aria-label", "Worst ROI crown");
    crown.textContent = "♛";
    wrap.append(crown);
  }

  if (row.profileImageUrl) {
    const img = document.createElement("img");
    img.className = "pain-avatar";
    img.src = row.profileImageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => img.remove(), { once: true });
    wrap.append(img);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "pain-avatar pain-avatar-fallback";
    fallback.textContent = (row.chefName || row.chefAddress || "?").slice(0, 2).toUpperCase();
    wrap.append(fallback);
  }

  return wrap;
}

function renderHallOfPain(rows) {
  const ranked = hallOfPainRows(rows).map((row, index) => ({
    row,
    place: index + 1
  }));
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);

  els.hallPainPodium.innerHTML = "";
  els.hallPainRowCount.textContent = ranked.length === 0 ? "No ROI data" : `${ranked.length} worst ROI`;

  if (ranked.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-cell";
    empty.textContent = "No ROI data available for Hall of Pain.";
    els.hallPainPodium.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const { row, place } of podium) {
    const card = document.createElement("article");
    card.className = `pain-podium-card pain-place-${place}`;

    const placeBadge = document.createElement("span");
    placeBadge.className = "pain-place";
    placeBadge.textContent = `#${place}`;

    const avatar = painPodiumAvatar(row, place);

    const name = document.createElement("strong");
    name.className = "pain-name";
    name.textContent = row.chefName || shortAddress(row.chefAddress);

    const bakery = document.createElement("span");
    bakery.className = "pain-bakery";
    bakery.textContent = row.bakeryName || "Bakery";

    const roi = document.createElement("strong");
    roi.className = "pain-roi";
    roi.textContent = formatPercent(row.roi);

    const pnl = document.createElement("span");
    pnl.className = row.pnlEth >= 0 ? "pain-pnl positive" : "pain-pnl negative";
    pnl.textContent = `${moneyLabel(row.pnlEth, { signed: true })} P&L`;

    const meta = document.createElement("span");
    meta.className = "pain-meta";
    meta.append(`${currentBoardLabel()} #${row.rank}`, rankMovementBadge(row), ` · Cost ${moneyLabel(row.costEth)}`);

    card.append(placeBadge, avatar, name, bakery, roi, pnl, meta);
    fragment.append(card);
  }

  els.hallPainPodium.append(fragment);
}

function topFailRows(rows) {
  return [...rows]
    .filter((row) => Number(row.boostAttempts || 0) > 0 && boostFailCount(row) > 0)
    .sort((a, b) => {
      const failRateDelta = (boostFailRate(b) || 0) - (boostFailRate(a) || 0);
      if (failRateDelta !== 0) {
        return failRateDelta;
      }

      const attemptsDelta = Number(b.boostAttempts || 0) - Number(a.boostAttempts || 0);
      if (attemptsDelta !== 0) {
        return attemptsDelta;
      }

      return Number(a.rank || 0) - Number(b.rank || 0);
    })
    .slice(0, 20);
}

function failPodiumAvatar(row, place) {
  const portalUrl = abstractPortalProfileUrl(row.chefAddress);
  const wrap = document.createElement(portalUrl ? "a" : "span");
  wrap.className = "fail-profile";
  if (portalUrl) {
    wrap.href = portalUrl;
    wrap.target = "_blank";
    wrap.rel = "noopener noreferrer";
    wrap.title = `Open ${row.chefName || row.chefAddress} on Abstract Portal`;
  }

  if (place === 1) {
    const badge = document.createElement("span");
    badge.className = "fail-crown";
    badge.setAttribute("aria-label", "Top Fail crown");
    badge.textContent = "!";
    wrap.append(badge);
  }

  if (row.profileImageUrl) {
    const img = document.createElement("img");
    img.className = "fail-avatar";
    img.src = row.profileImageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => img.remove(), { once: true });
    wrap.append(img);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "fail-avatar fail-avatar-fallback";
    fallback.textContent = (row.chefName || row.chefAddress || "?").slice(0, 2).toUpperCase();
    wrap.append(fallback);
  }

  return wrap;
}

function renderTopFail(rows) {
  const ranked = topFailRows(rows).map((row, index) => ({
    row,
    place: index + 1
  }));
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);

  els.topFailPodium.innerHTML = "";
  els.topFailTableBody.innerHTML = "";
  els.topFailRowCount.textContent = ranked.length === 0 ? "No failed boost rate" : `Top ${ranked.length} fail rates`;
  els.topFailTableCount.textContent = `${ranked.length} rows`;

  if (ranked.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-cell";
    empty.textContent = "No failed boost rate found for the selected leaderboard.";
    els.topFailPodium.append(empty);

    const tr = document.createElement("tr");
    tr.append(cell("No failed boost rate found for the selected leaderboard.", "empty-cell"));
    tr.firstChild.colSpan = 8;
    els.topFailTableBody.append(tr);
    return;
  }

  const podiumFragment = document.createDocumentFragment();
  for (const { row, place } of podium) {
    const card = document.createElement("article");
    card.className = `fail-podium-card fail-place-${place}`;

    const placeBadge = document.createElement("span");
    placeBadge.className = "fail-place";
    placeBadge.textContent = `#${place}`;

    const avatar = failPodiumAvatar(row, place);

    const name = document.createElement("strong");
    name.className = "fail-name";
    name.textContent = row.chefName || shortAddress(row.chefAddress);

    const bakery = document.createElement("span");
    bakery.className = "fail-bakery";
    bakery.textContent = row.bakeryName || "Bakery";

    const failValue = document.createElement("strong");
    failValue.className = "fail-count";
    failValue.textContent = formatPercent(boostFailRate(row));

    const meta = document.createElement("span");
    meta.className = "fail-meta";
    meta.append(`${currentBoardLabel()} #${row.rank}`, rankMovementBadge(row), ` · ${numberFormatter.format(boostFailCount(row))} fails / ${numberFormatter.format(Number(row.boostAttempts || 0))} attempts`);

    card.append(placeBadge, avatar, name, bakery, failValue, meta);
    podiumFragment.append(card);
  }
  els.topFailPodium.append(podiumFragment);

  const tableFragment = document.createDocumentFragment();
  ranked.forEach(({ row, place }) => {
    const failRate = boostFailRate(row);
    const successRate = boostSuccessRate(row);
    const tr = document.createElement("tr");
    tr.append(
      cell(`#${place}`, "rank-cell", "Fail Rank"),
      rankCell(row, "Leaderboard Rank"),
      chefCell(row),
      cell(row.bakeryName || "-", "name-cell", "Bakery"),
      cell(failRate === null ? "--" : formatPercent(failRate), "number-cell pnl-cell", "Fail Rate"),
      cell(numberFormatter.format(boostFailCount(row)), "number-cell", "Boost Fails"),
      cell(numberFormatter.format(Number(row.boostAttempts || 0)), "number-cell", "Boost Attempts"),
      cell(successRate === null ? "--" : formatPercent(successRate), "number-cell", "Boost Success")
    );
    addMobileDetailsToggle(tr, 2);
    tableFragment.append(tr);
  });
  els.topFailTableBody.append(tableFragment);
}

function renderDashboard() {
  if (!dashboard) {
    return;
  }

  syncSeasonSelector();
  syncLeaderboardSelector();
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

  els.statusText.textContent = dashboard.isHistorical
    ? `${seasonLabel()} final rewards loaded from on-chain payouts`
    : `Live data refreshed ${new Date(dashboard.updatedAt).toLocaleString()}`;
  els.seasonValue.textContent = seasonLabel();
  els.dashboardTab.textContent = leaderboardLabel();
  els.grossLabel.textContent = dashboard.grossLabel || "Gross";
  els.costLabel.textContent = dashboard.costLabel || "Cost";
  els.pnlLabel.textContent = dashboard.pnlLabel || "P&L";
  els.cookiesNote.textContent = `Visible ${leaderboardLabel().toLowerCase()} rows`;
  els.tableTitle.textContent = leaderboardLabel();
  els.myBakerySearchLabel.textContent = `Search ${leaderboardLabel()}`;
  els.totalRugsLabel.textContent = `Total ${leaderboardLabel()} Rugs`;
  els.topRugRankHeader.textContent = `${currentBoardLabel()} Rank`;
  els.ruggedRankHeader.textContent = `${currentBoardLabel()} Rank`;
  els.simBucketLabel.textContent = `${currentBoardLabel()} Bucket`;
  els.simBucketNote.textContent = `${formatShare(dashboard.leaderboardBucketPct)} live split`;
  els.simDeltaLabel.textContent = `${currentBoardLabel()} Delta`;
  els.updatedValue.textContent = dashboard.isHistorical
    ? (dashboard.rewardTx?.timestampText ? `Reward tx ${dashboard.rewardTx.timestampText}` : "Finalized season")
    : dashboard.seasonEndsAt
      ? `Ends ${new Date(dashboard.seasonEndsAt).toLocaleString()}`
      : "Active season";
  els.prizePoolValue.textContent = moneyLabel(dashboard.prizePoolEth);
  els.payoutSplitValue.textContent = dashboard.payoutSummaryText
    || `Leaderboard ${formatShare(dashboard.leaderboardBucketPct)} / Activity ${formatShare(dashboard.activityBucketPct)}`;
  els.grossValue.textContent = moneyLabel(totalGrossEth);
  els.grossValueNote.textContent = dashboard.isHistorical
    ? `Final on-chain rewards sent to the ${leaderboardLabel()}`
    : (dashboard.bucketProjectionLabel || "Leaderboard bucket projection");
  els.costValue.textContent = moneyLabel(totalCostEth);
  els.pnlValue.textContent = moneyLabel(totalPnlEth, { signed: true });
  els.roiValue.textContent = totalRoi === null ? "ROI --" : `ROI ${formatPercent(totalRoi)}`;
  els.cookiesValue.textContent = formatCookieCount(totalCookies);
  els.tableNote.textContent = dashboard.isHistorical
    ? dashboard.costModel?.kind === "historical_exact_gas"
      ? "P&L = final on-chain reward - exact historical gas. Rewards come from the season payout transaction."
      : dashboard.costModel?.kind === "tx_usd_rate"
      ? "P&L = final on-chain reward - estimated tx fees. Rewards come from the season payout transaction."
      : "P&L = final on-chain reward - gas cost. The reward values come from the season payout transaction."
    : dashboard?.rankingMetric === "score"
      ? "Leaderboard ranks are sorted by Score. Cookies baked stay visible as a separate stat."
      : dashboard?.leaderboardKey === "open"
        ? "P&L = projected open leaderboard reward - gas cost. The S4 open leaderboard uses its own 40% prize pool bucket."
        : dashboard?.leaderboardKey === "standard"
          ? "P&L = projected standard leaderboard reward - gas cost. Standard activity rewards are not included."
          : "P&L = projected leaderboard reward - gas cost. Activity rewards and future cookie farming are not included.";

  if (dashboard.isHistorical && dashboard.costModel?.kind === "historical_exact_gas") {
    const playerCount = Number(dashboard.costModel.exactBackfillPlayerCount || 0);
    const endBlock = dashboard.costModel.exactBackfillEndBlock || dashboard.rewardTx?.blockNumber || null;
    els.costSourceValue.textContent = playerCount > 0
      ? `Exact on-chain bake gas for ${playerCount} players${endBlock ? ` · end block ${endBlock}` : ""}`
      : "Exact on-chain bake gas";
  } else if (dashboard.isHistorical && dashboard.costModel?.kind === "tx_usd_rate") {
    const txUsd = Number(dashboard.costModel.txUsd || 0);
    const payoutEthUsd = Number(dashboard.costModel.payoutEthUsd || dashboard.rewardTx?.payoutEthUsd || 0);
    els.costSourceValue.textContent = payoutEthUsd > 0
      ? `$${txUsd.toFixed(4)} / tx · payout ETH $${payoutEthUsd.toFixed(2)}`
      : `$${txUsd.toFixed(4)} / tx`;
  } else if (manualCostPerMillion > 0) {
    els.costSourceValue.textContent = `${moneyLabel(manualCostPerMillion)} / 1M manual`;
  } else if ((dashboard.rows || []).some((row) => row.costSource === "exact_gas_cache" || row.costSource === "partial_gas_cache")) {
    const exactRows = (dashboard.rows || []).filter((row) => row.costSource === "exact_gas_cache").length;
    const partialRows = (dashboard.rows || []).filter((row) => row.costSource === "partial_gas_cache").length;
    els.costSourceValue.textContent = partialRows > 0
      ? `Gas cache ${exactRows} exact / ${partialRows} partial · ${formatShortDateTime(dashboard.costCache?.updatedAt)}`
      : `Exact gas cache ${exactRows}/${(dashboard.rows || []).length} · ${formatShortDateTime(dashboard.costCache?.updatedAt)}`;
  } else if (dashboard.costCache?.status === "partial") {
    els.costSourceValue.textContent =
      `Exact gas cache syncing ${dashboard.costCache.completeChefCount || 0}/${dashboard.costCache.top100AddressCount || (dashboard.rows || []).length} · estimate fallback`;
  } else if (dashboard.costEstimate?.status === "ok") {
    els.costSourceValue.textContent =
      `${moneyLabel(dashboard.costEstimate.estimatedCostPerMillionEth)} / 1M raw from ${dashboard.costEstimate.sampleTxCount} RPC txs`;
  } else {
    els.costSourceValue.textContent = "RPC estimate unavailable";
  }

  if (dashboard.isHistorical && dashboard.rewardTx?.hash) {
    els.sourceLink.href = `https://abscan.org/tx/${dashboard.rewardTx.hash}`;
    els.docsLink.href = `https://abscan.org/tx/${dashboard.rewardTx.hash}`;
    els.sourceLink.textContent = "Final Winners";
    els.docsLink.textContent = "Reward Tx";
  } else {
    if (dashboard.sourceUrl) {
      els.sourceLink.href = dashboard.sourceUrl;
    }
    if (dashboard.docsUrl) {
      els.docsLink.href = dashboard.docsUrl;
    }
    els.sourceLink.textContent = "Leaderboard";
    els.docsLink.textContent = "Payouts";
  }
  renderTable(rows);
  renderMyBakery(myRows);
  renderTopRug(rows);
  renderTopFail(rows);
  renderHallOfPain(myRows);
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
  els.simDeltaNote.textContent = dashboard?.isHistorical ? "Versus final gross" : "Versus live gross";
  els.simLiveGrossHeader.textContent = dashboard?.isHistorical ? "Final Gross" : "Live Gross";
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
      rankCell(row),
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
  const header = ["Rank", "Chef", "Bakery", "Score", "Cookies", "Remaining Cookies", "Share %", `Gross ${currencyLabel}`, `Cost ${currencyLabel}`, `P&L ${currencyLabel}`, "ROI %"];
  const records = rows.map((row) => [
    row.rank,
    row.chefName || row.chefAddress || "",
    row.bakeryName || "",
    Number(row.score || 0) > 0 ? row.scoreDisplay : "",
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
  link.download = `bakery-top100-pnl-season-${dashboard?.seasonDisplayId || dashboard?.seasonId || "current"}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function refreshDashboard() {
  els.refreshButton.disabled = true;
  els.statusText.textContent = "Loading season data...";
  try {
    const params = new URLSearchParams();
    if (selectedSeasonId) {
      params.set("season", String(selectedSeasonId));
    }
    if (selectedLeaderboardKey) {
      params.set("board", selectedLeaderboardKey);
    }
    const endpoint = params.size > 0 ? `/api/pnl-top100?${params}` : "/api/pnl-top100";
    const response = await fetch(endpoint);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to load Bakery P&L");
    }

    dashboard = payload;
    selectedSeasonId = Number(payload.selectedSeasonId || payload.seasonId || selectedSeasonId || 0) || null;
    selectedLeaderboardKey = payload.selectedLeaderboardKey || payload.leaderboardKey || selectedLeaderboardKey || "standard";
    try {
      if (selectedSeasonId) {
        localStorage.setItem(STORAGE_KEYS.selectedSeasonId, String(selectedSeasonId));
      }
      if (selectedLeaderboardKey) {
        localStorage.setItem(STORAGE_KEYS.selectedLeaderboardKey, selectedLeaderboardKey);
      }
    } catch {}
    syncSeasonSelector();
    syncLeaderboardSelector();
    renderDashboard();
  } catch (error) {
    els.statusText.textContent = error instanceof Error ? error.message : String(error);
    currentMyBakeryRow = null;
    applyPnlCardBackground(false);
    els.tableBody.innerHTML = "";
    els.rugTableBody.innerHTML = "";
    els.ruggedTableBody.innerHTML = "";
    els.topFailPodium.innerHTML = "";
    els.topFailTableBody.innerHTML = "";
    els.hallPainPodium.innerHTML = "";
    els.myBakeryCard.innerHTML = "";
    els.shareStatus.textContent = "";
    els.sharePnlButton.disabled = true;
    els.simTableBody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.append(cell("Unable to load the public Bakery P&L right now.", "empty-cell"));
    tr.firstChild.colSpan = 11;
    els.tableBody.append(tr);
    const rugTr = document.createElement("tr");
    rugTr.append(cell("Unable to load the public Bakery rug stats right now.", "empty-cell"));
    rugTr.firstChild.colSpan = 8;
    els.rugTableBody.append(rugTr);
    const ruggedTr = document.createElement("tr");
    ruggedTr.append(cell("Unable to load the public Bakery received rug stats right now.", "empty-cell"));
    ruggedTr.firstChild.colSpan = 10;
    els.ruggedTableBody.append(ruggedTr);
    const painEmpty = document.createElement("p");
    painEmpty.className = "empty-cell";
    painEmpty.textContent = "Unable to load the Hall of Pain right now.";
    els.hallPainPodium.append(painEmpty);
    const failEmpty = document.createElement("p");
    failEmpty.className = "empty-cell";
    failEmpty.textContent = "Unable to load Top Fail right now.";
    els.topFailPodium.append(failEmpty);
    const failTr = document.createElement("tr");
    failTr.append(cell("Unable to load Top Fail right now.", "empty-cell"));
    failTr.firstChild.colSpan = 8;
    els.topFailTableBody.append(failTr);
    const simTr = document.createElement("tr");
    simTr.append(cell("Unable to load the simulator data right now.", "empty-cell"));
    simTr.firstChild.colSpan = 7;
    els.simTableBody.append(simTr);
    if (els.seasonSelect) {
      els.seasonSelect.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Season --";
      els.seasonSelect.append(option);
      els.seasonSelect.disabled = true;
    }
    if (els.leaderboardSelect) {
      els.leaderboardSelect.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Leaderboard --";
      els.leaderboardSelect.append(option);
      els.leaderboardSelect.disabled = true;
    }
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

els.seasonSelect?.addEventListener("change", () => {
  const nextSeasonId = Number(els.seasonSelect.value || 0) || null;
  selectedSeasonId = nextSeasonId;
  try {
    if (selectedSeasonId) {
      localStorage.setItem(STORAGE_KEYS.selectedSeasonId, String(selectedSeasonId));
    } else {
      localStorage.removeItem(STORAGE_KEYS.selectedSeasonId);
    }
  } catch {}
  refreshDashboard();
});

els.leaderboardSelect?.addEventListener("change", () => {
  selectedLeaderboardKey = els.leaderboardSelect.value || "standard";
  try {
    localStorage.setItem(STORAGE_KEYS.selectedLeaderboardKey, selectedLeaderboardKey);
  } catch {}
  refreshDashboard();
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

els.topFailTab.addEventListener("click", () => {
  setActiveView("fail");
});

els.hallPainTab.addEventListener("click", () => {
  setActiveView("pain");
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
setPnlCardBackground(pnlCardBackground, false);
setActiveView(activeView, false);
refreshEthPrice();
refreshDashboard();
