import sharp from "sharp";
import { writeFile } from "node:fs/promises";

async function main() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#f4dfc2"/><circle cx="600" cy="450" r="280" fill="#e2542c"/><rect x="430" y="300" width="340" height="90" rx="24" fill="#f8eddc"/><circle cx="520" cy="500" r="26" fill="#251e17"/><circle cx="680" cy="500" r="26" fill="#251e17"/><path d="M540 560c36 30 84 30 120 0" fill="none" stroke="#251e17" stroke-width="22" stroke-linecap="round"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile("tests/fixtures/sample-photo.png");
  await writeFile(
    "tests/fixtures/not-an-image.txt",
    "Это не изображение, а текстовый файл для проверки сервера.",
  );
  console.log("fixtures ready");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
