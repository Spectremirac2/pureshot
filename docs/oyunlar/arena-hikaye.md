# 1vDOQUZ Arena — Hikâye ve modlar (faz D): “Dokuzun Laneti”

Arena’nın başlangıç merkezi, beş bölümlük hikâye kampanyası, günlük meydan okuma ve kalıcı ilerleme ekranlarının
bağlantısı. Tasarım: [../ARENA-TASARIM.md](../ARENA-TASARIM.md) §3 (modlar), §6 (hikâye), §8 (sözleşme). Oyunun
kendisi: [arena.md](arena.md). Kalıcı ilerleme: [../ARENA-ILERLEME.md](../ARENA-ILERLEME.md).

## Özet

Nehrin iki yakasında bitmeyen bir pub maçı sürüyor. Ward alınmayan her gece, unutulan her Aegis’te bir oyuncunun
ruhu DOG’a dönüştü: dokuzu da sürüye katıldı, sen tek kaldın — **1vDOQUZ**. Anlatıcı **Kurye** (kanatlı eşek; hani
şu hep ölen kurye, “burada en kısa yayın yirmi dört saat” diyen) seni nehir kıyısından ormana, kuşatılan kulelere,
Roshan’ın inine ve sonunda lanetin kaynağına, **Sonsuz Pub’ın Kalbi**’ne götürür. Kalp kırılınca DOG’lar yeniden
takım arkadaşına döner: *“Kahramanlar masumdur, DOG’luk oyuncudadır.”* Kurye’nin son sözü: *“Yirmi dört saat oldu.
Isınma turu bitti.”*

Gerçek kişiler hikâyede karakter değildir; kahramanlar ve bosslar özgün. Yayıncıya dair tek gönderme sevgi dolu
“en kısa yayın 24 saat” şakasıdır.

## Dosyalar

| Dosya | İçerik | Paket |
|---|---|---|
| `src/sections/games/arena/story.js` | Saf veri + yardımcılar (DOM yok, Node’da çalışır): `CHAPTERS`, `MISSIONS`, `missionConfig`, `storyRunConfig`, `starsFor`, `storyProgress`, `recordMission`, `triggerMatches`, `SPEAKERS`, `STORY_CODEX`, `FINALE` | tembel parça |
| `src/sections/games/arena/storyui.js` + `story.css` | Bölüm haritası (`mountCampaign`), diyalog kartları (`createDialogue`), final jeneriği (`mountFinale`), portre yardımcısı (`speakerNode`) | tembel parça |
| `src/sections/games/arena/daily.js` | Günlük meydan okuma (İstanbul günü tohumu), yerel günlük rekor | arena paketi (≈3 KB) |
| `src/sections/games/arena/arena.js` | Mod merkezi, günlük ekranı, akış (başlat / diyalog / rapor / menü), Kütüphane-Kodeks-ustalık pencereleri, hikâye raporu | arena paketi |
| `src/sections/games/arena/select.js` | Seçim ekranı bağlamı: Sonsuz (Lanet seçici, Rastgele) ya da görev (hedefler, önerilen/misafir kahraman), kilit bedeli, ustalık düğmesi | arena paketi |
| `src/sections/games/arena/game.js` | Görev altyapısı: ölçek dalgası (`lvl`), `mission.setup`, `mission.prep`, özel hedefler (`objSet/objAdd/objFail`, `hold`), bitince son dalgayı yineleme, birim güçlendirme seçenekleri | arena paketi |

## Modlar ve akış

Arena açılınca **mod merkezi** gelir (3D sahne arkada döner):

| Kart | Ne yapar |
|---|---|
| **Hikâye · Dokuzun Laneti** | Bölüm haritası. Kartta açık olan en yüksek bölümün afişi, yıldız/görev sayısı. |
| **Sonsuz** | Arena 2.0/3.0’ın dalga modu. Kahraman seçimi + **Lanet seçici** (`mountCursePicker`) + (Kütüphane’de açıldıysa) **Rastgele**. Salon skoru `scores.arena` **yalnızca** buradan yazılır. |
| **Günlük** | Günün kahramanı, Laneti ve değiştiricileri, geri sayım, bugünkü rekor → “Meydan okumaya gir”. |
| **Kütüphane** | `mountLibrary` (pencerede; Kodeks’e ve ustalık paneline geçiş). |
| **Kodeks** | `mountCodex` (pencerede). |

