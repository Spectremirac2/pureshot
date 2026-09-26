# 1vDOQUZ Arena — Kalıcı ilerleme (faz C)

Parıltı Taşı, Aghanim Kütüphanesi, kahraman ustalığı, Lanet seviyeleri ve Kodeks. Tasarım çerçevesi:
[ARENA-TASARIM.md](ARENA-TASARIM.md) §1 (roguelite araştırması), §5 (kalıcı gelişim), §8 (sözleşme). Oyunun kendisi:
[oyunlar/arena.md](oyunlar/arena.md).

**İlke:** kalıcı ilerleme ham güç değil **seçenek** açar. Ustalığın ham istatistiği toplamda **en çok %5**’tir
(+%2 can, +%2 hasar, +%1 altın). Geri kalan her şey artısı ve eksisi olan yetenek varyantı, eşdeğer değerde başlangıç
çantası, kozmetik ya da isteğe bağlı zorluktur (Lanet). Günlük meydan okuma “herkes aynı koşulda” kalsın diye ustalık
bonusu, varyantlar ve özel çantalar orada kapalıdır (kozmetik açık).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `src/sections/games/arena/progression.js` | Saf çekirdek (DOM yok; Node’da çalışır): veri, ekonomi, kayıt, API, tembel arayüz sarmalayıcıları |
| `src/sections/games/arena/library.js` + `library.css` | Aghanim Kütüphanesi ekranı, Lanet seçici, ortak parçalar (Parıltı taşı, amblem, rütbe madalyası) |
| `src/sections/games/arena/mastery.js` | Kahraman ustalık paneli, koşu sonu ödül kartı (stilleri `library.css`’te) |
| `src/sections/games/arena/codex.js` + `codex.css` | Kodeks ekranı |
| `src/core/badges.js` · `src/core/quests.js` · `src/core/icons.js` | 6 yeni Arena rozeti, `arenaEfsane` 10.000, 1 yeni görev, `shard` / `book` / `unlock` ikonları |

Arayüz parçaları **tembel** yüklenir: `progression.mountLibrary(...)` vb. `import('./library.js')` yapar; derlemede
library ≈ 26 KB, mastery ≈ 12 KB, codex ≈ 16 KB JS (+ CSS) ayrı parçalardır. Arena paketine yalnızca `progression.js` girer.

## API (`progression.js`)

```js
import {
  // profil ve koşu
  getProfile,          // () → { shards, earned, spent, heroes: { [id]: { xp, rank, tier, variants, unlocked, lockable, cost, next, pct, runs, best, bestWave, loadout } },
                       //        unlocks, curseMax, curse, proof, pools, codex: { units: [id], bosses, items, story, counts }, stats, global, story }
  applyMeta,           // (runConfig) → YENİ runConfig (heroId, curse, random, modifiers, meta)
  grantRunRewards,     // (result) → { shards, heroXp, rankUp, unlocked, newCodex, affordable, breakdown, firsts, balance, hero, heroBefore, curse, mode, stars, newStars, duplicate }
  computeRewards,      // (result, profil?) → saf hesap (simülasyon/test)
  trackGame,           // (g) → kapatma fn · oyunun olay veri yolundan Kodeks’i doldurur
  recordStoryChapter,  // (n) → { shards, first } · hikâye bölümü ilk kez bitti: +50, picks['arena:story']
  // kahramanlar
  isHeroUnlocked, unlockCost, unlockHero, heroSummary, heroInfo, heroIds, heroKey, isLockable, heroVariants, abilityIdOf,
  // Kütüphane
  buyNode, nodeStatus, libraryState, nodeOf, BRANCHES, NODES, HERO_UNLOCK_COSTS,
  // seçimler (sonraki koşu)
  setLoadout, setGlobalCosmetics, setCurse, getCurse, curseMax,
  // Lanetler
  CURSES, MAX_CURSE, CURSE_PROOF_WAVE, curseInfo, curseModifiers, mergeModifiers, MODIFIER_KEYS,
  // ustalık, çanta, kozmetik
  MASTERY_TIERS, rankOf, masteryStats, VARIANTS, KITS, DEFAULT_KIT, resolveKit, itemValue, COSMETICS,
  // Kodeks
  markSeen, isSeen, codexId, codexCatalog, registerCodex, CODEX_KINDS, DOG_IDS,
  // kayıt
  META_KEY, META_STORAGE_KEY, META_VERSION, exportMeta, importMeta, migrate, sanitizeProfile, resetMeta, reloadMeta, flushMeta,
  subscribeMeta, connectStore, ECONOMY, SHARD_NAME, BASE_HEROES, LOCKED_HEROES, HERO_ALIASES,
  // arayüzler (tembel; hepsi temizlik fonksiyonu döndürür)
  mountLibrary,        // (el, ctx?: { branch?, onClose?, onHero?(id), onCodex?, onChange?(profil), title? })
  mountHeroMastery,    // (el, heroId, ctx?: { onClose?, onLibrary? })
  mountCodex,          // (el, ctx?: { kind?: 'units'|'bosses'|'items'|'story', onClose? })
  mountRunRewards,     // (el, rewards, ctx?: { onLibrary?, onHero?(id) })
  mountCursePicker,    // (el, ctx?: { onChange?(seviye) })
} from './progression.js';
```

