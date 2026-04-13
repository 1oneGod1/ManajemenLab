# LabFlow Pro - Sistem Manajemen Laboratorium

Sistem manajemen laboratorium terintegrasi untuk melacak fasilitas, inventori, dan laporan kerusakan.

## Struktur Proyek

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
│       ├── data.js         # Data bersama dan utility functions
│       ├── app.js          # Logika untuk index.html
│       ├── login.js        # Logika untuk login.html
│       └── dashboard.js    # Logika untuk dashboard.html
└── README.md
```

## Fitur

- **Dashboard Utama**: Ringkasan semua lab dengan statistik dan aktivitas terkini
- **Manajemen Fasilitas**: Tambah, edit, dan lihat detail fasilitas per lab
- **Laporan Kerusakan**: Sistem pelaporan dan tracking kerusakan peralatan
- **Autentikasi**: Login per lab dengan kredensial guru
- **Dashboard Lab**: Tampilan khusus untuk lab tertentu

## Cara Menjalankan

1. Buka `index.html` di browser web
2. Pilih lab dari sidebar untuk login
3. Masukkan kredensial yang sesuai dengan lab

### Kredensial Login

- **Computer Lab**: budi@labflow.id / komputer123
- **Physics Lab**: sari@labflow.id / fisika123
- **Chemistry Lab**: andi@labflow.id / kimia123
- **Biology Lab**: rita@labflow.id / biologi123

## Teknologi

- HTML5
- CSS3 (dengan Inter font dari Google Fonts)
- Vanilla JavaScript (ES6+)
- Session Storage untuk state management

## Arsitektur

Proyek ini menggunakan arsitektur web sederhana dengan pemisahan yang jelas antara:
- **Presentation**: HTML untuk struktur
- **Styling**: CSS untuk tampilan
- **Logic**: JavaScript untuk interaktivitas
- **Data**: Objek JavaScript untuk penyimpanan data (bisa diganti dengan database nanti)

## Pengembangan Lanjutan

- Tambahkan backend API untuk persistensi data
- Implementasi autentikasi yang lebih aman
- Tambahkan fitur notifikasi real-time
- Integrasi dengan sistem inventory eksternal