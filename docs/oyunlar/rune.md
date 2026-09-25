# Rune Refleksi (`rune`)

**Rota:** `#oyunlar--rune` · **Tür:** Anlık · Refleks · **Skor:** ortalama tepki süresi, ms (**düşük iyi**,
`higherIsBetter: false`) · **Dosyalar:** `src/sections/games/rune.js`, stiller `games.css` (`gm-rn-`)

## Kurallar
- 5 geçerli tur. Nehre dokun (ya da Boşluk/Enter) → "Bekle…" → 1,5–5 sn içinde rune belirir → dokun.
- Tepki süresi rune'un çizildiği karenin zaman damgasından dokunuşun olay zamanına kadar ölçülür.
- Rune'dan önce dokunmak ya da 100 ms'den hızlı tepki (tahmin sayılır): "Erken tıkladın, DOG!", tur yeniden.
- **Tuzak (yeni):** ikinci turdan itibaren, bekleme 2,4 sn'den uzunsa %35 olasılıkla rune yerine nehirde
  0,75 sn boyunca bir **DOG kafası** (kırmızı halka, "DOG" etiketi) belirir. Dokunma: ona dokunan da erken
  sayılır ("DOG’a dokundun!"). Bekleyen oyuncu için gerçek rune zamanında gelir. (Go/No-Go: "erken davranan DOG olur".)
- Sekme gizlenirse bekleyen tur iptal olur.
- Skor = 5 turun ortalaması. Derecelendirme: <200 altın · <260 ve <330 yeşil · <450 nötr · üstü kırmızı.

## Kontroller
| Giriş | İş |
|---|---|
| Dokun / tıkla (nehir) | Hazır / rune'u al |
| Boşluk / Enter | Aynı iş (odak başka bir düğmedeyse o düğmeye ait) |

## Sonuç kartı
En hızlı · En yavaş · Erken / tuzak (ör. `1 · 0/2 tuzak` = 1 erken, 2 tuzaktan 0'ına dokundun) ve
**Son maçların** grafiği: son 10 maçın ortalaması çubuk olarak (bu maç çerçeveli), genel ortalama ve en iyi.
Geçmiş yalnızca bu tarayıcıda: `csk:rune:hist`.

## Bu turda değişenler
- DOG tuzağı (go/no-go) — refleksin yanında dürtü kontrolü.
- Kişisel geçmiş grafiği (sonuç kartında, `kit.resultCard` `extra` ile).
- Kurallar dört maddeye toplandı (giriş kartı dördünü gösterir).
- Rozet: **Refleks Canavarı** — ortalama ≤ 300 ms.