`library.js`, `mastery.js` ve `codex.js` aynı adlı fonksiyonları eşzamanlı olarak da dışa aktarır (doğrudan içe aktaran
hemen çizer). Kahraman kimlikleri heroes.js’tekilerdir: **`okcu`, `balta`, `buz`, `golge`, `simsek` (Şimşek Ruhu),
`agac` (Ağaç Bekçisi)**. Tasarım belgesindeki `storm` / `treant` (ve `archer`, `brute`, `frost`, `shadow`) `heroKey`
ile otomatik çevrilir.

### `applyMeta(runConfig)`
Girdiyi değiştirmez, yeni nesne döndürür. Girdi: `{ mode: 'endless'|'story'|'daily', heroId, seed, curse?, random?,
allowLocked?, missionId?, modifiers?, meta?, … }` (diğer alanlar olduğu gibi geçer).

- **heroId:** kilitli ya da heroes.js’in tanımadığı kahraman ilk açık kahramana düşer (`meta.heroFallback`).
  `allowLocked: true` hikâyenin “misafir kahraman” görevleri içindir. `random: true` + Kütüphane’de *Rastgele Seçim*
  → açık kahramanlardan biri (`seed` ile tekrarlanabilir), `cfg.random = true`.
- **curse:** verilmezse Sonsuz modda oyuncunun seçtiği Lanet (`setCurse`), hikâye/günlükte 0. Açılan en yüksek seviyeye
  kırpılır; günlük modda gelen değer kırpılmaz (günün koşulu herkes için aynı).
- **modifiers:** `mergeModifiers(runConfig.modifiers, Lanet değiştiricileri + scoreMul, ustalık)`; ustalık
  `heroHp`/`heroDmg`/`gold` çarpanları (≤ %5) ve çanta altını `startGold` olarak eklenir. Kurallar `MODIFIER_KEYS`’te
  (mul / add / max / min / or).
- **meta:**

```js
meta: {
  version: 1, heroId, mode, fair /* günlük */, random, heroFallback?,
  curse: { level, name, scoreMult, shardMult },
  startItems: ['tango', …],        // game.js g.start: envantere bedelsiz eklenir (Arena 3.0 bunu zaten yapıyor)
  startGold: 250,                  // modifiers.startGold'a da eklendi
  kit: { id, name },
  mastery: { tier, rank, color, xp, hpPct, dmgPct, goldPct },
  variants: { okcu_shot: 'okcu_volley' },   // YETENEK KİMLİĞİ → varyant (game.js g.variant(abilityId))
  variantSlots: { q: 'okcu_volley' },       // aynı seçim tuşla
  cosmetics: { aura: { id, name, color, color2?, style? } | null, trail: { id, name, color, kind } | null,
               courier: { id, name, color } | null, stamp: bool, title: 'Ölümsüz' | null },
  pools: { neutralChoice: 1–3, neutralReroll: 0–1 },
}
```

