// ======================================================================
// Swing Choreo Studio — arayüz
// ======================================================================
(function () {
  'use strict';
  const S = SCS;
  const ANAHTAR = 'swing-choreo-studio.v1';
  let DB = null;
  let kayitOk = true;
  let indirici = null;
  // claude.ai görüntüleyicisinin içinde mi, yoksa kendi adresinde mi çalışıyor
  const CLAUDE_ICINDE = !!(window.claude && typeof window.claude.use === 'function');
  let kaliciDepo = null;
  const ui = {
    rota: { gorunum: 'sarkilar' }, sekme: {}, secKoreo: {}, secOge: null, ara: '', hareketDuzen: null,
    sesler: {}, tap: [], analiz: null, mikrofon: null, mikHata: null, silOnay: null, silZaman: null,
    yeniForm: null, yeniUyari: null, yeniOnay: false, metinGoster: false, yedekGoster: false, yedekGelen: null, prBas: {},
  };

  // ---------------- yardımcılar ----------------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sayi = S.sayi;
  function toast(m) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }
  function sureMetni(sn) { if (sn == null || isNaN(sn)) return ''; const m = Math.floor(sn / 60), s = Math.round(sn - m * 60); return `${m}:${String(s).padStart(2, '0')}`; }
  // "1, 5" ya da "7&" gibi vurgu sayımlarını okur (1–8, yarım sayım "&" ile)
  function vurguOku(v) {
    const out = [];
    for (const p of String(v || '').split(/[\s,;]+/).filter(Boolean)) {
      const yarim = /&$/.test(p);
      const n = parseFloat(p.replace('&', '').replace(',', '.'));
      if (n >= 1 && n <= 8) out.push(n + (yarim ? 0.5 : 0));
    }
    return [...new Set(out)].sort((a, b) => a - b);
  }
  function sureOku(v) {
    v = String(v).trim().replace(',', '.');
    if (!v) return null;
    const m = v.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
    if (m) return +m[1] * 60 + +m[2];
    const n = parseFloat(v);
    return isNaN(n) || n <= 0 ? null : n;
  }
  const tarih = (ts) => { try { return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  const ENERJI = { 1: 'Düşük', 2: 'Orta', 3: 'Yüksek' };
  const SEVIYE = { 1: 'Başlangıç', 2: 'Orta', 3: 'İleri' };
  const STIL = { klasik: 'Klasik Solo Jazz', enerjik: 'Enerjik Swing', eglenceli: 'Eğlenceli Jazz', ritmik: 'Ritmik ve keskin' };
  const TEKRAR = { 1: 'Az', 2: 'Normal', 3: 'Fazla' };
  const UZUNLUK = { tum: 'Tüm şarkı', ilk: 'İlk bölüm', secili: 'Seçtiğim bölüm' };
  const KAYNAK = { dosya: 'Ses dosyası analizi', mikrofon: 'Mikrofonla dinleme', dokunma: 'Dokunarak', elle: 'Elle girildi', web: 'Web sitesi', ornek: 'Örnek değer' };
  const AGIRLIK = { any: 'Fark etmez', L: 'Sol ayakta', R: 'Sağ ayakta' };
  const BOLUMLER = ['Giriş', 'A', 'B', 'C', 'D', 'Solo', 'Shout', 'Son'];
  const varsayilanAyar = () => ({ seviye: 2, enerji: 2, stil: 'klasik', tekrar: 2, uzunluk: 'tum', bas: 1, bit: 8, uyum: 'normal' });
  const UYUM = { normal: 'Normal', guclu: 'Güçlü' };
  const HASSASIYET = { az: 'Az', orta: 'Orta', cok: 'Çok' };

  function spotifyId(s) {
    if (!s) return null;
    s = s.trim();
    let m = s.match(/spotify:track:([A-Za-z0-9]{22})/);
    if (m) return m[1];
    m = s.match(/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-zA-Z]{2})?\/)?(?:embed\/)?track\/([A-Za-z0-9]{22})/);
    return m ? m[1] : undefined;
  }

  // ---------------- veri ----------------
  function kaydet() {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(DB)); kayitOk = true; } catch (e) { kayitOk = false; }
  }
  function hareketNormal(m) {
    const v = { lengthOptions: null, flexStart: false, accents: [], vurguSayimlari: [], weightStart: 'any', weightEnd: 'any', mirror: false, sekizSerbest: true, kullan: true, bpmMin: 60, bpmMax: 300, desc: '', video: '', variations: '', kind: 'hareket', travel: 'yerinde', energy: 2, level: 1, character: 'groove', start: 1, length: 8 };
    for (const k in v) if (m[k] === undefined || m[k] === null && k !== 'lengthOptions') m[k] = v[k];
    return m;
  }
  function duzelt() {
    // sürüm 2: kullanıcının sayımıyla Boogie Forward 8'de başlar (varsayılanı değiştirilmediyse)
    if (!DB.version || DB.version < 2) {
      const bf = (DB.moves || []).find((m) => m.id === 'boogie-forward');
      if (bf && bf.builtin && bf.start === 1) bf.start = 8;
    }
    // sürüm 3: kütüphaneye yeni vernacular jazz hareketleri (olmayanlar eklenir, var olanlara dokunulmaz)
    if (!DB.version || DB.version < 3) {
      DB.moves = DB.moves || [];
      for (const m of S.varsayilanHareketler()) if (!DB.moves.some((x) => x.id === m.id)) DB.moves.push(m);
    }
    // sürüm 4: hareketlerin vurgu sayımları (varsayılan hareketlere öneri; kullanıcı düzeltir)
    if (!DB.version || DB.version < 4) {
      for (const m of DB.moves || []) if (m.vurguSayimlari === undefined) m.vurguSayimlari = (S.VARSAYILAN_VURGU[m.id] || []).slice();
    }
    DB.version = 4;
    for (const k of ['moves', 'songs', 'choreos']) if (!Array.isArray(DB[k])) DB[k] = [];
    const sis = S.varsayilanHareketler();
    for (const id of ['poz', 'freeze']) if (!DB.moves.some((m) => m.id === id)) DB.moves.push(sis.find((m) => m.id === id));
    DB.moves.forEach(hareketNormal);
  }
  function yukle() {
    try {
      const s = localStorage.getItem(ANAHTAR);
      if (s) { DB = JSON.parse(s); duzelt(); return; }
    } catch (e) { kayitOk = false; }
    DB = { version: 1, moves: S.varsayilanHareketler(), songs: [], choreos: [] };
    const s = ornekSarki();
    DB.songs.push(s);
    koreoUret(s, varsayilanAyar(), 'Örnek koreografi', [], 12345);
    kaydet();
  }
  function ornekSarki() {
    const e = [];
    const desen = [[2, 2, 2, 3], [2, 2, 3, 3], [1, 1, 2, 2], [3, 3, 3, 3]];
    for (let i = 0; i < 14; i++) e.push(...desen[i % 4]);
    return {
      id: S.uid('s'), example: true, title: 'Deneme şarkısı', artist: 'Örnek veri, gerçek bir kayıt değil', year: '', album: '',
      spotifyId: null, bpm: 180, bpmOlcum: 180, bpmKaynak: 'ornek', bpmSources: [{ id: S.uid('k'), kaynak: 'ornek', bpm: 180, tarih: Date.now(), not: 'Uygulamayı denemek için' }],
      durationSec: 150, firstOneSec: 4, beats: null, originIdx: null, energy: e.slice(0, 55),
      breaks: [124, 125], accents: [31, 63, 126, 223],
      sections: [{ beat: 0, label: 'A' }, { beat: 64, label: 'B' }, { beat: 96, label: 'A' }, { beat: 192, label: 'B' }, { beat: 224, label: 'A' }, { beat: 320, label: 'B' }, { beat: 352, label: 'A' }, { beat: 416, label: 'Son' }],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }
  const sarki = (id) => DB.songs.find((s) => s.id === id);
  const hareket = (id) => DB.moves.find((m) => m.id === id) || S.varsayilanHareketler().find((m) => m.id === id && (id === 'poz' || id === 'freeze'));
  const koreolari = (sid) => DB.choreos.filter((c) => c.songId === sid).sort((a, b) => a.createdAt - b.createdAt);
  function aktifKoreo(s) {
    const l = koreolari(s.id);
    return l.find((c) => c.id === ui.secKoreo[s.id]) || l[l.length - 1] || null;
  }
  function koreoUret(s, ayar, ad, sabitler, seed) {
    const aralik = S.aralikHesapla(s, ayar);
    const items = S.olustur({ song: s, moves: DB.moves, ayar, aralik, sabitler: sabitler || [], seed });
    const c = { id: S.uid('c'), songId: s.id, name: ad, settings: Object.assign({}, ayar), range: aralik, items, createdAt: Date.now(), updatedAt: Date.now() };
    DB.choreos.push(c);
    ui.secKoreo[s.id] = c.id;
    return c;
  }
  function yonMetni(it, m) {
    if (!it.side || !m || !m.mirror) return '';
    if (m.travel === 'yana') return it.side === 'L' ? ' (sola)' : ' (sağa)';
    return it.side === 'L' ? ' (sol)' : ' (sağ)';
  }
  function kaynakEkle(s, kaynak, bpm, not) {
    s.bpmSources = s.bpmSources || [];
    s.bpmSources.push({ id: S.uid('k'), kaynak, bpm: Math.round(bpm * 10) / 10, tarih: Date.now(), not: not || '' });
  }
  function iliski(v, ref) {
    if (!ref) return '';
    const r = v / ref;
    if (Math.abs(r - 1) < 0.03) return 'uyumlu';
    if (Math.abs(r - 0.5) < 0.02) return 'yarısı';
    if (Math.abs(r - 2) < 0.06) return 'iki katı';
    return `%${r > 1 ? '+' : ''}${Math.round((r - 1) * 100)} farklı`;
  }

  // Tempo yorumu değişince (yarım/çift) analiz vuruşları da ölçeklenir
  function tempoYorumu(s, yeni) {
    const eski = s.bpm;
    s.bpm = Math.round(yeni * 10) / 10;
    if (!eski || !s.beats || s.originIdx == null) return;
    let r = yeni / eski, adim = 0;
    while (Math.abs(r - 1) > 0.05 && adim++ < 3) {
      if (Math.abs(r - 2) < 0.15 || r > 2) { vuruslariCiftle(s); r /= 2; }
      else if (Math.abs(r - 0.5) < 0.04 || r < 0.5) { vuruslariYarila(s); r *= 2; }
      else break;
    }
  }
  function vuruslariCiftle(s) {
    const b = s.beats, out = [];
    for (let i = 0; i < b.length; i++) { out.push(b[i]); if (i + 1 < b.length) out.push(Math.round((b[i] + b[i + 1]) * 500) / 1000); }
    s.beats = out; s.originIdx *= 2;
    if (s.analiz) for (const k of ['vDb', 'vOn', 'ozel']) if (s.analiz[k]) s.analiz[k] = s.analiz[k].flatMap((v, i, a) => (i + 1 < a.length ? [v, v] : [v]));
    s.accents = (s.accents || []).map((x) => x * 2); s.breaks = (s.breaks || []).flatMap((x) => [x * 2, x * 2 + 1]);
    s.sections = (s.sections || []).map((x) => ({ beat: x.beat * 2, label: x.label }));
    s.energy = (s.energy || []).flatMap((e) => [e, e]);
  }
  function vuruslariYarila(s) {
    const par = s.originIdx % 2;
    s.beats = s.beats.filter((_, i) => i % 2 === par); s.originIdx = (s.originIdx - par) / 2;
    if (s.analiz) for (const k of ['vDb', 'vOn', 'ozel']) if (s.analiz[k]) s.analiz[k] = s.analiz[k].filter((_, i) => i % 2 === par);
    s.accents = [...new Set((s.accents || []).map((x) => Math.floor(x / 2)))]; s.breaks = [...new Set((s.breaks || []).map((x) => Math.floor(x / 2)))];
    s.sections = (s.sections || []).map((x) => ({ beat: Math.floor(x.beat / 64) * 32, label: x.label }));
    s.energy = (s.energy || []).filter((_, i) => i % 2 === 0);
  }

  // ---------------- gezinme ----------------
  function rotaOku() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('sarki-') && sarki(h.slice(6))) return { gorunum: 'sarki', id: h.slice(6) };
    if (h === 'hareketler') return { gorunum: 'hareketler' };
    if (h === 'yedek') return { gorunum: 'yedek' };
    if (h === 'koreografiler') return { gorunum: 'koreografiler' };
    return { gorunum: 'sarkilar' };
  }
  function git(h) {
    ui.secOge = null; ui.metinGoster = false;
    try { if (location.hash !== '#' + h) history.replaceState(null, '', '#' + h); } catch (e) { /* hash yazılamıyorsa sayfa içi kalır */ }
    ui.rota = (() => {
      if (h.startsWith('sarki-')) return { gorunum: 'sarki', id: h.slice(6) };
      if (h === 'hareketler' || h === 'yedek' || h === 'koreografiler') return { gorunum: h };
      return { gorunum: 'sarkilar' };
    })();
    ciz();
    window.scrollTo(0, 0);
  }

  // ---------------- çizim ----------------
  function ciz() {
    if (T.calisiyor && !(ui.rota.gorunum === 'sarki' && ui.sekme[ui.rota.id] === 'prova')) takipDurdur();
    const r = ui.rota;
    let govde = '';
    if (r.gorunum === 'sarki' && sarki(r.id)) govde = vSarki(sarki(r.id));
    else if (r.gorunum === 'hareketler') govde = vHareketler();
    else if (r.gorunum === 'koreografiler') govde = vKoreografiler();
    else if (r.gorunum === 'yedek') govde = vYedek();
    else govde = vSarkilar();
    const aktif = (g) => (r.gorunum === g || (g === 'sarkilar' && r.gorunum === 'sarki') ? ' aria-current="page"' : '');
    $('#uygulama').innerHTML = `
      <header class="ust"><div class="kap ust-ic">
        <a class="marka" href="#sarkilar" data-act="git" data-h="sarkilar"><b>Swing Choreo Studio</b><span>5 6 7 8</span></a>
        <nav class="gezinme" aria-label="Bölümler">
          <a href="#sarkilar" data-act="git" data-h="sarkilar"${aktif('sarkilar')}>Şarkılar</a>
          <a href="#koreografiler" data-act="git" data-h="koreografiler"${aktif('koreografiler')}>Koreografiler</a>
          <a href="#hareketler" data-act="git" data-h="hareketler"${aktif('hareketler')}>Hareketler</a>
          <a href="#yedek" data-act="git" data-h="yedek"${aktif('yedek')}>Yedek</a>
        </nav>
      </div></header>
      <main class="kap">${kayitOk ? '' : '<p class="not uyari" style="margin-bottom:16px">Bu tarayıcı verileri kaydetmiyor (gizli pencere ya da engellenmiş depolama). Yaptıkların sayfa kapanınca kaybolur; Yedek bölümünden JSON olarak al.</p>'}${govde}</main>`;
    sonraCiz();
  }

  // ---- Şarkılar ----
  function vSarkilar() {
    const f = ui.yeniForm || {};
    const liste = [...DB.songs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const satirlar = liste.map((s) => {
      const n = koreolari(s.id).length;
      if (ui.sarkiDuzen === s.id) {
        // listede yerinde düzenleme
        const alan = (k, ad, v, ek) => `<label>${ad}<input data-ch="sarki-alan" data-id="${s.id}" data-alan="${k}" value="${esc(v)}" ${ek || ''}></label>`;
        return `<div class="panel sarki-duzen">
          <div class="izgara2">${alan('title', 'Şarkı adı', s.title)}${alan('artist', 'Sanatçı', s.artist, 'placeholder="ör. Slim &amp; Slam"')}${alan('year', 'Kayıt yılı', s.year, 'inputmode="numeric"')}${alan('album', 'Albüm ya da versiyon notu', s.album)}</div>
          ${alan('spotify', 'Spotify şarkı bağlantısı', s.spotifyId ? 'https://open.spotify.com/track/' + s.spotifyId : '', 'placeholder="https://open.spotify.com/track/…"')}
          <div class="satir"><button class="btn ana kucuk" data-act="sarki-duzen-bitti">Bitti</button>${silDugme('sarki-' + s.id, 'sarki-sil', `data-id="${s.id}"`, n ? `Sil (${n} koreografisiyle)` : 'Sil')}</div>
        </div>`;
      }
      const alt = [s.artist || 'sanatçı eklenmedi', s.year, n ? `${n} koreografi` : 'koreografi yok', s.spotifyId ? 'Spotify bağlı' : ''].filter(Boolean).map(esc).join(' · ');
      return `<div class="sarki-kart">
        <a class="sarki-satir" href="#sarki-${s.id}" data-act="git" data-h="sarki-${s.id}">
          <div style="min-width:0"><div class="ad">${esc(s.title)} ${s.example ? '<span class="cip">örnek</span>' : ''}</div><div class="alt">${alt}</div></div>
          <div class="bpm-buyuk">${s.bpm ? sayi(s.bpm) : '—'}<small>BPM</small></div></a>
        <div class="sarki-arac"><button class="btn kucuk" data-act="sarki-duzen" data-id="${s.id}">Düzenle</button>${silDugme('sarki-' + s.id, 'sarki-sil', `data-id="${s.id}"`)}</div>
      </div>`;
    }).join('');
    return `<div class="yigin">
      ${ui.girisKodu ? `<section class="panel not bilgi" style="gap:8px"><b>Spotify girişi burada tamamlanamadı</b>
        <p class="kucuk">iPhone girişi ayrı bir tarayıcı görünümünde açtı. Bu kodu kopyala, ana ekrandaki uygulamaya dön ve Şarkılar sayfasındaki "kodu yapıştır" alanına yapıştır (birkaç dakika geçerli).</p>
        <input id="giris-kodu-goster" readonly value="${esc(ui.girisKodu)}"><div><button class="btn kucuk ana" data-act="giris-kodu-kopyala">Kodu kopyala</button></div></section>` : ''}
      <section class="panel" style="gap:12px">
        <h2>Şarkı ekle</h2>
        <div class="satir"><label class="btn ana" for="dosya-ekle" style="color:var(--surface)">Ses dosyasından ekle</label>
          <input type="file" id="dosya-ekle" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" hidden data-ch="dosya-ekle">
          <span class="kucuk soluk">Telefondaki ya da bilgisayardaki şarkı dosyası (MP3, M4A, WAV…): şarkı eklenir ve analizi hemen başlar. Dosya cihazdan çıkmaz.</span></div>
        <form data-form="yeni-sarki" class="yigin" style="gap:12px" autocomplete="off">
          <p class="kucuk soluk">Ya da bilgileri yazarak ekle (tempoyu sonra şarkının sayfasında bulursun):</p>
          <div class="izgara2"><label>Şarkı adı<input id="ys-ad" value="${esc(f.ad)}" required placeholder="ör. Night Train"></label><label>Sanatçı (bu kaydın)<input id="ys-sanatci" value="${esc(f.sanatci)}" placeholder="ör. Jonah Jones"></label></div>
          <div class="izgara2"><label>Kayıt yılı<input id="ys-yil" value="${esc(f.yil)}" inputmode="numeric" placeholder="ör. 1958"></label><label>Albüm ya da versiyon notu<input id="ys-album" value="${esc(f.album)}" placeholder="ör. canlı kayıt"></label></div>
          <label>Spotify şarkı bağlantısı (isteğe bağlı)<input id="ys-spotify" value="${esc(f.spotify)}" placeholder="https://open.spotify.com/track/…"></label>
          ${ui.yeniUyari ? `<p class="not uyari">${ui.yeniUyari}</p>` : ''}
          <div class="satir"><button class="btn" type="submit">${ui.yeniOnay ? 'Yine de ekle (farklı kayıt)' : 'Şarkıyı ekle'}</button>${ui.yeniOnay ? '<button class="btn" type="button" data-act="yeni-vazgec">Vazgeç</button>' : ''}</div>
        </form>
      </section>
      <section class="yigin" style="gap:10px"><h2>Şarkılarım</h2>
        ${satirlar ? `<div class="liste">${satirlar}</div>` : '<div class="panel bos-durum">Henüz şarkı yok. Yukarıdan ilk şarkını ekle.</div>'}
      </section>
      ${SPOTIFY_VAR ? `<details class="panel" ${ui.yapistirGoster || bekleyenGiris() || (bagli() && HS.calan) ? 'open' : ''}>
        <summary><b>Spotify ile ekle</b> <span class="kucuk soluk">(isteğe bağlı)</span></summary>
        <div class="yigin" style="gap:10px;margin-top:10px">
          <div id="calan-kart">${calanKartHtml()}</div>
          <div class="satir"><button class="btn kucuk" data-act="spotify-ekle">Kopyalanan Spotify bağlantısından ekle</button></div>
          ${ui.yapistirGoster ? `<label>Bağlantıyı buraya yapıştır<input id="sp-yapistir" placeholder="https://open.spotify.com/track/…" autocomplete="off"></label>
            ${ui.yapistirHata ? `<p class="not uyari">${esc(ui.yapistirHata)}</p>` : '<p class="kucuk soluk">Uygulama panoyu okuyamadı; bağlantıyı buraya yapıştır.</p>'}` : ''}
          <p class="kucuk soluk">Spotify şarkının sesini vermez: Spotify'dan eklenen şarkıda analiz için dosya yükle ya da "Dinlerken işaretle"yi kullan.</p>
        </div>
      </details>` : ''}</div>`;

  }
  function yeniSarki(v) {
    return Object.assign({ id: S.uid('s'), title: '', artist: '', year: '', album: '', spotifyId: null, bpm: null, bpmOlcum: null, bpmKaynak: null, bpmSources: [], durationSec: null, firstOneSec: 0, beats: null, originIdx: null, energy: [], breaks: [], accents: [], sections: [], createdAt: Date.now(), updatedAt: Date.now() }, v);
  }
  // Spotify bağlantısıyla tek adımda ekleme; şarkı adı Spotify'ın paylaşım bilgisinden (oEmbed) gelir
  async function spotifyIleEkle(metin) {
    const id = spotifyId(String(metin || '').trim());
    if (!id) {
      ui.yapistirGoster = true;
      ui.yapistirHata = metin && String(metin).trim() ? 'Bu bir Spotify şarkı bağlantısı değil. Spotify\'da şarkıyı aç → Paylaş → Bağlantıyı kopyala (albüm ya da çalma listesi değil).' : null;
      ciz();
      setTimeout(() => { const i = $('#sp-yapistir'); if (i) i.focus(); }, 50);
      return;
    }
    const varOlan = DB.songs.find((x) => x.spotifyId === id);
    if (varOlan) { ui.yapistirGoster = false; toast(`“${varOlan.title}” zaten ekli; açıyorum.`); git('sarki-' + varOlan.id); return; }
    const s = yeniSarki({ spotifyId: id, title: 'Spotify şarkısı' });
    DB.songs.push(s); kaydet();
    ui.yapistirGoster = false; ui.yapistirHata = null;
    git('sarki-' + s.id);
    try {
      const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/track/' + id));
      if (r.ok) { const j = await r.json(); if (j && j.title) { s.title = j.title; s.updatedAt = Date.now(); kaydet(); ciz(); } }
    } catch (e) { /* ad gelmezse elle yazılır */ }
    toast('Şarkı eklendi. Sanatçıyı ve yılı Kayıt bilgisi bölümünden ya da listede "Düzenle" ile ekleyebilirsin.');
  }

  // ---- Şarkı ----
  function vSarki(s) {
    const sek = ui.sekme[s.id] || 'tempo';
    const top = S.toplamVurus(s);
    const ara = encodeURIComponent(`${s.title} ${s.artist || ''}`.trim());
    const sekmeler = [['tempo', 'Tempo'], ['harita', 'Müzik haritası'], ['koreo', 'Koreografi'], ['prova', 'Prova']];
    let icerik = '';
    if (sek === 'tempo') icerik = vTempo(s);
    else if (sek === 'harita') icerik = vHarita(s);
    else if (sek === 'koreo') icerik = vKoreo(s);
    else icerik = vProva(s);
    return `<div class="sarki-bas">
        <a class="geri" href="#sarkilar" data-act="git" data-h="sarkilar">← Şarkılar</a>
        <h1>${esc(s.title)}</h1>
        <div class="satir">
          <span class="soluk">${esc([s.artist, s.year, s.album].filter(Boolean).join(' · '))}</span>
          <span class="cip brass mono">${s.bpm ? sayi(s.bpm) + ' BPM' : 'BPM yok'}</span>
          ${top ? `<span class="cip">${Math.ceil(top / 8)} sekizlik · ${Math.ceil(top / 32)} cümle</span>` : ''}
          ${s.example ? '<span class="cip">örnek veri</span>' : ''}
        </div>
        <div class="satir kucuk">
          ${s.spotifyId ? `<a href="https://open.spotify.com/track/${s.spotifyId}" target="_blank" rel="noopener">Spotify'da aç</a>` : ''}
          <a href="https://open.spotify.com/search/${ara}" target="_blank" rel="noopener">Spotify'da ara</a>
          <a href="https://www.google.com/search?q=${encodeURIComponent(`"${s.title}" ${s.artist || ''} BPM`)}" target="_blank" rel="noopener">Web'de BPM ara</a>
        </div>
      </div>
      <div class="sekmeler" role="tablist">${sekmeler.map(([k, ad]) => `<button role="tab" aria-selected="${sek === k}" data-act="sekme" data-k="${k}">${ad}</button>`).join('')}</div>
      ${icerik}`;
  }

  function vTempo(s) {
    const kaynaklar = s.bpmSources || [];
    const ref = s.bpmOlcum || s.bpm;
    const yorumlar = ref ? [[ref / 2, 'yarım tempo'], [ref, 'seçilen ölçüm'], [ref * 2, 'çift tempo']].filter(([v]) => v >= 40 && v <= 400).map(([v, ad]) => {
      const olasi = v >= 100 && v <= 260;
      return `<button class="yorum" aria-pressed="${Math.abs(v - s.bpm) < 0.6}" data-act="yorum" data-v="${v}"><b>${sayi(v)}</b><span>${ad}${olasi ? ' · dans sayımına uygun' : ''}</span></button>`;
    }).join('') : '';
    const tablo = kaynaklar.length ? `<div class="tablo-kap"><table>
        <thead><tr><th>Kaynak</th><th>BPM</th><th>Seçilene göre</th><th>Tarih</th><th></th></tr></thead>
        <tbody>${kaynaklar.map((k) => `<tr><td>${esc(KAYNAK[k.kaynak] || k.kaynak)}${k.not ? `<div class="kucuk soluk">${esc(k.not)}</div>` : ''}</td>
          <td class="sayi">${sayi(k.bpm)}</td><td class="kucuk">${esc(iliski(k.bpm, ref))}</td><td class="kucuk soluk">${tarih(k.tarih)}</td>
          <td><div class="satir" style="justify-content:flex-end"><button class="btn kucuk" data-act="kaynak-kullan" data-id="${k.id}">Kullan</button>${silDugme('k-' + k.id, 'kaynak-sil', `data-id="${k.id}"`)}</div></td></tr>`).join('')}</tbody></table></div>` : '<p class="ipucu">Henüz ölçüm yok.</p>';
    const tutmuyor = kaynaklar.length > 1 && kaynaklar.some((k) => !['uyumlu', 'yarısı', 'iki katı'].includes(iliski(k.bpm, ref)));
    const a = s.analiz;
    const mik = ui.mikrofon && ui.mikrofon.songId === s.id;
    const an = ui.analiz && ui.analiz.songId === s.id ? ui.analiz : null;
    return `<div class="yigin">
      <section class="panel">
        <div class="satir ara"><h2>Tempo</h2>${s.bpmKaynak ? `<span class="cip">${esc(KAYNAK[s.bpmKaynak] || s.bpmKaynak)}</span>` : ''}</div>
        <div class="bpm-ana"><span class="deger">${s.bpm ? sayi(s.bpm) : '—'}</span><span class="soluk">BPM</span></div>
        ${ref ? `<div class="yigin" style="gap:8px"><p class="ipucu">Tempo yorumu: swing kayıtlarında aynı şarkı yarım ya da çift tempoda sayılabilir. Dansta saydığın vuruşa uyanı seç; koreografi ve sayım bu değere göre kurulur.</p><div class="yorumlar">${yorumlar}</div></div>` : '<p class="ipucu">Henüz tempo yok. Aşağıdaki yollardan biriyle bul: ses dosyası, mikrofon, dokunma ya da elle.</p>'}
        <h3>Ölçümler</h3>
        ${tablo}
        ${tutmuyor ? '<p class="not uyari">Kaynaklar birbirini tutmuyor. Şarkıyı çalarken dokunarak ölç ve hangisinin doğru olduğuna kulağınla karar ver.</p>' : ''}
        <p class="not bilgi">Otomatik BPM neden sınırlı: Spotify, Kasım 2024'ten beri yeni uygulamalara tempo ve analiz verisi vermiyor. Bu sayfa güvenlik gereği dış servislere de bağlanamıyor. Bu yüzden tempo sesten ölçülür ya da senin bulduğun değer girilir. "Web'de BPM ara" bağlantısıyla bulduğun değeri "Web sitesi" kaynağıyla ekleyip öbür ölçümlerle karşılaştırabilirsin. Eski swing kayıtlarında sitelerdeki değerler sık sık yarım ya da çift tempo çıkar.</p>
      </section>

      <div class="izgara2">
        <section class="panel" style="gap:10px">
          <h3>Dokunarak bul</h3>
          <p class="ipucu">Şarkıyı çal, vuruşlara en az 8 kez dokun. Bilgisayarda boşluk tuşu da çalışır.</p>
          <button class="dokun" data-tap="1" id="tap-btn">Vuruşa dokun</button>
          <div class="satir ara"><span id="tap-sonuc" class="mono">${tapMetni()}</span>
            <span class="satir"><button class="btn kucuk" data-act="tap-sifirla">Sıfırla</button><button class="btn kucuk ana" data-act="tap-kaydet">Kaydet</button></span></div>
        </section>
        <section class="panel" style="gap:10px">
          <h3>Elle ekle</h3>
          <form data-form="elle-bpm" class="yigin" style="gap:10px">
            <label>BPM<input id="elle-bpm" inputmode="decimal" placeholder="ör. 180"></label>
            <label>Nereden<select id="elle-kaynak"><option value="elle">Kendim saydım / biliyorum</option><option value="web">Bir web sitesinden</option></select></label>
            <label>Not (isteğe bağlı)<input id="elle-not" placeholder="ör. hangi site, hangi versiyon"></label>
            <div><button class="btn" type="submit">Ölçümlere ekle</button></div>
          </form>
        </section>
      </div>

      ${SPOTIFY_VAR && s.spotifyId ? `<section class="panel" style="gap:10px">
        <h3>Dinlerken işaretle</h3>
        <p class="ipucu">Bu şarkı Spotify'da çalarken dokun; her dokunuş şarkının Spotify'daki saniyesine yazılır, şarkının farklı yerlerinde parça parça yapabilirsin. Vuruşlara "Vuruş"a dokun (en az 8), sonra "Bulunan tempoyu kullan". Dansın ilk 1'inde "1"e, müzik durduğunda "Break"e, güçlü darbede "Vurgu"ya dokun.${bagli() ? '' : ' (Spotify\'a bağlı değilsen sadece alttaki önizleme oynatıcısının çaldığı 30 saniyede çalışır.)'}</p>
        <div id="isaret-durum" class="kucuk mono">${esc(isaretDurumu(s))}</div>
        <button class="dokun" data-isaret="vurus">Vuruş</button>
        <div class="izgara3"><button class="btn" data-isaret="bir">1</button><button class="btn" data-isaret="break">Break</button><button class="btn" data-isaret="vurgu">Vurgu</button></div>
        <div class="satir"><button class="btn kucuk ana" data-act="isaret-tempo">Bulunan tempoyu kullan</button>${silDugme('isaret-' + s.id, 'isaret-sifirla', `data-id="${s.id}"`, 'Vuruş dokunuşlarını sil')}</div>
      </section>` : ''}

      <section class="panel">
        <div class="yigin" style="gap:6px"><h3>Sesten analiz</h3>
        <p class="ipucu">Tempo, vuruşlar, ilk "1", sekizliklerin enerjisi, break ve vurgu önerileri sesten ölçülür. Dosya cihazından çıkmaz ve saklanmaz; sadece sonuçlar kaydedilir. Spotify kaydıyla aynı versiyonu kullan.</p></div>
        <div class="satir">
          <label class="btn ana" for="ses-dosya" style="color:var(--surface)">Ses dosyası seç</label>
          <input type="file" id="ses-dosya" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" hidden data-ch="ses-dosya">
          ${mik ? '' : '<button class="btn" data-act="mikrofon">Mikrofonla dinle</button>'}
        </div>
        ${!mik && SPOTIFY_VAR && s.spotifyId ? '<p class="not bilgi">Deneysel (iPhone): "Mikrofonla dinle"ye bastıktan sonra alttaki Spotify oynatıcısında Çal\'a bas. Spotify çalmaya devam ederse kayıt Spotify zamanıyla eşlenir ve prova sayacı ayarsız oturur. Yine susarsa iPhone buna izin vermiyor demektir: şarkıyı başka bir cihazdan hoparlörle çal.</p>' : ''}
        ${mik ? `<div class="yigin" style="gap:8px"><p><b>Dinleniyor</b> · <span id="mik-sure" class="mono">0:00</span>. Şarkıyı hoparlörden baştan sona çal (kulaklıkla mikrofon duymaz). Kayıt sırasında sarma ya da durdurma.</p>
          <p class="kucuk" id="mik-spotify"></p>
          <div class="seviye-cubuk"><i id="mik-seviye"></i></div>
          <div class="satir"><button class="btn ana" data-act="mik-bitir">Bitir ve analiz et</button><button class="btn" data-act="mik-vazgec">Vazgeç</button></div></div>` : ''}
        ${ui.mikHata ? `<p class="not uyari">${esc(ui.mikHata)}</p>` : ''}
        <div id="analiz-durum">${analizDurumu(an)}</div>
        ${s.sesDosyasi ? `<div class="satir"><span class="kucuk">Uygulamada saklı dosya: <b>${esc(s.sesDosyasi.ad)}</b> (${boyutMetni(s.sesDosyasi.boyut || 0)}). Prova'da hazır; sayım vuruşlara kilitli ilerler.</span>
          ${silDugme('ses-' + s.id, 'ses-sil', `data-id="${s.id}"`, 'Dosyayı uygulamadan sil')}</div>`
          : ui.sesler[s.id] ? `<p class="kucuk soluk">Bu oturumda yüklü: ${esc(ui.sesler[s.id].ad)} (uygulamada saklanamadı).</p>` : ''}
        ${a ? `<div class="not">
            <b>Son analiz (${esc(KAYNAK[a.kaynak] || a.kaynak)}, ${tarih(a.tarih)}):</b> ölçülen tempo ${sayi(a.bpm)} BPM${Math.abs(a.bpmSon - a.bpmBas) / a.bpmBas > 0.03 ? ` (başta ${sayi(a.bpmBas)}, sonda ${sayi(a.bpmSon)}: kayıtta tempo kayıyor; sayım bulunan vuruşları izler)` : ''}.
            Tempo adayları: ${a.adaylar.map((x) => `${sayi(x.bpm)} (güç ${x.guc})`).join(', ')}.
            İlk 1 tahmini ${sayi(s.firstOneSec)} sn, güven ${esc(a.guven)}. Müzik haritası sekmesinde ilk 1'i kaydırarak düzeltebilirsin.
            ${s.haritaElle ? '<div style="margin-top:8px"><button class="btn kucuk" data-act="analiz-uygula">Analiz önerilerini haritaya uygula (elle işaretlerin yerine geçer)</button></div>' : ''}
          </div>` : ''}
      </section>

      <section class="panel">
        <h3>Süre ve ilk "1"</h3>
        ${s.beats ? `<p class="ipucu">Bu değerler analizden geliyor. İlk 1'i Müzik haritası sekmesinde kaydırabilirsin.</p>` : '<p class="ipucu">Ses analizi yoksa koreografinin uzunluğu süre ve BPM\'den hesaplanır. İlk 1: şarkının başından dansın ilk sayımına kadar geçen süre.</p>'}
        <div class="izgara2">
          <label>Süre (dk:sn)<input data-ch="sarki-alan" data-alan="durationSec" value="${esc(sureMetni(s.durationSec))}" placeholder="ör. 2:45" ${s.beats ? 'disabled' : ''}></label>
          <label>İlk 1 (saniye)<input data-ch="sarki-alan" data-alan="firstOneSec" inputmode="decimal" value="${s.firstOneSec != null ? esc(sayi(s.firstOneSec)) : ''}" placeholder="ör. 3,5" ${s.beats ? 'disabled' : ''}></label>
        </div>
        ${S.toplamVurus(s) ? `<p class="kucuk soluk">Dans edilecek bölüm: ${S.toplamVurus(s)} vuruş = ${Math.ceil(S.toplamVurus(s) / 8)} sekizlik, ${Math.ceil(S.toplamVurus(s) / 32)} cümle (32'lik).</p>` : ''}
      </section>

      <section class="panel">
        <h3>Kayıt bilgisi</h3>
        <div class="izgara2">
          <label>Şarkı adı<input data-ch="sarki-alan" data-alan="title" value="${esc(s.title)}"></label>
          <label>Sanatçı<input data-ch="sarki-alan" data-alan="artist" value="${esc(s.artist)}"></label>
          <label>Kayıt yılı<input data-ch="sarki-alan" data-alan="year" value="${esc(s.year)}"></label>
          <label>Albüm ya da versiyon notu<input data-ch="sarki-alan" data-alan="album" value="${esc(s.album)}"></label>
        </div>
        <label>Spotify şarkı bağlantısı<input data-ch="sarki-alan" data-alan="spotify" value="${s.spotifyId ? 'https://open.spotify.com/track/' + s.spotifyId : ''}" placeholder="https://open.spotify.com/track/…"></label>
        <div>${silDugme('sarki-' + s.id, 'sarki-sil', `data-id="${s.id}"`, 'Şarkıyı ve koreografilerini sil')}</div>
      </section>
    </div>`;
  }
  function analizDurumu(an) {
    if (!an) return '';
    if (an.hata) return `<p class="not uyari">${esc(an.hata)}</p>`;
    if (an.bitti) return `<p class="not bilgi">${esc(an.bitti)}</p>`;
    return `<div class="yigin" style="gap:6px"><span class="kucuk">${esc(an.durum || 'Hazırlanıyor…')}</span><div class="ilerleme"><i style="width:${Math.round((an.oran || 0) * 100)}%"></i></div></div>`;
  }
  function analizCiz() {
    const el = $('#analiz-durum');
    const an = ui.analiz && ui.rota.id === ui.analiz.songId ? ui.analiz : null;
    if (el) el.innerHTML = analizDurumu(an);
  }

  // ---- Müzik haritası ----
  function vHarita(s) {
    const top = S.toplamVurus(s);
    if (!top) return `<div class="panel bos-durum">Harita için önce Tempo sekmesinde BPM ve süreyi gir ya da sesten analiz yap.</div>`;
    const acc = new Set(s.accents || []), brk = new Set(s.breaks || []);
    const cumleler = Math.ceil(top / 32);
    let html = '';
    for (let j = 0; j < cumleler; j++) {
      const isaretli = (s.sections || []).find((x) => x.beat === j * 32);
      const suren = S.bolumEtiketi(s, j * 32 - 0.5);
      const secenek = [...new Set([...BOLUMLER, isaretli ? isaretli.label : ''])].filter(Boolean);
      let bloklar = '';
      for (let k = j * 4; k < Math.min(j * 4 + 4, Math.ceil(top / 8)); k++) {
        const e = S.blokEnerji(s, k);
        let sayimlar = '';
        for (let c = 0; c < 8; c++) {
          const b = k * 8 + c;
          if (b >= top) { sayimlar += '<span></span>'; continue; }
          const cls = brk.has(b) ? 'b' : acc.has(b) ? 'v' : '';
          sayimlar += `<button class="${cls}" data-act="isaret" data-b="${b}" aria-label="${k + 1}. sekizlik, ${c + 1}. sayım${cls === 'b' ? ', break' : cls === 'v' ? ', vurgu' : ''}">${c + 1}</button>`;
        }
        bloklar += `<div class="blok"><div class="blok-ust"><span>${k + 1}. sekizlik</span>
          <button class="enerji" data-act="enerji" data-k="${k}" title="Enerji: ${ENERJI[e]} (değiştirmek için dokun)" aria-label="${k + 1}. sekizlik enerjisi ${ENERJI[e]}">${[1, 2, 3].map((x) => `<i class="${x <= e ? 'dolu' : ''}"></i>`).join('')}</button></div>
          <div class="sayimlar">${sayimlar}</div></div>`;
      }
      html += `<section class="cumle"><div class="cumle-bas"><h3>${j + 1}. cümle</h3>
        <label class="yan kucuk">Bölüm <select data-ch="bolum" data-c="${j}" style="width:auto;padding:4px 8px">
          <option value="">${suren ? `— (${esc(suren)} sürüyor)` : '—'}</option>
          ${secenek.map((l) => `<option ${isaretli && isaretli.label === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select></label></div><div class="bloklar">${bloklar}</div></section>`;
    }
    const intro = s.firstOneSec ? `Giriş: ilk 1, şarkının ${sayi(s.firstOneSec)}. saniyesinde.` : 'İlk 1 şarkının başında.';
    return `<div class="yigin">
      <section class="panel">
        <div class="yigin" style="gap:6px"><h2>Müzik haritası</h2>
        <p class="ipucu">Her kutu bir sekizlik, her satır bir 32'lik cümle. Sayıma dokun: önce vurgu (hit), sonra break, sonra temiz. Enerji çubuklarına dokunarak sekizliğin enerjisini değiştir. ${s.analiz ? 'Analizden gelen işaretler öneridir; şarkıyı dinleyerek düzelt.' : 'Ses analizi yoksa işaretleri sen koyarsın.'}</p></div>
        <div class="lejant"><span><i style="background:var(--brass)"></i>Vurgu: güçlü müzik darbesi</span><span><i style="background:var(--break)"></i>Break: müzik durur, Freeze konur</span><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Temiz</span></div>
        <div class="satir"><span class="kucuk">${intro}</span></div>
        ${s.analiz && s.beats ? `<div class="satir kucuk"><label class="yan">Vurgu hassasiyeti <select data-ch="vurgu-hassasiyet" style="width:auto;padding:4px 8px">${Object.entries(HASSASIYET).map(([k, ad]) => `<option value="${k}" ${(s.vurguHassasiyet || 'orta') === k ? 'selected' : ''}>${ad}</option>`).join('')}</select></label>
          <span class="soluk">${(s.accents || []).length} vurgu işaretli. "Çok": darbesi bol parçalarda daha fazla darbe işaretlenir (her 32 sayımda 4'e kadar); "Az": sadece en belirginleri. Değiştirince analizden gelen vurgular yenilenir, elle koyduğun vurguların yerini alır.</span></div>` : ''}
        <div class="satir kucuk"><span>İlk 1'i kaydır:</span>
          <button class="btn kucuk" data-act="ilk1" data-d="-8">−8</button><button class="btn kucuk" data-act="ilk1" data-d="-1">−1</button>
          <button class="btn kucuk" data-act="ilk1" data-d="1">+1</button><button class="btn kucuk" data-act="ilk1" data-d="8">+8</button>
          <span class="soluk">vuruş. İşaretler müzikte aynı yerde kalır.</span></div>
      </section>
      ${html}
    </div>`;
  }

  // ---- Koreografi ----
  function ayarSecimi(k, deger, secenekler) {
    return `<select data-ch="ayar" data-k="${k}">${Object.entries(secenekler).map(([v, ad]) => `<option value="${v}" ${String(deger) === String(v) ? 'selected' : ''}>${esc(ad)}</option>`).join('')}</select>`;
  }
  function vKoreo(s) {
    const top = S.toplamVurus(s);
    if (!top) return `<div class="panel bos-durum">Koreografi için önce Tempo sekmesinde BPM ve süreyi gir ya da sesten analiz yap.</div>`;
    const ayar = Object.assign(varsayilanAyar(), s.sonAyar || {});
    const bloklar = Math.ceil(top / 8);
    const blokSec = (k, v) => `<select data-ch="ayar" data-k="${k}">${Array.from({ length: bloklar }, (_, i) => `<option value="${i + 1}" ${+v === i + 1 ? 'selected' : ''}>${i + 1}. sekizlik</option>`).join('')}</select>`;
    const c = aktifKoreo(s);
    const liste = koreolari(s.id);
    return `<div class="yigin">
      <section class="panel">
        <div class="satir ara"><h2>Ayarlar</h2><span class="cip teal">Dans türü: Solo Jazz</span></div>
        <div class="izgara3">
          <label>Seviye${ayarSecimi('seviye', ayar.seviye, SEVIYE)}</label>
          <label>Enerji${ayarSecimi('enerji', ayar.enerji, ENERJI)}</label>
          <label>Stil${ayarSecimi('stil', ayar.stil, STIL)}</label>
          <label>Hareket tekrarı${ayarSecimi('tekrar', ayar.tekrar, TEKRAR)}</label>
          <label>Uzunluk${ayarSecimi('uzunluk', ayar.uzunluk, UZUNLUK)}</label>
          <label>Müziğe vurgu uyumu${ayarSecimi('uyum', ayar.uyum, UYUM)}</label>
          ${ayar.uzunluk === 'secili' ? `<label>Başlangıç${blokSec('bas', ayar.bas)}</label><label>Bitiş (dahil)${blokSec('bit', ayar.bit)}</label>` : ''}
        </div>
        <p class="ipucu">Enerji hem hareketlerin enerjisini hem yoğunluğu belirler: düşükte uzun ve akıcı hareketler, yüksekte kısa ve sık değişen hareketler. Seviye, üstündeki hareketleri dışarıda bırakır. Hareketin rahat tempo aralığı şarkının BPM'iyle uymuyorsa o hareket seçilmez.</p>
        ${s.bpm ? '' : '<p class="not uyari">BPM yok: hareketlerin tempo aralıkları dikkate alınmayacak.</p>'}
        <div class="satir"><button class="btn ana" data-act="koreo-yeni">Yeni koreografi oluştur</button>${c ? '<button class="btn" data-act="koreo-alternatif">Alternatif üret</button>' : ''}</div>
        ${c ? '<p class="kucuk soluk">Alternatif, seçili koreografinin ayarlarıyla yeni bir koreografi kurar; sabitlediğin hareketler aynı yerde kalır. Öbürü silinmez.</p>' : ''}
      </section>
      ${c ? vKoreoGoster(s, c, liste) : '<div class="panel bos-durum">Bu şarkıya henüz koreografi yok. Ayarları seç ve "Yeni koreografi oluştur"a bas.</div>'}
    </div>`;
  }

  function vKoreoGoster(s, c, liste) {
    const { uyarilar, bosluklar } = S.dogrula(c.items, s, DB.moves, c.range);
    const items = [...c.items].sort((a, b) => a.t - b.t);
    const uyariSay = [...uyarilar.values()].reduce((n, u) => n + (u.length ? 1 : 0), 0);
    const farkli = new Set(items.filter((x) => { const m = hareket(x.moveId); return m && m.kind !== 'poz'; }).map((x) => x.moveId)).size;
    const kilitli = items.filter((x) => x.locked).length;
    const ay = c.settings || {};
    const blokA = Math.floor(c.range[0] / 8 + 1e-6), blokB = Math.ceil(c.range[1] / 8 - 1e-6);
    let govde = '';
    let acikCumle = false;
    for (let k = blokA; k < blokB; k++) {
      if (k === blokA || k % 4 === 0) {
        if (acikCumle) govde += '</section>';
        const lab = S.bolumEtiketi(s, k * 8 + 0.5);
        govde += `<section class="koreo-cumle"><h3>${Math.floor(k / 4) + 1}. cümle${lab ? ' · ' + esc(lab) : ''}</h3>`;
        acikCumle = true;
      }
      const satirlar = [];
      for (const it of items) {
        const p = S.blokParcasi(it, k);
        if (p) satirlar.push({ a: p.a, html: ogeSatiri(s, c, it, p, uyarilar.get(it.id) || []) });
      }
      for (const g of bosluklar) {
        const p = S.blokParcasi(g, k);
        if (p) satirlar.push({ a: p.a, html: boslukSatiri(s, c, g, p) });
      }
      satirlar.sort((x, y) => x.a - y.a);
      const e = S.blokEnerji(s, k);
      const brk = (s.breaks || []).filter((b) => b >= k * 8 && b < k * 8 + 8).map((b) => S.sayim(b).etiket);
      const acc = (s.accents || []).filter((b) => b >= k * 8 && b < k * 8 + 8).map((b) => S.sayim(b).etiket);
      govde += `<div class="sekizlik"><div class="sekizlik-bas"><b>${k + 1}. sekizlik</b>
        <span class="cip">enerji ${ENERJI[e].toLocaleLowerCase('tr')}</span>
        ${acc.length ? `<span class="cip brass">vurgu ${acc.join(', ')}</span>` : ''}${brk.length ? `<span class="cip break">break ${brk.join(', ')}</span>` : ''}
        <button class="btn kucuk" data-act="blok-yenile" data-k="${k}">Bu sekizliği yeniden oluştur</button></div>
        ${satirlar.map((x) => x.html).join('')}</div>`;
    }
    if (acikCumle) govde += '</section>';
    return `<section class="panel">
        <div class="satir ara" style="align-items:flex-end">
          <label style="flex:1;min-width:200px">Koreografi<select data-ch="koreo-sec">${liste.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)} · ${tarih(x.createdAt)}</option>`).join('')}</select></label>
          <label style="flex:1;min-width:200px">Adı<input data-ch="koreo-ad" value="${esc(c.name)}"></label>
        </div>
        <div class="koreo-ozet">
          <span class="cip">${blokB - blokA} sekizlik (${blokA + 1}–${blokB})</span>
          <span class="cip">${items.length} hareket · ${farkli} farklı</span>
          ${kilitli ? `<span class="cip brass">${kilitli} sabit</span>` : ''}
          ${uyariSay ? `<span class="cip uyari">${uyariSay} uyarı</span>` : '<span class="cip teal">Sayım kontrolü temiz</span>'}
          ${bosluklar.length ? `<span class="cip uyari">${bosluklar.length} boşluk</span>` : ''}
          ${c.hazir ? '<span class="cip brass">Hazır</span>' : ''}
          <span class="cip">${esc(SEVIYE[ay.seviye] || '')} · enerji ${esc((ENERJI[ay.enerji] || '').toLocaleLowerCase('tr'))} · ${esc(STIL[ay.stil] || '')} · tekrar ${esc((TEKRAR[ay.tekrar] || '').toLocaleLowerCase('tr'))}</span>
        </div>
        ${uyariSay || bosluklar.length ? `<div class="not uyari satir ara"><span>${uyariSay ? `${uyariSay} harekette uyarı var` : ''}${uyariSay && bosluklar.length ? ', ' : ''}${bosluklar.length ? `${bosluklar.length} boşluk var` : ''}. Düzeltme hareketleri silmez: sadece yerlerini ve geçişlerini (8'de hazırlık, 8'i bırakma, gerekirse duruş) kurallara göre ayarlar. Boşluklara yeni hareket koyar. Sabitlediğin hareketlere dokunmaz.</span>
          <button class="btn kucuk ana" data-act="uyari-duzelt">Sayımları düzelt</button></div>` : ''}
        <div class="satir">
          <button class="btn kucuk" data-act="metin">${ui.metinGoster ? 'Metni gizle' : 'Metin olarak göster'}</button>
          <button class="btn kucuk" data-act="kilitsiz-yenile">Sabit olmayanları yeniden oluştur</button>
          <button class="btn kucuk" data-act="git-prova">Provaya geç</button>
          <button class="btn kucuk ${c.hazir ? '' : 'ana'}" data-act="hazir-isaret" data-id="${c.id}">${c.hazir ? 'Hazırlardan çıkar' : 'Hazır olarak işaretle'}</button>
          ${silDugme('koreo-' + c.id, 'koreo-sil', `data-id="${c.id}"`, 'Bu koreografiyi sil')}
        </div>
        ${ui.metinGoster ? `<pre class="metin" id="koreo-metin">${esc(S.metinCikar(c, s, DB.moves))}</pre><div><button class="btn kucuk" data-act="metin-kopyala">Kopyala</button></div>` : ''}
        <p class="kucuk soluk">Bir harekete dokununca araçlar açılır: sabitle, değiştir, yönünü çevir, sırasını değiştir, sil. Sayımlar sekizlik içindeki yerdir; "8 →" hazırlıkla sonraki sekizliğe bağlanan hareket demektir.</p>
      </section>
      ${govde}`;
  }

  // haric: değiştirilen öğe; maxL: boşluğa eklerken sığması gereken süre; tamL: aynı süreyi işaretlemek için
  function adayListesi(s, c, t, maxL, tamL, haric) {
    const ham = S.elleSecenekler({ song: s, moves: DB.moves, ayar: c.settings, aralik: c.range, items: c.items, t, haric });
    const out = [];
    for (const o of ham) {
      if (maxL != null && o.L > maxL + 1e-6) continue;
      let ad = o.ad + yonMetni({ side: o.side }, o);
      if (o.on) ad += " · 8'de hazırlıkla";
      if (o.bir) ad += " · 8'ini bırakır";
      out.push({ v: `${o.moveId}|${o.L}|${o.side || ''}|${o.on ? 1 : 0}|${o.bir ? 1 : 0}`, ad, L: o.L, tam: tamL != null && Math.abs(o.L - tamL) < 1e-6, sorun: o.sorun, seviyeUstu: o.seviyeUstu, kapali: o.kapali });
    }
    out.sort((a, b) => (!!a.sorun - !!b.sorun) || (!!a.kapali - !!b.kapali) || a.ad.localeCompare(b.ad, 'tr'));
    return out;
  }
  const adayEtiketi = (x, sureGoster) => esc(x.ad) + (sureGoster ? ` · ${sayi(x.L)} sayım` : '') + (x.sorun ? ' (kurala uymuyor)' : '') + (x.seviyeUstu ? ' (seviye üstü)' : '') + (x.kapali ? ' (otomatikte kapalı)' : '');

  function ogeSatiri(s, c, it, p, uy) {
    const m = hareket(it.moveId);
    const secili = ui.secOge === it.id && p.baslangic;
    const ad = m ? (it.moveId === 'freeze' ? 'Freeze' : m.name) : 'Silinmiş hareket';
    let alt;
    if (!p.baslangic) alt = 'önceki sekizlikten devam';
    else {
      const a = m ? S.aile(m) : '';
      const notlar = [`${sayi(m ? m.length : it.L)} sayım`];
      if (a === '8') notlar.push("8'de başlar, 7'de biter");
      if (it.on) notlar.push("8'de hazırlıkla girer");
      if (it.bir) notlar.push("8'ini sonraki harekete bırakır");
      if (it.moveId === 'freeze') notlar.push('müzikteki break');
      if (it.t < c.range[0]) notlar.push("girişin son sayımında başlar");
      const denk = m ? S.vurguDenkligi(it, m, s) : [];
      if (denk.length) notlar.push(`vurgu müzikteki darbeye denk (${denk.map((b) => S.sayim(b).etiket).join(', ')})`);
      alt = notlar.join(' · ');
    }
    let araclar = '';
    if (secili) {
      const adaylar = adayListesi(s, c, it.t, null, it.L, it.id);
      const tam = adaylar.filter((x) => x.tam), diger = adaylar.filter((x) => !x.tam);
      araclar = `<div class="oge-arac">
        <button class="btn kucuk" data-act="oge-kilit" data-id="${it.id}">${it.locked ? 'Sabiti kaldır' : 'Sabitle'}</button>
        <select data-ch="oge-degistir" data-id="${it.id}" aria-label="Hareketi değiştir"><option value="">Değiştir…</option>
          ${tam.length ? `<optgroup label="Aynı süre (${sayi(it.L)} vuruş)">${tam.map((x) => `<option value="${x.v}">${adayEtiketi(x, false)}</option>`).join('')}</optgroup>` : ''}
          ${diger.length ? `<optgroup label="Başka süre (arkası yeniden kurulur)">${diger.map((x) => `<option value="${x.v}">${adayEtiketi(x, true)}</option>`).join('')}</optgroup>` : ''}
        </select>
        ${m && m.mirror ? `<button class="btn kucuk" data-act="oge-ayna" data-id="${it.id}">Yönünü çevir</button>` : ''}
        <button class="btn kucuk" data-act="oge-tasi" data-id="${it.id}" data-d="-1">Öncekiyle yer değiştir</button>
        <button class="btn kucuk" data-act="oge-tasi" data-id="${it.id}" data-d="1">Sonrakiyle yer değiştir</button>
        <button class="btn kucuk tehlike" data-act="oge-sil" data-id="${it.id}">Sil</button>
        ${m ? `<button class="btn kucuk" data-act="hareket-ac" data-id="${m.id}">Sayımını düzenle</button>` : ''}
        ${m && m.video ? `<a class="btn kucuk" href="${esc(m.video)}" target="_blank" rel="noopener">Video</a>` : ''}
      </div>
      ${m && m.desc ? `<div class="uyarilar"><p style="color:var(--muted)">${esc(m.desc)}</p></div>` : ''}`;
    }
    return `<div class="oge ${p.baslangic ? '' : 'devam'} ${secili ? 'secili' : ''}">
      <button class="oge-ana" ${p.baslangic ? `data-act="oge-sec" data-id="${it.id}"` : 'tabindex="-1" style="cursor:default"'}>
        <span class="oge-sayim">${(p.baslangic ? '' : '↳ ') + p.metin}</span>
        <span class="oge-ad">${esc(ad)}${esc(yonMetni(it, m))}<small>${alt}</small></span>
        <span class="oge-isaret">${it.locked ? '<span class="kilit">Sabit</span>' : ''}${uy.length && p.baslangic ? `<span class="cip uyari">${uy.length} uyarı</span>` : ''}</span>
      </button>
      ${araclar}
      ${uy.length && p.baslangic ? `<div class="uyarilar">${uy.map((u) => `<p>${esc(u)}</p>`).join('')}
        ${ui.sigmayan && ui.sigmayan.has(it.id) ? '<p style="color:var(--fg)">Sayımı düzeltilemedi: bu hareket kendi sayımıyla buraya ancak arkasındaki hareketler bir sekizlik kayarsa sığıyor, ileride de boş yer yok. Seçeneklerin: önceki hareketin "8\'i bırakılabilir" ayarını aç, yakındaki bir hareketi sil ya da "Değiştir" ile başka hareket seç.</p>' : ''}
        <div>${it.locked ? '<span class="kucuk soluk">Sabit olduğu için otomatik düzeltilmez; sabitini kaldır ya da elle değiştir.</span>' : `<button class="btn kucuk" data-act="oge-duzelt" data-id="${it.id}">Sayımını düzelt</button>`}</div></div>` : ''}
    </div>`;
  }

  function boslukSatiri(s, c, g, p) {
    const ilk = p.baslangic;
    let araclar = '';
    if (ilk) {
      const adaylar = adayListesi(s, c, g.t, g.L, null);
      araclar = `<div class="oge-arac">
        <button class="btn kucuk ana" data-act="bosluk-doldur" data-t="${g.t}" data-l="${g.L}">Otomatik doldur</button>
        <select data-ch="bosluk-ekle" data-t="${g.t}" aria-label="Boşluğa hareket ekle"><option value="">Hareket ekle…</option>
          ${adaylar.map((x) => `<option value="${x.v}">${adayEtiketi(x, true)}</option>`).join('')}</select>
      </div>`;
    }
    return `<div class="oge bosluk"><div class="oge-ana" style="cursor:default"><span class="oge-sayim">${p.metin}</span>
      <span class="oge-ad">Boş<small>${ilk ? `${sayi(g.L)} vuruş hareketsiz. Bu yere sadece burada başlayabilen hareketler listelenir.` : 'boşluk sürüyor'}</small></span><span></span></div>${araclar}</div>`;
  }

  // ---- Prova ----
  function vProva(s) {
    const c = aktifKoreo(s);
    if (!c) return '<div class="panel bos-durum">Prova için önce Koreografi sekmesinde bir koreografi oluştur.</div>';
    const liste = koreolari(s.id);
    const ses = ui.sesler[s.id];
    const blokA = Math.floor(c.range[0] / 8), blokB = Math.ceil(c.range[1] / 8);
    const bas = Math.min(Math.max(ui.prBas[s.id] ?? blokA, blokA), blokB - 1);
    return `<div class="prova">
      ${liste.length > 1 ? `<label>Koreografi<select data-ch="koreo-sec">${liste.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
      <div class="sahne" aria-live="off">
        <div class="konum" id="pr-konum">Başlamaya hazır · ${esc(c.name)}</div>
        <div class="simdi" id="pr-simdi">${esc(ilkHareketAdi(c, bas * 8))}</div>
        <div class="sayac" id="pr-sayac">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<span>${n}</span>`).join('')}</div>
        <div class="sonraki" id="pr-sonraki">&nbsp;</div>
      </div>
      <section class="panel">
        ${ses ? `<div class="yigin" style="gap:8px"><h3>Dosyayla prova</h3><audio id="pr-ses" controls preload="auto" src="${ses.url}" style="width:100%"></audio>
          <p class="ipucu">${ses.sakli ? 'Uygulamada saklı dosya. ' : ''}Dosyayı çal: sayım, analizde bulunan vuruşlara kilitli ilerler. İleri-geri sardığında sayım da gelir.</p></div>`
          : s.sesDosyasi ? '<p class="kucuk soluk">Saklı ses dosyası hazırlanıyor…</p>'
          : `<div class="satir"><label class="btn" for="pr-dosya">Ses dosyası seç</label><input type="file" id="pr-dosya" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" hidden data-ch="ses-dosya">
            <span class="kucuk soluk">Dosyayla prova için: dosya bir kez seçilir, analiz edilir ve uygulamada saklanır.</span></div>`}
        <div class="yigin" style="gap:8px">
          ${SPOTIFY_VAR && s.spotifyId ? `<h3>${ses ? 'Ya da Spotify ile' : 'Spotify ile prova'}</h3>
          <p class="ipucu">${bagli() ? 'Telefondaki Spotify\'da bu şarkıyı çal (ya da alttaki şeritten başlat)' : 'Alttaki Spotify oynatıcısında çal'}: sayım şarkının çalan anına kilitli, ileri sarınca sayım da gelir, durdurunca durur. Sayım müziğe oturmuyorsa şarkı seçili sekizliğin 1'ine geldiği anda aşağıdaki düğmeye dokun; bu ayar şarkıya kaydedilir.${s.spotifyKayma ? ` (Kayıtlı ayar: ${sayi(s.spotifyKayma)} sn)` : ''}</p>
          <label class="yan kucuk">Başlangıç <select id="pr-bas" data-ch="pr-bas" style="width:auto">${Array.from({ length: blokB - blokA }, (_, i) => `<option value="${blokA + i}" ${blokA + i === bas ? 'selected' : ''}>${blokA + i + 1}. sekizlik</option>`).join('')}</select></label>
          <button class="dokun" data-act="sp-ilk1" style="min-height:84px">Şu an seçili sekizliğin 1'i</button>
          <p class="kucuk soluk">Spotify oynatıcısı olmadan, elle başlatmak için: şarkı seçili sekizliğin 1'ine gelince aşağıdaki "elle" düğmesine dokun.</p>
          <button class="btn" data-tap="pr">Elle başlat (seçili sekizliğin 1'inde dokun)</button>` : `
          <h3>${ses ? 'Ya da Spotify ile' : 'Spotify ile prova'}</h3>
          <p class="ipucu">${CLAUDE_ICINDE ? 'Spotify\'da çalan şarkının anını bu sayfa okuyamaz (gerçek zamanlı eşleşme yok; kendi adresindeki sürümde Spotify oynatıcısı sayfanın içinde çalar ve sayım ona kilitlenir).' : 'Tempo sekmesindeki kayıt bilgisine Spotify şarkı bağlantısı eklersen oynatıcı burada çıkar ve sayım ona kilitlenir.'} Şimdilik sayaç BPM'e göre kendi ilerler: şarkı seçtiğin sekizliğin 1'ine gelince dokun. Kayarsa ±1 vuruşla düzelt. ${s.beats ? 'Bu şarkının analiz vuruşları var: sayaç kayıttaki tempo değişimlerini de izler (aynı versiyonu çal).' : ''}</p>
          <div class="satir">
            ${s.spotifyId ? `<a class="btn" href="https://open.spotify.com/track/${s.spotifyId}" target="_blank" rel="noopener">Spotify'da aç</a>` : ''}
            <label class="yan kucuk">Başlangıç <select id="pr-bas" data-ch="pr-bas" style="width:auto">${Array.from({ length: blokB - blokA }, (_, i) => `<option value="${blokA + i}" ${blokA + i === bas ? 'selected' : ''}>${blokA + i + 1}. sekizlik</option>`).join('')}</select></label>
          </div>
          <button class="dokun" data-tap="pr" style="min-height:84px">Seçili sekizliğin 1'inde dokun</button>`}
          <div class="satir">
            <button class="btn" data-act="pr-sayarak">5-6-7-8 sayarak başlat</button>
            <button class="btn" data-act="pr-durdur">Durdur</button>
            <label class="yan kucuk"><input type="checkbox" id="pr-metronom" ${ui.metronom ? 'checked' : ''} data-ch="metronom"> Metronom sesi</label>
          </div>
          <div class="satir kucuk"><span>Kaydır:</span>
            <button class="btn kucuk" data-act="pr-kay" data-d="-1">−1 vuruş</button><button class="btn kucuk" data-act="pr-kay" data-d="-0.5">−½</button>
            <button class="btn kucuk" data-act="pr-kay" data-d="0.5">+½</button><button class="btn kucuk" data-act="pr-kay" data-d="1">+1 vuruş</button>
            ${s.beats ? '' : `<span class="soluk">Tempo:</span><button class="btn kucuk" data-act="pr-tempo" data-d="-0.5">−0,5</button><button class="btn kucuk" data-act="pr-tempo" data-d="0.5">+0,5</button><span class="mono" id="pr-bpm">${sayi((s.bpm || 120) + (T.bpmFark || 0))} BPM</span>`}
          </div>
        </div>
      </section>
    </div>`;
  }
  function ilkHareketAdi(c, t) {
    const it = [...c.items].sort((a, b) => a.t - b.t).find((x) => x.t + x.L > t + 1e-6);
    const m = it && hareket(it.moveId);
    return m ? m.name + yonMetni(it, m) : '—';
  }

  // ---- Hareketler ----
  function vHareketler() {
    if (ui.hareketDuzen) return vHareketForm(ui.hareketDuzen === 'yeni' ? null : hareket(ui.hareketDuzen));
    return `<div class="yigin">
      <section class="panel">
        <div class="satir ara"><h2>Hareket kütüphanesi</h2><button class="btn ana" data-act="hareket-yeni">Yeni hareket</button></div>
        <p class="ipucu">Varsayılan sayımlar başlangıç önerisidir; kendi saydığın gibi düzelt. Başlangıç sayımı hareketin sekizlik içinde nereden girdiği: 8'de başlayan hareket 8 → 1…7 gider. Arkasından ya yine 8'de başlayan ya da 8'de hazırlıkla giren 1'lik bir hareket gelir; 1'likten 8'liğe geçişte önceki hareket 8'ini bırakır (kartta işaretli olmalı) ya da araya duruş girer. 4 sayımlık hareketler 4 sayım sonra da (1 yerine 5'te) başlayabilir. Ağırlık bilgisini girdiğin hareketlerde koreografi uymayan geçişi seçmez.</p>
        <p class="kucuk"><b id="kullanim-sayisi">${kullanimMetni()}</b> Koreografiyi bölen ya da istemediğin hareketlerde "Otomatik koreografide kullan" işaretini kaldır: hareket silinmez, sadece otomatik koreografiye girmez.</p>
        <input id="hareket-ara" placeholder="Ara: ad, karakter, yön…" value="${esc(ui.ara)}" aria-label="Hareket ara">
      </section>
      <div class="liste" id="hareket-liste">${hareketListesi()}</div>
      <div><button class="btn kucuk" data-act="varsayilan-geri">Eksik varsayılan hareketleri geri ekle</button></div>
    </div>`;
  }
  function kullanimMetni() {
    const l = DB.moves.filter((m) => m.kind !== 'poz');
    return `Otomatik koreografide: ${l.filter((m) => m.kullan !== false).length} / ${l.length} hareket.`;
  }
  function hareketListesi() {
    const q = ui.ara.toLocaleLowerCase('tr').trim();
    const l = DB.moves.filter((m) => !q || [m.name, m.character, m.travel, m.desc].join(' ').toLocaleLowerCase('tr').includes(q));
    if (!l.length) return '<div class="panel bos-durum">Aramaya uyan hareket yok.</div>';
    return l.map((m) => {
      const kullanim = DB.choreos.filter((c) => c.items.some((x) => x.moveId === m.id)).length;
      const uz = m.lengthOptions && m.lengthOptions.length ? m.lengthOptions.map(sayi).join(' / ') : sayi(m.length);
      return `<div class="hareket-satir${m.kullan === false && m.kind !== 'poz' ? ' kapali' : ''}">
        <div style="min-width:0"><div class="ad">${esc(m.name)}</div><div class="kucuk soluk">${esc(m.desc)}</div></div>
        <button class="btn kucuk" data-act="hareket-duzen" data-id="${m.id}">Düzenle</button>
        <div class="satir kucuk" style="grid-column:1/-1">
          ${m.kind === 'poz' ? '' : `<label class="yan"><input type="checkbox" data-ch="hizli-kullan" data-id="${m.id}" ${m.kullan !== false ? 'checked' : ''}> Otomatik koreografide kullan</label>`}
          ${m.flexStart ? '' : `<label class="yan">Başlangıç <select data-ch="hizli-sayim" data-id="${m.id}" data-k="start" style="width:auto;padding:4px 8px">${baslangicSecenekleri(m.start)}</select></label>
          <label class="yan">Süre <select data-ch="hizli-sayim" data-id="${m.id}" data-k="length" style="width:auto;padding:4px 8px">${sureSecenekleri(m.length)}</select> sayım</label>`}
          ${m.kind === 'poz' ? '' : `<label class="yan">Vurgu <input data-ch="hizli-vurgu" data-id="${m.id}" value="${esc((m.vurguSayimlari || []).map(sayi).join(', '))}" placeholder="ör. 5" style="width:7em;padding:4px 8px"></label>`}
        </div>
        <div class="bilgi">
          <span class="cip teal mono">${m.flexStart ? 'her sayımda' : 'başlar ' + S.baslangicEtiketi(m.start)} · ${uz} sayım</span>
          ${S.aile(m) === '1' && m.sekizSerbest !== false ? '<span class="cip">8\'i bırakılabilir</span>' : ''}
          <span class="cip">${esc(m.character)}</span><span class="cip">${esc(m.travel)}</span>
          <span class="cip">enerji ${esc(ENERJI[m.energy].toLocaleLowerCase('tr'))}</span><span class="cip">${esc(SEVIYE[m.level])}</span>
          <span class="cip mono">${m.bpmMin}–${m.bpmMax} BPM</span>
          ${m.mirror ? '<span class="cip">aynalı</span>' : ''}
          ${m.weightStart !== 'any' || m.weightEnd !== 'any' ? `<span class="cip brass">ağırlık ${m.weightStart === 'any' ? '?' : m.weightStart === 'L' ? 'sol' : 'sağ'} → ${m.weightEnd === 'any' ? '?' : m.weightEnd === 'L' ? 'sol' : 'sağ'}</span>` : ''}
          ${(m.accents || []).map((a) => `<span class="cip brass">${esc(a)}</span>`).join('')}
          ${kullanim ? `<span class="cip">${kullanim} koreografide</span>` : ''}
          ${m.video ? `<a class="cip" href="${esc(m.video)}" target="_blank" rel="noopener">video</a>` : ''}
        </div></div>`;
    }).join('');
  }
  function baslangicSecenekleri(deger) {
    const out = [];
    for (let x = 1; x <= 8.5; x += 0.5) out.push(`<option value="${x}" ${Math.abs(deger - x) < 1e-6 ? 'selected' : ''}>${S.baslangicEtiketi(x)}</option>`);
    return out.join('');
  }
  function sureSecenekleri(deger) {
    const l = [1, 2, 3, 4, 6, 8, 12, 16];
    if (!l.some((x) => Math.abs(x - deger) < 1e-6)) l.push(deger);
    return l.sort((a, b) => a - b).map((x) => `<option value="${x}" ${Math.abs(deger - x) < 1e-6 ? 'selected' : ''}>${sayi(x)}</option>`).join('');
  }
  function vHareketForm(m) {
    const yeni = !m;
    const v = m || { name: '', start: 1, length: 8, lengthOptions: null, flexStart: false, travel: 'yerinde', energy: 2, level: 1, character: 'groove', accents: [], weightStart: 'any', weightEnd: 'any', mirror: false, bpmMin: 100, bpmMax: 220, desc: '', video: '', variations: '', kind: 'hareket' };
    const bas = [];
    for (let x = 1; x <= 8.5; x += 0.5) bas.push(`<option value="${x}" ${Math.abs(v.start - x) < 1e-6 ? 'selected' : ''}>${S.baslangicEtiketi(x)}${x === 7.5 ? ' (&8)' : ''}</option>`);
    const sec = (id, deger, obj) => `<select id="${id}">${Object.entries(obj).map(([k, ad]) => `<option value="${k}" ${String(deger) === String(k) ? 'selected' : ''}>${esc(ad)}</option>`).join('')}</select>`;
    const kullanim = m ? DB.choreos.filter((c) => c.items.some((x) => x.moveId === m.id)).length : 0;
    return `<form class="panel" data-form="hareket" autocomplete="off">
      <div class="satir ara"><h2>${yeni ? 'Yeni hareket' : esc(v.name)}</h2><button class="btn" type="button" data-act="hareket-vazgec">Vazgeç</button></div>
      <div class="izgara2">
        <label>Hareket adı<input id="hf-ad" value="${esc(v.name)}" required></label>
        <label>Tür${sec('hf-tur', v.kind, { hareket: 'Hareket', poz: 'Duruş / poz' })}</label>
      </div>
      <fieldset class="alan-grup"><legend>Sayım</legend>
        <div class="izgara3">
          <label>Başlangıç sayımı<select id="hf-bas">${bas.join('')}</select></label>
          <label>Süre (sayım)<input id="hf-sure" inputmode="decimal" value="${sayi(v.length)}"></label>
          <label>Süre seçenekleri (esnekse)<input id="hf-secenek" value="${esc((v.lengthOptions || []).map(sayi).join(', '))}" placeholder="ör. 2, 4, 8"></label>
        </div>
        <label class="yan"><input type="checkbox" id="hf-serbest" ${v.sekizSerbest !== false ? 'checked' : ''}> 8'i bırakılabilir: 1'de başlıyorsa son sayımı (8), arkasından gelen 8'de başlayan hareketin hazırlığına bırakılabilir</label>
        <label class="yan"><input type="checkbox" id="hf-esnek" ${v.flexStart ? 'checked' : ''}> Her sayımda başlayabilir (vurgu hareketi; süre seçenekleriyle 4'lük sınırda biter)</label>
        <p class="ipucu">8'de başlayan hareket 8 → 1…7 gider. Arkasından ya yine 8'de başlayan bir hareket ya da 8'de hazırlıkla giren 1'lik bir hareket gelir. 1'lik hareketten 8'de başlayana geçişte önceki hareket 8'ini bırakır ya da araya duruş/break girer.</p>
      </fieldset>
      <fieldset class="alan-grup"><legend>Karakter</legend>
        <div class="izgara3">
          <label>Enerji${sec('hf-enerji', v.energy, ENERJI)}</label>
          <label>Zorluk${sec('hf-seviye', v.level, SEVIYE)}</label>
          <label>Karakter${sec('hf-karakter', v.character, Object.fromEntries(S.KARAKTERLER.map((k) => [k, k])))}</label>
          <label>Yer değiştirme${sec('hf-yon', v.travel, Object.fromEntries(S.YONLER.map((k) => [k, k])))}</label>
          <label>Rahat tempo, en az (BPM)<input id="hf-bpm1" inputmode="numeric" value="${v.bpmMin}"></label>
          <label>Rahat tempo, en çok (BPM)<input id="hf-bpm2" inputmode="numeric" value="${v.bpmMax}"></label>
        </div>
        <div class="yigin" style="gap:6px"><span class="kucuk soluk">Uygun olduğu müzik anları</span>
          <div class="onay-kutulari">${S.VURGU_ETIKETLERI.map((a) => `<label class="yan"><input type="checkbox" name="hf-vurgu" value="${a}" ${(v.accents || []).includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div></div>
      </fieldset>
      <fieldset class="alan-grup"><legend>Ayak ve yön</legend>
        <div class="izgara3">
          <label>Başlarken ağırlık${sec('hf-ag1', v.weightStart, AGIRLIK)}</label>
          <label>Bitişte ağırlık${sec('hf-ag2', v.weightEnd, AGIRLIK)}</label>
        </div>
        <label>Vurgu sayımları (hareketin vurduğu dans sayımları; ör. "5" ya da "1, 5")<input id="hf-vurgu-sayim" value="${esc((v.vurguSayimlari || []).map(sayi).join(', '))}" placeholder="ör. 5"></label>
        <p class="ipucu">Koreografi, hareketin vurgusunu müzikteki darbeyle (Müzik haritasındaki vurgu işaretleri) aynı sayıma denk getirmeye çalışır. Boş bırakırsan hareketin vurgusu yok sayılır.</p>
        <label class="yan"><input type="checkbox" id="hf-kullan" ${v.kullan !== false ? 'checked' : ''}> Otomatik koreografide kullan (kapalıysa kütüphanede kalır, otomatik koreografiye girmez; elle eklenebilir)</label>
        <label class="yan"><input type="checkbox" id="hf-ayna" ${v.mirror ? 'checked' : ''}> Aynalanabilir (sağa ve sola yapılır; ağırlıklar sol yönde yer değiştirir)</label>
        <p class="ipucu">Yukarıdaki ağırlıklar hareketin sağ (sağa) yönü içindir. "Fark etmez" bırakırsan geçişlerde kontrol yapılmaz.</p>
      </fieldset>
      <label>Açıklama<textarea id="hf-aciklama">${esc(v.desc)}</textarea></label>
      <label>Varyasyonlar<textarea id="hf-varyasyon">${esc(v.variations)}</textarea></label>
      <label>Video bağlantısı (isteğe bağlı)<input id="hf-video" value="${esc(v.video)}" placeholder="https://…"></label>
      <p class="not uyari" id="hf-hata" hidden></p>
      <div class="satir"><button class="btn ana" type="submit">Kaydet</button>
        ${!yeni && !v.system ? silDugme('h-' + v.id, 'hareket-sil', `data-id="${v.id}" type="button"`, kullanim ? `Sil (${kullanim} koreografide kullanılıyor)` : 'Sil') : ''}
        ${v.system ? '<span class="kucuk soluk">Bu hareket sistem için gerekli; düzenlenebilir ama silinmez.</span>' : ''}</div>
    </form>`;
  }

  // ---- Koreografiler (hazır olanlar) ----
  function koreoKarti(c, kisa) {
    const s = sarki(c.songId);
    if (!s) return '';
    const v = S.dogrula(c.items, s, DB.moves, c.range);
    const uyari = [...v.uyarilar.values()].filter((u) => u.length).length + v.bosluklar.length;
    const sekiz = Math.ceil(c.range[1] / 8) - Math.floor(c.range[0] / 8);
    const sure = s.bpm ? (c.range[1] - c.range[0]) * 60 / s.bpm : null;
    const acik = ui.metinAcik === c.id;
    if (kisa) {
      return `<div class="satir ara hazir-kisa"><span style="min-width:0"><b>${esc(c.name)}</b> <span class="kucuk soluk">· ${esc(s.title)} · ${tarih(c.updatedAt || c.createdAt)}</span></span>
        <span class="satir"><button class="btn kucuk" data-act="koreo-ac" data-id="${c.id}">Aç</button><button class="btn kucuk ana" data-act="hazir-isaret" data-id="${c.id}">Hazır yap</button></span></div>`;
    }
    return `<article class="panel hazir-kart">
      <div class="satir ara" style="align-items:flex-start"><div style="min-width:0"><h3>${esc(c.name)}</h3>
        <div class="kucuk soluk">${esc(s.title)}${s.artist ? ' · ' + esc(s.artist) : ''}</div></div>
        ${s.bpm ? `<div class="bpm-buyuk">${sayi(s.bpm)}<small>BPM</small></div>` : ''}</div>
      <div class="koreo-ozet">
        <span class="cip">${sekiz} sekizlik${sure ? ' · ' + sureMetni(sure) : ''}</span>
        <span class="cip">${c.items.length} hareket</span>
        ${uyari ? `<span class="cip uyari">${uyari} uyarı</span>` : '<span class="cip teal">Sayım temiz</span>'}
        ${s.sesDosyasi ? '<span class="cip">ses dosyası saklı</span>' : ''}
        <span class="cip">${tarih(c.updatedAt || c.createdAt)}</span>
      </div>
      <div class="satir">
        <button class="btn ana kucuk" data-act="koreo-prova" data-id="${c.id}">Prova</button>
        <button class="btn kucuk" data-act="koreo-ac" data-id="${c.id}">Düzenle</button>
        <button class="btn kucuk" data-act="koreo-metin-ac" data-id="${c.id}">${acik ? 'Metni gizle' : 'Metin'}</button>
        <button class="btn kucuk" data-act="hazir-isaret" data-id="${c.id}">Hazırlardan çıkar</button>
      </div>
      ${acik ? `<pre class="metin" id="metin-${c.id}">${esc(S.metinCikar(c, s, DB.moves))}</pre><div><button class="btn kucuk" data-act="koreo-metin-kopyala" data-id="${c.id}">Kopyala</button></div>` : ''}
    </article>`;
  }
  function vKoreografiler() {
    const sira = (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    const hazir = DB.choreos.filter((c) => c.hazir && sarki(c.songId)).sort(sira);
    const digerleri = DB.choreos.filter((c) => !c.hazir && sarki(c.songId)).sort(sira);
    return `<div class="yigin">
      <section class="yigin" style="gap:10px"><h2>Hazır koreografiler</h2>
        ${hazir.length ? hazir.map((c) => koreoKarti(c)).join('') : '<div class="panel bos-durum">Henüz hazır koreografi yok. Bir koreografiyi bitirince şarkının Koreografi sekmesinde "Hazır olarak işaretle"ye bas; burada toplanır.</div>'}
      </section>
      ${digerleri.length ? `<details class="panel" ${hazir.length ? '' : 'open'}>
        <summary><b>Üzerinde çalıştıkların (${digerleri.length})</b></summary>
        <div class="yigin" style="gap:8px;margin-top:10px">${digerleri.map((c) => koreoKarti(c, true)).join('')}</div>
      </details>` : ''}
    </div>`;
  }

  // ---- Yedek ----
  function vYedek() {
    const json = ui.yedekGoster ? JSON.stringify(DB, null, 1) : '';
    const g = ui.yedekGelen;
    return `<div class="yigin">
      <section class="panel">
        <h2>Yedek</h2>
        <p class="ipucu">Veriler bu tarayıcıda saklanıyor: ${DB.songs.length} şarkı, ${DB.choreos.length} koreografi, ${DB.moves.length} hareket. Telefon ve bilgisayar ayrı ayrı saklar. Birinden öbürüne aktarmak için burada yedek al, öbür cihazda geri yükle. Ses dosyaları yedeğe girmez.</p>
        ${kayitOk ? '' : '<p class="not uyari">Bu tarayıcı şu an kaydetmiyor; yedeği hemen al.</p>'}
        <div class="satir"><button class="btn ana" data-act="yedek-indir">Yedeği indir (JSON)</button><button class="btn" data-act="yedek-goster">${ui.yedekGoster ? 'JSON metnini gizle' : 'JSON metnini göster'}</button></div>
        ${ui.yedekGoster ? `<textarea id="yedek-metin-cikis" readonly style="min-height:180px;font-family:var(--font-mono);font-size:.78rem">${esc(json)}</textarea><div><button class="btn kucuk" data-act="yedek-kopyala">Kopyala</button></div>` : ''}
      </section>
      <section class="panel">
        <h2>Saklı ses dosyaları</h2>
        <p class="ipucu">Ses dosyaları bu cihazda, uygulamanın kendi alanında saklanır (yedeğe girmez). Ana ekran simgesini silersen ya da tarayıcı verilerini temizlersen bunlar da silinir; asıl dosyaların bir kopyasını iCloud Drive'da ya da bilgisayarda tut.</p>
        ${(() => {
          const l = DB.songs.filter((x) => x.sesDosyasi);
          if (!l.length) return '<p class="kucuk soluk">Saklı dosya yok.</p>';
          const top = l.reduce((a, x) => a + (x.sesDosyasi.boyut || 0), 0);
          return `<p class="kucuk"><b>${l.length} dosya · ${boyutMetni(top)}</b> <span id="depo-bilgi" class="soluk"></span></p>
            <div class="liste">${l.map((x) => `<div class="satir ara"><span class="kucuk" style="min-width:0">${esc(x.title)} · ${esc(x.sesDosyasi.ad)} · ${boyutMetni(x.sesDosyasi.boyut || 0)}</span>
              ${silDugme('ses-' + x.id, 'ses-sil', `data-id="${x.id}"`, 'Sil')}</div>`).join('')}</div>`;
        })()}
      </section>
      <section class="panel">
        <h2>Geri yükle</h2>
        <div class="satir"><label class="btn" for="yedek-dosya">JSON dosyası seç</label><input type="file" id="yedek-dosya" accept=".json,application/json,text/plain" hidden data-ch="yedek-dosya"></div>
        <label>Ya da yedek metnini yapıştır<textarea id="yedek-girdi" placeholder='{"version":1, …}'></textarea></label>
        <div><button class="btn" data-act="yedek-metinden">Metni oku</button></div>
        ${g ? `<div class="not bilgi">Yedekte ${g.songs.length} şarkı, ${g.choreos.length} koreografi, ${g.moves.length} hareket var.
          <div class="satir" style="margin-top:8px"><button class="btn ana kucuk" data-act="yedek-birlestir">Birleştir (aynı kayıtlar yedektekiyle güncellenir)</button>
          ${silDugme('yedek-degistir', 'yedek-degistir', '', 'Tümünü yedekle değiştir')}</div></div>` : ''}
      </section>
      ${CLAUDE_ICINDE ? `<section class="panel">
        <h2>Mikrofon için sayfayı indir</h2>
        <p class="ipucu">claude.ai sayfaları mikrofona erişemez. Mikrofonla dinlemek istersen uygulamanın kendi adresindeki sürümünü kullan ya da sayfanın kendisini indirip tarayıcında aç; orada mikrofon izni sorulur. Öbür sürüm kendi ayrı deposunu kullanır: verilerini bu bölümdeki yedekle aktar.</p>
        <div><button class="btn" data-act="sayfa-indir">Sayfayı indir (HTML)</button></div>
      </section>` : `<section class="panel">
        <h2>Bu cihazda</h2>
        <p class="ipucu">Uygulama kendi adresinde çalışıyor: internetsiz de açılır, mikrofonla dinleme kullanılabilir. iPhone'da Safari'nin Paylaş menüsünden "Ana Ekrana Ekle" ile uygulama gibi kurulur. Veriler bu cihazda saklanır; başka cihaza aktarmak için yedek al.</p>
        <p class="kucuk soluk">${kaliciDepo === true ? 'Tarayıcı verileri kalıcı olarak saklamayı onayladı.' : kaliciDepo === false ? 'Tarayıcı kalıcı saklamayı onaylamadı; düzenli yedek al.' : ''}</p>
        <div class="satir">${bagli() ? `<span class="kucuk">Spotify'a bağlı.</span>${silDugme('spotify-kes', 'spotify-kes', '', 'Spotify bağlantısını kes')}` : '<button class="btn kucuk" data-act="spotify-baglan">Spotify\'a bağlan</button>'}</div>
      </section>`}
    </div>`;
  }

  function silDugme(anahtar, act, attrs, metin) {
    const on = ui.silOnay === anahtar;
    return `<button class="btn kucuk tehlike ${on ? 'onay' : ''}" data-act="${act}" ${attrs || ''}>${on ? 'Emin misin? Tekrar dokun' : esc(metin || 'Sil')}</button>`;
  }
  function onayli(anahtar) {
    if (ui.silOnay === anahtar) { ui.silOnay = null; clearTimeout(ui.silZaman); return true; }
    ui.silOnay = anahtar;
    clearTimeout(ui.silZaman);
    ui.silZaman = setTimeout(() => { if (ui.silOnay === anahtar) { ui.silOnay = null; ciz(); } }, 4000);
    ciz();
    return false;
  }

  // ---------------- dokunarak tempo ----------------
  function tapBpm() {
    const t = ui.tap;
    if (t.length < 4) return null;
    const d = [];
    for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
    const ss = [...d].sort((a, b) => a - b); const med = ss[ss.length >> 1];
    const iyi = d.filter((x) => Math.abs(x - med) < med * 0.25);
    return 60000 / (iyi.reduce((a, b) => a + b, 0) / iyi.length);
  }
  function tapMetni() {
    const n = ui.tap.length;
    if (n < 4) return n ? `${n} dokunuş · en az 4 gerekli` : '—';
    return `${tapBpm().toFixed(1).replace('.', ',')} BPM · ${n} dokunuş`;
  }
  function tapDokun() {
    const now = performance.now();
    if (ui.tap.length && now - ui.tap[ui.tap.length - 1] > 2500) ui.tap = [];
    ui.tap.push(now);
    if (ui.tap.length > 24) ui.tap.shift();
    const el = $('#tap-sonuc'); if (el) el.textContent = tapMetni();
  }

  // ---------------- analiz ----------------
  async function sesiAnalizEt(s, mono, sr, kaynak, sesAdi, secenek) {
    ui.analiz = { songId: s.id, durum: 'Analiz ediliyor…', oran: 0.05 };
    analizCiz();
    secenek = secenek || {};
    try {
      const r = await S.analizEt(mono, sr, (v) => { if (ui.analiz) { ui.analiz.oran = v; analizCiz(); } });
      const fark = secenek.spotifyFarki;
      // Spotify zamanıyla eşleşmişse vuruşlar şarkının Spotify'daki zamanına kaydırılır
      s.beats = fark != null ? r.beats.map((b) => Math.round((b + fark) * 1000) / 1000) : r.beats;
      s.originIdx = r.originIdx; s.firstOneSec = s.beats[r.originIdx];
      if (fark != null) s.spotifyKayma = 0;
      s.durationSec = fark != null && SP.dur > 31 ? Math.round(SP.dur * 10) / 10 : Math.round(r.sureSn * 10) / 10;
      s.analiz = { kaynak, tarih: Date.now(), bpm: r.bpm, bpmBas: r.bpmBas, bpmSon: r.bpmSon, adaylar: r.adaylar, guven: r.guven, vDb: r.vDb, vOn: r.vOn, ozel: r.ozel, sesAdi: sesAdi || '' };
      kaynakEkle(s, kaynak, r.bpm, sesAdi || '');
      const eskiBpm = s.bpm;
      s.bpm = r.bpm; s.bpmOlcum = r.bpm; s.bpmKaynak = kaynak;
      let ek = '';
      if (!s.haritaElle) {
        s.energy = r.energy; s.breaks = r.breaks; s.sections = r.sections;
        // seçili vurgu hassasiyetiyle (varsayılan "orta" analizin kendisi)
        s.accents = s.vurguHassasiyet && s.vurguHassasiyet !== 'orta'
          ? S.turet({ beats: s.beats, vDb: r.vDb, vOn: r.vOn, ozel: r.ozel, origin: s.originIdx, hassasiyet: s.vurguHassasiyet }).accents : r.accents;
        ek = ' Harita önerileri uygulandı.';
      }
      else ek = ' Elle işaretlerin korundu; istersen analiz önerilerini uygulayabilirsin.';
      if (eskiBpm && Math.abs(eskiBpm - r.bpm) / r.bpm > 0.03) ek += ` Önceki seçilen tempo ${sayi(eskiBpm)} idi; gerekirse yarım/çift tempoyu seç.`;
      if (fark != null) ek += ' Vuruşlar şarkının Spotify zamanına oturtuldu: Prova sekmesinde sayım ayarsız eşleşir.';
      else if (secenek.spotifyVardi) ek += ' Kayıt sırasında Spotify sarıldı ya da durdu; Spotify zamanıyla eşleme yapılamadı (Prova\'daki "Şu an 1" düğmesiyle eşleyebilirsin).';
      s.updatedAt = Date.now();
      kaydet();
      ui.analiz = { songId: s.id, bitti: `Bitti: ${sayi(r.bpm)} BPM, ${r.beats.length} vuruş bulundu.${ek}` };
    } catch (e) {
      ui.analiz = { songId: s.id, hata: 'Analiz yapılamadı: ' + (e && e.message ? e.message : 'bilinmeyen hata') };
    }
    ciz();
  }
  // ---------------- ses dosyası deposu (tarayıcının IndexedDB'si; cihazdan çıkmaz) ----------------
  const SES_DB = 'swing-choreo-studio-ses', SES_DEPO = 'dosyalar';
  let sesDbSoz = null;
  function sesDb() {
    if (!sesDbSoz) {
      sesDbSoz = new Promise((res, rej) => {
        if (!window.indexedDB) { rej(new Error('IndexedDB yok')); return; }
        const r = indexedDB.open(SES_DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(SES_DEPO);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }).catch((e) => { sesDbSoz = null; throw e; });
    }
    return sesDbSoz;
  }
  async function sesIslem(kip, f) {
    const db = await sesDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(SES_DEPO, kip);
      const st = tx.objectStore(SES_DEPO);
      let sonuc;
      const istek = f(st);
      if (istek) istek.onsuccess = () => { sonuc = istek.result; };
      tx.oncomplete = () => res(sonuc);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('iptal'));
    });
  }
  const sesSakla = (id, file) => sesIslem('readwrite', (st) => st.put({ blob: file, ad: file.name, boyut: file.size, tarih: Date.now() }, id));
  const sesOku = (id) => sesIslem('readonly', (st) => st.get(id));
  const sesSil = (id) => sesIslem('readwrite', (st) => st.delete(id));
  // şarkı açılınca saklı dosya varsa Prova için hazırlanır
  const sesYukleniyor = new Set();
  function sesHazirla(s) {
    if (!s || !s.sesDosyasi || ui.sesler[s.id] || sesYukleniyor.has(s.id)) return;
    sesYukleniyor.add(s.id);
    sesOku(s.id).then((k) => {
      if (k && k.blob) {
        ui.sesler[s.id] = { url: URL.createObjectURL(k.blob), ad: k.ad, sakli: true };
        if (ui.rota.gorunum === 'sarki' && ui.rota.id === s.id && !T.calisiyor) ciz();
      } else { delete s.sesDosyasi; kaydet(); }
    }).catch(() => { /* okunamadı: dosya yeniden seçilebilir */ }).finally(() => sesYukleniyor.delete(s.id));
  }
  // Yedek sayfasında cihazın kullanım/boş yer bilgisi (tarayıcı izin veriyorsa)
  function depoBilgisiCiz() {
    if (!navigator.storage || !navigator.storage.estimate) return;
    navigator.storage.estimate().then((e) => {
      const el = $('#depo-bilgi');
      if (el && e && e.quota) el.textContent = `· uygulamanın kullandığı toplam yer ${boyutMetni(e.usage || 0)}, ayrılabilecek yer yaklaşık ${boyutMetni(e.quota)}`;
    }).catch(() => {});
  }
  function boyutMetni(b) { return b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }

  async function dosyaAnaliz(s, file) {
    ui.analiz = { songId: s.id, durum: 'Dosya çözülüyor…', oran: 0.02 };
    ui.mikHata = null;
    analizCiz();
    let ac;
    try {
      const buf = await file.arrayBuffer();
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      const ab = await new Promise((res, rej) => { const p = ac.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
      const mono = new Float32Array(ab.length);
      for (let ch = 0; ch < ab.numberOfChannels; ch++) { const d = ab.getChannelData(ch); for (let i = 0; i < d.length; i++) mono[i] += d[i] / ab.numberOfChannels; }
      if (ui.sesler[s.id]) { try { URL.revokeObjectURL(ui.sesler[s.id].url); } catch (e) { /* yok */ } }
      ui.sesler[s.id] = { url: URL.createObjectURL(file), ad: file.name };
      try { ac.close(); } catch (e) { /* yok */ }
      // dosya uygulamada saklanır: Prova'da yeniden seçmek gerekmez
      try {
        await sesSakla(s.id, file);
        s.sesDosyasi = { ad: file.name, boyut: file.size, tarih: Date.now() };
        kaydet();
      } catch (e) { toast('Dosya uygulamada saklanamadı (yer yetmiyor olabilir); analiz yine de yapılıyor.'); }
      await sesiAnalizEt(s, mono, ab.sampleRate, 'dosya', file.name);
    } catch (e) {
      try { ac && ac.close(); } catch (x) { /* yok */ }
      ui.analiz = { songId: s.id, hata: 'Dosya çözülemedi. MP3, M4A, WAV ya da OGG dene.' };
      ciz();
    }
  }
  async function mikrofonBasla(s) {
    ui.mikHata = null;
    const hataMetni = CLAUDE_ICINDE
      ? 'Mikrofon açılamadı. claude.ai sayfaları mikrofona erişemez: ses dosyası yükle, dokunarak ölç ya da uygulamanın kendi adresindeki sürümünü kullan.'
      : 'Mikrofon açılamadı. Mikrofon iznini kontrol et (iPhone: Ayarlar → Safari → Mikrofon, ya da adres çubuğundaki "aA" → Web Sitesi Ayarları).';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { ui.mikHata = hataMetni; ciz(); return; }
    // DENEYSEL (iPhone, Safari 16.4+): ses oturumunu "çal ve kaydet" yap; mikrofon açılınca
    // çalan müziğin (sayfadaki Spotify oynatıcısının) kesilmemesi istenir. Desteklenmezse bir şey olmaz.
    let oturumEski = null;
    try { if (navigator.audioSession) { oturumEski = navigator.audioSession.type; navigator.audioSession.type = 'play-and-record'; } } catch (e) { /* desteklenmiyor */ }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e) { oturumGeriAl(oturumEski); ui.mikHata = hataMetni; ciz(); return; }
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaStreamSource(stream);
    const f = Math.max(1, Math.round(ac.sampleRate / 11025));
    const proc = ac.createScriptProcessor(4096, 1, 1);
    const parcalar = [];
    let seviye = 0;
    const M = { songId: s.id, stream, ac, src, proc, parcalar, sr: ac.sampleRate / f, bas: Date.now(), seviye: () => seviye, oturumEski, toplam: 0, sonParca: performance.now(), spotifyCiftleri: [] };
    proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      const out = new Float32Array(Math.floor(d.length / f));
      let m = 0;
      for (let i = 0; i < out.length; i++) { let t = 0; for (let k = 0; k < f; k++) t += d[i * f + k]; out[i] = t / f; m = Math.max(m, Math.abs(out[i])); }
      parcalar.push(out); seviye = m;
      M.toplam += out.length; M.sonParca = performance.now();
    };
    src.connect(proc); proc.connect(ac.destination);
    M.zaman = setInterval(() => {
      const a = $('#mik-sure'), b = $('#mik-seviye'), c = $('#mik-spotify');
      if (a) a.textContent = sureMetni((Date.now() - M.bas) / 1000);
      if (b) b.style.width = Math.min(100, Math.round(M.seviye() * 140)) + '%';
      if (c) c.textContent = M.spotifyCiftleri.length ? 'Spotify zamanı kaydediliyor: vuruşlar şarkının Spotify zamanına oturtulacak.' : (SPOTIFY_VAR && sarki(M.songId) && sarki(M.songId).spotifyId ? 'Alttaki Spotify oynatıcısında Çal\'a bas (deneysel).' : '');
    }, 200);
    ui.mikrofon = M;
    ciz();
  }
  function mikrofonKapat() {
    const M = ui.mikrofon;
    if (!M) return null;
    clearInterval(M.zaman);
    try { M.proc.disconnect(); M.src.disconnect(); } catch (e) { /* yok */ }
    M.stream.getTracks().forEach((t) => t.stop());
    try { M.ac.close(); } catch (e) { /* yok */ }
    oturumGeriAl(M.oturumEski);
    ui.mikrofon = null;
    return M;
  }
  function oturumGeriAl(eski) {
    try { if (navigator.audioSession) navigator.audioSession.type = eski || 'auto'; } catch (e) { /* yok */ }
  }
  // Kayıt sırasında toplanan (kayıt zamanı, Spotify zamanı) çiftlerinden aradaki sabit fark.
  // Kayıt sırasında sarılmış ya da durdurulmuşsa çiftler tutarsız olur: o zaman eşleme yapılmaz.
  function spotifyFarki(ciftler) {
    if (!ciftler || ciftler.length < 3) return null;
    const farklar = ciftler.map((c) => c.spotify - c.kayit).sort((a, b) => a - b);
    const md = farklar[farklar.length >> 1];
    const tutarli = farklar.filter((x) => Math.abs(x - md) < 0.3).length;
    return tutarli >= farklar.length * 0.6 ? md : null;
  }

  // ---------------- prova sayacı ----------------
  const T = { calisiyor: false, mod: null, t0: 0, basVurus: 0, kayma: 0, bpmFark: 0, raf: 0, sonIdx: null, songId: null, wake: null, ac: null, metin: {} };
  function zamandanVurus(s, sn) {
    const b = s.beats;
    if (b && s.originIdx != null && b.length > 1) {
      let lo = 0, hi = b.length - 1;
      if (sn <= b[0]) return (sn - b[0]) / (b[1] - b[0]) - s.originIdx;
      if (sn >= b[hi]) return hi + (sn - b[hi]) / (b[hi] - b[hi - 1]) - s.originIdx;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m] <= sn) lo = m; else hi = m; }
      return lo + (sn - b[lo]) / (b[lo + 1] - b[lo]) - s.originIdx;
    }
    return (sn - (s.firstOneSec || 0)) * (s.bpm || 120) / 60;
  }
  function vurusSn(s) { return 60 / ((s.bpm || 120) + T.bpmFark); }
  function vurusKonumu(s) {
    if (T.mod === 'dosya') { const a = $('#pr-ses'); return a ? zamandanVurus(s, a.currentTime) + T.kayma : null; }
    if (T.mod === 'spotify') return zamandanVurus(s, spotifyZamani() - (s.spotifyKayma || 0)) + T.kayma;
    const gecen = (performance.now() - T.t0) / 1000;
    if (T.mod === 'dokun' && s.beats && s.originIdx != null) {
      const i = Math.min(s.beats.length - 1, s.originIdx + T.basVurus);
      return zamandanVurus(s, s.beats[i] + gecen) + T.kayma;
    }
    return T.basVurus + gecen / vurusSn(s) + T.kayma;
  }
  function takipBasla(s, mod) {
    // Spotify'da durdur-çal arasında elle yapılan kaydırma korunur
    const ayniSpotify = mod === 'spotify' && T.mod === 'spotify' && T.songId === s.id;
    if (!ayniSpotify) T.kayma = 0;
    T.songId = s.id; T.mod = mod; T.calisiyor = true; T.sonIdx = null;
    T.basVurus = (ui.prBas[s.id] ?? Math.floor((aktifKoreo(s).range[0]) / 8)) * 8;
    if (mod === 'sayarak') T.t0 = performance.now() + 4 * vurusSn(s) * 1000;
    else T.t0 = performance.now();
    if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then((w) => { T.wake = w; }).catch(() => {});
    cancelAnimationFrame(T.raf);
    T.raf = requestAnimationFrame(dongu);
  }
  function takipDurdur() {
    T.calisiyor = false;
    cancelAnimationFrame(T.raf);
    if (T.wake) { try { T.wake.release(); } catch (e) { /* yok */ } T.wake = null; }
  }
  function tik(vurgulu) {
    if (!ui.metronom) return;
    try {
      if (!T.ac) T.ac = new (window.AudioContext || window.webkitAudioContext)();
      const ac = T.ac, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = vurgulu ? 1568 : 1046;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(vurgulu ? 0.5 : 0.3, ac.currentTime + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.07);
    } catch (e) { /* ses yok */ }
  }
  function yaz(id, html) { const el = $('#' + id); if (el && T.metin[id] !== html) { el.innerHTML = html; T.metin[id] = html; } }
  function dongu() {
    if (!T.calisiyor) return;
    const s = sarki(T.songId);
    const c = s && aktifKoreo(s);
    const sayac = $('#pr-sayac');
    if (!s || !c || !sayac) { takipDurdur(); return; }
    const b = vurusKonumu(s);
    if (b != null && !isNaN(b)) cizTakip(s, c, b, sayac);
    T.raf = requestAnimationFrame(dongu);
  }
  function cizTakip(s, c, b, sayac) {
    const spans = sayac.children;
    const items = [...c.items].sort((x, y) => x.t - y.t);
    const idx = Math.floor(b + 1e-6);
    if (idx !== T.sonIdx) { T.sonIdx = idx; tik(S.mod(idx, 8) === 0); }
    const sayim = S.mod(idx, 8);
    if (b < T.basVurus - 1e-6 && T.mod === 'sayarak') {
      for (let i = 0; i < 8; i++) { spans[i].classList.toggle('aktif', i === sayim); spans[i].classList.remove('hareket-ici'); }
      const ilk = items.find((x) => x.t + x.L > T.basVurus + 1e-6);
      yaz('pr-simdi', 'Hazırlan');
      yaz('pr-konum', 'Sayım: 5 · 6 · 7 · 8');
      const m = ilk && hareket(ilk.moveId);
      yaz('pr-sonraki', m ? `İlk hareket: <b>${esc(m.name + yonMetni(ilk, m))}</b>` : '&nbsp;');
      return;
    }
    if (b >= c.range[1] - 1e-6) {
      yaz('pr-simdi', 'Bitti'); yaz('pr-sonraki', '&nbsp;');
      for (const sp of spans) sp.classList.remove('aktif', 'hareket-ici');
      if (T.mod !== 'dosya' && T.mod !== 'spotify') takipDurdur();
      return;
    }
    const it = items.find((x) => b >= x.t - 1e-6 && b < x.t + x.L - 1e-6);
    const m = it && hareket(it.moveId);
    const blok = Math.floor(idx / 8);
    for (let i = 0; i < 8; i++) {
      const v = blok * 8 + i;
      spans[i].classList.toggle('aktif', i === sayim);
      spans[i].classList.toggle('hareket-ici', !!it && v >= it.t - 1e-6 && v < it.t + it.L - 1e-6);
    }
    const simdi = $('#pr-simdi');
    if (simdi) simdi.classList.toggle('break', !!it && it.moveId === 'freeze');
    yaz('pr-simdi', !it && b < c.range[0] ? 'Giriş' : it ? esc(it.moveId === 'freeze' ? 'Break: dur' : m ? m.name + yonMetni(it, m) : '?') : 'Boş');
    const lab = S.bolumEtiketi(s, Math.max(0, b));
    yaz('pr-konum', b < 0 ? `Giriş · ilk 1'e ${Math.ceil(-b)} vuruş` : `${blok + 1}. sekizlik · ${Math.floor(blok / 4) + 1}. cümle${lab ? ' (' + esc(lab) + ')' : ''}`);
    const sonraki = items.find((x) => x.t > b + 1e-6 && (!it || x.id !== it.id));
    const sm = sonraki && hareket(sonraki.moveId);
    yaz('pr-sonraki', sm ? `Sıradaki: <b>${esc(sonraki.moveId === 'freeze' ? 'Break' : sm.name + yonMetni(sonraki, sm))}</b> · ${Math.floor(sonraki.t / 8 + 1e-6) !== blok ? (Math.floor(sonraki.t / 8 + 1e-6) + 1) + '. sekizlik, ' : ''}sayım ${S.sayim(sonraki.t).etiket}` : '&nbsp;');
  }

  // ---------------- Spotify oynatıcısı (sadece kendi adresinde) ----------------
  // Spotify'ın gömülü oynatıcısı + iFrame API'si: çalınan an (ms) sayfaya bildirilir; ses sayfaya gelmez.
  // Oynatıcı şarkı sayfasının altında sabit bir şeritte durur, sekme değişince yeniden yüklenmez.
  const SPOTIFY_VAR = !CLAUDE_ICINDE && location.protocol.startsWith('http');
  const SP = { api: null, yukleniyor: null, ctrl: null, uri: null, pos: 0, dur: 0, durdu: true, t: 0, songId: null };
  function spotifyApi() {
    if (SP.api) return Promise.resolve(SP.api);
    if (SP.yukleniyor) return SP.yukleniyor;
    SP.yukleniyor = new Promise((res, rej) => {
      window.onSpotifyIframeApiReady = (api) => { SP.api = api; res(api); };
      const sc = document.createElement('script');
      sc.src = 'https://open.spotify.com/embed/iframe-api/v1';
      sc.async = true;
      sc.onerror = () => { SP.yukleniyor = null; rej(new Error('yüklenemedi')); };
      document.head.appendChild(sc);
    });
    return SP.yukleniyor;
  }
  function spotifyCubugu() {
    let k = $('#spotify-cubuk');
    if (!k) {
      k = document.createElement('div');
      k.id = 'spotify-cubuk';
      k.hidden = true;
      k.innerHTML = '<div class="sc-ic"><div id="sc-api" hidden></div><div id="spotify-yer"></div><p id="spotify-not"></p></div>';
      document.body.appendChild(k);
    }
    return k;
  }
  function spotifyNot(m) { const n = $('#spotify-not'); if (n) n.textContent = m || ''; }
  // Spotify'ın son bildirdiği an + o zamandan beri geçen süre (çalıyorsa)
  function spotifyZamani() { return SP.pos + (SP.durdu ? 0 : (performance.now() - SP.t) / 1000); }
  function spotifyGuncelle() {
    if (!SPOTIFY_VAR) return;
    const s = aktifSarki();
    const k = spotifyCubugu();
    const goster = !!(s && s.spotifyId);
    k.hidden = !goster;
    document.body.classList.toggle('spotify-acik', goster);
    if (!goster) { if (SP.ctrl && !SP.durdu) { try { SP.ctrl.pause(); } catch (e) { /* yok */ } } return; }
    // Spotify hesabına bağlıysa gömülü önizleme oynatıcısı yerine telefondaki Spotify'ı izleyen şerit
    const apiYer = $('#sc-api'), gomulu = k.querySelector('iframe') || $('#spotify-yer');
    if (bagli()) {
      if (gomulu) gomulu.style.display = 'none';
      if (SP.ctrl && SP.kaynak === 'embed' && !SP.durdu) { try { SP.ctrl.pause(); } catch (e) { /* yok */ } }
      if (apiYer) { apiYer.hidden = false; apiYer.innerHTML = seritHtml(s); }
      if (SP.songId !== s.id) { SP.songId = s.id; SP.pos = 0; SP.dur = 0; SP.durdu = true; SP.kaynak = 'hesap'; }
      spotifyNot('Telefondaki Spotify izleniyor: bu şarkı orada çalınca sayım ve işaretler şarkının saniyesine oturur.');
      return;
    }
    if (apiYer) apiYer.hidden = true;
    if (gomulu) gomulu.style.display = '';
    SP.songId = s.id;
    const uri = 'spotify:track:' + s.spotifyId;
    if (SP.uri === uri) return;
    SP.uri = uri; SP.pos = 0; SP.dur = 0; SP.durdu = true;
    if (T.calisiyor && T.mod === 'spotify') takipDurdur();
    spotifyNot('Spotify oynatıcısı yükleniyor…');
    spotifyApi().then((api) => {
      if (SP.ctrl) { SP.ctrl.loadUri(uri); return; }
      if (SP.olusturuluyor) return;
      SP.olusturuluyor = true;
      api.createController($('#spotify-yer'), { uri, width: '100%', height: 80 }, (ctrl) => {
        SP.ctrl = ctrl;
        if (SP.uri !== uri) ctrl.loadUri(SP.uri); // yüklenirken şarkı değiştiyse
        ctrl.addListener('ready', () => spotifyNot('Çal: Prova sekmesinde sayım bu oynatıcının çaldığı ana kilitlenir.'));
        ctrl.addListener('playback_update', (e) => { if (bagli()) return; SP.kaynak = 'embed'; spotifyOlay(e.data || {}); });
      });
    }).catch(() => spotifyNot('Spotify oynatıcısı yüklenemedi; internet bağlantısını kontrol et. Şarkıyı "Spotify\'da aç" ile açabilirsin.'));
  }
  function spotifyOlay(d) {
    SP.pos = (d.position || 0) / 1000;
    SP.dur = (d.duration || 0) / 1000;
    SP.durdu = !!d.isPaused || !!d.isBuffering;
    SP.t = performance.now();
    const s = SP.songId && sarki(SP.songId);
    if (!s) return;
    // mikrofonla dinlerken: o anki kayıt zamanı ile Spotify zamanını eşle (sonradan vuruşlar Spotify'a oturtulur)
    const M = ui.mikrofon;
    if (M && M.songId === s.id && !SP.durdu) {
      const kayit = M.toplam / M.sr + (performance.now() - M.sonParca) / 1000;
      M.spotifyCiftleri.push({ kayit, spotify: SP.pos });
    }
    const onizleme = SP.kaynak !== 'hesap' && SP.dur > 0 && SP.dur <= 31;
    if (SP.kaynak === 'hesap') { /* şerit kendi yazısını gösterir */ }
    else if (onizleme) spotifyNot('Spotify sadece 30 saniyelik önizleme çalıyor: bu tarayıcıda Spotify hesabına giriş yapılmamış görünüyor. Safari\'de open.spotify.com\'a giriş yapıp sayfayı yeniden aç.');
    else if (SP.dur > 31) spotifyNot('Sayım bu oynatıcının çaldığı ana kilitli (Prova sekmesi).');
    // şarkının süresi bilinmiyorsa Spotify'dan al (koreografi uzunluğu için)
    if (!onizleme && SP.dur > 31 && !s.durationSec && !s.beats) { s.durationSec = Math.round(SP.dur * 10) / 10; s.updatedAt = Date.now(); kaydet(); }
    const provada = ui.rota.gorunum === 'sarki' && ui.rota.id === s.id && ui.sekme[s.id] === 'prova';
    if (!provada) return;
    if (!SP.durdu && !(T.calisiyor && T.mod === 'spotify')) takipBasla(s, 'spotify');
    else if (SP.durdu && T.calisiyor && T.mod === 'spotify') {
      takipDurdur();
      const c = aktifKoreo(s), sy = $('#pr-sayac');
      if (c && sy) cizTakip(s, c, vurusKonumu(s), sy);
    }
  }

  // ---------------- Spotify hesabı (Web API; giriş PKCE ile, şifre bize gelmez) ----------------
  // Telefondaki Spotify'da çalan şarkıyı ve saniyesini okur; Premium hesapta çal/durdur/sar.
  // Spotify sesi vermez: analiz için "Dinlerken işaretle", mikrofon (başka cihazdan çalarak) ya da dosya.
  const SPOTIFY_CLIENT_ID = '467cc7d466b74f508222e97fbf307c3f';
  const SPOTIFY_KAPSAM = 'user-read-playback-state user-read-currently-playing user-modify-playback-state';
  const HESAP_ANAHTAR = 'swing-choreo-studio.spotify';
  const HS = { token: null, yenile: null, bitis: 0, zamanlayici: null, hata: null, calan: null, sayac: null };
  function donusAdresi() { return location.origin + location.pathname.replace(/index\.html$/, ''); }
  function hesapYukle() {
    try { const v = JSON.parse(localStorage.getItem(HESAP_ANAHTAR) || 'null'); if (v) { HS.token = v.token; HS.yenile = v.yenile; HS.bitis = v.bitis || 0; } } catch (e) { /* yok */ }
  }
  function hesapKaydet() {
    try { localStorage.setItem(HESAP_ANAHTAR, JSON.stringify({ token: HS.token, yenile: HS.yenile, bitis: HS.bitis })); } catch (e) { /* yok */ }
  }
  const bagli = () => !!(SPOTIFY_VAR && HS.yenile);
  function bekleyenGiris() { try { return JSON.parse(localStorage.getItem(HESAP_ANAHTAR + '.bekleyen') || 'null'); } catch (e) { return null; } }
  function rastgele(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => ('0' + b.toString(16)).slice(-2)).join(''); }
  async function sha256b64url(s) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function spotifyGiris() {
    const dogrulayici = rastgele(48), durum = rastgele(12);
    try { localStorage.setItem(HESAP_ANAHTAR + '.bekleyen', JSON.stringify({ dogrulayici, durum, t: Date.now() })); } catch (e) { /* yok */ }
    const p = new URLSearchParams({
      response_type: 'code', client_id: SPOTIFY_CLIENT_ID, scope: SPOTIFY_KAPSAM, redirect_uri: donusAdresi(),
      state: durum, code_challenge_method: 'S256', code_challenge: await sha256b64url(dogrulayici),
    });
    location.assign('https://accounts.spotify.com/authorize?' + p.toString());
  }
  async function tokenIste(govde) {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.assign({ client_id: SPOTIFY_CLIENT_ID }, govde)),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) { const e = new Error(j.error_description || j.error || ('HTTP ' + r.status)); e.kod = j.error; throw e; }
    HS.token = j.access_token;
    HS.bitis = Date.now() + (j.expires_in || 3600) * 1000 - 60000;
    if (j.refresh_token) HS.yenile = j.refresh_token;
    hesapKaydet();
  }
  async function kodDegistir(kod) {
    const b = bekleyenGiris();
    if (!b) throw new Error('Bu cihazda başlatılmış bir giriş yok; "Spotify\'a bağlan"a yeniden bas.');
    await tokenIste({ grant_type: 'authorization_code', code: kod, redirect_uri: donusAdresi(), code_verifier: b.dogrulayici });
    try { localStorage.removeItem(HESAP_ANAHTAR + '.bekleyen'); } catch (e) { /* yok */ }
  }
  // Spotify girişten dönünce adres ?code=…&state=… taşır
  async function girisDonusu() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return;
    const kod = q.get('code'), durum = q.get('state');
    try { history.replaceState(null, '', donusAdresi() + location.hash); } catch (e) { /* yok */ }
    if (q.has('error')) { toast('Spotify girişi iptal edildi.'); return; }
    const b = bekleyenGiris();
    if (b && b.durum === durum) {
      try { await kodDegistir(kod); toast('Spotify\'a bağlandı.'); calanIzle(); }
      catch (e) { toast('Spotify girişi tamamlanamadı: ' + e.message); }
      ciz();
    } else {
      // giriş başka bir pencerede döndü (iPhone'da ana ekran uygulaması ayrı tarayıcı görünümü açabilir):
      // kod ana ekrandaki uygulamaya elle taşınır
      ui.girisKodu = kod;
      ui.rota = { gorunum: 'sarkilar' };
      ciz();
    }
  }
  function spotifyBaglantiyiKes() {
    clearTimeout(HS.zamanlayici);
    HS.token = null; HS.yenile = null; HS.bitis = 0; HS.calan = null;
    try { localStorage.removeItem(HESAP_ANAHTAR); } catch (e) { /* yok */ }
  }
  async function erisim() {
    if (!HS.yenile) throw new Error('Spotify\'a bağlı değil.');
    if (!HS.token || Date.now() > HS.bitis) {
      try { await tokenIste({ grant_type: 'refresh_token', refresh_token: HS.yenile }); }
      catch (e) { if (e.kod === 'invalid_grant') { spotifyBaglantiyiKes(); ciz(); toast('Spotify bağlantısının süresi doldu; yeniden bağlan.'); } throw e; }
    }
    return HS.token;
  }
  async function api(yol, secenek) {
    const t = await erisim();
    const s = Object.assign({}, secenek || {});
    s.headers = Object.assign({ Authorization: 'Bearer ' + t }, s.headers || {});
    const r = await fetch('https://api.spotify.com/v1' + yol, s);
    if (r.status === 401) { HS.token = null; throw new Error('Spotify yetkisi yenileniyor, tekrar dene.'); }
    if (r.status === 204 || r.status === 202) return null;
    const tx = await r.text();
    let j = null; try { j = tx ? JSON.parse(tx) : null; } catch (e) { j = null; }
    if (!r.ok) {
      const e = new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
      e.durum = r.status; e.neden = j && j.error && j.error.reason; throw e;
    }
    return j;
  }
  // Çalan şarkıyı düzenli sor (sayfa görünürken). Şarkı sayfasında daha sık.
  function calanIzle() {
    clearTimeout(HS.zamanlayici);
    if (!bagli()) return;
    const tur = async () => {
      if (document.visibilityState === 'visible') {
        const t0 = performance.now();
        try {
          const d = await api('/me/player/currently-playing');
          calanGuncelle(d, (performance.now() - t0) / 1000);
          HS.hata = null;
        } catch (e) { HS.hata = e.message; calanSeridiCiz(); }
      }
      if (!bagli()) return;
      const sik = ui.rota.gorunum === 'sarki';
      HS.zamanlayici = setTimeout(tur, sik ? 1200 : 3000);
    };
    tur();
  }
  function calanGuncelle(d, rtt) {
    if (!d || !d.item || d.item.type !== 'track') HS.calan = null;
    else {
      const it = d.item;
      HS.calan = {
        id: it.id, ad: it.name, sanatci: (it.artists || []).map((a) => a.name).join(', '),
        album: it.album ? it.album.name : '', yil: ((it.album && it.album.release_date) || '').slice(0, 4),
        sure: (it.duration_ms || 0) / 1000, pos: (d.progress_ms || 0) / 1000 + (d.is_playing ? rtt / 2 : 0),
        caliyor: !!d.is_playing, t: performance.now(),
      };
    }
    // açık şarkı Spotify'da çalıyorsa sayaç zamanı buradan
    const s = aktifSarki();
    const C = HS.calan;
    if (s && s.spotifyId) {
      if (C && C.id === s.spotifyId) {
        const tahmin = SP.songId === s.id && !SP.durdu ? spotifyZamani() : null;
        // küçük farklarda kaydırma yok: sayım titremesin
        const pos = tahmin != null && C.caliyor && Math.abs(tahmin - C.pos) < 0.25 ? tahmin : C.pos;
        SP.songId = s.id; SP.kaynak = 'hesap';
        spotifyOlay({ position: pos * 1000, duration: C.sure * 1000, isPaused: !C.caliyor });
      } else if (SP.songId === s.id && SP.kaynak === 'hesap' && !SP.durdu) {
        spotifyOlay({ position: spotifyZamani() * 1000, duration: SP.dur * 1000, isPaused: true });
      }
    }
    calanSeridiCiz();
  }
  function calanSimdi() { const C = HS.calan; return C ? C.pos + (C.caliyor ? (performance.now() - C.t) / 1000 : 0) : 0; }
  // Şarkılar sayfasındaki "Spotify'da çalıyor" kartı ve şarkı sayfasının alt şeridi
  function calanKartHtml() {
    if (!SPOTIFY_VAR) return '';
    if (!bagli()) {
      const b = bekleyenGiris();
      return `<div class="satir"><button class="btn" data-act="spotify-baglan">Spotify'a bağlan</button>
        <span class="kucuk soluk">Bağlanınca telefondaki Spotify'da çalan şarkı tek dokunuşla eklenir, sayaç Spotify'ın çaldığı yeri izler. Premium gerekir.</span></div>
        ${b ? `<label class="kucuk">Giriş tarayıcıda kaldıysa oradaki kodu buraya yapıştır<input id="giris-kodu" placeholder="kod" autocomplete="off"></label>` : ''}`;
    }
    const C = HS.calan;
    if (HS.hata && !C) return `<p class="kucuk soluk">Spotify: ${esc(HS.hata)}</p>`;
    if (!C) return '<p class="kucuk soluk">Spotify\'a bağlı. Telefondaki Spotify\'da bir şarkı çaldığında burada görünür.</p>';
    const varOlan = DB.songs.find((x) => x.spotifyId === C.id);
    return `<div class="satir ara"><div style="min-width:0"><div class="kucuk soluk">Spotify'da ${C.caliyor ? 'çalıyor' : 'duraklatıldı'}</div>
      <b>${esc(C.ad)}</b> <span class="soluk">${esc(C.sanatci)}</span></div>
      ${varOlan ? `<button class="btn kucuk" data-act="git" data-h="sarki-${varOlan.id}">Aç</button>` : '<button class="btn ana kucuk" data-act="calan-ekle">Ekle</button>'}</div>`;
  }
  function seritHtml(s) {
    const C = HS.calan;
    const ayni = C && C.id === s.spotifyId;
    if (HS.hata && !C) return `<div class="satir ara"><span class="kucuk">Spotify: ${esc(HS.hata)}</span></div>`;
    if (ayni) {
      return `<div class="satir ara"><span class="mono" id="sc-zaman">${sureMetni(calanSimdi())} / ${sureMetni(C.sure)}</span>
        <span class="satir"><button class="btn kucuk" data-act="sp-sar" data-d="-5">−5 sn</button>
        <button class="btn kucuk ana" data-act="sp-durdur-devam">${C.caliyor ? 'Durdur' : 'Çal'}</button>
        <button class="btn kucuk" data-act="sp-sar" data-d="5">+5 sn</button></span></div>`;
    }
    return `<div class="satir ara"><span class="kucuk" style="min-width:0">${C ? `Spotify'da başka şarkı: ${esc(C.ad)}` : 'Spotify\'da şu an bir şey çalmıyor.'}</span>
      <button class="btn kucuk ana" data-act="sp-cal">Bu şarkıyı Spotify'da çal</button></div>`;
  }
  function calanSeridiCiz() {
    const kart = $('#calan-kart');
    if (kart) kart.innerHTML = calanKartHtml();
    const yer = $('#sc-api');
    const s = aktifSarki();
    if (yer && s && s.spotifyId && bagli()) yer.innerHTML = seritHtml(s);
  }
  async function spotifyKomut(yol, yontem, govde) {
    try {
      await api(yol, { method: yontem, headers: govde ? { 'Content-Type': 'application/json' } : {}, body: govde ? JSON.stringify(govde) : undefined });
      setTimeout(calanIzle, 350);
    } catch (e) {
      if (e.durum === 404 || e.neden === 'NO_ACTIVE_DEVICE') toast('Spotify\'da etkin cihaz yok: telefonda Spotify\'ı açıp bir şarkı başlat, sonra tekrar dene.');
      else if (e.durum === 403) toast('Spotify bu komuta izin vermedi (Premium gerekir ya da cihaz uzaktan kontrolü kapalı).');
      else toast('Spotify: ' + e.message);
    }
  }
  function calaniEkle() {
    const C = HS.calan;
    if (!C) return;
    const varOlan = DB.songs.find((x) => x.spotifyId === C.id);
    if (varOlan) { git('sarki-' + varOlan.id); return; }
    const s = yeniSarki({ spotifyId: C.id, title: C.ad, artist: C.sanatci, album: C.album, year: C.yil, durationSec: Math.round(C.sure * 10) / 10 });
    DB.songs.push(s); kaydet();
    toast(`“${C.ad}” eklendi.`);
    git('sarki-' + s.id);
  }

  // ---------------- Dinlerken işaretle ----------------
  // Spotify bu şarkıyı çalarken dokunuşlar şarkının Spotify'daki saniyesine yazılır.
  // Vuruş dokunuşlarından tempo ve vuruş ızgarası, "1"den dansın başı, break/vurgu dokunuşlarından harita işaretleri.
  function dokunusIzgarasi(liste) {
    const t = [...(liste || [])].sort((a, b) => a - b);
    if (t.length < 8) return null;
    const ar = [];
    for (let i = 1; i < t.length; i++) { const d = t[i] - t[i - 1]; if (d > 0.18 && d < 1.6) ar.push(d); }
    if (ar.length < 6) return null;
    ar.sort((a, b) => a - b);
    let p = ar[ar.length >> 1], a = t[0];
    // dokunuşları ızgara sırasına yuvarlayıp doğru uydur (en küçük kareler), üç tur
    for (let tur = 0; tur < 3; tur++) {
      const k = t.map((x) => Math.round((x - a) / p));
      const n = t.length;
      let sk = 0, st = 0, skk = 0, skt = 0;
      for (let i = 0; i < n; i++) { sk += k[i]; st += t[i]; skk += k[i] * k[i]; skt += k[i] * t[i]; }
      const pay = n * skk - sk * sk;
      if (!pay) break;
      p = (n * skt - sk * st) / pay;
      a = (st - p * sk) / n;
    }
    let hata = 0;
    for (const x of t) { const r = x - (a + p * Math.round((x - a) / p)); hata += r * r; }
    return { periyot: p, evre: a, bpm: 60 / p, sapma: Math.sqrt(hata / t.length) };
  }
  function isaretDurumu(s) {
    const iz = dokunusIzgarasi(s.vurusDokunuslari);
    const n = (s.vurusDokunuslari || []).length;
    if (!n) return 'Henüz vuruş dokunuşu yok.';
    if (!iz) return `${n} vuruş dokunuşu (en az 8 gerekli).`;
    return `${n} vuruş dokunuşu · tempo ${sayi(iz.bpm)} BPM · sapma ±${Math.round(iz.sapma * 1000)} ms`;
  }
  function isaretDokun(tur) {
    const s = aktifSarki();
    if (!s) return;
    if (!(SP.songId === s.id && SP.dur > 0 && !SP.durdu)) { toast('Önce Spotify\'da bu şarkıyı çal.'); return; }
    const an = Math.round((spotifyZamani() - (s.spotifyKayma || 0)) * 1000) / 1000;
    const durumYaz = (m) => { const el = $('#isaret-durum'); if (el) el.textContent = m; };
    if (tur === 'vurus') {
      s.vurusDokunuslari = s.vurusDokunuslari || [];
      s.vurusDokunuslari.push(an);
      s.updatedAt = Date.now(); kaydet();
      durumYaz(isaretDurumu(s));
      return;
    }
    if (tur === 'bir') {
      const iz = dokunusIzgarasi(s.vurusDokunuslari);
      if (s.beats && s.originIdx != null) {
        // analiz vuruşları varsa en yakın vuruş dansın ilk 1'i olur
        let en = 0; for (let i = 1; i < s.beats.length; i++) if (Math.abs(s.beats[i] - an) < Math.abs(s.beats[en] - an)) en = i;
        s.originIdx = en; s.firstOneSec = s.beats[en];
      } else s.firstOneSec = iz ? Math.round((iz.evre + iz.periyot * Math.round((an - iz.evre) / iz.periyot)) * 1000) / 1000 : an;
      s.spotifyKayma = 0;
      s.updatedAt = Date.now(); kaydet();
      toast(`Dansın ilk 1'i: ${sureMetni(s.firstOneSec)} (${sayi(s.firstOneSec)} sn).`);
      return;
    }
    if (!s.bpm) { toast('Önce tempo gerekli: vuruşlara dokunup "Bulunan tempoyu kullan"a bas.'); return; }
    const b = Math.round(zamandanVurus(s, an));
    if (b < 0) { toast('Bu an dansın ilk 1\'inden önce.'); return; }
    const anahtar = tur === 'break' ? 'breaks' : 'accents';
    s[anahtar] = [...new Set([...(s[anahtar] || []), b])].sort((x, y) => x - y);
    s.haritaElle = true; s.updatedAt = Date.now(); kaydet();
    const k = S.sayim(b);
    toast(`${tur === 'break' ? 'Break' : 'Vurgu'}: ${k.blok + 1}. sekizlik, sayım ${k.etiket}.`);
  }

  // ---------------- olaylar ----------------
  function aktifSarki() { return ui.rota.gorunum === 'sarki' ? sarki(ui.rota.id) : null; }
  function koreoGuncelle(c) { c.updatedAt = Date.now(); const s = sarki(c.songId); if (s) s.updatedAt = Date.now(); kaydet(); ciz(); }

  const eylem = {
    git: (el, e) => { e.preventDefault(); git(el.dataset.h); },
    sekme: (el) => { const s = aktifSarki(); ui.sekme[s.id] = el.dataset.k; ui.secOge = null; ciz(); },
    'yeni-vazgec': () => { ui.yeniForm = null; ui.yeniUyari = null; ui.yeniOnay = false; ciz(); },
    yorum: (el) => { const s = aktifSarki(); tempoYorumu(s, +el.dataset.v); s.updatedAt = Date.now(); kaydet(); ciz(); if (s.beats) toast('Analiz vuruşları ve işaretler yeni tempoya göre ölçeklendi.'); },
    'kaynak-kullan': (el) => { const s = aktifSarki(); const k = s.bpmSources.find((x) => x.id === el.dataset.id); if (!k) return; tempoYorumu(s, k.bpm); s.bpmOlcum = k.bpm; s.bpmKaynak = k.kaynak; kaydet(); ciz(); },
    'kaynak-sil': (el) => { const s = aktifSarki(); if (!onayli('k-' + el.dataset.id)) return; s.bpmSources = s.bpmSources.filter((x) => x.id !== el.dataset.id); kaydet(); ciz(); },
    'tap-sifirla': () => { ui.tap = []; const el = $('#tap-sonuc'); if (el) el.textContent = tapMetni(); },
    'tap-kaydet': () => {
      const s = aktifSarki(); const b = tapBpm();
      if (!b) { toast('Önce en az 4 kez dokun.'); return; }
      kaynakEkle(s, 'dokunma', b, `${ui.tap.length} dokunuş`);
      if (!s.bpm) { s.bpm = Math.round(b * 10) / 10; s.bpmOlcum = s.bpm; s.bpmKaynak = 'dokunma'; }
      ui.tap = []; kaydet(); ciz(); toast('Dokunma ölçümü eklendi.');
    },
    mikrofon: () => { const s = aktifSarki(); mikrofonBasla(s); },
    'mik-vazgec': () => { mikrofonKapat(); ciz(); },
    'mik-bitir': () => {
      const M = mikrofonKapat(); if (!M) return;
      const s = sarki(M.songId);
      let n = 0; for (const p of M.parcalar) n += p.length;
      const mono = new Float32Array(n); let o = 0;
      for (const p of M.parcalar) { mono.set(p, o); o += p.length; }
      ciz();
      const fark = spotifyFarki(M.spotifyCiftleri);
      sesiAnalizEt(s, mono, M.sr, 'mikrofon', fark != null ? 'mikrofon + Spotify zamanı' : 'mikrofon kaydı', { spotifyFarki: fark, spotifyVardi: M.spotifyCiftleri.length > 0 });
    },
    'analiz-uygula': () => { const s = aktifSarki(); haritayiAnalizdenKur(s); s.haritaElle = false; kaydet(); ciz(); toast('Analiz önerileri haritaya uygulandı.'); },
    'sarki-sil': (el) => {
      if (!onayli('sarki-' + el.dataset.id)) return;
      DB.songs = DB.songs.filter((x) => x.id !== el.dataset.id);
      DB.choreos = DB.choreos.filter((x) => x.songId !== el.dataset.id);
      sesSil(el.dataset.id).catch(() => {});
      ui.sarkiDuzen = null;
      kaydet(); git('sarkilar'); toast('Şarkı silindi.');
    },
    'spotify-ekle': async () => {
      let metin = '';
      try { if (navigator.clipboard && navigator.clipboard.readText) metin = await navigator.clipboard.readText(); } catch (e) { /* izin yok: yapıştırma alanı açılır */ }
      spotifyIleEkle(metin);
    },
    'sarki-duzen': (el) => { ui.sarkiDuzen = el.dataset.id; ciz(); },
    'sarki-duzen-bitti': () => { ui.sarkiDuzen = null; ciz(); toast('Kaydedildi.'); },
    'ses-sil': (el) => {
      if (!onayli('ses-' + el.dataset.id)) return;
      const s = sarki(el.dataset.id);
      sesSil(el.dataset.id).catch(() => {});
      if (ui.sesler[el.dataset.id]) { try { URL.revokeObjectURL(ui.sesler[el.dataset.id].url); } catch (e) { /* yok */ } delete ui.sesler[el.dataset.id]; }
      if (s) { delete s.sesDosyasi; kaydet(); }
      ciz(); toast('Ses dosyası uygulamadan silindi; analiz ve koreografiler duruyor.');
    },
    'hazir-isaret': (el) => {
      const c = DB.choreos.find((x) => x.id === el.dataset.id); if (!c) return;
      c.hazir = !c.hazir; c.updatedAt = Date.now(); kaydet(); ciz();
      toast(c.hazir ? `“${c.name}” hazır koreografilere eklendi (Koreografiler sekmesi).` : `“${c.name}” hazırlardan çıkarıldı.`);
    },
    'koreo-prova': (el) => {
      const c = DB.choreos.find((x) => x.id === el.dataset.id); if (!c) return;
      ui.secKoreo[c.songId] = c.id; ui.sekme[c.songId] = 'prova'; git('sarki-' + c.songId);
    },
    'koreo-ac': (el) => {
      const c = DB.choreos.find((x) => x.id === el.dataset.id); if (!c) return;
      ui.secKoreo[c.songId] = c.id; ui.sekme[c.songId] = 'koreo'; git('sarki-' + c.songId);
    },
    'koreo-metin-ac': (el) => { ui.metinAcik = ui.metinAcik === el.dataset.id ? null : el.dataset.id; ciz(); },
    'koreo-metin-kopyala': (el) => { const p = $('#metin-' + el.dataset.id); kopyala(p && p.textContent, p); },
    'spotify-baglan': () => { spotifyGiris().catch((e) => toast('Spotify girişi açılamadı: ' + e.message)); },
    'spotify-kes': () => { if (!onayli('spotify-kes')) return; spotifyBaglantiyiKes(); ciz(); toast('Spotify bağlantısı kesildi.'); },
    'giris-kodu-kopyala': () => { const i = $('#giris-kodu-goster'); kopyala(i && i.value, i); },
    'calan-ekle': () => calaniEkle(),
    'sp-cal': () => { const s = aktifSarki(); if (s && s.spotifyId) spotifyKomut('/me/player/play', 'PUT', { uris: ['spotify:track:' + s.spotifyId] }); },
    'sp-durdur-devam': () => { const C = HS.calan; spotifyKomut(C && C.caliyor ? '/me/player/pause' : '/me/player/play', 'PUT'); },
    'sp-sar': (el) => {
      const C = HS.calan; if (!C) return;
      const hedef = Math.max(0, Math.min(C.sure - 1, calanSimdi() + +el.dataset.d));
      spotifyKomut('/me/player/seek?position_ms=' + Math.round(hedef * 1000), 'PUT');
    },
    'isaret-tempo': () => {
      const s = aktifSarki(); const iz = dokunusIzgarasi(s.vurusDokunuslari);
      if (!iz) { toast('En az 8 vuruş dokunuşu gerekli.'); return; }
      kaynakEkle(s, 'dokunma', iz.bpm, `Spotify'la dinlerken, ${s.vurusDokunuslari.length} dokunuş`);
      // dokunuş ızgarası düzgün tempo varsayar; eski analiz vuruşları bırakılır (analiz verisi saklı kalır)
      s.beats = null; s.originIdx = null;
      s.bpm = Math.round(iz.bpm * 10) / 10; s.bpmOlcum = s.bpm; s.bpmKaynak = 'dokunma';
      if (s.firstOneSec != null) s.firstOneSec = Math.round((iz.evre + iz.periyot * Math.round((s.firstOneSec - iz.evre) / iz.periyot)) * 1000) / 1000;
      s.updatedAt = Date.now(); kaydet(); ciz();
      toast(`Tempo ${sayi(s.bpm)} BPM. Şimdi dansın ilk 1'inde "1"e dokun.`);
    },
    'isaret-sifirla': (el) => { if (!onayli('isaret-' + el.dataset.id)) return; const s = sarki(el.dataset.id); s.vurusDokunuslari = []; kaydet(); ciz(); },
    isaret: (el) => {
      const s = aktifSarki(); const b = +el.dataset.b;
      const acc = new Set(s.accents || []), brk = new Set(s.breaks || []);
      if (brk.has(b)) brk.delete(b); else if (acc.has(b)) { acc.delete(b); brk.add(b); } else acc.add(b);
      s.accents = [...acc].sort((x, y) => x - y); s.breaks = [...brk].sort((x, y) => x - y);
      s.haritaElle = true; s.updatedAt = Date.now(); kaydet(); ciz();
    },
    enerji: (el) => {
      const s = aktifSarki(); const k = +el.dataset.k;
      s.energy = s.energy || [];
      while (s.energy.length <= k) s.energy.push(2);
      s.energy[k] = S.blokEnerji(s, k) % 3 + 1;
      s.haritaElle = true; kaydet(); ciz();
    },
    ilk1: (el) => { const s = aktifSarki(); ilkBirKaydir(s, +el.dataset.d); kaydet(); ciz(); },
    'koreo-yeni': () => {
      const s = aktifSarki(); const ayar = Object.assign(varsayilanAyar(), s.sonAyar || {});
      const n = koreolari(s.id).length + 1;
      const c = koreoUret(s, ayar, `Koreografi ${n}`);
      if (!c.items.length) { toast('Bu aralıkta koreografi için yer yok.'); }
      ui.secOge = null; s.updatedAt = Date.now(); kaydet(); ciz();
    },
    'koreo-alternatif': () => {
      const s = aktifSarki(); const c0 = aktifKoreo(s);
      const sabit = c0.items.filter((x) => x.locked).map((x) => Object.assign({}, x, { id: S.uid('i') }));
      const ayar = Object.assign({}, c0.settings);
      const items = S.olustur({ song: s, moves: DB.moves, ayar, aralik: c0.range, sabitler: sabit });
      const c = { id: S.uid('c'), songId: s.id, name: `${c0.name} · alternatif`, settings: ayar, range: c0.range.slice(), items, createdAt: Date.now(), updatedAt: Date.now() };
      DB.choreos.push(c); ui.secKoreo[s.id] = c.id; ui.secOge = null; kaydet(); ciz(); toast('Alternatif oluşturuldu; öncekini listeden seçebilirsin.');
    },
    'koreo-sil': (el) => {
      if (!onayli('koreo-' + el.dataset.id)) return;
      DB.choreos = DB.choreos.filter((x) => x.id !== el.dataset.id); kaydet(); ciz();
    },
    metin: () => { ui.metinGoster = !ui.metinGoster; ciz(); },
    'metin-kopyala': () => kopyala($('#koreo-metin') && $('#koreo-metin').textContent, $('#koreo-metin')),
    'kilitsiz-yenile': () => {
      const s = aktifSarki(); const c = aktifKoreo(s);
      c.items = S.olustur({ song: s, moves: DB.moves, ayar: c.settings, aralik: c.range, sabitler: c.items.filter((x) => x.locked) });
      ui.secOge = null; koreoGuncelle(c);
    },
    'git-prova': () => { const s = aktifSarki(); ui.sekme[s.id] = 'prova'; ciz(); window.scrollTo(0, 0); },
    'blok-yenile': (el) => {
      const s = aktifSarki(); const c = aktifKoreo(s); const k = +el.dataset.k;
      c.items = S.bolgeyiYenile({ song: s, moves: DB.moves, ayar: c.settings, aralik: c.range, items: c.items, bolge: [k * 8, k * 8 + 8] });
      ui.secOge = null; koreoGuncelle(c);
    },
    'uyari-duzelt': () => duzeltUygula(null),
    'oge-duzelt': (el) => duzeltUygula(el.dataset.id),
    'oge-sec': (el) => { ui.secOge = ui.secOge === el.dataset.id ? null : el.dataset.id; ciz(); },
    'oge-kilit': (el) => { const s = aktifSarki(); const c = aktifKoreo(s); const it = c.items.find((x) => x.id === el.dataset.id); it.locked = !it.locked; koreoGuncelle(c); },
    'oge-ayna': (el) => { const s = aktifSarki(); const c = aktifKoreo(s); const it = c.items.find((x) => x.id === el.dataset.id); it.side = it.side === 'L' ? 'R' : 'L'; koreoGuncelle(c); },
    'oge-sil': (el) => {
      const s = aktifSarki(); const c = aktifKoreo(s); const it = c.items.find((x) => x.id === el.dataset.id);
      if (it.locked) { toast('Sabitlenmiş hareketi silmek için önce sabitini kaldır.'); return; }
      c.items = c.items.filter((x) => x.id !== it.id); ui.secOge = null; koreoGuncelle(c);
    },
    'oge-tasi': (el) => {
      const s = aktifSarki(); const c = aktifKoreo(s);
      const arr = [...c.items].sort((a, b) => a.t - b.t);
      const i = arr.findIndex((x) => x.id === el.dataset.id), j = i + +el.dataset.d;
      if (j < 0 || j >= arr.length) { toast('Bu yönde hareket yok.'); return; }
      const A = arr[Math.min(i, j)], B = arr[Math.max(i, j)];
      if (A.locked || B.locked) { toast('Sabitlenmiş hareketin yeri değişmez.'); return; }
      if (!S.yakin(A.t + A.L, B.t)) { toast('Aralarında boşluk var; yer değiştirmek için bitişik olmalılar.'); return; }
      const t0 = A.t; B.t = t0; A.t = t0 + B.L;
      koreoGuncelle(c);
      const u = S.dogrula(c.items, s, DB.moves, c.range).uyarilar;
      if ((u.get(A.id) || []).length || (u.get(B.id) || []).length) toast('Yer değişti; yeni yerinde sayım uyarısı var, kontrol et.');
    },
    'bosluk-doldur': (el) => {
      const s = aktifSarki(); const c = aktifKoreo(s); const t = +el.dataset.t, L = +el.dataset.l;
      c.items = S.olustur({ song: s, moves: DB.moves, ayar: c.settings, aralik: c.range, sabitler: c.items, bolge: [t, t + L] });
      koreoGuncelle(c);
    },
    'sp-ilk1': () => {
      // şarkı seçili sekizliğin 1'ine geldiği an: Spotify zamanı ile koreografi sayımı eşlenir
      const s = aktifSarki();
      if (SP.songId !== s.id || SP.dur <= 0) { toast('Önce bu şarkıyı Spotify\'da çal.'); return; }
      const an = spotifyZamani();
      const blok = ui.prBas[s.id] ?? Math.floor(aktifKoreo(s).range[0] / 8);
      if (s.beats && s.originIdx != null) {
        const i = Math.min(s.beats.length - 1, s.originIdx + blok * 8);
        s.spotifyKayma = Math.round((an - s.beats[i]) * 1000) / 1000;
      } else {
        s.firstOneSec = Math.max(0, Math.round((an - blok * 8 * 60 / (s.bpm || 120)) * 1000) / 1000);
      }
      s.updatedAt = Date.now(); kaydet(); T.kayma = 0; T.sonIdx = null;
      if (!SP.durdu) takipBasla(s, 'spotify');
      toast(`Eşlendi: ${blok + 1}. sekizliğin 1'i Spotify'da ${sayi(an)}. saniye.`);
    },
    'pr-sayarak': () => { const s = aktifSarki(); if (T.ac && T.ac.state === 'suspended') T.ac.resume(); takipBasla(s, 'sayarak'); },
    'pr-durdur': () => { takipDurdur(); const a = $('#pr-ses'); if (a) a.pause(); },
    'pr-kay': (el) => { T.kayma += +el.dataset.d; },
    'pr-tempo': (el) => { T.bpmFark += +el.dataset.d; const s = aktifSarki(); const e = $('#pr-bpm'); if (e) e.textContent = sayi((s.bpm || 120) + T.bpmFark) + ' BPM'; },
    'hareket-yeni': () => { ui.hareketDuzen = 'yeni'; ciz(); window.scrollTo(0, 0); },
    'hareket-duzen': (el) => { ui.hareketDuzen = el.dataset.id; ciz(); window.scrollTo(0, 0); },
    'hareket-vazgec': () => {
      ui.hareketDuzen = null;
      if (ui.hareketDonus) { const h = ui.hareketDonus; ui.hareketDonus = null; git(h); return; }
      ciz();
    },
    'hareket-ac': (el) => { ui.hareketDuzen = el.dataset.id; ui.hareketDonus = 'sarki-' + ui.rota.id; git('hareketler'); },
    'hareket-sil': (el) => {
      if (!onayli('h-' + el.dataset.id)) return;
      DB.moves = DB.moves.filter((m) => m.id !== el.dataset.id); ui.hareketDuzen = null; kaydet(); ciz(); toast('Hareket silindi.');
    },
    'varsayilan-geri': () => {
      let n = 0;
      for (const m of S.varsayilanHareketler()) if (!DB.moves.some((x) => x.id === m.id)) { DB.moves.push(m); n++; }
      kaydet(); ciz(); toast(n ? `${n} hareket geri eklendi.` : 'Eksik varsayılan hareket yok.');
    },
    'yedek-indir': async () => {
      const ad = `swing-choreo-studio-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      await dosyaVer(ad, JSON.stringify(DB, null, 1), 'application/json');
    },
    'yedek-goster': () => { ui.yedekGoster = !ui.yedekGoster; ciz(); },
    'yedek-kopyala': () => { const t = $('#yedek-metin-cikis'); kopyala(t && t.value, t); },
    'yedek-metinden': () => { const t = $('#yedek-girdi'); yedekOku(t ? t.value : ''); },
    'yedek-birlestir': () => {
      const g = ui.yedekGelen; if (!g) return;
      for (const k of ['moves', 'songs', 'choreos']) {
        const harita = new Map(DB[k].map((x) => [x.id, x]));
        for (const x of g[k]) harita.set(x.id, x);
        DB[k] = [...harita.values()];
      }
      duzelt(); kaydet(); ui.yedekGelen = null; ciz(); toast('Yedek birleştirildi.');
    },
    'yedek-degistir': () => {
      if (!onayli('yedek-degistir')) return;
      DB = ui.yedekGelen; duzelt(); kaydet(); ui.yedekGelen = null; ciz(); toast('Veriler yedekle değiştirildi.');
    },
    'sayfa-indir': async () => {
      const html = '<!doctype html>\n' + document.documentElement.outerHTML;
      await dosyaVer('swing-choreo-studio.html', html, 'text/html');
    },
  };

  const degisim = {
    'sarki-alan': (el) => {
      const s = el.dataset.id ? sarki(el.dataset.id) : aktifSarki(); const k = el.dataset.alan; const v = el.value.trim();
      if (k === 'spotify') {
        if (!v) s.spotifyId = null;
        else {
          const id = spotifyId(v);
          if (!id) { toast('Bu bir Spotify şarkı bağlantısı değil (open.spotify.com/track/… olmalı).'); ciz(); return; }
          const ayni = DB.songs.find((x) => x.id !== s.id && x.spotifyId === id);
          if (ayni) toast(`Bu bağlantı “${ayni.title}” kaydında da var.`);
          s.spotifyId = id;
        }
      } else if (k === 'durationSec') {
        const sn = sureOku(v); if (sn == null) { toast('Süreyi dk:sn olarak yaz (ör. 2:45).'); ciz(); return; } s.durationSec = sn;
      } else if (k === 'firstOneSec') {
        const sn = parseFloat(v.replace(',', '.')); if (isNaN(sn) || sn < 0) { toast('İlk 1 için saniye yaz (ör. 3,5).'); ciz(); return; } s.firstOneSec = sn;
      } else if (k === 'title' && !v) { toast('Şarkı adı boş olamaz.'); ciz(); return; }
      else s[k] = v;
      s.example = s.example && k !== 'title' && k !== 'artist';
      s.updatedAt = Date.now(); kaydet(); ciz();
    },
    'ses-dosya': (el) => { const s = aktifSarki(); const f = el.files && el.files[0]; if (f) dosyaAnaliz(s, f); el.value = ''; },
    // Ses dosyasından yeni şarkı: ad (ve "Sanatçı - Ad" biçimindeyse sanatçı) dosya adından, analiz hemen başlar
    'dosya-ekle': (el) => {
      const f = el.files && el.files[0]; el.value = '';
      if (!f) return;
      const ham = f.name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').replace(/^\d{1,3}[\s.\-]+/, '').trim();
      const parca = ham.split(/\s+[-–]\s+/);
      const v = parca.length >= 2 ? { artist: parca[0].trim(), title: parca.slice(1).join(' - ').trim() } : { artist: '', title: ham };
      const s = yeniSarki({ title: v.title || 'Yeni şarkı', artist: v.artist });
      DB.songs.push(s); kaydet();
      ui.sekme[s.id] = 'tempo';
      git('sarki-' + s.id);
      dosyaAnaliz(s, f);
    },
    'vurgu-hassasiyet': (el) => {
      const s = aktifSarki(); if (!s || !s.analiz || !s.beats) return;
      s.vurguHassasiyet = el.value;
      s.accents = S.turet({ beats: s.beats, vDb: s.analiz.vDb, vOn: s.analiz.vOn, ozel: s.analiz.ozel, origin: s.originIdx, hassasiyet: el.value }).accents;
      s.updatedAt = Date.now(); kaydet(); ciz();
      toast(`Vurgu hassasiyeti: ${HASSASIYET[el.value]}. ${s.accents.length} vurgu işaretlendi; koreografiyi yeniden oluşturunca hareketler bunlara göre yerleşir.`);
    },
    bolum: (el) => {
      const s = aktifSarki(); const b = +el.dataset.c * 32;
      s.sections = (s.sections || []).filter((x) => x.beat !== b);
      if (el.value) s.sections.push({ beat: b, label: el.value });
      s.sections.sort((x, y) => x.beat - y.beat); s.haritaElle = true; kaydet(); ciz();
    },
    ayar: (el) => {
      const s = aktifSarki(); const ayar = Object.assign(varsayilanAyar(), s.sonAyar || {});
      const k = el.dataset.k; ayar[k] = ['seviye', 'enerji', 'tekrar', 'bas', 'bit'].includes(k) ? +el.value : el.value;
      if (ayar.bit < ayar.bas) { if (k === 'bas') ayar.bit = ayar.bas; else ayar.bas = ayar.bit; }
      s.sonAyar = ayar; kaydet(); ciz();
    },
    'koreo-sec': (el) => { const s = aktifSarki(); ui.secKoreo[s.id] = el.value; ui.secOge = null; takipDurdur(); ciz(); },
    'koreo-ad': (el) => { const s = aktifSarki(); const c = aktifKoreo(s); c.name = el.value.trim() || c.name; koreoGuncelle(c); },
    'oge-degistir': (el) => {
      if (!el.value) return;
      const s = aktifSarki(); const c = aktifKoreo(s); const it = c.items.find((x) => x.id === el.dataset.id);
      const [moveId, L, side, on, bir] = el.value.split('|');
      const items = c.items.map((x) => (x.id === it.id ? Object.assign({}, x, { locked: false }) : x));
      const r = S.yerlestir({ song: s, moves: DB.moves, ayar: c.settings, aralik: c.range, items, t: it.t, moveId, L: +L, side: side || null, on: +on, bir: +bir });
      if (r.hata) { toast(r.hata); ciz(); return; }
      c.items = r.items; ui.secOge = (c.items.find((x) => S.yakin(x.t, it.t)) || {}).id || null; koreoGuncelle(c);
    },
    'bosluk-ekle': (el) => {
      if (!el.value) return;
      const s = aktifSarki(); const c = aktifKoreo(s); const t = +el.dataset.t;
      const [moveId, L, side, on, bir] = el.value.split('|');
      c.items.push({ id: S.uid('i'), moveId, t, L: +L, side: side || null, on: +on || 0, bir: +bir || 0, locked: false });
      koreoGuncelle(c);
    },
    'pr-bas': (el) => { const s = aktifSarki(); ui.prBas[s.id] = +el.value; takipDurdur(); const c = aktifKoreo(s); yaz('pr-simdi', esc(ilkHareketAdi(c, +el.value * 8))); },
    metronom: (el) => { ui.metronom = el.checked; if (el.checked && !T.ac) { try { T.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* yok */ } } },
    'hizli-vurgu': (el) => {
      const m = hareket(el.dataset.id); if (!m) return;
      m.vurguSayimlari = vurguOku(el.value);
      kaydet();
      toast(m.vurguSayimlari.length ? `${m.name}: vurgu sayımı ${m.vurguSayimlari.map(sayi).join(', ')}.` : `${m.name}: vurgu sayımı kaldırıldı.`);
    },
    'hizli-kullan': (el) => {
      const m = hareket(el.dataset.id); if (!m) return;
      m.kullan = el.checked;
      kaydet();
      $('#hareket-liste').innerHTML = hareketListesi();
      const say = $('#kullanim-sayisi'); if (say) say.textContent = kullanimMetni();
      toast(m.kullan ? `${m.name} otomatik koreografide kullanılacak.` : `${m.name} otomatik koreografide kullanılmayacak (kütüphanede duruyor). Var olan koreografilerde değişmez; yeniden oluşturunca çıkar.`);
    },
    'hizli-sayim': (el) => {
      const m = hareket(el.dataset.id); if (!m) return;
      m[el.dataset.k] = +el.value;
      kaydet();
      const kul = DB.choreos.filter((c) => c.items.some((x) => x.moveId === m.id)).length;
      $('#hareket-liste').innerHTML = hareketListesi();
      toast(`${m.name}: başlangıç ${S.baslangicEtiketi(m.start)}, ${sayi(m.length)} sayım kaydedildi.${kul ? ` ${kul} koreografide kullanılıyor; uymayan yerler uyarıyla görünür.` : ''}`);
    },
    'yedek-dosya': async (el) => { const f = el.files && el.files[0]; if (!f) return; yedekOku(await f.text()); el.value = ''; },
  };

  // Sayımları düzelt: hareketler silinmez, sadece yerleri ve geçişleri (8'de hazırlık, 8'i bırakma) ayarlanır
  function duzeltUygula(hedef) {
    const s = aktifSarki(); const c = aktifKoreo(s);
    const uyariSay = (items) => [...S.dogrula(items, s, DB.moves, c.range).uyarilar.values()].filter((u) => u.length).length;
    const once = uyariSay(c.items);
    const r = S.sayimlariDuzelt({ song: s, moves: DB.moves, ayar: c.settings, aralik: c.range, items: c.items, hedef });
    c.items = r.items; ui.secOge = null;
    ui.sigmayan = new Set(r.yerlesmeyen);
    koreoGuncelle(c);
    const sonra = uyariSay(c.items);
    if (!sonra) toast('Sayımlar düzeltildi; hareketler aynı kaldı.');
    else if (r.yerlesmeyen.length) toast(`${Math.max(0, once - sonra)} uyarı düzeldi, ${sonra} kaldı. ${r.yerlesmeyen.length} hareket kendi sayımıyla yerine sığmadı; altında nedeni ve seçeneklerin yazıyor. Hiçbir hareket silinmedi.`);
    else toast(`${Math.max(0, once - sonra)} uyarı düzeldi, ${sonra} kaldı: sabit hareketler, tempo ya da ağırlık uyarıları sayım düzeltmesiyle değişmez. Hiçbir hareket silinmedi.`);
  }
  function ilkBirKaydir(s, d) {
    if (s.beats && s.originIdx != null) {
      const yeni = Math.max(0, Math.min(s.beats.length - 9, s.originIdx + d));
      d = yeni - s.originIdx;
      if (!d) return;
      s.originIdx = yeni; s.firstOneSec = s.beats[yeni];
    } else {
      s.firstOneSec = Math.max(0, Math.round(((s.firstOneSec || 0) + d * 60 / (s.bpm || 120)) * 1000) / 1000);
    }
    s.accents = (s.accents || []).map((b) => b - d).filter((b) => b >= 0);
    s.breaks = (s.breaks || []).map((b) => b - d).filter((b) => b >= 0);
    if (s.analiz && s.analiz.vDb && s.beats) {
      const yeni = S.turet({ beats: s.beats, vDb: s.analiz.vDb, vOn: s.analiz.vOn, ozel: s.analiz.ozel, origin: s.originIdx, hassasiyet: s.vurguHassasiyet });
      s.energy = yeni.energy;
      if (!s.haritaElle) s.sections = yeni.sections;
      else s.sections = (s.sections || []).map((x) => ({ beat: Math.max(0, Math.round((x.beat - d) / 32) * 32), label: x.label }));
    } else {
      if (d % 8 === 0) { const k = d / 8; s.energy = k > 0 ? (s.energy || []).slice(k) : Array(-k).fill(2).concat(s.energy || []); }
      s.sections = (s.sections || []).map((x) => ({ beat: Math.max(0, Math.round((x.beat - d) / 32) * 32), label: x.label }));
    }
    const temiz = new Map(); for (const x of s.sections) temiz.set(x.beat, x); s.sections = [...temiz.values()].sort((a, b) => a.beat - b.beat);
    s.updatedAt = Date.now();
    if (koreolari(s.id).length) toast('İlk 1 kaydı. Koreografiler sayıma bağlı olduğu için müzikte yeni yerlerine kaydı; gerekirse yeniden oluştur.');
  }
  function haritayiAnalizdenKur(s) {
    if (!s.analiz || !s.beats) return;
    const r = S.turet({ beats: s.beats, vDb: s.analiz.vDb, vOn: s.analiz.vOn, ozel: s.analiz.ozel, origin: s.originIdx, hassasiyet: s.vurguHassasiyet });
    s.energy = r.energy; s.breaks = r.breaks; s.accents = r.accents; s.sections = r.sections;
  }

  async function kopyala(metin, el) {
    if (!metin) return;
    try { await navigator.clipboard.writeText(metin); toast('Kopyalandı.'); }
    catch (e) {
      if (el) { try { if (el.select) el.select(); else { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } } catch (x) { /* yok */ } }
      toast('Kopyalanamadı; metin seçildi, elle kopyala.');
    }
  }
  async function dosyaVer(ad, metin, tur) {
    if (indirici) {
      try { await indirici.save({ filename: ad, data: metin }); toast('İndirildi.'); return; }
      catch (e) { if (e && e.code === 'declined') { toast('İndirme iptal edildi.'); return; } }
    }
    if (!CLAUDE_ICINDE) {
      // iPhone'da paylaşım sayfası: "Dosyalar'a Kaydet" seçilebilir
      try {
        const dosya = new File([metin], ad, { type: tur });
        if (navigator.canShare && navigator.canShare({ files: [dosya] })) {
          await navigator.share({ files: [dosya], title: ad });
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') { toast('Kaydetme iptal edildi.'); return; } }
      try {
        const url = URL.createObjectURL(new Blob([metin], { type: tur }));
        const a = document.createElement('a'); a.href = url; a.download = ad; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      } catch (e) { /* aşağıya düş */ }
    }
    if (tur === 'application/json') { ui.yedekGoster = true; ciz(); }
    toast('Bu görünümde indirme kapalı. JSON metnini kopyalayabilirsin.');
  }
  function yedekOku(txt) {
    try {
      const d = JSON.parse(txt);
      if (!d || !Array.isArray(d.moves) || !Array.isArray(d.songs) || !Array.isArray(d.choreos)) throw new Error();
      ui.yedekGelen = d; ciz();
    } catch (e) { ui.yedekGelen = null; toast('Bu metin bir Swing Choreo Studio yedeği değil.'); ciz(); }
  }

  function hareketKaydet() {
    const g = (id) => $('#' + id);
    const hata = (m) => { const e = g('hf-hata'); e.textContent = m; e.hidden = false; e.scrollIntoView({ block: 'center' }); };
    const ad = g('hf-ad').value.trim();
    if (!ad) return hata('Hareketin bir adı olmalı.');
    const L = parseFloat(g('hf-sure').value.replace(',', '.'));
    if (!(L > 0 && L <= 32) || Math.abs(L * 2 - Math.round(L * 2)) > 1e-6) return hata('Süre 0,5 ile 32 arasında, yarım sayım adımlarıyla olmalı.');
    const ops = g('hf-secenek').value.split(/[\s,;]+/).filter(Boolean).map((x) => parseFloat(x.replace(',', '.')));
    if (ops.some((x) => !(x > 0 && x <= 32))) return hata('Süre seçenekleri sayı olmalı (ör. 2, 4, 8).');
    const b1 = parseInt(g('hf-bpm1').value, 10), b2 = parseInt(g('hf-bpm2').value, 10);
    if (!(b1 > 0 && b2 > 0 && b1 < b2)) return hata('Rahat tempo aralığında en az değer en çoktan küçük olmalı (ör. 100 ve 220).');
    const video = g('hf-video').value.trim();
    if (video && !/^https?:\/\//i.test(video)) return hata('Video bağlantısı http:// ya da https:// ile başlamalı.');
    const yeni = ui.hareketDuzen === 'yeni';
    const m = yeni ? { id: S.uid('h'), builtin: false } : hareket(ui.hareketDuzen);
    Object.assign(m, {
      name: ad, kind: g('hf-tur').value, start: +g('hf-bas').value, length: L, lengthOptions: ops.length ? ops : null,
      flexStart: g('hf-esnek').checked, energy: +g('hf-enerji').value, level: +g('hf-seviye').value,
      character: g('hf-karakter').value, travel: g('hf-yon').value, bpmMin: b1, bpmMax: b2,
      accents: [...document.querySelectorAll('input[name="hf-vurgu"]:checked')].map((x) => x.value),
      weightStart: g('hf-ag1').value, weightEnd: g('hf-ag2').value, mirror: g('hf-ayna').checked, sekizSerbest: g('hf-serbest').checked, kullan: g('hf-kullan').checked, vurguSayimlari: vurguOku(g('hf-vurgu-sayim').value),
      desc: g('hf-aciklama').value.trim(), variations: g('hf-varyasyon').value.trim(), video,
    });
    if (yeni) DB.moves.push(m);
    ui.hareketDuzen = null; kaydet();
    if (ui.hareketDonus) { const h = ui.hareketDonus; ui.hareketDonus = null; git(h); } else ciz();
    toast(yeni ? 'Hareket eklendi.' : 'Hareket kaydedildi. Koreografilerde artık uymayan yerler uyarıyla görünür; "Sabit olmayanları yeniden oluştur" ile yenileyebilirsin.');
  }

  const formlar = {
    'yeni-sarki': () => {
      const v = { spotify: $('#ys-spotify').value.trim(), ad: $('#ys-ad').value.trim(), sanatci: $('#ys-sanatci').value.trim(), yil: $('#ys-yil').value.trim(), album: $('#ys-album').value.trim() };
      if (JSON.stringify(v) !== JSON.stringify(ui.yeniForm)) { if (ui.yeniForm) ui.yeniOnay = false; }
      ui.yeniForm = v;
      const sid = v.spotify ? spotifyId(v.spotify) : null;
      if (v.spotify && !sid) { ui.yeniUyari = 'Bu bir Spotify şarkı bağlantısı değil. Bağlantı open.spotify.com/track/… biçiminde olmalı (albüm ya da çalma listesi değil).'; ui.yeniOnay = false; ciz(); return; }
      if (!v.ad) { ui.yeniUyari = 'Şarkı adı gerekli.'; ciz(); return; }
      if (sid) { const ayni = DB.songs.find((s) => s.spotifyId === sid); if (ayni) { ui.yeniUyari = `Bu Spotify kaydı zaten ekli: “${esc(ayni.title)}”, ${esc(ayni.artist)}.`; ui.yeniOnay = false; ciz(); return; } }
      const norm = (x) => String(x || '').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const benzer = DB.songs.filter((s) => norm(s.title) === norm(v.ad));
      if (benzer.length && !ui.yeniOnay) {
        ui.yeniUyari = `Aynı adla ${benzer.length} kayıt var: ${benzer.map((s) => esc(s.artist) + (s.year ? ' (' + esc(s.year) + ')' : '')).join(', ')}. Farklı bir kayıtsa (başka sanatçı, yıl ya da versiyon) yine de ekle: tempo ve koreografiler her kayıt için ayrı tutulur.`;
        ui.yeniOnay = true; ciz(); return;
      }
      const s = { id: S.uid('s'), title: v.ad, artist: v.sanatci, year: v.yil, album: v.album, spotifyId: sid || null, bpm: null, bpmOlcum: null, bpmKaynak: null, bpmSources: [], durationSec: null, firstOneSec: 0, beats: null, originIdx: null, energy: [], breaks: [], accents: [], sections: [], createdAt: Date.now(), updatedAt: Date.now() };
      DB.songs.push(s); kaydet();
      ui.yeniForm = null; ui.yeniUyari = null; ui.yeniOnay = false;
      git('sarki-' + s.id);
    },
    'elle-bpm': () => {
      const s = aktifSarki(); const b = parseFloat($('#elle-bpm').value.replace(',', '.'));
      if (!(b >= 30 && b <= 400)) { toast('BPM 30 ile 400 arasında bir sayı olmalı.'); return; }
      kaynakEkle(s, $('#elle-kaynak').value, b, $('#elle-not').value.trim());
      if (!s.bpm) { s.bpm = Math.round(b * 10) / 10; s.bpmOlcum = s.bpm; s.bpmKaynak = $('#elle-kaynak').value; }
      kaydet(); ciz(); toast('Ölçüm eklendi.');
    },
    hareket: hareketKaydet,
  };

  function sonraCiz() {
    spotifyGuncelle();
    sesHazirla(aktifSarki());
    if (ui.rota.gorunum === 'yedek') depoBilgisiCiz();
    const yap = $('#sp-yapistir');
    if (yap) {
      yap.addEventListener('paste', () => setTimeout(() => spotifyIleEkle(yap.value), 0));
      yap.addEventListener('change', () => spotifyIleEkle(yap.value));
    }
    const a = $('#pr-ses');
    if (a) {
      const s = aktifSarki();
      a.addEventListener('play', () => { takipBasla(s, 'dosya'); });
      a.addEventListener('pause', () => { takipDurdur(); });
      a.addEventListener('seeked', () => { T.sonIdx = null; if (!T.calisiyor) { const c = aktifKoreo(s); const sy = $('#pr-sayac'); if (c && sy) cizTakip(s, c, zamandanVurus(s, a.currentTime), sy); } });
    }
    const ara = $('#hareket-ara');
    if (ara) ara.addEventListener('input', () => { ui.ara = ara.value; $('#hareket-liste').innerHTML = hareketListesi(); });
    const gk = $('#giris-kodu');
    if (gk) {
      const bitir = () => {
        const v = gk.value.trim(); if (!v) return;
        // tam dönüş adresi yapıştırıldıysa içinden kodu al
        let kod = v; try { const u = new URL(v); if (u.searchParams.get('code')) kod = u.searchParams.get('code'); } catch (e) { /* düz kod */ }
        kodDegistir(kod).then(() => { toast('Spotify\'a bağlandı.'); ciz(); calanIzle(); }).catch((e) => toast('Bağlanamadı: ' + e.message));
      };
      gk.addEventListener('paste', () => setTimeout(bitir, 0));
      gk.addEventListener('change', bitir);
    }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const f = eylem[el.dataset.act];
    if (f) f(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-ch]');
    if (!el) return;
    const f = degisim[el.dataset.ch];
    if (f) f(el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const h = formlar[f.dataset.form];
    if (h) h(f, e);
  });
  document.addEventListener('pointerdown', (e) => {
    const is = e.target.closest('[data-isaret]');
    if (is) { e.preventDefault(); isaretDokun(is.dataset.isaret); return; }
    const el = e.target.closest('[data-tap]');
    if (!el) return;
    e.preventDefault();
    if (el.dataset.tap === 'pr') { const s = aktifSarki(); if (T.ac && T.ac.state === 'suspended') T.ac.resume(); takipBasla(s, 'dokun'); }
    else tapDokun();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT|BUTTON|AUDIO/.test(tag)) return;
    const s = aktifSarki();
    if (s && (ui.sekme[s.id] || 'tempo') === 'tempo') { e.preventDefault(); tapDokun(); }
  });
  window.addEventListener('hashchange', () => { ui.rota = rotaOku(); ui.secOge = null; ciz(); });

  // başlat
  yukle();
  ui.rota = rotaOku();
  if (SPOTIFY_VAR) hesapYukle();
  ciz();
  if (SPOTIFY_VAR) {
    girisDonusu().finally(() => calanIzle());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') calanIzle(); });
    // şeritteki Spotify saati akıcı ilerlesin
    setInterval(() => { const z = $('#sc-zaman'); const C = HS.calan; if (z && C) z.textContent = `${sureMetni(calanSimdi())} / ${sureMetni(C.sure)}`; }, 500);
  }
  (async () => {
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        indirici = await window.claude.use('downloads');
      }
    } catch (e) { indirici = null; }
  })();

  // Kendi adresinde: çevrimdışı açılma (service worker) ve kalıcı depolama isteği
  if (!CLAUDE_ICINDE && location.protocol.startsWith('http')) {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((v) => { kaliciDepo = !!v; if (ui.rota.gorunum === 'yedek') ciz(); }).catch(() => {});
    }
  }

  // deneme için dışa açık (sadece okuma amaçlı)
  window.__scs = { DB: () => DB, S, spotifyOlay: (d) => spotifyOlay(d), calanGuncelle: (d, r) => calanGuncelle(d, r || 0), HS, dokunusIzgarasi, isaretDokun, donusAdresi };
})();
