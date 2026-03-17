const electron = require("electron");
console.log("typeof electron:", typeof electron);
console.log("typeof electron.app:", typeof electron.app);
console.log("keys:", Object.keys(electron).join(", "));
if (electron.app) {
  electron.app.whenReady().then(() => { console.log("app ready"); electron.app.quit(); });
} else {
  console.log("app is not available!");
  process.exit(1);
}
