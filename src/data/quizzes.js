// Quiz bankaları — Quizler bölümü (#quizler) bu tek dosyadan beslenir.
//
// Kurallar:
// - Dota 2 bilgi soruları yalnızca yamayla değişmeyen, kalıcı bilgilerden oluşur (fiyat, bekleme süresi vb. yok).
// - Yayıncı hakkında yalnızca kullanıcının verdiği bilgiler kullanılır: Kick, Dota 2, "DOG DOG DOG", "1vDOQUZ",
//   en kısa yayının bile 24 saat sürmesi. Başka bilgi uydurulmaz.
// - Espriler hayran yapımıdır.

import { byId } from './archetypes.js';

// ------------------------------------------------------------------ Quiz listesi (merkez kartları)
export const QUIZZES = [
  {
    id: 'hangidog',
    name: 'Hangi DOG’sun?',
    kind: 'Kişilik testi',
    icon: 'paw',
    minutes: 3,
    count: 10,
    unit: 'soru',
    blurb: 'On pub durumu, kırk kaçamak cevap. Sonunda DOG Arşivi’ndeki yerini buluyorsun.',
  },
  {
    id: 'bilgi',
    name: 'Dota 2 Bilgi Yarışması',
    kind: 'Süreli yarışma',
    icon: 'brain',
    minutes: 4,
    count: 10,
    unit: 'soru',
    blurb: 'Her soruya 20 saniye. Hızlı olan bonus kapar, yavaş olan tango yer.',
  },
  {
    id: 'dogmu',
    name: 'DOG mu Değil mi?',
    kind: 'Karar kartları',
    icon: 'target',
    minutes: 3,
    count: 10,
    unit: 'kart',
    blurb: 'Pub’dan kesitler. Sağa kaydır, sola kaydır; DOG radarını topluluğa karşı test et.',
  },
  {
    id: 'hayran',
    name: 'Gerçek Hayran Testi',
    kind: 'Hayran sınavı',
    icon: 'crown',
    minutes: 3,
    count: 12,
    unit: 'soru',
    blurb: 'DOG DOG DOG ne zaman söylenir? DOQUZ’daki Q nereden geliyor? Kanıtla.',
  },
];

// ------------------------------------------------------------------ 1) Hangi DOG'sun?
// Her seçenek `s` içinde arketip kimliklerine puan verir; iyi oynayana `legend`.
export const HANGIDOG_QUESTIONS = [
  {
    id: 'savas',
    q: 'Takım savaşı başladı. Sen neredesin?',
    options: [
      { t: 'Üçlü kampı stack’liyorum, geliyorum geliyorum…', s: { farm: 3, ward: 1 } },
      { t: 'En öndeyim. Kimse gelmedi ama ben girdim bile.', s: { feed: 3, rapier: 1 } },
      { t: 'Smoke’landık, arkadan dalıyoruz. Ward’lar zaten yerinde.', s: { legend: 3 } },
      { t: 'All chat’e ne olduğunu yazıyorum, birisi yazmalı.', s: { chat: 3, smurf: 1 } },
    ],
  },
  {
    id: 'support',
    q: 'Support oldun. İlk 600 altınla ne alırsın?',
    options: [
      { t: 'Ward, Tango, Salve ve kurye için bir dua.', s: { legend: 3 } },
      { t: 'Hiçbir şey. Midas’a biriktiriyorum.', s: { ward: 3, farm: 1 } },
      { t: 'Kendime dört Tango. Ward başkasının işi.', s: { ward: 2, kurye: 1 } },
      { t: 'Support mu? Pick ekranında “mid” yazmıştım.', s: { mid: 3, smurf: 1 } },
    ],
  },
  {
    id: 'rapier',
    q: 'Rapier düştü, yerde parlıyor. Ne yaparsın?',
    options: [
      { t: 'Koşarak kaparım. Sonra büyük ihtimalle yine düşürürüm.', s: { rapier: 3, feed: 1 } },
      { t: 'Önce etrafı görürüz, takımla birlikte güvenle alırız.', s: { legend: 3 } },
      { t: 'Pause atıp bunu uzun uzun düşünürüm.', s: { pause: 3 } },
      { t: 'Chat’e “kim düşürdü” diye üç paragraf yazarım.', s: { chat: 3 } },
    ],
  },
  {
    id: 'dakika50',
    q: 'Maç 50. dakikada. Takıma son mesajın?',
    options: [
      { t: '“gg ff, bu takımla olmaz.”', s: { chat: 2, afk: 1 } },
      { t: '“3 dk daha farm, sonra geliyorum.”', s: { farm: 3 } },
      { t: '“Ana hesabımda olsam şimdi biterdi.”', s: { smurf: 3 } },
      { t: '“Smoke alın, Roshan’a gidiyoruz. Bitiriyoruz.”', s: { legend: 3 } },
    ],
  },
  {
    id: 'mid',
    q: 'Mid’i alamadın. Şimdi ne olacak?',
    options: [
      { t: '“Mid or feed” demiştim. Feed’i seçiyorum.', s: { mid: 3, feed: 2 } },
      { t: 'Offlane’e gidip sessizce maçın en iyi oyununu çıkarırım.', s: { legend: 3 } },
      { t: 'Ormana girerim ve bir daha görülmem.', s: { farm: 2, afk: 1 } },
      { t: 'Maç boyunca mid’e laf yetiştiririm.', s: { chat: 2, mid: 2 } },
    ],
  },
  {
    id: 'kurye',
    q: 'Kurye şu an senin elinde. Rotası ne?',
    options: [
      { t: 'Bottle doldurmaya. Altıncı kez.', s: { kurye: 3, mid: 1 } },
      { t: 'Önce takımın eşyaları, sonra benimkiler.', s: { legend: 3 } },
      { t: 'Düşman kulesinin tam üstünden kestirme.', s: { kurye: 2, feed: 1 } },
      { t: 'Kurye çeşmede bekliyor. Ben de.', s: { afk: 3 } },
    ],
  },
  {
    id: 'pause',
    q: 'Bir pause hakkın var. Ne zaman kullanırsın?',
    options: [
      { t: 'Rakip kombosunu atarken. Tam o saniyede.', s: { pause: 3 } },
      { t: 'Kapı çaldı, “1 dk su içicem”…', s: { pause: 2, afk: 2 } },
      { t: 'Takım arkadaşımın bağlantısı koptuğunda. Sadece o zaman.', s: { legend: 3 } },
      { t: 'Rakibin pause’unu protesto etmek için.', s: { chat: 2, pause: 1 } },
    ],
  },
  {
    id: 'skor',
    q: 'Takım arkadaşın 0-8. İlk tepkin?',
    options: [
      { t: 'REPORT yazıp büyük harfle devam ederim.', s: { chat: 3 } },
      { t: 'Yanıma alırım, birlikte toparlarız.', s: { legend: 3 } },
      { t: 'Sorun yok, ben de 0-9’um.', s: { feed: 3 } },
      { t: 'Fark etmem bile. Ormandayım.', s: { farm: 2, afk: 1 } },
    ],
  },
  {
    id: 'blink',
    q: 'Blink Dagger aldın. İlk hareketin?',
    options: [
      { t: 'Tek başıma beş kişinin tam ortasına.', s: { feed: 3, smurf: 1 } },
      { t: 'Kampları daha hızlı dolaşırım.', s: { farm: 3 } },
      { t: 'Komboyu ters sırayla yapıp “lag” derim.', s: { smurf: 3 } },
      { t: 'Doğru anı bekleyip savaşı ben başlatırım.', s: { legend: 3 } },
    ],
  },
  {
    id: 'altin',
    q: 'Cebinde yüklü bir altın var. Ne yaparsın?',
    options: [
      { t: 'Divine Rapier. Ya tutarsa?', s: { rapier: 3 } },
      { t: 'Buyback için saklarım.', s: { legend: 3 } },
      { t: 'Midas. Support olsam bile.', s: { ward: 3 } },
      { t: 'Kuryeye dört Salve yükleyip yollarım.', s: { kurye: 3 } },
    ],
  },
];

