# DroneHarvest — RPG pixel 2D alam–industrial

## Identitas dan batas tahap ini

Dunia RPG menjadi tampilan utama: eksplorasi zona, farming, pengumpulan sumber daya, dan perkembangan machinery. Kontrak merupakan kegiatan pendukung yang tersedia melalui Jurnal.

Tahap ini mengoreksi visual dan penyajian UI. Pembangunan mesin bebas di grid, peningkatan machinery baru, dan otomasi berbasis UI tanpa skrip adalah arah tahap selanjutnya. Sistem kode drone yang sudah ada tetap tersedia melalui Menu → Kode lanjutan.

## Sistem seni pixel

- Tile dan karakter asli 32×32. Pemain memiliki 16 frame: empat arah, empat frame per arah; indeks frame tetap kompatibel.
- Semua gambar dunia dan ikon dihasilkan dari buffer RGBA berkoordinat integer. Tidak ada kurva vector, resampling, atau antialiasing dalam sumber sprite.
- Setiap frame maksimal empat warna dan alpha hanya 0/255, dari palet bersama: `#101a21`, `#22343c`, `#42535b`, `#93a7a1`, `#edf0d4`, `#a4b18b`, `#244c3a`, `#4a7c59`, `#9b794e`, `#e3ba83`, `#63d8d1`, `#e9bf62`.
- Tile, tanaman, drone, NPC, gudang, pasar, conveyor, gerbang, dan ikon memakai bahasa visual yang sama. Ikon DOM dan Phaser berasal dari atlas item yang sama; ikon objek berbentuk emoji telah diganti.
- Mesin dibedakan lewat bentuk penggiling, oven, tangki, press, tungku, dan lengan perakitan. Indikator kotak membaca status simulasi yang sudah ada: menunggu bahan, bekerja, atau hasil siap.
- Efek kerja berupa partikel kotak. Preferensi reduced motion menonaktifkan animasi dekoratif dan partikel kerja.

## Peta, HUD, dan panel

- Permainan langsung membuka peta, tanpa sidebar permanen atau header bergaya website.
- HUD ringkas menampilkan zona, saldo, status armada, dan hotbar. Tiga akses utama adalah Tas, Jurnal, dan Menu.
- Menu memuat Armada drone, Profil, Panduan, Ponsel, dan Kode lanjutan. Jurnal memuat kontrak dan laporan Operasi yang sudah ada.
- Koordinator panel menjaga satu panel utama terbuka, menjebak fokus keyboard di dalamnya, memblokir input dunia ketika panel terbuka, dan mengembalikan fokus saat Escape atau tombol Tutup digunakan.
- Inspector mesin memisahkan gambar, status, progres, bahan masuk, hasil, dan resep. Pasar mempertahankan API pembelian/penjualan yang sudah ada.
- Bingkai UI berbentuk siku dengan aksen cyan/amber, tanpa blur atau sudut kartu membulat. Judul memakai font pixel dan isi memakai monospace yang terbaca. Monaco mempertahankan font kode.
- Target tombol minimal 44px. Hotbar menjadi empat kolom × dua baris jika lebar render kurang dari 384px.

## Rendering dan kompatibilitas

Skala CSS adalah 2× pada viewport desktop mulai 1024px dan 1× pada ukuran lebih kecil. Ukuran logis mengikuti ruang tersedia dalam kelipatan 32, maksimal 640×480. Sisa ruang menjadi letterbox. Canvas, HUD, dan hotbar mengikuti ukuran aktual setelah resize; peta, collision, dan koordinat tile tidak berubah.

Tidak ada migrasi save atau perubahan resep, biaya, hasil, kapasitas, maupun persyaratan zona. Nama tekstur dan indeks animasi tetap tersedia. Penyimpanan kontrak, gudang, hotbar, serta perbaikan harga dan estimasi sebelumnya dipertahankan.

## Pengujian

`npm test` mencakup logika kontrak sebelumnya dan pemeriksaan sumber pixel: batas palet, jumlah warna per frame, alpha biner, karakter 32px/16 frame, atlas bersama, penolakan koordinat pecahan, integer scaling pada lima lebar, serta target hotbar 44px.

Fixture browser di `tests/visual-fixtures.html` menguji inspector dan pasar dengan inventaris terpisah yang tidak membaca atau menulis save pemain. Alur yang diperiksa: deposit 2 gandum → proses → ambil 1 tepung, beli benih 5g, jual tepung 35g, dan pemulihan fokus melalui Escape.

Pemeriksaan visual dilakukan pada lebar 320, 390, 768, 1024, dan 1440px, termasuk menu, Jurnal, dan editor. Build produksi masih menampilkan peringatan ukuran bundel Monaco/Phaser dan externalisasi `vm` dari js-interpreter. Integrasi cloud memerlukan konfigurasi layanan dan tidak termasuk validasi lokal ini.

## Tahap berikutnya

Fokus berikutnya adalah bangun machinery bebas di grid dan pengaturan prioritas produksi melalui UI. Perkembangan idealnya membuka kemampuan yang terlihat: alat kerja alami → mesin dasar → pengolahan bertingkat → logistik → lini produksi yang dapat ditata pemain. Kontrak memberikan tujuan tambahan; pertumbuhan pabrik menjadi progres utama.
