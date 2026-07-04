import { access, mkdir, readFile, rm, writeFile } from "fs/promises";
import { mkdtemp } from "fs/promises";
import path from "path";
import { exec, log } from "./utils.js";

export async function prepareTemplate(
  templateUrl: string,
  projectDir: string,
  skipFork: boolean
): Promise<void> {
  if (await pathExists(projectDir)) {
    throw new Error(`Project directory already exists: ${projectDir}`);
  }

  const isGithub = templateUrl.includes("github.com");
  const shouldFork = isGithub && !skipFork;

  if (shouldFork) {
    const owner = parseRepoOwner(templateUrl);
    const user = await getGithubUser();

    if (owner && user && owner.toLowerCase() === user.toLowerCase()) {
      await createRepoFromTemplate(templateUrl, projectDir, user);
      return;
    }

    log("Forking template on GitHub...");
    const forkResult = await forkTemplate(templateUrl, projectDir);
    if (forkResult) {
      await cloneRepo(forkResult, projectDir, true);
      return;
    }
    log("Fork failed or skipped, falling back to git clone.");
  }

  log(`Cloning template from ${templateUrl}...`);
  await cloneRepo(templateUrl, projectDir, false);
}

async function createRepoFromTemplate(
  templateUrl: string,
  projectDir: string,
  user: string
): Promise<void> {
  const repoName = path.basename(projectDir);
  const newRepoUrl = `https://github.com/${user}/${repoName}.git`;

  log(`Template is owned by your GitHub account; creating new repository ${user}/${repoName}...`);
  await createGithubRepo(repoName);

  const parentDir = path.dirname(projectDir);
  await mkdir(parentDir, { recursive: true });
  const tempDir = await mkdtemp(path.join(parentDir, `.stitch-${repoName}-`));
  try {
    log("Cloning template locally...");
    await exec(`git clone --depth 1 ${templateUrl} ${tempDir}`);

    log("Removing old git history...");
    await removeDir(path.join(tempDir, ".git"));

    log("Moving template into project directory...");
    await renameDir(tempDir, projectDir);

    log("Pushing to new repository...");
    await initAndPush(projectDir, newRepoUrl);
  } catch (err) {
    await removeDir(tempDir).catch(() => {});
    throw err;
  }
}

async function createGithubRepo(repoName: string): Promise<void> {
  try {
    await exec(`gh repo create ${repoName} --public --description "Created with stitch-site CLI"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already exists")) {
      throw new Error(`GitHub repository ${repoName} already exists.`);
    }
    throw new Error(`Failed to create GitHub repository: ${message}`);
  }
}

async function forkTemplate(templateUrl: string, projectDir: string): Promise<string | null> {
  try {
    const repoName = path.basename(projectDir);
    const parentRepo = templateUrl.replace(/\.git$/, "");
    const { stdout } = await exec(
      `gh repo fork ${parentRepo} --fork-name ${repoName} --clone=false`,
      { cwd: process.cwd() }
    );
    log(stdout?.trim() || "Fork created");
    const user = await getGithubUser();
    if (!user) return null;
    return `https://github.com/${user}/${repoName}.git`;
  } catch (err) {
    log(`GitHub fork unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function cloneRepo(repoUrl: string, projectDir: string, keepGit: boolean): Promise<void> {
  await exec(`git clone --depth 1 ${repoUrl} ${projectDir}`);
  if (!keepGit) {
    await removeDir(path.join(projectDir, ".git"));
  }
}

async function initAndPush(projectDir: string, repoUrl: string): Promise<void> {
  await exec("git init", { cwd: projectDir });
  await exec("git config user.name \"stitch-site\"", { cwd: projectDir });
  await exec("git config user.email \"stitch-site@localhost\"", { cwd: projectDir });
  await exec("git add .", { cwd: projectDir });
  await exec('git commit -m "Initial commit from stitch-site template"', { cwd: projectDir });
  await exec("git branch -M main", { cwd: projectDir });
  await exec(`git remote add origin ${repoUrl}`, { cwd: projectDir });
  await exec("git push -u origin main", { cwd: projectDir });
}

async function renameDir(oldPath: string, newPath: string): Promise<void> {
  try {
    await exec(`mv ${oldPath} ${newPath}`);
  } catch {
    // Fallback if mv fails across devices
    await exec(`cp -r ${oldPath} ${newPath}`);
    await removeDir(oldPath);
  }
}

async function getGithubUser(): Promise<string | null> {
  try {
    const { stdout } = await exec("gh api user --jq '.login'", { cwd: process.cwd() });
    return stdout?.trim() || null;
  } catch {
    return null;
  }
}

function parseRepoOwner(templateUrl: string): string | null {
  const match = templateUrl.match(/github\.com[/:]([\w-]+)\/[\w-]+/i);
  return match ? match[1] : null;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function removeDir(target: string): Promise<void> {
  await rm(target, { recursive: true, force: true });
}

export { readFile, writeFile };
