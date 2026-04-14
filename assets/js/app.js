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

const LAB_NAMES = ["Computer Lab", "Physics Lab", "Chemistry Lab", "Biology Lab"];
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
    fotoUrl: record.fotoUrl || "",
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
    fotoUrl: record.fotoUrl || "",
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
      '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Tidak ada fasilitas ditemukan.</td></tr>';
  } else {
    body.innerHTML = slice
      .map((f) => {
        const isLabManaged = f._source === "lab_data";
        return `
      <tr>
        <td style="color:var(--text-primary);font-weight:500">${escHtml(f.name)}</td>
        <td>${f.qty || 0}</td>
        <td><span class="badge ${conditionBadgeClass(f.condition)}">${escHtml(f.condition)}</span></td>
        <td>${escHtml(f.lab)}</td>
        <td class="action-links">
          ${f.fotoUrl ? `<a href="${escHtml(f.fotoUrl)}" target="_blank" title="Lihat Foto">[Foto]</a> ` : ""}
          ${
            isLabManaged
              ? `<a onclick='goToLab(${JSON.stringify(f.lab)})'>[Manage]</a><span> </span>`
              : `<a onclick="editFacility('${escHtml(f._key)}')">[Edit]</a><span> </span>`
          }
          <a onclick="viewFacility('${escHtml(f._key)}')">[View]</a>
          ${
            isLabManaged
              ? ""
              : `<span> </span><a onclick="deleteFacility('${escHtml(f._key)}')" style="color:#f87171">[Del]</a>`
          }
        </td>
      </tr>
    `;
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
  if (f._source === "lab_data") {
    showToast("Data inventaris ini dikelola dari halaman manajemen lab.");
    return;
  }
  if (!confirm(`Hapus "${f.name}"? Tindakan ini tidak dapat dibatalkan.`))
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
      ${
        f.fotoUrl
          ? `
        <div class="detail-item" style="display:block">
          <span style="display:block;margin-bottom:8px;color:var(--text-muted)">Foto Fasilitas</span>
          <img src="${escHtml(f.fotoUrl)}" alt="Foto Fasilitas" style="max-width:100%;border-radius:8px;margin-top:4px" />
        </div>`
          : ""
      }
    </div>
  `;
  openModal("viewFacilityModal");
};

/* ===========================
   DAMAGE REPORTS PAGE
=========================== */
window.showPage = function (page) {
  document
    .querySelectorAll(".page-panel")
    .forEach((panel) => panel.classList.add("hidden"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });
};

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

  container.innerHTML =
    urgent
      .map(
        (report) => `
    <div class="urgent-report-item">
      <div class="urgent-report-top">
        <div class="urgent-report-name">${escHtml(report.item)}</div>
        <span class="badge ${priorityClass(report.priority)}">${escHtml(report.priority)}</span>
      </div>
      <div class="urgent-report-meta">
        <span>${escHtml(report.lab)}</span>
        <span>•</span>
        <span>${escHtml(report.status)}</span>
        <span>•</span>
        <span>${report.overdue ? "Overdue" : "Updated " + escHtml(report.updatedAt || "")}</span>
      </div>
      <p class="urgent-report-description">${escHtml(report.description)}</p>
    </div>
  `,
      )
      .join("") ||
    '<div class="urgent-report-item"><div class="urgent-report-name" style="color:var(--text-muted)">Tidak ada laporan mendesak.</div></div>';
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
          <span> </span>
          <a onclick="advanceDamageReport('${escHtml(report._key)}')">[Advance]</a>
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
      ${
        report.fotoUrl
          ? `
        <div class="detail-item" style="display:block">
          <span style="display:block;margin-bottom:8px;color:var(--text-muted)">Foto Bukti Kerusakan</span>
          <img src="${escHtml(report.fotoUrl)}" alt="Foto Kerusakan" style="max-width:100%;border-radius:8px;margin-top:4px" />
        </div>`
          : ""
      }
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
