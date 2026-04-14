"use strict";

/* ===========================
   SESSION CHECK
=========================== */
let lab = sessionStorage.getItem("loggedInLab");
let teacher = sessionStorage.getItem("loggedInTeacher");
let email = sessionStorage.getItem("loggedInEmail");

function navigateTo(path) {
  const target = new URL(path, window.location.href).toString();
  try {
    window.location.assign(target);
  } catch (err) {
    window.open(target, "_self");
  }
}

function deriveTeacherFromEmail(addr) {
  const local = String(addr || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();
  if (!local) return "Pengelola Lab";
  return local
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function ensureAuthenticatedSession() {
  const fallbackLab = lab || "Computer Lab";

  if (typeof auth === "undefined") {
    if (!lab || !teacher) {
      sessionStorage.clear();
      navigateTo(`login.html?lab=${encodeURIComponent(fallbackLab)}`);
      throw new Error("Unauthenticated session");
    }
    return;
  }

  const user =
    auth.currentUser ||
    (await new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged((nextUser) => {
        unsub();
        resolve(nextUser);
      });
    }));

  if (!user) {
    sessionStorage.clear();
    navigateTo(`login.html?lab=${encodeURIComponent(fallbackLab)}`);
    throw new Error("Not logged in");
  }

  email = email || user.email || "";

  let profile = {};
  try {
    const profileSnap = await db.ref(`user_profiles/${user.uid}`).once("value");
    if (profileSnap.exists()) profile = profileSnap.val() || {};
  } catch (err) {
    console.warn("Gagal memuat profil user:", err);
  }

  if (!lab) lab = profile.lab || fallbackLab;
  if (profile.lab) lab = profile.lab;

  if (!teacher) {
    teacher =
      profile.teacher || user.displayName || deriveTeacherFromEmail(user.email);
  }

  sessionStorage.setItem("loggedInLab", lab);
  sessionStorage.setItem("loggedInTeacher", teacher);
  sessionStorage.setItem("loggedInEmail", email);
}

/* ===========================
   LAB DATA SEEDS
=========================== */
const LAB_EMOJIS = {
  "Computer Lab": "[COM]",
  "Physics Lab": "[PHY]",
  "Chemistry Lab": "[CHE]",
  "Biology Lab": "[BIO]",
};

/* ===========================
   GLOBAL DATA STATE
   All data sourced from Firebase Realtime Database only
=========================== */
let data = {
  items: [],
  jadwal: [],
  laporan: [],
  pinjam: []
};

// Pagination & Navigation State
let invPage = 1;
const INV_PER_PAGE = 10;
let weekOffset = 0;
let inventorySyncAttempted = false;
let inventorySyncInProgress = false;

const GLOBAL_TO_LAB_CONDITION = {
  Excellent: "Sangat Baik",
  Good: "Baik",
  Fair: "Cukup",
  Poor: "Rusak",
};

function normalizeConditionForLab(condition) {
  return GLOBAL_TO_LAB_CONDITION[condition] || condition || "Baik";
}

function inferCategoryFromName(name) {
  const lower = String(name || "").toLowerCase();
  if (/gelas|beaker|erlenmeyer|tabung|pipet|buret|flask|labu/.test(lower)) {
    return "Gelas";
  }
  if (/mikroskop|osiloskop|multimeter|sensor|meter|alat ukur/.test(lower)) {
    return "Ukur";
  }
  if (/kursi|meja|lemari|rak/.test(lower)) {
    return "Furniture";
  }
  return "Peralatan";
}

function buildLabItemCode(name, usedCodes) {
  const prefix = lab
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  let idx = usedCodes.size + 1;
  let candidate = `${prefix}-${String(idx).padStart(3, "0")}`;
  while (usedCodes.has(candidate.toLowerCase())) {
    idx += 1;
    candidate = `${prefix}-${String(idx).padStart(3, "0")}`;
  }
  usedCodes.add(candidate.toLowerCase());
  return candidate;
}

function stripMeta(record) {
  const { _key, _dbPath, _source, ...rest } = record || {};
  return rest;
}

function writeActivity(type, icon, text) {
  const entry = {
    type,
    icon,
    text,
    actor: teacher || "Unknown",
    lab,
    source: "lab-dashboard",
    timestamp: Date.now(),
    time: new Date().toLocaleString("id-ID"),
  };

  return db.ref("activity_log").push(entry).catch((err) => {
    console.warn("Activity log write failed:", err);
  });
}

