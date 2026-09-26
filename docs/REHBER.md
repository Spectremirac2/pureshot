# Rehber & UX — ilk giriş turu, yardım paneli, profil menüsü

İlk kez gelen ziyaretçiye sitenin ana gezinmesini (alttaki Dota yetenek çubuğu ve üst HUD) tanıtan tur,
her an açılabilen `?` yardım paneli, ad çipinden açılan profil menüsü ve iki küçük sürpriz.
Analizdeki boşluk: [ANALIZ.md → 2. Tur analizi, madde 1](ANALIZ.md). Plan: [PLAN.md → 2. Tur planı](PLAN.md).

| Dosya | İçerik |
|---|---|
| `src/core/tour.js` | Tur (karşılama → spot ışıklı adımlar → “Hazırsın”), yardım paneli `openHelp()`, derin bağlantı dürtmesi, otomatik başlatma |
| `src/styles/tour.css` | Tur, dürtme, yardım paneli, HUD menüsü/yardım düğmesi, alt bilgi düğmeleri, altın mod (tour.js içe aktarır) |
| `src/core/shell.js` | Ad çipi menüsü, HUD `?` düğmesi, `?` kısayolu, `#tur` / `#yardim` eylemleri, `csk:tour` / `csk:help` olayları, alt bilgi “Rehber” sütunu |
| `src/core/easter.js` | Konami kodu ve “dogdogdog” |
| `src/data/faq.js` | Yeni SSS maddesi `tur`; `kisayol` ve `nick` maddeleri güncellendi |
| `src/core/icons.js` | `compass`, `keyboard`, `pen` ikonları |

## Tur akışı ve metinler

Tur kendiliğinden yalnızca **ilk ziyarette**, kabuk ve ilk bölüm çizildikten **~800 ms** sonra açılır (modal açıksa
kapanmasını, sekme arka plandaysa görünür olmasını bekler). Elle açıldığında karşılama kartı atlanır.

**0 · Karşılama kartı** (ortada) — “İlk giriş · 30 saniye” / **DOG DOG DOG Üssü’ne hoş geldin** / “CureShotKick
hayranlarının üssü: espriler, 14 mini oyun, quizler ve 1vDOQUZ Arena. Gezinmenin sırrı alttaki yetenek çubuğunda;
kısa bir turla göstereyim.” Altında minik yetenek çubuğu önizlemesi (H Q W E **R** D F T | Z). Düğmeler: **Turu başlat** / **Geç**.

**Spot ışıklı adımlar** (masaüstü 12, mobil 11 — görünmeyen hedefler atlanır):

| # | Hedef | Başlık | Gövde (≤ ~140 karakter) |
|---|---|---|---|
| 1 | `.ability-slots` | Burası senin yetenek çubuğun | Dota’daki gibi: her slot bir bölüm, her tuş bir kısayol. Tıkla ya da tuşa bas; H seni her an Üs’e döndürür. *(dokunmatikte: “dokun ve gir. Ev simgeli H slotu…”)* |
| 2 | Q | Espri Duvarı | Efsane espriler, espri makinesi ve topluluk duvarı. Beğendiğini DOG’la, kendi esprini ekle. |
| 3 | W | Mini Oyunlar | 14 oyunluk salon: DOGdle, Invoker Kombo, Pudge Hook ve dahası. Rekor kır, rozet topla. **Dene:** W’ye bas / slota dokun → slot “büyü” animasyonu oynar, gezinmeden sonraki adıma geçilir. |
| 4 | E | Quizler | Hangi DOG’sun? Bilgi yarışması, Yetenek Avı… Sonucunu paylaş, arkadaşını DOG ilan et. |
| 5 | R (ulti) | 1vDOQUZ Arena | Ultin hazır. 3D arenada dokuz kişiye karşı tek başına: gerçek 1vDOQUZ. Bahane yok, bekleme süresi yok. — altın hale, yayılan halka, altın kart, “ULTİ” rozeti, ayrı ses |
| 6 | D | Karakter Analizleri | 10 DOG türü, radar grafikleri ve saha notları. Takımdaki DOG’un türü burada teşhis edilir. |
| 7 | F | Soru-Cevap | Topluluğa sor, DOG Kâhini’ne danış, SSS’e göz at. Kâhin “ward al” diyorsa, al. |
| 8 | T | Galeri & 3D Müze | fal.ai afişleri ve üç salonda 18 3D eser: DOG maskotu, Arena kahramanları, Roshan’ın kuzeni ve dahası. |
| 9 | Z (eşya) | Kahraman DOG Endeksi | Eşya slotun: 127 kahramanın DOG endeksi, tier listesi ve “Daha DOG mu?”. Pick’ten önce bir bak. — yeşim çerçeve, “EŞYA” rozeti |
| 10 | `.hud-dog` | DOG sayacı | Biri feed’lediğinde bas: DOG DOG DOG! Her basış topluluk sayacına eklenir. Utanma, herkes basıyor. |
| 11 | `.hud-clock` | Maraton saati | Bu sekmede geçirdiğin süre. En kısa yayın 24 saat sürüyor; sen daha ısınma turundasın. *(≤ 640 px’te saat gizli → adım atlanır)* |
| 12 | `.hud-nick` + `.hud-sound` + `.hud-help` | Profil, ses ve yardım | Ad çipinden profilini aç ya da adını değiştir. Hoparlör sesi kısar; ? yardımı her an açar. *(dokunmatikte: kişi simgesi menüsü)* |

