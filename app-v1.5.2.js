(() => {
  "use strict";

  const STORAGE_KEY = "sdgRecords";
  const POINT_KEY = "sdgLastPoint";
  const MAX_DRY_DENSITY = 1803;
  let records = loadRecords();
  let currentFilter = "today";

  const form = document.getElementById("recordForm");
  const editId = document.getElementById("editId");
  const dateInput = document.getElementById("date");
  const pointSelect = document.getElementById("point");
  const laneSelect = document.getElementById("lane");
  const densityInput = document.getElementById("density");
  const saveButton = document.getElementById("saveButton");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const showTodayButton = document.getElementById("showTodayButton");
  const showAllButton = document.getElementById("showAllButton");
  const recordList = document.getElementById("recordList");
  const emptyMessage = document.getElementById("emptyMessage");
  const recordCount = document.getElementById("recordCount");
  const shareCsvButton = document.getElementById("shareCsvButton");
  const deleteAllButton = document.getElementById("deleteAllButton");
  const showGraphButton = document.getElementById("showGraphButton");
  const closeGraphButton = document.getElementById("closeGraphButton");
  const graphSection = document.getElementById("graphSection");
  const graphScope = document.getElementById("graphScope");
  const leftChart = document.getElementById("leftChart");
  const rightChart = document.getElementById("rightChart");
  const leftStats = document.getElementById("leftStats");
  const rightStats = document.getElementById("rightStats");
  const leftEmpty = document.getElementById("leftEmpty");
  const rightEmpty = document.getElementById("rightEmpty");
  const csvFileInput = document.getElementById("csvFileInput");
  const selectCsvButton = document.getElementById("selectCsvButton");
  const importDialog = document.getElementById("importDialog");
  const importFileName = document.getElementById("importFileName");
  const importTotal = document.getElementById("importTotal");
  const importAdd = document.getElementById("importAdd");
  const importDuplicate = document.getElementById("importDuplicate");
  const importWarning = document.getElementById("importWarning");
  const confirmImportButton = document.getElementById("confirmImportButton");
  const cancelImportButton = document.getElementById("cancelImportButton");
  const toast = document.getElementById("toast");
  let pendingImport = [];

  init();

  function init() {
    for (let n = 19; n <= 110; n++) {
      const option = document.createElement("option");
      option.value = `No.${n}`;
      option.textContent = `No.${n}`;
      pointSelect.appendChild(option);
    }
    dateInput.value = todayLocal();
    pointSelect.value = loadLastPoint();
    render();
    registerServiceWorker();
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const density = Number(densityInput.value);
    if (!dateInput.value || !pointSelect.value || !laneSelect.value || !Number.isFinite(density) || density <= 0) {
      alert("入力内容を確認してください。");
      return;
    }

    if (editId.value) {
      const record = records.find((item) => item.id === editId.value);
      if (!record) return;
      Object.assign(record, {
        date: dateInput.value,
        point: pointSelect.value,
        lane: laneSelect.value,
        density,
        updatedAt: new Date().toISOString()
      });
      showToast("記録を修正しました。");
    } else {
      records.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        date: dateInput.value,
        point: pointSelect.value,
        lane: laneSelect.value,
        density,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast("記録を登録しました。");
    }

    saveRecords();
    localStorage.setItem(POINT_KEY, pointSelect.value);
    resetForm();
    render();
  });

  cancelEditButton.addEventListener("click", resetForm);

  pointSelect.addEventListener("change", () => {
    localStorage.setItem(POINT_KEY, pointSelect.value);
  });

  showTodayButton.addEventListener("click", () => {
    currentFilter = "today";
    updateFilters();
    render();
  });

  showAllButton.addEventListener("click", () => {
    currentFilter = "all";
    updateFilters();
    render();
  });

  shareCsvButton.addEventListener("click", shareCsv);

  selectCsvButton.addEventListener("click", () => {
    csvFileInput.value = "";
    csvFileInput.click();
  });

  csvFileInput.addEventListener("change", async () => {
    const file = csvFileInput.files?.[0];
    if (!file) return;
    await prepareCsvImport(file);
  });

  cancelImportButton.addEventListener("click", closeImportDialog);
  confirmImportButton.addEventListener("click", commitCsvImport);

  showGraphButton.addEventListener("click", () => {
    graphSection.classList.remove("hidden");
    renderGraphs();
    graphSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  closeGraphButton.addEventListener("click", () => {
    graphSection.classList.add("hidden");
  });

  window.addEventListener("resize", () => {
    if (!graphSection.classList.contains("hidden")) renderGraphs();
  });

  deleteAllButton.addEventListener("click", () => {
    if (records.length === 0) {
      alert("削除する測定データはありません。");
      return;
    }

    if (!confirm("保存されている全ての測定データを削除します。\n削除して良いですか？")) return;
    if (!confirm("本当に削除しますか？\nこの操作は元に戻せません。")) return;

    records = [];
    saveRecords();
    resetForm();
    render();
    alert("全ての測定データを削除しました。");
  });

  function render() {
    const visible = records
      .filter((record) => currentFilter === "all" || record.date === todayLocal())
      .sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt));

    recordCount.textContent = `${visible.length}件`;
    recordList.replaceChildren();
    emptyMessage.classList.toggle("hidden", visible.length > 0);

    for (const record of visible) {
      const item = document.createElement("article");
      item.className = "record-item";

      const top = document.createElement("div");
      top.className = "record-top";

      const left = document.createElement("div");
      const title = document.createElement("div");
      title.className = "record-title";
      title.textContent = `${record.point}　${record.lane}`;
      const date = document.createElement("div");
      date.className = "record-date";
      date.textContent = record.date.replaceAll("-", "/");
      left.append(title, date);

      const values = document.createElement("div");
      values.className = "record-values";
      const density = document.createElement("div");
      density.className = "record-density";
      density.innerHTML = `${formatDensity(record.density)} <span class="record-unit-label">kg/m³</span>`;
      const compaction = document.createElement("div");
      compaction.className = "record-compaction";
      compaction.innerHTML = `<span class="record-compaction-label">締固め度</span> ${formatCompaction(record.density)}`;
      values.append(density, compaction);

      top.append(left, values);

      const actions = document.createElement("div");
      actions.className = "record-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit-button";
      editButton.textContent = "修正";
      editButton.addEventListener("click", () => startEdit(record.id));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-button";
      deleteButton.textContent = "削除";
      deleteButton.addEventListener("click", () => deleteOne(record.id));

      actions.append(editButton, deleteButton);
      item.append(top, actions);
      recordList.appendChild(item);
    }
  }

  function startEdit(id) {
    const record = records.find((item) => item.id === id);
    if (!record) return;

    editId.value = record.id;
    dateInput.value = record.date;
    pointSelect.value = record.point;
    laneSelect.value = record.lane;
    densityInput.value = record.density;
    saveButton.textContent = "修正を保存";
    cancelEditButton.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteOne(id) {
    const record = records.find((item) => item.id === id);
    if (!record) return;
    if (!confirm(`${record.date} ${record.point} ${record.lane}\nこの記録を削除しますか？`)) return;

    records = records.filter((item) => item.id !== id);
    saveRecords();
    if (editId.value === id) resetForm();
    render();
    showToast("記録を削除しました。");
  }

  function resetForm() {
    editId.value = "";
    dateInput.value = todayLocal();
    pointSelect.value = loadLastPoint();
    laneSelect.value = "左";
    densityInput.value = "";
    saveButton.textContent = "登録";
    cancelEditButton.classList.add("hidden");
  }

  async function shareCsv() {
    if (records.length === 0) {
      alert("共有する測定データがありません。");
      return;
    }

    const csv = buildCsv(records);
    const fileName = `SDG記録_${todayLocal().replaceAll("-", "")}.csv`;
    const file = new File(["\uFEFF" + csv], fileName, { type: "text/csv;charset=utf-8" });

    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "SDG測定記録",
          text: "SDG測定記録のCSVです。",
          files: [file]
        });
      } else {
        downloadFile(file, fileName);
        alert("共有画面を開けなかったため、CSVを保存しました。");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        downloadFile(file, fileName);
        alert("共有画面を開けなかったため、CSVを保存しました。");
      }
    }
  }

  function buildCsv(items) {
    const rows = [["測定日", "測点", "車線", "乾燥密度(kg/m³)", "締固め度(%)"]];
    items
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || pointNumber(a.point) - pointNumber(b.point) || a.lane.localeCompare(b.lane, "ja"))
      .forEach((record) => rows.push([
        record.date,
        record.point,
        record.lane,
        formatDensity(record.density),
        formatCompactionNumber(record.density)
      ]));
    return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  }

  async function prepareCsvImport(file) {
    try {
      const text = await readCsvFile(file);
      const parsedRows = parseCsv(text.replace(/^\uFEFF/, ""));
      const result = validateImportRows(parsedRows);
      pendingImport = result.additions;

      importFileName.textContent = file.name;
      importTotal.textContent = `${result.validCount}件`;
      importAdd.textContent = `${result.additions.length}件`;
      importDuplicate.textContent = `${result.duplicateCount}件`;
      importWarning.classList.toggle("hidden", result.errors.length === 0);
      importWarning.textContent = result.errors.length
        ? `${result.errors.length}行は入力内容が不正なため取り込みません。`
        : "";
      confirmImportButton.disabled = pendingImport.length === 0;
      confirmImportButton.textContent = pendingImport.length ? `${pendingImport.length}件を追加する` : "追加する記録なし";
      openImportDialog();
    } catch (error) {
      pendingImport = [];
      alert(error?.message || "CSVを読み込めませんでした。");
    }
  }

  function readCsvFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("CSVファイルを読み込めませんでした。"));
      reader.readAsText(file, "UTF-8");
    });
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field.replace(/\r$/, ""));
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
    return rows;
  }

  function validateImportRows(rows) {
    if (rows.length === 0) throw new Error("CSVにデータがありません。");
    const headers = rows[0].map(normalizeHeader);
    const required = ["測定日", "測点", "車線", "乾燥密度"];
    const indexes = required.map((name) => headers.findIndex((header) => header === name));
    if (indexes.some((index) => index < 0)) {
      throw new Error("V1.4・V1.5のCSVではありません。列名を確認してください。");
    }

    const existingKeys = new Set(records.map(recordKey));
    const importKeys = new Set();
    const additions = [];
    const errors = [];
    let duplicateCount = 0;
    let validCount = 0;

    rows.slice(1).forEach((row, rowIndex) => {
      const date = normalizeDate(row[indexes[0]]);
      const point = String(row[indexes[1]] || "").trim();
      const lane = String(row[indexes[2]] || "").trim();
      const densityText = String(row[indexes[3]] || "").trim().replace(/,/g, "");
      const density = Number(densityText);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^No\.\d+$/.test(point) || !["左", "右"].includes(lane) || !Number.isFinite(density) || density <= 0) {
        errors.push(rowIndex + 2);
        return;
      }

      validCount++;
      const candidate = { date, point, lane, density };
      const key = recordKey(candidate);
      if (existingKeys.has(key) || importKeys.has(key)) {
        duplicateCount++;
        return;
      }
      importKeys.add(key);
      additions.push(candidate);
    });

    return { additions, duplicateCount, validCount, errors };
  }

  function normalizeHeader(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .replace(/[\s　]/g, "")
      .replace(/\([^)]*\)|（[^）]*）/g, "")
      .trim();
  }

  function normalizeDate(value) {
    const text = String(value || "").trim().replaceAll("/", "-");
    const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : text;
  }

  function recordKey(record) {
    const density = Number(record.density);
    return [record.date, record.point, record.lane, Number.isFinite(density) ? density.toFixed(3) : ""].join("|");
  }

  function commitCsvImport() {
    if (pendingImport.length === 0) return;
    const now = new Date().toISOString();
    const additions = pendingImport.map((item, index) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}-${Math.random()}`,
      date: item.date,
      point: item.point,
      lane: item.lane,
      density: item.density,
      createdAt: now,
      updatedAt: now
    }));

    records = records.concat(additions);
    saveRecords();
    pendingImport = [];
    closeImportDialog();
    currentFilter = "all";
    updateFilters();
    render();
    showToast(`${additions.length}件を追加しました。`);
  }

  function openImportDialog() {
    if (typeof importDialog.showModal === "function") importDialog.showModal();
    else importDialog.setAttribute("open", "");
  }

  function closeImportDialog() {
    if (typeof importDialog.close === "function") importDialog.close();
    else importDialog.removeAttribute("open");
    pendingImport = [];
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadFile(file, fileName) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateFilters() {
    showTodayButton.classList.toggle("active", currentFilter === "today");
    showAllButton.classList.toggle("active", currentFilter === "all");
  }

  function pointNumber(value) {
    const match = String(value).match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function formatDensity(value) {
    const number = Number(value);
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  function compactionValue(density) {
    return Number(density) / MAX_DRY_DENSITY * 100;
  }

  function formatCompactionNumber(density) {
    const value = compactionValue(density);
    return Number.isFinite(value) ? value.toFixed(1) : "";
  }

  function formatCompaction(density) {
    const value = formatCompactionNumber(density);
    return value ? `${value}%` : "－";
  }

  function graphRecords() {
    return records
      .filter((record) => currentFilter === "all" || record.date === todayLocal())
      .filter((record) => Number.isFinite(Number(record.density)))
      .slice()
      .sort((a, b) => pointNumber(a.point) - pointNumber(b.point) || String(a.date).localeCompare(String(b.date)) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  }

  function renderGraphs() {
    const items = graphRecords();
    graphScope.textContent = currentFilter === "today" ? `今日（${todayLocal().replaceAll("-", "/")}）の記録` : "全記録";
    drawLaneChart(leftChart, leftStats, leftEmpty, items.filter((record) => record.lane === "左"), "#165b92");
    drawLaneChart(rightChart, rightStats, rightEmpty, items.filter((record) => record.lane === "右"), "#0b7358");
  }

  function drawLaneChart(canvas, statsElement, emptyElement, items, lineColor) {
    const wrapper = canvas.parentElement;
    const values = items.map((record) => compactionValue(record.density));
    const hasData = values.length > 0;
    wrapper.classList.toggle("hidden", !hasData);
    emptyElement.classList.toggle("hidden", hasData);
    statsElement.replaceChildren();
    if (!hasData) return;

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    [
      `平均 ${average.toFixed(1)}%`,
      `最低 ${Math.min(...values).toFixed(1)}%`,
      `最高 ${Math.max(...values).toFixed(1)}%`
    ].forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "stat-chip";
      chip.textContent = text;
      statsElement.appendChild(chip);
    });

    const cssWidth = Math.max(wrapper.clientWidth || 300, items.length * 58 + 70);
    const cssHeight = 280;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const margin = { top: 20, right: 18, bottom: 55, left: 48 };
    const plotWidth = cssWidth - margin.left - margin.right;
    const plotHeight = cssHeight - margin.top - margin.bottom;
    const minValue = Math.min(90, Math.floor(Math.min(...values, 93) - 1));
    const maxValue = Math.max(103, Math.ceil(Math.max(...values, 100) + 1));
    const x = (index) => margin.left + (items.length === 1 ? plotWidth / 2 : index * plotWidth / (items.length - 1));
    const y = (value) => margin.top + (maxValue - value) * plotHeight / (maxValue - minValue);

    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#dbe5eb";
    ctx.fillStyle = "#526873";
    for (let value = Math.ceil(minValue / 2) * 2; value <= maxValue; value += 2) {
      ctx.beginPath();
      ctx.moveTo(margin.left, y(value));
      ctx.lineTo(cssWidth - margin.right, y(value));
      ctx.stroke();
      ctx.fillText(`${value}%`, margin.left - 7, y(value));
    }

    [[93, "#d07a00"], [100, "#b22b37"]].forEach(([value, color]) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(margin.left, y(value));
      ctx.lineTo(cssWidth - margin.right, y(value));
      ctx.stroke();
      ctx.restore();
    });

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    values.forEach((value, index) => index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)));
    ctx.stroke();

    values.forEach((value, index) => {
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(x(index), y(value), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x(index), cssHeight - margin.bottom + 12);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = "right";
      ctx.fillStyle = "#263e4c";
      ctx.fillText(items[index].point, 0, 0);
      ctx.restore();
    });
  }

  function loadLastPoint() {
    const saved = localStorage.getItem(POINT_KEY);
    return /^No\.(?:19|[2-9]\d|10\d|110)$/.test(saved || "") ? saved : "No.20";
  }

  function todayLocal() {
    const now = new Date();
    const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
      });
    }
  }
})();
