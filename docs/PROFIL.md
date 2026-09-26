# Profil — Fan Kartı ve Günlük Görevler

`#profil` gizli bir rotadır (yetenek çubuğunda slotu yoktur); HUD’daki ad çipinin menüsünden açılır.
Sayfa, ziyaretçinin sitedeki bütün izini tek yerde toplar ve her gün geri gelmek için bir neden verir.
Statik yayında (Netlify) bütün veriler ziyaretçinin kendi tarayıcısındadır; hesap yoktur.

Dosyalar:

| Dosya | İçerik |
|---|---|
| `src/sections/profile/profile.js` | Bölüm (sözleşme: `mount(el, ctx)` → temizlik, `onSub(sub)`) |
| `src/sections/profile/profile.css` | Stiller (`pf-` öneki) |
| `src/sections/profile/catalog.js` | Rekor kartlarının oyun/quiz kataloğu (oyunlar `SALON_GAMES`'ten), quiz birimleri, skor yönü |
| `src/sections/profile/avatar.js` | Avatar kahraman seçici (arama + özellik süzgeci, portre atlası) |
| `src/sections/profile/sharecard.js` | 1200×630 paylaşım kartı (canvas) |
| `src/sections/profile/data.js` | JSON yedek, içe aktarma, sıfırlama, indirme yardımcıları |
| `src/core/quests.js` | Günlük görevler + XP/seviye (diğer modüller de kullanabilir) |

## Bölümler ve adresler

| Adres | Bölüm | Özet |
|---|---|---|
| `#profil` | Fan Kartı (başlık) | Avatar kahraman, takma ad (düzenle), seviye + XP çubuğu, “Hangi DOG’sun?” sonucu, üyelik tarihi; DOG / Rozet / Rekor / Seri kutuları |
| `#profil--gorevler` | Günlük Görevler | 3 görev, ilerleme çubukları, İstanbul gece yarısına geri sayım, seri |
| `#profil--kart` | Fan Kartın | Canvas önizleme, “Görseli indir”, “Panoya kopyala” |
| `#profil--rekorlar` | Rekorlar | 14 oyun + 5 quiz + “Daha DOG mu?”: en iyi skor, son denemeler çizgisi, deneme sayısı, son oynama; skoru yoksa “Oyna / Çöz” |
| `#profil--rozetler` | Rozetler | 37 rozet, gruplu (Salon, Oyunlar, Quizler, Topluluk), kilitlilerde ilerleme |
| `#profil--veri` | Verilerin | Dışa aktar (JSON), İçe aktar, Sıfırla |

Alt sayfa adresleri ilgili bölüme kaydırır; sayfadaki gezinme çipleri aynı işi yapar (`ctx.setSub` ile adres güncellenir).

- **Avatar:** `store.me.picks.avatar = <kahraman id>`. Başlıkta kahramanın şeffaf render görseli, yoksa portresi,
  hiç seçilmemişse DOG pençesi. Seçici 127 kahramanı tek istekli portre atlasından gösterir (atlas yoksa tek tek
  portre), `normTr` ile Türkçe duyarsız arama (ad, iç ad, kısaltma, baş harfler) ve Güç/Çeviklik/Zekâ/Evrensel süzgeci;
  Enter ilk sonucu seçer. “Rastgele” ve “Kaldır” düğmeleri var.
- **Takma ad:** kabuğun `openNickEditor()` penceresi (dışa aktarılmazsa aynı davranışlı yerel yedek).
- **Üyelik tarihi:** yerel kipte fan kimliği (`csk:local-fan-id` = `f` + zaman damgası + rastgele) ilk ziyaret anını
  taşır; bu, en eski deneme ve kayıtlı değer (`csk:profile:since`) arasından en erken olanı alınır ve kaydedilir.
- **Rekor biçimi:** oyunların adı, simgesi, rengi, birimi, skor yönü ve biçimleyicisi `SALON_GAMES`’ten gelir
  (`core/badges.js`; oyun `meta` değerlerinin kopyası — ayrı `UNITS` tablosu kaldırıldı). `games.js` bütün oyun
  modüllerini statik içe aktardığı için profil onu yüklemez. Yedek: birimi olmayan kayıt düz sayı ve “yüksek iyi”;
  hiçbir katalogda olmayan bir skor kimliği “Diğer” altında düz sayı olarak görünür. Çizgide yukarı her zaman daha iyidir (düşük-iyi oyunlarda eksen ters); altın nokta rekordur.

## XP ve seviye

```
XP = kazanılan rozet × 100  +  ömür boyu tamamlanan görev × 50  +  oynanan farklı oyun/quiz × 30
```

“Oynanan farklı oyun/quiz” = skor tablosundaki kimlikler ∪ deneme geçmişindeki kimlikler ∪ (“Hangi DOG’sun?” çözüldüyse) `hangidog`.

Seviye L için gereken toplam XP: `100·(L−1) + 25·(L−1)·(L−2)` → 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700…
(her seviye bir öncekinden 50 XP fazla ister). Rütbeler Dota madalyalarından:

| Seviye | 1–2 | 3–4 | 5–6 | 7–8 | 9–10 | 11–12 | 13–15 | 16+ |
|---|---|---|---|---|---|---|---|---|
| Rütbe | Herald | Guardian | Crusader | Archon | Legend | Ancient | Divine | Immortal |

Örnek: 37 rozetin tamamı + 14 oyun + 5 quiz + “Daha DOG mu?” = 4.300 XP (Seviye 12, Ancient); bir ay boyunca her gün 3 görev +4.500 XP.
(Arena’nın kalıcı ilerleme fazı 6 rozet ekledi: Roshan Avcısı, On Dalga, Dört Yüz, Lanet Ustası, Kurye’nin Yoldaşı, Lanet Kırıcı.)
Profil açıkken seviye atlanırsa bildirim çıkar.

## Günlük Görevler (`src/core/quests.js`)

### Kurallar
- Gün İstanbul saatine göredir (UTC+3); görevler gece yarısı yenilenir. Gün numarası `questDay(now)` = DOGdle’ın `istanbulDay()`.
- Her gün havuzdaki 24 şablondan **3 görev**; seçim gün numarasıyla tohumlanır (`seeded(hashStr('csk-gorev-' + gün))`),
  herkes aynı gün aynı görevleri görür. Kısıtlar: en az 1 oyun görevi, en çok 2 oyun görevi, quiz/topluluk/genel
  gruplarından en çok birer tane, aynı oyun iki kez yok. (365 günlük taramayla doğrulandı.)
- İlerleme oyunlara dokunmadan türetilir: `history.since(istanbulDayStart())` (her `store.me.submitScore` denemesi),
  günlük anlık görüntü (DOG sayısı, DOG’lanan espriler, rekorlar) ve `csk:qz:last` (quizlerin son sonuç zamanı).
- Tamamlanan görev günde bir kez kaydedilir ve bildirilir (`fx.toast`, +50 XP); üçü birden bitince seri uzar
  (“Günün üç görevi tamam! Seri: N gün”). Seri, bugün ya da dün tamamlandıysa sürer.
- 2. tur oyunlarının (kurye, mayin, esya, maraton) puanlaması kesinleşti; ilk sürümdeki “bir kez oyna” görevleri
  eşikli görevlerle değişti (`kurye200`, `mayinOrta`, `esya1000`, `maraton24`). Arena’nın kalıcı ilerleme fazı `arenaRoshan`’ı
  ekledi: havuz 24 şablon (Arena iki görevle ~%24 günde çıkar; 400 günlük taramada kısıtlar temiz).

### Havuz

| id | Grup | Görev | Koşul (bugün) |
|---|---|---|---|
| `dogdle` | oyun | Günün DOGdle’ını çöz | `dogdle` denemesi (yalnızca günlük çözümde yazılır) |
| `invoker10` | oyun | Invoker Kombo’da 10+ büyü çağır | en iyi ≥ 10 |
| `hook800` | oyun | Pudge Hook’ta 800+ puan topla | en iyi ≥ 800 |
| `rune350` | oyun | Rune Refleksi’nde 350 ms altına in | en iyi < 350 (düşük iyi) |
| `dogavi500` | oyun | DOG Avı’nda 500+ puan yap | en iyi ≥ 500 |
| `lasthit350` | oyun | Last Hit Ustası’nda 350+ altın kas | en iyi ≥ 350 |
| `hafiza500` | oyun | DOG Hafıza’da 500+ puan | en iyi ≥ 500 |
| `portre1500` | oyun | Portre Avı’nda 1.500+ puan | en iyi ≥ 1500 |
| `arena1200` | oyun | 1vDOQUZ Arena’da ilk dalgayı temizle | en iyi ≥ 1200 |
| `arenaRoshan` | oyun | 1vDOQUZ Arena’da Roshan’ı kes | `picks['arena:roshan']` − günün görüntüsündeki değer (`snap.ar`) ≥ 1 |
| `bingo1` | oyun | DOG Bingo’da bir çizgi tamamla | en iyi ≥ 1 |
| `kurye200` | oyun | Uçan Kurye’de 200+ metre uç | en iyi ≥ 200 (rozet 300’de) |
| `mayinOrta` | oyun | Mayın Tarlası’nda Orta tahtayı temizle | `mayin` denemesi (yalnızca kazanılan Orta tahtası skor yazar) |
| `esya1000` | oyun | Eşya 2048’de 1.000+ puan topla | en iyi ≥ 1000 (rozet 2.500’de) |
| `maraton24` | oyun | 24 Saat Maraton’u 24:00’e taşı | `picks['maraton:tamam']` − günün görüntüsündeki değer (`snap.mt`) ≥ 1 |
| `quiz` | quiz | Bir quiz bitir | bilgi/dogmu/hayran/yetenek denemesi ya da `qz:last[*].at` bugün (Hangi DOG dahil) |
| `hayran8` | quiz | Gerçek Hayran Testi’nde 8+ doğru | en iyi ≥ 8 |
| `yetenek` | quiz | Yetenek Avı quizini bitir | 1 deneme |
| `daha5` | quiz | “Daha DOG mu?” serisinde 5 doğru | en iyi ≥ 5 |
| `dog10` | topluluk | DOG düğmesine 10 kez bas | `me.dog − görüntü.dog` ≥ 10 (profilde “DOG!” düğmesi) |
| `like1` | topluluk | Bir espriyi DOG’la | görüntüde olmayan yeni `jk:` beğenisi |
| `cesit3` | genel | 3 farklı oyun oyna | farklı salon oyunu ≥ 3 |
| `tur5` | genel | Salonda 5 tur at | salon oyunu denemesi ≥ 5 |
| `rekor` | genel | Bir oyunda rekorunu kır | görüntüden sonra değişen en iyi skor; görüntüden önceki bugünkü denemeler için: en iyi skora eşit ve önceki günlerin denemelerinde yok |

Eşikler rozet eşiklerinin (`THRESHOLDS`) altında, bir oturumda yapılabilecek düzeydedir. Görev eklemek: `QUEST_POOL`’a
`{ id, group, text, hint, icon, color, href | action, target, value(ctx) }` ekleyin; `value` bir sayı ya da
`{ value, done?, detail? }` döndürür (`ctx`: `today`, `by[id]`, `me`, `snap`, `qz`, `start`).

### Anlık görüntü sınırı
DOG ve beğeni görevleri günün ilk değerlendirmesinde alınan anlık görüntüye göre sayılır. `quests.js` o gün hiç
yüklenmeden basılan DOG’lar sayılmaz; bu yüzden izleyicinin uygulama açılışında kurulması önerilir (aşağıda).

## Depolama anahtarları (localStorage, `csk:` önekli)

| Anahtar | Sahibi | İçerik |
|---|---|---|
| `csk:me` | store.js | fan profili: `nick, dog, likes, scores, picks` (profil `picks.avatar` ekler) |
| `csk:hist` | history.js | `{ id: [{ s, t }] }` son 20 deneme/oyun |
| `csk:hist:n` | history.js | `{ id: n }` ömür boyu deneme sayısı (`history.count(id)`; ilk sayımda liste uzunluğundan başlar) |
| `csk:qz:last` | quizzes/ui.js | quizlerin son sonucu (`at` zamanı) — yalnızca okunur |
| `csk:quests:snap` | quests.js | `{ day, at, dog, likes: [jk:…], scores, mt, ar }` günün anlık görüntüsü (`mt`: 24:00’e varan Maraton sayacı, `ar`: Arena’da kesilen Roshan sayacı; eski görüntüde yoksa ilk okumada eklenir) |
| `csk:quests:log` | quests.js | `{ total, days: { gün: [görev id] } (son 60 gün), streak: { last, count, best } }` |
| `csk:profile:since` | profile.js | üyelik tarihi (ms) |
| `csk:local-fan-id` | store.js | fan kimliği (yalnızca okunur; üyelik tarihi için) |
| `csk:arena:meta:v1` | arena/progression.js | Arena kalıcı ilerlemesi: Parıltı, ustalık, Kütüphane, Lanet, Kodeks (dışa aktarmada `extra` içinde; içe alınınca doğrulanır — [ARENA-ILERLEME.md](ARENA-ILERLEME.md)) |

`sessionStorage['csk-flash']` sıfırlama/içe aktarma sonrası tek seferlik bildirim içindir.

## Diğer modüller için API

```js
import {
  todayQuests,        // (now = Date.now()) → [{ id, group, text, hint, icon, color, href?, action?, target, game? }]
  questStatus,        // (now) → [{ …görev, done, progress, target, detail }]   salt okunur (kayıt yapmaz)
  syncQuests,         // (now) → durum; yeni tamamlananları kaydeder + bildirir (günde bir kez)
  completedQuestCount,// () → ömür boyu tamamlanan görev sayısı
  questStreak,        // (now) → { current, best, todayAll, todayDone }
  subscribeQuests,    // (fn(durum)) → kapatma fn; geçmiş / profil / başka sekme / gün değişince
  ensureQuestWatcher, // () → küresel tekil izleyici (bildirimler); tekrar çağrı etkisiz
  msToReset,          // (now) → İstanbul gece yarısına kalan ms
  questDay,           // (now) → İstanbul gün numarası
  fanXp,              // (me = store.me.get()) → { xp, badges, quests, games }
  fanLevel,           // (xp) → { level, rank, color, xp, floor, next, into, need, pct }
  playedIds,          // (me) → oynanmış oyun/quiz kimlikleri
  QUEST_POOL, QUEST_XP, XP_RULES, RANKS, xpForLevel,
} from './core/quests.js';
```

Ana sayfadaki görev kartı (`sections/home/home.js` → `buildQuests`): ilk çizim `questStatus()`, sonra
`subscribeQuests`; `msToReset()` ile geri sayım, `questStreak()` ile seri, `fanLevel(fanXp().xp)` ile “Fan seviyen”
çipi (`#profil`); bağlantı `#profil--gorevler`. Satırlar yerinde güncellenir; DOG görevinin satırı DOG düğmesi gibi
çalışır. Ad çipi menüsünde “Profilim”in yanında seviye rozeti (`shell.js`, menü her açılışta hesaplanır).

## Paylaşım kartı
1200×630 canvas; sitenin fontları `document.fonts.load` ile beklenir (en fazla 1,5 sn). İçerik: avatar kahramanın
render görseli (yoksa portre, o da yoksa DOG pençesi), takma ad (sığmazsa küçülür), seviye/rütbe, XP çubuğu, DOG /
rozet / görev serisi kutuları, DOG türü, en iyi 3 rekor (rozet eşiğine oranla “en güçlü” rekorlar), site adresi,
üyelik tarihi ve DOG DOG DOG damgası. Görseller aynı kökenden (`/assets/…`) geldiği için canvas kirlenmez
(`toDataURL`/`toBlob` çalışır).

- **Görseli indir:** `canvas.toBlob` → `a[download]`. Sayfa bir çerçevedeyse (iframe/Artifact) ya da indirme hata
  verirse, görsel bir pencerede açılır (“uzun bas / sağ tık → Resmi kaydet” + indirme bağlantısı).
- **Panoya kopyala:** `navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise<Blob> })])` (Safari için
  söz tıklama anında verilir); desteklenmezse bildirimle “Görseli indir”e yönlendirir.

## Veri
- **Dışa aktar:** `dog-fan-karti-YYYY-AA-GG.json` = `{ kind: 'cureshot-fan-karti', version: 1, exportedAt, site, me,
  history, extra }`; `extra` diğer bütün `csk:` anahtarlarıdır (DOGdle serisi, quiz son sonuçları, görev kaydı,
  ayarlar), `db:*` koleksiyon önbellekleri, `local-fan-id` ve `quests:snap` hariç. Çerçevede indirme engellenirse
  JSON kopyalanabilir bir pencerede gösterilir.
- **İçe aktar:** dosya ≤ 2 MB, `kind` doğrulanır; profil temizlenir (takma ad ≤ 24, sonlu sayılar, güvenli anahtarlar,
  oyun başına ≤ 20 deneme). Onaydan sonra anahtarlar yazılır ve sayfa yenilenir; sayfa kapanırken bekleyen profil
  yazımı olursa anahtarlar `pagehide`’da yeniden yazılır.
- **Sıfırla:** `fx.confirm` (tehlike düğmesi) açık bir uyarıyla; yalnızca `csk:` önekli anahtarları siler ve yeniler.
  Store kapanırken bekleyen fan belgesini (`csk:db:fans`) yazabileceği için silme `pagehide`’da bir kez daha yapılır.
  Paylaşılan arka uçta (Artifact db / API) sunucudaki kayıt silinmez; metin bunu söyler.

## Entegrasyon notları
1. `src/main.js` içinde `ensureBadgeWatcher()` yanına `ensureQuestWatcher()` eklenmeli (şu an yalnızca profil
   yüklenince kuruluyor): görev bildirimleri her sayfada çıksın ve DOG/beğeni anlık görüntüsü günün ilk açılışında alınsın.
2. ~~Ana sayfaya “Günlük Görevler” kartı ve ad çipi menüsüne seviye~~ — yapıldı (2. tur, salon ajanı).
3. ~~Yeni oyunların birimleri ve eşikli görevleri~~ — yapıldı: `SALON_GAMES` 14 oyunun `unit` / `higherIsBetter` /
   `format` değerlerini taşır, `catalog.js` onları kullanır; `quests.js`’te dört eşikli görev.
4. Yeni ASCII dışı karakter eklenmedi (font alt kümesi değişmez).

## Test notları
Playwright (dev sunucusu, HMR engelli), masaüstü 1440×900 ve mobil 390×844 (dokunmatik):
- Boş profil ve tohumlanmış profil (12 oyunda skor, bugünkü denemeler, 11 rozet, 3 günlük seri): konsol hatası 0,
  4xx 0, yatay taşma yok.
- Avatar seçici: 127 kahraman, “pudg” → Pudge, seçim `picks.avatar`’a yazılır, başlık render’ı değişir; Çeviklik
  süzgeci 35 kahraman; Esc kapatır.
- Takma ad: kabuğun penceresiyle değişir, başlık ve kart güncellenir.
- Görevler: gerçek `store.me.submitScore` / `toggleLike` çağrılarıyla bugünün 3 görevi tamamlandı → 3 “Görev tamam”
  bildirimi + “Günün üç görevi tamam! Seri: 4 gün”; kayıt ve seri doğru; yeniden yüklemede tekrar bildirim yok.
- Görev değerlendiricileri sentetik günlerde ayrı ayrı: DOG farkı (0 → 7 → 10, ertesi gün sıfır), beğeni (geri
  alıp yeniden beğenmek sayılmaz), rekor (görüntü öncesi/sonrası, eşitlik sayılmaz), quiz (`qz:last` ile Hangi DOG),
  çeşit/tur (quizler ve ertesi gün sayılmaz), rune (< 350). 365 gün seçim kısıtları.
- Paylaşım kartı: `toDataURL` çalışıyor (kirlenmemiş), indirme dosyası `fan-karti-<ad>-<tarih>.png`, panoya kopyalama.
- Dışa aktar → sıfırla (yalnızca `csk:` anahtarları, `db:fans` dahil temiz, yeni takma ad) → içe aktar (skorlar,
  görev serisi geri gelir); geçersiz dosyada hata bildirimi.
- `VITE_API_BASE=none npx vite build` başarılı; profil parçası ~52 KB (gzip ~19 KB), kahraman/arketip verisi ortak parçalardan.
