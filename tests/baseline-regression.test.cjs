const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const panel = fs.readFileSync(path.join(root, "ui/panel.html"), "utf8");
const entry = fs.readFileSync(path.join(root, "entry.js"), "utf8");

assert.strictEqual(manifest.specVersion, 2, "StoryState must remain Spec 2");
assert.ok(manifest.permissions.includes("file"), "native import/export requires file permission");
assert.ok(manifest.permissions.includes("variable"));
assert.ok(manifest.permissions.includes("message"));
assert.ok(manifest.permissions.includes("generate"));

for (const tab of ["npcs", "relationships", "knowledge", "world", "activity", "settings"]) {
  assert.ok(panel.includes(`data-tab="${tab}"`), `missing ${tab} navigation tab`);
  assert.ok(panel.includes(`data-panel="${tab}"`), `missing ${tab} panel`);
}

assert.ok(panel.includes("tavo.file.export"), "export must use Tavo native file API");
assert.ok(panel.includes("tavo.file.import"), "import must use Tavo native file API");
assert.ok(panel.includes("tavo.file.load"), "import must load selected native file");
assert.ok(panel.includes("SCHEMA_VERSION=12"), "schema 12 baseline changed unexpectedly");
assert.ok(panel.includes("SCAN_LEASE_TIMEOUT_MS"), "scan lease/recovery guard missing");
assert.ok(panel.includes("STRUCTURED_HINT_PENDING_KEY"), "structured NPC hint support missing");
assert.ok(entry.includes('tavo.plugin.on("generation:prepare"'), "context injection hook missing");
assert.ok(entry.includes('tavo.plugin.on("message:added"'), "saved-message hook missing");

console.log("baseline-regression.test.cjs: StoryState 0.8 behavioral surface is present.");