/** Sonuç ekranındaki eğlenceli kapanış cümleleri (arketip kimliğine göre). */
export const HANGIDOG_LINES = {
  farm: 'Tebrikler! Net worth grafiğinde zirvedesin. Takımın ise nerede olduğunu soruyor.',
  feed: 'Çeşme seni o kadar çok gördü ki artık adınla selamlıyor.',
  pause: 'Bu sonucu okumak için de pause attın, biliyoruz.',
  afk: 'Sonucun hazır. Sen dönene kadar burada bekleyecek.',
  kurye: 'Sonucun kuryeyle geliyor. Bottle’dan sonra sırada.',
  rapier: 'Sonucunu sakın yere düşürme. Rakip carry yakınlarda.',
  mid: 'Sonuç sayfası da senin koridorun. Kimse girmesin.',
  ward: 'Bu sonucu görebildin çünkü birisi senin yerine ward dikti.',
  smurf: 'Ana hesabında olsan başka türlü çıkardı. Tabii.',
  chat: 'Bu sonuca itirazını yorumlara roman olarak yazabilirsin. Yer ayırdık.',
  legend: 'Dört takım arkadaşı ve beş rakip: dokuzu da DOG, sen değilsin. 1vDOQUZ.',
};

// ------------------------------------------------------------------ 2) Dota 2 Bilgi Yarışması
// { q, a: doğru cevap, wrong: [3 yanlış], why: kısa açıklama }. Yalnızca kalıcı bilgiler.
export const BILGI_BANK = [
  { id: 'aegis', q: 'Aegis of the Immortal hangi canavar öldürülünce düşer?', a: 'Roshan', wrong: ['Ancient Black Dragon', 'Orman kurtları', 'Dire’ın Ancient’ı'], why: 'Roshan’ı kesen takım Aegis’i kapar. Sonra çukurun önünde dans etmek serbest.' },
  { id: 'aegis2', q: 'Aegis taşıyan kahraman ölünce ne olur?', a: 'Kısa süre sonra yeniden doğar; Aegis bir kez kullanılır', wrong: ['Bütün takım canlanır', 'Aegis rakibe geçer', 'Hiçbir şey, Aegis sadece süstür'], why: 'Aegis tek kullanımlık ikinci can verir. Harcandı mı biter; yenisi için Roshan’a yeniden gitmek gerekir.' },
  { id: 'rapier', q: 'Divine Rapier taşıyan kahraman ölürse ne olur?', a: 'Rapier yere düşer ve herkes alabilir', wrong: ['Rapier kaybolur, altını iade edilir', 'Rapier çeşmeye ışınlanır', 'Rapier iki kat güçlenir'], why: 'Rapier ölünce düşer. Rakip carry’nin eline geçerse maç çoğu zaman orada biter.' },
  { id: 'kazan', q: 'Dota 2’de maç nasıl kazanılır?', a: 'Rakibin Ancient’ını yok ederek', wrong: ['En çok kill alarak', 'Roshan’ı üç kez keserek', 'En çok altına sahip olarak'], why: 'Kill sayısı teselli ödülüdür; oyunu bitiren tek şey Ancient’ın yıkılmasıdır.' },
  { id: 'taraf', q: 'Dota 2’deki iki tarafın adı nedir?', a: 'Radiant ve Dire', wrong: ['Sentinel ve Scourge', 'Alliance ve Horde', 'Kırmızı ve Mavi'], why: 'Dota 2’de taraflar Radiant ve Dire. Sentinel ve Scourge, eski DotA haritasındaki adlardı.' },
  { id: 'besbes', q: 'Bir Dota 2 maçında her takımda kaç oyuncu bulunur?', a: '5', wrong: ['4', '6', '3'], why: '5v5. Yani 1v9 dediğinde: 4 takım arkadaşı + 5 rakip.' },
  { id: 'tango', q: 'Tango sana nasıl can verir?', a: 'Bir ağacı yiyerek zamanla can yeniler', wrong: ['Anında bütün canı doldurur', 'Can değil mana verir', 'Kuleye atılınca hasar verir'], why: 'Tango ağaç yer, kahraman iyileşir. Orman kısalır, laning uzar.' },
  { id: 'bkb', q: 'Black King Bar (BKB) etkinleştirildiğinde temel olarak ne sağlar?', a: 'Büyülere karşı bağışıklık', wrong: ['Görünmezlik', 'Ağaçların üstünden geçme', 'Her saniye altın'], why: 'BKB kısa bir süre büyülerin çoğuna karşı korur. Savaşa BKB’siz dalmak DOG Arşivi’nde ayrı bir sayfa.' },
  { id: 'observer', q: 'Observer Ward ne işe yarar?', a: 'Dikildiği bölgede görüş sağlar', wrong: ['Görünmez birimleri açığa çıkarır', 'Yakındaki düşmanlara hasar verir', 'Takıma altın kazandırır'], why: 'Observer haritayı aydınlatır. Görünmezleri göstermek ise Sentry’nin işi.' },
  { id: 'sentry', q: 'Sentry Ward’ın asıl görevi nedir?', a: 'Gerçek görüş: görünmez birimleri ve ward’ları gösterir', wrong: ['Haritada geniş bir alanı aydınlatmak', 'Creep dalgasını durdurmak', 'Kahramanı iyileştirmek'], why: 'Sentry gerçek görüş verir; görünmez kahramanlar ve rakip ward’ları ortaya çıkar.' },
  { id: 'tp', q: 'Town Portal Scroll (TP) ne yapar?', a: 'Kısa bir beklemeden sonra dost bir binaya ışınlar', wrong: ['Rakip üssüne ışınlar', 'Bütün takımı çeşmeye ışınlar', 'Kuryeyi yanına çağırır'], why: 'TP, savaşa geç kalmamanın yolu. Yine de ters yöndeki kuleye basmamaya dikkat.' },
  { id: 'bounty', q: 'Bounty rune’u alınca ne kazanırsın?', a: 'Altın', wrong: ['Görünmezlik', 'Anında seviye', 'Ekstra buyback hakkı'], why: 'Bounty rune altın verir; oyunun başında herkesin onun peşinde koşması bu yüzden.' },
  { id: 'dalga', q: 'Koridorlardaki creep dalgaları ne sıklıkla çıkar?', a: '30 saniyede bir', wrong: ['Dakikada bir', '10 saniyede bir', 'Yalnızca kule yıkılınca'], why: 'Her 30 saniyede bir yeni dalga yola çıkar. Farm Köpeği bunu bilir, savaş saatini bilmez.' },
  { id: 'deny', q: 'Dota 2’de “deny” ne demek?', a: 'Kendi takımının birimine son vuruşu yapıp rakibin kazancını engellemek', wrong: ['Rakibin büyüsünü geri çevirmek', 'Takım arkadaşının pause’unu iptal etmek', 'Kurye göndermeyi reddetmek'], why: 'Deny edilen creep’ten rakip altın alamaz, tecrübesi de azalır.' },
  { id: 'lasthit', q: '“Last hit” nedir?', a: 'Birime son vuruşu yapıp altını kapmak', wrong: ['Maçtaki son kill', 'Ancient’a vurulan son darbe', 'Oyundan çıkmadan önceki son mesaj'], why: 'Altını, birimi öldüren son vuruş kazanır. Vurup geçmek yetmez; zamanlama her şey.' },
  { id: 'buyback', q: 'Buyback ne işe yarar?', a: 'Altın ödeyip ölüm süresini beklemeden hemen yeniden doğmak', wrong: ['Dükkândan indirimli eşya almak', 'Rakibin Aegis’ini satın almak', 'Kaybedilen maçı geri almak'], why: 'Ölüm süresini altınla atlarsın. Son savaşta unutan, DOG DOG DOG’u hak eder.' },
  { id: 'kurye', q: 'Kurye (Courier) ne işe yarar?', a: 'Dükkândan kahramana eşya taşır', wrong: ['Rakip ward’larını söker', 'Kuleleri tamir eder', 'Creep dalgasını yönlendirir'], why: 'Kurye takımın postacısıdır. Onu altıncı kez bottle doldurmaya yollamak ise ayrı bir vaka.' },
  { id: 'pudge', q: 'Pudge’ın en meşhur yeteneği hangisi?', a: 'Meat Hook', wrong: ['Chronosphere', 'Black Hole', 'Ravage'], why: 'Meat Hook ile kancayı fırlatıp yakaladığı birimi kendine çeker.' },
  { id: 'invoker', q: 'Invoker büyülerini hangi üç küreyi birleştirerek oluşturur?', a: 'Quas, Wex ve Exort', wrong: ['Güç, Çeviklik ve Zekâ', 'Radiant, Dire ve Roshan', 'Ateş, Buz ve Şimşek'], why: 'Quas, Wex ve Exort’u farklı birleşimlerle dizip Invoke eder. Bu yüzden herkes “mid” diyor.' },
  { id: 'techies', q: 'Techies en çok neyle tanınır?', a: 'Haritaya döşediği mayınlarla', wrong: ['Kanca atmasıyla', 'Ejderhaya dönüşmesiyle', 'Ağaç dikmesiyle'], why: 'Techies mayın döşer; basan da “bu nereden çıktı” diye sorar.' },
  { id: 'ti', q: 'The International nedir?', a: 'Dota 2’nin en büyük dünya turnuvası', wrong: ['Bir Dota 2 kahramanı', 'Roshan’ın diğer adı', 'Nadir bir eşya'], why: 'TI, Valve’ın düzenlediği Dota 2 dünya şampiyonası. Pub’da TI oynayan çok, TI’a giden az.' },
  { id: 'ozellik', q: 'Dota 2 kahramanlarının ana özellik türleri hangileri?', a: 'Güç, Çeviklik, Zekâ ve Evrensel', wrong: ['Ateş, Buz, Şimşek ve Toprak', 'Hız, Zırh, Şans ve Mana', 'Carry, Support, Mid ve Orman'], why: 'Her kahramanın ana özelliği Güç, Çeviklik ya da Zekâdır; Evrensel kahramanlar üçünden birden güç alır.' },
  { id: 'smoke', q: 'Smoke of Deceit ne yapar?', a: 'Seni ve yakınındaki takım arkadaşlarını görünmez yapar', wrong: ['Rakibi susturur', 'Kuleleri görünmez yapar', 'Kuryeyi hızlandırır'], why: 'Smoke gank ve Roshan için gizlenmeni sağlar; düşmana fazla yaklaşınca bozulur.' },
  { id: 'dust', q: 'Dust of Appearance ne işe yarar?', a: 'Yakındaki görünmez düşmanları açığa çıkarır', wrong: ['Kahramanını görünmez yapar', 'Ağaçları keser', 'Kuleye can verir'], why: 'Görünmez kahramanlara karşı cebindeki en iyi arkadaş.' },
  { id: 'ultitus', q: 'Varsayılan tuş düzeninde bir kahramanın ultimate yeteneği hangi tuştadır?', a: 'R', wrong: ['Q', 'Boşluk', 'Tab'], why: 'Q-W-E yetenekler, R ultimate. Bu sitenin alt çubuğunda da R, ultimate: 1vDOQUZ Arena.' },
  { id: 'rampage', q: '“Rampage” anonsu ne zaman duyulur?', a: 'Bir oyuncu kısa sürede üst üste 5 düşman kahramanı öldürünce', wrong: ['İlk kill alınınca', 'Roshan kesilince', 'Maç bir saati geçince'], why: 'Double, Triple, Ultra ve Rampage: beşini birden silen oyuncuya özel anons.' },
  { id: 'firstblood', q: '“First Blood” nedir?', a: 'Maçtaki ilk kahraman ölümü', wrong: ['İlk kesilen creep', 'İlk yıkılan kule', 'İlk alınan rune'], why: 'Maçın ilk kahraman kill’i. Alan için gurur, veren için uzun bir ölüm ekranı.' },
  { id: 'ultra', q: '“Ultra Kill” anonsu kaç kahraman öldürünce gelir?', a: '4', wrong: ['3', '5', '6'], why: 'Double (2), Triple (3), Ultra (4), Rampage (5).' },
  { id: 'cesme', q: 'Üssündeki çeşme (Fountain) ne yapar?', a: 'Yanındaki dost kahramanlara hızla can ve mana yeniler', wrong: ['Her saniye altın verir', 'Ölen creep’leri canlandırır', 'Rakibe görüş verir'], why: 'Çeşme can ve mana doldurur. AFK Köpeği’nin de doğal yaşam alanıdır.' },
  { id: 'bottle', q: 'Bottle’ın özelliği nedir?', a: 'Can ve mana yeniler, içine rune saklanabilir', wrong: ['Rakibin manasını çalar', 'Sınırsız TP verir', 'Kuryeyi hızlandırır'], why: 'Bottle’a rune doldurup sonra kullanabilirsin. Mid oyuncuları bu yüzden onu elinden bırakmaz.' },
  { id: 'blink', q: 'Blink Dagger ne sağlar?', a: 'Kısa mesafeye anında ışınlanma', wrong: ['Her vuruşta kritik hasar', 'Rakibi susturma', 'Yüksek can yenilemesi'], why: 'Blink ile savaşı başlatırsın. Doğru anda basarsan kahraman, yanlış anda basarsan Feed Köpeği.' },
  { id: 'radiantus', q: 'Radiant’ın üssü haritanın neresindedir?', a: 'Sol alt köşede', wrong: ['Sağ üst köşede', 'Haritanın ortasında', 'Sol üst köşede'], why: 'Radiant sol altta, Dire sağ üstte. Nehir ikisinin arasından akar.' },
  { id: 'koridor', q: 'Dota 2 haritasında kaç koridor (lane) vardır?', a: '3', wrong: ['2', '4', '5'], why: 'Üst, orta ve alt. Orta koridor tek kişiliktir ve herkes onu ister.' },
  { id: 'antimage', q: 'Anti-Mage’in saldırıları rakibin neyini yakar?', a: 'Manasını', wrong: ['Altınını', 'Ağaçlarını', 'Ward’larını'], why: 'Mana Break her vuruşta rakibin manasını yakar. Manasız büyücü, yürüyen bir cübbedir.' },
  { id: 'midas', q: 'Hand of Midas ne işe yarar?', a: 'Bir creep’i dönüştürüp ekstra altın ve tecrübe kazandırır', wrong: ['Takım arkadaşını iyileştirir', 'Kuleleri altına çevirir', 'Rakibin altınını çalar'], why: 'Midas farmı hızlandırır. Support’un ward yerine Midas alması ise DOG mu Değil mi? kartlarında.' },
  { id: 'valve', q: 'Dota 2’yi hangi şirket geliştirdi?', a: 'Valve', wrong: ['Blizzard', 'Riot Games', 'Ubisoft'], why: 'Dota 2 bir Valve oyunu. Kökleri Warcraft III’teki DotA haritasına dayanır.' },
  { id: 'koken', q: 'Dota 2’nin atası DotA haritası hangi oyun için yapılmıştı?', a: 'Warcraft III', wrong: ['StarCraft', 'Counter-Strike', 'Age of Empires II'], why: 'Defense of the Ancients, Warcraft III için yapılmış bir özel haritaydı.' },
  { id: 'stack', q: '“Stack” yapmak ne demek?', a: 'Tarafsız kampı doğma anından önce çekip kampların birikmesini sağlamak', wrong: ['Kuleleri güçlendirmek', 'Creep dalgasını kuleye çekmek', 'Aynı eşyadan iki tane almak'], why: 'Kamp boşken yeniden doğar; zamanında çekersen üst üste birikir. Carry’ye güzel bir hediye.' },
  { id: 'haste', q: 'Haste rune’u ne verir?', a: 'Kısa süreliğine en yüksek hareket hızı', wrong: ['Çift hasar', 'Görünmezlik', 'Yanılsama kopyaları'], why: 'Haste ile ya kovalarsın ya kaçarsın; ikisini de en hızlı hâlinle.' },
];

