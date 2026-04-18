"use strict";

/* ===========================
   LAB PROFILE HINTS
=========================== */
const LAB_PROFILES = {
  "Computer Lab": {
    email: "budi@labflow.id",
    teacher: "Budi Santoso",
  },
  "Physics Lab": {
    email: "sari@labflow.id",
    teacher: "Dr. Sari Dewi",
  },
  "Chemistry Lab": {
    email: "andi@labflow.id",
    teacher: "Andi Pratama",
  },
  "Biology Lab": {
    email: "rita@labflow.id",
    teacher: "Rita Wulandari",
  },
};

const DEMO_CREDENTIALS = {
  "Computer Lab": { email: "budi@labflow.id", password: "komputer123" },
  "Physics Lab": { email: "sari@labflow.id", password: "fisika123" },
  "Chemistry Lab": { email: "andi@labflow.id", password: "kimia123" },
  "Biology Lab": { email: "rita@labflow.id", password: "biologi123" },
};

/* ===========================
   CURRENT LAB / ROOM (from URL)
=========================== */
let currentLab = null;
let currentRoomKey = null;
let currentRoom = null; // fetched from Firebase rooms/{roomKey}

// State for unverified user resend flow
let _unverifiedEmail = null;
let _unverifiedPass = null;

function navigateTo(path) {
  const target = new URL(path, window.location.href).toString();
  try {
    window.location.assign(target);
  } catch (err) {
    window.open(target, "_self");
  }
}

const LAB_EMOJIS = {
  "Computer Lab": "🗁",
  "Physics Lab": "🗁",
  "Chemistry Lab": "🗁",
  "Biology Lab": "🗁",
};

/* ===========================
   ON LOAD
=========================== */
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  currentLab = params.get("lab") || null;
  currentRoomKey = params.get("room") || null;

  // ROOM mode: fetch room info, show room chip, prefill email
  if (currentRoomKey && typeof db !== "undefined") {
    try {
      const snap = await db.ref(`rooms/${currentRoomKey}`).once("value");
      if (snap.exists()) {
        currentRoom = snap.val();
        const chip = document.getElementById("labChip");
        chip.textContent = `🚪 ${currentRoom.name} · ${currentRoom.lab}`;
        chip.style.display = "inline-flex";
        const emailInput = document.getElementById("emailInput");
        if (emailInput && currentRoom.email) {
          emailInput.placeholder = currentRoom.email;
          emailInput.value = currentRoom.email;
        }
        const cardTitle = document.getElementById("cardTitle");
        if (cardTitle) cardTitle.textContent = `Login Ruangan ${currentRoom.name}`;
      } else {
        showAlert("Ruangan tidak ditemukan.");
      }
    } catch (err) {
      console.warn("Gagal memuat data ruangan:", err);
    }
  } else if (currentLab) {
    // LAB mode (legacy)
    const chip = document.getElementById("labChip");
    const emoji = LAB_EMOJIS[currentLab] || "🏫";
    chip.textContent = emoji + " " + currentLab;
    chip.style.display = "inline-flex";

    const profile = LAB_PROFILES[currentLab];
    if (profile) {
      document.getElementById("emailInput").placeholder = profile.email;
    }
  }

  bindAuthState();
  initCanvas();
});

function bindAuthState() {
  if (typeof auth === "undefined") return;

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    // ROOM mode: verify user belongs to this room, redirect to room.html
    if (currentRoomKey && currentRoom) {
      if ((user.email || "").toLowerCase() !== (currentRoom.email || "").toLowerCase()) {
        return; // let user login manually with the right room account
      }
      if (!user.emailVerified) {
        await auth.signOut();
        return;
      }
      persistRoomSession(currentRoomKey, currentRoom, user.email || "");
      navigateTo("room.html");
      return;
    }

    // LAB mode (existing)
    if (!user.emailVerified && !isDemoEmail(user.email)) {
      await auth.signOut();
      return;
    }

    const profile = await getUserProfile(user.uid);
    const profileLab =
      profile.lab || currentLab || sessionStorage.getItem("loggedInLab");

    if (!profileLab) return;
    if (currentLab && profile.lab && currentLab !== profile.lab) {
      showAlert(
        `Akun ini terdaftar untuk ${profile.lab}, bukan ${currentLab}.`,
      );
      return;
    }

    const teacherName = resolveTeacherName(user, profile, profileLab);
    persistSession(profileLab, teacherName, user.email || "");
    navigateTo("dashboard.html");
  });
}

function persistRoomSession(roomKey, room, userEmail) {
  sessionStorage.setItem("loggedInRoomKey", roomKey);
  sessionStorage.setItem("loggedInRoomName", room.name || "");
  sessionStorage.setItem("loggedInRoomLab", room.lab || "");
  sessionStorage.setItem("loggedInRoomEmail", userEmail);
  // Clear lab session to avoid mix-up
  sessionStorage.removeItem("loggedInLab");
  sessionStorage.removeItem("loggedInTeacher");
}

