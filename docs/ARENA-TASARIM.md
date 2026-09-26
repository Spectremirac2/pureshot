# 1vDOQUZ Arena — Derinlik Tasarımı (Arena 3.0)

Bu belge Arena’yı “dalga dalga DOG kes” mini oyunundan, Dota’nın mekaniklerini taşıyan, hikâyesi ve kalıcı
karakter gelişimi olan bir aksiyon-RPG arenasına dönüştürme planıdır. Arena 2.0 (kahraman seçimi, creep’ler,
Roshan, kuleler, dükkân, kurye, rünler, minimap) temeldir; bu belge onun üstüne kurulacak katmanları tanımlar.
Oyun tasarımının güncel durumu: [oyunlar/arena.md](oyunlar/arena.md).

## 1. Araştırma özeti

- **Dota’nın savaş modeli** üç hasar türü üzerine kuruludur: fiziksel (zırhla azalır), büyü (büyü direnciyle
  azalır) ve saf (azalmaz). Zırh, fiziksel hasarı bir çarpanla değiştirir; her zırh puanı etkin canı yaklaşık
  %6 artırır. Kaynak: [Liquipedia — Damage Types](https://liquipedia.net/dota2/Damage_Types),
  [Liquipedia — Armor](https://liquipedia.net/dota2/Armor)
- **Eşya tarifleri**: gelişmiş eşyalar iki ya da daha fazla temel bileşenden (bazen bir tarif parşömeniyle)
  birleşir; dükkân bir eşyanın hem altını (bileşenlerini) hem üstünü (girdiği eşyaları) gösterir.
  **Orman (neutral) eşyaları** ayrı bir ödül hattıdır. Kaynak: [Liquipedia — Item Recipes](https://liquipedia.net/dota2/Recipe),
  [Liquipedia — Neutral Items](https://liquipedia.net/dota2/Neutral_Items)
- **Yetenek ağacı**: bir kahraman yapısı yetenek sırası + eşya yapısı + yetenek ağacı (talent) seçimlerinden
  oluşur; seçimler oynanışı yönlendirir. Kaynak: [Talents and Builds in Dota 2](https://neznakov.ru/guides-talanty-i-bildy-en)
- **Roguelite kalıcı ilerleme**: en iyi sistemler oyuncuya ham güç yerine **yeni seçeneklerin kilidini açar**;
  zorluk, oyuncunun isteğe bağlı açtığı katmanlarla (Hades’in “Heat”i gibi) ölçeklenir. Yükseltmeler zorluğu
  “çözerse” deneyimli oyuncular ilgisini kaybeder. Kaynak: [Bullet Haven — best progression systems](https://bullethaven.com/blog/BlogPost12_RoguelikesWiththeBestProgressionSystems2026),
  [GameRant — roguelites with the best progression](https://gamerant.com/roguelite-games-with-best-progression-systems/)

## 2. Vizyon ve ilkeler

**“Dokuzun Laneti”** — Nehrin iki yakasında bitmeyen bir maç sürüyor. Ward alınmayan her gece, unutulan her
Aegis’te bir oyuncunun ruhu DOG’a dönüşüyor. Sen dokuza karşı tek başınasın: 1vDOQUZ.

1. **Dota’yı hissettir**: hasar türleri, zırh/direnç, yetenek seviyeleri, 10/15/20/25 yetenek ağacı, tarifli
   eşyalar, orman kampları, gece-gündüz, Roshan/Aegis, kurye, rünler, kuleler.
2. **Derin ama erişilebilir**: 390 px telefonda da oynanır; karmaşıklık kademeli açılır (hikâyenin ilk bölümleri
   öğretir).
3. **Sitenin kimliği**: 10 DOG türü (Farm, Feed, Pause, AFK, Kurye, Rapier, Mid, Wardsız, Smurf, Chat), “DOG DOG
   DOG” ve 1vDOQUZ memleri dünyanın parçası. Gerçek kişiler hikâyede karakter değildir; kahramanlar özgün.
4. **Tekrar oynanabilirlik**: kalıcı ilerleme güç değil **seçenek** açar; zorluk isteğe bağlı “Lanet seviyeleri”yle
   artar ve skor çarpanı verir.

## 3. Modlar

| Mod | Açıklama | Skor |
|---|---|---|
| **Hikâye** | 5 bölüm × 3 görev; diyaloglar, farklı görev hedefleri, bölüm bossları | Görev yıldızları (1–3) |
| **Sonsuz** | Mevcut dalga modu (Arena 2.0) + Lanet seviyeleri | Salon skor tablosu (`scores.arena`, değişmez) |
| **Günlük Meydan Okuma** | Günün tohumuyla sabit kahraman + değiştiriciler, herkes aynı koşulda | Yerel günlük rekor |

## 4. Savaş derinliği

- **Özellikler**: Güç (can + can yenilenmesi), Çeviklik (zırh + saldırı hızı), Zekâ (mana + büyü güçlendirme).
  Her kahramanın ana özelliği saldırı hasarına eklenir; seviye başına özellik artışı.
- **Hasar hattı** (tek giriş noktası `dealDamage`): tür (fiziksel/büyü/saf) → kaçınma (yalnız saldırılar) →
  kritik → zırh çarpanı `1 - 0.06·zırh / (1 + 0.06·|zırh|)` ya da büyü direnci (taban %25) → hasar bloğu →
  kalkanlar → can çalma / büyü can çalma.
- **Durum etkileri**: sersemletme, yavaşlatma, kök, susturma, korku, dönüştürme (hex); **statü direnci**
  süreleri kısaltır; BKB benzeri eşya büyü bağışıklığı verir, “dispel” olumsuz etkileri temizler.
- **Yetenek seviyeleri**: her seviyede 1 yetenek puanı; Q W E 1–4, R (ulti) 6/12/18’de 1–3. Dota’daki gibi
  “yetenek sırası” bir tercih olur.
- **Yetenek ağacı**: seviye 10/15/20/25’te iki seçenekten biri (kahramana özgü).
- **Eşyalar**: temel bileşenler (≈10) → tarifli eşyalar (≈14); dükkânda ağaç görünümü (altı/üstü), 6 slot,
  aktifler 1–6 tuşları. **Orman eşyaları**: orman kamplarından düşen, bölüm kademeli pasif/aktif ödüller.
- **Ekonomi**: güvenilir/güvenilmez altın, son vuruş bonusu, **deny** (kendi creep’ini son vurunca rakibe
  altın yok), ödül rünü, seri ödülü; ölünce güvenilmez altının bir kısmı düşer; **geri alma (buyback)**.
- **Harita**: nehir, Radiant/Dire kuleleri, Roshan çukuru, **orman kampları** (kurt sürüsü, harpi yuvası) —
  dalgalar arasında “farm” fırsatı; **gece-gündüz** (gece görüş kısalır, Wardsız DOG’lar güçlenir).

## 5. Kalıcı karakter gelişimi (meta)

- **Kahraman ustalığı**: her kahramanın kalıcı XP’si ve rütbesi (Herald → Immortal, sitedeki rütbe dili).
  Ustalık kademeleri **seçenek** açar: alternatif yetenek varyantları (“Aghanim yükseltmesi”), başlangıç eşyası
  seçenekleri, kozmetik aura/iz. Ham istatistik artışı sınırlı ve küçük tutulur.
- **Aghanim Kütüphanesi**: hesap geneli kilit ağacı; para birimi **Parıltı Taşı** (görev yıldızları, boss,
  günlük meydan okuma, ilk kez yapılan başarılar). Açılanlar: yeni kahramanlar, yeni eşya havuzları, orman
  eşyası kademeleri, Lanet seviyeleri, günlük mod değiştiricileri.
- **Lanet seviyeleri (1–10)**: isteğe bağlı zorluk katmanları (DOG’lar daha hızlı, kurye yok, hep gece,
  Roshan erken, dükkân pahalı…) → skor çarpanı ve Parıltı bonusu.
- **Kodeks**: karşılaşılan birimler, eşyalar, bosslar ve hikâye kartları (koleksiyon hissi).

## 6. Hikâye — “Dokuzun Laneti”

Anlatıcı: **Kurye** (kanatlı eşek; “ölen kurye” memesinin kendisi). Diyaloglar kısa, atlanabilir kartlar;
kahraman, Kurye ve bosslar portreyle konuşur.

| Bölüm | Mekân | Görevler (örnek hedefler) | Boss |
|---|---|---|---|
| I · Nehir Kıyısı | Nehir, ilk DOG’lar | Kuryeyi koru · 3 dalga hayatta kal · Rün topla | **Feed Alfa** (dev Feed Köpeği) |
| II · Wardsız Orman | Gece, orman kampları | Orman kamplarını temizle · Wardsız DOG avı · Karanlıkta hayatta kal | **Gölge Ulusu** (Wardsız DOG’ların lideri) |
| III · Kule Kuşatması | Radiant kuleleri | Kuleyi savun · Dire dalgalarını durdur · Rapier’i geri al | **Dire Generali** |
| IV · Roshan’ın İni | Roshan çukuru | Aegis’i kazan · Chat DOG’larını sustur · Kaya Canavarı’nı yen | **Kaya Canavarı** (Roshan benzeri) |
| V · 1vDOQUZ | Sonsuz Pub’ın kalbi | Dokuz DOG lordu · Son kule · Kalbi kır | **Sonsuz Pub’ın Kalbi** (Dire ancient benzeri çekirdek) |

Uygulama (faz D): 15 görevin ayrıntısı, diyaloglar, yıldız kuralları, simülasyon sonuçları →
[oyunlar/arena-hikaye.md](oyunlar/arena-hikaye.md). Bölüm ödülleri: II → Ağaç Bekçisi, IV → Şimşek Ruhu.

Kapanış: lanet kırılınca DOG’lar yeniden takım arkadaşına dönüşür — sitenin sözü: *“Kahramanlar masumdur,
DOG’luk oyuncudadır.”* Son sahnede Kurye: *“Yirmi dört saat oldu. Isınma turu bitti.”*

## 7. İçerik

- **Kahramanlar**: Okçu, Balta, Buz Cadısı, Gölge (Arena 2.0) + kilitli iki yeni kahraman: **Şimşek Ruhu**
  (hareketli büyücü) ve **Ağaç Bekçisi** (dayanıklı destek) — Kütüphane’den açılır.
- **Birimler**: 10 DOG türü, Dire piyade/büyücü creep’leri, orman: **Orman Kurdu**, **Harpi**; bosslar:
  Feed Alfa (DOG modeli ölçekli), Gölge Ulusu (DOG modeli, gölge malzeme), **Dire Generali**, Kaya Canavarı,
  **Sonsuz Pub’ın Kalbi**.
- **Yeni 3D modeller (fal.ai)**: `model-neutral-wolf`, `model-neutral-harpy`, `model-boss-general`,
  `model-boss-ancient`, `model-hero-storm`, `model-hero-treant` (aynı chibi stil, okçu referanslı).

## 8. Teknik mimari ve sözleşme

Arena 2.0’ın veri odaklı modülleri üzerine:

| Modül | Sorumluluk |
|---|---|
| `combat.js` | `dealDamage`, zırh/direnç/kaçınma/kritik/can çalma, durum etkileri, statü direnci |
| `heroes.js`, `abilities.js` | kahraman verisi, yetenek seviyeleri, yetenek ağacı |
| `items.js` | bileşenler, tarifler, orman eşyaları, dükkân ağacı |
| `units.js` | DOG’lar, creep’ler, orman kampları, bosslar |
| `progression.js` | kalıcı ilerleme: ustalık, Kütüphane, Parıltı, Lanet seviyeleri |
| `story.js` + `story/*.js` | bölüm/görev verisi, diyaloglar, görev hedefleri |

**Koşu yapılandırması** (`createGame(emit, runConfig)`):
`{ mode: 'endless'|'story'|'daily', heroId, seed, curse: 0..10, meta: { startItems, mastery, variants }, mission: { waves, objectives, boss, dialogue } | null }`.

**Olaylar**: `runStart`, `waveStart`, `waveEnd`, `unitKilled {type, by, lastHit}`, `bossKilled`, `itemBought`,
`levelUp`, `objective {id, done}`, `runEnd {mode, score, wave, heroId, stats, stars}`.

**İlerleme API’si** (`progression.js`): `applyMeta(runConfig) → runConfig`, `grantRunRewards(result) → rewards`,
`getProfile()`, `mountLibrary(el, ctx) → cleanup`, `mountHeroMastery(el, heroId) → cleanup`.
**Hikâye API’si** (`story.js`): `CHAPTERS`, `missionConfig(id) → runConfig.mission`, `mountCampaign(el, ctx) → cleanup`,
`storyProgress()`.

**Kayıt**: `localStorage` sürümlü anahtarlar (`csk:arena:*`, `csk:arena:meta:v1`, `csk:arena:story:v1`).
Salon skor tablosu yalnızca Sonsuz modun puanıdır (`scores.arena`), anlamı değişmez.

## 9. Faz planı

| Faz | Kapsam | Sahip |
|---|---|---|
| A | Arena 2.0 temeli (kahraman seçimi, creep, Roshan, kule, dükkân, kurye, rün, minimap) | Arena ajanı (sürüyor) |
| E | Yeni 3D modeller (6 adet) | Entegrasyon (fal.ai) |
| B | Savaş derinliği: özellikler, hasar hattı, durum etkileri, yetenek seviyeleri, 10/15/20/25 ağaç, tarifli eşyalar, orman kampları ve eşyaları, gece-gündüz, deny/buyback, yeni iki kahramanın kitleri | Savaş ajanı |
| C | Kalıcı ilerleme: ustalık, Kütüphane, Parıltı, Lanet seviyeleri, kodeks | İlerleme ajanı (D ile paralel) |
| D | Hikâye: 5 bölüm, 15 görev, diyaloglar, bosslar, mod menüsü (Hikâye/Sonsuz/Günlük/Kütüphane) | ✅ Tamamlandı — [oyunlar/arena-hikaye.md](oyunlar/arena-hikaye.md) |
| F | Denge, oynanış testi, performans, belgeler | ✅ Tamamlandı — 10 hata düzeltildi (mobil +N/portre, dükkân orman yuvası, diyalogda duraklatma, sızan pencere, kilitli görev, yatay telefon ve dar pencere HUD’u …), test notları: [oyunlar/arena.md](oyunlar/arena.md#test-notları-faz-f) |
