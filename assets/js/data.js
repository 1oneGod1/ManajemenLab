"use strict";

/* ===========================
   DEPRECATED: This file is no longer used
   All data is now persisted in Firebase Realtime Database
   
   Data structure reference:
   - fasilitas: Contains all lab facility items (name, qty, condition, lab, fotoUrl)
   - laporan: Contains damage reports (id, item, description, lab, status, priority, etc)
   - jadwal: Contains schedules (hari, mulai, selesai, kelas, mapel, note)
   - peminjaman: Contains borrowing records (peminjam, alat, qty, tgl_pinjam, etc)
   
   NOTE: DO NOT add any hardcoded data here
   Start fresh with Firebase and let users populate via the Web UI
=========================== */

const activities = []; // All activities now loaded from Firebase

let damageReports = []; // All damage reports now loaded from Firebase

/* ===========================
   UTILITY FUNCTIONS
=========================== */
function escHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

