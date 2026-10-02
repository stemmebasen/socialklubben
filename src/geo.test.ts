import { describe, expect, it } from "vitest";
import { distanceKm, formatKm, region } from "./geo.js";
import { addressFor, addressKey, isOnline } from "./geocode.js";

describe("places and distances", () => {
  it("measures distances between towns", () => {
    const ost = region("ostjylland")!;
    const town = (slug: string) => ost.towns.find(t => t.slug === slug)!;
    expect(Math.round(distanceKm(town("aarhus"), town("randers")))).toBe(35);
    expect(Math.round(distanceKm(town("aarhus"), town("silkeborg")))).toBe(41);
    expect(distanceKm(town("aarhus"), town("aarhus"))).toBe(0);
    for (const t of ost.towns) expect(distanceKm(ost, t)).toBeLessThan(ost.radiusKm);
    expect(formatKm(0.4)).toBe("under 1 km");
    expect(formatKm(4.25)).toBe("4,3 km");
    expect(formatKm(37.6)).toBe("38 km");
  });

  it("uses an event's own address when it reads like one, else the organizer's house", () => {
    expect(addressFor("Yogahuset, Vestergade 10, 8000 Aarhus C", "Guldsmedgade 26B, 8000 Aarhus C")).toBe("Yogahuset, Vestergade 10, 8000 Aarhus C");
    expect(addressFor("Hjerterum", "Guldsmedgade 26B, 8000 Aarhus C")).toBe("Guldsmedgade 26B, 8000 Aarhus C");
    expect(addressFor("Mols Bjerge", null)).toBe("Mols Bjerge");
    expect(addressFor(null, null)).toBeNull();
    expect(addressKey(" Guldsmedgade 26B,  8000 Aarhus C ")).toBe(addressKey("guldsmedgade 26b 8000 aarhus c"));
    expect(isOnline("Online via Zoom")).toBe(true);
    expect(isOnline("Zoom-link sendes")).toBe(true);
    expect(isOnline("Onlinestudiet, Vestergade 1")).toBe(false);
  });
});
