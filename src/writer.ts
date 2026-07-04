import path from "path";
import { load } from "cheerio";
import { DesignAsset, DesignSystem } from "./types.js";
import { log } from "./utils.js";
import { readFile, writeFile, ensureDir, pathExists } from "./template.js";

export async function applyDesignSystem(
  designSystem: DesignSystem,
  appDir: string
): Promise<void> {
  const globalsPath = path.join(appDir, "globals.css");
  let existingCss = "";
  if (await pathExists(globalsPath)) {
    existingCss = await readFile(globalsPath, "utf-8");
  }

  const extraCss: string[] = [];

  if (designSystem.colors) {
    const colors = extractColors(designSystem.colors);
    if (colors.length) {
      extraCss.push(":root {");
      for (const c of colors) {
        extraCss.push(`  ${c.cssVar}: ${c.value};`);
      }
      extraCss.push("}");
    }
  }

  if (designSystem.typography) {
    const fontFamily = extractFontFamily(designSystem.typography);
    if (fontFamily) {
      extraCss.push(`body { font-family: ${fontFamily}; }`);
    }
  }

  if (extraCss.length) {
    await writeFile(globalsPath, `${existingCss}\n\n${extraCss.join("\n")}`, "utf-8");
    log("Updated globals.css with design tokens.");
  }
}

export async function copyAssets(assets: DesignAsset[], publicDir: string): Promise<void> {
  await ensureDir(publicDir);
  for (const asset of assets) {
    const dest = path.join(publicDir, asset.name);
    await writeFile(dest, asset.buffer);
  }
  if (assets.length) {
    log(`Copied ${assets.length} asset(s) to public/.`);
  }
}

interface ColorToken {
  cssVar: string;
  value: string;
}

function extractColors(html: string): ColorToken[] {
  const $ = load(html);
  const names = new Map<string, string>();
  const scored: Array<{ value: string; name: string; score: number }> = [];

  // Collect all elements that contain a hex color and score their semantic usefulness.
  $("*").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const hexMatches = text.match(/(#[0-9a-fA-F]{3,8})/g);
    if (!hexMatches) return;

    const className = $el.attr("class") || "";
    const semanticName = deriveColorName(className);
    const score = semanticName === "token" ? 0 : 1;

    for (const hex of hexMatches) {
      scored.push({ value: hex, name: semanticName, score });
    }
  });

  // Prefer the highest-scoring name for each color value.
  scored.sort((a, b) => b.score - a.score);
  for (const candidate of scored) {
    if (!names.has(candidate.value)) {
      names.set(candidate.value, candidate.name);
    }
  }

  return Array.from(names.entries()).map(([value, name]) => ({
    cssVar: `--color-${name}`,
    value,
  }));
}

function deriveColorName(className: string): string {
  const candidates = (className || "")
    .split(/\s+/)
    .filter((c) => /primary|secondary|accent|brand|dark|light|neutral|success|warning|danger|muted|background|foreground|surface|text/i.test(c));
  return toCssVarName(candidates[0] || "token");
}

function extractFontFamily(html: string): string | null {
  const $ = load(html);
  const fontFamily = $("body, [style*='font-family']").first().css("font-family");
  if (fontFamily && fontFamily !== "") return fontFamily;

  const textMatch = html.match(/font-family:\s*([^;]+)/i);
  return textMatch ? textMatch[1].trim() : null;
}

function toCssVarName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30) || "token";
}
