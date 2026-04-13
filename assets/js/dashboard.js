'use strict';

/* ===========================
   SESSION CHECK
=========================== */
const lab     = sessionStorage.getItem('loggedInLab');
const teacher = sessionStorage.getItem('loggedInTeacher');
const email   = sessionStorage.getItem('loggedInEmail');

if (!lab || !teacher) {
  window.location.href = 'login.html?lab=Computer%20Lab';
}

/* ===========================
   LAB DATA SEEDS
=========================== */
const LAB_EMOJIS = {
  'Computer Lab':  '[COM]',
  'Physics Lab':   '[PHY]',
  'Chemistry Lab': '[CHE]',
  'Biology Lab':   '[BIO]',
};

const SEED = {
  'Computer Lab': {
    items: [
      { code:'KOM-001', name:'Desktop PC', kat:'Elektronik', qty:30, cond:'Baik', note:'Intel Core i5 Gen 10', checked:'10 Apr 2026',
        units: [
          {no:1,  label:'PC #01',  cond:'Sangat Baik', note:''},
          {no:2,  label:'PC #02',  cond:'Baik',        note:''},
          {no:3,  label:'PC #03',  cond:'Baik',        note:''},
          {no:4,  label:'PC #04',  cond:'Baik',        note:''},
          {no:5,  label:'PC #05',  cond:'Baik',        note:''},
          {no:6,  label:'PC #06',  cond:'Sangat Baik', note:''},
          {no:7,  label:'PC #07',  cond:'Baik',        note:''},
          {no:8,  label:'PC #08',  cond:'Baik',        note:''},
          {no:9,  label:'PC #09',  cond:'Cukup',       note:'Kipas berisik'},
          {no:10, label:'PC #10',  cond:'Baik',        note:''},
          {no:11, label:'PC #11',  cond:'Baik',        note:''},
          {no:12, label:'PC #12',  cond:'Baik',        note:''},
          {no:13, label:'PC #13',  cond:'Sangat Baik', note:''},
          {no:14, label:'PC #14',  cond:'Baik',        note:''},
          {no:15, label:'PC #15',  cond:'Baik',        note:''},
          {no:16, label:'PC #16',  cond:'Baik',        note:''},
          {no:17, label:'PC #17',  cond:'Cukup',       note:'RAM sering error'},
          {no:18, label:'PC #18',  cond:'Baik',        note:''},
          {no:19, label:'PC #19',  cond:'Baik',        note:''},
          {no:20, label:'PC #20',  cond:'Baik',        note:''},
          {no:21, label:'PC #21',  cond:'Baik',        note:''},
          {no:22, label:'PC #22',  cond:'Rusak',       note:'Tidak bisa booting, HDD rusak'},
          {no:23, label:'PC #23',  cond:'Baik',        note:''},
          {no:24, label:'PC #24',  cond:'Baik',        note:''},
          {no:25, label:'PC #25',  cond:'Sangat Baik', note:''},
          {no:26, label:'PC #26',  cond:'Baik',        note:''},
          {no:27, label:'PC #27',  cond:'Baik',        note:''},
          {no:28, label:'PC #28',  cond:'Cukup',       note:'Monitor kadang blank'},
          {no:29, label:'PC #29',  cond:'Baik',        note:''},
          {no:30, label:'PC #30',  cond:'Baik',        note:''},
        ]
      },
      { code:'KOM-002', name:'Monitor 24"', kat:'Elektronik', qty:30, cond:'Baik', note:'LG Full HD', checked:'10 Apr 2026',
        units: Array.from({length:30}, (_,i) => ({no:i+1, label:'Monitor #'+String(i+1).padStart(2,'0'), cond: i===11?'Rusak':i===19?'Cukup':'Baik', note: i===11?'Layar retak':i===19?'Backlight redup':''}))
      },
      { code:'KOM-003', name:'Proyektor Epson',      kat:'Elektronik', qty:2,  cond:'Cukup',      note:'Perlu kalibrasi', checked:'8 Apr 2026',
        units: [{no:1,label:'Proyektor #01',cond:'Cukup',note:'Perlu kalibrasi lensa'},{no:2,label:'Proyektor #02',cond:'Baik',note:''}]
      },
      { code:'KOM-004', name:'UPS APC',              kat:'Elektronik', qty:5,  cond:'Sangat Baik',note:'', checked:'11 Apr 2026',
        units: Array.from({length:5}, (_,i) => ({no:i+1, label:'UPS #0'+(i+1), cond:'Sangat Baik', note:''}))
      },
      { code:'KOM-005', name:'Switch Hub 24-port',   kat:'Elektronik', qty:2,  cond:'Baik',       note:'', checked:'9 Apr 2026',
        units: [{no:1,label:'Switch #01',cond:'Baik',note:''},{no:2,label:'Switch #02',cond:'Baik',note:'Port 12-16 lambat'}]
      },
      { code:'KOM-006', name:'Keyboard Mechanical',  kat:'Peralatan',  qty:30, cond:'Baik',       note:'', checked:'10 Apr 2026',
        units: Array.from({length:30}, (_,i) => ({no:i+1, label:'Keyboard #'+String(i+1).padStart(2,'0'), cond: i===4?'Rusak':i===14?'Cukup':'Baik', note: i===4?'Tombol Enter copot':i===14?'Beberapa tombol macet':''}))
      },
      { code:'KOM-007', name:'Mouse Optical',        kat:'Peralatan',  qty:30, cond:'Baik',       note:'', checked:'10 Apr 2026',
        units: Array.from({length:30}, (_,i) => ({no:i+1, label:'Mouse #'+String(i+1).padStart(2,'0'), cond: i===7?'Rusak':'Baik', note: i===7?'Scroll tidak berfungsi':''}))
      },
      { code:'KOM-008', name:'Headset',              kat:'Peralatan',  qty:20, cond:'Cukup',      note:'5 unit kabel putus', checked:'7 Apr 2026',
        units: Array.from({length:20}, (_,i) => ({no:i+1, label:'Headset #'+String(i+1).padStart(2,'0'), cond: [2,7,11,15,18].includes(i)?'Rusak':'Baik', note: [2,7,11,15,18].includes(i)?'Kabel audio putus':''}))
      },
      { code:'KOM-009', name:'Meja Komputer',        kat:'Furnitur',   qty:30, cond:'Baik',       note:'', checked:'5 Apr 2026' },
      { code:'KOM-010', name:'Kursi Ergonomis',      kat:'Furnitur',   qty:32, cond:'Baik',       note:'', checked:'5 Apr 2026' },
      { code:'KOM-011', name:'AC Split 1.5 PK',      kat:'Elektronik', qty:3,  cond:'Sangat Baik',note:'', checked:'1 Apr 2026',
        units: [{no:1,label:'AC #01',cond:'Sangat Baik',note:''},{no:2,label:'AC #02',cond:'Sangat Baik',note:''},{no:3,label:'AC #03',cond:'Sangat Baik',note:''}]
      },
      { code:'KOM-012', name:'Desktop PC (Rusak)',   kat:'Elektronik', qty:2,  cond:'Rusak',      note:'Tidak bisa booting', checked:'9 Apr 2026',
        units: [{no:1,label:'PC Rusak #01',cond:'Rusak',note:'Tidak bisa booting'},{no:2,label:'PC Rusak #02',cond:'Rusak',note:'Motherboard terbakar'}]
      },
    ],
    jadwal: [
      { hari:'Senin',  mulai:'07:30', selesai:'09:30', kelas:'XI RPL 1', mapel:'Pemrograman Dasar',    note:'Praktikum Python' },
      { hari:'Senin',  mulai:'10:00', selesai:'12:00', kelas:'X TKJ 2',  mapel:'Jaringan Komputer',    note:'Konfigurasi Router' },
      { hari:'Selasa', mulai:'07:30', selesai:'09:30', kelas:'XII RPL 2',mapel:'Basis Data',            note:'Query SQL' },
      { hari:'Rabu',   mulai:'09:30', selesai:'11:30', kelas:'XI TKJ 1', mapel:'Administrasi Server',  note:'Install Linux' },
      { hari:'Kamis',  mulai:'07:30', selesai:'09:30', kelas:'X RPL 1',  mapel:'Desain Grafis',        note:'Adobe Illustrator' },
      { hari:'Jumat',  mulai:'10:00', selesai:'12:00', kelas:'XII TKJ 1',mapel:'Keamanan Jaringan',    note:'Ethical Hacking' },
    ],
    laporan: [
      { id:'LAP-001', nama:'Desktop PC #22',    desk:'Tidak bisa booting, kemungkinan HDD rusak', tgl:'2026-04-09', prioritas:'Tinggi',  status:'Belum Ditangani' },
      { id:'LAP-002', nama:'Proyektor Epson #1',desk:'Gambar buram, perlu kalibrasi lensa',        tgl:'2026-04-08', prioritas:'Sedang',  status:'Sedang Diperbaiki' },
      { id:'LAP-003', nama:'Headset #14',       desk:'Kabel audio putus sebelah kiri',             tgl:'2026-04-07', prioritas:'Rendah',  status:'Belum Ditangani' },
      { id:'LAP-004', nama:'UPS #2',            desk:'Baterai tidak menyimpan daya',               tgl:'2026-04-01', prioritas:'Kritis',  status:'Selesai' },
      { id:'LAP-005', nama:'Switch Hub #1',     desk:'Port 12-16 tidak berfungsi',                 tgl:'2026-03-28', prioritas:'Sedang',  status:'Selesai' },
    ],
    pinjam: [
      { id:'PNJ-001', nama:'Ahmad Fauzi',   kelas:'XI RPL 1', alat:'Laptop Asus',      qty:1, tglPinjam:'2026-04-10', tglKembali:'2026-04-12', status:'Dipinjam' },
      { id:'PNJ-002', nama:'Siti Rahayu',   kelas:'XII TKJ 1',alat:'Kabel LAN 5m',     qty:3, tglPinjam:'2026-04-09', tglKembali:'2026-04-11', status:'Terlambat' },
      { id:'PNJ-003', nama:'Budi Hartono',  kelas:'X RPL 2',  alat:'Mouse Wireless',   qty:2, tglPinjam:'2026-04-08', tglKembali:'2026-04-10', status:'Dikembalikan' },
      { id:'PNJ-004', nama:'Dewi Lestari',  kelas:'XI TKJ 2', alat:'Headset',          qty:1, tglPinjam:'2026-04-11', tglKembali:'2026-04-13', status:'Dipinjam' },
      { id:'PNJ-005', nama:'Rizky Pratama', kelas:'XII RPL 1',alat:'Flashdisk 32GB',   qty:2, tglPinjam:'2026-04-07', tglKembali:'2026-04-09', status:'Dikembalikan' },
    ],
  },
  'Physics Lab': {
    items: [
      { code:'FIS-001', name:'Osiloskop Digital',    kat:'Elektronik', qty:4,  cond:'Baik',       note:'', checked:'10 Apr 2026' },
      { code:'FIS-002', name:'Power Supply DC',      kat:'Elektronik', qty:8,  cond:'Sangat Baik',note:'', checked:'10 Apr 2026' },
      { code:'FIS-003', name:'Multimeter Digital',   kat:'Peralatan',  qty:15, cond:'Baik',       note:'', checked:'9 Apr 2026' },
      { code:'FIS-004', name:'Rel Dinamika',         kat:'Peralatan',  qty:6,  cond:'Cukup',      note:'Beberapa rel bengkok', checked:'8 Apr 2026' },
      { code:'FIS-005', name:'Neraca Ohaus',         kat:'Peralatan',  qty:5,  cond:'Baik',       note:'', checked:'9 Apr 2026' },
      { code:'FIS-006', name:'Termometer Digital',   kat:'Peralatan',  qty:10, cond:'Baik',       note:'', checked:'10 Apr 2026' },
      { code:'FIS-007', name:'Garpu Tala Set',       kat:'Peralatan',  qty:3,  cond:'Sangat Baik',note:'', checked:'5 Apr 2026' },
      { code:'FIS-008', name:'Meja Lab',             kat:'Furnitur',   qty:12, cond:'Baik',       note:'', checked:'1 Apr 2026' },
      { code:'FIS-009', name:'Osiloskop Analog',     kat:'Elektronik', qty:2,  cond:'Rusak',      note:'Layar tidak menyala', checked:'7 Apr 2026' },
    ],
    jadwal: [
      { hari:'Senin',  mulai:'07:30', selesai:'09:30', kelas:'XI IPA 1', mapel:'Fisika',  note:'Praktikum Gelombang' },
      { hari:'Rabu',   mulai:'10:00', selesai:'12:00', kelas:'XII IPA 2',mapel:'Fisika',  note:'Listrik Dinamis' },
      { hari:'Jumat',  mulai:'07:30', selesai:'09:30', kelas:'X IPA 1',  mapel:'Fisika',  note:'Gerak Lurus' },
    ],
    laporan: [
      { id:'LAP-001', nama:'Osiloskop Analog #2', desk:'Layar tidak menyala sama sekali', tgl:'2026-04-07', prioritas:'Tinggi', status:'Belum Ditangani' },
      { id:'LAP-002', nama:'Rel Dinamika #4',     desk:'Rel bengkok, tidak bisa diluruskan', tgl:'2026-04-05', prioritas:'Sedang', status:'Selesai' },
    ],
    pinjam: [
      { id:'PNJ-001', nama:'Rina Sari',    kelas:'XI IPA 1', alat:'Multimeter',    qty:2, tglPinjam:'2026-04-10', tglKembali:'2026-04-12', status:'Dipinjam' },
      { id:'PNJ-002', nama:'Doni Kusuma', kelas:'XII IPA 2', alat:'Power Supply',  qty:1, tglPinjam:'2026-04-08', tglKembali:'2026-04-10', status:'Dikembalikan' },
    ],
  },
  'Chemistry Lab': {
    items: [
      { code:'KIM-001', name:'Gelas Beaker 250ml',  kat:'Peralatan', qty:40, cond:'Baik',       note:'', checked:'10 Apr 2026' },
      { code:'KIM-002', name:'Erlenmeyer 500ml',    kat:'Peralatan', qty:30, cond:'Baik',       note:'', checked:'10 Apr 2026' },
      { code:'KIM-003', name:'Buret 50ml',          kat:'Peralatan', qty:10, cond:'Sangat Baik',note:'', checked:'9 Apr 2026' },
      { code:'KIM-004', name:'Spektrofotometer',    kat:'Elektronik',qty:2,  cond:'Baik',       note:'', checked:'8 Apr 2026' },
      { code:'KIM-005', name:'Timbangan Analitik',  kat:'Elektronik',qty:3,  cond:'Sangat Baik',note:'', checked:'10 Apr 2026' },
      { code:'KIM-006', name:'Hotplate Stirrer',    kat:'Elektronik',qty:5,  cond:'Baik',       note:'', checked:'9 Apr 2026' },
      { code:'KIM-007', name:'Pipet Ukur 10ml',     kat:'Peralatan', qty:20, cond:'Cukup',      note:'3 unit retak', checked:'7 Apr 2026' },
      { code:'KIM-008', name:'Lemari Asam',         kat:'Furnitur',  qty:2,  cond:'Baik',       note:'', checked:'5 Apr 2026' },
      { code:'KIM-009', name:'Centrifuge',          kat:'Elektronik',qty:1,  cond:'Rusak',      note:'Motor tidak berputar', checked:'6 Apr 2026' },
    ],
    jadwal: [
      { hari:'Selasa', mulai:'07:30', selesai:'09:30', kelas:'XI IPA 2', mapel:'Kimia', note:'Titrasi Asam Basa' },
      { hari:'Kamis',  mulai:'10:00', selesai:'12:00', kelas:'XII IPA 1',mapel:'Kimia', note:'Elektrokimia' },
    ],
    laporan: [
      { id:'LAP-001', nama:'Centrifuge #1',   desk:'Motor tidak berputar, bunyi aneh', tgl:'2026-04-06', prioritas:'Kritis', status:'Sedang Diperbaiki' },
      { id:'LAP-002', nama:'Pipet Ukur #7',   desk:'Retak di bagian tengah', tgl:'2026-04-07', prioritas:'Rendah', status:'Belum Ditangani' },
    ],
    pinjam: [
      { id:'PNJ-001', nama:'Maya Putri', kelas:'XI IPA 2', alat:'Gelas Beaker', qty:5, tglPinjam:'2026-04-11', tglKembali:'2026-04-12', status:'Dipinjam' },
    ],
  },
  'Biology Lab': {
    items: [
      { code:'BIO-001', name:'Mikroskop Binokuler',  kat:'Peralatan',  qty:15, cond:'Baik',       note:'', checked:'10 Apr 2026' },
      { code:'BIO-002', name:'Mikroskop Monokuler',  kat:'Peralatan',  qty:10, cond:'Cukup',      note:'Beberapa lensa kotor', checked:'8 Apr 2026' },
      { code:'BIO-003', name:'Inkubator',            kat:'Elektronik', qty:2,  cond:'Sangat Baik',note:'', checked:'9 Apr 2026' },
      { code:'BIO-004', name:'Autoclave',            kat:'Elektronik', qty:1,  cond:'Baik',       note:'', checked:'7 Apr 2026' },
      { code:'BIO-005', name:'Preparat Awetan',      kat:'Bahan',      qty:50, cond:'Baik',       note:'', checked:'10 Apr 2026' },
      { code:'BIO-006', name:'Pinset Bedah',         kat:'Peralatan',  qty:20, cond:'Baik',       note:'', checked:'9 Apr 2026' },
      { code:'BIO-007', name:'Cawan Petri',          kat:'Peralatan',  qty:30, cond:'Baik',       note:'', checked:'10 Apr 2026' },
      { code:'BIO-008', name:'Meja Lab',             kat:'Furnitur',   qty:10, cond:'Baik',       note:'', checked:'1 Apr 2026' },
      { code:'BIO-009', name:'Mikroskop Rusak',      kat:'Peralatan',  qty:2,  cond:'Rusak',      note:'Lensa objektif pecah', checked:'6 Apr 2026' },
    ],
    jadwal: [
      { hari:'Senin',  mulai:'10:00', selesai:'12:00', kelas:'XI IPA 3', mapel:'Biologi', note:'Pengamatan Sel' },
      { hari:'Rabu',   mulai:'07:30', selesai:'09:30', kelas:'XII IPA 3',mapel:'Biologi', note:'Genetika' },
      { hari:'Sabtu',  mulai:'07:30', selesai:'09:30', kelas:'X IPA 2',  mapel:'Biologi', note:'Ekosistem' },
    ],
    laporan: [
      { id:'LAP-001', nama:'Mikroskop Monokuler #3', desk:'Lensa okuler berjamur', tgl:'2026-04-08', prioritas:'Sedang', status:'Belum Ditangani' },
      { id:'LAP-002', nama:'Mikroskop Rusak #1',     desk:'Lensa objektif pecah', tgl:'2026-04-06', prioritas:'Tinggi', status:'Sedang Diperbaiki' },
    ],
    pinjam: [
      { id:'PNJ-001', nama:'Hendra Wijaya', kelas:'XI IPA 3', alat:'Mikroskop Binokuler', qty:1, tglPinjam:'2026-04-11', tglKembali:'2026-04-13', status:'Dipinjam' },
      { id:'PNJ-002', nama:'Lina Marlina',  kelas:'XII IPA 3',alat:'Pinset Bedah',        qty:3, tglPinjam:'2026-04-09', tglKembali:'2026-04-11', status:'Dikembalikan' },
    ],
  },
};

