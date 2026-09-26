# Galeri & 3D Müze (`#galeri`, kısayol `T`)

Sitenin yapım aşamasında fal.ai ile üretilmiş görsellerinin ve 3D modellerinin vitrini. Üç alt sayfa:

| Alt sayfa | Adres | Dosya | İçerik |
|---|---|---|---|
| 3D Müze (varsayılan) | `#galeri--muze` | `museum3d.js` | Üç salonda 18 eser, taş kaide, spot ışık, beğen/DOG’la |
| Sanat Galerisi | `#galeri--sanat` | `art.js` | 25 fal.ai görseli (afişler, DOG portreleri, Arena hikâyesi: 5 bölüm afişi + 5 boss portresi, doku), lightbox, yorumlar, en çok beğenilenler |
| Nasıl yapıldı? | `#galeri--nasil` | `howto.js` | Üretim hattı (5 adım) ve varlık envanteri |

Kod `src/sections/gallery/` altındadır. `gallery.js` sekmeleri ve başlıktaki sayaçları (görsel, **3D model n/n**,
canlı fal.ai çağrısı: 0) kurar; alt sayfalar dinamik import ile yüklenir.

## Salonlar ve eserler

Tek kaynak `exhibit-data.js` (three.js içermez): `WINGS` salonları, `EXHIBITS` eserleri tanımlar.
`catalog.js` içindeki `MODEL_KEYS`, "Nasıl yapıldı?" sayfası, sanat galerisinin skor tablosu ve başlık sayacı
hep bu listeden türetilir; yeni eser eklemek için başka bir listeyi elle güncellemek gerekmez.

| No | Salon | Ad | Anahtar | Rol | Doku |
|---|---|---|---|---|---|
| I | I · Efsaneler | DOG Maskotu | `model-dog` | sitenin maskotu | 768² |
| II | I · Efsaneler | Okçu Kahraman | `model-archer` | 1vDOQUZ efsanesi | 768² |
| III | I · Efsaneler | Aegis Kupası | `model-aegis` | kupa | 768² |
| IV | II · Arena | Balta | `model-hero-brute` | kahraman, yakın dövüş | 768² |
| V | II · Arena | Buz Cadısı | `model-hero-frost` | kahraman, büyücü | 768² |
| VI | II · Arena | Gölge | `model-hero-shadow` | kahraman, suikastçı | 768² |
| VII | II · Arena | Dire Piyadesi | `model-creep-melee` | creep, yakın dövüş | 512² |
| VIII | II · Arena | Dire Büyücüsü | `model-creep-ranged` | creep, menzilli | 512² |
| IX | II · Arena | Kaya Canavarı | `model-roshan` | boss | 768² |
| X | II · Arena | Radiant Kulesi | `model-tower-radiant` | yapı | 768² |
| XI | II · Arena | Dire Kulesi | `model-tower-dire` | yapı | 768² |
| XII | II · Arena | Kurye | `model-courier` | yardımcı | 512² |
| XIII | III · Dokuzun Laneti | Şimşek Ruhu | `model-hero-storm` | açılabilir kahraman | 768² |
| XIV | III · Dokuzun Laneti | Ağaç Bekçisi | `model-hero-treant` | açılabilir kahraman (en ağır: ~720 KB) | 768² |
| XV | III · Dokuzun Laneti | Orman Kurdu | `model-neutral-wolf` | tarafsız kamp | 512² |
| XVI | III · Dokuzun Laneti | Harpi | `model-neutral-harpy` | tarafsız kamp | 512² |
| XVII | III · Dokuzun Laneti | Dire Generali | `model-boss-general` | III. bölüm boss’u | 768² |
| XVIII | III · Dokuzun Laneti | Sonsuz Pub’ın Kalbi | `model-boss-ancient` | final boss’u | 768² |

Eserler Dota arketiplerinden esinlenen özgün tasarımlardır; plaketlerde hiçbirine Valve kahraman adı verilmez
(esprili göndermeler serbest). Salon III, Arena’nın yakında gelecek hikâye modunun ("Dokuzun Laneti": bitmeyen bir
pub maçı oyuncuların ruhunu DOG’a çevirir, laneti 1vDOQUZ ile kırarsın; anlatıcı Kurye) kadrosudur.

### Eser alanları

