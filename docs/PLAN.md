# Geliştirme Planı

Analiz için bkz. [ANALIZ.md](ANALIZ.md). Oyun tasarım belgeleri: [oyunlar/](oyunlar/).

## Hedefler
1. **Oyunları çeşitlendir:** 5 oyundan 10 oyuna; refleks, zihin, günlük ve yayın kategorileri.
2. **Mevcut oyunları geliştir:** zorluk seçenekleri, kahraman portreli modlar, hata/akış düzeltmeleri.
3. **Optimize et:** kişi başı aktarımı ve istek sayısını düşür, tekrar ziyaretleri önbellekten sun.
4. **Siteyi toparla:** paylaşım önizlemesi, favicon/manifest, oyun salonu yeniden düzeni, rozetler.
5. **Belgele:** analiz, plan, oyun tasarımları, mimari ve optimizasyon sonuçları `docs/` altında.

## Yeni oyunlar
| id | Oyun | Tür | Özet |
|---|---|---|---|
| `dogdle` | DOGdle | Günlük | Her gün bir gizli kahraman; özellik karşılaştırmasıyla bul. Seri ve paylaşılabilir sonuç. |
| `portre` | Portre Avı | Refleks/Bilgi | Yakınlaştırılmış, bulanık portreden kahramanı tanı; açıldıkça puan azalır. |
| `invoker` | Invoker Kombo | Refleks | Q/W/E kürelerini dizip R ile büyüyü çağır; 60 sn’de en çok büyü. |
| `hook` | Pudge Hook | Beceri | Nişan al, kancayı fırlat; düşmanı çek, dosta çarpma. |
| `bingo` | DOG Bingo | Yayın | 5×5 yayın bingosu; yayında olan DOG anlarını işaretle. |

Quizlere ek: **Yetenek Avı** — yetenek adından kahramanı bul (OpenDota yetenek verisi, derleme anında).

## Optimizasyon
- Fontları Türkçe glif kümesine alt küme olarak indir, tek dosya/kalınlık (`scripts/subset-fonts`).
- Statik yayında bölüm bazlı JS parçaları + hash’li dosya adları + `immutable` önbellek; Artifact sürümü
  eskisi gibi tek paket (`--mode artifact`).
- 3D halka için tek sprite atlas; GLB dokularında boyut/kalite ayarı.
- Open Graph, favicon, web manifest.

## İş dağılımı (paralel ajanlar)
| Dalga | Ajan | Kapsam |
|---|---|---|
| 1 | Performans | fontlar, bölünmüş derleme, önbellek, atlas, GLB, OG/manifest, `docs/OPTIMIZASYON.md` |
| 1 | Kahraman oyunları | DOGdle, Portre Avı |
| 1 | Refleks oyunları | Invoker Kombo, Pudge Hook |
| 2 | Yayın & quiz | DOG Bingo, Yetenek Avı quizi |
| 2 | Salon & cila | Oyun salonu yeni düzeni (10 oyun), rozetler, mevcut 5 oyunun geliştirilmesi |
| 3 | Entegrasyon | uçtan uca test (masaüstü + mobil), belgeler, yayına alma |

Kurallar: her ajan yalnızca kendi dosyalarına dokunur; ortak kayıt dosyalarını (games.js, quizzes.js)
entegrasyon yapar. Yayına alma tek seferde (15 kredi).

## Sonuç (25 Eylül 2026)

Tüm dalgalar tamamlandı ve entegre edildi.

- **Oyunlar:** 5 → 10 oyun (DOGdle, Portre Avı, Invoker Kombo, Pudge Hook, DOG Bingo eklendi); quizler 4 → 5
  (Yetenek Avı). Mevcut oyunlara: DOG Avı rünleri, Last Hit çizgisi ve LH verimi, Hafıza kahraman destesi,
  Rune yemi ve geçmiş grafiği. Özet: [OYUNLAR.md](OYUNLAR.md).
- **Salon:** kategori filtreleri, günün meydan okuması (DOGdle), 1–9 kısayolları, 10 oyunluk envanter, 23 rozet.
- **Ana sayfa:** “Oyun Salonu’nda yeni” bölümü, DOGdle geri sayımı, rozet kartı.
- **Performans:** ana sayfa −%31, kahramanlar −%46, tur −%19; tekrar ziyaretlerde yalnızca HTML iner.
  Ayrıntılar: [OPTIMIZASYON.md](OPTIMIZASYON.md).
