# 競馬場メモ

Nimbus（Astro 7）で動く日本語ドキュメントサイト。競馬場ごとのコース形状・アクセス・開催の傾向を 1 場 1 ページでまとめる。

- フレームワーク: [Nimbus](https://nimbus-docs.com/) `@cloudflare/nimbus-docs` 0.19 / Astro 7.4.2
- 出力: Cloudflare Workers（`@astrojs/cloudflare`、全ページ prerender）
- デプロイ: `wrangler deploy`

## 必要環境

- Node 22.12 以上
- pnpm

## セットアップ

```sh
pnpm install
pnpm dev
```

`http://localhost:4321/` が開く。保存するとその場で反映される。

## ページを追加する

`src/content/docs/` に `.mdx` を置くと、URL とサイドバーに自動で反映される。ファイルパスが URL になる。

```mdx title="src/content/docs/racecourses/hanshin.mdx"
---
title: 阪神競馬場
description: コース形状とアクセスのメモ。
sidebar:
  order: 6
---

本文。
```

- `title` は必須。それ以外は任意。
- 並び順は `sidebar.order`。
- 利用できる MDX コンポーネントは `src/components.ts` を参照（`Aside`、`Steps`、`Tabs` など）。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー（`astro dev`） |
| `pnpm build` | 本番ビルド → `dist/` |
| `pnpm preview` | ビルド結果をローカルで確認（静的プレビュー） |
| `pnpm preview:worker` | `wrangler dev` で本番と同じ形で確認 |
| `pnpm typecheck` | `astro check` |
| `pnpm fmt` | oxfmt で整形（`src/content/` と `*.md` は対象外） |
| `pnpm fmt:check` | 整形済みか確認（CI と同じ） |
| `pnpm lint:docs` | 記事の lint（リンク・frontmatter・見出し）。ビルド後に実行する |
| `pnpm lint:docs:fix` | 自動修正できる指摘を直す |
| `pnpm deploy` | `astro check` → `astro build` → `lint:docs` → `wrangler deploy` |

## デプロイ

```sh
pnpm exec wrangler login   # 初回のみ
pnpm deploy
```

`wrangler` が Worker の URL（`https://horse-racecourses-memo.<subdomain>.workers.dev`）を出力する。デプロイ前に中身を確認したいときは `pnpm exec wrangler deploy --dry-run`。

## Lint

`pnpm lint:docs` は `astro.config.ts` の `rules` で有効にした記事ルールを実行する。リンク検査はビルドが書く `.nimbus/routes.json` を見るので、**先に `pnpm build`**（`.nimbus/` は git 管理外）。

- `error`: 壊れたリンク・画像、`description` 欠落、frontmatter 不正など。1 件でもあれば終了コード 1。
- `warn`: 見出しの句読点、強調・リストの記法など。表示されるが失敗にはしない。
- `nimbus/bare-url` は無効。出典は URL をそのまま並べる方針のため。
- ルールを足すときは `rules` に追記 → `pnpm build` → `pnpm lint:docs` で現状を確認してから直す。
- `pnpm deploy` と GitHub Actions（`.github/workflows/lint.yml`）は build → lint の順で実行する。

## 依存とフォーマット

依存のバージョンは `pnpm-workspace.yaml` の `catalog` に完全固定で書き、`package.json` は `"catalog:"` だけを持つ。`catalogMode: strict` と `saveExact: true` を効かせてあるので、`pnpm add` も catalog 経由・固定バージョンで入る。上げるときは `pnpm-workspace.yaml` の該当行を書き換えて `pnpm install`。pnpm 自体のバージョンは `package.json` の `packageManager` で固定する（CI もこれを見る）。

整形は oxfmt（`oxfmt.config.ts`）。`src/content/` の MDX とルートの `*.md` は本文なので対象外。`.astro` は `@astrojs/compiler-rs` 経由で整形する。

## ドメイン

配信ドメインは 2 箇所に書いてある。片方だけ変えると canonical URL と実際の配信先がずれる。

| ファイル | 設定 | 役割 |
| --- | --- | --- |
| `astro.config.ts` | `site: "https://racecourses-memo.koralle-mgmg.com"` | canonical / OG 画像 / sitemap / `llms.txt` の基準 |
| `wrangler.jsonc` | `routes[0].pattern` + `custom_domain: true` | 実際の配信先。初回デプロイ時にドメインが割り当たる |

`custom_domain` は `koralle-mgmg.com` が同じ Cloudflare アカウントのゾーンにある前提。別アカウントならダッシュボードで Custom Domain を設定する。

## アダプタ設定の注意

`astro.config.ts` の `adapter: cloudflare({ prerenderEnvironment: "node" })` は外さないこと。アダプタは既定で prerender を workerd 内で実行するが、Nimbus の OG 画像生成は satori + resvg（Node 専用）なので `[og] satori is installed but failed to load` でビルドが落ちる。

`output` は `"server"`。ページはすべてビルド時に prerender されるので、実行時レンダリングは発生しない。

## 構成

| パス | 中身 |
| --- | --- |
| `src/content/docs/` | 記事本体（MDX）。木構造 = URL = サイドバー |
| `src/components/ui/` | 部品（Aside、Steps、Tabs など） |
| `src/styles/` | デザイントークンと本文スタイル |
| `astro.config.ts` | サイト名・説明・サイドバー構成・Cloudflare アダプタ |
| `wrangler.jsonc` | Worker 名・静的アセット・compatibility date |
| `nimbus.json` | Nimbus CLI の導入記録。コミットする |
| `AGENT.md` | コーディングエージェント向けの作業ガイド |

## 収録範囲（確定事項）

| 区分 | 範囲 | 根拠 |
| --- | --- | --- |
| 中央 10 場 | 135 距離（芝 88 / ダート 47） | JRA コース紹介ページの「発走距離」 |
| 地方 15 場 | 109 距離 | NAR「コースレコード一覧」に収載された距離 |
| 海外 | 9 か国 31 会場 116 競走 | JRA「指定競走」一覧（2026年） |

- 地方の「全距離」は NAR が全施行距離の一覧を公開していないため、コースレコードに記録がある距離を採用している。
- 海外は当初 8 か国を想定していたが、2026 年の指定競走拡大でドイツ 3 会場（ホッペガルテン・バーデンバーデン・ケルン）が加わり 9 か国になったため、全 31 会場を収録する。
- 障害コースは対象外。

## 未確認の扱い

一次情報で裏取りできなかった項目は「未確認」と明記し、推測では埋めていない。主なもの:

- 中央のスタート位置（JRA が距離別に文章で公開していない距離）
- 内回り・外回りで距離が重複するコースのレコード（どちらの記録か特定できない 16 件）
- 海外会場の 1 周距離・直線・高低差
