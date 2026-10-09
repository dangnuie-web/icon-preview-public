// examples/ 의 예시 아이콘(svg · png · jpg · webp)을 512px 정사각형 PNG 로 만들고,
// 미리보기 페이지(index.html), 예시마다의 설치 페이지(install/<번호>/), 내 그림용 설치 페이지(install/mine/)를 dist/ 에 내놓는다.
// `npm run build` 뒤 `npm start` 로 띄운다.
//
// examples/ 에는 처음 보는 사람을 위한 예시만 둔다. 쓰는 사람의 시안은 폰에서 "그림 추가"로 넣고, 그 기기 브라우저에만 남는다.
// 번호는 파일 이름 순서다 ("example_1.svg", "example_2.svg" … 처럼 끝의 숫자를 알아듣는다).
// SVG 는 아이콘 네모 밖으로 그림이 삐져나와 있어도 되게, 첫 정사각형 <rect> 를 네모로 보고 그만큼만 잘라낸다.
// PNG · JPG 가 정사각형이 아니면 가운데를 잘라 넣는다.

import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES = path.join(ROOT, "examples");
const DIST = path.join(ROOT, "dist");
const SIDE = 512;

const appName = "앱 이름"; // 기본값. 쓰는 사람은 화면에서 바꾸고, 그 값은 그 기기에만 남는다
// 배포마다 달라지는 표식. 같은 이름으로 그림만 바뀌어도 브라우저가 옛 그림을 다시 쓰지 않게 주소 뒤에 붙인다.
// 배포 서비스가 커밋 번호를 주면(Vercel) 그걸 쓰고, 아니면 시각으로 대신한다
const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? String(Date.now());

// SVG 안의 첫 정사각형 <rect> — 아이콘 네모. 없으면 그림 전체를 쓴다
function squareOf(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  for (const [, attrs] of svg.matchAll(/<rect\b([^>]*)\/?>/g)) {
    const get = (name) => Number(attrs.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] ?? 0);
    const width = get("width");
    if (width > 0 && width === get("height")) return { x: get("x"), y: get("y"), size: width, viewBox };
  }
  return { viewBox };
}

async function toSquarePng(file) {
  const isSvg = file.toLowerCase().endsWith(".svg");
  const source = await readFile(file);
  const rendered = await sharp(source).png().toBuffer();
  const { width, height } = await sharp(rendered).metadata();

  let crop = { left: 0, top: 0, size: Math.min(width, height) };
  if (isSvg) {
    const { x, y, size, viewBox } = squareOf(source.toString("utf8"));
    // viewBox 단위 → 그려진 픽셀 단위 (보통 1:1)
    const scale = viewBox ? width / viewBox[2] : 1;
    if (size) crop = { left: Math.round(x * scale), top: Math.round(y * scale), size: Math.round(size * scale) };
  } else {
    // 가운데를 정사각형으로
    crop = { left: Math.round((width - crop.size) / 2), top: Math.round((height - crop.size) / 2), size: crop.size };
  }
  crop.size = Math.min(crop.size, width - crop.left, height - crop.top);

  return sharp(rendered).extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size }).resize(SIDE, SIDE).png().toBuffer();
}

// 이름 끝의 숫자가 순서다 ("logo_3.svg" → 3). 숫자가 없으면 0 이라 맨 앞에 온다 ("logo.svg" 가 1번). 같으면 이름순
function orderOf(fileName) {
  return Number(fileName.match(/(\d+)\.[^.]+$/)?.[1] ?? 0);
}

// examples/ 가 비었거나 없어도 빌드는 된다. 그때는 예시 0개로 페이지만 만든다
const names = await readdir(EXAMPLES).catch((error) => {
  if (error.code === "ENOENT") return [];
  throw error;
});
const files = names
  .filter((f) => /\.(svg|png|jpe?g|webp)$/i.test(f))
  .sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b, undefined, { numeric: true }));

await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, "examples"), { recursive: true });

const list = [];
for (const [i, file] of files.entries()) {
  const n = i + 1;
  await writeFile(path.join(DIST, "examples", `${n}.png`), await toSquarePng(path.join(EXAMPLES, file)));
  list.push({ n, name: file.replace(/\.[^.]+$/, "") });
  console.log(`${n}번 ← ${file}`);
}

await writeFile(path.join(DIST, "examples.json"), JSON.stringify({ appName, version, examples: list }));

// 미리보기 페이지
await cp(path.join(ROOT, "src/index.html"), path.join(DIST, "index.html"));

// 예시마다의 설치 페이지. 아이폰은 "홈 화면에 추가"할 때 그 페이지의 apple-touch-icon 을 아이콘으로 쓴다
const template = await readFile(path.join(ROOT, "src/install.html"), "utf8");
for (const { n, name } of list) {
  const html = template
    .replaceAll("{{N}}", String(n))
    .replaceAll("{{NAME}}", name)
    .replaceAll("{{APP_NAME}}", appName)
    .replaceAll("{{VERSION}}", version);
  await mkdir(path.join(DIST, "install", String(n)), { recursive: true });
  await writeFile(path.join(DIST, "install", String(n), "index.html"), html);
}

// 내 그림용 설치 페이지. 그림은 서버에 없으니 이 페이지가 브라우저 저장소에서 꺼내 apple-touch-icon 으로 단다 (아이폰에서 되는지는 README 참고)
await mkdir(path.join(DIST, "install", "mine"), { recursive: true });
await cp(path.join(ROOT, "src/install-mine.html"), path.join(DIST, "install", "mine", "index.html"));

console.log(`\n예시 ${list.length}개로 dist/ 를 만들었어요.`);
