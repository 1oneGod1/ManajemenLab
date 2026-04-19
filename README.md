# LabFlow Pro - Sistem Manajemen Laboratorium Berbasis Cloud

Sistem Manajemen Laboratorium Terpadu adalah platform berbasis web untuk mengelola fasilitas laboratorium secara terpusat di berbagai jenis laboratorium dengan memanfaatkan teknologi Google Firebase dan Cloudflare R2 sebagai infrastruktur cloud.

## Deskripsi Sistem

Aplikasi ini dirancang untuk mendigitalisasi dan mempermudah pengelolaan fasilitas laboratorium di 4 jenis laboratorium:
- **Laboratorium Komputer**
- **Laboratorium Fisika**
- **Laboratorium Kimia**
- **Laboratorium Biologi**

Fitur mencakup pendataan inventaris terstruktur, pelaporan kerusakan alat, dokumentasi visual fasilitas, dan sinkronisasi data real-time.

## Fitur Utama Sistem

### A. Manajemen Data Fasilitas (CRUD)
- ✅ **Create**: Menambahkan data fasilitas baru (komputer, mikroskop, alat lab, dll)
- ✅ **Read**: Menampilkan daftar fasilitas berdasarkan laboratorium
- ✅ **Update**: Memperbarui detail fasilitas (jumlah, kondisi, lokasi)
- ✅ **Delete**: Menghapus data fasilitas yang afkir atau tidak digunakan

### B. Laporan Kerusakan
- ✅ Menginput laporan kerusakan pada alat tertentu
- ✅ Menyimpan detail deskripsi masalah/kerusakan beserta foto bukti
- ✅ Memantau status perbaikan: Belum Ditangani, Sedang Diperbaiki, Selesai
- ✅ Filter dan pencarian laporan berdasarkan status dan prioritas

### C. Unggah Dokumentasi (Cloudflare R2 Storage)
- ✅ Mengunggah foto bukti kerusakan alat ke Cloudflare R2
- ✅ Mengunggah foto dokumentasi fasilitas/inventaris
- ✅ Menyimpan URL publik file ke Firebase Realtime Database
- ✅ Akses foto langsung dari kartu inventaris dan detail laporan

### D. Sinkronisasi Data Real-Time
- ✅ Semua data otomatis diperbarui di layar pengguna tanpa reload halaman
- ✅ Pemantauan kondisi inventaris laboratorium secara langsung dan terkini
- ✅ Kolaborasi multi-pengguna dengan data yang selalu konsisten

### E. Autentikasi (Firebase Authentication)
- ✅ Login per laboratorium dengan email & password
- ✅ Verifikasi email pengguna baru
- ✅ Proteksi halaman dashboard — hanya pengguna terautentikasi yang bisa akses
- ✅ Profil pengguna tersimpan di Firebase (`/user_profiles/{uid}`)

## Teknologi & Cloud Services

### Frontend
- HTML5, CSS3, Vanilla JavaScript (ES6+)
- Inter font via Google Fonts
- Tanpa framework atau build tool

### Backend (Cloud Services)
- **Firebase Realtime Database**: NoSQL database untuk semua data teks, sinkronisasi real-time
- **Firebase Authentication**: Login dengan email/password + verifikasi email
- **Cloudflare R2**: Object storage untuk file gambar (foto inventaris & laporan kerusakan)
- **Firebase SDK v10.12.2 (compat)**: Penghubung antara frontend dan Firebase

### Hosting
- GitHub Pages

## Struktur Proyek

```
/
├── index.html                  # Dashboard admin utama (global view)
├── pages/
│   ├── home.html               # Landing page
│   ├── login.html              # Halaman login per lab
│   ├── dashboard.html          # Dashboard per laboratorium
│   └── room.html               # Manajemen per ruangan
├── assets/
│   ├── css/
│   │   ├── style.css           # CSS untuk index.html
│   │   ├── home.css            # CSS untuk home.html
│   │   ├── login.css           # CSS untuk login.html
│   │   └── dashboard.css       # CSS untuk dashboard.html & room.html
│   └── js/
│       ├── firebase-config.js  # Konfigurasi Firebase SDK
│       ├── r2-service.js       # Cloudflare R2 upload/delete helper
│       ├── app.js              # Logika untuk index.html
│       ├── login.js            # Logika untuk login.html
│       ├── dashboard.js        # Logika untuk dashboard.html
│       ├── room.js             # Logika untuk room.html
│       └── data.js             # Data statis seed awal
└── README.md
```

