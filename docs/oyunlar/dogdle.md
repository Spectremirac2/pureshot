# DOGdle (`dogdle`)

**Rota:** `#oyunlar--dogdle` · **Tür:** Günlük · Tahmin · **Skor:** tahmin sayısı (düşük iyi, `higherIsBetter: false`)
**Dosyalar:** `src/sections/games/dogdle.js`, `src/sections/games/dogdle.css`,
ortak kahraman seçici `src/sections/games/heropick.js` + `heropick.css`

## Fikir

Dotadle / Wordle tarzı günlük bulmaca. Her gün (İstanbul takvim günü) herkes aynı gizli kahramanı arar.
Oyuncu bir kahraman yazar; tahmini gizli kahramanla altı özellikte karşılaştırılır ve renkli kutularla
ne kadar yaklaştığını görür. Sitenin kahraman verisi (127 kahraman, DOG% ve DOG türü) bulmacaya kendine
has bir tat katar: yalnızca Dota bilgisi değil, topluluğun “DOG” ön yargıları da ipucudur.

## Gün ve gizli kahraman

- Gün = **Europe/Istanbul takvim günü** (2016’dan beri sabit UTC+3, yaz saati yok):
  `istanbulDay = floor((Date.now() + 3 sa) / 1 gün)`.
- Bulmaca numarası: **25 Eylül 2026 = DOGdle #1**, sonra her gün bir artar (`puzzleNumber()`).
- Başlıkta ve HUD’da `DOGdle #N` ve sonraki bulmacaya (İstanbul gece yarısı) geri sayım görünür.
  Sayfa açıkken gece yarısı geçerse bulmaca kendiliğinden yenilenir ve bildirim çıkar.
- Sıra: kahramanlar kimliğe göre sabit sıralanır (dosya sırası önemsizdir), sonra her **127 günlük döngü**
  `seeded(hashStr('dogdle:cycle:<c>'))` (mulberry32 + FNV-1a) ile karıştırılır. Bir döngü içinde hiçbir
  kahraman tekrar etmez; döngü sınırında aynı kahraman art arda iki gün gelmez (`dailyHero(n)`).
- Veri setine kahraman eklenir ya da çıkarılırsa sıra değişir (bilinçli bir değişiklik olarak yapılmalı).

## Kurallar

- Arama kutusuna kahraman adını yaz ve öneriden seç. Her tahmin tahtaya en üste bir satır ekler:

| Sütun | Karşılaştırma |
|---|---|
| Kahraman | Portre + ad (mobilde kısaltma). Doğruysa yeşil hâle |
| Özellik | Güç / Çeviklik / Zekâ / Evrensel: yeşil aynı, kırmızı farklı |
| Saldırı | Yakın / Menzilli: yeşil / kırmızı |
| Karmaşıklık | 1–3 elmas; eşitse yeşil, değilse kırmızı + ok (gizli kahramanınki ↑ yüksek / ↓ düşük) |
| Roller | Yeşil: rol kümesi birebir aynı · Sarı: en az bir ortak rol · Kırmızı: hiç ortak rol yok |
| DOG% | Yeşil: aynı · Sarı: en fazla ±10 puan (ok ile) · Kırmızı: daha uzak (ok ile) |
| DOG türü | Arketip (`src/data/archetypes.js` adları; Farm, Feed, Ward’sız, 1vDOQUZ…): yeşil / kırmızı |

- Kutular soldan sağa çevrilerek açılır (hareket azaltma açıksa animasyonsuz).
- Tahmin edilen kahraman öneri listesinden çıkar; aynı kahraman iki kez denenemez.
- **Günlük modda pes etmek yok.** Bulmaca gün boyu açık; gece yarısına kadar dönüp devam edebilirsin.

### İpuçları (oyuncu seçer)

- **4 tahminden sonra “Topluluk der ki”**: gizli kahramanın ön yargı cümlesi (“Topluluk der ki:” öneki
  silinir). Kahramanın adı ve adındaki kelimeler (≥ 4 harf) çizgili bir bantla karartılır.
- **7 tahminden sonra “Bulanık portre”**: portre 2,5× yakınlaştırılmış ve `blur(7px)` ile bulanık; odak
  noktası kahraman kimliğinden türetilir (her açılışta aynı).
- İpuçları kendiliğinden açılmaz; düğmeye basınca açılır, açıldığı kaydedilir ve paylaşımda sayılır.