function syncMissingInventoryFromGlobal() {
  if (inventorySyncAttempted || inventorySyncInProgress) return;
  inventorySyncInProgress = true;

  const existingNameSet = new Set(
    data.items
      .map((item) => String(item?.name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const usedCodes = new Set(
    data.items
      .map((item) => String(item?.code || "").trim().toLowerCase())
      .filter(Boolean),
  );

  db.ref("fasilitas")
    .once("value")
    .then((snap) => {
      const additions = [];
      const today = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      snap.forEach((child) => {
        const row = child.val() || {};
        if (String(row.lab || "").trim() !== lab) return;

        const name = String(row.name || "").trim();
        if (!name) return;

        const normalizedName = name.toLowerCase();
        if (existingNameSet.has(normalizedName)) return;

        const code = String(row.code || "").trim();
        const resolvedCode = code
          ? code
          : buildLabItemCode(name, usedCodes);
        if (code) usedCodes.add(code.toLowerCase());

        additions.push({
          code: resolvedCode,
          name,
          kat: row.kat || inferCategoryFromName(name),
          qty: Number(row.qty) || 1,
          cond: normalizeConditionForLab(row.condition || row.cond),
          note: row.note || "Sinkron dari data ringkasan",
          checked: row.checked || today,
        });

        existingNameSet.add(normalizedName);
      });

      if (!additions.length) return;

      const merged = [...data.items.map(stripMeta), ...additions];
      return db
        .ref(`lab_data/${lab}/items`)
        .set(merged)
        .then(() => {
          writeActivity(
            "update",
            "I",
            `Sinkron inventaris ${lab}: +${additions.length} item dari data ringkasan`,
          );
          showToast(`Inventaris disinkronkan: +${additions.length} item.`);
        });
    })
    .catch((err) => {
      console.error("Global inventory sync failed:", err);
    })
    .finally(() => {
      inventorySyncInProgress = false;
      inventorySyncAttempted = true;
    });
}


// Initialize Firebase listeners for this lab
function initLabDataListeners() {
  // Listen to inventory items
  db.ref(`lab_data/${lab}/items`).on(
    'value',
    (snap) => {
      data.items = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          data.items.push({ _key: child.key, ...child.val() });
        });
      }
      syncMissingInventoryFromGlobal();
      populateLaporanItemOptions();
      renderDashboard();
      renderInventaris();
    },
    (err) => {
      console.error('Firebase items error:', err);
      showToast('Gagal memuat inventaris dari Firebase.');
    },
  );

  // Listen to schedules
  db.ref(`lab_data/${lab}/jadwal`).on(
    'value',
    (snap) => {
      data.jadwal = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          data.jadwal.push({ _key: child.key, ...child.val() });
        });
      }
      renderDashboard();
      renderJadwal();
    },
    (err) => {
      console.error('Firebase jadwal error:', err);
      showToast('Gagal memuat jadwal dari Firebase.');
    },
  );

  // Listen to damage reports
  db.ref(`lab_data/${lab}/laporan`).on(
    'value',
    (snap) => {
      data.laporan = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          data.laporan.push({ _key: child.key, ...child.val() });
        });
      }
      renderDashboard();
      renderLaporan();
    },
    (err) => {
      console.error('Firebase laporan error:', err);
      showToast('Gagal memuat laporan dari Firebase.');
    },
  );

  // Listen to borrowing records
  db.ref(`lab_data/${lab}/pinjam`).on(
    'value',
    (snap) => {
      data.pinjam = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          data.pinjam.push({ _key: child.key, ...child.val() });
        });
      }
      renderPinjam();
    },
    (err) => {
      console.error('Firebase pinjam error:', err);
      showToast('Gagal memuat data peminjaman dari Firebase.');
    },
  );
}

// Save data changes to Firebase
function saveData() {
  const sanitize = (arr) =>
    arr.map((item) => {
      const { _key, _dbPath, _source, ...rest } = item;
      return rest;
    });

  return Promise.all([
    db.ref(`lab_data/${lab}/items`).set(sanitize(data.items)),
    db.ref(`lab_data/${lab}/jadwal`).set(sanitize(data.jadwal)),
    db.ref(`lab_data/${lab}/laporan`).set(sanitize(data.laporan)),
    db.ref(`lab_data/${lab}/pinjam`).set(sanitize(data.pinjam)),
  ]).catch((err) => {
    console.error('Firebase save error:', err);
    showToast('Gagal menyimpan perubahan ke Firebase.');
  });
}



/* ===========================
   INIT
=========================== */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await ensureAuthenticatedSession();
  } catch (err) {
    // Redirect already handled inside ensureAuthenticatedSession
    return;
  }

  populateUserInfo();
  updateTopbarDate();
  setInterval(updateTopbarDate, 60000);
  
  // Initialize Firebase listeners - will pull data from cloud and trigger renders
  initLabDataListeners();
  
  // Set today's date defaults in modals
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("addLapTgl").value = today;
  document.getElementById("addPinjamTgl").value = today;
  document.getElementById("addPinjamKembali").value = today;

  // Close dropdowns on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".notif-btn"))
      document.getElementById("notifDropdown").classList.remove("open");
    if (!e.target.closest(".topbar-user"))
      document.getElementById("userDropdown").classList.remove("open");
  });
});

/* ===========================
   USER INFO
=========================== */
function populateUserInfo() {
  const initials = teacher
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const emoji = LAB_EMOJIS[lab] || "🏫";

  setText("sidebarLabName", lab);
  setText("sidebarTeacher", teacher);
  setText("sidebarEmail", email);
  setText("sidebarAvatar", initials);

  setText("topbarLab", emoji + " " + lab);
  setText("topbarTeacher", teacher);
  setText("topbarAvatar", initials);
  setText("udAvatar", initials);
  setText("udName", teacher);
  setText("udEmail", email);

  setText("dashTitle", emoji + " " + lab);
  setText(
    "dashDesc",
    "Selamat datang, " + teacher + ". Berikut ringkasan kondisi lab hari ini.",
  );
}

