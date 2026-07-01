/* ================================================================
   diary.js  —  Munan.hub Diary Tool Logic
   Firebase 10.x CDN (ESM) — same project as auth.js / login.html
   ================================================================ */

import { initializeApp, getApps, getApp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, collection, doc, setDoc, updateDoc,
    query, where, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE INIT ────────────────────────────────────────────
// Same config as auth.js. Re-initializing with an identical config
// against the same default app name is safe in the Firebase SDK —
// getApps()/getApp() guards against the "already exists" error in
// case auth.js (or another module) initialized it first on this page.
const firebaseConfig = {
    apiKey:            "AIzaSyDl0Cqhjj-X9SjwMrrTWi_lW4ADsI8Gnq0",
    authDomain:        "login-system-309fc.firebaseapp.com",
    projectId:         "login-system-309fc",
    storageBucket:     "login-system-309fc.firebasestorage.app",
    messagingSenderId: "509365590175",
    appId:             "1:509365590175:web:2a1de8ab7688a96853aaaa",
    measurementId:     "G-M6V63MYZN6"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── CONSTANTS ────────────────────────────────────────────────
const MAX_SECTIONS = 10;
const COLLECTION   = "diaryEntries";
const ACCENT_HEX   = "#0284c7"; // fixed brand color for PDF (theme-independent)

// ── STATE ────────────────────────────────────────────────────
let currentUser   = null;
let editingDocId  = null;      // null = creating new entry; set = editing existing doc
let sectionIdSeq  = 0;         // increments to give each section row a unique DOM id
let historyLimit  = 10;        // 10 | 50 | 'all'
let cachedEntries = [];        // last fetched batch, reused for PDF export so we don't re-query

// ── DOM REFS ─────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const gate            = $("#diary-gate");
const gateContent     = $("#diary-gate-content");
const appRoot         = $("#diary-app");
const navLoginBtn     = $("#nav-login-btn");
const navLogoutBtn    = $("#nav-logout-btn");
const themeToggleBtn  = $("#theme-toggle");

const entryDateInput  = $("#entry-date");
const entryTimeInput  = $("#entry-time");
const sectionsContainer = $("#sections-container");
const addSectionBtn   = $("#add-section-btn");
const sectionCapMsg   = $("#section-cap-msg");
const saveEntryBtn    = $("#save-entry-btn");
const saveBtnLabel    = $("#save-btn-label");
const clearFormBtn    = $("#clear-form-btn");
const editingBanner   = $("#editing-banner");
const editingBannerText = $("#editing-banner-text");
const cancelEditBtn   = $("#cancel-edit-btn");

const entryListEl     = $("#entry-list");
const downloadPdfBtn  = $("#download-pdf-btn");
const filterBtns      = document.querySelectorAll(".diary-filter-btn");
const toastEl         = $("#diary-toast");

// ════════════════════════════════════════════════════════════
//  THEME (mirrors the toggle pattern used on index.html)
// ════════════════════════════════════════════════════════════
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("munan_theme", theme);
    if (themeToggleBtn) {
        themeToggleBtn.innerHTML = theme === "dark"
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }
}
(function initTheme() {
    const saved = localStorage.getItem("munan_theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
})();
themeToggleBtn?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
});

// ════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.toggle("error", isError);
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

// ════════════════════════════════════════════════════════════
//  AUTH GATE
// ════════════════════════════════════════════════════════════
function renderLoggedOutGate() {
    gateContent.innerHTML = `
        <div class="diary-gate-card">
            <i class="lock-icon fas fa-lock"></i>
            <h2>Login required</h2>
            <p>Your diary is private. Log in to write, view, and export your entries.</p>
            <a href="login.html?redirect=diary.html" class="diary-btn diary-btn-primary">
                <i class="fas fa-right-to-bracket"></i> Go to Login
            </a>
        </div>`;
    gate.style.display = "flex";
    appRoot.style.display = "none";
}

function unlockApp() {
    gate.style.display = "none";
    appRoot.style.display = "block";
}