/* ===========================
   HANDLE LOGIN
=========================== */
window.handleLogin = async function (e) {
  e.preventDefault();
  const email = document.getElementById("emailInput").value.trim();
  const pass = document.getElementById("passInput").value;

  if (!email || !pass) {
    showAlert("Email dan kata sandi wajib diisi.");
    return;
  }
  if (typeof auth === "undefined") {
    showAlert("Firebase Auth belum siap. Muat ulang halaman.");
    return;
  }

  // ROOM mode
  if (currentRoomKey) {
    if (!currentRoom) {
      showAlert("Data ruangan belum dimuat. Muat ulang halaman.");
      return;
    }
    if (email.toLowerCase() !== (currentRoom.email || "").toLowerCase()) {
      showAlert(`Email tidak cocok untuk ruangan ${currentRoom.name}.`);
      shakeCard();
      return;
    }

    setLoading(true);
    hideAlert();
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const result = await auth.signInWithEmailAndPassword(email, pass);
      const user = result.user;
      if (!user) throw new Error("auth/no-user");
      if (!user.emailVerified) {
        _unverifiedEmail = email;
        _unverifiedPass = pass;
        await auth.signOut();
        showInfoBox("Email belum diverifikasi. Cek inbox Anda lalu coba login kembali.", true);
        shakeCard();
        return;
      }
      persistRoomSession(currentRoomKey, currentRoom, user.email || email);
      navigateTo("room.html");
    } catch (err) {
      showAlert(mapAuthError(err));
      shakeCard();
    } finally {
      setLoading(false);
    }
    return;
  }

  // LAB mode (existing)
  if (!currentLab) {
    showAlert("Lab tidak diketahui. Pilih lab dari dashboard terlebih dahulu.");
    return;
  }

  setLoading(true);
  hideAlert();

  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const result = await signInOrBootstrapDemoUser(email, pass, currentLab);
    const user = result.user;
    if (!user) throw new Error("auth/no-user");

    // Block login if email not verified (skip for demo accounts)
    if (!user.emailVerified && !isDemoEmail(user.email)) {
      _unverifiedEmail = email;
      _unverifiedPass = pass;
      await auth.signOut();
      showInfoBox(
        "Email belum diverifikasi. Cek inbox Anda lalu coba login kembali.",
        true,
      );
      shakeCard();
      return;
    }

    const profile = await getUserProfile(user.uid);
    if (profile.lab && profile.lab !== currentLab) {
      await auth.signOut();
      showAlert(
        `Akun ini terdaftar untuk ${profile.lab}, bukan ${currentLab}.`,
      );
      shakeCard();
      return;
    }

    const teacherName = resolveTeacherName(user, profile, currentLab);
    persistSession(currentLab, teacherName, user.email || email);
    await upsertUserProfile(user, currentLab, teacherName);

    navigateTo("dashboard.html");
  } catch (err) {
    showAlert(mapAuthError(err));
    shakeCard();
  } finally {
    setLoading(false);
  }
};

async function signInOrBootstrapDemoUser(email, password, labName) {
  try {
    return await auth.signInWithEmailAndPassword(email, password);
  } catch (signInErr) {
    if (!canBootstrapDemoUser(labName, email, password)) {
      throw signInErr;
    }

    try {
      return await auth.createUserWithEmailAndPassword(email, password);
    } catch (createErr) {
      if (createErr && createErr.code === "auth/email-already-in-use") {
        return await auth.signInWithEmailAndPassword(email, password);
      }
      throw createErr;
    }
  }
}

function canBootstrapDemoUser(labName, email, password) {
  if (!labName || !email || !password) return false;

  const demo = DEMO_CREDENTIALS[labName];
  if (!demo) return false;

  const normalizedInputEmail = String(email).trim().toLowerCase();
  const normalizedDemoEmail = String(demo.email).trim().toLowerCase();

  return (
    normalizedInputEmail === normalizedDemoEmail && password === demo.password
  );
}

async function getUserProfile(uid) {
  if (!uid || typeof db === "undefined") return {};

  try {
    const snap = await db.ref(`user_profiles/${uid}`).once("value");
    return snap.exists() ? snap.val() || {} : {};
  } catch (err) {
    console.warn("Gagal membaca profil user:", err);
    return {};
  }
}

async function upsertUserProfile(user, labName, teacherName) {
  if (!user || typeof db === "undefined") return;

  const payload = {
    uid: user.uid,
    email: user.email || "",
    teacher: teacherName,
    lab: labName,
    updatedAt: Date.now(),
  };

  try {
    await db.ref(`user_profiles/${user.uid}`).update(payload);
  } catch (err) {
    console.warn("Gagal menyimpan profil user:", err);
  }
}

