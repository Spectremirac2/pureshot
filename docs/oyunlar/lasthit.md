# Last Hit Ustası (`lasthit`)

**Rota:** `#oyunlar--lasthit` · **Tür:** Hedefli · Tek hedef · **Skor:** altın (yüksek iyi)
**Dosyalar:** `src/sections/games/lasthit.js` (canvas), stiller `games.css` (`gm-lh-`)

## Kurallar
- 60 saniye, her 12 saniyede bir creep dalgası (iki tarafta 3 yakın dövüş + 1 menzilli).
- Creep'e dokun: okçu 0,12 sn gerilir, ok 0,23 sn uçar (toplam ≈0,35 sn), 50–56 hasar vurur.
  - Düşman creep ölürse **last hit**: yakın dövüş 36–42, menzilli 44–50 altın.
  - Canı %50'nin altındaki müttefik creep'i öldürürsen **deny**: +12 bonus.
  - Erken: creep ölmez (ıska · erken). Geç: creep çoktan öldü (ıska · geç).
- Saldırı bekleme süresi 0,8 sn (HUD'daki yay simgesi dolum gösterir).
- DOG takım arkadaşı (Farm ya da Ward'sız Destek Köpeği) 9–14 sn'de bir canı az düşman creep'ini "çalar".

## Kontroller
| Giriş | İş |
|---|---|
| Tık / dokun | Creep'e vur |
| `← →` | Hedef seç (ekran okuyucuya can yüzdesi okunur) |
| Boşluk / Enter | Seçili hedefe vur (seçim yoksa canı en az düşman) |

## Sonuç kartı
Last hit · Deny · İsabet · Iska (erken/geç) · Çalınan LH · **LH verimi** (ölen düşman creep'lerinin yüzde kaçı senin).

## Bu turda değişenler
- **Son vuruş çizgisi:** düşman ve deny edilebilir müttefik creep'lerin can çubuğunda okun en az hasarında
  (50) ince bir çizgi; can çizginin altına inince çizgi altın rengine döner. Zamanlamayı öğrenmeyi kolaylaştırır
  (okun uçuş süresinde can azalmaya devam ettiği için yine de biraz önceden vurmak gerekir).
- **Dokunmatikte akıllı hedef:** creep'ler üst üste bindiğinde parmak tek creep'i seçemiyordu. Dokunuşun
  altındaki adaylardan son vuruşa en uygun olan (canı en az düşman ya da deny edilebilir müttefik) seçilir.
  Fare ile seçim eskisi gibi en yakın creep'tir.
- **Sıralar arası açıldı:** üç creep sırası daha aralıklı (0,575 / 0,73 / 0,885 × yükseklik); can çubukları
  arkadaki creep'in gövdesine binmiyor.
- "Bekle" ve "Deny için can %50 altı olmalı" yazıları üst üste yığılmıyor.
- "Toplam saldırı" yerine **LH verimi** istatistiği.
