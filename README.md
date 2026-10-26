# Petualangan Ujian v2 — Pilihan Ganda + Essay, Offline, Dinilai AI
**Ubah atau naikan versi di "sw.js" misalnya const VERSI = 'ue2-v2'; menjadi const VERSI = 'ue2-v3';**

Aplikasi ujian bergaya game 2D yang bisa dikerjakan **tanpa internet**.

- Soal, siswa, dan token disimpan di Google Spreadsheet.
- **Pilihan ganda** dinilai otomatis begitu jawaban terkirim.
- **Essay** dinilai AI (Gemini atau Claude).
- Rumus matematika ditulis dengan **MathJax/LaTeX**.
- Guru memantau ujian secara langsung dan mencetak **laporan PDF**.

## Yang baru (pembaruan Oktober 2026 — Code.gs 3.0, web v2.2.0)

| Fitur | Keterangan |
|---|---|
| Penanda nomor soal | Telur di layar ujian diganti **nomor soal**: hijau = sudah dijawab, bening = belum, oranye = ragu, merah = terkunci. Pada mode `TIMER` nomor bisa diketuk untuk pindah soal. |
| Info peserta di atas | Bilah atas ujian menampilkan **nama peserta · kelas · nama ujian**, posisi **Soal x/y**, dan jumlah **dijawab / belum**. |
| Kolom `TUJUAN_PEMBELAJARAN` | Kolom paling akhir di `SOAL_PG` dan `SOAL_ESSAY`. Bisa diisi di spreadsheet atau lewat menu **Bank Soal** (juga ikut import CSV). |
| Dashboard guru formal | Tampilan baru: header resmi, menu samping berkelompok, tabel & kartu bergaya profesional, tanpa efek suara. |
| **Rekap & Export** (menu baru) | Excel (.xlsx) & PDF: rekap hasil per mapel & kelas (filter kelas/mapel/ujian), daftar Tujuan Pembelajaran per mapel, analisis butir soal. |
| Perbaikan | Token pemulihan & maks pelanggaran kini benar-benar terunduh ke HP siswa; `kuis.html` & `Cetak_Kartu.html` ikut tersimpan untuk offline. |

### Cara upgrade
1. **Apps Script:** ganti seluruh isi `Code.gs` dengan `apps-script/Code.gs` (isi `CodeGS.txt` sama persis), simpan, lalu jalankan **`setupSpreadsheet`** sekali. Kolom `TUJUAN_PEMBELAJARAN` otomatis ditambahkan di ujung kanan `SOAL_PG` & `SOAL_ESSAY` tanpa menggeser data. Lalu **Kelola deployment → Edit → Versi baru → Terapkan** (URL tetap).
2. **GitHub:** timpa semua file website (termasuk file baru `assets/guru.css`, `assets/rekap.js`, `assets/ekspor.js`). `VERSI` di `sw.js` sudah dinaikkan ke `ue2-v6-auto`.
3. Isi kolom `TUJUAN_PEMBELAJARAN` setiap soal. Soal dengan teks TP yang sama dihitung sebagai satu TP. Boleh diawali kode sendiri, misalnya `TP 1.2: Menjelaskan perbedaan suhu dan kalor` — kode itu yang dipakai di laporan. Tanpa kode, TP diberi kode otomatis `TP1`, `TP2`, … per mata pelajaran.

## Yang baru di versi 2

| Fitur | Keterangan |
|---|---|
| Soal pilihan ganda | Sheet terpisah `SOAL_PG`, opsi A–E, kunci tidak pernah dikirim ke HP. Bisa diacak urutan opsinya. |
| 3 mode timer | `TIMER`, `TIMERSOAL`, `TIMERFIXED` (lihat penjelasan di bawah). |
| Navigasi bebas (mode TIMER) | Tombol kembali, tandai **ragu-ragu**, dan daftar nomor soal. |
| Dashboard: Siswa & HP | Siswa yang sudah/belum login, HP mana yang dipakai, HP yang sudah mengunduh data, dan jawaban yang masih tertahan di HP. |
| Laporan PDF | Rekap satu ujian, lembar jawaban per siswa, rekap per kelas, rekap per mapel, dan riwayat nilai satu siswa. Lengkap dengan KKM, peringkat, dan tanda tangan. |
| Nilai PG & essay terpisah | Ada di dashboard, CSV, dan laporan. |

