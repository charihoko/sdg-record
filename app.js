(() => {
  "use strict";

  const STORAGE_KEY = "sdgRecords";
  const LEGACY_KEYS = ["sdg-records", "sdg_record_records"];
  let currentFilter = "today";
  let records = loadRecords();

  const form = document.getElementById("recordForm");
  const editIdInput = document.getElementById("editId");
  const dateInput = document.getElementById("date");
  const pointSelect = document.getElementById("point");
  const densityInput = document.getElementById("density");
  const saveButton = document.getElementById("saveButton");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const recordList = document.getElementById("recordList");
  const emptyMessage = document.getElementById("emptyMessage");
  const showTodayButton = document.getElementById("showTodayButton");
  const showAllButton = document.getElementById("showAllButton");
  const shareCsvButton = document.getElementById("shareCsvButton");
  const deleteAllButton = document.getElementById("deleteAllButton");
  const toast = document.getElementById("toast");

  initialize();

  function initialize() {
    buildPointOptions();
    dateInput.value = todayLocal();
    renderRecords();
    registerServiceWorker();
  }

  function buildPointOptions() {
    const fragment = document.createDocumentFragment();
    for (let number = 20; number <= 110; number += 1) {
      const option = document.createElement("option");
      option.value = `No.${number}`;
      option.textContent = `No.${number}`;
      fragment.appendChild(option);
    }
    pointSelect.appendChild(fragment);
  }

  function loadRecords() {
    let raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          raw = legacy;
          localStorage.setItem(STORAGE_KEY, legacy);
          break;
        }
      }
    }

    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("保存データの読込みに失敗しました。", error);
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const date = dateInput.value;
    const point = pointSelect.value;
    const lane = document.querySelector('input[name="lane"]:checked')?.value;
    const density = Number(densityInput.value);

    if (!date || !point || !lane || !Number.isFinite(density) || density <= 0) {
      alert("測定日、測点、車線、乾燥密度を確認してください。");
      return;
    }

    const editId = editIdInput.value;

    if (editId) {
      const target = records.find((record) => record.id === editId);
      if (!target) {
        alert("編集対象の記録が見つかりません。");
        resetForm();
        return;
      }

      target.date = date;
      target.point = point;
      target.lane = lane;
      target.density = density;
      target.updatedAt = new Date().toISOString();
      showToast("記録を修正しました。");
    } else {
      records.push({
        id: createId(),
        date,
        point,
        lane,
        density,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast("記録を登録しました。");
    }

    saveRecords();
    resetForm();
    renderRecords();
  });

  cancelEditButton.addEventListener("click", resetForm);

  showTodayButton.addEventListener("click", () => {
    currentFilter = "today";
    updateFilterButtons();
    renderRecords();
  });

  showAllButton.addEventListener("click", () => {
    currentFilter = "all";
    updateFilterButtons();
    renderRecords();
  });

  shareCsvButton.addEventListener("click", shareCsv);

  deleteAllButton.addEventListener("click", () => {
    if (records.length === 0) {
      alert("削除する測定データはありません。");
      return;
    }

    const firstConfirm = confirm(
      "保存されている全ての測定データを削除します。\n削除して良いですか？"
    );
    if (!firstConfirm) return;

    const secondConfirm = confirm(
      "本当に削除しますか？\nこの操作は元に戻せません。"
    );
    if (!secondConfirm) return;

    records = [];
    saveRecords();
    resetForm();
    renderRecords();
    alert("全ての測定データを削除しました。");
  });

  function renderRecords() {
    const today = todayLocal();
    const visible = records
      .filter((record) => currentFilter === "all" || record.date === today)
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      });

    recordList.replaceChildren();
    emptyMessage.classList.toggle("hidden", visible.length > 0);

    for (const record of visible) {
      const item = document.createElement("article");
      item.className = "record-item";

      const main = document.createElement("div");
      main.className = "record-main";

      const textWrap = document.createElement("div");

      const title = document.createElement("h3");
      title.className = "record-title";
      title.textContent = `${record.point}　${record.lane}`;

      const meta = document.createElement("p");
      meta.className = "record-meta";
      meta.textContent = formatJapaneseDate(record.date);

      const density = document.createElement("div");
      density.className = "record-density";
      density.textContent = `${formatDensity(record.density)} kg/m³`;

      textWrap.append(title, meta);
      main.append(textWrap, density);

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
      deleteButton.addEventListener("click", () => deleteRecord(record.id));

      actions.append(editButton, deleteButton);
      item.append(main, actions);
      recordList.appendChild(item);
    }
  }

  function startEdit(id) {
    const record = records.find((item) => item.id === id);
    if (!record) return;

    editIdInput.value = record.id;
    dateInput.value = record.date;
    pointSelect.value = record.point;
    densityInput.value = record.density;

    const laneInput = document.querySelector(
      `input[name="lane"][value="${CSS.escape(record.lane)}"]`
    );
    if (laneInput) laneInput.checked = true;

    saveButton.textContent = "修正を保存する";
    cancelEditButton.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    densityInput.focus();
  }

  function deleteRecord(id) {
    const record = records.find((item) => item.id === id);
    if (!record) return;

    const ok = confirm(
      `${record.date}　${record.point}　${record.lane}\n乾燥密度 ${formatDensity(record.density)} kg/m³\n\nこの記録を削除しますか？`
    );
    if (!ok) return;

    records = records.filter((item) => item.id !== id);
    saveRecords();

    if (editIdInput.value === id) resetForm();

    renderRecords();
    showToast("記録を削除しました。");
  }

  function resetForm() {
    editIdInput.value = "";
    dateInput.value = todayLocal();
    pointSelect.value = "No.20";
    document.querySelector('input[name="lane"][value="左"]').checked = true;
    densityInput.value = "";
    saveButton.textContent = "登録する";
    cancelEditButton.classList.add("hidden");
  }

  async function shareCsv() {
    if (records.length === 0) {
      alert("共有する測定データがありません。");
      return;
    }

    const csv = buildCsv(records);
    const fileName = `SDG記録_${todayLocal().replaceAll("-", "")}.csv`;
    const file = new File(
      ["\uFEFF" + csv],
      fileName,
      { type: "text/csv;charset=utf-8" }
    );

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: "SDG測定記録",
          text: "SDG測定記録のCSVです。",
          files: [file]
        });
        return;
      }

      downloadFile(file, fileName);
      alert(
        "この端末では共有画面を直接開けなかったため、CSVをダウンロードしました。\nファイルからOutlookで共有してください。"
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        downloadFile(file, fileName);
        alert(
          "共有画面を開けなかったため、CSVをダウンロードしました。\nファイルからOutlookで共有してください。"
        );
      }
    }
  }

  function buildCsv(items) {
    const header = ["測定日", "測点", "車線", "乾燥密度(kg/m³)"];
    const rows = items
      .slice()
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        const pointCompare = pointNumber(a.point) - pointNumber(b.point);
        if (pointCompare !== 0) return pointCompare;
        return a.lane.localeCompare(b.lane, "ja");
      })
      .map((record) => [
        record.date,
        record.point,
        record.lane,
        formatDensity(record.density)
      ]);

    return [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  }

  function downloadFile(file, fileName) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateFilterButtons() {
    showTodayButton.classList.toggle("active", currentFilter === "today");
    showAllButton.classList.toggle("active", currentFilter === "all");
  }

  function formatDensity(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number.toFixed(0) : number.toFixed(1);
  }

  function pointNumber(point) {
    const match = String(point).match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function todayLocal() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function formatJapaneseDate(dateText) {
    const [year, month, day] = dateText.split("-");
    return `${year}/${Number(month)}/${Number(day)}`;
  }

  function createId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch((error) => {
          console.warn("Service Worker registration failed:", error);
        });
      });
    }
  }
})();
