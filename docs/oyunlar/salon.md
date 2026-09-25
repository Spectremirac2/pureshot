# Oyun Salonu (`#oyunlar`)

**Dosyalar:** `src/sections/games/games.js` (merkez + oyun sayfası kabuğu), `games.css`, ortak iskelet `kit.js`,
rozetler `src/core/badges.js` (bkz. [rozetler.md](rozetler.md)).

Salon, on dört oyunun tek giriş kapısıdır. Oyun sayısı ve bütün metinler `GAMES` listesinden türetilir:
listeye bir oyun eklenince başlık ("On dört mini oyun…"), envanter yuvaları, Aegis metni, kategori sayıları,
skor tablosu sekmeleri ve kısayollar kendiliğinden güncellenir. Oyun modüllerini yüklemeyen sayfalar (ana sayfa,
profil) için hafif katalog `SALON_GAMES` (`core/badges.js`): ad, simge, renk, tür, birim, skor yönü, biçimleyici,
"yeni" etiketi. Yeni bir oyun eklenince oraya da bir kayıt girilir (bkz. [rozetler.md](rozetler.md)).

## Sayfa düzeni (yukarıdan aşağı)

| Bölüm | İçerik |
|---|---|
| Başlık | "W · Mini Oyunlar", **Oyun Salonu**, oyun sayısı yazıyla (`SAYI` tablosu: 1–20; şu an "On dört") |
| Günün meydan okuması | DOGdle kartı: `#N` bulmaca numarası, İstanbul gece yarısına canlı geri sayım, bugünkü durum, en iyi skor, düğme |
| Rekor envanteri | Her oyun için bir yuva + **Aegis** (hepsinde rekor). 4 sütun (dar ekranda 6); Aegis kalan hücreleri doldurur |
| Kategori süzgeci | Tümü · Refleks · Zihin · Günlük · Yayın (sayılarla) + masaüstünde kısayol ipucu |
| Oyun ızgarası | Tam genişlik **1vDOQUZ Arena** afişi + 3 sütunlu oyun kartları (tablet 2, mobil 1); son satırdaki boşluğa **Rekor defteri** kutucuğu |
| Rozetler | 31 rozet, ilerleme sayacı ve çubuğu; mobilde ilk 6 + "Tümünü göster" |
| Salon tablosu / Rekor defterin + sohbet | 14 sekmeli skor tablosu (kendi içinde yatay kayar) ve `games` sohbeti. Statik yayında sekmeler kişisel rekor defterini gösterir (aşağıda) |

### Günün meydan okuması (DOGdle)
- Geri sayım: `msToIstanbulMidnight()` — İstanbul UTC+3 (yaz saati yok) gece yarısına kalan süre, saniyede bir
  güncellenir (salon gizliyken durur). Ekran okuyucu için dakikada bir "x saat y dakika".
- Durum: `dogdle.js` → `todayStatus()` `{ n, done, won, guesses, streak }` kullanılır:
  "Bugün çözüldü · 3 tahmin · 4 gün seri", "2 tahmin yaptın, devam et" ya da "Bugün çözülmedi".
  Düğme metni de buna göre değişir (Bugünün kahramanı / Devam et / Sonucuna bak).
- Yedek: modül `todayStatus` vermezse `puzzleNumber()` + yerel kayıt `csk:dogdle:day` (`{ n, guesses, solved }`)
  karşılaştırılır; ikisi de yoksa durum gizlenir. `puzzleNumber()` varsa başlıkta `#N` görünür.

### Kategoriler
Kategori tablosu `CAT_OF` games.js içindedir (oyun modüllerine bağımlı değil). Bir oyun birden çok
kategoride olabilir.

| Kategori | Oyunlar |
|---|---|
| Refleks (7) | Arena, DOG Avı, Last Hit, Rune, Invoker Kombo, Pudge Hook, Uçan Kurye |
| Zihin (5) | DOG Hafıza, Portre Avı, DOGdle, Techies Mayın Tarlası, Eşya 2048 |
| Günlük (1) | DOGdle |
| Yayın (2) | DOG Bingo, 24 Saat Maraton |

Tabloda olmayan yeni bir oyun gelirse sırasıyla `meta.cat`/`meta.cats`, sonra `meta.kind` metni
("Günlük", "Yayın", "Zihin/Hafıza/Tahmin/Bilgi") denenir; hiçbiri yoksa Refleks sayılır. Oyunu olmayan
kategori çipi gösterilmez. Seçim `csk:gm-cat` anahtarında hatırlanır.