## Skor, seri ve istatistik

- **Skor = tahmin sayısı.** Yalnızca günlük bulmaca, günde **bir kez** `submitResult` ile gönderilir
  (doğru tahmin anında, açılış animasyonundan önce; oyuncu o arada ayrılsa da kaybolmaz). Profil en düşüğü tutar.
- Seri: art arda günlerde çözülen günlük bulmacalar. Dün ya da bugün çözüldüyse seri sürer; bir gün
  atlanırsa HUD’da 0 görünür, sonraki çözümde 1’den başlar. En iyi seri ayrıca saklanır.
- **İstatistik** sekmesi: oynanan (en az bir tahmin yapılan gün), kazanma yüzdesi, seri, en iyi seri ve
  1…9, 10+ tahmin dağılımı (bugünün çubuğu yeşil).

## Sonuç ve paylaşım

Doğru tahminde `DOG DOG DOG` damgası (tek tahminde `1vDOQUZ`), konfeti ve kit `resultCard` açılır:
bugünün gizli kahramanı (portre, DOG%, tür, topluluk sözü), seri istatistikleri ve bir espri.
Birincil düğme **Serbest mod**’a geçirir. Paylaşım bloğu salt okunur bir metin kutusu ve **Kopyala** düğmesi:

```
DOGdle #1 — 8 tahmin
🟥🟥⬇️🟨⬇️🟥
🟩🟩🟩🟨⬇️🟥
…
🟩🟩🟩🟩🟩🟩
💡 2 ipucu
DOG DOG DOG
https://cureshot-dog.netlify.app/#oyunlar--dogdle
```

- Satır sırası: özellik, saldırı, karmaşıklık, roller, DOG%, tür. Kırmızı karmaşıklık/DOG% kutusu ok olur
  (⬆️/⬇️), sarı DOG% 🟨 kalır. En fazla 12 satır gösterilir (fazlası `⋯ +N tahmin`). Cevap metinde geçmez.
- Kopyala: `navigator.clipboard.writeText` (try/catch) → olmazsa metin kutusu seçilip `execCommand('copy')`
  denenir → o da olmazsa metin seçili bırakılır ve “Ctrl+C / basılı tut → Kopyala” bildirimi çıkar.

## Serbest mod

- Sekmeden her an açılır. Rastgele kahraman (bugünün günlük cevabı asla sorulmaz), sınırsız tahmin,
  aynı ipuçları. **Pes et** yalnızca burada var: cevap, DOG dosyasıyla gösterilir.
- Skora, seriye ve istatistiğe hiç dokunmaz (sonuç kartında “Antrenman · skor tutulmaz”). Durumu ayrıca saklanır.

## Kontroller

| Tuş | İş |
|---|---|
| Harf / rakam | Odak neredeyse arama kutusuna gider ve yazılır |
| ↑ ↓ | Önerilerde gez |
| Enter | Seçili (yoksa ilk) öneriyi tahmin et |
| Tab | Öneriyi tamamla |
| Esc | Öneri listesini kapat (kapalıysa kutuyu temizle) |
| ← → (sekmelerde) | Günlük / Serbest / İstatistik arasında geç |

Arama Türkçe duyarsızdır (`normTr`: “ANTİ MAGE” → Anti-Mage) ve ad, kelime başı, iç ad (`furion`),
kısaltma (`CM`), baş harfler (`qop`) ve yaygın lakaplarla (`naix`, `bara`, `necro`…) eşleşir. Öneride
portre küçük resmi, ad (eşleşen kısım vurgulu) ve özellik etiketi var; satırlar ≥ 48 px (dokunmatik).
Oyun sürerken site kısayolları kapalıdır (`ctx.hotkeys(false)`); bulmaca bitince/sekme istatistikteyken açılır.

## Kalıcı durum (`ls`, önek `csk:`)

| Anahtar | İçerik |
|---|---|
| `dogdle:day` | `{ n, guesses[], solved, hints{quote,portrait}, submitted, counted }` (n = bulmaca no) |
| `dogdle:stats` | `{ played, solved, streak, best, lastSolved, dist{"1".."10"} }` |
| `dogdle:practice` | `{ answer, guesses[], gaveUp, hints }` |
| `dogdle:tab` | son açık sekme · `dogdle:seen`: başlangıç kartı bir kez gösterildi |

