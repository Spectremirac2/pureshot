# Uçan Kurye (`kurye`)

**Rota:** `#oyunlar--kurye` · **Bölüm:** Mini Oyunlar · **Tür:** Refleks · Ritim (`meta.cat = 'refleks'`) ·
**Birim:** metre (yüksek iyi)
**Dosyalar:** `src/sections/games/kurye.js`, `src/sections/games/kurye.css`; ikonlar `courier`, `bottle`, `tango`
(`src/core/icons.js`); kayıt: `games.js`. Dış görsel yok: kurye, kuleler, eşyalar ve arka plan canvas'ta çizilir.

## Fikir

Dota 2'nin Crownfall etkinliğindeki “Flappy Bat” mini oyunu, Flappy türünün Dota oyuncularında tuttuğunu
gösterdi. Uçan Kurye bu türün özgün bir yorumu: **kanatlı kurye eşeği** mid'e bottle yetiştirmeye çalışır.
Her dokunuş bir kanat çırpışı, yerçekimi hep aşağı çeker; Radiant ve Dire kulelerinin arasındaki boşluklardan
geçilir, nehre düşmek ya da kuleye çarpmak kuryeyi öldürür (“Kurye öldü!”). Hiçbir Valve varlığı ya da
Crownfall görseli kullanılmaz.

## Kurallar ve puan

- **Başla** → kurye havada bekler (“DOKUN VE UÇ”); **ilk dokunuş** uçuşu başlatır ve aynı zamanda ilk kanat
  çırpışıdır. Basılı tutmak bir şey yapmaz (tuş tekrarı yok sayılır); her kanat için ayrı dokunuş gerekir.
- Fizik (mantıksal birim; sahne yüksekliği 600 birim, **10 birim = 1 metre**): yerçekimi 1.550 birim/sn²,
  kanat hızı −485 birim/sn (tepe ≈ 76 birim yükselir, 0,31 sn), düşüş hızı en çok 760 birim/sn. Kuryenin
  isabet çemberi 12,5 birim (çizimden küçük, bağışlayıcı). Tavana çarpmak öldürmez (kurye tavanda kayar).
