#!/usr/bin/env node
import { Command } from "commander";
import path from "path";
import { pathExists } from "./template.js";
import { loadDesignPackage } from "./package.js";
import { prepareTemplate } from "./template.js";
import { writePages } from "./mapper.js";
import { applyDesignSystem, copyAssets } from "./writer.js";
import { exec, log, error } from "./utils.js";
import { CliOptions } from "./types.js";

const program = new Command();

program
  .name("stitch-site")
  .description("Turn a Stitch design package zip into a Next.js site")
  .version("0.1.0");

program
  .command("init <design-package> [project-dir]")
  .description("Create a new Next.js site from a Stitch design package")
  .option("-t, --template <url>", "Template repository URL", "https://github.com/wanggang265/nextjs-site-template.git")
  .option("--skip-fork", "Skip GitHub fork and clone directly", false)
  .option("--skip-install", "Skip npm install", false)
  .option("--skip-build", "Skip npm run build", false)
  .action(async (designPackageArg: string, projectDirArg: string | undefined, options: any) => {
    const opts: CliOptions = {
      packagePath: path.resolve(designPackageArg),
      projectDir: path.resolve(projectDirArg || deriveProjectName(designPackageArg)),
      template: options.template,
      skipFork: options.skipFork,
      skipInstall: options.skipInstall,
      skipBuild: options.skipBuild,
    };

    try {
      await runInit(opts);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();

async function runInit(opts: CliOptions): Promise<void> {
  if (!(await pathExists(opts.packagePath))) {
    throw new Error(`Design package not found: ${opts.packagePath}`);
  }

  log(`Creating project at ${opts.projectDir}`);
  await prepareTemplate(opts.template, opts.projectDir, opts.skipFork);

  log("Loading design package...");
  const designPackage = await loadDesignPackage(opts.packagePath);
  log(`Found ${designPackage.pages.length} page(s).`);

  const appDir = path.join(opts.projectDir, "app");
  const publicDir = path.join(opts.projectDir, "public");

  log("Writing pages...");
  await writePages(designPackage.pages, appDir);

  log("Applying design system...");
  await applyDesignSystem(designPackage.designSystem, appDir);

  log("Copying assets...");
  await copyAssets(designPackage.assets, publicDir);

  if (!opts.skipInstall) {
    log("Installing dependencies...");
    await exec("npm install", { cwd: opts.projectDir });
  }

  if (!opts.skipBuild) {
    log("Building project...");
    await exec("npm run build", { cwd: opts.projectDir });
  }

  log("Done.");
}

function deriveProjectName(packagePath: string): string {
  const base = path.basename(packagePath, path.extname(packagePath));
  return base.replace(/[-_]design_package$/, "").replace(/[-_]design$/, "").replace(/[-_]$/, "");
}
