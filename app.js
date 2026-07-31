(() => {
  "use strict";

  const STORAGE_KEY = "sdgRecords";
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
  const toast = document.getElementById("toast");

  init();

  function init() {
    for (let n = 20; n <= 110; n++) {
      const option = document.createElement("option");
      option.value = `No.${n}`;
      option.textContent = `No.${n}`;
      pointSelect.appendChild(option);
    }
    dateInput.value = todayLocal();
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
    resetForm();
    render();
  });

  cancelEditButton.addEventListener("click", resetForm);

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

      const density = document.createElement("div");
      density.className = "record-density";
      density.textContent = `${formatDensity(record.density)} kg/m³`;

      top.append(left, density);

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
    pointSelect.value = "No.20";
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
    const rows = [["測定日", "測点", "車線", "乾燥密度(kg/m³)"]];
    items
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || pointNumber(a.point) - pointNumber(b.point) || a.lane.localeCompare(b.lane, "ja"))
      .forEach((record) => rows.push([
        record.date,
        record.point,
        record.lane,
        formatDensity(record.density)
      ]));
    return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
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