- **Paylaşım:** Open Graph görseli, favicon, uygulama simgeleri, web manifest.
- **Test:** 16 bölüm/alt sayfa + 10 oyun + 5 quiz, masaüstü (1440) ve mobil (390): konsol hatası 0, 4xx 0,
  yatay taşma yok; her oyun ajanının kendi uçtan uca oynanış testleri (`docs/oyunlar/*.md` → Test notları).

### Bilinen sınırlar
- claude.ai Artifact sürümü tek yayında en fazla 255 dosya kabul eder; yetenek ikonlarıyla dosya sayısı
  bunu aşar (yayınlamak gerekirse ikonlar sprite’a toplanmalı ya da parti parti yüklenmeli).
- Netlify ücretsiz planındaki “Powered by Netlify” rozeti yalnızca panelden kapatılabilir.
- `heroes.js` sırası değişirse gelecekteki DOGdle cevapları yeniden karılır (belgelendi).

---

## 2. Tur planı

| Ajan | Kapsam |
|---|---|
| Rehber & UX | İlk giriş turu (HUD + yetenek çubuğu, spot ışığı + kısa ipuçları, Geç/İleri/Geri, klavye), `?` yardım paneli (kısayollar), “Turu yeniden başlat”, ad çipinden profil menüsü, küçük sürprizler (Konami kodu) |
| Profil | `#profil`: Fan Kartı (takma ad, avatar kahraman, DOG sayısı, tüm rekorlar, quiz sonuçları, rozetler), paylaşılabilir kart görseli, Günlük Görevler (her gün 3 görev, XP ve seviye) |
| Oyunlar A | **Uçan Kurye** (Flappy türü, sonsuz), **Techies Mayın Tarlası** (mayın tarlası, 3 zorluk) |
| Oyunlar B | **Eşya 2048** (Dota eşya zinciriyle birleştirme), **24 Saat Maraton** (yayın simülasyonu: enerji, chat, MMR) |
| Salon & cila (2. dalga) | 14 oyunluk salon, yeni rozetler, kişisel deneme geçmişi tabloları, 1. tur oyunlarının eleştirel gözden geçirmesi ve iyileştirmesi, ana sayfa güncellemesi |

Altyapı (entegrasyon, ajanlardan önce): `src/core/history.js` (her `submitScore` denemesini tarih ile kaydeder),
gizli `#profil` rotası (yetenek çubuğunda slotu yok), dört yeni oyun için iskelet kayıtları.

## 2. Tur sonucu (25 Eylül 2026)

- **İlk giriş turu** (masaüstünde 12, mobilde 11 adım): yetenek çubuğunun her slotu ve HUD; R adımı “ulti” vurgulu;
  `?` yardım paneli, ad çipi menüsü, altbilgideki “Rehber” sütunu ve `#tur` bağlantısıyla tekrar açılır.
  Ayrıntı: [REHBER.md](REHBER.md).
- **Profil / Fan Kartı** (`#profil`): avatar kahraman, seviye ve rütbe, 14 oyun + 5 quiz rekoru, rozetler,
  paylaşılabilir kart görseli, veri dışa/içe aktarma. **Günlük görevler**: her gün 3 görev (23 şablonluk havuz).
  Ayrıntı: [PROFIL.md](PROFIL.md).
- **4 yeni oyun** (toplam 14): Uçan Kurye, Techies Mayın Tarlası, Eşya 2048, 24 Saat Maraton.
- **Rozetler** 23 → 31. **Skor tabloları** statik yayında kişisel “Rekor defterin” (son denemeler, gelişim çizgisi).
- **9 oyunun eleştirel cilası**: Portre Avı spam kilidi ve “null” hatası, Invoker geri sayım ve sıradaki büyü,
  Hook isabet duraklaması ve “Kıl payı!”, Kurye okunur ölümler ve rekor çizgisi, Mayın mobil bayrak ipucu,
  Eşya koleksiyonu, Maraton “yayın neden bitti” kutusu, Bingo “1 kala” vurgusu, DOGdle mobil kahraman adları.
  Ortak `juice.js`: rekor notu, oyun içi “REKOR!” anı, titreşim.