onAuthStateChanged(auth, (user) => {
    if (user && user.emailVerified) {
        currentUser = user;
        navLoginBtn.style.display = "none";
        navLogoutBtn.style.display = "inline-flex";
        unlockApp();
        resetFormToNew();         // seed one default section, today's date/time
        loadHistory();             // initial fetch for History tab
    } else {
        currentUser = null;
        navLoginBtn.style.display = "inline-flex";
        navLogoutBtn.style.display = "none";
        renderLoggedOutGate();
    }
});

navLogoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    // onAuthStateChanged will re-render the gate automatically
});

// ════════════════════════════════════════════════════════════
//  TAB SWITCHING (Write / History)
// ════════════════════════════════════════════════════════════
document.querySelectorAll(".diary-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".diary-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".diary-view").forEach((v) => v.classList.remove("active"));
        tab.classList.add("active");
        $(`#view-${tab.dataset.tab}`).classList.add("active");
    });
});

// ════════════════════════════════════════════════════════════
//  SECTION MANAGEMENT (Write form)
// ════════════════════════════════════════════════════════════
function sectionCount() {
    return sectionsContainer.children.length;
}

function updateAddSectionVisibility() {
    const atMax = sectionCount() >= MAX_SECTIONS;
    addSectionBtn.hidden = atMax;
    sectionCapMsg.style.display = atMax ? "block" : "none";
}

function updateRemoveButtonsVisibility() {
    const onlyOne = sectionCount() <= 1;
    sectionsContainer.querySelectorAll(".diary-section-remove").forEach((btn) => {
        btn.style.display = onlyOne ? "none" : "flex";
    });
}

/**
 * Adds one section row to the form.
 * title/content prefill is used when loading an entry for edit.
 */
function addSectionRow(title = "", content = "") {
    if (sectionCount() >= MAX_SECTIONS) return;

    sectionIdSeq += 1;
    const rowId = `sec-${sectionIdSeq}`;
    const placeholderNum = sectionCount() + 1;

    const row = document.createElement("div");
    row.className = "diary-section";
    row.dataset.rowId = rowId;
    row.innerHTML = `
        <div class="diary-section-head">
            <input type="text" class="section-title-input" placeholder="Section ${placeholderNum}" value="${escapeAttr(title)}">
            <button type="button" class="diary-section-remove" aria-label="Remove section" title="Remove section">
                <i class="fas fa-xmark"></i>
            </button>
        </div>
        <textarea class="section-content-input" placeholder="Write here…">${escapeHtml(content)}</textarea>
    `;
    sectionsContainer.appendChild(row);

    row.querySelector(".diary-section-remove").addEventListener("click", () => {
        if (sectionCount() <= 1) return; // guard — can't remove the last one
        row.remove();
        updateAddSectionVisibility();
        updateRemoveButtonsVisibility();
    });

    updateAddSectionVisibility();
    updateRemoveButtonsVisibility();
}

addSectionBtn.addEventListener("click", () => addSectionRow());

function clearSections() {
    sectionsContainer.innerHTML = "";
}

