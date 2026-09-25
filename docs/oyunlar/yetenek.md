# Yetenek Avı (`yetenek`)

**Rota:** `#quizler--yetenek` · **Bölüm:** Quizler (5. kart, kısayol `5`) · **Tür:** Süreli yarışma
**Dosyalar:** `src/sections/quizzes/yetenek.js`, `src/sections/quizzes/yetenek.css`,
`src/data/abilities.js` (üretilmiş), `src/assets/abilities/heroes/*.webp` (üretilmiş),
`scripts/fetch-abilities.mjs`; kayıt: `src/sections/quizzes/quizzes.js`, `src/data/quizzes.js`

## Fikir

Yetenek ikonu ve adı ekranda, dört kahraman şıkta: **bu yetenek kimin?** Dota oyuncusunun en temel
bilgisi olan “bu büyüyü kim atar” refleksini ölçer. Bilgi Yarışması’nın süreli akışını ve görünümünü
paylaşır (quizzes.css `.qz-*`), üstüne yetenek yuvası çerçeveleri, portreli şıklar ve DOG% madalyonu ekler.

## Kurallar ve puan

- Tur 10 soru; her soru farklı bir kahramandan (127 kahramandan rastgele 10).
- Her soruda 20 sn. Süre biterse soru 0 puan, doğru cevap gösterilir.
- Doğru cevap **100 puan + kalan süreye göre 100’e kadar hız bonusu** (`100 + round(kalan/20 × 100)`).
  En yüksek skor 2.000.
- **Zorluk:** üç yanlış şık, doğru kahramanla **aynı ana özellikten** (Güç/Çeviklik/Zekâ/Evrensel) seçilir;
  soru başlığında “Şıklar: Zekâ kahramanları” notu vardır.
- **Adillik:**
  - Aynı adı taşıyan yetenekler (Blink: Anti-Mage + Queen of Pain; Hex: Lion + Shadow Shaman) için öbür
    sahip asla yanlış şık olmaz.
  - Adı kahramanı ele veren yetenekler (Doom → *Doom*, Luna → *Lunar Orbit*, Viper → *Viper Strike*…)
    kahramanın başka yeteneği varken sorulmaz.
  - Doğuştan (innate) yetenekler nadiren (%12) sorulur ve “Doğuştan” rozetiyle işaretlenir; ultimate’lar
    altın çerçeve + “Ultimate” rozeti taşır.
- Açıklama: doğru kahramanın DOG% halkalı madalyonu (`crestSvg`), DOG kademesi ve Kahraman DOG
  Endeksi’ndeki “Topluluk der ki…” ön yargı cümlesi (lezzet için; kahramanlar masumdur).
- Sonuç: puan (sayarak yükselir), unvan, doğru sayısı, hız bonusu, ortalama cevap süresi, **Yetenek defteri**
  (ikonlu cevap anahtarı), skor tablosu “Yetenek Avcıları”. 7+ doğru konfeti; 10/10 `1vDOQUZ` damgası.

| Doğru | Unvan |
|---|---|
| 9–10 | Yetenek Ansiklopedisi |
| 7–8 | Kombo Ustası |
| 5–6 | Pub Gazisi |
| 3–4 | Tooltip Okuyucu |
| 0–2 | Ward’sız Gezen |

Kayıt: “Sonuçları gör” tıklanınca `store.me.submitScore('yetenek', puan, true)` ve bu cihazdaki son sonuç
(`saveLast('yetenek', { score, correct, title })`). Quiz merkezindeki kart “Son sonucun: 1.384 puan · 7/10 ·
Kombo Ustası” gösterir; envanter yuvası yanar.

## Denetimler

`1`–`4` şık seçer, `Enter` / `Boşluk` / `→` sonraki soru. Dokunmatikte şıklar ≥ 56 px. Sekme gizlenince
sayaç durur. Soru değişince başlık odaklanır ve `aria-live` ile okunur; sayaç `role="timer"`.

## Veri kaynağı ve yeniden üretme

Yetenek adları ve ikonları **Valve**’ın resmi kaynaklarından: `https://www.dota2.com/datafeed/herodata`
(kahraman başına) ve `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/<ad>.png`.
Dota 2 ve tüm yetenek adları/ikonları Valve Corporation’a aittir. Çalışma anında dış istek yoktur: veri ve
ikonlar derlemeye dosya olarak girer.

