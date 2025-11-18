# sim-template-inserter-demo
A browser automation userscript that adds a smart template sidebar to SIM-style workflow portals. Supports dynamic placeholders, favorites, import/export, and one-click comment insertion.

# DigiFlex Comment Hub — Demo Version

DigiFlex Comment Hub is a **browser userscript** that provides a centralized hub for managing and inserting reusable text templates across multiple web portals.

This repository contains a **sanitized demo version** of a real-world internal automation project.  
All domains, business logic, and template content have been anonymized to avoid exposing any confidential information.

---

## 🚀 Overview

The script adds:

- A **floating "Templates" button**
- A **sidebar** with categorized templates and search
- A **template manager** for add/edit/delete/import/export
- A **quick-fill modal** for replacing placeholders like `[Name]`

From any supported portal page, you can:

1. Open the template sidebar  
2. Search or browse templates  
3. Click a template  
4. Automatically insert it into the active text area / editor

This is useful for:

- Repeated email responses  
- Standardized comments  
- Vendor / client communication  
- Internal operational notes

---

## ✨ Key Features

- **Multi-portal support (demo domains)**  
  Works on several example domains via `@match` rules (easily customizable).

- **Sidebar template browser**
  - Filter by process (e.g., “General”, “Approvals”, etc.)
  - Search by template name, category, or body
  - Grouped by category

- **Favorites & last-used recall**
  - Mark templates as ⭐ favorites
  - One-click reuse of the last inserted template

- **QuickFields (placeholder fill)**
  - Detects `[placeholders]` inside template bodies
  - Prompts the user to fill them before insertion
  - Replaces them dynamically in the final text

- **Template Manager UI**
  - Add / edit / duplicate / delete templates
  - Mark templates as starred
  - Edit process, category, name, and body
  - All changes saved in browser storage

- **Import / Export**
  - Export templates as **JSON** or **CSV**
  - Import templates from JSON/CSV files
  - Merge with existing templates

- **Non-intrusive UI**
  - Draggable panels and compact layout
  - Toast notifications for actions (saved, inserted, imported, etc.)

---

## 🧠 Architecture & Concepts

The demo showcases:

- **Userscript design** (Tampermonkey/Greasemonkey)
- **Domain-aware behavior** via `@match` and hostname detection
- **State management** using `GM_getValue` / `GM_setValue` or `localStorage`
- **Dynamic DOM manipulation** (sidebars, modals, overlays)
- **Text insertion logic** that works with:
  - `<textarea>`
  - `<input>`
  - `contenteditable` elements
- **Import/export handling**
  - JSON handling
  - Simple CSV parsing and generation

---

## 🛠 Tech Stack

- **Language:** Vanilla JavaScript (ES6)
- **Environment:** Browser Userscript
- **Tools:**
  - Tampermonkey / Greasemonkey (or similar)
  - `GM_addStyle`, `GM_getValue`, `GM_setValue` (when available)
  - `localStorage` fallback

---

## 📦 Getting Started

### 1. Install a Userscript Manager

Install one of:

- Tampermonkey  
- Violentmonkey  

(Chrome, Edge, Firefox, etc. are supported.)

### 2. Install the Script

1. Open the `src/digiflex-comment-hub-demo.user.js` file in this repo.
2. Click **Raw**.
3. Your userscript manager should prompt you to **Install**.
4. Confirm installation.

### 3. Open a Demo Portal Page

The demo script is configured to run on example domains like:

```js
// @match        https://portal-a.example.com/*
// @match        https://portal-b.example.com/*
// @match        https://approvals.example.com/*
// @match        https://finance-portal.example.com/*
```

You can:

- Create simple local HTML test pages that match these URLs, or  
- Change the `@match` lines to point to your own test domains or tools.

### 4. Use the Template Hub

1. Navigate to a matched page.  
2. Click the **“Templates”** button in the top-right corner.  
3. Select a template and click to insert.  
4. If the template contains `[placeholders]`, a small modal will ask you to fill them before insertion.

---

## 📑 Template Structure

Templates are stored as an array of objects in browser storage:

```json
{
  "process": "General",
  "category": "Follow-ups",
  "name": "Reminder: Pending Action",
  "body": "Hi [Name],\n\nThis is a reminder about [Item].\n\nThanks,\n[Sender]",
  "starred": false
}
```

Fields:

- `process` – logical grouping (e.g., “General”, “Finance”, “Support”)  
- `category` – subgroup within a process (e.g., “Reminders”, “Approvals”)  
- `name` – visible title of the template  
- `body` – the text to insert (supports `[placeholders]`)  
- `starred` – marks the template as a favorite (boolean)

You can manage templates:

- Via the **Template Manager** UI (⚙ button in the sidebar), or  
- By **exporting/editing/importing** JSON/CSV.

---

## 🔐 Privacy & Safety

This repository contains **only a generic, demo-friendly version** of the original project:

- No real company names or internal systems  
- No confidential URLs or selectors  
- No real templates, customer data, or vendor data  
- No references to internal processes or tooling

The focus is on demonstrating:

- Your ability to design and build a complex userscript  
- UI/UX decisions  
- Automation / productivity improvements

---

## 💡 Possible Extensions

Some ideas if you want to enhance the demo further:

- Add **per-portal configuration** (enable/disable categories per site)
- Add **rich-text support** for HTML editors
- Add **template tags** and advanced filtering
- Add **team sharing** via remote JSON endpoint (if hosted somewhere safe)

---

## 📄 License

You can choose the license you prefer (e.g., MIT):

MIT License – feel free to modify and adapt for your own non-confidential use.

---

## 👩🏽‍💻 About

This demo script is based on an internal automation created to reduce repetitive typing, standardize communication, and speed up operations across multiple portals.

All sensitive elements have been removed or replaced with generic examples for public sharing.

