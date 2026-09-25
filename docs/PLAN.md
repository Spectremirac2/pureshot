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