function updateTopbarDate() {
  const now = new Date();
  const opts = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  setText("topbarDate", now.toLocaleDateString("id-ID", opts));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ===========================
   PAGE NAVIGATION
=========================== */
function showPage(page) {
  document
    .querySelectorAll(".page-content")
    .forEach((p) => p.classList.add("hidden"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.page === page);
  });

  const labels = {
    dashboard: "Dashboard",
    jadwal: "Jadwal Penggunaan",
    inventaris: "Inventaris Alat",
    laporan: "Laporan Kerusakan",
    peminjaman: "Peminjaman Alat",
    profil: "Profil Saya",
  };
  setText("topbarPage", labels[page] || page);

  // Close sidebar on mobile
  if (window.innerWidth <= 800) {
    document.getElementById("sidebar").classList.remove("open");
  }
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

function toggleNotif() {
  document.getElementById("notifDropdown").classList.toggle("open");
  document.getElementById("userDropdown").classList.remove("open");
}

function toggleUserMenu() {
  document.getElementById("userDropdown").classList.toggle("open");
  document.getElementById("notifDropdown").classList.remove("open");
}

function doLogout() {
  const finalize = () => {
    sessionStorage.clear();
    navigateTo("../index.html");
  };

  if (typeof auth === "undefined") {
    finalize();
    return;
  }

  auth
    .signOut()
    .catch((err) => {
      console.warn("Firebase signOut gagal:", err);
    })
    .finally(finalize);
}

/* ===========================
   DASHBOARD
=========================== */
function renderDashboard() {
  const items = data.items;
  const total = items.reduce((s, i) => s + i.qty, 0);
  const baikCount = items.filter(
    (i) => i.cond === "Sangat Baik" || i.cond === "Baik",
  ).length;
  const rusakAktif = data.laporan.filter((l) => l.status !== "Selesai").length;

  setText("statTotal", total);
  setText("statBaik", baikCount + " jenis");
  setText(
    "statBaikPct",
    Math.round((baikCount / items.length) * 100) + "% baik",
  );
  setText("statRusak", rusakAktif);
  setText("statJadwal", data.jadwal.length);
  setText("statTotalTrend", items.length + " jenis");

  // Condition bar
  const cExcellent = items.filter((i) => i.cond === "Sangat Baik").length;
  const cGood = items.filter((i) => i.cond === "Baik").length;
  const cFair = items.filter((i) => i.cond === "Cukup").length;
  const cPoor = items.filter((i) => i.cond === "Rusak").length;
  const tot = items.length || 1;
  document.getElementById("cbExcellent").style.width =
    (cExcellent / tot) * 100 + "%";
  document.getElementById("cbGood").style.width = (cGood / tot) * 100 + "%";
  document.getElementById("cbFair").style.width = (cFair / tot) * 100 + "%";
  document.getElementById("cbPoor").style.width = (cPoor / tot) * 100 + "%";
  const goodPct = Math.round(((cExcellent + cGood) / tot) * 100);
  setText("condBarPct", goodPct + "% kondisi baik");

  // Today's schedule
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const todayName = days[new Date().getDay()];
  const todaySched = data.jadwal.filter((j) => j.hari === todayName);
  const schedEl = document.getElementById("todaySchedule");
  if (todaySched.length === 0) {
    schedEl.innerHTML =
      '<div class="sched-empty">Tidak ada jadwal hari ini</div>';
  } else {
    schedEl.innerHTML = todaySched
      .map(
        (j) => `
      <div class="sched-item">
        <div class="sched-time">${j.mulai}–${j.selesai}</div>
        <div class="sched-info">
          <div class="sched-class">${j.kelas}</div>
          <div class="sched-mapel">${j.mapel}${j.note ? " · " + j.note : ""}</div>
        </div>
      </div>`,
      )
      .join("");
  }

  // Activity feed
  const activities = [
    {
      color: "blue",
      text: `<strong>${teacher}</strong> login ke sistem`,
      time: "Baru saja",
    },
    {
      color: "green",
      text: `Jadwal <strong>${data.jadwal[0]?.kelas || "-"}</strong> dikonfirmasi`,
      time: "1 jam lalu",
    },
    {
      color: "orange",
      text: `Laporan kerusakan <strong>${data.laporan[0]?.nama || "-"}</strong> dibuat`,
      time: "2 jam lalu",
    },
    {
      color: "blue",
      text: `Inventaris diperbarui: <strong>${data.items[0]?.name || "-"}</strong>`,
      time: "Kemarin",
    },
    {
      color: "green",
      text: `Peminjaman <strong>${data.pinjam[0]?.alat || "-"}</strong> dicatat`,
      time: "Kemarin",
    },
  ];
  document.getElementById("activityFeed").innerHTML = activities
    .map(
      (a) => `
    <div class="act-item">
      <div class="act-dot ${a.color}"></div>
      <div class="act-text">${a.text}</div>
      <div class="act-time">${a.time}</div>
    </div>`,
    )
    .join("");

  // Alert items
  const alerts = [];
  const rusak = items.filter((i) => i.cond === "Rusak");
  const cukup = items.filter((i) => i.cond === "Cukup");
  rusak.forEach((i) =>
    alerts.push({ cls: "danger", msg: "🔴 " + i.name + " — Kondisi Rusak" }),
  );
  cukup.forEach((i) =>
    alerts.push({ cls: "warn", msg: "🟡 " + i.name + " — Perlu Perhatian" }),
  );
  if (alerts.length === 0)
    alerts.push({ cls: "ok", msg: "✓ Semua alat dalam kondisi baik" });
  document.getElementById("alertItems").innerHTML = alerts
    .slice(0, 5)
    .map((a) => `<div class="alert-item ${a.cls}">${a.msg}</div>`)
    .join("");
}

/* ===========================
   JADWAL
=========================== */
function renderJadwal() {
  renderJadwalTable(data.jadwal);
  renderCalendar();
}

function renderJadwalTable(list) {
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const today = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ][new Date().getDay()];
  document.getElementById("jadwalBody").innerHTML =
    list
      .map((j, i) => {
        const isToday = j.hari === today;
        return `<tr>
      <td>${j.hari}</td>
      <td>${j.mulai} – ${j.selesai}</td>
      <td><strong style="color:var(--text)">${j.kelas}</strong></td>
      <td>${j.mapel}</td>
      <td>${teacher}</td>
      <td><span class="badge ${isToday ? "ok" : "gray"}">${isToday ? "Hari Ini" : "Terjadwal"}</span></td>
      <td>
        <button class="tbl-btn danger" onclick="deleteJadwal(${i})">Hapus</button>
      </td>
    </tr>`;
      })
      .join("") ||
    '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px">Belum ada jadwal</td></tr>';
}