### `grantRunRewards(result)`
`result` = oyunun `runEnd` yükü: `{ mode, score, wave, heroId, stats, victory, curse, objectives }` (Arena 3.0 hepsini
gönderir) + hikâye için `stars`, `missionId`. Eksik `mode` / `curse` / `random` / `missionId` son `applyMeta`’dan alınır.
`stats`’tan okunanlar: `bossKills` → yoksa `bosses` → yoksa `roshans`/`roshanKills`, `items`, `kills`, `time`.
Değerler temizlenir ve sınırlanır (dalga ≤ 999, yıldız 0–3, boss ≤ 100). **Çift ödül yok:** aynı sonuç 30 dk içinde
tekrar gelirse kaydedilmiş ödül `duplicate: true` ile döner. Dönüş:

| Alan | İçerik |
|---|---|
| `shards` | Bu koşunun toplam Parıltı’sı (Lanet × Rastgele çarpanlı taban + ilk kez bonusları + ilk yıldız + günlük) |
| `heroXp` · `hero` · `heroBefore` | Ustalık XP’si; sonrası `{ id, name, color, xp, tier, rank, rankColor, pct, next, nextName, into, need }` |
| `rankUp` | `{ heroId, from, to, tier, color }` ya da `null` |
| `unlocked` | `[{ kind: 'variant'|'kit'|'aura'|'trail'|'title'|'stat'|'curse', id, name, … }]` (kademe atlama + “Lanet N açılabilir”) |
| `newCodex` | Bu koşuda Kodeks’e ilk kez girenler `[{ kind, id, name }]` |
| `affordable` | Bu ödülle ilk kez alınabilir olan Kütüphane düğümleri |
| `breakdown` · `firsts` | Satır satır döküm (ödül kartı bunu gösterir) |

## Ekonomi

### Parıltı Taşı (`ECONOMY`)
- **Sonsuz:** `2 (katılım) + round(3,5 × T + ⌊0,15 × T²⌋) + 10 × boss`, T = temizlenen dalga (`wave − 1`, zaferde `wave`).
- **Hikâye:** `10 + 10 × yıldız + 10 × boss`; ilk kez kazanılan her yıldız +25 (görev başına en çok +75).
  Bölüm ilk kez bitince `recordStoryChapter(n)`: +50.
- **Günlük meydan okuma:** dalga formülü + günde bir kez **sabit +40** (İstanbul günü).
- **Çarpanlar** (yalnız tabana): Lanet `1 + 0,1 × seviye` (×1,1 … ×2,0), Rastgele Seçim ×1,15.
- **İlk kez** (bir kez, çarpansız): ilk koşu +10 · 5./10./15./20. dalga +15/+30/+50/+80 · ilk boss +20 ·
  her kahramanla ilk 5. dalga +10 · her Lanet seviyesinde ilk 5. dalga (ya da hikâye zaferi) +10 × seviye.
- **Kodeks ödülleri** (Kütüphane’de toplanır): +30 / +40 / +40 / +80 / +100 = +290.
- **Arena 2.0 mirası:** meta kaydı ilk kez oluşurken eski `arena:v2` koşuları hoş geldin hediyesine döner
  (koşu başına 6, en çok 150 Parıltı) ve kahraman rekorları ustalık XP’sine (rekor / 40, en çok 450).

Koşu başına Parıltı (ilkler hariç):

| Dalga | Roshan | Lanetsiz | Lanet 3 | Lanet 5 | Lanet 10 | Ustalık XP (L0 / L5) |
|---|---|---|---|---|---|---|
| 3 | 0 | 9 | 12 | 14 | 18 | 26 / 33 |
| 5 | 0 | 18 | 23 | 27 | 36 | 42 / 53 |
| 8 | 1 | 44 | 57 | 66 | 88 | 76 / 95 |
| 11 | 2 | 72 | 94 | 108 | 144 | 110 / 138 |
| 16 | 3 | 118 | 153 | 177 | 236 | 160 / 200 |
| 21 | 4 | 172 | 224 | 258 | 344 | 210 / 263 |

Hikâye görevi 3 yıldız: ilk kez 115, sonra 40 Parıltı; 65 ustalık XP’si.

