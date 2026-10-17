// What every page shares: saving events (kept only in this browser's own storage, never sent anywhere
// but in the address of the Gemt page), and "Nær mig" in Planlæg, which puts the position in the
// address without storing it.
(() => {
  const KEY = "gemt";
  const read = () => { try { return (JSON.parse(localStorage.getItem(KEY) || "[]") || []).filter(n => Number.isInteger(n) && n > 0); } catch { return []; } };
  const write = ids => { try { localStorage.setItem(KEY, JSON.stringify(ids.slice(-100))); } catch { /* private mode: nothing is kept */ } };

  const mark = root => {
    const saved = new Set(read());
    for (const button of (root || document).querySelectorAll("[data-save]")) {
      const on = saved.has(Number(button.dataset.save));
      button.setAttribute("aria-pressed", String(on));
      button.setAttribute("aria-label", on ? "Fjern fra gemte" : "Gem");
      const label = button.querySelector("span");
      if (label) label.textContent = on ? "Gemt" : "Gem";
      button.hidden = false;
    }
  };
  window.Saved = { mark };
  document.addEventListener("click", event => {
    const button = event.target.closest && event.target.closest("[data-save]");
    if (!button) return;
    event.preventDefault();
    const id = Number(button.dataset.save);
    const ids = read();
    write(ids.includes(id) ? ids.filter(n => n !== id) : [...ids, id]);
    mark(document);
  });
  mark(document);

  // Gemt: the saved events are asked for in the address; ones no longer coming are let go.
  const saved = document.getElementById("saved");
  if (saved) {
    const ids = read();
    if (!saved.dataset.asked && ids.length) location.replace(`/${saved.dataset.region}/gemt?ids=${ids.join(",")}`);
    else if (saved.dataset.asked) {
      const found = new Set((saved.dataset.found || "").split(",").filter(Boolean).map(Number));
      const asked = new Set((new URLSearchParams(location.search).get("ids") || "").split(",").map(Number));
      // Only events this page was asked about and did not find are let go - not ones saved since.
      write(ids.filter(id => found.has(id) || !asked.has(id)));
    }
  }

  // Planlæg's place and radius apply as soon as they are chosen; the button is for pages without script.
  for (const button of document.querySelectorAll("button[data-auto]")) {
    const form = button.form;
    button.hidden = true;
    for (const select of form.querySelectorAll("select")) select.addEventListener("change", () => {
      if (select.name === "by" && select.value !== "naer") for (const input of form.querySelectorAll("[data-near]")) input.value = "";
      form.submit();
    });
  }

  // As an app: the offline memory, and an install button where the browser offers one.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  const install = document.getElementById("install");
  if (install) addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    install.hidden = false;
    install.onclick = () => { event.prompt(); install.hidden = true; };
  });

  const near = document.getElementById("near-me");
  if (near && "geolocation" in navigator) {
    near.hidden = false;
    near.addEventListener("click", () => {
      const form = near.closest("form");
      near.disabled = true;
      near.textContent = "Finder dig …";
      navigator.geolocation.getCurrentPosition(position => {
        form.querySelector('[data-near="lat"]').value = position.coords.latitude.toFixed(3);
        form.querySelector('[data-near="lng"]').value = position.coords.longitude.toFixed(3);
        const by = form.querySelector('select[name="by"]');
        if (by && !by.querySelector('option[value="naer"]')) by.add(new Option("Nær mig", "naer"), 1);
        if (by) by.value = "naer";
        form.submit();
      }, () => { near.disabled = false; near.textContent = "Position ikke tilgængelig"; }, { timeout: 10000, maximumAge: 600000 });
    });
  }
})();
