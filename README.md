# Neraca — Game Keseimbangan Bola

Game keseimbangan fisika 2D berbasis React, TypeScript, Tailwind CSS, dan HTML5 Canvas2D.

## Cara Menjalankan di Laptop (Lokal)

Aplikasi ini menggunakan **React + TypeScript + Vite**, jadi **tidak bisa** dijalankan dengan mengklik ganda `index.html` secara langsung. Ikuti langkah berikut setelah `git clone` atau ekstrak ZIP dari GitHub:

1. **Pastikan Node.js sudah terpasang** versi **`20.19+`** atau **`22.12+`** (cek dengan `node -v`).
2. **Install dependensi** (karena `node_modules/` tidak ikut ter-push ke GitHub):
   ```bash
   npm install
   ```
3. **Jalankan server lokal**:
   ```bash
   npm run dev
   ```
4. **Buka di browser**:
   Akses **`http://localhost:3000`** (di Windows, jangan gunakan `http://0.0.0.0:3000`).

## Build Produksi (Opsional)

```bash
npm run build
npm run preview
```

> Catatan: Game ini berjalan sepenuhnya di sisi browser (*client-side*), sehingga tidak memerlukan konfigurasi file `.env` atau API key untuk dimainkan di lokal.
