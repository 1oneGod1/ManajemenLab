"use strict";

/* ===========================
   STATE  (populated from Firebase)
=========================== */
let facilities = [];
let damageReports = [];
let activities = [];

let globalFacilitiesRaw = [];
let globalReportsRaw = [];
let labFacilitiesRaw = [];
let labReportsRaw = [];

// Dynamic lab & room lists (from Firebase dev_config)
let devLabs = [];
let devRooms = [];

const DEFAULT_LAB_NAMES = ["Computer Lab", "Physics Lab", "Chemistry Lab", "Biology Lab"];
let LAB_NAMES = [...DEFAULT_LAB_NAMES];
const LAB_CONDITION_TO_GLOBAL = {
  "Sangat Baik": "Excellent",
  Baik: "Good",
  Cukup: "Fair",
  Rusak: "Poor",
};
const REPORT_STATUS_TO_GLOBAL = {
  "Belum Ditangani": "Open",
  "Sedang Diperbaiki": "In Progress",
  Selesai: "Resolved",
};
const REPORT_STATUS_TO_LAB = {
  Open: "Belum Ditangani",
  "In Progress": "Sedang Diperbaiki",
  Resolved: "Selesai",
};
const REPORT_PRIORITY_TO_GLOBAL = {
  Rendah: "Low",
  Sedang: "Medium",
  Tinggi: "High",
  Kritis: "Critical",
};

/* ===========================
   DEVELOPER AUTH
=========================== */
const DEVELOPER_EMAILS = ["pandapotanandi@gmail.com"];
let _devAuthed = false;

window.showPage = function (page) {
  if (page === "developer" && !_devAuthed) {
    // Store intended page, show login modal
    openDeveloperLogin();
    return;
  }
  _doShowPage(page);
};

function _doShowPage(page) {
  document
    .querySelectorAll(".page-panel")
    .forEach((panel) => panel.classList.add("hidden"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });
}

function openDeveloperLogin() {
  const err = document.getElementById("devLoginErr");
  if (err) { err.style.display = "none"; err.textContent = ""; }
  const emailEl = document.getElementById("devLoginEmail");
  const passEl = document.getElementById("devLoginPassword");
  if (emailEl) emailEl.value = "";
  if (passEl) passEl.value = "";
  document.getElementById("devLoginModal").classList.add("open");
  setTimeout(() => { if (emailEl) emailEl.focus(); }, 100);
}

window.closeDeveloperLogin = function () {
  document.getElementById("devLoginModal").classList.remove("open");
  // Re-activate previously active nav item
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === "dashboard");
  });
};

window.submitDeveloperLogin = async function () {
  const email = (document.getElementById("devLoginEmail")?.value || "").trim().toLowerCase();
  const password = document.getElementById("devLoginPassword")?.value || "";
  const errBox = document.getElementById("devLoginErr");
  const btn = document.getElementById("devLoginBtn");

  if (!email || !password) {
    errBox.textContent = "Email dan password wajib diisi.";
    errBox.style.display = "block";
    return;
  }
  if (!DEVELOPER_EMAILS.includes(email)) {
    errBox.textContent = "Akun ini tidak memiliki akses developer.";
    errBox.style.display = "block";
    return;
  }
  if (typeof auth === "undefined") {
    errBox.textContent = "Firebase Auth belum siap. Muat ulang halaman.";
    errBox.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Memverifikasi…";
  errBox.style.display = "none";

  try {
    await auth.signInWithEmailAndPassword(email, password);
    _devAuthed = true;
    document.getElementById("devLoginModal").classList.remove("open");
    _doShowPage("developer");
    showToast("Developer mode aktif.");
  } catch (err) {
    const msg = err.code === "auth/wrong-password" || err.code === "auth/user-not-found"
      ? "Email atau password salah."
      : err.code === "auth/invalid-email"
      ? "Format email tidak valid."
      : "Login gagal: " + err.message;
    errBox.textContent = msg;
    errBox.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Masuk";
  }
};

/* ===========================
   SESSION & AUTH
=========================== */
const SESSION_LAB = sessionStorage.getItem("loggedInLab");
const SESSION_TEACHER = sessionStorage.getItem("loggedInTeacher");
const SESSION_EMAIL = sessionStorage.getItem("loggedInEmail");

function navigateTo(path) {
  const target = new URL(path, window.location.href).toString();
  try {
    window.location.assign(target);
  } catch (err) {
    window.open(target, "_self");
  }
}

function signOutFirebase() {
  if (typeof auth === "undefined") return Promise.resolve();
  return auth.signOut().catch((err) => {
    console.warn("Firebase signOut gagal:", err);
  });
}

window.exitLabView = function () {
  signOutFirebase().finally(() => {
    sessionStorage.clear();
    navigateTo("index.html");
  });
};

window.goToLab = function (lab) {
  navigateTo("pages/login.html?lab=" + encodeURIComponent(lab));
};

/* ===========================
   PAGINATION STATE
=========================== */
let currentPage = 1;
const rowsPerPage = 5;
let filteredFacilities = [];

let currentDamageReportPage = 1;
const damageReportsPerPage = 6;
let filteredDamageReports = [];

/* ===========================
   FIREBASE REAL-TIME LISTENERS
=========================== */
function initFirebaseListeners() {
  // Show loading placeholders
  const tbody = document.getElementById("facilitiesBody");
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Memuat data dari Firebase…</td></tr>';
  }

  // --- Fasilitas ---
  db.ref("fasilitas").on(
    "value",
    (snap) => {
      const next = [];
      snap.forEach((child) => {
        next.push(
          normalizeFacilityRecord(child.val(), {
            key: child.key,
            source: "global",
            dbPath: "fasilitas/" + child.key,
          }),
        );
      });
      globalFacilitiesRaw = next;
      syncMergedState();
    },
    (err) => {
      console.error("Firebase fasilitas error:", err);
      showToast("⚠ Gagal memuat fasilitas: " + err.message);
    },
  );

  // --- Laporan Kerusakan ---
  db.ref("laporan").on(
    "value",
    (snap) => {
      const next = [];
      snap.forEach((child) => {
        next.push(
          normalizeReportRecord(child.val(), {
            key: child.key,
            source: "global",
            dbPath: "laporan/" + child.key,
          }),
        );
      });
      globalReportsRaw = next.reverse();
      syncMergedState();
    },
    (err) => {
      console.error("Firebase laporan error:", err);
      showToast("⚠ Gagal memuat laporan: " + err.message);
    },
  );

  // --- Agregasi data semua manajemen lab ---
  db.ref("lab_data").on(
    "value",
    (snap) => {
      const nextFacilities = [];
      const nextReports = [];

      snap.forEach((labNode) => {
        const labName = labNode.key;

        const itemsNode = labNode.child("items");
        itemsNode.forEach((itemNode) => {
          nextFacilities.push(
            normalizeFacilityRecord(itemNode.val(), {
              key: itemNode.key,
              lab: labName,
              source: "lab_data",
              dbPath: `lab_data/${labName}/items/${itemNode.key}`,
            }),
          );
        });

        const laporanNode = labNode.child("laporan");
        laporanNode.forEach((reportNode) => {
          nextReports.push(
            normalizeReportRecord(reportNode.val(), {
              key: reportNode.key,
              lab: labName,
              source: "lab_data",
              dbPath: `lab_data/${labName}/laporan/${reportNode.key}`,
            }),
          );
        });
      });

      labFacilitiesRaw = nextFacilities;
      labReportsRaw = nextReports.reverse();
      syncMergedState();
    },
    (err) => {
      console.error("Firebase lab_data error:", err);
      showToast("⚠ Gagal memuat data agregasi lab: " + err.message);
    },
  );

  // --- Dev config: labs ---
  db.ref("dev_config/labs").on(
    "value",
    (snap) => {
      devLabs = [];
      snap.forEach((child) => {
        devLabs.push({ _key: child.key, ...child.val() });
      });
      const customNames = devLabs.map((l) => l.name);
      LAB_NAMES = [
        ...DEFAULT_LAB_NAMES,
        ...customNames.filter((n) => !DEFAULT_LAB_NAMES.includes(n)),
      ];
      renderSidebarLabList();
      renderDevLabGrid();
    },
    (err) => console.error("Firebase dev_config/labs error:", err),
  );

  // --- Dev config: rooms ---
  db.ref("dev_config/rooms").on(
    "value",
    (snap) => {
      devRooms = [];
      snap.forEach((child) => {
        devRooms.push({ _key: child.key, ...child.val() });
      });
      renderDevRoomGrid();
    },
    (err) => console.error("Firebase dev_config/rooms error:", err),
  );

  // --- Dev config: custom sections & items ---
  initDevSectionsListener();
  initDevSectionItemsListener();

  // --- Activity feed lintas halaman ---
  db.ref("activity_log")
    .limitToLast(80)
    .on(
      "value",
      (snap) => {
        const next = [];
        snap.forEach((child) => {
          next.push({ _key: child.key, ...child.val() });
        });
        activities = next.sort(
          (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0),
        );
        renderActivities();
      },
      (err) => {
        console.error("Firebase activity_log error:", err);
      },
    );
}

