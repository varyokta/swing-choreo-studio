# Swing Choreo Studio

Kişisel Solo Jazz koreografi asistanı. Şarkının temposunu ve yapısını sesten çıkarır, hareketlerin başlangıç sayımlarına (1'de / 8'de) uyan koreografiler kurar, düzenletir ve prova sayacı sunar.

Veriler sadece kullanılan cihazın tarayıcısında saklanır; sunucu yoktur. Cihazlar arasında aktarmak için uygulamadaki **Yedek** bölümü kullanılır.

## Klasörler

| Klasör | İçerik |
|---|---|
| `kaynak/` | Asıl kod: `engine.js` (sayım kuralları, koreografi üretimi, ses analizi), `app.js` (ekranlar), `style.css`, `head.html`, `sw.js` (çevrimdışı), `manifest.webmanifest`, `simge-ciz.ps1` (simgeyi çizer) |
| `docs/` | Yayınlanan uygulama. GitHub Pages bu klasörü yayınlar. **Elle düzenlenmez**, `derle.sh` üretir. |
| `claude-sayfasi/` | claude.ai sayfası için sürüm (depoya girmez). |

## Değişiklik yapınca

```sh
sh derle.sh
```

Bu komut `docs/index.html`'i yeniden kurar ve çevrimdışı önbelleğin sürümünü değiştirir; telefon bir sonraki açılışta yeni sürümü alır.

## İlk yayın (GitHub Pages)

1. GitHub Desktop → **File → Add local repository…** → bu klasörü seç. "Bu bir Git deposu değil" derse **create a repository** de.
2. Değişiklikleri commit et, sonra **Publish repository**.
   - Ücretsiz GitHub hesabında Pages sadece **herkese açık** depolarda çalışır: "Keep this code private" işaretini kaldır. Kodda kişisel veri yok; şarkıların ve koreografilerin depoya girmez, telefonda kalır.
3. GitHub'da deponun sayfası → **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main**, klasör: **/docs** → Save.
4. Bir iki dakika sonra adres görünür: `https://KULLANICI-ADIN.github.io/swing-choreo-studio/`

## iPhone'a kurma

1. Adresi **Safari**'de aç.
2. Paylaş düğmesi → **Ana Ekrana Ekle** → Ekle.
3. Ana ekrandaki "Choreo Studio" simgesinden aç: tam ekran açılır, internetsiz de çalışır.

claude.ai sürümündeki verileri taşımak için: claude.ai'deki sayfada **Ayarlar → Yedeği indir**, telefondaki uygulamada **Ayarlar → Geri yükle**.
