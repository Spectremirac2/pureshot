# 1vDOQUZ Arena 3.0 (`arena`)

**Rota:** `#oyunlar--arena` (kısayol **R**) · **Tür:** Ultimate · 3D · mini Dota · **Skor:** puan (yüksek iyi, tek skor tablosu `scores.arena`, yalnızca Sonsuz mod yazar)
**Dosyalar:** `src/sections/games/arena/` (ayrıntı: [Mimari](#mimari--genişletme-noktaları)). Salon, arenayı ilk açılışta tembel yükler.
**İlgili:** kalıcı ilerleme (Aghanım Kütüphanesi, ustalık, varyantlar, lanetler) → [../ARENA-ILERLEME.md](../ARENA-ILERLEME.md) ·
hikâye modu, mod merkezi ve günlük meydan okuma → [arena-hikaye.md](arena-hikaye.md).

## Fikir
Radiant tarafında tek başınasın. Nehrin ikiye böldüğü küçük bir Dota savaş alanında dokuz DOG, Dire creep’leri,
Dire kuleleri, orman kampları, gece ve her 5. dalgada bir boss üstüne gelir. Altı kahramandan birini seç; **Güç /
Çeviklik / Zekâ** ile büyü, seviye başına **yetenek puanı** harca (Q W E 4 seviye, R 6/12/18), 10/15/20/25’te
**yetenek ağacından** seç, bileşenlerden **tarif eşyaları** birleştir, kamplardan **orman eşyası** düşür, geceyi
ward’la, ölünce **geri al** (buyback). Dokuz DOG’u indirmek bir dalgayı temizler: **1vDOQUZ**.

Kahramanlar Dota arketiplerinden esinlenen özgün karakterlerdir; arayüzde yalnızca Türkçe lakaplarıyla anılırlar.

## Modlar (faz D)
Arena açılınca **mod merkezi** gelir: **Hikâye** (Dokuzun Laneti: 5 bölüm × 3 görev, diyaloglar, yıldızlar),
**Sonsuz** (bu belgenin anlattığı dalga modu; Lanet seçici; salon skoru yalnızca buradan), **Günlük** (İstanbul
gününün tohumuyla herkes için aynı kahraman + Lanet + değiştiriciler; yerel günlük rekor), **Kütüphane** ve
**Kodeks** (kalıcı ilerleme ekranları, pencerede). Kahraman seçiminde “Ustalık” düğmesi, kilitli kahramanlarda bedel
ve “Kütüphane’de aç”. Her koşudan sonra Parıltı/ustalık ödül kartı. Ayrıntı: [arena-hikaye.md](arena-hikaye.md).

## Kahramanlar
Seçim ekranında sahne döner tabladır. Kart: ad, rol, zorluk, en iyi skor, özellik satırı (1. seviye + seviye başı
artış, ana özellik vurgulu), dört yetenek (ipucunda seviye tablosu), Aghanım metni, yetenek ağacı özeti.
**Şimşek Ruhu** ve **Ağaç Bekçisi** `locked: true`: Kütüphane’den açılır (kilitliyken incelenir, “Kilitli” düğmesi);
geliştirmede `devUnlock` düğmesi ve `__arenaDebug.unlock()` açar.

| Kahraman | Ana | Güç | Çev. | Zekâ | 1. sv can / mana / zırh | Hız | Saldırı |
|---|---|---|---|---|---|---|---|
| **Okçu** (`okcu`, model-archer) | Çev. | 18 +1,8 | 24 +2,8 | 17 +1,3 | 640 / 300 / 0,4 | 5,3 | Yok: Q (CureShot) onun saldırısı; ok hasarı + saldırı gücü |
| **Balta** (`balta`, model-hero-brute) | Güç | 25 +3,4 | 16 +1,6 | 16 +1,2 | 940 / 240 / 3,1 | 5,05 | Yakın 46, 1,55 menzil, BAT 1,1 |
| **Buz Cadısı** (`buz`, model-hero-frost) | Zekâ | 18 +2 | 16 +1,6 | 25 +3,2 | 630 / 440 / 0,4 | 4,95 | Menzilli 37, 6,2 menzil, BAT 1,16 |
| **Gölge** (`golge`, model-hero-shadow) | Çev. | 20 +2,2 | 24 +3,1 | 16 +1,2 | 700 / 270 / −0,1 · %15 kaçınma | 5,65 | Yakın 39, 1,45 menzil, BAT 0,89 |
| **Şimşek Ruhu** (`simsek`, model-hero-storm ≈1,6 yük.) 🔒 | Zekâ | 18 +2 | 20 +1,8 | 24 +3 | 600 / 400 / 0,5 | 5,2 | Menzilli 40 (kıvılcım), 6 menzil, BAT 1,26 |
| **Ağaç Bekçisi** (`agac`, model-hero-treant ≈1,8 yük.) 🔒 | Güç | 26 +3,6 | 14 +1,4 | 17 +1,6 | 1.000 / 260 / 3,9 | 4,75 | Yakın 55, 1,7 menzil, BAT 1,37 |

### Özellikler (Güç / Çeviklik / Zekâ)
`attrAt(H, k, L) = taban + artış × (L − 1)` + eşya/yetenek ağacı/Özellik Bonusu. `ATTR` (heroes.js):

| Özellik | Etki |
|---|---|
| Güç | +20 can, +0,1 can/sn |
| Çeviklik | +0,1 zırh (10 çeviklik = 1 zırh), +0,75 saldırı hızı |
| Zekâ | +12 mana, +0,05 mana/sn, +%0,2 büyü güçlendirme |
| Ana özellik | her puan +1 saldırı hasarı |

- Can = `taban + Güç×20 + eşya` (× `modifiers.heroHp`), Mana = `taban + Zekâ×12 + eşya`.
- Saldırı aralığı = `BAT / (1 + saldırı hızı / 100)` (en az 0,25 sn); saldırı hızı = `Çev×0,75 + eşya`.
- Büyü direnci: kahraman tabanı %25; kaynaklar çarpımsal (`1 − 0,75 × Π(1 − x)`). Kaçınma, kritik şansı,
  statü direnci de çarpımsal; kritik çarpanı ve blok şansı en yüksek olan geçerli.
- HUD’da portrenin yanında G/Ç/Z sayıları (ana özellik altın); **C** ya da portreye dokunmak kahraman sayfasını açar
  (tüm statlar: saldırı hasarı, zırh (azaltma %), kaçınma, büyü direnci/güçlendirme, statü direnci, kritik, can
  çalma, blok, hız, yenilenme, güvenilir/güvenilmez altın, geri alma bedeli).

### Yetenekler ve seviyeleri
Her seviyede **1 yetenek puanı**. Q W E en çok 4 (seviye sınırı `⌊(L+1)/2⌋`: 1/3/5/7), R en çok 3 (6/12/18. seviye).
Q 1. seviyede öğrenilmiş başlar. Puanlar istenirse **Özellik Bonusu**na da harcanır (+2 tüm özellik, 10 kez; otomatik
öğrenme önce yetenekleri doldurur) — 25. seviyedeki 24 puanın hepsi bir yere gider, harcanamayan puan kalınca rozet gizlenir.
Öğrenme: slotların üstündeki **+** (masaüstü), portredeki **+N** rozeti → öğrenme kipi (**L**; sonra Q/␣/E/R ya da
dokun), **Ctrl+Q/W/E/R**, kahraman sayfasındaki **+** düğmeleri. Ayarlardan “otomatik öğren” de açılabilir.
Öğrenilmemiş yetenek kilitli görünür; slotun altındaki noktalar seviyeyi gösterir.

| | Q | W | E | R |
|---|---|---|---|---|
| **Okçu** | **CureShot** (şarj): taban 26/34/42/50 + şarj 86/106/128/150, şarj 1,2→1,05 sn, delip geçer | **Rüzgâr Koşusu**: 2,5/3/3,5/4 sn hız + %80 kaçınma, 14→11 sn | **Tango**: 2/3/3/4 şarj, 110/150/190/230 can (6 sn) | **DOG DOG DOG**: 160/260/360 büyü, 8/8,5/9 yarıçap, korku 2/2,4/2,8 sn, 34/30/26 sn |
| **Balta** | **Savaş Çağrısı**: 3,2→3,8 yarıçap çek + kilit 1,8→2,7 sn, +8→14 zırh | **Helezon**: 70/100/130/160 saf; pasif %17→26 vurulunca döner | **Savaş Açlığı** (hedef): 18/26/34/42 dps 8 sn, %20→35 yavaş, ölürse sıçrar | **Kesin Hüküm** (hedef): eşik 220/360/500 (+seviye) altını infaz, bekleme sıfırlanır; üstüne 150/225/300 büyü |
| **Buz Cadısı** | **Buz Novası** (nokta): 100/150/200/250, 2,4→3 yarıçap, %30→45 yavaş 3 sn | **Buz Zinciri** (hedef): 1,6→2,8 sn kök + 30→60 dps | **Mana Aurası**: pasif +2→5 mana/sn; aktif 3 sn hızlı mana/can | **Donduran Alan** (kanal 4,2 sn): 50/80/110 patlamalar |
| **Gölge** | **Gölge Adımı** (hedef): ışınlan + 40/70/100/130 ek vuruş | **Duman Perdesi**: 3→6 sn görünmezlik; ilk vuruş +%50→110 ve 0,4→1 sn sersem | **Kan Kokusu** (pasif): %12→24 kritik ×2→×2,6, %5→11 can çalma | **Ölüm Dansı**: 4/6/8 sıçrama, garanti kritik, dokunulmaz |
| **Şimşek Ruhu** | **Durgun Kalıntı**: yerine kalıntı (0,5 sn’de kurulur, en çok 3), yaklaşan düşmanda 90/140/190/240 büyü patlaması | **Elektrik Girdabı** (nokta): merkeze çek + kök 1→1,9 sn + 40→100 | **Aşırı Yük** (pasif): her büyüden sonra sonraki saldırı alanda 40/65/90/115 büyü + %30→40 yavaş | **Yıldırım Topu** (nokta): uç, yolda dokunulmaz; birim başı 8/12/16 hasar ve 7/6/5 mana (+40 sabit) |
| **Ağaç Bekçisi** | **Doğanın Örtüsü**: 4→7 sn görünmezlik + 10→28 can/sn; ilk vuruş kök 0,8→1,7 sn | **Sömürücü Kökler** (hedef): kök 1,4→2,3 sn, 30→75 dps, hasarın tamamı can | **Canlı Zırh**: +4→10 zırh, 6→18 can/sn, 15→30 blok; yakındaki Radiant kulesine de | **Aşırı Büyüme**: 6/7/8 yarıçapta herkes kök 2,2→3,4 sn + 25/40/55 dps |

Aghanım Asası: Okçu ulti 18 sn + korku +1 sn · Balta infaz menzili +1,5, her infazda Helezon · Buz alan içindekiler
her 1,5 sn 0,6 sn donar · Gölge dans +3 sıçrama, sonunda 2 sn görünmezlik · Şimşek topu her 3 birimde kalıntı
bırakır · Ağaç örtüdeyken her 2,5 sn yakın düşmanı Sömürücü Köklerle bağlar.

### Yetenek ağacı (10 / 15 / 20 / 25)
Seviye 10’da bir kademe açılır (sol / sağ). Portrede **T** rozeti yanar; sayfa açıkken oyun durur (1 / 2 ile seç).

| | 10 | 15 | 20 | 25 |
|---|---|---|---|---|
| Okçu | +%15 ok hasarı · +220 can | Rüzgâr −4 sn · CureShot %30 hızlı şarj | Ulti +3 yarıçap · tam şarjda üçlü ok | +30 çeviklik · Ulti −12 sn |
| Balta | +20 hasar · +250 can | Helezon +60 · Çağrı +1,2 yarıçap | İnfaz eşiği +120 · %45 yarma | +10 zırh · Helezon şansı +%12 |
| Buz Cadısı | +150 mana · +%12 büyü | Zincir +1 sn · Nova −2 sn | Kanalda yürü · alan +%40 | Nova iki kez · Zincir ikinci hedef |
| Gölge | +%8 kritik · +0,5 hız | Adım −2 sn · +%15 kaçınma | Dans +3 hedef · Yıkım (+%20 alınan hasar 4 sn) | +%18 can çalma · Duman −6 sn |
| Şimşek | +%10 büyü · +200 can | Kalıntı +50 · Girdap kökü +0,6 sn | Aşırı Yük +1 alan, %50 fazla yavaş · Top mana −%40 | Girdap +1,5 yarıçap · Kalıntı −1,5 sn |
| Ağaç | +300 can · +%15 statü direnci | Kökler +1 sn · Örtü hızı +%20 | Canlı Zırh +6 · Büyüme +2 yarıçap | Büyüme hasarı ×2 · +30 güç |

### Yetenek varyantları (Kütüphane, 18 adet)
`runConfig.meta.variants = { <yetenek kimliği>: <varyant kimliği> }` → `g.variant(abilityId)`. Hepsi yan seçenek
(ham güç değil, oynanış değişir); seviye tabloları aynı kalır. HUD, sayfa ve ipuçları varyant adını/açıklamasını
gösterir (`abilityDisplay`, `targetingOf`), slotta mor elmas işareti, sayfada **VARYANT** etiketi.

| Yetenek | Varyant | Değişim |
|---|---|---|
| okcu_shot | `okcu_volley` Yaylım Ateşi | Şarj yok: dokununca 3 okluk yelpaze, ok başı %45, delmez, 0,5 sn bekleme |
| okcu_windrun | `okcu_gale` Kasırga Adımı | Kaçınma yok; başta 3 birimi iter + 1 sn yavaş; süre −0,5 |
| okcu_dog | `okcu_rain` Ok Yağmuru | Nokta hedefli 3 sn ok yağmuru (toplam %140), korku/sersem yok; Aghanım +1 sn |
| balta_call | `balta_roar` Meydan Okuma | Yarıçap ×0,7, zırh ×1,5, süre +1 sn |
| balta_helix | `balta_blood` Kanlı Helezon | Pasif dönme yok; aktif iki tur + isabet başı can |
| balta_cull | `balta_mass` Toplu Hüküm | Hedefsiz: 2,5 yarıçapta eşik ×0,75 altındaki herkesi infaz; bekleme sıfırlanmaz |
| buz_nova | `buz_shards` Buz Kıymıkları | Yavaşlatma yok; en yakına %160, çevredeki 4 düşmana %40 |
| buz_aura | `buz_ward` Kış Kalkanı | Pasif mana yok; aktif 4 sn mananın %60’ı kadar kalkan |
| buz_blizzard | `buz_blizzard` Gezgin Tipi | Kanal yok: 6 sn seni izleyen fırtına, yarıçap ×0,65 |
| golge_step | `golge_mark` Av İşareti | Işınlanma yok; hedef 4 sn +%25 hasar alır; menzil ½, bekleme −2 |
| golge_smoke | `golge_decoy` Gölge İkizi | 4 sn yem ikiz: DOG’lar ona saldırır (taunt-konum); ilk vuruş bonusu yok |
| golge_dance | `golge_eclipse` Tutulma | Yerinde 3 sn, 3,2 yarıçapta saniyede 3 kritik; köklü, dokunulmaz değil |
| simsek_remnant | `simsek_drift` Gezgin Kalıntı | Tek kalıntı, en yakın düşmana süzülür, hasar +%40 |
| simsek_vortex | `simsek_pulse` Girdap Darbesi | Çekme/kök yok: dışa iter + 1,5 sn yavaş |
| simsek_ball | `simsek_short` Kısa Devre | En çok 5 birim, sabit mana, varışta Aşırı Yük hazır |
| agac_guise | `agac_bloom` Çiçek Açan Örtü | Görünmezlik yok: 5 sn %30 yavaşlatan çiçek alanı, iyileşme ×2 |
| agac_leech | `agac_thorns` Dikenli Kökler | Can emme yok; hedef + 2 birim çevresi köklenir, hasar −%30 |
| agac_growth | `agac_grove` Kutsal Koru | Kök yok: 6 sn alan, içinde %3/sn can, düşmanlara %40 yavaş |

## Savaş sistemi (`combat.js`)
**Tek hasar girişi:** `dealDamage(g, source, target, amount, type, opts)` → verilen hasar. Türler `DMG.PHYS`
(`'physical'`), `DMG.MAG` (`'magical'`), `DMG.PURE` (`'pure'`). Sıra:

1. `g.hooks.beforeDamage` (dönen sayı yeni miktar; Dokuzun Mührü boss bonusu burada).
2. Vurulabilirlik: kule kuralları (magic binalara işlemez, `opts.structure` hariç); kahraman kendi Radiant kulesini
   can ≤ %12 iken saldırıyla **deny** edebilir.
3. **Büyü bağışıklığı** (kahramanda BKB/dokunulmazlık, düşmanda `spellImmune`): büyü hasarı 0 (`opts.pierce` hariç).
   Saf hasar geçer. Dokunulmazlık (`invuln`) her şeyi keser.
4. **Kaçınma** (yalnızca saldırı + fiziksel; `trueStrike` geçer) → “ISKA/MISS”.
5. **Kritik**: `opts.forceCrit` ya da saldırıda kaynağın kritik şansı (kahraman `g.stat.crit/critMul`, düşman `crit/critMul`).
6. **Zırh / büyü direnci**: fiziksel × `1 − 0,06a / (1 + 0,06|a|)` (10 zırh → ×0,625, −5 → ×1,23); büyü × `1 − MR`.
7. **Güçlendirme** (`amp`/İşaret/Yıkım), sonra **blok** (saldırı + fiziksel, şansla sabit miktar; menzillide yarı).
8. **Kalkanlar**: önce büyü kalkanı (Ruh Başlığı, yalnız büyü), sonra genel kalkan (Kış Kalkanı). “KALKAN”.
9. Yuvarla (en az 1) → `hurtHero` / `hurtFoe` / `hurtTower`.
10. **Can çalma** (saldırı + fiziksel) / **büyü can çalma** (saldırı olmayan; DoT yarım, `dotLs` açıkça verilirse tam).
11. `g.hooks.afterDamage`, `dmgNum` olayı → **yüzen sayılar**: fiziksel kırmızı/turuncu, büyü mavi, saf beyaz;
    kritik büyük ve “!”; kahramana gelen “−N”; ISKA, BAĞIŞIK, BLOK, KALKAN.

**Durumlar** (`applyStatus(g, target, kind, dur, data)`; `target.st` sayaçları): `stun`, `root`, `slow` (k: en güçlü
geçerli), `silence`, `fear` (kaynaktan kaçış), `hex` (dönüşüm: yavaş, yetenek/saldırı yok), `disarm`, `taunt`
(birime ya da x/z konumuna), `dot` (en güçlü tutulur, `dotType`, `dotLs`), `amp`, `shred` (zırh azaltma), `sleep`,
`blind`. **Statü direnci** olumsuz süreleri kısaltır (en çok %80). **Bosslarda `ccCap`**: tek bir kontrolün süresi
sınırlı (Roshan 0,35 sn, Kalp 0,2 sn …). BKB / dokunulmazlık olumsuzları engeller (`data.pierce` hariç).
**Dispel** `dispel(g, target, { strong, negative, positive })`: zayıf dispel yavaş/kök/susturma/dönüşüm/DoT’u, güçlü
dispel sersemletmeyi de siler (BKB, Kasırga Asası güçlü).

## Eşyalar (`items.js`)
Dükkân (**B**, altın düğmesi): **Temel** ve **Gelişmiş** sekmeleri, seçilen eşyada “Şuna dönüşür” ve “Bileşenler”
ağacı (sahip olunanlar ✓, tarif ücreti çipi). Sahip olduğun bileşenler fiyattan düşülür (“Al ve birleştir”); eksik
bileşenler + tarif tek seferde alınır. Bedava tarifler çantada **kendiliğinden birleşir**. Satış **%50** (tarif
toplamının yarısı). 6 yuva; etkin eşyalar **1–6**. Çeşmedeysen anında, değilsen **kurye** getirir (yolda bileşenler
“rezerve”). Fiyatlar `modifiers.shopCost` ile çarpılır (Lanet 3).

**Tüketim / temel:** Tango Paketi 90 · Peri Ateşi 70 · Görüş Tozu 90 (görünmezleri açar) · Gözcü Ward’ı 80 (2 şarj,
90 sn, gece 8 birim görüş) · Bilgi Kitabı 300 (anında XP) · Demir Dal 60 (+2 tümü) · Sihirli Sopa 200 · Koşu Botları
350 · Yenilenme Yüzüğü 250 · Kuvvet Kemeri / Çevik Eşarp / Bilge Cübbesi 400 (+7 özellik) · Hız Eldiveni 450 ·
Zincir Yelek 500 · Büyü Pelerini 500 · Vampir Maskesi 700 · Can Taşı 900 · Mana Küresi 800 · Pala 900 ·
Göz Açıp Kapayana 950.

| Tarif | Bileşenler + tarif | Toplam | Etki |
|---|---|---|---|
| Sihirli Değnek | Sopa + 2 Dal + 150 | 470 | +3 tümü, 18 şarj × 16 can/mana |
| Faz Botları | Botlar + Zincir Yelek (bedava) | 850 | +0,85 hız, +5 zırh; aktif 3 sn %25 hız, birimlerden geç |
| Güç Nalları | Botlar + Eldiven (bedava) | 800 | +0,8 hız, +25 sald. hızı, +8 ana özellik |
| Kaya Kalkanı | Can Taşı + Yüzük + 250 | 1.400 | +250 can, +5 yenilenme, %60 34 blok |
| Ruh Başlığı | Pelerin + Yüzük + Kemer + 300 | 1.450 | +%25 büyü direnci; aktif 400 büyü kalkanı 8 sn |
| Kutsal Tılsım | Yüzük + Yelek + Cübbe + 450 | 1.600 | aktif 260 can + 6 sn +4 zırh, kuleleri onarır |
| Kara Kral Asası | Kemer + Pala + 450 | 1.750 | aktif 5 sn büyü bağışıklığı + güçlü dispel |
| Şimşek Tırpanı | Eldiven + Pala + 350 | 1.700 | %25 şansla 4 hedefe 110 büyü şimşeği |
| Zırh Kıran | Pala + Yelek + 500 | 1.900 | saldırı 6 sn −6 zırh |
| Kasırga Asası | Cübbe + Küre + 400 | 1.600 | aktif 2,2 sn havada: dokunulmaz + dispel |
| Güneş Tacı | Pala + Can Taşı + 500 | 2.300 | 3,2 birimde 42 büyü yanması/sn |
| Kelebek | 2 Eşarp + Pala + 300 | 2.000 | +20 çev., +%30 kaçınma, +25 sald. hızı |
| Aghanım Asası | Kemer + Eşarp + Cübbe + Küre + 300 | 2.300 | +10 tümü, ulti yükseltmesi |
| Tazeleme Küresi | Yüzük + Küre + Cübbe + 550 | 2.000 | aktif tüm beklemeleri sıfırlar |
| Kan Emici | Maske + Kemer + Pala + 400 | 2.400 | %20 can çalma; aktif 5 sn ×3 |
| İlahi Kılıç | 2 Pala + 1.800 | 3.600 | tüm hasar +%80; Aegis’le dirilince düşer, Kurye Köpeği kaçırır |

İkonlar `itemIconUrl` (src/assets/items) varsa oradan, yoksa glif + eşya rengi (`--ic`) ile çizilir.

### Orman eşyaları (tek ayrı yuva)
Kamp temizleyince %50 (ilk kampta kesin) düşer; bosslar (Roshan hariç) kesin bırakır. Kademe dalgaya göre (1–5: 1,
6–10: 2, 11+: 3), kademe başına en çok 3 düşme. Yuva doluysa **orman sandığına** (stash) gider; dükkândan takılır.

| Kademe | Eşyalar |
|---|---|
| 1 | Kurt Dişi Kolye (+8 hasar, %5 can çalma) · Harpi Tüyü (+0,35 hız, +10 sald. hızı) · Ormancı Tılsımı (+2,5 can/sn, +1,5 mana/sn) |
| 2 | Gece Feneri (gece +3,5 görüş, +3 zırh) · Kopuk Zincir (%15 statü direnci, +200 can) · Öfke Kolyesi (%15 ×1,7 kritik) |
| 3 | Titan Pulu (+6 zırh, %15 büyü direnci, +300 can) · Yıldız Kırığı (+%15 büyü, +5 mana/sn, %10 büyü can çalma) · Dokuzun Mührü (+10 tümü, bosslara +%15) |

**Kütüphane havuzları** (`meta.pools`): `neutralChoice: 2|3` → düşen sandık 2–3 seçenek sunar (oyun durmadan kart,
F1–F3 / dokun; 25 sn’de seçilmezse ilki), `neutralReroll: n` → her molada n kez (en çok 3) “Orman takası”
(dükkânda, takılı eşyayı aynı kademeden rastgele değiştirir).

## Düşmanlar
- **10 DOG türü**: Feed, Farm, Pause, AFK, Kurye, Rapier, Mid, Wardsız, Smurf, Chat. Her dalga 9 DOG, 4. dalgadan
  sonra elitler. DOG’lar durumları okur (korkuda kaçar, dönüşümde amaçsız, kökte ısırır ama yürümez, taunt’ta hedefe).
  **Wardsız DOG** gece daha görünmez ve %18 hızlı; ward/Toz/Gece Feneri açığa çıkarır. **Kurye Köpeği** Tango ya da
  altın çalar; kaçmadan indirirsen geri gelir (“GERİ ALINDI”).
- **Dire creep’leri**: Piyade (250 can, 2,5 zırh) ve Büyücü (175 can, %10 MR, menzilli). Dalga başına 1–3 manga.
  Radiant kulesi düşerse creep’ler coşar (+%15 hasar/kule); kendi kuleni son vuruşla yıkarsan (**deny**) coşmazlar ve
  80 XP alırsın.
- **Kuleler**: 2 Radiant (5,5 zırh, görüş verir, nötr ve görünmeyenlere ateş etmez), 2 Dire (7 zırh, kahramana
  kilitlenir). Dire kulesi: 220 güvenilir altın, 150 XP, 500 puan.
- **Orman kampları** (`map.js CAMPS`): **Kurt** (sol alt orman: Alfa + 2 kurt), **Harpi** (Roshan çukuru yanı: 2 harpi),
  **Koru** (sağ orta: Alfa + harpi + kurt). İlk dolum 18. sn, sonra her dakika başı boşsa dolar (üstündeysen
  dolmaz). Uyuyan kamp vurulunca uyanır, 5,2 birimden uzağa kovalamaz (leash) ve dönüp iyileşir. Alfa kurt %20
  ×1,8 kritik, harpi zincir şimşek. Modeller `model-neutral-wolf` (≈0,9) / `model-neutral-harpy` (≈1,1), yoksa prosedürel.
- **Bosslar** (`units.js`; hepsi `g.spawnUnit(id)` ile görevden doğurulabilir). Üstte ad + can çubuğu + evre metni;
  saldırıları yerde **telgraf** (daire / halka / çizgi / koni / işaret) ile önceden gösterilir.

| Boss | Can · zırh · MR | Mekanikler | Ödül |
|---|---|---|---|
| **Roshan** `boss_roshan` | 2.600 · 6,5 · %25 | Yere vuruş (kırmızı daire 3,3), kükreme (sarı 5,4, 1,25 sn sersem); çukurdan uzaklaşınca döner/iyileşir | Aegis + Peynir, 350 altın |
| **Feed Alfa** `boss_feedalfa` | 3.000 · 3 · %15 | Çizgi boyunca dalış (kırmızı şerit, sersem), %66/%33’te yavru Feed’ler, <%50 öfke (hızlanır) | orman eşyası, 380 |
| **Gölge Ulusu** `boss_shadow` | 3.400 · 4 · %30 | Karanlığa karışıp kaybolur (Toz açar), sıçrama (daire), uluma (5,5 korku 1,3 sn); gece güçlü | orman eşyası, 420 |
| **Dire Generali** `boss_general` (model-boss-general ≈2,6) | 4.600 · 6 · %25 | Koni yarma, Savaş Narası (kendine + creep’lere hasar/zırh), creep takviyesi | orman eşyası, 480 |
| **Sonsuz Pub’ın Kalbi** `boss_ancient` (model-boss-ancient ≈3,2, sabit) | 7.000 · 8 · %35 | İç (4,2) / dış (4,2–9,5) nabız halkaları sırayla, DOG doğurur, %70 ve %35’te kalkan: 4 muhafızı indir | orman eşyası, 800 |

Sonsuz modda her 5. dalga bossludur: tek sıradakiler Roshan, çiftler sırayla Feed Alfa → Gölge Ulusu → Dire Generali →
Pub’ın Kalbi. Boss gücü `k` (kaçıncı boss dalgası): can ×`1 + 0,55(k−1)`, hasar ×`1 + 0,28(k−1)`.

## Harita
Nehir sol üstten sağ alta akar, ortada mühür adası. Sol alt Radiant (çeşme, yeşil), sağ üst Dire. Nehirde iki rün
kaidesi, sol üstte Roshan çukuru, üç orman kampı. Çeşme molada %14/sn, dalgada %3,5/sn can/mana.

## Gün / gece
~2 dk gündüz, ~2 dk gece (`DAY_LEN`/`NIGHT_LEN` 120; Lanet 4’te 60/180, Lanet 9 hep gece; dalga `night` ile
zorlanabilir). Üst şeritte güneş/ay + kalan süre; gece sahne mavileşir, meşaleler parlar, kahramanın çevresi dışında
karartma. **Gece görüşü 8,5 birim** (+Gece Feneri); Radiant kuleleri 6, ward’lar 8 birim görür. Görüş dışındaki
düşmanlar çizilmez, mini haritada ve kenar oklarında görünmez, hedeflenemez (son 2 sayılan düşman hep görünür —
dalga kilitlenmesin). Wardsız DOG’lar gece güçlenir.

## Ekonomi
- **Güvenilir altın** (ölünce kaybolmaz): boss, kule, dalga sonu `90 + 15×dalga`, seri ödülü `20 × (seri − 2)`,
  Ödül rünü `55 + 15×dalga`. **Güvenilmez**: DOG/creep son vuruşu `ödül + 2(dalga−1) + 10 + dalga`, nötr `ödül + 5`,
  başkası öldürürse %35, pasif 1,2/sn. Harcama önce güvenilmezden düşer.
- **Ölüm**: güvenilmez altının %40’ı düşer. **Geri alma** (buyback): 6 sn pencere, bedel `150 + 25×seviye + 12×dalga`,
  150 sn bekleme; çeşmede dirilirsin (**Enter**). Aegis önce kullanılır. `modifiers.noBuyback` kapatır.
- **Deny**: yalnızca kendi Radiant kulen (≤ %12 canda son vuruş) — DOG deny yok (tasarım gereği; DOG’lar kahramana ait
  birim değil). Kurye Köpeği ganimetini geri almak da “deny” sayılır.
- Seri duyuruları: KILLING SPREE … BEYOND GODLIKE; çoklu öldürme +50/150/300/500 puan.

## Seviye ve XP
XP L→L+1: `110 + 60 × (L − 1)`, en çok 25. DOG `45 + 5(dalga−1)`, creep 22/26, nötr 30–52, boss 500–1.200, kule 150,
deny 80, Bilgi Kitabı. İyi bir koşu 10. dalgada 15–17, 12. dalgada 18–20. seviyededir; 20+ ancak geç dalgalarda.

## Rünler
Nehirde iki noktadan birinde, ilki 14 sn’de, sonra her 40 sn’de: Hız, Çift Hasar, Yenilenme, Görünmezlik, Ödül.

## Puan (tek skor tablosu, anlamı değişmedi)
DOG 100 · creep 30/40 · nötr 25–45 · boss 1.000–3.000 · Dire kulesi 500 · çoklu öldürme +50/150/300/500 ·
dalga temizleme `300 × dalga` + verim bonusu `verim × 400`. Lanet çarpanı `1 + 0,12 × lanet`. Salon tablosuna
(`scores.arena`) ve kahraman en iyilerine yalnızca **Sonsuz** mod yazar; hikâye/günlük koşular kendi ödülünü alır.

## Kontroller
- **Klavye:** WASD + Boşluk (W yeteneği Boşluk) ya da ok tuşları + QWER · **1–6** eşyalar · **B** dükkân ·
  **C** kahraman sayfası · **T** yetenek ağacı · **L** öğrenme kipi · **Ctrl+Q/W/E/R** (ya da Ctrl+Boşluk) öğren ·
  ölünce **Enter** geri al · orman seçimi **F1–F3** · molada **Enter** “Hazırım” · **Esc/P** duraklat.
- **Dokunmatik:** sol joystick; Q W E R düğmeleri (dokun = en yakın hedef, basılı tut + sürükle = yön); portredeki
  **+N** rozeti öğrenme kipini açar (sonra yetenek düğmesine dokun); portreye dokun = kahraman sayfası; altın düğmesi
  dükkân. Dokunmatik düğmeler 44 px’ten küçük değildir.

## Arayüz (HUD)
Alt ortada Dota paneli: portre + XP halkası + seviye + yetenek puanı rozeti, G/Ç/Z, Q W E R (seviye noktaları,
bekleme, mana, “+”), can/mana, 6 eşya yuvası + orman yuvası, altın. Üstte dalga/DOG/öldürme + gün/gece hücresi
(boss dalgasında sayaç etiketi Roshan için “ROSHAN+”, diğer bosslar için “BOSS+”);
boss varken tepede boss çubuğu (ad, evre, kalkan). Sağda görev hedefleri listesi (varsa). Sol altta mini harita
(kamplar dolu/boş, ward, orman eşyası, boss rengi, gece karartması). Buyback kartı, orman seçimi kartı, kahraman sayfası.
390 px’te panel sıkışır (G/Ç/Z tek satır, eşyalar yetenek kümesinin üstünde), yatay taşma yok.

## 2D yedek
WebGL yoksa `view2d.js`: nehir, ağaçlar, kuleler, çeşme, çukur, rünler, DOG/creep/nötr/boss (renk, ad, telgraf
şekilleri), kalıntı/ward/alan etkileri, orman eşyası (kademe numarası), gece karartması, kurye, mermiler.

## Mimari / genişletme noktaları

| Dosya | Görev |
|---|---|
| `heroes.js` | Kahraman verisi (`attr`, `attrs {str:[taban,artış]…}`, `base`, `attack`, `abilities`, `build`, `talents` 10/15/20/25, `aghs`, `locked`), `ATTR`, `HERO_MR`, `xpFor`, `abilityCap`, `attrAt`, `isHeroUnlocked` / `registerUnlockCheck` / `devUnlock` |
| `abilities.js` | 24 yetenek: `targeting`, `levels[]` (4 ya da 3), `show` (tablo satırları), `cast/fire/tap/step/stats/onAttack/onHurt/onKill/hud`; `VARIANT_INFO` (18), `abilityDisplay`, `targetingOf`, `abilityCtx`, `abilityInfo`, `levelValues`, `STATS_BONUS` |
| `combat.js` | `dealDamage`, `applyStatus`, `dispel`, `tickStatus`, `armorFactor`, `isImmune`, `hasStatus`, `cantMove/cantAttack/cantCast`, `STATUS_NAMES`, `DMG` |
| `items.js` | `ITEMS` (tüketim, bileşen, tarif: `components`, `cost` = tarif ücreti), `SHOP_TABS`, `totalCost`, `buildsInto`, `isRecipe`, `NEUTRALS`, `neutralTier`, `RUNES` |
| `units.js` | `UNITS` (DOG’lar, creep’ler, nötrler, 5 boss, kuleler), `BOSS_IDS`, `CAMP_UNITS`, `unitId` (kısa ad → kimlik), `makeBoss/makeNeutral/makeCreep`, `THINK` yapay zekâları, `stepTowers` |
| `game.js` | Simülasyon (DOM’suz): `createGame(emit, config)`, dalga/görev akışı, kahraman, ekonomi, geri alma, kamplar, gece, varyant/havuz uygulaması, `g.dev` |
| `dogs.js` · `map.js` | DOG türleri/yapay zekâ/dalga ölçeği · harita (kamplar, `steerAround` engel kaçınma) |
| `actors.js` · `view3d.js` · `fx3d.js` · `map3d.js` · `textures.js` | Rig’ler (`UnitRig` + `UNIT_LOOK`), telgraf havuzu, gece ışığı/karartma, alan/kalıntı/ward görselleri, kozmetik aura/iz/kurye |
| `view2d.js` · `minimap.js` | WebGL’siz yedek · mini harita |
| `arena.js` · `select.js` · `shop.js` · `glyphs.js` · `arena.css` | Arayüz |
| `progression.js` · `library.js` · `mastery.js` · `codex.js` | Kalıcı ilerleme (İlerleme ajanı; bkz. ARENA-ILERLEME.md) |
| `story.js` · `storyui.js` · `story.css` · `daily.js` | Hikâye verisi/ilerlemesi (saf), harita + diyalog + final (tembel), günlük meydan okuma (bkz. arena-hikaye.md) |

### Koşu ayarı (`g.start(config)` / `createGame(emit, config)`)
```js
{
  mode: 'endless' | 'story' | 'daily', heroId, seed /* sayı: tekrarlanabilir */, curse: 0–10,
  modifiers: { startGold, startLevel, heroHp, heroDmg, enemyHp, enemyDmg, enemySpeed, bossHp, gold, xp, shopCost,
               noCourier, alwaysNight, dayLen, nightLen, roshanEvery, extraElites, noBuyback, noCamps, scoreMul, autoLearn },
  meta: { startItems: ['tango'], startGold, variants: { okcu_shot: 'okcu_volley' }, pools: { neutralChoice, neutralReroll },
          cosmetics: { aura: {color}, trail: {color}, courier: {color}, stamp: bool, title }, mastery: { title }, bonus: { stat… } },
  mission: { waves: [dalga…], objectives: [hedef…], victory: 'objectives' | 'waves', failOnObjective: true },
  waves: null | [dalga…],   objectives: [hedef…],
}
```
`curseMods(level)` lanet değiştiricilerini üretir (açık `modifiers` ezer): 1 DOG %10 hızlı · 2 düşman canı +%15 ·
3 dükkân +%20 · 4 uzun geceler · 5 kurye yok · 6 düşman hasarı +%20 · 7 Roshan her 4 dalga · 8 +2 elit · 9 hep gece ·
10 altın −%25; skor ×`1 + 0,12n`.

**Dalga şeması** (`mission.waves[i]`, yoksa `defaultWave(n)`):
```js
{ lvl: 8 /* ölçek dalgası: DOG/creep/orman gücü, öldürme altını/XP'si, kule gücü; yoksa dalga numarası */,
  dogs: ['feed', 'mid', …], elites: 2, creepSquads: 1,
  boss: null | 'roshan' | 'boss_general' | 'Dire Generali',   bossLevel: 1, bossAt: 'pit' | 'center' | 'dire' | 'gate' | {x, z},
  units: [{ id: 'neutral_alpha' | 'creep_melee' | 'dog_feed' | 'boss_shadow' | …, n: 2, at: 'center' | 'camp:kurt' | {x,z},
            elite, counted: true, delay: 5 /* sn */, k: 1, aggro: true,
            hpMul, dmgMul, scale, bountyMul, tag: 'lord', label /* hikâye: güçlendirilmiş/etiketli birim */ }],
  night: true | false, camps: true, text: 'Dalga duyurusu' }
```
Birim kimlikleri kısa adla da çözülür (`unitId('ROSHAN')`). `counted: false` birimler dalgayı bitirmeyi beklemez.
Liste bitince hikâyede zafer (`runEnd.victory`); hedefle kazanılan görevde (`victory: 'objectives'`) zorunlu hedef
sürüyorsa son dalga bosssuz ve ölçeği birer artarak yinelenir. `g.lvl` / `g.scaleWave()` ölçek dalgasıdır (Sonsuz’da
her zaman `g.wave`, dolayısıyla Sonsuz dengesi değişmedi). İlk dalga `lvl > 1` ise kuleler o ölçekle kurulur.

**Görev ek alanları (faz D):** `mission.prep` (sn; ilk dalgadan önce dükkân molası, “Hazırlık · ilk dalga”),
`mission.setup(g)` (görev betiği; `g.on` / `g.later` / `g.hooks`; kapatma fonksiyonu döndürür, sonraki `start`/
`attract`’ta çağrılır), başlangıç seviyesi > 1 ise başlangıç yetenek puanları otomatik dağıtılır. **Özel hedefler:**
`kind: 'custom'` → `g.objSet(id, v)`, `g.objAdd(id, n)`, `g.objFail(id)`; `hold: true` hedef (“en çok 3 REPORT ye”)
noDeath gibi zaferde tamamlanır. Hazırlık molası (dalga 0) `time`/`survive` sayacına girmez. `kill` hedefinde `unit`
birimin `tag`’ine de uyar.

**Görev hedefleri** (`mission.objectives`): `{ id, kind, n, optional, text, … }` — `kill` (`unit`: kimlik/kind/tür),
`boss` (`boss`: kimlik), `waves`, `survive` (`t` sn), `time` (`t` sn içinde bitir; aşılırsa başarısız), `runes`,
`camps`, `towers` (Dire kulesi yık), `protect` (Radiant kulesi düşerse başarısız), `noDeath`, `level`, `item` (`item`
kimliği), `lastHits`, `gold` (kazanılan). `victory: 'objectives'` → zorunlu hedefler bitince zafer; `failOnObjective`
(varsayılan açık) zorunlu hedef kaçınca yenilgi. HUD sağ üstte listeler, `objective` olayı yayar.

**API (hikâye/entegrasyon):** `g.spawnUnit(id, { n, at, x, z, elite, counted, k, aggro })` → birimler ·
`g.addZone({ kind, x, z, r, dur, every, follow, tick })` · `g.later(sn, fn)` · `g.learn(key)`, `g.chooseTalent(L, i)`,
`g.buy(id)`, `g.sell(slot)`, `g.buyback()`, `g.chooseNeutral(id)`, `g.rerollNeutral()`, `g.equipNeutral(id)`,
`g.variant(abilityId)`, `g.report()`, `g.activeBoss()`, `g.visionR()`, `g.dev.*` (test).

**Olay veri yolu** — `g.on(type, fn)` (çıkış fonksiyonu döner), `g.off`, `'*'` hepsi. Yaşam döngüsü: `runStart`,
`waveStart {wave, boss, bossId, text}`, `waveEnd`, `waveClear`, `runEnd {mode, score, wave, heroId, stats, victory,
objectives, curse}`, `gameOver`. Savaş: `dmgNum {x,y,z,n,type,crit,miss,immune,block,absorb,hero}`, `status`,
`dispel`, `silenced`, `hurt`, `hit`, `kill`, `unitKilled {unit, id, kind, by, lastHit}`, `multikill`, `streak`,
`firstBlood`, `deny`, `death {lost, buyback}`, `revive {buyback, cost}`. Kahraman: `levelUp`, `learn`, `unlearned`,
`talentReady`, `talent`. Eşya: `buy`, `combine`, `sell`, `itemBought`, `itemUse`, `courierDeliver`. Dünya:
`dayNight {night}`, `campSpawn`, `campCleared`, `neutralDrop`, `neutralChoice {choices, tier}`, `neutralEquip`,
`neutralReroll`, `ward`, `zone`, `zoneEnd`, `rune`, `runeTaken`. Boss: `bossSpawn`, `bossTele {foe, kind}`,
`bossAct`, `bossPhase`, `bossSummon`, `bossShieldBreak`, `bossKilled`, `roshanTele/Slam/Roar`. Görev: `objective
{id, done, failed, progress, n, obj}`. Görsel: `fx {kind…}`, `cast`, `proj`, `towerDown`, `towerShot` …
**Kancalar:** `g.hooks.beforeDamage / afterDamage / onKill / onStep`.

**Yeni içerik eklemek:** kahraman → `heroes.js` + 4 yetenek `abilities.js` (levels, show) + `MODEL_H`/`MODEL_YAW` +
prosedürel yedek + glif · eşya → `items.js` (+ `SHOP_TABS`) · boss/birim → `UNITS` + `THINK[ai]` + `UNIT_LOOK` ·
dalga/görev → `mission`.

### Geliştirme kancası (`root.__arenaDebug`, yalnızca `import.meta.env.DEV`)
`wave(n)`, `clear()`, `gold(n)`, `level(n)`, `learnAll()`, `talents(i)`, `roshan()`, `boss(id, {at, k})`,
`unit(id, o)`, `camps()`, `neutral(id?)`, `night(true|false|null)`, `rune(k)`, `creeps()`, `heal()`, `god(v)`,
`kill()`, `unlock(id|'all')`, `pickHero(id)`, `start(config)`, `sheet(tab)`, `learnMode(v)`, `speed(k)`, `mode()`.
Faz D: `menu()`, `run()`, `hub()`, `endless()`, `campaign(id?)`, `daily()`, `startDaily()`, `story(id, heroId?)`,
`win(all?)`, `lose()`, `talkOpen()`, `talkNext()`, `talkSkip()`, `storyProgress()`, `storyUnlock(n, yıldız)`,
`storyReset()`, `panel('library'|'codex'|'mastery', arg)`.

### Kayıtlar (localStorage, `csk:` önekiyle)
| Anahtar | İçerik |
|---|---|
| `arena:v2` | `{ v: 2, hero, bests: { <kahraman>: puan }, runs, roshans }` |
| `arena:keys` · `arena:auto` · `arena:autoshop` · `arena:autolearn` | Tuş düzeni, otomatik nişan, molada dükkân, otomatik öğrenme |
| profil `scores.arena` · `picks['arena:h:<id>']` · `picks['arena:roshan']` · `picks['arena:dalga']` | Sonsuz mod skorları |
| `devUnlock` | yalnızca bellek içi (kalıcı değil) |
| `arena:story:v1` · `arena:daily:v1` · (oturum) `arena:ui` | Hikâye ilerlemesi, günlük rekor, son açılan menü — bkz. [arena-hikaye.md](arena-hikaye.md) |

## Denge notları (Arena 3.0)
Başsız bot (`game.js` DOM’suz; kaçan/yaklaşan bot, otomatik öğrenme, sabit eşya planı, 25–30 dk sınır, her kahraman
3–4 koşu): **Okçu 22–24, Balta 19–23, Buz Cadısı 18–20, Gölge ≈24 (bazen erken ölüm), Şimşek Ruhu ≈22, Ağaç
Bekçisi 21–22** dalga. Aynı botla eski 2.0: Okçu 14–17, Balta 22–23, Buz 23, Gölge 21. Seviye: 10. dalgada 15–17,
12. dalgada 18–20. Bot mükemmel nişanlıdır; gerçek oyuncu için beklenen kabaca 6–14 dalga.
Ayarlananlar: Çev. zırhı 1/6 → 1/10, saldırı hızı 1 → 0,75/çev.; geç dalga ölçeği (kare terimler + 14. dalgadan
sonra ×1,06^(k−14) duvarı); Gölge kaçınma %20 → %15 ve kritik tablosu; Kan Emici; Okçu ok saldırı çarpanı;
Feed Alfa dalışı her menzilde; Roshan kükremesine ccCap.

## Performans
- Modeller tembel: seçili kahraman + köpek + kuleler; nötr kurt/harpi ve Roshan koşu başında, diğer bosslar 7.
  dalgadan (ya da görev bossu varsa) önce. Birim rig’leri görünüşe göre havuzlanır; telgraflar, alanlar, kalıntılar,
  ward’lar havuzlu ve çıkışta `dispose()`.
- Sınırlar: en çok 40 düşman (`MAX_FOES`), 8 creep, kamp başına 2–3 nötr, 4 ward, 3 kalıntı. Yüzen sayılar 32’lik
  DOM havuzu. Gece karartması tek düzlem + radyal doku; ışıklar sabit sayıda, yalnızca renk/yoğunluk değişir.
- Mobilde gölge yok, piksel oranı ≤ 1,5; kare hızı düşerse kademeli iner.

## Test notları (Arena 3.0)
- **Başsız (node):** `scenario` (5 boss görevi zaferle, telgraf/evre/çağırma; tarif + kurye + satış; kamplar + orman
  düşmesi; gece görüşü; dönüşüm/susturma/dispel; BKB sersemletme ve büyü hasarını engelliyor, saf hasar geçiyor; zırh
  formülü; statü direnci; geri alma + bekleme + altınsız son; yetenek puanları/ağaç/seviye sınırları) — tümü geçti.
  Bulanık test 6 kahraman × (bot + rastgele) 18 koşu, **0 istisna**. `variants`: 18 varyantın hepsi (bot + rastgele,
  `neutralChoice: 3`, `neutralReroll: 1`) 12 koşu, 0 istisna; tüm varyant yolları ve seçim/takas olayları görüldü.
- **Playwright** (SwiftShader, HMR engelli, port 5201): 1440×900 ve 390×844 dokunmatik, 6 kahraman: kilit açma,
  başlat, 25. seviye, öğrenme kipi / Ctrl kısayolu / sayfa “+”, 4 yetenek ağacı seçimi, dükkândan iki tarif (Faz Botları
  bedava birleşme, Şimşek Tırpanı bileşen + tarif), BKB, kamplar + orman eşyası (+ seçim kartı), gece, 5 boss (çubuk +
  telgraf), geri alma, yüzen hasar sayıları (fiziksel/büyü/saf/kritik sınıfları), taşma kontrolü, konsol hatası 0.
- `vite build` geçti.

## Hikâye ve ilerleme ajanlarına notlar
- Görevler `g.start({ mode: 'story', heroId, mission: { waves, objectives, victory, failOnObjective }, modifiers })`
  ile kurulur; bosslar `waves[i].boss` / `units[{id}]` ya da `g.spawnUnit` ile. Pub’ın Kalbi sabittir, `bossAt:
  'center'` önerilir. Gölge Ulusu gece (`night: true`) daha anlamlıdır.
- `runEnd` yükü `grantRunRewards` için yeterlidir (`stats.bosses`, `stats.bossKills`, `items`, `kills`, `time`).
  Yalnızca `mode: 'endless'` salon skoruna yazar.
- arena.js `progression.js` varsa: `registerUnlockCheck`, `connectStore(coreStore)`, `trackGame(game)` (çıkışta
  durdurulur), her başlatmada `applyMeta(config)`, oyun sonunda `grantRunRewards(runEnd)`. **Faz D:** Kütüphane,
  Kodeks, ustalık, Lanet seçici, ödül kartı ve hikâye/günlük akışı bağlandı ([arena-hikaye.md](arena-hikaye.md)).
- Uygulanan meta alanları: `variants` (18/18), `pools.neutralChoice` (1–3), `pools.neutralReroll` (0–3/mola),
  `startItems`, `startGold`, `cosmetics.aura/trail` (halka + iz), `cosmetics.courier` (kurye izi rengi),
  `cosmetics.stamp` (üçlü öldürmede “DOG DOG DOG” damgası), `cosmetics.title` / `mastery.title` (sayfada unvan,
  portrede altın çerçeve), `bonus` (stat nesnesi).
