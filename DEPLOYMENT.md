# Panduan Konfigurasi & Deployment — LOUIS BRIDES PILIH FOTO V1

Dokumen ini menjelaskan langkah lengkap menghubungkan **Google Sheets**, **Google Drive**, **Google Apps Script**, dan **Cloudflare Pages** agar aplikasi **LOUIS BRIDES PHOTO** beroperasi penuh secara publik.

---

## 1. Persiapan Google Drive & Google Sheets

1. Buka Google Drive menggunakan akun pemilik studio (`andre.louisbrides@gmail.com`).
2. Pastikan folder induk **`LOUIS BRIDES CLIENT DATA`** sudah tersedia dan catat **Folder ID**-nya (contoh: `1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF`).
3. Buat sebuah **Google Spreadsheet** baru bernama `LOUIS BRIDES DATABASE`, lalu catat **Spreadsheet ID** dari URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

---

## 2. Deployment Google Apps Script (`gas/Code.gs`)

1. Dari Google Spreadsheet tersebut, klik **Extensions → Apps Script** (atau buka `https://script.google.com`).
2. Hapus kode bawaan dan salin seluruh isi file `gas/Code.gs` (juga tersedia langsung untuk disalin di menu **Admin Studio → Pengaturan → Kode Apps Script**).
3. Buka **Project Settings (ikon gerigi) → Script Properties**, tambahkan:
   - `SPREADSHEET_ID`: `<ID Spreadsheet Anda>`
   - `DRIVE_ROOT_FOLDER_ID`: `1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF`
4. Pilih fungsi `initDatabase` di toolbar atas lalu klik **Run** untuk membuat 8 tab database secara otomatis (`PENGANTIN`, `KELUARGA`, `PILIHAN_FOTO`, `DETAIL_PILIHAN`, `FEEDBACK`, `PENGATURAN`, `MARKETING`, `LOG_AKTIVITAS`).
5. Klik **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me (Pemilik Studio)**
   - Who has access: **Anyone**
6. Salin **Web App URL** (`https://script.google.com/macros/s/.../exec`).

---

## 3. Menghubungkan di Aplikasi

1. Buka aplikasi **LOUIS BRIDES PILIH FOTO V1** lalu masuk ke `/admin`.
2. Login menggunakan PIN Admin (default awal: `202601`, segera ubah di menu Pengaturan → Akun & Keamanan).
3. Buka menu **Pengaturan**, isi:
   - **Google Apps Script Web App URL**
   - **Spreadsheet ID**
   - **Google Drive Root Folder ID** (`1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF`)
4. Klik **Simpan Pengaturan**, lalu klik **TEST KONEKSI** untuk memverifikasi status **TERHUBUNG** pada Backend Aplikasi, Google Apps Script, Google Sheets, dan Google Drive.

---

## 4. Deployment ke Cloudflare Pages

1. Push source code ke repository GitHub.
2. Buka **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Konfigurasi Build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
4. Tambahkan **Environment Variables** pada Cloudflare Pages (Production & Preview):
   - `GAS_WEBAPP_URL` = `<URL Web App Google Apps Script>`
   - `SPREADSHEET_ID` = `<ID Spreadsheet>`
   - `DRIVE_ROOT_FOLDER_ID` = `1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF`
   - `ADMIN_DEFAULT_PIN` = `<PIN Admin pilihan Anda>`
   - `SESSION_SECRET` = `<String acak panjang untuk keamanan sesi>`
   - `APP_URL` = `<URL publik domain Cloudflare Pages Anda, opsional>`
5. File `public/_redirects` (`/* /index.html 200`) sudah disertakan dan otomatis disalin ke `dist/_redirects` saat build agar rute `/`, `/admin`, dan `/c/:customerCode` dapat dibuka langsung dari HP, Chrome, maupun mode Incognito tanpa error 404.
6. Endpoint API `/api/*` otomatis berjalan di Cloudflare Pages Functions (`functions/api/[[path]].ts`) tanpa memerlukan server Node.js terpisah.