function persistSession(labName, teacherName, userEmail) {
  sessionStorage.setItem("loggedInLab", labName);
  sessionStorage.setItem("loggedInTeacher", teacherName);
  sessionStorage.setItem("loggedInEmail", userEmail);
}

function resolveTeacherName(user, profile, labName) {
  if (profile && profile.teacher) return profile.teacher;
  if (user && user.displayName) return user.displayName;
  if (LAB_PROFILES[labName] && LAB_PROFILES[labName].teacher) {
    return LAB_PROFILES[labName].teacher;
  }
  return deriveTeacherFromEmail((user && user.email) || "");
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

/* ===========================
   PANEL TOGGLES
=========================== */
window.showRegisterPanel = function () {
  document.getElementById("loginPanel").style.display = "none";
  document.getElementById("registerPanel").style.display = "";
  document.getElementById("verifyPanel").style.display = "none";
  hideAlert();
  hideInfoBox();
  hideRegAlert();
};

window.showLoginPanel = function () {
  document.getElementById("loginPanel").style.display = "";
  document.getElementById("registerPanel").style.display = "none";
  document.getElementById("verifyPanel").style.display = "none";
};

function showVerifyPanel(email) {
  document.getElementById("loginPanel").style.display = "none";
  document.getElementById("registerPanel").style.display = "none";
  document.getElementById("verifyPanel").style.display = "";
  document.getElementById("verifyEmailDisplay").textContent = email;
}

/* ===========================
   HANDLE REGISTER
=========================== */
window.handleRegister = async function (e) {
  e.preventDefault();

  const name = document.getElementById("regNameInput").value.trim();
  const lab = document.getElementById("regLabInput").value;
  const email = document.getElementById("regEmailInput").value.trim();
  const pass = document.getElementById("regPassInput").value;
  const confirm = document.getElementById("regConfirmInput").value;

  if (!name) return showRegAlert("Nama lengkap wajib diisi.");
  if (!lab) return showRegAlert("Pilih laboratorium Anda.");
  if (!email) return showRegAlert("Alamat email wajib diisi.");
  if (!pass) return showRegAlert("Kata sandi wajib diisi.");
  if (pass.length < 6) return showRegAlert("Kata sandi minimal 6 karakter.");
  if (pass !== confirm)
    return showRegAlert("Konfirmasi kata sandi tidak cocok.");

  if (typeof auth === "undefined") {
    return showRegAlert("Firebase Auth belum siap. Muat ulang halaman.");
  }

  setRegLoading(true);
  hideRegAlert();

  try {
    const result = await auth.createUserWithEmailAndPassword(email, pass);
    const user = result.user;

    // Set display name
    await user.updateProfile({ displayName: name });

    // Save profile to Realtime DB
    await upsertUserProfile(user, lab, name);

    // Send email verification
    await user.sendEmailVerification();

    // Store for potential resend
    _unverifiedEmail = email;
    _unverifiedPass = pass;

    // Sign out — user must verify before logging in
    await auth.signOut();

    showVerifyPanel(email);
  } catch (err) {
    showRegAlert(mapAuthError(err));
  } finally {
    setRegLoading(false);
  }
};

/* ===========================
   RESEND VERIFICATION
=========================== */
window.resendVerificationFromPanel = async function () {
  if (!_unverifiedEmail || !_unverifiedPass) {
    showLoginPanel();
    showAlert("Silakan login untuk mengirim ulang verifikasi.");
    return;
  }
  await _doResendVerification(_unverifiedEmail, _unverifiedPass);
};

// Called by resendBtn in infoBox on login panel
window.resendVerificationEmail = async function () {
  if (!_unverifiedEmail || !_unverifiedPass) return;
  await _doResendVerification(_unverifiedEmail, _unverifiedPass);
};

async function _doResendVerification(email, pass) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, pass);
    await result.user.sendEmailVerification();
    await auth.signOut();
    showLoginPanel();
    showInfoBox(
      "Email verifikasi telah dikirim ulang ke " + email + ". Cek inbox Anda.",
      false,
    );
  } catch (err) {
    showLoginPanel();
    showAlert("Gagal mengirim ulang email: " + mapAuthError(err));
  }
}

/* ===========================
   DEMO EMAIL CHECK
=========================== */
function isDemoEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  return Object.values(DEMO_CREDENTIALS).some(
    (d) => d.email.toLowerCase() === normalized,
  );
}

/* ===========================
   REGISTER HELPERS
=========================== */
function setRegLoading(on) {
  const btn = document.getElementById("regBtn");
  document.getElementById("regBtnText").style.display = on ? "none" : "";
  document.getElementById("regBtnSpinner").style.display = on ? "" : "none";
  btn.disabled = on;
}

