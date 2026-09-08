/** Demo inventory used by `npm run seed`. Bilingual copy is hand-written (translation: "manual"). */
export type SeedRoom = { id: string; name: { en: string; ja: string }; description: { en: string; ja: string }; sleeps: number; pricePerNight: number; breakfast: boolean; refundable: boolean; image: string; quantity?: number; sizeSqm?: number };
export type SeedHotel = {
  id: string; name: { en: string; ja: string }; city: string; area: { en: string; ja: string };
  type: "hotel" | "ryokan" | "business" | "hostel"; rating: number; reviewCount: number;
  description: { en: string; ja: string }; access: { en: string; ja: string }; amenities: string[];
  checkIn: string; checkOut: string; images: string[]; rooms: SeedRoom[];
  station?: { en: string; ja: string }; lat?: number; lng?: number; address?: string;
};

export type SeedReview = { hotel: string; author: string; rating: number; title: { en: string; ja: string }; body: { en: string; ja: string }; stayMonth: string };

const img = (seed: string, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const seedHotels: SeedHotel[] = [
  {
    id: "shinjuku-granbell",
    station: { en: "Shinjuku Station", ja: "新宿駅" }, lat: 35.6917, lng: 139.7036, address: "東京都新宿区新宿3丁目",
    name: { en: "Shinjuku Sky Terrace Hotel", ja: "新宿スカイテラスホテル" },
    city: "tokyo",
    area: { en: "Shinjuku, 4 min from station", ja: "新宿・駅から徒歩4分" },
    type: "hotel",
    rating: 4.5,
    reviewCount: 1284,
    description: {
      en: "A modern high-rise hotel steps from Shinjuku Station with a rooftop bar overlooking the skyline. Rooms are compact but bright, with blackout curtains and rain showers.",
      ja: "新宿駅から徒歩すぐの高層モダンホテル。スカイラインを望むルーフトップバーが自慢です。客室はコンパクトながら明るく、遮光カーテンとレインシャワーを完備。",
    },
    access: {
      en: "JR Shinjuku Station East Exit, 4 min walk. Narita Express direct.",
      ja: "JR新宿駅東口より徒歩4分。成田エクスプレス直通。",
    },
    amenities: ["wifi", "bar", "restaurant", "gym", "luggage", "nonSmoking", "accessible"],
    checkIn: "15:00",
    checkOut: "11:00",
    images: [img("shinjuku-1"), img("shinjuku-2"), img("shinjuku-3")],
    rooms: [
      {
        id: "std-double",
        name: { en: "Standard Double", ja: "スタンダードダブル" },
        description: { en: "18 m², 1 double bed, city view", ja: "18㎡・ダブルベッド1台・シティビュー" },
        sizeSqm: 18, sleeps: 2, pricePerNight: 16800, breakfast: false, refundable: true, image: img("shinjuku-r1"),
      },
      {
        id: "deluxe-twin",
        name: { en: "Deluxe Twin with Breakfast", ja: "デラックスツイン 朝食付き" },
        description: { en: "26 m², 2 single beds, high floor", ja: "26㎡・シングルベッド2台・高層階" },
        sizeSqm: 26, sleeps: 2, pricePerNight: 24500, breakfast: true, refundable: true, image: img("shinjuku-r2"),
      },
      {
        id: "family",
        name: { en: "Family Room", ja: "ファミリールーム" },
        description: { en: "34 m², 1 double + 2 singles", ja: "34㎡・ダブル1台＋シングル2台" },
        sizeSqm: 34, sleeps: 4, pricePerNight: 36000, breakfast: true, refundable: false, image: img("shinjuku-r3"),
      },
    ],
  },
  {
    id: "asakusa-machiya",
    station: { en: "Asakusa Station", ja: "浅草駅" }, lat: 35.7119, lng: 139.7967, address: "東京都台東区浅草2丁目",
    name: { en: "Asakusa Machiya Inn", ja: "浅草 町家の宿" },
    city: "tokyo",
    area: { en: "Asakusa, near Senso-ji", ja: "浅草・浅草寺近く" },
    type: "ryokan",
    rating: 4.7,
    reviewCount: 412,
    description: {
      en: "A restored wooden townhouse turned boutique inn. Six tatami rooms, a cedar bath, and a quiet garden courtyard in the middle of old Tokyo.",
      ja: "古い町家を改装したブティック旅館。和室6室、檜風呂、静かな中庭。下町情緒あふれる浅草に佇みます。",
    },
    access: { en: "Asakusa Station (Ginza Line), 6 min walk.", ja: "銀座線浅草駅より徒歩6分。" },
    amenities: ["wifi", "tatami", "bath", "breakfast", "luggage", "nonSmoking"],
    checkIn: "16:00",
    checkOut: "10:00",
    images: [img("asakusa-1"), img("asakusa-2"), img("asakusa-3")],
    rooms: [
      {
        id: "tatami-2",
        name: { en: "Tatami Room (2 guests)", ja: "和室（2名）" },
        description: { en: "8 tatami mats, futon bedding, garden view", ja: "8畳・布団・庭園ビュー" },
        sizeSqm: 13, sleeps: 2, pricePerNight: 21000, breakfast: true, refundable: true, image: img("asakusa-r1"),
      },
      {
        id: "tatami-4",
        name: { en: "Large Tatami Room (4 guests)", ja: "広間和室（4名）" },
        description: { en: "12 tatami mats, futon bedding", ja: "12畳・布団" },
        sizeSqm: 20, sleeps: 4, pricePerNight: 34000, breakfast: true, refundable: true, image: img("asakusa-r2"),
      },
    ],
  },
  {
    id: "gion-hanare",
    station: { en: "Gion-Shijo Station", ja: "祇園四条駅" }, lat: 35.0037, lng: 135.7752, address: "京都府京都市東山区祇園町南側",
    name: { en: "Gion Hanare Ryokan", ja: "祇園 はなれ旅館" },
    city: "kyoto",
    area: { en: "Gion, Higashiyama", ja: "祇園・東山" },
    type: "ryokan",
    rating: 4.9,
    reviewCount: 298,
    description: {
      en: "An intimate eight-room ryokan on a lantern-lit lane in Gion. Kaiseki dinner served in-room, private cypress baths, and staff who speak English and Japanese.",
      ja: "祇園の石畳の小路にたたずむ全8室の小さな旅館。お部屋で味わう会席料理、檜の貸切風呂。日本語・英語対応スタッフが常駐。",
    },
    access: { en: "Gion-Shijo Station (Keihan), 5 min walk.", ja: "京阪祇園四条駅より徒歩5分。" },
    amenities: ["wifi", "tatami", "bath", "breakfast", "restaurant", "luggage", "nonSmoking"],
    checkIn: "15:00",
    checkOut: "11:00",
    images: [img("gion-1"), img("gion-2"), img("gion-3")],
    rooms: [
      {
        id: "garden",
        name: { en: "Garden Room with Kaiseki Dinner", ja: "庭園の間 会席夕食付き" },
        description: { en: "10 tatami, private bath, dinner & breakfast", ja: "10畳・専用風呂・夕朝食付き" },
        sizeSqm: 16, sleeps: 2, pricePerNight: 58000, breakfast: true, refundable: true, image: img("gion-r1"),
      },
      {
        id: "suite",
        name: { en: "Hanare Suite", ja: "はなれスイート" },
        description: { en: "Detached suite, open-air bath, dinner & breakfast", ja: "離れ・露天風呂付き・夕朝食付き" },
        sleeps: 3, pricePerNight: 92000, breakfast: true, refundable: false, image: img("gion-r2"),
      },
    ],
  },
  {
    id: "kyoto-station-business",
    station: { en: "Kyoto Station", ja: "京都駅" }, lat: 34.9858, lng: 135.7588, address: "京都府京都市南区東九条",
    name: { en: "Kyoto Station Business Hotel", ja: "京都駅前ビジネスホテル" },
    city: "kyoto",
    area: { en: "Kyoto Station, 2 min walk", ja: "京都駅・徒歩2分" },
    type: "business",
    rating: 4.1,
    reviewCount: 2210,
    description: {
      en: "Clean, efficient rooms right by Kyoto Station. Ideal for day trips to Nara, Osaka and Arashiyama. Coin laundry and a 24-hour front desk.",
      ja: "京都駅すぐの清潔で機能的なホテル。奈良・大阪・嵐山への日帰り観光に最適。コインランドリー、24時間フロント。",
    },
    access: { en: "JR Kyoto Station Hachijo Exit, 2 min walk.", ja: "JR京都駅八条口より徒歩2分。" },
    amenities: ["wifi", "laundry", "luggage", "nonSmoking", "breakfast", "accessible"],
    checkIn: "15:00",
    checkOut: "10:00",
    images: [img("kyostn-1"), img("kyostn-2"), img("kyostn-3")],
    rooms: [
      {
        id: "single",
        name: { en: "Single", ja: "シングル" },
        description: { en: "13 m², 1 semi-double bed", ja: "13㎡・セミダブルベッド1台" },
        sizeSqm: 13, sleeps: 1, pricePerNight: 8900, breakfast: false, refundable: true, image: img("kyostn-r1"),
      },
      {
        id: "twin",
        name: { en: "Twin", ja: "ツイン" },
        description: { en: "19 m², 2 single beds", ja: "19㎡・シングルベッド2台" },
        sizeSqm: 19, sleeps: 2, pricePerNight: 13400, breakfast: false, refundable: true, image: img("kyostn-r2"),
      },
      {
        id: "twin-bf",
        name: { en: "Twin with Breakfast", ja: "ツイン 朝食付き" },
        description: { en: "19 m², 2 single beds, buffet breakfast", ja: "19㎡・シングルベッド2台・朝食ビュッフェ" },
        sizeSqm: 19, sleeps: 2, pricePerNight: 15800, breakfast: true, refundable: true, image: img("kyostn-r3"),
      },
    ],
  },
  {
    id: "namba-loft",
    station: { en: "Namba Station", ja: "なんば駅" }, lat: 34.6659, lng: 135.5010, address: "大阪府大阪市中央区難波",
    name: { en: "Namba Loft Hotel", ja: "なんばロフトホテル" },
    city: "osaka",
    area: { en: "Namba / Dotonbori", ja: "なんば・道頓堀" },
    type: "hotel",
    rating: 4.3,
    reviewCount: 967,
    description: {
      en: "A design hotel in the heart of Osaka's food district. Loft-style rooms with kitchenettes, a ground-floor coffee bar, and Dotonbori a two-minute stroll away.",
      ja: "大阪の食の中心地に位置するデザインホテル。キッチン付きロフトタイプの客室、1階のコーヒーバー。道頓堀まで徒歩2分。",
    },
    access: { en: "Namba Station (Midosuji Line), 3 min walk.", ja: "御堂筋線なんば駅より徒歩3分。" },
    amenities: ["wifi", "bar", "laundry", "luggage", "nonSmoking"],
    checkIn: "15:00",
    checkOut: "11:00",
    images: [img("namba-1"), img("namba-2"), img("namba-3")],
    rooms: [
      {
        id: "loft-double",
        name: { en: "Loft Double", ja: "ロフトダブル" },
        description: { en: "22 m², loft bed, kitchenette", ja: "22㎡・ロフトベッド・簡易キッチン" },
        sizeSqm: 22, sleeps: 2, pricePerNight: 14200, breakfast: false, refundable: true, image: img("namba-r1"),
      },
      {
        id: "loft-quad",
        name: { en: "Loft Quad", ja: "ロフトクアッド" },
        description: { en: "36 m², 2 doubles, kitchenette", ja: "36㎡・ダブル2台・簡易キッチン" },
        sizeSqm: 36, sleeps: 4, pricePerNight: 26800, breakfast: false, refundable: true, image: img("namba-r2"),
      },
    ],
  },
  {
    id: "hakone-yumoto-onsen",
    station: { en: "Hakone-Yumoto Station", ja: "箱根湯本駅" }, lat: 35.2323, lng: 139.1060, address: "神奈川県足柄下郡箱根町湯本",
    name: { en: "Hakone Yumoto Onsen Resort", ja: "箱根湯本 温泉リゾート" },
    city: "hakone",
    area: { en: "Hakone-Yumoto, riverside", ja: "箱根湯本・川沿い" },
    type: "ryokan",
    rating: 4.6,
    reviewCount: 743,
    description: {
      en: "Riverside onsen ryokan with indoor and open-air baths fed by Hakone's hot springs. Multi-course dinner featuring local produce. Free shuttle from Hakone-Yumoto Station.",
      ja: "箱根の源泉かけ流し。内湯と露天風呂を備えた川沿いの温泉旅館。地元食材を使った会席料理。箱根湯本駅から無料送迎あり。",
    },
    access: { en: "Hakone-Yumoto Station, free shuttle (5 min).", ja: "箱根湯本駅より無料送迎バス5分。" },
    amenities: ["wifi", "onsen", "bath", "tatami", "restaurant", "breakfast", "parking", "spa"],
    checkIn: "15:00",
    checkOut: "10:00",
    images: [img("hakone-1"), img("hakone-2"), img("hakone-3")],
    rooms: [
      {
        id: "japanese-2",
        name: { en: "Japanese Room, Dinner & Breakfast", ja: "和室 夕朝食付き" },
        description: { en: "10 tatami, river view, futon", ja: "10畳・リバービュー・布団" },
        sizeSqm: 16, sleeps: 2, pricePerNight: 42000, breakfast: true, refundable: true, image: img("hakone-r1"),
      },
      {
        id: "openair",
        name: { en: "Room with Private Open-Air Bath", ja: "露天風呂付き客室" },
        description: { en: "Japanese-Western room, private rotenburo, dinner & breakfast", ja: "和洋室・専用露天風呂・夕朝食付き" },
        sleeps: 3, pricePerNight: 68000, breakfast: true, refundable: false, image: img("hakone-r2"),
      },
    ],
  },
  {
    id: "hakata-canal-hotel",
    station: { en: "Nakasu-Kawabata Station", ja: "中洲川端駅" }, lat: 33.5931, lng: 130.4089, address: "福岡県福岡市博多区中洲",
    name: { en: "Hakata Canal Hotel", ja: "博多キャナルホテル" },
    city: "fukuoka",
    area: { en: "Nakasu / Canal City", ja: "中洲・キャナルシティ" },
    type: "hotel",
    rating: 4.2,
    reviewCount: 1530,
    description: {
      en: "Comfortable mid-range hotel next to Canal City, walking distance to the famous Nakasu yatai food stalls. Large public bath on the top floor.",
      ja: "キャナルシティ隣接の快適なミドルクラスホテル。中洲の屋台街まで徒歩圏内。最上階に大浴場。",
    },
    access: { en: "Nakasu-Kawabata Station, 4 min walk. Hakata Station, 12 min walk.", ja: "中洲川端駅より徒歩4分。博多駅より徒歩12分。" },
    amenities: ["wifi", "bath", "restaurant", "laundry", "luggage", "nonSmoking", "accessible"],
    checkIn: "15:00",
    checkOut: "11:00",
    images: [img("hakata-1"), img("hakata-2"), img("hakata-3")],
    rooms: [
      {
        id: "double",
        name: { en: "Double", ja: "ダブル" },
        description: { en: "16 m², 1 double bed", ja: "16㎡・ダブルベッド1台" },
        sizeSqm: 16, sleeps: 2, pricePerNight: 11500, breakfast: false, refundable: true, image: img("hakata-r1"),
      },
      {
        id: "twin-bf",
        name: { en: "Twin with Breakfast", ja: "ツイン 朝食付き" },
        description: { en: "21 m², 2 single beds, Japanese breakfast", ja: "21㎡・シングル2台・和朝食" },
        sizeSqm: 21, sleeps: 2, pricePerNight: 15900, breakfast: true, refundable: true, image: img("hakata-r2"),
      },
    ],
  },
  {
    id: "sapporo-snow-hostel",
    station: { en: "Susukino Station", ja: "すすきの駅" }, lat: 43.0553, lng: 141.3535, address: "北海道札幌市中央区南5条西",
    name: { en: "Sapporo Snow Hostel", ja: "札幌スノーホステル" },
    city: "sapporo",
    area: { en: "Susukino", ja: "すすきの" },
    type: "hostel",
    rating: 4.4,
    reviewCount: 388,
    description: {
      en: "Friendly hostel with private rooms and capsule-style dorms, five minutes from Susukino nightlife. Shared kitchen, ski storage, and a cozy lounge with a wood stove.",
      ja: "個室とカプセルドミトリーのあるアットホームなホステル。すすきのまで徒歩5分。共用キッチン、スキー置き場、薪ストーブのラウンジ。",
    },
    access: { en: "Susukino Station (Namboku Line), 5 min walk.", ja: "南北線すすきの駅より徒歩5分。" },
    amenities: ["wifi", "laundry", "luggage", "nonSmoking"],
    checkIn: "15:00",
    checkOut: "10:00",
    images: [img("sapporo-1"), img("sapporo-2"), img("sapporo-3")],
    rooms: [
      {
        id: "capsule",
        name: { en: "Capsule Bed (mixed dorm)", ja: "カプセルベッド（男女混合）" },
        description: { en: "1 capsule bed, shared bathroom", ja: "カプセルベッド1台・共用バスルーム" },
        sleeps: 1, pricePerNight: 4200, breakfast: false, refundable: true, image: img("sapporo-r1"),
      },
      {
        id: "private-twin",
        name: { en: "Private Twin", ja: "個室ツイン" },
        description: { en: "12 m², 2 single beds, shared bathroom", ja: "12㎡・シングル2台・共用バスルーム" },
        sizeSqm: 12, sleeps: 2, pricePerNight: 9800, breakfast: false, refundable: true, image: img("sapporo-r2"),
      },
    ],
  },
];

export const seedReviews: SeedReview[] = [
  { hotel: "shinjuku-granbell", author: "Emma R.", rating: 5, stayMonth: "2026-05", title: { en: "Perfect base for Tokyo", ja: "東京観光に最適" }, body: { en: "Four minutes from the station really is four minutes. Rooftop bar at sunset was the highlight.", ja: "駅から本当に4分。夕暮れのルーフトップバーが最高でした。" } },
  { hotel: "shinjuku-granbell", author: "健太", rating: 4, stayMonth: "2026-06", title: { en: "Compact but comfortable", ja: "コンパクトだけど快適" }, body: { en: "Small room, great shower, quiet despite the location.", ja: "部屋は狭いけどシャワーが良く、立地の割に静かでした。" } },
  { hotel: "asakusa-machiya", author: "Lucas M.", rating: 5, stayMonth: "2026-04", title: { en: "Like staying with family", ja: "家族の家のよう" }, body: { en: "The cedar bath and the courtyard garden made this unforgettable.", ja: "檜風呂と中庭が忘れられません。" } },
  { hotel: "gion-hanare", author: "Sophie L.", rating: 5, stayMonth: "2026-03", title: { en: "Worth every yen", ja: "価値ある滞在" }, body: { en: "Kaiseki dinner in the room was extraordinary. Staff spoke perfect English.", ja: "部屋での会席料理が素晴らしかった。スタッフの英語も完璧。" } },
  { hotel: "gion-hanare", author: "美咲", rating: 5, stayMonth: "2026-05", title: { en: "Quiet luxury", ja: "静かな贅沢" }, body: { en: "Lantern-lit lane, private bath, total calm.", ja: "灯籠の小路、貸切風呂、静寂そのもの。" } },
  { hotel: "kyoto-station-business", author: "Daniel K.", rating: 4, stayMonth: "2026-06", title: { en: "Clean and practical", ja: "清潔で実用的" }, body: { en: "Exactly what you need for day trips. Coin laundry was handy.", ja: "日帰り観光の拠点として十分。コインランドリーが便利。" } },
  { hotel: "kyoto-station-business", author: "陽菜", rating: 3, stayMonth: "2026-07", title: { en: "Thin walls", ja: "壁が薄い" }, body: { en: "Good value but you hear the neighbours.", ja: "コスパは良いが隣室の音が聞こえる。" } },
  { hotel: "namba-loft", author: "Chloe W.", rating: 4, stayMonth: "2026-05", title: { en: "Fun design, great location", ja: "楽しいデザイン、最高の立地" }, body: { en: "Kitchenette was useful, Dotonbori right there.", ja: "簡易キッチンが便利、道頓堀がすぐそこ。" } },
  { hotel: "hakone-yumoto-onsen", author: "Hiroshi T.", rating: 5, stayMonth: "2026-02", title: { en: "Onsen heaven", ja: "温泉天国" }, body: { en: "Open-air bath by the river in winter. Dinner was ten courses.", ja: "冬の川沿い露天風呂。夕食は10品のコース。" } },
  { hotel: "hakata-canal-hotel", author: "Olivia P.", rating: 4, stayMonth: "2026-06", title: { en: "Yatai every night", ja: "毎晩屋台" }, body: { en: "Rooftop bath after the food stalls was ideal.", ja: "屋台の後の最上階大浴場が最高。" } },
  { hotel: "sapporo-snow-hostel", author: "Tom B.", rating: 4, stayMonth: "2026-01", title: { en: "Cosy in the snow", ja: "雪の中の温もり" }, body: { en: "Wood stove lounge, friendly staff, ski storage worked well.", ja: "薪ストーブのラウンジ、親切なスタッフ、スキー置き場も便利。" } },
];