Akış: Merkez → **Hikâye** → bölüm sekmesi → görev kartı → brifing (“Göreve başla”) → **kahraman seçimi** (görev
bağlamı: başlık, hedefler, “Önerilen” / “Misafir” rozetleri) → **giriş diyaloğu** → görev (görev içi diyaloglar
olaylarla tetiklenir) → zaferde **çıkış diyaloğu** (V. bölüm ilk kez biterse final diyaloğu + jenerik) → **rapor**:
yıldızlar, hedef listesi, Kurye’nin sözü, bölüm ödülü, `mountRunRewards` kartı → **Sonraki görev / Tekrar oyna /
Harita**. Sonsuz raporu: **Tekrar oyna / Kahraman değiştir / Menü** (+ ödül kartı ve skor tablosu); günlük raporu:
**Tekrar dene / Menü**. Duraklatma ekranındaki menü düğmesi koşu türüne göre “Kahraman seç / Haritaya dön / Menü”dür.

**Kalıcı durum:** oturum içinde son menü `sessionStorage['csk:arena:ui']`’de tutulur; yenileyince merkez ya da en
son açılan harita/seçim/günlük ekranı geri gelir. Yönlendirici sözleşmesi değişmedi (`#oyunlar--arena`).

## Hikâye verisi ve sözleşme

```js
import { CHAPTERS, MISSIONS, missionConfig, storyRunConfig, starsFor, storyProgress, recordMission } from './story.js';
missionConfig('s3m2')      // → { missionId, waves, objectives, victory: 'objectives', failOnObjective: true, prep, modifiers, setup }
storyRunConfig('s2m1', 'agac') // → { mode: 'story', missionId, heroId, curse: 0, modifiers, mission, allowLocked: true (misafir) }
starsFor('s1m1', runEnd)   // 1 = zafer, +1 her tamamlanan bonus hedef (en çok 3)
storyProgress()            // { missions: { id: { stars, wins, plays, best, unlocked, won } }, chapters, stars, maxStars: 45, current, finished, … }
recordMission(id, { victory, stars, time }) // → { stars, newStars, firstWin, chapterDone, finale, next, reward }
```

- **Kilitler:** I. bölüm açık; N+1. bölüm, N’nin boss görevi (3. görev) kazanılınca. Bölüm içinde görevler sırayla.
- **Yıldızlar:** her görevde iki bonus hedef (`optional: true`); ★1 zafer, tamamlanan her bonus +1 yıldız (sırası
  önemsiz, en çok ★3).
  Bonus hedefler: son vuruş, “hiç ölme”, süre sınırı, tür avı, seviye, eşya (ward, Görüş Tozu), “en çok 3 REPORT”.
- **Görev tanımı** (`MISSIONS[id].build()`): Faz B’nin görev şeması — `waves` (dalga başına `lvl` = ölçek dalgası,
  `dogs`, `elites`, `creepSquads`, `boss`/`bossLevel`/`bossAt`, `units[]` gecikmeli ve güçlendirilmiş birimler,
  `night`, `camps`, `text`), `objectives` (kill/boss/waves/survive/time/runes/camps/towers/protect/noDeath/level/item/
  lastHits/custom), `modifiers` (`startLevel`, `startGold`, `bossHp`, `alwaysNight`), `prep` (ilk dalgadan önce dükkân
  molası), `setup(g)` (görev betiği).
- **Diyaloglar** (`MISSIONS[id].dialogue`): `intro`, `triggers` (`{ on: 'waveStart'|'bossSpawn'|'bossPhase'|
  'bossShieldBreak'|'objective'|'story', wave?, phase?, boss?, id?, progress?, done?, key?, cards }`, koşu başına bir
  kez), `win`, `lose` (raporda Kurye’nin sözü). Kart: `{ who: 'kurye'|'hero'|'hero:<id>'|'dog:<tür>'|boss, text,
  alt?: { <kahraman>: metin }, card?: kodeks kartı, quote? }`.

## Bölümler ve görevler

Başlangıç altını = görev altını + başlangıç çantası (Tango Paketi + 250). Yüksek seviyeden başlayan görevlerde
başlangıç yetenek puanları kendiliğinden dağıtılır; yetenek ağacı seçimi oyuncuda kalır (hazırlık molası olan
görevlerde ağaç penceresi molanın başında açılır, kapanınca dükkân gelir). “Ölçek” = DOG/creep/orman
gücünün eşit olduğu Sonsuz dalga numarası (`lvl`).

### I · Nehir Kıyısı