// ════════════════════════════════════════════════════════════
//  FORM ↔ DATA HELPERS
// ════════════════════════════════════════════════════════════
function todayDateString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function nowTimeString() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mi}`;
}

function resetFormToNew() {
    editingDocId = null;
    editingBanner.classList.remove("active");
    saveBtnLabel.textContent = "Save Entry";
    entryDateInput.value = todayDateString();
    entryTimeInput.value = nowTimeString();
    clearSections();
    addSectionRow(); // exactly one default section
}

clearFormBtn.addEventListener("click", () => {
    resetFormToNew();
    showToast("Form cleared");
});

cancelEditBtn.addEventListener("click", () => {
    resetFormToNew();
});

/** Reads the current Write form into a plain object (no Firestore-specific fields). */
function readFormData() {
    const dateVal = entryDateInput.value;
    const timeVal = entryTimeInput.value || "00:00";
    if (!dateVal) return { error: "Please pick a date for this entry." };

    // Combine date + time into one ISO-ish local string for clean sorting.
    // Stored as "YYYY-MM-DDTHH:MM:00" (local time, no offset) so that
    // string sort order == chronological order == what the date/time
    // pickers showed, with no timezone-shift surprises on reload.
    const datetime = `${dateVal}T${timeVal}:00`;

    const sectionEls = [...sectionsContainer.querySelectorAll(".diary-section")];
    if (sectionEls.length === 0) return { error: "Add at least one section." };

    const sections = sectionEls.map((el, i) => {
        const titleInput = el.querySelector(".section-title-input");
        const contentInput = el.querySelector(".section-content-input");
        const title = titleInput.value.trim() || titleInput.placeholder; // fall back to "Section N" placeholder
        const content = contentInput.value; // intentionally not trimmed — preserves user's line breaks/spacing
        return { title, content };
    });

    const hasAnyContent = sections.some((s) => s.content.trim().length > 0);
    if (!hasAnyContent) return { error: "Write something in at least one section before saving." };

    return { datetime, sections };
}

/** Loads a Firestore entry doc into the Write form for editing. */
function loadEntryIntoForm(entryDoc) {
    editingDocId = entryDoc.id;
    editingBanner.classList.add("active");
    editingBannerText.textContent =
        `Editing entry from ${formatDateLabel(entryDoc.datetime)} · ${formatTimeLabel(entryDoc.datetime)}`;
    saveBtnLabel.textContent = "Update Entry";

    const [datePart, timePart] = entryDoc.datetime.split("T");
    entryDateInput.value = datePart || todayDateString();
    entryTimeInput.value = (timePart || "00:00").slice(0, 5);

    clearSections();
    const sections = entryDoc.sections && entryDoc.sections.length ? entryDoc.sections : [{ title: "", content: "" }];
    sections.slice(0, MAX_SECTIONS).forEach((s) => addSectionRow(s.title, s.content));

    // Jump to Write tab so the user actually sees the loaded form
    document.querySelector('.diary-tab[data-tab="write"]').click();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ════════════════════════════════════════════════════════════
//  SAVE (create or update)
// ════════════════════════════════════════════════════════════
saveEntryBtn.addEventListener("click", async () => {
    if (!currentUser) { showToast("You need to be logged in.", true); return; }

    const data = readFormData();
    if (data.error) { showToast(data.error, true); return; }

    saveEntryBtn.disabled = true;
    // Snapshot isEditing BEFORE any await — editingDocId gets mutated mid-flow
    // for new entries (set to newRef.id after first save), so we can't re-read
    // it safely inside the finally block.
    const wasEditing = !!editingDocId;
    saveBtnLabel.textContent = wasEditing ? "Updating…" : "Saving…";

    try {
        if (wasEditing) {
            // Update the SAME document — never creates a duplicate.
            await updateDoc(doc(db, COLLECTION, editingDocId), {
                datetime: data.datetime,
                sections: data.sections,
                updatedAt: serverTimestamp(),
            });
            showToast("Entry updated.");
        } else {
            // doc() with no ID generates a new auto-ID client-side; we grab it
            // immediately so subsequent saves in this session hit the same doc.
            const newRef = doc(collection(db, COLLECTION));
            await setDoc(newRef, {
                userId: currentUser.uid,
                datetime: data.datetime,
                sections: data.sections,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            editingDocId = newRef.id;
            editingBanner.classList.add("active");
            editingBannerText.textContent = `Editing entry from ${formatDateLabel(data.datetime)} · ${formatTimeLabel(data.datetime)}`;
            saveBtnLabel.textContent = "Update Entry";
            showToast("Entry saved.");
        }
        await loadHistory(); // refresh History tab so it reflects the save immediately
    } catch (err) {
        console.error("Diary save failed:", err);
        // TEMP DEBUG: showing the real Firebase error code/message on-screen
        // so it's visible on mobile without DevTools. Revert to the generic
        // message once the root cause is confirmed and fixed.
        const debugMsg = `Save failed: ${err.code || "no-code"} — ${err.message || err}`;
        showToast(debugMsg, true);
        alert(debugMsg); // guaranteed full-text, unstyled — remove once confirmed
        // Restore label to pre-attempt state using the snapshot, not the live flag
        saveBtnLabel.textContent = wasEditing ? "Update Entry" : "Save Entry";
    } finally {
        saveEntryBtn.disabled = false;
    }
});

// ════════════════════════════════════════════════════════════
//  HISTORY (list + filter)
// ════════════════════════════════════════════════════════════
filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        historyLimit = btn.dataset.limit === "all" ? "all" : parseInt(btn.dataset.limit, 10);
        loadHistory();
    });
});

// NOTE — Firestore composite index required:
// Collection: diaryEntries  |  Fields: userId ASC, datetime DESC
// First query on a fresh project will throw with a URL to auto-create it.
// Click that URL once in the browser console and it's done.
async function loadHistory() {
    if (!currentUser) return;
    entryListEl.innerHTML = `<div class="diary-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading entries…</div>`;

    try {
        const baseQuery = [
            collection(db, COLLECTION),
            where("userId", "==", currentUser.uid),
            orderBy("datetime", "desc"),
        ];
        const q = historyLimit === "all"
            ? query(...baseQuery)
            : query(...baseQuery, limit(historyLimit));

        const snap = await getDocs(q);
        cachedEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderEntryList(cachedEntries);
    } catch (err) {
        console.error("Diary history fetch failed:", err);
        entryListEl.innerHTML = `<div class="diary-empty"><i class="fas fa-triangle-exclamation"></i><p>Couldn't load entries. Check your connection and try again.</p></div>`;
    }
}

