import fs from "node:fs";
import zlib from "node:zlib";

function ascii85Decode(input) {
  const source = input.replace(/\s/g, "").replace(/^<~/, "").replace(/~>$/, "");
  const out = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] === "z") {
      out.push(0, 0, 0, 0);
      index += 1;
      continue;
    }
    const chunk = source.slice(index, index + 5);
    index += chunk.length;
    let value = 0;
    for (let offset = 0; offset < 5; offset += 1) {
      const code = offset < chunk.length ? chunk.charCodeAt(offset) : 117;
      value = value * 85 + (code - 33);
    }
    const count = chunk.length === 5 ? 4 : chunk.length - 1;
    const bytes = [
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    ];
    out.push(...bytes.slice(0, count));
  }
  return Buffer.from(out);
}

const pdf = fs.readFileSync("C:/Users/ADMIN/Downloads/security_performance_evaluation_form_transcribed.pdf");
const source = pdf.toString("latin1");
let cursor = 0;
let page = 0;
while (cursor < source.length) {
  const start = source.indexOf("stream\n", cursor);
  if (start < 0) {
    break;
  }
  const bodyStart = start + "stream\n".length;
  const end = source.indexOf("endstream", bodyStart);
  if (end < 0) {
    break;
  }
  const body = source.slice(bodyStart, end).replace(/\s+$/, "");
  cursor = end + 9;
  if (!body.startsWith("Gb")) {
    continue;
  }
  page += 1;
  const inflated = zlib.inflateSync(ascii85Decode(body.replace(/~>$/, ""))).toString("latin1");
  const strings = [...inflated.matchAll(/\((?:\\\)|[^)])*\)/g)].map((item) =>
    item[0]
      .slice(1, -1)
      .replace(/\\([()\\])/g, "$1")
      .replace(/\\n/g, "\n"),
  );
  fs.writeFileSync(
    `C:/Users/ADMIN/AppData/Local/Temp/eval-page-${page}.txt`,
    strings.filter((line) => line.trim() && line !== "n").join("\n"),
  );
  console.log("wrote", page, strings.length);
}
