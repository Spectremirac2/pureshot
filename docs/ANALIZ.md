# Analiz — DOG DOG DOG Üssü (Eylül 2026)

Bu belge sitenin mevcut durumunu, ölçülen performans değerlerini ve geliştirme kararlarına temel olan
araştırmayı özetler. Plan ve iş dağılımı için bkz. [PLAN.md](PLAN.md).

## 1. Mevcut durum

| Bölüm | Kısayol | İçerik |
|---|---|---|
| Üs (`#ana`) | H | 3D DOG maskotu + okçu, DOG sayacı, bölüm vitrinleri |
| Espri Duvarı (`#espriler`) | Q | 143 efsane espri, espri makinesi (51 şablon), topluluk duvarı, espri ekleme |
| Mini Oyunlar (`#oyunlar`) | W | 5 oyun: 1vDOQUZ Arena (3D), DOG Avı, Last Hit, DOG Hafıza, Rune |
| Quizler (`#quizler`) | E | 4 quiz: Hangi DOG’sun, Bilgi Yarışması, DOG mu Değil mi, Hayran Testi |
| Karakter Analizleri (`#karakterler`) | D | 10 DOG türü + efsane: radar, saha notları, karşılaştırma |
| Soru-Cevap (`#soru-cevap`) | F | Topluluk soruları, DOG Kâhini, SSS |
| Galeri & 3D Müze (`#galeri`) | T | 15 fal.ai görseli, 3 GLB model |
| Kahraman DOG Endeksi (`#kahramanlar`) | Z | 127 kahraman, resmi portre/render, tier listesi, Daha DOG mu?, çark |

Yayın: statik (`VITE_API_BASE=none`), Netlify — https://cureshot-dog.netlify.app. Veri ziyaretçinin
tarayıcısında kalır; yayında trol riski yoktur.

## 2. Ölçümler (canlı site, sıkıştırılmış aktarım)

| Ölçüm | Değer |
|---|---|
| `app.js` | 1.464 KB ham · 459 KB gzip (three.js dahil, tek paket) |
| `app.css` | 804 KB ham · 435 KB gzip — **~%95’i gömülü font** (18 woff2, 380 KB ham → base64) |
| Ana sayfa ilk ziyaret | **3,05 MB**, 19 istek (GLB’ler 1,1 MB, font+CSS 423 KB, JS 421 KB) |
| Kahramanlar sayfası | 1,78 MB, **133 istek** (3D halka için 127 portre ayrı ayrı iniyor) |
| Tüm bölümler turu | 5,16 MB, 159 istek |
| GLB modeller | dog 541 KB, archer 569 KB, aegis 633 KB (1024² WebP doku + meshopt) |

Netlify ücretsiz plan: ayda 300 kredi, 1 GB = 20 kredi, her yayına alma 15 kredi. Kişi başı aktarım
doğrudan kapasiteyi belirler (ana sayfa ~3 MB → ayda ~4.000 ziyaretçi).

### Darboğazlar
1. **Fontlar CSS’e gömülü.** Her ziyaretçi, kullanılmayan glifler dahil 9 kalınlığın tamamını base64 olarak
   indiriyor; CSS önbelleği JS’ten ayrılamıyor. Türkçe için gereken glif kümesi küçük (Latin + ğ ş ı İ).
2. **Tek JS paketi.** Bölümler dinamik `import()` ile tanımlı ama `inlineDynamicImports` yüzünden hepsi
   tek dosyada; espri duvarına gelen ziyaretçi de three.js + arena kodunu indiriyor. (Bu ayar claude.ai
   Artifact sürümü için gerekli; statik yayında gerekmez.)
3. **Önbellek başlıkları.** `app.js`/`app.css` adları sabit (hash yok); tekrar ziyaretlerde doğrulama isteği.
4. **3D halka atlası** 127 ayrı portre isteği yapıyor.
5. Paylaşım önizlemesi yok (Open Graph / favicon / manifest eksik) — link Kick sohbetine ya da Discord’a
   atıldığında görsel çıkmıyor.

## 3. Araştırma

- **Dotadle** türü günlük tahmin oyunları Dota topluluğunda çok popüler: gizli kahramanı özellik
  karşılaştırmasıyla (özellik, saldırı, rol, karmaşıklık…) ve kırpılmış görsellerle bulma.
  Kaynak: [Dotadle](https://dotadle.net/), [Esportdle Dota 2](https://esportdle.com/dota-2)
- **Invoker çalıştırıcıları** (QWE küre kombinasyonları) tarayıcıda en çok oynanan Dota alıştırmaları;
  günlük meydan okuma ve yarış modları öne çıkıyor. Kaynak: [Invoker Game](https://invokergame.org/)
- **Yayın bingosu** izleyicinin yayını “oynamasını” sağlayan en yaygın etkileşim aracı; özel olay
  kartları ve paylaşılabilir kartlar temel özellik. Kaynak: [TCB Streamer Bingo](https://tcb.wtf/streamer-bingo),
  [Stream Bingo](https://michaelmcneil.net/projects/stream-bingo/)

Sonuç: sitedeki kahraman verisi (127 kahraman, özellik/rol/karmaşıklık/DOG%) ve yeni eklenen resmi
portreler, Dotadle ve portre tahmini gibi oyunlar için hazır bir temel sunuyor. 24 saatlik maratonlar ve
“DOG DOG DOG” anları ise yayın bingosu için birebir içerik.

---

## 2. Tur analizi (25 Eylül 2026, 1. tur sonrası)

Canlı site: 10 oyun, 5 quiz, 23 rozet; performans çalışması tamam. Kalan boşluklar:

1. **İlk giriş rehberi yok.** Sitenin ana gezinmesi alttaki Dota yetenek çubuğu (H Q W E R D F T Z); ilk kez gelen
   ziyaretçi slotların ve kısayolların ne yaptığını tahmin etmek zorunda. Araştırma: iyi ürün turları 3–5 kısa
   adım, her zaman “Geç” seçeneği, kısa metin (≤140 karakter), değer odaklı dil ve istenince tekrar açılabilme
   içerir. Kaynak: [Appcues — product tour UI patterns](https://www.appcues.com/blog/product-tours-ui-patterns),
   [Formbricks — onboarding best practices](https://formbricks.com/blog/user-onboarding-best-practices)
2. **Statik yayında skor tabloları “boş” görünüyor.** Her ziyaretçinin verisi kendi tarayıcısında kaldığı için
   tabloda yalnızca kendi satırı var. Kişisel deneme geçmişi (son denemeler, gelişim) bu alanı anlamlı kılar.
3. **İstatistikler dağınık.** Skorlar, rozetler, quiz sonuçları ve DOG sayısı farklı sayfalarda; toplu bir
   “Fan Kartı” / profil sayfası ve geri dönme nedeni (günlük görevler) yok.
4. **Oyun çeşitliliği.** Dota 2’nin kendi Crownfall etkinliğindeki mini oyunlar (Techies temalı mayın tarlası
   “Spleen Sweeper”, Flappy Bird benzeri “Flappy Bat”) Dota oyuncularının bu türleri sevdiğini gösteriyor.
   Kaynak: [Liquipedia — Crownfall Minigames](https://liquipedia.net/dota2/Crownfall/Minigames)
   Birleştirme bulmacası (2048) ve yayın temalı bir strateji/simülasyon oyunu, 24 saatlik maraton kültürüne
   birebir uyuyor.