function renderEntryList(entries) {
    if (!entries.length) {
        entryListEl.innerHTML = `
            <div class="diary-empty">
                <i class="fas fa-feather"></i>
                <p>No entries yet — your first one is one tab away.</p>
            </div>`;
        downloadPdfBtn.disabled = true;
        return;
    }
    downloadPdfBtn.disabled = false;

    entryListEl.innerHTML = entries.map((entry) => {
        const first = entry.sections && entry.sections[0] ? entry.sections[0] : { title: "Untitled", content: "" };
        const sectionsArr = entry.sections || [];
        const snippet = (first.content || "").trim().slice(0, 90).replace(/\n+/g, " ");
        const d = new Date(entry.datetime);
        const dayNum = isNaN(d) ? "--" : d.getDate();
        const monthAbbr = isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short" });
        return `
            <div class="diary-entry" data-doc-id="${entry.id}">
                <div class="diary-entry-date"><span class="d">${dayNum}</span><span class="m">${monthAbbr}</span></div>
                <div class="diary-entry-body">
                    <div class="diary-entry-title">${escapeHtml(first.title || "Untitled")}${sectionsArr.length > 1 ? ` <span style="opacity:.55;font-weight:500;">+${sectionsArr.length - 1} more</span>` : ""}</div>
                    <div class="diary-entry-snippet">${escapeHtml(snippet) || "<em style=\"opacity:.6;\">No content</em>"}</div>
                </div>
                <div class="diary-entry-time">${formatTimeLabel(entry.datetime)}</div>
                <i class="fas fa-chevron-right diary-entry-arrow"></i>
            </div>`;
    }).join("");

    entryListEl.querySelectorAll(".diary-entry").forEach((el) => {
        el.addEventListener("click", () => {
            const entry = cachedEntries.find((e) => e.id === el.dataset.docId);
            if (entry) loadEntryIntoForm(entry);
        });
    });
}

