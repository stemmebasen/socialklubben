/** The portal's themes, for the filter chips. An event gets the first theme whose words its title holds,
 * then its text; otherwise the organizer's default theme. Plain words, no AI: the same text always gives
 * the same theme, and the organizer's own calendar stays the truth. */

export type Topic = { slug: string; label: string; words: Array<string | RegExp> };

export const TOPICS: Topic[] = [
  { slug: "mental-sundhed", label: "Mental sundhed", words: ["stress", "angst", "depression", "sorg", "mental sundhed", "mentalt helbred", "trivsel", "ensomhed", "psykolog", "terapi", "udbrændt", "selvværd"] },
  { slug: "meditation", label: "Meditation & mindfulness", words: ["meditation", "mediter", "mindfulness", "stilhed", "nærvær", "retreat", "vipassana", "yoga nidra"] },
  { slug: "lyd", label: "Lyd & musik", words: ["lydbad", "lydhealing", "lydrejse", "gong", "kirtan", "mantra", "sangcirkel", "fællessang", "tromme", "sound bath", "sound healing", "klangskål", "syngeskål"] },
  { slug: "krop", label: "Krop & bevægelse", words: ["yoga", "qigong", "qi gong", "tai chi", /dans(?!k)/iu, "ecstatic", "5rhythms", "breathwork", "åndedræt", "bevægelse", "pilates", "kropsterapi", "somatic", "somatisk"] },
  { slug: "spiritualitet", label: "Spiritualitet & ceremoni", words: ["ceremoni", "kakao", "cacao", "fuldmåne", "nymåne", "shaman", "spirituel", /sjæl(?!d)/iu, "astrologi", "tarot", "healing", "reiki", "channeling", "ritual"] },
  { slug: "cirkler", label: "Cirkler & fællesskab", words: ["cirkel", "kvindecirkel", "mandecirkel", "samtalesalon", "fællesskab", "medlemscafé", "café", "sharing"] },
  { slug: "udvikling", label: "Selvudvikling & kurser", words: ["workshop", "kursus", "foredrag", "coaching", "selvudvikling", "uddannelse", "forløb", "personlig udvikling"] }
];

export const topicLabel = (slug: string) => TOPICS.find(t => t.slug === slug)?.label ?? "Andet";
export const isTopic = (slug: string) => TOPICS.some(t => t.slug === slug);

/** A word anywhere in the text - Danish compounds put it last as often as first ("morgenmeditation",
 * "lydhealing") - and a RegExp for the few that need care ("dans", not "dansk"; "sjæl", not "sjælden"). */
const has = (text: string, word: string | RegExp) => typeof word === "string" ? text.toLocaleLowerCase("da-DK").includes(word.toLocaleLowerCase("da-DK")) : word.test(text);

export function topicFor(title: string, description: string | null, fallback: string): string {
  for (const text of [title, description ?? ""]) {
    const found = TOPICS.find(topic => topic.words.some(word => has(text, word)));
    if (found) return found.slug;
  }
  return isTopic(fallback) ? fallback : TOPICS[TOPICS.length - 1]!.slug;
}

/** An organizer's own include/exclude words (comma separated), for calendars that hold more than the portal's themes. */
export function passesWords(text: string, include: string | null, exclude: string | null): boolean {
  const words = (list: string | null) => (list ?? "").split(",").map(w => w.trim()).filter(Boolean);
  if (words(exclude).some(w => has(text, w))) return false;
  const wanted = words(include);
  return !wanted.length || wanted.some(w => has(text, w));
}
