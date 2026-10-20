import { haversineKm, tierFor, clueCost, afterClue, afterWrongGuess, failScore } from "./scoring.js";

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.forEach((k) => n.append(k));
  return n;
};

function easternDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
function asset(path) {
  return new URL(path, import.meta.url).href;
}
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

async function main() {
  const params = new URLSearchParams(location.search);
  const puzzleName = params.get("puzzle") || easternDate();
  const [cfg, cities] = await Promise.all([getJSON(asset("config.json")), getJSON(asset("data/cities.json"))]);
  let puzzle;
  try {
    puzzle = await getJSON(asset(`puzzles/${puzzleName}.json`));
  } catch {
    const note = puzzleName === easternDate() && puzzleName < "2026-10-21"
      ? `No puzzle for ${puzzleName} yet. The daily puzzle starts October 21, 2026, and this page loads it on its own.`
      : `No puzzle published for ${puzzleName}.`;
    $("app").textContent = note;
    return;
  }
  if (puzzle.dev_fixture) {
    $("banner").append(el("div", { className: "banner", textContent: "DEV FIXTURE: the clue text is fake and is not real weather." }));
  }
  $("attr").textContent = puzzle.attribution || "";

  const byId = Object.fromEntries(cities.map((c) => [c.id, c]));
  const answer = byId[puzzle.answer_id];
  if (!answer) { $("app").textContent = `Puzzle references unknown city ${puzzle.answer_id}.`; return; }

  const key = `wxg:${puzzleName}`;
  const s = store.get(key) || { revealed: 1, points: cfg.startPoints, guesses: [], done: false, score: null, won: false };
  const save = () => store.set(key, s);

  function addPick(id) {
    if (s.done || s.guesses.some((g) => g.id === id)) return;
    const c = byId[id];
    const km = haversineKm(c, answer);
    if (id === answer.id) {
      s.guesses.push({ id, ok: true });
      s.done = true; s.won = true; s.score = s.points;
    } else {
      const r = afterWrongGuess(s.points, km, cfg);
      s.points = r.points;
      s.guesses.push({ id, ok: false, tier: r.tier.name, km });
      if (s.guesses.length >= cfg.maxGuesses) giveUp();
    }
    save(); render();
  }
  function giveUp() {
    s.done = true; s.won = false;
    const best = s.guesses.length ? Math.min(...s.guesses.map((g) => g.km ?? Infinity)) : Infinity;
    s.score = Number.isFinite(best) ? failScore(best, cfg) : 0;
  }
  function reveal() {
    const next = s.revealed + 1;
    if (s.done || next > puzzle.clues.length) return;
    s.points = afterClue(s.points, next, cfg);
    s.revealed = next; save(); render();
  }

  function shareText() {
    const grid = "🟦".repeat(s.revealed) + s.guesses.map((g) => (g.ok ? "✅" : "🟥")).join("");
    const score = `${s.won ? s.score : "✗ " + s.score} pts`;
    return `Where in the Weather ${puzzleName}\n${score}\n${grid}\n\nTry your hand at it\nhttps://redcrowlabs.com/weather`;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return cities.filter((c) =>
      `${c.name}, ${c.state}`.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q))
    ).slice(0, 8);
  }

  function render() {
    const root = $("app");
    root.replaceChildren();
    root.append(el("div", { className: "score", textContent: `${s.done ? "Final" : "Now"}: ${s.points.toLocaleString()} pts` }));

    const list = el("ol");
    puzzle.clues.slice(0, s.revealed).forEach((c) =>
      list.append(el("li", { className: "clue" }, el("div", { className: "t", textContent: `Clue ${c.n} · ${c.title}` }), el("div", { textContent: c.text })))
    );
    root.append(list);

    s.guesses.filter((g) => !g.ok).forEach((g) =>
      root.append(el("div", { className: "wrong", textContent: `✗ ${byId[g.id].name}, ${byId[g.id].state}: ${g.tier}` }))
    );

    if (!s.done) {
      const row = el("div", { className: "row" });
      const input = el("input", { placeholder: "Type a city…", autocomplete: "off" });
      const opts = el("div", { id: "opts", hidden: true });
      input.addEventListener("input", () => {
        const hits = search(input.value);
        opts.replaceChildren(...hits.map((c) => {
          const alias = c.aliases.length ? ` (incl. ${c.aliases.join(", ")})` : "";
          const d = el("div", { textContent: `${c.name}, ${c.state}${alias}` });
          d.addEventListener("click", () => addPick(c.id));
          return d;
        }));
        opts.hidden = hits.length === 0;
      });
      row.append(input, opts);
      root.append(row);

      const nextN = s.revealed + 1;
      const more = nextN <= puzzle.clues.length;
      const rev = el("button", { textContent: more ? `Reveal next clue (−${clueCost(nextN, cfg)})` : "No more clues", disabled: !more });
      rev.addEventListener("click", reveal);
      const quit = el("button", { textContent: "Give up" });
      quit.addEventListener("click", () => { giveUp(); save(); render(); });
      root.append(el("div", { className: "row" }, rev, quit));
      root.append(el("div", { className: "sub", textContent: `Guesses left: ${cfg.maxGuesses - s.guesses.length}` }));
    } else {
      const res = el("div", { className: "result" });
      res.append(el("h2", { textContent: s.won ? `Correct: ${puzzle.answer_label}` : `It was ${puzzle.answer_label}` }));
      const wrong = s.guesses.filter((g) => !g.ok);
      wrong.forEach((g) => res.append(el("div", { className: "sub", textContent: `${byId[g.id].name}: ${Math.round(g.km).toLocaleString()} km away` })));
      res.append(el("div", { className: "sub", textContent: `Weather was from ${puzzle.weather_date}.` }));
      res.append(el("div", { className: "score", textContent: `Score: ${s.score.toLocaleString()}` }));
      const share = el("pre", { textContent: shareText() });
      const copy = el("button", { className: "primary", textContent: "Copy result" });
      copy.addEventListener("click", () => navigator.clipboard?.writeText(share.textContent));
      res.append(share, copy);
      root.append(res);
    }
  }
  render();
}

main().catch((e) => { $("app").textContent = `Failed to load: ${e.message}`; });
