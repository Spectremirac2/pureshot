# Portre Avı (`portre`)

**Rota:** `#oyunlar--portre` · **Tür:** Refleks · Göz · **Skor:** puan (yüksek iyi)
**Dosyalar:** `src/sections/games/portre.js`, `src/sections/games/portre.css`

## Fikir

Kahramanın resmi portresi (256×144 WebP) canvas’ta çok yakından ve iri piksellerle başlar; saniyeler
içinde uzaklaşıp netleşir. Dört şıktan doğru kahramanı ne kadar erken seçersen o kadar puan alırsın.
“Minimap’te bir piksel kıpırdadı: Pudge mu, ağaç mı?” anının oyunu.

## Kurallar

- **10 tur**, her maçta 10 farklı kahraman (rastgele).
- Her turda portre açılır: yakınlaştırma azalır, odak rastgele bir noktadan portrenin ortasına kayar, piksel
  blokları küçülür (smoothstep eğrisi). Açılma süresinden sonra kısa bir **son şans** (tam/son görünüm) gelir;
  o da biterse tur **süre doldu** sayılır.
- Dört şık: 1–4 tuşları ya da dokun/tıkla. Doğru şık yeşil ✓, yanlış seçim kırmızı ✗, diğerleri söner.
- Cevaptan sonra portre tamamen açılır; alt şeritte kahramanın adı ve **DOG%**’si görünür. Yanlış ya da
  süre dolduysa topluluğun o kahramana dair sözü (“Topluluk der ki”) de çıkar. Doğruda ~1,5 sn, yanlışta
  ~3,6 sn sonra sonraki tura geçilir; **Devam**, Enter/Boşluk ya da portreye dokunmak beklemeyi atlar.
- Bir sonraki turun portresi tur başında önceden yüklenir.

## Zorluk (başlangıç kartında seçilir, hatırlanır)

| | Çaylak | Immortal |
|---|---|---|
| Açılma | 10 sn + 2,5 sn son şans | 6,5 sn + 1,8 sn son şans |
| Başlangıç yakınlaştırma → son | 4,2× → 1× (tam portre) | 6,2× → 1,5× (tam açılmaz) |
| Piksel bloğu | 26 px → 1 px | 34 px → 2 px |
| Şıklar | Rastgele | Hepsi gizli kahramanla **aynı özellikten** |
| Puan çarpanı | ×1 | ×1,25 |

## Puanlama

- Tur puanı = `(100 + 400 × (1 − p)) × seri çarpanı × zorluk çarpanı`, p = cevap anındaki açılma oranı (0–1).
  Son şans aşamasında p = 1 → 100 taban puan.
- Yanlış ya da süre doldu: 0 puan, seri sıfırlanır.
- **Seri çarpanı** (ardışık doğru): 1. ×1, 2. ×1,25, 3. ×1,5, 4. ×1,75, 5. ve sonrası ×2.
  3’lü seride `DOG DOG DOG`, 5’li seride `1vDOQUZ` damgası.
- HUD: Tur, Skor, Seri (çarpan), **Değer** (şu an doğru cevap verirsen alacağın puan; eriyerek düşer).
  Portrenin altında süre çubuğu; son şansta kırmızı yanıp söner. Köşede “Görüş %”.
- Maç sonu: `submitResult` ile skor hemen kaydedilir; kit `resultCard`: puan, **Doğru x/10**, **En hızlı**
  (doğru cevaplar arasında, saniye), **En iyi seri**, puana göre espri ve 10 turun özeti (kahraman + puan).
  Zorluk başına en iyi skor `ls` `portre:best` içinde de tutulur (başlangıç kartında gösterilir).
  **Tekrar oyna** başlangıç kartına (zorluk seçimi) döner.

| Puan | Espri |
|---|---|
| ≥ 6000 | Aegis senin… draft’ta ban’lanacak göz bu. |
| ≥ 3500 | Keskin göz. Sisin içinden bile Pudge’un kancasını seçiyorsun. |
| ≥ 1800 | Bazen piksel okudun, bazen yazı tura attın. |
| ≥ 600 | Portreler biraz bulanık kaldı. Minimap’e daha sık bak, kaptan. |
| < 600 | DOG DOG DOG. Bu turda ağaçlar bile kahramana benziyordu. |

## Kontroller

| Tuş | İş |
|---|---|
| 1 2 3 4 | Şıkkı seç |
| Enter / Boşluk | Cevaptan sonra sonraki tur (odak başka bir düğmedeyse o düğmeye ait) |
| Dokun / tık | Şık seç; cevaptan sonra portreye dokunmak sonraki tura geçer |

Maç sürerken site kısayolları kapalıdır (`ctx.hotkeys(false)`), maç bitince/sayfadan çıkınca açılır.

## Teknik notlar

- Çizim: kaynak dikdörtgen (`256/z × 144/z`, odakta, sınırlar içinde) önce küçük bir ara canvas’a
  yumuşatmayla çizilir (blok başına ortalama renk), sonra ana canvas’a `imageSmoothingEnabled = false` ile
  büyütülür → gerçek pikselleşme. Blok ≤ 1,2 px olunca doğrudan yüksek kaliteli çizim. Canvas boyu
  `ResizeObserver` ile CSS genişliği × DPR (en fazla 2).
