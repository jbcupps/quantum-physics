import fs from "node:fs";
import assert from "node:assert/strict";
const html = fs.readFileSync("public/index.html", "utf8");
assert(html.includes("<main"));
assert(!html.includes("{%"));
for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (url.startsWith("/"))
    assert(fs.existsSync("public" + url), "Missing asset: " + url);
}
console.log("Static site validated.");
