/* =========================================================
   Dashboard Guru v3 — tampilan formal, Rekap & Export (Excel/PDF),
   Tujuan Pembelajaran, analisis butir soal (+ Pemulihan & Anti-Contek)
   ========================================================= */
(function () {
  'use strict';
  var UE = window.UE;
  var $ = function (id) { return document.getElementById(id); };
  var G = { pw: sessionStorage.getItem('ue_guru_pw') || '', paket: sessionStorage.getItem('ue_guru_paket') || '', data: null, meta: null,
    metaT: 0, metaJanji: null, identitas: false, tab: 't-pantau', sort: { k: 'n', dir: 1 }, loading: false, modal: false };
  var MODE = { TIMER: 'Timer ujian', TIMERSOAL: 'Timer per soal', TIMERFIXED: 'Timer tetap per soal' };
  var TAB_PAKET = ['t-pantau', 't-hasil', 't-siswa', 't-token']; // menu yang memakai pilihan "Paket ujian"

  // Dashboard formal: tanpa efek suara game
  UE.sfx = function () {};
  UE.pasangIndikatorOnline($('net'));
  UE.daftarSW();

  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    $('btnKeluar').classList.toggle('hidden', id !== 'g-main');
  }
  function guru(action, data, t) { return UE.api(action, Object.assign({ password: G.pw }, data || {}), t); }
  function stat(n, label, cls) { return '<div class="stat ' + (cls || '') + '"><b>' + n + '</b><span>' + label + '</span></div>'; }
  function opsiKelas(sel, list, semuaLabel) {
    var pilih = sel.value;
    sel.innerHTML = '<option value="">' + (semuaLabel || 'Semua kelas') + '</option>' + list.map(function (k) {
      return '<option' + (k === pilih ? ' selected' : '') + '>' + UE.esc(k) + '</option>';
    }).join('');
  }

  /* ---------- Login ---------- */
  $('formGuru').addEventListener('submit', function (e) {
    e.preventDefault();
    G.pw = $('inGuruPw').value;
    var b = this.querySelector('button'); b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
    guru('guruLogin').then(function () {
      sessionStorage.setItem('ue_guru_pw', G.pw); UE.sfx('sukses'); show('g-main'); muat();
    }).catch(function (err) { $('gMsg').textContent = err.message; UE.sfx('salah'); })
      .finally(function () { b.disabled = false; b.textContent = 'Masuk'; });
  });
  $('btnKeluar').addEventListener('click', function () { sessionStorage.removeItem('ue_guru_pw'); G.pw = ''; $('inGuruPw').value = ''; show('g-login'); });

  /* ---------- Muat data ---------- */
  function muat(diam) {
    if (G.loading) return;
    G.loading = true;
    if (!diam) $('btnRefresh').innerHTML = '<span class="spinner"></span>';
    guru('guruData', { paket: G.paket }).then(function (d) {
      G.data = d;
      if (d.paket) { G.paket = d.paket.id; sessionStorage.setItem('ue_guru_paket', G.paket); }
      $('gSekolah').textContent = d.sekolah || 'Dashboard ujian';
      renderPaketSelect();
      if (d.paket) { renderPantau(); renderHasil(); renderSiswa(); renderToken(); }
      if (!G.meta) ambilMeta().catch(function () {});
    }).catch(function (e) {
      if (/password/i.test(e.message)) { show('g-login'); $('gMsg').textContent = e.message; return; }
      if (!diam) UE.toast(e.message, 'err');
    }).finally(function () { G.loading = false; $('btnRefresh').textContent = 'Segarkan'; });
  }
  $('btnRefresh').addEventListener('click', function () { UE.sfx('klik'); muat(); });
  $('selPaket').addEventListener('change', function () { G.paket = this.value; muat(); });
  setInterval(function () {
    if ($('autoRefresh').checked && !document.hidden && !G.modal && G.pw && $('g-main').classList.contains('active') &&
      ['t-pantau', 't-hasil', 't-siswa'].indexOf(G.tab) >= 0) muat(true);
  }, 15000);

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      UE.sfx('klik');
      G.tab = t.dataset.tab;
      document.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-selected', x === t); });
      document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.toggle('hidden', p.id !== G.tab); });
      $('ctxBar').classList.toggle('hidden', TAB_PAKET.indexOf(G.tab) < 0);
      if (G.tab === 't-laporan') siapkanLaporan();
      if (G.tab === 't-rekap') siapkanRekap();
    });
  });

  function renderPaketSelect() {
    var d = G.data;
    $('selPaket').innerHTML = d.pakets.map(function (p) {
      return '<option value="' + UE.esc(p.id) + '"' + (p.id === G.paket ? ' selected' : '') + '>' + UE.esc(p.nama) + ' (' + UE.esc(p.id) + ')' + (p.aktif ? '' : ' — nonaktif') + '</option>';
    }).join('') || '<option>Belum ada paket di sheet PAKET</option>';
    if (d.paket) {
      var isi = [d.jumlahPG ? d.jumlahPG + ' PG' : '', d.jumlahES ? d.jumlahES + ' essay' : ''].filter(String).join(' + ');
      $('paketInfo').textContent = d.paket.mapel + ' · Kelas ' + d.paket.kelas.join(', ') + ' · ' + isi + ' · ' + (MODE[d.paket.mode] || d.paket.mode) +
        ' · ' + Math.ceil(d.durasi / 60) + ' menit · Nilai ' + (d.paket.tampil ? 'ditampilkan ke siswa' : 'disembunyikan') +
        ' · Diperbarui ' + new Date().toLocaleTimeString('id-ID');
    }
  }

  /* ---------- Gabungan status siswa ---------- */
  var URUT = { MENGERJAKAN: 0, TERHENTI: 1, SELESAI: 2, TERKIRIM: 3, LOGIN: 4, BELUM: 5 };
  var LABEL = { MENGERJAKAN: 'Mengerjakan', TERHENTI: 'Ujian Terhenti', SELESAI: 'Selesai, belum terkirim', TERKIRIM: 'Terkirim', LOGIN: 'Sudah login', BELUM: 'Belum login' };
  function gabungSiswa() {
    var d = G.data, map = {};
    d.users.forEach(function (u) {
      var lg = d.login[u.u];
      map[u.u] = { u: u.u, n: u.n, k: u.k, status: lg ? 'LOGIN' : 'BELUM', dijawab: 0, total: d.jumlahPG + d.jumlahES, soalKe: 0, pel: 0, t: lg ? lg.last : 0,
        login: lg || null, sisa: null };
    });
    d.progress.forEach(function (p) {
      var x = map[p.u] || (map[p.u] = { u: p.u, n: p.n, k: p.k, login: null });
      Object.assign(x, { status: p.status, dijawab: p.dijawab, total: p.total || x.total, soalKe: p.soalKe, pel: p.pel, t: p.t, sisa: p.sisa, dev: p.dev });
    });
    d.hasil.forEach(function (h) {
      var x = map[h.u] || (map[h.u] = { u: h.u, n: h.n, k: h.k, dijawab: 0, total: 0, soalKe: 0, pel: 0, t: 0, login: null });
      x.status = 'TERKIRIM'; x.pel = Math.max(x.pel || 0, h.pel); x.t = Math.max(x.t || 0, h.t);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function kelasDari(list) { var s = {}; list.forEach(function (x) { if (x.k) s[x.k] = 1; }); return Object.keys(s).sort(); }

  /* ---------- Pantau langsung ---------- */
  function renderPantau() {
    var semua = gabungSiswa();
    opsiKelas($('filterKelas'), kelasDari(semua));
    var fk = $('filterKelas').value, cari = $('cariPantau').value.trim().toLowerCase();
    var list = semua.filter(function (s) { return !fk || s.k === fk; });
    var hit = { MENGERJAKAN: 0, TERHENTI: 0, SELESAI: 0, TERKIRIM: 0, LOGIN: 0, BELUM: 0 };
    list.forEach(function (s) { hit[s.status] = (hit[s.status] || 0) + 1; });
    $('stats').innerHTML = stat(list.length, 'Total siswa') + stat(hit.BELUM, 'Belum login', 's-none') + stat(hit.LOGIN, 'Sudah login, belum mulai', 's-login') +
      stat(hit.MENGERJAKAN, 'Mengerjakan', 's-play') + stat(hit.SELESAI, 'Selesai, blm terkirim', 's-wait') + stat(hit.TERKIRIM, 'Terkirim', 's-done') +
      (hit.TERHENTI ? stat(hit.TERHENTI, 'Terhenti (Pelanggaran)', 's-play') : '');
      
    list = list.filter(function (s) { return !cari || s.n.toLowerCase().indexOf(cari) >= 0 || s.u.indexOf(cari) >= 0; })
      .sort(function (a, b) { return (URUT[a.status] - URUT[b.status]) || a.n.localeCompare(b.n); });
    var now = Date.now();
    $('students').innerHTML = list.map(function (s) {
      var pct = s.total ? Math.round(s.dijawab / s.total * 100) : 0;
      var lama = s.status === 'MENGERJAKAN' && s.t && now - s.t > 120000;
      var baris2;
      if (s.status === 'BELUM') baris2 = '<span>Belum pernah login</span>';
      else if (s.status === 'LOGIN') baris2 = '<span>Login ' + UE.relatif(s.login.last) + ' · ' + UE.esc(s.login.dev) + '</span>';
      else baris2 = '<span>' + s.dijawab + '/' + s.total + ' terjawab' + (s.status === 'MENGERJAKAN' ? ' · soal ' + s.soalKe : '') + '</span>' +
        '<span class="' + (s.pel ? 'warn-pel' : '') + '">' + (s.pel ? '⚠ ' + s.pel + 'x keluar' : '') + '</span>';
      return '<div class="stu ' + s.status + '">' +
        '<div class="stu-name" title="' + UE.esc(s.n) + '">' + UE.esc(s.n) + '</div>' +
        '<div class="stu-meta"><span>' + UE.esc(s.k) + ' · ' + UE.esc(s.u) + '</span><span>' + (LABEL[s.status] || s.status) + '</span></div>' +
        '<div class="prog"><i style="width:' + (s.status === 'BELUM' || s.status === 'LOGIN' ? 0 : pct) + '%"></i></div>' +
        '<div class="stu-meta">' + baris2 + '</div>' +
        (s.status === 'MENGERJAKAN' || s.status === 'SELESAI' || s.status === 'TERHENTI' ? '<div class="stu-meta"><span>' + (lama ? '📴 Terakhir terlihat ' : 'Update ') + UE.relatif(s.t) + '</span>' +
          '<span>' + (s.sisa != null && s.status === 'MENGERJAKAN' ? '⏳ ' + UE.fmtWaktu(Math.max(0, s.sisa - (now - s.t) / 1000)) : '') + '</span></div>' : '') +
        '</div>';
    }).join('') || '<p class="muted">Tidak ada siswa.</p>';
  }
  $('cariPantau').addEventListener('input', renderPantau);
  $('filterKelas').addEventListener('change', renderPantau);

  /* ---------- Hasil ---------- */
  function barisHasil() {
    var cari = $('cariHasil').value.trim().toLowerCase();
    var rows = G.data.hasil.map(function (h) { return Object.assign({ dur: h.selesai && h.mulai ? h.selesai - h.mulai : 0 }, h); })
      .filter(function (h) { return !cari || h.n.toLowerCase().indexOf(cari) >= 0; });
    var k = G.sort.k, dir = G.sort.dir;
    rows.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (x == null) x = -1; if (y == null) y = -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
    });
    return rows;
  }
  function pillStatus(s) {
    var err = s.indexOf('ERROR') === 0, c = err ? 'ERROR' : s.split(' ')[0];
    var txt = err ? 'Error AI' : { DINILAI: 'Dinilai', MENUNGGU: 'Menunggu AI', SEDANG: 'Sedang dinilai' }[c] || s;
    return '<span class="pill ' + c + '" title="' + UE.esc(s) + '">' + txt + '</span>';
  }
  function renderHasil() {
    var d = G.data, rows = barisHasil();
    var nilai = d.hasil.filter(function (h) { return h.nilai != null; }).map(function (h) { return h.nilai; });
    var rata = nilai.length ? Math.round(nilai.reduce(function (a, b) { return a + b; }, 0) / nilai.length * 10) / 10 : '–';
    $('statsHasil').innerHTML = stat(d.hasil.length, 'Kiriman masuk', 's-done') + stat(nilai.length, 'Sudah dinilai') +
      stat(rata, 'Rata-rata', 's-wait') + stat(nilai.length ? Math.max.apply(null, nilai) : '–', 'Tertinggi') +
      stat(nilai.length ? Math.min.apply(null, nilai) : '–', 'Terendah', 's-play');
    var ganda = {};
    d.hasil.forEach(function (h) { ganda[h.u] = (ganda[h.u] || 0) + 1; });
    var f = function (v) { return v == null ? '–' : v; };
    document.querySelector('#tblHasil tbody').innerHTML = rows.map(function (h) {
      return '<tr><td class="wrap"><b>' + UE.esc(h.n) + '</b>' + (ganda[h.u] > 1 ? ' <span class="pill ERROR" title="Siswa ini mengirim lebih dari sekali">ganda</span>' : '') +
        '<div class="small muted">' + UE.esc(h.u) + '</div></td><td>' + UE.esc(h.k) + '</td>' +
        '<td>' + (d.jumlahPG ? f(h.pg) : '–') + '</td><td>' + (d.jumlahES ? f(h.es) : '–') + '</td>' +
        '<td>' + (h.nilai != null ? '<span class="nilai-big">' + h.nilai + '</span> ' + UE.bintangSVG(UE.bintang(h.nilai)) : '–') + '</td>' +
        '<td>' + pillStatus(h.status) + '</td><td class="' + (h.pel ? 'warn-pel' : '') + '">' + (h.pel || 0) + '</td>' +
        '<td>' + (h.dur ? Math.round(h.dur / 60000) + ' mnt' : '–') + '</td><td>' + UE.fmtTanggal(h.t) + '</td>' +
        '<td><button class="btn btn-blue btn-sm" data-detail="' + UE.esc(h.id) + '">Detail</button></td></tr>';
    }).join('') || '<tr><td colspan="10" class="muted">Belum ada jawaban yang masuk.</td></tr>';
  }
  $('cariHasil').addEventListener('input', renderHasil);
  document.querySelectorAll('#tblHasil th[data-s]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.s;
      G.sort = { k: k, dir: G.sort.k === k ? -G.sort.dir : (k === 'n' || k === 'k' ? 1 : -1) };
      renderHasil();
    });
  });
  $('tblHasil').addEventListener('click', function (e) { var b = e.target.closest('[data-detail]'); if (b) bukaDetail(b.dataset.detail); });
  $('btnNilaiSemua').addEventListener('click', function () {
    var b = this; UE.sfx('klik');
    b.disabled = true; b.innerHTML = '<span class="spinner dark"></span> AI sedang menilai…';
    guru('guruNilaiAI', {}, 300000).then(function (r) { UE.toast(r.dinilai + ' kiriman selesai dinilai', 'ok'); UE.sfx('sukses'); muat(true); })
      .catch(function (e) { UE.toast(e.message, 'err'); })
      .finally(function () { b.disabled = false; b.textContent = 'Nilai semua yang tertunda (AI)'; });
  });
  $('btnCSV').addEventListener('click', function () {
    var d = G.data; if (!d || !d.paket) return;
    var angka = function (v) { return v == null ? '' : String(v).replace('.', ','); };
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [['Nama', 'Username', 'Kelas', 'Skor PG', 'Skor Essay', 'Nilai', 'Total skor', 'Skor maks', 'Status', 'Pelanggaran', 'Mulai', 'Selesai', 'Dikirim'].map(q).join(';')];
    barisHasil().forEach(function (h) {
      lines.push([q(h.n), q(h.u), q(h.k), angka(h.pg), angka(h.es), angka(h.nilai), angka(h.total), angka(h.maks), q(h.status), h.pel,
        q(UE.fmtTanggal(h.mulai)), q(UE.fmtTanggal(h.selesai)), q(UE.fmtTanggal(h.t))].join(';'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nilai_' + d.paket.id + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });

  /* ---------- Detail jawaban ---------- */
  function bukaDetail(id) {
    G.modal = true;
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal board" style="width:min(880px,100%)" role="dialog" aria-modal="true"><div id="detailIsi"><span class="spinner dark"></span> Memuat…</div></div>';
    document.body.appendChild(wrap);
    function tutup() { wrap.remove(); G.modal = false; muat(true); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) tutup(); });

    function itemHTML(it) {
      var kepala = '<h4>' + (it.tipe === 'PG' ? 'Pilihan ganda ' : 'Essay ') + it.no + ' <span class="small muted">(maks ' + it.maks + ')</span></h4>' +
        '<div class="box math">' + UE.rich(it.soal) + '</div>' + (it.gambar ? '<img class="q-img" src="' + UE.esc(it.gambar) + '" alt="Gambar soal">' : '');
      var isi;
      if (it.tipe === 'PG') {
        isi = '<div class="opsi-guru">' + (it.opsi || []).map(function (o) {
          var c = o.k === it.kunci ? 'kunci' : (o.k === it.jawaban ? 'salah' : '');
          return '<div class="' + c + ' math"><b>' + o.k + '.</b> ' + UE.rich(o.t) + (o.k === it.jawaban ? ' ← <b>dipilih siswa</b>' : '') + (o.k === it.kunci ? ' ✔ kunci' : '') + '</div>';
        }).join('') + '</div>' + (!it.jawaban ? '<p class="small muted">Siswa tidak menjawab.</p>' : '') +
          '<div class="lbl">Hasil otomatis</div><div class="box">' + (it.oto != null ? '<b>' + it.oto + '/' + it.maks + '</b> — ' + UE.esc(it.feedback) : '-') + '</div>';
      } else {
        isi = '<div class="lbl">Pedoman jawaban</div><div class="box math">' + UE.rich(it.pedoman || '-') + '</div>' +
          '<div class="lbl">Jawaban siswa</div><div class="box ans math">' + (it.jawaban ? UE.rich(it.jawaban) : '<i class="muted">(kosong)</i>') + '</div>' +
          '<div class="lbl">Penilaian AI</div><div class="box">' + (it.oto != null ? '<b>' + it.oto + '/' + it.maks + '</b> — ' + UE.esc(it.feedback) : '<i class="muted">Belum dinilai</i>') + '</div>';
      }
      return '<div class="detail-item">' + kepala + isi +
        '<div class="skor-row"><span class="small" style="font-weight:800">Skor guru (koreksi):</span>' +
        '<input class="input" type="number" step="0.5" min="0" max="' + it.maks + '" value="' + (it.guru != null ? it.guru : '') + '" placeholder="' + (it.oto != null ? it.oto : '') + '" aria-label="Skor guru">' +
        '<button class="btn btn-green btn-sm" data-simpan="' + it.tipe + '|' + it.no + '">Simpan</button>' +
        (it.guru != null ? '<button class="btn btn-wood btn-sm" data-reset="' + it.tipe + '|' + it.no + '">Pakai skor otomatis</button>' : '') +
        '<span class="small muted">Skor akhir: <b>' + (it.akhir != null ? it.akhir : '–') + '</b></span></div></div>';
    }
    function render(r) {
      var h = r.hasil, isi = wrap.querySelector('#detailIsi');
      var pg = r.items.filter(function (i) { return i.tipe === 'PG'; }), es = r.items.filter(function (i) { return i.tipe !== 'PG'; });
      isi.innerHTML = '<h2 class="board-title">' + UE.esc(h.n) + ' <span class="small muted">' + UE.esc(h.k) + '</span></h2>' +
        '<p class="board-sub">Nilai: <b class="nilai-big">' + (h.nilai != null ? h.nilai : '–') + '</b> ' + pillStatus(h.status) +
        (pg.length ? ' · PG ' + (h.pg != null ? h.pg : '–') : '') + (es.length ? ' · Essay ' + (h.es != null ? h.es : '–') : '') +
        (h.pel ? ' · <span class="warn-pel">⚠ keluar aplikasi ' + h.pel + 'x</span>' : '') + '</p>' +
        (pg.length ? '<h3 class="section-title">Pilihan ganda — ' + pg.filter(function (i) { return i.akhir > 0; }).length + ' benar dari ' + pg.length + '</h3>' + pg.map(itemHTML).join('') : '') +
        (es.length ? '<h3 class="section-title">Essay</h3>' + es.map(itemHTML).join('') : '') +
        '<div class="modal-actions"><button class="btn btn-red btn-sm" data-act="hapus">Hapus kiriman</button>' +
        (es.length ? '<button class="btn btn-gold" data-act="ulang">Nilai ulang essay dengan AI</button>' : '') +
        '<button class="btn btn-wood" data-act="tutup">Tutup</button></div>';
      UE.typeset(isi);
    }
    function proses(p) { return p.then(render).catch(function (e) { UE.toast(e.message, 'err'); }); }
    proses(guru('guruDetail', { id: id }));

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'tutup') { tutup(); return; }
      if (b.dataset.simpan || b.dataset.reset) {
        var key = (b.dataset.simpan || b.dataset.reset).split('|');
        var val = b.dataset.reset ? '' : b.closest('.skor-row').querySelector('input').value;
        b.disabled = true;
        proses(guru('guruSetSkor', { id: id, tipe: key[0], no: +key[1], skor: val === '' ? '' : Number(val) })).then(function () { UE.sfx('pop'); UE.toast('Skor disimpan', 'ok'); });
        return;
      }
      if (b.dataset.act === 'ulang') {
        b.disabled = true; b.innerHTML = '<span class="spinner dark"></span> Menilai…';
        proses(guru('guruNilaiAI', { id: id }, 300000)).then(function () { UE.sfx('sukses'); });
        return;
      }
      if (b.dataset.act === 'hapus') {
        UE.dialog({ judul: 'Hapus kiriman ini?', pesan: 'Jawaban dan nilai siswa ini dihapus permanen dari spreadsheet. Pakai hanya untuk data uji coba, kiriman ganda, atau ujian ulang.', ok: 'Hapus', batal: 'Batal', bahaya: true })
          .then(function (ya) { if (ya) guru('guruHapusKiriman', { id: id }).then(function () { UE.toast('Kiriman dihapus', 'ok'); tutup(); }).catch(function (e) { UE.toast(e.message, 'err'); }); });
      }
    });
  }

  /* ---------- Siswa & HP ---------- */
  function renderSiswa() {
    var d = G.data, now = Date.now();
    var semua = gabungSiswa();
    opsiKelas($('filterKelasSiswa'), kelasDari(semua));
    var fk = $('filterKelasSiswa').value, cari = $('cariSiswa').value.trim().toLowerCase();
    var hpPerKelas = {};
    d.perangkat.forEach(function (p) { p.kelas.forEach(function (k) { hpPerKelas[k] = (hpPerKelas[k] || 0) + 1; }); });
    var list = semua.filter(function (s) { return (!fk || s.k === fk); });
    var sudahLogin = list.filter(function (s) { return s.login; }).length;
    var antre = d.perangkat.reduce(function (a, p) { return a + p.antrian; }, 0);
    var adaPaket = d.perangkat.filter(function (p) { return p.paket.indexOf(d.paket.id) >= 0; }).length;
    $('statsSiswa').innerHTML = stat(list.length, 'Siswa') + stat(sudahLogin, 'Pernah login', 's-login') + stat(list.length - sudahLogin, 'Belum pernah login', 's-none') +
      stat(d.perangkat.length, 'HP mengunduh data', 's-done') + stat(adaPaket, 'HP memuat ujian ini', 's-wait') + stat(antre, 'Jawaban tertahan di HP', antre ? 's-play' : '');

    document.querySelector('#tblSiswa tbody').innerHTML = list.filter(function (s) { return !cari || s.n.toLowerCase().indexOf(cari) >= 0 || s.u.indexOf(cari) >= 0; })
      .sort(function (a, b) { return a.k.localeCompare(b.k) || a.n.localeCompare(b.n); }).map(function (s) {
        var nHP = hpPerKelas[s.k] || 0;
        return '<tr><td class="wrap"><b>' + UE.esc(s.n) + '</b><div class="small muted">' + UE.esc(s.u) + '</div></td><td>' + UE.esc(s.k) + '</td>' +
          '<td>' + (nHP ? '<span class="pill ok">✔ di ' + nHP + ' HP</span>' : '<span class="pill warn">Belum diunduh</span>') + '</td>' +
          '<td>' + (s.login ? UE.relatif(s.login.last) : '<span class="pill no">Belum login</span>') + '</td>' +
          '<td>' + (s.login ? UE.esc(s.login.devs.join(', ')) : '–') + '</td>' +
          '<td>' + (s.login ? s.login.jml : 0) + '</td><td>' + (LABEL[s.status] || s.status) + '</td></tr>';
      }).join('') || '<tr><td colspan="7" class="muted">Tidak ada siswa.</td></tr>';

    document.querySelector('#tblHP tbody').innerHTML = d.perangkat.sort(function (a, b) { return b.online - a.online; }).map(function (p) {
      var ada = p.paket.indexOf(d.paket.id) >= 0;
      return '<tr><td><b>' + UE.esc(p.dev) + '</b></td><td class="wrap">' + UE.esc(p.info || '-') + '</td><td>' + UE.esc(p.kelas.join(', ')) + '</td>' +
        '<td>' + (ada ? '<span class="pill ok">Ya</span>' : '<span class="pill warn" title="Minta siswa menekan Perbarui data">Tidak</span>') + '</td>' +
        '<td>' + UE.fmtTanggal(p.unduh) + '</td><td>' + (p.online ? UE.relatif(p.online) : '–') + '</td>' +
        '<td>' + (p.antrian ? '<span class="pill warn">' + p.antrian + ' kiriman</span>' : '0') + '</td><td>' + p.login + '</td></tr>';
    }).join('') || '<tr><td colspan="8" class="muted">Belum ada HP yang mengunduh data kelas ujian ini.</td></tr>';
  }
  $('cariSiswa').addEventListener('input', renderSiswa);
  $('filterKelasSiswa').addEventListener('change', renderSiswa);

  /* ---------- Token ---------- */
  function renderToken() {
    var d = G.data;
    document.querySelector('#tblToken tbody').innerHTML = d.tokens.map(function (t) {
      var c = t.status === 'AKTIF' ? 'DINILAI' : t.status === 'BELUM AKTIF' ? 'MENUNGGU' : 'ERROR';
      return '<tr><td><b class="nilai-big" style="letter-spacing:3px">' + UE.esc(t.token) + '</b></td><td>' + UE.fmtTanggal(t.mulai) + '</td><td>' +
        UE.fmtTanggal(t.selesai) + '</td><td><span class="pill ' + c + '">' + t.status + '</span></td><td class="wrap">' + UE.esc(t.ket) + '</td>' +
        '<td class="c"><b>' + (t.mp||3) + '</b> kali</td><td><b>' + UE.esc(t.tp||'-') + '</b></td>' +
        '<td><button class="btn btn-blue btn-sm" data-edittoken="' + UE.esc(t.token) + '">Edit</button> ' +
        '<button class="btn btn-red btn-sm" data-hapustoken="' + UE.esc(t.token) + '">Hapus</button></td></tr>';
    }).join('') || '<tr><td colspan="8" class="muted">Belum ada token. Paket tanpa token tidak ikut terunduh ke HP siswa.</td></tr>';
    
    if (typeof renderMasterSiswa === 'function') renderMasterSiswa();
    if (typeof renderMasterPaket === 'function') renderMasterPaket();
  }
  function lokal(ms) { return new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function acakToken() {
    var huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '', r = crypto.getRandomValues(new Uint32Array(6));
    for (var i = 0; i < 6; i++) s += huruf[r[i] % huruf.length];
    return s;
  }
  
  $('tkKode').value = acakToken();
  $('tkPemulihan').value = acakToken().slice(0, 6);
  $('tkMulai').value = lokal(Date.now());
  $('tkSelesai').value = lokal(Date.now() + 2 * 3600000);
  
  $('btnAcakToken').addEventListener('click', function () { 
    UE.sfx('pop'); 
    $('tkKode').value = acakToken(); 
    $('tkPemulihan').value = acakToken().slice(0, 6);
  });
  
  var tokenLama = '';
  $('tblToken').addEventListener('click', function(e) {
    var b = e.target.closest('button'); if(!b) return;
    if(b.dataset.hapustoken) {
      if(confirm('Hapus token ini?')) {
        guru('guruHapusToken', {paket: G.paket, token: b.dataset.hapustoken}).then(function(){ UE.toast('Token dihapus', 'ok'); muat(true); });
      }
    }
    if(b.dataset.edittoken) {
      var tk = G.data.tokens.find(function(x) { return x.token === b.dataset.edittoken; });
      if(tk) {
        tokenLama = tk.token;
        $('tkKode').value = tk.token;
        $('tkMulai').value = new Date(tk.mulai - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
        $('tkSelesai').value = new Date(tk.selesai - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
        $('tkMaks').value = tk.mp || 3;
        $('tkPemulihan').value = tk.tp || acakToken().slice(0,6);
        var btnBatal = $('btnBatalToken');
        if(btnBatal) btnBatal.classList.remove('hidden');
        $('formToken').querySelector('[type=submit]').textContent = 'Simpan Edit';
      }
    }
  });

  var btnBatal = $('btnBatalToken');
  if(btnBatal) {
    btnBatal.addEventListener('click', function() {
      tokenLama = '';
      $('tkKode').value = acakToken();
      $('tkPemulihan').value = acakToken().slice(0, 6);
      this.classList.add('hidden');
      $('formToken').querySelector('[type=submit]').textContent = 'Simpan token';
    });
  }

  $('formToken').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = this.querySelector('[type=submit]'); b.disabled = true;
    var aksi = tokenLama ? 'guruEditToken' : 'guruBuatToken';
    guru(aksi, { 
      paket: G.paket, 
      token: $('tkKode').value.trim().toUpperCase(),
      tokenlama: tokenLama,
      mulai: new Date($('tkMulai').value).getTime(), 
      selesai: new Date($('tkSelesai').value).getTime(),
      maksPel: $('tkMaks').value, 
      tokenPemulihan: $('tkPemulihan').value.trim().toUpperCase() 
    }).then(function () { 
      UE.sfx('sukses'); 
      UE.toast('Token tersimpan.', 'ok'); 
      if($('btnBatalToken')) $('btnBatalToken').click();
      muat(true); 
    }).catch(function (e) { 
      UE.toast(e.message, 'err'); 
    }).finally(function () { 
      b.disabled = false; 
    });
  });

  /* ---------- Data induk (paket, siswa, pengaturan) — dipakai Laporan & Rekap ---------- */
  function ambilMeta() {
    if (G.meta && Date.now() - G.metaT < 60000) return Promise.resolve(G.meta);
    if (G.metaJanji) return G.metaJanji;
    G.metaJanji = guru('guruMeta').then(function (m) {
      G.meta = m; G.metaT = Date.now();
      if (!G.identitas) { G.identitas = true; isiIdentitas(m.setting || {}); }
      return m;
    }).finally(function () { G.metaJanji = null; });
    return G.metaJanji;
  }
  function isiIdentitas(s) {
    $('lapKKM').value = s.KKM || 75; $('exKKM').value = s.KKM || 75; $('lapKota').value = s.KOTA || ''; $('lapTP').value = s.TAHUN_PELAJARAN || '';
    $('lapGuru').value = s.NAMA_GURU || ''; $('lapNipGuru').value = s.NIP_GURU || ''; $('lapKepsek').value = s.NAMA_KEPSEK || ''; $('lapNipKepsek').value = s.NIP_KEPSEK || '';
    $('lapTanggal').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (s.LOGO_URL) {
      var img = $('gLogo');
      img.onload = function () { img.classList.remove('hidden'); $('gEmblem').classList.add('hidden'); };
      img.src = s.LOGO_URL;
    }
  }
  /** Isi <select>; pilihan sebelumnya dipertahankan bila masih ada. items = [{v, t}] */
  function opsiSelect(sel, items, semuaLabel, bawaan) {
    var pilih = sel.value || bawaan || '';
    sel.innerHTML = (semuaLabel ? '<option value="">' + UE.esc(semuaLabel) + '</option>' : '') +
      items.map(function (x) { return '<option value="' + UE.esc(x.v) + '">' + UE.esc(x.t) + '</option>'; }).join('');
    if (pilih && items.some(function (x) { return x.v === pilih; })) sel.value = pilih;
  }
  function daftarMapel(m) {
    var s = {};
    m.pakets.forEach(function (p) { var k = (p.mapel || '').toUpperCase(); if (k && !s[k]) s[k] = p.mapel; });
    return Object.keys(s).map(function (k) { return s[k]; }).sort(function (a, b) { return a.localeCompare(b); });
  }
  function untukKelas(p, k) { return p.kelas.indexOf('SEMUA') >= 0 || p.kelas.indexOf(k) >= 0; }

  /* ---------- Laporan PDF ---------- */
  function siapkanLaporan() {
    ambilMeta().then(function (m) {
      opsiSelect($('lapPaket'), m.pakets.map(function (p) { return { v: p.id, t: p.nama + ' — ' + p.mapel }; }), null, G.paket);
      opsiSelect($('lapMapel'), daftarMapel(m).map(function (x) { return { v: x, t: x }; }), 'Semua mapel');
      aturFormLaporan();
    }).catch(function (e) { UE.toast(e.message, 'err'); });
  }
  function aturFormLaporan() {
    var m = G.meta, jenis = $('lapJenis').value;
    document.querySelectorAll('#formLaporan [data-lap]').forEach(function (el) { el.classList.toggle('hidden', el.dataset.lap.split(' ').indexOf(jenis) < 0); });
    var kelasSemua = kelasDari(m.users);
    var p = m.pakets.filter(function (x) { return x.id === $('lapPaket').value; })[0];
    var kelasOpsi = (jenis === 'rekap' || jenis === 'detail') && p ? kelasSemua.filter(function (k) { return p.kelas.indexOf('SEMUA') >= 0 || p.kelas.indexOf(k) >= 0; }) : kelasSemua;
    var sel = $('lapKelas'), pilih = sel.value;
    var wajib = jenis === 'kelas';
    sel.innerHTML = (wajib ? '' : '<option value="">Semua kelas</option>') + kelasOpsi.map(function (k) { return '<option' + (k === pilih ? ' selected' : '') + '>' + UE.esc(k) + '</option>'; }).join('');
    // Daftar siswa
    var ss = $('lapSiswa'), pilihS = ss.value;
    var siswa = m.users.filter(function (u) { return jenis === 'siswa' || !p || p.kelas.indexOf('SEMUA') >= 0 || p.kelas.indexOf(u.k) >= 0; })
      .filter(function (u) { return jenis === 'siswa' || !sel.value || u.k === sel.value; })
      .sort(function (a, b) { return a.k.localeCompare(b.k) || a.n.localeCompare(b.n); });
    ss.innerHTML = (jenis === 'detail' ? '<option value="">Semua siswa (1 halaman per siswa)</option>' : '') +
      siswa.map(function (u) { return '<option value="' + UE.esc(u.u) + '"' + (u.u === pilihS ? ' selected' : '') + '>' + UE.esc(u.n) + ' — ' + UE.esc(u.k) + '</option>'; }).join('');
  }
  ['lapJenis', 'lapPaket', 'lapKelas'].forEach(function (id) { $(id).addEventListener('change', aturFormLaporan); });

  $('formLaporan').addEventListener('submit', function (e) {
    e.preventDefault();
    var jenis = $('lapJenis').value;
    var opsi = {
      jenis: jenis, kkm: Number($('lapKKM').value) || 0, tanggal: $('lapTanggal').value, urut: $('lapUrut').value,
      belum: $('lapBelum').checked, teksSoal: $('lapTeksSoal').checked, kunci: $('lapKunci').checked, ttd: $('lapTTD').checked,
      kota: $('lapKota').value, tp: $('lapTP').value, guru: $('lapGuru').value, nipGuru: $('lapNipGuru').value,
      kepsek: $('lapKepsek').value, nipKepsek: $('lapNipKepsek').value, kelas: $('lapKelas').value, mapel: $('lapMapel').value
    };
    var req = { kelas: opsi.kelas };
    if (jenis === 'rekap') { req.jenis = 'paket'; req.paket = $('lapPaket').value; }
    else if (jenis === 'detail') { req.jenis = 'detail'; req.paket = $('lapPaket').value; req.username = $('lapSiswa').value; }
    else if (jenis === 'kelas') { req.jenis = 'matriks'; req.mapel = opsi.mapel; if (!opsi.kelas) { UE.toast('Pilih kelas', 'err'); return; } }
    else if (jenis === 'mapel') { req.jenis = 'matriks'; req.mapel = opsi.mapel; }
    else { req.jenis = 'matriks'; req.username = $('lapSiswa').value; req.kelas = ''; if (!req.username) { UE.toast('Pilih siswa', 'err'); return; } }
    
    var w = window.open('', '_blank');
    if (!w) { UE.toast('Browser memblokir tab baru. Izinkan pop-up untuk situs ini.', 'err'); return; }
    w.document.write('<p style="font-family:sans-serif;padding:30px">Menyiapkan laporan…</p>');
    var b = this.querySelector('[type=submit]'); b.disabled = true;
    guru('guruLaporan', req, 120000).then(function (data) {
      window.Laporan.tulis(w, opsi, data);
    }).catch(function (err) {
      w.document.body.innerHTML = '<p style="font-family:sans-serif;padding:30px;color:#b00">Gagal: ' + UE.esc(err.message) + '</p>';
    }).finally(function () { b.disabled = false; });
  });

  /* ================== REKAP & EXPORT (Excel / PDF) ================== */
  function siapkanRekap() {
    ambilMeta().then(function (m) {
      var kelas = kelasDari(m.users).map(function (k) { return { v: k, t: 'Kelas ' + k }; });
      var mapel = daftarMapel(m).map(function (x) { return { v: x, t: x }; });
      opsiSelect($('exKelas'), kelas, 'Semua kelas');
      opsiSelect($('exMapel'), mapel, 'Semua mata pelajaran');
      aturPaketRekap();
      opsiSelect($('tpMapel'), mapel, 'Semua mata pelajaran');
      opsiSelect($('tpKelas'), kelas, 'Semua kelas');
      opsiSelect($('abPaket'), m.pakets.map(function (p) { return { v: p.id, t: p.nama + ' — ' + p.mapel }; }), null, G.paket);
      aturKelasButir();
    }).catch(function (e) { UE.toast(e.message, 'err'); });
  }
  function aturPaketRekap() {
    var mp = $('exMapel').value.toUpperCase(), kl = $('exKelas').value;
    var list = G.meta.pakets.filter(function (p) { return (!mp || (p.mapel || '').toUpperCase() === mp) && (!kl || untukKelas(p, kl)); });
    opsiSelect($('exPaket'), list.map(function (p) { return { v: p.id, t: p.nama + (mp ? '' : ' — ' + p.mapel) }; }), 'Semua ujian');
  }
  function aturKelasButir() {
    var p = G.meta.pakets.filter(function (x) { return x.id === $('abPaket').value; })[0];
    var kelas = kelasDari(G.meta.users).filter(function (k) { return !p || untukKelas(p, k); });
    opsiSelect($('abKelas'), kelas.map(function (k) { return { v: k, t: 'Kelas ' + k }; }), 'Semua kelas');
  }
  $('exMapel').addEventListener('change', aturPaketRekap);
  $('exKelas').addEventListener('change', aturPaketRekap);
  $('abPaket').addEventListener('change', aturKelasButir);

  function angkaKKM() { var v = $('exKKM').value; return v === '' || isNaN(+v) ? 75 : Math.max(0, Math.min(100, +v)); }
  function batasEssay() { var v = +$('exBatas').value; return v >= 1 && v <= 100 ? v : 50; }
  function opsiDokumen() {
    return { kkm: angkaKKM(), tanggal: $('lapTanggal').value, ttd: $('exTTD').checked, kota: $('lapKota').value, tp: $('lapTP').value,
      guru: $('lapGuru').value, nipGuru: $('lapNipGuru').value, kepsek: $('lapKepsek').value, nipKepsek: $('lapNipKepsek').value };
  }
  function labelFilter(f) {
    var p = f.paket && G.meta.pakets.filter(function (x) { return x.id === f.paket; })[0];
    return [f.kelas ? 'Kelas ' + f.kelas : 'Semua kelas', f.mapel || (p ? p.mapel : 'Semua mata pelajaran'), p ? p.nama : 'Semua ujian'].join(' · ');
  }
  function namaFile(awal, f) {
    var bagian = [awal, f.mapel || (f.paket ? '' : 'Semua-Mapel'), f.kelas ? 'Kelas-' + f.kelas : 'Semua-Kelas', f.paket || '', new Date().toISOString().slice(0, 10)];
    return bagian.filter(String).join('_').replace(/[^\w.\-]+/g, '-') + '.xlsx';
  }
  function sibuk(btn, on, teks) {
    if (on) { btn.dataset.asli = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + teks; }
    else { btn.disabled = false; if (btn.dataset.asli) btn.innerHTML = btn.dataset.asli; }
  }
  /** Ambil data guruRekap lalu buat dokumen. PDF: tab dibuka lebih dulu agar tidak diblokir browser. */
  function jalankanEkspor(btn, req, pdf, buat) {
    var w = null;
    if (pdf) {
      w = window.open('', '_blank');
      if (!w) { UE.toast('Browser memblokir tab baru. Izinkan pop-up untuk situs ini.', 'err'); return; }
      w.document.write('<p style="font-family:sans-serif;padding:30px">Menyiapkan dokumen…</p>');
    }
    sibuk(btn, true, pdf ? 'Menyiapkan PDF…' : 'Menyiapkan Excel…');
    Promise.all([guru('guruRekap', req, 180000), pdf ? null : window.Ekspor.muat()]).then(function (r) { return buat(r[0], w); })
      .then(function (pesan) { if (pesan) UE.toast(pesan, 'ok'); })
      .catch(function (e) {
        if (w) w.document.body.innerHTML = '<p style="font-family:sans-serif;padding:30px;color:#b00">' + UE.esc(e.message) + '</p>';
        UE.toast(e.message, 'err');
      })
      .finally(function () { sibuk(btn, false); });
  }

  function eksporHasil(btn, pdf) {
    var f = { kelas: $('exKelas').value, mapel: $('exMapel').value, paket: $('exPaket').value };
    var opsi = { kkm: angkaKKM(), batas: batasEssay(), urut: $('exUrut').value, tidakIkut: $('exTidakIkut').checked, remedial: $('exRemedial').checked,
      perTP: $('exPerTP').checked, perSheet: $('exSheet').checked, label: labelFilter(f) };
    jalankanEkspor(btn, f, pdf, function (data, w) {
      var R = window.Rekap.hasil(data, opsi);
      if (!R.grup.length) throw new Error(opsi.remedial ? 'Tidak ada siswa yang belum tuntas untuk pilihan ini.' : 'Belum ada hasil ujian yang masuk untuk pilihan ini.');
      if (pdf) { window.Laporan.rekapHasil(w, Object.assign(opsiDokumen(), opsi), R); return; }
      return window.Ekspor.hasil(R, opsi, namaFile(opsi.remedial ? 'Daftar_Remedial' : 'Rekap_Hasil', f)).then(function () { return 'File Excel rekap hasil sudah diunduh'; });
    });
  }
  function eksporTP(btn, pdf) {
    var f = { kelas: $('tpKelas').value, mapel: $('tpMapel').value };
    var opsi = { kkm: angkaKKM(), batas: batasEssay(), analisis: $('tpAnalisis').checked, label: labelFilter(f).split(' · ').slice(0, 2).join(' · ') };
    jalankanEkspor(btn, f, pdf, function (data, w) {
      var T = window.Rekap.tp(data, opsi);
      if (!T.mapel.length) throw new Error('Belum ada soal yang memiliki Tujuan Pembelajaran untuk pilihan ini. Isi kolom TUJUAN_PEMBELAJARAN di sheet SOAL_PG / SOAL_ESSAY (atau lewat menu Bank Soal).');
      if (pdf) { window.Laporan.daftarTP(w, Object.assign(opsiDokumen(), opsi), T); return; }
      return window.Ekspor.tp(T, opsi, namaFile('Daftar_TP', f)).then(function () { return 'File Excel daftar TP sudah diunduh'; });
    });
  }
  function eksporButir(btn, pdf) {
    var f = { paket: $('abPaket').value, kelas: $('abKelas').value };
    if (!f.paket) { UE.toast('Pilih ujian dulu', 'err'); return; }
    var opsi = { kkm: angkaKKM(), batas: batasEssay(), label: labelFilter(f) };
    jalankanEkspor(btn, f, pdf, function (data, w) {
      var B = window.Rekap.butir(data, opsi);
      if (!B || !B.N) throw new Error('Belum ada jawaban siswa yang masuk untuk ujian/kelas ini.');
      if (pdf) { window.Laporan.analisisButir(w, Object.assign(opsiDokumen(), opsi), B); return; }
      return window.Ekspor.butir(B, opsi, namaFile('Analisis_Butir', f)).then(function () { return 'File Excel analisis butir sudah diunduh'; });
    });
  }
  $('btnExXlsx').addEventListener('click', function () { eksporHasil(this, false); });
  $('btnExPdf').addEventListener('click', function () { eksporHasil(this, true); });
  $('btnTpXlsx').addEventListener('click', function () { eksporTP(this, false); });
  $('btnTpPdf').addEventListener('click', function () { eksporTP(this, true); });
  $('btnAbXlsx').addEventListener('click', function () { eksporButir(this, false); });
  $('btnAbPdf').addEventListener('click', function () { eksporButir(this, true); });

  /* ================== CRUD UI ================== */
  function renderMasterSiswa() {
    var d = G.data; if(!d.users) return;
    var cariEl = $('cariMasterSiswa');
    var cari = cariEl ? cariEl.value.trim().toLowerCase() : '';
    var list = d.users.filter(function(u) { return !cari || u.n.toLowerCase().indexOf(cari) >= 0 || u.u.indexOf(cari) >= 0; });
    var tbl = $('tblMasterSiswa');
    if(tbl) {
      tbl.querySelector('tbody').innerHTML = list.map(function(u) {
        return '<tr><td><b>' + UE.esc(u.u) + '</b></td><td>***</td><td>' + UE.esc(u.n) + '</td><td>' + UE.esc(u.k) + '</td>' +
        '<td><button class="btn btn-blue btn-sm" data-editsiswa="' + UE.esc(u.u) + '">Edit</button> ' +
        '<button class="btn btn-red btn-sm" data-hapussiswa="' + UE.esc(u.u) + '">Hapus</button></td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">Tidak ada data</td></tr>';
    }
  }
  if($('cariMasterSiswa')) $('cariMasterSiswa').addEventListener('input', renderMasterSiswa);

  function renderMasterPaket() {
    var d = G.data; if(!d.pakets) return;
    var tbl = $('tblMasterPaket');
    if(tbl) {
      tbl.querySelector('tbody').innerHTML = d.pakets.map(function(p) {
        return '<tr><td><b>' + UE.esc(p.id) + '</b></td><td>' + UE.esc(p.nama) + '</td><td>' + UE.esc(p.mapel) + '</td><td>' + UE.esc(p.kelas.join(', ')) + '</td>' +
        '<td>' + UE.esc(p.mode) + '</td><td>' + p.durasiMenit + '</td><td>' + (p.acak?'YA':'TIDAK') + '</td><td>' + (p.acakOpsi?'YA':'TIDAK') + '</td>' +
        '<td>' + (p.tampil?'YA':'TIDAK') + '</td><td>' + (p.aktif?'YA':'TIDAK') + '</td>' +
        '<td><button class="btn btn-blue btn-sm" data-editpaket="' + UE.esc(p.id) + '">Edit</button> ' +
        '<button class="btn btn-red btn-sm" data-hapuspaket="' + UE.esc(p.id) + '">Hapus</button></td></tr>';
      }).join('') || '<tr><td colspan="11" class="muted">Tidak ada paket</td></tr>';
    }
    
    var sel = $('selMasterPaketSoal');
    if(sel && d.pakets.length > 0) {
      var curr = sel.value || d.pakets[0].id;
      sel.innerHTML = d.pakets.map(function(p) { return '<option value="' + UE.esc(p.id) + '">' + UE.esc(p.nama) + ' (' + UE.esc(p.id) + ')</option>'; }).join('');
      sel.value = curr;
    }
  }

  /** Form sederhana di modal. Field: {label, type, multi (textarea), wide (selebar form), list + opsi (saran isian)} */
  function openFormPrompt(fields, values, onSimpan, judul) {
    var wrap = document.createElement('div'); wrap.className = 'modal-wrap';
    var formHtml = fields.map(function(f, i) {
      var v = UE.esc(values[i] == null ? '' : values[i]);
      var inp = f.multi ? '<textarea class="input" rows="3" id="in_f' + i + '">' + v + '</textarea>'
        : '<input class="input" ' + (f.type === 'password' ? 'type="password" ' : '') + (f.list ? 'list="' + f.list + '" ' : '') + 'id="in_f' + i + '" value="' + v + '">';
      return '<label class="field' + (f.wide ? ' wide' : '') + '"><span>' + f.label + '</span>' + inp + '</label>';
    }).join('');
    var saran = fields.filter(function (f) { return f.list && f.opsi && f.opsi.length; }).map(function (f) {
      return '<datalist id="' + f.list + '">' + f.opsi.map(function (o) { return '<option value="' + UE.esc(o) + '">'; }).join('') + '</datalist>';
    }).join('');
    wrap.innerHTML = '<div class="modal board" style="width:min(' + (fields.length > 6 ? 780 : 440) + 'px,100%)">' +
      (judul ? '<h2 class="board-title">' + UE.esc(judul) + '</h2>' : '') +
      '<form id="genForm"><div class="form-grid">' + formHtml + '</div>' + saran +
      '<div class="modal-actions"><button type="button" class="btn btn-wood" id="genBatal">Batal</button><button type="submit" class="btn btn-green">Simpan</button></div></form></div>';
    document.body.appendChild(wrap);
    var form = wrap.querySelector('#genForm');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var res = fields.map(function(f, i) { return wrap.querySelector('#in_f'+i).value; });
      onSimpan(res);
      wrap.remove();
    });
    wrap.querySelector('#genBatal').addEventListener('click', function() { wrap.remove(); });
  }

  if($('tblMasterSiswa')) $('tblMasterSiswa').addEventListener('click', function(e) {
    var b = e.target.closest('button'); if(!b) return;
    if(b.dataset.hapussiswa) {
      if(confirm('Hapus siswa ' + b.dataset.hapussiswa + '?')) {
        guru('guruHapusSiswa', {username: b.dataset.hapussiswa}).then(function(){ muat(true); });
      }
    }
    if(b.dataset.editsiswa) {
      var u = G.data.users.find(function(x) { return x.u === b.dataset.editsiswa; });
      if(u) {
        openFormPrompt([{label:'Username'}, {label:'Password (kosongkan jika tidak diubah)', type:'password'}, {label:'Nama'}, {label:'Kelas'}],
        [u.u, '', u.n, u.k], function(res) {
          guru('guruSimpanSiswa', {usernamelama: u.u, username: res[0], password: res[1], nama: res[2], kelas: res[3]}).then(function(){ muat(true); });
        });
      }
    }
  });

  if($('btnTambahSiswa')) $('btnTambahSiswa').addEventListener('click', function() {
    openFormPrompt([{label:'Username'}, {label:'Password'}, {label:'Nama'}, {label:'Kelas'}],
    ['', '', '', ''], function(res) {
      guru('guruSimpanSiswa', {username: res[0], password: res[1], nama: res[2], kelas: res[3]}).then(function(){ muat(true); });
    });
  });

  if($('tblMasterPaket')) $('tblMasterPaket').addEventListener('click', function(e) {
    var b = e.target.closest('button'); if(!b) return;
    if(b.dataset.hapuspaket) {
      if(confirm('Hapus paket ' + b.dataset.hapuspaket + '?')) {
        guru('guruHapusPaket', {id: b.dataset.hapuspaket}).then(function(){ muat(true); });
      }
    }
    if(b.dataset.editpaket) {
      var p = G.data.pakets.find(function(x) { return x.id === b.dataset.editpaket; });
      if(p) {
        openFormPrompt([{label:'ID Paket'}, {label:'Nama Ujian'}, {label:'Mapel'}, {label:'Kelas (pisahkan koma)'}, {label:'Mode (TIMER/TIMERFIXED)'}, {label:'Durasi (menit)'}, {label:'Acak Soal (YA/TIDAK)'}, {label:'Acak Opsi (YA/TIDAK)'}, {label:'Tampil Nilai (YA/TIDAK)'}, {label:'Aktif (YA/TIDAK)'}],
        [p.id, p.nama, p.mapel, p.kelas.join(', '), p.mode, p.durasiMenit, p.acak?'YA':'TIDAK', p.acakOpsi?'YA':'TIDAK', p.tampil?'YA':'TIDAK', p.aktif?'YA':'TIDAK'], function(res) {
          guru('guruSimpanPaket', {idlama: p.id, id: res[0], nama: res[1], mapel: res[2], kelas: res[3], mode: res[4], durasi: res[5], acak: res[6], acakopsi: res[7], tampil: res[8], aktif: res[9]}).then(function(){ muat(true); });
        });
      }
    }
  });

  if($('btnTambahPaket')) $('btnTambahPaket').addEventListener('click', function() {
    openFormPrompt([{label:'ID Paket'}, {label:'Nama Ujian'}, {label:'Mapel'}, {label:'Kelas (pisahkan koma)'}, {label:'Mode (TIMER/TIMERFIXED)'}, {label:'Durasi (menit)'}, {label:'Acak Soal (YA/TIDAK)'}, {label:'Acak Opsi (YA/TIDAK)'}, {label:'Tampil Nilai (YA/TIDAK)'}, {label:'Aktif (YA/TIDAK)'}],
    ['', '', '', '', 'TIMER', '60', 'YA', 'YA', 'YA', 'YA'], function(res) {
      guru('guruSimpanPaket', {id: res[0], nama: res[1], mapel: res[2], kelas: res[3], mode: res[4], durasi: res[5], acak: res[6], acakopsi: res[7], tampil: res[8], aktif: res[9]}).then(function(){ muat(true); });
    });
  });

  var currentSoal = [];
  var FIELD_SOAL = [{label:'Tipe (PG/ES)'}, {label:'No'}, {label:'Soal', multi:true, wide:true}, {label:'Gambar URL', wide:true}, {label:'Opsi A'}, {label:'Opsi B'}, {label:'Opsi C'}, {label:'Opsi D'}, {label:'Opsi E'}, {label:'Kunci (A/B/C/D/E)'}, {label:'Pedoman (ES)', multi:true, wide:true}, {label:'Skor'}, {label:'Waktu (detik)'}, {label:'Tujuan Pembelajaran (TP)', wide:true, list:'dlTP'}];
  function fieldSoal() {
    var tp = {};
    currentSoal.forEach(function (s) { if (s.tp) tp[s.tp] = 1; });
    return FIELD_SOAL.map(function (f) { return f.list ? Object.assign({ opsi: Object.keys(tp) }, f) : f; });
  }
  function renderMasterSoal() {
    var tbl = $('tblMasterSoal'); if(!tbl) return;
    tbl.querySelector('tbody').innerHTML = currentSoal.map(function(s) {
      return '<tr><td><b>' + s.no + '</b></td><td><span class="tipe-tag '+(s.tipe.toLowerCase())+'">' + s.tipe + '</span></td>' +
      '<td style="max-width:350px; white-space:normal;" class="math-wrap">' + UE.esc(s.soal) + '</td>' +
      '<td>' + (s.gambar?'Ada':'Tidak') + '</td><td>' + s.skor + '</td><td>' + s.waktu + ' det</td>' +
      '<td class="tp-sel">' + (s.tp ? UE.esc(s.tp) : '<span class="pill warn">Belum diisi</span>') + '</td>' +
      '<td><button class="btn btn-blue btn-sm" data-editsoal="' + s.tipe + '|' + s.no + '">Edit</button> ' +
      '<button class="btn btn-red btn-sm" data-hapussoal="' + s.tipe + '|' + s.no + '">Hapus</button></td></tr>';
    }).join('') || '<tr><td colspan="8" class="muted">Tidak ada soal / Sedang memuat...</td></tr>';
    var adaTP = currentSoal.filter(function (s) { return s.tp; });
    var unik = {};
    adaTP.forEach(function (s) { unik[s.tp.replace(/\s+/g, ' ').trim().toLowerCase()] = 1; });
    $('infoTPSoal').textContent = currentSoal.length ? currentSoal.length + ' soal · ' + adaTP.length + ' sudah memiliki Tujuan Pembelajaran · ' +
      Object.keys(unik).length + ' TP berbeda' + (adaTP.length < currentSoal.length ? ' — lengkapi TP agar laporan ketercapaian akurat.' : '') : '';
    
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([tbl]).catch(function (err) { console.log(err.message); });
    }
  }

  function fetchSoal(paket) {
    if(!paket) return;
    currentSoal = []; renderMasterSoal();
    guru('guruAmbilSoal', {paket: paket}).then(function(res) {
      currentSoal = res.soal;
      renderMasterSoal();
    });
  }

  if($('selMasterPaketSoal')) $('selMasterPaketSoal').addEventListener('change', function() { fetchSoal(this.value); });
  document.querySelectorAll('.tab[data-tab="t-master-soal"]').forEach(function(t) {
    t.addEventListener('click', function() { if($('selMasterPaketSoal') && $('selMasterPaketSoal').value) fetchSoal($('selMasterPaketSoal').value); });
  });

  if($('btnTambahSoal')) $('btnTambahSoal').addEventListener('click', function() {
    var pkt = $('selMasterPaketSoal').value; if(!pkt) return alert('Pilih paket dulu!');
    var noBaru = currentSoal.filter(function (s) { return s.tipe === 'PG'; }).reduce(function (m, s) { return Math.max(m, s.no); }, 0) + 1;
    openFormPrompt(fieldSoal(),
    ['PG', noBaru, '', '', '', '', '', '', '', '', '', '2', '60', ''], function(res) {
      guru('guruSimpanSoal', {paket: pkt, tipe: res[0], no: res[1], soal: res[2], gambar: res[3], A: res[4], B: res[5], C: res[6], D: res[7], E: res[8], kunci: res[9], pedoman: res[10], skor: res[11], waktu: res[12], tp: res[13]})
        .then(function(){ UE.toast('Soal tersimpan', 'ok'); fetchSoal(pkt); }).catch(function (e) { UE.toast(e.message, 'err'); });
    }, 'Tambah soal');
  });

  if($('tblMasterSoal')) $('tblMasterSoal').addEventListener('click', function(e) {
    var b = e.target.closest('button'); if(!b) return;
    var pkt = $('selMasterPaketSoal').value;
    if(b.dataset.hapussoal) {
      var arr = b.dataset.hapussoal.split('|');
      if(confirm('Hapus soal ini?')) {
        guru('guruHapusSoal', {paket: pkt, tipe: arr[0], no: arr[1]}).then(function(){ fetchSoal(pkt); });
      }
    }
    if(b.dataset.editsoal) {
      var arr = b.dataset.editsoal.split('|');
      var s = currentSoal.find(function(x) { return x.tipe === arr[0] && x.no == arr[1]; });
      if(s) {
        var isPg = s.tipe === 'PG';
        var opsiTeks = function (k) { var o = isPg ? s.opsi.filter(function (x) { return x.k === k; })[0] : null; return o ? o.t : ''; };
        openFormPrompt(fieldSoal(),
        [s.tipe, s.no, s.soal, s.gambar||'', opsiTeks('A'), opsiTeks('B'), opsiTeks('C'), opsiTeks('D'), opsiTeks('E'), s.kunci||'', s.pedoman||'', s.skor, s.waktu, s.tp||''], function(res) {
          guru('guruSimpanSoal', {paket: pkt, tipe: res[0], nolama: s.no, no: res[1], soal: res[2], gambar: res[3], A: res[4], B: res[5], C: res[6], D: res[7], E: res[8], kunci: res[9], pedoman: res[10], skor: res[11], waktu: res[12], tp: res[13]})
            .then(function(){ UE.toast('Soal tersimpan', 'ok'); fetchSoal(pkt); }).catch(function (e) { UE.toast(e.message, 'err'); });
        }, 'Edit soal ' + (isPg ? 'PG' : 'essay') + ' no ' + s.no);
      }
    }
  });

  function downloadCSV(filename, content) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  function parseCSV(str) {
    var sep = str.indexOf('\t') > -1 ? '\t' : (str.indexOf(';') > -1 ? ';' : ',');
    var res = [], row = [], inQ = false, val = '';
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c === '"') inQ = !inQ;
      else if (c === sep && !inQ) { row.push(val.replace(/^"|"$/g, '').trim()); val = ''; }
      else if ((c === '\n' || c === '\r') && !inQ) {
        if (c === '\r' && str[i+1] === '\n') i++;
        row.push(val.replace(/^"|"$/g, '').trim()); res.push(row); row = []; val = '';
      } else { val += c; }
    }
    if (val !== '' || str[str.length-1] === sep) row.push(val.replace(/^"|"$/g, '').trim());
    if (row.length > 0) res.push(row);
    return res;
  }

  if($('btnTemplateSiswa')) $('btnTemplateSiswa').addEventListener('click', function() {
    downloadCSV("template_siswa.csv", "username,password,nama,kelas\nsiswa1,1234,Andi,8A\nsiswa2,1234,Budi,8A");
  });

  if($('btnTemplateSoal')) $('btnTemplateSoal').addEventListener('click', function() {
    var t = prompt("Template untuk PG atau ES? (Ketik PG atau ES)", "PG");
    if(t === 'PG') downloadCSV("template_soal_pg.csv", "no,soal,gambar,A,B,C,D,E,kunci,skor,waktu,tujuan_pembelajaran\n1,Ini contoh soal PG,,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E,A,2,60,Menjelaskan konsep kalor\n2,\"Soal PG mengandung koma, lho!\",,A,B,C,D,E,B,2,60,\"Menghitung kalor, suhu, dan massa\"");
    else if(t === 'ES') downloadCSV("template_soal_es.csv", "no,soal,gambar,pedoman,skor,waktu,tujuan_pembelajaran\n1,Ini contoh soal Essay,,Pedoman jawaban,5,120,Menjelaskan konsep kalor");
  });

  if($('btnImportSiswa')) $('btnImportSiswa').addEventListener('click', function() {
    var csv = prompt("Buka Excel, isi data siswa, lalu COPY semua barisnya dan PASTE ke sini:\n(Atau paste isi file CSV)");
    if(!csv) return;
    var rows = parseCSV(csv).filter(function(r){ return r.length >= 4 && r[0].toLowerCase() !== 'username'; });
    if(rows.length === 0) return alert('Format tidak valid atau data kosong.');
    var data = rows.map(function(r) { return {username:r[0], password:r[1], nama:r[2], kelas:r[3]}; });
    guru('guruImportSiswa', {data: data}).then(function(){ muat(true); UE.toast('Import Berhasil', 'ok'); });
  });

  if($('btnImportSoal')) $('btnImportSoal').addEventListener('click', function() {
    var pkt = $('selMasterPaketSoal').value; if(!pkt) return alert('Pilih paket dulu!');
    var t = prompt("Ketik PG untuk import soal Pilihan Ganda, atau ES untuk Essay");
    if(t !== 'PG' && t !== 'ES') return;
    var csv = prompt("Buka Excel, isi soal Anda, lalu COPY semua barisnya dan PASTE ke sini:\n(Atau paste isi file CSV)");
    if(!csv) return;
    var rows = parseCSV(csv).filter(function(r){ return r.length >= 4 && isNaN(parseInt(r[0])) === false; });
    if(rows.length === 0) return alert('Format tidak valid atau data kosong.');
    var data;
    // Kolom terakhir (opsional) = tujuan pembelajaran
    if(t === 'PG') {
      data = rows.map(function(r) { return {paket:pkt, no:r[0], soal:r[1], gambar:r[2], A:r[3], B:r[4], C:r[5], D:r[6], E:r[7], kunci:r[8], skor:r[9], waktu:r[10], tp:r[11]}; });
    } else {
      data = rows.map(function(r) { return {paket:pkt, no:r[0], soal:r[1], gambar:r[2], pedoman:r[3], skor:r[4], waktu:r[5], tp:r[6]}; });
    }
    guru('guruImportSoal', {tipe: t, data: data}).then(function(){ fetchSoal(pkt); UE.toast('Import Berhasil', 'ok'); })
      .catch(function (e) { UE.toast(e.message, 'err'); });
  });

  if (G.pw) { show('g-main'); muat(); } else show('g-login');
})();