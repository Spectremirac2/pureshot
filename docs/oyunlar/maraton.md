# 24 Saat Maraton (`maraton`)

**Rota:** `#oyunlar--maraton` · **Bölüm:** Mini Oyunlar · **Tür:** Yayın · Strateji (`cat: 'yayin'`) · **Birim:** izleyici (yüksek iyi)
**Dosyalar:** `src/sections/games/maraton.js`, `src/sections/games/maraton.css`, `src/data/maraton.js` (olay bankası,
chat satırları, unvanlar); varlıklar: `src/assets/items/*.webp` (`itemIconUrl`), kahraman portreleri (`heroPortraitUrl`);
ikonlar `tea`, `sun`, `moon` (`src/core/icons.js`); kayıt: `games.js` (iskeletle birlikte zaten kayıtlı)

## Fikir

Yayıncının en kısa yayını 24 saat. Bu oyunda 24 saatlik bir Dota yayınını ayakta tutarsın: saat 00:00’dan 24:00’e
akar, enerji azalır, chat’in keyfi ve kafanın ayarı (tilt) oynar. Maç atar, çay içer, chat’e cevap verir, mola verir
ya da 1vDOQUZ denersin; araya olay kartları girer. Espri: **24:00 bitiş çizgisi değil, asgari süre** — oyun
bunu kurallarda, olaylarda ve bitiş sözlerinde tekrarlar. Yayıncı hakkında yalnızca izin verilen bilgiler
kullanılır (Kick, Dota 2, “DOG DOG DOG”, “1vDOQUZ”, en kısa yayın 24 saat); olaylar kurgusaldır, kimseye özel
hayat ya da alışkanlık yakıştırılmaz, chat kullanıcı adları uydurmadır.

## Saat ve göstergeler

- **1 oyun saati = 11 gerçek saniye** → 24 saat ≈ 4,4 dk + olay kartları ≈ **5–5,5 dk**. Kit `createRunner`:
  sekme gizlenince durur. **P** (ya da düğme) duraklatır; olay kartı açıkken saat de chat de durur.
- Saat aynı zamanda günün saatidir (yayın gece yarısı başlar): gece 02–08 arası yorgunluk ×1,25, sabah
  izleyici dipte, akşam 21–24 arası zirve (+ final coşkusu).
- **Enerji** (0–100): sürekli azalır — maçta 6,6/sa, lobide 4,6/sa; gece ×1,25, 12. saatten sonra maraton
  yorgunluğu (24:00’te ×1,33), tilt > 60 ise ×1,1, lobide 30 dk’dan uzun beklemek ×2,2’ye kadar (“lobi uyutur”).
  **0 olursa yayın biter** (“uyuya kaldın”).
- **Chat Moodu** (0–100): maçta 66’ya, molada 42’ye, lobide 55’e (12 dk’dan sonra 34’e: “maç ne zaman?”) doğru
  kayar. Tilt > 50 ve enerji < 25 moodu düşürür.
- **Tilt** (0–100): kaybedilen maç +9, DOG anı +6, başarısız 1vDOQUZ +22; kazanılan maç −12, zamanla −5/sa (maçta)
  / −8/sa (lobide), mola −8 ve −20/sa. Maç kazanma şansı = 0,58 − (tilt − 20) × 0,0035 (enerji < 25 ise −0,10) +
  olay etkileri, 0,08–0,92 arası.
- **MMR** 5000’den başlar, maç başına ±21–29.
- **İzleyici** hedefe yumuşakça yaklaşır (~20 oyun dakikası): `1000 × gün eğrisi × (0,35 + 1,25·mood) × (1 + takipçi)
  × (1 + hype) × durum (mola ×0,72, sıkılan lobi ×0,88) × final (22:00’den sonra saatte +%12)`. **Hype** anlık
  dalgadır (yarı ömür ~0,6 sa): DOG anı +0,35, galibiyet +0,18, 3+ seri +0,2, 1vDOQUZ +1,0, raid +0,55…
  **Takipçi** (fame) kalıcıdır: galibiyet, DOG anı, 1vDOQUZ ve bazı olaylar küçük küçük artırır.

