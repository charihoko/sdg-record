(() => {
  "use strict";

  const STORAGE_KEY = "sdgRecordV1.records";
  const PREF_KEY = "sdgRecordV1.preferences";

  const $ = (id) => document.getElementById(id);

  const el = {
    measurementDate: $("measurementDate"),
    point: $("point"),
    lane: $("lane"),
    density: $("density"),
    photoInput: $("photoInput"),
    preview: $("preview"),
    ocrButton: $("ocrButton"),
    ocrStatus: $("ocrStatus"),
    saveButton: $("saveButton"),
    cancelEditButton: $("cancelEditButton"),
    message: $("message"),
    recordList: $("recordList"),
    emptyState: $("emptyState"),
    recordCount: $("recordCount"),
    showTodayButton: $("showTodayButton"),
    showAllButton: $("showAllButton"),
    exportButton: $("exportButton"),
    backupButton: $("backupButton"),
    restoreInput: $("restoreInput"),
    deleteAllButton: $("deleteAllButton")
  };

  let records = loadRecords();
  let editingId = null;
  let currentFilter = "today";
  let selectedImage = null;

  init();

  function init() {
    populatePoints();
    const prefs = loadPreferences();
    el.measurementDate.value = todayLocal();
    el.point.value = prefs.point || "No.20";
    el.lane.value = prefs.lane || "左";
    bindEvents();
    render();
    registerServiceWorker();
  }

  function bindEvents() {
    el.photoInput.addEventListener("change", handlePhoto);
    el.ocrButton.addEventListener("click", runOcr);
    el.saveButton.addEventListener("click", saveRecord);
    el.cancelEditButton.addEventListener("click", cancelEdit);
    el.showTodayButton.addEventListener("click", () => setFilter("today"));
    el.showAllButton.addEventListener("click", () => setFilter("all"));
    el.exportButton.addEventListener("click", exportCsv);
    el.backupButton.addEventListener("click", exportBackup);
    el.restoreInput.addEventListener("change", restoreBackup);
    el.deleteAllButton.addEventListener("click", deleteAll);
  }

  function populatePoints() {
    const fragment = document.createDocumentFragment();
    for (let i = 20; i <= 110; i += 1) {
      const option = document.createElement("option");
      option.value = `No.${i}`;
      option.textContent = `No.${i}`;
      fragment.appendChild(option);
    }
    el.point.appendChild(fragment);
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    selectedImage = file;
    el.preview.src = URL.createObjectURL(file);
    el.preview.hidden = false;
    el.ocrButton.disabled = false;
    el.ocrStatus.textContent = "画像を確認して「読み取る」を押してください。";
  }

  async function runOcr() {
    if (!selectedImage) return;
    if (!window.Tesseract) {
      showMessage("OCR機能を読み込めません。通信状態を確認してください。", "error");
      return;
    }

    el.ocrButton.disabled = true;
    el.ocrStatus.textContent = "読み取り中…初回は少し時間がかかります。";

    try {
      const result = await Tesseract.recognize(selectedImage, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            el.ocrStatus.textContent = `読み取り中… ${Math.round((m.progress || 0) * 100)}%`;
          }
        }
      });

      const text = result.data.text || "";
      const value = extractDensity(text);

      if (value !== null) {
        el.density.value = value.toFixed(1);
        el.ocrStatus.textContent = `読取候補：${value.toFixed(1)} kg/m³。必ず画面と照合してください。`;
        el.density.focus();
      } else {
        el.ocrStatus.textContent = "乾燥密度を特定できませんでした。数値を直接入力してください。";
      }
    } catch (error) {
      console.error(error);
      el.ocrStatus.textContent = "読み取りに失敗しました。数値を直接入力してください。";
    } finally {
      el.ocrButton.disabled = false;
    }
  }

  function extractDensity(text) {
    const normalized = text.replace(/,/g, "").replace(/[Oo]/g, "0");
    const matches = normalized.match(/\b[12]\d{3}(?:\.\d)?\b/g) || [];
    const numbers = matches
      .map(Number)
      .filter((n) => n >= 1000 && n <= 3000);

    if (!numbers.length) return null;

    // SDGの乾燥密度として現実的な候補を優先
    const preferred = numbers.find((n) => n >= 1400 && n <= 2600);
    return preferred ?? numbers[0];
  }

  function saveRecord() {
    clearMessage();

    const date = el.measurementDate.value;
    const point = el.point.value;
    const lane = el.lane.value;
    const density = Number(el.density.value);

    if (!date) return showMessage("測定日を入力してください。", "error");
    if (!point) return showMessage("測点を選択してください。", "error");
    if (!["左", "右"].includes(lane)) return showMessage("車線を選択してください。", "error");
    if (!Number.isFinite(density) || density < 1000 || density > 3000) {
      return showMessage("乾燥密度を1000～3000の範囲で入力してください。", "error");
    }

    const duplicate = records.find((r) =>
      r.id !== editingId &&
      r.date === date &&
      r.point === point &&
      r.lane === lane
    );

    if (duplicate) {
      const proceed = confirm(`${date} ${point} ${lane}は既に登録されています。\n重複して登録しますか？`);
      if (!proceed) return;
    }

    const now = new Date().toISOString();

    if (editingId) {
      records = records.map((r) => r.id === editingId
        ? { ...r, date, point, lane, density: round1(density), updatedAt: now }
        : r
      );
      showMessage("記録を修正しました。", "success");
    } else {
      records.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        date,
        point,
        lane,
        density: round1(density),
        createdAt: now,
        updatedAt: now
      });
      showMessage("登録しました。", "success");
    }

    saveRecords();
    savePreferences({ point, lane });
    resetEntryAfterSave();
    render();
  }

  function editRecord(id) {
    const record = records.find((r) => r.id === id);
    if (!record) return;

    editingId = id;
    el.measurementDate.value = record.date;
    el.point.value = record.point;
    el.lane.value = record.lane;
    el.density.value = record.density.toFixed(1);
    el.saveButton.textContent = "修正を保存";
    el.cancelEditButton.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    editingId = null;
    el.saveButton.textContent = "登録";
    el.cancelEditButton.hidden = true;
    el.measurementDate.value = todayLocal();
    el.density.value = "";
    clearMessage();
  }

  function deleteRecord(id) {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    const ok = confirm(`${record.date} ${record.point} ${record.lane} ${record.density.toFixed(1)} を削除しますか？`);
    if (!ok) return;
    records = records.filter((r) => r.id !== id);
    saveRecords();
    if (editingId === id) cancelEdit();
    render();
  }

  function setFilter(filter) {
    currentFilter = filter;
    el.showTodayButton.classList.toggle("active", filter === "today");
    el.showAllButton.classList.toggle("active", filter === "all");
    render();
  }

  function render() {
    const source = [...records].sort(sortRecords);
    const visible = currentFilter === "today"
      ? source.filter((r) => r.date === todayLocal())
      : source;

    el.recordList.innerHTML = "";
    el.emptyState.hidden = visible.length > 0;
    el.recordCount.textContent = `${visible.length}件`;

    visible.forEach((record) => {
      const item = document.createElement("article");
      item.className = "record-item";
      item.innerHTML = `
        <div class="record-main">
          <span>${escapeHtml(record.date.replaceAll("-", "/"))}</span>
          <strong>${escapeHtml(record.point)}</strong>
          <strong>${escapeHtml(record.lane)}</strong>
          <span class="density-value">${record.density.toFixed(1)}</span>
        </div>
        <div class="record-actions">
          <button class="edit-button" type="button">修正</button>
          <button class="delete-button" type="button">削除</button>
        </div>
      `;
      item.querySelector(".edit-button").addEventListener("click", () => editRecord(record.id));
      item.querySelector(".delete-button").addEventListener("click", () => deleteRecord(record.id));
      el.recordList.appendChild(item);
    });
  }

  function sortRecords(a, b) {
    return a.date.localeCompare(b.date)
      || pointNumber(a.point) - pointNumber(b.point)
      || a.lane.localeCompare(b.lane, "ja");
  }

  function exportCsv() {
    if (!records.length) {
      showMessage("出力する記録がありません。", "error");
      return;
    }

    const sorted = [...records].sort(sortRecords);
    const rows = [
      ["測定日", "測点", "車線", "乾燥密度_kgm3"],
      ...sorted.map((r) => [r.date.replaceAll("-", "/"), r.point, r.lane, r.density.toFixed(1)])
    ];

    const csv = "\uFEFF" + rows.map((row) =>
      row.map(csvEscape).join(",")
    ).join("\r\n");

    const dates = sorted.map((r) => r.date).sort();
    const start = dates[0].replaceAll("-", "");
    const end = dates[dates.length - 1].replaceAll("-", "");
    downloadBlob(csv, `SDG記録_${start}-${end}.csv`, "text/csv;charset=utf-8");
    showMessage("CSVを作成しました。共有からOneDriveへ保存してください。", "success");
  }

  function exportBackup() {
    if (!records.length) {
      showMessage("保存する記録がありません。", "error");
      return;
    }

    const payload = {
      app: "SDG Record",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      records
    };

    downloadBlob(
      JSON.stringify(payload, null, 2),
      `SDG_Record_Backup_${todayLocal().replaceAll("-", "")}.json`,
      "application/json"
    );
    showMessage("バックアップを作成しました。", "success");
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.records)) throw new Error("invalid");
      const valid = payload.records.filter(validateRecord);
      const ok = confirm(`${valid.length}件のバックアップを読み込みます。\n現在のデータへ追加しますか？`);
      if (!ok) return;

      const existingIds = new Set(records.map((r) => r.id));
      const additions = valid.filter((r) => !existingIds.has(r.id));
      records = [...records, ...additions];
      saveRecords();
      render();
      showMessage(`${additions.length}件を追加しました。`, "success");
    } catch (error) {
      showMessage("バックアップファイルを読み込めませんでした。", "error");
    } finally {
      event.target.value = "";
    }
  }

  function deleteAll() {
    if (!records.length) return;
    const first = confirm("端末内のSDG記録をすべて削除しますか？");
    if (!first) return;
    const second = confirm("CSVまたはバックアップの保存を確認しましたか？\n削除後は元に戻せません。");
    if (!second) return;

    records = [];
    saveRecords();
    cancelEdit();
    render();
    showMessage("全データを削除しました。", "success");
  }

  function resetEntryAfterSave() {
    editingId = null;
    el.saveButton.textContent = "登録";
    el.cancelEditButton.hidden = true;
    el.density.value = "";
    selectedImage = null;
    el.photoInput.value = "";
    el.preview.hidden = true;
    el.preview.removeAttribute("src");
    el.ocrButton.disabled = true;
    el.ocrStatus.textContent = "画像は保存されません。";

    // 同じ測点の左右を続けて測る想定で、自動で左右を切替
    el.lane.value = el.lane.value === "左" ? "右" : "左";
  }

  function validateRecord(r) {
    return r && typeof r.id === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
      && /^No\.(?:[2-9]\d|10\d|110)$/.test(r.point)
      && ["左", "右"].includes(r.lane)
      && Number.isFinite(Number(r.density));
  }

  function loadRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(validateRecord).map((r) => ({
        ...r,
        density: Number(r.density)
      })) : [];
    } catch {
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function loadPreferences() {
    try {
      return JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function savePreferences(prefs) {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }

  function todayLocal() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function pointNumber(point) {
    return Number(point.replace("No.", ""));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showMessage(text, type) {
    el.message.textContent = text;
    el.message.className = `message ${type}`;
  }

  function clearMessage() {
    el.message.textContent = "";
    el.message.className = "message";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(console.error);
    }
  }
})();
