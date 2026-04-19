"use strict";

/* ===========================
   ROOM DASHBOARD — Step 1 shell
   Full inventaris / jadwal / laporan will be added in later steps.
=========================== */

let roomKey = sessionStorage.getItem("loggedInRoomKey");
let roomName = sessionStorage.getItem("loggedInRoomName");
let roomEmail = sessionStorage.getItem("loggedInRoomEmail");
let roomData = null;

function navigateTo(path) {
  const target = new URL(path, window.location.href).toString();
  try { window.location.assign(target); } catch (e) { window.open(target, "_self"); }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

async function ensureRoomSession() {
  if (typeof auth === "undefined") {
    if (!roomKey) { navigateTo("../index.html"); throw new Error("No room key"); }
    return;
  }

  const user = auth.currentUser || (await new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); });
  }));

  if (!user) {
    if (roomKey) navigateTo(`login.html?room=${encodeURIComponent(roomKey)}`);
    else navigateTo("../index.html");
    throw new Error("Not logged in");
  }

  if (!roomKey) {
    showToast("Sesi ruangan tidak ditemukan.");
    navigateTo("../index.html");
    throw new Error("No room key in session");
  }

  // Verify the signed-in user matches the room in RTDB
  try {
    const snap = await db.ref(`rooms/${roomKey}`).once("value");
    if (!snap.exists()) {
      showToast("Ruangan tidak ditemukan.");
      await auth.signOut();
      navigateTo("../index.html");
      throw new Error("Room not found");
    }
    roomData = snap.val();
    if ((roomData.email || "").toLowerCase() !== (user.email || "").toLowerCase()) {
      showToast("Akun tidak cocok dengan ruangan.");
      await auth.signOut();
      navigateTo(`login.html?room=${encodeURIComponent(roomKey)}`);
      throw new Error("Email mismatch");
    }

    // Keep session in sync
    roomName = roomData.name || roomName;
    sessionStorage.setItem("loggedInRoomName", roomName || "");
  } catch (err) {
    throw err;
  }
}

function renderHeader() {
  const name = roomName || "Ruangan";
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set("sidebarRoomName", name);
  set("topbarRoom", name);
  set("roomEmail", roomEmail || "—");

  const initialsMatch = name.match(/\d+/);
  const initials = initialsMatch ? initialsMatch[0] : name.slice(0, 2);
  set("roomAvatar", String(initials).slice(0, 3).toUpperCase());

  // Topbar date
  const dateEl = document.getElementById("topbarDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
}

window.toggleSidebar = function () {
  const sb = document.getElementById("sidebar");
  if (sb) sb.classList.toggle("open");
};

window.showPage = function (page) {
  document.querySelectorAll(".page-content").forEach((p) => p.classList.add("hidden"));
  const tgt = document.getElementById("page-" + page);
  if (tgt) tgt.classList.remove("hidden");
  document.querySelectorAll(".nav-item[data-page]").forEach((n) => {
    n.classList.toggle("active", n.dataset.page === page);
  });
};

window.handleRoomLogout = async function () {
  if (!confirm("Keluar dari ruangan ini?")) return;
  try { if (typeof auth !== "undefined") await auth.signOut(); } catch (_) {}
  sessionStorage.removeItem("loggedInRoomKey");
  sessionStorage.removeItem("loggedInRoomName");
  sessionStorage.removeItem("loggedInRoomLab");
  sessionStorage.removeItem("loggedInRoomEmail");
  navigateTo("../index.html");
};

/* ===========================
   INVENTARIS PER RUANGAN
   Schema: rooms/{roomKey}/items/{itemKey}
           rooms/{roomKey}/categories (array)
=========================== */
const DEFAULT_ROOM_CATEGORIES = ["Elektronik", "Peralatan", "Furnitur", "Bahan"];
const ROOM_INV_PER_PAGE = 12;

let roomItems = [];
let roomCategories = [...DEFAULT_ROOM_CATEGORIES];
let roomInvPage = 1;
let _pendingRoomItemPhoto = null;      // File object
let _pendingRoomItemPhotoRemove = false; // when editing: user clicked remove

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function initRoomInventoryListeners() {
  if (!roomKey) return;

  db.ref(`rooms/${roomKey}/items`).on("value", (snap) => {
    roomItems = [];
    snap.forEach((child) => roomItems.push({ _key: child.key, ...child.val() }));
    roomItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderRoomInventory();
    renderRoomStats();
  });

  db.ref(`rooms/${roomKey}/categories`).on("value", (snap) => {
    if (snap.exists()) {
      const val = snap.val();
      const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val || {}).filter(Boolean);
      roomCategories = list.length ? list : [...DEFAULT_ROOM_CATEGORIES];
    } else {
      roomCategories = [...DEFAULT_ROOM_CATEGORIES];
    }
    renderRoomCategoryDropdowns();
    renderRoomCategoryList();
    renderRoomInventory();
  });
}

function renderRoomStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("statInventaris", roomItems.length);
  set("statJadwal", roomJadwal.length);
  // Laporan stat will be wired in Step 4
  const lap = document.getElementById("statLaporan");
  if (lap && !lap.textContent.trim()) lap.textContent = "0";
}

function renderRoomCategoryDropdowns() {
  // Add-item modal
  const kat = document.getElementById("roomItemKat");
  if (kat) {
    kat.innerHTML = roomCategories.map((c) => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join("");
  }
  // Inventory filter
  const filter = document.getElementById("roomInvFilterKat");
  if (filter) {
    const current = filter.value;
    filter.innerHTML = `<option value="">Semua Kategori</option>` + roomCategories.map((c) => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join("");
    filter.value = current;
  }
}

function renderRoomCategoryList() {
  const list = document.getElementById("roomCategoryList");
  if (!list) return;
  list.innerHTML = roomCategories.map((c) => `
    <span class="category-chip">
      ${escHtml(c)}
      <button type="button" title="Hapus" onclick="removeRoomCategory('${escHtml(c)}')">&times;</button>
    </span>`).join("") || `<span style="color:var(--text-muted);font-size:12px">Belum ada kategori.</span>`;
}

window.renderRoomInventory = function () {
  const body = document.getElementById("roomInvBody");
  if (!body) return;

  const q = (document.getElementById("roomInvSearch")?.value || "").toLowerCase();
  const cond = document.getElementById("roomInvFilterCond")?.value || "";
  const kat = document.getElementById("roomInvFilterKat")?.value || "";

  const filtered = roomItems.filter((i) =>
    ((i.name || "").toLowerCase().includes(q) || (i.code || "").toLowerCase().includes(q)) &&
    (!cond || i.cond === cond) &&
    (!kat || i.kat === kat)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROOM_INV_PER_PAGE));
  if (roomInvPage > totalPages) roomInvPage = totalPages;
  const slice = filtered.slice((roomInvPage - 1) * ROOM_INV_PER_PAGE, roomInvPage * ROOM_INV_PER_PAGE);

  const condClass = { "Sangat Baik": "ok", "Baik": "good", "Cukup": "warn", "Rusak": "danger" };

  if (!slice.length) {
    body.innerHTML = `<div class="inv-empty">${roomItems.length ? "Tidak ada item yang cocok dengan filter." : "Belum ada inventaris. Klik \"+ Tambah Item\" untuk mulai."}</div>`;
  } else {
    body.innerHTML = slice.map((item) => {
      const photo = item.fotoUrl
        ? `<img src="${escHtml(item.fotoUrl)}" alt="${escHtml(item.name)}" onerror="this.remove();this.parentElement.innerHTML='<span class=\\'ri-no-photo\\'>Foto gagal dimuat</span>'" onclick="event.stopPropagation(); openRoomPhotoLightbox('${escHtml(item.fotoUrl)}')" />`
        : `<span class="ri-no-photo">Tanpa foto</span>`;
      return `
        <div class="ri-card">
          <div class="ri-photo-wrap">
            ${photo}
            <span class="ri-kat-badge">${escHtml(item.kat || "-")}</span>
          </div>
          <div class="ri-body">
            <div class="ri-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
            ${item.code ? `<div class="ri-code">Kode: ${escHtml(item.code)}</div>` : ""}
            ${item.note ? `<div class="ri-note">${escHtml(item.note)}</div>` : ""}
            <div class="ri-meta">
              <span class="ri-qty">Qty: <strong>${item.qty || 0}</strong></span>
              <span class="ri-cond ${condClass[item.cond] || "good"}">${escHtml(item.cond || "-")}</span>
            </div>
            <div class="ri-actions">
              <button class="ri-btn" onclick="openEditRoomItemModal('${item._key}')">Edit</button>
              <button class="ri-btn danger" onclick="deleteRoomItem('${item._key}')">Hapus</button>
            </div>
          </div>
        </div>`;
    }).join("");
  }

  // Pagination
  const pag = document.getElementById("roomInvPagination");
  if (filtered.length > ROOM_INV_PER_PAGE) {
    pag.style.display = "flex";
    document.getElementById("roomInvPageInfo").textContent = `Halaman ${roomInvPage} dari ${totalPages}`;
    document.getElementById("roomInvPrev").disabled = roomInvPage <= 1;
    document.getElementById("roomInvNext").disabled = roomInvPage >= totalPages;
  } else {
    pag.style.display = "none";
  }
};

window.roomInvChangePage = function (delta) {
  roomInvPage += delta;
  renderRoomInventory();
};

window.openRoomPhotoLightbox = function (url) {
  window.open(url, "_blank");
};

/* --- Add / Edit modal --- */
window.openAddRoomItemModal = function () {
  document.getElementById("roomItemModalTitle").textContent = "Tambah Item";
  document.getElementById("roomItemEditKey").value = "";
  document.getElementById("roomItemName").value = "";
  document.getElementById("roomItemCode").value = "";
  document.getElementById("roomItemQty").value = "1";
  document.getElementById("roomItemNote").value = "";
  const firstRadio = document.querySelector('input[name="roomItemCond"]');
  if (firstRadio) firstRadio.checked = true;
  renderRoomCategoryDropdowns();
  clearRoomItemPhoto();
  _pendingRoomItemPhotoRemove = false;
  hideRoomItemErr();
  openModal("roomItemModal");
  setTimeout(() => document.getElementById("roomItemName").focus(), 100);
};

window.openEditRoomItemModal = function (key) {
  const item = roomItems.find((i) => i._key === key);
  if (!item) return showToast("Item tidak ditemukan.");
  document.getElementById("roomItemModalTitle").textContent = "Edit Item";
  document.getElementById("roomItemEditKey").value = key;
  document.getElementById("roomItemName").value = item.name || "";
  document.getElementById("roomItemCode").value = item.code || "";
  document.getElementById("roomItemQty").value = item.qty || 1;
  document.getElementById("roomItemNote").value = item.note || "";
  renderRoomCategoryDropdowns();
  document.getElementById("roomItemKat").value = item.kat || roomCategories[0] || "";
  document.querySelectorAll('input[name="roomItemCond"]').forEach((r) => {
    r.checked = r.value === (item.cond || "Sangat Baik");
  });

  _pendingRoomItemPhoto = null;
  _pendingRoomItemPhotoRemove = false;
  const previewEl = document.getElementById("roomItemPhotoPreview");
  const placeholder = document.getElementById("roomItemPhotoPlaceholder");
  const removeBtn = document.getElementById("roomItemRemovePhoto");
  const fileInput = document.getElementById("roomItemPhoto");
  fileInput.value = "";
  if (item.fotoUrl) {
    previewEl.src = item.fotoUrl;
    previewEl.style.display = "";
    placeholder.style.display = "none";
    removeBtn.style.display = "";
  } else {
    previewEl.src = "";
    previewEl.style.display = "none";
    placeholder.style.display = "";
    removeBtn.style.display = "none";
  }
  hideRoomItemErr();
  openModal("roomItemModal");
};

function hideRoomItemErr() {
  const err = document.getElementById("roomItemErr");
  if (err) { err.style.display = "none"; err.textContent = ""; }
}
function showRoomItemErr(msg) {
  const err = document.getElementById("roomItemErr");
  if (err) { err.style.display = "block"; err.textContent = msg; }
}

window.previewRoomItemPhoto = function (e) {
  const file = e.target.files?.[0];
  if (!file) return;
  _pendingRoomItemPhoto = file;
  _pendingRoomItemPhotoRemove = false;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("roomItemPhotoPreview").src = ev.target.result;
    document.getElementById("roomItemPhotoPreview").style.display = "";
    document.getElementById("roomItemPhotoPlaceholder").style.display = "none";
    document.getElementById("roomItemRemovePhoto").style.display = "";
  };
  reader.readAsDataURL(file);
};

