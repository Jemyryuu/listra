# Listra

[English](README.md) | [Bahasa Indonesia](README.id.md)

Listra menyinkronkan pemutaran lagu di Spotify secara *real-time* antar-teman. Sistem ini menggabungkan ekstensi Spicetify dan layanan background daemon untuk mengontrol playback serta menampilkan tombol gabung langsung di profil Discord.

## Fitur

- Menampilkan tombol gabung yang bisa diklik di profil Discord lewat Discord Rich Presence.
- Menyelaraskan playback langsung via peer-to-peer WebRTC UDP data channel.
- Mengestimasi selisih jam perangkat memakai algoritma SNTP agar aksi putar dan *seek* dieksekusi tepat pada timestamp yang sama.
- Menangani *audio drift* antar sound card tanpa lompatan suara (skip) atau bunyi *pop*.
- Berfungsi untuk akun Spotify gratis maupun Premium di desktop karena kontrol playback berjalan langsung di dalam aplikasi client.
- Musik tetap berjalan saat sedang di voice call Discord tanpa terhenti otomatis setelah 30 detik.

## Instalasi

### Untuk Teman / Pendengar
Teman yang hanya ingin ikut mendengarkan tidak memerlukan Git, Node.js, atau build tools. Jalankan perintah ini di Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Jemyryuu/listra/main/install.ps1 | iex
```

Skrip ini akan otomatis:
1. Memasang Spicetify CLI jika belum tersedia di sistem.
2. Mengunduh bundle `listen-together.js` siap pakai ke direktori extensions Spicetify.
3. Mendaftarkan protokol `listentogether://` ke registry pengguna.
4. Menjalankan `spicetify apply` untuk mengaktifkan ekstensi di Spotify.

Restart aplikasi Spotify setelah pemasangan selesai.

### Untuk Host (Menjalankan Daemon)

1. Daftarkan URL protocol handler:
   ```powershell
   npm run register:protocol
   ```
2. Build dan pasang ekstensi Spicetify:
   ```powershell
   npm run apply:extension
   ```
3. Jalankan daemon pendamping:
   ```powershell
   npm run start:daemon
   ```

Daemon akan terhubung ke aplikasi Discord melalui `\\.\pipe\discord-ipc-0` dan mendengarkan redirect peramban di `http://127.0.0.1:8989`.

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

Atur environment variable berikut sebelum menjalankan daemon jika ingin menggunakan Discord Application ID atau domain landing page sendiri:

```powershell
$env:DISCORD_CLIENT_ID = "DISCORD_APP_ID_ANDA"
$env:JOIN_BASE_URL = "https://domain-pages-anda.com/join"
npm run start:daemon
```
