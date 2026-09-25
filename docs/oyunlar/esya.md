# Eşya 2048 (`esya`)

**Rota:** `#oyunlar--esya` · **Bölüm:** Mini Oyunlar · **Tür:** Zihin · Birleştir (`cat: 'zihin'`) · **Birim:** puan (yüksek iyi)
**Dosyalar:** `src/sections/games/esya.js`, `src/sections/games/esya.css`, `src/assets/items/*.webp` (üretilmiş),
`scripts/fetch-item-icons.mjs`; yardımcılar: `itemIconUrl()` (`src/core/assets.js`), ikonlar `rapier`, `undo`
(`src/core/icons.js`); kayıt: `games.js` (iskeletle birlikte zaten kayıtlı)

## Fikir

Klasik 2048 bulmacası, sayılar yerine Dota eşyalarıyla. Aynı iki eşya çarpışınca zincirde bir üst eşyaya
dönüşür; hedef **Divine Rapier** (değeri tam 2048, oyunun adı da buradan). Dota’nın kendi etkinliklerindeki
mini oyunlar (bkz. [ANALIZ.md](../ANALIZ.md) 2. tur §4) Dota oyuncularının bu türleri sevdiğini gösteriyor.

**Zincir tamamen oyunluk bir fantezidir, gerçek tarifler değildir** — kurallarda ve yan panelde açıkça
yazılır (“Dota’da iki Branch’ten Magic Stick çıkmaz, keşke çıksa”). Sıra kabaca eşyaların altın değerini izler.

| Kademe | Eşya | Değer | Renk | Satır |
|---|---|---|---|---|
| 1 | Iron Branch | 2 | kahve `#a67c52` | Her şey bir dalla başlar. |
| 2 | Tango | 4 | yeşil `#4fb85a` | Koridorda ağaç kalmadı. |
| 3 | Magic Stick | 8 | camgöbeği `#37c3b2` | Şarjlar birikiyor. |
| 4 | Magic Wand | 16 | mor `#a07cff` | Can da mana da cepte. |
| 5 | Boots of Speed | 32 | turuncu `#d98b4a` | Artık yürümüyorsun, koşuyorsun. |
| 6 | Blink Dagger | 64 | buz `#7fe3ff` | Işınlan, dal, çık. |
| 7 | Black King Bar | 128 | altın `#e9b949` | Büyü işlemez. DOG işler mi, bilinmez. |
| 8 | Aghanim’s Scepter | 256 | lacivert `#4f6bff` | Ultimate’ın yükseldi. |
| 9 | Radiance | 512 | kor `#ff7a2b` | Orman yanıyor, farm akıyor. |
| 10 | Butterfly | 1024 | limon `#b7f25a` | Kaçınma yüksek, özgüven daha yüksek. |
| 11 | **Divine Rapier** | 2048 | kızıl `#ff3b5c` | Sakın ölme: düşerse DOG DOG DOG. |
| 12 | Aegis of the Immortal | 4096 | açık altın `#f6d98a` | Ölümsüzlük tek seferlik, puan kalıcı. |
| 13 | Cheese (gizli) | 8192 | sarı `#ffe27a` | Roshan ikinci kez düştü. Efsane. |

Kademe renkleri çember boyunca dağıtıldı: komşu kademeler hiçbir zaman aynı renk ailesinde değil.
7. kademeden itibaren taş parlar, 11–13 hafifçe nabız atar.

## Kurallar ve puan

- 4×4 tahta. Kaydırınca bütün eşyalar o yöne kayar; aynı iki eşya **bir hamlede bir kez** birleşir
  (klasik 2048: `[2,2,2,2] → [4,4]`).
- Her geçerli hamleden sonra boş bir hücreye yeni eşya düşer: **%90 Iron Branch, %10 Tango**.
- **Puan = birleşen eşyanın değeri** (iki Blink → BKB: +128). Oyun başında iki eşya vardır.
- **Divine Rapier** ilk kez oluşunca kazanç kartı açılır: konfeti, “DIVINE RAPIER” damgası; iki seçenek:
  **Aegis’e devam** (oyun sürer, hedef 4096) ya da **Burada bitir** (puan kaydedilir). Aegis’e ulaşınca damga
  ve konfeti; oyun sürer. İki Aegis → gizli Cheese.
