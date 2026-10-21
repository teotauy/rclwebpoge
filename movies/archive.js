import { easternDate, longDate, puzzleNumber } from "./edition.js";

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.forEach((k) => n.append(k));
  return n;
};

function asset(path) {
  return new URL(path, import.meta.url).href;
}
function gameHref(date) {
  const root = new URL("./", import.meta.url);
  return new URL(date ? `?puzzle=${date}` : "./", root).href;
}
function saved(date) {
  try { return JSON.parse(localStorage.getItem(`pic:${date}`)); } catch { return null; }
}
function statusLabel(state) {
  if (!state || (!state.done && !(state.guesses?.length || state.revealed > 1))) return "Play";
  if (!state.done) return "In progress";
  const pts = Number(state.score).toLocaleString();
  return state.won ? `${pts} pts` : `✗ ${pts} pts`;
}

async function main() {
  for (const id of ["today-link", "today-link-2"]) $(id).href = gameHref();
  const catalog = await fetch(asset("puzzles/index.json")).then((r) => {
    if (!r.ok) throw new Error(`puzzles/index.json: HTTP ${r.status}`);
    return r.json();
  });
  const today = easternDate();
  const dates = (catalog.dates || []).filter((d) => d <= today).sort().reverse();
  const list = $("list");
  list.replaceChildren();
  if (!dates.length) {
    list.append(el("li", { textContent: `The first feature is ${longDate(catalog.epoch)}.` }));
    return;
  }
  for (const date of dates) {
    const href = gameHref(date);
    list.append(el("li", { className: "entry" },
      el("a", { href, className: "num", textContent: `#${puzzleNumber(date, catalog.epoch)}` }),
      el("a", { href, className: "when", textContent: date === today ? `${longDate(date)} · Today` : longDate(date) }),
      el("a", { href, className: "stat", textContent: statusLabel(saved(date)) }),
    ));
  }
}

main().catch((e) => { $("list").textContent = `Failed to load: ${e.message}`; });