function filterJadwal() {
  const q = document.getElementById("jadwalSearch").value.toLowerCase();
  const filtered = data.jadwal.filter(
    (j) =>
      j.kelas.toLowerCase().includes(q) || j.mapel.toLowerCase().includes(q),
  );
  renderJadwalTable(filtered);
}

function addJadwal() {
  const kelas = document.getElementById("addJadwalKelas").value.trim();
  const mapel = document.getElementById("addJadwalMapel").value.trim();
  if (!kelas || !mapel) {
    showToast("Kelas dan mata pelajaran wajib diisi.");
    return;
  }
  const hariR = document.querySelector('input[name="jadwalHariR"]:checked');
  data.jadwal.push({
    hari: hariR ? hariR.value : "Senin",
    mulai: document.getElementById("addJadwalMulai").value,
    selesai: document.getElementById("addJadwalSelesai").value,
    kelas,
    mapel,
    note: document.getElementById("addJadwalNote").value.trim(),
  });
  saveData();
  renderJadwal();
  renderDashboard();
  closeModal("addJadwalModal");
  showToast("Jadwal berhasil ditambahkan.");
  writeActivity("add", "J", `Jadwal ditambahkan: ${kelas} - ${mapel}`);
  document.getElementById("addJadwalKelas").value = "";
  document.getElementById("addJadwalMapel").value = "";
  document.getElementById("addJadwalNote").value = "";
}

function deleteJadwal(idx) {
  if (!confirm("Hapus jadwal ini?")) return;
  const removed = data.jadwal[idx];
  data.jadwal.splice(idx, 1);
  saveData();
  renderJadwal();
  renderDashboard();
  showToast("Jadwal dihapus.");
  if (removed) {
    writeActivity(
      "warn",
      "J",
      `Jadwal dihapus: ${removed.kelas || "-"} - ${removed.mapel || "-"}`,
    );
  }
}

/* ===========================
   CALENDAR
=========================== */
function renderCalendar() {
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const todayName = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ][new Date().getDay()];

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(
    now.getDate() -
      (now.getDay() === 0 ? 6 : now.getDay() - 1) +
      weekOffset * 7,
  );

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 5);

  const fmt = (d) =>
    d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  setText(
    "weekLabel",
    fmt(startOfWeek) + " – " + fmt(endOfWeek) + " " + startOfWeek.getFullYear(),
  );

  document.getElementById("calendarGrid").innerHTML = days
    .map((day) => {
      const isToday = day === todayName && weekOffset === 0;
      const events = data.jadwal.filter((j) => j.hari === day);
      return `<div class="cal-day ${isToday ? "today" : ""}">
      <div class="cal-day-name">${day}</div>
      ${events.map((e) => `<div class="cal-event" title="${e.kelas} · ${e.mapel}">${e.mulai} ${e.kelas}</div>`).join("")}
    </div>`;
    })
    .join("");
}

function changeWeek(dir) {
  weekOffset += dir;
  renderCalendar();
}

/* ===========================
   INVENTARIS
=========================== */
function renderInventaris() {
  filterInventaris();
}

