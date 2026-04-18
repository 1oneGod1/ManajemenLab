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

const DEFAULT_CATEGORIES = ["Elektronik", "Peralatan", "Furnitur", "Bahan"];
let categories = [...DEFAULT_CATEGORIES];

// Pagination & Navigation State
let invPage = 1;
const INV_PER_PAGE = 10;
let weekOffset = 0;

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

// Initialize Firebase listeners for this lab
function initLabDataListeners() {
  // Listen to categories
  db.ref(`lab_data/${lab}/categories`).on(
    "value",
    (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        categories = Array.isArray(val) ? val.filter(Boolean) : Object.values(val || {}).filter(Boolean);
        if (!categories.length) categories = [...DEFAULT_CATEGORIES];
      } else {
        categories = [...DEFAULT_CATEGORIES];
      }
      renderKategoriDropdowns();
      renderKategoriList();
      filterInventaris();
    },
    (err) => {
      console.error("Firebase categories error:", err);
    },
  );

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
      populateLaporanItemOptions();
      renderDashboard();
      renderInventaris();
      renderProfil();
      renderKategoriList();
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
      renderProfil();
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
      renderProfil();
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
      renderProfil();
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

  if (page === "profil") renderProfil();

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
  const searchEl = document.getElementById("invSearch");
  const condEl = document.getElementById("invFilterCond");
  const katEl = document.getElementById("invFilterKat");
  const body = document.getElementById("invBody");
  if (!body) return;

  const q = (searchEl?.value || "").toLowerCase();
  const cond = condEl?.value || "";
  const kat = katEl?.value || "";

  const filtered = data.items.filter(
    (i) =>
      ((i.name || "").toLowerCase().includes(q) ||
        (i.code || "").toLowerCase().includes(q)) &&
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

  if (slice.length === 0) {
    body.innerHTML =
      '<div class="inv-empty">Tidak ada alat yang cocok dengan filter.</div>';
  } else {
    body.innerHTML = slice
      .map((item) => {
        const realIdx = data.items.indexOf(item);
        const safeName = (item.name || "").replace(/'/g, "\\'");

        let condHtml;
        const hasUnits = item.units && item.units.length > 0;
        if (hasUnits) {
          const u = item.units;
          const counts = {
            ok: u.filter((x) => x.cond === "Sangat Baik").length,
            good: u.filter((x) => x.cond === "Baik").length,
            warn: u.filter((x) => x.cond === "Cukup").length,
            danger: u.filter((x) => x.cond === "Rusak").length,
          };
          const parts = [];
          if (counts.ok) parts.push(`<span class="badge ok">${counts.ok} SB</span>`);
          if (counts.good) parts.push(`<span class="badge good">${counts.good} B</span>`);
          if (counts.warn) parts.push(`<span class="badge warn">${counts.warn} C</span>`);
          if (counts.danger) parts.push(`<span class="badge danger">${counts.danger} R</span>`);
          condHtml = parts.join(" ");
        } else {
          condHtml = `<span class="badge ${condMap[item.cond] || "gray"}">${item.cond || "-"}</span>`;
        }

        const photo = item.fotoUrl
          ? `<img src="${item.fotoUrl}" alt="${item.name}" class="ic-photo" onerror="this.parentElement.classList.add('no-photo');this.remove()" />`
          : "";

        return `
          <div class="inv-card ${item.fotoUrl ? "" : "no-photo"}" onclick="${
            item.fotoUrl
              ? `openPhotoLightbox('${item.fotoUrl}','${safeName}')`
              : `openEditItem(${realIdx})`
          }">
            <div class="ic-photo-wrap">
              ${photo}
              <span class="ic-kat-badge">${item.kat || "-"}</span>
              ${hasUnits ? `<span class="ic-unit-badge" title="Ada detail unit">● UNIT</span>` : ""}
            </div>
            <div class="ic-body">
              <div class="ic-top">
                <div class="ic-name" title="${item.name}">${item.name}</div>
                <span class="ic-code">${item.code || "-"}</span>
              </div>
              ${item.note ? `<div class="ic-note">${item.note}</div>` : ""}
              <div class="ic-meta">
                <span class="ic-qty">Qty: <strong>${item.qty || 0}</strong></span>
                <span class="ic-cond">${condHtml}</span>
              </div>
              <div class="ic-checked">Cek terakhir: ${item.checked || "-"}</div>
              <div class="ic-actions">
                ${hasUnits ? `<button type="button" class="ic-btn info" onclick="event.stopPropagation(); openUnitModal(${realIdx})">Detail Unit</button>` : ""}
                <button type="button" class="ic-btn" onclick="event.stopPropagation(); openEditItem(${realIdx})">Edit</button>
                <button type="button" class="ic-btn danger" onclick="event.stopPropagation(); deleteItem(${realIdx})" title="Hapus">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>`;
      })
      .join("");
  }

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

async function addItem() {
  const errBox = document.getElementById("addItemErr");
  if (errBox) {
    errBox.style.display = "none";
    errBox.textContent = "";
  }

  try {
    const name = document.getElementById("addItemName").value.trim();
    if (!name) {
      showToast("Nama alat wajib diisi.");
      return;
    }
    if (typeof uploadToR2 !== "function") {
      throw new Error("uploadToR2 tidak terdefinisi — r2-service.js gagal load.");
    }

    const btn = document.querySelector("#addItemModal .btn-save");
    if (btn) {
      btn.disabled = true;
      btn.dataset.prevHtml = btn.innerHTML;
      btn.innerHTML = "Menyimpan…";
    }

    try {
      const photoFile = document.getElementById("addItemPhoto")?.files?.[0];
      let fotoUrl = "";
      if (photoFile) {
        showToast("Mengunggah foto ke R2…");
        fotoUrl = await uploadToR2(photoFile, "fasilitas");
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
        fotoUrl,
      });
      await saveData();
      renderInventaris();
      renderDashboard();
      closeModal("addItemModal");
      showToast("Alat berhasil ditambahkan.");
      writeActivity("add", "I", `Item inventaris ditambahkan: ${name}`);
      document.getElementById("addItemName").value = "";
      document.getElementById("addItemCode").value = "";
      document.getElementById("addItemNote").value = "";
      document.getElementById("addItemQty").value = "1";
      removePhoto(
        "addItemPhoto",
        "addItemPhotoPreview",
        "addItemPhotoPlaceholder",
        "addItemRemovePhoto",
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.prevHtml || "Simpan Alat";
      }
    }
  } catch (err) {
    console.error("[addItem] ERROR:", err);
    const msg = err?.message || String(err) || "Gagal menambahkan alat";
    if (errBox) {
      errBox.textContent = "⚠ " + msg;
      errBox.style.display = "block";
    }
    showToast("⚠ Gagal: " + msg);
  }
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
  document.getElementById("editItemNote").value = item.note || "";
  setSelect("editItemKat", item.kat);
  document.querySelectorAll('input[name="editItemCondR"]').forEach((r) => {
    r.checked = r.value === item.cond;
  });

  // Load existing photo preview
  const fileInput = document.getElementById("editItemPhoto");
  const preview = document.getElementById("editItemPhotoPreview");
  const placeholder = document.getElementById("editItemPhotoPlaceholder");
  const removeBtn = document.getElementById("editItemRemovePhoto");
  if (fileInput) fileInput.value = "";
  if (item.fotoUrl) {
    preview.src = item.fotoUrl;
    preview.style.display = "block";
    if (placeholder) placeholder.style.display = "none";
    if (removeBtn) removeBtn.style.display = "block";
  } else {
    preview.src = "";
    preview.style.display = "none";
    if (placeholder) placeholder.style.display = "flex";
    if (removeBtn) removeBtn.style.display = "none";
  }
  const errBox = document.getElementById("editItemErr");
  if (errBox) {
    errBox.style.display = "none";
    errBox.textContent = "";
  }
  openModal("editItemModal");
}

async function saveEditItem() {
  const errBox = document.getElementById("editItemErr");
  if (errBox) {
    errBox.style.display = "none";
    errBox.textContent = "";
  }

  try {
    const idx = parseInt(document.getElementById("editItemIdx").value);
    const prevItem = data.items[idx] || {};
    const prevName = prevItem.name || "";
    const name = document.getElementById("editItemName").value.trim();
    if (!name) {
      showToast("Nama alat wajib diisi.");
      return;
    }

    const btn = document.querySelector("#editItemModal .btn-save");
    if (btn) {
      btn.disabled = true;
      btn.dataset.prevHtml = btn.innerHTML;
      btn.innerHTML = "Menyimpan…";
    }

    try {
      const photoFile = document.getElementById("editItemPhoto")?.files?.[0];
      const previewEl = document.getElementById("editItemPhotoPreview");
      const photoCleared =
        !photoFile && previewEl && previewEl.style.display === "none";

      let fotoUrl = prevItem.fotoUrl || "";
      if (photoFile) {
        if (typeof uploadToR2 !== "function") {
          throw new Error("uploadToR2 tidak terdefinisi.");
        }
        showToast("Mengunggah foto ke R2…");
        fotoUrl = await uploadToR2(photoFile, "fasilitas");
      } else if (photoCleared) {
        fotoUrl = "";
      }

      const condR = document.querySelector(
        'input[name="editItemCondR"]:checked',
      );
      const today = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      data.items[idx] = {
        ...prevItem,
        name,
        code: document.getElementById("editItemCode").value.trim(),
        kat: document.getElementById("editItemKat").value,
        qty: parseInt(document.getElementById("editItemQty").value) || 1,
        cond: condR ? condR.value : prevItem.cond,
        note: document.getElementById("editItemNote").value.trim(),
        checked: today,
        fotoUrl,
      };
      await saveData();
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
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.prevHtml || "Simpan Perubahan";
      }
    }
  } catch (err) {
    console.error("[saveEditItem] ERROR:", err);
    const msg = err?.message || String(err) || "Gagal menyimpan";
    if (errBox) {
      errBox.textContent = "⚠ " + msg;
      errBox.style.display = "block";
    }
    showToast("⚠ Gagal: " + msg);
  }
}

