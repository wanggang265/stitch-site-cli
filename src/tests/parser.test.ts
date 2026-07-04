import assert from "node:assert";
import { describe, it } from "node:test";
import { htmlToTsx } from "../parser.js";

describe("htmlToTsx", () => {
  it("converts a simple tag to JSX", () => {
    const { tsx } = htmlToTsx("<h1>Hello</h1>");
    assert.equal(tsx, "<h1>Hello</h1>");
  });

  it("converts class to className", () => {
    const { tsx } = htmlToTsx('<div class="hero">Content</div>');
    assert.ok(tsx.includes('className="hero"'));
  });

  it("converts inline style to JSX style object", () => {
    const { tsx } = htmlToTsx('<p style="color: red; font-size: 16px;">Text</p>');
    assert.ok(tsx.includes("style={{"));
    assert.ok(tsx.includes('color: "red"'));
    assert.ok(tsx.includes('fontSize: "16px"'));
  });

  it("converts internal <a> to <Link>", () => {
    const { tsx, imports } = htmlToTsx('<a href="/pricing">Pricing</a>');
    assert.ok(tsx.includes("<Link"));
    assert.ok(tsx.includes('href="/pricing"'));
    assert.ok(imports.some((i) => i.includes("next/link")));
  });

  it("leaves external links as <a>", () => {
    const { tsx } = htmlToTsx('<a href="https://example.com">External</a>');
    assert.ok(tsx.includes("<a "));
    assert.ok(!tsx.includes("<Link"));
  });

  it("converts <img> with width/height to <Image>", () => {
    const { tsx, imports } = htmlToTsx('<img src="/logo.svg" alt="Logo" width="120" height="40" />');
    assert.ok(tsx.includes("<Image"));
    assert.ok(tsx.includes("width={120}"));
    assert.ok(tsx.includes("height={40}"));
    assert.ok(imports.some((i) => i.includes("next/image")));
  });

  it("keeps <img> without dimensions as native img", () => {
    const { tsx } = htmlToTsx('<img src="/photo.jpg" alt="Photo" />');
    assert.ok(tsx.includes("<img "));
    assert.ok(!tsx.includes("<Image"));
  });

  it("escapes JSX special characters in text", () => {
    const { tsx } = htmlToTsx("<p>{value}</p>");
    assert.ok(tsx.includes("{'{'}") || tsx.includes("&#123;"));
    assert.ok(tsx.includes("{'}'}") || tsx.includes("&#125;"));
  });

  it("preserves whitespace between inline elements", () => {
    const { tsx } = htmlToTsx("<span>Hello</span> <span>World</span>");
    assert.ok(tsx.includes("Hello</span> <span>World"));
  });
});
