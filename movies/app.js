import { drawResultCard, shareResult } from "./sharecard.js?v=share2";
import { easternDate, longDate, puzzleNumber } from "./edition.js";
import { afterClue, afterWrongGuess, clueCost, failScore } from "./scoring.js";

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
  const [cfg, films, catalog] = await Promise.all([
    getJSON(asset("config.json")),
    getJSON(asset("data/films.json")),
    getJSON(asset("puzzles/index.json")).catch(() => ({ epoch: "2026-10-20" })),
  ]);
  let puzzle;
  try {
    puzzle = await getJSON(asset(`puzzles/${puzzleName}.json`));
  } catch {
    $("app").textContent = `No feature published for ${puzzleName}.`;
    return;
  }
  $("attr").textContent = puzzle.attribution || "";

  const byId = Object.fromEntries(films.map((f) => [f.id, f]));
  const answer = byId[puzzle.answer_id];
  if (!answer) { $("app").textContent = `This feature is not in the booking book (${puzzle.answer_id}).`; return; }

  const editionDate = puzzle.date || puzzleName;
  const number = /^\d{4}-\d{2}-\d{2}$/.test(editionDate) ? puzzleNumber(editionDate, catalog.epoch) : null;
  if (number) {
    $("edition").textContent = `No. ${number}  ·  ${longDate(editionDate)}`;
    document.title = `Name the Picture #${number}`;
  }

  const key = `pic:${puzzleName}`;
  const s = store.get(key) || { revealed: 1, points: cfg.startPoints, guesses: [], done: false, score: null, won: false };
  const save = () => store.set(key, s);

  function addPick(id) {
    if (s.done || s.guesses.some((g) => g.id === id)) return;
    const film = byId[id];
    if (id === answer.id) {
      s.guesses.push({ id, ok: true });
      s.done = true; s.won = true; s.score = s.points;
    } else {
      const r = afterWrongGuess(s.points, film, answer, cfg);
      s.points = r.points;
      s.guesses.push({ id, ok: false, tier: r.tier.name });
      if (s.guesses.length >= cfg.maxGuesses) giveUp();
    }
    save(); render();
  }
  function giveUp() {
    s.done = true; s.won = false;
    const best = s.guesses.map((g) => byId[g.id]).filter(Boolean);
    const closest = best.sort((a, b) => Math.abs(a.year - answer.year) - Math.abs(b.year - answer.year))[0];
    s.score = failScore(closest, answer, cfg);
  }
  function reveal() {
    const next = s.revealed + 1;
    if (s.done || next > puzzle.clues.length) return;
    s.points = afterClue(s.points, next, cfg);
    s.revealed = next; save(); render();
  }

  function shareText() {
    const grid = "🎬".repeat(s.revealed) + s.guesses.map((g) => (g.ok ? "✅" : "🟥")).join("");
    const score = `${s.won ? s.score : "✗ " + s.score} pts`;
    const title = number ? `Name the Picture #${number}` : `Name the Picture ${puzzleName}`;
    return `${title}\n${score}\n${grid}\n\nTry your hand at it\nhttps://redcrowlabs.com/movies`;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    const rank = (f) => {
      const title = f.title.toLowerCase();
      const aliases = (f.aliases || []).map((a) => a.toLowerCase());
      if (title === q || aliases.includes(q)) return 0;
      if (title.startsWith(q) || aliases.some((a) => a.startsWith(q))) return 1;
      if (title.includes(q)) return 2;
      return 3;
    };
    return films.filter((f) =>
      f.label.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q) ||
      String(f.year).includes(q) ||
      (f.aliases || []).some((a) => a.toLowerCase().includes(q))
    ).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title)).slice(0, 8);
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

    s.guesses.filter((g) => !g.ok).forEach((g) =>
      root.append(el("div", { className: "wrong", textContent: `✗ ${byId[g.id].label}: ${g.tier}` }))
    );

    if (!s.done) {
      const row = el("div", { className: "row" });
      const input = el("input", { placeholder: "Name the picture…", autocomplete: "off", ariaLabel: "Movie" });
      const opts = el("div", { id: "opts", hidden: true });
      input.addEventListener("input", () => {
        const hits = search(input.value);
        opts.replaceChildren(...hits.map((f) => {
          const d = el("div", { textContent: f.label });
          d.addEventListener("click", () => addPick(f.id));
          return d;
        }));
        opts.hidden = hits.length === 0;
      });
      row.append(input, opts);
      root.append(row);

      const nextN = s.revealed + 1;
      const more = nextN <= puzzle.clues.length;
      const rev = el("button", { textContent: more ? `Next line (−${clueCost(nextN, cfg).toLocaleString()})` : "No more lines", disabled: !more });
      rev.addEventListener("click", reveal);
      const quit = el("button", { textContent: "Give up" });
      quit.addEventListener("click", () => { giveUp(); save(); render(); });
      root.append(clueMeter(s.revealed, puzzle.clues.length, "Line"));
      root.append(el("div", { className: "row" }, rev, quit));
      root.append(el("div", { className: "remain", textContent: `Guesses left  ${cfg.maxGuesses - s.guesses.length}` }));
    } else {
      const res = el("div", { className: "result" });
      res.append(clueMeter(s.revealed, puzzle.clues.length, "Line"));
      res.append(el("h2", { textContent: s.won ? `Correct: ${puzzle.answer_label}` : `It was ${puzzle.answer_label}` }));
      s.guesses.filter((g) => !g.ok).forEach((g) => {
        const years = Math.abs(byId[g.id].year - answer.year);
        res.append(el("div", { className: "note", textContent: `${byId[g.id].label}: ${years === 0 ? "same year" : years + " years off"}` }));
      });
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
        kicker: "Name the Picture",
        number: number || puzzleName,
        status: s.won ? "Solved" : "Missed",
        scoreLine: `${s.score.toLocaleString()} pts`,
        squares,
        footer: "redcrowlabs.com/movies",
      }).then((card) => {
        preview.src = card.url;
        shareBtn.disabled = false;
        shareBtn.addEventListener("click", async () => {
          const result = await shareResult({
            text: shareText(),
            blob: card.blob,
            filename: `name-the-picture-${number || puzzleName}.png`,
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
