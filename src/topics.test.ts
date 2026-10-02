import { describe, expect, it } from "vitest";
import { passesWords, topicFor } from "./topics.js";

describe("themes", () => {
  it("takes the theme from the title first, then the text, then the organizer's default", () => {
    expect(topicFor("Yin yoga workshop", null, "cirkler")).toBe("krop");
    expect(topicFor("Lydbad med gongs", "Kom og vær med", "krop")).toBe("lyd");
    expect(topicFor("Søndagsmøde", "En aften med meditation og te", "cirkler")).toBe("meditation");
    expect(topicFor("Søndagsmøde", "Kom som du er", "cirkler")).toBe("cirkler");
    expect(topicFor("Søndagsmøde", null, "ukendt")).toBe("udvikling");
  });

  it("finds words inside Danish compounds, without taking 'dansk' for dance or 'sjælden' for soul", () => {
    expect(topicFor("Kakaoceremoni ved fuldmåne", null, "udvikling")).toBe("spiritualitet");
    expect(topicFor("Ecstatic dance", null, "udvikling")).toBe("krop");
    expect(topicFor("Danseworkshop", null, "udvikling")).toBe("krop");
    expect(topicFor("Fortælling på dansk", null, "cirkler")).toBe("cirkler");
    expect(topicFor("En sjælden aften", null, "cirkler")).toBe("cirkler");
    expect(topicFor("Morgenmeditation i parken", null, "udvikling")).toBe("meditation");
    expect(topicFor("Lydhealing", null, "udvikling")).toBe("lyd");
    expect(topicFor("Stressfri hverdag", null, "udvikling")).toBe("mental-sundhed");
  });

  it("follows an organizer's own include and exclude words", () => {
    expect(passesWords("Yoga for begyndere", null, null)).toBe(true);
    expect(passesWords("Generalforsamling", null, "generalforsamling, bestyrelse")).toBe(false);
    expect(passesWords("Koncert med kor", "meditation, yoga", null)).toBe(false);
    expect(passesWords("Morgenmeditation", "meditation, yoga", null)).toBe(true);
  });
});
