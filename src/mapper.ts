import { ensureDir, writeFile } from "./template.js";
import path from "path";
import { DesignPage } from "./types.js";
import { htmlToTsx } from "./parser.js";

export async function writePages(pages: DesignPage[], appDir: string): Promise<void> {
  for (const page of pages) {
    await writePage(page, appDir);
  }
}

async function writePage(page: DesignPage, appDir: string): Promise<void> {
  const routeDir = path.join(appDir, page.route || "");
  await ensureDir(routeDir);

  const { tsx, imports } = htmlToTsx(page.html);
  const pageFile = path.join(routeDir, "page.tsx");

  const importBlock = imports.length ? `${imports.join("\n")}\n\n` : "";
  const component = `${importBlock}export default function ${toComponentName(page.name)}Page() {
  return (
    <>
${indent(tsx, 6)}
    </>
  );
}
`;

  await writeFile(pageFile, component, "utf-8");
}

function toComponentName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/(?:^|\s)\w/g, (m) => m.toUpperCase())
    .replace(/\s+/g, "");
}

function indent(text: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");
}
