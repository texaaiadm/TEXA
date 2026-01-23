
# TEXA-Ai Manager Extension

Ekstensi ini berfungsi sebagai jembatan antara dashboard TEXA dan browser Anda.

## Fitur Utama

1.  **Open Tools**: Membuka tool dari dashboard dengan injeksi cookie otomatis.
2.  **Cookie Injection**: Mengambil data cookie dari API URL yang ditentukan (mendukung format JSON Array atau dokumen Firestore).

## Cara Kerja

1.  Klik "Open Tools" di dashboard.
2.  Dashboard mengirim pesan ke ekstensi dengan `targetUrl` dan `apiUrl`.
3.  Ekstensi mengambil data dari `apiUrl`.
4.  Ekstensi menyuntikkan cookie ke domain target.
5.  Ekstensi membuka tab baru ke `targetUrl`.

## Format Data API

Ekstensi mendukung dua format respons dari `apiUrl`:

### 1. JSON Array Standar
```json
[
  {
    "name": "session_id",
    "value": "xyz123",
    "domain": ".example.com",
    "path": "/",
    "secure": true,
    "httpOnly": true
  }
]
```

### 2. Firestore Document (REST API)
Jika Anda menggunakan URL Firestore langsung (`firestore.googleapis.com/...`), ekstensi akan mencari field yang berisi string JSON array cookies.
Contoh Field Firestore: `stringValue: "[{...}, {...}]"`

## Instalasi

1.  Buka `chrome://extensions/`.
2.  Aktifkan "Developer mode" (pojok kanan atas).
3.  Klik "Load unpacked".
4.  Pilih folder `extension` ini.

## Troubleshooting

-   **Tombol Open Tools tidak merespons**: Pastikan ekstensi aktif dan Anda telah merefresh halaman dashboard setelah instalasi.
-   **Cookie tidak masuk**: Cek konsol ekstensi (Background page) untuk melihat log error. Pastikan format JSON cookie benar.