| Görev | Tür | Zorunlu hedef | ★2 · ★3 | Başlangıç | Dalgalar (ölçek) | Boss | Önerilen |
|---|---|---|---|---|---|---|---|
| `s1m1` Kıyıdaki Kurye | Koruma | 2 dalgayı temizle + Radiant kuleleri ayakta kalsın | 12 son vuruş · Hiç ölme | 1. sv · 250 altın | 2 (1/2) | — | Okçu, Balta |
| `s1m2` Nehrin Rünleri | Rün avı | 3 rün topla (rünler 14 sn’de bir) | 5 Feed Köpeği · 200 sn içinde | 2. sv · 400 altın | 3 (2/3/4) | — | Gölge, Okçu |
| `s1m3` Feed Alfa | Boss | Feed Alfa’yı yen | 8 Feed Köpeği · Hiç ölme | 3. sv · 550 altın | 2 (3/4) | Feed Alfa (k1, can ×0,7) | Balta, Buz Cadısı |

Diyaloglar: Kurye kendini tanıtır (“bugün ölmemeye kararlıyım”), lanetin nasıl başladığını anlatır; 2. dalgada creep
uyarısı; rün görevinde ilk rünle cesaretlendirme; Feed Alfa “HAV! DALIYORUM! PLAN YOK! DOG DOG DOG!” diye girer,
%50’de öfkelenir, düşünce “Neden hep ilk ben dalıyordum?” diye sorar.

### II · Wardsız Orman — bölüm ödülü: Ağaç Bekçisi

| Görev | Tür | Zorunlu hedef | ★2 · ★3 | Başlangıç | Dalgalar (ölçek) | Boss | Önerilen |
|---|---|---|---|---|---|---|---|
| `s2m1` Kamp Ateşleri | Orman | 3 orman kampı temizle | 9. seviye · 240 sn içinde | 5. sv · 700 altın | 3 (4/5/6), kamplar her dalgada | — | Ağaç Bekçisi, Balta · **misafir: Ağaç Bekçisi** |
| `s2m2` Karanlıkta Hayatta Kal | Gece | 150 sn hayatta kal (hep gece) | 6 Wardsız DOG · Gözcü Ward’ı al | 6. sv · 850 altın | 3 (5/6/7) | — | Buz Cadısı, Okçu |
| `s2m3` Gölge Ulusu | Boss | Gölge Ulusu’nu yen | Görüş Tozu al · Hiç ölme | 7. sv · 1.050 altın · 12 sn hazırlık | 2 (6/7), gece | Gölge Ulusu (k1, can ×0,8) | Gölge, Balta |

Diyaloglar: Ağaç Bekçisi ormanını temizletir ve misafir olur; Wardsız Köpek “Ward mı? O ne? Biz destek oynuyoruz.”;
Gölge Ulusu “Ward’larınızı yedim”, düşerken “Bir ward alsaydım…”.

### III · Kule Kuşatması

| Görev | Tür | Zorunlu hedef | ★2 · ★3 | Başlangıç | Dalgalar (ölçek) | Boss | Önerilen |
|---|---|---|---|---|---|---|---|
| `s3m1` Kuleyi Savun | Savunma | 4 dalga + Radiant kuleleri ayakta | 40 son vuruş · Hiç ölme | 7. sv · 2.050 altın · 15 sn hazırlık | 4 (5/6/7/8), 2–3 creep mangası | — | Buz Cadısı, Ağaç Bekçisi |
| `s3m2` Karşı Hücum | Kuşatma | Bir Dire kulesini yık | 3 Rapier Köpeği · 300 sn içinde | 8. sv · 2.450 altın · 15 sn hazırlık | 3 (6/7/8) | — | Balta, Gölge |
| `s3m3` Dire Generali | Boss | Dire Generali’ni yen | 12 creep · Hiç ölme | 9. sv · 2.850 altın · 15 sn hazırlık | 2 (7/8) | Dire Generali (k1, can ×0,85, Dire kapısında) | Okçu, Buz Cadısı |

Diyaloglar: General’in tek kelimelik emirleri (“Dalın.” “Dalın. Dedim.”), Rapier Köpeği “Düşürmeyiz, söz!”, Kurye:
“Her maçta böyle derler. Her maçta düşürürler.”; General “Salon II’deki Balta’ya çok benziyordu; aile meselesi”.

### IV · Roshan’ın İni — bölüm ödülü: Şimşek Ruhu