### Kütüphane bedelleri — toplam 10.945 Parıltı
Kahramanlar 1.300 (Şimşek Ruhu / Ağaç Bekçisi: ilk açılan **300**, ikincisi **450**; Rastgele Seçim 200; Ustalık Mirası 350) ·
Eşya havuzları 1.570 · Lanetler 4.245 (70 → 980) · Kozmetik 3.430 · Kodeks 400.

### Tempo (simülasyon)
`scratchpad/arenaC/tests/sim.mjs` gerçek API’yi sürer: üç oyuncu modeli (ilk koşuların ortalama dalgası → ustalaşınca:
gündelik 4 → 10, orta 5 → 13, usta 7 → 17; Lanet başına −0,5…−0,7 dalga), dalga başına ≈ 66 sn + 45 sn kurulum,
her 1,5 saatte bir günlük meydan okuma, koşuların ~%25’i hikâye (lanetsiz), altı kahraman sırayla, açgözlü harcama
(önce yeni kahraman, sonra Lanet, sonra en ucuz). 8 tohumun medyanı:

| Kilometre taşı | Gündelik | Orta | Usta |
|---|---|---|---|
| İlk yeni kahraman | 0,6 sa · 6 koşu | 0,5 sa · 5 koşu | 0,5 sa · 4 koşu |
| İkinci yeni kahraman | 2,9 sa | 2,2 sa | 2,0 sa |
| Lanet 5 açık | 28 sa | 8,4 sa | 6,5 sa |
| Hikâye bitti (5. bölüm) | 38 sa | 20,5 sa | 18,2 sa |
| **Kütüphane tamam** | — (Lanet kanıtında takılır) | **21,9 sa** | **18,3 sa** |
| Kazanılan Parıltı: 5 / 10 / 20 sa | 1.634 / 3.336 / 7.021 | 2.144 / 4.521 / 10.178 | 2.565 / 5.418 / 12.115 |

İlk yeni kahraman ≈ 3–5 iyi koşuda gelir (ilk koşudaki ilk kez bonusları + 3–4 orta koşu). Kütüphanenin tamamı orta
oyuncu için ≈ 20–25 saat; gündelik oyuncu Parıltı’yı biriktirse de son Lanetler beceri kanıtı ister (Lanet N−1 ile 5.
dalga) — bu bilinçli: Lanetler güç değil zorluktur. Tek kahramanla Immortal ≈ 23–33 koşu (8–11. dalga koşuları; orta oyuncuda 4–6 saat).

## Kahraman ustalığı (`MASTERY_TIERS`)

| Kademe | XP | Açılanlar |
|---|---|---|
| Herald | 0 | Temel kit, Tango Paketi çantası |
| Guardian | 70 | Kahraman aurası (kendi rengi) · +%1 can |
| Crusader | 220 | 1. yetenek varyantı |
| Archon | 450 | Kahramana özel başlangıç çantası · +%1 hasar |
| Legend | 800 | 2. yetenek varyantı |
| Ancient | 1.250 | Kahraman izi · +%1 altın |
| Divine | 1.800 | Ulti varyantı (Aghanım tarzı) · +%1 can |
| Immortal | 2.500 | Ölümsüz aurası + “Ölümsüz” unvanı · +%1 hasar |

Ustalık XP’si: sonsuz/günlük `10 + 8 × T + 10 × boss`, hikâye `20 + 15 × yıldız + 10 × boss`; × (1 + 0,05 × Lanet),
Rastgele ×1,1, *Ustalık Mirası* açıksa Legend altındaki kahramanlara ×1,25; koşu başına en çok 600.

### Yetenek varyantları (`VARIANTS`) — game.js’in okuyacağı kimlikler
`meta.variants[yetenekKimliği] === varyantKimliği` ise varyant etkin (`g.variant('okcu_shot') === 'okcu_volley'`).
Her biri bir tuşun yerine geçer; varsayılana dönmek her zaman serbest.

