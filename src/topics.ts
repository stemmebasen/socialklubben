/** Socialklubben's categories: a broad cut of the cultural life in Østjylland. An event gets the first
 * category whose words its title holds, then its text; otherwise the organizer's default. Plain words, no
 * AI: the same text always gives the same category, and the organizer's own calendar stays the truth.
 * Short words that hide inside longer ones ("bar" in "barn", "kamp" in "kampagne") are matched as whole
 * words. */

export type Topic = { slug: string; label: string; words: Array<string | RegExp> };

const whole = (...words: string[]) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join("|")})(?![\\p{L}\\p{N}])`, "iu");

/** The order they are matched in: the most telling words first ("filmklub" is film, "foredrag om stress" is a talk). */
export const TOPICS: Topic[] = [
  { slug: "marked", label: "Marked & loppemarked", words: ["loppemarked", "kræmmermarked", "julemarked", "designmarked", "bagagerumsmarked", "byttemarked", "swap", "genbrugsmarked", whole("marked")] },
  { slug: "film", label: "Film", words: ["filmvisning", "filmklub", "biograf", "dokumentarfilm", "kortfilm", "filmfestival", "cinema", whole("film", "filmen", "films")] },
  { slug: "litteratur", label: "Litteratur", words: ["forfatter", "oplæsning", "litteratur", "poesi", "digte", "læsekreds", "bogreception", "bogudgivelse", "bogklub", "lyrik", whole("bog", "bøger")] },
  { slug: "kunst", label: "Kunst & udstillinger", words: ["udstilling", "fernisering", "vernissage", "galleri", "kunstmuseum", "kunsthal", "maleri", "skulptur", "kunstner", "kunstværk", whole("kunst", "museum")] },
  { slug: "scene", label: "Scene: teater, dans & comedy", words: ["teater", "forestilling", "stand-up", "standup", "comedy", "revy", "musical", "opera", "ballet", "danseforestilling", "improteater", "cirkus", "monolog"] },
  { slug: "musik", label: "Musik & koncerter", words: ["koncert", "livemusik", "live musik", "jazz", "blues", "symfoni", "orkester", "kammermusik", "korkoncert", "sangskriver", "singer-songwriter", "releasekoncert", "spillested", whole("band", "rock", "kor", "live", "folk")] },
  { slug: "natteliv", label: "Fest & natteliv", words: ["natklub", "dansefest", "party", "rave", "techno", "karaoke", "afterwork", "fredagsbar", whole("dj", "fest", "bar", "klubaften")] },
  { slug: "mad", label: "Mad & drikke", words: ["smagning", "vinsmagning", "ølsmagning", "madmarked", "street food", "streetfood", "brunch", "middag", "madlavning", "kokkeskole", "madfestival", "food", whole("vin", "øl")] },
  { slug: "foredrag", label: "Foredrag & debat", words: ["foredrag", "debat", "paneldebat", "oplæg", "forelæsning", "seminar", "konference", "talk", "fortælleaften"] },
  { slug: "sport", label: "Sport & friluft", words: ["motionsløb", "løbetur", "løbeklub", "cykeltur", "cykling", "vandretur", "vandring", "gåtur", "svømning", "vinterbad", "kajak", "klatring", "fodbold", "håndbold", "turnering", "naturvandring", "fugletur", "svampetur", "friluft", "naturen", "bootcamp", whole("løb", "kamp", "sport")] },
  { slug: "krop-sind", label: "Krop & sind", words: ["yoga", "meditation", "mediter", "mindfulness", "breathwork", "åndedræt", "qigong", "qi gong", "tai chi", "pilates", "ecstatic", "5rhythms", "lydbad", "gong", "kirtan", "mantra", "healing", "reiki", "kakao", "cacao", "ceremoni", "retreat", "stress", "angst", "sorg", "trivsel", "terapi", "psykolog", "selvværd", "nærvær", "tarot", "astrologi", "spirituel"] },
  { slug: "faellesskab", label: "Fællesskab", words: ["fællesspisning", "brætspil", "spilaften", "quiz", "fællessang", "sangaften", "kvindecirkel", "mandecirkel", "samtalesalon", "fællesskab", "netværk", "meetup", "frivillig", "medlemscafé", "cirkel", "cafe", "café", "ensomhed"] },
  { slug: "workshops", label: "Kreative workshops", words: ["workshop", "værksted", "keramik", "drejning", "tegning", "akvarel", "maling", "strik", "syning", "hækling", "håndværk", "kreativ", "diy", "kursus", "kalligrafi"] }
];

/** The order the categories are shown in. (TOPICS' own order is the order they are matched in.) */
export const SHOWN_TOPICS = ["musik", "scene", "film", "kunst", "foredrag", "litteratur", "mad", "krop-sind", "sport", "workshops", "faellesskab", "marked", "natteliv"].map(slug => TOPICS.find(t => t.slug === slug)!);

export const topicLabel = (slug: string) => TOPICS.find(t => t.slug === slug)?.label ?? "Andet";
export const isTopic = (slug: string) => TOPICS.some(t => t.slug === slug);

/** A word anywhere in the text - Danish compounds put it last as often as first ("morgenmeditation",
 * "julemarked") - and a RegExp for the short ones that must stand alone. */
const has = (text: string, word: string | RegExp) => typeof word === "string" ? text.toLocaleLowerCase("da-DK").includes(word.toLocaleLowerCase("da-DK")) : word.test(text);

export function topicFor(title: string, description: string | null, fallback: string): string {
  for (const text of [title, description ?? ""]) {
    const found = TOPICS.find(topic => topic.words.some(word => has(text, word)));
    if (found) return found.slug;
  }
  return isTopic(fallback) ? fallback : "faellesskab";
}

/** An organizer's own include/exclude words (comma separated), for calendars that hold more than the portal's themes. */
export function passesWords(text: string, include: string | null, exclude: string | null): boolean {
  const words = (list: string | null) => (list ?? "").split(",").map(w => w.trim()).filter(Boolean);
  if (words(exclude).some(w => has(text, w))) return false;
  const wanted = words(include);
  return !wanted.length || wanted.some(w => has(text, w));
}