## Alur Kerja Sistem

1. Pengguna mengakses landing page (`home.html`) dan memilih laboratorium
2. Pengguna login melalui `login.html` dengan akun email yang sudah terverifikasi
3. Dashboard lab ditampilkan dengan data real-time dari Firebase
4. Pengguna mengelola inventaris, jadwal, laporan kerusakan, dan peminjaman alat
5. Jika ada foto yang diunggah, file dikirim ke Cloudflare R2 dan URL-nya disimpan ke Firebase
6. Semua perubahan langsung tersinkronisasi ke seluruh sesi yang aktif

## Struktur Data Firebase (JSON)

```json
{
  "lab_data": {
    "Computer Lab": {
      "items": {
        "-key": { "name": "Komputer Dell", "qty": 20, "cond": "Baik", "kat": "Elektronik", "fotoUrl": "https://pub-xxx.r2.dev/..." }
      },
      "laporan": {
        "-key": { "id": "LAP-001", "nama": "Komputer Dell", "desk": "Monitor tidak menyala", "status": "Belum Ditangani", "prioritas": "Tinggi", "fotoUrl": "..." }
      },
      "jadwal": {
        "-key": { "hari": "Senin", "mulai": "08:00", "selesai": "10:00", "kelas": "X IPA 1", "mapel": "TIK" }
      },
      "pinjam": {
        "-key": { "id": "PNJ-001", "nama": "Budi", "alat": "Laptop Asus", "status": "Dipinjam" }
      },
      "categories": ["Elektronik", "Peralatan", "Furnitur", "Bahan"]
    }
  },
  "rooms": {
    "-roomKey": {
      "name": "Lab Komputer A", "lab": "Computer Lab",
      "items": { "-key": { "name": "PC Unit 1", "qty": 1, "cond": "Baik", "fotoUrl": "..." } },
      "jadwal": { "-key": { "hari": "Selasa", "kelas": "XI RPL" } }
    }
  },
  "user_profiles": {
    "{uid}": { "lab": "Computer Lab", "teacher": "Budi Santoso" }
  },
  "activity_log": {
    "-key": { "type": "add", "text": "Item ditambahkan: Komputer Dell", "actor": "Budi", "timestamp": 1713456789000 }
  }
}
```

## Status Pengembangan

### Phase 1: UI/UX ✅ SELESAI
- ✅ Desain responsive semua halaman (home, login, dashboard, room)
- ✅ Struktur navigasi dan modal CRUD
- ✅ Design system dengan dark/light mode

### Phase 2: Backend Integration ✅ SELESAI
- ✅ Firebase Realtime Database — semua CRUD terhubung
- ✅ Firebase Authentication — login + verifikasi email
- ✅ Cloudflare R2 — upload foto inventaris & laporan
- ✅ Real-time listeners aktif di semua halaman
- ✅ Activity log tersimpan ke Firebase

### Phase 3: Production Ready ⏳ IN PROGRESS
- ⏳ Firebase Security Rules (saat ini open untuk testing)
- ⏳ Performance & error monitoring
- ⏳ Deployment ke GitHub Pages

## Cara Menjalankan

1. Clone repository ini
2. Buka `pages/home.html` di browser
3. Pilih laboratorium, lalu login dengan akun yang sudah terdaftar
4. Untuk akses admin global, buka `index.html`

## Repository

- GitHub: [ManajemenLab](https://github.com/1oneGod1/ManajemenLab)

## Author

**Andi Pandapotan Purba**
- NIM: 0706012324024
- Universitas Ciputra Online Learning, Surabaya
- 2026