- **Skor = uçulan metre + şişe bonusu.** Şişe (Bottle) **+25 m**.
- **Tango:** bir çarpmayı (kule ya da nehir) affeder; 1,2 sn yanıp sönen koruma verir, nehirden geri
  zıplatır. Aynı anda bir tane taşınır (HUD'da “Tango: Var”, kuryenin çevresinde yeşim halka).
- **Hız rünü:** 2,4 sn **turbo**: dünya ×1,75 hızlanır (metre de hızlı akar), kurye kulelerin içinden geçer,
  nehirden seker; ardından 1,2 sn koruma. Kulenin içindeyken koruma bitmez (turbo kuleye gömülü bitirmez).
- Ölüm: kuleye çarpma ya da nehre düşme (Tango yoksa). Kurye takla atarak nehre düşer, tüyler saçılır,
  sahnede “KURYE ÖLDÜ!” yazar. **Tek kule bile geçilmeden** ölünürse ekranda **DOG DOG DOG** damgası çıkar.
- Sekme gizlenince, pencere odağı kaybolunca ya da sahne ekranın yarısından çoğu dışına kayınca uçuş
  **duraklar** (“DURAKLATILDI”); dokunuş / Boşluk devam ettirir (ve kanat çırpar).

**Sonuç kartı** (başlık “Kurye öldü!”): skor (metre), Mesafe, Şişe (adet · +bonus), Kule (geçilen), **En yakın
sıyrık** (kuleye en yakın geçiş, cm; 1 birim = 10 cm), Tango (harcanan can), Uçuş (sn). 60 cm'den yakın
geçişlerde sahnede “Kıl payı!” yazar; 3+ kıl payı söze eklenir. Skor kart açılmadan kaydedilir (`submitResult`).

| Skor | Söz |
|---|---|
| 1.500+ | Kurye bu hızla Roshan çukuruna bile bottle yetiştirir. 1vDOQUZ onaylı teslimat. |
| 800+ | Rünler dolu, bottle'lar taze. Mid'ci sana bir teşekkür borçlu. |
| 400+ | Sağlam teslimat. (kuleye / nehre) Birkaç kule daha ve efsane kurye sensin. |
| 150+ | Kurye yolda… Ritmi tut: boşluğun biraz altında kal. |
| kule geçti | Kısa kısa dokun, kuryeyi boşluğun ortasında tut. |
| kule geçmedi | DOG DOG DOG. Kurye fountain'dan çıkamadı; mid'ci hâlâ bottle bekliyor. |

## Zorluk eğrisi

Tüm değerler uçulan metreye (m) bağlıdır; kuleler, kuryeye ulaşacakları andaki mesafeye göre üretilir.

| Değer | 0 m | 300 m | 800 m | 1.500 m+ |
|---|---|---|---|---|
| Hız (birim/sn) | 205 | ~234 | ~270 | ~297 (en çok 300, 1.800 m'de) |
| Boşluk (birim) | 212 | ~198 | ~175 | 148 (1.400 m'de sabitlenir) |
| Kule aralığı (birim) | 350 | ~336 | ~319 | ~306 |
| Oynayan kule olasılığı | — | — | ~%19 | ~%30 → %42 (1.850 m) |

- Ardışık boşluk merkezleri arasında en çok ~115–160 birim **yukarı**, ~150–225 birim **aşağı** kayma olur
  (yukarı tırmanmak düşmekten zor olduğu için). Oynayan kulelerde yukarı sınır genliğin yarısı kadar azalır.
- **650 m'den** sonra bazı kulelerin boşluğu 24→48 birim genlikle yukarı-aşağı salınır (başlıkta küçük oklar).
- İlk kule her ekran genişliğinde kuryeden **44 m** ileride başlar (masaüstünde hazır ekranında görünür).
- Kule renkleri 8 kulede bir Radiant (yeşim taşı, yeşil kristal) ↔ Dire (kızıl taş, dikenli başlık) değişir.
- Eşyalar: her kulede %50 şişe (iki kulenin arasında ya da boşluğun kenarına yakın, küçük risk); Tango
  4. kuleden sonra, en az 9 kulede bir, taşınmıyorsa %22; Hız rünü 13–17. kulede, sonra her 15–22 kulede bir.

## Denetimler

- **Dokun / tıkla** (sahnenin her yeri), **Boşluk** ya da **↑**: kanat çırp.
- Boşluk sayfayı kaydırmaz (hazır ve uçuşta `preventDefault`); odak bir düğmedeyse (sonuç kartı “Tekrar oyna”,
  “Oyunlar”) Boşluk ona bırakılır (`kit.onOtherControl`). Ölüm anında basılan Boşluk da sayfayı kaydırmaz.
- Hazır ve uçuş sırasında sahnede `touch-action: none` (her dokunuş bir kanat, sayfa kaymaz/yakınlaşmaz);
  başlangıç ve sonuç kartında sayfa normal kayar.
- **Site kısayolları** Başla'dan itibaren kapalı (`ctx.hotkeys(false)`), ölümden 0,9 sn sonra ve temizlikte açılır.

## Sahne ve çizim

- Canvas 2D, DPR'ye duyarlı (en çok 2×). Mantıksal yükseklik sabit **600 birim**, genişlik kabın oranına göre
  (masaüstünde ~1.000, mobilde ~410 birim). Kurye ekran genişliğinin %27'sinde (96–230 birim).
- Yükseklik: masaüstünde genişlik × 0,6; 600 px altında genişlik × 1,45; her durumda sabit üst HUD ile alt
  yetenek çubuğu arasındaki alana sığar. 390×844'te başlık + HUD + sahne birlikte görünür (HUD mobilde de okunur).
- Katmanlar: önbellekli gökyüzü (gece moru → kor ufuk, yıldızlar, ay) → uzak dağlar (paralaks ×0,1) →
  ağaç siluetleri (×0,35; Radiant ve Dire tonları) → kuleler (×1) → nehir (akıntı çizgileri, kıyı sazları) →
  eşyalar → turbo hız çizgileri → kurye → parçacıklar → uçan yazılar → skor (sahne üstünde büyük metre).
  Paralaks katmanları dikişsiz karolar olarak bir kez çizilir; parıltılar hazır sprite'lardır.
- **Kurye** (özgün çizim): gri-lavanta gövde, uzun kulaklar, açık renk burun, sırtta kahverengi heybe ve
  altın kayış, heybeden çıkan mavi bottle, iki tüylü kanat. Kanat çırpınca kanatlar hızlı çırpar; eğim dikey
  hıza göre (çıkarken burun yukarı, düşerken aşağı). Turbo'da kırmızı hale + hayalet iz, korumada yanıp söner.
- **Eşyalar** (özgün çizim): mantar tıpalı cam şişe ve dalgalanan mavi sıvı; üç yapraklı Tango filizi;
  altıgen kırmızı Hız rünü ve çift ok.
- `prefers-reduced-motion`: sarsıntı yok, parçacıklar üçte bire iner, hayalet iz ve rün dönüşü yok, yazılar
  yerinde söner, “DOKUN VE UÇ” nabız atmaz, korumada yanıp sönme yerine sabit yarı saydamlık.
- Görünmezken çizim atlanır (IntersectionObserver); intro kartının arkasında otomatik pilotlu **demo** uçuşu.

## Test notları

Playwright (1440×900 masaüstü, 390×844 dokunmatik mobil). Yalnızca geliştirme sunucusunda
(`import.meta.env.DEV`) açılan `window.__kuryeDebug()` anlık görüntüsü (kurye konumu/hızı, fizik sabitleri,
kule boşlukları, turbo/koruma/Tango) sayfa içi bota bir sonraki boşluğun alt kenarında kalmasını sağlar;
**üretim derlemesinde yoktur** (derleme çıktısında aranarak doğrulandı), temizlikte silinir.

- Gerçek giriş: masaüstünde Boşluk, mobilde ekrana dokunuş uçuşu başlatır; `scrollY` değişmedi.
- Bot 300 m'de bırakıldı → nehre düştü (Tango bir kez kurtardı); sonuç kartı 343 = `csk:me.scores.kurye` = 343
  (masaüstü), 321 = 321 (mobil). İkinci uçuşta bot 70 sn'de ~2.000 m'ye ulaştı (turbo, Tango, Dire kuleleri ve
  oynayan kuleler görüldü), sonra bırakılarak öldürüldü. Üçüncü uçuş tek kanatla: kule geçilmeden ölüm →
  DOG DOG DOG damgası. `csk:hist.kurye` üç denemeyi kaydetti.
- Sekme gizlendi → duraklatıldı, mesafe dondu; sekme dönünce dokunuşa kadar duraklı kaldı, dokunuş devam ettirdi.
- Hazırda `Q` gezinmedi; “Oyunlar”a dönünce `window.__kuryeDebug` silindi ve `Q` yeniden Espri Duvarı'na gitti.
- Sonuç kartında Boşluk “Tekrar oyna”yı tetikledi, sayfa kaymadı. Hareket azaltma açıkken hatasız.
- Konsol hatası 0, yatay taşma yok (iki görünüm), `VITE_API_BASE=none vite build` başarılı.

## Önerilen rozetler

Kategori: **Refleks**. Eşikler metre (skor = metre + şişe bonusu):

| Rozet (öneri) | Koşul |
|---|---|
| Bottle Teslimatı | `kurye ≥ 300` |
| Efsane Kurye | `kurye ≥ 1000` |

## 2. tur iyileştirmeleri (oyun cilası)

| Bulgu | Değişiklik |
|---|---|
| Ölüm anı okunmuyordu: kurye kuleye değdiği kare takla atıp nehre düşüyordu; neye, nereden çarptığı belli değildi. | **Ölüm donması** (0,16 sn): kurye çarptığı yerde kalır, sahne titrer. **Çarpma noktasında** beyaz-kızıl yıldız + halka, **çarpılan kule parçası** (üst/alt) kızarır. Hareket azaltmada donma yok, işaretler sabit. |
| “Kuleye çarptı” genel bir cümleydi, bir sonraki denemeye öğüt vermiyordu. | Neden + öğüt: “Üst kuleye çarptı · daha seyrek dokun”, “Alt kuleye çarptı · biraz erken dokun”, “Nehre düştü · düşerken daha sık dokun”. Sonuç sözleri de bu nedeni kullanır. |
| Rekor kovalamanın uçuş içinde hiçbir işareti yoktu. | **Rekor kapısı:** eski rekorun bu uçuştaki yeri kesikli altın çizgi + “REKOR 1.234” olarak dünyada yaklaşır (şişe bonusu kapıyı yaklaştırır). Geçilince “YENİ REKOR!”, altın kıvılcım, fanfar; HUD’daki Rekor kutusu altına döner. Sonuç kartında rekor notu. |
| Kıl payı geçişte “iyi” sesi çalıyordu. | Ayrı kıl payı ıslığı (`sound.nearMiss`). Ölümde dokunmatikte kısa titreşim. |

Fizik, zorluk eğrisi ve skor (metre + şişe) değişmedi. `__kuryeDebug()` (yalnızca geliştirme) artık `cause`, `part`,
`best`, `recordAt` da döndürür. Test (`final.mjs kurye d|m`): 1. uçuş (bot ~120 m’de bırakılır) → neden işaretli, skor kaydı;
2. uçuşta rekor kapısı görünür ve “YENİ REKOR” tetiklenir, sonra sürekli çırpılarak kuleye çarpılır → parça üst/alt,
rekor kaydı, sonuç kartında rekor notu; oyun içinde Z kapalı, çıkınca Q çalışır ve kanca silinir.