| Kahraman | Crusader | Legend | Divine (Aghanım tarzı) |
|---|---|---|---|
| Okçu | `okcu_volley` Q Yaylım Ateşi: şarj yok, 3 okluk yelpaze, ok başına %45, delmez | `okcu_gale` W Kasırga Adımı: kaçınma yerine 3 birim itme + 1 sn yavaşlatma, süre 2,5 sn | `okcu_rain` R Ok Yağmuru: korku/sersemletme yok, alana 3 sn ok (toplam %140), Aghanım +1 sn |
| Balta | `balta_roar` Q Meydan Okuma: yarıçap −%30, hasar azaltma %60, +1 sn | `balta_blood` W Kanlı Helezon: pasif dönme yok, aktif 2 tur + isabet başına can | `balta_mass` R Toplu Hüküm: 2,5 yarıçapta infaz, eşik −%25, bekleme sıfırlanmaz |
| Buz Cadısı | `buz_shards` Q Buz Kıymıkları: yavaşlatma yok, 5 kıymık, tek hedefe +%60 | `buz_ward` E Kış Kalkanı: pasif mana yok, aktif 4 sn mana kadar kalkan | `buz_blizzard` R Gezgin Tipi: kanal yok, seni izleyen −%35 yarıçaplı fırtına, 6 sn |
| Gölge | `golge_mark` Q Av İşareti: ışınlanma yok, 4 sn +%25 alınan hasar, menzil ½, −2 sn | `golge_decoy` W Gölge İkizi: görünmezlik yerine 4 sn yem ikiz, ilk vuruş bonusu yok | `golge_eclipse` R Tutulma: sıçrama yok, 3 sn yerinde saniyede 3 kritik, dokunulmazlık yok |
| Şimşek Ruhu | `simsek_drift` Q Gezgin Kalıntı: en yakın düşmana süzülür, tek kalıntı, +%40 | `simsek_pulse` W Girdap Darbesi: çekme/kök yok, dışarı itme + 1,5 sn yavaşlatma | `simsek_short` R Kısa Devre: en çok 5 birim, sabit mana, varışta Aşırı Yük hazır |
| Ağaç Bekçisi | `agac_bloom` Q Çiçek Açan Örtü: görünmezlik yok, 5 sn %30 yavaşlatan alan, iyileşme ×2 | `agac_thorns` W Dikenli Kökler: can emme yok, 2 birim çevre de köklenir, hasar −%30 | `agac_grove` R Kutsal Koru: kök yok, 6 sn %3/sn can + %40 yavaşlatan koru |

### Başlangıç çantaları (`KITS`) — hepsi ≈ 340–450 altın
Yuvalar aday listesidir; items.js’te bulunamayan (ya da tarifli/düşen/orman) eşya aynı değerde altına döner.
`k_basic` Tango Paketi + 250 altın (herkese açık) · `k_purse` 350 altın, `k_wand` Sihirli Sopa + Demir Dal + 90 (Tüccar
Heybesi) · `k_boots` Koşu Botları, `k_twin` 2 Tango + Demir Dal + 110 (Kurye Heybesi) · Archon: `k_okcu` Çevik Eşarp,
`k_balta` Kuvvet Kemeri, `k_buz` / `k_simsek` Bilge Cübbesi, `k_golge` Hız Eldiveni, `k_agac` Yenilenme Yüzüğü + Demir Dal + Tango.

### Kozmetik (`COSMETICS`)
Aura: kahraman aurası (Guardian), `a_ember`, `a_arcane`, `a_dire`, `a_aegis` (Kütüphane), Ölümsüz aurası (Immortal) ·
İz: kahraman izi (Ancient), `t_sparks`, `t_paws`, `t_river`, `t_ether` · Kurye: `cr_ghost`, `cr_gold` · Damga: üçlü ve üstü
öldürmede “DOG DOG DOG”. Aura/iz kahraman başına ustalık panelinden, kurye/damga hesap geneli Kütüphane’den takılır.

## Lanet seviyeleri (`CURSES`) — birikimli
N. seviye 1..N’nin hepsini içerir. Değerler Arena 3.0 `game.js curseMods(N)` ile **birebir** aynıdır (Node testi
karşılaştırır); `applyMeta` aynı anahtarları `modifiers`’a yazar, skor çarpanını `scoreMul` olarak ekler.

