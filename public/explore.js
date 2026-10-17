// Udforsk: the map with the sheet over it. The server has drawn the sheet for the address; this follows
// the map, so the bars, the day's count and the cards only count what is in view, and draws the day's
// events as pins - ink pins with the theme's glyph, gathered when they are close. Text from calendars is
// always set as text, never as HTML. "Vis hvor jeg er" moves the map; the position is not kept.
(() => {
  const source = document.getElementById("explore-data");
  const L = window.L;
  if (!source || !L) return;
  const data = JSON.parse(source.textContent || "{}");
  const deck = document.getElementById("deck");
  const cards = document.getElementById("cards");
  const header = document.querySelector("header.bar");
  const params = new URLSearchParams(location.search);
  const state = { day: data.chosen || 0, tema: params.get("tema") || "", slags: params.get("slags") || "alle", varighed: params.get("varighed") || "" };
  const phone = () => matchMedia("(max-width:720px)").matches;
  const svg = (name, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${data.icons[name] || ""}</svg>`;

  const map = L.map("map", { zoomControl: false, zoomSnap: 0.5 }).setView([data.region.lat, data.region.lng], 9);
  // On a phone the sheet covers the bottom, so the zoom buttons sit at the top, under the locate button.
  L.control.zoom({ position: phone() ? "topright" : "bottomright" }).addTo(map);
  L.tileLayer(data.tiles, { attribution: data.attribution, maxZoom: 18 }).addTo(map);
  const pins = L.layerGroup().addTo(map);

  // The part of the map not covered by the header or the sheet.
  const viewRect = () => {
    const size = map.getSize();
    const top = header ? header.getBoundingClientRect().bottom : 0;
    const bottom = phone() ? deck.getBoundingClientRect().top : size.y;
    return { top: Math.max(0, top), bottom: Math.max(top + 40, bottom), size };
  };
  const padding = () => {
    const r = viewRect();
    return { paddingTopLeft: [24, r.top + 24], paddingBottomRight: [24, r.size.y - r.bottom + 24] };
  };
  const placed = data.events.filter(e => e.la !== null && e.ln !== null);
  if (placed.length > 1) map.fitBounds(placed.map(e => [e.la, e.ln]), { ...padding(), maxZoom: 13 });
  else if (placed.length === 1) map.setView([placed[0].la, placed[0].ln], 13);

  const matches = e => (!state.tema || e.k === state.tema)
    && (state.slags === "alle" || (state.slags === "online" ? e.o === 1 : state.slags === "gratis" ? e.p === 0 : e.o === 0 && e.la !== null))
    && (!state.varighed || e.v === state.varighed);
  const inView = () => {
    const r = viewRect();
    const a = map.containerPointToLatLng([0, r.top]), b = map.containerPointToLatLng([r.size.x, r.bottom]);
    const bounds = L.latLngBounds(a, b);
    return e => e.la === null || bounds.contains([e.la, e.ln]);
  };

  const areaName = () => {
    const r = viewRect();
    const c = map.containerPointToLatLng([r.size.x / 2, (r.top + r.bottom) / 2]);
    if (map.getZoom() < 10) return data.region.name;
    let best = null, bestKm = 15;
    for (const t of data.towns) { const km = c.distanceTo([t.la, t.ln]) / 1000; if (km < bestKm) { best = t; bestKm = km; } }
    return best ? best.n : data.region.name;
  };

  function card(e) {
    const day = data.days[state.day];
    const article = document.createElement("article");
    article.className = "ev-card";
    article.dataset.t = e.k;
    article.dataset.id = e.id;
    const cover = document.createElement("div");
    cover.className = "cover" + (e.i ? " img" : "");
    if (e.i) cover.style.backgroundImage = `url(${JSON.stringify(e.i)})`;
    cover.innerHTML = svg(e.k, 40);
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = data.labels[e.k] || "";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "save";
    save.dataset.save = e.id;
    save.innerHTML = svg("gemt", 18);
    const body = document.createElement("div");
    body.className = "body";
    const h = document.createElement("h2");
    const a = document.createElement("a");
    a.href = e.u;
    a.textContent = e.t;
    h.append(a);
    const when = document.createElement("p");
    const w = document.createElement("span");
    w.className = "when";
    w.textContent = `${day.label} ${e.h}`;
    when.append(w);
    const where = document.createElement("p");
    where.textContent = e.w + (e.p === 0 ? " · Gratis" : e.p ? ` · ${(e.p / 100).toLocaleString("da-DK")} kr.` : "");
    body.append(h, when, where);
    article.append(cover, badge, save, body);
    return article;
  }

  function showCard(id) {
    const el = cards.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    for (const on of cards.querySelectorAll(".ev-card.on")) on.classList.remove("on");
    el.classList.add("on");
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  // Events at the same address are opened out in a ring, so each can be tapped.
  let opened = null;
  const pin = (topic, n, on) => L.divIcon({ className: "", iconSize: [44, 44], iconAnchor: [22, 53],
    html: `<div class="pin${on ? " on" : ""}" data-t="${topic}">${svg(topic, 22)}${n > 1 ? `<b>${n}</b>` : ""}</div>` });

  function drawPins(list) {
    pins.clearLayers();
    // Close pins are gathered: greedy, within 46 px on screen.
    const groups = [];
    for (const e of list) {
      const p = map.latLngToLayerPoint([e.la, e.ln]);
      const near = groups.find(g => g.p.distanceTo(p) < 46);
      if (near) near.events.push(e);
      else groups.push({ p, events: [e] });
    }
    for (const g of groups) {
      const n = g.events.length;
      const first = g.events[0];
      const key = g.events.map(e => e.id).join(",");
      if (n > 1 && opened === key) {
        const radius = 34 + 7 * n;
        g.events.forEach((e, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
          const at = map.layerPointToLatLng(g.p.add([Math.cos(angle) * radius, Math.sin(angle) * radius]));
          L.polyline([[first.la, first.ln], at], { color: "#1d2733", weight: 1.5, opacity: 0.5, interactive: false }).addTo(pins);
          L.marker(at, { icon: pin(e.k, 1, false), title: e.t, riseOnHover: true }).addTo(pins).on("click", () => showCard(e.id));
        });
        continue;
      }
      const count = {};
      for (const e of g.events) count[e.k] = (count[e.k] || 0) + 1;
      const topic = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
      const marker = L.marker([first.la, first.ln], { icon: pin(topic, n, false), title: n > 1 ? `${n} events` : first.t, riseOnHover: true }).addTo(pins);
      marker.on("click", () => {
        if (n === 1) return showCard(first.id);
        const spread = L.latLngBounds(g.events.map(e => [e.la, e.ln]));
        // Apart on the map: zoom in until they separate. At the same place: open them out.
        if (map.getZoom() < 17 && spread.getNorthEast().distanceTo(spread.getSouthWest()) > 25) map.flyToBounds(spread, { ...padding(), maxZoom: 17, duration: 0.6 });
        else { opened = key; render(); showCard(first.id); }
      });
    }
  }
  map.on("zoomstart", () => { opened = null; });
  map.on("click", () => { if (opened) { opened = null; render(); } });

  function render() {
    const shown = data.events.filter(matches);
    const visible = shown.filter(inView());
    const counts = data.days.map((_, i) => visible.filter(e => e.d.includes(i)).length);
    const max = Math.max(1, ...counts);
    for (const bar of document.querySelectorAll(".dbar")) {
      const i = Number(bar.dataset.day);
      bar.querySelector("i").style.setProperty("--h", `${Math.round(counts[i] / max * 100)}%`);
      bar.classList.toggle("on", i === state.day);
      bar.classList.toggle("zero", !counts[i]);
      bar.setAttribute("aria-label", `${data.days[i].label}: ${counts[i]} events`);
      if (i === state.day) bar.setAttribute("aria-current", "date"); else bar.removeAttribute("aria-current");
    }
    const today = visible.filter(e => e.d.includes(state.day));
    const text = document.getElementById("daytext");
    text.innerHTML = "<b></b> <span class=\"n\"></span>";
    text.querySelector("b").textContent = data.days[state.day].label;
    text.querySelector(".n").textContent = `· ${today.length} event${today.length === 1 ? "" : "s"}`;
    document.getElementById("area").textContent = areaName();
    cards.replaceChildren(...(today.length ? today.map(card) : [Object.assign(document.createElement("div"), { className: "empty-card", textContent: "Ingen events her den dag. Flyt kortet, eller vælg en anden dag." })]));
    if (window.Saved) window.Saved.mark(cards);
    drawPins(shown.filter(e => e.d.includes(state.day) && e.la !== null));
  }

  // The links still work as links; with the map here they change the view in place.
  const sync = () => {
    const p = new URLSearchParams();
    if (state.day) p.set("dag", data.days[state.day].key);
    if (state.tema) p.set("tema", state.tema);
    if (state.slags !== "alle") p.set("slags", state.slags);
    if (state.varighed) p.set("varighed", state.varighed);
    history.replaceState(null, "", location.pathname + (p.size ? `?${p}` : ""));
  };
  const mark = (selector, attr, value) => {
    for (const a of document.querySelectorAll(selector)) {
      const on = a.dataset[attr] === value;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    }
  };
  deck.addEventListener("click", event => {
    const a = event.target.closest && event.target.closest("a[data-day], a[data-tema], a[data-slags], a[data-varighed]");
    if (!a) return;
    event.preventDefault();
    if (a.dataset.day !== undefined) state.day = Number(a.dataset.day);
    if (a.dataset.tema !== undefined) { state.tema = a.dataset.tema; mark(".sheet .chips a", "tema", state.tema); a.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    if (a.dataset.slags !== undefined) { state.slags = a.dataset.slags; mark(".seg a", "slags", state.slags); }
    if (a.dataset.varighed !== undefined) {
      state.varighed = a.dataset.varighed;
      mark(".dur div a", "varighed", state.varighed);
      const dur = a.closest("details");
      dur.open = false;
      dur.querySelector("summary").textContent = `${state.varighed ? a.textContent : "Hvor længe?"} ›`;
    }
    sync();
    render();
  });
  // On a phone the sheet covers the bottom of the map: the attribution sits just above it.
  const lift = () => { const bottom = document.querySelector(".leaflet-bottom.leaflet-right"); if (bottom) bottom.style.bottom = phone() ? `${Math.max(0, innerHeight - deck.getBoundingClientRect().top)}px` : ""; };
  addEventListener("resize", lift);
  lift();
  let pending = 0;
  map.on("moveend", () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(render); });
  render();

  const locate = document.getElementById("locate");
  if (locate && "geolocation" in navigator) {
    locate.hidden = false;
    let dot = null;
    locate.addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition(position => {
        const at = [position.coords.latitude, position.coords.longitude];
        if (dot) dot.remove();
        dot = L.circleMarker(at, { radius: 8, color: "#fff", weight: 3, fillColor: "#2446d8", fillOpacity: 1 }).addTo(map);
        map.setView(at, 13);
      }, () => { locate.disabled = true; }, { timeout: 10000, maximumAge: 600000 });
    });
  }
})();
