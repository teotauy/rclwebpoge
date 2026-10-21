/** Square result card. No answer, so it can be posted. */

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawResultCard({ kicker, number, status, scoreLine, squares, streak, footer }) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const paper = cssVar("--paper", "#f4f7f2");
  const ink = cssVar("--ink", "#172033");
  const muted = cssVar("--muted", "#5c6b78");
  const signal = cssVar("--signal", "#b42318");
  const rule = cssVar("--rule", "#c3cfc6");

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = rule;
  ctx.lineWidth = 1;
  for (let y = 40; y < 1080; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1080, y);
    ctx.stroke();
  }
  ctx.fillStyle = signal;
  ctx.fillRect(0, 0, 1080, 14);

  ctx.fillStyle = signal;
  ctx.font = "500 28px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillText(kicker.toUpperCase(), 72, 110);

  ctx.fillStyle = ink;
  ctx.font = "500 92px Newsreader, Georgia, serif";
  ctx.fillText(`No. ${number}`, 72, 230);

  ctx.fillStyle = signal;
  ctx.font = "500 28px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillText(String(status || "SCORE").toUpperCase(), 72, 330);
  ctx.fillStyle = ink;
  ctx.font = "500 108px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillText(scoreLine, 72, 450);

  const colors = { clue: "#2f6fbf", miss: "#b42318", solved: "#0f6e56" };
  const size = 64;
  const gap = 16;
  squares.forEach((kind, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const x = 72 + col * (size + gap);
    const y = 520 + row * (size + gap);
    ctx.fillStyle = colors[kind] || colors.clue;
    ctx.fillRect(x, y, size, size);
  });

  ctx.fillStyle = muted;
  ctx.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
  const legendY = 520 + Math.ceil(squares.length / 8) * (size + gap) + 36;
  ctx.fillStyle = "#2f6fbf";
  ctx.fillRect(72, legendY - 22, 22, 22);
  ctx.fillStyle = ink;
  ctx.fillText("clue", 104, legendY);
  ctx.fillStyle = "#b42318";
  ctx.fillRect(230, legendY - 22, 22, 22);
  ctx.fillStyle = ink;
  ctx.fillText("miss", 262, legendY);
  ctx.fillStyle = "#0f6e56";
  ctx.fillRect(400, legendY - 22, 22, 22);
  ctx.fillStyle = ink;
  ctx.fillText("solved", 432, legendY);

  ctx.fillStyle = ink;
  ctx.font = "500 36px Newsreader, Georgia, serif";
  if (streak != null) ctx.fillText(`Streak ${streak}`, 72, legendY + 90);

  ctx.fillStyle = muted;
  ctx.font = "500 28px 'IBM Plex Mono', ui-monospace, monospace";
  const foot = wrap(ctx, footer, 900);
  foot.forEach((line, i) => ctx.fillText(line, 72, 980 + i * 36));

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, url: URL.createObjectURL(blob) };
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/** Share the card as a picture. Text rides along only when a picture cannot. */
export async function shareResult({ text, blob, filename }) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share) {
    const image = { files: [file] };
    const canImage = typeof navigator.canShare !== "function" || navigator.canShare(image);
    if (canImage) {
      try {
        await navigator.share(image);
        return "shared";
      } catch (e) {
        if (e?.name === "AbortError") return "cancelled";
      }
    }
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "image/png": blob,
        }),
      ]);
      return "copied";
    } catch { /* this browser won't hold text and an image together */ }
  }
  let textCopied = false;
  try {
    await navigator.clipboard.writeText(text);
    textCopied = true;
  } catch { /* text stays on the card download */ }
  downloadBlob(blob, filename);
  return textCopied ? "saved" : "saved-image";
}