- Zamanlama kit `createRunner` ile: sekme gizlenince açılma, süre ve bekleme durur; geri gelince kaldığı
  yerden sürer. Tüm dinleyiciler, gözlemci ve zamanlayıcılar temizleme fonksiyonunda kaldırılır.
- Görsel yoksa (beklenmez) özellik renginde zemin + kısaltma çizilir. Çalışma anında dış ağ isteği yok.
- Test kancası: `window.__portreTest` nesnesi varsa her turun cevap kimliği `answer` alanına yazılır
  (yalnızca Playwright bu nesneyi tanımlar; normal kullanıcıda hiçbir şey yazılmaz).

## Veri kaynakları

`src/data/heroes.js` (ad, özellik, `dogRate`, `prejudice`), `heroPortraitUrl()` (`src/core/assets.js`,
Valve’ın resmi portreleri, yerel WebP).

## Tasarım notları

- Portre çerçevesi Dota panel köşeleriyle (`.frame`), üstünde hafif tarama çizgileri ve vinyet; Çaylak
  Radiant yeşili, Immortal Aegis altını vurgulu.
- Şıklar pah kırılmış (clip-path) iri düğmeler: masaüstünde 2×2, ≥ 54 px yükseklik; mobilde de 2×2.
- Tur şeridi: 10 küçük yuva; cevaplanan tur kahramanın portresi + ✓/✗ rozetiyle dolar (yanlışlar gri).
- Hareket azaltma: açılma yine olur (oyunun kendisi), cevap sonrası geçiş anında, çubuk yanıp sönmez.

## Test notları

`test-portre.mjs` (Playwright, dev sunucusu, HMR engelli):

- **Masaüstü 1440×900, Çaylak:** 10 tur; 2 yanlış tıklama, 2 turda 1–4 tuşu, diğerleri tıklama; tur geçişi
  sırayla Devam düğmesi ve Enter. Her turda 4 farklı şık + cevap içinde, doğru/yanlış geri bildirimi ve
  yanlışta söz. Sonuç: 8/10, skor `scores.portre`’ye ve `portre:best.caylak`’a yazıldı, HUD = sonuç,
  özet 10 satır, Tekrar oyna → başlangıç kartı. Oyun sırasında Q bölüm değiştirmedi.
- **Mobil 390×844 (dokunmatik), Immortal:** 10 tur; her turda şıkların hepsi aynı özellikte; 2 yanlış
  dokunuş + 1 zaman aşımı (“Süre doldu”); sonuç 7/10, skor kaydı. Tüm akış **geçti**.
- Her iki görünümde konsol hatası 0, yatay taşma 0, localhost dışı istek 0.
- `test-rm.mjs`: sekme gizliyken “Görüş %” sabit kaldı, geri gelince sürdü; oyundan çıkınca site
  kısayolları yeniden çalıştı.

## 2. tur iyileştirmeleri (oyun cilası)

Masaüstü (1440×900) ve mobil (390×844 dokunmatik) oynanarak bulunanlar → yapılanlar:

| Bulgu | Değişiklik |
|---|---|
| **Hata:** doğru cevapta bilgi şeridinin altında “null” yazıyordu (`replaceChildren(…, null)`). | Yalnızca var olan düğümler eklenir; testte her turda “null” aranıyor. |
| Turun ilk anında, portre daha hiç açılmadan körlemesine tahmin (ya da önceki turdan kalan dokunuş) ~500 puanlık şans getirebiliyordu. | **Şık kilidi:** tur başında şıklar 0,4 sn kilitli ve soluk; sonra sırayla belirir. 1–4 tuşları ve dokunuşlar bu sırada yok sayılır. Açılma saati yine tur başından sayılır (en yüksek tur puanı ~484 · seri · zorluk); puan formülü değişmedi. |
| Seri ilerlerken geri bildirim yalnızca HUD’daki sayıydı. | Seri ≥ 2’de yükselen “seri” notası (`sound.streak`), Seri kutusu kor rengine döner, 3+ seride portre çerçevesi kor ışığıyla yanar. Doğru/yanlışta çerçeve içi yeşil/kırmızı parlama (hareket azaltmada yok). |
| Son şans aşaması yalnızca yanıp sönen çubukla belliydi. | Son şansta yarım saniyede bir tık sesi. |
| Maç sonunda rekorla kıyas yoktu. | Sonuç kartında zorluk başına rekor notu: “Eski rekorunu N puan farkla geçtin” ya da (%15 içinde) “Kıl payı! Rekoruna N puan kaldı.” (`juice.js`). Yanlış cevapta dokunmatik cihazda kısa titreşim. |
| Mobilde “Devam” düğmesi 36 px’ti. | 44 px. |

Test (`final.mjs portre d|m`): kilit anında 1 tuşu yok sayıldı; 10 tur (tık, 1–4 tuşu, bir yanlış); şeritte “null” yok;
skor = `csk:me.scores.portre`; oyun içinde site kısayolu (Z) kapalı, oyun ortasında salona dönünce Q → Espri Duvarı;
konsol hatası 0, yatay taşma yok. İki görünümde **geçti**.
