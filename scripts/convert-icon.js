const fs = require("fs");
const path = require("path");

async function convertIcons() {
  const sharp = require("sharp");
  const pngToIcoModule = require("png-to-ico");
  const pngToIco = pngToIcoModule.default ?? pngToIcoModule;

  const root = path.join(__dirname, "..");
  const buildAssetsDir = path.join(root, "build-assets");
  const publicDir = path.join(root, "apps", "web", "public");
  const svg = fs.readFileSync(path.join(buildAssetsDir, "icon.svg"));

  const render = (size) => sharp(svg, { density: Math.ceil((72 * size) / 28) }).resize(size, size).png();

  for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    await render(size).toFile(path.join(buildAssetsDir, `icon-${size}.png`));
  }
  await render(256).toFile(path.join(buildAssetsDir, "icon.png"));
  await render(192).toFile(path.join(publicDir, "favicon.png"));
  await render(180).toFile(path.join(publicDir, "apple-touch-icon.png"));

  const ico = await pngToIco([16, 32, 48, 256].map((s) => path.join(buildAssetsDir, `icon-${s}.png`)));
  fs.writeFileSync(path.join(buildAssetsDir, "icon.ico"), ico);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);
  console.log("Icons generated from build-assets/icon.svg");
}

convertIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
