import assert from "node:assert";
import { describe, it } from "node:test";
import { loadDesignPackage } from "../package.js";
import path from "node:path";

describe("loadDesignPackage", () => {
  const fixturePath = path.resolve("tests/fixtures/sample-design.zip");

  it("loads pages and routes from the fixture", async () => {
    const pkg = await loadDesignPackage(fixturePath);

    assert.equal(pkg.pages.length, 2);

    const home = pkg.pages.find((p) => p.name === "Home");
    assert.ok(home);
    assert.equal(home!.route, "");

    const pricing = pkg.pages.find((p) => p.name === "Pricing");
    assert.ok(pricing);
    assert.equal(pricing!.route, "pricing");
  });

  it("extracts assets", async () => {
    const pkg = await loadDesignPackage(fixturePath);
    assert.equal(pkg.assets.length, 1);
    assert.equal(pkg.assets[0].name, "logo.svg");
    assert.ok(pkg.assets[0].buffer.length > 0);
  });

  it("extracts design system files", async () => {
    const pkg = await loadDesignPackage(fixturePath);
    assert.ok(pkg.designSystem.colors);
  });
});