| Görev | Tür | Zorunlu hedef | ★2 · ★3 | Başlangıç | Dalgalar (ölçek) | Boss | Önerilen |
|---|---|---|---|---|---|---|---|
| `s4m1` Aegis’i Kazan | Roshan çukuru | Roshan’ı yen + **Aegis’i al** (özel hedef) | 210 sn içinde · Hiç ölme | 10. sv · 3.250 altın · 15 sn hazırlık | 2 (7/8) | Kaya Canavarı (k2, çukurda) | Balta, Ağaç Bekçisi |
| `s4m2` Chat’i Sustur | Sessizlik | 12 Chat Köpeği | **En çok 3 REPORT ye** (özel, `hold`) · Hiç ölme | 11. sv · 3.550 altın · 15 sn hazırlık | 3 (7/8/9) | — | Şimşek Ruhu, Okçu · **misafir: Şimşek Ruhu** |
| `s4m3` Kaya Canavarı | Boss | Kaya Canavarı’nı yen | 200 sn içinde · Hiç ölme | 12. sv · 3.850 altın · 15 sn hazırlık | 2 (8/9) | Kaya Canavarı (k3, çukurda; %50’de betik diyaloğu) | Gölge, Okçu |

Diyaloglar: “Biri ‘Rosh ne zaman çıkıyor?’ diye kırk kez sorunca adını değiştirmiş”; Chat Köpeği “…mute mu attın?”;
Kaya Canavarı “Uyandırmayın. Sekiz ila on bir dakika.”

### V · 1vDOQUZ

| Görev | Tür | Zorunlu hedef | ★2 · ★3 | Başlangıç | Dalgalar (ölçek) | Boss | Önerilen |
|---|---|---|---|---|---|---|---|
| `s5m1` Dokuz DOG Lordu | Lordlar | 9 DOG lordunu indir (`tag: 'lord'`: elit, can ×2,4, ölçek ×1,3, “LORD” etiketi) | 420 sn içinde · Hiç ölme | 13. sv · 4.250 altın · 20 sn hazırlık | 3 (8/9/10), dalga başına 3 lord (0/5/10 sn) | — | Okçu, Şimşek Ruhu |
| `s5m2` Son Kule | Son savunma | 150 sn hayatta kal + son kule ayakta (diğeri yıkık başlar; kalan kule can ×1,6, +3 zırh) | 40 son vuruş · Hiç ölme | 13. sv · 4.550 altın · 20 sn hazırlık | 3 (8/9/10) | — | Ağaç Bekçisi, Buz Cadısı |
| `s5m3` Kalbi Kır | Final | Sonsuz Pub’ın Kalbi’ni kır | 360 sn içinde · Hiç ölme | 14. sv · 5.050 altın · 20 sn hazırlık | 1 (10) | Sonsuz Pub’ın Kalbi (k2, `bossAt: 'center'`) | Balta, Gölge |

Diyaloglar: Kurye dokuz lordu tek tek sayar (“farm’cı, ‘ilk ben dalarım’ diyen, ‘1 dk’ deyip giden…”); Kalp “Yirmi
dört saat… Kırk sekiz saat… Maç hiç bitmez”; kalkan evresinde muhafız uyarısı; “Maç… bitti mi?” — “Bitti.”

**Final** (V. bölüm ilk kez bitince): Feed, Wardsız ve Chat Köpekleri insana döner (“Bir ward aldım. İlk kez.
Güzelmiş.”, “…gg wp.”), Kurye sitenin sözünü söyler, jenerik kartı: “Dokuzun Laneti kırıldı”, yıldız toplamı,
son satır *Yirmi dört saat oldu. Isınma turu bitti.*

## İlerleme bağlantıları (ARENA-ILERLEME.md kontrol listesi)

| Madde | Uygulama |
|---|---|
| 1 | `connectStore(coreStore)`, `trackGame(game)` (arena açılınca; kapanınca durdurulur) |
| 2 | Her başlatma `applyMeta({ mode, heroId, seed, curse, random, missionId, modifiers, mission, allowLocked })` |
| 3 | Seçim ekranında `isHeroUnlocked` kilidi + `unlockCost` bedeli + “Kütüphane’de aç”; “Ustalık” → `mountHeroMastery`; Sonsuz’da `mountCursePicker`; `h_random` açıksa “Rastgele” |
| 4 | Her koşu sonunda `grantRunRewards` (+ hikâyede `missionId`, `stars`; günlükte `day`) → `mountRunRewards` |
| 5 | Bölüm ilk bitişinde `recordStoryChapter(n)`; `registerCodex('story', STORY_CODEX)` (10 kart; ch1–ch5 ile Kodeks’te 15 hikâye kartı) ve diyalogda gösterilen kartlar `markSeen` (diyalog “Atla”yla geçilirse kalan kartlar da işlenir — metinleri Kodeks’te okunur); bölüm ödülü `unlockHero(id, { free: true, source: 'bolum2'|'bolum4' })` |
| 6 | Günlük: `applyMeta({ mode: 'daily', heroId, curse, modifiers, seed, allowLocked: true })`, ödülde `day` |
| 7 | Merkezde Kütüphane (`mountLibrary`, `onCodex`) ve Kodeks (`mountCodex`) |