window.clearRoomItemPhoto = function () {
  _pendingRoomItemPhoto = null;
  _pendingRoomItemPhotoRemove = true;
  document.getElementById("roomItemPhoto").value = "";
  document.getElementById("roomItemPhotoPreview").src = "";
  document.getElementById("roomItemPhotoPreview").style.display = "none";
  document.getElementById("roomItemPhotoPlaceholder").style.display = "";
  document.getElementById("roomItemRemovePhoto").style.display = "none";
};

window.saveRoomItem = async function () {
  hideRoomItemErr();
  const key = document.getElementById("roomItemEditKey").value;
  const name = document.getElementById("roomItemName").value.trim();
  const code = document.getElementById("roomItemCode").value.trim();
  const kat = document.getElementById("roomItemKat").value;
  const qty = parseInt(document.getElementById("roomItemQty").value, 10);
  const note = document.getElementById("roomItemNote").value.trim();
  const cond = document.querySelector('input[name="roomItemCond"]:checked')?.value || "Sangat Baik";

  if (!name) return showRoomItemErr("Nama item wajib diisi.");
  if (!kat) return showRoomItemErr("Kategori wajib dipilih.");
  if (!qty || qty < 1) return showRoomItemErr("Jumlah minimal 1.");

  const btn = document.getElementById("roomItemSaveBtn");
  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = "Menyimpan…";

  try {
    let fotoUrl = null;
    if (key) {
      const existing = roomItems.find((i) => i._key === key);
      fotoUrl = existing?.fotoUrl || null;
    }

    // Upload new photo (if any)
    if (_pendingRoomItemPhoto) {
      btn.textContent = "Mengunggah foto…";
      fotoUrl = await uploadToR2(_pendingRoomItemPhoto, "room-inventory");
    } else if (_pendingRoomItemPhotoRemove && key) {
      fotoUrl = null;
    }

    const payload = {
      name, code, kat, qty, note, cond,
      fotoUrl: fotoUrl || null,
      updatedAt: Date.now(),
    };

    if (key) {
      await db.ref(`rooms/${roomKey}/items/${key}`).update(payload);
      showToast(`Item "${name}" diperbarui.`);
    } else {
      payload.createdAt = Date.now();
      await db.ref(`rooms/${roomKey}/items`).push(payload);
      showToast(`Item "${name}" ditambahkan.`);
    }
    closeModal("roomItemModal");
  } catch (err) {
    console.error(err);
    showRoomItemErr("Gagal menyimpan: " + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
};

window.deleteRoomItem = async function (key) {
  const item = roomItems.find((i) => i._key === key);
  if (!item) return;
  if (!confirm(`Hapus item "${item.name}"?`)) return;
  try {
    await db.ref(`rooms/${roomKey}/items/${key}`).remove();
    showToast(`Item "${item.name}" dihapus.`);
  } catch (err) {
    showToast("Gagal: " + err.message);
  }
};

/* --- Category management --- */
window.openRoomCategoryModal = function () {
  renderRoomCategoryList();
  document.getElementById("roomNewCategoryInput").value = "";
  openModal("roomCategoryModal");
};

window.addRoomCategory = async function () {
  const input = document.getElementById("roomNewCategoryInput");
  const name = input.value.trim();
  if (!name) return;
  if (roomCategories.some((c) => c.toLowerCase() === name.toLowerCase())) {
    showToast("Kategori sudah ada.");
    return;
  }
  const next = [...roomCategories, name];
  try {
    await db.ref(`rooms/${roomKey}/categories`).set(next);
    input.value = "";
    showToast(`Kategori "${name}" ditambahkan.`);
  } catch (err) {
    showToast("Gagal: " + err.message);
  }
};

window.removeRoomCategory = async function (name) {
  // Prevent removing category that is still used
  const used = roomItems.some((i) => i.kat === name);
  if (used) return showToast(`Kategori "${name}" masih dipakai oleh item.`);
  if (!confirm(`Hapus kategori "${name}"?`)) return;
  const next = roomCategories.filter((c) => c !== name);
  try {
    await db.ref(`rooms/${roomKey}/categories`).set(next);
    showToast(`Kategori "${name}" dihapus.`);
  } catch (err) {
    showToast("Gagal: " + err.message);
  }
};

/* ===========================
   JADWAL PENGGUNAAN PER RUANGAN
   Schema: rooms/{roomKey}/jadwal/{key}
           { hari, mulai, selesai, kelas, mapel, pengajar, note, createdAt, updatedAt }
=========================== */
const ROOM_HARI_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
let roomJadwal = [];

function todayHari() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][new Date().getDay()];
}

