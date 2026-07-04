import { exec as nodeExec } from "child_process";
import { promisify } from "util";

export const exec = promisify(nodeExec);

export function log(message: string): void {
  console.log(`[stitch-site] ${message}`);
}

export function error(message: string): void {
  console.error(`[stitch-site] ${message}`);
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/(?:^|\s)\w/g, (match) => match.toUpperCase())
    .replace(/\s+/g, "");
}

export function toRouteName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