Çubuk slotlarının başlıkları `routes.js`’teki `label`’dan gelir; yeni bir slot eklenirse tur onu genel bir metinle
kendiliğinden gösterir (`SLOT_COPY` tablosuna metin eklemek yeterli). `hidden` rotalar (ör. `#profil`) atlanır.

**Son kart · Hazırsın!** — “Çubuk senin, klavye senin. İlk hamle için üç öneri:” **Günün DOGdle’ı** (`#oyunlar--dogdle`),
**Oyun Salonu** (`#oyunlar`), **Profilin** (`#profil`); “Yardım her an bir tuş uzağında: ?” (dokunmatikte: kişi
simgesinin menüsü). Konfeti (hareket azaltılmışsa yok) ve kısa ses. Düğme: **Keşfe çık**.

### Kontroller
- Düğmeler: **Geç** (her adımda), **Geri** (ilk adımda pasif), **İleri** (son adımda **Bitir**). Adım sayacı (`3/12`) ve ilerleme noktaları.
- Klavye: `→` / `Enter` ileri, `←` geri, `Esc` geç (son kartta kapat). `Tab` kart içinde döner (odak tuzağı); açılışta
  birincil düğmeye odaklanır, kapanınca odak eski yerine döner.
- Tur açıkken sitenin hiçbir kısayolu tuş almaz: tur `keydown`’ı `window` üzerinde yakalama evresinde durdurur,
  kabuk da `isTourOpen()` iken kısayolları yok sayar. Sayfa (`#app`) `inert` olur; arka plana tıklama turu kapatmaz,
  kartı hafifçe dürter (yanlışlıkla kaybolmasın diye).
- Yerleşim: kart hedefin üstüne/altına/sağına/soluna, ekranda kalacak şekilde yerleşir (kenar payı 16 px, en fazla
  `calc(100vw - 32px)`); ok hedefin ortasını gösterir. `resize`, `scroll`, `visualViewport` ve `ResizeObserver`
  (kart + hedef) değişimlerinde yeniden hesaplanır. Dar tablet genişliğinde yatay kayan çubukta hedef slot görünür alana kaydırılır.
- Mobil (390 px): çubuk adımlarında kart çubuğun üstünde, HUD adımlarında altında; tüm hedefler ≥ 44 px.
- `prefers-reduced-motion`: geçiş ve animasyon yok (spot anında yer değiştirir, ulti halkası ve konfeti kapalı).
- Kapanışta tüm dinleyiciler, zamanlayıcılar ve gözlemciler kaldırılır; sayfa kaydırması hiç kilitlenmez.

### Derin bağlantılar
Ziyaretçi doğrudan bir oyun ya da quiz alt sayfasına gelirse (`#oyunlar--x`, `#arena`, `#quizler--x`; `#oyunlar--rozetler`
hariç) tur açılmaz. Onun yerine alt çubuğun üstünde küçük bir öneri görünür: **“Siteyi tanıyalım mı?” [Turu başlat] [×]**.
12 sn sonra ya da sayfaya ilk dokunuşta kaybolur. Ziyaretçi daha sonra bir hub’a (ör. `#oyunlar`) dönerse tur
karşılama kartıyla açılır; `×` “şimdi değil” demektir ve bu oturumda bir daha önerilmez.

## Depolama

| Anahtar (`ls`) | localStorage adı | Değer | Anlamı |
|---|---|---|---|
| `tour:v1` | `csk:tour:v1` | `"done"` | Tur sona kadar izlendi (son karta ulaşınca yazılır) |
| | | `"skipped"` | Geç / Esc ya da tur açıkken sayfa yenilendi/kapandı |
| `tour:auto` | `csk:tour:auto` | `true` | Yalnızca test: otomasyon altında da otomatik başlat (aşağıya bakın) |