function initRoomJadwalListener() {
  if (!roomKey) return;
  db.ref(`rooms/${roomKey}/jadwal`).on("value", (snap) => {
    roomJadwal = [];
    snap.forEach((child) => roomJadwal.push({ _key: child.key, ...child.val() }));
    roomJadwal.sort((a, b) => {
      const d = ROOM_HARI_ORDER.indexOf(a.hari) - ROOM_HARI_ORDER.indexOf(b.hari);
      if (d !== 0) return d;
      return (a.mulai || "").localeCompare(b.mulai || "");
    });
    renderRoomJadwal();
    renderRoomTodaySchedule();
    renderRoomStats();
  });
}

window.renderRoomJadwal = function () {
  const body = document.getElementById("roomJadwalBody");
  if (!body) return;

  const q = (document.getElementById("roomJadwalSearch")?.value || "").toLowerCase();
  const hariFilter = document.getElementById("roomJadwalFilterHari")?.value || "";
  const today = todayHari();

  const filtered = roomJadwal.filter((j) =>
    (!hariFilter || j.hari === hariFilter) &&
    (
      (j.kelas || "").toLowerCase().includes(q) ||
      (j.mapel || "").toLowerCase().includes(q) ||
      (j.pengajar || "").toLowerCase().includes(q)
    )
  );

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="7" class="rj-empty">${
      roomJadwal.length ? "Tidak ada jadwal yang cocok dengan filter." : "Belum ada jadwal. Klik \"+ Tambah Jadwal\" untuk mulai."
    }</td></tr>`;
    return;
  }

  body.innerHTML = filtered.map((j) => {
    const isToday = j.hari === today;
    return `
      <tr>
        <td><strong>${escHtml(j.hari || "-")}</strong></td>
        <td class="rj-time">${escHtml(j.mulai || "-")} – ${escHtml(j.selesai || "-")}</td>
        <td><strong>${escHtml(j.kelas || "-")}</strong></td>
        <td>${escHtml(j.mapel || "-")}</td>
        <td>${escHtml(j.pengajar || "-")}</td>
        <td><span class="rj-badge ${isToday ? "ok" : "gray"}">${isToday ? "Hari Ini" : "Terjadwal"}</span></td>
        <td>
          <div class="rj-act">
            <button onclick="openEditRoomJadwalModal('${j._key}')">Edit</button>
            <button class="danger" onclick="deleteRoomJadwal('${j._key}')">Hapus</button>
          </div>
        </td>
      </tr>`;
  }).join("");
};

function renderRoomTodaySchedule() {
  const today = todayHari();
  const list = roomJadwal
    .filter((j) => j.hari === today)
    .sort((a, b) => (a.mulai || "").localeCompare(b.mulai || ""));

  const html = list.length
    ? list.map((j) => `
        <div class="rj-today-card">
          <div class="t-time">${escHtml(j.mulai || "-")} – ${escHtml(j.selesai || "-")}</div>
          <div class="t-kelas">${escHtml(j.kelas || "-")}</div>
          <div class="t-sub">${escHtml(j.mapel || "-")}${j.pengajar ? ` • ${escHtml(j.pengajar)}` : ""}</div>
        </div>`).join("")
    : `<div class="rj-today-empty">Tidak ada jadwal untuk ${today}.</div>`;

  const a = document.getElementById("roomJadwalToday");
  const b = document.getElementById("roomDashTodayJadwal");
  if (a) a.innerHTML = html;
  if (b) b.innerHTML = html;
}

function hideRoomJadwalErr() {
  const err = document.getElementById("roomJadwalErr");
  if (err) { err.style.display = "none"; err.textContent = ""; }
}
function showRoomJadwalErr(msg) {
  const err = document.getElementById("roomJadwalErr");
  if (err) { err.style.display = "block"; err.textContent = msg; }
}

window.openAddRoomJadwalModal = function () {
  document.getElementById("roomJadwalModalTitle").textContent = "Tambah Jadwal";
  document.getElementById("roomJadwalEditKey").value = "";
  const firstRadio = document.querySelector('input[name="roomJadwalHari"][value="Senin"]');
  if (firstRadio) firstRadio.checked = true;
  document.getElementById("roomJadwalMulai").value = "07:00";
  document.getElementById("roomJadwalSelesai").value = "09:00";
  document.getElementById("roomJadwalKelas").value = "";
  document.getElementById("roomJadwalMapel").value = "";
  document.getElementById("roomJadwalPengajar").value = "";
  document.getElementById("roomJadwalNote").value = "";
  hideRoomJadwalErr();
  openModal("roomJadwalModal");
  setTimeout(() => document.getElementById("roomJadwalKelas").focus(), 100);
};

window.openEditRoomJadwalModal = function (key) {
  const j = roomJadwal.find((x) => x._key === key);
  if (!j) return showToast("Jadwal tidak ditemukan.");
  document.getElementById("roomJadwalModalTitle").textContent = "Edit Jadwal";
  document.getElementById("roomJadwalEditKey").value = key;
  document.querySelectorAll('input[name="roomJadwalHari"]').forEach((r) => {
    r.checked = r.value === (j.hari || "Senin");
  });
  document.getElementById("roomJadwalMulai").value = j.mulai || "07:00";
  document.getElementById("roomJadwalSelesai").value = j.selesai || "09:00";
  document.getElementById("roomJadwalKelas").value = j.kelas || "";
  document.getElementById("roomJadwalMapel").value = j.mapel || "";
  document.getElementById("roomJadwalPengajar").value = j.pengajar || "";
  document.getElementById("roomJadwalNote").value = j.note || "";
  hideRoomJadwalErr();
  openModal("roomJadwalModal");
};

window.saveRoomJadwal = async function () {
  hideRoomJadwalErr();
  const key = document.getElementById("roomJadwalEditKey").value;
  const hari = document.querySelector('input[name="roomJadwalHari"]:checked')?.value || "Senin";
  const mulai = document.getElementById("roomJadwalMulai").value;
  const selesai = document.getElementById("roomJadwalSelesai").value;
  const kelas = document.getElementById("roomJadwalKelas").value.trim();
  const mapel = document.getElementById("roomJadwalMapel").value.trim();
  const pengajar = document.getElementById("roomJadwalPengajar").value.trim();
  const note = document.getElementById("roomJadwalNote").value.trim();

  if (!kelas) return showRoomJadwalErr("Kelas wajib diisi.");
  if (!mapel) return showRoomJadwalErr("Mata pelajaran wajib diisi.");
  if (!mulai || !selesai) return showRoomJadwalErr("Waktu mulai & selesai wajib diisi.");
  if (mulai >= selesai) return showRoomJadwalErr("Waktu selesai harus setelah waktu mulai.");

  const btn = document.getElementById("roomJadwalSaveBtn");
  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = "Menyimpan…";

  try {
    const payload = { hari, mulai, selesai, kelas, mapel, pengajar, note, updatedAt: Date.now() };
    if (key) {
      await db.ref(`rooms/${roomKey}/jadwal/${key}`).update(payload);
      showToast(`Jadwal ${kelas} diperbarui.`);
    } else {
      payload.createdAt = Date.now();
      await db.ref(`rooms/${roomKey}/jadwal`).push(payload);
      showToast(`Jadwal ${kelas} ditambahkan.`);
    }
    closeModal("roomJadwalModal");
  } catch (err) {
    console.error(err);
    showRoomJadwalErr("Gagal menyimpan: " + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
};

window.deleteRoomJadwal = async function (key) {
  const j = roomJadwal.find((x) => x._key === key);
  if (!j) return;
  if (!confirm(`Hapus jadwal ${j.kelas || "-"} - ${j.mapel || "-"}?`)) return;
  try {
    await db.ref(`rooms/${roomKey}/jadwal/${key}`).remove();
    showToast("Jadwal dihapus.");
  } catch (err) {
    showToast("Gagal: " + err.message);
  }
};

/* --- Modal helpers (mirror app.js) --- */
window.openModal = function (id) { document.getElementById(id)?.classList.add("open"); };
window.closeModal = function (id) { document.getElementById(id)?.classList.remove("open"); };
window.closeModalOutside = function (e) {
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await ensureRoomSession();
    renderHeader();
    initRoomInventoryListeners();
  } catch (err) {
    console.warn("Room session error:", err);
  }
});