```bash
NODE_USE_ENV_PROXY=1 node scripts/fetch-abilities.mjs            # veri + eksik ikonlar
NODE_USE_ENV_PROXY=1 node scripts/fetch-abilities.mjs --force    # ikonları da yeniden indir
node scripts/fetch-abilities.mjs --no-icons --cache /tmp/feed    # ham yanıtları sakla/yeniden kullan
```

Kahraman sayısal kimlikleri `assets-src/heroes-roster.json`’dan (yedek: `assets-src/dota2-herolist.json`).
`language=turkish` datafeed açıklamaları çeviriyor ama **yetenek adlarını çevirmiyor**; bu yüzden adlar
oyundaki İngilizce halleriyle tutulur (Türkçe ad alanı yok). api.opendota.com’a bağımlılık yok.

**Seçim kuralları** (`scripts/fetch-abilities.mjs`):

- Normal yetenekler; ultimate `ult: true`.
- Alınmaz: talent/`special_bonus_*`, `generic_hidden`, boş kayıtlar, Aghanim’s Shard/Scepter ile gelen
  yetenekler, pasif ya da gizli doğuştan yetenekler, ikinci kopyalar (Activate Fire Remnant,
  Attribute Shift (Strength Gain)).
- Gizli olduğu hâlde alınır: Invoker’ın çağırdığı 10 büyü, Kez’in ikinci duruşu, Largo’nun şarkıları.
- Etkin doğuştan yetenekler alınır (`innate: true`): Invoke, Stone Remnant, Summon Spirit Bear, Mischief,
  Blur, Battle Stance, Switch Discipline, Sacrifice, Zealot, Special Delivery, Celestial Quiver,
  Silent as the Grave.

**Boyutlar (Eylül 2026):** 127 kahraman, 539 yetenek (129 ultimate, 12 doğuştan).
`src/data/abilities.js` 41 KB kaynak; derlemede tembel parça `abilities-*.js` ~103 KB (23 KB gzip, ikon URL
listesi dahil). İkonlar 539 × 96×96 WebP (kalite 74), toplam **0,99 MB** (ortalama 1,8 KB); bir tur yalnızca
gördüğü ~10 ikonu indirir. İkonlar `?url&no-inline` ile hiçbir zaman JS’e gömülmez.

**Tembel yükleme:** `yetenek.js` hafiftir; `abilities.js`, `heroes.js` ve `crest.js` quiz açılınca
`import()` ile gelir (brifing ekranında “Başla” veri gelene dek pasif). Quiz merkezi bu yükü taşımaz.
İkon yardımcısı `abilityIcon(key)` üretilmiş `abilities.js` içindedir (çekirdek `assets.js`’e 539 URL’lik
liste eklememek için).

## Merkez düzeni

`quizzes.css` dört kart için yazıldığından `yetenek.css` iki küçük ayar içerir: envanter yuvaları beşe
bölünür, beşinci kart masaüstünde tüm genişliği kaplayan yatay karttır. `quizzes.js`’te sayılar
`QUIZZES.length`’ten gelir (`/5 quiz çözüldü`, `1–5` ipucu), `1`–`9` tuşları karta göre quiz açar.

## Test notları (Playwright, dev sunucusu :5183)

Masaüstü 1440×900 ve mobil 390×844 (`isMobile`, `hasTouch`) — konsol hatası 0, yatay taşma 0:

- Merkez: 5 kart, “/5”, Yetenek Avı kartı → `#quizler--yetenek`; brifingde ikon şeridi yükleniyor.
- 10 sorunun her birinde: ikon yüklü, şıklarda tam **bir** doğru sahip, dört şık aynı özellik rengi,
  10 farklı kahraman. Cevaplar DOM’dan (`data-hero` + yetenek verisi) bulundu; 1, 4, 7. sorular bilerek
  yanlış, masaüstünde tık ve `1–4` tuşu, mobilde dokunma; bir koşuda 10. soru süre dolumu (20 sn).
- Her açıklamada madalyon, DOG% ve “Topluluk der ki” cümlesi; puanlar 100–200 arası.
- Sonuç puanı beklenen toplamla aynı; `csk:me.scores.yetenek` ve `csk:qz:last.yetenek` yazıldı;
  merkez kartı “Son sonucun: 1.384 puan · 7/10 · Kombo Ustası”, envanter yuvası açık; `5` tuşu quizi açıyor.
- `VITE_API_BASE=none npx vite build` geçiyor; ikonlar ayrı dosya, `abilities-*.js` ayrı tembel parça.
