import { describe, expect, it } from "vitest";
import { passesWords, topicFor } from "./topics.js";

describe("themes", () => {
  it("takes the category from the title first, then the text, then the organizer's default", () => {
    expect(topicFor("Jazz på havnen", null, "faellesskab")).toBe("musik");
    expect(topicFor("Torsdagsaften", "Kom og hør Aarhus Symfoniorkester", "faellesskab")).toBe("musik");
    expect(topicFor("Søndagsmøde", "Kom som du er", "foredrag")).toBe("foredrag");
    expect(topicFor("Søndagsmøde", null, "ukendt")).toBe("faellesskab");
  });

  it("covers a broad cut of the city's cultural life", () => {
    const cases: Array<[string, string]> = [
      ["Julemarked i Den Gamle By", "marked"], ["Loppemarked på Godsbanen", "marked"], ["Filmklub: Festen", "film"], ["Forfattermøde med Olga Ravn", "litteratur"],
      ["Fernisering: Nye malerier", "kunst"], ["Stand-up i Fatter Eskil", "scene"], ["Premiere på Aarhus Teater", "scene"], ["Koncert med Kim Larsen-band", "musik"],
      ["Fredagsbar med DJ", "natteliv"], ["Vinsmagning", "mad"], ["Foredrag om stress og søvn", "foredrag"], ["Motionsløb rundt om søen", "sport"],
      ["Yin yoga", "krop-sind"], ["Lydbad med gongs", "krop-sind"], ["Kakaoceremoni", "krop-sind"], ["Fællesspisning i Folkehuset", "faellesskab"],
      ["Brætspilsaften", "faellesskab"], ["Keramikworkshop", "workshops"]];
    for (const [title, slug] of cases) expect([title, topicFor(title, null, "faellesskab")]).toEqual([title, slug]);
  });

  it("matches short words only when they stand alone", () => {
    expect(topicFor("Barnedåb", null, "faellesskab")).toBe("faellesskab");
    expect(topicFor("Kampagne for parken", null, "faellesskab")).toBe("faellesskab");
    expect(topicFor("Forløb for nybegyndere", null, "faellesskab")).toBe("faellesskab");
    expect(topicFor("Øl og ost", null, "faellesskab")).toBe("mad");
    expect(topicFor("Festival-fest i parken", null, "faellesskab")).toBe("natteliv");
  });

  it("follows an organizer's own include and exclude words", () => {
    expect(passesWords("Yoga for begyndere", null, null)).toBe(true);
    expect(passesWords("Generalforsamling", null, "generalforsamling, bestyrelse")).toBe(false);
    expect(passesWords("Koncert med kor", "meditation, yoga", null)).toBe(false);
    expect(passesWords("Morgenmeditation", "meditation, yoga", null)).toBe(true);
  });
});