function filterInventaris() {
  const q = document.getElementById("invSearch").value.toLowerCase();
  const cond = document.getElementById("invFilterCond").value;
  const kat = document.getElementById("invFilterKat").value;

  const filtered = data.items.filter(
    (i) =>
      (i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) &&
      (!cond || i.cond === cond) &&
      (!kat || i.kat === kat),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / INV_PER_PAGE));
  if (invPage > totalPages) invPage = totalPages;
  const slice = filtered.slice(
    (invPage - 1) * INV_PER_PAGE,
    invPage * INV_PER_PAGE,
  );

  const condMap = {
    "Sangat Baik": "ok",
    Baik: "good",
    Cukup: "warn",
    Rusak: "danger",
  };

  document.getElementById("invBody").innerHTML =
    slice
      .map((item) => {
        const realIdx = data.items.indexOf(item);
        // Build kondisi cell: jika ada units, tampilkan summary per kondisi
        let condCell;
        if (item.units && item.units.length > 0) {
          const u = item.units;
          const sb = u.filter((x) => x.cond === "Sangat Baik").length;
          const b = u.filter((x) => x.cond === "Baik").length;
          const c = u.filter((x) => x.cond === "Cukup").length;
          const r = u.filter((x) => x.cond === "Rusak").length;
          const parts = [];
          if (sb) parts.push(`<span class="badge ok">${sb} Sangat Baik</span>`);
          if (b) parts.push(`<span class="badge good">${b} Baik</span>`);
          if (c) parts.push(`<span class="badge warn">${c} Cukup</span>`);
          if (r) parts.push(`<span class="badge danger">${r} Rusak</span>`);
          condCell = `<div style="display:flex;flex-wrap:wrap;gap:4px">${parts.join("")}</div>`;
        } else {
          condCell = `<span class="badge ${condMap[item.cond] || "gray"}">${item.cond}</span>`;
        }
        const hasUnits = item.units && item.units.length > 0;
        return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${item.code}</td>
      <td><strong style="color:var(--text)">${item.name}</strong>${item.note ? '<br><span style="font-size:10px;color:var(--text-dim)">' + item.note + "</span>" : ""}</td>
      <td>${item.kat}</td>
      <td style="font-weight:600">${item.qty}</td>
      <td>${condCell}</td>
      <td style="font-size:11px">${item.checked}</td>
      <td>
        ${hasUnits ? `<button class="tbl-btn info" onclick="openUnitModal(${realIdx})">📋 Detail Unit</button>` : ""}
        <button class="tbl-btn" onclick="openEditItem(${realIdx})">Edit</button>
        <button class="tbl-btn danger" onclick="deleteItem(${realIdx})">Hapus</button>
      </td>
    </tr>`;
      })
      .join("") ||
    '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px">Tidak ada data</td></tr>';

  // Pagination
  let pgHtml = "";
  for (let p = 1; p <= totalPages; p++) {
    pgHtml += `<button class="pg-btn ${p === invPage ? "active" : ""}" onclick="goInvPage(${p})">${p}</button>`;
  }
  document.getElementById("invPagination").innerHTML = pgHtml;
}

function goInvPage(p) {
  invPage = p;
  filterInventaris();
}

function addItem() {
  const name = document.getElementById("addItemName").value.trim();
  if (!name) {
    showToast("Nama alat wajib diisi.");
    return;
  }
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  data.items.push({
    code: document.getElementById("addItemCode").value.trim() || autoCode(),
    name,
    kat: document.getElementById("addItemKat").value,
    qty: parseInt(document.getElementById("addItemQty").value) || 1,
    cond: (
      document.querySelector('input[name="addItemCondR"]:checked') || {
        value: "Baik",
      }
    ).value,
    note: document.getElementById("addItemNote").value.trim(),
    checked: today,
  });
  saveData();
  renderInventaris();
  renderDashboard();
  closeModal("addItemModal");
  showToast("Alat berhasil ditambahkan.");
  writeActivity("add", "I", `Item inventaris ditambahkan: ${name}`);
  document.getElementById("addItemName").value = "";
  document.getElementById("addItemCode").value = "";
  document.getElementById("addItemNote").value = "";
  document.getElementById("addItemQty").value = "1";
}

function autoCode() {
  const prefix = lab
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return prefix + "-" + String(data.items.length + 1).padStart(3, "0");
}

function openEditItem(idx) {
  const item = data.items[idx];
  document.getElementById("editItemIdx").value = idx;
  document.getElementById("editItemName").value = item.name;
  document.getElementById("editItemCode").value = item.code;
  document.getElementById("editItemQty").value = item.qty;
  document.getElementById("editItemNote").value = item.note;
  setSelect("editItemKat", item.kat);
  // Set radio button kondisi
  document.querySelectorAll('input[name="editItemCondR"]').forEach((r) => {
    r.checked = r.value === item.cond;
  });
  openModal("editItemModal");
}

function saveEditItem() {
  const idx = parseInt(document.getElementById("editItemIdx").value);
  const prevName = data.items[idx]?.name || "";
  const name = document.getElementById("editItemName").value.trim();
  if (!name) {
    showToast("Nama alat wajib diisi.");
    return;
  }
  const condR = document.querySelector('input[name="editItemCondR"]:checked');
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  data.items[idx] = {
    ...data.items[idx],
    name,
    code: document.getElementById("editItemCode").value.trim(),
    kat: document.getElementById("editItemKat").value,
    qty: parseInt(document.getElementById("editItemQty").value) || 1,
    cond: condR ? condR.value : data.items[idx].cond,
    note: document.getElementById("editItemNote").value.trim(),
    checked: today,
  };
  saveData();
  renderInventaris();
  renderDashboard();
  closeModal("editItemModal");
  showToast("Data alat diperbarui.");
  writeActivity(
    "update",
    "I",
    `Item inventaris diperbarui: ${prevName || name}${
      prevName && prevName !== name ? ` -> ${name}` : ""
    }`,
  );
}

function deleteItem(idx) {
  if (!confirm('Hapus alat "' + data.items[idx].name + '"?')) return;
  const removedName = data.items[idx]?.name || "-";
  data.items.splice(idx, 1);
  saveData();
  renderInventaris();
  renderDashboard();
  showToast("Alat dihapus.");
  writeActivity("warn", "I", `Item inventaris dihapus: ${removedName}`);
}

/* ===========================
   UNIT DETAIL MODAL
=========================== */
let currentUnitItemIdx = -1;

function openUnitModal(itemIdx) {
  currentUnitItemIdx = itemIdx;
  const item = data.items[itemIdx];
  document.getElementById("unitModalTitle").textContent =
    item.name + " — Detail Unit";
  document.getElementById("unitModalSub").textContent =
    item.code + " · " + item.qty + " unit";
  renderUnitTable();
  openModal("unitDetailModal");
}

function renderUnitTable() {
  const item = data.items[currentUnitItemIdx];
  if (!item || !item.units) return;
  const condMap = {
    "Sangat Baik": "ok",
    Baik: "good",
    Cukup: "warn",
    Rusak: "danger",
  };
  const q = (document.getElementById("unitSearch") || {}).value || "";
  const f = (document.getElementById("unitFilter") || {}).value || "";
  const list = item.units.filter(
    (u) =>
      (!q || u.label.toLowerCase().includes(q.toLowerCase())) &&
      (!f || u.cond === f),
  );
  document.getElementById("unitBody").innerHTML =
    list
      .map((u) => {
        const realIdx = item.units.indexOf(u);
        return `<tr class="${u.cond === "Rusak" ? "unit-row-rusak" : u.cond === "Cukup" ? "unit-row-cukup" : ""}">
      <td style="font-weight:600;color:var(--text)">${u.label}</td>
      <td>
        <select class="unit-cond-sel" onchange="updateUnitCond(${realIdx}, this.value)">
          <option ${u.cond === "Sangat Baik" ? "selected" : ""}>Sangat Baik</option>
          <option ${u.cond === "Baik" ? "selected" : ""}>Baik</option>
          <option ${u.cond === "Cukup" ? "selected" : ""}>Cukup</option>
          <option ${u.cond === "Rusak" ? "selected" : ""}>Rusak</option>
        </select>
      </td>
      <td>
        <input class="unit-note-inp" value="${u.note}" placeholder="Catatan kerusakan..." onchange="updateUnitNote(${realIdx}, this.value)">
      </td>
      <td>
        <span class="badge ${condMap[u.cond] || "gray"}">${u.cond}</span>
      </td>
    </tr>`;
      })
      .join("") ||
    '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:16px">Tidak ada unit</td></tr>';

  // Update summary bar
  const all = item.units;
  const sb = all.filter((x) => x.cond === "Sangat Baik").length;
  const b = all.filter((x) => x.cond === "Baik").length;
  const c = all.filter((x) => x.cond === "Cukup").length;
  const r = all.filter((x) => x.cond === "Rusak").length;
  document.getElementById("unitSummary").innerHTML =
    `<span class="badge ok">${sb} Sangat Baik</span>` +
    `<span class="badge good">${b} Baik</span>` +
    `<span class="badge warn">${c} Cukup</span>` +
    `<span class="badge danger">${r} Rusak</span>`;
}

function updateUnitCond(unitIdx, val) {
  data.items[currentUnitItemIdx].units[unitIdx].cond = val;
  // Sync item.cond ke kondisi terburuk
  const units = data.items[currentUnitItemIdx].units;
  if (units.some((u) => u.cond === "Rusak"))
    data.items[currentUnitItemIdx].cond = "Rusak";
  else if (units.some((u) => u.cond === "Cukup"))
    data.items[currentUnitItemIdx].cond = "Cukup";
  else if (units.some((u) => u.cond === "Baik"))
    data.items[currentUnitItemIdx].cond = "Baik";
  else data.items[currentUnitItemIdx].cond = "Sangat Baik";
  saveData();
  renderUnitTable();
  renderInventaris();
  renderDashboard();
}

function updateUnitNote(unitIdx, val) {
  data.items[currentUnitItemIdx].units[unitIdx].note = val;
  saveData();
}

function filterUnitTable() {
  renderUnitTable();
}

function setSelect(id, val) {
  const sel = document.getElementById(id);
  for (let o of sel.options) o.selected = o.value === val;
}

/* ===========================
   LAPORAN
=========================== */
function renderLaporan() {
  updateLaporanStats();
  renderPrioBreakdown();
  renderKritisList();
  filterLaporan();
}

function updateLaporanStats() {
  const total = data.laporan.length;
  const open = data.laporan.filter(
    (l) => l.status === "Belum Ditangani",
  ).length;
  const process = data.laporan.filter(
    (l) => l.status === "Sedang Diperbaiki",
  ).length;
  const done = data.laporan.filter((l) => l.status === "Selesai").length;
  const kritis = data.laporan.filter((l) => l.prioritas === "Kritis").length;
  setText("lsTotal", total);
  setText("lsOpen", open);
  setText("lsProcess", process);
  setText("lsDone", done);
  // sub-text
  const elSub = document.getElementById("lsKritisSub");
  if (elSub) elSub.textContent = kritis + " prioritas kritis";
}

function renderPrioBreakdown() {
  const el = document.getElementById("prioBreakdown");
  if (!el) return;
  const counts = { Kritis: 0, Tinggi: 0, Sedang: 0, Rendah: 0 };
  data.laporan.forEach((l) => {
    if (counts[l.prioritas] !== undefined) counts[l.prioritas]++;
  });
  const max = Math.max(...Object.values(counts), 1);
  const colors = {
    Kritis: "critical",
    Tinggi: "high",
    Sedang: "medium",
    Rendah: "low",
  };
  el.innerHTML = Object.entries(counts)
    .map(
      ([prio, cnt]) => `
    <div class="prio-row">
      <span class="prio-row-label">${prio}</span>
      <div class="prio-bar-track"><div class="prio-bar-fill ${colors[prio]}" style="width:${Math.round((cnt / max) * 100)}%"></div></div>
      <span class="prio-row-count">${cnt}</span>
    </div>`,
    )
    .join("");
}

function renderKritisList() {
  const el = document.getElementById("kritisList");
  if (!el) return;
  const urgent = data.laporan
    .filter(
      (l) =>
        (l.prioritas === "Kritis" || l.prioritas === "Tinggi") &&
        l.status !== "Selesai",
    )
    .slice(0, 5);
  if (!urgent.length) {
    el.innerHTML =
      '<div class="kritis-empty">✅ Tidak ada laporan mendesak</div>';
    return;
  }
  el.innerHTML = urgent
    .map((l) => {
      const isKritis = l.prioritas === "Kritis";
      return `<div class="kritis-item ${isKritis ? "" : "warn"}">
      <div class="kritis-dot ${isKritis ? "" : "warn"}"></div>
      <div class="kritis-info">
        <div class="kritis-name">${l.nama}</div>
        <div class="kritis-desc">${l.desk}</div>
        <div class="kritis-date">${l.tgl} · ${l.status}</div>
      </div>
      <span class="kritis-badge ${isKritis ? "kritis" : "tinggi"}">${l.prioritas}</span>
    </div>`;
    })
    .join("");
}

function filterLaporan() {
  const f = document.getElementById("laporanFilter").value;
  const q = (document.getElementById("laporanSearch") || {}).value || "";
  let list = f ? data.laporan.filter((l) => l.status === f) : data.laporan;
  if (q)
    list = list.filter(
      (l) =>
        l.nama.toLowerCase().includes(q.toLowerCase()) ||
        l.desk.toLowerCase().includes(q.toLowerCase()),
    );
  const prioMap = {
    Rendah: "gray",
    Sedang: "good",
    Tinggi: "warn",
    Kritis: "danger",
  };
  const statMap = {
    "Belum Ditangani": "danger",
    "Sedang Diperbaiki": "warn",
    Selesai: "ok",
  };
  const stepMap = { "Belum Ditangani": 0, "Sedang Diperbaiki": 1, Selesai: 2 };
  document.getElementById("laporanBody").innerHTML =
    list
      .map((l) => {
        const realIdx = data.laporan.indexOf(l);
        const step = stepMap[l.status] || 0;
        const steps = [0, 1, 2]
          .map(
            (s) =>
              `<div class="ps-step ${s < step ? "done" : s === step && step < 2 ? "active" : s < 2 && step === 2 ? "done" : ""}"></div>`,
          )
          .join("");
        return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${l.id}</td>
      <td><strong style="color:var(--text)">${l.nama}</strong></td>
      <td style="max-width:180px;white-space:normal;font-size:11px;color:var(--text-muted)">${l.desk}</td>
      <td style="font-size:11px">${l.tgl}</td>
      <td><span class="badge ${prioMap[l.prioritas] || "gray"}">${l.prioritas}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-steps">${steps}</div>
          <span class="badge ${statMap[l.status] || "gray"}" style="font-size:9px">${l.status}</span>
        </div>
      </td>
      <td>
        ${l.status !== "Selesai" ? `<button class="tbl-btn" onclick="advanceLaporan(${realIdx})">▶ Lanjut</button>` : '<span style="font-size:11px;color:var(--green)">✓ Selesai</span>'}
        <button class="tbl-btn danger" onclick="deleteLaporan(${realIdx})">Hapus</button>
      </td>
    </tr>`;
      })
      .join("") ||
    '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px">Tidak ada laporan</td></tr>';
}

