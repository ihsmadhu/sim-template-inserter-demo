// ==UserScript==
// @name         DigiFlex Comment Hub — Demo
// @namespace    https://digiflex.example.com/
// @version      1.0
// @description  Centralized comment & template hub for multiple enterprise portals (demo, non-confidential)
// @author       Madhumitha Sekar
// @match        https://portal-a.example.com/*
// @match        https://portal-b.example.com/*
// @match        https://approvals.example.com/*
// @match        https://finance-portal.example.com/*
// @run-at       document-idle
// @all-frames   true
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  "use strict";

  /* ========= Portal Detection (Generic, No Real Domains) ========= */

  const HOST = location.hostname;
  const PATH = location.pathname || "";

  const IS_PORTAL_A = /portal-a\.example\.com$/i.test(HOST);
  const IS_PORTAL_B = /portal-b\.example\.com$/i.test(HOST);
  const IS_APPROVALS = /approvals\.example\.com$/i.test(HOST);
  const IS_FINANCE = /finance-portal\.example\.com$/i.test(HOST);

  function storageGroupFor(host) {
    if (/portal-a\.example\.com$/i.test(host)) return "PORTAL_A";
    if (/portal-b\.example\.com$/i.test(host)) return "PORTAL_B";
    if (/approvals\.example\.com$/i.test(host)) return "APPROVALS";
    if (/finance-portal\.example\.com$/i.test(host)) return "FINANCE";
    return "OTHER";
  }

  const STORAGE_GROUP = storageGroupFor(HOST);
  const STORAGE_NS = `DFCH_${STORAGE_GROUP}_`;
  const STORAGE_KEY = `${STORAGE_NS}Templates`;
  const LAST_PROCESS_KEY = `${STORAGE_NS}LastProcess`;
  const LAST_USED_KEY = `${STORAGE_NS}LastUsedTemplate`;

  /* ========= Simple Storage Wrapper (GM or localStorage) ========= */

  const store = {
    get(key, fallback = null) {
      try {
        if (typeof GM_getValue === "function") {
          const v = GM_getValue(key, "__DFCH__MISSING__");
          return v === "__DFCH__MISSING__" ? fallback : v;
        }
      } catch {}
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (typeof GM_setValue === "function") return GM_setValue(key, value);
      } catch {}
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
  };

  /* ========= Template Model ========= */

  /**
   * Template shape:
   * {
   *   process: "RFQ",
   *   category: "General",
   *   name: "Follow-up: Pending Response",
   *   body: "Hi [Contact],\n\nThis is a reminder...",
   *   starred: false
   * }
   */

  function loadTemplates() {
    const data = store.get(STORAGE_KEY, []);
    return Array.isArray(data) ? data : [];
  }

  function saveTemplates(list) {
    store.set(STORAGE_KEY, list || []);
  }

  function currentTemplates() {
    return loadTemplates();
  }

  function uniqueProcesses() {
    const set = new Set(currentTemplates().map((t) => t.process));
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /* ========= Toast Helper ========= */

  if (!window.showToast) {
    const tc = document.createElement("div");
    tc.id = "dfch-toast-container";
    document.body.appendChild(tc);

    safeGMStyle(`
      #dfch-toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .dfch-toast {
        background: #111827;
        color: #f9fafb;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        box-shadow: 0 2px 5px rgba(0,0,0,.3);
        opacity: 0;
        transform: translateY(10px);
        transition: all .25s ease;
      }
      .dfch-toast.show {
        opacity: 1;
        transform: translateY(0);
      }
    `);

    window.showToast = (msg) => {
      const t = document.createElement("div");
      t.className = "dfch-toast";
      t.textContent = msg;
      tc.appendChild(t);
      requestAnimationFrame(() => t.classList.add("show"));
      setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.remove(), 250);
      }, 2200);
    };
  }

  function safeGMStyle(css) {
    try {
      if (typeof GM_addStyle === "function") {
        GM_addStyle(css);
        return;
      }
    } catch {}
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ========= Generic Insert Logic (No Internal Selectors) ========= */

  function findEditableElement() {
    const visible = (el) =>
      el &&
      el.offsetParent !== null &&
      getComputedStyle(el).visibility !== "hidden";

    // Try textareas
    const ta = [...document.querySelectorAll("textarea")].find(visible);
    if (ta) return ta;

    // Try contenteditable
    const ce = [
      ...document.querySelectorAll("[contenteditable='true']"),
      ...document.querySelectorAll('[role="textbox"]'),
    ].find(visible);
    if (ce) return ce;

    return null;
  }

  function insertPlainText(text) {
    const target = findEditableElement();
    if (!target) {
      showToast("⚠️ Could not find an editable field");
      return;
    }

    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      const setter =
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value"
        )?.set || ((el, v) => (el.value = v));
      setter.call(target, text);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Simple conversion: newlines -> <br>
      target.innerHTML = String(text)
        .replace(/\n/g, "<br>")
        .replace(/\s+$/, "");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }

    try {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
    showToast("✅ Template inserted");
  }

  const insertFn = insertPlainText;

  /* ========= QuickFields Modal (Placeholder Replacement) ========= */

  function openQuickFieldModal(templateText, insertFn) {
    const placeholders = [
      ...new Set(
        (templateText.match(/\[[^\]]+\]/g) || []).map((ph) =>
          ph.slice(1, -1).trim()
        )
      ),
    ];

    const overlay = document.createElement("div");
    overlay.className = "dfch-qf-overlay";
    overlay.tabIndex = -1;

    const box = document.createElement("div");
    box.className = "dfch-qf-modal";
    box.innerHTML = `<h3>Fill Template Fields</h3>`;
    overlay.appendChild(box);

    const fields = {};
    if (placeholders.length) {
      placeholders.forEach((name) => {
        const label = document.createElement("label");
        label.textContent = name;
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = name;
        fields[name] = input;
        box.appendChild(label);
        box.appendChild(input);
      });
    } else {
      const info = document.createElement("div");
      info.textContent = "No [placeholders] found in this template.";
      info.style.fontSize = "12px";
      info.style.margin = "6px 0";
      box.appendChild(info);
    }

    const actions = document.createElement("div");
    actions.className = "dfch-qf-actions";
    const insertBtn = document.createElement("button");
    insertBtn.textContent = "Insert";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    actions.appendChild(insertBtn);
    actions.appendChild(cancelBtn);
    box.appendChild(actions);

    function doInsert() {
      let final = templateText;
      placeholders.forEach((name) => {
        const val = fields[name]?.value || "";
        const re = new RegExp(
          "\\[\\s*" + escapeReg(name) + "\\s*\\]",
          "g"
        );
        final = final.replace(re, val);
      });
      insertFn(final.trim());
      document.body.removeChild(overlay);
    }

    insertBtn.onclick = doInsert;
    cancelBtn.onclick = () => document.body.removeChild(overlay);

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doInsert();
      } else if (e.key === "Escape") {
        e.preventDefault();
        document.body.removeChild(overlay);
      }
    });

    document.body.appendChild(overlay);
    overlay.focus();
  }

  function escapeReg(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  /* ========= Sidebar UI (Templates List) ========= */

  const toggleBtn = document.createElement("div");
  toggleBtn.id = "dfch-toggle";
  toggleBtn.textContent = "Templates";
  toggleBtn.setAttribute("role", "button");
  toggleBtn.tabIndex = 0;

  const sidebar = document.createElement("div");
  sidebar.id = "dfch-sidebar";
  sidebar.innerHTML = `
    <div class="dfch-sb-header">
      <span>Templates</span>
      <button id="dfch-gear-btn" title="Manage Templates">⚙️</button>
    </div>
    <select id="dfch-process"></select>
    <input id="dfch-search" type="text" placeholder="Search templates..." />
    <div id="dfch-list"></div>
  `;

  document.body.appendChild(toggleBtn);
  document.body.appendChild(sidebar);

  toggleBtn.onclick = () => {
    const isOpen = sidebar.style.display === "block";
    sidebar.style.display = isOpen ? "none" : "block";
  };

  function renderProcessDropdown() {
    const sel = document.getElementById("dfch-process");
    const processes = uniqueProcesses();
    const last = store.get(LAST_PROCESS_KEY, processes[0] || "");
    sel.innerHTML = "";

    processes.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (p === last) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.onchange = () => {
      store.set(LAST_PROCESS_KEY, sel.value);
      renderTemplates();
    };
  }

  function addTemplateButton(container, t) {
    const btn = document.createElement("div");
    btn.className = "dfch-tpl-btn";
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    btn.innerHTML = `
      <span class="dfch-tpl-name">${t.name}</span>
      <span class="dfch-star">${t.starred ? "★" : "☆"}</span>
    `;

    btn.onclick = () => {
      store.set(LAST_USED_KEY, t);
      if (/\[[^\]]+\]/.test(t.body)) {
        openQuickFieldModal(t.body, insertFn);
      } else {
        insertFn(t.body);
      }
    };

    btn.querySelector(".dfch-star").onclick = (e) => {
      e.stopPropagation();
      const list = currentTemplates();
      const idx = list.findIndex(
        (x) =>
          x.process === t.process &&
          x.category === t.category &&
          x.name === t.name
      );
      if (idx >= 0) {
        list[idx].starred = !list[idx].starred;
        saveTemplates(list);
        renderTemplates();
        showToast(
          list[idx].starred
            ? "⭐ Marked as favorite"
            : "⭐ Removed from favorites"
        );
      }
    };

    container.appendChild(btn);
  }

  function renderTemplates() {
    const listEl = document.getElementById("dfch-list");
    const searchEl = document.getElementById("dfch-search");
    const processSel = document.getElementById("dfch-process");

    renderProcessDropdown();

    const all = currentTemplates();
    const proc = processSel.value || "";
    const q = (searchEl.value || "").toLowerCase();

    listEl.innerHTML = "";

    const lastTpl = store.get(LAST_USED_KEY, null);
    if (lastTpl) {
      const lastBtn = document.createElement("div");
      lastBtn.className = "dfch-tpl-btn dfch-last-used";
      lastBtn.innerHTML = `↩ ${lastTpl.name}`;
      lastBtn.onclick = () => {
        if (/\[[^\]]+\]/.test(lastTpl.body)) {
          openQuickFieldModal(lastTpl.body, insertFn);
        } else {
          insertFn(lastTpl.body);
        }
      };
      listEl.appendChild(lastBtn);
    }

    const filtered = all.filter(
      (t) =>
        (!proc || t.process === proc) &&
        (t.name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q))
    );

    const favorites = filtered.filter((t) => t.starred);
    if (favorites.length) {
      const favHeader = document.createElement("div");
      favHeader.className = "dfch-group-title";
      favHeader.textContent = "⭐ Favorites";
      listEl.appendChild(favHeader);
      favorites.forEach((t) => addTemplateButton(listEl, t));
    }

    const cats = [
      ...new Set(
        filtered.filter((t) => !t.starred).map((t) => t.category)
      ),
    ].sort((a, b) => a.localeCompare(b));

    cats.forEach((cat) => {
      const header = document.createElement("div");
      header.className = "dfch-group-title";
      header.textContent = cat;
      listEl.appendChild(header);

      filtered
        .filter((t) => !t.starred && t.category === cat)
        .forEach((t) => addTemplateButton(listEl, t));
    });
  }

  document.getElementById("dfch-search").oninput = () => renderTemplates();

  /* ========= Template Manager (Simple CRUD UI) ========= */

  const manager = document.createElement("div");
  manager.id = "dfch-manager";
  manager.innerHTML = `
    <div class="dfch-mgr-head">
      <h3>DigiFlex Comment Hub — Template Manager (Demo)</h3>
      <button id="dfch-mgr-close">✖</button>
    </div>
    <div class="dfch-mgr-ctrl">
      <button id="dfch-add">+ Add Template</button>
      <button id="dfch-export-json">Export JSON</button>
      <button id="dfch-export-csv">Export CSV</button>
      <input id="dfch-import-file" type="file" accept=".json,.csv" style="display:none" />
      <button id="dfch-import">Import</button>
    </div>
    <div id="dfch-mgr-content"></div>
  `;
  document.body.appendChild(manager);
  manager.style.display = "none";

  document
    .getElementById("dfch-gear-btn")
    .addEventListener("click", () => {
      manager.style.display =
        manager.style.display === "block" ? "none" : "block";
      if (manager.style.display === "block") renderManager();
    });

  document
    .getElementById("dfch-mgr-close")
    .addEventListener("click", () => {
      manager.style.display = "none";
    });

  document.getElementById("dfch-add").onclick = () => {
    const list = currentTemplates();
    list.push({
      process: "General",
      category: "General",
      name: "New Template",
      body: "Hello [Name],",
      starred: false,
    });
    saveTemplates(list);
    renderTemplates();
    renderManager();
  };

  document.getElementById("dfch-export-json").onclick = () => {
    const data = JSON.stringify(currentTemplates(), null, 2);
    downloadFile("digiflex_templates_demo.json", "application/json", data);
    showToast("📤 Exported JSON");
  };

  document.getElementById("dfch-export-csv").onclick = () => {
    const csv = templatesToCSV(currentTemplates());
    downloadFile("digiflex_templates_demo.csv", "text/csv", csv);
    showToast("📤 Exported CSV");
  };

  const importInput = document.getElementById("dfch-import-file");
  document.getElementById("dfch-import").onclick = () => importInput.click();
  importInput.onchange = (e) => handleImport(e.target.files || []);

  function renderManager() {
    const wrap = document.getElementById("dfch-mgr-content");
    const list = currentTemplates();
    wrap.innerHTML = "";

    list.forEach((t, idx) => {
      const row = document.createElement("div");
      row.className = "dfch-row";
      row.innerHTML = `
        <div class="dfch-row-top">
          <input value="${escapeHtml(
            t.process
          )}" placeholder="Process" />
          <input value="${escapeHtml(
            t.category
          )}" placeholder="Category" />
          <input value="${escapeHtml(t.name)}" placeholder="Name" />
          <label class="dfch-row-star">
            <input type="checkbox" ${t.starred ? "checked" : ""} /> ★
          </label>
        </div>
        <textarea>${escapeHtml(t.body)}</textarea>
        <div class="dfch-row-actions">
          <button class="dfch-save">Save</button>
          <button class="dfch-dup">Duplicate</button>
          <button class="dfch-del">Delete</button>
        </div>
      `;
      const [p, c, n] = row.querySelectorAll(".dfch-row-top input");
      const starredCheckbox = row.querySelector(
        ".dfch-row-top .dfch-row-star input"
      );
      const body = row.querySelector("textarea");
      const saveBtn = row.querySelector(".dfch-save");
      const dupBtn = row.querySelector(".dfch-dup");
      const delBtn = row.querySelector(".dfch-del");

      saveBtn.onclick = () => {
        const list = currentTemplates();
        list[idx] = {
          process: p.value || "General",
          category: c.value || "General",
          name: n.value || "Untitled",
          body: body.value || "",
          starred: !!starredCheckbox.checked,
        };
        saveTemplates(list);
        renderTemplates();
        renderManager();
        showToast("✅ Template saved");
      };

      dupBtn.onclick = () => {
        const list = currentTemplates();
        list.push({
          process: p.value || "General",
          category: c.value || "General",
          name: (n.value || "Untitled") + " Copy",
          body: body.value || "",
          starred: false,
        });
        saveTemplates(list);
        renderTemplates();
        renderManager();
        showToast("📄 Template duplicated");
      };

      delBtn.onclick = () => {
        const list = currentTemplates();
        list.splice(idx, 1);
        saveTemplates(list);
        renderTemplates();
        renderManager();
        showToast("🗑️ Template deleted");
      };

      wrap.appendChild(row);
    });
  }

  /* ========= Import / Export Helpers ========= */

  function downloadFile(name, mime, text) {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      showToast("⚠️ Download failed");
    }
  }

  function templatesToCSV(list) {
    function escCSV(s) {
      return `"${String(s ?? "").replace(/"/g, '""')}"`;
    }
    const header = "Process,Category,Name,Body,Starred";
    const lines = (list || []).map((t) =>
      [
        escCSV(t.process),
        escCSV(t.category),
        escCSV(t.name),
        escCSV(t.body),
        t.starred ? "true" : "false",
      ].join(",")
    );
    return [header].concat(lines).join("\n");
  }

  function csvToTemplates(text) {
    const rows = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((x) => x.trim().length);
    if (!rows.length) return [];
    const header = rows.shift().split(",").map((h) => h.trim().toLowerCase());

    function col(obj, ...names) {
      for (const name of names) {
        const idx = header.indexOf(name.toLowerCase());
        if (idx >= 0) return obj[idx] || "";
      }
      return "";
    }

    return rows.map((line) => {
      const parts = parseCsvRow(line);
      return {
        process: (col(parts, "process") || "General").trim(),
        category: (col(parts, "category") || "General").trim(),
        name: (col(parts, "name", "template name") || "Untitled").trim(),
        body: (col(parts, "body", "template text") || "").replace(
          /\r?\n/g,
          "\n"
        ),
        starred: /true|yes|1/i.test(col(parts, "starred") || ""),
      };
    });
  }

  function parseCsvRow(line) {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const n = line[i + 1];
      if (c === '"') {
        if (inQ && n === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  function handleImport(files) {
    if (!files.length) {
      showToast("⚠️ No file selected");
      return;
    }
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target.result || "").replace(/^\uFEFF/, "");
        let imported = [];
        if (/\.json$/i.test(file.name) || text.trim().startsWith("[")) {
          const data = JSON.parse(text);
          if (Array.isArray(data)) imported = data;
        } else {
          imported = csvToTemplates(text);
        }
        if (!imported.length) {
          showToast("⚠️ Nothing to import");
          return;
        }
        const merged = mergeTemplates(currentTemplates(), imported);
        saveTemplates(merged);
        renderTemplates();
        renderManager();
        showToast(`⬆️ Imported ${imported.length} template(s)`);
      } catch (e) {
        console.error(e);
        showToast("⚠️ Import failed");
      }
    };
    reader.readAsText(file);
  }

  function mergeTemplates(base, incoming) {
    const key = (t) =>
      (t.process + "||" + t.category + "||" + t.name).toLowerCase();
    const map = new Map(base.map((t) => [key(t), t]));
    incoming.forEach((t) => {
      map.set(key(t), t);
    });
    return [...map.values()];
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ========= Styles ========= */

  safeGMStyle(`
    #dfch-toggle {
      all: unset;
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483646;
      padding: 6px 12px;
      background: #1f2937;
      color: #f9fafb;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    #dfch-toggle:hover {
      background: #111827;
    }
    #dfch-sidebar {
      position: fixed;
      top: 60px;
      right: 20px;
      width: 260px;
      max-height: 80vh;
      background: #ffffff;
      border-radius: 10px;
      border: 1px solid #d1d5db;
      box-shadow: 0 4px 10px rgba(0,0,0,.12);
      padding: 8px;
      z-index: 2147483645;
      display: none;
      box-sizing: border-box;
      font-size: 13px;
    }
    .dfch-sb-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .dfch-sb-header span {
      font-weight: 600;
    }
    #dfch-gear-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
    }
    #dfch-process {
      width: 100%;
      margin: 4px 0;
      padding: 4px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: #eff6ff;
      font-weight: 600;
    }
    #dfch-search {
      width: 100%;
      margin-bottom: 6px;
      padding: 4px 6px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      box-sizing: border-box;
    }
    #dfch-list {
      max-height: 60vh;
      overflow: auto;
    }
    .dfch-group-title {
      margin-top: 6px;
      padding: 4px 6px;
      background: #f3f4f6;
      border-radius: 4px;
      font-weight: 600;
    }
    .dfch-tpl-btn {
      margin-top: 4px;
      padding: 6px 8px;
      border-radius: 6px;
      background: #111827;
      color: #f9fafb;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .dfch-tpl-btn:hover {
      background: #1f2937;
    }
    .dfch-last-used {
      background: #e5e7eb;
      color: #111827;
      font-weight: 600;
    }
    .dfch-star {
      margin-left: 6px;
      cursor: pointer;
    }

    .dfch-qf-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
    }
    .dfch-qf-modal {
      background: #ffffff;
      border-radius: 10px;
      padding: 10px 12px 8px;
      min-width: 280px;
      max-width: 360px;
      max-height: 80vh;
      box-shadow: 0 4px 12px rgba(0,0,0,.25);
      display: flex;
      flex-direction: column;
    }
    .dfch-qf-modal h3 {
      margin: 0 0 6px;
      font-size: 13px;
    }
    .dfch-qf-modal label {
      font-size: 12px;
      margin-top: 4px;
    }
    .dfch-qf-modal input {
      width: 100%;
      padding: 4px 6px;
      margin-top: 2px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      box-sizing: border-box;
    }
    .dfch-qf-actions {
      margin-top: 8px;
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .dfch-qf-actions button {
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      font-size: 12px;
      cursor: pointer;
    }
    .dfch-qf-actions button:first-child {
      background: #1d4ed8;
      color: #ffffff;
      border-color: #1d4ed8;
    }

    #dfch-manager {
      position: fixed;
      top: 80px;
      right: 40px;
      width: 780px;
      max-width: 95vw;
      height: 70vh;
      max-height: 80vh;
      background: #ffffff;
      border-radius: 10px;
      border: 1px solid #d1d5db;
      box-shadow: 0 6px 18px rgba(0,0,0,.2);
      z-index: 2147483646;
      display: none;
      box-sizing: border-box;
      padding: 8px 10px;
      overflow: auto;
      font-size: 13px;
    }
    .dfch-mgr-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .dfch-mgr-head h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
    }
    #dfch-mgr-close {
      border-radius: 999px;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      cursor: pointer;
      font-size: 12px;
      width: 22px;
      height: 22px;
      padding: 0;
    }
    .dfch-mgr-ctrl {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .dfch-mgr-ctrl button {
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      cursor: pointer;
      font-size: 12px;
    }
    .dfch-row {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 6px;
      margin-bottom: 6px;
      background: #f9fafb;
    }
    .dfch-row-top {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 4px;
    }
    .dfch-row-top input {
      flex: 1;
      padding: 3px 6px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      font-size: 12px;
    }
    .dfch-row-top .dfch-row-star {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;
    }
    .dfch-row-top .dfch-row-star input {
      margin: 0;
    }
    .dfch-row textarea {
      width: 100%;
      min-height: 60px;
      resize: vertical;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      padding: 4px 6px;
      box-sizing: border-box;
      font-size: 12px;
    }
    .dfch-row-actions {
      margin-top: 4px;
      display: flex;
      gap: 6px;
    }
    .dfch-row-actions button {
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid #d1d5db;
      background: #f3f4f6;
      font-size: 12px;
      cursor: pointer;
    }
    .dfch-row-actions button:hover {
      background: #e5e7eb;
    }
  `);

  /* ========= Initial Render ========= */

  renderTemplates();
})();
