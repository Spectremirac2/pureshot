# 1vDOQUZ Arena 2.0 (`arena`)

**Rota:** `#oyunlar--arena` (kısayol **R**) · **Tür:** Ultimate · 3D · mini Dota · **Skor:** puan (yüksek iyi, tek skor tablosu)
**Dosyalar:** `src/sections/games/arena/` (ayrıntı: [Mimari](#mimari--genişletme-noktaları)). Salon, arenayı ilk açılışta tembel yükler.

## Fikir
Radiant tarafında tek başınasın. Nehrin ikiye böldüğü küçük bir Dota savaş alanında dokuz DOG, Dire creep’leri,
Dire kuleleri ve her 5. dalgada Roshan (Kaya Canavarı) üstüne gelir. Dört kahramandan birini seç, öldürdükçe
**altın** ve **XP** topla, molada **dükkândan** eşya al (kurye getirir), 5/10/15. seviyede **yetenek ağacından**
seç, nehirdeki **rünleri** kap. Dokuz DOG’u indirmek bir dalgayı temizler: **1vDOQUZ**.

Kahramanlar Dota arketiplerinden esinlenen özgün karakterlerdir; arayüzde yalnızca Türkçe lakaplarıyla anılırlar.

## Kahramanlar
Seçim ekranında sahnenin kendisi döner tabladır: kamera seçili kahramanın 3D modeline yaklaşır. Seçim
`csk:arena:v2` içinde saklanır; her kahramanın **kendi en iyi skoru** yerel olarak tutulur ve kartında görünür.

| Kahraman | Rol · Zorluk | Can / Mana / Hız | Temel saldırı |
|---|---|---|---|
| **Okçu** (`okcu`, model-archer) | Menzilli nişancı · ★★ | 640 / 300 / 5,3 | Yok: Q onun saldırısı |
| **Balta** (`balta`, model-hero-brute) | Yakın dövüş tank · ★ | 940 / 240 / 5,05 · %20 zırh | 46 hasar, 1,55 menzil, 0,95 sn |
| **Buz Cadısı** (`buz`, model-hero-frost) | Menzilli büyücü · ★★ | 630 / 440 / 4,95 | Buz mermisi 37, 6,2 menzil, hafif yavaşlatma |
| **Gölge** (`golge`, model-hero-shadow) | Suikastçı · ★★★ | 700 / 270 / 5,65 · %20 kaçınma | 39 hasar, 1,45 menzil, 0,72 sn |

### Yetenekler (Q W E R)
| | Okçu | Balta | Buz Cadısı | Gölge |
|---|---|---|---|---|
| **Q** | **CureShot**: basılı tut, 1,2 sn şarj, delip geçen ok | **Savaş Çağrısı**: 3,4 yarıçapta düşmanları çeker ve 2,4 sn kendine kilitler; 3,5 sn %40 hasar azaltma | **Buz Novası**: noktaya alan hasarı + 3 sn %40 yavaşlatma | **Gölge Adımı**: hedefin yanına ışınlan + anında saldırı |
| **W** | **Rüzgâr Koşusu**: 3 sn %60 hız, %80 kaçınma | **Helezon**: çevreye saf hasar; pasif %24 şansla vurulunca döner | **Buz Zinciri**: 2,2 sn dondur (yürüyemez, ısıramaz) + DoT | **Duman Perdesi**: 4 sn görünmezlik, +%15 hız; ilk vuruş +%80 ve 0,6 sn sersemletme |
| **E** | **Tango**: 3 şarj, 6 sn’de 150 can | **Savaş Açlığı**: 8 sn DoT + %30 yavaşlatma; hedef ölürse sıçrar | **Mana Aurası**: pasif +3 mana/sn; aktif 3 sn hızlı mana/can | **Kan Kokusu** (pasif): %20 ×2,6 kritik, %12 can çalma |
| **R** | **DOG DOG DOG**: 8 yarıçap hasar, sersemletme, korku | **Kesin Hüküm**: eşiğin (200 + 24/seviye) altını infaz eder, bekleme sıfırlanır | **Donduran Alan**: 4,2 sn kanal, art arda buz patlamaları | **Ölüm Dansı**: 5 düşmana sıçra, garanti kritik; dans boyunca dokunulmaz |

Balta’nın ultisi hazırken infaz edilebilecek düşmanların etiketinde **İNFAZ** yazar (Roshan dahil).
Pasif yetenekler (Gölge E) “P” işaretiyle görünür; tuşa basınca yalnızca uyarır.

### Yetenek ağacı (5 / 10 / 15. seviye) ve Aghanım yükseltmesi
| | 5 | 10 | 15 | Aghanım Asası |
|---|---|---|---|---|
| Okçu | +%15 ok hasarı · +180 can | Rüzgâr −4 sn · şarj %30 hızlı | DOG DOG DOG +3 yarıçap · tam şarjda üçlü ok | Ulti 18 sn, korku +1 sn |
| Balta | +14 hasar · +220 can | Helezon +60 · Çağrı +1,2 yarıçap | İnfaz eşiği +120 · %45 yarma | İnfaz menzili +1,5, her infazda Helezon |
| Buz Cadısı | +120 mana · +%15 büyü hasarı | Zincir +1 sn · Nova −2 sn | Kanalda yürü · alan hasarı +%40 | Alandakiler her 1,5 sn 0,6 sn donar |
| Gölge | +%8 kritik · +0,5 hız | Adım −2 sn · +%15 kaçınma | Dans +3 hedef · “Yıkım”: vurulan 4 sn %20 fazla hasar alır | Dans +3 sıçrama, sonunda 2 sn görünmezlik |

Seviye atlayınca portrede ağaç düğmesi yanar (**T**). Seçici açıkken oyun durur; molada kendiliğinden açılır.

## Düşmanlar
- **10 DOG türü** (değişmedi): Feed, Farm, Pause, AFK, Kurye, Rapier, Mid, Wardsız, Smurf, Chat. Her dalga 9 DOG;
  4. dalgadan sonra elitler. Yeni: görünmez kahramanı kaybeder (“?”), Savaş Çağrısı’na kilitlenir (“!”), donunca
  buz kütlesi. Kurye Köpeği Okçu’dan Tango, diğerlerinden Tango Paketi ya da altın çalar.
- **Dire creep’leri**: Piyade (yakın, kalkanlı) ve Büyücü (menzilli küre). Dalga başına 1–3 manga, Dire kapısından
  çıkıp en yakın Radiant kulesine yürür; 3,6 birime girersen ya da vurursan sana döner. Dalga bitince geri çekilir.
- **Roshan (Kaya Canavarı)**: her 5. dalgada çukurundan çıkar (+5 DOG). Yere vuruş (kırmızı halka, 1,1 sn uyarı,
  hasar + itme + yavaşlatma), kükreme (sarı halka, 1,25 sn sersemletme; BKB korur). Çukurdan uzaklaşırsan geri döner ve
  iyileşir. Düşünce **Aegis** ve **Peynir** bırakır: ROSHAN KATLEDİLDİ.
- **Kuleler**: 2 Radiant (menzile giren düşmanlara ateş eder, creep’ler onlara saldırır), 2 Dire (0,8 sn kilitlenip
  kahramana ateş eder, kırmızı menzil halkası). Dire kulesini yıkmak +500 puan, +220 altın. Roshan dalgasından sonraki
  dalgada yıkılan kuleler yeniden dikilir.

## Harita
Nehir sol üstten sağ alta akar (animasyonlu su shader’ı), ortadaki mühür adasının çevresinden dolanır. Sol alt
Radiant (yeşil, çam ağaçları, çeşme), sağ üst Dire (kül, kızıl ölü ağaçlar). Nehrin iki kıvrımında **rün kaideleri**,
sol üst uçta **Roshan çukuru**. Çeşme: molada saniyede %14, dalgada %3,5 can/mana; çeşmedeyken alınan eşya anında
gelir. DOG’lar Radiant kapısı dışındaki üç kapıdan, creep’ler Dire kapısından girer.

## Ekonomi ve dükkân
- **Altın:** DOG 38 (+elit 20) + 2/dalga; **son vuruş bonusu** +10+dalga (kahraman öldürürse). Kule ya da başka
  kaynak öldürürse %35 pay. Creep 30/36, Roshan 350+, Dire kulesi 220, dalga sonu 90+15×dalga, pasif 1,2/sn, Ödül rünü.
- **Dükkân (B):** molada kendiliğinden açılır (ayar), her an açılabilir. Fareyle tıkla = al; dokunmada seç → “Satın
  al”. Çantaya tıkla + onayla = yarı fiyatına sat. 6 yuva, etkin eşyalar **1–6** tuşları / dokunmatik düğmeler.
- **Kurye:** çeşmede değilsen eşya kuryeye yüklenir; kanatlı eşek çeşmeden sana uçar ve teslim eder.

| Eşya | Fiyat | Etki |
|---|---|---|
| Koşu Botları | 350 | +0,7 hız |
| Tango Paketi | 90 | 3 şarj, 8 sn’de 130 can (üst üste biner) |
| Sihirli Değnek | 250 | Öldürme başına şarj (15); aktif: şarj × 16 can/mana |
| Göz Açıp Kapayana | 950 | 7 birim ışınlanma (hareket yönü ya da nişan); hasar alınca 2 sn kilit |
| Kara Kral Asası | 1500 | +10 hasar; 5 sn büyü bağışıklığı (yavaşlatma/sersemletme/REPORT/kükreme), büyü hasarı −%60 |
| Güneş Tacı | 2100 | +14 hasar; 3,2 birimde saniyede 38 yanma |
| Kelebek | 2300 | +%30 kaçınma, +%25 saldırı hızı, +12 hasar (Okçu’da şarj %20 hızlı) |
| Aghanım Asası | 2400 | +180 can/mana, ulti yükseltmesi |
| Tazeleme Küresi | 2000 | +4 mana/sn; aktif: tüm bekleme sürelerini sıfırlar |
| İlahi Kılıç | 3600 | Tüm hasar +%80; Aegis’le dirilirsen düşer, Kurye Köpeği kaçırır: 8 sn içinde indir, geri al |
| Peynir | — | Roshan’dan düşer; aktif: tam can ve mana (çanta doluysa hemen yenir) |

Eşya ikonları `src/assets/items/` (itemIconUrl) dosyalarıdır; adlar Türkçe ve oyunbazdır.

## Seviye ve XP
XP: DOG 45+5/dalga, creep 22/26, Roshan 500+, kule 150, Ödül rünü. Seviye L→L+1: `100 + 55 × (L−1)`, en çok 25.
Seviye başına kahraman hasar çarpanı (%4–5,8), can, mana ve yenilenme artar.

## Rünler
Nehirde iki noktadan birinde, ilki 14 sn’de, sonra her 40 sn’de (eskisinin yerine) çıkar; mini haritada ve ekran
kenarında görünür. **Hız** (8 sn ×1,45 hız), **Çift Hasar** (12 sn), **Yenilenme** (8 sn %7/sn), **Görünmezlik**
(10 sn; saldırı/büyü bozar), **Ödül** (altın + XP).

## Puan (tek skor tablosu, anlamı değişmedi)
DOG 100 · creep 30/40 · Roshan 1000 (+500/kez) · Dire kulesi 500 · çoklu öldürme +50/150/300/500 ·
dalga temizleme `300 × dalga` + **verim bonusu** `verim × 400` (Okçu: isabet; diğerleri: `1 − dalga hasarı / (1,5 × azami can)`).
Kabaca: ilk dalga ≈ 1.300 (rozet **1vDOQUZ**), 4–5 dalga ≈ 6.000–8.000 (rozet **Arena Efsanesi**).

## Kontroller
- **Klavye:** WASD + Boşluk (W yeteneği Boşluk) ya da ok tuşları + QWER · **1–6** eşyalar · **B** dükkân ·
  **T** yetenek ağacı · molada **Enter** “Hazırım” · **Esc/P** duraklat. Fare nişanı (otomatik nişan kapalıyken);
  saldıran kahramanlarda tıklanan düşman odak hedefi olur.
- **Dokunmatik:** sol başparmak joystick; Q W E R düğmeleri (dokun = en yakın hedef; basılı tut + sürükle = yön);
  etkin eşyalar yetenek kümesinin üstünde; portre panelindeki altın düğmesi dükkânı açar.
- Temel saldırı kendiliğinden (menzildeki en yakın düşman, yoksa Dire kulesi). Görünmezken yürürsen saldırmazsın
  (pusu için dur).

## Arayüz (HUD)
Alt ortada Dota paneli: portre + XP halkası + seviye, Q W E R, can/mana, 6 eşya yuvası, altın. Sol altta mini harita
(kahraman, DOG’lar, creep’ler, Roshan, kuleler, rünler, kurye, Aegis), sağ üstte öldürme akışı, üstte dalga/DOG/öldürme,
spiker duyuruları (FIRST BLOOD, DOUBLE/TRIPLE/ULTRA KILL, RAMPAGE, KILLING SPREE … BEYOND GODLIKE, ROSHAN UYANDI,
ROSHAN KATLEDİLDİ, AEGIS ALINDI, KULE YIKILDI, Rün: …). 390 px’te panel sol üste, mini harita sağ üste taşınır.

## 2D yedek
WebGL yoksa `view2d.js` aynı simülasyonu üstten çizer: nehir, ağaçlar, kuleler (menzil halkası), çeşme, çukur, rünler,
creep (kare), Roshan (altın halka + saldırı uyarısı), kurye, mermiler, kahraman rengi.

## Mimari / genişletme noktaları
Hikâye modu, meta ilerleme ve derin savaş sistemi bu yapının üstüne kurulacak şekilde ayrıldı.

| Dosya | Görev |
|---|---|
| `heroes.js` | Kahraman verisi: `attr` (str/agi/int, ileride özellik sistemi), `base`/`grow` statlar, `attack`, `abilities` (tuş → yetenek kimliği), `talents` (5/10/15; `stat` ya da yetenek kodunun okuduğu kimlik), `aghs`, model/yükseklik/renk |
| `abilities.js` | Yetenek kayıt defteri: `targeting` (none/point/unit/passive/charge/channel), `levels: [{ mana, cd, … }]` (şimdilik 1. seviye), `cast(g, c)`, `canCast`, `step`, `stats`, `onAttack`, `onHurt`, `onKill`, `hud` |
| `items.js` | Eşyalar: `cost`, `stat`, `active { cd, mana, use(g, slot) }`, `charges`, `components: []` (tarif sistemi için ayrıldı); `SHOP`, `RUNES` |
| `units.js` | `UNITS` tablosu: DOG’lar (dogs.js’ten), creep’ler, `boss_roshan`, kuleler — can, hız, hasar, `armor`, `magicResist`, `attackType`, menzil, `bounty {gold,xp,score}`, model; creep/Roshan/kule yapay zekâsı |
| `combat.js` | **Tek hasar girişi** `dealDamage(g, source, target, amount, type, opts)` (`'physical'`: zırh + kaçınma, `'magical'`: büyü direnci, BKB azaltır, `'pure'`), `applyStatus(g, target, 'stun'|'root'|'slow'|'silence'|'fear'|'taunt'|'dot'|'amp', dur, data)`, `tickStatus`, `mitigation` |
| `game.js` | Simülasyon: `createGame(emit, config)`, dalga akışı, kahraman, ekonomi, kurye, rünler, olay veri yolu |
| `dogs.js` | DOG türleri, dalga dizilimi, DOG yapay zekâsı (durumları `d.st` üzerinden okur) |
| `map.js` · `map3d.js` | Harita yerleşimi (nehir, kuleler, çeşme, çukur, rün, ağaç, çarpışma) · 3D çevre (zemin boyası, su shader’ı, instanced ağaçlar, çeşme, çukur) |
| `actors.js` · `view3d.js` · `fx3d.js` · `textures.js` | Rig’ler (DogRig, HeroRig, UnitRig, TowerRig, CourierRig, rün/mermi/peynir), sahne, efekt havuzları, canvas dokuları |
| `view2d.js` | WebGL’siz yedek |
| `arena.js` · `select.js` · `shop.js` · `minimap.js` · `glyphs.js` · `arena.css` | Arayüz: akış, HUD, girdi, kahraman seçimi, dükkân, mini harita, SVG glifleri |

**Koşu ayarı** — `createGame(emit, config)` ve `g.start(config)`:
```js
{ mode: 'endless' | 'story', heroId: 'okcu', seed: null /* sayı: tekrarlanabilir dalga/rün */,
  modifiers: { startGold, startLevel, heroHp, heroDmg, enemyHp, enemyDmg, gold, xp },
  waves: null | [{ dogs: ['feed', …], elites: 0, creepSquads: 1, boss: null | 'roshan' }],
  objectives: [] /* hikâye modu için ayrıldı */ }
```
`waves` verilirse n. dalga oradan okunur; `mode: 'story'` ve liste bitince koşu zaferle biter (`runEnd.victory`).
Liste yoksa `defaultWave(n)` (her 5. dalga Roshan) kullanılır.

**Olay veri yolu** — `g.on(type, fn)` (çıkış fonksiyonu döner), `g.off`, `'*'` hepsini dinler:
`runStart {heroId, config}`, `waveStart {wave, boss}`, `waveEnd {wave, bonus, effBonus, gold, boss}`,
`unitKilled {unit, type, kind, by}`, `bossKilled {boss, k, by}`, `itemBought {item, cost}`, `levelUp {level}`,
`runEnd {score, wave, heroId, stats, victory}`; ayrıca görsel olaylar (`hit`, `kill`, `fx`, `cast`, `towerDown`,
`rune`, `courierDeliver` …). **Kancalar:** `g.hooks.beforeDamage / afterDamage / onKill / onStep` dizileri.

**Yeni içerik eklemek:** kahraman → `heroes.js` satırı + 4 yetenek `abilities.js` + model anahtarı
(`MODEL_H`, `MODEL_YAW`, `HeroRig` prosedürel yedek) + `glyphs.js` amblemi · eşya → `items.js` + (varsa) `src/assets/items`
ikonu · boss/creep → `UNITS` satırı + think fonksiyonu + `stepFoes` dağıtımı + `UnitRig` model anahtarı · dalga senaryosu
→ `config.waves`.

### Kayıtlar (localStorage, `csk:` önekiyle)
| Anahtar | İçerik |
|---|---|
| `arena:v2` | `{ v: 2, hero, bests: { okcu, balta, buz, golge }, runs, roshans }` (sürüm uyuşmazsa sıfırlanır) |
| `arena:keys` · `arena:auto` · `arena:autoshop` | Tuş düzeni (wasd/dota), otomatik nişan, molada dükkânı aç |
| profil `scores.arena` | Tek skor tablosu (değişmedi, `store.me.submitScore`) |
| profil `picks['arena:h:<kahraman>']` · `picks['arena:roshan']` · `picks['arena:dalga']` | Kahraman başına en iyi skor, toplam Roshan, en yüksek dalga (rozet/görev için) |

## Denge notları
Başsız simülasyon botuyla (kaçan/yaklaşan basit bot, otomatik nişan, eşya sırası sabit; 4’er koşu, 20 dk sınır):
Okçu 14–18, Balta 13–17, Buz Cadısı 14–19, Gölge 5–22 (yüksek risk/ödül) dalga. Bot mükemmel nişanlı olduğundan
gerçek oyuncu için beklenen aralık kabaca 4–12 dalga. Ayarlanan noktalar: geç dalga ölçeği (`waveScale`: can
`1 + 0.26k + 0.035k²`, hasar `1 + 0.12k + 0.006k²`, en çok 6 elit), Dire kulesi (34 hasar, 1,5 sn, 0,8 sn kilitlenme —
yakın dövüşçüleri en çok öldüren kaynaktı), Gölge’ye can çalma, Balta’ya zırh/Helezon şansı.

## Performans
- Modeller tembel: açılışta köpek, iki kule, Aegis ve seçili kahraman; diğer kahramanlar seçim ekranında boşta,
  creep’ler ve kurye koşu başlarken, Roshan 4 sn sonra / 3. dalgada. GLB başına bir şablon (core/models.js önbelleği),
  birim başına yalnızca malzeme kopyası (yanıp sönme/saydamlık).
- Sınırlar: aynı anda en çok 8 creep, 9 DOG (+1 hırsız), 1 Roshan, 4 kule. Rig’ler, oklar, mermiler, rünler havuzlanır.
- Ağaçlar InstancedMesh (5 draw call), nokta ışık sayısı sabit (4 kapı + kahraman + efekt), creep/kule can çubukları
  canvas’sız sprite, DOG etiketleri yalnızca değişince yeniden çizilir, mini harita ~8 fps.
- Mobilde gölge yok, piksel oranı ≤ 1,5, yarım yoğunluk dış ağaç, 1024 px zemin boyası; kare hızı düşerse piksel oranı
  kademeli iner, sonra gölge kapanır. Her şey `dispose()` ile bırakılır (model önbelleği hariç).
- Üçgen bütçesi: model başına ~20–29 bin üçgen; en kalabalık anda ~500 bin. Orta telefonlar için bir LOD/basitleştirme
  (gltf-transform `simplify`) ileride düşünülebilir.

## Test notları (bu tur)
Playwright + SwiftShader (yazılımsal WebGL, 1–3 fps; kare hızı değerlendirilmedi), HMR engelli, 1440×900 masaüstü ve
390×844 dokunmatik. Her kahraman için: seçim → başlat → bot/dokunmatik oyun → dalga temizleme → dükkânın kendiliğinden
açılması → satın alma (kurye uçup teslim etti) → çeşmede anında alım → yetenek ağacı (oyun durdu, seçim uygulandı) →
Çift Hasar rünü → Roshan dalgası (uyarı halkası) → BKB → Roshan’ı kes → Aegis + Peynir → Aegis ile dirilme → oyun sonu
ekranı → `scores.arena`, `picks` ve `arena:v2` yazıldı. Mobilde ayrıca gerçek dokunma (CDP): joystick, Q W E R
düğmeleri, dükkânda seç + “Satın al”, yetenek ağacına dokunma. Ek olarak: WebGL kapalıyken 2D yedek (Roshan dalgası,
creep, rün), 1024×700 dizüstü düzeni, arenadan çıkıp dönme (tüm canvas’lar bırakıldı, site kısayolları geri geldi),
başsız bulanık test (4 kahraman × 3 koşu, rastgele yetenek/eşya/alım/satım/rün/Roshan; 0 istisna) ve
`mode: 'story'` senaryolu dalgaların zaferle bitmesi. Konsol hatası 0, yatay taşma 0, `vite build` geçti.
Geliştirme kancası `root.__arenaDebug` (dalga atla, altın, seviye, Roshan, rün, creep, ölümsüzlük, zaman ölçeği,
model sırası) yalnızca `import.meta.env.DEV` altında; üretim paketinde yok. Tüm GLB’lerin +z’ye baktığı sıra
ekran görüntüsüyle doğrulandı (`MODEL_YAW` hepsi 0).

## Önerilen rozet / görev eklemeleri (entegrasyona)
- **Roshan Avcısı**: `picks['arena:roshan'] ≥ 1` · **Aegis Koleksiyoncusu**: `≥ 5`.
- **Dört Yüz**: dört kahramanın hepsinde `picks['arena:h:<id>'] ≥ 1200`.
- **On Dalga**: `picks['arena:dalga'] ≥ 10`.
- Kahraman rozetleri: “Kesin Hüküm” (Balta ≥ 8.000), “Buz Devri” (Buz Cadısı ≥ 8.000), “Görünmez Kâbus” (Gölge ≥ 8.000).
- Günlük görev fikirleri: “Arena’da Roshan’ı kes”, “Balta/Buz/Gölge ile ilk dalgayı temizle” (kahraman skoru ≥ 1.200).
- `THRESHOLDS.arenaEfsane` (6.000) yeni ekonomiyle 4–5 dalgaya denk geliyor; istenirse 10.000’e çekilebilir.
