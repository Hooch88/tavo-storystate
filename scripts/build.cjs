const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const files = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((name) => name.endsWith(".js")).sort();
const joinFiles = (dir) => files(dir).map((name) => read(dir, name)).join("");

function buildEntry() {
  return joinFiles("src/entry");
}

function buildPanel() {
  const prefix = read("src/ui/prefix.html");
  const css = read("src/ui/styles.css");
  const markup = read("src/ui/markup.html");
  const runtime = joinFiles("src/ui/runtime");
  return `${prefix}<style>\n${css}\n</style>${markup}<script>\n${runtime}\n</script>\n`;
}

function check(name, generated, targetPath) {
  const target = read(...targetPath.split("/"));
  if (generated !== target) {
    console.error(`${name} is out of date. Run: node scripts/build.cjs`);
    process.exitCode = 1;
    return false;
  }
  console.log(`${name}: generated artifact matches source modules.`);
  return true;
}

const entry = buildEntry();
const panel = buildPanel();
if (process.argv.includes("--check")) {
  check("entry.js", entry, "entry.js");
  check("ui/panel.html", panel, "ui/panel.html");
} else {
  fs.writeFileSync(path.join(ROOT, "entry.js"), entry);
  fs.writeFileSync(path.join(ROOT, "ui/panel.html"), panel);
  console.log("Built entry.js and ui/panel.html from modular source.");
}