| Alan | Anlamı |
|---|---|
| `key` | `src/assets/fal/<key>.glb` |
| `id` | prosedürel yedeğin kimliği (`exhibits.js` → `BUILDERS`) |
| `no`, `wing` | Roma rakamıyla genel numara (sayaç: "Eser IV / XVIII"), salon kimliği |
| `name`, `kicker`, `desc`, `icon` | plaket başlığı, rol satırı, esprili açıklama, slot ikonu (`core/icons.js`) |
| `height`, `yaw` | kaide üstündeki yükseklik (birim) ve modeli kameraya çevirmek için y dönüşü (şu an hepsi 0: tüm modeller önden bakıyor) |
| `pitch` | DOG! havlamasının perdesi (boss’lar kalın, harpi ince) |
| `arena` | `true` → plakette "Arena’da gör" (`#oyunlar--arena`); `'soon'` → "Yakında hikâye modunda" rozeti + "Arena’ya git". Hikâye modu yayına girince Salon III eserlerinde `true` yapın. |
| `fallbackArt`, `fallbackArch` | WebGL yokken gösterilecek 2D görsel (yoksa ikonlu kart çizilir) |

### Yeni eser eklemek

1. GLB’yi `assets-src/raw/`e koy, `npm run optimize:assets` ile `src/assets/fal/`e sıkıştır (ekranda küçük görünen
   birimler 512², diğerleri 768² doku; kural `scripts/optimize-assets.mjs` ve `howto.js` içindeki `smallTex`).
2. `exhibit-data.js`e kaydı ekle (salon ve Roma rakamı sırası), gerekiyorsa `WINGS`e yeni salon ekle.
3. İkon yoksa `core/icons.js`e ekle (yalnızca sona ekleme).
4. İsteğe bağlı: `exhibits.js`e prosedürel yedek (`BUILDERS[id]`); yoksa Aegis yedeği kullanılır.
5. `howto.js`teki sabit sayıları (üçgen aralığı, dosya boyutu aralığı) güncelle.
6. Masaüstü (1440) ve mobil (390) test et: model önden bakıyor mu, kaideden taşıyor mu (gerekirse `height`/`yaw`).

## Müze

- **Gezinme**: salon sekmeleri (her salon son bakılan eserini hatırlar), eser slotları, sahnedeki ‹ › okları,
  klavye. Son bakılan eser `localStorage` (`csk:gl:eser`) ile hatırlanır. Salon değişince sahnede kısa bir
  "Salon II · Arena" perdesi iner ve arka plandaki sancaklar salona göre değişir (Efsaneler: pati, Arena:
  Radiant/Dire dönüşümlü, Dokuzun Laneti: IX mührü).
- **Klavye**: `←` `→` eser değiştirir (odak müzedeyken ya da hiçbir yerde değilken; slottayken odak da taşınır),
  sahneye odaklıyken `Shift` + `←` `→` döndürür, `+` `−` yakınlaştırır, `F` tam ekran. Salon sekmelerinde ok
  tuşları, Home/End (sekme deseni).
- **Tam ekran**: Fullscreen API varsa sahne gerçek tam ekrana geçer; yoksa (ör. iPhone Safari) sabit konumlu
  "sözde" tam ekran (Esc ile çıkılır). Tam ekranda sitenin tek harfli kısayolları kapatılır (`ctx.hotkeys(false)`),
  altta ad + beğen + DOG! şeridi görünür.
- **Kamera**: otomatik dönüş; eser değişince kamera en kısa yoldan ön cepheye döner, bakış yüksekliği esere göre
  yumuşakça ayarlanır. Hareketi azalt tercihinde otomatik dönüş, giriş animasyonu ve dönüş yok.
- **Beğeniler**: `gl:<key>` anahtarıyla fan belgesinde; sanat galerisindeki "En çok beğenilen eserler" tablosu
  müze eserlerini de sayar.

### Performans

- `modelpool.js`: müzenin kendi sınırlı GLB havuzu. Bellekte yalnızca **sergilenen eser + iki komşusu** (ve çıkış
  animasyonundaki eser) tutulur; pencereden çıkan modellerin geometri, malzeme, doku ve ImageBitmap’leri serbest
  bırakılır. Komşular eser seçildikten ~350 ms sonra önceden yüklenir, böylece ‹ › anında açılır.
  (`core/models.js` önbelleği hiç boşalmaz; sabit kadro yükleyen Arena için uygundur, müze bu yüzden onu kullanmaz.)
- Uyarlanır kalite kademeleri (piksel oranı, yansıma, gölge çözünürlüğü), yazılım WebGL algılama, sekme gizlenince
  ve sahne ekrandan çıkınca çizim durur.

### Yedekler

- **Prosedürel**: GLB yoksa ya da yüklenemezse her eserin kodla çizilmiş sade bir chibi versiyonu (`exhibits.js`)
  sergilenir; plaket bunu açıkça söyler.
- **2D**: WebGL yoksa sahne yerine eserin portresi/afişi ya da ikonlu bir SVG kartı gösterilir; gezinme aynı.

### Test kancaları

- `?gl-yedek` (ör. `/?gl-yedek#galeri--muze`): görseller ve modeller yokmuş gibi davranır; prosedürel yedekler görülür.
- Geliştirme sunucusunda `.gl-museum[data-pool]` o an bellekteki model anahtarlarını listeler.
