# LabFlow Pro - Sistem Manajemen Laboratorium Berbasis Cloud (Firebase)

Sistem Manajemen Laboratorium Terpadu adalah platform berbasis web untuk mengelola fasilitas laboratorium secara terpusat di berbagai jenis laboratorium dengan memanfaatkan teknologi Google Firebase sebagai Backend as a Service (BaaS).

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
- Menginput laporan kerusakan pada alat tertentu
- Menyimpan detail deskripsi masalah/kerusakan
- Memantau status perbaikan: Belum Diperbaiki, Sedang Diperbaiki, Selesai
- Melacak riwayat kerusakan dan perbaikan

### C. Unggah Dokumentasi (Cloud Storage Integration)
- Mengunggah foto bukti kerusakan alat ke Firebase Storage
- Mengunggah foto dokumentasi fasilitas baru
- Menyimpan URL dokumen visual ke Firebase Realtime Database
- Akses file melalui link publik yang aman

### D. Sinkronisasi Data Real-Time
- Semua data otomatis diperbarui di layar pengguna tanpa reload halaman
- Pemantauan kondisi inventaris laboratorium secara langsung dan terkini
- Kolaborasi multi-pengguna dengan data yang selalu konsisten

## Teknologi & Cloud Services

### Frontend
- HTML5
- CSS3 (dengan Inter font dari Google Fonts)
- Vanilla JavaScript (ES6+)

### Backend (Google Firebase - BaaS)
- **Firebase Realtime Database**: NoSQL database untuk menyimpan data fasilitas dan laporan kerusakan dengan sinkronisasi real-time
- **Firebase Storage**: Object storage untuk menyimpan file gambar (foto kerusakan, dokumentasi alat)
- **Firebase SDK**: Penghubung antara frontend dan layanan Firebase

### State Management
- LocalStorage untuk pengaturan user
- Real-time listeners untuk data dari Firebase

## Struktur Proyek (Phase 1 - UI)

```
/
├── index.html              # Halaman utama (dashboard + reports)
├── pages/
│   ├── login.html          # Halaman login
│   └── dashboard.html      # Dashboard lab spesifik
├── assets/
│   ├── css/
│   │   ├── style.css       # CSS untuk index.html
│   │   ├── login.css       # CSS untuk login.html
│   │   └── dashboard.css   # CSS untuk dashboard.html
│   └── js/
│       ├── app.js          # Logika untuk index.html
│       ├── login.js        # Logika untuk login.html
│       └── dashboard.js    # Logika untuk dashboard.html
└── README.md
```

## Alur Kerja Sistem

1. Pengguna mengakses antarmuka website melalui peramban web (browser)
2. Pengguna login menggunakan kredensial per laboratorium
3. Pengguna memasukkan data melalui formulir (fasilitas baru atau laporan kerusakan)
4. Apabila ada lampiran gambar, file diunggah terlebih dahulu ke Firebase Storage
5. Data teks (beserta URL gambar jika ada) dikirimkan melalui Firebase SDK dan disimpan ke Firebase Realtime Database
6. Antarmuka website secara otomatis merender dan menampilkan data terbaru kepada pengguna secara real-time

## Struktur Data Firebase (JSON Format)

```json
{
  "fasilitas": {
    "item_01": {
      "nama": "Komputer Dell",
      "jumlah": 20,
      "kondisi": "Baik",
      "lab_id": "lab_komputer",
      "foto_url": "https://firebasestorage.googleapis.com/..."
    }
  },
  "laporan": {
    "report_01": {
      "item_id": "item_01",
      "masalah": "Monitor tidak menyala",
      "status": "Belum diperbaiki",
      "foto_url": "https://firebasestorage.googleapis.com/..."
    }
  }
}
```

## Kredensial Login (Demo - Phase 1)

- **Computer Lab**: budi@labflow.id / komputer123
- **Physics Lab**: sari@labflow.id / fisika123
- **Chemistry Lab**: andi@labflow.id / kimia123
- **Biology Lab**: rita@labflow.id / biologi123

## Roadmap Pengembangan

### Phase 1: UI/UX ✅ (COMPLETED)
- ✅ Desain responsive interface
- ✅ Implementasi halaman login dan dashboard
- ✅ Struktur CRUD operations UI
- ✅ Settings dan user management UI
- ✅ Professional icon dan design system

### Phase 2: Firebase Integration (IN PROGRESS)
- ⏳ Integrasi Firebase Realtime Database
- ⏳ Integrasi Firebase Storage untuk upload gambar
- ⏳ Implementasi real-time data listeners
- ⏳ Setup authentication dengan Firebase

### Phase 3: Production Ready
- ⏳ Testing & optimization
- ⏳ Security rules untuk Firebase
- ⏳ Performance monitoring
- ⏳ Deployment ke hosting

## Cara Menjalankan (Phase 1 - Local Development)

1. Clone repository ini
2. Buka `index.html` di browser web
3. Pilih laboratorium dari sidebar
4. Masukkan kredensial yang sesuai

## Repository

- 🔗 GitHub: [ManajemenLab](https://github.com/1oneGod1/ManajemenLab)
- Branch `main`: UI/UX completion (Phase 1)
- Branch `initial-ui-development`: Development branch

## Author

**Andi Pandapotan Purba**
- NIM: 0706012324024
- Universitas Ciputra Online Learning, Surabaya
- 2026