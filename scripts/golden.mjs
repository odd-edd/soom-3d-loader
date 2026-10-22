// Writes or checks spec/golden.json: reference frames every platform must match.
//   node scripts/golden.mjs --write   regenerate after an intended spec change
//   node scripts/golden.mjs --check   fail if the web core drifted
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeFrame, VARIANTS } from "../packages/web/dist/index.js";

const file = fileURLToPath(new URL("../spec/golden.json", import.meta.url));
// Small counts at many times, plus a larger count so grids, beads and trails are covered.
const RUNS = [
  { count: 24, times: [0, 0.6, 2.3, 7.9] },
  { count: 96, times: [0.6, 2.3] },
];
const TOLERANCE = 1e-6;

const cases = [];
for (const variant of Object.keys(VARIANTS)) {
  for (const { count, times } of RUNS) {
    for (const t of times) cases.push({ variant, count, t, frame: Array.from(computeFrame(variant, count, t)) });
  }
}

if (process.argv.includes("--write")) {
  writeFileSync(file, JSON.stringify({ tolerance: TOLERANCE, cases }, null, 1) + "\n");
  console.log(`wrote ${cases.length} golden cases`);
} else {
  const golden = JSON.parse(readFileSync(file, "utf8"));
  let worst = 0;
  golden.cases.forEach((g, n) => {
    g.frame.forEach((v, i) => (worst = Math.max(worst, Math.abs(v - cases[n].frame[i]))));
  });
  if (worst > golden.tolerance) {
    console.error(`web core drifted from spec/golden.json (max diff ${worst})`);
    process.exit(1);
  }
  console.log(`web core matches golden (${golden.cases.length} cases, max diff ${worst})`);
}
