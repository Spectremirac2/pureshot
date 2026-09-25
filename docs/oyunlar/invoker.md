# Invoker Kombo (`invoker`)

**Rota:** `#oyunlar--invoker` · **Bölüm:** Mini Oyunlar · **Tür:** Refleks · Parmak · **Birim:** büyü (yüksek iyi)
**Dosyalar:** `src/sections/games/invoker.js`, `src/sections/games/invoker.css`,
`src/assets/abilities/invoker/*.webp` (üretilmiş), `scripts/fetch-ability-icons.mjs`;
yardımcı: `abilityIconUrl()` (`src/core/assets.js`), ikon `orbs` (`src/core/icons.js`); kayıt: `games.js`

## Fikir

Invoker, Dota’nın en çok “parmak” isteyen kahramanı: üç küreyi (Quas, Wex, Exort) dizip Invoke ile on
büyüden birini çağırır. Tarayıcıda en çok oynanan Dota alıştırmalarından biri tam da budur (bkz.
[ANALIZ.md](../ANALIZ.md) §3). Oyun, hedef büyüyü göstere göstere bu refleksi ölçer; ekrandaki büyük
Q W E R düğmeleriyle mobilde de oynanır.

## Küre mantığı

- **Q** Quas (buz mavisi), **W** Wex (mor), **E** Exort (ateş turuncusu) birer küre çağırır.
- Son basılan **üç küre** slotlarda durur; dördüncü basış en eskiyi iter (FIFO). Slotlar soldan sağa
  eskiden yeniye sıralıdır; sahnenin ışığı kürelerin karışım rengini alır.
- **R** (Invoke) üç kürenin **çoklu kümesine** denk gelen büyüyü çağırır; **sıra önemsiz** (QQW = QWQ = WQQ).
  Üçten az küre varsa uyarı verir, ceza yoktur.
- Çağrılan büyü, Dota’daki gibi **D** slotuna girer, önceki **F**’ye kayar. D’deki büyüyü yeniden çağırmak
  (ör. R’ye iki kez basmak) hiçbir şey yapmaz ve **cezasızdır**.

| Tarif | Büyü | Türkçe lezzet |
|---|---|---|
| QQQ | Cold Snap | Ayaz Çıtırtısı — Her darbede yeniden donar. |
| QQW | Ghost Walk | Hayalet Yürüyüşü — Görünmez ol, sessizce sıvış. |
| QQE | Ice Wall | Buz Duvarı — Koridoru dondurur, kaçışı keser. |
| WWW | EMP | Mana Fırtınası — Üç saniye sonra mana buharlaşır. |
| WWQ | Tornado | Kasırga — Havaya kaldırır, komboya sahne kurar. |
| WWE | Alacrity | Şevk — Carry’ne saldırı hızı, sana teşekkür. |
| EEE | Sun Strike | Güneş Darbesi — Haritanın öbür ucuna, tahminle. |
| EEQ | Forge Spirit | Ocak Ruhu — İki ateş ruhu, bedava kule baskısı. |
| EEW | Chaos Meteor | Kaos Meteoru — Yuvarlanan kaya, yanan koridor. |
| QWE | Deafening Blast | Sağır Eden Patlama — Herkesi iter, silahsız bırakır. |

## Modlar ve puan

**Zaman Saldırısı (skor tablosu)** — 60 sn (kit `createRunner`: sekme gizlenince durur).
- Hedef büyüyü çağır: **+1 büyü**, sıradaki hedef gelir. Hedefler 10’luk karışık torbadan çekilir; art arda
  aynı hedef gelmez, on büyünün hepsi düzenli döner.
- Yanlış büyü: **−2 sn**, “DOG!” uçan yazısı, ıska sesi, seri sıfırlanır; hedef aynı kalır.
  Üst üste üç yanlışta ekran damgası **DOG DOG DOG**.
- Seri (hatasız zincir): HUD’da küre renkli 5’li gösterge; her 5’te “SERİ ×n”, her 10’da **1vDOQUZ** damgası.
- **Skor = çağrılan hedef büyü sayısı.** Skor tablosuna yazılan tek ölçü budur (`submitResult` bitişte hemen).

**10 Büyü Yarışı (yalnızca yerel rekor)** — on büyünün **her biri bir kez**, kronometreyle.
- Yanlış büyü **+2 sn** ceza. Sonuç süresi `csk:invoker-race-best` anahtarında (bu cihaz) saklanır;
  sonuç kartı aynı bileşenle “saniye” biriminde gösterilir, **skor tablosuna yazılmaz**.
- Seçilen mod `csk:invoker-mode`, Tarifler tercihi `csk:invoker-book` anahtarında hatırlanır.

**Sonuç kartı** (Zaman Saldırısı): Yanlış (DOG), En uzun seri, En hızlı büyü, Ortalama (hedef görünmesinden
çağrıya), **Küre verimi** (gereken en az küre basışı ÷ yapılan basış; mevcut kürelerden hedefe en kısa yol
hesaplanır), Küre basışı. Yarışta son kutu “Ceza”.

