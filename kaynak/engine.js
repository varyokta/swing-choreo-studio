// ======================================================================
// Swing Choreo Studio — saf motor: hareket kütüphanesi, sayım matematiği,
// koreografi üretimi, doğrulama ve sesten analiz. Arayüze bağlı değildir.
// Zaman birimi: "vuruş" (count). 0 = şarkıdaki ilk "1". Yarım vuruş = "&".
// ======================================================================
const SCS = (function () {
  'use strict';
  const EPS = 1e-6;
  const mod = (a, n) => ((a % n) + n) % n;
  const yakin = (a, b) => Math.abs(a - b) < 1e-4;
  const uid = (p) => (p || '') + Math.random().toString(36).slice(2, 9) + (Date.now() % 1e7).toString(36);
  const bekle = () => new Promise((r) => setTimeout(r, 0));

  // ---------------- Hareket kütüphanesi ----------------
  function H(id, name, start, length, travel, energy, level, character, bpmMin, bpmMax, desc, ek) {
    return Object.assign({
      id, name, start, length, lengthOptions: null, flexStart: false, travel, energy, level, character,
      accents: [], weightStart: 'any', weightEnd: 'any', mirror: false, sekizSerbest: true, kullan: true, bpmMin, bpmMax,
      desc, video: '', variations: '', kind: 'hareket', builtin: true,
      vurguSayimlari: VARSAYILAN_VURGU[id] ? VARSAYILAN_VURGU[id].slice() : [],
    }, ek || {});
  }
  // Hareketin vurguyu yaptığı dans sayımları (başlangıç önerisi; kullanıcı kütüphanede düzeltir)
  const VARSAYILAN_VURGU = {
    'stomps': [1], 'kick-ball-change': [8], 'boogie-drops': [1, 5], 'scissor-kicks': [1, 3],
    'hallelujah': [1], 'knee-slaps': [1, 3], 'shimmy': [1], 'apple-jacks': [1, 5], 'charleston': [1, 5],
  };

  function varsayilanHareketler() {
    return [
      H('suzie-q', 'Suzie Q', 1, 4, 'yana', 2, 1, 'akıcı', 100, 220, 'Topuk ve parmak ucu dönüşleriyle yana kayan hareket. Bir yöne 4 sayım; iki yön art arda 8 eder.', { mirror: true }),
      H('shorty-george', 'Shorty George', 1, 8, 'ileri', 2, 1, 'groove', 100, 200, 'Alçak duruşta, dizler birlikte adım yönüne dönerek küçük adımlarla ilerleme.'),
      H('tacky-annie', 'Tacky Annie', 1, 8, 'yerinde', 2, 1, 'oyunbaz', 120, 240, 'Yerinde, oyunbaz adım ve tekme dizisi.', { variations: 'Varyasyonlarını buraya yaz (ör. dönüşlü, tek ayakla, yarım tempoda).' }),
      H('apple-jacks', 'Apple Jacks', 1, 8, 'yana', 3, 2, 'oyunbaz', 110, 220, 'Ayak uçları ve topuklar dönerken ağırlık bir yandan öbür yana aktarılır; dizler yaylanır.', { mirror: true }),
      H('fall-off-the-log', 'Fall Off The Log', 1, 8, 'yana', 2, 2, 'akıcı', 120, 230, 'Çapraz düşer gibi ağırlık aktarımı; gövde yanlara sallanır.', { mirror: true }),
      H('boogie-forward', 'Boogie Forward', 8, 8, 'ileri', 2, 1, 'groove', 100, 220, 'Kalça ve dizlerle groove yaparak öne ilerleyen adımlar.'),
      H('boogie-back', 'Boogie Back', 1, 8, 'geri', 2, 1, 'groove', 100, 220, 'Boogie Forward\'ın geriye giden eşi.'),
      H('charleston', 'Charleston', 1, 8, 'yerinde', 3, 1, 'groove', 120, 240, 'Öne ve geriye ayak vuruşları arasında ağırlık aktarımı; klasik sallanan ritim.'),
      H('kick-ball-change', 'Kick Ball Change', 7, 2, 'yerinde', 2, 1, 'vurgu', 90, 260, 'Tekme, ayak ucu, ağırlık değişimi: "7 & 8". Cümle sonu ve geçiş için. 4 sayımlık periyotla 3 & 4\'te de girer.', { mirror: true, accents: ['cümle sonu'] }),
      H('scissor-kicks', 'Scissor Kicks', 1, 4, 'yerinde', 3, 2, 'keskin', 120, 260, 'Ayaklar sıçrayarak makas gibi öne-arkaya yer değiştirir.', { accents: ['vurgu'] }),
      H('camel-walk', 'Camel Walk', 1, 8, 'ileri', 1, 1, 'akıcı', 90, 180, 'Gövde dalgasıyla öne doğru yumuşak yürüyüş.'),
      H('mess-around', 'Mess Around', 1, 8, 'yerinde', 1, 1, 'akıcı', 80, 180, 'Gövde ve kalça daireleri; sakin bölümler için.'),
      H('fishtails', 'Fishtails', 1, 4, 'yerinde', 2, 2, 'oyunbaz', 100, 200, 'Kalça yanlara sallanır, ayaklar yerinde küçük adımlar atar.'),
      H('jazz-square', 'Jazz Square', 1, 4, 'yerinde', 1, 1, 'akıcı', 80, 220, 'Çapraz, geri, yana, öne: dört adımla kare.', { mirror: true }),
      H('shimmy', 'Shimmy', 1, 4, 'yerinde', 2, 1, 'oyunbaz', 80, 260, 'Omuzların hızlı titreşimi. Süresi esnek: vurgu ya da dolgu.', { flexStart: true, lengthOptions: [2, 4, 8], accents: ['vurgu'] }),
      H('stomps', 'Stomps', 1, 2, 'yerinde', 3, 1, 'vurgu', 80, 260, 'Ağırlıklı ayak vuruşu; müzikteki darbeleri (hit) vurgular.', { flexStart: true, lengthOptions: [1, 2, 4], accents: ['vurgu', 'cümle sonu'] }),
      H('swivels', 'Swivels', 1, 8, 'ileri', 2, 2, 'oyunbaz', 100, 200, 'Topuk ya da parmak uçları üzerinde ayaklar birlikte dönerek ilerler.'),
      H('boogie-drops', 'Boogie Drops', 1, 8, 'yerinde', 2, 2, 'keskin', 100, 200, 'Dizlerle aşağı düşüş ve kalkış; vurgulu.', { accents: ['vurgu'] }),
      // 2. grup (sürüm 3): klasik vernacular jazz adımları. Sayımlar başlangıç önerisidir.
      H('truckin', "Truckin'", 1, 8, 'ileri', 2, 1, 'groove', 100, 220, 'İşaret parmağı sallanırken topuk dönüşleriyle öne yürüyüş.'),
      H('peckin', "Peckin'", 1, 4, 'yerinde', 2, 2, 'oyunbaz', 110, 220, 'Baş ve boyun öne-geri "gagalar", adımlar ritimle.'),
      H('spank-the-baby', 'Spank the Baby', 1, 8, 'yerinde', 2, 2, 'oyunbaz', 120, 220, 'Elle vurgu yapılan oyunbaz adım dizisi.'),
      H('eagle-slide', 'Eagle Slide', 1, 8, 'yana', 2, 2, 'akıcı', 100, 200, 'Bir bacak gergin, yana kayarak ilerleme.', { mirror: true }),
      H('crazy-legs', 'Crazy Legs', 1, 4, 'yerinde', 3, 2, 'oyunbaz', 120, 240, 'Dizler içe-dışa çapraz hareket eder.'),
      H('black-bottom', 'Black Bottom', 1, 8, 'yerinde', 2, 2, 'groove', 100, 200, 'Kalça vurgulu, ayak vuruşlu 1920\'ler adımı.'),
      H('cakewalk', 'Cakewalk', 1, 8, 'ileri', 2, 1, 'oyunbaz', 100, 200, 'Dik ve gösterişli, dizleri kaldırarak yürüyüş.'),
      H('tick-tocks', 'Tick Tocks', 1, 4, 'yana', 1, 1, 'akıcı', 100, 220, 'Ağırlık sarkaç gibi iki yana aktarılır.', { mirror: true }),
      H('hallelujah', 'Hallelujah', 1, 8, 'yerinde', 3, 2, 'keskin', 120, 240, 'Kollar yukarıda, sıçramalı ve vurgulu adım.', { accents: ['vurgu'] }),
      H('scarecrow', 'Scarecrow', 1, 8, 'yerinde', 2, 2, 'oyunbaz', 110, 220, 'Korkuluk gibi kollar, gevşek bacak sallamaları.'),
      H('mooche', 'Mooche', 1, 4, 'yerinde', 1, 2, 'akıcı', 90, 200, 'Ayaklar birlikte topuk ve parmak ucuyla kayar.'),
      H('knee-slaps', 'Knee Slaps', 1, 4, 'yerinde', 3, 1, 'vurgu', 120, 240, 'Dizlere el vuruşlarıyla vurgu.', { accents: ['vurgu'] }),
      H('poz', 'Duruş / Poz', 1, 2, 'yerinde', 1, 1, 'poz', 40, 400, 'Dur, tut, gövdeyle ifade et. Kısa boşluklar ve cümle sonları için. Her sayımda başlayabilir, süresi yere göre ayarlanır.', { flexStart: true, kind: 'poz', accents: ['cümle sonu'], system: true }),
      H('freeze', 'Freeze (break)', 1, 2, 'yerinde', 1, 1, 'poz', 40, 400, 'Müzikteki break boyunca tamamen dur; müzik dönünce devam et. Break işaretlerine kendiliğinden konur.', { flexStart: true, kind: 'poz', accents: ['break'], system: true }),
    ];
  }

  const KARAKTERLER = ['akıcı', 'groove', 'keskin', 'oyunbaz', 'vurgu', 'poz'];
  const YONLER = ['yerinde', 'ileri', 'geri', 'yana'];
  const VURGU_ETIKETLERI = ['vurgu', 'break', 'cümle sonu', 'cümle başı'];

  // ---------------- Sayım matematiği ----------------
  // Mutlak vuruş → sekizlik numarası (0 tabanlı) ve sayım etiketi ("1".."8", "7&")
  function sayim(b) {
    const blok = Math.floor(b / 8 + EPS);
    const ic = b - blok * 8;
    const tam = Math.floor(ic + EPS);
    const yarim = ic - tam > 0.25;
    return { blok, sayi: tam + 1, etiket: (tam + 1) + (yarim ? '&' : '') };
  }
  // Hareketin "başlangıç" alanı (1..8.5) → etiket
  function baslangicEtiketi(s) {
    const t = Math.floor(s + EPS);
    return t + (s - t > 0.25 ? '&' : '');
  }
  // Bir harekete ait son sayım (dahil)
  function sonVurus(t, L) { return t + L - (yakin(L % 1, 0) ? 1 : 0.5); }

  // 4 sayım ve altındaki hareketler 4'lük, uzunlar 8'lik periyotla hizalanır:
  // 1'de başlayan 4 sayımlık hareket 5'te de başlayabilir; 7&8'lik KBC 3&4'te de.
  function hizaPeriyodu(L) { return L <= 4 + EPS ? 4 : 8; }
  // t: hareketin kendi başlangıç sayımının düştüğü vuruş (8'de hazırlıkla girişte hazırlıktan sonraki vuruş)
  function baslangicUygun(m, t) {
    if (m.flexStart) return yakin(t * 2, Math.round(t * 2));
    const p = hizaPeriyodu(m.length);
    return yakin(mod(t, p), mod(m.start - 1, p));
  }
  const sonrakiSinir = (t, n) => Math.ceil(t / n - EPS) * n; // t sınırdaysa t

  // Hareketin giriş ailesi:
  //  '1'   1'de (4 sayımlıkta 5'te de) başlar
  //  '8'   8'de (4 sayımlıkta 4'te de) başlar: 8 → 1…7
  //  'ara' başka bir sayımda başlar (ör. Kick Ball Change 7&8)
  //  'esnek' süresi seçenekli dolgu/vurgu hareketi, 'poz' duruş ve freeze
  function aile(m) {
    if (!m) return 'esnek';
    if (m.kind === 'poz') return 'poz';
    if (m.flexStart) return 'esnek';
    const p = hizaPeriyodu(m.length), s = mod(m.start - 1, p);
    if (yakin(s, p - 1)) return '8';
    if (yakin(s, 0)) return '1';
    return 'ara';
  }
  // Geçiş kuralları (kullanıcı kararı):
  //  - 8'de başlayan hareketten sonra ya yine 8'de başlayan hareket gelir,
  //    ya da 1'de başlayan hareket 8'de hazırlıkla girer (on=1, süresi +1). 8 boş kalmaz.
  //  - 1'de başlayan hareketten 8'de başlayana geçmek için önceki hareket 8'ini bırakır
  //    (bir=1, süresi −1; kütüphanede "8'i bırakılabilir" açık olmalı) ya da araya duruş/break girer.
  function beklenenSure(m, it) { return m.length + (it.on ? 1 : 0) - (it.bir ? 1 : 0); }

  // 8'lik ve 32'lik cümle kuralı:
  // - Sekizliğin ortasında başlayan hareket ya o sekizlik içinde biter,
  //   ya da sadece 8'de bir sayımlık hazırlıkla sonraki sekizliğin 1'ine bağlanır.
  // - Hareketin gövdesi (hazırlıktan sonrası) 32'lik cümle sınırını aşamaz.
  function sinirUygun(t, L) {
    const son = t + L;
    const b8 = sonrakiSinir(t, 8);
    let cekirdek = t;
    if (b8 > t + EPS) {
      if (son <= b8 + EPS) return true;
      if (b8 - t > 1 + EPS) return false;
      cekirdek = b8;
    }
    const b32 = sonrakiSinir(cekirdek + 0.01, 32);
    return son <= b32 + EPS;
  }
  function hazirlik(t, L) {
    const b8 = sonrakiSinir(t, 8);
    return (b8 > t + EPS && t + L > b8 + EPS) ? b8 - t : 0;
  }

  function ayna(w, side) {
    if (side === 'L') return w === 'R' ? 'L' : w === 'L' ? 'R' : w;
    return w;
  }

  // ---------------- Şarkı yardımcıları ----------------
  function toplamVurus(s) {
    if (s.beats && s.beats.length && s.originIdx != null) return Math.max(0, s.beats.length - 1 - s.originIdx);
    if (s.bpm && s.durationSec) return Math.max(0, Math.floor((s.durationSec - (s.firstOneSec || 0)) * s.bpm / 60 + EPS));
    return 0;
  }
  function bolumEtiketi(s, b) {
    let l = '';
    for (const x of (s.sections || [])) if (x.beat <= b + EPS && x.label) l = x.label;
    return l;
  }
  function blokEnerji(s, blok) {
    const e = s.energy && s.energy[blok];
    return e >= 1 && e <= 3 ? e : 2;
  }
  function breakAraliklari(s, a, b) {
    const bs = [...new Set((s.breaks || []).filter((x) => x >= a - EPS && x < b - EPS))].sort((x, y) => x - y);
    const r = [];
    for (const x of bs) {
      const l = r[r.length - 1];
      if (l && yakin(l.t + l.L, x)) l.L += 1; else r.push({ t: x, L: 1 });
    }
    return r;
  }
  function aralikHesapla(s, ayar) {
    const top = toplamVurus(s);
    if (ayar.uzunluk === 'ilk') {
      const sec = (s.sections || []).map((x) => x.beat).filter((b) => b >= 32 && b < top).sort((a, b) => a - b);
      // ilk bölüm: ilk bölüm değişimine kadar, yoksa ilk iki cümle
      let son = sec.length ? sec[0] : Math.min(64, top);
      return [0, Math.min(son, top)];
    }
    if (ayar.uzunluk === 'secili') {
      const a = Math.max(0, ((ayar.bas || 1) - 1) * 8);
      const b = Math.min(top, (ayar.bit || 1) * 8);
      return [a, Math.max(a, b)];
    }
    return [0, top];
  }

  // ---------------- Puanlama ----------------
  function hedefEnerji(s, t, ayar) {
    const e = blokEnerji(s, Math.floor(t / 8 + EPS));
    const kay = { 1: -0.8, 2: 0, 3: 0.8 }[ayar.enerji] || 0;
    return Math.max(1, Math.min(3, e + kay));
  }
  function stilPuani(m, stil) {
    const c = m.character;
    if (stil === 'klasik') return c === 'groove' ? 1 : c === 'akıcı' ? 0.6 : c === 'keskin' ? -0.2 : 0;
    if (stil === 'enerjik') return (m.energy >= 3 ? 1 : m.energy === 2 ? 0.3 : -0.4) + (c === 'keskin' ? 0.3 : 0);
    if (stil === 'eglenceli') return c === 'oyunbaz' ? 1.2 : c === 'groove' ? 0.3 : 0;
    if (stil === 'ritmik') return c === 'keskin' ? 1.2 : c === 'vurgu' ? 0.8 : c === 'akıcı' ? -0.5 : 0;
    return 0;
  }
  const keskinMi = (m) => m.character === 'vurgu' || m.character === 'keskin' || (m.accents || []).includes('vurgu');

  // Hareketin vurgu sayımları (dans sayımı olarak, ör. [5]) → hareketin başından itibaren vuruş farkları.
  // 8'den uzun hareketlerde vurgu her 8 sayımda tekrar eder. on: 8'de hazırlıkla giriş (gövde 1 vuruş sonra).
  function vurguOfsetleri(m, L, on) {
    const acc = m && m.vurguSayimlari;
    if (!acc || !acc.length) return [];
    const govdeL = L - (on ? 1 : 0);
    const out = [];
    for (const a of acc) {
      const o0 = m.flexStart ? Math.max(0, a - 1) : mod(a - m.start, 8);
      for (let o = o0; o < govdeL - EPS; o += 8) out.push(o + (on ? 1 : 0));
    }
    return out;
  }
  // Bir öğenin müzikteki darbelerle (vurgu) denk gelen sayımları
  function vurguDenkligi(it, m, song) {
    const set = new Set((song.accents || []).map((a) => Math.round(a * 2)));
    return vurguOfsetleri(m, it.L, it.on).map((o) => it.t + o).filter((b) => set.has(Math.round(b * 2)));
  }

  function adayPuani(m, t, L, side, st, ctx, kopya, on) {
    const { song, ayar } = ctx;
    const guclu = ayar.uyum === 'guclu'; // "Müziğe vurgu uyumu: Güçlü"
    let p = 0;
    const acc = m.accents || [];
    if (m.kind === 'poz') {
      p -= 2.5;
      if (L > 2) p -= 0.5 * (L - 2);
      if (!kopya && st.son === 'poz') p -= 3;
    } else {
      p -= 1.3 * Math.abs(m.energy - hedefEnerji(song, t, ayar));
      if (ayar.enerji === 1) { if (L >= 8) p += 0.8; if (L <= 2) p -= 0.6; }
      else if (ayar.enerji === 2) { if (L >= 4) p += 0.3; }
      else if (L <= 4) p += 0.6;
      p += stilPuani(m, ayar.stil);
      if (m.level === ayar.seviye) p += ayar.seviye === 3 ? 0.5 : 0.3;
      if (!kopya) {
        // kullanım cezası şarkının uzunluğuna göre: uzun şarkıda hareketlerin tekrar etmesi doğal
        const k = { 1: 1.0, 2: 0.5, 3: 0.2 }[ayar.tekrar];
        const beklenen = ((t - ctx.aralik[0]) / 8 + 1) / Math.max(4, ctx.hareketSayisi) * { 1: 0.8, 2: 1, 3: 1.5 }[ayar.tekrar];
        p -= k * Math.max(0, (st.kullanim[m.id] || 0) - beklenen);
        if (L <= 2 && st.sonKisa) p -= 1;
        if (st.son === m.id) {
          // aynalı hareketin öbür yönü doğal bir eştir; aynı yönde tekrar cezalı
          if (m.mirror && side && st.sonSide && side !== st.sonSide) p -= { 1: 0.6, 2: 0.2, 3: 0 }[ayar.tekrar];
          else p -= { 1: 2.5, 2: 1.8, 3: 1.0 }[ayar.tekrar];
        }
        const ii = st.ileri + (m.travel === 'ileri' ? 1 : m.travel === 'geri' ? -1 : 0);
        if (Math.abs(ii) > 2) p -= Math.abs(ii) - 2;
        if (m.travel === 'yana') {
          const y = st.yan + (side === 'L' ? -1 : 1);
          if (Math.abs(y) > 1) p -= 0.6 * (Math.abs(y) - 1);
        }
      }
    }
    const son = t + L;
    // Müzikteki darbeler (vurgular): hareketin kendi vurgu sayımı darbeye denk gelirse güçlü ödül.
    // Darbe akıcı bir hareketin ortasına düşerse ceza (hareket müziği "kaçırır").
    const ofs = m.kind === 'poz' ? [] : vurguOfsetleri(m, L, on);
    const ofsSet = new Set(ofs.map((o) => Math.round((t + o) * 2)));
    let denk = 0;
    for (const a of ctx.vurgular) {
      if (a < t - EPS || a >= son - EPS) continue;
      if (ofsSet.has(Math.round(a * 2))) { p += guclu ? 3.4 : 1.8; denk++; }
      else if (!ofs.length && yakin(a, t)) p += keskinMi(m) ? 1.0 : 0.1; // vurgu sayımı girilmemiş harekette eski kural
      else if (m.character === 'akıcı' && L >= 4) p -= guclu ? 1.8 : 0.9;
      else if (!ofs.length && keskinMi(m)) p += 0.3;
      else p -= guclu ? 0.9 : 0.4;
    }
    // vurgu sayımı müzikte darbesiz bir yere düşüyorsa, yakında darbe varken hafif ceza (vurgu boşa gider)
    if (ofs.length && !denk && ctx.vurgular.some((a) => a >= t - EPS && a < son - EPS)) p -= guclu ? 0.9 : 0.3;
    // enerji yükselişi/düşüşü: sekizlik başında enerji arttıysa keskin/enerjik giriş, düştüyse akıcı geçiş
    const govdeBas = t + (on ? 1 : 0);
    if (m.kind !== 'poz' && yakin(mod(govdeBas, 8), 0)) {
      const blok = Math.round(govdeBas / 8);
      if (ctx.yukselis && ctx.yukselis.has(blok)) p += (keskinMi(m) || m.energy >= 3) ? 0.7 : -0.2;
      if (ctx.dusus && ctx.dusus.has(blok)) p += m.character === 'akıcı' || m.energy === 1 ? 0.5 : -0.2;
    }
    // vurgu müziğin bir sonraki sayımındaysa, akıcı hareketi orada bitirmek iyidir
    if (ctx.vurguSet.has(Math.round(son * 2)) && m.kind !== 'poz') p += 0.3;
    if (yakin(mod(son, 32), 0) && (acc.includes('cümle sonu') || m.character === 'vurgu')) p += 0.8;
    if (yakin(mod(t, 32), 0) && L >= 8) p += 0.3;
    if (acc.includes('cümle başı') && yakin(mod(t, 32), 0)) p += 0.6;
    if (ctx.sonVurus && yakin(son, ctx.sonVurus) && (acc.includes('cümle sonu') || keskinMi(m))) p += 1;
    return p;
  }

  // giris: sıradaki hareketin nasıl girebileceği
  //  'serbest' başta ya da break'ten sonra, 'normal' 1'lik ya da ara hareketten sonra,
  //  'zincir8' 8'de başlayan hareketten sonra, 'zorunlu8' 8 bırakıldıktan ya da duruş bağlantısından sonra
  function yeniDurum() { return { kullanim: {}, son: null, sonSide: null, sonKisa: false, agirlik: 'any', ileri: 0, yan: 0, giris: 'serbest' }; }
  function durumKopya(st) { return Object.assign({}, st, { kullanim: Object.assign({}, st.kullanim) }); }
  function girisSonrasi(it, m) {
    if (!m || m.id === 'freeze') return 'serbest';
    if (it.bir) return 'zorunlu8';
    const a = aile(m);
    if (a === '8') return 'zincir8';
    if (a === 'poz' && yakin(mod(it.t + it.L, 8), 7) && !it.dolgu) return 'zorunlu8';
    return 'normal';
  }
  function durumaUygula(st, it, m) {
    st.giris = girisSonrasi(it, m);
    if (!m) { st.agirlik = 'any'; st.son = null; return; }
    if (m.kind !== 'poz') st.kullanim[m.id] = (st.kullanim[m.id] || 0) + 1;
    st.son = m.id;
    st.sonSide = it.side || null;
    st.sonKisa = it.L <= 2 && m.kind !== 'poz';
    st.agirlik = ayna(m.weightEnd, it.side);
    if (m.travel === 'ileri') st.ileri += 1; else if (m.travel === 'geri') st.ileri -= 1;
    if (m.travel === 'yana') st.yan += it.side === 'L' ? -1 : 1;
  }
  // Geçiş kuralına uyuyor mu? Uymuyorsa nedenini döndürür.
  function gecisSorunu(giris, m, on, bir) {
    const a = aile(m);
    if (m.id === 'freeze') return null;
    if (on && !(giris === 'zincir8' || giris === 'serbest')) return '8\'de hazırlık sadece 8\'de başlayan bir hareketin ya da break\'in arkasından olur.';
    if (giris === 'zorunlu8' && a !== '8') return 'Önceki hareket 8\'ini bıraktı (ya da duruşla bağlandı); burada 8\'de başlayan bir hareket gelmeli.';
    if (giris === 'zincir8' && !(a === '8' || (a === '1' && on))) return 'Önceki hareket 8\'de başlıyor ve 7\'de bitiyor; arkasından ya yine 8\'de başlayan ya da 8\'de hazırlıkla giren bir hareket gelmeli.';
    if (giris === 'normal' && a === '8') return 'Bu hareket 8\'de başlıyor ama önceki hareket 8\'ini bırakmıyor; önceki hareketin 8\'ini bırak ya da araya duruş koy.';
    return null;
  }

  function uygunMu(m, ctx) {
    if (m.id === 'freeze') return false;
    if (m.kullan === false && m.kind !== 'poz') return false; // kullanıcı otomatik koreografide istemiyor
    if (m.level > ctx.ayar.seviye) return false;
    const bpm = ctx.song.bpm;
    if (bpm && m.kind !== 'poz' && (bpm < m.bpmMin * 0.97 || bpm > m.bpmMax * 1.03)) return false;
    return true;
  }
  // Duruş sadece meşru yerlerde: 8'de başlayan harekete bağlantı (8'den hemen önce biter),
  // break'ten önceki / koreografinin sonundaki kısa kalan.
  function pozUzunluklari(t, kalan, st, ctx) {
    const out = [];
    if (st.giris === 'zorunlu8') return out;
    if (st.giris === 'zincir8') { if (kalan <= 2 + EPS && ctx.sonuSerbest) out.push({ L: kalan, puan: -0.5 }); return out; }
    if (ctx.var8) {
      const hedef = sonrakiSinir(t + 0.01, 8) - 1; // sonraki 8'in hemen öncesi
      const L = hedef - t;
      if (L > EPS && L <= kalan - 1 + EPS) out.push({ L, puan: -1.5 - 0.25 * L });
    }
    if (kalan <= 4 + EPS && !out.some((o) => yakin(o.L, kalan))) out.push({ L: kalan, puan: -1 });
    return out;
  }

  // m hareketinin t'deki seçenekleri. elle: kurallara uymayanlar da döner (uyarıyla).
  function hareketSecenekleri(m, t, kalan, st, ctx, elle) {
    const out = [];
    const a = aile(m);
    const taraflar = m.mirror ? ['R', 'L'] : [null];
    const ekle = (L, on, bir, ek) => {
      if (!(L > EPS) || L > kalan + EPS) return;
      if (!sinirUygun(t, L)) return;
      const gecis = gecisSorunu(st.giris, m, on, bir);
      if (gecis && !elle) return;
      for (const side of taraflar) {
        const ws = ayna(m.weightStart, side);
        const ayak = st.agirlik !== 'any' && ws !== 'any' && ws !== st.agirlik;
        if (ayak && !elle) continue;
        const sorun = gecis || (ayak ? 'Ağırlık uymuyor.' : null);
        out.push({ tur: 'hareket', m, t, L, side, on, bir, sorun, puan: adayPuani(m, t, L, side, st, ctx, false, on) + (ek || 0) });
      }
    };
    if (a === 'poz') {
      if (m.id === 'freeze' && !elle) return out;
      if (elle) { const L = Math.min(kalan, sonrakiSinir(t + 0.01, 8) - t); ekle(L, 0, 0, 0); return out; }
      for (const o of pozUzunluklari(t, kalan, st, ctx)) ekle(o.L, 0, 0, o.puan + 2.5);
      return out;
    }
    if (a === 'esnek') {
      const uz = m.lengthOptions && m.lengthOptions.length ? m.lengthOptions : [m.length];
      if (!yakin(t, Math.round(t))) return out;
      for (const L of uz) if (yakin(mod(t + L, 4), 0)) ekle(L, 0, 0, 0); // sayımı kaydırmasın: 4'lük sınırda biter
      return out;
    }
    if (baslangicUygun(m, t)) {
      ekle(m.length, 0, 0, 0);
      if (a === '1' && m.sekizSerbest !== false) {
        // bırakılan 8'e oturabilecek 8'lik hareket var mı (8 uzunluklu: 8'de; 4 uzunluklu: 4'te ya da 8'de)
        const son = t + m.length - 1;
        const yer = (yakin(mod(son, 8), 7) && ctx.var8) || (yakin(mod(son, 4), 3) && ctx.var8_4);
        if (yer || elle) ekle(m.length - 1, 0, 1, -0.2);
      }
    }
    if (a === '1' && baslangicUygun(m, t + 1)) ekle(m.length + 1, 1, 0, 0);
    return out;
  }

  // Önceki parçayı (8'lik ya da 32'lik) kopyalama seçeneği
  function kopyaSecenegi(onceki, t, kaydir, W, ge, st, ctx, ters, bonus) {
    const src = t - kaydir;
    if (src < ctx.aralik[0] - 1 - EPS) return null;
    const i0 = onceki.findIndex((x) => yakin(x.t, src));
    if (i0 < 0) return null;
    const parca = onceki.filter((x) => x.t >= src - EPS && x.t < src + W - EPS);
    if (!parca.length || parca.some((x) => x.sabit || x.moveId === 'freeze' || x.dolgu)) return null;
    if (parca.every((x) => x.moveId === 'poz')) return null;
    for (let i = 1; i < parca.length; i++) if (!yakin(parca[i - 1].t + parca[i - 1].L, parca[i].t)) return null;
    const yeni = parca.map((x) => ({ moveId: x.moveId, t: x.t + kaydir, L: x.L, on: x.on || 0, bir: x.bir || 0, side: ters && x.side ? (x.side === 'R' ? 'L' : 'R') : x.side }));
    const son = yeni[yeni.length - 1];
    if (son.t + son.L > ge + EPS) return null;
    for (const y of yeni) if (!sinirUygun(y.t, y.L)) return null;
    const m0 = ctx.bul(yeni[0].moveId);
    if (!m0) return null;
    if (gecisSorunu(st.giris, m0, yeni[0].on, yeni[0].bir)) return null;
    const ws = ayna(m0.weightStart, yeni[0].side);
    if (st.agirlik !== 'any' && ws !== 'any' && ws !== st.agirlik) return null;
    if (ters && !parca.some((x) => x.side)) return null; // aynalanacak bir şey yoksa aynı seçenek
    // kopyanın sonu, bir sonraki parçanın başlayabileceği bir yere düşmeli (8 bırakıldıysa arkasında 8'lik yer olmalı)
    const sonM = ctx.bul(son.moveId);
    if (girisSonrasi(son, sonM) === 'zorunlu8' && son.t + son.L >= ge - EPS) return null;
    let toplam = 0, n = 0, ileri = 0;
    for (const y of yeni) {
      const m = ctx.bul(y.moveId); if (!m) return null;
      toplam += adayPuani(m, y.t, y.L, y.side, st, ctx, true, y.on); n++;
      ileri += m.travel === 'ileri' ? 1 : m.travel === 'geri' ? -1 : 0;
    }
    let ceza = 0;
    if (Math.abs(st.ileri + ileri) > 2) ceza += Math.abs(st.ileri + ileri) - 2;
    // aynı parça zaten bir kez tekrarlandıysa üçüncüsü cezalı
    const imza = (a, b) => onceki.filter((x) => x.t >= a - EPS && x.t < b - EPS).map((x) => x.moveId + (x.side || '') + (x.t - a) + '/' + x.L).join('|');
    const bu = imza(src, src + W);
    let tekrarSay = 0;
    if (W >= 32) { for (let a = src - 32; a >= ctx.aralik[0] - 1 - EPS; a -= 32) if (imza(a, a + W) === bu) tekrarSay++; }
    else for (let k = 1; k <= 3 && src - W * k >= ctx.aralik[0] - 1 - EPS; k++) if (imza(src - W * k, src - W * k + W) === bu) tekrarSay++; else break;
    if (tekrarSay) ceza += { 1: 3, 2: 2.2, 3: 0.8 }[ctx.ayar.tekrar] * tekrarSay;
    return { tur: 'kopya', ogeler: yeni, W: son.t + son.L - t, puan: bonus + toplam / n - ceza };
  }

  function secenekler(t, ge, st, onceki, ctx, ilkAdim) {
    const kalan = ge - t;
    const out = [];
    // 8'li zincire giren seçenekten sonra kurala uygun devam edecek yer kalmalı (break'e ya da sona kadar)
    const devamEder = (o) => {
      const kal = ge - (o.t + o.L);
      if (kal < EPS) return true;
      const g = girisSonrasi({ t: o.t, L: o.L, bir: o.bir }, o.m);
      if (g === 'zorunlu8') return kal >= ctx.min8 - EPS;
      if (g === 'zincir8') return kal <= 2 + EPS || kal >= Math.min(ctx.min8, ctx.min1 + 1) - EPS;
      return true;
    };
    for (const m of ctx.hareketler) {
      for (const o of hareketSecenekleri(m, t, kalan, st, ctx, false)) if (devamEder(o)) out.push(o);
    }
    // koreografinin ilk hareketi 8'de başlıyorsa girişin son sayımında (8) başlar
    if (ilkAdim && ctx.giris8) {
      for (const m of ctx.hareketler) if (aile(m) === '8') out.push(...hareketSecenekleri(m, t - 1, kalan + 1, st, ctx, false).filter(devamEder));
    }
    const pos = mod(t, 32);
    const tk = ctx.ayar.tekrar;
    // 8'lik tekrar (aynalı ya da aynı)
    let b8;
    if (yakin(pos, 8) || yakin(pos, 7)) b8 = { 1: 0.2, 2: 1.4, 3: 2.2 }[tk];
    else if (yakin(pos, 24) || yakin(pos, 23)) b8 = { 1: -1.5, 2: -1.0, 3: 0.6 }[tk];
    else b8 = { 1: -1.5, 2: -1.2, 3: 0.4 }[tk];
    for (const ters of [true, false]) {
      const k = kopyaSecenegi(onceki, t, 8, 8, ge, st, ctx, ters, b8 + (ters ? 0.2 : 0));
      if (k) out.push(k);
    }
    // 32'lik cümle tekrarı (aynı bölüm etiketi)
    if (yakin(pos, 0) || yakin(pos, 31)) {
      const lab = bolumEtiketi(ctx.song, t + 1.5);
      let bulundu = false;
      for (let k = 1; lab && t - 32 * k >= ctx.aralik[0] - 1 - EPS; k++) {
        if (bolumEtiketi(ctx.song, t - 32 * k + 1.5) !== lab) continue;
        const kp = kopyaSecenegi(onceki, t, 32 * k, 32, ge, st, ctx, false, { 1: -0.3, 2: 1.8, 3: 3 }[tk]);
        if (kp) { out.push(kp); bulundu = true; break; }
      }
      if (!bulundu) {
        const kp = kopyaSecenegi(onceki, t, 32, 32, ge, st, ctx, false, { 1: -3, 2: -1.5, 3: 0.3 }[tk]);
        if (kp) out.push(kp);
      }
    }
    return out;
  }

  function agirlikliSec(ops, sic, rnd) {
    let mx = -Infinity;
    for (const o of ops) mx = Math.max(mx, o.puan);
    let top = 0;
    const w = ops.map((o) => { const v = Math.exp((o.puan - mx) / sic); top += v; return v; });
    let r = rnd() * top;
    for (let i = 0; i < ops.length; i++) { r -= w[i]; if (r <= 0) return ops[i]; }
    return ops[ops.length - 1];
  }

  // Bir boşluğu [gs, ge) doldur: rastgele açgözlü denemeler, en iyisi seçilir.
  // Kurala uyan hiçbir seçenek yoksa "dolgu" işaretli duruş konur (doğrulamada uyarı olarak görünür).
  function boslukDoldur(gs, ge, st0, onceki0, ctx, deneme, sonrakiOge) {
    // boşluğun arkası break ya da koreografinin sonuysa oraya duruşla bağlanılabilir
    ctx.sonuSerbest = !sonrakiOge || sonrakiOge.moveId === 'freeze';
    let enIyi = null;
    for (let d = 0; d < deneme; d++) {
      const st = durumKopya(st0);
      const onceki = onceki0.slice();
      const yeni = [];
      let t = gs, puan = 0, guvenlik = 0, dolgu = 0;
      while (t < ge - EPS && guvenlik++ < 2000) {
        let ops = secenekler(t, ge, st, onceki, ctx, t === ctx.aralik[0] && !onceki.length);
        if (!ops.length) {
          const L = Math.min(ge - t, Math.max(1, sonrakiSinir(t + 0.01, 4) - t));
          ops = [{ tur: 'hareket', m: ctx.bul('poz'), t, L, side: null, on: 0, bir: 0, dolgu: true, puan: -6 }];
          dolgu++;
        }
        const s = agirlikliSec(ops, 0.7, ctx.rnd);
        const ogeler = s.tur === 'kopya' ? s.ogeler : [{ moveId: s.m.id, t: s.t, L: s.L, side: s.side, on: s.on || 0, bir: s.bir || 0, dolgu: !!s.dolgu }];
        for (const o of ogeler) {
          const it = { id: uid('i'), moveId: o.moveId, t: o.t, L: o.L, side: o.side || null, on: o.on || 0, bir: o.bir || 0, dolgu: !!o.dolgu, locked: false };
          yeni.push(it); onceki.push(it);
          durumaUygula(st, it, ctx.bul(o.moveId));
          t = o.t + o.L;
        }
        puan += s.puan * Math.max(1, (s.tur === 'kopya' ? s.W : s.L)) / 8;
      }
      puan -= dolgu * 10;
      // boşluğun arkasındaki sabit harekete kurala uygun bağlanmalı
      if (sonrakiOge) { const mn = ctx.bul(sonrakiOge.moveId); if (mn && gecisSorunu(st.giris, mn, sonrakiOge.on, sonrakiOge.bir)) puan -= 8; }
      if (!enIyi || puan > enIyi.puan) enIyi = { puan, yeni, st };
    }
    return enIyi;
  }

  function seededRnd(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function baglam(song, moves, ayar, aralik, seed) {
    const harita = new Map(moves.map((m) => [m.id, m]));
    const sistem = varsayilanHareketler();
    for (const id of ['poz', 'freeze']) if (!harita.has(id)) harita.set(id, sistem.find((m) => m.id === id));
    const bul = (id) => harita.get(id);
    const ctx = { song, ayar, aralik, bul, rnd: seededRnd(seed || (Date.now() & 0x7fffffff)) };
    ctx.hareketler = [...harita.values()].filter((m) => uygunMu(m, ctx));
    if (!ctx.hareketler.some((m) => m.kind !== 'poz')) ctx.hareketler = [...harita.values()].filter((m) => m.id !== 'freeze');
    ctx.hareketSayisi = ctx.hareketler.filter((m) => m.kind !== 'poz').length;
    ctx.var8 = ctx.hareketler.some((m) => aile(m) === '8');
    ctx.var8_4 = ctx.hareketler.some((m) => aile(m) === '8' && m.length <= 4);
    const uz = (a) => ctx.hareketler.filter((m) => aile(m) === a).map((m) => m.length);
    ctx.min8 = Math.min(Infinity, ...uz('8'));
    ctx.min1 = Math.min(Infinity, ...uz('1'));
    // ilk hareket 8'de başlayacaksa girişin son sayımı müzikte olmalı
    const vs = 60 / (song.bpm || 120);
    ctx.giris8 = aralik[0] > 0 || (song.beats && song.originIdx >= 1) || (!song.beats && (song.firstOneSec || 0) >= vs * 0.9);
    ctx.vurgular = (song.accents || []).filter((a) => a >= aralik[0] && a < aralik[1]);
    ctx.vurguSet = new Set(ctx.vurgular.map((a) => Math.round(a * 2)));
    ctx.sonVurus = aralik[1];
    // enerjinin bir önceki sekizliğe göre yükseldiği ve düştüğü sekizlikler
    ctx.yukselis = new Set(); ctx.dusus = new Set();
    for (let b = Math.floor(aralik[0] / 8) + 1; b * 8 < aralik[1]; b++) {
      const fark = blokEnerji(song, b) - blokEnerji(song, b - 1);
      if (fark > 0) ctx.yukselis.add(b); else if (fark < 0) ctx.dusus.add(b);
    }
    return ctx;
  }

  // Ana üretim. sabitler: korunacak öğeler (kilitli ya da bölge dışı).
  // bolge: sadece bu aralıktaki boşluklar doldurulur (yoksa tüm aralık).
  function olustur({ song, moves, ayar, aralik, sabitler = [], bolge = null, seed, deneme = 30 }) {
    const ctx = baglam(song, moves, ayar, aralik, seed);
    const [a, b] = aralik;
    const sabit = sabitler.filter((x) => x.t < b - EPS && x.t + x.L > a + EPS).map((x) => Object.assign({}, x, { sabit: true }));
    // break'ler için Freeze (kilitli öğeyle çakışmıyorsa)
    if (!bolge) {
      for (const br of breakAraliklari(song, a, b)) {
        const cak = sabit.some((x) => x.t < br.t + br.L - EPS && x.t + x.L > br.t + EPS);
        if (!cak) sabit.push({ id: uid('i'), moveId: 'freeze', t: br.t, L: br.L, side: null, locked: false, sabit: true, otomatik: true });
      }
    }
    sabit.sort((x, y) => x.t - y.t);
    // boşluklar
    const bosluklar = [];
    let t = a;
    for (const x of sabit) {
      if (x.t > t + EPS) bosluklar.push([t, x.t]);
      t = Math.max(t, x.t + x.L);
    }
    if (t < b - EPS) bosluklar.push([t, b]);
    let st = yeniDurum();
    const sonuc = [];
    let si = 0;
    for (const [gs, ge] of bosluklar) {
      while (si < sabit.length && sabit[si].t < gs - EPS) { sonuc.push(sabit[si]); durumaUygula(st, sabit[si], ctx.bul(sabit[si].moveId)); si++; }
      const icinde = !bolge || (gs < bolge[1] - EPS && ge > bolge[0] + EPS);
      if (!icinde) continue;
      const r = boslukDoldur(gs, ge, st, sonuc.concat(), ctx, deneme, sabit.find((x) => yakin(x.t, ge)));
      sonuc.push(...r.yeni);
      st = r.st;
    }
    while (si < sabit.length) { sonuc.push(sabit[si]); si++; }
    sonuc.sort((x, y) => x.t - y.t);
    return sonuc.map((x) => ({ id: x.id || uid('i'), moveId: x.moveId, t: x.t, L: x.L, side: x.side || null, on: x.on || 0, bir: x.bir || 0, dolgu: !!x.dolgu, locked: !!x.locked, otomatik: !!x.otomatik }));
  }

  // Bir bölgeyi yeniden üret: bölgeye değen kilitsiz öğeler silinir, gerisi korunur
  function bolgeyiYenile({ song, moves, ayar, aralik, items, bolge, seed, deneme = 40 }) {
    let [ra, rb] = bolge;
    const dokunan = items.filter((x) => !x.locked && x.t < rb - EPS && x.t + x.L > ra + EPS);
    for (const x of dokunan) { ra = Math.min(ra, x.t); rb = Math.max(rb, x.t + x.L); }
    const kalan = items.filter((x) => !dokunan.includes(x));
    const imza = (arr) => arr.filter((x) => x.t >= ra - EPS && x.t < rb - EPS).map((x) => x.moveId + (x.side || '') + x.L).join('|');
    const eski = imza(items);
    let son = null;
    for (let i = 0; i < 6; i++) {
      son = olustur({ song, moves, ayar, aralik, sabitler: kalan, bolge: [ra, rb], seed: (seed || Date.now()) + i * 7919, deneme });
      if (imza(son) !== eski) break;
    }
    return son;
  }

  // ---------------- Sayımları düzelt (hareketler korunur) ----------------
  // Hareketler ve sıraları aynı kalır; sadece yerleri ve geçiş biçimleri (8'de hazırlık, 8'i bırakma)
  // kurallara göre ayarlanır. Gerekirse araya duruş girer. Kayma en az olacak çözüm seçilir (dinamik programlama).
  // hedef: sadece bu öğe ve iki yanındaki ikişer öğe ayarlanır.
  function sayimlariDuzelt({ song, moves, ayar, aralik, items, hedef }) {
    const ctx = baglam(song, moves, ayar, aralik, 1);
    const bul = ctx.bul;
    const sirali = [...items].filter((x) => !x.dolgu).sort((a, b) => a.t - b.t);
    let serbest = null;
    if (hedef) {
      const i = sirali.findIndex((x) => x.id === hedef);
      if (i >= 0) serbest = new Set(sirali.slice(Math.max(0, i - 2), i + 3).map((x) => x.id));
    }
    const sabitMi = (x) => x.locked || x.moveId === 'freeze' || !bul(x.moveId) || (serbest && !serbest.has(x.id));
    const sonuc = [];
    const yerlesmeyen = [];
    let i = 0, segBas = aralik[0], giris = 'serbest';
    for (;;) {
      const grup = [];
      while (i < sirali.length && !sabitMi(sirali[i])) grup.push(sirali[i++]);
      const capa = i < sirali.length ? sirali[i] : null;
      const segSon = capa ? Math.max(segBas, capa.t) : aralik[1];
      // ilk sabit öğe aralığın başından önce başlıyorsa (girişte 8) segment boş
      if (grup.length || segSon > segBas + EPS) {
        const r = parcaliZamanla(grup, segBas, segSon, giris, capa, ctx, aralik);
        sonuc.push(...r.items); yerlesmeyen.push(...r.yerlesmeyen);
      }
      if (!capa) break;
      sonuc.push(capa);
      giris = girisSonrasi(capa, bul(capa.moveId));
      segBas = capa.t + capa.L;
      i++;
    }
    // kalan boşluklar yeni hareketlerle doldurulur (hiçbir hareket silinmez)
    let cur = sonuc;
    const v = dogrula(cur, song, moves, aralik);
    for (const g of v.bosluklar) cur = olustur({ song, moves, ayar, aralik, sabitler: cur, bolge: [g.t, g.t + g.L], seed: Math.round(g.t) + 17, deneme: 30 });
    return { items: cur, yerlesmeyen };
  }

  // Grup bütün olarak sığmazsa ortadaki hareket yerinde bırakılıp iki yarısı ayrı ayrı düzeltilir;
  // sadece gerçekten sığmayan hareketler olduğu gibi kalır (yerlesmeyen).
  function parcaliZamanla(grup, A, B, giris, capa, ctx, aralik) {
    const r = yeniZamanla(grup, A, B, giris, capa, ctx, aralik);
    if (r) return { items: r, yerlesmeyen: [] };
    const hepsi = { items: grup.slice(), yerlesmeyen: grup.map((x) => x.id) };
    if (grup.length <= 1) return hepsi;
    // bölme noktası: sayımı kendi başına doğru olan bir hareket (duruş değil), ortaya en yakın olan
    const dogruYerde = (x) => {
      const m = ctx.bul(x.moveId), a = aile(m);
      if (!m || a === 'poz') return false;
      if (x.t < A - 1 - EPS || x.t + x.L > B + EPS || !sinirUygun(x.t, x.L)) return false;
      if (a === 'esnek') return true;
      return baslangicUygun(m, x.t + (x.on ? 1 : 0)) && yakin(x.L, beklenenSure(m, x));
    };
    const orta = Math.floor(grup.length / 2);
    const adaylar = grup.map((x, i) => i).filter((i) => dogruYerde(grup[i])).sort((p, q) => Math.abs(p - orta) - Math.abs(q - orta)).slice(0, 4);
    let enIyi = null;
    for (const i of adaylar) {
      const cp = grup[i];
      const sol = parcaliZamanla(grup.slice(0, i), A, Math.max(A, cp.t), giris, cp, ctx, aralik);
      const sag = parcaliZamanla(grup.slice(i + 1), cp.t + cp.L, B, girisSonrasi(cp, ctx.bul(cp.moveId)), capa, ctx, aralik);
      const r = { items: [...sol.items, cp, ...sag.items], yerlesmeyen: [...sol.yerlesmeyen, ...sag.yerlesmeyen] };
      if (!enIyi || r.yerlesmeyen.length < enIyi.yerlesmeyen.length) enIyi = r;
      if (!r.yerlesmeyen.length) break;
    }
    return enIyi || hepsi;
  }

  function yeniZamanla(grup, A, B, giris0, capa, ctx, aralik) {
    const bul = ctx.bul;
    const n = grup.length;
    const anahtar = (t, g, pz) => `${Math.round(t * 2)}|${g}|${pz}`;
    // katman[k]: k öğe yerleşmiş durumlar
    let katman = new Map();
    katman.set(anahtar(A, giris0, 0), { t: A, g: giris0, pz: 0, c: 0, onc: null, oge: null });
    const ekle = (harita, d) => { const k = anahtar(d.t, d.g, d.pz); const v = harita.get(k); if (!v || d.c < v.c) harita.set(k, d); };
    const capaSorunu = (g) => {
      if (!capa) return g === 'zorunlu8';
      const mc = bul(capa.moveId);
      return !!(mc && gecisSorunu(g, mc, capa.on, capa.bir));
    };
    let enIyiSon = null;
    let islem = 0; // güvenlik: aşırı büyürse vazgeç (öğeler olduğu gibi kalır)
    for (let k = 0; k <= n; k++) {
      // 1) duruş ya da boşluk ekleme (aynı k, ardışık iki ekleme yok)
      const ek = new Map();
      for (const d of katman.values()) {
        if (d.pz) continue;
        const hedefT = k < n ? grup[k].t : B;
        // boşluk: sonraki öğenin eski yerine ya da segment sonuna atla (sonra yeni hareketle doldurulur)
        const zincir = d.g === 'zincir8' || d.g === 'zorunlu8';
        // 8'li zincirden sonra kısa boşluk kuralı atlatmasın: en az bir sekizlik olmalı (yeni hareketle dolar)
        if (hedefT > d.t + EPS && hedefT <= B + EPS && !(zincir && hedefT - d.t < 8 - EPS)) ekle(ek, { t: hedefT, g: 'serbest', pz: 1, c: d.c + 2 + 0.05 * (hedefT - d.t), onc: d, oge: { bosluk: true } });
        // duruş: 1–7 vuruş, sekizlik içinde
        for (let P = 1; P <= 7; P++) {
          const t2 = d.t + P;
          if (t2 > B + EPS || !sinirUygun(d.t, P)) break;
          if (d.g === 'zincir8' || d.g === 'zorunlu8') {
            // 8'li zincirde duruş sadece break'e ya da sona kadar
            if (!yakin(t2, B) || (capa && capa.moveId !== 'freeze')) continue;
          }
          const it = { t: d.t, L: P, bir: 0 };
          ekle(ek, { t: t2, g: girisSonrasi(it, bul('poz')), pz: 1, c: d.c + 3 + 0.5 * P, onc: d, oge: { poz: true, t: d.t, L: P } });
        }
      }
      for (const d of ek.values()) ekle(katman, d);
      if (k === n) {
        for (const d of katman.values()) {
          if (!yakin(d.t, B)) continue;
          if (capaSorunu(d.g)) continue;
          if (!enIyiSon || d.c < enIyiSon.c) enIyiSon = d;
        }
        break;
      }
      // 2) k. öğeyi yerleştir
      const x = grup[k], m = bul(x.moveId), a = aile(m);
      const yeni = new Map();
      for (const d of katman.values()) {
        const secenek = [];
        const ilkGiris = k === 0 && yakin(d.t, aralik[0]) && ctx.giris8 && a === '8';
        const basla = ilkGiris ? [d.t, d.t - 1] : [d.t];
        for (const t of basla) {
          if (Math.abs(t - x.t) > 16) continue;
          if (a === 'poz') { for (let L = 1; L <= 8; L++) secenek.push({ t, L, on: 0, bir: 0 }); }
          else if (a === 'esnek') {
            const uz = m.lengthOptions && m.lengthOptions.length ? m.lengthOptions : [m.length];
            for (const L of uz) secenek.push({ t, L, on: 0, bir: 0 });
          } else {
            if (baslangicUygun(m, t)) {
              secenek.push({ t, L: m.length, on: 0, bir: 0 });
              if (a === '1' && m.sekizSerbest !== false) secenek.push({ t, L: m.length - 1, on: 0, bir: 1 });
            }
            if (a === '1' && baslangicUygun(m, t + 1)) secenek.push({ t, L: m.length + 1, on: 1, bir: 0 });
          }
        }
        // duruş (hareket değil) gerekirse kaldırılabilir
        if (a === 'poz') ekle(yeni, { t: d.t, g: d.g, pz: 0, c: d.c + 1.5, onc: d, oge: null });
        for (const s of secenek) {
          const g = d.t - s.t > EPS ? 'serbest' : d.g; // girişin 8'inden başlama
          if (s.t + s.L > B + EPS || !sinirUygun(s.t, s.L)) continue;
          if (a === 'poz') {
            // duruş 8'li zincirin arkasına sadece break'ten ya da sondan hemen önce girer
            if ((g === 'zincir8' || g === 'zorunlu8') && !(yakin(s.t + s.L, B) && (!capa || capa.moveId === 'freeze'))) continue;
          } else if (gecisSorunu(g, m, s.on, s.bir)) continue;
          const c = d.c + Math.abs(s.t - x.t) + (s.on !== (x.on || 0) || s.bir !== (x.bir || 0) ? 0.3 : 0) + (yakin(s.L, x.L) ? 0 : (a === 'poz' ? 0.3 * Math.abs(s.L - x.L) : 0.2));
          const it = { t: s.t, L: s.L, bir: s.bir };
          ekle(yeni, { t: s.t + s.L, g: girisSonrasi(it, m), pz: 0, c, onc: d, oge: Object.assign({}, x, { t: s.t, L: s.L, on: s.on, bir: s.bir, dolgu: false }) });
        }
      }
      katman = yeni;
      islem += katman.size;
      if (islem > 400000) return null;
      if (!katman.size) return null;
    }
    if (!enIyiSon) return null;
    const out = [];
    for (let d = enIyiSon; d; d = d.onc) {
      if (!d.oge || d.oge.bosluk) continue;
      if (d.oge.poz) out.push({ id: uid('i'), moveId: 'poz', t: d.oge.t, L: d.oge.L, side: null, on: 0, bir: 0, locked: false });
      else out.push(d.oge);
    }
    return out.reverse();
  }

  // Uyarıları düzelt: uyarılı (sabit olmayan) hareketlerin yeri kurallara göre yeniden kurulur.
  // Önce sadece o hareket, olmazsa sekizliği, sonra 32'lik cümlesi, en son tüm aralık yenilenir.
  // hedef: tek bir öğenin id'si (yoksa tüm uyarılar ve boşluklar).
  function uyarilariDuzelt({ song, moves, ayar, aralik, items, hedef, seed }) {
    let cur = items.map((x) => Object.assign({}, x));
    const durum = (arr) => {
      const v = dogrula(arr, song, moves, aralik);
      const uyarili = (x) => (v.uyarilar.get(x.id) || []).length > 0;
      return { kotu: arr.filter((x) => !x.locked && uyarili(x)), kilitli: arr.filter((x) => x.locked && uyarili(x)), bosluk: v.bosluklar };
    };
    const genislet = ([a, b], tur) => {
      if (tur === 0) return [a, b];
      const n = tur === 1 ? 8 : tur === 2 ? 32 : 0;
      if (!n) return [aralik[0], aralik[1]];
      return [Math.max(aralik[0], Math.floor(a / n + EPS) * n), Math.min(aralik[1], Math.ceil(b / n - EPS) * n)];
    };
    const kes = (x, r) => x.t < r[1] - EPS && x.t + x.L > r[0] + EPS;
    let d = durum(cur);
    const ilk = d.kotu.length + d.bosluk.length;
    const hedefOge = hedef ? cur.find((x) => x.id === hedef) : null;
    const hedefAralik = hedefOge ? [hedefOge.t, hedefOge.t + hedefOge.L] : null;
    for (let tur = 0; tur < 4; tur++) {
      let bolgeler;
      if (hedefAralik) {
        const r = genislet(hedefAralik, tur);
        if (tur > 0 && !d.kotu.some((x) => kes(x, r))) break;
        bolgeler = [r];
      } else {
        if (!d.kotu.length && !d.bosluk.length) break;
        bolgeler = d.kotu.map((x) => genislet([x.t, x.t + x.L], tur)).concat(d.bosluk.map((g) => genislet([g.t, g.t + g.L], tur)));
      }
      bolgeler.sort((x, y) => x[0] - y[0]);
      const birlesik = [];
      for (const r of bolgeler) { const l = birlesik[birlesik.length - 1]; if (l && r[0] <= l[1] + EPS) l[1] = Math.max(l[1], r[1]); else birlesik.push(r.slice()); }
      for (const r of birlesik) cur = bolgeyiYenile({ song, moves, ayar, aralik, items: cur, bolge: r, seed: (seed || Date.now()) + tur * 977 + Math.round(r[0]), deneme: 40 });
      d = durum(cur);
      if (hedefAralik && !d.kotu.some((x) => kes(x, genislet(hedefAralik, tur)))) break;
    }
    return { items: cur, once: ilk, kalan: d.kotu.length + d.bosluk.length, kilitli: d.kilitli.length };
  }

  // Belirli bir yere hareket koy: üst üste binen kilitsizleri çıkar, artanı doldur
  function yerlestir({ song, moves, ayar, aralik, items, t, moveId, L, side, on, bir, seed }) {
    const engel = items.find((x) => x.locked && x.t < t + L - EPS && x.t + x.L > t + EPS);
    if (engel) return { hata: 'Bu süre sabitlenmiş bir hareketin üstüne taşıyor. Önce onun sabitini kaldır.' };
    const cikan = items.filter((x) => x.t < t + L - EPS && x.t + x.L > t + EPS);
    let kalan = items.filter((x) => !cikan.includes(x));
    const yeni = { id: uid('i'), moveId, t, L, side: side || null, on: on ? 1 : 0, bir: bir ? 1 : 0, locked: false };
    // önceden başlayıp t'den sonra biten hareket olmaz (t bir başlangıçtır), ama güvenlik:
    kalan.push(yeni);
    // artan boşlukları otomatik doldur (sadece çıkanların bıraktığı yer)
    let bas = t + L, bit = t + L;
    for (const x of cikan) bit = Math.max(bit, x.t + x.L);
    let sonuc = kalan.sort((x, y) => x.t - y.t);
    if (bit > bas + EPS) {
      sonuc = olustur({ song, moves, ayar, aralik, sabitler: kalan, bolge: [bas, bit], seed, deneme: 30 });
    }
    return { items: sonuc };
  }

  // Elle düzenleme için t'de başlayabilecek seçenekler (kurala uymayanlar "sorun" ile işaretli)
  function elleSecenekler({ song, moves, ayar, aralik, items, t, haric }) {
    const ctx = baglam(song, moves, ayar, aralik, 1);
    const sirali = [...items].filter((x) => x.id !== haric).sort((a, b) => a.t - b.t);
    const st = yeniDurum();
    let onceki = null;
    for (const x of sirali) { if (x.t + x.L > t + EPS) break; durumaUygula(st, x, ctx.bul(x.moveId)); onceki = x; }
    if (!onceki || !yakin(onceki.t + onceki.L, t)) st.giris = 'serbest';
    const sonraki = sirali.find((x) => x.t >= t - EPS);
    const kalan = aralik[1] - t;
    const out = [];
    for (const m of [...new Map(moves.map((x) => [x.id, x])).values()]) {
      if (m.id === 'freeze') continue;
      for (const o of hareketSecenekleri(m, t, kalan, st, ctx, true)) {
        let sorun = o.sorun;
        // arkadaki harekete bağlanıyor mu
        if (!sorun && sonraki && yakin(t + o.L, sonraki.t)) {
          const mn = ctx.bul(sonraki.moveId);
          const g = mn && gecisSorunu(girisSonrasi({ t, L: o.L, bir: o.bir }, m), mn, sonraki.on, sonraki.bir);
          if (g) sorun = 'Arkadaki hareketle geçiş uymuyor.';
        }
        out.push({ moveId: m.id, ad: m.name, mirror: m.mirror, travel: m.travel, L: o.L, side: o.side, on: o.on, bir: o.bir, sorun, seviyeUstu: m.level > ayar.seviye, kapali: m.kullan === false && m.kind !== 'poz' });
      }
    }
    return out;
  }

  function boslukOlustur(items, aralik) {
    const s = [...items].sort((x, y) => x.t - y.t);
    const out = [];
    let t = aralik[0];
    for (const x of s) {
      if (x.t > t + EPS) out.push({ t, L: x.t - t });
      t = Math.max(t, x.t + x.L);
    }
    if (t < aralik[1] - EPS) out.push({ t, L: aralik[1] - t });
    return out;
  }

  // ---------------- Doğrulama ----------------
  const ayakAdi = (w) => (w === 'L' ? 'sol' : w === 'R' ? 'sağ' : '?');
  function sayi(v) { return String(Math.round(v * 2) / 2).replace('.', ','); }
  function dogrula(items, song, moves, aralik) {
    const harita = new Map(moves.map((m) => [m.id, m]));
    const sistem = varsayilanHareketler();
    for (const id of ['poz', 'freeze']) if (!harita.has(id)) harita.set(id, sistem.find((m) => m.id === id));
    const uyarilar = new Map();
    const s = [...items].sort((x, y) => x.t - y.t);
    let onceki = null, agirlik = 'any', giris = 'serbest';
    for (let i = 0; i < s.length; i++) {
      const it = s[i];
      const u = [];
      const m = harita.get(it.moveId);
      const bitisik = onceki && yakin(onceki.t + onceki.L, it.t);
      if (!bitisik) giris = 'serbest';
      if (!m) u.push('Bu hareket kütüphanede yok (silinmiş).');
      else {
        const a = aile(m);
        if (a === '1' || a === '8' || a === 'ara') {
          const govde = it.t + (it.on ? 1 : 0);
          if (!baslangicUygun(m, govde)) u.push(`${m.name} için başlangıç sayımı ${baslangicEtiketi(m.start)}, burada ${sayim(govde).etiket}.`);
          if (!yakin(it.L, beklenenSure(m, it))) u.push(`Süre ${sayi(it.L)} sayım; ${m.name} ${sayi(m.length)} sayımlık${it.on ? ' (+8\'de hazırlık)' : ''}${it.bir ? ' (−bırakılan 8)' : ''}.`);
          if (it.on && a !== '1') u.push('Sadece 1\'de başlayan hareketler 8\'de hazırlıkla girer.');
          if (it.bir && a !== '1') u.push('Sadece 1\'de başlayan hareketler 8\'ini bırakabilir.');
          if (it.bir && m.sekizSerbest === false) u.push(`${m.name} 8'ini bırakamaz (kütüphanede kapalı).`);
        } else if (a === 'esnek') {
          const ops = m.lengthOptions && m.lengthOptions.length ? m.lengthOptions : [m.length];
          if (!ops.some((L) => yakin(L, it.L))) u.push(`Süre seçeneklerinde yok (${ops.map(sayi).join(', ')} sayım).`);
        }
        if (!sinirUygun(it.t, it.L)) u.push('Sekizliği ya da 32\'lik cümleyi ortadan bölüyor.');
        let gs = gecisSorunu(giris, m, it.on, it.bir);
        // duruş, break'ten ya da sondan hemen önce 8'li zincirin arkasına girebilir
        if (gs && m.kind === 'poz') { const sn = s[i + 1]; if ((sn && sn.moveId === 'freeze' && yakin(it.t + it.L, sn.t)) || yakin(it.t + it.L, aralik[1])) gs = null; }
        if (gs) u.push(gs);
        if (it.dolgu) u.push('Bu duruş sayımı tamamlamak için kondu: buraya kurala uyan hareket bulunamadı. Değiştir ya da çevresini yeniden oluştur.');
        const ws = ayna(m.weightStart, it.side);
        if (bitisik && agirlik !== 'any' && ws !== 'any' && ws !== agirlik) u.push(`Ağırlık uymuyor: önceki hareket ağırlığı ${ayakAdi(agirlik)} ayakta bitiriyor, bu hareket ${ayakAdi(ws)} ayakta başlıyor.`);
        if (song.bpm && m.kind !== 'poz' && (song.bpm < m.bpmMin || song.bpm > m.bpmMax)) u.push(`Tempo (${sayi(song.bpm)} BPM) bu hareketin rahat aralığının (${m.bpmMin}–${m.bpmMax}) dışında.`);
      }
      if (onceki) {
        const fark = it.t - (onceki.t + onceki.L);
        if (fark < -EPS) u.push(`Önceki hareketle ${sayi(-fark)} vuruş çakışıyor.`);
      }
      const girisHazirligi = i === 0 && yakin(it.t, aralik[0] - 1) && m && aile(m) === '8';
      if ((it.t < aralik[0] - EPS && !girisHazirligi) || it.t + it.L > aralik[1] + EPS) u.push('Koreografi aralığının dışına taşıyor.');
      // son hareket 8'ini bıraktıysa arkasında 8'de başlayan hareket olmalı
      if (it.bir && i === s.length - 1) u.push('8\'ini bıraktı ama arkasında 8\'de başlayan hareket yok.');
      uyarilar.set(it.id, u);
      agirlik = m ? ayna(m.weightEnd, it.side) : 'any';
      giris = girisSonrasi(it, m);
      onceki = it;
    }
    return { uyarilar, bosluklar: boslukOlustur(items, aralik) };
  }

  // ---------------- Görüntüleme yardımcıları ----------------
  // Bir öğenin belirli bir sekizlik içindeki parçası. 8'de hazırlıkla başlayan hareket,
  // gövdesinin olduğu sekizlikte "8 → 1–7" diye gösterilir.
  function blokParcasi(it, blok) {
    const hz = hazirlik(it.t, it.L);
    const cek = it.t + hz;
    const sahip = Math.floor(cek / 8 + EPS);
    if (blok < sahip) return null;
    const bs = blok * 8, be = bs + 8;
    const a = Math.max(cek, bs), b = Math.min(it.t + it.L, be);
    if (b <= a + EPS) return null;
    const L = b - a;
    const ilk = sayim(a).etiket, son = sayim(sonVurus(a, L)).etiket;
    let metin = ilk === son ? ilk : `${ilk}–${son}`;
    const baslangic = blok === sahip;
    if (baslangic && hz) metin = `${sayim(it.t).etiket} → ${metin}`;
    return { metin, baslangic, a: baslangic ? it.t : a, L };
  }

  function metinCikar(choreo, song, moves) {
    const harita = new Map(moves.map((m) => [m.id, m]));
    const sistem = varsayilanHareketler();
    for (const id of ['poz', 'freeze']) if (!harita.has(id)) harita.set(id, sistem.find((m) => m.id === id));
    const satir = [];
    satir.push(`Müzik: ${song.title}${song.artist ? ' – ' + song.artist : ''}${song.year ? ' (' + song.year + ')' : ''}`);
    satir.push(`BPM: ${song.bpm ? sayi(song.bpm) : 'bilinmiyor'}`);
    satir.push(`Koreografi: ${choreo.name}`);
    const [a, b] = choreo.range;
    const items = [...choreo.items].sort((x, y) => x.t - y.t);
    for (let blok = Math.floor(a / 8); blok * 8 < b - EPS; blok++) {
      if (blok % 4 === 0 || blok === Math.floor(a / 8)) {
        const lab = bolumEtiketi(song, blok * 8);
        satir.push('');
        satir.push(`${Math.floor(blok / 4) + 1}. cümle${lab ? ' (' + lab + ')' : ''}`);
      }
      satir.push(`  ${blok + 1}. sekizlik`);
      for (const it of items) {
        const p = blokParcasi(it, blok);
        if (!p) continue;
        const m = harita.get(it.moveId);
        const ad = m ? m.name : '(silinmiş hareket)';
        const yon = it.side && m && m.mirror ? (m.travel === 'yana' ? (it.side === 'L' ? ' (sola)' : ' (sağa)') : (it.side === 'L' ? ' (sol)' : ' (sağ)')) : '';
        const not = p.baslangic ? (it.on ? ' (8\x27de hazırlıkla girer)' : '') + (it.bir ? ' (8\x27ini sonrakine bırakır)' : '') + (aile(m) === '8' ? ' (8\x27de başlar)' : '') : '';
        satir.push(`    ${p.metin}: ${p.baslangic ? '' : '(devam) '}${ad}${yon}${not}`);
      }
    }
    return satir.join('\n');
  }

  // ======================================================================
  // Sesten analiz: tempo, vuruşlar, ilk "1", enerji, break, vurgu, bölüm
  // ======================================================================
  function fftHazirla(N) {
    const lev = Math.log2(N);
    const rev = new Uint32Array(N);
    for (let i = 0; i < N; i++) { let r = 0, x = i; for (let j = 0; j < lev; j++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
    const c = new Float64Array(N / 2), s = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) { c[i] = Math.cos(2 * Math.PI * i / N); s[i] = -Math.sin(2 * Math.PI * i / N); }
    return { N, rev, c, s };
  }
  function fft(re, im, P) {
    const { N, rev, c, s } = P;
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j, b = a + half;
          const tr = re[b] * c[k] - im[b] * s[k];
          const ti = re[b] * s[k] + im[b] * c[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }
  function medyan(arr) { const a = Array.from(arr).sort((x, y) => x - y); if (!a.length) return 0; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function ortalama(a) { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : 0; }
  function stdSapma(a) { const m = ortalama(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return a.length ? Math.sqrt(s / a.length) : 0; }
  function kosinusUzaklik(x, y) { let d = 0, nx = 0, ny = 0; for (let i = 0; i < x.length; i++) { d += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; } return nx && ny ? 1 - d / Math.sqrt(nx * ny) : 0; }

  // x: mono örnekler, sr: örnekleme hızı. Sonuçlar saniye ve vuruş cinsinden.
  async function analizEt(x, sr, ilerleme) {
    const not = (v) => { if (ilerleme) ilerleme(v); };
    const f = Math.max(1, Math.round(sr / 11025));
    const sr2 = sr / f;
    const n = Math.floor(x.length / f);
    const y = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[j++]; y[i] = s / f; }
    const N = 512, hop = 128, hopSn = hop / sr2;
    const kare = Math.max(0, Math.floor((n - N) / hop) + 1);
    if (kare * hopSn < 20) throw new Error('Ses en az 20 saniye olmalı.');
    const P = fftHazirla(N);
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const bantHz = [0, 100, 200, 400, 800, 1600, 3200, 5500];
    const bk = bantHz.map((hz) => Math.min(N / 2, Math.round(hz * N / sr2)));
    const B = bk.length - 1;
    const aki = new Float32Array(kare), rms = new Float32Array(kare), bant = new Float32Array(kare * B);
    // kroma: 200 Hz – 2 kHz arası frekanslar perde sınıfına (12) toplanır; bölüm (A/B) ayrımı için
    const kromaK = [];
    for (let k = Math.ceil(200 * N / sr2); k <= Math.min(N / 2, Math.floor(2000 * N / sr2)); k++) {
      kromaK.push([k, mod(Math.round(12 * Math.log2((k * sr2 / N) / 261.63)), 12)]);
    }
    const kroma = new Float32Array(kare * 12);
    let onc = new Float64Array(N / 2 + 1), sim = new Float64Array(N / 2 + 1);
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let t = 0; t < kare; t++) {
      const o = t * hop;
      let e = 0;
      for (let i = 0; i < N; i++) { const v = y[o + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
      rms[t] = Math.sqrt(e / N);
      fft(re, im, P);
      for (let k = 0; k <= N / 2; k++) sim[k] = Math.log(1 + 100 * Math.hypot(re[k], im[k]));
      let a = 0;
      if (t) for (let k = 1; k <= N / 2; k++) { const d = sim[k] - onc[k]; if (d > 0) a += d; }
      aki[t] = a;
      for (let b = 0; b < B; b++) { let s = 0; for (let k = bk[b]; k < bk[b + 1]; k++) s += sim[k]; bant[t * B + b] = s / Math.max(1, bk[b + 1] - bk[b]); }
      for (const [k, pc] of kromaK) kroma[t * 12 + pc] += sim[k];
      const g = onc; onc = sim; sim = g;
      if (t % 3000 === 0) { not(0.05 + 0.45 * t / kare); await bekle(); }
    }
    // başlangıç zarfı: yerel ortalamayı çıkar, yarım dalga, standart sapmaya böl
    const W = Math.max(1, Math.round(0.4 / hopSn));
    const pre = new Float64Array(kare + 1);
    for (let t = 0; t < kare; t++) pre[t + 1] = pre[t] + aki[t];
    const env = new Float32Array(kare);
    for (let t = 0; t < kare; t++) {
      const a = Math.max(0, t - W), b = Math.min(kare, t + W + 1);
      env[t] = Math.max(0, aki[t] - (pre[b] - pre[a]) / (b - a));
    }
    const sd = stdSapma(env) || 1;
    for (let t = 0; t < kare; t++) env[t] /= sd;
    not(0.55); await bekle();

    // tempo: özilinti
    const maxLag = Math.ceil(2 * 60 / 50 / hopSn) + 2;
    const acf = new Float64Array(maxLag + 1);
    for (let l = 1; l <= maxLag; l++) { let s = 0; for (let t = l; t < kare; t++) s += env[t] * env[t - l]; acf[l] = s / (kare - l); }
    const acfAt = (l) => { const i = Math.floor(l), fr = l - i; if (i < 1 || i + 1 > maxLag) return 0; return acf[i] * (1 - fr) + acf[i + 1] * fr; };
    const grid = [];
    for (let bpm = 60; bpm <= 320; bpm += 0.5) {
      const lag = 60 / (bpm * hopSn);
      const s = acfAt(lag) + 0.5 * acfAt(2 * lag) + 0.25 * acfAt(lag / 2);
      // swing dansı çoğunlukla 120–240 BPM'de sayılır: tercih 165 civarı
      const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 165) / 0.9, 2));
      grid.push({ bpm, ham: s, skor: s * w });
    }
    const tepeler = [];
    for (let i = 1; i < grid.length - 1; i++) if (grid[i].skor >= grid[i - 1].skor && grid[i].skor >= grid[i + 1].skor) tepeler.push(grid[i]);
    tepeler.sort((a, b) => b.skor - a.skor);
    const adaylar = [];
    for (const tp of tepeler) {
      if (adaylar.some((a) => Math.abs(a.bpm / tp.bpm - 1) < 0.05)) continue;
      adaylar.push(tp);
      if (adaylar.length >= 4) break;
    }
    if (!adaylar.length) throw new Error('Tempo bulunamadı.');
    const enUst = adaylar[0].skor || 1;
    // yarım/çift tempo: ikisi de güçlüyse dans sayımına (120–250) düşeni öne al
    {
      const a0 = adaylar[0];
      const es = adaylar.find((a) => a !== a0 && a.skor >= 0.6 * a0.skor && (Math.abs(a.bpm / a0.bpm - 2) < 0.05 || Math.abs(a.bpm / a0.bpm - 0.5) < 0.0125));
      const aralikta = (v) => v >= 120 && v <= 250;
      if (es && !aralikta(a0.bpm) && aralikta(es.bpm)) { adaylar.splice(adaylar.indexOf(es), 1); adaylar.unshift(es); }
    }
    not(0.65); await bekle();

    // vuruş izleme (dinamik programlama, Ellis 2007)
    const p = 60 / (adaylar[0].bpm * hopSn);
    const lo = Math.max(1, Math.round(p / 2)), hi = Math.round(2 * p);
    const skor = new Float64Array(kare), geri = new Int32Array(kare).fill(-1);
    const alfa = 100;
    const ceza = new Float64Array(hi + 1);
    for (let d = lo; d <= hi; d++) ceza[d] = alfa * Math.pow(Math.log(d / p), 2);
    for (let t = 0; t < kare; t++) {
      let best = -Infinity, bi = -1;
      for (let d = lo; d <= hi; d++) { const u = t - d; if (u < 0) break; const v = skor[u] - ceza[d]; if (v > best) { best = v; bi = u; } }
      if (bi >= 0 && best > 0) { skor[t] = env[t] + best; geri[t] = bi; } else skor[t] = env[t];
    }
    let son = kare - 1, sm = -Infinity;
    for (let t = Math.max(0, kare - hi); t < kare; t++) if (skor[t] > sm) { sm = skor[t]; son = t; }
    const vf = [];
    for (let t = son; t >= 0; t = geri[t]) vf.push(t);
    vf.reverse();
    // sessiz baş ve sonu at
    const rmsMax = Math.max(...Array.from(rms).filter((_, i) => i % 4 === 0));
    const sesli = (fr) => { let m = 0; for (let k = Math.max(0, fr - 4); k < Math.min(kare, fr + 8); k++) m = Math.max(m, rms[k]); return m > rmsMax * 0.03; };
    while (vf.length && !sesli(vf[0])) vf.shift();
    while (vf.length && !sesli(vf[vf.length - 1])) vf.pop();
    if (vf.length < 32) throw new Error('Yeterli vuruş bulunamadı.');
    const zaman = (fr) => (fr * hop + N / 2) / sr2;
    const beats = vf.map(zaman);
    const ibi = []; for (let i = 1; i < beats.length; i++) ibi.push(beats[i] - beats[i - 1]);
    // kare çözünürlüğü yüzünden medyan yuvarlanır: medyana yakın aralıkların ortalaması alınır
    const kirpOrt = (a) => { const md = medyan(a); const iyi = a.filter((v) => Math.abs(v - md) < md * 0.2); return ortalama(iyi.length ? iyi : a); };
    const bpm = 60 / kirpOrt(ibi);
    const bolum = Math.min(ibi.length, Math.max(8, Math.round(30 / (60 / bpm))));
    const bpmBas = 60 / kirpOrt(ibi.slice(0, bolum)), bpmSon = 60 / kirpOrt(ibi.slice(-bolum));
    not(0.75); await bekle();

    // vuruş başına özellikler
    const nb = beats.length;
    const vDb = new Float64Array(nb), vOn = new Float64Array(nb);
    const ozel = [];
    for (let i = 0; i < nb; i++) {
      const a = vf[i], b = i + 1 < nb ? vf[i + 1] : Math.min(kare, vf[i] + Math.round(p));
      let e = 0, c = 0; const v = new Float64Array(B + 12);
      for (let t = a; t < Math.max(a + 1, b); t++) {
        e += rms[t] * rms[t]; c++;
        for (let k = 0; k < B; k++) v[k] += bant[t * B + k];
        for (let k = 0; k < 12; k++) v[B + k] += kroma[t * 12 + k];
      }
      vDb[i] = 10 * Math.log10(e / Math.max(1, c) + 1e-10);
      for (let k = 0; k < B; k++) v[k] /= Math.max(1, c);
      let ks = 0; for (let k = 0; k < 12; k++) ks += v[B + k];
      for (let k = 0; k < 12; k++) v[B + k] = ks ? v[B + k] / ks : 0;
      ozel.push(v);
      let mo = 0; for (let t = Math.max(0, a - 2); t <= Math.min(kare - 1, a + 2); t++) mo = Math.max(mo, env[t]);
      vOn[i] = mo;
    }
    // özellikleri boyut boyut standartlaştır
    const D = B + 12;
    for (let k = 0; k < D; k++) {
      const col = ozel.map((v) => v[k]); const m = ortalama(col), s = stdSapma(col) || 1;
      for (const v of ozel) v[k] = (v[k] - m) / s;
    }
    const pencereOrt = (a, b) => { const v = new Float64Array(D); for (let i = a; i < b; i++) for (let k = 0; k < D; k++) v[k] += ozel[i][k]; for (let k = 0; k < D; k++) v[k] /= Math.max(1, b - a); return v; };
    // break gibi ani düşüşler cümle evresini şaşırtmasın: çevresinde düşüş olan noktalar sayılmaz
    const dbMed = medyan(vDb);
    const cukur = new Uint8Array(nb + 1);
    for (let i = 0; i < nb; i++) if (vDb[i] < dbMed - 8) cukur[i] = 1;
    const cukurPre = new Int32Array(nb + 1);
    for (let i = 0; i < nb; i++) cukurPre[i + 1] = cukurPre[i] + cukur[i];
    const temiz = (a, b) => cukurPre[Math.min(nb, b)] - cukurPre[Math.max(0, a)] === 0;
    // iki pencerenin ortalamaları arasındaki uzaklık: karışık pencerede doğrusal azalır, sınırda tepe yapar
    const oklid = (x, y) => { let s = 0; for (let k = 0; k < x.length; k++) s += (x[k] - y[k]) * (x[k] - y[k]); return Math.sqrt(s); };
    const yenilik = (i, w) => (i - w < 0 || i + w > nb) ? null : oklid(pencereOrt(i - w, i), pencereOrt(i, i + w));
    // Evre: yenilik tepelerinin oylaması. Düz bölgelerin gürültüsü sayılmaz, sadece belirgin değişimler oy verir.
    const yenilikTepeleri = (w) => {
      const dizi = Array.from({ length: nb }, (_, i) => (temiz(i - w, i + w) ? yenilik(i, w) : null));
      const degerler = dizi.filter((v) => v != null);
      if (degerler.length < 8) return [];
      const md = medyan(degerler), sd = stdSapma(degerler);
      const esik = md + 1.5 * sd;
      const out = [];
      for (let i = 0; i < nb; i++) {
        const v = dizi[i];
        if (v == null || v < esik) continue;
        let enUstte = true;
        for (let j = Math.max(0, i - 4); j <= Math.min(nb - 1, i + 4); j++) if (j !== i && dizi[j] != null && (dizi[j] > v || (dizi[j] === v && j < i))) { enUstte = false; break; }
        if (enUstte) out.push([i, v - md]);
      }
      return out;
    };
    const t8 = yenilikTepeleri(8), t16 = yenilikTepeleri(16);
    const evre8 = new Float64Array(8);
    for (const [i, v] of t8) evre8[i % 8] += v;
    let f8 = 0; for (let k = 1; k < 8; k++) if (evre8[k] > evre8[f8]) f8 = k;
    const top8 = evre8.reduce((a, b) => a + b, 0);
    const pay8 = top8 ? evre8[f8] / top8 : 0;
    // 32'lik evre: 8'lik evreyle uyumlu dört aday arasından
    const evre32 = new Float64Array(4);
    for (const [i, v] of t16) { const d = mod(i - f8, 32); if (d % 8 === 0) evre32[d / 8] += v; }
    let j32 = 0; for (let j = 1; j < 4; j++) if (evre32[j] > evre32[j32]) j32 = j;
    const f32 = f8 + 8 * j32;
    // müziğin başladığı vuruş
    const dbMax = Math.max(...vDb);
    let basla = 0; while (basla < nb - 1 && vDb[basla] < dbMax - 30) basla++;
    // ilk 1 = müzik başladıktan sonraki ilk cümle başı (giriş kısmı beklenir; kullanıcı kaydırabilir)
    let origin = top8 ? basla + mod(f32 - basla, 32) : basla;
    if (origin >= nb - 8) origin = basla + mod(f8 - basla, 8);
    const guven = !top8 ? 'düşük' : pay8 > 0.6 ? 'yüksek' : pay8 > 0.4 ? 'orta' : 'düşük';
    not(0.85); await bekle();

    const tur = turet({ beats, vDb: Array.from(vDb), vOn: Array.from(vOn), ozel, origin });
    not(1);
    return {
      bpm: Math.round(bpm * 10) / 10,
      bpmBas: Math.round(bpmBas * 10) / 10,
      bpmSon: Math.round(bpmSon * 10) / 10,
      adaylar: adaylar.map((a) => ({ bpm: a.bpm, guc: Math.round(100 * a.skor / enUst) })),
      beats: beats.map((b) => Math.round(b * 1000) / 1000),
      originIdx: origin,
      guven,
      sureSn: x.length / sr,
      vDb: Array.from(vDb).map((v) => Math.round(v * 10) / 10),
      vOn: Array.from(vOn).map((v) => Math.round(v * 100) / 100),
      ozel: ozel.map((v) => Array.from(v).map((z) => Math.round(z * 100) / 100)),
      ...tur,
    };
  }

  // Vuruş başına ölçümlerden harita önerisi (ilk 1 değişince yeniden çağrılır)
  function turet({ beats, vDb, vOn, ozel, origin, hassasiyet }) {
    const nb = beats.length;
    const top = Math.max(0, nb - 1 - origin);
    const B = ozel.length ? ozel[0].length : 0;
    // enerji: sekizlik başına ses düzeyi + başlangıç yoğunluğu, üçe bölünür
    const bloklar = Math.ceil(top / 8);
    const deger = [];
    const zDb = (() => { const m = ortalama(vDb), s = stdSapma(vDb) || 1; return vDb.map((v) => (v - m) / s); })();
    const zOn = (() => { const m = ortalama(vOn), s = stdSapma(vOn) || 1; return vOn.map((v) => (v - m) / s); })();
    for (let k = 0; k < bloklar; k++) {
      const a = origin + 8 * k, b = Math.min(nb, a + 8);
      const d = [], o = [];
      for (let i = a; i < b; i++) { d.push(zDb[i]); o.push(zOn[i]); }
      deger.push(ortalama(d) + 0.5 * ortalama(o));
    }
    const sirali = [...deger].sort((x, y) => x - y);
    const q1 = sirali[Math.floor(sirali.length * 0.3)] ?? 0, q2 = sirali[Math.floor(sirali.length * 0.7)] ?? 0;
    const yayilim = stdSapma(deger);
    const energy = deger.map((v) => (yayilim < 0.2 ? 2 : v <= q1 ? 1 : v >= q2 ? 3 : 2));
    // break: çevresine göre 10 dB'den fazla düşen vuruşlar (en çok 8 vuruş art arda)
    const breaks = [];
    for (let r = 0; r < top - 4; r++) {
      const i = origin + r;
      const kom = [];
      for (let j = Math.max(origin, i - 16); j < Math.min(nb, i + 17); j++) kom.push(vDb[j]);
      if (vDb[i] < medyan(kom) - 10) breaks.push(r);
    }
    const temizBreak = [];
    for (let i = 0; i < breaks.length;) {
      let j = i; while (j + 1 < breaks.length && breaks[j + 1] === breaks[j] + 1) j++;
      if (j - i + 1 <= 8) for (let k = i; k <= j; k++) temizBreak.push(breaks[k]);
      i = j + 1;
    }
    const breakSet = new Set(temizBreak);
    // vurgular: vuruş, hemen yanındaki vuruşlardan belirgin şekilde güçlüyse darbedir (riff'te her 4 vuruşta
    // bir gelen darbeler de yakalansın diye 32 vuruşluk ortalamaya değil komşulara bakılır).
    // Ölçü: başlangıç gücü ve ses düzeyinin komşulara göre farkı, şarkı genelinde standartlaştırılmış.
    // vuruşun, hem hemen yanındaki iki vuruştan hem de ±2 vuruşun ortalamasından ne kadar güçlü olduğu
    const komsuFark = (dizi, i) => {
      const yakinlar = [i - 1, i + 1].filter((j) => j >= origin && j < nb).map((j) => dizi[j]);
      const dortlu = [i - 2, i - 1, i + 1, i + 2].filter((j) => j >= origin && j < nb).map((j) => dizi[j]);
      if (!yakinlar.length) return 0;
      return dizi[i] - Math.max(Math.max(...yakinlar), ortalama(dortlu));
    };
    const fOn = [], fDb = [];
    for (let r = 0; r < top; r++) { fOn.push(komsuFark(vOn, origin + r)); fDb.push(komsuFark(vDb, origin + r)); }
    const gz = (a) => { const md = medyan(a); const mad = medyan(a.map((v) => Math.abs(v - md))) * 1.4826 || 1; return a.map((v) => (v - md) / mad); };
    const zKomsuOn = gz(fOn), zKomsuDb = gz(fDb);
    const VS = { az: { esik: 2.6, en: 2 }, orta: { esik: 1.8, en: 4 }, cok: { esik: 1.2, en: 8 } }[hassasiyet || 'orta'] || { esik: 1.8, en: 4 };
    const accents = [];
    for (let c = 0; c * 32 < top; c++) {
      const ad = [];
      for (let r = c * 32; r < Math.min(top, c * 32 + 32); r++) {
        if (breakSet.has(r)) continue;
        const z = zKomsuOn[r] + 0.5 * zKomsuDb[r];
        if (z > VS.esik) ad.push({ r, z });
      }
      ad.sort((a, b) => b.z - a.z);
      for (const x of ad.slice(0, VS.en)) accents.push(x.r);
    }
    for (const r of temizBreak) if (!breakSet.has(r + 1) && r + 1 < top) accents.push(r + 1);
    // bölümler: 32'lik cümlelerin ortalama tınısı benzerliğine göre harf
    const sections = [];
    const temsil = [];
    const harfler = 'ABCDEF';
    let onceki = null;
    for (let c = 0; c * 32 < top; c++) {
      const a = origin + c * 32, b = Math.min(nb, a + 32);
      if (b - a < 8) break;
      // break vuruşları ve hemen sonrası tınıyı bozmasın diye sayılmaz
      const v = new Float64Array(B + 1);
      let n = 0;
      for (let i = a; i < b; i++) {
        const r = i - origin;
        if (breakSet.has(r) || breakSet.has(r - 1)) continue;
        for (let k = 0; k < B; k++) v[k] += ozel[i][k]; v[B] += zDb[i]; n++;
      }
      for (let k = 0; k <= B; k++) v[k] /= Math.max(1, n);
      let lab = null, enY = -1;
      temsil.forEach((tm, idx) => { const sim = 1 - kosinusUzaklik(tm, v); if (sim > enY) { enY = sim; lab = idx; } });
      if (lab === null || enY < 0.6) { if (temsil.length < harfler.length) { temsil.push(v); lab = temsil.length - 1; } }
      const harf = harfler[lab];
      if (harf !== onceki) sections.push({ beat: c * 32, label: harf });
      onceki = harf;
    }
    return { energy, breaks: [...new Set(temizBreak)].sort((a, b) => a - b), accents: [...new Set(accents)].sort((a, b) => a - b), sections };
  }

  return {
    EPS, mod, yakin, uid, varsayilanHareketler, KARAKTERLER, YONLER, VURGU_ETIKETLERI,
    sayim, baslangicEtiketi, sonVurus, baslangicUygun, sinirUygun, hazirlik, ayna, hizaPeriyodu,
    toplamVurus, bolumEtiketi, blokEnerji, breakAraliklari, aralikHesapla,
    olustur, bolgeyiYenile, yerlestir, boslukOlustur, dogrula, blokParcasi, metinCikar, elleSecenekler, vurguOfsetleri, vurguDenkligi, VARSAYILAN_VURGU, uyarilariDuzelt, sayimlariDuzelt, aile, beklenenSure, gecisSorunu,
    hareketSecenekleri, baglam, yeniDurum, durumaUygula,
    analizEt, turet, sayi,
  };
})();