/** Bilgi yarışması unvanları (10 sorudaki doğru sayısına göre). */
export const BILGI_TITLES = [
  { min: 9, title: 'Wiki’yi Ezberlemiş', note: 'Bu bilgiyle pub’da değil, masada oturman lazım.', tone: 'gold' },
  { min: 7, title: 'Arşiv Kurdu', note: 'Patch notlarını yatmadan önce okuyanlardan.', tone: 'gold' },
  { min: 5, title: 'Pub Efsanesi', note: 'Bildiğin yetiyor; bilmediğini chat’e sorarsın.', tone: 'jade' },
  { min: 3, title: 'Tango Yiyen Çırak', note: 'Ağaçlar senden korkuyor, rakipler henüz değil.', tone: 'ember' },
  { min: 0, title: 'Çeşmede Uyuyan', note: 'Olsun. Herkes bir yerden başlar; çoğu da çeşmeden.', tone: 'blood' },
];

// ------------------------------------------------------------------ 3) DOG mu Değil mi?
// verdict: 'dog' | 'not'. who: kartın üstündeki rol etiketi. t: maç dakikası (süs).
export const DOGMU_CARDS = [
  { id: 'stack35', t: '35:00', who: 'Carry', text: 'Takım arkadaşın 35. dakikada hâlâ ormanda üçlü kamp stack’liyor. Takım 4v5 savaşıyor.', verdict: 'dog', why: 'Stack güzel şeydir; takım savaşırken değil. Farm Köpeği kokusu alıyoruz.' },
  { id: 'midas20', t: '20:00', who: 'Support', text: 'Support 20. dakikada Midas aldı. Haritada tek bir ward yok.', verdict: 'dog', why: 'Midas’ın suçu yok; karanlık harita suçlu. Ward’sız Destek Köpeği iş başında.' },
  { id: 'buyback', t: '52:10', who: 'Carry', text: 'Carry son savaşta buyback’i unuttu. Altını vardı, tuşa basmadı.', verdict: 'dog', why: 'Altın cepte, carry çeşmede, Ancient yerde. Klasik DOG DOG DOG.' },
  { id: 'roshsolo', t: '28:40', who: 'Sen', text: 'Roshan’ı tek başına kesmeyi bekliyordun. Rakip 5 kişi dalıp Roshan’ı çaldı.', verdict: 'dog', why: 'Rakip gayet mantıklı oynadı. DOG olan, Roshan’ı tek başına beklemeye karar veren.' },
  { id: 'smokegank', t: '12:30', who: 'Support', text: 'Support smoke alıp takımı sessizce gank’e götürdü, iki kill geldi.', verdict: 'not', why: 'Bu düpedüz iyi oyun. DOG değil, alkış.' },
  { id: 'wardrosh', t: '24:05', who: 'Support', text: 'Ölmeden hemen önce son ward’unu Roshan çukurunun önüne dikti.', verdict: 'not', why: 'Öldü ama takıma görüş bıraktı. Kahramanca bir veda.' },
  { id: 'tpsave', t: '31:15', who: 'Carry', text: 'Savaş başlar başlamaz TP ile geldi ve takımı kurtardı.', verdict: 'not', why: 'TP’si hazır carry, nesli tükenmekte olan tür. Koruma altına alındı.' },
  { id: 'pausekombo', t: '18:22', who: 'Mid', text: 'Rakip kombo atarken “1 dk su içicem” deyip pause attı.', verdict: 'dog', why: 'Zamanın efendisi Pause Köpeği. Su önemli ama zamanlama da önemli.' },
  { id: 'rapierdive', t: '41:00', who: 'Carry', text: 'Rapier’i alan takım arkadaşın tek başına rakip üssüne daldı.', verdict: 'dog', why: 'Rapier 30 saniye sonra rakip carry’nin elindeydi. Kumar hayattır, DOG da.' },
  { id: 'rakipdeny', t: '06:10', who: 'Rakip', text: 'Rakip mid, creep’lerinin yarısını deny’ladı. Sen neredeyse hiç last hit alamadın.', verdict: 'not', why: 'Rakip iyi oynadı, sen de biraz izledin. Deny sanattır, DOG değil.' },
  { id: 'allchat', t: '22:45', who: 'Offlane', text: 'Takım arkadaşın ölüp üç dakika boyunca all chat’e roman yazdı.', verdict: 'dog', why: 'Chat Köpeği’nin edebî dönemi. Mute butonu tam bunun için var.' },
  { id: 'kuryebottle', t: '09:30', who: 'Mid', text: 'Mid, kuryeyi altıncı kez bottle doldurmaya yolladı. Senin Blink dükkânda bekliyor.', verdict: 'dog', why: 'Kurye Köpeği! Blink’in hâlâ dükkânda seni bekliyor.' },
  { id: 'ggwp', t: '44:00', who: 'Rakip', text: 'Rakip maçı kazandıktan sonra “gg wp” yazdı.', verdict: 'not', why: 'Nezaket DOG değildir. Acı ama saygılı.' },
  { id: 'aegisafk', t: '27:50', who: 'Carry', text: 'Aegis’i alan takım arkadaşın çeşmeye dönüp AFK kaldı.', verdict: 'dog', why: 'Aegis’in de bir son kullanma tarihi var. AFK Köpeği onu çeşmede bekletti.' },
  { id: 'glyph', t: '33:05', who: 'Support', text: 'Kule yıkılmak üzereyken Glyph’e bastı, takım geri dönüp kuleyi kurtardı.', verdict: 'not', why: 'Doğru anda Glyph: küçük tuş, büyük fark.' },
  { id: 'midorfeed', t: '00:00', who: 'Mid', text: 'Pick ekranında “mid or feed” yazdı. Mid verilmeyince gerçekten feed’e başladı.', verdict: 'dog', why: 'Sözünü tutan tek DOG. Ama keşke bu sözü tutmasaydı.' },
  { id: 'tangopaylas', t: '02:00', who: 'Support', text: 'Support, lane’de zorlanan carry’ye Tango paylaştı.', verdict: 'not', why: 'Ağaç yiyerek büyüyen dostluk. DOG değil, en iyi arkadaş.' },
  { id: 'smurfult', t: '14:40', who: 'Smurf', text: '“Ana hesabım 8k” deyip ilk savaşta ultisini creep’e bastı.', verdict: 'dog', why: 'Smurf Köpeği! Ana hesap belki 8k; creep de çok tehlikeliydi.' },
  { id: 'sentrydust', t: '16:20', who: 'Support', text: 'Rakipte görünmez bir kahraman var diye Sentry ward ve Dust aldı.', verdict: 'not', why: 'Görünmeze karşı gerçek görüş: ders kitabı support.' },
  { id: 'lvl3', t: '30:00', who: 'Takım arkadaşı', text: 'Takım arkadaşın 30. dakikada hâlâ 3. seviye.', verdict: 'dog', why: 'AFK Köpeği mi, Feed Köpeği mi? Belki ikisi birden.' },
  { id: 'gericekil', t: '38:30', who: 'Takım', text: 'Takım 3 kişi kalınca savaşa girmeyip geri çekildi, buyback’lerini sakladı.', verdict: 'not', why: 'Kaybetmemeyi bilmek de oyun. DOG değil, akıl.' },
  { id: 'solot3', t: '26:10', who: 'Offlane', text: 'Tek başına, smoke’suz, ward’sız Dire’ın üçüncü kulesine daldı.', verdict: 'dog', why: 'Feed Köpeği’nin en sevdiği mekân: düşman kulesinin tam altı.' },
  { id: 'roshfarm', t: '34:00', who: 'Carry', text: 'Takım “Roshan!” diye bağırırken carry Ancient kampını kesmeye devam etti.', verdict: 'dog', why: 'Farm Köpeği Roshan’ı da bir kamp sanıyor; sırası gelince gelecek.' },
  { id: 'ozur', t: '46:00', who: 'Takım arkadaşı', text: 'Kaybedilen savaşın ardından “benim hatam, pardon” yazdı.', verdict: 'not', why: 'Hatasını kabul eden oyuncu: pub’ın en nadir kahramanı.' },
  { id: 'killcal', t: '19:15', who: 'Support', text: 'Support, carry’nin kesin alacağı kill’i son vuruşla kaptı.', verdict: 'dog', why: 'Teknik olarak suç değil ama carry’nin gözündeki yaşları gördük. DOG.' },
  { id: 'bkberken', t: '29:35', who: 'Carry', text: 'Rakip daha tek büyü atmadan BKB’ye bastı; ultiler 10 saniye sonra geldi.', verdict: 'dog', why: 'BKB süresi savaş başlamadan bitti. Zamanlama DOG’u.' },
  { id: 'runeward', t: '03:50', who: 'Support', text: 'Rune çıkmadan önce nehre Observer ward dikti.', verdict: 'not', why: 'Rune kontrolü, mid’in minnettarlığı. Tam not.' },
  { id: 'stackerken', t: '04:00', who: 'Support', text: 'Support ilk dakikalardan itibaren carry için kamp stack’ledi.', verdict: 'not', why: 'İşte doğru zamanda stack. Carry’nin en iyi hediyesi.' },
  { id: 'kuryekule', t: '11:10', who: 'Mid', text: 'Kuryeyi düşman kulesinin üstünden geçirdi. Kurye öldü, suçu mid’e attı. Mid kendisi.', verdict: 'dog', why: 'Kurye Köpeği kendini bile suçlayamayacak kadar meşgul.' },
  { id: 'terstp', t: '36:20', who: 'Offlane', text: 'Savaş alt koridorda başladı; o TP’yi üst koridordaki kuleye bastı.', verdict: 'dog', why: 'Farm Köpeği’nin imza hareketi: savaş başlarken ters yöne ışınlanmak.' },
  { id: 'dcpause', t: '15:00', who: 'Takım arkadaşı', text: 'Bir arkadaşının bağlantısı kopunca pause atıp dönmesini bekledi.', verdict: 'not', why: 'Pause’un icat edilme sebebi tam olarak bu. DOG değil.' },
  { id: 'ggff10', t: '10:05', who: 'Takım arkadaşı', text: 'Takım tek ölüm vermişken 10. dakikada “gg ff” yazdı.', verdict: 'dog', why: 'Maç daha ısınma turunda; 24 saatlik maraton yayınlarda 10. dakika sayılmaz bile.' },
  { id: 'bbsavunma', t: '55:40', who: 'Carry', text: 'Buyback yapıp Ancient’ı son saniyede tek başına savundu.', verdict: 'not', why: 'İşte 1vDOQUZ ruhu. DOG değil, efsane.' },
  { id: 'rampagesira', t: '39:00', who: 'Takım', text: 'Rakip Rampage yaptı çünkü takımın beşi de aynı dar geçide sıraya girdi.', verdict: 'dog', why: 'Rampage’i yapan değil, sıraya giren DOG.' },
  { id: 'mute', t: '21:30', who: 'Takım arkadaşı', text: 'Tilt olmamak için all chat’i sessize alıp oyuna odaklandı.', verdict: 'not', why: 'Mute, Dota’nın en güçlü eşyası. Akıllıca.' },
];