function setLaporanFilter(val) {
  document.getElementById("laporanFilter").value = val;
  filterLaporan();
}

function populateLaporanItemOptions() {
  const select = document.getElementById("addLapNama");
  if (!select) return;

  const currentValue = select.value;
  const items = [...data.items].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || "")),
  );

  select.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  if (!items.length) {
    defaultOpt.textContent = "Inventaris kosong. Tambah alat dulu.";
    select.disabled = true;
  } else {
    defaultOpt.textContent = "Pilih alat dari inventaris...";
    select.disabled = false;
  }
  select.appendChild(defaultOpt);

  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.name || "";
    opt.textContent = `${item.code || "-"} - ${item.name || "Tanpa Nama"}`;
    select.appendChild(opt);
  });

  if (currentValue && items.some((item) => item.name === currentValue)) {
    select.value = currentValue;
  }
}

function addLaporan() {
  const nama = document.getElementById("addLapNama").value;
  const desk = document.getElementById("addLapDesk").value.trim();
  if (!nama || !desk) {
    showToast("Pilih alat dari inventaris dan isi deskripsi wajib.");
    return;
  }
  const prioR = document.querySelector('input[name="lapPrioR"]:checked');
  const newId = "LAP-" + String(data.laporan.length + 1).padStart(3, "0");
  data.laporan.unshift({
    id: newId,
    nama,
    desk,
    tgl: document.getElementById("addLapTgl").value,
    prioritas: prioR ? prioR.value : "Sedang",
    status: "Belum Ditangani",
  });
  saveData();
  renderLaporan();
  renderDashboard();
  closeModal("addLaporanModal");
  showToast("Laporan berhasil dikirim.");
  writeActivity("warn", "R", `Laporan kerusakan baru: ${nama}`);
  document.getElementById("addLapNama").value = "";
  document.getElementById("addLapDesk").value = "";
}

