# Pudge Hook (`hook`)

**Rota:** `#oyunlar--hook` · **Bölüm:** Mini Oyunlar · **Tür:** Beceri · Nişan · **Birim:** puan (yüksek iyi)
**Dosyalar:** `src/sections/games/hook.js`, `src/sections/games/hook.css`,
`src/assets/abilities/pudge/pudge_meat_hook.webp` (üretilmiş, `scripts/fetch-ability-icons.mjs`);
kahraman portreleri `heroPortraitUrl()`; ikon `hook` (`src/core/icons.js`); kayıt: `games.js`

## Fikir

Dota’nın en ünlü “klip” anı: Pudge’un Meat Hook’u. Kuşbakışı bir nehir ve koridor sahnesinde hedefler
yürür, oyuncu nişan alıp kancayı fırlatır. Kanca **yoldaki ilk birime** takılır; bu yüzden creep dalgası
ve dost kahramanlar doğal bir kalkan olur. İsabet için hedefin **önüne** atmak gerekir.

## Kurallar ve puan

- Tur **60 sn** (kit `createRunner`: sekme gizlenince oyun durur).
- Kanca Pudge’dan nişan yönünde **düz** ve sabit hızla gider (menzile ~0,5 sn), menzilin ucundan geri döner.
  Bir birime değerse onu Pudge’a **sürükler**. Bekleme süresi **1,2 sn** (fırlatınca başlar); Pudge’un
  çevresindeki halka ve HUD’daki Meat Hook slotu dolumu gösterir. Kanca dışarıdayken yeni atış yok.
- **Düşman kahraman** (kırmızı halka, kırmızı parıltı, yürüme yönü oku): **+100**.
  Menzilin **%75’i ve ötesinden** çekersen **+50 uzun kanca** bonusu (“UZUN KANCA · 1.150”).
- **Creep** (küçük Dire birimleri, 2–3’lü gruplar): **+10**. Seriyi bozmaz, ilerletmez.
- **Dost kahraman** (yeşil çift halka + “DOST” etiketi): **−50**, ekran damgası **DOG DOG DOG**, kötü ses,
  sahne sarsıntısı, seri sıfırlanır. Puan 0’ın altına inmez.
- **Seri çarpanı:** art arda çekilen düşman kahramanlar; 3’te **×2**, 6’da **×3** (düşman ve creep puanına
  uygulanır). Iska (boş dönen kanca) ya da dost seriyi bozar.
- **Zorluk eğrisi:** hedefler 60 sn içinde ~%65 hızlanır; kahramanlar “juke” yapar (yön değiştirir ya da
  duraklar; olasılık %30 → %75); aynı anda sahnedeki hedef sayısı ve dost oranı (%17 → %26) artar.
- Hedefler: turun başında portresi olan 12 rastgele kahraman seçilir (8 düşman, 4 dost; Pudge hariç),
  portreler önceden yüklenir ve daire içine kırpılarak çizilir.

**Sonuç kartı:** İsabet oranı (düşman kahraman isabeti ÷ atış), Düşman, Dost (DOG), **En uzun kanca**
(Dota birimiyle; menzil 1.300 birime ölçeklenir), Creep, En uzun seri. Söz puana göre değişir, ikinci kez
çekilen kahraman varsa “En sevdiğin av: …” eklenir; 3+ dost çekildiyse özel DOG sözü gelir.

| Puan | Söz |
|---|---|
| 2.500+ | Fresh meat! … Bu kanca 1vDOQUZ onaylı. |
| 1.500+ | Temiz kancalar. Klip kanalına gidecek en az üç an var. |
| 700+ | Fena değil; creep dalgası biraz kalkan oldu ama av avdır. |
| 200+ | Kanca bazen tuttu, bazen nehre gitti. Hedefin peşine değil, önüne at. |
| 0–199 | DOG DOG DOG. Kanca döndü, çanta boş. |

## Denetimler