| Sv. | Ad | Değiştirici | Skor | Parıltı |
|---|---|---|---|---|
| 1 | Hızlı Sürü | `enemySpeed: 1.1` | ×1,12 | ×1,1 |
| 2 | Kalın Post | `enemyHp: 1.15` | ×1,24 | ×1,2 |
| 3 | Pahalı Dükkân | `shopCost: 1.2` | ×1,36 | ×1,3 |
| 4 | Uzun Geceler | `dayLen: 60, nightLen: 180` | ×1,48 | ×1,4 |
| 5 | Kurye Grevde | `noCourier: true` | ×1,6 | ×1,5 |
| 6 | Sert Isırık | `enemyDmg: 1.2` | ×1,72 | ×1,6 |
| 7 | Aç Roshan | `roshanEvery: 4` | ×1,84 | ×1,7 |
| 8 | Elit Sürü | `extraElites: 2` | ×1,96 | ×1,8 |
| 9 | Ay Tutulması | `alwaysNight: true` | ×2,08 | ×1,9 |
| 10 | Dokuzun Laneti | `gold: 0.75` | ×2,2 | ×2,0 |

Lanet N’yi **Kütüphane’de açmak** için (Parıltı’nın yanında) Lanet N−1 ile 5. dalgaya ulaşmak (ya da hikâye görevini
kazanmak) gerekir; kanıt `proof[N−1]`’de tutulur. Günlük meydan okumanın laneti kanıt sayılmaz.

## Aghanim Kütüphanesi (`BRANCHES`, `NODES`)

| Dal | Düğümler (bedel) |
|---|---|
| Kahramanlar | `h_simsek` Şimşek Ruhu, `h_agac` Ağaç Bekçisi (300 → 450) · `h_random` Rastgele Seçim 200 (bir yeni kahraman sonrası) · `h_legacy` Ustalık Mirası 350 |
| Eşya havuzları | `i_merchant` Tüccar Heybesi 120 → `i_courier` Kurye Heybesi 250 (çantalar) · `i_neutral1` Orman Sandığı 200 (orman eşyasında 2 seçenek) → `i_neutral2` Harpi Hazinesi 400 (3 seçenek) → `i_neutral3` Yaşlı Koru Takası 600 (molada bir takas) |
| Lanetler | `curse_1` … `curse_10`: 70, 115, 170, 240, 320, 410, 520, 640, 780, 980 |
| Kozmetik | auralar 120 / 180 / 250 / 420 · izler 200 / 280 / 360 / 480 · Hayalet Kurye 340 → Altın Kurye 500 · Damga 300 |
| Kodeks | ödül: `x_dogs` 10 DOG +30, `x_units` tüm birimler +40, `x_items` 20 dükkân eşyası +40, `x_bosses` 5 boss +80, `x_story` tüm hikâye kartları +100 · satın alma: `x_lens` Kâşif Dürbünü 150 (görülmeyenin ipucu) → `x_lore` Kurye’nin Notları 250 |

Ekran: dallar (masaüstünde dikey liste, dar kapsayıcıda yatay kaydırmalı sekmeler), altıgen düğümlü ağaç (bağlantılar
SVG; altın = açık, mor = açılabilir yol, kesikli = kilitli), sağda/altta ayrıntı paneli. Satın alma **iki adımlı**
(“Aç” → “Onayla”, 4,5 sn). Kahramanlar dalının altında altı kahramanın ustalık çipleri (ustalık panelini modalde açar),
Lanetler dalında “Sonraki koşunun laneti” seçici, Kodeks dalında koleksiyon ilerlemesi. Yerleşim kapsayıcı sorgularıyla
(container queries) yapılır: sayfaya da, arena sahnesindeki dar bir karta da yerleşir.