function advanceLaporan(idx) {
  const l = data.laporan[idx];
  const beforeStatus = l.status;
  if (l.status === "Belum Ditangani") l.status = "Sedang Diperbaiki";
  else if (l.status === "Sedang Diperbaiki") l.status = "Selesai";
  saveData();
  renderLaporan();
  renderDashboard();
  showToast("Status laporan diperbarui.");
  writeActivity(
    "update",
    "R",
    `Status laporan ${l.id || ""} (${l.nama || "-"}) diperbarui: ${beforeStatus} -> ${l.status}`,
  );
}

function deleteLaporan(idx) {
  if (!confirm("Hapus laporan ini?")) return;
  const removed = data.laporan[idx];
  data.laporan.splice(idx, 1);
  saveData();
  renderLaporan();
  renderDashboard();
  showToast("Laporan dihapus.");
  if (removed) {
    writeActivity(
      "warn",
      "R",
      `Laporan dihapus: ${removed.id || ""} ${removed.nama || "-"}`,
    );
  }
}

/* ===========================
   PEMINJAMAN
=========================== */
function renderPinjam() {
  filterPinjam();
  updatePinjamStats();
}

function updatePinjamStats() {
  setText(
    "psDipinjam",
    data.pinjam.filter((p) => p.status === "Dipinjam").length,
  );
  setText(
    "psDikembalikan",
    data.pinjam.filter((p) => p.status === "Dikembalikan").length,
  );
  setText(
    "psTerlambat",
    data.pinjam.filter((p) => p.status === "Terlambat").length,
  );
}