---

## Isi folder

```
ujian-v2/
├── index.html        ← aplikasi siswa
├── guru.html         ← dashboard guru
├── config.js         ← SATU-SATUNYA file yang perlu diubah (URL API)
├── sw.js             ← agar aplikasi jalan offline
├── manifest.json     ← agar bisa dipasang di layar utama HP
├── assets/           ← tampilan, logika, laporan, maskot, ikon
└── apps-script/
    └── Code.gs       ← backend, ditempel ke Google Apps Script (tidak perlu di GitHub)
```

---

## A. Pemasangan baru

### 1. Spreadsheet + Apps Script
1. Buat spreadsheet baru di [sheets.new](https://sheets.new), misalnya beri nama **UJIAN SEKOLAH**.
2. Buka menu **Ekstensi → Apps Script**. Hapus isi `Code.gs` bawaan, lalu tempel seluruh isi `apps-script/Code.gs`. Klik 💾 Simpan.
3. Pilih fungsi **`setupSpreadsheet`**, lalu klik **Jalankan**. Berikan izin: **Tinjau izin → pilih akun → Lanjutan → Buka (tidak aman) → Izinkan**.
4. Kembali ke spreadsheet dan muat ulang halaman. Menu **🎯 Ujian** akan muncul, beserta sheet berisi contoh: 2 ujian, 6 soal PG, 3 soal essay, 5 siswa.

### 2. API key AI (untuk menilai essay)
1. Di sheet `PENGATURAN`, isi `AI_PROVIDER` dan `AI_MODEL`:
   - Gemini (gratis): `gemini` dan `gemini-2.5-flash`. Buat key di [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   - Claude: `claude` dan `claude-haiku-4-5-20251001`. Buat key di [platform.claude.com](https://platform.claude.com).
2. Pilih **🎯 Ujian → 2. Atur API Key AI**, tempel key, lalu klik OK. Cek dengan **🎯 Ujian → Tes koneksi AI**.
3. Pilih **🎯 Ujian → 3. Aktifkan Penilaian Otomatis**.

> Jika menu tidak bisa dipakai, simpan key lewat Apps Script → ⚙️ Setelan Project → Properti skrip → tambah `API_KEY_GEMINI` (atau `API_KEY_CLAUDE`) berisi key Anda.

### 3. Terbitkan Web App
1. Di Apps Script pilih **Terapkan → Deployment baru → ⚙️ Aplikasi web**.
2. Isi **Jalankan sebagai: Saya**, lalu **Yang memiliki akses: Siapa saja**. Klik **Terapkan**.
3. Salin URL yang berakhiran `/exec`. Uji dengan membukanya di browser; harus muncul `"API Petualangan Ujian v2 aktif"`.

### 4. Isi `config.js`
```js
API_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
```

### 5. Upload ke GitHub
1. Buat repository baru di [github.com/new](https://github.com/new) (Public).
2. Pilih **uploading an existing file**, lalu seret **isi** folder (`index.html`, `guru.html`, `config.js`, `sw.js`, `manifest.json`, folder `assets`). Klik **Commit changes**.
3. Buka **Settings → Pages → Deploy from a branch → main / (root) → Save**. Tunggu 1–2 menit.
4. Alamat aplikasinya:
   - Siswa: `https://NAMAUSER.github.io/NAMAREPO/`
   - Guru: `https://NAMAUSER.github.io/NAMAREPO/guru.html`

---

## B. Upgrade dari versi 1

1. **Spreadsheet:** buka Apps Script, ganti seluruh isi `Code.gs` dengan versi 2, simpan, lalu jalankan **`setupSpreadsheet`** sekali lagi. Yang terjadi otomatis:
   - Sheet `SOAL` berganti nama menjadi `SOAL_ESSAY`.
   - Sheet `SOAL_PG`, `PERANGKAT`, dan `LOGIN_LOG` dibuat.
   - Kolom baru ditambahkan ke `PAKET` (`DURASI_MENIT`, `ACAK_OPSI`) dan pengaturan baru ke `PENGATURAN`.
   - Sheet `HASIL`/`JAWABAN`/`PROGRESS` lama yang sudah berisi data diarsipkan (misal `HASIL_v1_20261005`), lalu dibuat baru dengan format v2. Data lama tetap aman di arsip.
2. **Deployment:** Terapkan → **Kelola deployment** → ✏️ Edit → Versi: **Versi baru** → Terapkan. URL tetap sama, jadi `config.js` tidak perlu diubah.
3. **Mode timer lama:** periksa kolom `MODE_TIMER` di `PAKET`. `KUNCI` dibaca sebagai `TIMERFIXED` dan `BEBAS` sebagai `TIMERSOAL`. Ganti sesuai keinginan Anda.
4. **GitHub:** timpa semua file website dengan versi 2. Isi `API_URL` di `config.js` dengan URL lama Anda.
5. **HP siswa:** cukup buka aplikasinya saat online. Data versi 1 di HP otomatis diminta untuk diunduh ulang.

> Selesaikan dan kirim semua ujian versi 1 yang sedang berjalan **sebelum** upgrade.

---

## C. Mengisi spreadsheet

### `PAKET` — daftar ujian
| Kolom | Isi |
|---|---|
| ID_PAKET | Kode unik tanpa spasi, misalnya `IPA8-KALOR` |
| NAMA_UJIAN, MAPEL | Tampil ke siswa dan di laporan. Isi MAPEL dengan konsisten agar laporan per mapel rapi. |
| KELAS | `VIII-A, VIII-B` atau `SEMUA` |
| MODE_TIMER | `TIMER` / `TIMERSOAL` / `TIMERFIXED` |
| DURASI_MENIT | Khusus mode `TIMER`. Jika dikosongkan, durasi = jumlah `WAKTU_DETIK` semua soal. |
| ACAK_SOAL | `YA` = urutan soal diacak per siswa (PG tetap di depan, essay di belakang) |
| ACAK_OPSI | `YA` = urutan opsi A–E diacak per siswa |
| TAMPILKAN_NILAI | `YA` = siswa bisa melihat nilai di menu "Lihat nilaiku" |
| AKTIF | `YA` agar ikut terunduh ke HP |

### Tiga mode timer

| Mode | Cara kerja | Cocok untuk |
|---|---|---|
| **TIMER** | Satu timer untuk seluruh ujian (`DURASI_MENIT`). Siswa bebas maju, mundur, lompat ke nomor mana saja, dan menandai **ragu-ragu**. Ujian selesai otomatis saat waktu habis. | Ulangan biasa, PAS/PAT, gaya ANBK |
| **TIMERSOAL** | Setiap soal punya timer (`WAKTU_DETIK`). Saat timer habis, **jawaban terkunci** dan soal otomatis berganti. Siswa boleh lanjut lebih cepat, tetapi tidak bisa kembali. | Kuis cepat, soal hafalan |
| **TIMERFIXED** | Setiap soal punya timer minimal: tombol **Lanjut terkunci** sampai timer soal habis. Setelah itu siswa **masih boleh menjawab** lalu menekan Lanjut. Ada **timer total = jumlah waktu semua soal + 5%**; jika habis, ujian selesai otomatis. Tidak bisa kembali. | Mencegah siswa terburu-buru dan asal menjawab |

> Pada mode TIMERFIXED, waktu yang dipakai siswa setelah timer soal habis diambil dari cadangan 5%. Untuk soal yang butuh lebih banyak waktu, besarkan `WAKTU_DETIK`-nya.

### `SOAL_PG` — pilihan ganda
| ID_PAKET | NO | SOAL | GAMBAR | OPSI_A | OPSI_B | OPSI_C | OPSI_D | OPSI_E | KUNCI | SKOR | WAKTU_DETIK | TUJUAN_PEMBELAJARAN |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IPA8-KALOR | 1 | Satuan kalor SI adalah … | | kalori | joule | watt | kelvin | | B | 2 | 45 | Menjelaskan konsep kalor dan satuannya |

- `OPSI_E` (atau D) boleh kosong; jumlah opsi bisa 2 sampai 5.
- `KUNCI` cukup diisi satu huruf (A–E). Opsi boleh memakai rumus, misalnya `$Q = m \cdot c \cdot \Delta T$`.

### `SOAL_ESSAY` — essay
| ID_PAKET | NO | SOAL | GAMBAR | PEDOMAN_JAWABAN | SKOR_MAKS | WAKTU_DETIK | TUJUAN_PEMBELAJARAN |
|---|---|---|---|---|---|---|---|

`PEDOMAN_JAWABAN` adalah rubrik untuk AI dan **tidak pernah dikirim ke HP**. Rubrik yang rinci (poin per bagian) membuat penilaian lebih konsisten.

`TUJUAN_PEMBELAJARAN` (kedua sheet soal) dipakai untuk laporan ketercapaian TP dan juga tidak dikirim ke HP.

**Nilai akhir** = (skor PG + skor essay) ÷ total skor maksimal × 100. Atur bobot lewat kolom `SKOR` / `SKOR_MAKS`. Contoh: PG 20 soal × 2 = 40, ditambah essay 3 soal × 20 = 60, totalnya 100.

### `TOKEN`
| ID_PAKET | TOKEN | MULAI | SELESAI | KETERANGAN |
|---|---|---|---|---|

- MULAI–SELESAI adalah masa aktif token untuk **memulai** ujian.
- Token harus dibuat **sebelum** siswa mengunduh atau memperbarui data, karena token dicek offline di HP.
- Paket tanpa token aktif atau token yang akan datang tidak ikut terunduh.

### `USER`
`USERNAME | PASSWORD | NAMA | KELAS`

### `PENGATURAN`
| Kunci | Isi |
|---|---|
| NAMA_SEKOLAH, PASSWORD_GURU | **Ganti `guru123`!** |
| AI_PROVIDER, AI_MODEL, AUTO_NILAI, INSTRUKSI_AI | Pengaturan penilaian essay |
| KKM | Batas tuntas di laporan (bisa diubah juga di form laporan) |
| TAHUN_PELAJARAN, KOTA, NAMA_GURU, NIP_GURU, NAMA_KEPSEK, NIP_KEPSEK | Kop dan tanda tangan laporan |
| LOGO_URL | (Opsional) link logo sekolah untuk kop laporan |

### Sheet otomatis — jangan diubah strukturnya
- `HASIL`: 1 baris per kiriman.
- `JAWABAN`: 1 baris per jawaban.
- `PROGRESS`: pantauan langsung.
- `PERANGKAT`: HP yang mengunduh data.
- `LOGIN_LOG`: riwayat login siswa.

---

## D. Alur pemakaian

**Sebelum hari ujian (online)**
1. Guru mengisi soal, token, dan siswa.
2. Siswa membuka web → **Tampilkan daftar kelas** → pilih kelas → **Unduh data**. Disarankan juga **Tambahkan ke layar utama**.
3. Siswa mencoba login sekali. Di dashboard tab **Siswa & HP**, guru bisa melihat siapa yang sudah siap.

**Hari ujian (boleh offline)**
1. Siswa login → pilih ujian.
2. Guru mengumumkan token.
3. Siswa mengerjakan. Jawaban tersimpan otomatis.
4. Selesai → jawaban masuk kotak kirim. Pilih **Ganti pemain** agar HP bisa dipakai siswa berikutnya.

**Setelah ujian**
1. Saat online, jawaban terkirim otomatis lalu dihapus dari HP.
2. PG langsung dinilai; essay dinilai AI dalam ±1–2 menit.
3. Guru memeriksa nilai, mengoreksi bila perlu, lalu mencetak laporan PDF.

---

## E. Dashboard guru (`guru.html`)

| Tab | Isi |
|---|---|
| **Pantau langsung** | Status tiap siswa: Belum login · Sudah login · Mengerjakan (soal ke-berapa, sisa waktu) · Selesai belum terkirim · Terkirim. Juga jumlah keluar aplikasi. Segar otomatis tiap 15 detik. |
| **Hasil & nilai** | Skor PG, skor essay, nilai, status AI, durasi. **Detail** menampilkan opsi yang dipilih siswa vs kunci, jawaban essay, dan umpan balik AI. Isi **Skor guru** untuk mengoreksi (berlaku untuk PG maupun essay). Tersedia juga unduh CSV. |
| **Siswa & HP** | Kelas mana yang sudah diunduh dan di berapa HP, login terakhir tiap siswa dan HP yang dipakai, serta daftar HP (merek/OS, kelas, apakah ujian ini sudah ada di data HP, online terakhir, **jawaban yang belum terkirim**). |
| **Laporan PDF** | Lihat bagian F. |
| **Rekap & Export** | Lihat bagian F2. |
| **Token** | Lihat status token dan buat token baru. |
| **Data Siswa / Paket Soal / Bank Soal** | Tambah, ubah, hapus, dan import data langsung dari dashboard. Bank Soal menampilkan kolom Tujuan Pembelajaran beserta jumlah soal yang belum ber-TP. |

> Login yang terjadi saat HP offline dicatat di HP dan baru muncul di dashboard setelah HP itu online lagi.

---

## F. Laporan PDF

Pilih jenis laporan → atur pilihan → **📄 Buat laporan**. Laporan terbuka di tab baru. Tekan **🖨️ Cetak / Simpan PDF**, lalu pilih tujuan **Simpan sebagai PDF**. Cara ini bisa dipakai di laptop maupun Chrome Android.

| Jenis | Isi |
|---|---|
| **Rekap nilai satu ujian** | Per kelas atau semua kelas. Berisi skor PG/essay, nilai, tuntas/belum tuntas, siswa yang tidak ikut, rata-rata, tertinggi/terendah, persentase ketuntasan, sebaran nilai, dan pilihan urut berdasarkan peringkat. |
| **Lembar jawaban per siswa** | Satu siswa atau semua siswa (1 halaman per siswa). Berisi jawaban PG vs kunci, jawaban essay, pedoman, dan umpan balik AI. Teks soal dan kunci bisa disembunyikan. |
| **Rekap per kelas** | Tabel nilai semua ujian untuk satu kelas (bisa dibatasi satu mapel), rata-rata siswa dan rata-rata per ujian. |
| **Rekap per mata pelajaran** | Semua ujian satu mapel, bisa per kelas atau semua kelas. |
| **Riwayat nilai satu siswa** | Semua ujian yang diikuti satu siswa beserta rata-ratanya. |

Pilihan tambahan: KKM, tanggal laporan, tanda tangan guru & kepala sekolah (nama/NIP bisa diubah langsung di form). Jika ujian lebih dari 6, laporan rekap otomatis dicetak mendatar (landscape).

> Jika tab laporan tidak terbuka, izinkan pop-up untuk situs Anda (ikon di ujung kanan bilah alamat).

---

## F2. Rekap & Export (Excel / PDF)

Atur **KKM** dan batas benar essay (bawaan: essay dihitung benar bila skor ≥ 50% skor maksimal), lalu pilih salah satu:

| Export | Isi |
|---|---|
| **1. Rekap hasil per mapel & kelas** | Filter: kelas (atau semua), mata pelajaran (atau semua), ujian (atau semua). Kolom: No, Nama, Username, Mata Pelajaran, Jumlah Benar, Jumlah Salah, Tidak Terjawab, Nilai, **Pencapaian TP Tertinggi**, **Pencapaian TP Terendah**, Predikat, Ketuntasan, Peringkat, Skor PG/Essay, Total/Skor Maks, Pelanggaran, Durasi, Waktu Kirim, serta nilai tiap TP. Excel berisi sheet **Ringkasan**, **Semua Data** (bisa difilter), dan satu sheet per kelas & ujian. PDF: satu halaman per kelas & ujian lengkap dengan tanda tangan. Centang **Hanya siswa belum tuntas** untuk daftar remedial. |
| **2. Daftar Tujuan Pembelajaran** | Per mata pelajaran: kode & rumusan TP, ujian dan nomor soal yang mengukurnya, jumlah soal, bobot skor, rata-rata ketercapaian, jumlah siswa ≥ KKM, status Tercapai/Belum tercapai. |
| **3. Analisis butir soal** | Per ujian (bisa per kelas): sebaran jawaban A–E, tingkat kesukaran (P), daya pembeda (D, kelompok atas–bawah 27%), fungsi pengecoh, reliabilitas KR-20, dan kesimpulan Diterima / Direvisi / Ditolak. |

Cara menghitung:
- **Pencapaian TP** seorang siswa = skor yang diperoleh pada soal-soal TP itu ÷ skor maksimalnya × 100. TP tertinggi/terendah dipilih dari angka ini (bila sama, dipilih TP berbobot skor terbesar).
- **Predikat**: Sangat Baik ≥ 85, Baik 70–84, Cukup 50–69, Perlu Bimbingan < 50.
- Peringkat dihitung per kelas per ujian; nilai sama mendapat peringkat sama.

> Excel dibuat langsung di perangkat guru memakai pustaka ExcelJS yang diunduh sekali saat pertama kali dipakai (butuh internet; setelah itu tersimpan di cache). PDF dibuka di tab baru → **Cetak / Simpan PDF** (kertas A4 mendatar).

---

## G. Menulis rumus (MathJax)

| Tulis | Hasil |
|---|---|
| `$Q = m \cdot c \cdot \Delta T$` | rumus dalam kalimat |
| `$$E_k = \frac{1}{2}mv^2$$` | rumus di baris sendiri |
| `$25^\circ\text{C}$` | 25 °C |
| `$\sqrt{a^2+b^2}$`, `$H_2O$` | akar, indeks bawah |

Siswa tidak perlu hafal LaTeX: tersedia tombol simbol dan pratinjau rumus di kotak jawaban essay.

---

## H. Masalah umum

| Masalah | Solusi |
|---|---|
| "Server masih versi 1" | Ganti `Code.gs` ke v2, jalankan `setupSpreadsheet`, lalu Kelola deployment → **Versi baru**. |
| "URL API belum diatur" | Isi `config.js`, upload ulang, naikkan versi di `sw.js`. |
| Ujian tidak muncul di HP | Cek `AKTIF = YA`, kolom `KELAS` cocok, ada token dengan SELESAI di masa depan, dan ada soal di SOAL_PG/SOAL_ESSAY. Lalu siswa tekan **Perbarui data**. |
| Dashboard: "Ujian ini ada? Tidak" | HP itu mengunduh data sebelum ujian/token dibuat. Minta siswa tekan **Perbarui data**. |
| "Jawaban tertahan di HP" > 0 | HP tersebut punya jawaban belum terkirim. Minta siswa membuka aplikasi saat online lalu tekan **Kirim jawaban**. |
| Token "belum aktif/kedaluwarsa" padahal jadwal benar | Jam HP salah. Betulkan tanggal, jam, dan zona waktu. |
| Status nilai `ERROR` | API key salah, kuota habis, atau nama model salah. Perbaiki, lalu tekan **Nilai semua yang tertunda**. |
| Status tetap `MENUNGGU` | Trigger belum aktif → **🎯 Ujian → 3. Aktifkan Penilaian Otomatis**. |
| Perubahan Code.gs tidak berlaku | Kelola deployment → Edit → **Versi baru**. |
| Tampilan web tidak berubah | Naikkan `VERSI` di `sw.js` (misal `ue2-v1` → `ue2-v2`), lalu buka aplikasi 2× saat online. |
| Rumus di laporan belum rapi | Tunggu tulisan "Siap dicetak" di bilah biru sebelum mencetak (butuh internet). |
| Siswa perlu ujian ulang | Dashboard → Detail → **Hapus kiriman**. Di HP siswa: **Hapus data HP** → unduh ulang. |

## Catatan keamanan

- Soal terenkripsi dan baru terbuka dengan token; kunci PG dan pedoman essay tidak pernah dikirim ke HP.
- Jam token dicek dengan jam HP (karena offline), sehingga bisa diakali dengan mengubah jam HP.
- Deteksi keluar aplikasi hanya *mencatat*, tidak mencegah. Pengawasan guru tetap penting.
- Penilaian AI sebaiknya diperiksa guru sebelum masuk rapor.
- Pada Gemini versi gratis, teks soal dan jawaban boleh dipakai Google untuk meningkatkan modelnya. Nama dan username siswa **tidak** dikirim ke AI.
