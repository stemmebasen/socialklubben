// The small map on an event's page: the place, with a popup. Text from calendars is set as text, never
// as HTML.
(() => {
  const data = document.getElementById("map-data");
  const el = document.getElementById("map");
  const L = window.L;
  if (!data || !el || !L) return;
  const map_ = JSON.parse(data.textContent || "{}");
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2446d8";
  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView([map_.center.lat, map_.center.lng], map_.zoom || 9);
  L.tileLayer(map_.tiles, { attribution: map_.attribution, maxZoom: 18 }).addTo(map);
  if (map_.radiusKm) {
    const circle = L.circle([map_.center.lat, map_.center.lng], { radius: map_.radiusKm * 1000, color: accent, weight: 1.5, fillColor: accent, fillOpacity: 0.06 }).addTo(map);
    map.fitBounds(circle.getBounds(), { padding: [16, 16] });
  }
  const bounds = [];
  for (const point of map_.points || []) {
    const marker = L.circleMarker([point.lat, point.lng], { radius: 8 + Math.min(6, point.events.length - 1), color: "#fff", weight: 2, fillColor: accent, fillOpacity: 0.95 }).addTo(map);
    const box = document.createElement("div");
    for (const event of point.events.slice(0, 6)) {
      const p = document.createElement("p");
      const title = document.createElement(event.u ? "a" : "b");
      if (event.u) title.href = event.u;
      title.textContent = event.t;
      const when = document.createElement("div");
      when.textContent = event.w;
      when.style.color = "var(--muted, #5a6675)";
      p.append(title, when);
      box.append(p);
    }
    if (point.events.length > 6) {
      const more = document.createElement("p");
      more.textContent = `+ ${point.events.length - 6} mere her`;
      box.append(more);
    }
    marker.bindPopup(box, { maxWidth: 260 });
    bounds.push([point.lat, point.lng]);
  }
  if (map_.fit && bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
  else if (map_.fit && bounds.length === 1) map.setView(bounds[0], 13);
})();