- **Test**: 19 bölüm/alt sayfa, 14 oyun, 5 quiz ve tur; masaüstü (1440) + mobil (390): konsol hatası 0,
  4xx 0, yatay taşma yok; her ajanın oynanış botları (`docs/oyunlar/*.md` → Test notları).

---

## Arena 3.0 sonuçları (26 Eylül 2026)

Plan: [ARENA-TASARIM.md](ARENA-TASARIM.md) (faz A–F). Arena 2.0’ın dalga modu; Dota mekanikleri, hikâyesi ve kalıcı
ilerlemesi olan bir aksiyon-RPG’ye dönüştü.

- **Savaş derinliği (B):** Güç/Çeviklik/Zekâ, fiziksel/büyü/saf hasar hattı (zırh, büyü direnci, kaçınma, kritik, blok,
  kalkan, can çalma), durum etkileri (sersemletme, kök, susturma, korku, dönüşüm …) ve statü direnci, yetenek seviyeleri
  + 10/15/20/25 yetenek ağacı, 16 tarif eşyası, orman kampları ve 9 orman eşyası, gece-gündüz ve görüş, deny, geri alma,
  5 boss; iki yeni kahraman (Şimşek Ruhu, Ağaç Bekçisi) → [oyunlar/arena.md](oyunlar/arena.md).
- **Kalıcı ilerleme (C):** Parıltı Taşı, Aghanim Kütüphanesi (10.945 Parıltı’lık ağaç), 8 ustalık kademesi, 18 yetenek
  varyantı, başlangıç çantaları, kozmetikler, 10 Lanet seviyesi, Kodeks; 6 yeni rozet (toplam 37) →
  [ARENA-ILERLEME.md](ARENA-ILERLEME.md).
- **Hikâye ve modlar (D):** “Dokuzun Laneti” — 5 bölüm, 15 görev, Kurye anlatıcı, diyalog kartları, yıldızlar, final;
  mod merkezi (Hikâye / Sonsuz / Günlük / Kütüphane / Kodeks), günlük meydan okuma → [oyunlar/arena-hikaye.md](oyunlar/arena-hikaye.md).
- **Görseller (E):** 6 yeni 3D model; galeride “Arena Hikâyesi” grubu (5 bölüm afişi + 5 boss portresi), 3D Müze Salon III.
- **QA (F):** 15 hata düzeltildi (13 Arena + 2 site: Espri Duvarı kart kırpması, yatay telefonda HUD saati; mobilde +N düğmesinin portreyi örtmesi, dükkân orman yuvası kırpılması, diyalogda
  duraklatma, diyalog yarışı, bölümden çıkınca açık kalan pencere, kilitli görevin geri yüklenmesi, yatay telefon ve dar
  pencere HUD’u, library.js’in her açılışta inmesi …) → [oyunlar/arena.md → Test notları (faz F)](oyunlar/arena.md#test-notları-faz-f).

**Testler (faz F sonu, `HEAD` üzerinde):**

| Takım | Sonuç |
|---|---|
| Node: hikâye / ilerleme / senaryo / varyant | 62/62 · 17/17 · senaryo tümü · 18 varyant, 0 istisna |
| Görev simülasyonu (görev bilen bot, 6 kahraman × 15 görev × 2) | 174/180 zafer; bulanık test 0 istisna |
| Playwright Arena (1440×900 + 390×844 dokunmatik) | hikâye 59/59 + 58/58, dokunmatik HUD 11/11 ×2, uç durumlar 37/37 + 36/36, 2D yedek 11/11 ×2, erişilebilirlik 21/21, yaşam döngüsü 9/9, rastgele 8/8, yatay telefon 10/10 ×3 |
| Faz B kahraman matrisi (6 kahraman × masaüstü + mobil) | MATRIX_PLACEHOLDER |
| Tüm site duman testi (tüm rotalar, 14 oyun, quizler, galeri, müze, tur) | masaüstü + mobil: konsol hatası 0, başarısız istek 0, sayfa taşması 0, içerik kırpması 0, kırık görsel 0 |
| Canlı (https://cureshot-dog.netlify.app) | LIVE_PLACEHOLDER |
| Derleme | `build:static` ✓, `build` (Artifact) ✓ |
