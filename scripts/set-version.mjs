// Sets one version across all platforms: `npm run version:set -- 0.2.0`
// iOS (Swift Package Manager) takes its version from the git tag `v<version>`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? "")) {
  console.error("usage: npm run version:set -- <semver>");
  process.exit(1);
}
const root = fileURLToPath(new URL("..", import.meta.url));

const pkgPath = root + "packages/web/package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const gradlePath = root + "android/gradle.properties";
writeFileSync(gradlePath, readFileSync(gradlePath, "utf8").replace(/^VERSION_NAME=.*$/m, `VERSION_NAME=${version}`));

console.log(`version set to ${version}. Commit, then tag: git tag v${version}`);