/* ===========================
   STATE
=========================== */
let data = JSON.parse(sessionStorage.getItem('labData_' + lab)) || deepClone(SEED[lab] || SEED['Computer Lab']);
let invPage = 1;
const INV_PER_PAGE = 8;
let weekOffset = 0;

function saveData() {
  sessionStorage.setItem('labData_' + lab, JSON.stringify(data));
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

/* ===========================
   INIT
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  populateUserInfo();
  updateTopbarDate();
  setInterval(updateTopbarDate, 60000);
  renderDashboard();
  renderJadwal();
  renderInventaris();
  renderLaporan();
  renderPinjam();
  renderProfil();
  renderCalendar();

  // Set today's date defaults in modals
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('addLapTgl').value = today;
  document.getElementById('addPinjamTgl').value = today;
  document.getElementById('addPinjamKembali').value = today;

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.notif-btn'))    document.getElementById('notifDropdown').classList.remove('open');
    if (!e.target.closest('.topbar-user'))  document.getElementById('userDropdown').classList.remove('open');
  });
});

/* ===========================
   USER INFO
=========================== */
function populateUserInfo() {
  const initials = teacher.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const emoji = LAB_EMOJIS[lab] || '🏫';

  setText('sidebarLabName', lab);
  setText('sidebarTeacher', teacher);
  setText('sidebarEmail', email);
  setText('sidebarAvatar', initials);

  setText('topbarLab', emoji + ' ' + lab);
  setText('topbarTeacher', teacher);
  setText('topbarAvatar', initials);
  setText('udAvatar', initials);
  setText('udName', teacher);
  setText('udEmail', email);

  setText('dashTitle', emoji + ' ' + lab);
  setText('dashDesc', 'Selamat datang, ' + teacher + '. Berikut ringkasan kondisi lab hari ini.');
}

function updateTopbarDate() {
  const now = new Date();
  const opts = { weekday:'long', day:'numeric', month:'long', year:'numeric' };
  setText('topbarDate', now.toLocaleDateString('id-ID', opts));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ===========================
   PAGE NAVIGATION
=========================== */
function showPage(page) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  const labels = {
    dashboard: 'Dashboard', jadwal: 'Jadwal Penggunaan',
    inventaris: 'Inventaris Alat', laporan: 'Laporan Kerusakan',
    peminjaman: 'Peminjaman Alat', profil: 'Profil Saya',
  };
  setText('topbarPage', labels[page] || page);

  // Close sidebar on mobile
  if (window.innerWidth <= 800) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function toggleNotif() {
  document.getElementById('notifDropdown').classList.toggle('open');
  document.getElementById('userDropdown').classList.remove('open');
}

function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('open');
  document.getElementById('notifDropdown').classList.remove('open');
}

function doLogout() {
  sessionStorage.clear();
  window.location.href = '../index.html';
}

/* ===========================
   DASHBOARD
=========================== */
function renderDashboard() {
  const items = data.items;
  const total = items.reduce((s, i) => s + i.qty, 0);
  const baikCount = items.filter(i => i.cond === 'Sangat Baik' || i.cond === 'Baik').length;
  const rusakAktif = data.laporan.filter(l => l.status !== 'Selesai').length;

  setText('statTotal', total);
  setText('statBaik', baikCount + ' jenis');
  setText('statBaikPct', Math.round(baikCount / items.length * 100) + '% baik');
  setText('statRusak', rusakAktif);
  setText('statJadwal', data.jadwal.length);
  setText('statTotalTrend', items.length + ' jenis');

  // Condition bar
  const cExcellent = items.filter(i => i.cond === 'Sangat Baik').length;
  const cGood      = items.filter(i => i.cond === 'Baik').length;
  const cFair      = items.filter(i => i.cond === 'Cukup').length;
  const cPoor      = items.filter(i => i.cond === 'Rusak').length;
  const tot = items.length || 1;
  document.getElementById('cbExcellent').style.width = (cExcellent/tot*100) + '%';
  document.getElementById('cbGood').style.width      = (cGood/tot*100) + '%';
  document.getElementById('cbFair').style.width      = (cFair/tot*100) + '%';
  document.getElementById('cbPoor').style.width      = (cPoor/tot*100) + '%';
  const goodPct = Math.round((cExcellent + cGood) / tot * 100);
  setText('condBarPct', goodPct + '% kondisi baik');

  // Today's schedule
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const todayName = days[new Date().getDay()];
  const todaySched = data.jadwal.filter(j => j.hari === todayName);
  const schedEl = document.getElementById('todaySchedule');
  if (todaySched.length === 0) {
    schedEl.innerHTML = '<div class="sched-empty">Tidak ada jadwal hari ini</div>';
  } else {
    schedEl.innerHTML = todaySched.map(j => `
      <div class="sched-item">
        <div class="sched-time">${j.mulai}–${j.selesai}</div>
        <div class="sched-info">
          <div class="sched-class">${j.kelas}</div>
          <div class="sched-mapel">${j.mapel}${j.note ? ' · ' + j.note : ''}</div>
        </div>
      </div>`).join('');
  }

  // Activity feed
  const activities = [
    { color:'blue',   text:`<strong>${teacher}</strong> login ke sistem`, time:'Baru saja' },
    { color:'green',  text:`Jadwal <strong>${data.jadwal[0]?.kelas || '-'}</strong> dikonfirmasi`, time:'1 jam lalu' },
    { color:'orange', text:`Laporan kerusakan <strong>${data.laporan[0]?.nama || '-'}</strong> dibuat`, time:'2 jam lalu' },
    { color:'blue',   text:`Inventaris diperbarui: <strong>${data.items[0]?.name || '-'}</strong>`, time:'Kemarin' },
    { color:'green',  text:`Peminjaman <strong>${data.pinjam[0]?.alat || '-'}</strong> dicatat`, time:'Kemarin' },
  ];
  document.getElementById('activityFeed').innerHTML = activities.map(a => `
    <div class="act-item">
      <div class="act-dot ${a.color}"></div>
      <div class="act-text">${a.text}</div>
      <div class="act-time">${a.time}</div>
    </div>`).join('');

  // Alert items
  const alerts = [];
  const rusak = items.filter(i => i.cond === 'Rusak');
  const cukup = items.filter(i => i.cond === 'Cukup');
  rusak.forEach(i => alerts.push({ cls:'danger', msg:'🔴 ' + i.name + ' — Kondisi Rusak' }));
  cukup.forEach(i => alerts.push({ cls:'warn',   msg:'🟡 ' + i.name + ' — Perlu Perhatian' }));
  if (alerts.length === 0) alerts.push({ cls:'ok', msg:'✓ Semua alat dalam kondisi baik' });
  document.getElementById('alertItems').innerHTML = alerts.slice(0,5).map(a =>
    `<div class="alert-item ${a.cls}">${a.msg}</div>`).join('');
}

/* ===========================
   JADWAL
=========================== */
function renderJadwal() {
  renderJadwalTable(data.jadwal);
  renderCalendar();
}

function renderJadwalTable(list) {
  const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const today = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
  document.getElementById('jadwalBody').innerHTML = list.map((j, i) => {
    const isToday = j.hari === today;
    return `<tr>
      <td>${j.hari}</td>
      <td>${j.mulai} – ${j.selesai}</td>
      <td><strong style="color:var(--text)">${j.kelas}</strong></td>
      <td>${j.mapel}</td>
      <td>${teacher}</td>
      <td><span class="badge ${isToday ? 'ok' : 'gray'}">${isToday ? 'Hari Ini' : 'Terjadwal'}</span></td>
      <td>
        <button class="tbl-btn danger" onclick="deleteJadwal(${i})">Hapus</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px">Belum ada jadwal</td></tr>';
}

function filterJadwal() {
  const q = document.getElementById('jadwalSearch').value.toLowerCase();
  const filtered = data.jadwal.filter(j =>
    j.kelas.toLowerCase().includes(q) || j.mapel.toLowerCase().includes(q)
  );
  renderJadwalTable(filtered);
}

function addJadwal() {
  const kelas = document.getElementById('addJadwalKelas').value.trim();
  const mapel = document.getElementById('addJadwalMapel').value.trim();
  if (!kelas || !mapel) { showToast('Kelas dan mata pelajaran wajib diisi.'); return; }
  const hariR = document.querySelector('input[name="jadwalHariR"]:checked');
  data.jadwal.push({
    hari:    hariR ? hariR.value : 'Senin',
    mulai:   document.getElementById('addJadwalMulai').value,
    selesai: document.getElementById('addJadwalSelesai').value,
    kelas, mapel,
    note:    document.getElementById('addJadwalNote').value.trim(),
  });
  saveData();
  renderJadwal();
  renderDashboard();
  closeModal('addJadwalModal');
  showToast('Jadwal berhasil ditambahkan.');
  document.getElementById('addJadwalKelas').value = '';
  document.getElementById('addJadwalMapel').value = '';
  document.getElementById('addJadwalNote').value  = '';
}

function deleteJadwal(idx) {
  if (!confirm('Hapus jadwal ini?')) return;
  data.jadwal.splice(idx, 1);
  saveData();
  renderJadwal();
  renderDashboard();
  showToast('Jadwal dihapus.');
}

/* ===========================
   CALENDAR
=========================== */
function renderCalendar() {
  const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const todayName = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) + weekOffset * 7);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 5);

  const fmt = d => d.toLocaleDateString('id-ID', { day:'numeric', month:'short' });
  setText('weekLabel', fmt(startOfWeek) + ' – ' + fmt(endOfWeek) + ' ' + startOfWeek.getFullYear());

  document.getElementById('calendarGrid').innerHTML = days.map(day => {
    const isToday = day === todayName && weekOffset === 0;
    const events = data.jadwal.filter(j => j.hari === day);
    return `<div class="cal-day ${isToday ? 'today' : ''}">
      <div class="cal-day-name">${day}</div>
      ${events.map(e => `<div class="cal-event" title="${e.kelas} · ${e.mapel}">${e.mulai} ${e.kelas}</div>`).join('')}
    </div>`;
  }).join('');
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
  const q    = document.getElementById('invSearch').value.toLowerCase();
  const cond = document.getElementById('invFilterCond').value;
  const kat  = document.getElementById('invFilterKat').value;

  const filtered = data.items.filter(i =>
    (i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) &&
    (!cond || i.cond === cond) &&
    (!kat  || i.kat  === kat)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / INV_PER_PAGE));
  if (invPage > totalPages) invPage = totalPages;
  const slice = filtered.slice((invPage-1)*INV_PER_PAGE, invPage*INV_PER_PAGE);

  const condMap = {
    'Sangat Baik': 'ok',
    'Baik':        'good',
    'Cukup':       'warn',
    'Rusak':       'danger',
  };

  document.getElementById('invBody').innerHTML = slice.map((item) => {
    const realIdx = data.items.indexOf(item);
    // Build kondisi cell: jika ada units, tampilkan summary per kondisi
    let condCell;
    if (item.units && item.units.length > 0) {
      const u = item.units;
      const sb = u.filter(x => x.cond === 'Sangat Baik').length;
      const b  = u.filter(x => x.cond === 'Baik').length;
      const c  = u.filter(x => x.cond === 'Cukup').length;
      const r  = u.filter(x => x.cond === 'Rusak').length;
      const parts = [];
      if (sb) parts.push(`<span class="badge ok">${sb} Sangat Baik</span>`);
      if (b)  parts.push(`<span class="badge good">${b} Baik</span>`);
      if (c)  parts.push(`<span class="badge warn">${c} Cukup</span>`);
      if (r)  parts.push(`<span class="badge danger">${r} Rusak</span>`);
      condCell = `<div style="display:flex;flex-wrap:wrap;gap:4px">${parts.join('')}</div>`;
    } else {
      condCell = `<span class="badge ${condMap[item.cond] || 'gray'}">${item.cond}</span>`;
    }
    const hasUnits = item.units && item.units.length > 0;
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${item.code}</td>
      <td><strong style="color:var(--text)">${item.name}</strong>${item.note ? '<br><span style="font-size:10px;color:var(--text-dim)">' + item.note + '</span>' : ''}</td>
      <td>${item.kat}</td>
      <td style="font-weight:600">${item.qty}</td>
      <td>${condCell}</td>
      <td style="font-size:11px">${item.checked}</td>
      <td>
        ${hasUnits ? `<button class="tbl-btn info" onclick="openUnitModal(${realIdx})">📋 Detail Unit</button>` : ''}
        <button class="tbl-btn" onclick="openEditItem(${realIdx})">Edit</button>
        <button class="tbl-btn danger" onclick="deleteItem(${realIdx})">Hapus</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px">Tidak ada data</td></tr>';

  // Pagination
  let pgHtml = '';
  for (let p = 1; p <= totalPages; p++) {
    pgHtml += `<button class="pg-btn ${p===invPage?'active':''}" onclick="goInvPage(${p})">${p}</button>`;
  }
  document.getElementById('invPagination').innerHTML = pgHtml;
}

function goInvPage(p) { invPage = p; filterInventaris(); }

function addItem() {
  const name = document.getElementById('addItemName').value.trim();
  if (!name) { showToast('Nama alat wajib diisi.'); return; }
  const today = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  data.items.push({
    code:    document.getElementById('addItemCode').value.trim() || autoCode(),
    name,
    kat:     document.getElementById('addItemKat').value,
    qty:     parseInt(document.getElementById('addItemQty').value) || 1,
    cond:    (document.querySelector('input[name="addItemCondR"]:checked') || {value:'Baik'}).value,
    note:    document.getElementById('addItemNote').value.trim(),
    checked: today,
  });
  saveData();
  renderInventaris();
  renderDashboard();
  closeModal('addItemModal');
  showToast('Alat berhasil ditambahkan.');
  document.getElementById('addItemName').value = '';
  document.getElementById('addItemCode').value = '';
  document.getElementById('addItemNote').value = '';
  document.getElementById('addItemQty').value  = '1';
}

function autoCode() {
  const prefix = lab.split(' ').map(w=>w[0]).join('').toUpperCase();
  return prefix + '-' + String(data.items.length + 1).padStart(3,'0');
}

function openEditItem(idx) {
  const item = data.items[idx];
  document.getElementById('editItemIdx').value  = idx;
  document.getElementById('editItemName').value  = item.name;
  document.getElementById('editItemCode').value  = item.code;
  document.getElementById('editItemQty').value   = item.qty;
  document.getElementById('editItemNote').value  = item.note;
  setSelect('editItemKat', item.kat);
  // Set radio button kondisi
  document.querySelectorAll('input[name="editItemCondR"]').forEach(r => {
    r.checked = r.value === item.cond;
  });
  openModal('editItemModal');
}

function saveEditItem() {
  const idx  = parseInt(document.getElementById('editItemIdx').value);
  const name = document.getElementById('editItemName').value.trim();
  if (!name) { showToast('Nama alat wajib diisi.'); return; }
  const condR = document.querySelector('input[name="editItemCondR"]:checked');
  const today = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  data.items[idx] = {
    ...data.items[idx],
    name,
    code:    document.getElementById('editItemCode').value.trim(),
    kat:     document.getElementById('editItemKat').value,
    qty:     parseInt(document.getElementById('editItemQty').value) || 1,
    cond:    condR ? condR.value : data.items[idx].cond,
    note:    document.getElementById('editItemNote').value.trim(),
    checked: today,
  };
  saveData();
  renderInventaris();
  renderDashboard();
  closeModal('editItemModal');
  showToast('Data alat diperbarui.');
}

function deleteItem(idx) {
  if (!confirm('Hapus alat "' + data.items[idx].name + '"?')) return;
  data.items.splice(idx, 1);
  saveData();
  renderInventaris();
  renderDashboard();
  showToast('Alat dihapus.');
}

/* ===========================
   UNIT DETAIL MODAL
=========================== */
let currentUnitItemIdx = -1;

function openUnitModal(itemIdx) {
  currentUnitItemIdx = itemIdx;
  const item = data.items[itemIdx];
  document.getElementById('unitModalTitle').textContent = item.name + ' — Detail Unit';
  document.getElementById('unitModalSub').textContent = item.code + ' · ' + item.qty + ' unit';
  renderUnitTable();
  openModal('unitDetailModal');
}

function renderUnitTable() {
  const item = data.items[currentUnitItemIdx];
  if (!item || !item.units) return;
  const condMap = { 'Sangat Baik':'ok', 'Baik':'good', 'Cukup':'warn', 'Rusak':'danger' };
  const q = (document.getElementById('unitSearch') || {}).value || '';
  const f = (document.getElementById('unitFilter') || {}).value || '';
  const list = item.units.filter(u =>
    (!q || u.label.toLowerCase().includes(q.toLowerCase())) &&
    (!f || u.cond === f)
  );
  document.getElementById('unitBody').innerHTML = list.map(u => {
    const realIdx = item.units.indexOf(u);
    return `<tr class="${u.cond === 'Rusak' ? 'unit-row-rusak' : u.cond === 'Cukup' ? 'unit-row-cukup' : ''}">
      <td style="font-weight:600;color:var(--text)">${u.label}</td>
      <td>
        <select class="unit-cond-sel" onchange="updateUnitCond(${realIdx}, this.value)">
          <option ${u.cond==='Sangat Baik'?'selected':''}>Sangat Baik</option>
          <option ${u.cond==='Baik'?'selected':''}>Baik</option>
          <option ${u.cond==='Cukup'?'selected':''}>Cukup</option>
          <option ${u.cond==='Rusak'?'selected':''}>Rusak</option>
        </select>
      </td>
      <td>
        <input class="unit-note-inp" value="${u.note}" placeholder="Catatan kerusakan..." onchange="updateUnitNote(${realIdx}, this.value)">
      </td>
      <td>
        <span class="badge ${condMap[u.cond] || 'gray'}">${u.cond}</span>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:16px">Tidak ada unit</td></tr>';

  // Update summary bar
  const all = item.units;
  const sb = all.filter(x => x.cond === 'Sangat Baik').length;
  const b  = all.filter(x => x.cond === 'Baik').length;
  const c  = all.filter(x => x.cond === 'Cukup').length;
  const r  = all.filter(x => x.cond === 'Rusak').length;
  document.getElementById('unitSummary').innerHTML =
    `<span class="badge ok">${sb} Sangat Baik</span>` +
    `<span class="badge good">${b} Baik</span>` +
    `<span class="badge warn">${c} Cukup</span>` +
    `<span class="badge danger">${r} Rusak</span>`;
}

function updateUnitCond(unitIdx, val) {
  data.items[currentUnitItemIdx].units[unitIdx].cond = val;
  // Sync item.cond ke kondisi terburuk
  const units = data.items[currentUnitItemIdx].units;
  if (units.some(u => u.cond === 'Rusak'))           data.items[currentUnitItemIdx].cond = 'Rusak';
  else if (units.some(u => u.cond === 'Cukup'))      data.items[currentUnitItemIdx].cond = 'Cukup';
  else if (units.some(u => u.cond === 'Baik'))       data.items[currentUnitItemIdx].cond = 'Baik';
  else                                                data.items[currentUnitItemIdx].cond = 'Sangat Baik';
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
  const total   = data.laporan.length;
  const open    = data.laporan.filter(l => l.status === 'Belum Ditangani').length;
  const process = data.laporan.filter(l => l.status === 'Sedang Diperbaiki').length;
  const done    = data.laporan.filter(l => l.status === 'Selesai').length;
  const kritis  = data.laporan.filter(l => l.prioritas === 'Kritis').length;
  setText('lsTotal',   total);
  setText('lsOpen',    open);
  setText('lsProcess', process);
  setText('lsDone',    done);
  // sub-text
  const elSub = document.getElementById('lsKritisSub');
  if (elSub) elSub.textContent = kritis + ' prioritas kritis';
}

function renderPrioBreakdown() {
  const el = document.getElementById('prioBreakdown');
  if (!el) return;
  const counts = { Kritis:0, Tinggi:0, Sedang:0, Rendah:0 };
  data.laporan.forEach(l => { if (counts[l.prioritas] !== undefined) counts[l.prioritas]++; });
  const max = Math.max(...Object.values(counts), 1);
  const colors = { Kritis:'critical', Tinggi:'high', Sedang:'medium', Rendah:'low' };
  el.innerHTML = Object.entries(counts).map(([prio, cnt]) => `
    <div class="prio-row">
      <span class="prio-row-label">${prio}</span>
      <div class="prio-bar-track"><div class="prio-bar-fill ${colors[prio]}" style="width:${Math.round(cnt/max*100)}%"></div></div>
      <span class="prio-row-count">${cnt}</span>
    </div>`).join('');
}

function renderKritisList() {
  const el = document.getElementById('kritisList');
  if (!el) return;
  const urgent = data.laporan
    .filter(l => (l.prioritas === 'Kritis' || l.prioritas === 'Tinggi') && l.status !== 'Selesai')
    .slice(0, 5);
  if (!urgent.length) {
    el.innerHTML = '<div class="kritis-empty">✅ Tidak ada laporan mendesak</div>';
    return;
  }
  el.innerHTML = urgent.map(l => {
    const isKritis = l.prioritas === 'Kritis';
    return `<div class="kritis-item ${isKritis ? '' : 'warn'}">
      <div class="kritis-dot ${isKritis ? '' : 'warn'}"></div>
      <div class="kritis-info">
        <div class="kritis-name">${l.nama}</div>
        <div class="kritis-desc">${l.desk}</div>
        <div class="kritis-date">${l.tgl} · ${l.status}</div>
      </div>
      <span class="kritis-badge ${isKritis ? 'kritis' : 'tinggi'}">${l.prioritas}</span>
    </div>`;
  }).join('');
}

function filterLaporan() {
  const f = document.getElementById('laporanFilter').value;
  const q = (document.getElementById('laporanSearch') || {}).value || '';
  let list = f ? data.laporan.filter(l => l.status === f) : data.laporan;
  if (q) list = list.filter(l => l.nama.toLowerCase().includes(q.toLowerCase()) || l.desk.toLowerCase().includes(q.toLowerCase()));
  const prioMap = { 'Rendah':'gray','Sedang':'good','Tinggi':'warn','Kritis':'danger' };
  const statMap = { 'Belum Ditangani':'danger','Sedang Diperbaiki':'warn','Selesai':'ok' };
  const stepMap = { 'Belum Ditangani':0,'Sedang Diperbaiki':1,'Selesai':2 };
  document.getElementById('laporanBody').innerHTML = list.map((l) => {
    const realIdx = data.laporan.indexOf(l);
    const step = stepMap[l.status] || 0;
    const steps = [0,1,2].map(s => `<div class="ps-step ${s < step ? 'done' : s === step && step < 2 ? 'active' : s < 2 && step === 2 ? 'done' : ''}"></div>`).join('');
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${l.id}</td>
      <td><strong style="color:var(--text)">${l.nama}</strong></td>
      <td style="max-width:180px;white-space:normal;font-size:11px;color:var(--text-muted)">${l.desk}</td>
      <td style="font-size:11px">${l.tgl}</td>
      <td><span class="badge ${prioMap[l.prioritas] || 'gray'}">${l.prioritas}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-steps">${steps}</div>
          <span class="badge ${statMap[l.status] || 'gray'}" style="font-size:9px">${l.status}</span>
        </div>
      </td>
      <td>
        ${l.status !== 'Selesai' ? `<button class="tbl-btn" onclick="advanceLaporan(${realIdx})">▶ Lanjut</button>` : '<span style="font-size:11px;color:var(--green)">✓ Selesai</span>'}
        <button class="tbl-btn danger" onclick="deleteLaporan(${realIdx})">Hapus</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px">Tidak ada laporan</td></tr>';
}

function setLaporanFilter(val) {
  document.getElementById('laporanFilter').value = val;
  filterLaporan();
}

function addLaporan() {
  const nama = document.getElementById('addLapNama').value.trim();
  const desk = document.getElementById('addLapDesk').value.trim();
  if (!nama || !desk) { showToast('Nama alat dan deskripsi wajib diisi.'); return; }
  const prioR = document.querySelector('input[name="lapPrioR"]:checked');
  const newId = 'LAP-' + String(data.laporan.length + 1).padStart(3,'0');
  data.laporan.unshift({
    id: newId, nama, desk,
    tgl:       document.getElementById('addLapTgl').value,
    prioritas: prioR ? prioR.value : 'Sedang',
    status:    'Belum Ditangani',
  });
  saveData();
  renderLaporan();
  renderDashboard();
  closeModal('addLaporanModal');
  showToast('Laporan berhasil dikirim.');
  document.getElementById('addLapNama').value = '';
  document.getElementById('addLapDesk').value = '';
}

function advanceLaporan(idx) {
  const l = data.laporan[idx];
  if (l.status === 'Belum Ditangani') l.status = 'Sedang Diperbaiki';
  else if (l.status === 'Sedang Diperbaiki') l.status = 'Selesai';
  saveData();
  renderLaporan();
  renderDashboard();
  showToast('Status laporan diperbarui.');
}

function deleteLaporan(idx) {
  if (!confirm('Hapus laporan ini?')) return;
  data.laporan.splice(idx, 1);
  saveData();
  renderLaporan();
  renderDashboard();
  showToast('Laporan dihapus.');
}

/* ===========================
   PEMINJAMAN
=========================== */
function renderPinjam() {
  filterPinjam();
  updatePinjamStats();
}

function updatePinjamStats() {
  setText('psDipinjam',    data.pinjam.filter(p => p.status === 'Dipinjam').length);
  setText('psDikembalikan',data.pinjam.filter(p => p.status === 'Dikembalikan').length);
  setText('psTerlambat',   data.pinjam.filter(p => p.status === 'Terlambat').length);
}

function filterPinjam() {
  const q = document.getElementById('pinjamSearch').value.toLowerCase();
  const list = data.pinjam.filter(p =>
    p.nama.toLowerCase().includes(q) || p.alat.toLowerCase().includes(q)
  );
  const statMap = { 'Dipinjam':'good','Dikembalikan':'ok','Terlambat':'danger' };
  document.getElementById('pinjamBody').innerHTML = list.map((p, i) => {
    const realIdx = data.pinjam.indexOf(p);
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${p.id}</td>
      <td><strong style="color:var(--text)">${p.nama}</strong><br><span style="font-size:10px;color:var(--text-dim)">${p.kelas}</span></td>
      <td>${p.alat}</td>
      <td>${p.qty}</td>
      <td style="font-size:11px">${p.tglPinjam}</td>
      <td style="font-size:11px">${p.tglKembali}</td>
      <td><span class="badge ${statMap[p.status] || 'gray'}">${p.status}</span></td>
      <td>
        ${p.status === 'Dipinjam' || p.status === 'Terlambat' ? `<button class="tbl-btn" onclick="returnPinjam(${realIdx})">Kembalikan</button>` : ''}
        <button class="tbl-btn danger" onclick="deletePinjam(${realIdx})">Hapus</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:20px">Tidak ada data peminjaman</td></tr>';
}

function addPinjam() {
  const nama = document.getElementById('addPinjamNama').value.trim();
  const alat = document.getElementById('addPinjamAlat').value.trim();
  if (!nama || !alat) { showToast('Nama peminjam dan alat wajib diisi.'); return; }
  const newId = 'PNJ-' + String(data.pinjam.length + 1).padStart(3,'0');
  data.pinjam.unshift({
    id: newId, nama, alat,
    kelas:      document.getElementById('addPinjamKelas').value.trim(),
    qty:        parseInt(document.getElementById('addPinjamQty').value) || 1,
    tglPinjam:  document.getElementById('addPinjamTgl').value,
    tglKembali: document.getElementById('addPinjamKembali').value,
    status:     'Dipinjam',
  });
  saveData();
  renderPinjam();
  closeModal('addPinjamModal');
  showToast('Peminjaman berhasil dicatat.');
  document.getElementById('addPinjamNama').value    = '';
  document.getElementById('addPinjamKelas').value   = '';
  document.getElementById('addPinjamAlat').value    = '';
  document.getElementById('addPinjamQty').value     = '1';
}

function returnPinjam(idx) {
  data.pinjam[idx].status = 'Dikembalikan';
  saveData();
  renderPinjam();
  showToast('Alat berhasil dikembalikan.');
}

function deletePinjam(idx) {
  if (!confirm('Hapus catatan peminjaman ini?')) return;
  data.pinjam.splice(idx, 1);
  saveData();
  renderPinjam();
  showToast('Catatan dihapus.');
}

/* ===========================
   PROFIL
=========================== */
function renderProfil() {
  const initials = teacher.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const emoji = LAB_EMOJIS[lab] || '🏫';
  const now = new Date().toLocaleString('id-ID');

  setText('profilAvatar', initials);
  setText('profilName', teacher);
  setText('profilEmail', email);
  setText('profilLab', lab);
  setText('profilLabBadge', emoji + ' ' + lab);
  setText('profilLastLogin', now);

  setText('pstatItem',    data.items.length);
  setText('pstatLaporan', data.laporan.length);
  setText('pstatJadwal',  data.jadwal.length);
  setText('pstatPinjam',  data.pinjam.length);
}

/* ===========================
   PHOTO PREVIEW & HELPERS
=========================== */
function previewPhoto(inputId, previewId, placeholderId) {
  const file = document.getElementById(inputId).files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById(previewId);
    const ph  = document.getElementById(placeholderId);
    img.src = e.target.result;
    img.style.display = 'block';
    if (ph) ph.style.display = 'none';
    // Show remove button if exists
    const removeId = inputId.replace('Photo', 'RemovePhoto');
    const removeBtn = document.getElementById(removeId);
    if (removeBtn) removeBtn.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removePhoto(inputId, previewId, placeholderId, removeBtnId) {
  document.getElementById(inputId).value = '';
  const img = document.getElementById(previewId);
  img.src = '';
  img.style.display = 'none';
  const ph = document.getElementById(placeholderId);
  if (ph) ph.style.display = 'flex';
  const removeBtn = document.getElementById(removeBtnId);
  if (removeBtn) removeBtn.style.display = 'none';
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
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function closeModalOutside(e) {
  if (e.target === e.currentTarget) closeModal(e.currentTarget.id);
}

/* ===========================
   TOAST
=========================== */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
