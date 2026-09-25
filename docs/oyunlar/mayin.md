# Techies Mayın Tarlası (`mayin`)

**Rota:** `#oyunlar--mayin` · **Bölüm:** Mini Oyunlar · **Tür:** Zihin · Mantık (`meta.cat = 'zihin'`) ·
**Birim:** sn (düşük iyi; yalnızca **Orta** zorluğun süresi)
**Dosyalar:** `src/sections/games/mayin.js`, `src/sections/games/mayin.css`; ikonlar `mine`, `pick` (`src/core/icons.js`);
kayıt: `games.js`. Dış görsel yok: mayın, Sentry ward ve Techies yüzü satır içi SVG olarak çizilir.

## Fikir

Dota 2'nin Crownfall etkinliğindeki Techies temalı “Spleen Sweeper”, klasik mayın tarlasının Dota
oyuncularında tuttuğunu gösterdi. Bu oyun o türün özgün bir yorumu: ormanda Techies'in **yakınlık mayınları**
gizli; oyuncu sayılardan mantık yürütür, mayınları **Sentry ward** ile işaretler (Dota'da görünmez mayını
Sentry gösterir), tüm güvenli hücreleri açar. Crownfall'dan hiçbir görsel ya da ses kullanılmaz.

## Zorluklar

| Zorluk | Tahta | Mayın | Skor |
|---|---|---|---|
| Çaylak | 9×9 | 10 | yerel rekor (bu cihaz) |
| **Orta** · sıralı | 16×16 | 40 | **skor tablosu** (`submitResult`) + profil + “En iyin” |
| Immortal | 16×30 (dar ekranda 30×16) | 99 | yerel rekor (bu cihaz) |

Seçim `csk:mayin-diff` içinde hatırlanır. Her zorluğun en iyi süresi `csk:mayin-best` (`{ caylak, orta, immortal }`),
oynanan/kazanılan tahta sayıları `csk:mayin-stats` içinde tutulur. HUD'daki **Rekor** seçili zorluğun en iyisidir
(Orta için profildeki skor). Kurallarda ve başlangıç kartında “skor tablosuna yalnızca Orta yazılır” denir.

## Kurallar

- Hücreyi aç: sayı, çevresindeki sekiz hücredeki mayın sayısıdır; boş (0) hücreler çevresini kendiliğinden açar.
- **İlk açılış her zaman güvenli** ve bir alan açar: mayınlar ilk tıklamadan sonra, tıklanan hücre ve sekiz
  komşusu dışında rastgele yerleştirilir.
- **Sentry (bayrak):** sağ tık, dokunmatikte **uzun basış (350 ms)** ya da **Bayrak modu** düğmesi. Sentry'li
  hücre açılmaz. HUD'daki **Mayın** sayacı = mayın − Sentry (eksiye düşerse kırmızı).
- **Akor:** açık bir sayıya tıkla/dokun; çevresindeki Sentry sayısı sayıya eşitse kalan kapalı komşular birden
  açılır. Eşit değilse komşular kısa süre kırmızı yanar (hiçbir şey açılmaz). Orta tık da akordur.
- **Süre** ilk açılışta başlar, onda bir saniye hassasiyetle ölçülür; sekme gizliyken durur (kit `createRunner`).
- **Kazanma:** tüm güvenli hücreler açılınca. Kalan mayınlara otomatik Sentry konur, yüz güneş gözlüklü
  (yıldız gözlü) olur, konfeti + zafer sesi, ardından sonuç kartı.
- **Kaybetme:** mayına basılınca basılan mayın büyük patlar, diğer mayınlar uzaklığa göre sırayla
  **zincirleme patlar** (en çok 1,6 sn), doğru Sentry'ler yeşil çerçeveyle yerinde kalır, yanlış Sentry'lere
  kırmızı çarpı; ardından **DOG DOG DOG** damgası ve kayıp kartı. Kaybedilen tahta skor tablosuna yazılmaz.
