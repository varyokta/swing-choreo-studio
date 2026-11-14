#!/bin/sh
# Swing Choreo Studio'yu kaynak/ klasöründeki parçalardan kurar.
#   docs/index.html                  -> kendi adresindeki uygulama (GitHub Pages bu klasörü yayınlar)
#   claude-sayfasi/swing-choreo-studio.html -> claude.ai sayfası için (iskeletsiz) sürüm
# Kullanım: sh derle.sh
cd "$(dirname "$0")"
mkdir -p docs claude-sayfasi

govde() {
  cat kaynak/head.html
  printf '<style>\n'; cat kaynak/style.css; printf '</style>\n'
  printf '<div id="uygulama"></div>\n<script>\n'; cat kaynak/engine.js; printf '</script>\n<script>\n'; cat kaynak/app.js; printf '</script>\n'
}

# claude.ai sayfası: iskeleti claude.ai ekler
govde > claude-sayfasi/swing-choreo-studio.html

# kendi adresindeki uygulama: tam sayfa + telefona kurulum bilgileri
{
  printf '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="theme-color" content="#1A1310">\n'
  printf '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
  printf '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
  printf '<meta name="apple-mobile-web-app-title" content="Choreo Studio">\n'
  printf '<link rel="manifest" href="manifest.webmanifest">\n'
  printf '<link rel="apple-touch-icon" href="simgeler/simge-180.png">\n<link rel="icon" type="image/png" href="simgeler/simge-192.png">\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);-webkit-text-size-adjust:100%%}body{margin:0}[hidden]{display:none!important}img{max-width:100%%}</style>\n'
  printf '</head>\n<body>\n'
  govde
  printf '</body>\n</html>\n'
} > docs/index.html

# çevrimdışı önbelleğin sürümü her derlemede değişir: telefon yeni sürümü alır
SURUM=$(date +%Y%m%d%H%M%S)
sed "s/__SURUM__/$SURUM/" kaynak/sw.js > docs/sw.js
cp kaynak/manifest.webmanifest docs/manifest.webmanifest

echo "docs/index.html: $(wc -c < docs/index.html) bayt, önbellek sürümü $SURUM"
