# DOG Avı (`dogavi`)

**Rota:** `#oyunlar--dogavi` · **Tür:** Aktif · Alan etkili (refleks) · **Skor:** puan (yüksek iyi)
**Dosyalar:** `src/sections/games/whack.js`, stiller `games.css` (`gm-wh-`)

## Kurallar
- 45 saniye. Koridor çukurlarından DOG'lar (DOG Arşivi türleri) kafasını çıkarır: dokun → **REPORT!**
- Puan: `(10 + 2 × min(seri, 10)) × çarpan`. Smurf Köpeği ×2 (ama hızlı kaçar), Çift Hasar ×2.
- Her 5'li seride **DOG DOG DOG** bonusu: `25 × (seri / 5)`.
- Altın parlayan **1vDOQUZ** senin carry'n: ona vurursan −30 puan ve seri sıfırlanır.
- Kaçan DOG ya da boş çukura dokunmak seriyi bozar.
- **Rune'lar (yeni):** ara sıra çukurdan bir rune çıkar (oyun başına en çok 3, aralarında en az 9 sn):
  - **Çift Hasar** — 8 saniye ×2 puan (tahta mor parlar, HUD'da geri sayım rozeti).
  - **Aegis** — bir sonraki hatada (kaçan DOG, boş çukur, carry'ye vuruş) serin korunur; HUD'da kalkan.
  Rune kaçarsa ceza yok; rune'a dokunmak seriyi ne artırır ne bozar, isabete sayılır.
- Zorluk rampası: süre ilerledikçe çıkış sıklığı ve aynı anda açık çukur sayısı artar (2 → 4, geniş ekranda +1),
  DOG'ların yukarıda kalma süresi 1,25 → 0,66 sn'ye iner, 1vDOQUZ olasılığı %10 → %20.

## Kontroller
| Giriş | İş |
|---|---|
| Dokun / tıkla | Çukura vur (`pointerdown`: gecikmesiz) |
| `1`–`9` | Dar ekranda 3×3 çukurlar |
| `1–4` / `Q–R` / `A–F` | Geniş ekranda (≥640 px sahne) 4×3 çukurlar |
| Enter / Boşluk | Odaktaki çukur |

Oyun sırasında sitenin gezinme kısayolları kapalıdır (Q/W/E/R çukur tuşu).

## Sonuç kartı
Report edilen · İsabet (DOG + rune / tüm dokunuşlar) · En uzun seri · Carry / kaçan · Rune (Aegis'in kurtardığı
seri sayısıyla) · Seri bonusu.

## Bu turda değişenler
- **Rune güçleri:** Çift Hasar ve Aegis (yukarıda). Sonuç kartında rune istatistiği.
- **Dokunmatik çift sayım düzeltmesi:** dokunuştan sonra tarayıcının ürettiği `detail: 0` click, klavye
  etkinleştirmesi sanılıp boş çukura tek dokunuşu iki ıska sayabiliyordu. Artık işaretçi kaynaklı ya da son
  600 ms'de işlenmiş basışın click'i yok sayılır (Playwright dokunmatik testiyle doğrulandı: 1 boş + 1 isabet = %50).
- **Kafa kırpılması:** köstebek boyu kuyu yüksekliğine göre (`container-type: size`, `cqh`) hesaplanır; dar
  çukurlarda etiket ve kafa artık kesilmiyor. Mobilde çukurlar daha kare (1 / 0,95) — daha büyük hedef.
- Hareket azaltma açıkken rune parıltı animasyonu kapalı.
- Not: rune'lar yüksek skoru bir miktar artırır; eski rekorlar rune'suz yapılmıştı.
