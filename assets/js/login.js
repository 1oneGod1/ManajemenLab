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

/* ===========================
   CURRENT LAB (from URL, set by dashboard)
=========================== */
let currentLab = null;

function navigateTo(path) {
  const target = new URL(path, window.location.href).toString();
  try {
    window.location.assign(target);
  } catch (err) {
    window.open(target, "_self");
  }
}

const LAB_EMOJIS = {
  "Computer Lab": "[COM]",
  "Physics Lab": "[PHY]",
  "Chemistry Lab": "[CHE]",
  "Biology Lab": "[BIO]",
};

/* ===========================
   ON LOAD
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  currentLab = params.get("lab") || null;

  // Show lab chip and update subtitle
  if (currentLab) {
    const chip = document.getElementById("labChip");
    const emoji = LAB_EMOJIS[currentLab] || "🏫";
    chip.textContent = emoji + " " + currentLab;
    chip.style.display = "inline-flex";

    // Also hint the email placeholder
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

    const profile = await getUserProfile(user.uid);
    const profileLab = profile.lab || currentLab || sessionStorage.getItem("loggedInLab");

    if (!profileLab) return;
    if (currentLab && profile.lab && currentLab !== profile.lab) {
      showAlert(`Akun ini terdaftar untuk ${profile.lab}, bukan ${currentLab}.`);
      return;
    }

    const teacherName = resolveTeacherName(user, profile, profileLab);
    persistSession(profileLab, teacherName, user.email || "");
    navigateTo("dashboard.html");
  });
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
  if (!currentLab) {
    showAlert("Lab tidak diketahui. Pilih lab dari dashboard terlebih dahulu.");
    return;
  }
  if (typeof auth === "undefined") {
    showAlert("Firebase Auth belum siap. Muat ulang halaman.");
    return;
  }

  setLoading(true);
  hideAlert();

  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const result = await auth.signInWithEmailAndPassword(email, pass);
    const user = result.user;
    if (!user) throw new Error("auth/no-user");

    const profile = await getUserProfile(user.uid);
    if (profile.lab && profile.lab !== currentLab) {
      await auth.signOut();
      showAlert(`Akun ini terdaftar untuk ${profile.lab}, bukan ${currentLab}.`);
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
  return "Login gagal. Silakan coba lagi.";
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
