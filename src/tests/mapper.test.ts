import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { writePages } from "../mapper.js";
import { DesignPage } from "../types.js";

describe("writePages", () => {
  let tempDir: string;

  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "stitch-mapper-"));
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes page files to the expected routes", async () => {
    const pages: DesignPage[] = [
      { route: "", name: "home", html: "<h1>Home</h1>", hasScreenshot: false },
      { route: "pricing", name: "pricing", html: "<h1>Pricing</h1>", hasScreenshot: false },
    ];

    const appDir = path.join(tempDir, "app");
    await writePages(pages, appDir);

    const homePage = await readFile(path.join(appDir, "page.tsx"), "utf-8");
    const pricingPage = await readFile(path.join(appDir, "pricing", "page.tsx"), "utf-8");

    assert.ok(homePage.includes("export default function HomePage"));
    assert.ok(homePage.includes("<h1>Home</h1>"));
    assert.ok(pricingPage.includes("export default function PricingPage"));
    assert.ok(pricingPage.includes("<h1>Pricing</h1>"));
  });

  it("includes imports from the parser", async () => {
    const pages: DesignPage[] = [
      { route: "", name: "home", html: '<a href="/pricing">Pricing</a>', hasScreenshot: false },
    ];

    const appDir = path.join(tempDir, "app-imports");
    await writePages(pages, appDir);

    const page = await readFile(path.join(appDir, "page.tsx"), "utf-8");
    assert.ok(page.includes('import Link from "next/link"'));
  });
});
