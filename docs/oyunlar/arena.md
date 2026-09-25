# 1vDOQUZ Arena (`arena`)

**Rota:** `#oyunlar--arena` (kısayol **R**) · **Tür:** Ultimate · 3D · **Skor:** puan (yüksek iyi)
**Dosyalar:** `src/sections/games/arena/` — `arena.js` (arayüz, giriş, döngü), `game.js` (kurallar/simülasyon),
`dogs.js` (DOG türleri, dalga dizilimi, yapay zekâ), `view3d.js` / `view2d.js` (three.js ya da 2D yedek çizim),
`actors.js`, `fx3d.js`, `textures.js`, `arena.css`. Salon, arenayı ilk açılışta tembel yükler.

## Fikir
Dört takım arkadaşı ve beş rakip: dokuz DOG arenaya dalar, sen tek başına bir okçusun. Dokuzunu indirmek
bir dalgayı temizler — **1vDOQUZ**. Her dalga biraz daha hızlı ve dayanıklı (`waveScale`: can, hız, hasar,
saldırı aralığı; 4. dalgadan sonra elit DOG'lar).

## Yetenekler
| Tuş | Yetenek | Özet |
|---|---|---|
| Q | CureShot | Basılı tut (1,2 sn'ye kadar şarj), bırak: delip geçen ok; şarjla hasar ve menzil artar |
| W | Rüzgâr Koşusu | 3 sn %60 hız, %80 kaçınma · 12 sn bekleme |
| E | Tango | 3 şarj, 6 sn can yenileme |
| R | DOG DOG DOG | Çevredeki DOG'lara hasar, sersemletme ve korku · 30 sn bekleme |

Dalga sonunda ortada **Aegis** belirir (bir kez ölümden döndürür); Rapier Köpeği düşerse **Rapier** 8 sn
çift hasar verir.

## Puan
- Her DOG 100 · çoklu öldürme (1,8 sn içinde): Double +50, Triple +150, Ultra +300, Rampage +500.
- Dalga temizleme: `300 × dalga` + isabet bonusu `isabet × 400`.
- Kabaca: ilk dalga ≈ 1.200+ puan (rozet: **1vDOQUZ**), 3–4 dalga ≈ 6.000 (rozet: **Arena Efsanesi**).

## Kontroller
- **Klavye:** iki düzen — WASD + Boşluk (W yeteneği Boşluk/Shift) ya da ok tuşları + QWER; fare ile nişan,
  "Otomatik nişan (en yakın DOG)" seçeneği.
- **Dokunmatik:** sol başparmakla sürükle = yürü; Q basılı tut = şarj (sürüklersen nişan, yoksa en yakın DOG);
  sağ tarafa dokun = oraya ok; W E R düğmeleri. Dokunmatik cihazda otomatik nişan varsayılan açık.
- Tam ekran ve duraklatma düğmeleri; sekme gizlenince oyun durur.

## Bu turda
Salon & cila turunda arena koduna dokunulmadı (yalnızca hata/performans düzeltmesi kapsamındaydı).
Playwright ile masaüstü (1440×900) ve mobil (390×844, dokunmatik) açılış + 20 sn oynanış denendi: konsol hatası
yok, yatay taşma yok. Test ortamı yazılımsal WebGL (SwiftShader) kullandığından kare hızı (1–3 fps) gerçek
cihazı yansıtmaz; performans ayarı gerçek cihazda ölçülmeden değiştirilmedi.

Dokunmatik birincil cihazlarda (`pointer: coarse`) başlangıç ekranındaki "Tuş düzeni" seçimi gizlenir;
orada dokunmatik kontroller kullanılır.
