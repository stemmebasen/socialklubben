/** Where things are: the regions the portal covers (first Østjylland), their towns, and distances. */

export type Town = { slug: string; name: string; lat: number; lng: number };
/** start: what the map opens on, before the visitor moves it - the region's main city. */
export type Region = { slug: string; name: string; lat: number; lng: number; radiusKm: number; towns: Town[]; start: { south: number; west: number; north: number; east: number } };

export const REGIONS: Region[] = [{
  slug: "ostjylland", name: "Østjylland", lat: 56.12, lng: 10.08, radiusKm: 80,
  // Udforsk opens on Aarhus; zooming out shows the rest of Østjylland.
  start: { south: 56.125, west: 10.145, north: 56.19, east: 10.255 },
  towns: [
    { slug: "aarhus", name: "Aarhus", lat: 56.1567, lng: 10.2108 },
    { slug: "randers", name: "Randers", lat: 56.4607, lng: 10.0364 },
    { slug: "silkeborg", name: "Silkeborg", lat: 56.1697, lng: 9.5451 },
    { slug: "skanderborg", name: "Skanderborg", lat: 56.0337, lng: 9.931 },
    { slug: "horsens", name: "Horsens", lat: 55.8607, lng: 9.8503 },
    { slug: "odder", name: "Odder", lat: 55.9733, lng: 10.1529 },
    { slug: "ry", name: "Ry", lat: 56.089, lng: 9.7643 },
    { slug: "hammel", name: "Hammel", lat: 56.2563, lng: 9.863 },
    { slug: "grenaa", name: "Grenaa", lat: 56.4158, lng: 10.8783 },
    { slug: "ebeltoft", name: "Ebeltoft", lat: 56.1944, lng: 10.6821 },
    { slug: "samsoe", name: "Samsø", lat: 55.8706, lng: 10.6083 },
    { slug: "vejle", name: "Vejle", lat: 55.7093, lng: 9.5357 }
  ]
}];

export const region = (slug: string) => REGIONS.find(r => r.slug === slug) ?? null;
export const RADII = [5, 10, 25, 50] as const;

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const formatKm = (km: number) => km < 1 ? "under 1 km" : `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