- **Techies yüzü** (HUD'daki düğme): her an yeni tahta (aynı zorluk). İfadeler: sırıtış (bekleme), “o” ağız
  (basılıyken), yıldız gözler (kazanma), çarpı gözler + is + duman (kaybetme).
- Oyun sürerken araç çubuğundan zorluk değiştirmek onay ister (sayfa içi `fx.confirm`).

**Kazanma kartı:** süre, rekor rozeti (Orta: profil rekoru; diğerleri: yerel rekor, başlıkta “yerel rekor”),
Zorluk, Tıklama, **3BV** (tahtanın en az tıklama sayısı: açıklıklar + açıklığa değmeyen sayılar), **Verim**
(3BV ÷ tıklama), Sentry, Kazanma (kazanılan/oynanan), zorluğa ve süreye göre söz, “Sıradaki tahta” seçicisi.
**Kayıp kartı:** “%N temizlendi”, Süre, Açılan, Doğru Sentry, söz, zorluk seçicisi, “Tekrar dene”.

## Denetimler

| Giriş | Masaüstü | Dokunmatik |
|---|---|---|
| Aç | sol tık | dokun (Kaz modu) |
| Sentry | sağ tık | uzun bas (350 ms, dolan mavi halka) ya da Bayrak modunda dokun |
| Akor | açık sayıya sol tık ya da orta tık | açık sayıya dokun |
| Klavye | oklar imleç, **Boşluk / Enter** aç (sayıda akor), **F** Sentry | — |

- Uzun basış halkası 350 ms'de dolar (titreşim yok, yalnızca görsel); parmak 10 px'ten fazla kayarsa
  (sayfayı kaydırma) iptal olur. Bayrak modunda roller yer değiştirir: dokunuş Sentry, uzun basış açar.
- Sağ tık / uzun basış bağlam menüsü açmaz; tahtada metin seçimi ve iOS çağrı balonu kapalı.
- Tahta `role="grid"`, imleç `aria-activedescendant` ile duyurulur (“3. satır, 5. sütun: 2 mayın komşu”);
  açılan hücre sayısı, Sentry ve sonuçlar canlı bölgede okunur. Odak halkası yalnızca klavyeyle gelindiğinde görünür.
- **Site kısayolları** (H Q W E R D F T Z; F burada Sentry'dir) tahta odaktayken ve oyun sürerken kapalı,
  bitişten 0,9 sn sonra ve temizlikte açılır. Boşluk ve oklar tahtadayken sayfayı kaydırmaz.

## Mobil çözüm (390 px)

- 620 px altında sahne iki kenara kadar uzar (kenar boşluğu 4 px): **Orta 16×16**, ~23 px hücreyle yatay
  kaydırma olmadan sığar; hücre en az 22 px'tir.
- **Immortal**: sütun sayısı satırdan fazla ve hücre 26 px'in altına düşecekse tahta **dikey çevrilir**
  (16×30 → 30 satır × 16 sütun). Aynı zorluk, aynı mayın sayısı; tahta uzun olur ve sayfa doğal olarak kayar
  (iç içe dikey kaydırma yok). Karar oyun başında verilir, oyun sürerken değişmez.
- **Yakınlaştır** düğmesi (yalnızca dokunmatik/dar ekranda ve hücre 32 px'in altındaysa): hücreler ×1,6
  (en çok 40 px); tahta kendi kabında **yalnızca yatay** kayar (`overscroll-behavior-x: contain`), sayfada yatay
  taşma olmaz. Kaz / Bayrak modu ve Yakınlaştır 44 px dokunma hedefleridir.
- Masaüstünde hücre boyu hem genişliğe hem yüksekliğe göre seçilir (Orta 1440×900’de 34 px, Immortal 26 px,
  Çaylak 48 px) ki başlık, HUD ve tahta birlikte görünsün.

## Çizim notları (özgün)

- **Yakınlık mayını** (üstten): sekiz saplamalı koyu metal halka, iç plaka, parlak kırmızı ışık ve yansıma.
- **Sentry ward**: ahşap direk + üç ayak, kıvrık tutucu içinde mavi parlayan göz küresi ve halesi.
- **Techies yüzü**: yeşil cin başı, sivri kulaklar, pirinç çerçeveli mavi gözlük; dört ifade CSS ile açılıp kapanır.
- Sayı renkleri site paletinden: 1 buz mavisi (#62c8ff), 2 Radiant yeşimi, 3 kor, 4 arcane moru, 5 Dire kırmızısı,
  6 Aegis altını, 7 metin, 8 soluk metin. Kapalı hücreler satranç tahtası gibi iki tonlu (saymayı kolaylaştırır).
- Açılış kademeli (tıklanan hücreden uzaklığa göre 28 ms gecikme), Sentry “dikilme” animasyonu, patlama
  parıltısı. `prefers-reduced-motion`: animasyon yok, kayıpta tüm mayınlar bir anda gösterilir, konfeti yok.

## Test notları

Playwright (1440×900 masaüstü, 390×844 dokunmatik mobil). Yalnızca geliştirme sunucusunda açılan
`window.__mayinDebug()` (mayın konumları, açık/Sentry hücreler, sayılar, 3BV, hücre boyu) çözücü bota her
güvenli hücreyi gerçek tıklama/dokunuşla açtırır; **üretim derlemesinde yoktur**, temizlikte silinir.

- Çaylak: ilk tık her iki görünümde güvenli ve bir alan açtı (0 hücre, 29–54 açılış). Masaüstünde sağ tıkla,
  mobilde iki **uzun basış** (CDP dokunma olayları) ve bir **Bayrak modu** dokunuşuyla üç Sentry kondu.
  **Akor** komşuları açtı. Tahta çözüldü → kazanma kartı; `csk:mayin-best.caylak` yazıldı, skor tablosuna gitmedi.
- Orta: bir doğru + bir yanlış Sentry, sonra bilerek mayına basıldı → zincirleme patlama, yanlış Sentry'de
  çarpı, DOG DOG DOG damgası, kayıp kartı; profile skor yazılmadı. İkinci Orta tahtası çözüldü →
  `csk:me.scores.mayin` = sonuç kartındaki süre, yan sütundaki Mayın tablosunda satır göründü.
- Immortal: masaüstünde 16×30 (26 px), mobilde 30×16 (23 px) çevrildi; yatay taşma yok.
- Mobil Yakınlaştır: 37 px hücre, yalnızca tahta kabı yatay kaydı; yakınlaştırılmış hücreye dokunuş açtı;
  hücre üstünden parmak sürükleme uzun basışı iptal etti (Sentry konmadı).
- Klavye: Başla'ya Enter → tahta odakta (halka görünür); Boşluk açtı, sayfa kaymadı; oklar + F Sentry
  koyup kaldırdı; oyunda `Q` ve `F` siteyi gezdirmedi.
- Konsol hatası 0, yatay taşma yok (iki görünüm), `VITE_API_BASE=none vite build` başarılı.

## Önerilen rozetler

Kategori: **Zihin**. Skor yalnızca kazanılan Orta tahtasının süresidir (düşük iyi):

| Rozet (öneri) | Koşul |
|---|---|
| Mayın Temizleyici | `mayin` skoru var (bir Orta tahtası kazanıldı) |
| Sentry Ustası | `mayin ≤ 90` sn |
