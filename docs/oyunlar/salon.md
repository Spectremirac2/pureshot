# Oyun Salonu (`#oyunlar`)

**Dosyalar:** `src/sections/games/games.js` (merkez + oyun sayfası kabuğu), `games.css`, ortak iskelet `kit.js`,
rozetler `src/core/badges.js` (bkz. [rozetler.md](rozetler.md)).

Salon, on oyunun tek giriş kapısıdır. Oyun sayısı ve bütün metinler `GAMES` listesinden türetilir:
listeye bir oyun eklenince başlık ("On mini oyun…"), envanter yuvaları, Aegis metni, kategori sayıları,
skor tablosu sekmeleri ve kısayollar kendiliğinden güncellenir.

## Sayfa düzeni (yukarıdan aşağı)

| Bölüm | İçerik |
|---|---|
| Başlık | "W · Mini Oyunlar", **Oyun Salonu**, oyun sayısı yazıyla (`SAYI` tablosu: 1–20) |
| Günün meydan okuması | DOGdle kartı: `#N` bulmaca numarası, İstanbul gece yarısına canlı geri sayım, bugünkü durum, en iyi skor, düğme |
| Rekor envanteri | Her oyun için bir yuva + **Aegis** (hepsinde rekor). 4 sütun (dar ekranda 6); Aegis kalan hücreleri doldurur |
| Kategori süzgeci | Tümü · Refleks · Zihin · Günlük · Yayın (sayılarla) + masaüstünde kısayol ipucu |
| Oyun ızgarası | Tam genişlik **1vDOQUZ Arena** afişi + 3 sütunlu oyun kartları (tablet 2, mobil 1) |
| Rozetler | Tüm rozetler, ilerleme sayacı ve çubuğu; mobilde ilk 6 + "Tümünü göster" |
| Salon tablosu + sohbet | 10 sekmeli canlı skor tablosu (kendi içinde yatay kayar) ve `games` sohbeti |

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
| Refleks | Arena, DOG Avı, Last Hit, Rune, Invoker Kombo, Pudge Hook |
| Zihin | DOG Hafıza, Portre Avı, DOGdle |
| Günlük | DOGdle |
| Yayın | DOG Bingo |

Tabloda olmayan yeni bir oyun gelirse sırasıyla `meta.cat`/`meta.cats`, sonra `meta.kind` metni
("Günlük", "Yayın", "Zihin/Hafıza/Tahmin/Bilgi") denenir; hiçbiri yoksa Refleks sayılır. Oyunu olmayan
kategori çipi gösterilmez. Seçim `csk:gm-cat` anahtarında hatırlanır.

### "Yeni" etiketi
`NEW_GAME_IDS` (badges.js → `SALON_GAMES[].isNew`): dogdle, portre, invoker, hook, bingo. Kartta turuncu
"Yeni" etiketi ve hafif farklı zemin. Etiketi kaldırmak için `isNew` alanını silmek yeter.

### Rekor envanteri
- Yuva "şarjı": `meta.charge(v)` varsa o; yoksa kısa birimler sayıya eklenir (`ms` → `287ms`), diğerleri
  `compact()` (1,5B). Düşük-iyi oyunlar (Rune ms, DOGdle tahmin) `meta.format` ile doğru yazılır.
- Aegis: `n/N`; alt metin "N/10 oyunda rekorun var. Aegis için kalan altı oyunu da dene." →
  hepsinde "On oyunda da rekorun var. Aegis senin."

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
10 sekme tek satırda; şerit kendi içinde yatay kayar (sayfa kaymaz), seçili sekme ortalanır, kenarlarda
gölge; masaüstünde kaydırılabilir yöne ok düğmeleri çıkar (dokunmatikte gizli). Seçim `csk:gm-lb-tab`.

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
