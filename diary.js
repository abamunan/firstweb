/* ================================================================
   diary.js  —  Munan.hub Diary Tool Logic
   Firebase 10.x CDN (ESM) — same project as auth.js / login.html
   ================================================================ */

import { initializeApp, getApps, getApp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
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

// ── TEMP DEBUG HOOK (safe to remove once PDF export is confirmed working) ──
// Since diary.js is a module, its functions aren't reachable from the
// console normally. This exposes what's needed to visually check whether
// buildPrintableDocument() is producing real content, independent of
// whether html2canvas can capture it.
window.__diaryDebug = {
    showPrintable() {
        const r = buildPrintableDocument(cachedEntries);
        r.style.cssText += "position:fixed;top:0;left:0;z-index:999999;overflow:auto;max-height:100vh;box-shadow:0 0 0 9999px rgba(0,0,0,.6);";
        document.body.appendChild(r);
        return r;
    }
};

// ── DOM REFS ─────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const gate            = $("#diary-gate");
const gateContent     = $("#diary-gate-content");
const appRoot         = $("#diary-app");

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

// NOTE: Theme is handled entirely by the shared theme.js script tag
// in <head> (loaded before this module). It applies the persisted
// theme on load and exposes window.MunanTheme for any page that has
// a visible toggle button. This page has none, so there's nothing
// to wire up here — see theme.js for the single source of truth.

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

/** Stringifies any error shape (Error instance, plain object, string, etc.) for logging. */
function safeStringifyError(err) {
    try {
        if (err instanceof Error) {
            return JSON.stringify({ name: err.name, code: err.code, message: err.message, stack: err.stack });
        }
        return JSON.stringify(err, Object.getOwnPropertyNames(err || {}));
    } catch {
        return String(err);
    }
}

/** Builds a guaranteed-non-blank, human-readable message from any error shape. */
function buildErrorMessage(err, actionLabel) {
    if (err && err.code === "permission-denied") {
        return `${actionLabel} blocked: you don't have permission (check Firestore rules or that you're logged in).`;
    }
    if (err && err.code === "failed-precondition") {
        return `${actionLabel} failed: a required Firestore index is missing. Check the browser console for a link to create it.`;
    }
    if (err && err.code === "unavailable") {
        return `${actionLabel} failed: couldn't reach the server. Check your connection and try again.`;
    }
    const code = err && err.code;
    const message = err && err.message;
    if (code || message) {
        return `${actionLabel} failed: ${code || "unknown-code"} — ${message || "no message"}`;
    }
    // Last resort — guarantees we never show a blank toast.
    return `${actionLabel} failed: ${safeStringifyError(err) || "unknown error (see console)"}`;
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
        unlockApp();
        resetFormToNew();         // seed one default section, today's date/time
        loadHistory();             // initial fetch for History tab
    } else {
        currentUser = null;
        renderLoggedOutGate();
    }
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
        await loadHistory(true); // refresh History tab; silent=true so a refresh failure
                                   // (e.g. missing composite index) can't overwrite/mask
                                   // the "Entry saved." toast shown above
    } catch (err) {
        // Full dump so we can see the real shape of the error in DevTools.
        console.error("Diary save failed — raw error object:", err);
        console.error("Diary save failed — code:", err && err.code);
        console.error("Diary save failed — message:", err && err.message);
        console.error("Diary save failed — stringified:", safeStringifyError(err));

        const readableMsg = buildErrorMessage(err, "Save");
        showToast(readableMsg, true);
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
async function loadHistory(silent = false) {
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
        console.error("Diary history fetch failed — raw error object:", err);
        console.error("Diary history fetch failed — code:", err && err.code);
        console.error("Diary history fetch failed — stringified:", safeStringifyError(err));
        entryListEl.innerHTML = `<div class="diary-empty"><i class="fas fa-triangle-exclamation"></i><p>Couldn't load entries. Check your connection and try again.</p></div>`;
        // silent=true is used for the auto-refresh right after a save — that save
        // already succeeded and told the user so via toast. Showing a second,
        // unrelated error toast here would overwrite/mask that success message
        // and make it look like the SAVE failed, when only this refresh did.
        if (!silent) showToast(buildErrorMessage(err, "Loading entries"), true);
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

        // Wrapper clips the printable doc from view WITHOUT touching the
        // printable doc's own styles. Earlier attempts (left:-9999px,
        // z-index:-1, opacity:0.01) all modified the target element itself —
        // html2canvas renders exactly what it's told to render, so hiding
        // tricks applied to that same element corrupt the capture:
        //   • negative offset -> coordinates get clamped/lost
        //   • negative z-index -> some mobile WebViews drop it from the paint layer
        //   • near-zero opacity -> gets crushed to invisible at JPEG encode time
        // A wrapper with overflow:hidden + height:0 hides it from the *user*
        // (nothing paints outside the wrapper's box on screen) while the
        // printRoot element passed to html2pdf is left completely normal —
        // full opacity, positive z-index, in-flow — so html2canvas captures
        // it exactly as authored.
        const hideWrapper = document.createElement("div");
        hideWrapper.style.cssText = "position: absolute; top: 0; left: 0; width: 0; height: 0; overflow: hidden;";
        hideWrapper.appendChild(printRoot);
        document.body.appendChild(hideWrapper);

        await window.html2pdf()
            .set({
                margin:       [14, 12, 16, 12], // mm: top, left, bottom, right
                filename:     `Munans-Diary-${todayDateString()}.pdf`,
                image:        { type: "jpeg", quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 900 },
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

        hideWrapper.remove();
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
        width: 190mm;
        background: #ffffff; color: #2c3e50;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                     'Hind Siliguri', Helvetica, Arial, sans-serif;
        padding: 6mm 2mm;
        -webkit-font-smoothing: antialiased;
    `;
    // Visibility/hiding is handled entirely by the wrapper in the click
    // handler (overflow:hidden; height:0), NOT by styles on this element —
    // see the notes on hideWrapper above. This element stays fully normal
    // so html2canvas captures it exactly as authored.

    // ── HEADER ──────────────────────────────────────────────────
    const header = document.createElement("div");
    header.style.cssText = `
        text-align: center; padding-bottom: 16px; margin-bottom: 26px;
        border-bottom: 1px solid #e2e8f0;
    `;
    header.innerHTML = `
        <div style="font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#1e293b;">
            Munan's <span style="color:${ACCENT_HEX};font-weight:800;">Diary</span>
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-top:6px;font-weight:500;">
            ${entries.length} ${entries.length === 1 ? "entry" : "entries"} · exported ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
    `;
    root.appendChild(header);

    // ── ENTRY CARDS ─────────────────────────────────────────────
    entries.forEach((entry, idx) => {
        const entryCard = document.createElement("div");
        entryCard.style.cssText = `
            background: #ffffff;
            border: 1px solid #e2e8f0; border-radius: 10px;
            padding: 18px 20px;
            margin-bottom: 16px;
            page-break-inside: avoid; break-inside: avoid;
        `;
        // Cards are capped at one diary entry's worth of sections, which in
        // practice is short enough that "avoid" is safe here — unlike the
        // old borderless flowing layout, each card is a small bounded unit
        // so html2pdf's css pagebreak mode can always find a legal break
        // point (between cards), instead of failing to place an oversized
        // block and rendering blank.

        const dateHeading = document.createElement("div");
        dateHeading.style.cssText = `
            display: flex; align-items: baseline; gap: 9px; margin-bottom: 14px;
            padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;
        `;
        dateHeading.innerHTML = `
            <div style="width:4px;height:16px;background:${ACCENT_HEX};border-radius:2px;flex-shrink:0;"></div>
            <div style="font-size:14px;font-weight:700;color:#1e293b;">${escapeHtml(formatDateLabel(entry.datetime))}</div>
            <div style="font-size:12px;font-weight:500;color:#94a3b8;">${escapeHtml(formatTimeLabel(entry.datetime))}</div>
        `;
        entryCard.appendChild(dateHeading);

        (entry.sections || []).forEach((sec, secIdx) => {
            const secEl = document.createElement("div");
            const isLast = secIdx === (entry.sections.length - 1);
            secEl.style.cssText = `margin-bottom: ${isLast ? "0" : "14px"};`;
            secEl.innerHTML = `
                <div style="font-size:11.5px;font-weight:700;color:${ACCENT_HEX};margin-bottom:5px;letter-spacing:0.03em;text-transform:uppercase;">
                    ${escapeHtml(sec.title || "Untitled")}
                </div>
                <div style="font-size:13.5px;line-height:1.6;color:#2c3e50;white-space:pre-wrap;">
                    ${escapeHtml(sec.content || "")}
                </div>
            `;
            entryCard.appendChild(secEl);
        });

        root.appendChild(entryCard);
    });

    return root;
}
