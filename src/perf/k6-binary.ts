/**
 * k6 is a Go binary, not an npm package: the pinned release is downloaded into
 * .tools/k6/<version>/ and checked against its SHA-256 checksum.
 */

import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '@config/paths';

export const K6_VERSION = '2.3.0';

const RELEASES = `https://github.com/grafana/k6/releases/download/v${K6_VERSION}`;

/** Release asset name for this OS/CPU, e.g. k6-v2.3.0-windows-amd64.zip. */
function assetName(): string {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  switch (process.platform) {
    case 'win32':
      return `k6-v${K6_VERSION}-windows-amd64.zip`;
    case 'darwin':
      return `k6-v${K6_VERSION}-macos-${arch}.zip`;
    case 'linux':
      return `k6-v${K6_VERSION}-linux-${arch}.tar.gz`;
    default:
      throw new Error(`no k6 release for platform ${process.platform}`);
  }
}

export function k6Path(): string {
  return join(ROOT, '.tools', 'k6', K6_VERSION, process.platform === 'win32' ? 'k6.exe' : 'k6');
}

/** Path to the pinned k6 binary, downloading and verifying it on first use. */
export async function ensureK6(): Promise<string> {
  const target = k6Path();
  if (existsSync(target)) return target;

  const asset = assetName();
  const [archive, checksums] = await Promise.all([
    download(`${RELEASES}/${asset}`),
    download(`${RELEASES}/k6-v${K6_VERSION}-checksums.txt`),
  ]);

  const expected = new TextDecoder()
    .decode(checksums)
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .find(([, name]) => name === asset)?.[0];
  const actual = createHash('sha256').update(archive).digest('hex');
  if (expected === undefined || expected !== actual) {
    throw new Error(`k6 ${asset}: SHA-256 mismatch (expected ${expected ?? 'no entry'}, got ${actual})`);
  }

  // Extract into a scratch dir, then move the binary into place in one rename,
  // so a concurrent caller never sees a half-written executable.
  const toolsDir = join(ROOT, '.tools', 'k6');
  mkdirSync(toolsDir, { recursive: true });
  const scratch = mkdtempSync(join(toolsDir, '.download-'));
  try {
    const archivePath = join(scratch, asset);
    await Bun.write(archivePath, archive);
    // bsdtar (Windows 10+, macOS) reads .zip; GNU tar reads the Linux .tar.gz.
    const tar = Bun.spawn(['tar', '-xf', archivePath, '-C', scratch], { stderr: 'pipe' });
    if ((await tar.exited) !== 0)
      throw new Error(`extracting ${asset} failed: ${await new Response(tar.stderr).text()}`);

    const folder = readdirSync(scratch, { withFileTypes: true }).find((entry) => entry.isDirectory())?.name;
    if (folder === undefined) throw new Error(`unexpected layout in ${asset}`);
    mkdirSync(join(target, '..'), { recursive: true });
    if (!existsSync(target)) renameSync(join(scratch, folder, process.platform === 'win32' ? 'k6.exe' : 'k6'), target);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  // macOS and Windows ship k6 as a .zip, and unzipping does not reliably carry
  // the exec bit, so set it rather than trust the archive.
  if (process.platform !== 'win32') chmodSync(target, 0o755);
  return target;
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