function showRegAlert(msg) {
  const box = document.getElementById("regAlertBox");
  document.getElementById("regAlertMsg").textContent = msg;
  box.style.display = "flex";
}

function hideRegAlert() {
  const el = document.getElementById("regAlertBox");
  if (el) el.style.display = "none";
}

/* ===========================
   INFO BOX (login panel)
=========================== */
function showInfoBox(msg, showResend) {
  const box = document.getElementById("infoBox");
  if (!box) return;
  document.getElementById("infoMsg").textContent = msg;
  const btn = document.getElementById("resendBtn");
  if (btn) btn.style.display = showResend ? "" : "none";
  box.style.display = "flex";
}

function hideInfoBox() {
  const box = document.getElementById("infoBox");
  if (box) box.style.display = "none";
}

/* ===========================
   TOGGLE REG PASSWORD
=========================== */
window.toggleRegPass = function () {
  const inp = document.getElementById("regPassInput");
  const isPass = inp.type === "password";
  inp.type = isPass ? "text" : "password";
  document.getElementById("regEyeIcon").innerHTML = isPass
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
};

function mapAuthError(err) {
  const code = err && err.code ? err.code : "";

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "Email atau kata sandi salah.";
  }
  if (code === "auth/invalid-email") {
    return "Format email tidak valid.";
  }
  if (code === "auth/too-many-requests") {
    return "Terlalu banyak percobaan login. Coba lagi beberapa saat.";
  }
  if (code === "auth/network-request-failed") {
    return "Koneksi internet bermasalah. Periksa jaringan Anda.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email/Password belum diaktifkan di Firebase Auth. Aktifkan provider Email/Password di Firebase Console.";
  }
  if (code === "auth/weak-password") {
    return "Kata sandi terlalu lemah. Gunakan minimal 6 karakter.";
  }
  if (code === "auth/email-already-in-use") {
    return "Email sudah terdaftar. Silakan login atau gunakan email lain.";
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
}

/* ===========================
   TOGGLE PASSWORD VISIBILITY
=========================== */
window.togglePass = function () {
  const inp = document.getElementById("passInput");
  const isPass = inp.type === "password";
  inp.type = isPass ? "text" : "password";
  document.getElementById("eyeIcon").innerHTML = isPass
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
};

/* ===========================
   FORGOT HINT
=========================== */
window.showForgotHint = function () {
  const h = document.getElementById("hintCard");
  h.scrollIntoView({ behavior: "smooth", block: "nearest" });
  h.style.border = "1px solid rgba(59,130,246,.5)";
  h.style.boxShadow = "0 0 20px rgba(59,130,246,.2)";
  setTimeout(() => {
    h.style.border = "1px solid rgba(59,130,246,.15)";
    h.style.boxShadow = "";
  }, 1500);
};

/* ===========================
   HELPERS
=========================== */
function setLoading(on) {
  const btn = document.getElementById("loginBtn");
  document.getElementById("btnText").style.display = on ? "none" : "";
  document.getElementById("btnArrow").style.display = on ? "none" : "";
  document.getElementById("btnSpinner").style.display = on ? "" : "none";
  btn.disabled = on;
}

function showAlert(msg) {
  const box = document.getElementById("alertBox");
  document.getElementById("alertMsg").textContent = msg;
  box.style.display = "flex";
}

function hideAlert() {
  document.getElementById("alertBox").style.display = "none";
}

function shakeCard() {
  const card = document.getElementById("loginCard");
  card.style.animation = "none";
  card.style.transform = "translateX(0)";
  let i = 0;
  const shakes = ["-8px", "8px", "-6px", "6px", "-3px", "3px", "0px"];
  const iv = setInterval(() => {
    card.style.transform = `translateX(${shakes[i]})`;
    i++;
    if (i >= shakes.length) {
      clearInterval(iv);
      card.style.transform = "";
    }
  }, 50);
}

/* ===========================
   CANVAS PARTICLE BACKGROUND
=========================== */
function initCanvas() {
  const canvas = document.getElementById("bgCanvas");
  const ctx = canvas.getContext("2d");
  let W,
    H,
    particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", () => {
    resize();
    buildParticles();
  });

  function buildParticles() {
    const count = Math.floor((W * H) / 18000);
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
    }));
  }
  buildParticles();

  const LINK_DIST = 130;
  const PARTICLE_COLOR = "rgba(59,130,246,";
  const LINE_COLOR = "rgba(59,130,246,";

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Update positions
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = PARTICLE_COLOR + ".5)";
      ctx.fill();
    });

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const alpha = (1 - dist / LINK_DIST) * 0.25;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = LINE_COLOR + alpha + ")";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}