Yeniden yüklemede tahta animasyonsuz geri gelir; çözülmüş bulmacada sonuç ve paylaşım sessizce
(ses/konfeti olmadan) gösterilir.

### Salon için dışa aktarımlar

`puzzleNumber()`, `msToNext()`, `dailyHero(n)`, `compare(g, t)`, `emojiRow()`, `shareText()`,
`currentStreak()` ve **`todayStatus()`** → `{ n, done, won, guesses, streak }` (Oyun Salonu’nun
“Günün meydan okuması” kartı bunu kullanır).

## Veri kaynakları

- `src/data/heroes.js`: ad, özellik, saldırı, karmaşıklık, roller (resmi liste), `dogRate` (topluluk ön
  yargısı), `archetype`, `prejudice`.
- `src/data/archetypes.js`: DOG türü adları ve simgeleri. `src/core/assets.js`: `heroPortraitUrl` (yerel
  256×144 WebP). Çalışma anında dış ağ isteği yok.

## Tasarım notları

- Kutular Dota arayüzü gibi: koyu zeminde Radiant yeşili / Aegis altını / Dire kanı degradeleri, iç gölge.
- Tahta bir `container` (container query): kap 560 px’ten darsa kolonlar `50px + 6 eşit` olur, etiketler
  kısaltmaya döner (ZEK, Menzil, TAŞ/DES…, Mid/Feed). 390 px telefonda 7 sütun sayfayı taşırmadan sığar;
  daha dar ekranlarda tahta yalnızca kendi kabında yatay kayar.
- Öneri listesi panelin pah kırpmasına takılmasın diye tahmin paneli `clip-path: none` + altın üst şerit.
- Erişilebilirlik: arama `combobox` + `listbox` (aria-activedescendant); her satırın ekran okuyucu özeti
  var, sonuç `aria-live` ile duyurulur; sekmeler `tablist`.

## Test notları

Playwright (dev sunucusu, HMR engelli), masaüstü 1440×900 ve mobil 390×844 (dokunmatik):

- `test-dogdle.mjs`: başlangıç kartı; 7 yanlış tahmin (tam ad+Enter, “ANTİ MAGE”, “cm”, ↑/↓, kısmi
  ad+tıklama) ve her satırın kutu renkleri `compare()` ile birebir; tahmin edilenin öneriden çıkması, Esc;
  ipucu kilitleri (3’te kilitli, 4’te açılır, kendiliğinden açılmaz), sözde cevabın adı yok; 7’de bulanık
  portre; doğru tahmin → skor 8, `scores.dogdle = 8`, istatistik, paylaşım metni (başlık, 8 emoji satırı,
  ipucu, imza, adres, cevap yok); pano; yenilemede 8 satır, animasyonsuz, aynı paylaşım; serbest mod
  (cevap ≠ günlük, pes et, yeni kahraman, kazanma “Antrenman · skor tutulmaz”, skor/istatistik değişmez); istatistik
  sekmesi; Q tuşu bölüm değiştirmez. Her iki görünümde **geçti**, konsol hatası 0, yatay taşma 0.
- `test-days.mjs` (sahte saat): 23:58:30’da geri sayım, #1 çözüm, gece yarısı #2’ye geçiş + bildirim,
  seri 2, iki gün atlayınca seri 0, `todayStatus()`. **Geçti.**
- `test-rm.mjs`: hareket azaltmada animasyon yok ve kazanma anında; odak dışındayken harfler aramaya yazılır.

## 2. tur iyileştirmeleri (oyun cilası)

| Bulgu | Değişiklik |
|---|---|
| 390 px tahtada kahraman sütunu yalnızca kısaltma gösteriyordu (“LNA”, “TMB”, “JUG”); portre küçükken tahmin geçmişini okumak zordu. | Dar tahtada **tek kelimelik adlar olduğu gibi** (≤ 10 harf: Lina, Axe, Juggernaut, Timbersaw, Anti-Mage), çok kelimeli adlar topluluğun bildiği kısaltmayla (CM, QOP, SF). 9–10 harfli adlar bir punto küçük. Masaüstünde tam ad değişmedi. |

Diğer akışlar (ipuçları, seri, paylaşım, serbest mod) oynanarak denendi; sorun bulunmadı. Test (`final.mjs dogdle d|m`):
3 yanlış + doğru tahmin → `scores.dogdle = 4`, dar ad etiketleri (“Disruptor, CM, Juggernaut, Pudge”), çıkınca Q çalışır.