## Kodeks
Türler: `units`, `bosses`, `items`, `story` (tekil adlar da kabul). Kimlikler oyunun `UNITS` tablosuyla aynıdır:
`dog_<tür>`, `creep_melee|ranged`, `neutral_wolf|alpha|harpy`, `tower_dire`, `boss_roshan|feedalfa|shadow|general|ancient`;
eşyalar `ITEMS` + `NEUTRALS` kimlikleri; hikâye kartları `ch1`–`ch5` (+ `registerCodex('story', [...])` ile eklenenler).
`codexId` takma adları çevirir (`'feed'` → `dog_feed`, `'roshan'` → `boss_roshan`, `'alfa'` → `boss_feedalfa`).
`trackGame(g)` şunları dinler: `spawn`, `unitKilled` (`d.id`), `bossKilled` (`d.id`), `itemBought`, `neutralDrop`,
`neutralEquip`, `towerDown`, `runStart` (tanıtım DOG’ları sayılmaz). `markSeen` yazımı 400 ms toplanır.

## Kayıt
`localStorage['csk:arena:meta:v1']` (`ls` anahtarı `arena:meta:v1`):

```js
{ v: 1, created, updated, shards, earned, spent,
  heroes: { [id]: { xp, runs, best, bestWave, loadout: { variants: { q: id }, kit, aura, trail } } },
  unlocks: { [düğüm]: zaman }, curse, proof: { [lanet]: enİyiDalga },
  codex: { units: { [id]: zaman }, bosses, items, story }, firsts: { [anahtar]: zaman }, story: { [görev]: yıldız },
  daily: { [gün]: 1 } /* son 40 */, stats: { runs, bestWave, bosses, shardsFromRuns },
  global: { courier, stamp }, last /* son applyMeta */, lastGrant /* çift ödül koruması */, pendingPicks }
```

- **Göç:** `migrate(raw)` — v1 doğrulanıp temizlenir (sonlu sayılar, sınırlar, güvenli anahtarlar, `__proto__` yok);
  v0 taslağı (`{ shards, xp: { kahraman: n } }`) v1’e taşınır; gelecek sürüm (v > 1) okunur ama üzerine yazılmaz.
- **Profil dışa/içe aktarma:** profil sayfası zaten tüm `csk:` anahtarlarını aktarır; içe alınan kayıt okunurken
  `migrate` ile temizlenir. Ayrıca `exportMeta()` / `importMeta(obj)`.
- **Rozet seçimleri:** `store.me.picks['arena:lanet']` (5. dalgaya ulaşılan en yüksek Lanet) ve `['arena:story']`
  (en yüksek biten bölüm, 1–5). Veri katmanı bağlı değilse `pendingPicks`’te bekler; `connectStore(store)` boşaltır
  (library/mastery/codex parçaları kendiliğinden bağlanır).
- Başka sekmede değişen kayıt `storage` olayıyla önbellekten düşer; `subscribeMeta(fn)` açık ekranları günceller.

## Rozetler ve görevler
Yeni rozetler (toplam 37): **Roshan Avcısı** (`picks['arena:roshan'] ≥ 1`), **On Dalga** (`arena:dalga ≥ 10`),
**Dört Yüz** (dört ana kahramanın her biriyle `arena:h:<id> ≥ 1.200`), **Lanet Ustası** (`arena:lanet ≥ 5`),
**Kurye’nin Yoldaşı** (`arena:story ≥ 1`), **Lanet Kırıcı** (`arena:story ≥ 5`). `THRESHOLDS.arenaEfsane` 6.000 → 10.000.
Yeni görev: **arenaRoshan** “1vDOQUZ Arena’da Roshan’ı kes” (`picks['arena:roshan']` − günün görüntüsündeki `ar`).
Ayrıntı: [oyunlar/rozetler.md](oyunlar/rozetler.md), [PROFIL.md](PROFIL.md).

