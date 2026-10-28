# Listra

[English](README.md) | [Bahasa Indonesia](README.id.md)

Listra adalah ekstensi Spicetify yang menyinkronkan pemutaran lagu Spotify secara *real-time* antar-teman. Sistem ini menggabungkan ekstensi Spicetify dan layanan background daemon untuk mengontrol playback serta menampilkan tombol gabung langsung di profil Discord.

## Fitur

- Menampilkan tombol gabung yang bisa diklik di profil Discord lewat Discord Rich Presence.
- Menyelaraskan playback langsung via peer-to-peer WebRTC UDP data channel.
- Mengestimasi selisih jam perangkat memakai algoritma SNTP agar aksi putar dan *seek* dieksekusi tepat pada timestamp yang sama.
- Menangani *audio drift* antar sound card tanpa lompatan suara (skip) atau bunyi *pop*.
- Berfungsi untuk akun Spotify gratis maupun Premium di desktop via Spicetify (catatan: tidak berfungsi pada Spotify biasa tanpa Spicetify).
- Musik tetap berjalan saat sedang di voice call Discord tanpa terhenti otomatis setelah 30 detik.

## Tutorial

### Pemasangan

> [!IMPORTANT]
> Listra memerlukan aplikasi desktop Spotify resmi yang telah dipasang [Spicetify](https://spicetify.app). Listra **tidak dapat berjalan pada Spotify biasa** (client standar tanpa Spicetify, versi Microsoft Store, maupun web/mobile player). Skrip pemasangan satu baris di bawah ini akan mengurus pemasangan Spicetify dan ekstensi Listra secara otomatis.

Host maupun pendengar dapat memasang Listra hanya dengan satu perintah PowerShell tanpa perlu clone repositori Git atau kompilasi manual:

```powershell
irm https://raw.githubusercontent.com/Jemyryuu/listra/main/install.ps1 | iex
```

Skrip ini akan otomatis:
1. Memasang Spicetify CLI jika belum tersedia di sistem.
2. Memasang Node.js LTS secara senyap lewat winget jika belum terpasang (diperlukan untuk host dengan Discord Rich Presence).
3. Mengunduh bundle ekstensi `listra.js` ke folder extensions Spicetify.
4. Mengunduh file daemon `daemon.js` mandiri ke `%LOCALAPPDATA%\listra\`.
5. Mendaftarkan skema protokol `listra://` di Windows registry agar daemon dapat berjalan otomatis di latar belakang.
6. Menambahkan perintah `listra` ke PATH sistem pengguna.
7. Menghapus konfigurasi lama `listen-together.js` dan mengaktifkan `listra.js` di Spotify via `spicetify apply`.

Restart aplikasi Spotify (yang telah diterapkan Spicetify) setelah pemasangan selesai.

### Menjalankan Listra

- **Untuk Host**: Buka Spotify, klik ikon **Listra**, lalu klik **Start Hosting Party**. Spotify akan otomatis menyalakan background daemon tanpa perlu buka terminal.
- **Untuk Bergabung**: Klik tombol profil Discord teman, buka tautan undangan, atau masukkan 6 huruf kode room di menu Listra.
- **Perintah Terminal (Opsional)**: Anda juga bisa menyalakan daemon secara manual kapan saja dengan mengetik:
  ```powershell
  listra
  ```

---

## Pengembangan (Development)

Jika Anda ingin mengubah kode sumber dari repositori:

1. Build bundle ekstensi dan daemon:
   ```powershell
   npm run build
   ```
2. Terapkan ekstensi ke client Spotify lokal:
   ```powershell
   npm run apply:extension
   ```
3. Daftarkan handler protokol dari direktori pengembangan:
   ```powershell
   npm run register:protocol
   ```
4. Jalankan daemon:
   ```powershell
   npm run start:daemon
   ```

## Deployment Cloudflare

Deploy landing page statis ke Cloudflare Pages:
```powershell
npm run deploy:web
```

Deploy signaling worker WebRTC:
```powershell
npm run deploy:signaling
```

## Konfigurasi

Atur environment variable berikut sebelum menjalankan daemon jika ingin menggunakan Discord Application ID atau domain landing page kustom:

```powershell
$env:DISCORD_CLIENT_ID = "YOUR_DISCORD_APP_ID"
$env:JOIN_BASE_URL = "https://your-custom-pages-domain.com/join"
npm run start:daemon
```
