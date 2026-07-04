import { readFile } from "./template.js";
import JSZip from "jszip";
import { DesignPackage, DesignPage, DesignSystem, DesignAsset } from "./types.js";
import { toRouteName } from "./utils.js";

export async function loadDesignPackage(zipPath: string): Promise<DesignPackage> {
  const data = await readFile(zipPath);
  const zip = await JSZip.loadAsync(data);

  const pages: DesignPage[] = [];
  const designSystem: DesignSystem = {};
  const assets: DesignAsset[] = [];

  const pageDirs = new Set<string>();

  for (const [relativePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    const topLevel = parts[0];
    const fileName = parts[parts.length - 1];

    if (topLevel === "design-system") {
      const content = await entry.async("string");
      if (fileName === "colors.html") designSystem.colors = content;
      else if (fileName === "typography.html") designSystem.typography = content;
      else if (fileName === "spacing.html") designSystem.spacing = content;
    } else if (topLevel === "assets") {
      const buffer = Buffer.from(await entry.async("arraybuffer"));
      assets.push({ name: fileName, buffer });
    } else if (parts.length === 2) {
      pageDirs.add(topLevel);
    }
  }

  for (const dir of pageDirs) {
    const htmlEntry = zip.files[`${dir}/code.html`];
    const screenshotEntry = zip.files[`${dir}/screen.png`];

    if (!htmlEntry) continue;

    const html = await htmlEntry.async("string");
    const route = toRouteName(dir);

    pages.push({
      route: route === "home" ? "" : route,
      name: toPageName(dir),
      html,
      hasScreenshot: !!screenshotEntry,
      screenshot: screenshotEntry ? Buffer.from(await screenshotEntry.async("arraybuffer")) : undefined,
    });
  }

  return {
    pages: pages.sort((a, b) => (a.route === "" ? -1 : b.route === "" ? 1 : 0)),
    designSystem,
    assets,
  };
}

function toPageName(dir: string): string {
  return dir
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