function normalizeConditionForGlobal(condition) {
  return LAB_CONDITION_TO_GLOBAL[condition] || condition || "Good";
}

function normalizeStatusForGlobal(status) {
  return REPORT_STATUS_TO_GLOBAL[status] || status || "Open";
}

function normalizePriorityForGlobal(priority) {
  return REPORT_PRIORITY_TO_GLOBAL[priority] || priority || "Medium";
}

/**
 * Convert old R2 public-bucket URLs (pub-*.r2.dev) to worker-served URLs.
 * The path segment is identical between the two — only the domain differs.
 */
function fixR2PhotoUrl(url) {
  if (!url) return url;
  return url.replace(
    /^https:\/\/pub-[a-f0-9]+\.r2\.dev\//,
    "https://alp-r2-uploader.pandapotanandi.workers.dev/file/",
  );
}

function resolvePhotoUrl(record) {
  if (!record || typeof record !== "object") return "";
  const raw =
    record.fotoUrl ||
    record.foto_url ||
    record.photoUrl ||
    record.photo_url ||
    record.imageUrl ||
    record.image_url ||
    "";
  return fixR2PhotoUrl(raw);
}

function normalizeFacilityRecord(record, meta) {
  const source = meta.source || "global";
  const key = meta.key || "";
  const resolvedLab = meta.lab || record.lab || "Unknown Lab";

  return {
    _key: `${source}:${key}`,
    _dbPath: meta.dbPath || "",
    _source: source,
    name: record.name || "Tanpa Nama",
    qty: Number(record.qty) || 0,
    condition: normalizeConditionForGlobal(record.condition || record.cond),
    lab: resolvedLab,
    fotoUrl: resolvePhotoUrl(record),
  };
}

function normalizeReportRecord(record, meta) {
  const source = meta.source || "global";
  const key = meta.key || "";
  const labName = meta.lab || record.lab || "Unknown Lab";
  const status = normalizeStatusForGlobal(record.status);
  const priority = normalizePriorityForGlobal(record.priority || record.prioritas);

  return {
    _key: `${source}:${key}`,
    _dbPath: meta.dbPath || "",
    _source: source,
    id: record.id || `DR-${key.slice(0, 6)}`,
    item: record.item || record.nama || "Tanpa Nama Alat",
    description: record.description || record.desk || "",
    lab: labName,
    status,
    priority,
    assignee: record.assignee || "Unassigned",
    reporter: record.reporter || "Unknown",
    fotoUrl: resolvePhotoUrl(record),
    updatedAt: record.updatedAt || record.tgl || "",
    createdAt: record.createdAt || record.tgl || "",
    overdue:
      typeof record.overdue === "boolean"
        ? record.overdue
        : priority === "Critical" && status !== "Resolved",
  };
}

function syncMergedState() {
  facilities = [...globalFacilitiesRaw, ...labFacilitiesRaw];
  damageReports = [...globalReportsRaw, ...labReportsRaw];
  applyFacilityFilter();
  applyReportFilter();
  renderFacilities();
  renderDamageReports();
  renderActivities();
  updateStats();
}

/* ---------- filter helpers (re-applied after every Firebase push) ---------- */
function applyFacilityFilter() {
  const q = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const base = SESSION_LAB
    ? facilities.filter((f) => f.lab === SESSION_LAB)
    : [...facilities];
  filteredFacilities = q
    ? base.filter(
        (f) =>
          (f.name || "").toLowerCase().includes(q) ||
          (f.lab || "").toLowerCase().includes(q) ||
          (f.condition || "").toLowerCase().includes(q),
      )
    : base;
}

function applyReportFilter() {
  const q = (
    document.getElementById("reportSearchInput")?.value || ""
  ).toLowerCase();
  const lab = document.getElementById("reportLabFilter")?.value || "";
  const status = document.getElementById("reportStatusFilter")?.value || "";
  const priority = document.getElementById("reportPriorityFilter")?.value || "";

  filteredDamageReports = damageReports.filter((r) => {
    const matchText =
      !q ||
      [r.id, r.item, r.lab, r.reporter, r.assignee, r.description].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(q),
      );
    const matchLab = !lab || r.lab === lab;
    const matchStatus = !status || r.status === status;
    const matchPriority = !priority || r.priority === priority;
    return matchText && matchLab && matchStatus && matchPriority;
  });
}

/* ===========================
   SEED DATA - DISABLED
   All data must be entered via the Web UI and persisted to Firebase.
   No hardcoded/local seed data allowed.
   
   To populate data:
   1. Login to the dashboard
   2. Use "Add New Facility" button to add facilities
   3. Use "Create Report" button to add damage reports
   4. Data is automatically persisted to Firebase Realtime Database
=========================== */
// NOTE: seedIfEmpty() removed - Firebase must be the single source of truth

/* ===========================
   INIT
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.protocol === "file:") {
    console.warn(
      "Aplikasi dijalankan dari file://. Gunakan local server untuk menghindari batasan origin browser.",
    );
  }

  // --- Session-based UI ---
  if (SESSION_LAB) {
    const heading = document.querySelector(".page-heading");
    if (heading) heading.textContent = "Dashboard – " + SESSION_LAB;

    const teacher = SESSION_TEACHER || "Unknown";
    const initials = teacher
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const nameEl = document.querySelector(".user-name");
    const avatarEl = document.querySelector(".user-avatar");
    if (nameEl) nameEl.textContent = teacher;
    if (avatarEl) avatarEl.textContent = initials;

    const dropdown = document.getElementById("userDropdown");
    if (dropdown) {
      const logoutLink =
        dropdown.querySelector('a[style*="color:#f87171"]') ||
        dropdown.querySelector("a:last-child");
      if (logoutLink) {
        logoutLink.textContent = "Logout";
        logoutLink.onclick = (e) => {
          e.preventDefault();
          signOutFirebase().finally(() => {
            sessionStorage.clear();
            navigateTo("pages/login.html?lab=" + encodeURIComponent(SESSION_LAB));
          });
        };
      }
    }

    document.querySelectorAll(".nav-sub-item").forEach((el) => {
      if (el.textContent.includes(SESSION_LAB.replace(" Lab", "").trim())) {
        el.style.color = "var(--accent-blue)";
        el.style.fontWeight = "600";
      }
    });

    const banner = document.createElement("div");
    banner.className = "lab-banner";
    banner.innerHTML = `
      <span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        Menampilkan data: <strong>${SESSION_LAB}</strong>
      </span>
      <button onclick="exitLabView()">
        ✕ Keluar dari Lab
      </button>
    `;
    document.querySelector(".page-content").prepend(banner);
  }

  toggleLabList();
  renderActivities();
  setTimeout(loadSettings, 100);

  // Initialize Firebase real-time listeners
  // All data is managed via UI and persisted to Firebase
  initFirebaseListeners();

  // Render default sidebar lab list immediately (Firebase will update it)
  renderSidebarLabList();
});

/* ===========================
   STATS COUNTER
=========================== */
function updateStats() {
  const total = facilities.reduce((s, f) => s + (f.qty || 0), 0);
  const active = damageReports.filter((r) => r.status !== "Resolved").length;
  const availability = Math.max(
    72,
    100 - Math.round((active / Math.max(facilities.length, 1)) * 12),
  );
  setTextIfExists("totalItems", total.toLocaleString());
  setTextIfExists("activeReports", active);
  setTextIfExists("labAvailability", availability + "%");
}