// ════════════════════════════════════════════════════════════
//  DATE / TIME FORMATTING HELPERS
// ════════════════════════════════════════════════════════════
function formatDateLabel(datetime) {
    const d = new Date(datetime);
    if (isNaN(d)) return datetime;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function formatTimeLabel(datetime) {
    const d = new Date(datetime);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}
function escapeAttr(str) {
    return (str ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ════════════════════════════════════════════════════════════
//  PDF EXPORT (html2pdf.js — respects the active history filter)
// ════════════════════════════════════════════════════════════
downloadPdfBtn.addEventListener("click", async () => {
    if (!cachedEntries.length) { showToast("No entries to export yet.", true); return; }

    downloadPdfBtn.disabled = true;
    const originalHtml = downloadPdfBtn.innerHTML;
    downloadPdfBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Building PDF…';

    try {
        const printRoot = buildPrintableDocument(cachedEntries);
        document.body.appendChild(printRoot);

        await window.html2pdf()
            .set({
                margin:       [14, 12, 16, 12], // mm: top, left, bottom, right
                filename:     `Munans-Diary-${todayDateString()}.pdf`,
                image:        { type: "jpeg", quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
                jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
                pagebreak:    { mode: ["css", "legacy"] },
            })
            .from(printRoot)
            .toPdf()
            .get("pdf")
            .then((pdf) => {
                // Footer page numbers — added after layout so total page count is known
                const totalPages = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    pdf.setFontSize(8.5);
                    pdf.setTextColor(120, 130, 145);
                    const pageW = pdf.internal.pageSize.getWidth();
                    const pageH = pdf.internal.pageSize.getHeight();
                    pdf.text(`${i} / ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
                }
            })
            .save();

        printRoot.remove();
        showToast("PDF downloaded.");
    } catch (err) {
        console.error("PDF export failed:", err);
        showToast("PDF export failed — please try again.", true);
    } finally {
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.innerHTML = originalHtml;
    }
});

/**
 * Builds an off-screen, print-styled DOM tree (light theme, fixed colors —
 * independent of the live page's data-theme) representing every entry in
 * `entries`, for html2pdf.js to rasterize. Returns the root element.
 */
function buildPrintableDocument(entries) {
    const root = document.createElement("div");
    root.style.cssText = `
        position: fixed; left: -9999px; top: 0; width: 190mm;
        background: #ffffff; color: #0f172a;
        font-family: 'Poppins', 'Hind Siliguri', sans-serif;
        padding: 4mm 2mm;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
        text-align: center; padding-bottom: 14px; margin-bottom: 18px;
        border-bottom: 2.5px solid ${ACCENT_HEX};
    `;
    header.innerHTML = `
        <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">
            Munan's <span style="color:${ACCENT_HEX};">Diary</span>
        </div>
        <div style="font-size:10.5px;color:#64748b;margin-top:5px;letter-spacing:0.04em;text-transform:uppercase;">
            ${entries.length} ${entries.length === 1 ? "entry" : "entries"} · exported ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
    `;
    root.appendChild(header);

    entries.forEach((entry, idx) => {
        const entryBlock = document.createElement("div");
        entryBlock.style.cssText = `
            margin-bottom: 22px; padding-bottom: 18px;
            ${idx < entries.length - 1 ? "border-bottom: 1px solid #e2e8f0;" : ""}
            page-break-inside: avoid;
        `;

        const dateHeading = document.createElement("div");
        dateHeading.style.cssText = `
            display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px;
        `;
        dateHeading.innerHTML = `
            <div style="width:5px;height:18px;background:${ACCENT_HEX};border-radius:3px;flex-shrink:0;"></div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(formatDateLabel(entry.datetime))}</div>
            <div style="font-size:11px;font-weight:600;color:#64748b;">${escapeHtml(formatTimeLabel(entry.datetime))}</div>
        `;
        entryBlock.appendChild(dateHeading);

        (entry.sections || []).forEach((sec) => {
            const secEl = document.createElement("div");
            secEl.style.cssText = `margin-bottom: 12px; margin-left: 15px; page-break-inside: avoid;`;
            secEl.innerHTML = `
                <div style="font-size:12px;font-weight:700;color:${ACCENT_HEX};margin-bottom:4px;letter-spacing:0.02em;">
                    ${escapeHtml(sec.title || "Untitled")}
                </div>
                <div style="font-size:11px;line-height:1.7;color:#334155;white-space:pre-wrap;">
                    ${escapeHtml(sec.content || "")}
                </div>
            `;
            entryBlock.appendChild(secEl);
        });

        root.appendChild(entryBlock);
    });

    return root;
}