function filterPinjam() {
  const q = document.getElementById("pinjamSearch").value.toLowerCase();
  const list = data.pinjam.filter(
    (p) => p.nama.toLowerCase().includes(q) || p.alat.toLowerCase().includes(q),
  );
  const statMap = { Dipinjam: "good", Dikembalikan: "ok", Terlambat: "danger" };
  document.getElementById("pinjamBody").innerHTML =
    list
      .map((p, i) => {
        const realIdx = data.pinjam.indexOf(p);
        return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${p.id}</td>
      <td><strong style="color:var(--text)">${p.nama}</strong><br><span style="font-size:10px;color:var(--text-dim)">${p.kelas}</span></td>
      <td>${p.alat}</td>
      <td>${p.qty}</td>
      <td style="font-size:11px">${p.tglPinjam}</td>
      <td style="font-size:11px">${p.tglKembali}</td>
      <td><span class="badge ${statMap[p.status] || "gray"}">${p.status}</span></td>
      <td>
        ${p.status === "Dipinjam" || p.status === "Terlambat" ? `<button class="tbl-btn" onclick="returnPinjam(${realIdx})">Kembalikan</button>` : ""}
        <button class="tbl-btn danger" onclick="deletePinjam(${realIdx})">Hapus</button>
      </td>
    </tr>`;
      })
      .join("") ||
    '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:20px">Tidak ada data peminjaman</td></tr>';
}

function addPinjam() {
  const nama = document.getElementById("addPinjamNama").value.trim();
  const alat = document.getElementById("addPinjamAlat").value.trim();
  if (!nama || !alat) {
    showToast("Nama peminjam dan alat wajib diisi.");
    return;
  }
  const newId = "PNJ-" + String(data.pinjam.length + 1).padStart(3, "0");
  data.pinjam.unshift({
    id: newId,
    nama,
    alat,
    kelas: document.getElementById("addPinjamKelas").value.trim(),
    qty: parseInt(document.getElementById("addPinjamQty").value) || 1,
    tglPinjam: document.getElementById("addPinjamTgl").value,
    tglKembali: document.getElementById("addPinjamKembali").value,
    status: "Dipinjam",
  });
  saveData();
  renderPinjam();
  closeModal("addPinjamModal");
  showToast("Peminjaman berhasil dicatat.");
  writeActivity("add", "P", `Peminjaman dicatat: ${nama} meminjam ${alat}`);
  document.getElementById("addPinjamNama").value = "";
  document.getElementById("addPinjamKelas").value = "";
  document.getElementById("addPinjamAlat").value = "";
  document.getElementById("addPinjamQty").value = "1";
}

function returnPinjam(idx) {
  const record = data.pinjam[idx];
  data.pinjam[idx].status = "Dikembalikan";
  saveData();
  renderPinjam();
  showToast("Alat berhasil dikembalikan.");
  if (record) {
    writeActivity(
      "update",
      "P",
      `Pengembalian alat: ${record.nama || "-"} mengembalikan ${record.alat || "-"}`,
    );
  }
}

function deletePinjam(idx) {
  if (!confirm("Hapus catatan peminjaman ini?")) return;
  const removed = data.pinjam[idx];
  data.pinjam.splice(idx, 1);
  saveData();
  renderPinjam();
  showToast("Catatan dihapus.");
  if (removed) {
    writeActivity(
      "warn",
      "P",
      `Catatan peminjaman dihapus: ${removed.nama || "-"} - ${removed.alat || "-"}`,
    );
  }
}

/* ===========================
   PROFIL
=========================== */
function renderProfil() {
  const initials = teacher
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const emoji = LAB_EMOJIS[lab] || "🏫";
  const now = new Date().toLocaleString("id-ID");

  setText("profilAvatar", initials);
  setText("profilName", teacher);
  setText("profilEmail", email);
  setText("profilLab", lab);
  setText("profilLabBadge", emoji + " " + lab);
  setText("profilLastLogin", now);

  setText("pstatItem", data.items.length);
  setText("pstatLaporan", data.laporan.length);
  setText("pstatJadwal", data.jadwal.length);
  setText("pstatPinjam", data.pinjam.length);
}

/* ===========================
   PHOTO PREVIEW & HELPERS
=========================== */
function previewPhoto(inputId, previewId, placeholderId) {
  const file = document.getElementById(inputId).files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById(previewId);
    const ph = document.getElementById(placeholderId);
    img.src = e.target.result;
    img.style.display = "block";
    if (ph) ph.style.display = "none";
    // Show remove button if exists
    const removeId = inputId.replace("Photo", "RemovePhoto");
    const removeBtn = document.getElementById(removeId);
    if (removeBtn) removeBtn.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function removePhoto(inputId, previewId, placeholderId, removeBtnId) {
  document.getElementById(inputId).value = "";
  const img = document.getElementById(previewId);
  img.src = "";
  img.style.display = "none";
  const ph = document.getElementById(placeholderId);
  if (ph) ph.style.display = "flex";
  const removeBtn = document.getElementById(removeBtnId);
  if (removeBtn) removeBtn.style.display = "none";
}

function stepQty(inputId, delta) {
  const el = document.getElementById(inputId);
  const val = parseInt(el.value) || 1;
  el.value = Math.max(1, val + delta);
}

/* ===========================
   MODALS
=========================== */
function openModal(id) {
  if (id === "addLaporanModal") {
    populateLaporanItemOptions();
  }
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
function closeModalOutside(e) {
  if (e.target === e.currentTarget) closeModal(e.currentTarget.id);
}

/* ===========================
   TOAST
=========================== */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}