/** DOG radarı unvanları (siteyle uyum yüzdesi). */
export const DOGMU_TITLES = [
  { min: 90, title: 'DOG Dedektifi', note: 'Mini haritaya bakmadan bile DOG’u kokusundan tanıyorsun.', tone: 'gold' },
  { min: 70, title: 'Gerçek Görüşlü Sentry', note: 'Görünmez DOG’lar bile senden kaçamıyor.', tone: 'jade' },
  { min: 50, title: 'Yarım Ward', note: 'Haritanın yarısı aydınlık, yarısı sis. Fena değil.', tone: 'jade' },
  { min: 30, title: 'Sisin İçindeki Yolcu', note: 'Bazı DOG’lar yanından geçip gitti. Bir Sentry al.', tone: 'ember' },
  { min: 0, title: 'Sen de Biraz DOG’sun', note: 'Takma kafana; herkesin içinde küçük bir DOG yaşar.', tone: 'blood' },
];

// ------------------------------------------------------------------ 4) Gerçek Hayran Testi
// Yalnızca kullanıcının verdiği bilgiler + sitenin kendi içeriği.
const arch = (id) => byId(id) || { name: id, tagline: '' };

export const HAYRAN_QUESTIONS = [
  { id: 'nezaman', q: '“DOG DOG DOG” ne zaman söylenir?', a: 'Biri kötü oynadığında ya da oyunu trollediğinde', wrong: ['Maç kazanıldığında', 'Ekranda bir köpek görünce', 'Yayın kapanırken'], why: 'DOG DOG DOG, kötü oyuna ve trollemeye verilen meşhur tepki.' },
  { id: 'kime', q: '“DOG DOG DOG” kime söylenebilir?', a: 'Takım arkadaşına, rakibe, kısacası herhangi birine', wrong: ['Yalnızca rakiplere', 'Yalnızca takım arkadaşlarına', 'Yalnızca kuryeye'], why: 'Taraf ayırt etmez: kötü oynayan ya da trolleyen herkes DOG olabilir.' },
  { id: 'doquz', q: '“1vDOQUZ” ne anlama geliyor?', a: '1v9: tek başına dokuz kişiye karşı oyunu taşımak', wrong: ['Maçı dokuz dakikada bitirmek', 'Bir Dota 2 kahramanının adı', 'Dokuzuncu seviyede solo kill'], why: '1v9 şakası: bire dokuz. Oyunu tek başına sırtlamak.' },
  { id: 'dokuzkisi', q: '1vDOQUZ’daki dokuz kişi kimlerden oluşur?', a: '4 takım arkadaşı ve 5 rakip', wrong: ['9 rakip', '5 takım arkadaşı ve 4 rakip', '9 kurye'], why: 'Dota 5v5 oynanır: senden başka 4 takım arkadaşı ve 5 rakip. Toplam dokuz.' },
  { id: 'q', q: '“DOQUZ” yazımındaki Q neden var?', a: '“Dokuz” kelimesinin stilize yazımı', wrong: ['Q tuşundaki yeteneğin adı', 'Bir klavye hatası', 'Bir kahraman adının kısaltması'], why: 'Dokuz → DOQUZ. K yerine Q: daha havalı, daha 1v9.' },
  { id: 'sure', q: 'En kısa yayını bile ne kadar sürer?', a: '24 saat', wrong: ['2 saat', '6 saat', '45 dakika'], why: 'Maraton yayın: en kısası bile 24 saat. Sitenin üstündeki sayaç bu yüzden “Maraton” diyor.' },
  { id: 'platform', q: 'Yayınlar hangi platformda?', a: 'Kick', wrong: ['Twitch', 'YouTube', 'Facebook Gaming'], why: 'Kick’te: kick.com/cureshotkick.' },
  { id: 'oyun', q: 'Yayınlarda hangi oyun oynanıyor?', a: 'Dota 2', wrong: ['League of Legends', 'Counter-Strike 2', 'Valorant'], why: 'Dota 2. Ward, stack, buyback ve bol bol DOG.' },
  { id: 'ward', q: `DOG Arşivi’nde “${arch('ward').tagline}” sloganı hangi türe ait?`, a: arch('ward').name, wrong: [arch('farm').name, arch('kurye').name, arch('smurf').name], why: 'Support seçip ward almamak: bu sitenin DOG Arşivi’ndeki en tanıdık türlerden.' },
  { id: 'pause', q: 'DOG Arşivi’nde her takım savaşının ortasında “1 dk su içicem” deyip pause atan tür hangisi?', a: arch('pause').name, wrong: [arch('afk').name, arch('chat').name, arch('kurye').name], why: 'Pause Köpeği: rakip kombo atarken dünyayı donduran zamanın efendisi.' },
  { id: 'legend', q: 'DOG Arşivi’nde DOG olmayan tek sonuç hangisi?', a: arch('legend').name, wrong: [arch('smurf').name, arch('rapier').name, arch('mid').name], why: 'Dokuz DOG’u sırtında taşıyan efsane. “Hangi DOG’sun?” testinde en iyi oynayanlara çıkar.' },
  { id: 'ulti', q: 'Bu sitenin alt yetenek çubuğunda ultimate (R) seni nereye götürür?', a: '1vDOQUZ Arena', wrong: ['Espri Duvarı', 'Soru-Cevap', 'Galeri & 3D Müze'], why: 'R tuşu ultimate: 1vDOQUZ Arena. Dokuz DOG’a karşı tek başına.' },
];

/** Hayran kademeleri (12 sorudaki doğru sayısı). */
export const HAYRAN_TIERS = [
  { min: 12, title: '1vDOQUZ Tanığı', note: 'Dokuz DOG’a karşı o efsane anı canlı izlemiş gibisin. Tam puan.', tone: 'gold' },
  { min: 9, title: '24 Saat İzleyen', note: 'Maratonun başında girdin, sonunda hâlâ buradasın.', tone: 'gold' },
  { min: 5, title: 'Emote Ustası', note: 'Chat’te doğru anda doğru DOG’u atıyorsun.', tone: 'jade' },
  { min: 0, title: 'Chat’e Yeni Katılmış', note: 'Hoş geldin! 24 saatlik bir yayın, öğrenmek için bol vakit demek.', tone: 'ember' },
];

/** Verilen puan tablosunda en yüksek eşiği bulur. */
export function tierFor(table, value) {
  return table.find((t) => value >= t.min) || table[table.length - 1];
}
