# DOG DOG DOG Üssü

Kick yayıncısı **CureShotKick** için hazırlanmış, **resmi olmayan** bir hayran sitesi.
Dota 2 maratonlarının ruhunu taşıyan memeler — **"DOG DOG DOG"** (biri feed'lediğinde ya da oyunu
trollediğinde söylenen o laf) ve **"1vDOQUZ"** (4 takım arkadaşı + 5 rakip = dokuza karşı tek başına
oyunu taşımak) — etrafında kurulmuş espri duvarı, mini oyunlar, quizler, soru-cevap ve 3D sahneler içerir.

Yayın: <https://kick.com/cureshotkick>

> Site bir hayran yapımıdır. Espriler, quizlerdeki hayran içerikleri ve karakter analizleri
> topluluk mizahıdır; yayıncıya ait gerçek alıntı, istatistik ya da biyografi olarak sunulmaz.

---

## İçindekiler

- [Özellikler](#özellikler)
- [Belgeler](#belgeler)
- [Teknoloji yığını](#teknoloji-yığını)
- [Klasör yapısı](#klasör-yapısı)
- [Geliştirme](#geliştirme)
- [Derleme](#derleme)
- [Veri modları](#veri-modları)
- [Yayınlama](#yayınlama)
  - [A) Herhangi bir statik barındırma](#a-herhangi-bir-statik-barındırma)
  - [B) Paylaşılan yorumlar: Cloudflare Worker + D1](#b-paylaşılan-yorumlar-cloudflare-worker--d1)
  - [C) claude.ai Artifact önizlemesi](#c-claudeai-artifact-önizlemesi)
- [fal.ai varlık hattı](#falai-varlık-hattı)
- [İçerik ve marka uyarısı](#i̇çerik-ve-marka-uyarısı)

---

## Özellikler

Gezinme, Dota'nın yetenek çubuğunu taklit eder: ekranın altındaki slotlara tıklayın ya da kısayol tuşlarına basın.

| Tuş | Bölüm | Adres | İçerik |
| --- | --- | --- | --- |
| `H` | **Üs** | `#ana` | Kahraman alanı ve "1 vs 9" 3D dioraması, canlı DOG sayacı, meme sözlüğü, günün esprisi, ziyaretçi defteri |
| `Q` | **Espri Duvarı** | `#espriler` | Topluluk esprileri: yaz, DOG'la (beğen), yorumla |
| `W` | **Mini Oyunlar** | `#oyunlar` | 14 oyun: DOGdle (günlük kahraman tahmini), Portre Avı, Invoker Kombo, Pudge Hook, DOG Bingo, Uçan Kurye, Techies Mayın Tarlası, Eşya 2048, 24 Saat Maraton, DOG Avı, DOG Hafıza, Last Hit, Rune Refleksi ve Arena — kişisel rekor defteri ve rozetler |
| `R` | **1vDOQUZ Arena** | `#arena` (`#oyunlar--arena`) | three.js ile 3D arena: dokuz DOG'a karşı tek başına ("ultimate" slotu) |
| `E` | **Quizler** | `#quizler` | Hangi DOG'sun?, Dota 2 Bilgi Yarışması, DOG mu Değil mi?, Gerçek Hayran Testi, Yetenek Avı (539 yetenek) |
| `D` | **Karakter Analizleri** | `#karakterler` | DOG Arşivi (oyuncu türleri), kahraman potansiyeli, türleri karşılaştırma, kendi analizin |
| `F` | **Soru-Cevap** | `#soru-cevap` | Topluluk soruları ve cevapları (kabul edilen cevap), SSS, DOG Kâhini (yerel, yapay zekâ yok) |
| `T` | **Galeri & 3D Müze** | `#galeri` | fal.ai ile üretilmiş görseller ve 3D modeller (DOG maskotu, okçu kahraman, Aegis) |
| `Z` | **Kahraman DOG Endeksi** | `#kahramanlar` | 127 Dota 2 kahramanı (resmi portre ve tam boy görseller), hayran yapımı "DOG potansiyeli", ziyaretçi oylaması, tier listesi, Daha DOG mu?, çark |

Ek sayfalar ve sistemler:

- **İlk giriş turu** — yetenek çubuğunu ve HUD’u adım adım anlatır; `?` ile yardım ve kısayollar, ad çipi menüsünden tekrar.
- **Profil** (`#profil`) — Fan Kartı, seviye, rekorlar, rozetler, paylaşılabilir kart; her gün 3 **günlük görev**.

Ortak sistemler:

- **Espri / yorum sistemi** — her içerik için ayrı yorum akışı (`src/components/comments.js`), 400 karakter sınırı,
  hafif küfür filtresi, yazarın kendi yorumunu silebilmesi, "DOG'lama" (beğeni).
- **Fan profili** — her ziyaretçinin takma adı, bastığı DOG sayısı, beğenileri, oyun skorları ve quiz seçimleri
  tek bir profil belgesinde tutulur; toplam DOG sayacı ve skor tabloları bunlardan hesaplanır.
- **3D sahneler** — three.js; fal.ai (Trellis 2) GLB modelleri varsa onları, yoksa prosedürel modelleri kullanır.
  Görünmezken çizim durur, WebGL yoksa 2D yedeğe geçer.
- **Varlıksız çalışma** — fal.ai görselleri/modelleri henüz indirilmemişse bile site derlenir ve çalışır;
  her görselin canvas/CSS ile çizilmiş bir yedeği vardır.
- **Erişilebilirlik ve mobil** — 360 px genişlikte yatay kaydırma yok, ≥ 44 px dokunma hedefleri,
  görünür klavye odağı, `prefers-reduced-motion` desteği. Sesler WebAudio ile üretilir (dosya yok) ve
  yalnızca etkileşimden sonra çalar.

## Belgeler

`docs/` klasörü geliştirme sürecini ve tasarımı anlatır:

| Belge | İçerik |
| --- | --- |
| [docs/ANALIZ.md](docs/ANALIZ.md) | Mevcut durum, ölçümler, darboğazlar, araştırma |
| [docs/PLAN.md](docs/PLAN.md) | Hedefler, yeni oyunlar, iş dağılımı |
| [docs/OYUNLAR.md](docs/OYUNLAR.md) | Tüm oyun ve quizlerin özeti; ayrıntılar `docs/oyunlar/` altında |
| [docs/OPTIMIZASYON.md](docs/OPTIMIZASYON.md) | Performans çalışması: önce/sonra ölçümleri, betikler |
| [docs/MIMARI.md](docs/MIMARI.md) | Mimari: bölüm sözleşmesi, veri katmanı, oyun kiti, varlık hatları, derleme modları |
| [docs/REHBER.md](docs/REHBER.md) | İlk giriş turu ve yardım paneli |
| [docs/PROFIL.md](docs/PROFIL.md) | Profil, XP/seviye, günlük görevler |

## Teknoloji yığını

| Katman | Kullanılan |
| --- | --- |
| Derleme | [Vite 6](https://vite.dev) — statik yayın: bölüm başına JS/CSS parçaları, hash'li adlar, ayrı alt küme fontlar; Artifact: tek `app.js` + tek `app.css` (fontlar gömülü) |
| Arayüz | Vanilla JavaScript (ES modülleri, framework yok), elle yazılmış tasarım sistemi (`src/styles/`) |
| 3D | [three.js](https://threejs.org) 0.170 (GLTFLoader + MeshoptDecoder) |
| Yazı tipleri | `@fontsource` ile paketlenen Unbounded, Cinzel, Barlow, JetBrains Mono (dış CDN yok) |
| Ses | WebAudio ile anlık üretilen efektler |
| Paylaşılan veri | claude.ai Artifact veritabanı **ya da** Cloudflare Worker + D1 (`server/`) **ya da** localStorage |
| Görsel/3D üretimi | fal.ai — Nano Banana Pro, Nano Banana 2, Trellis 2 |
| Varlık optimizasyonu | sharp (WebP), @gltf-transform/cli (meshopt + WebP doku) |
| Araçlar | Playwright (ekran görüntüsü betiği), Node 22 |

## Klasör yapısı

```
.
├── index.html                  # giriş sayfası (Vite)
├── vite.config.js              # iki derleme kipi: statik (bölünmüş, hash'li) ve artifact (tek paket), base: './'
├── package.json
├── public/                     # favicon.svg, apple-touch-icon, manifest simgeleri, og.jpg (build:share üretir)
├── src/
│   ├── main.js                 # kabuğu başlatır
│   ├── core/                   # çekirdek: dom, store (veri katmanı), platform, fx, sound, icons,
│   │                           #   shell (HUD + yetenek çubuğu), routes, assets, models
│   ├── components/             # yorumlar, skor tablosu, portre, tilt
│   ├── sections/               # her bölüm kendi klasöründe (home, jokes, games, quizzes,
│   │                           #   characters, qa, gallery, heroes) + bölüme özel CSS
│   ├── data/                   # espriler, DOG türleri, quiz soruları, SSS, kahraman verisi
│   ├── styles/                 # tokens.css, base.css, components.css, shell.css, fonts.css (build:fonts üretir)
│   ├── assets/fal/             # optimize edilmiş fal.ai görselleri (.webp) ve modelleri (.glb)
│   ├── assets/fonts/           # alt küme woff2 fontlar (aile + kalınlık başına tek dosya)
│   └── assets/heroes/          # kahraman görselleri (Valve): portraits/ (256×144), renders/ (tam boy),
│                               #   atlas/ (3D halka için tek portre atlası)
├── assets-src/
│   ├── fal-jobs.json           # fal.ai iş listesi (anahtar → endpoint, request_id, url)
│   ├── raw/                    # fal.ai'den inen ham dosyalar (git'e girmez)
│   └── *.json                  # kahraman listesi kaynak verileri
├── scripts/
│   ├── fetch-fal-assets.mjs    # fal.ai varlıklarını assets-src/raw/ altına indirir (npm run fetch:fal)
│   ├── optimize-assets.mjs     # assets-src/raw/ → src/assets/fal/ (WebP + meshopt GLB, doku 768)
│   ├── subset-fonts.mjs        # @fontsource → src/assets/fonts/ alt küme + src/styles/fonts.css (npm run build:fonts)
│   ├── build-hero-atlas.mjs    # portreler → src/assets/heroes/atlas/ tek WebP atlas (npm run build:atlas)
│   ├── build-share-images.mjs  # public/ simgeleri ve og.jpg paylaşım görseli (npm run build:share)
│   ├── fetch-hero-images.mjs   # Dota 2 CDN'inden kahraman portre/render'ları → src/assets/heroes/ (npm run fetch:heroes)
│   ├── build-artifact.mjs      # dist/index.html → dist/artifact.html (npm run build)
│   ├── artifact-files.mjs      # dist/ içeriğini Artifact dosya eşlemesine çevirir
│   └── shot.mjs                # Playwright ile ekran görüntüsü
└── server/                     # isteğe bağlı paylaşılan veri API'si
    ├── worker.js               # Cloudflare Worker (bağımlılıksız ES modülü)
    ├── schema.sql              # D1 şeması
    ├── wrangler.toml           # Worker + D1 (+ isteğe bağlı statik site) yapılandırması
    ├── local/dev.mjs           # wrangler'sız yerel sunucu (Node SQLite ile)
    ├── local/d1-sqlite.mjs     # D1 arayüzü taklidi (yerel/test)
    └── test/worker.test.mjs    # uç nokta testleri
```

## Geliştirme

Gereken: **Node.js 22** (yerel API sunucusu için ≥ 22.13, vekil sunucu desteği için ≥ 22.21).

```bash
npm install
npm run dev          # http://localhost:5173 (ağdaki diğer cihazlardan da erişilebilir)
```

Geliştirme sırasında yorumlar ve profiller tarayıcının localStorage'ında tutulur (bkz. [Veri modları](#veri-modları)).
Paylaşılan API'yi yerelde denemek için ikinci bir terminalde:

```bash
node server/local/dev.mjs                              # http://localhost:8787/api
VITE_API_BASE=http://localhost:8787/api npm run dev    # site bu API'yi kullanır
```

Ekran görüntüsü (konsol hatalarını ve yatay taşmayı JSON olarak da yazar):

```bash
node scripts/shot.mjs "http://localhost:5173/#oyunlar" ekran.png 1440 900 3000
node scripts/shot.mjs "http://localhost:5173/#oyunlar" mobil.png 390 844 3000
FULL=1 node scripts/shot.mjs "http://localhost:5173/#ana" tam-sayfa.png 1440 900 3000
```

## Derleme

İki derleme kipi vardır (bkz. `vite.config.js`; ayrıntılar ve ölçümler: [docs/OPTIMIZASYON.md](docs/OPTIMIZASYON.md)):

```bash
npm run build:static   # statik yayın (Netlify, GitHub Pages, Cloudflare Pages…) = vite build
npm run build          # claude.ai Artifact: vite build --mode artifact + scripts/build-artifact.mjs
npm run preview        # dist/ klasörünü yerelde sunar (/assets/* için Netlify'deki önbellek başlığıyla)
```

**Statik kip** (`build:static`) — ziyaretçi yalnızca açtığı bölümün kodunu indirir:

| Dosya | Açıklama |
| --- | --- |
| `dist/index.html` | Giriş sayfası; iki fontu önceden yükler, paylaşım (Open Graph) etiketlerini taşır |
| `dist/assets/index-[hash].js`, `index-[hash].css` | Kabuk (HUD, yetenek çubuğu, yönlendirme) ve ortak stiller |
| `dist/assets/<bölüm>-[hash].js/.css` | Bölüm parçaları (`src/core/routes.js` içindeki dinamik `import()`'lar) |
| `dist/assets/three-[hash].js` | three.js; yalnızca 3D sahne açıldığında iner |
| `dist/assets/<aile>-<kalınlık>-[hash].woff2` | Alt küme fontlar, yalnızca kullanıldıklarında istenir |
| `dist/assets/*.webp`, `*.glb` | Görseller, kahraman portre atlası, modeller |
| `dist/og.jpg`, `favicon.svg`, `manifest.webmanifest`… | `public/` klasöründen gelen paylaşım görseli ve simgeler |

Adları hash'li olduğu için `/assets/*` dosyaları bir yıl `immutable` önbelleklenebilir (`netlify.toml`).

**Artifact kipi** (`build`) — claude.ai Artifact ortamı ayrı font dosyalarını ve kod parçalarını güvenilir biçimde
sunamadığı için eskisi gibi tek paket üretilir:

| Dosya | Açıklama |
| --- | --- |
| `dist/assets/app.js`, `dist/assets/app.css` | Tek JS ve tek CSS paketi (fontlar CSS içinde) |
| `dist/assets/*.webp`, `*.glb`, `*.glb.json` | Görseller ve modeller (Artifact `.glb` sunmadığı için base64 JSON kopyaları da) |
| `dist/artifact.html` | Artifact yayını için yalnızca içerikten oluşan sürüm |

`base: './'` sayesinde `dist/` herhangi bir alt klasörde (ör. `kullanici.github.io/depo/`) çalışır.
Yönlendirme hash tabanlıdır (`#oyunlar--arena`); sunucuda yeniden yazma kuralı gerekmez.

Üretilmiş varlıklar depoda durur; kaynakları değiştiğinde yeniden üretin:

```bash
npm run build:fonts    # yeni bir ASCII dışı karakter/simge eklendiğinde (Python: pip install --user fonttools brotli)
npm run build:atlas    # kahraman portreleri değiştiğinde ya da kahraman eklendiğinde
npm run build:share    # og.jpg ve simgeler (og.jpg için Playwright Chromium gerekir)
```

## Veri modları

`src/core/store.js` üç arka uçtan birini açılışta kendiliğinden seçer; bölümler hangisinin kullanıldığını bilmez.

| Mod | Ne zaman | Veri kimle paylaşılır |
| --- | --- | --- |
| `db` | Site claude.ai Artifact önizlemesinde çalışıyorsa (`window.claude.use('db')`) | Artifact'ı açan herkes |
| `api` | Derlemede `VITE_API_BASE` verildiyse ya da aynı kökende `/api/health` → `{ "ok": true }` dönüyorsa | API'yi kullanan herkes |
| `local` | Diğer durumlarda | Yalnızca bu tarayıcı (localStorage) |

Koleksiyonlar:

| Koleksiyon | Alanlar |
| --- | --- |
| `jokes` | `text` (≤ 280), `cat`, `nick`, `authorId`, `createdAt` |
| `comments` | `thread`, `text` (≤ 400), `nick`, `authorId`, `createdAt` |
| `questions` | `title` (≤ 120), `body` (≤ 600), `nick`, `authorId`, `createdAt`, `acceptedId?` |
| `answers` | `qid`, `text` (≤ 600), `nick`, `authorId`, `createdAt` |
| `fans` | belge kimliği = ziyaretçi kimliği; `nick` (≤ 24), `dog`, `likes`, `scores`, `picks`, `updatedAt` |

API modunda ziyaretçi kimliği tarayıcıda üretilir ve `x-fan-id` başlığıyla gönderilir. Bu bir **takma ad
kimliğidir, oturum açma değildir**. Kimliğin başkalarınca kullanılmasını zorlaştırmak için API, başkalarına ait
belgelerde `authorId` alanını (ve `fans` belgelerinin kimliğini) geri döndürülemez bir genel kimlikle (`p_…`)
değiştirir; ham kimliği yalnızca sahibi görür.

## Yayınlama

### A) Herhangi bir statik barındırma

Site tamamen statiktir; `npm run build:static` sonrası `dist/` klasörünü yüklemek yeterlidir. Bu modda yorumlar ve
espriler **yalnızca ziyaretçinin kendi tarayıcısında** saklanır. Herkesin aynı yorumları görmesi için
[B](#b-paylaşılan-yorumlar-cloudflare-worker--d1) seçeneğindeki API'yi ekleyin ve derlemeyi
`VITE_API_BASE=https://…/api npm run build:static` ile yapın.
Hash'li `/assets/*` dosyalarına uzun önbellek başlığı vermek (`Cache-Control: public, max-age=31536000, immutable`)
tekrar ziyaretlerde bütün doğrulama isteklerini ortadan kaldırır; Netlify için bu ayar `netlify.toml` içinde hazırdır.

#### GitHub Pages

1. Depoyu GitHub'a gönderin.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** seçin.
3. `.github/workflows/pages.yml` dosyasını oluşturun:

   ```yaml
   name: Pages
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency: { group: pages, cancel-in-progress: true }
   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22, cache: npm }
         - run: npm ci
         - run: npm run build:static
           env:
             VITE_API_BASE: ${{ vars.VITE_API_BASE }}   # isteğe bağlı: Settings → Variables
         - uses: actions/upload-pages-artifact@v3
           with: { path: dist }
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

4. `main` dalına gönderin; site `https://<kullanıcı>.github.io/<depo>/` adresinde yayınlanır.

#### Netlify

Depodaki `netlify.toml` statik yayın sürümünü derler (`npm run build:static`, `VITE_API_BASE=none`, yayın klasörü
`dist`) ve `/assets/*` için bir yıllık `immutable` önbellek başlığını ekler.

- **Git ile:** *Add new site → Import an existing project* → depoyu seçin.
  Build command: `npm run build:static` · Publish directory: `dist` · (isteğe bağlı) *Environment variables*: `VITE_API_BASE`.
- **Elle:** `npm run build:static` sonrası `dist/` klasörünü <https://app.netlify.com/drop> sayfasına sürükleyin
  ya da `npx netlify-cli deploy --prod --dir dist`.

#### Cloudflare Pages

- **Git ile:** *Workers & Pages → Create → Pages → Connect to Git* → depoyu seçin.
  Framework preset: *None* (ya da *Vite*) · Build command: `npm run build:static` · Build output directory: `dist` ·
  Ortam değişkenleri: `NODE_VERSION=22`, isteğe bağlı `VITE_API_BASE`.
- **Elle:** `npm run build:static && npx wrangler pages deploy dist --project-name dogdogdog`.

### B) Paylaşılan yorumlar: Cloudflare Worker + D1

`server/worker.js` bağımlılıksız bir Cloudflare Worker'dır; veriler Cloudflare D1 (SQLite) veritabanında tutulur.
İki kurulum biçimi vardır:

- **B1 — Tek Worker (önerilen):** site ve API aynı adresten sunulur. CORS ya da `VITE_API_BASE` gerekmez;
  site `/api/health` yanıtını görüp kendiliğinden API moduna geçer.
- **B2 — Yalnızca API:** site başka yerde (GitHub Pages, Netlify…) durur, API ayrı bir Worker adresindedir.

#### Adımlar

```bash
# 0) Cloudflare hesabına giriş
npx wrangler login

# 1) Veritabanını oluşturun; çıktıdaki database_id değerini server/wrangler.toml içine yapıştırın
cd server
npx wrangler d1 create dogdogdog

# 2) Şemayı uygulayın (tekrar çalıştırmak güvenlidir)
npx wrangler d1 execute dogdogdog --remote --file schema.sql

# 3) (isteğe bağlı) Yönetici anahtarı ve kimlik tuzu
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put ID_SALT
```

**B1 — site + API tek Worker'da:**

```bash
cd ..            # depo kökü
npm run build    # dist/ oluşur
# server/wrangler.toml içindeki [assets] bloğunun yorumunu kaldırın:
#   [assets]
#   directory = "../dist"
#   binding = "ASSETS"
cd server
npx wrangler deploy
# → https://dogdogdog-api.<hesabınız>.workers.dev  (site)  ve  …/api/health  (API)
```

`/api/*` istekleri Worker'a, diğer tüm istekler `dist/` içindeki statik dosyalara gider. Siteyi her
güncellediğinizde `npm run build` ve `npx wrangler deploy` komutlarını yeniden çalıştırın.

**B2 — yalnızca API:**

```bash
# server/wrangler.toml → [vars] ALLOWED_ORIGIN = "https://kullanici.github.io"   (virgülle birden fazla olabilir)
npx wrangler deploy
# Siteyi API adresiyle derleyin ve A) seçeneğindeki gibi yayınlayın:
cd ..
VITE_API_BASE=https://dogdogdog-api.<hesabınız>.workers.dev/api npm run build
```

Kontrol:

```bash
curl https://dogdogdog-api.<hesabınız>.workers.dev/api/health
# {"ok":true,"version":1}
```

#### Yerelde çalıştırma

```bash
# wrangler ile (Cloudflare çalışma ortamının yerel kopyası)
cd server
npx wrangler d1 execute dogdogdog --local --file schema.sql
npx wrangler dev                      # http://localhost:8787

# wrangler olmadan (Node'un yerleşik SQLite'ı ile, ağ gerekmez)
node server/local/dev.mjs             # dist/ varsa siteyi de sunar; --persist ile veri kalıcı olur

# testler
node --disable-warning=ExperimentalWarning --test server/test/worker.test.mjs
```

#### API başvurusu

| Yöntem | Yol | Yanıt |
| --- | --- | --- |
| `GET` | `/api/health` | `{ "ok": true, "version": 1 }` (DB/şema yoksa 503 + `ok: false`) |
| `GET` | `/api/c/:col?where=alan:değer&orderBy=alan&dir=asc\|desc&limit=n` | `{ "docs": [{ "id", …alanlar }] }` |
| `GET` | `/api/c/:col/:id` | `{ "doc": { "id", … } }` ya da 404 |
| `POST` | `/api/c/:col` | `{ "id" }` (201) |
| `PUT` | `/api/c/:col/:id` | yoksa oluşturur, varsa tamamen değiştirir → `{ "ok": true, "id" }` |
| `PATCH` | `/api/c/:col/:id` | sığ birleştirme → `{ "ok": true, "id" }` ya da 404 |
| `DELETE` | `/api/c/:col/:id` | `{ "ok": true, "id" }` ya da 404 |

Kurallar:

- Koleksiyonlar: `jokes`, `comments`, `questions`, `answers`, `fans`. Diğerleri 404.
- Yazma istekleri `x-fan-id` başlığı ister. `createdAt` ve `authorId` sunucu tarafından konur; istemcinin
  gönderdiği değerler yok sayılır. `fans/:id` yalnızca `x-fan-id` aynı kimlikse yazılabilir.
- Güncelleme ve silme yalnızca yazara (`authorId === x-fan-id`) ya da `authorization: Bearer <ADMIN_TOKEN>`
  gönderen yöneticiye açıktır.
- Gövde düz bir JSON nesnesi olmalı ve 200 KB'ı aşmamalı. Uzunluk sınırları: `jokes.text` 280,
  `comments.text` 400, `questions.title` 120, `questions.body` 600, `answers.text` 600, `nick` 24,
  diğer metin alanları 1000 karakter.
- `where` yalnızca eşitlik; `orderBy` yalnızca izinli alanlarla (`createdAt`, `updatedAt`, `id`, `nick`, `dog`,
  `cat`, `thread`, `qid`, `title`, `score`, `votes`, `likes`, `rank`, `order` — `server/worker.js` içindeki
  `ORDER_FIELDS` ile genişletilebilir); `limit` en fazla 1000.
- Hız sınırı: IP başına dakikada 10 yeni içerik (`POST_LIMIT_PER_MIN`) ve 60 diğer yazma
  (`WRITE_LIMIT_PER_MIN`); aşılırsa 429 + `retry-after`.

#### Moderasyon

```bash
API=https://dogdogdog-api.<hesabınız>.workers.dev/api
# Bir konunun yorumlarını listele (yönetici ham yazar kimliklerini görür)
curl -H "authorization: Bearer $ADMIN_TOKEN" "$API/c/comments?where=thread:joke:abc&orderBy=createdAt&dir=desc"
# Sil
curl -X DELETE -H "authorization: Bearer $ADMIN_TOKEN" "$API/c/comments/<id>"
# Doğrudan SQL (ör. bir yazarın tüm içeriğini silmek)
npx wrangler d1 execute dogdogdog --remote --command "DELETE FROM docs WHERE author_id = '<kimlik>'"
```

Cloudflare'in ücretsiz planı küçük bir hayran sitesi için genellikle yeterlidir; güncel Worker ve D1
kotaları için Cloudflare belgelerine bakın. Site her abonelik için 10 saniyede bir liste isteği yapar.

### C) claude.ai Artifact önizlemesi

`npm run build` (`vite build --mode artifact`) tek paket derler ve ayrıca `dist/artifact.html` üretir: Artifact
yayını sayfayı kendi `<html>` iskeletine sardığı için yalnızca başlık, stil, betik ve gövde içeriğinden oluşur.
Destek dosyalarının (`assets/app.js`, `assets/app.css`, görseller, modeller) eşlemesi için
`node scripts/artifact-files.mjs` kullanılır; `public/` kaynaklı paylaşım görseli ve simgeler bu eşlemeye girmez.

Bu ortamda:

- Veriler Artifact'ın paylaşılan veritabanında tutulur (`db` modu); sahip ve editörler başkalarının yorumlarını silebilir.
- Sayfa bir iframe içinde çalışır: `alert/confirm/prompt`, `window.open` ve dosya indirme yoktur (site kendi
  modal ve onay pencerelerini kullanır); başka alan adlarına istek, CDN, dış font kullanılmaz — her şey pakettedir.
- Adres çubuğu yalnızca `[A-Za-z0-9._~-]` karakterlerini ilettiği için alt sayfa adresleri bu karakterlerle sınırlıdır.
- Artifact boyut sınırı nedeniyle fal.ai varlıkları yalnızca optimize edilmiş hâlleriyle (`src/assets/fal/`) pakete girer.

## fal.ai varlık hattı

Görseller ve 3D modeller [fal.ai](https://fal.ai) üzerinde üretilir; hat şöyle işler:

```
fal.ai üretimi ──► assets-src/fal-jobs.json ──► npm run fetch:fal ──► assets-src/raw/ ──► optimize ──► src/assets/fal/
  (endpoint,          (anahtar → endpoint,        (ham indirme)         (jpg/png/glb,      (WebP,           (pakete giren
   request_id)         request_id, url)                                  git'e girmez)       meshopt GLB)      dosyalar)
```

| Model | Uç nokta | Kullanım |
| --- | --- | --- |
| Nano Banana Pro | `fal-ai/nano-banana-pro` | Ana görsel (`hero-keyart`, 21:9) ve posterler (`poster-dogdogdog`, `poster-1vdoquz`, 16:9) |
| Nano Banana 2 | `fal-ai/nano-banana-2` | DOG türü portreleri (`portrait-<tür>`, 1:1), döşenebilir arena zemini (`texture-arena`), 3D için referans görseller (`src3d-*`) |
| Trellis 2 | `fal-ai/trellis-2` | Referans görselden GLB model: `model-dog`, `model-archer`, `model-aegis` |

Portre türleri: `farm`, `feed`, `pause`, `afk`, `kurye`, `rapier`, `mid`, `ward`, `smurf`, `chat`, `legend`.

### 1. İndirme — `npm run fetch:fal`

```bash
npm run fetch:fal                              # url'si olan ve assets-src/raw/ içinde olmayan her girdiyi indirir
npm run fetch:fal -- --force                   # hepsini yeniden indir
npm run fetch:fal -- --only hero-keyart,model-dog
npm run fetch:fal -- --dry-run                 # yalnızca ne yapılacağını göster
npm run fetch:fal -- --no-optimize             # indir, optimizasyonu çalıştırma
FAL_KEY=<anahtar> npm run fetch:fal            # url'si olmayanları request_id'den çöz
```

- Ham dosyalar `assets-src/raw/<anahtar>.<jpg|png|webp|glb>` olarak kaydedilir; uzantı dosyanın imzasından
  belirlenir (hata sayfası gibi görsel olmayan yanıtlar reddedilir). Bu klasör `.gitignore` içindedir.
- `src3d-*` girdileri (Trellis 2'ye verilen referans görseller) sitede kullanılmadığı için indirilmez.
- Zaten var olan dosyalar atlanır; sonunda bir özet tablo yazdırılır. Yeni bir dosya indiyse betik
  optimizasyon adımını kendiliğinden çalıştırır.
- `url` alanı boş bir girdi için `FAL_KEY` tanımlıysa sonuç `https://queue.fal.run/<endpoint>/requests/<request_id>`
  adresinden (`Authorization: Key $FAL_KEY`) alınır ve bulunan URL jobs dosyasına geri yazılır.
  Anahtar yoksa girdi özet tabloda **URL eksik** olarak görünür.
- **Vekil sunucu:** Node'un yerleşik `fetch`'i `HTTPS_PROXY` değişkenini ancak `NODE_USE_ENV_PROXY=1` ile
  kullanır (Node ≥ 22.21). `HTTPS_PROXY` tanımlıysa betik kendini bu değişkenle yeniden başlatır; elle çalıştırmak
  için: `NODE_USE_ENV_PROXY=1 npm run fetch:fal`. Kurumsal bir sertifika gerekiyorsa `NODE_EXTRA_CA_CERTS` ayarlayın.
  Ağ politikası `fal.media` / `queue.fal.run` adreslerini engelliyorsa (403, "Host not in allowlist") bu alan
  adlarının izin listesine eklenmesi gerekir.

### 2. Optimizasyon — `node scripts/optimize-assets.mjs`

`sharp` ve `@gltf-transform/cli` geliştirme bağımlılığı olarak kuruludur (`npm install`).

- Görseller WebP'ye çevrilir: ana görsel en fazla 2400 px, posterler 1600 px, portreler 768 px, doku 1024 px genişlik.
- GLB'ler `gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 768` ile sıkıştırılır
  (three.js yükleyicisi `MeshoptDecoder` ile hazırdır: `src/core/models.js`). Ham dosyalar yoksa
  `node scripts/optimize-assets.mjs --yerinde` aynı ayarları mevcut `src/assets/fal/` dosyalarına uygular.
- Çıktı `src/assets/fal/<anahtar>.<webp|glb>`; `src/core/assets.js` bunları derlemede kendiliğinden bulur.
  Bir dosya yoksa bileşenler prosedürel (canvas/three.js) yedeğe geçer, yani site varlıklar olmadan da çalışır.

## İçerik ve marka uyarısı

- Bu site **resmi değildir**; CureShotKick, Kick ya da Valve Corporation ile bir bağı yoktur ve onlar
  tarafından onaylanmamıştır.
- **Dota 2**, Valve Corporation'ın ticari markasıdır. Kahraman DOG Endeksi'ndeki kahraman portreleri ve
  renderları Dota 2'nin resmi görselleridir; Valve'a aittir ve ticari olmayan hayran kullanımıyla yer alır
  (`npm run fetch:heroes`). Diğer tüm görseller fal.ai ile üretilmiş ya da kodla çizilmiş özgün çalışmalardır.
- "DOG DOG DOG" oyunbaz bir laftır; içerik saygılı kalır. Hakaret, nefret söylemi ve kişisel saldırı içeren
  yorumlar silinir. Topluluk esprileri ve analizleri hayran yapımıdır; yayıncının görüşü ya da sözü değildir.