## Aksiyonlar (1–5)

| Tuş | Aksiyon | Etki | Bekleme |
|---|---|---|---|
| 1 | **Maç at** | 43–55 oyun dakikası sürer, enerji −1; maçta enerji daha hızlı erir. %30 (+tilt) şansla maç ortasında takım arkadaşı DOG’lar: **DOG DOG DOG** damgası + havlama, chat coşar (mood +10, hype +0,35), tilt +6, maç şansı −%8. Sonunda G/M, MMR ±, chat tepkisi. | Maç bitene kadar |
| 2 | **Çay iç** | enerji +16 (son 6 saatte içilen her çay etkiyi %15 azaltır, en az %40); 2+ çayda “çarpıntı”: tilt +3 | 2 sa |
| 3 | **Chat’e cevap** | mood +10 (maçta +7 ve “chat’e bakarken creep kaçtı”: maç şansı −%2), enerji −2 | 36 dk |
| 4 | **Mola ver** | yalnızca maç dışında; “5 dk” dediğin mola 30 dk sürer: enerji ~+28, tilt −8 ve −10, izleyici ×0,72 | 3 sa |
| 5 | **1vDOQUZ** | yalnızca maçta, maç başına bir kez: şans = 0,40 − tilt·0,003 + (enerji−50)·0,002 + (mood−50)·0,001 (%10–60). Tutarsa: altın **1vDOQUZ** damgası, konfeti, hype +1,0, mood +18, takipçi +0,08, **maç kazanılır**. Tutmazsa: tilt +22, maç şansı −%25. Enerji −6. | 3 sa |

Düğmelerde tuş, ikon, ad ve canlı alt yazı (kalan bekleme, “+11 enerji”, “%45 şans”, “maçta · %60”) ile bekleme
dolgusu vardır. Lobide boş kalınca “Maç at” nabız atar.

## Olaylar

`src/data/maraton.js` → **35 olay** (5 sabit saat, 17 maç içi, 13 “her an”). Her 1,7–2,7 oyun saatinde bir rastgele
olay (+ sabit saatler: 03:00 gece sessizliği, 06:00 güneş doğdu, 12:00 yarı yol, 19:00 akşam yemeği, 23:00 son saat)
→ oyun başına ~15 kart. Maçtayken maç olaylarının ağırlığı ×1,8; her olay oyunda en fazla bir kez; koşullu olaylar
(enerji < 22/35, tilt > 55, en az 1 DOG anı, gece saatleri).

- Kart eylem ızgarasının yerine açılır (başparmağın olduğu yer), saat durur; mobilde chat gizlenir ki göstergeler
  kartla birlikte görünsün; `revealInView` ile görünür alana gelir.
- İki seçenek, her birinde etki çipleri (Enerji ↑, Tilt ↑ kötü = kırmızı…) ya da “Risk · %50 şans”. Seçince sonuç
  metni, **gerçekleşen** değerler (“Enerji +16, İzleyici −63”) ve “Devam” (2,6 sn sonra kendiliğinden kapanır).
- Uzun “yayın arası” (kahvaltı, şekerleme, modem) maç ortasında gelmez; sabit saat olayı maça denk gelirse ara
  maçtan sonra başlar.
- Örnekler: Rapier düştü, Kurye öldü, Rakip Techies seçti (portre), Pudge hook’u sisten tuttu, Roshan zamanı,
  Chat “uyu artık” diyor, İnternet koptu, Raid geldi, Klip yayıldı, Sürpriz yama…

## Chat akışı

