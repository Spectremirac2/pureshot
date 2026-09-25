# Optimizasyon — Eylül 2026

Analiz ve darboğazlar için bkz. [ANALIZ.md](ANALIZ.md), plan için [PLAN.md](PLAN.md). Bu belge performans
çalışmasında neyin neden değiştiğini, ölçüm sonuçlarını ve üretilmiş varlıkların nasıl yeniden üretileceğini anlatır.

Amaç: Netlify ücretsiz planında kapasiteyi doğrudan belirleyen **ziyaretçi başına aktarımı** ve istek sayısını
düşürmek, tekrar ziyaretleri tamamen önbellekten sunmak. claude.ai Artifact sürümü eskisi gibi tek paket kalır.

## Özet

| Ölçüm (1440×900, ilk ziyaret) | Önce | Sonra | Fark |
|---|---|---|---|
| Ana sayfa (`#ana`) | 2.817 KB · 9 istek | **1.949 KB** · 28 istek | **−%31** |
| Kahramanlar (`#kahramanlar`) | 1.883 KB · 131 istek | **1.009 KB** · 73 istek | **−%46** · −58 istek |
| Tüm bölümler turu (10 rota) | 5.333 KB · 151 istek | **4.323 KB** · 117 istek | **−%19** |
| Tekrar ziyaret (aynı tarayıcı, tur) | 151 doğrulama isteği (304) | **1 istek** (yalnızca HTML) | 150 gidiş-dönüş yok |

İstek sayısı ana sayfada artar (tek paket → bölüm parçaları + ayrı fontlar); HTTP/2 üzerinde bu istekler paralel
iner ve her biri ayrı ayrı bir yıl önbellekte kalır. Kahramanlar sayfasında ise 127 portre isteği tek atlasa indi.

> Ölçüm: aynı kaynak ağacından iki derleme (eski yapılandırma ↔ yeni yapılandırma), yerel `vite preview`
> (gzip), Playwright + Chrome DevTools Protocol ile aktarılan bayt (`encodedDataLength`). Böylece fark yalnızca
> bu çalışmadaki değişiklikleri gösterir; aynı sırada eklenen yeni oyunlar iki tarafta da vardır. Netlify brotli
> kullandığı için JS/CSS yayında biraz daha küçüktür. Canlı sitenin önceki değerleri (ANALIZ.md, daha az içerikle):
> ana sayfa 3,05 MB / 19 istek, kahramanlar 1,78 MB / 133 istek, tur 5,16 MB / 159 istek.

### Türlere göre (ilk ziyaret)

| | Ana sayfa önce | Ana sayfa sonra | Kahramanlar önce | Kahramanlar sonra |
|---|---|---|---|---|
| CSS | 438 KB (1 dosya, fontlar içinde) | 15 KB (2) | 438 KB (1) | 14 KB (2) |
| Font | — (CSS'te) | 153 KB (8 woff2) | — (CSS'te) | 153 KB (8) |
| JS | 523 KB (1) | 236 KB (11, three.js dahil) | 523 KB (1) | 254 KB (10) |
| Görsel | 745 KB (4) | 678 KB (4) | 920 KB (128) | 587 KB (52: atlas + görünür duvar kartları) |
| GLB | 1.109 KB (2) | 866 KB (2) | — | — |

### Paketler

