import fs from "node:fs";
import path from "node:path";
import { csMessages } from "../src/i18n/cs-messages.ts";
import { csUiMessages } from "../src/i18n/cs-ui.ts";

const allMessages = { ...csMessages, ...csUiMessages };

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

const files = walk("src");
const keyRegex = /\b(?:text|phrase)\(\s*["']([^"']+)["']/g;
const templateRegex = /\b(?:text|phrase)\(\s*`([^`]+)`/g;
const missing: { file: string; key: string }[] = [];
const dynamicFound: { file: string; pattern: string }[] = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  let match: RegExpExecArray | null;
  while ((match = keyRegex.exec(content)) !== null) {
    const key = match[1];
    if (key.includes("${") || key.endsWith(".")) continue;
    if (!(key in allMessages)) {
      missing.push({ file, key });
    }
  }
  while ((match = templateRegex.exec(content)) !== null) {
    dynamicFound.push({ file, pattern: match[1] });
  }
}

console.log("Dynamic template phrases found:", dynamicFound);

const steps = [
  "step_1_matej_move",
  "step_2_colloredo_escort",
  "step_3_vaclav_aim",
  "step_4_vaclav_shoot",
  "step_5_enemy_turn_react",
  "step_6_vaclav_reload",
  "step_7_keg_explosion",
  "step_8_melee_finish",
  "step_9_free_combat",
];
const fields = ["speaker", "role", "title", "order", "tip"];
for (const step of steps) {
  for (const field of fields) {
    const key = `tutorial.${step}.${field}`;
    if (!(key in allMessages)) {
      missing.push({ file: "GuidedTutorialSystem", key });
    }
  }
}

const coverLevels = ["none", "half", "full"];
for (const level of coverLevels) {
  const key = `inspect.cover.${level}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const dirs = ["N", "S", "E", "W"];
for (const dir of dirs) {
  const key = `inspect.dir.${dir}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const locks = ["wheellock", "matchlock"];
for (const lock of locks) {
  const key = `inspect.lock.${lock}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const meleeKinds = ["sword", "dagger", "polearm", "pistol_butt", "musket_butt", "fist"];
for (const kind of meleeKinds) {
  const key = `inspect.meleeKind.${kind}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const surfaces = ["cobble", "stone_floor", "palace_carpet", "rubble", "scorched_ruin", "water"];
for (const surface of surfaces) {
  const key = `inspect.surface.${surface}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const obstacles = ["none", "low_wall", "high_wall", "pillar", "powder_keg"];
for (const obs of obstacles) {
  const key = `inspect.obstacle.${obs}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const stairs = ["straight_stairs", "spiral_stairs", "ladder"];
for (const stair of stairs) {
  const key = `inspect.stair.${stair}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const floorLevels = ["0", "1", "2"];
for (const f of floorLevels) {
  const key = `inspect.floor.${f}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}

const damageLevels = ["0", "1", "2"];
for (const d of damageLevels) {
  const key = `inspect.damage.${d}`;
  if (!(key in allMessages)) missing.push({ file: "inspectView", key });
}



if (missing.length > 0) {
  console.error("Missing translation keys found:", missing);
  process.exit(1);
} else {
  console.log("All static translation keys exist in locale pack!");
}