## Entegrasyon kontrol listesi (hikâye ajanı / entegrasyon)
1. **mountArena:** `connectStore(coreStore)` (bir kez). `const stop = trackGame(game)` (oyun oluşturulunca; çıkışta `stop()`).
2. **Koşu başlatma:** `game.start(applyMeta({ mode, heroId: save.hero, seed, curse, random, missionId, modifiers, mission }))`.
   Arena 3.0 game.js zaten `config.curse`, `modifiers` (ustalık yüzdeleri `heroHp`/`heroDmg`/`gold` burada),
   `meta.startItems` ve `meta.variants` (ability id) okuyor; `meta.bonus` alanını progression boş bırakır.
   Kalan işler: **varyantların etkileri** (`abilities.js`, tablo yukarıda; `g.variant(abilityId)`), `meta.pools`
   (`neutralChoice` 2–3 seçenekli düşme, `neutralReroll` molada takas), `meta.cosmetics` (aura halkası rengi, iz
   parçacıkları, kurye rengi, damga — isteğe bağlı görsel), `meta.mastery.title` (HUD’da “Ölümsüz”).
3. **Seçim ekranı:** `isHeroUnlocked(id)` ile kilit, `unlockCost(id)` ile fiyat; kilitli karta dokununca
   `mountLibrary(el, { branch: 'heroes' })` ya da `mountHeroMastery(el, id)` (kilit bandında “Aç” düğmesi var).
   `getProfile().unlocks.h_random` varsa “Rastgele” düğmesi → `applyMeta({ …, random: true })`.
   Başlangıç ekranına `mountCursePicker(el)` (yalnızca Sonsuz mod için).
4. **Oyun sonu:** `const rw = grantRunRewards({ ...runEnd, stars, missionId })` → `mountRunRewards(el, rw, { onLibrary, onHero })`.
   Salon skoru (`scores.arena`) Lanet `scoreMul`’lu skorla yazılır (Arena 3.0 kararı; rozet eşikleri buna göre).
5. **Hikâye:** her bölümün ilk bitişinde `recordStoryChapter(n)`; kartları `registerCodex('story', [{ id, name, desc, group }])`
   ve görüldükçe `markSeen('story', id)`; bölüm ödülü olarak kahraman vermek isterse `unlockHero('simsek', { free: true, source: 'bolum2' })`
   (bedelli sıralamayı bozmaz). `missionId` kararlı bir dizge olmalı (ilk kez yıldız bonusu ona bağlı).
6. **Günlük:** `applyMeta({ mode: 'daily', heroId: günün kahramanı, curse: günün laneti, modifiers: günün değiştiricileri, allowLocked: true })`,
   ödülde `day` (İstanbul günü) verilebilir.
7. **Menü:** “Kütüphane” → `mountLibrary(el, { onClose, onHero, onCodex })`, “Kodeks” → `mountCodex(el, { onClose })`.

## Testler
- **Node** (`scratchpad/arenaC/tests/progression.test.mjs`, 17 test): sözleşme, boş profil, Arena 2.0 mirası, ödül
  formülü + ilkler + çift ödül koruması, bozuk girdi, kahraman açma (artan bedel, bedava açma, düşüş), Lanet kanıtı /
  kırpma / birikimli değiştiriciler / **game.js curseMods eşitliği**, ustalık (varyant yetenek kimliğiyle, çanta değerleri,
  ≤ %5), günlük adil koşul + günde bir bonus, hikâye yıldızları + bölüm + seçim boşaltma, Kodeks (takma adlar, ödül,
  `trackGame`, **units.js kimlik eşleşmesi**), Kütüphane kuralları, göç (v0, temizleme, gelecek sürüm, gidiş-dönüş).
- **Simülasyon** (`sim.mjs`): yukarıdaki tempo tablosu.
- **Playwright** (`shots.mjs`, `interact.mjs`; Vite 5202, HMR engelli, `reducedMotion`): 13 sayfa × 1440×900 ve
  390×844 (dokunmatik) ekran görüntüsü; konsol hatası 0, yatay taşma 0; klavye (sekmeler, ağaçta oklar, tek sekme
  durağı, radyo grupları, Kodeks ızgarası), iki adımlı satın alma, ödül toplama, Lanet seçici, kurye kozmetiği, ustalık
  modali (Esc), dokunarak satın alma, 44 px hedefler; tarayıcıda 37 rozet ve 400 günlük görev seçimi kısıtları.
- **Derleme:** `VITE_API_BASE=none npx vite build` geçti; ayrıca yalnızca `progression.js`’i içe aktaran bir giriş
  (tembel parçalar ayrıldı, uyarı yok).
