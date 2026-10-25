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
| `pnpm lint:docs` | リンク・frontmatter・見出しの検査（`--fix` で自動修正） |
| `pnpm deploy` | `astro check` → `astro build` → `wrangler deploy` |

## デプロイ

```sh
pnpm exec wrangler login   # 初回のみ
pnpm deploy
```

`wrangler` が Worker の URL（`https://horse-racecourses-memo.<subdomain>.workers.dev`）を出力する。デプロイ前に中身を確認したいときは `pnpm exec wrangler deploy --dry-run`。

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