İkisinden biri yazılınca tur **bir daha kendiliğinden açılmaz**. Tekrar izleyip geçmek `"done"`’ı silmez.
Metinler büyük ölçüde değişirse anahtarı `tour:v2` yapmak herkese turu bir kez daha gösterir.

## Turu yeniden başlatmak

- Klavyede `?` → yardım paneli → **Turu başlat**
- HUD ad çipi (mobilde kişi simgesi) → menü → **Turu başlat**
- Sayfanın en altı → **Rehber** → **Turu yeniden başlat**
- SSS → “Alttaki çubuk ne işe yarıyor? …” maddesindeki **Turu yeniden başlat** bağlantısı
- Adres: `…/#tur` (tur) ve `…/#yardim` (yardım paneli). Kabuk bu iki bağlantıyı gezinme yerine eyleme çevirir;
  sayfadaki herhangi bir `<a href="#tur">` / `<a href="#yardim">` da çalışır. Adres çubuğuna yazılırsa bulunulan sayfada kalınır.
- Kod: `startTour()` / `openHelp()` (`core/tour.js`, `core/shell.js` de yeniden dışa aktarır) ya da içe aktarmadan
  `document.dispatchEvent(new CustomEvent('csk:tour'))` / `'csk:help'`.

## Yardım paneli (`?`)

`?` (ABD klavyesinde Shift+/, Türkçe Q’da Shift+*; `e.key === '?'`) yazı alanı dışında, modal açık değilken ve
kısayollar açıkken (oyun oynanmıyorken) açılır; HUD’daki `?` düğmesi (> 640 px) ve ad menüsü de açar. İçerik:
`ROUTES`’tan üretilen kısayol listesi (gizli rotalar hariç; ulti/eşya rozetli), `?` ve `Esc`, DOG sayacı / Maraton
saati / Profil menüsü açıklamaları ve **Turu başlat**. `fx.modal` üzerinde çalışır (Esc ve arka plan kapatır).

## Profil menüsü (ad çipi)

WAI-ARIA menü düğmesi kalıbı: çip `aria-haspopup="menu"` + `aria-expanded`; Enter/Boşluk/↓ açar ve ilk öğeye, ↑ son
öğeye odaklanır; menüde ↑ ↓ Home End, `Esc` kapatıp çipe döner, `Tab` kapatır; dışarı tıklama ve sayfa değişimi kapatır.
Öğeler: **Profilim** (`#profil`), **Adını değiştir** (mevcut `openNickEditor`), **Yardım ve kısayollar**, **Turu başlat**.
Dokunmatikte her öğe 48 px, çip 44×44 px.

## Sürprizler (`core/easter.js`)

Yalnızca kısayollar açıkken (oyun oynanmıyorken), yazı alanı ve modal dışında; tuşlar arası 1,5 sn’den uzun ara diziyi sıfırlar.
- **Konami kodu** `↑ ↑ ↓ ↓ ← → ← → B A` → “1vDOQUZ MODU” damgası, konfeti, zafer sesi ve 10 sn boyunca
  `<html class="csk-gold">` (kor turuncusu yerine Aegis altını).
- **“dogdogdog” yazmak** → “DOG DOG DOG” damgası + DOG sesi + bir DOG basışı (`pressDog`). İlk `D` Karakter Analizleri
  kısayolu olarak çalışır; “dog”dan sonra gelen `D`’ler kısayol sayılmaz (meme yarıda ışınlanmasın).

## Tasarım kararları