**Bölüm ödülü kararı:** II. bölüm Ağaç Bekçisi’ni (ormanın bekçisi), IV. bölüm Şimşek Ruhu’nu bedava açar
(`unlockHero({ free: true })` — Kütüphane’nin bedelli sıralamasını bozmaz: bedelle açılan ilk kahraman yine 300).
Kahraman zaten açıksa yerine bir şey verilmez (bölümün +50 Parıltı’sı her durumda gelir). Gerekçe: faz C temposunda
orta oyuncu ilk yeni kahramanı ≈ 0,5 saatte alır, hikâyenin II. bölümü ise ≈ 1,5–3 saatte biter; ödül çoğu zaman
“ikinci kahramanı erken açmak” anlamına gelir (≈ 450 Parıltı), Kütüphane’nin toplam 10.945 Parıltı’lık yolunun
%4’ü — seçenek açar, güç eklemez. Ödüller `csk:arena:story:v1 → rewards` ile bir kez verilir; kayıt bir şekilde
eksik kalırsa (ör. içe aktarılan profil) arena açılışında `reconcileStory()` tamamlar.

**Misafir kahraman:** `s2m1` (Ağaç Bekçisi) ve `s4m2` (Şimşek Ruhu) görevlerinde kilitli kahraman seçilebilir
(`allowLocked`); seçim ekranında “Misafir” rozeti.

**Rozet:** yeni rozet eklenmedi — mevcut **Kurye’nin Yoldaşı** (`arena:story ≥ 1`) ve **Lanet Kırıcı** (`arena:story
≥ 5`) hikâyeyi zaten kapsıyor; `recordStoryChapter` `picks['arena:story']`’yi yazar. Rozet sayısı 37’de kaldı.

## Günlük meydan okuma (`daily.js`)

- **Gün:** İstanbul takvimi (`floor((now + 3 sa) / gün)`, progression.js ile aynı). Tohum `hashStr('1vdoquz:gunluk:<gün>')`.
- **Koşullar:** altı kahramandan biri (kilitliler dahil, misafir olarak), Lanet 1–5 (ağırlıklı: 1,1,2,2,3,3,4,5), 1–2
  değiştirici (13’lük havuz: Altın Yağmuru, Cam Top, Uzun Gece, Bitmeyen Sabah, Kurye Grevde, Aç Roshan, Kalabalık
  Sürü, Uykucu Kamplar, Zam Geldi, Geri Dönüş Yok, Bilge Kahraman, Zengin Başlangıç, Hızlı Pati; çelişenler ve Lanetin
  zaten getirdikleri elenir).
- **Kurallar:** Sonsuz dalgalar; ustalık bonusu, varyant ve özel çanta kapalı (`fair`); skor salon tablosuna yazılmaz.
  Yerel rekor `csk:arena:daily:v1` = `{ day, best, wave, heroId, runs }` (yalnız bugünün). Günün ilk koşusu +40 Parıltı
  (progression). Merkez ve günlük ekranında gece yarısına geri sayım; gün dönünce ekran yenilenir.

## Kayıt anahtarları

| Anahtar | İçerik |
|---|---|
| `csk:arena:story:v1` | `{ v: 1, missions: { s1m1: { stars, wins, plays, best (sn), first } }, chapters: { 1: zaman }, finale, rewards: { hero_agac: zaman }, last }` (okurken temizlenir; bozuk kayıt boş profile döner) |
| `csk:arena:daily:v1` | bugünün günlük rekoru |
| `sessionStorage csk:arena:ui` | son menü (`hub` · `select` + tür/görev · `campaign` + görev · `daily`) |
| `csk:arena:meta:v1` | progression (yıldızlar `story`, bölüm kartları, ödüller) |

## Arayüz

- **Merkez:** sol kartta 5 mod kutucuğu (Hikâye geniş; bölüm afişi arka planda), Parıltı bakiyesi; 390 px’te üstte
  3D önizleme şeridi, altta kendi içinde kayan tek sütun.
- **Bölüm haritası:** 5 bölüm sekmesi (afiş küçük resimli; kilitli olanlar gri + kilit, `role=tablist`, oklar yalnız
  açık bölümlerde gezer), bölüm afişi (`story-ch1…5`, yoksa bölüm renkli degrade + Roma rakamı), boss çipi
  (`story-boss-*` portresi, yoksa glif), ödül çipi, 3 görev kartı (`role=radiogroup`, yıldızlar), brifing (hedefler,
  yıldız kuralları, başlangıç, önerilen/misafir, ipuçları, “Göreve başla”).