/* ===========================
   ACTIVITY FEED
=========================== */
function renderActivities() {
  const list = document.getElementById("activityList");
  if (!list) return;

  const shown = activities.length ? activities : buildFallbackActivities();
  if (shown.length === 0) {
    list.innerHTML =
      '<div class="activity-item"><div class="act-text" style="color:var(--text-muted)">Belum ada aktivitas.</div></div>';
    return;
  }

  list.innerHTML = shown
    .slice(0, 10)
    .map(
      (a) => `
    <div class="activity-item">
      <div class="act-icon ${escHtml(a.type || "update")}">${escHtml(a.icon || "*")}</div>
      <div>
        <div class="act-time">${escHtml(resolveActivityTime(a))}</div>
        <div class="act-text">${escHtml(a.text || "")}</div>
      </div>
    </div>
  `,
    )
    .join("");
}

function buildFallbackActivities() {
  const reportFallback = [...damageReports]
    .sort((a, b) => {
      const ta = Date.parse(a.updatedAt || "") || 0;
      const tb = Date.parse(b.updatedAt || "") || 0;
      return tb - ta;
    })
    .slice(0, 8)
    .map((r) => ({
      type: r.status === "Resolved" ? "update" : "warn",
      icon: r.status === "Resolved" ? "R" : "!",
      time: r.updatedAt || r.createdAt || "",
      text: `${r.lab || "Lab"}: ${r.item || "Item"} (${r.status || "Open"})`,
    }));

  return reportFallback;
}