function openPhotoLightbox(url, title) {
  const modal = document.getElementById("photoLightbox");
  const img = document.getElementById("photoLightboxImg");
  const titleEl = document.getElementById("photoLightboxTitle");
  const linkEl = document.getElementById("photoLightboxLink");
  if (!modal || !img) return;
  img.src = url;
  if (titleEl) titleEl.textContent = title || "Foto Alat";
  if (linkEl) linkEl.href = url;
  modal.classList.add("open");
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
        <button class="tbl-btn info" onclick="viewLaporan(${realIdx})">Lihat</button>
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

async function addLaporan() {
  console.log("[addLaporan] START");
  const errBox = document.getElementById("addLapErr");
  if (errBox) {
    errBox.style.display = "none";
    errBox.textContent = "";
  }

  try {
    const nama = document.getElementById("addLapNama").value;
    const desk = document.getElementById("addLapDesk").value.trim();
    if (!nama || !desk) {
      showToast("Pilih alat dari inventaris dan isi deskripsi wajib.");
      return;
    }

    if (typeof uploadToR2 !== "function") {
      throw new Error(
        "uploadToR2 tidak terdefinisi — script r2-service.js mungkin gagal load.",
      );
    }

    const btn = document.querySelector("#addLaporanModal .btn-save");
    if (btn) {
      btn.disabled = true;
      btn.dataset.prevHtml = btn.innerHTML;
      btn.innerHTML = "Menyimpan…";
    }

    try {
      const photoFile = document.getElementById("addLapPhoto")?.files?.[0];
      console.log("[addLaporan] photoFile:", photoFile);
      let fotoUrl = "";
      if (photoFile) {
        showToast("Mengunggah foto ke R2…");
        console.log("[addLaporan] calling uploadToR2...");
        fotoUrl = await uploadToR2(photoFile, "laporan");
        console.log("[addLaporan] R2 returned URL:", fotoUrl);
      } else {
        console.log("[addLaporan] no photo file selected");
      }

      const prioR = document.querySelector('input[name="lapPrioR"]:checked');
      const newId = "LAP-" + String(data.laporan.length + 1).padStart(3, "0");
      data.laporan.unshift({
        id: newId,
        nama,
        desk,
        lokasi: document.getElementById("addLapLokasi").value.trim(),
        tgl: document.getElementById("addLapTgl").value,
        prioritas: prioR ? prioR.value : "Sedang",
        status: "Belum Ditangani",
        fotoUrl,
        reporter: teacher || "Unknown",
        createdAt: new Date().toISOString(),
      });
      console.log("[addLaporan] saving to Firebase...");
      await saveData();
      console.log("[addLaporan] DONE");
      renderLaporan();
      renderDashboard();
      closeModal("addLaporanModal");
      showToast("Laporan berhasil dikirim.");
      writeActivity("warn", "R", `Laporan kerusakan baru: ${nama}`);
      document.getElementById("addLapNama").value = "";
      document.getElementById("addLapDesk").value = "";
      document.getElementById("addLapLokasi").value = "";
      removePhoto(
        "addLapPhoto",
        "addLapPhotoPreview",
        "addLapPhotoPlaceholder",
        "addLapRemovePhoto",
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.prevHtml || "Kirim Laporan";
      }
    }
  } catch (err) {
    console.error("[addLaporan] ERROR:", err);
    const msg = err?.message || String(err) || "Upload gagal";
    if (errBox) {
      errBox.textContent = "⚠ " + msg;
      errBox.style.display = "block";
    }
    showToast("⚠ Gagal: " + msg);
  }
}

function viewLaporan(idx) {
  const l = data.laporan[idx];
  if (!l) return;
  const body = document.getElementById("viewLapBody");
  if (!body) return;
  const escHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  const photo = l.fotoUrl
    ? `<img src="${escHtml(l.fotoUrl)}" alt="Foto Kerusakan" style="max-width:100%;border-radius:8px;margin-top:4px" />
       <a href="${escHtml(l.fotoUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;color:var(--accent-blue)">Buka foto ukuran penuh</a>`
    : `<span style="color:var(--text-dim)">Tidak ada foto untuk laporan ini.</span>`;
  body.innerHTML = `
    <div style="display:grid;gap:10px;font-size:13px">
      <div><strong>ID:</strong> ${escHtml(l.id)}</div>
      <div><strong>Nama Alat:</strong> ${escHtml(l.nama)}</div>
      <div><strong>Lokasi:</strong> ${escHtml(l.lokasi || "-")}</div>
      <div><strong>Deskripsi:</strong> ${escHtml(l.desk)}</div>
      <div><strong>Tanggal:</strong> ${escHtml(l.tgl || "-")}</div>
      <div><strong>Prioritas:</strong> ${escHtml(l.prioritas)}</div>
      <div><strong>Status:</strong> ${escHtml(l.status)}</div>
      <div><strong>Reporter:</strong> ${escHtml(l.reporter || "Unknown")}</div>
      <div style="margin-top:8px"><strong>Foto Bukti Kerusakan</strong><br>${photo}</div>
    </div>`;
  openModal("viewLapModal");
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
   KATEGORI
=========================== */
function renderKategoriDropdowns() {
  const targets = [
    { id: "addItemKat", placeholder: null },
    { id: "editItemKat", placeholder: null },
    { id: "invFilterKat", placeholder: "Semua Kategori" },
  ];
  targets.forEach(({ id, placeholder }) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    const opts = [];
    if (placeholder) opts.push(`<option value="">${placeholder}</option>`);
    categories.forEach((k) => {
      opts.push(`<option value="${k}">${k}</option>`);
    });
    sel.innerHTML = opts.join("");
    if (prev && categories.includes(prev)) sel.value = prev;
  });
}

function renderKategoriList() {
  const list = document.getElementById("katList");
  if (!list) return;
  if (!categories.length) {
    list.innerHTML = '<div class="kat-empty">Belum ada kategori.</div>';
    return;
  }
  list.innerHTML = categories
    .map((k, idx) => {
      const inUse = data.items.some((it) => it.kat === k);
      const safe = String(k).replace(/'/g, "\\'");
      return `
        <div class="kat-row">
          <span class="kat-name">${k}</span>
          ${inUse ? `<span class="kat-badge">dipakai</span>` : ""}
          <button class="kat-del" type="button" title="Hapus" onclick="deleteKategori(${idx})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>`;
    })
    .join("");
}

function saveCategoriesToFirebase() {
  return db.ref(`lab_data/${lab}/categories`).set(categories);
}

async function addKategori() {
  const input = document.getElementById("newKatInput");
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    showToast("Nama kategori wajib diisi.");
    return;
  }
  if (categories.some((k) => k.toLowerCase() === name.toLowerCase())) {
    showToast("Kategori sudah ada.");
    return;
  }
  categories = [...categories, name];
  input.value = "";
  try {
    await saveCategoriesToFirebase();
    writeActivity("update", "K", `Kategori ditambahkan: ${name}`);
    showToast(`Kategori "${name}" ditambahkan.`);
  } catch (err) {
    showToast("Gagal menyimpan kategori.");
    console.error(err);
  }
}

async function deleteKategori(idx) {
  const name = categories[idx];
  if (!name) return;
  const inUse = data.items.some((it) => it.kat === name);
  const msg = inUse
    ? `Kategori "${name}" masih dipakai oleh beberapa alat. Tetap hapus?\n(Alat yang terpengaruh tidak akan berubah.)`
    : `Hapus kategori "${name}"?`;
  if (!confirm(msg)) return;
  categories = categories.filter((_, i) => i !== idx);
  try {
    await saveCategoriesToFirebase();
    writeActivity("update", "K", `Kategori dihapus: ${name}`);
    showToast(`Kategori "${name}" dihapus.`);
  } catch (err) {
    showToast("Gagal menghapus kategori.");
    console.error(err);
  }
}

/* ===========================
   PROFIL
=========================== */
function renderProfil() {
  if (!document.getElementById("profilName")) return;

  const displayName = teacher || "Pengelola Lab";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
  const emoji = LAB_EMOJIS[lab] || "🏫";

  let lastLoginText = "—";
  try {
    const user = typeof auth !== "undefined" ? auth.currentUser : null;
    const ts = user && user.metadata && user.metadata.lastSignInTime;
    if (ts) {
      lastLoginText = new Date(ts).toLocaleString("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
      });
    }
  } catch (_) {}

  setText("profilAvatar", initials);
  setText("profilName", displayName);
  setText("profilEmail", email || "—");
  setText("profilLab", lab || "—");
  setText("profilLabBadge", emoji + " " + (lab || "-"));
  setText("profilLastLogin", lastLoginText);

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