- **Kısa, atlanabilir, değer odaklı.** Her ipucu tek fikir ve ≤ ~140 karakter; her adımda **Geç**, `Esc` ve ilerleme
  göstergesi; metinler “ne işe yarar”ı anlatır, arayüzü tarif etmez. Kaynak:
  [Appcues — Product tour UI patterns](https://www.appcues.com/blog/product-tours-ui-patterns),
  [Formbricks — User onboarding best practices](https://formbricks.com/blog/user-onboarding-best-practices).
- **Önerilen 3–5 adımdan uzun olmasının nedeni:** kullanıcı isteği açıkça alttaki çubuğun anlatılması. Bu yüzden karşılama
  kartı turu bir *seçim* olarak sunar (“Turu başlat / Geç”), adımlar tek tuşla (→) çok hızlı geçilir, W adımı etkileşimli
  (“Dene”) ve Ulti adımı görsel olarak ayrışır; tur her yerden yeniden açılabilir (Appcues: “istenince tekrar açılabilme”).
- **Bağlama duyarlı başlama.** Oyuna doğrudan gelen birini tam ekran kartla bölmek yerine küçük bir öneri gösterilir;
  tur hub’a dönünce açılır (Formbricks: kullanıcıyı işinin ortasında kesme).
- **Görünen neyse o anlatılır.** Hedefler çalışma anında ölçülür; mobilde gizli saat adımı atlanır, köşe adımı görünen
  düğmeleri birleştirir. Metinler dokunmatik/klavyeye göre değişir.
- **Sürekli yardım.** Tur bitince bilgi kaybolmasın diye `?` paneli ve SSS maddesi aynı içeriği kalıcı olarak sunar.
- **Erişilebilirlik.** `role="dialog"` + `aria-modal`, başlık/gövde `aria-labelledby`/`aria-describedby`, adım değişimi
  `aria-live` ile okunur, odak tuzağı ve geri dönüşü, `#app` `inert`.
- **Otomasyon koruması.** `navigator.webdriver` doğruysa tur/öneri kendiliğinden açılmaz (paralel ajanların ve
  entegrasyonun Playwright testleri tur katmanına takılmasın). Otomatik başlatmayı test etmek için
  `localStorage['csk:tour:auto'] = 'true'`. Elle başlatma (`#tur`, `?`, menü) her zaman çalışır.

## Test notları (25 Eylül 2026)

Playwright (Chromium, swiftshader), dev sunucusu, HMR websocket engelli. Betikler geliştirme sırasında geçici klasörde tutuldu.

| Senaryo | Sonuç |
|---|---|
| Masaüstü 1440×900, temiz bağlam → karşılama ~800 ms sonra (sayfa yüklemesi + 3D sahne dahil ~3,7 sn) | ✓ odak “Turu başlat”ta |
| 12 adım klavyeyle (Enter, →, ←); her adımda spot = hedefin `getBoundingClientRect()` + 6 px (±1,5 px), kart ekranda, hedefi örtmüyor, ok var, yatay taşma yok | ✓ 0 sorun |
| Tur sırasında `q` `h` `1` → adres değişmedi; Tab/Shift+Tab kartta kaldı; dışarıya zorla odak → karta döndü; arka plan tıklaması kapatmadı | ✓ |
| W adımında `w` → gezinmeden sonraki adım (“Aynen böyle!”) | ✓ |
| Son kart → Esc: kapandı, `#app` inert değil, kaydırma çalışıyor, kısayollar geri geldi, `csk:tour:v1 = "done"`; yenileyince açılmadı | ✓ |
| Esc ile geç → `"skipped"` + bilgilendirme; yenileyince açılmadı. Tur ortasında yenileme → `"skipped"` | ✓ |
| `?` → yardım paneli (H Q W E R D F T Z ? Esc); yazı alanında `?` açmaz; ikinci `?` ikinci modal açmaz; “Turu başlat” → tur 1/12 | ✓ |
| Ad menüsü: tık/Enter açar, ↓ / End gezinir, Esc çipe döner, “Adını değiştir” modalı kapanınca odak çipte, “Profilim” → `#profil`, dışarı tıklama kapatır | ✓ |
| Alt bilgi “Turu yeniden başlat”, SSS `#tur` / `#yardim` bağlantıları, açılışta `#tur` / `#yardim`, adres çubuğunda `#yardim`, `csk:tour` olayı | ✓ |
| Mobil 390×844 (dokunmatik): 11 adım dokunarak, kart ≤ 358 px ve 16 px payla, çubuk adımlarında kart çubuğun üstünde; W adımında slota dokunma; “Oyun Salonu” CTA | ✓ 0 sorun |
| Mobil menü: 4 öğe × 48 px, çip 44×44, ekranda; yardım paneli ekrana sığıyor, en üstten açılıyor | ✓ |
| 500 px (çubuk yatay kayıyor): her slot adımında hedef kaydırılarak görünür | ✓ |
| Derin bağlantı `#oyunlar--dogdle` (mobil): tur yok, öneri var; `#oyunlar`’a dönünce karşılama açıldı. `#arena`: öneriden “Turu başlat”. `#quizler--hangidog`: `×` sonrası hub’da açılmadı | ✓ |
| Otomasyon koruması: `tour:auto` yokken tur/öneri açılmıyor | ✓ |
| `reducedMotion: 'reduce'`: `no-motion` sınıfı, spot geçişi 0 sn, kart/ulti animasyonu yok, çalışan animasyon 0 | ✓ |
| Konami → altın mod + damga, 10 sn sonra kalkıyor; “dogdogdog” → damga, DOG sayacı +1 | ✓ |
| Konsol hatası | 0 |
| `VITE_API_BASE=none npx vite build` | ✓ uyarısız |

Not: swiftshader’da kare hızı düşük olduğundan spot geçişleri (0,34 sn) ölçümden önce bitmeyebilir; testler
ölçümden önce çalışan `CSSTransition`’ların bitmesini bekler.