Uydurma genel kullanıcı adlarıyla (ward_sever, çay_ocağı…) bağlama göre satırlar: lobi, maç, galibiyet, mağlubiyet,
DOG anı (4 satırlık “DOG DOG DOG” patlaması), 1vDOQUZ, gece, sabah, çay, mola, düşük enerji, tilt, hype, final.
Satır sıklığı izleyiciyle artar. Chat’e cevap verince yeşil “Yayıncı” satırı ve teşekkür. Metinler saygılı:
hamle eleştirilir, kişi değil (“hamleyi eleştir, kişiyi değil”).

## Skor ve bitiş

- **Skor = zirve izleyici.** 24:00’e ulaşılamazsa **zirve × yayınlanan saat / 24** (13:47’de biten, zirvesi 2.000
  olan yayın 1.149). Neden: izleyici birimi korunur, zirve kovalamak ödüllendirilir ama maratonu bitirmeden
  büyük skor olmaz (erken 1vDOQUZ’la zirve yapıp enerjiyi yakmak işe yaramaz). Gün eğrisi zirveyi genelde
  son saatlere taşır: **1vDOQUZ’u akşama saklamak** iyi bir strateji.
- **24:00:** “24 SAAT!” yeşil damga, konfeti, zafer sesi, final chat’i; profilde `picks['maraton:tamam']` bir artar
  (rozet için). **Enerji 0:** “Zzz…” damgası, kayıp sesi.
- Sonuç kartı: Zirve, Yayın (saat), Maç (G · M), MMR (±), DOG anı, 1vDOQUZ (tutan/deneme), söz, **unvan** kartı ve
  tüm maçların G/M şeridi (turuncu nokta = DOG anı, altın nokta = 1vDOQUZ); erken bitişte skor formülü notu.
- Unvanlar (ilk eşleşen): 1vDOQUZ Efsanesi (≥ 4 başarılı), Kick Fenomeni (tamam + zirve ≥ 7.000), DOG Mıknatısı
  (≥ 14 DOG anı), MMR Makinesi (tamam + G ≥ M + 5), Çay Ocağı Sahibi (≥ 12 çay), Chat’in Dostu (≥ 20 cevap),
  Molasız Maratoncu, Maraton Yayıncısı, Gece Kuşu (≥ 16 sa), Yarım Maratoncu (≥ 10 sa), Isınma Turu.

## Denge notları

Simülasyon çekirdeği (`createSim`) DOM’suzdur; geliştirme kancası `window.__maraton.simulate(strateji, n)`
tarayıcıda binlerce oyunu anında koşar. Son ayarla 500’er oyun:

| Strateji | 24:00’e varış | Skor P10 / P50 / P90 / en yüksek | Not |
|---|---|---|---|
| Hiçbir şey yapma | %0 (ort. 16. saat) | 489 / 678 / 787 / 1.343 | Lobi yorgunluğu öldürür |
| Yalnızca maç (çay yok) | %0 (ort. 13,9. saat) | 718 / 927 / 1.485 / 2.578 | Çay şart |
| Maç + çay + chat, mola yok | %65 | 3.200 / 4.674 / 6.389 / 9.855 | Chat spamı enerji yer |
| Maç + çay + enerji < 35’te mola | %100 | 3.905 / 5.040 / 7.094 / 10.797 | |
| Aynısı, olay seçimleri rastgele | %100 | 3.514 / 4.721 / 6.701 / 9.674 | |
| “İnsan” (~1 sn tepki, çay < 70, mola < 32) | %100 | 3.500 / 4.872 / 6.540 / 9.512 | ort. 12,4 G · 12,7 M, 9,8 DOG anı |

Gözlemler: enerjiyi izleyen oyuncu 24 saati tamamlar; zorluk zirveyi büyütmektedir (moodu yüksek tutmak, hype’ı
akşama denk getirmek, 1vDOQUZ zamanlaması). İlk turda tilt sarmalı vardı (galibiyet oranı %29); kayıp/DOG tilt’i
düşürülüp tilt sönümü artırılınca oran ~%49’a çıktı. İlk turda “hiçbir şey yapmamak” da bitiriyordu; lobi
yorgunluğu eklendi.