| | Önce (tek paket) | Sonra — statik kip | Sonra — Artifact kipi |
|---|---|---|---|
| JS | `app.js` 1.675 KB · 521 KB gzip, her sayfada | 31 parça, toplam 1.678 KB · 534 KB gzip; giriş `index.js` 39 KB · 16 KB gzip; `three.js` 640 KB · 166 KB gzip (yalnızca 3D bölümlerde) | `app.js` 1.675 KB · 522 KB gzip (değişmedi) |
| CSS | `app.css` 861 KB · 437 KB gzip (%70'i gömülü font) | 10 dosya, toplam 364 KB · 75 KB gzip; giriş 26 KB · 7 KB gzip | `app.css` 588 KB · 235 KB gzip (alt küme fontlar gömülü, **−%46**) |
| Font | 18 woff2 (latin + latin-ext × 9 kalınlık), 371 KB → base64 | 9 woff2, toplam 169 KB, yalnızca kullanılan kalınlık iner | 9 woff2 CSS içinde |
| GLB | dog 540 · archer 569 · aegis 632 KB | dog 418 · archer 447 · aegis 461 KB (**−%24**) | aynı |
| Kahraman halkası | 127 portre isteği | 1 atlas, 187 KB | 1 atlas |

## Değişiklikler

### 1. Alt küme fontlar — `scripts/subset-fonts.mjs`

- **Neden:** Fontlar base64 olarak CSS'e gömülüydü: her ziyaretçi 9 kalınlığın latin + latin-ext dosyalarını
  (kullanılmayan yüzlerce glif dahil) indiriyor, CSS ve fontlar ayrı önbelleklenemiyordu.
- **Ne:** `@fontsource` paketlerindeki latin ve latin-ext woff2 dosyaları `fontTools` ile birleştirilip sitenin
  kullandığı glif kümesine indirilir, aile + kalınlık başına tek woff2 yazılır (`src/assets/fonts/`).
  `src/styles/fonts.css` aynı aile adlarıyla `@font-face` kurallarını içerir (`font-display: swap`);
  `src/main.js` artık `@fontsource/*` yerine bunu içe aktarır.
- **Glif kümesi:** `src/**/*.{js,css}` + `index.html` içindeki tüm ASCII dışı karakterler (`\uXXXX` kaçışları
  dahil) ∪ Temel Latin ∪ Latin-1 Ek ∪ Türkçe harfler (Ç ç Ğ ğ İ ı Ö ö Ş ş Ü ü, â î û) ∪ sık noktalama ve oklar.
  Kullanıcı metninde başka bir alfabe (Kiril, Yunan…) görünürse tarayıcı sistem fontuna düşer — bilinçli tercih.
- **Kalınlıklar:** CSS/JS taraması ve 10 rotalık tarayıcı turunda `document.fonts` ile doğrulandı; dokuzu da
  kullanılıyor, hiçbiri atılmadı: Unbounded 800/900, Cinzel 700, Barlow 400/500/600/700, JetBrains Mono 500/700.
- **Korunan özellikler:** `kern`, `liga`, `locl` (Türkçe), JetBrains Mono `calt`, `tnum` (`.num`). Sitede
  kullanılmayan `frac/numr/dnom` atıldı. Barlow'un ipucu (hinting) tabloları korunur (Windows'ta gövde metni).
- **Önyükleme:** Statik yayında en çok kullanılan iki font (`barlow-400`, `unbounded-800`) `index.html`'de
  `<link rel="preload">` ile istenir; metin JS kabuğu çizdikten sonra oluştuğu için aksi hâlde fontlar geç kalırdı.
