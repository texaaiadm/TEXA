# 🔥 Panduan Setup Firebase Realtime Database (RTDB)

## ❓ Kenapa RTDB Timeout?

Error `RTDB: FAILED: Timeout` terjadi karena **Realtime Database belum dibuat** di Firebase Console atau **Rules tidak mengizinkan write access**.

---

## ✅ Cara Membuat RTDB di Firebase Console

### **Step 1: Buka Firebase Console**
1. Buka https://console.firebase.google.com
2. Pilih project **texa-ai**

### **Step 2: Buat Realtime Database**
1. Di sidebar kiri, klik **"Realtime Database"**
2. Klik tombol **"Create Database"**
3. **Pilih Location**: 
   - Untuk Indonesia/Asia: Pilih **`asia-southeast1`** (Singapore)
   - Atau gunakan default **`us-central1`**
4. **Security Rules**: Pilih **"Start in test mode"** (untuk development)
5. Klik **"Enable"**

### **Step 3: Setup Database Rules**
Setelah database dibuat, atur rules di tab **"Rules"**:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "permission_test": {
      ".read": true,
      ".write": "auth != null"
    },
    "texa_users": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "texa_sessions": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "texa_online": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "texa_tokens": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### **Step 4: Verifikasi Database URL**
1. Di Firebase Console → Realtime Database
2. Copy **Database URL** yang ditampilkan
3. Pastikan URL sesuai dengan konfigurasi di `firebase.ts`:
   ```
   https://texa-ai-default-rtdb.firebaseio.com
   ```

---

## 🔧 Troubleshooting

### **Problem 1: Timeout Terus**
**Solusi:**
- Pastikan RTDB sudah dibuat di Firebase Console
- Cek region database (gunakan `asia-southeast1` untuk performa lebih baik)
- Cek koneksi internet

### **Problem 2: Permission Denied**
**Solusi:**
- Ubah rules menjadi test mode (seperti di atas)
- Pastikan user sudah login (authenticated)

### **Problem 3: Database URL Salah**
**Solusi:**
- Cek URL di Firebase Console
- Update `databaseURL` di `firebase.ts` jika berbeda

---

## 🎯 Cara Test Koneksi RTDB

1. Login ke aplikasi sebagai admin
2. Buka **Admin Dashboard**
3. Klik tombol **"🛠️ Test Koneksi DB"**
4. Lihat hasilnya:
   - ✅ **Firestore: OK** → Firestore berfungsi
   - ✅ **RTDB: OK** → RTDB berfungsi
   - ❌ **RTDB: FAILED** → Ada masalah (ikuti troubleshooting)

---

## 📝 Catatan Penting

> [!IMPORTANT]
> **RTDB tidak wajib untuk aplikasi berjalan!**
> 
> Aplikasi akan tetap berfungsi dengan Firestore saja. RTDB hanya digunakan untuk:
> - Realtime online status
> - Session tracking
> - Token vault

> [!TIP]
> Jika tidak butuh fitur realtime, Anda bisa **skip setup RTDB** dan aplikasi tetap berjalan normal dengan Firestore.

> [!WARNING]
> Setelah membuat RTDB, tunggu 1-2 menit sebelum test koneksi untuk memastikan database sudah aktif.

---

## 🚀 Quick Fix

Jika ingin **cepat** tanpa setup RTDB:

1. Aplikasi sudah diperbaiki untuk tidak crash jika RTDB tidak ada
2. Fitur-fitur akan fallback ke Firestore only
3. Test koneksi akan menunjukkan RTDB: FAILED tapi aplikasi tetap jalan

**Status sekarang:**
- ✅ Firestore: Berfungsi penuh
- ⚠️ RTDB: Optional (bisa diabaikan untuk development)
