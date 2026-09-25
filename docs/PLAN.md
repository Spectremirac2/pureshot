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