- **Diyalog kartı:** sahnenin altında; konuşan portresi (Kurye `portrait-kurye`, bosslar `story-boss-*`, DOG’lar
  `portrait-<tür>`, kahraman glifi — görsel yoksa ya da yüklenemezse renkli glif, asla kırık görsel), ad + rol, daktilo
  efekti (azaltılmış harekette anında), sayaç, **Atla** (Esc) ve **Devam** (Enter/Boşluk; son kartta “Kapat”); karta
  dokunmak da ilerletir. Açıkken simülasyon durur (`mode = 'talk'`), dokunmatik kontroller gizlenir. Erişilebilirlik:
  tam metin `aria-live` ile tek seferde okunur (daktilo `aria-hidden`), açılınca odak “Devam”da, kapanınca sahnede.
- **Rapor:** yıldızlar (yeni yıldızlar sırayla “pop” eder + ses), hedef listesi (✓/✗, her tamamlanan bonus
  “+1 yıldız”), süre/öldürme/seviye/son vuruş, Kurye’nin sözü, bölüm tamam kartı (+50 Parıltı, katılan kahraman), ödül kartı.
- **Sesler:** diyalog açılışında konuşana göre `courier` / `bark` / `roar`, zaferde `win`, bölüm ve finalde `record`,
  yıldızlarda `good`.

## Performans ve paket boyutları

Hikâye verisi (`story.js`) arena açıldıktan sonra ayrı parça olarak yüklenir (merkezdeki Hikâye kartı ilerlemeyi
gösterebilsin diye; ilk çizimi beklemez). Harita, diyalog ve final arayüzü (`storyui.js` + `story.css`) yalnızca
harita/görev açılınca ya da Hikâye kartının üstüne gelince/dokununca yüklenir. `daily.js` küçük olduğu için arena
paketinde. Bölüm afişleri ve boss portreleri `artUrl` ile yalnızca kullanıldıkları ekran çizilince indirilir
(merkezdeki Hikâye kartı yalnız güncel bölümün afişini kullanır).

`VITE_API_BASE=none npx vite build` (önce = faz D’siz `HEAD`, sonra = bu çalışma; kB, gzip parantez içinde):

| Parça | Önce | Sonra | Fark |
|---|---|---|---|
| `arena-*.js` | 269,06 (96,75) | 298,80 (107,45) | +29,7 (+10,7) |
| `arena-*.css` | 66,58 (12,57) | 77,57 (14,36) | +11,0 (+1,8) |
| `story-*.js` (yeni, tembel) | — | 39,28 (14,18) | |
| `storyui-*.js` (yeni, tembel) | — | 13,20 (5,07) | |
| `storyui-*.css` (yeni, tembel) | — | 16,48 (3,78) | |
| `view3d-*.js` | 106,66 (34,65) | 106,69 (34,67) | +0,03 (DOG etiketi/lord rozeti) |
| `progression-*.js`, `library-*.js`, `codex-*.js`, `view2d-*.js`, `games-*.js`, `index-*.js` | | aynı | 0 |

`npx vite build --mode artifact` (tek dosya): `app.js` 2.395,86 kB (771,81 gzip) → 2.478,33 kB (801,54 gzip);
`app.css` 784,77 → 812,24 kB. İki derleme de hatasız; tek uyarı faz D’den önce de olan “2000 kB üstü parça” uyarısı.

Çalışma anı: diyalog açıkken simülasyon durur (`simDt = 0`), yalnızca sahne çizilir. Görev betikleri (`setup`)
en çok bir `onStep` kancası ve birkaç olay dinleyicisi ekler; yeni koşu ya da tanıtım sahnesi başlayınca hepsi
kaldırılır (`stopMission`).

## Test sonuçları

### Görev simülasyonu (başsız, bot)

`createGame` + `storyRunConfig` + `progression.applyMeta` (taze profil) + görev bilen bot (rün toplar, kamp temizler,
Dire kulesine yürür, korunan creep’e saldıranları hedefler, ölünce parası yetiyorsa geri alır). Tablo: zafer / koşu,
kazanılan koşuların ortalama süresi (oyun saniyesi) ve yıldızı. Bot kusursuz son vuruş yapar ve hedefi hiç
kaybetmez; yıldız ortalamaları insan oyuncu için üst sınırdır, zafer oranları ise zorluk rampasını gösterir.

**Metasız** (Kütüphane yok, ustalık yok; her kahramanla 3 koşu, 18 koşu/görev):

