// Copies the built game (dist/) into an IdleForge checkout at wwwroot/games/greebles/.
// Usage: npm run build && node scripts/ship-to-hub.mjs /path/to/IdleForge
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hub = process.argv[2] && resolve(process.argv[2]);
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
if (!hub || !existsSync(join(hub, 'IdleForge.csproj'))) {
  console.error('Pass the path to an IdleForge checkout (folder containing IdleForge.csproj).');
  process.exit(1);
}
if (!existsSync('dist/index.html')) { console.error('Run `npm run build` first.'); process.exit(1); }

const dest = resolve(hub, 'wwwroot/games/greebles');
rmSync(dest, { recursive: true, force: true });
cpSync('dist', dest, { recursive: true });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync(join(dest, 'build.json'), JSON.stringify({ version: pkg.version, builtUtc: new Date().toISOString() }) + '\n');
console.log(`Shipped Greebles ${pkg.version} -> ${dest}`);
