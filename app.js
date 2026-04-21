const numberFormatter = new Intl.NumberFormat("en-US");

const els = {
  statusText: document.getElementById("statusText"),
  sourceLink: document.getElementById("sourceLink"),
  docsLink: document.getElementById("docsLink"),
  botLink: document.getElementById("botLink"),
  searchInput: document.getElementById("searchInput"),
  manualCostInput: document.getElementById("manualCostInput"),
  ethPriceInput: document.getElementById("ethPriceInput"),
  refreshButton: document.getElementById("refreshButton"),
  csvButton: document.getElementById("csvButton"),
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
  tableBody: document.getElementById("tableBody")
};

let dashboard = null;

try {
  const manualCost = localStorage.getItem("bakery-public:manual-cost");
  const ethPrice = localStorage.getItem("bakery-public:eth-price");
  if (manualCost !== null) {
    els.manualCostInput.value = manualCost;
  }
  if (ethPrice !== null) {
    els.ethPriceInput.value = ethPrice;
  }
} catch {
  // Optional browser storage.
}

function numericInputValue(input) {
  const value = Number(input?.value || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatCookieMillions(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: numeric >= 100 ? 2 : 3
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

function formatUsd(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "--";
  }

  const prefix = numeric > 0 ? "+" : "-";
  return `${prefix}$${numberFormatter.format(Math.abs(Math.round(numeric)))}`;
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

function computedRows() {
  if (!dashboard) {
    return [];
  }

  const manualCostPerMillion = numericInputValue(els.manualCostInput);
  const ethPrice = numericInputValue(els.ethPriceInput);
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
      const cookiesBakedMillions = cookiesBakedRaw / 1_000_000;
      const grossEth = Number(row.grossPrizeEth || 0);
      const costEth = manualCostPerMillion > 0
        ? cookiesBakedMillions * manualCostPerMillion
        : Number(row.estimatedCostEth || 0);
      const pnlEth = grossEth - costEth;
      const roi = costEth > 0 ? (pnlEth / costEth) * 100 : null;

      return {
        ...row,
        cookiesBaked: cookiesBakedRaw,
        cookiesBakedMillions,
        grossEth,
        costEth,
        pnlEth,
        roi,
        ethPrice
      };
    });
}

function moneyLabel(ethValue, ethPrice) {
  if (ethPrice > 0 && ethValue !== 0) {
    return `${formatEth(ethValue)} ${formatUsd(ethValue * ethPrice)}`;
  }
  return formatEth(ethValue);
}

function cell(text, className = "") {
  const td = document.createElement("td");
  td.textContent = text;
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
      cell(`#${row.rank}`, "rank-cell"),
      cell(row.chefName || row.chefAddress || "-", "name-cell"),
      cell(row.bakeryName || "-", "name-cell"),
      cell(formatCookieMillions(row.cookiesBakedMillions), "number-cell"),
      cell(formatShare(row.leaderboardSharePct), "number-cell"),
      cell(moneyLabel(row.grossEth, row.ethPrice), "number-cell"),
      cell(moneyLabel(row.costEth, row.ethPrice), "number-cell"),
      cell(moneyLabel(row.pnlEth, row.ethPrice), "number-cell pnl-cell"),
      cell(row.roi === null ? "--" : formatPercent(row.roi), "number-cell")
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
    const cookiesBakedMillions = cookiesBakedRaw / 1_000_000;
    const grossEth = Number(row.grossPrizeEth || 0);
    const manualCostPerMillion = numericInputValue(els.manualCostInput);
    const costEth = manualCostPerMillion > 0
      ? cookiesBakedMillions * manualCostPerMillion
      : Number(row.estimatedCostEth || 0);
    return { cookiesBakedMillions, grossEth, costEth, pnlEth: grossEth - costEth };
  });
  const ethPrice = numericInputValue(els.ethPriceInput);
  const totalGrossEth = allRows.reduce((total, row) => total + row.grossEth, 0);
  const totalCostEth = allRows.reduce((total, row) => total + row.costEth, 0);
  const totalPnlEth = allRows.reduce((total, row) => total + row.pnlEth, 0);
  const totalCookiesMillions = allRows.reduce((total, row) => total + row.cookiesBakedMillions, 0);
  const totalRoi = totalCostEth > 0 ? (totalPnlEth / totalCostEth) * 100 : null;
  const manualCostPerMillion = numericInputValue(els.manualCostInput);

  els.statusText.textContent = `Live data refreshed ${new Date(dashboard.updatedAt).toLocaleString()}`;
  els.seasonValue.textContent = `Season ${dashboard.seasonId ?? "--"}`;
  els.updatedValue.textContent = dashboard.seasonEndsAt
    ? `Ends ${new Date(dashboard.seasonEndsAt).toLocaleString()}`
    : "Active season";
  els.prizePoolValue.textContent = formatEth(dashboard.prizePoolEth);
  els.payoutSplitValue.textContent =
    `Leaderboard ${formatShare(dashboard.leaderboardBucketPct)} / Activity ${formatShare(dashboard.activityBucketPct)}`;
  els.grossValue.textContent = moneyLabel(totalGrossEth, ethPrice);
  els.costValue.textContent = moneyLabel(totalCostEth, ethPrice);
  els.pnlValue.textContent = moneyLabel(totalPnlEth, ethPrice);
  els.roiValue.textContent = totalRoi === null ? "ROI --" : `ROI ${formatPercent(totalRoi)}`;
  els.cookiesValue.textContent = formatCookieMillions(totalCookiesMillions);

  if (manualCostPerMillion > 0) {
    els.costSourceValue.textContent = `${formatEth(manualCostPerMillion)} / 1M manual`;
  } else if (dashboard.costEstimate?.status === "ok") {
    els.costSourceValue.textContent =
      `${formatEth(dashboard.costEstimate.estimatedCostPerMillionEth)} / 1M from ${dashboard.costEstimate.sampleTxCount} RPC txs`;
  } else {
    els.costSourceValue.textContent = "RPC estimate unavailable";
  }

  if (dashboard.sourceUrl) {
    els.sourceLink.href = dashboard.sourceUrl;
  }
  if (dashboard.docsUrl) {
    els.docsLink.href = dashboard.docsUrl;
  }
  if (dashboard.telegramBotUrl) {
    els.botLink.href = dashboard.telegramBotUrl;
  }

  renderTable(rows);
}

function rowsToCsv(rows) {
  const header = ["Rank", "Chef", "Bakery", "Cookies (M)", "Share %", "Gross ETH", "Cost ETH", "P&L ETH", "ROI %"];
  const records = rows.map((row) => [
    row.rank,
    row.chefName || row.chefAddress || "",
    row.bakeryName || "",
    row.cookiesBakedMillions,
    row.leaderboardSharePct,
    row.grossEth,
    row.costEth,
    row.pnlEth,
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

for (const input of [els.searchInput, els.manualCostInput, els.ethPriceInput]) {
  input.addEventListener("input", () => {
    try {
      localStorage.setItem("bakery-public:manual-cost", els.manualCostInput.value);
      localStorage.setItem("bakery-public:eth-price", els.ethPriceInput.value);
    } catch {}
    renderDashboard();
  });
}

els.refreshButton.addEventListener("click", () => {
  refreshDashboard();
});

els.csvButton.addEventListener("click", () => {
  downloadCsv();
});

refreshDashboard();
