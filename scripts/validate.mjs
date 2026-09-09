import fs from "node:fs";
import assert from "node:assert/strict";
const pages = fs.readdirSync("public").filter((name) => name.endsWith(".html"));
for (const page of pages) {
  const html = fs.readFileSync("public/" + page, "utf8");
  assert(html.includes("<main"), "Missing main content: " + page);
  assert(!html.includes("{%"), "Unrendered template: " + page);
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!url.startsWith("/")) continue;
    const path = "public" + url.split(/[?#]/)[0];
    assert(
      fs.existsSync(path) || fs.existsSync(path + ".html"),
      `Missing local asset or page in ${page}: ${url}`,
    );
  }
}
console.log(`${pages.length} static pages validated.`);
