# 🔐 Setup OAuth untuk TEXA-Ai Manager

## Langkah-langkah Membuat OAuth Credentials di Google Cloud Console

### 📋 Prasyarat
- Akun Google
- Akses ke [Google Cloud Console](https://console.cloud.google.com)

---

## Step 1: Buat atau Pilih Project

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Klik dropdown project di header (atas kiri)
3. Klik **"New Project"** atau pilih project yang sudah ada
4. Jika membuat baru:
   - **Project Name**: `TEXA-Ai Manager`
   - Klik **"Create"**

---

## Step 2: Aktifkan APIs

1. Di sidebar kiri, buka **APIs & Services** → **Library**
2. Cari dan aktifkan API berikut:
   - **Google+ API** (atau People API)
   - **Chrome Identity API** (jika tersedia)

---

## Step 3: Konfigurasi OAuth Consent Screen

1. Buka **APIs & Services** → **OAuth consent screen**
2. Pilih **User Type**: 
   - **External** (untuk semua pengguna Google)
   - **Internal** (hanya untuk organisasi, jika menggunakan Google Workspace)
3. Klik **"Create"**
4. Isi informasi:
   - **App name**: `TEXA-Ai Manager`
   - **User support email**: email Anda
   - **Developer contact information**: email Anda
5. Klik **"Save and Continue"**
6. Di bagian **Scopes**, klik **"Add or Remove Scopes"**
7. Tambahkan scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
8. Klik **"Save and Continue"**
9. Di bagian **Test Users**, tambahkan email pengguna yang akan menguji
10. Klik **"Save and Continue"**

---

## Step 4: Buat OAuth Client ID

1. Buka **APIs & Services** → **Credentials**
2. Klik **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Pilih **Application type**: **Chrome Extension**
4. Isi informasi:
   - **Name**: `TEXA Extension OAuth`
   - **Application ID**: (dapatkan dari langkah berikutnya)

### 🔍 Cara Mendapatkan Extension ID:

1. Buka Chrome → `chrome://extensions/`
2. Aktifkan **Developer mode** (toggle di pojok kanan atas)
3. Load extension Anda (jika belum)
4. Extension ID terlihat di bawah nama extension
   - Contoh: `abcdefghijklmnopqrstuvwxyzabcdef`

5. Masukkan **Application ID** (Extension ID) tersebut
6. Klik **"Create"**

---

## Step 5: Salin Client ID

Setelah OAuth Client dibuat, Anda akan melihat dialog dengan:
- **Client ID**: `123456789-xxxxx.apps.googleusercontent.com`
- **Client Secret**: (tidak diperlukan untuk Chrome extension)

**⚠️ PENTING**: Salin **Client ID** tersebut!

---

## Step 6: Update manifest.json

Buka file `extension/manifest.json` dan ganti placeholder:

```json
"oauth2": {
  "client_id": "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

Ganti `YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com` dengan Client ID yang Anda salin.

**Contoh setelah diganti:**
```json
"oauth2": {
  "client_id": "123456789-abcdefg.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

---

## Step 7: Reload Extension

1. Buka `chrome://extensions/`
2. Klik tombol **Reload** pada TEXA-Ai Manager
3. Buka popup extension dan uji login

---

## 🧪 Testing

Setelah setup, extension akan:
1. Mencoba **silent authentication** terlebih dahulu
2. Jika gagal, akan menampilkan **popup kecil** untuk pilih akun Google
3. User memilih akun → token didapatkan → popup tertutup otomatis

---

## ❓ Troubleshooting

### Error: "OAuth client was deleted"
- Pastikan OAuth client masih ada di Google Cloud Console

### Error: "Access blocked: This app's request is invalid"
- Pastikan Extension ID di OAuth client cocok dengan ID extension Anda
- Jika ID berubah, update di Google Cloud Console

### Error: "Authorization Error"
- Pastikan scopes di manifest.json cocok dengan yang ditambahkan di consent screen

### Token tidak didapat
- Pastikan user sudah login ke Google di browser
- Coba dengan akun yang ditambahkan sebagai Test User

---

## 📝 Notes

- Untuk **development**, OAuth akan bekerja dengan batasan (100 test users)
- Untuk **production**, perlu memverifikasi aplikasi dengan Google
- Proses verifikasi memerlukan review dari Google (bisa memakan waktu beberapa hari/minggu)

---

## 🔗 Links

- [Google Cloud Console](https://console.cloud.google.com)
- [Chrome Identity API Docs](https://developer.chrome.com/docs/extensions/reference/identity/)
- [OAuth 2.0 for Chrome Extensions](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/)
