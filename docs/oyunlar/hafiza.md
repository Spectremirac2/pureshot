# DOG Hafıza (`hafiza`)

**Rota:** `#oyunlar--hafiza` · **Tür:** Pasif · Zihin · **Skor:** puan (yüksek iyi)
**Dosyalar:** `src/sections/games/memory.js`, stiller `games.css` (`gm-mm-`)

## Kurallar
- İki kart çevir; aynıysa açık kalır, değilse 0,85 sn sonra kapanır (üçüncü karta dokunmak hemen kapatır).
- Her iki kart açma bir hamle; süre ilk kartla başlar.
- **Skor = 1000 − hamle × 20 − saniye × 5** (en az 0). Üst üste 3 eşleşme DOG DOG DOG damgası.

## Modlar (yeni)
Giriş kartında ve sonuç kartında seçilir; seçim `csk:hafiza:mode` anahtarında hatırlanır.

| Deste | Kartlar |
|---|---|
| DOG'lar | DOG Arşivi portreleri (10 tür) — eşleşince türün sloganı |
| Kahramanlar | Resmi Dota 2 kahraman portreleri (`heroPortraitUrl`) — eşleşince "İmza hareketi" |

| Masa | Kart | Skor |
|---|---|---|
| 4×4 | 8 çift | **Sıralı**: tabloya ve rekoruna yazılır (iki deste de; aynı çift sayısı, aynı formül) |
| 5×4 Zor | 10 çift | **Antrenman**: skor 8 çifte ölçeklenir (`hamle×0,8`, `sn×0,8`), tabloya yazılmaz |

Zor masa geniş ekranda 5 sütun, dar ekranda 4 sütun × 5 satır. DOG Arşivi'nde 10 tür olduğu için Zor masa
iki destede de 10 çifttir. Kahraman portreleri deste dağıtılırken önceden indirilir (ilk çevirişte boş kart yok).

## Kontroller
| Giriş | İş |
|---|---|
| Tık / dokun | Kartı çevir |
| Tab, `← ↑ → ↓` | Kartlar arasında gez (tek sekme durağı; sütun sayısı ekrandaki ızgaradan okunur) |
| Enter / Boşluk | Kartı çevir |

## Bu turda değişenler
- Kahraman destesi ve 5×4 Zor (antrenman) masa; mod seçici giriş ve sonuç kartında.
- `kit.resultCard` `practice` seçeneği: antrenman sonucunda "Antrenman" etiketi, kayıt yok.
- Ok tuşu gezinmesi sabit 4 sütun yerine gerçek sütun sayısını kullanıyor.
- Sonuç esprileri masa boyuna göre ölçekleniyor.
- Rozet: **Hafıza Kralı** — 4×4 masada 600 puan.