### "Yeni" etiketi
`NEW_GAME_IDS` (badges.js → `SALON_GAMES[].isNew`): yalnızca en son gelen dört oyun — kurye, mayin, esya, maraton
(1. tur oyunlarının etiketi kaldırıldı). Kartta turuncu "Yeni" etiketi ve hafif farklı zemin; ana sayfadaki "yeni
oyunlar" şeridi de aynı listeyi gösterir. Etiketi kaldırmak için `isNew` alanını silmek yeter.

### Rekor defteri kutucuğu
Görünür kart sayısı sütun sayısına bölünmüyorsa son satırdaki boşluğu `#profil--rekorlar` bağlantılı bir kutucuk
doldurur: "N/14 oyunda rekor", son oynanan üç oyun (deneme geçmişinden; skor + "3 dk önce"). `applyFilter` ızgaraya
`data-r3` / `data-r2` (kalan hücre) yazar, CSS gösterir: 3 sütunda 1 boş hücre → 2 hücre genişliğinde, 2 boş → 1 hücre;
2 sütunda 1 boş → 1 hücre; tek sütunda (mobil) ve satır tamken gizli. Tümü (13 kart): masaüstünde geniş kutucuk.

### Rekor envanteri
- Yuva "şarjı": `meta.charge(v)` varsa o; yoksa kısa birimler sayıya eklenir (`ms` → `287ms`), diğerleri
  `compact()` (1,5B). Düşük-iyi oyunlar (Rune ms, DOGdle tahmin) `meta.format` ile doğru yazılır.
- 14 yuva + Aegis: 4 sütunda Aegis son 2 hücreyi, mobilde (6 sütun) son 4 hücreyi kaplar.
- Aegis: `n/N`; alt metin "N/14 oyunda rekorun var. Aegis için kalan altı oyunu da dene." →
  hepsinde "On dört oyunda da rekorun var. Aegis senin."

## Klavye

| Tuş | İş |
|---|---|
| `1`–`9` | Görünür sıradaki oyun kartını açar (süzgece göre yeniden numaralanır; Arena hariç) |
| `R` | Arena (kabuk kısayolu) |
| `W` | Salon (kabuk kısayolu) |
| `← →`, `Home`, `End` | Skor tablosu sekmelerinde gezinme |

Yazı alanında (sohbet) ya da açık pencerede kısayollar çalışmaz. Dar ekranda kart kısayol rozetleri ve
ipucu gizlenir.

## Skor tablosu sekmeleri
14 sekme tek satırda; şerit kendi içinde yatay kayar (sayfa kaymaz), seçili sekme ortalanır, kenarlarda
gölge; masaüstünde kaydırılabilir yöne ok düğmeleri çıkar (dokunmatikte gizli). Seçim `csk:gm-lb-tab`.

### Statik yayında: Rekor defterin
Netlify yayını statiktir (veriler yalnızca ziyaretçinin tarayıcısında), bu yüzden "ilk 10" tablosu tek satır olurdu.
`components/leaderboard.js` `store.shared` yanlışken kişisel görünüm çizer; salonda başlık "Kişisel · son denemeler /
Rekor defterin" olur, sekme seçili oyunun rengini (`--gc`) verir. Görünüm (her `mountLeaderboard` kullanan yerde aynı:
oyun sayfalarının yan sütunu, Arena, Bilgi Yarışması, Yetenek Avı, Kahramanlar → "Daha DOG mu?"):

- **En iyin** (büyük; düşük-iyi oyunlarda "En iyin · düşük iyi"), "N deneme · son: 3 dk önce" (N ömür boyu deneme
  sayısı: `history.count(id)`, liste 20 kayıtla sınırlı olsa da doğru sayar).
- **Gelişim çizgisi** (satır içi SVG): son ≤ 20 deneme, yukarı her zaman daha iyi (düşük-iyi oyunlarda eksen ters),
  kesikli çizgi rekor seviyesi, altın nokta rekor, beyaz nokta son deneme. Tek denemede yerine kısa bir ipucu.
