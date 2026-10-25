#!/usr/bin/env node
/**
 * src/data/courses.json から距離ページの MDX を生成する。
 * 冪等: 同じ JSON からは常に同じ出力になる。
 * 出典 URL が無いエントリは生成せずエラーで落ちる（推測で埋めないため）。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src/data/courses.json");
const OUT = join(ROOT, "src/content/docs/racecourses");

const SURFACE_SLUG = { 芝: "turf", ダート: "dirt" };
const COURSE_SLUG = { 内回り: "inner", 外回り: "outer", 直線: "straight" };
const SURFACE_ORDER = { 芝: 0, ダート: 1 };
const COUNTRY_ORDER = [
  "アラブ首長国連邦",
  "サウジアラビア",
  "香港",
  "アメリカ合衆国",
  "イギリス",
  "アイルランド",
  "フランス",
  "オーストラリア",
  "ドイツ",
];

const isUrl = (v) => typeof v === "string" && /^https?:\/\/\S+$/.test(v);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function validate(venue) {
  const where = venue.name ?? venue.slug;
  if (!venue.slug) fail("slug が無い会場がある");
  if (!Array.isArray(venue.sources) || !venue.sources.every(isUrl)) {
    fail(`${where}: 会場の sources に http(s) URL が必要`);
  }
  if (!Array.isArray(venue.surfaces) || venue.surfaces.length === 0) {
    fail(`${where}: surfaces が空`);
  }
  for (const s of venue.surfaces) {
    const id = `${where} ${s.surface}${s.course ?? ""}`;
    if (!SURFACE_SLUG[s.surface]) fail(`${id}: surface は 芝 / ダート のみ`);
    if (s.course !== null && !COURSE_SLUG[s.course]) fail(`${id}: course は 内回り / 外回り / 直線 / null`);
    if (!Array.isArray(s.sources) || !s.sources.every(isUrl)) fail(`${id}: sources に http(s) URL が必要`);
    if (!Array.isArray(s.distances) || s.distances.length === 0) fail(`${id}: distances が空`);
    for (const d of s.distances) {
      if (!Number.isInteger(d)) fail(`${id}: distance ${d} が整数でない`);
    }
    if (new Set(s.distances).size !== s.distances.length) fail(`${id}: distances に重複がある`);
    for (const key of ["circumference", "width", "straight", "elevation", "bias"]) {
      if (s[key] === undefined) fail(`${id}: ${key} が無い（不明なら null）`);
    }
    for (const d of Object.keys(s.starts ?? {})) {
      if (!s.distances.includes(Number(d))) fail(`${id}: starts の ${d}m が distances に無い`);
    }
    for (const d of Object.keys(s.records ?? {})) {
      if (!s.distances.includes(Number(d))) fail(`${id}: records の ${d}m が distances に無い`);
    }
  }
}

const cell = (v) => (v === null || v === undefined || v === "" ? "未確認" : String(v));
const metres = (v) => {
  if (v === null || v === undefined || v === "") return "未確認";
  const s = String(v);
  return /^[0-9.]+$/.test(s) ? `${s}m` : s;
};

const titleOf = (venue, surface, distance) => {
  const label = `${venue.name.replace("競馬場", "")}${surface.surface}${distance}m`;
  return surface.course ? `${label}（${surface.course}）` : label;
};

function page(venue, surface, distance, order) {
  const title = titleOf(venue, surface, distance);
  const start = surface.starts?.[String(distance)] ?? null;
  const rec = surface.records?.[String(distance)] ?? null;

  const record = rec
    ? [
        "| タイム | 馬 | 騎手 | 日付 |",
        "| --- | --- | --- | --- |",
        `| ${cell(rec.time)} | ${cell(rec.horse)} | ${cell(rec.jockey)} | ${cell(rec.date)} |`,
      ].join("\n")
    : "コースレコードは未確認。";
  const sources = [
    ...new Set([
      ...surface.sources,
      ...venue.sources,
      ...(rec ? (venue.recordSources ?? []) : []),
    ]),
  ]
    .map((u) => `- ${u}`)
    .join("\n");

  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(`${venue.name} ${surface.surface}${distance}m${surface.course ? `（${surface.course}）` : ""} のスタート位置・直線・傾向。`)}
sidebar:
  order: ${order}
---

## コース概要

| 項目 | 内容 |
| --- | --- |
| 競馬場 | ${venue.name} |
| コース | ${surface.surface}${surface.course ? `（${surface.course}）` : ""} |
| 距離 | ${distance}m |
| スタート位置 | ${cell(start)} |
| 直線 | ${metres(surface.straight)} |
| 高低差 | ${metres(surface.elevation)} |
| 1周距離 | ${metres(surface.circumference)} |
| 幅員 | ${metres(surface.width)} |

## 傾向

${cell(surface.bias)}

## コースレコード

${record}

## 出典

${sources}

<Aside type="note" title="表記について">
  「未確認」は一次情報で裏取りできなかった項目。推測では埋めていない。
</Aside>
`;
}

function validateOverseas(venue) {
  if (!venue.slug) fail("海外会場: slug が無い");
  if (!Array.isArray(venue.sources) || !venue.sources.every(isUrl)) {
    fail(`${venue.name}: 海外会場の sources に http(s) URL が必要`);
  }
  if (!Array.isArray(venue.races) || venue.races.length === 0) fail(`${venue.name}: races が空`);
  for (const r of venue.races) {
    if (!r.name) fail(`${venue.name}: 競走名が無い`);
    if (!["芝", "ダート", "障害"].includes(r.surface)) fail(`${venue.name} ${r.name}: surface が不正`);
    if (!Number.isInteger(r.distance)) fail(`${venue.name} ${r.name}: distance が整数でない`);
  }
}

function overseasPage(venue, order) {
  const rows = venue.races
    .map(
      (r) =>
        `| ${cell(r.name)} | ${r.surface}${r.direction ? `・${r.direction}` : ""} | ${r.distance}m | ${cell(r.date)} |`,
    )
    .join("\n");
  const sources = [...new Set(venue.sources)].map((u) => `- ${u}`).join("\n");

  return `---
title: ${JSON.stringify(`${venue.name}競馬場`)}
description: ${JSON.stringify(`${venue.name}競馬場（${venue.country}）で JRA が馬券を発売する対象レースの一覧。`)}
sidebar:
  order: ${order}
---

## 概要

| 項目 | 内容 |
| --- | --- |
| 国・地域 | ${venue.country} |
| 競馬場 | ${venue.name} |
| JRA 発売対象レース | ${venue.races.length} 競走（2026年） |

## 発売対象レース（2026年）

| 競走名 | コース | 距離 | 実施予定日 |
| --- | --- | --- | --- |
${rows}

## コース情報

1周距離・直線・高低差は未確認（JRA の公開情報に記載がないため）。

## 出典

${sources}

<Aside type="note" title="表記について">
  「未確認」は一次情報で裏取りできなかった項目。推測では埋めていない。
</Aside>
`;
}

function overseasIndex(venues) {
  const byCountry = new Map();
  for (const v of venues) {
    if (!byCountry.has(v.country)) byCountry.set(v.country, []);
    byCountry.get(v.country).push(v);
  }
  const rows = [...byCountry.entries()]
    .map(
      ([country, list]) =>
        `| ${country} | ${list.map((v) => `[${v.name}](/racecourses/overseas/${v.slug}/)`).join("、")} |`,
    )
    .join("\n");
  const races = venues.reduce((n, v) => n + v.races.length, 0);

  return `---
title: 海外
description: JRA が馬券を発売する海外の競馬場を国別にまとめる。
sidebar:
  order: 40
---

JRA が馬券を発売する海外競馬のうち、2026年の指定競走が行われる会場を国別に並べる。対象は ${venues.length} 会場・${races} 競走。

| 国・地域 | 会場 |
| --- | --- |
${rows}

<Aside type="note" title="発売の条件">
  指定競走のうち、農林水産大臣の認可を受けた競走が対象。実際の発売は日本馬の出走予定がある場合に限られる。
</Aside>

## 出典

- https://www.jra.go.jp/keiba/overseas/racelist/release.html
- https://www.jra.go.jp/keiba/overseas/country/
`;
}

let data;
try {
  data = JSON.parse(await readFile(DATA, "utf8"));
} catch (error) {
  fail(`courses.json を読めない: ${error.message}`);
}
if (!Array.isArray(data.venues)) fail("courses.json: venues 配列が無い");
data.venues.forEach(validate);

function venuePage(venue, groups, links) {
  const courseNames = groups
    .map((s) => `${s.surface}${s.course ? `（${s.course}）` : ""}`)
    .join("、");
  const perSurface = (key) => {
    const parts = groups
      .filter((s) => s[key] !== null && s[key] !== undefined)
      .map((s) => `${s.surface}${s.course ? `（${s.course}）` : ""} ${metres(s[key])}`);
    return parts.length > 0 ? parts.join("／") : "未確認";
  };
  const rows = [
    venue.location ? `| 所在地 | ${venue.location} |` : null,
    `| コース | ${courseNames} |`,
    `| 直線 | ${perSurface("straight")} |`,
    `| 高低差 | ${perSurface("elevation")} |`,
  ]
    .filter(Boolean)
    .join("\n");
  const list = links.map((l) => `- [${l.title}](${l.href})`).join("\n");
  const sources = [...new Set(venue.sources)].map((u) => `- ${u}`).join("\n");

  return `---
title: ${JSON.stringify(venue.name)}
description: ${JSON.stringify(`${venue.name}のコース一覧と基本データ。`)}
sidebar:
  order: 0
---

| 項目 | 内容 |
| --- | --- |
${rows}

## 距離別ページ

${list}

## 出典

${sources}

<Aside type="note" title="表記について">
  「未確認」は一次情報で裏取りできなかった項目。推測では埋めていない。
</Aside>
`;
}

let written = 0;
for (const venue of data.venues) {
  const dir = join(OUT, venue.slug);
  await mkdir(dir, { recursive: true });
  const groups = [...venue.surfaces].sort(
    (a, b) =>
      SURFACE_ORDER[a.surface] - SURFACE_ORDER[b.surface] ||
      (a.course ?? "").localeCompare(b.course ?? "", "ja") ||
      Math.min(...a.distances) - Math.min(...b.distances),
  );
  let order = 0;
  const links = [];
  for (const surface of groups) {
    const suffix = surface.course ? `-${COURSE_SLUG[surface.course]}` : "";
    for (const distance of [...surface.distances].sort((a, b) => a - b)) {
      order += 1;
      const name = `${SURFACE_SLUG[surface.surface]}-${distance}${suffix}`;
      await writeFile(join(dir, `${name}.mdx`), page(venue, surface, distance, order), "utf8");
      links.push({ title: titleOf(venue, surface, distance), href: `/racecourses/${venue.slug}/${name}/` });
      written += 1;
    }
  }
  if (!venue.handWritten) {
    await writeFile(join(dir, "index.mdx"), venuePage(venue, groups, links), "utf8");
    written += 1;
  }
}

function courseIndex(venues, overseas) {
  const row = (v) =>
    `| [${v.name}](/racecourses/${v.slug}/) | ${v.location ?? "未確認"} | ${v.surfaces
      .map((s) => s.surface + (s.course ? `（${s.course}）` : ""))
      .join("、")} |`;
  const central = venues.filter((v) => v.region === "central").sort((a, b) => a.order - b.order);
  const local = venues.filter((v) => v.region === "local").sort((a, b) => a.order - b.order);
  const races = overseas.reduce((n, v) => n + v.races.length, 0);
  const countries = new Set(overseas.map((v) => v.country)).size;
  const total = venues.reduce(
    (n, v) => n + v.surfaces.reduce((m, s) => m + s.distances.length, 0),
    0,
  );

  return `---
title: 競馬場一覧
description: 中央・地方・海外の競馬場を、距離別ページへのリンク付きでまとめる。
sidebar:
  order: 2
---

距離別のページは ${total} 件。各ページにスタート位置・直線・高低差・傾向・出典を載せている。

## 中央競馬（JRA）

| 競馬場 | 所在地 | コース |
| --- | --- | --- |
${central.map(row).join("\n")}

## 地方競馬

| 競馬場 | 所在地 | コース |
| --- | --- | --- |
${local.map(row).join("\n")}

## 海外

JRA が馬券を発売する海外の会場 ${overseas.length} か所（${countries} か国・${races} 競走）は [海外の競馬場](/racecourses/overseas/) にまとめている。

<Aside type="note" title="未確認について">
  一次情報で裏取りできなかった項目は「未確認」と書いている。推測では埋めていない。
</Aside>

## ページを足す

距離ページは \`src/data/courses.json\` から生成する。手で MDX を書く必要はない。

1. \`courses.json\` の該当会場に距離を足す（\`sources\` は必須）
2. \`pnpm gen:courses\` を実行
3. \`pnpm lint:docs\` と \`pnpm build\` で確認

## 出典

- 中央 10 場のコースデータ: https://www.jra.go.jp/facilities/race/
- 地方 15 場のコースデータ: https://www.keiba.go.jp/guide/course/
- 海外の指定競走: https://www.jra.go.jp/keiba/overseas/racelist/release.html
`;
}

const overseas = data.overseas ?? [];
if (overseas.length > 0) {
  overseas.forEach(validateOverseas);
  const dir = join(OUT, "overseas");
  await mkdir(dir, { recursive: true });
  const sorted = [...overseas].sort(
    (a, b) =>
      COUNTRY_ORDER.indexOf(a.country) - COUNTRY_ORDER.indexOf(b.country) ||
      a.name.localeCompare(b.name, "ja"),
  );
  let order = 0;
  for (const venue of sorted) {
    order += 1;
    await writeFile(join(dir, `${venue.slug}.mdx`), overseasPage(venue, order), "utf8");
    written += 1;
  }
  await writeFile(join(dir, "index.mdx"), overseasIndex(sorted), "utf8");
  written += 1;
}

await writeFile(join(OUT, "index.mdx"), courseIndex(data.venues, overseas), "utf8");
written += 1;

console.log(`✓ ${data.venues.length} 場 / ${overseas.length} 海外会場 / ${written} ページを生成 → src/content/docs/racecourses/`);