| Skor | Söz |
|---|---|
| 45+ | Arsenal Magus bile not aldı. Parmakların 1vDOQUZ modunda. |
| 32+ | Tornado, EMP, Meteor, Blast… Kombo akıyor. |
| 20+ | Sağlam Invoker. Sun Strike’ların artık gerçekten birine çarpıyor. |
| 10+ | Küreler dönüyor… Tarifleri kapatıp bir tur daha? |
| 0–9 | DOG DOG DOG. Quas, Wex, Exort birbirine girdi; her Invoker böyle başlar. |

## Denetimler

- **Klavye:** fiziksel tuş konumu (`e.code`: `KeyQ/KeyW/KeyE/KeyR`) önce, sonra basılan harf (`e.key`
  q/w/e/r). Böylece Türkçe F, AZERTY vb. düzenlerde de sol elin aynı parmakları çalışır. Basılı tutma
  (`e.repeat`) yok sayılır; Ctrl/Alt/Meta ve yazı alanları hariç.
- **Dokunmatik / fare:** büyük Q W E R düğmeleri (masaüstü 96 px, 390 px ekranda ~78 px; en az 56 px),
  `pointerdown` ile anında tepki, basış parlaması. Odaklanıp Enter/Boşluk da çalışır (dokunmanın
  tetiklediği `detail 0` tıklamaları ikinci kez sayılmaz).
- **Site kısayolları:** oyun sürerken `ctx.hotkeys(false)`; bitişte 1,2 sn’lik aradan sonra açılır
  (tuşlamaya devam eden oyuncu sonuç ekranından Espri Duvarı’na ya da Arena’ya fırlamasın). Tekrar oyna
  bu arayı iptal eder; temizlikte her durumda geri açılır.
- **Tarifler:** alanın üstündeki çip, sahnenin altındaki 10’lu tarif defterini ve hedef kartındaki küre
  noktalarını açar/kapatır. İlk kez oynayana varsayılan açık. Başlangıç kartında da okunur.

## Görseller ve varlıklar

- **Yetenek ikonları:** Valve’ın resmi Dota 2 CDN’inden (`cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/`)
  derleme öncesi indirilir: 10 büyü + Quas/Wex/Exort + Invoke, **128×128 WebP** (her biri ~1,5–3,5 KB).
  Görseller Valve Corporation’a aittir; site resmi olmayan bir hayran projesidir. Çalışma anında dış
  istek yoktur. Yeniden üretmek için:
  `NODE_USE_ENV_PROXY=1 node scripts/fetch-ability-icons.mjs [--force]`
- İkon yoksa (`abilityIconUrl` null) büyü için küre renklerinden **konik çizim yedeği** + baş harfler,
  küre ve düğmeler için renkli küre degradesi kullanılır; oyun varlıksız da çalışır.
- İkonlar açılışta önceden çözülür ve düğümler yeniden kullanılır: hedef değişirken ikon bir kare bile boş kalmaz.
- Görsel dil: obsidyen zemin, dönen rün çemberi, küre parıltısı ve yörünge ışıltısı, çağırmada hedef
  renginde parlama, hatada Dire kızıllığı, Dota yetenek slotu çerçeveli hedef kartı ve D/F slotları.

## Tasarım notları

- Hedef kartı İngilizce adı büyük (oyuncunun bildiği ad), Türkçe lezzet adını ve tek satırlık espriyi
  altında taşır. Tarifler açıkken kartın sağında (mobilde dikey) küre noktaları görünür.
- Sahne içeriği sabit boyutludur; oyun sırasında düğmeler yer değiştirmez (bkz. test notları).
- `prefers-reduced-motion`: dönen çember, küre yörüngesi, giriş/basış animasyonları kapanır; uçan yazılar
  (fx) zaten kapalıdır, geri bildirim mesaj satırı + slot/HUD güncellemesiyle verilir.
- Erişilebilirlik: `aria-live` ile hedef ve sonuç okunur; küre slotları `role="img"` + güncel etiket.

## Test notları

Playwright (masaüstü 1440×900, mobil 390×844 dokunmatik), yerel dev sunucusu, HMR engelli:
- Klavyeyle 10+ hedef büyü (hedef DOM’daki `data-spell`’den okunur), ters sırayla tarif (sıra bağımsızlığı),
  bir yanlış büyü (−2 sn, DOG sayacı, kırmızı mesaj), D slotundaki büyüyü tekrar çağırma (cezasız),
  Tarifler aç/kapa, süre sonu → sonuç kartı skoru = doğru sayısı, `csk:me.scores.invoker` kaydı.
- Mobilde aynı akış ekran düğmelerine **dokunarak**; düğmeler ≥ 56 px ve alt yetenek çubuğunun üstünde.
- Yarış: 10 farklı büyü, yerel rekor yazıldı, skor tablosu değişmedi.
- Kısayollar: oyun içinde Q/W/E/R gezinmez; bitiş arasında da gezinmez; aradan sonra Q → Espri Duvarı.
- Hareket azaltma açıkken hatasız; yatay taşma yok; konsol hatası 0; derleme başarılı.
- Bulunan ve düzeltilen: sitenin genel `.empty` sınıfı küre slotuna çarpıp satır yüksekliğini oynatıyordu
  (durum sınıfları `is-*` yapıldı); dokunmanın `detail 0` tıklaması küreyi iki kez sayıyordu.
