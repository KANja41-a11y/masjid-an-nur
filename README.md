# An-Nur Masjid Digital Display 🕌✨

Static HTML/CSS/JS app designed for GitHub Pages.

## Fitur
- Jadwal salat berbasis koordinat perangkat (Browser Geolocation)
- Fallback lokasi Bojonggede, Bogor
- Metode perhitungan Kementerian Agama RI via AlAdhan API
- Countdown ke waktu salat terdekat
- Jam WIB + tanggal Indonesia
- Highlight salat berikutnya
- Hijri date
- Arah kiblat
- Pengumuman otomatis
- Agenda masjid
- Running text
- Fullscreen
- Pengaturan tersimpan di localStorage
- Responsive / fluid UI
- No framework / build process

## Struktur
- `index.html`
- `style.css`
- `app.js`
- `assets/`
- `config.json`

## Deploy GitHub Pages
1. Upload semua file ke repository GitHub.
2. Settings → Pages.
3. Source: Deploy from a branch.
4. Pilih `main` + `/root`.
5. Buka URL Pages dengan HTTPS.
6. Izinkan Location agar jadwal memakai koordinat perangkat.

## Catatan akurasi
Aplikasi menggunakan koordinat browser bila izin lokasi diberikan. Untuk Indonesia, kalkulasi memakai metode Kementerian Agama RI pada AlAdhan API. Jadwal masjid tetap sebaiknya diverifikasi dengan jadwal resmi takmir/Kemenag setempat sebelum dipakai sebagai sumber tunggal untuk azan/iqamah.