- **Geri al:** oyun başına 1 kez, son hamleyi (puanıyla birlikte) geri alır. Üst üste iki kez alınamaz.
- **Oyun sonu:** hamle kalmayınca. Geri al hakkı duruyorsa oyun hemen bitmez: “Hamle kalmadı! Son hamleyi geri
  al (U) ya da Bitir’e bas.” (düğme parlar). **Bitir** düğmesi her an puanı kaydedip oyunu kapatır (onay ister).
- Skor, oyun bittiğinde `submitResult` ile hemen kaydedilir. Başlangıç kartında kayıtlı oyun varken “Yeni oyun”
  denirse yarım oyunun puanı da kaydedilir (rekorsa tabloya girer).
- Rozetler için ulaşılan en yüksek kademe (≥ 7) profilde `picks['esya:tier']` olarak tutulur.

**Sonuç kartı:** en iyi eşya (ikon + ad + satır), Hamle, Birleştirme, En büyük birleştirme, Süre (sekme
görünürken ve son hamleden bu yana 30 sn geçmemişken sayılır; kit `createRunner`), Geri al (kullanıldı mı),
Kademe (x/12 ya da “Cheese!”). Söz en iyi eşyaya göre değişir.

## Denetimler

- **Klavye:** ← ↑ → ↓ ve **W A S D** (fiziksel tuş, `e.code`; sonra `e.key`), **U** geri al. Basılı tutma yok
  sayılır; Ctrl/Alt/Meta, yazı alanları ve açık modal hariç. Geçersiz yön tahtayı o yöne hafifçe sarsar.
- **Dokunmatik / fare:** tahtanın üzerinde kaydır ya da sürükle (Pointer Events). Eşik 26 px, baskın eksen
  1,2 kat; her harekette tek hamle. Tahtada `touch-action: none` + `touchmove` `preventDefault` (passive: false):
  **yalnızca tahtanın içinde** sayfa kaymaz; tahtanın dışı normal kaydırılır.
- **Site kısayolları:** oynarken `ctx.hotkeys(false)` (W, D, E… sitenin kısayolları); oyun bitince 1 sn aradan
  sonra, çıkışta her durumda geri açılır.

## Kalıcılık

Tahta her hamlede `csk:esya:game` anahtarına yazılır (`{ v, cells: [16 kademe], score, moves, merges, best, undo,
prev, won, cont, time, big }`; `prev` geri al anlık görüntüsü). Sayfa yenilenince başlangıç kartı **“Devam et”**
gösterir (kayıtlı puan, hamle ve en iyi eşya kartıyla) ya da “Yeni oyun”. Oyun bitince kayıt silinir. Oyundan
çıkarken (salon, başka bölüm) kayıt güncellenir. Bozuk/eski kayıt yok sayılır.

## Görseller ve varlıklar

- **Eşya ikonları:** Valve’ın resmi Dota 2 CDN’inden (`cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/`)
  derleme öncesi indirilir; kaynak 88×64 PNG, lanczos ile **128×93 WebP** (her biri ~1,2–3,9 KB, toplam 25 dosya
  ~104 KB; 12’si Eşya 2048, gerisi 24 Saat Maraton). Görseller **Valve Corporation’a aittir**; site resmi olmayan,
  ticari olmayan bir hayran projesidir. Çalışma anında dış istek yoktur. Yeniden üretmek için:
  `NODE_USE_ENV_PROXY=1 node scripts/fetch-item-icons.mjs [--force]`
- `itemIconUrl(key)` glob’u `?url&no-inline` kullanır: ikonlar hem statik hem Artifact derlemesinde **ayrı dosya**
  kalır, JS’e gömülmez ve yalnızca görüntülendiğinde iner.
- İkon yoksa taş, kademe renginde kısa ad harfleriyle çizilen yedeğe geçer; oyun varlıksız da çalışır.