| Görev | Zafer | Süre | ★ | Kayıplar |
|---|---|---|---|---|
| s1m1 Kıyıdaki Kurye | 18/18 | 56 sn | 2,9 | — |
| s1m2 Nehrin Rünleri | 18/18 | 56 sn | 2,0 | — |
| s1m3 Feed Alfa | 18/18 | 69 sn | 3,0 | — |
| s2m1 Kamp Ateşleri | 17/18 | 136 sn | 2,3 | buz 2/3 |
| s2m2 Karanlıkta Hayatta Kal | 17/18 | 150 sn | 2,0 | gölge 2/3 |
| s2m3 Gölge Ulusu | 16/18 | 90 sn | 1,9 | buz 2/3, gölge 2/3 |
| s3m1 Kuleyi Savun | 17/18 | 150 sn | 2,5 | gölge 2/3 |
| s3m2 Karşı Hücum | 18/18 | 131 sn | 2,3 | — |
| s3m3 Dire Generali | 17/18 | 108 sn | 2,4 | okçu 2/3 |
| s4m1 Aegis’i Kazan | 17/18 | 79 sn | 3,0 | okçu 2/3 |
| s4m2 Chat’i Sustur | 18/18 | 127 sn | 1,9 | — |
| s4m3 Kaya Canavarı | 18/18 | 89 sn | 3,0 | — |
| s5m1 Dokuz DOG Lordu | 17/18 | 152 sn | 3,0 | buz 2/3 |
| s5m2 Son Kule | 18/18 | 170 sn | 2,8 | — |
| s5m3 Kalbi Kır | 13/18 | 213 sn | 2,7 | okçu 1/3, buz 0/3 |

**Mütevazı meta** (III–V; ustalık Guardian/Archon ≈ +%2 can, +%1 hasar, Koşu Botları çantası; 4 koşu × 6 kahraman):

| Görev | Zafer | Süre | ★ | Kayıplar |
|---|---|---|---|---|
| s3m1 | 24/24 | 144 sn | 2,6 | — |
| s3m2 | 22/24 | 134 sn | 2,4 | okçu 3/4 (süre doldu: bot kuleye ok atmıyor), gölge 3/4 |
| s3m3 | 23/24 | 116 sn | 2,3 | buz 3/4 |
| s4m1 | 24/24 | 79 sn | 3,0 | — |
| s4m2 | 24/24 | 136 sn | 2,0 | — |
| s4m3 | 24/24 | 90 sn | 3,0 | — |
| s5m1 | 23/24 | 151 sn | 3,0 | okçu 3/4 |
| s5m2 | 24/24 | 170 sn | 2,8 | — |
| s5m3 | 20/24 | 191 sn | 2,8 | buz 1/4, gölge 3/4 |

Toplam: metasız I–II %96, III–IV %97, V %89; mütevazı metayla III–V %96. Final (s5m3) bilerek en zoru: incelenen
bot kayıplarının hepsi geri alma altını kalmadan gelen ilk ölüm (geri alma yapılan koşuların hepsi kazanıldı); brifinge “geri alma
altınını harcama” ipucu eklendi, önerilen kahramanlar Balta ve Gölge. Sonsuz mod botu etkilenmedi (12 dk sınırında
dalga 18; ölçek dalgası `lvl` Sonsuz’da dalga numarasına eşit).

**Bulanık test** (`FUZZ=1`: bot rastgele eşya alır, satar ve kullanır, rastgele yetenek basar ve öğrenir,
hareketine gürültü eklenir; 15 görev × 6 kahraman × 3 koşu): 0 istisna.

### Birim ve senaryo testleri (Node)

- `story.test.mjs` — **62/62**: veri bütünlüğü (5 × 3 görev, kararlı kimlikler, her görevde iki bonus; birim,
  eşya, boss, kahraman ve konuşmacı kimlikleri geçerli), `missionConfig` her çağrıda taze kopya, betik işlev olarak
  gelir, misafir kahraman `allowLocked`, 10 hikâye kartının hepsi bir diyalogdan ulaşılabilir, kapanış sözleri
  birebir, yıldız kuralları, tetikleyiciler (dalga, hedef ilerlemesi, evre, betik), kilitler ve ilerleme (bölüm
  bitişi, ödül ve final yalnız bir kez), bozuk/okunamayan kayıt, günlük (aynı gün aynı koşullar, İstanbul gece
  yarısı, geri sayım, 400 günde geçerli koşullar ve 6 kahramanın hepsi, rekor), görev altyapısı (hazırlık molası,
  kulelerin ilk dalga ölçeği, süre hedefi hazırlıkta saymaz, lordlar ve etiketli öldürme, `hold`, dördüncü REPORT,
  betik sonraki koşuda kapanır, hedef sürerken boss’suz dalga yinelenir, Sonsuz’da `lvl` = dalga) ve koşular arası
  hedef sızıntısı olmaması (başlangıç seviyesi önceki koşunun hedefini bitirmez).