- **Fare:** imleç nişan alır (kesikli nişan çizgisi menzil sonuna kadar + artı işareti); **tık** fırlatır.
- **Boşluk:** geçerli nişana fırlatır (odak bir düğme/bağlantıdaysa Boşluk ona bırakılır: `kit.onOtherControl`).
  **← →** nişanı 4°’lik adımlarla çevirir (klavyeyle tam oynanabilir).
- **Dokunmatik:** dokunduğun noktaya nişan alır **ve** fırlatır. Oyun sırasında sahada `touch-action: none`
  (her dokunuş bir kanca, sayfa kaymaz); başlangıç/sonuç kartında sayfa normal kayar.
- Nişan yukarı yarım düzlemle sınırlıdır (Pudge’un arkasına atış yok).
- **Site kısayolları** oyun boyunca kapalı (`ctx.hotkeys(false)`), bitişten 0,9 sn sonra ve temizlikte açılır.

## Sahne ve çizim

- Canvas 2D, DPR’ye duyarlı (en çok 2×), kabın genişliğine göre yeniden boyutlanır (ResizeObserver).
  Masaüstünde mantıksal 800 birim genişlik, ~16:10 (yükseklik = genişlik × 0,6); 600 px altında 400 birim,
  dikey sahne (genişlik × 1,2) — dar ekranda hedefler büyük kalsın. Yükseklik görünür alanla
  (üst HUD + alt yetenek çubuğu hariç) sınırlanır; Pudge her zaman çubuğun üstünde görünür.
  Oyun sürerken mantıksal genişlik sabit kalır.
- Katmanlar: önbellekli zemin (üstte Dire, altta Radiant tonu; mor nehir, toz koridorlar, kenar ağaçları,
  kesikli menzil yayı ve uzun kanca yayı, Pudge’un taş platformu) → akan nehir çizgileri → nişan →
  hedefler (y sırasına göre) → zincir + kanca → Pudge jetonu ve bekleme halkası → kıvılcımlar → uçan yazılar.
- Çarpışma, kancanın o karedeki **doğru parçasıyla** yapılır (hızlı kanca küçük creep’in içinden geçmesin);
  parçada ilk temas eden birim seçilir.
- Görünmezken çizim atlanır (IntersectionObserver); sonuç kartının arkasında sahne canlı kalır.
- `prefers-reduced-motion`: sarsıntı yok, kıvılcımlar üçte bire iner, uçan yazılar yerinde söner, hazır
  halkası nabız atmaz.

## Varlıklar

- Kahraman portreleri: Valve’ın resmi Dota 2 görselleri (mevcut `src/assets/heroes/portraits/`).
- Meat Hook ikonu (HUD slotu): Valve’ın resmi CDN’inden 128 px WebP, `scripts/fetch-ability-icons.mjs`
  ile. Görseller Valve Corporation’a aittir. İkon yoksa çizgi ikon `hook` kullanılır; portre yoksa jetonda
  kahramanın kısaltması yazar.

## Test notları

Playwright (1440×900 masaüstü, 390×844 dokunmatik mobil). Yalnızca geliştirme sunucusunda
(`import.meta.env.DEV`) açılan `window.__hookDebug()` anlık görüntüsü (hedef konum/hızları, Pudge, menzil,
kanca hızı) test botunun hedefin önüne atmasını sağlar; üretim derlemesinde yoktur, temizlikte silinir.
- 60 sn boyunca hareketli düşmanlara öngörülü atış + en az bir bilinçli dost atışı; bot ~%70–85 isabetle
  ~3.000–7.000 puan yaptı. Sonuç kartındaki puan = `csk:me.scores.hook`.
- Pudge ve sahne alt çubuğun üstünde; yatay taşma yok; konsol hatası 0.
- Boşluk kancayı atar ve sayfayı kaydırmaz; oyunda Q gezinmez; “Oyunlar”a dönünce kısayollar açık.
- Hareket azaltma açıkken mobilde dokunarak atış hatasız.
