import { drawResultCard, shareResult } from "./sharecard.js?v=share2";
import { haversineKm, tierFor, clueCost, afterClue, afterWrongGuess, failScore } from "./scoring.js";
import { easternDate, longDate, puzzleNumber, playStreak } from "./edition.js";

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.forEach((k) => n.append(k));
  return n;
};

function clueMeter(shown, total, noun) {
  const label = `${noun} ${shown} of ${total}`;
  const track = el("div", { className: "meter-track" });
  for (let i = 1; i <= total; i++) {
    const cls = i < shown ? "meter-seg on" : i === shown ? "meter-seg now" : "meter-seg";
    track.append(el("span", { className: cls }));
  }
  return el("div", {
    className: "meter",
    role: "meter",
    ariaValueNow: String(shown),
    ariaValueMin: "1",
    ariaValueMax: String(total),
    ariaLabel: label,
  }, el("div", { className: "meter-label", textContent: label }), track);
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
  const archiveLink = $("archive-link");
  if (archiveLink) archiveLink.href = new URL("archive", import.meta.url).href;
  const [cfg, cities, catalog] = await Promise.all([
    getJSON(asset("config.json")),
    getJSON(asset("data/cities.json")),
    getJSON(asset("puzzles/index.json")).catch(() => ({ epoch: "2026-10-20" })),
  ]);
  let puzzle;
  try {
    puzzle = await getJSON(asset(`puzzles/${puzzleName}.json`));
  } catch {
    $("app").textContent = `No puzzle published for ${puzzleName}.`;
    return;
  }
  if (puzzle.dev_fixture) {
    $("banner").append(el("div", { className: "banner", textContent: "DEV FIXTURE: the clue text is fake and is not real weather." }));
  }
  $("attr").textContent = puzzle.attribution || "";

  const byId = Object.fromEntries(cities.map((c) => [c.id, c]));
  const answer = byId[puzzle.answer_id];
  if (!answer) { $("app").textContent = `Puzzle references unknown city ${puzzle.answer_id}.`; return; }

  const editionDate = puzzle.date || puzzleName;
  const number = /^\d{4}-\d{2}-\d{2}$/.test(editionDate) ? puzzleNumber(editionDate, catalog.epoch) : null;
  function showEdition() {
    if (!number) return;
    const streak = playStreak(easternDate(), (d) => store.get(`wxg:${d}`));
    $("edition").textContent = `No. ${number}  ·  ${longDate(editionDate)}  ·  Streak ${streak}`;
    document.title = `Where in the Weather #${number}`;
  }
  showEdition();

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
    const streak = playStreak(easternDate(), (d) => store.get(`wxg:${d}`));
    const title = number ? `Where in the Weather #${number}` : `Where in the Weather ${puzzleName}`;
    return `${title}\n${score}\nStreak ${streak}\n${grid}\n🟦 clue   🟥 miss   ✅ solved\n\nTry your hand at it\nhttps://redcrowlabs.com/weather`;
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
    const shown = s.done ? s.score : s.points;
    root.append(el("div", { className: "score" },
      el("span", { className: "score-k", textContent: s.done ? "Final" : "Now" }),
      el("span", { className: "score-n", textContent: shown.toLocaleString() }),
      el("span", { className: "score-u", textContent: "pts" }),
    ));

    const list = el("ol", { className: "obs-log" });
    puzzle.clues.slice(0, s.revealed).forEach((c) =>
      list.append(el("li", { className: "clue" },
        el("div", { className: "t" },
          el("span", { className: "obs", textContent: String(c.n).padStart(2, "0") }),
          el("span", { textContent: c.title }),
        ),
        el("div", { className: "obs-text", textContent: c.text }),
      ))
    );
    root.append(list);
    showEdition();

    s.guesses.filter((g) => !g.ok).forEach((g) =>
      root.append(el("div", { className: "wrong", textContent: `✗ ${byId[g.id].name}, ${byId[g.id].state}: ${g.tier}` }))
    );

    if (!s.done) {
      const row = el("div", { className: "row" });
      const input = el("input", { placeholder: "Name the city…", autocomplete: "off", ariaLabel: "City" });
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
      const rev = el("button", { className: "go", textContent: more ? `Reveal next clue (−${clueCost(nextN, cfg)})` : "No more clues", disabled: !more });
      rev.addEventListener("click", reveal);
      const quit = el("button", { textContent: "Give up" });
      quit.addEventListener("click", () => { giveUp(); save(); render(); });
      root.append(clueMeter(s.revealed, puzzle.clues.length, "Clue"));
      root.append(el("div", { className: "row" }, rev, quit));
      root.append(el("div", { className: "remain", textContent: `Guesses left  ${cfg.maxGuesses - s.guesses.length}` }));
    } else {
      const res = el("div", { className: "result" });
      res.append(clueMeter(s.revealed, puzzle.clues.length, "Clue"));
      res.append(el("h2", { textContent: s.won ? `Correct: ${puzzle.answer_label}` : `It was ${puzzle.answer_label}` }));
      const wrong = s.guesses.filter((g) => !g.ok);
      wrong.forEach((g) => res.append(el("div", { className: "note", textContent: `${byId[g.id].name}: ${Math.round(g.km).toLocaleString()} km away` })));
      res.append(el("div", { className: "note", textContent: `Weather was from ${puzzle.weather_date}.` }));
      res.append(el("div", { className: "score" },
        el("span", { className: "score-k", textContent: "Score" }),
        el("span", { className: "score-n", textContent: s.score.toLocaleString() }),
        el("span", { className: "score-u", textContent: "pts" }),
      ));
      const preview = el("img", { className: "share-card", alt: "Result card" });
      const shareBtn = el("button", { className: "primary", textContent: "Share", disabled: true });
      const squares = [
        ...Array(s.revealed).fill("clue"),
        ...s.guesses.map((g) => (g.ok ? "solved" : "miss")),
      ];
      drawResultCard({
        kicker: "Where in the Weather",
        number: number || puzzleName,
        status: s.won ? "Solved" : "Missed",
        scoreLine: `${s.score.toLocaleString()} pts`,
        squares,
        streak: playStreak(easternDate(), (d) => store.get(`wxg:${d}`)),
        footer: "redcrowlabs.com/weather",
      }).then((card) => {
        preview.src = card.url;
        shareBtn.disabled = false;
        shareBtn.addEventListener("click", async () => {
          const result = await shareResult({
            text: shareText(),
            blob: card.blob,
            filename: `where-in-the-weather-${number || puzzleName}.png`,
          });
          if (result === "cancelled") return;
          shareBtn.textContent = result === "shared" || result === "copied" ? "Shared" : "Saved";
        });
      });
      res.append(preview, shareBtn);
      root.append(res);
    }
  }
  render();
}

main().catch((e) => { $("app").textContent = `Failed to load: ${e.message}`; });
