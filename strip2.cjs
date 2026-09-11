const ts = require("typescript");
const fs = require("fs");

const KEEP = /^\s*(\/\/|\/\*)\s*(@ts-|eslint|prettier|biome|deno-|#region|#endregion|@__|<reference|global|webpackChunkName|@jsx)/;

function stripFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const cuts = [];
  const seen = new Set();
  const addRange = (pos, end) => {
    const key = pos + ":" + end;
    if (seen.has(key)) return;
    seen.add(key);
    cuts.push({ pos, end });
  };
  const addComments = (r) => {
    if (!r) return;
    for (const c of r) {
      if (KEEP.test(text.slice(c.pos, c.end))) continue;
      addRange(c.pos, c.end);
    }
  };

  const visit = (node) => {
    if (ts.isJsxExpression(node) && !node.expression) {
      const inner = text.slice(node.getStart(), node.getEnd());
      if (/^\{\s*\/\*[\s\S]*\*\/\s*\}$/.test(inner)) {
        addRange(node.getStart(), node.getEnd());
        return;
      }
    }
    addComments(ts.getLeadingCommentRanges(text, node.getFullStart()));
    addComments(ts.getTrailingCommentRanges(text, node.getEnd()));
    node.forEachChild(visit);
  };
  visit(sf);
  addComments(ts.getLeadingCommentRanges(text, sf.endOfFileToken.getFullStart()));

  if (!cuts.length) return 0;
  cuts.sort((a, b) => b.pos - a.pos);

  let out = text;
  for (const { pos, end } of cuts) {
    const lineStart = out.lastIndexOf("\n", pos - 1) + 1;
    const onlyBefore = out.slice(lineStart, pos).trim() === "";
    let after = end;
    while (after < out.length && (out[after] === " " || out[after] === "\t")) after++;
    const onlyAfter = out[after] === "\n" || after >= out.length;
    if (onlyBefore && onlyAfter) out = out.slice(0, lineStart) + out.slice(Math.min(after + 1, out.length));
    else if (onlyAfter) out = out.slice(0, out.slice(0, pos).replace(/[ \t]+$/, "").length) + out.slice(after);
    else out = out.slice(0, pos) + out.slice(end);
  }
  out = out.replace(/\n{3,}/g, "\n\n");
  if (out !== text) fs.writeFileSync(file, out);
  return cuts.length;
}

let total = 0, touched = 0;
for (const f of process.argv.slice(2)) {
  try { const n = stripFile(f); if (n) { total += n; touched++; } }
  catch (e) { console.error("SKIP", f, e.message); }
}
console.log(`removed ${total} comments from ${touched} files`);