- **Son denemeler** yeniden eskiye: `#deneme no`, göreli zaman (üzerinde tam tarih), skor (oyunun `format`'ı).
  Rekoru ilk yazan deneme altın zeminli "Rekor" etiketiyle vurgulanır; katlanmışken ilk 5 satır + (dışarıda kaldıysa)
  "···" ve rekor satırı; "Tüm denemeler (N)" açar.
- Not: "Skorlar bu cihazda tutuluyor. Tüm rekorların →" (`#profil--rekorlar`). Hiç deneme yoksa boş durum kutusu;
  skor var ama geçmiş yoksa (1. tur skorları) yalnızca en iyi skor.
- Canlı: `history.subscribe` (yeni deneme: satır kısa süre parlar, en iyi değer zıplar), `store.me.subscribe` (rekor),
  başka sekmeden `storage` olayı, göreli zamanlar 30 sn'de bir tazelenir. Paylaşılan arka uçta eski "ilk 10" tablosu
  hiç değişmeden çizilir. Stiller bileşenin içinde (`lbp-` öneki, tek `<style>`); `mountLeaderboard` API'si aynı
  (isteğe bağlı yeni seçenek: `personalTitle`).

## Alt sayfalar
- `#oyunlar--<id>` oyunu açar (Arena tembel yüklenir).
- `#oyunlar--rozetler` salonu açıp Rozetler paneline kaydırır (ana sayfadaki rozet kartı buraya gider).

## Ortak iskelet (`kit.js`) eklemeleri — geriye uyumlu
- `introCard(meta, { …, extra, rules })`: kuralların altına düğüm (ör. mod seçici), isteğe bağlı kural listesi.
- `resultCard(meta, { …, practice, extra, quiet, retryLabel, retryIcon })`: `practice` skoru kaydetmez ve
  "Antrenman" etiketi gösterir; `quiet` ses/konfeti çalmaz (geri yüklenen sonuçlar); tekrar düğmesi metni/ikonu.
- İstatistik ızgarası `n-<adet>` sınıfı alır: 3 istatistik ≤400 px'te de tek satırda kalır.
- `hudStat(label, value, { compact })`: uzun değerler (ör. `18:32:55`) dar ekranda küçülür.
- Rekor yuvasındaki "boş" durum sınıfı `is-empty` (genel `.empty` boş-durum kutusuyla çakışıp mobilde yuvaları
  şişiriyordu — düzeltildi).

## Test notları (2. tur, salon ve altyapı)
Playwright (dev sunucusu, HMR engelli), masaüstü 1440×900 ve mobil 390×844 (`isMobile`, `hasTouch`); ayrıca 1024 ve 820 px:
- Salon: başlık "On dört mini oyun", 13 kart + Arena afişi, "Yeni" yalnızca Uçan Kurye / Mayın Tarlası / Eşya 2048 /
  24 Saat Maraton'da; kategoriler Tümü 14 · Refleks 7 · Zihin 5 · Günlük 1 · Yayın 2; envanter 14 yuva + Aegis
  ("On dört oyunda da rekorun var"); 14 sekmeli tablo şeridi. Rekor defteri kutucuğu: Tümü'de 2 hücre, Zihin/Yayın'da 1
  hücre (masaüstü), 2 sütunda yalnızca tek sayıda kartta, mobilde gizli.
- Kişisel tablo (tohumlanmış `csk:hist`): Uçan Kurye 12 deneme → en iyi 343 metre, 5 satır + "···" + rekor satırı,
  "Tüm denemeler (12)". Sayfanın kendi `store` örneğiyle `submitScore('kurye', 377)` → anında "#13 · az önce · Rekor ·
  377 metre", en iyi 377, "13 deneme". Mayın (düşük iyi: "112,4 sn", eksen ters), geçmişsiz skor (Invoker), hiç
  denemesi olmayan ziyaretçi (boş durum), Arena yan sütunu, Bilgi Yarışması, Yetenek Avı ve "Daha DOG mu?" aynı görünümle.
- Rozet bildirimi: `submitScore('kurye', 1024)` → "Yeni rozet · Bottle Teslimatı", ardından "Efsane Kurye";
  `picks['esya:tier'] = 11`, `picks['maraton:tamam'] = 1` → Divine Rapier ve Maraton Tamam bildirimleri. Panel 31 rozet.
- Günlük görevler: 365 günlük taramada kısıt ihlali 0 (havuz 23). Saat kaydırılarak yeni görevlerin geldiği günlerde
  (esya1000, kurye200, mayinOrta, maraton24) gerçek `submitScore` / `picks` yazımıyla görev tamamlandı → "Görev tamam ·
  +50 XP" bildirimi, ana sayfa kartında ✓.
- Ana sayfa: görev kartı (3 görev, ilerleme, geri sayım, seri, Fan seviyen çipi), dört yeni oyun şeridi (rekor ya da
  "Dene") ve DOGdle kartı; 1440'ta 3 sütun, 1024/820'de 2 sütun, 390'da tek sütun. Ad menüsü: "Profilim [7 ARCHON]".
- Profil rekorları: 14 oyun, yeni oyunlar doğru birimle (343 metre, 112,4 sn, 1.820 puan, 4.870 izleyici).
- Konsol hatası 0, 4xx 0, yatay taşma yok; `VITE_API_BASE=none vite build` uyarısız.
