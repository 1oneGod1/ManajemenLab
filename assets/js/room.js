"use strict";

/* ===========================
   ROOM DASHBOARD — Step 1 shell
   Full inventaris / jadwal / laporan will be added in later steps.
=========================== */

let roomKey = sessionStorage.getItem("loggedInRoomKey");
let roomName = sessionStorage.getItem("loggedInRoomName");
let roomLab = sessionStorage.getItem("loggedInRoomLab");
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
    roomLab = roomData.lab || roomLab;
    sessionStorage.setItem("loggedInRoomName", roomName || "");
    sessionStorage.setItem("loggedInRoomLab", roomLab || "");
  } catch (err) {
    throw err;
  }
}

function renderHeader() {
  const name = roomName || "Ruangan";
  const lab = roomLab || "—";
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set("sidebarRoomName", name);
  set("topbarRoom", name);
  set("topbarLab", lab);
  set("roomBadge", lab.toUpperCase());
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
  document.querySelectorAll(".page-panel").forEach((p) => p.classList.add("hidden"));
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

/* Placeholder stats — will be replaced by real listeners in later steps */
function renderPlaceholderStats() {
  document.getElementById("statInventaris").textContent = "0";
  document.getElementById("statJadwal").textContent = "0";
  document.getElementById("statLaporan").textContent = "0";
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await ensureRoomSession();
    renderHeader();
    renderPlaceholderStats();
  } catch (err) {
    console.warn("Room session error:", err);
  }
});