- Faz B `scenario.mjs` ve `variants.mjs`: **TÜMÜ GEÇTİ** (bosslar, hedefler, kamplar, gece, geri alma, 18 varyant).
- Faz C `progression.test.mjs`: **17/17**.

### Tarayıcı (Playwright, Chromium + SwiftShader)

Geliştirme sunucusunda (`npx vite --port 5202`), 1440×900 masaüstü ve 390×844 dokunmatik (DPR 2) için tek senaryo
(`t_story.mjs`, 59 kontrol): merkez ve 5 kutucuk → Kütüphane / Kodeks pencereleri → Sonsuz seçimi, Lanet seçici,
ustalık paneli, kilitli kahraman notu ve “Kütüphane’de aç” → Sonsuz koşu, ölüm, salon skoru yazıldı, ödül kartı,
rapordan Menü → Günlük ekranı, geri sayım, günün kahramanı (kilitliyken misafir), adil koşu, rapor, günlük rekor
kaydı → harita, kilitli bölümler, klavyeyle sekme (kilitliye atlamaz), kilitli görev ipucu → görev seçimi (önerilen
rozetleri) → giriş diyaloğu (odak “Devam”da, `aria-live` metni, simülasyon durur, Devam/Atla) → görev içi diyalog
ve sürme → duraklat/sürdür → zafer, çıkış diyaloğu, rapor (yıldız + ödül kartı), kayıt → “Sonraki görev” → misafir
kahramanlı görev → **5 boss görevinin hepsi** (boss giriş/evre diyaloğu, boss çubuğu, bölüm tamam kartı, II ve IV
sonunda kahraman ödülü; hazırlık molasında yetenek ağacı penceresi) → final diyaloğu (iki kapanış sözü) → jenerik
kartı → kalıcı kahraman kilitleri (`h_agac`, `h_simsek`) → Kodeks hikâye kartları → haritadayken sayfa yenileme
(harita geri gelir) → yatay taşma yok → konsol hatası yok.

| Görünüm | Sonuç |
|---|---|
| 1440×900 | **59/59** |
| 390×844 dokunmatik | **58/58** (klavye sekme kontrolü yalnız masaüstünde) |

Faz B regresyon matrisi (`t_desk.mjs`: kahraman × masaüstü/mobil, bazıları test metasıyla; öğrenme, yetenek ağacı,
tarifler, kamplar, orman eşyası, gece, 5 boss çubuğu ve telgrafı, BKB, geri alma, hasar sayıları, taşma, konsol):
aynı test, faz D’siz `HEAD` üzerinde de (5203 portunda) koşturularak karşılaştırıldı.

| Koşu | Faz D | Faz D’siz `HEAD` |
|---|---|---|
| Masaüstü okçu (meta), balta, buz, şimşek (meta), ağaç | hepsi geçti | — |
| Masaüstü gölge | Gölge Ulusu çubuğu kontrolü ✗ | aynı ✗ (Gölge, boss’u çubuk okunmadan öldürüyor) |
| Mobil okçu, ağaç (meta) | hepsi geçti | okçu: yalnız taşma ✗ (yüzen sayı) |
| Mobil balta, buz, şimşek, gölge (meta) | aralıklı: boss çubuğu yarışı (kahraman boss’u çubuk okunmadan öldürüyor), yüzen sayı / dükkân orman yuvası taşması (r = 394–396); gölgede 3 koşunun 2’sinde orman takası düğmesi mola biterken kayboldu (düzenek yarışı, üçüncüde geçti) | aynı sınıf hatalar (balta 3, gölge 3, buz 2, şimşek 0) |

Sonuç: faz D’ye özgü gerileme yok. Test düzeneğinde iki düzeltme yapıldı (yalnız karşılaştırma kopyalarında):
mobilde harcanmamış puan düğmesi (+N) portrenin üstünde durduğu için kahraman sayfası hata ayıklama kancasıyla
açılıyor; BKB tuşuna basmadan önce kahramanın sersemlemesinin bitmesi bekleniyor. Faz B/C’den kalan küçük bulgular
(entegratöre not): 390 px’te dükkân çantasındaki orman yuvası ~6 px taşıyor (panel içinde kırpılıyor, sayfa kaymıyor);
mobilde +N düğmesi portreyi örttüğü için puan varken portreye dokunuş çoğu zaman sayfayı değil +N düğmesini
(öğrenme kipini) tetikliyor.

Derleme: `VITE_API_BASE=none npx vite build` ve `npx vite build --mode artifact` hatasız (yukarıdaki boyutlar).