function resolveActivityTime(activity) {
  if (activity.time) return activity.time;
  if (activity.timestamp) {
    return new Date(activity.timestamp).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return nowStr();
}

function logActivity(type, icon, text, meta = {}) {
  const entry = {
    type,
    icon,
    text,
    actor: meta.actor || SESSION_TEACHER || "Admin",
    lab: meta.lab || SESSION_LAB || "All Labs",
    source: meta.source || "app",
    timestamp: Date.now(),
    time: new Date().toLocaleString("id-ID"),
  };

  db.ref("activity_log").push(entry).catch((err) => {
    console.warn("Activity log write failed:", err);
  });
}

/* ===========================
   FACILITIES TABLE
=========================== */
function renderFacilities() {
  const body = document.getElementById("facilitiesBody");
  if (!body) return;

  const totalPages = Math.ceil(filteredFacilities.length / rowsPerPage);
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  if (totalPages === 0) currentPage = 1;

  const start = (currentPage - 1) * rowsPerPage;
  const slice = filteredFacilities.slice(start, start + rowsPerPage);

  if (slice.length === 0) {
    body.innerHTML =
      '<div class="facility-empty">Tidak ada fasilitas ditemukan.</div>';
  } else {
    body.innerHTML = slice
      .map((f) => {
        const safeKey = escHtml(f._key);
        const safeName = escHtml(f.name);
        const safeLab = escHtml(f.lab);
        const condClass = conditionBadgeClass(f.condition);
        const condText = escHtml(f.condition);
        const photo = f.fotoUrl
          ? `<img src="${escHtml(f.fotoUrl)}" alt="${safeName}" class="fc-photo" onerror="this.parentElement.classList.add('no-photo');this.remove()" />`
          : "";
        const sourceTag =
          f._source === "lab_data" ? "LAB" : "GLOBAL";
        return `
      <div class="facility-card ${f.fotoUrl ? "" : "no-photo"}" onclick="viewFacility('${safeKey}')">
        <div class="fc-photo-wrap">
          ${photo}
          <span class="fc-lab-badge">${safeLab}</span>
          <span class="fc-source-badge ${f._source === "lab_data" ? "lab" : "global"}">${sourceTag}</span>
        </div>
        <div class="fc-body">
          <div class="fc-name">${safeName}</div>
          <div class="fc-meta">
            <span class="fc-qty">Qty: <strong>${f.qty || 0}</strong></span>
            <span class="badge ${condClass}">${condText}</span>
          </div>
          <div class="fc-actions">
            <button type="button" class="fc-view-btn" onclick="event.stopPropagation(); viewFacility('${safeKey}')">Lihat Detail</button>
            <button type="button" class="fc-del-btn" title="Hapus" onclick="event.stopPropagation(); deleteFacility('${safeKey}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
      })
      .join("");
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const nums = document.getElementById("pageNumbers");
  if (!nums) return;
  nums.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "page-num" + (i === currentPage ? " active" : "");
    btn.textContent = i;
    btn.onclick = () => {
      currentPage = i;
      renderFacilities();
    };
    nums.appendChild(btn);
  }
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

window.changePage = function (dir) {
  const totalPages = Math.ceil(filteredFacilities.length / rowsPerPage);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + dir));
  renderFacilities();
};

window.filterFacilities = function () {
  applyFacilityFilter();
  currentPage = 1;
  renderFacilities();
};

/* ===========================
   FACILITY CRUD — Firebase
=========================== */

/* ADD */
window.addFacility = async function () {
  const name = document.getElementById("facilityName").value.trim();
  const qty = parseInt(document.getElementById("facilityQty").value) || 0;
  const cond = document.getElementById("facilityCondition").value;
  const lab = document.getElementById("facilityLab").value;
  const photoFile = document.getElementById("facilityPhoto")?.files?.[0];

  if (!name) {
    showToast("Harap masukkan nama fasilitas.");
    return;
  }

  const btn = document.querySelector("#addFacilityModal .btn-save");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
  }

  try {
    let fotoUrl = "";
    if (photoFile) {
      showToast("Mengunggah foto ke R2…");
      fotoUrl = await uploadToR2(photoFile, "fasilitas");
    }

    await db
      .ref("fasilitas")
      .push({ name, qty, condition: cond, lab, fotoUrl });

    // Reset form
    ["facilityName", "facilityQty"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const photoInput = document.getElementById("facilityPhoto");
    if (photoInput) photoInput.value = "";

    closeModal("addFacilityModal");
    logActivity(
      "add",
      "+",
      `${SESSION_TEACHER || "Admin"} menambahkan ${qty} ${name} ke ${lab}`,
      { lab },
    );
    showToast("✓ Fasilitas berhasil ditambahkan!");
  } catch (err) {
    showToast("⚠ Gagal: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Save Facility";
    }
  }
};

/* EDIT — open modal */
window.editFacility = function (key) {
  const f = facilities.find((x) => x._key === key);
  if (!f) return;
  if (f._source === "lab_data") {
    showToast("Data inventaris ini dikelola dari halaman manajemen lab.");
    return;
  }
  // Reuse editFacilityIndex to store the Firebase key string
  document.getElementById("editFacilityIndex").value = key;
  document.getElementById("editFacilityName").value = f.name;
  document.getElementById("editFacilityQty").value = f.qty;
  setSelectValue("editFacilityCondition", f.condition);
  setSelectValue("editFacilityLab", f.lab);
  openModal("editFacilityModal");
};

/* EDIT — save */
window.saveEditFacility = async function () {
  const key = document.getElementById("editFacilityIndex").value;
  const current = facilities.find((x) => x._key === key);
  const name = document.getElementById("editFacilityName").value.trim();
  const qty = parseInt(document.getElementById("editFacilityQty").value) || 0;
  const cond = document.getElementById("editFacilityCondition").value;
  const lab = document.getElementById("editFacilityLab").value;

  if (!name) {
    showToast("Harap masukkan nama fasilitas.");
    return;
  }
  if (!key) {
    showToast("Key tidak valid.");
    return;
  }
  if (!current || current._source === "lab_data") {
    showToast("Data inventaris ini dikelola dari halaman manajemen lab.");
    return;
  }

  const btn = document.querySelector("#editFacilityModal .btn-save");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
  }

  try {
    await db.ref(current._dbPath).update({ name, qty, condition: cond, lab });
    closeModal("editFacilityModal");
    logActivity(
      "update",
      "✓",
      `${SESSION_TEACHER || "Admin"} memperbarui fasilitas ${name}`,
      { lab },
    );
    showToast("✓ Fasilitas berhasil diperbarui!");
  } catch (err) {
    showToast("⚠ Gagal: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Update Facility";
    }
  }
};

/* DELETE */
window.deleteFacility = async function (key) {
  const f = facilities.find((x) => x._key === key);
  if (!f) return;
  if (!f._dbPath) {
    showToast("Path data tidak diketahui, tidak dapat menghapus.");
    return;
  }
  const sourceLabel = f._source === "lab_data" ? "data lab" : "data global";
  if (
    !confirm(
      `Hapus "${f.name}" (${f.lab}) dari ${sourceLabel}?\nTindakan ini tidak dapat dibatalkan.`,
    )
  )
    return;

  try {
    await db.ref(f._dbPath).remove();
    logActivity(
      "update",
      "✗",
      `${SESSION_TEACHER || "Admin"} menghapus fasilitas ${f.name}`,
      { lab: f.lab },
    );
    showToast("✓ Fasilitas berhasil dihapus!");
  } catch (err) {
    showToast("⚠ Gagal menghapus: " + err.message);
  }
};

/* VIEW */
window.viewFacility = function (key) {
  const f = facilities.find((x) => x._key === key);
  if (!f) return;
  document.getElementById("viewModalBody").innerHTML = `
    <div class="detail-list">
      <div class="detail-item"><span>Name</span><span>${escHtml(f.name)}</span></div>
      <div class="detail-item"><span>Quantity</span><span>${f.qty || 0}</span></div>
      <div class="detail-item"><span>Condition</span><span><span class="badge ${f.condition}">${escHtml(f.condition)}</span></span></div>
      <div class="detail-item"><span>Laboratory</span><span>${escHtml(f.lab)}</span></div>
      <div class="detail-item" style="display:block">
        <span style="display:block;margin-bottom:8px;color:var(--text-muted)">Foto Fasilitas</span>
        ${
          f.fotoUrl
            ? `<img src="${escHtml(f.fotoUrl)}" alt="Foto Fasilitas"
                style="max-width:100%;border-radius:8px;margin-top:4px;display:block"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
               <span style="display:none;color:var(--text-faint);font-size:13px">Foto tidak dapat dimuat.</span>
               <a href="${escHtml(f.fotoUrl)}" target="_blank" rel="noopener noreferrer"
                  style="display:inline-block;margin-top:8px;color:var(--accent-blue);font-size:13px">
                 Buka foto ukuran penuh
               </a>`
            : `<span style="color:var(--text-faint);font-size:13px">Tidak ada foto untuk fasilitas ini.</span>`
        }
      </div>
    </div>
  `;
  openModal("viewFacilityModal");
};

/* ===========================
   DAMAGE REPORTS PAGE
=========================== */
function renderDamageReports() {
  renderDamageReportStats();
  renderLabReportSummary();
  renderUrgentReportList();
  renderDamageReportTable();
}

function renderDamageReportStats() {
  const total = damageReports.length;
  const open = damageReports.filter((r) => r.status === "Open").length;
  const progress = damageReports.filter(
    (r) => r.status === "In Progress",
  ).length;
  const critical = damageReports.filter(
    (r) => r.priority === "Critical" || r.overdue,
  ).length;
  setTextIfExists("reportsTotal", total);
  setTextIfExists("reportsOpen", open);
  setTextIfExists("reportsProgress", progress);
  setTextIfExists("reportsCritical", critical);
}

function renderLabReportSummary() {
  const container = document.getElementById("labReportList");
  if (!container) return;

  const summary = LAB_NAMES.map((lab) => {
    const reports = damageReports.filter((r) => r.lab === lab);
    const active = reports.filter((r) => r.status !== "Resolved").length;
    const critical = reports.filter(
      (r) => r.priority === "Critical" || r.priority === "High",
    ).length;
    const ratio = totalPercent(
      active,
      damageReports.filter((r) => r.status !== "Resolved").length || 1,
    );
    return { lab, total: reports.length, active, critical, ratio };
  });

  container.innerHTML = summary
    .map(
      (item) => `
    <div class="lab-report-item">
      <div class="lab-report-top">
        <div class="lab-report-name">${escHtml(item.lab)}</div>
        <span class="badge ${item.active > 0 ? "open" : "resolved"}">${item.active} active</span>
      </div>
      <div class="lab-report-meta">
        <span>${item.total} total reports</span>
        <span>•</span>
        <span>${item.critical} high priority</span>
      </div>
      <div class="lab-report-progress"><span style="width:${item.ratio}%"></span></div>
    </div>
  `,
    )
    .join("");
}

function renderUrgentReportList() {
  const container = document.getElementById("urgentReportList");
  if (!container) return;

  const urgent = [...damageReports]
    .filter((r) => r.status !== "Resolved")
    .sort(
      (a, b) =>
        priorityWeight(b.priority) - priorityWeight(a.priority) ||
        Number(b.overdue) - Number(a.overdue),
    )
    .slice(0, 5);

  if (!urgent.length) {
    container.innerHTML =
      '<div class="urgent-empty">Tidak ada laporan mendesak.</div>';
    return;
  }

  container.innerHTML = urgent
    .map((report) => {
      const safeKey = escHtml(report._key);
      const photo = report.fotoUrl
        ? `<img src="${escHtml(report.fotoUrl)}" alt="${escHtml(report.item)}" class="uc-photo" onerror="this.parentElement.classList.add('no-photo');this.remove()" />`
        : "";
      const statusText = report.overdue
        ? "Overdue"
        : "Updated " + escHtml(report.updatedAt || "-");
      return `
      <div class="urgent-card priority-${priorityClass(report.priority)}" onclick="viewDamageReport('${safeKey}')">
        <div class="uc-photo-wrap">
          ${photo}
          <span class="badge ${priorityClass(report.priority)} uc-prio-badge">${escHtml(report.priority)}</span>
        </div>
        <div class="uc-body">
          <div class="uc-name">${escHtml(report.item)}</div>
          <div class="uc-meta">
            <span class="uc-lab">${escHtml(report.lab)}</span>
            <span class="uc-dot">•</span>
            <span>${escHtml(report.status)}</span>
          </div>
          <div class="uc-update ${report.overdue ? "overdue" : ""}">${statusText}</div>
          <p class="uc-desc">${escHtml(report.description)}</p>
          <button type="button" class="uc-view-btn" onclick="event.stopPropagation(); viewDamageReport('${safeKey}')">Lihat Detail</button>
        </div>
      </div>`;
    })
    .join("");
}

function renderDamageReportTable() {
  const body = document.getElementById("damageReportsBody");
  if (!body) return;

  const totalPages = Math.ceil(
    filteredDamageReports.length / damageReportsPerPage,
  );
  if (currentDamageReportPage > totalPages && totalPages > 0)
    currentDamageReportPage = totalPages;
  if (totalPages === 0) currentDamageReportPage = 1;

  const start = (currentDamageReportPage - 1) * damageReportsPerPage;
  const slice = filteredDamageReports.slice(
    start,
    start + damageReportsPerPage,
  );

  if (slice.length === 0) {
    body.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Tidak ada laporan kerusakan ditemukan.</td></tr>';
  } else {
    body.innerHTML = slice
      .map(
        (report) => `
      <tr>
        <td>
          <div style="color:var(--text-primary);font-weight:600">${escHtml(report.id || "")}</div>
          <div style="font-size:12px;color:var(--text-faint);margin-top:4px">${escHtml(report.item)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Reported by ${escHtml(report.reporter)}</div>
        </td>
        <td>${escHtml(report.lab)}</td>
        <td><span class="badge ${statusClass(report.status)}">${escHtml(report.status)}</span></td>
        <td><span class="badge ${priorityClass(report.priority)}">${escHtml(report.priority)}</span></td>
        <td>${escHtml(report.assignee)}</td>
        <td>${escHtml(report.updatedAt || "")}</td>
        <td class="action-links">
          <a onclick="viewDamageReport('${escHtml(report._key)}')">[View]</a>
        </td>
      </tr>
    `,
      )
      .join("");
  }

  renderDamageReportPagination(totalPages);
}

function renderDamageReportPagination(totalPages) {
  const nums = document.getElementById("reportsPageNumbers");
  if (!nums) return;
  nums.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className =
      "page-num" + (i === currentDamageReportPage ? " active" : "");
    btn.textContent = i;
    btn.onclick = () => {
      currentDamageReportPage = i;
      renderDamageReportTable();
    };
    nums.appendChild(btn);
  }
  const prevBtn = document.getElementById("reportsPrevBtn");
  const nextBtn = document.getElementById("reportsNextBtn");
  if (prevBtn) prevBtn.disabled = currentDamageReportPage <= 1;
  if (nextBtn) nextBtn.disabled = currentDamageReportPage >= totalPages;
}

window.changeDamageReportPage = function (dir) {
  const totalPages = Math.ceil(
    filteredDamageReports.length / damageReportsPerPage,
  );
  currentDamageReportPage = Math.max(
    1,
    Math.min(totalPages, currentDamageReportPage + dir),
  );
  renderDamageReportTable();
};

window.filterDamageReports = function () {
  applyReportFilter();
  currentDamageReportPage = 1;
  renderDamageReports();
};

/* ===========================
   DAMAGE REPORT CRUD — Firebase
=========================== */

/* ADD */
window.addDamageReport = async function () {
  const item = document.getElementById("damageItemName").value.trim();
  const description = document.getElementById("damageDescription").value.trim();
  const lab = document.getElementById("damageLab").value;
  const priority = document.getElementById("damagePriority").value;
  const status = document.getElementById("damageStatus").value;
  const assignee =
    document.getElementById("damageAssignee").value.trim() || "Unassigned";
  const reporter =
    document.getElementById("damageReporter").value.trim() || "Unknown";
  const photoFile = document.getElementById("damagePhoto")?.files?.[0];

  if (!item || !description) {
    showToast("Harap masukkan nama item dan deskripsi.");
    return;
  }

  const btn = document.querySelector("#addDamageReportModal .btn-save");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
  }

  try {
    let fotoUrl = "";
    if (photoFile) {
      showToast("Mengunggah foto ke R2…");
      fotoUrl = await uploadToR2(photoFile, "laporan");
    }

    const report = {
      id: nextDamageReportId(),
      item,
      description,
      lab,
      status,
      priority,
      assignee,
      reporter,
      fotoUrl,
      updatedAt: nowStr(),
      createdAt: nowStr(),
      overdue: priority === "Critical" && status !== "Resolved",
    };

    await db.ref("laporan").push(report);

    closeModal("addDamageReportModal");
    resetDamageReportForm();
    logActivity(
      "warn",
      "!",
      `${reporter} melaporkan kerusakan: ${item}`,
      { lab },
    );
    showToast("✓ Laporan kerusakan berhasil dibuat!");
  } catch (err) {
    showToast("⚠ Gagal: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Save Report";
    }
  }
};

/* VIEW */
window.viewDamageReport = function (key) {
  const report = damageReports.find((r) => r._key === key);
  if (!report) return;
  const photoSection = report.fotoUrl
    ? `
      <div class="detail-item" style="display:block">
        <span style="display:block;margin-bottom:8px;color:var(--text-muted)">Foto Bukti Kerusakan</span>
        <img src="${escHtml(report.fotoUrl)}" alt="Foto Kerusakan" style="max-width:100%;border-radius:8px;margin-top:4px" />
        <a href="${escHtml(report.fotoUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;color:var(--accent-blue)">Buka foto ukuran penuh</a>
      </div>`
    : `
      <div class="detail-item" style="display:block">
        <span style="display:block;margin-bottom:8px;color:var(--text-muted)">Foto Bukti Kerusakan</span>
        <span style="display:block;color:var(--text-faint)">Tidak ada foto untuk laporan ini.</span>
      </div>`;

  document.getElementById("viewDamageReportBody").innerHTML = `
    <div class="detail-list">
      <div class="detail-item"><span>Report ID</span><span>${escHtml(report.id || "")}</span></div>
      <div class="detail-item"><span>Item</span><span>${escHtml(report.item)}</span></div>
      <div class="detail-item"><span>Laboratory</span><span>${escHtml(report.lab)}</span></div>
      <div class="detail-item"><span>Status</span><span><span class="badge ${statusClass(report.status)}">${escHtml(report.status)}</span></span></div>
      <div class="detail-item"><span>Priority</span><span><span class="badge ${priorityClass(report.priority)}">${escHtml(report.priority)}</span></span></div>
      <div class="detail-item"><span>Assigned To</span><span>${escHtml(report.assignee)}</span></div>
      <div class="detail-item"><span>Reporter</span><span>${escHtml(report.reporter)}</span></div>
      <div class="detail-item"><span>Updated</span><span>${escHtml(report.updatedAt || "")}</span></div>
      <div class="detail-item" style="display:block">
        <span style="display:block;margin-bottom:8px;color:var(--text-muted)">Description</span>
        <span style="display:block;color:var(--text-primary);font-weight:500;line-height:1.6">${escHtml(report.description)}</span>
      </div>
      ${photoSection}
    </div>
  `;
  openModal("viewDamageReportModal");
};

/* ADVANCE STATUS */
window.advanceDamageReport = async function (key) {
  const report = damageReports.find((r) => r._key === key);
  if (!report) return;

  const next = {
    Open: "In Progress",
    "In Progress": "Resolved",
    Resolved: "Open",
  };
  const newStatus = next[report.status] || "Open";
  const persistedStatus =
    report._source === "lab_data"
      ? REPORT_STATUS_TO_LAB[newStatus] || REPORT_STATUS_TO_LAB.Open
      : newStatus;

  try {
    await db.ref(report._dbPath).update({
      status: persistedStatus,
      updatedAt: nowStr(),
      overdue:
        newStatus !== "Resolved" &&
        (report.priority === "Critical" || report.priority === "High"),
    });
    logActivity(
      "update",
      "R",
      `Status laporan ${report.id || ""} di ${report.lab} berubah ke ${newStatus}`,
      { lab: report.lab },
    );
    showToast(`✓ Status diperbarui → ${newStatus}`);
  } catch (err) {
    showToast("⚠ Gagal memperbarui: " + err.message);
  }
};

function nextDamageReportId() {
  const max = damageReports.reduce(
    (cur, r) =>
      Math.max(cur, parseInt(String(r.id || "0").replace(/\D/g, ""), 10) || 0),
    1000,
  );
  return "DR-" + String(max + 1).padStart(4, "0");
}

function resetDamageReportForm() {
  [
    "damageItemName",
    "damageDescription",
    "damageAssignee",
    "damageReporter",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const photoInput = document.getElementById("damagePhoto");
  if (photoInput) photoInput.value = "";
  const labEl = document.getElementById("damageLab");
  const priorityEl = document.getElementById("damagePriority");
  const statusEl = document.getElementById("damageStatus");
  if (labEl) labEl.value = "Computer Lab";
  if (priorityEl) priorityEl.value = "Medium";
  if (statusEl) statusEl.value = "Open";
}

/* ===========================
   MODALS
=========================== */
window.openModal = function (id) {
  document.getElementById(id).classList.add("open");
};
window.closeModal = function (id) {
  document.getElementById(id).classList.remove("open");
};
window.closeModalOutside = function (e) {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
  }
};

/* ===========================
   SIDEBAR / NAV TOGGLES
=========================== */
window.toggleLabList = function () {
  const sub = document.getElementById("labSubMenu");
  const chevron = document.getElementById("labChevron");
  if (sub) sub.classList.toggle("open");
  if (chevron) chevron.classList.toggle("open");
};

window.toggleSidebar = function () {
  document.getElementById("sidebar").classList.toggle("mobile-open");
};

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", function () {
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));
    this.classList.add("active");
  });
});

/* ===========================
   USER DROPDOWN
=========================== */
window.toggleUserMenu = function () {
  document.getElementById("userDropdown").classList.toggle("open");
};

document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".user-avatar-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.remove("open");
  }
});

/* ===========================
   UTILITIES
=========================== */
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nowStr() {
  const d = new Date();
  return (
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) +
    ", " +
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );
}

function setSelectValue(id, val) {
  const sel = document.getElementById(id);
  if (!sel) return;
  for (const o of sel.options) {
    if (o.value === val) {
      o.selected = true;
      break;
    }
  }
}

function setTextIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function conditionBadgeClass(condition) {
  if (condition === "Excellent") return "Excellent";
  if (condition === "Good") return "Good";
  if (condition === "Fair") return "Fair";
  if (condition === "Poor") return "Poor";
  return "Good";
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function totalPercent(value, total) {
  return Math.max(8, Math.round((value / total) * 100));
}

function priorityWeight(priority) {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[priority] || 0;
}

function priorityClass(priority) {
  return (
    { Critical: "critical", High: "high", Medium: "medium", Low: "low" }[
      priority
    ] || "low"
  );
}

function statusClass(status) {
  return (
    { Open: "open", "In Progress": "progress", Resolved: "resolved" }[status] ||
    "open"
  );
}

/* ===========================
   SETTINGS
=========================== */
function loadSettings() {
  const theme = localStorage.getItem("theme") || "dark";
  const language = localStorage.getItem("language") || "id";
  const notifications = localStorage.getItem("notifications") !== "false";
  const autoSave = localStorage.getItem("autoSave") !== "false";

  if (document.getElementById("themeSetting"))
    document.getElementById("themeSetting").value = theme;
  if (document.getElementById("languageSetting"))
    document.getElementById("languageSetting").value = language;
  if (document.getElementById("notificationSetting"))
    document.getElementById("notificationSetting").checked = notifications;
  if (document.getElementById("autoSaveSetting"))
    document.getElementById("autoSaveSetting").checked = autoSave;

  const teacher = SESSION_TEACHER || "Dr. Emily Carter";
  const email = SESSION_EMAIL || "emily@labflow.id";
  const lab = SESSION_LAB || "Computer Lab";

  if (document.getElementById("usernameSetting"))
    document.getElementById("usernameSetting").value = teacher;
  if (document.getElementById("emailSetting"))
    document.getElementById("emailSetting").value = email;
  if (document.getElementById("labProfileSetting"))
    document.getElementById("labProfileSetting").value = lab;

  updateStorageInfo();
}

function saveSettings() {
  const theme = document.getElementById("themeSetting")?.value || "dark";
  const language = document.getElementById("languageSetting")?.value || "id";
  const notifications =
    document.getElementById("notificationSetting")?.checked || false;
  const autoSave = document.getElementById("autoSaveSetting")?.checked || false;

  localStorage.setItem("theme", theme);
  localStorage.setItem("language", language);
  localStorage.setItem("notifications", notifications);
  localStorage.setItem("autoSave", autoSave);

  applyTheme(theme);
  showToast("Pengaturan berhasil disimpan!");
}

function resetSettings() {
  loadSettings();
  showToast("Pengaturan direset ke nilai sebelumnya");
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.style.setProperty("--bg-primary", "#ffffff");
    root.style.setProperty("--bg-secondary", "#f5f5f5");
    root.style.setProperty("--text-primary", "#1a1a1a");
    root.style.setProperty("--text-muted", "#666666");
  } else {
    root.style.setProperty("--bg-primary", "#0f172a");
    root.style.setProperty("--bg-secondary", "#1e293b");
    root.style.setProperty("--text-primary", "#e4e4e7");
    root.style.setProperty("--text-muted", "#94a3b8");
  }
}

function exportDataAsJSON() {
  const data = {
    facilities: facilities,
    damageReports: damageReports,
    exportDate: new Date().toISOString(),
    laboratory: SESSION_LAB || "All Labs",
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `labflow_backup_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Data berhasil diekspor sebagai JSON!");
}

function exportDataAsCSV() {
  let csv = "NAME,QUANTITY,CONDITION,LAB\n";
  facilities.forEach((f) => {
    csv += `"${f.name}",${f.qty},"${f.condition}","${f.lab}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `labflow_facilities_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Data berhasil diekspor sebagai CSV!");
}

function clearCache() {
  if (confirm("Ini akan menghapus semua cache lokal. Lanjutkan?")) {
    sessionStorage.clear();
    localStorage.removeItem("theme");
    localStorage.removeItem("language");
    showToast("Cache berhasil dihapus!");
  }
}

function resetApplication() {
  if (
    confirm(
      "PERINGATAN: Ini akan menghapus semua data lokal dan reset ke default. Yakin?",
    )
  ) {
    sessionStorage.clear();
    localStorage.clear();
    navigateTo("index.html");
  }
}

function changePassword() {
  const oldPass = document.getElementById("oldPassword")?.value;
  const newPass = document.getElementById("newPassword")?.value;
  const confirmPass = document.getElementById("confirmPassword")?.value;

  if (!oldPass || !newPass || !confirmPass) {
    showToast("Semua field harus diisi!");
    return;
  }
  if (newPass !== confirmPass) {
    showToast("Kata sandi baru tidak cocok!");
    return;
  }
  if (newPass.length < 6) {
    showToast("Kata sandi minimal 6 karakter!");
    return;
  }

  showToast("Kata sandi berhasil diubah!");
  closeModal("changePasswordModal");
  ["oldPassword", "newPassword", "confirmPassword"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function updateStorageInfo() {
  let storageSize = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      storageSize += localStorage[key].length + key.length;
    }
  }
  const sizeKB = (storageSize / 1024).toFixed(2);
  const info = document.getElementById("storageInfo");
  if (info)
    info.textContent = `LocalStorage: ${sizeKB} KB | Firebase: Connected | Storage: Cloudflare R2`;
}

function showHelp() {
  alert(`LABFLOW PRO — PANDUAN PENGGUNAAN

1. DASHBOARD
   - Lihat statistik lab (total item, laporan aktif, ketersediaan)
   - Monitor aktivitas terbaru secara real-time

2. MANAJEMEN FASILITAS
   - Tambah fasilitas dengan "+ Add New Facility" (bisa upload foto)
   - Edit detail atau hapus fasilitas
   - Semua data tersimpan di Firebase Realtime Database
   - Foto disimpan di Cloudflare R2 Storage

3. LAPORAN KERUSAKAN
   - Buat laporan kerusakan (bisa upload foto bukti)
   - Pantau status: Open → In Progress → Resolved
   - Filter berdasarkan lab, prioritas, dan status

4. SINKRONISASI REAL-TIME
   - Data diperbarui otomatis di semua perangkat
   - Tidak perlu refresh halaman

Kontak: support@labflow.id`);
}

function showFeedback() {
  const feedback = prompt("Kirim feedback atau laporan bug:");
  if (feedback) {
    console.log("Feedback:", feedback);
    showToast("Terima kasih atas feedback Anda!");
  }
}

/* ===========================
   SIDEBAR — fully dynamic
=========================== */
const LAB_ICONS = {
  "Computer Lab": `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`,
  "Physics Lab":  `<circle cx="12" cy="12" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="19" r="1"/><line x1="12" y1="13" x2="19" y2="6"/><line x1="12" y1="13" x2="5" y2="20"/>`,
  "Chemistry Lab":`<path d="M10 2v7.31l-3.24 5.4A2 2 0 0 0 8.5 18h7a2 2 0 0 0 1.74-2.69L14 9.31V2"/><line x1="6.4" y1="15" x2="17.6" y2="15"/><line x1="8" y1="2" x2="16" y2="2"/>`,
  "Biology Lab":  `<path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/>`,
};
const DEFAULT_ITEM_ICON = `<circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>`;

function renderSidebarLabList() {
  // Lab List section is always rendered from LAB_NAMES
  const sub = document.getElementById("labSubMenu");
  if (!sub) return;
  sub.innerHTML = LAB_NAMES.map((name) => {
    const icon = LAB_ICONS[name] || DEFAULT_ITEM_ICON;
    return `<a href="javascript:void(0)" class="nav-sub-item" onclick="goToLab('${escHtml(name)}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;display:inline-block;flex-shrink:0">${icon}</svg>
      ${escHtml(name)}
    </a>`;
  }).join("");
}

function renderSidebarCustomSections() {
  // Render all custom sections AFTER the static nav items (before Developer)
  const nav = document.querySelector(".sidebar-nav");
  if (!nav) return;

  // Remove previously rendered custom sections
  nav.querySelectorAll(".nav-group.custom-section").forEach((el) => el.remove());

  // Insert before Developer nav item
  const devItem = document.getElementById("nav-developer");

  devSections.forEach((section) => {
    const sectionItems = devSectionItems[section._key] || [];
    const subId = `customSub_${section._key}`;
    const chevId = `customChev_${section._key}`;

    const group = document.createElement("div");
    group.className = "nav-group custom-section";
    group.innerHTML = `
      <button class="nav-group-header" onclick="toggleCustomSection('${section._key}')">
        <div class="nav-group-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          ${escHtml(section.name)}
        </div>
        <svg class="chevron" id="${chevId}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
      <div class="nav-sub open" id="${subId}">
        ${sectionItems.length
          ? sectionItems.map((item) => `
              <a href="javascript:void(0)" class="nav-sub-item" title="${escHtml(item.note || item.name)}" onclick="openSectionItem('${section._key}','${item._key}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;display:inline-block;flex-shrink:0">
                  ${DEFAULT_ITEM_ICON}
                </svg>
                ${escHtml(item.name)}
              </a>`).join("")
          : `<span class="nav-sub-empty">Belum ada item</span>`
        }
      </div>`;

    nav.insertBefore(group, devItem);
  });
}

window.toggleCustomSection = function (key) {
  const sub = document.getElementById(`customSub_${key}`);
  const chev = document.getElementById(`customChev_${key}`);
  if (sub) sub.classList.toggle("open");
  if (chev) chev.classList.toggle("open");
};

window.openSectionItem = function (sectionKey, itemKey) {
  const section = devSections.find((s) => s._key === sectionKey);
  const items = devSectionItems[sectionKey] || [];
  const item = items.find((i) => i._key === itemKey);
  if (!item) { showToast("Item tidak ditemukan."); return; }

  // Try to detect lab from item name (e.g. "Ruang 207 — Computer Lab")
  let detectedLab = null;
  for (const lab of LAB_NAMES) {
    if ((item.name || "").toLowerCase().includes(lab.toLowerCase())) { detectedLab = lab; break; }
  }

  const sectionName = section ? section.name : "Item";
  document.getElementById("sectionItemTitle").textContent = item.name || "(Tanpa nama)";
  document.getElementById("sectionItemSubtitle").textContent = sectionName;
  document.getElementById("sectionItemNote").textContent = item.note ? item.note : "Tidak ada deskripsi tambahan.";

  const labBtn = document.getElementById("sectionItemGoLab");
  if (detectedLab) {
    labBtn.style.display = "inline-flex";
    labBtn.textContent = `Buka ${detectedLab} →`;
    labBtn.onclick = () => { closeModal("sectionItemModal"); goToLab(detectedLab); };
  } else {
    labBtn.style.display = "none";
  }

  openModal("sectionItemModal");
};

/* ===========================
   DEVELOPER PAGE — sections system
=========================== */
let devSections = [];          // custom nav sections from Firebase
let devSectionItems = {};      // { sectionKey: [ items ] }

function renderDevLabGrid() {
  const grid = document.getElementById("devLabGrid");
  if (!grid) return;

  // Built-in labs (non-deletable)
  const builtinCards = DEFAULT_LAB_NAMES.map((name) => `
    <div class="dev-card builtin">
      <div class="dev-card-icon blue">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      </div>
      <div class="dev-card-body">
        <div class="dev-card-name">${escHtml(name)}</div>
        <div class="dev-card-meta">Built-in · tidak dapat dihapus</div>
      </div>
      <span class="dev-builtin-badge">DEFAULT</span>
    </div>`).join("");

  // Custom labs (deletable)
  const customCards = devLabs.map((lab) => `
    <div class="dev-card custom">
      <div class="dev-card-icon cyan">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      </div>
      <div class="dev-card-body">
        <div class="dev-card-name">${escHtml(lab.name)}</div>
        <div class="dev-card-meta">${escHtml(lab.teacher || "—")} · ${escHtml(lab.email || "—")}</div>
      </div>
      <button class="dev-del-btn" title="Hapus lab" onclick="deleteDevLab('${escHtml(lab._key)}','${escHtml(lab.name)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`).join("");

  grid.innerHTML = builtinCards + (customCards || '<div class="dev-empty">Belum ada lab kustom. Klik "+ Tambah Lab" untuk menambah.</div>');
}

function renderDevRoomGrid() {
  const grid = document.getElementById("devRoomGrid");
  if (!grid) return;

  if (!devRooms.length) {
    grid.innerHTML = '<div class="dev-empty">Belum ada room. Klik "+ Tambah Room" untuk menambah.</div>';
    return;
  }

  grid.innerHTML = devRooms.map((room) => `
    <div class="dev-card custom">
      <div class="dev-card-icon purple">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      </div>
      <div class="dev-card-body">
        <div class="dev-card-name">${escHtml(room.name)}</div>
        <div class="dev-card-meta">${room.capacity ? `Kapasitas: ${room.capacity}` : "—"}${room.note ? ` · ${escHtml(room.note)}` : ""}</div>
      </div>
      <button class="dev-del-btn" title="Hapus room" onclick="deleteDevRoom('${escHtml(room._key)}','${escHtml(room.name)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`).join("");
}

window.saveNewLab = async function () {
  const name = (document.getElementById("newLabName")?.value || "").trim();
  const teacher = (document.getElementById("newLabTeacher")?.value || "").trim();
  const email = (document.getElementById("newLabEmail")?.value || "").trim();
  const password = (document.getElementById("newLabPassword")?.value || "").trim();
  const errBox = document.getElementById("addLabErr");

  if (!name) {
    errBox.textContent = "Nama lab wajib diisi.";
    errBox.style.display = "block";
    return;
  }
  if (LAB_NAMES.map((l) => l.toLowerCase()).includes(name.toLowerCase())) {
    errBox.textContent = "Nama lab sudah ada.";
    errBox.style.display = "block";
    return;
  }
  errBox.style.display = "none";

  try {
    await db.ref("dev_config/labs").push({ name, teacher, email, password, createdAt: Date.now() });
    showToast(`Lab "${name}" berhasil ditambahkan.`);
    closeModal("addLabModal");
    document.getElementById("newLabName").value = "";
    document.getElementById("newLabTeacher").value = "";
    document.getElementById("newLabEmail").value = "";
    document.getElementById("newLabPassword").value = "";
  } catch (err) {
    errBox.textContent = "Gagal menyimpan: " + err.message;
    errBox.style.display = "block";
  }
};

window.deleteDevLab = async function (key, name) {
  if (!confirm(`Hapus lab "${name}"?\nData inventaris/laporan lab ini di Firebase tidak ikut terhapus.`)) return;
  try {
    await db.ref("dev_config/labs/" + key).remove();
    showToast(`Lab "${name}" dihapus.`);
  } catch (err) {
    showToast("Gagal menghapus: " + err.message);
  }
};

window.saveNewRoom = async function () {
  const name = (document.getElementById("newRoomName")?.value || "").trim();
  const capacity = document.getElementById("newRoomCapacity")?.value || "";
  const note = (document.getElementById("newRoomNote")?.value || "").trim();
  const errBox = document.getElementById("addRoomErr");

  if (!name) {
    errBox.textContent = "Nama room wajib diisi.";
    errBox.style.display = "block";
    return;
  }
  errBox.style.display = "none";

  try {
    await db.ref("dev_config/rooms").push({ name, capacity: Number(capacity) || 0, note, createdAt: Date.now() });
    showToast(`Room "${name}" berhasil ditambahkan.`);
    closeModal("addRoomModal");
    document.getElementById("newRoomName").value = "";
    document.getElementById("newRoomCapacity").value = "";
    document.getElementById("newRoomNote").value = "";
  } catch (err) {
    errBox.textContent = "Gagal menyimpan: " + err.message;
    errBox.style.display = "block";
  }
};

window.deleteDevRoom = async function (key, name) {
  if (!confirm(`Hapus room "${name}"?`)) return;
  try {
    await db.ref("dev_config/rooms/" + key).remove();
    showToast(`Room "${name}" dihapus.`);
  } catch (err) {
    showToast("Gagal menghapus: " + err.message);
  }
};

/* ===========================
   DEVELOPER — custom sections
=========================== */
function initDevSectionsListener() {
  db.ref("dev_config/sections").on("value", (snap) => {
    devSections = [];
    snap.forEach((child) => {
      devSections.push({ _key: child.key, ...child.val() });
    });
    renderDevSectionsPage();
    renderSidebarCustomSections();
  });
}

function initDevSectionItemsListener() {
  db.ref("dev_config/section_items").on("value", (snap) => {
    devSectionItems = {};
    snap.forEach((sectionSnap) => {
      const items = [];
      sectionSnap.forEach((itemSnap) => {
        items.push({ _key: itemSnap.key, ...itemSnap.val() });
      });
      devSectionItems[sectionSnap.key] = items;
    });
    renderDevSectionsPage();
    renderSidebarCustomSections();
  });
}

function renderDevSectionsPage() {
  const container = document.getElementById("devCustomSections");
  if (!container) return;

  if (!devSections.length) {
    container.innerHTML = `<div class="dev-section" style="border:1px dashed var(--border);background:transparent;text-align:center;color:var(--text-muted);padding:32px">
      Belum ada section kustom. Klik "+ Tambah Section" untuk membuat list baru di sidebar.
    </div>`;
    return;
  }

  container.innerHTML = devSections.map((section) => {
    const items = devSectionItems[section._key] || [];
    const safeKey = escHtml(section._key);
    const safeName = escHtml(section.name);

    const itemCards = items.length
      ? items.map((item) => `
          <div class="dev-card custom">
            <div class="dev-card-icon purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>
            </div>
            <div class="dev-card-body">
              <div class="dev-card-name">${escHtml(item.name)}</div>
              ${item.note ? `<div class="dev-card-meta">${escHtml(item.note)}</div>` : ""}
            </div>
            <button class="dev-del-btn" title="Hapus item" onclick="deleteDevSectionItem('${safeKey}','${escHtml(item._key)}','${escHtml(item.name)}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>`).join("")
      : `<div class="dev-empty">Belum ada item. Klik "+ Tambah Item".</div>`;

    return `
      <div class="dev-section" id="devSection_${safeKey}">
        <div class="dev-section-head">
          <div class="dev-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            ${safeName}
          </div>
          <div style="display:flex;gap:8px">
            <button class="dev-add-btn" onclick="openAddSectionItem('${safeKey}','${safeName}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tambah Item
            </button>
            <button class="dev-del-section-btn" onclick="deleteDevSection('${safeKey}','${safeName}')" title="Hapus section ini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Hapus Section
            </button>
          </div>
        </div>
        <div class="dev-grid">${itemCards}</div>
      </div>`;
  }).join("");
}

window.openAddSectionItem = function (sectionKey, sectionName) {
  document.getElementById("addItemSectionKey").value = sectionKey;
  document.getElementById("addItemSectionLabel").textContent = sectionName;
  document.getElementById("newSectionItemName").value = "";
  document.getElementById("newSectionItemNote").value = "";
  const err = document.getElementById("addSectionItemErr");
  if (err) { err.style.display = "none"; err.textContent = ""; }
  openModal("addSectionItemModal");
};

window.saveNewSectionItem = async function () {
  const sectionKey = document.getElementById("addItemSectionKey")?.value;
  const name = (document.getElementById("newSectionItemName")?.value || "").trim();
  const note = (document.getElementById("newSectionItemNote")?.value || "").trim();
  const errBox = document.getElementById("addSectionItemErr");
  if (!name) { errBox.textContent = "Nama item wajib diisi."; errBox.style.display = "block"; return; }
  errBox.style.display = "none";
  try {
    await db.ref(`dev_config/section_items/${sectionKey}`).push({ name, note, createdAt: Date.now() });
    showToast(`Item "${name}" ditambahkan.`);
    closeModal("addSectionItemModal");
  } catch (err) {
    errBox.textContent = "Gagal: " + err.message; errBox.style.display = "block";
  }
};

window.deleteDevSectionItem = async function (sectionKey, itemKey, name) {
  if (!confirm(`Hapus item "${name}"?`)) return;
  try {
    await db.ref(`dev_config/section_items/${sectionKey}/${itemKey}`).remove();
    showToast(`Item "${name}" dihapus.`);
  } catch (err) { showToast("Gagal: " + err.message); }
};

window.saveNewSection = async function () {
  const name = (document.getElementById("newSectionName")?.value || "").trim();
  const errBox = document.getElementById("addSectionErr");
  if (!name) { errBox.textContent = "Nama section wajib diisi."; errBox.style.display = "block"; return; }
  if (devSections.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    errBox.textContent = "Section dengan nama ini sudah ada."; errBox.style.display = "block"; return;
  }
  errBox.style.display = "none";
  try {
    await db.ref("dev_config/sections").push({ name, createdAt: Date.now() });
    showToast(`Section "${name}" dibuat.`);
    closeModal("addSectionModal");
    document.getElementById("newSectionName").value = "";
  } catch (err) { errBox.textContent = "Gagal: " + err.message; errBox.style.display = "block"; }
};

window.deleteDevSection = async function (key, name) {
  if (!confirm(`Hapus section "${name}" beserta semua item-nya?`)) return;
  try {
    await Promise.all([
      db.ref(`dev_config/sections/${key}`).remove(),
      db.ref(`dev_config/section_items/${key}`).remove(),
    ]);
    showToast(`Section "${name}" dihapus.`);
  } catch (err) { showToast("Gagal: " + err.message); }
};

const ROOM_SEED = [
  { name: "Ruang 207 — Computer Lab",   note: "Lab Komputer utama, 30 unit PC" },
  { name: "Ruang 208 — Computer Lab",   note: "Lab Komputer cadangan, 20 unit PC" },
  { name: "Ruang 301 — Physics Lab",    note: "Lab Fisika, alat mekanika & listrik" },
  { name: "Ruang 302 — Physics Lab",    note: "Lab Fisika lanjut, optik & pengukuran" },
  { name: "Ruang 303 — Chemistry Lab",  note: "Lab Kimia, lemari asam & timbangan" },
  { name: "Ruang 304 — Chemistry Lab",  note: "Lab Kimia organik, alat gelas" },
  { name: "Ruang 305 — Biology Lab",    note: "Lab Biologi, mikroskop & preparat" },
  { name: "Ruang 306 — Biology Lab",    note: "Lab Biologi lanjut, model anatomi & spesimen" },
];

window.seedRoomList = async function () {
  if (!confirm("Seed Room List?\n\nIni akan membuat section 'Room List' (jika belum ada) dan mengisi 8 ruang untuk semua lab. Item yang sudah ada tidak akan digandakan.")) return;

  try {
    // Find or create the "Room List" section
    let sectionKey = null;
    const existing = devSections.find((s) => s.name.toLowerCase() === "room list");
    if (existing) {
      sectionKey = existing._key;
    } else {
      const ref = await db.ref("dev_config/sections").push({ name: "Room List", createdAt: Date.now() });
      sectionKey = ref.key;
    }

    // Get current items to avoid duplicates
    const snap = await db.ref(`dev_config/section_items/${sectionKey}`).once("value");
    const existingNames = new Set();
    snap.forEach((child) => existingNames.add((child.val().name || "").toLowerCase()));

    // Push only missing rooms
    const promises = [];
    for (const room of ROOM_SEED) {
      if (!existingNames.has(room.name.toLowerCase())) {
        promises.push(db.ref(`dev_config/section_items/${sectionKey}`).push({ name: room.name, note: room.note, createdAt: Date.now() }));
      }
    }

    if (promises.length) {
      await Promise.all(promises);
      showToast(`${promises.length} ruang berhasil ditambahkan ke Room List.`);
    } else {
      showToast("Semua ruang sudah ada — tidak ada yang ditambahkan.");
    }
  } catch (err) {
    showToast("Gagal seed: " + err.message);
  }
};