- **Doğrulama:** CDP `CSS.getPlatformFontsForNode` ile her rotada metin düğümlerinin gerçekte hangi fontla
  çizildiği sayıldı: Türkçe karakter içeren bütün düğümler web fontlarıyla çiziliyor; sistem fontuna düşen
  birkaç glif (JetBrains Mono'da olmayan bir iki simge) önceki durumla birebir aynı. `#ana`, `#espriler`,
  `#kahramanlar--spectre` önce/sonra ekran görüntüleri görsel olarak aynı (ğ ş ı İ doğru yüzlerde).

### 2. İki derleme kipi — `vite.config.js`

- **Statik (varsayılan, `npm run build:static`):** `src/core/routes.js` içindeki dinamik `import()`'lar ayrı
  parçalara bölünür (ayrıca galeri müzesi, arena 3D görünümü, ana sayfa sahnesi gibi iç içe dinamik içe
  aktarmalar). three.js `manualChunks` ile tek bir `three` parçasında: bölüm kodu değişse de tarayıcıdaki kopyası
  geçerli kalır. JS/CSS/font adları hash'li (`assets/[name]-[hash].js`), fontlar ayrı dosya olarak iner.
  CSS de bölümlere bölünür (`cssCodeSplit`): ana sayfa 437 KB yerine 15 KB CSS indirir; bölüm CSS'i parçasıyla
  birlikte yüklenir (Vite yükleyicisi CSS gelmeden parçayı çalıştırmaz, stilsiz an olmaz). Parça listesi sabit
  değildir; yeni oyun/quiz dosyaları kendiliğinden doğru parçaya girer.
- **Artifact (`npm run build` = `vite build --mode artifact`):** eskisiyle aynı: `inlineDynamicImports`, sabit
  `assets/app.js` + `assets/app.css`, woff2 CSS içinde. `scripts/build-artifact.mjs` değişmeden çalışır.
- **Her iki kipte:** `/assets/heroes/` ve `/assets/abilities/` altındaki görseller asla JS/CSS'e gömülmez.
- **Önbellek:** `netlify.toml` → `/assets/*` için `Cache-Control: public, max-age=31536000, immutable`; derleme
  komutu `npm ci && npm run build:static`. `vite preview` aynı başlığı taklit eder (yerel ölçüm için).
  GitHub Pages iş akışı `npx vite build` ile zaten statik kipi kullanır (Pages başlık ayarına izin vermez).

### 3. Kahraman halkası atlası — `scripts/build-hero-atlas.mjs`

- **Neden:** 3D sikke halkası 127 portreyi ayrı ayrı istiyordu (sayfanın 133 isteğinin 127'si).
- **Ne:** Her portrenin (256×144) ortasından kare kırpım, `HEROES` sırasıyla 16 sütunluk tek WebP
  (`src/assets/heroes/atlas/portraits.webp`, 1280×640, 187 KB) + dizin (`portraits.json`: hücre, sütun, id listesi).
  `crest.js → loadPortraits()` önce atlası yükler; `drawCrestCanvas()` atlas hücresini iç madalyona çizer
  (portre madalyonda, DOG% halkası ve yüzde yazısı aynı). Görünüm birebir aynı (yakın çekim karşılaştırıldı).
- **Hücre 80 px:** sikke dokusunda iç madalyon zaten ~82 px çiziliyor; 96/128 px hücre görünür fark yaratmadan
  atlası 240–300 KB'a çıkarıyordu.
- **Yedek:** Atlas yüklenemezse (ya da yeni bir kahraman atlasta yoksa) o portreler eskisi gibi tek tek yüklenir;
  atlas isteği engellenerek test edildi (halka portrelerle çizildi, sayfa hatası 0).
- Duvar kartları kendi `loading="lazy"` portrelerini kullanmaya devam eder; ilk ekranda yalnızca görünüme yakın
  olanlar iner (yukarıdaki 52 görsel).

### 4. GLB modelleri ve dokular — `scripts/optimize-assets.mjs`

- GLB dokuları 1024² → **768²** WebP (`--texture-size 768`). Üçgen/köşe sayıları birebir aynı (yeniden
  sadeleştirme yapılmadı). Sabit kamerayla çizilen karşılaştırmada PSNR: 160–400 px'te 45–50 dB, 800 px'lik
  yakın çekimde 43–49 dB; müze ve ana sayfa boyutunda fark görülmüyor.
- Denenip **reddedilenler:** 512² doku (800 px yakın çekimde okçunun yüzü ve gözleri belirgin biçimde
  yumuşuyor) ve `simplify --error 0.001` (model başına yalnızca 20–40 KB kazanç, DOG'un yüz gölgelerinde
  görünür fark).
- `texture-arena.webp` (taş zemin dokusu, 3D sahnelerde döşenerek kullanılıyor): kalite 86 → 80, 316 → 249 KB.
  Portreler, posterler ve ana görsel yeniden kodlanmadı: kalite 80'de kazanç %2–5, 75'te portrelerde kayıp görünür.
- Dosyalar ham kaynaklardan (`assets-src/raw/`, git'e girmez) `npm run optimize:assets` ile üretildi; betik
  bu kaynaklardan depodaki bütün `src/assets/fal/` dosyalarını bayt bayt aynı üretir (eski 1024'lük GLB'ler de
  aynı komutla birebir yeniden üretilebildi). Ham kaynak olmayan bir makinede aynı ayarlar
  `node scripts/optimize-assets.mjs --yerinde` ile mevcut dosyalara uygulanabilir; bu kip zaten işlenmiş
  dosyaları (%10'dan az kazanç) yeniden kodlamaz, yani tekrar çalıştırmak kalite kaybettirmez.

### 5. Paylaşım önizlemesi ve simgeler — `scripts/build-share-images.mjs`

- `index.html`: Open Graph + Twitter kartı (Türkçe başlık/açıklama, `og:image` →
  `https://cureshot-dog.netlify.app/og.jpg`, 1200×630), `theme-color`, `color-scheme`, SVG favicon,
  `apple-touch-icon`, web manifest.
- `public/og.jpg` (95 KB): fal.ai ana görseli sağa yaslı, solda sitenin kendi fontlarıyla “DOG DOG DOG” başlığı ve
  tanıtım satırı (Chromium'da çizilip JPEG'e çevrilir).
- `public/favicon.svg`: sitedeki `.hud-crest` motifi (köz degradeli altıgen + pati, `icons.js` 'paw').
  `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (maskable güvenli alanında).
- `public/manifest.webmanifest`: “DOG DOG DOG Üssü” / “DOG Üssü”, koyu tema (`#0d0b14`), göreli yollar
  (GitHub Pages alt klasöründe de çalışır).
- Artifact: `build-artifact.mjs` yalnızca başlık, açıklama, tema rengi, stil ve betiği taşır;
  `scripts/artifact-files.mjs` bu `public/` dosyalarını Artifact eşlemesine almaz.

## Doğrulama

- Statik derleme, 10 rota (`ana, espriler, oyunlar, oyunlar--arena, quizler, karakterler, soru-cevap, galeri,
  kahramanlar, kahramanlar--spectre`), 1440×900 ve 390×844 (dokunmatik): **konsol hatası 0, 4xx 0, yatay taşma
  yok** (sayfa sonuna kadar kaydırılarak ölçüldü).
- Artifact derlemesi, sahte claude.ai çalışma zamanıyla (`scripts/fake-claude.js`): hata 0, tek `app.js` +
  `app.css`, font isteği 0 (gömülü), modeller `.glb.json` yolundan, halka atlası kullanılıyor, 9 font yüzü yüklü.
  `dist/artifact.html` yalnızca `./assets/app.css` ve `./assets/app.js`'e başvurur.
- Tekrar ziyaret (aynı tarayıcı bağlamı): statik kipte bütün `/assets/*` dosyaları bellekten/diskten gelir;
  ağa yalnızca `index.html` doğrulaması gider.

## Yeniden üretme

| Komut | Ne zaman | Gereken |
|---|---|---|
| `npm run build:fonts` | Kaynaklara yeni bir ASCII dışı karakter/simge eklendiğinde, font kalınlığı değiştiğinde | Python 3 + `pip install --user fonttools brotli` |
| `npm run build:atlas` | Kahraman portreleri değiştiğinde ya da kahraman eklendiğinde | sharp (devDependency) |
| `npm run build:share` | Ana görsel, başlık ya da marka rengi değiştiğinde (`--simgeler`: yalnızca simgeler) | sharp + Playwright Chromium |
| `npm run optimize:assets` | fal.ai ham dosyaları yeniden indirildiğinde (`--yerinde`: mevcut dosyalara uygula) | sharp + @gltf-transform/cli |
| `npm run build:static` | Netlify / GitHub Pages / Cloudflare Pages yayını | — |
| `npm run build` | claude.ai Artifact yayını (`dist/artifact.html` + `scripts/artifact-files.mjs`) | — |

Font kalınlığı eklemek için `scripts/subset-fonts.mjs` içindeki `FACES` listesine ekleyip betiği çalıştırın;
`src/styles/fonts.css` elle düzenlenmez.

## Kalan fikirler

- **three.js ağaç sallama:** `three` parçası 640 KB (166 KB gzip) — `import * as THREE` kullanımı yüzünden
  kütüphanenin çoğu pakete giriyor. Adlandırılmış içe aktarmalara geçmek 200–300 KB ham kazandırabilir.
- **Kahraman halkasını tembel yüklemek:** `heroes.js` halkayı (dolayısıyla three.js'i) statik içe aktarıyor;
  halka `import()` ile yüklenirse duvar/tier listesi three.js'i beklemeden açılır.
- **Ana sayfa 3D sahnesi:** ana sayfanın %44'ü iki GLB (866 KB). Sahneyi ilk etkileşimde ya da görünür olduğunda
  yüklemek, yavaş bağlantıda ilk boyamayı hızlandırır.
- **Küçük portre varyantları:** DOG türü portreleri 768² (~90 KB); kartlarda 256–384 px'lik varyantlar
  (`srcset`) ilk ziyareti ~%30 azaltır.
- **GLB sıkıştırması:** meshopt verisi gzip/brotli ile %20–30 daha küçülür, ancak Netlify `model/gltf-binary`
  türünü sıkıştırmıyor. KTX2/Basis dokular GPU belleğini de düşürür (kodlayıcı gerekir).
- **Font:** Barlow'un ipucu tabloları atılırsa 4 dosyada ~24 KB, JetBrains Mono `calt` atılırsa ~22 KB kazanılır;
  Windows'ta gövde metni netliği ve kod bağlarının görünümü karşılığında — şimdilik korundu.
- **Görsel biçimleri:** posterler/ana görsel için AVIF (`<picture>`) %20–30 kazandırabilir.
- **Galeri metni:** “Nasıl yapıldı?” (`src/sections/gallery/howto.js`) web paketini “model başına 550–650 KB”
  olarak anlatıyor; yeni değer 420–470 KB (doku 768).