## Denetimler ve düzen

- **Klavye:** 1–5 aksiyonlar (üst sıra ve numpad), olay kartında 1/2 (ya da A/B) seçim, sonra Boşluk/Enter/1–5
  devam; **P** duraklat/devam, **Esc** duraklat. Basılı tutma yok sayılır. Oynarken sitenin kısayolları kapalı;
  sonuç kartı açılınca ve çıkışta geri açılır.
- **Mobil (390 px):** HUD (Saat, İzleyici, Zirve, MMR) + sahne (591 px) birlikte alt çubuğun üstüne sığar:
  gökyüzü şeridi (00–24, güneş/ay işareti) + CANLI + duraklat, durum satırı (maç ilerlemesi, kazanma şansı,
  mola süresi), üç gösterge, 4 satırlık chat, **büyük düğme ızgarası** (Maç at tam genişlik, altında 2×2),
  maç şeridi. Başlangıçta ve olay kartı kapanınca HUD + sahne görünür alana getirilir.
- **Masaüstü:** sol sütunda gökyüzü/durum/göstergeler/5’li düğme sırası, sağda yayın chat’i.
- **prefers-reduced-motion:** yanıp sönme, nabız, sarsma, giriş animasyonları kapalı; damgalar kısa kalır, uçan
  yazı/konfeti zaten kapalı (fx). Göstergelerin +/− farkı yine yazıyla görünür.
- **Ses:** maç başlangıcı (whoosh), galibiyet/mağlubiyet, DOG DOG DOG havlaması, 1vDOQUZ zaferi, çay (coin),
  olay kartı, bitiş (win/lose). Erişilebilirlik: göstergeler `role="meter"`, olaylar ve sonuçlar `aria-live`.

## Test notları

Playwright (masaüstü 1440×900, mobil 390×844 dokunmatik), dev sunucusu, HMR engelli:
- Tam 24 saat, betikli stratejiyle (masaüstünde klavye, mobilde dokunma), dev hızlandırma kancasıyla (×8/×12):
  ~26 maç, ~11 çay, 1 mola, 3–6 1vDOQUZ, 15–16 olay kartı; sonuç kartı, `csk:me.scores.maraton` = `sim.score()` =
  zirve, `picks['maraton:tamam']` = 1.
- Kaybedilen yayın (enerji 6’ya çekildi): 13–15. saatte “Yayın erken bitti”, skor = zirve × saat / 24.
- Duraklat saati dondurur, devam ettirir; gizli sekme saati dondurur; oyun içinde Q gezinmez, sonuç ekranında
  gezinir; oyun ortasında salona dönünce kanca silinir, kısayollar açılır, zamanlayıcılar temizlenir.
- Hareket azaltma açıkken aynı akış hatasız. Konsol hatası 0, yatay taşma yok, derleme başarılı; `window.__maraton`
  üretim derlemesinde yok (`import.meta.env.DEV`, `dist`’te aranarak doğrulandı).
- Bulunan ve düzeltilen: olay sonucu kartında `replaceChildren(null)` “null” yazıyordu; maç şeridindeki
  `scrollIntoView` mobilde sayfayı dikey kaydırıyordu (yalnızca yatay `scrollLeft` yapıldı).

## Önerilen rozetler

Kategori: **Yayın** (`meta.cat = 'yayin'`). `core/badges.js` için öneri:

| Rozet | Koşul | Not |
|---|---|---|
| Maraton Tamam | `picks['maraton:tamam'] ≥ 1` (yalnızca skorla: `scores.maraton ≥ 3000`) | 24:00’e varan oyuncuların ~%90’ı 3.000+; erken bitenler nadiren |
| Kick Fenomeni | `scores.maraton ≥ 7000` | En iyi ~%10 |

(Mevcut “24 Saat Ruhu” rozeti DOG düğmesiyle ilgili; `maraton` eşik anahtarı orada kullanılıyor, çakışmasın.)
