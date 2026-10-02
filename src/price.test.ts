import { describe, expect, it } from "vitest";
import { extractPriceMinor, formatKrMinor } from "./price.js";

describe("prices", () => {
  it("writes prices the Danish way", () => {
    expect(formatKrMinor(25_000)).toBe("250 kr.");
    expect(formatKrMinor(125_000)).toBe("1.250 kr.");
    expect(formatKrMinor(29_970)).toBe("299,70 kr.");
  });
});

describe("the price from an event's text", () => {
  it("reads a price stated plainly next to a label and a currency", () => {
    expect(extractPriceMinor("Pris: 250 kr.")).toBe(25_000);
    expect(extractPriceMinor("Kom og vær med.\nPris 250,-\nTilmelding via linket.")).toBe(25_000);
    expect(extractPriceMinor("Billetpris: kr. 1.250")).toBe(125_000);
    expect(extractPriceMinor("Entré: 299,50 kr")).toBe(29_950);
    expect(extractPriceMinor("Prisen er 180 kroner pr. gang")).toBe(18_000);
    expect(extractPriceMinor("Pris pr. person: 450 DKK")).toBe(45_000);
    expect(extractPriceMinor("Pris: 250 kr. / 150 kr. for studerende")).toBe(25_000);
  });

  it("reads free events", () => {
    expect(extractPriceMinor("Gratis entré - alle er velkomne")).toBe(0);
    expect(extractPriceMinor("Pris: Gratis")).toBe(0);
  });

  it("gives up rather than guess", () => {
    expect(extractPriceMinor(null)).toBeNull();
    expect(extractPriceMinor("Tag 250 kr. med til te")).toBeNull();
    expect(extractPriceMinor("Pris for medlemmer: 200 kr.")).toBeNull();
    expect(extractPriceMinor("Pris: 250")).toBeNull();
    expect(extractPriceMinor("Billetter købes i døren")).toBeNull();
    expect(extractPriceMinor("Overraskelsespris 100 kr.")).toBeNull();
  });
});