## Tasarım notları

- Taşlar mutlak konumlu, `transform: translate(x · (100% + boşluk))` ile kayar (120 ms). Birleşmede iki kaynak taş
  hedefe kayar, yeni taş kayma bitince “pop” animasyonuyla belirir; 7+ kademede halka dalgası. Yeni düşen taş
  küçükten büyür. Hızlı basışlarda önceki animasyonun artıkları temizlenir, yeni hedefe yumuşakça yönelir.
- **prefers-reduced-motion:** kayma süresi 0, belirme/pop/halka/nabız/sarsma animasyonları kapalı; uçan yazı ve
  konfeti zaten kapalı (fx). Geri bildirim mesaj satırı, HUD ve zincir paneliyle verilir.
- Taşın üzerinde ikon + köşede değer; tahta ≥ 400 px genişse (container query) kısa ad da yazılır (masaüstü).
- Yan panel “Zincir”: 12 kademe, kazanılanlar renkli, en iyisi vurgulu, sıradaki kesikli çerçeveli; mobilde
  6×2 ikon ızgarası. Yeni eşya çıkınca ilgili satır yanıp söner, mesaj satırı eşyanın esprisini yazar.
- HUD: Puan (birleştirmede büyür, +puan uçar), Rekor, En iyi eşya (mini ikon), Hamle.
- Erişilebilirlik: tahta `role="application"` + güncel etiket (en iyi eşya, puan); `aria-live` ile yeni eşya,
  geri al ve oyun sonu okunur.

## Test notları

Playwright (masaüstü 1440×900, mobil 390×844 `isMobile` + `hasTouch`), dev sunucusu, HMR engelli:
- Klavye (oklar + WASD karışık) ve mobilde CDP dokunmatik kaydırmalarla 100–300 hamle, oyun sonuna kadar.
  Her hamlede tahtadaki toplam değerin tam olarak 2 ya da 4 arttığı (yalnızca yeni düşen eşya) doğrulandı;
  HUD puanı = oyun durumu.
- 8 art arda kaydırmada sayfa kaydırması 0 px (yalnızca tahtanın içinde engellenir).
- 40. hamlede sayfa yenileme → “Devam et”, tahta/puan/hamle aynen geri geldi; geri al tek hamle geri gitti,
  düğme devre dışı, ikinci geri al yok sayıldı.
- Geliştirme kancasıyla (`window.__esya`, yalnızca `import.meta.env.DEV`; üretim derlemesinde yok — `dist`’te
  aranarak doğrulandı) Rapier’e bir birleştirme kala tahta → kazanç kartı → “Aegis’e devam” → Aegis → hamlesiz
  tahta → sonuç kartı, `csk:me.scores.esya` = puan, `csk:esya:game` silindi.
- Kenar durumlar: hamlesiz kayıtlı tahtayı sürdürmek sonucu gösterir; hamle kalmayıp geri al hakkı varken oyun
  sürer, geri al oynanabilir tahtaya döner; Rapier + hamlesiz tahtada “Aegis’e devam” sonucu açar.
- Oyun içinde Q gezinmez; bitişten sonra Q → Espri Duvarı. Oyundan salon düğmesiyle çıkınca kanca silinir,
  kısayollar açılır, tahta kaydedilir. Hareket azaltma açıkken aynı akış hatasız.
- Konsol hatası 0, yatay taşma yok, `VITE_API_BASE=none vite build` başarılı.

## Önerilen rozetler

Kategori: **Zihin** (`meta.cat = 'zihin'`). `core/badges.js` için öneri:

| Rozet | Koşul | Not |
|---|---|---|
| BKB Bastın | `scores.esya ≥ 2500` | ≈ BKB/Aghanim kademesi; basit köşe stratejisiyle ulaşılır |
| Divine Rapier | `picks['esya:tier'] ≥ 11` (ya da `scores.esya ≥ 20000`) | Rapier = 2048; klasik 2048’de bu kareye ~20 bin puanla varılır |
