# 451-calendar

学生向けのシンプルなカレンダーアプリ。課題・試験・授業を一括管理し、デバイス間で同期できる。

**→ [451-calendar.netlify.app](https://451-calendar.netlify.app)**

---

## Features

- **月カレンダー** — 8種類のカテゴリで色分け。繰り返し登録・複数日登録に対応
- **ダッシュボード** — 今月の予定数・近日のイベント一覧を表示。科目・種別でフィルタリング可能
- **時間割** — 7日×6〜7時限のグリッド。科目とアイコンをセルごとに設定してクラウド保存
- **クラウド同期** — Supabase によるリアルタイム同期。
- **PDF出力** — 印刷用に最適化されたカレンダービュー（印刷日・件数のメタデータ付き）
- **ダークモード** — システム設定に従うか、手動で切替

## Stack

| Layer    | Technology                   |
| -------- | ---------------------------- |
| Frontend | Vanilla JS / HTML / CSS      |
| Backend  | Supabase (Auth + PostgreSQL) |
| Deploy   | Netlify                      |
| Build    | esbuild                      |

外部フレームワークなし。アイコンはインライン SVG で管理（`src/js/icons.js`）。

## Project Structure

```
src/
├── index.html          # 紹介ページ
├── home.html           # アプリ本体
├── css/
│   ├── tokens.css      # デザイントークン（CSS変数）
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── timetable.css
│   └── print.css
├── js/
│   ├── app.js          # エントリポイント
│   ├── auth.js         # Supabase認証
│   ├── cloud.js        # クラウド同期
│   ├── render.js       # カレンダー描画・モーダル
│   ├── tabs.js         # タブナビゲーション
│   ├── timetable.js    # 時間割ビュー
│   ├── state.js        # グローバルstate・ユーティリティ
│   ├── icons.js        # インラインSVGレジストリ
│   └── config.js       # Supabaseクライアント初期化
└── favicon/
scripts/
├── check-js.mjs        # JS構文チェック
└── check-links.mjs     # ローカルリンク検証
```

## Development

```bash
npm install
npm run dev        # ローカルサーバー起動 (src/)
npm run check      # JS構文 + リンク検証
npm run build      # dist/ にminifyしてビルド
```

## Database

Supabase Project: **451-n** (ap-northeast-1)

| Table                | Purpose            |
| -------------------- | ------------------ |
| `calendar_app`       | カレンダーイベント |
| `calendar_timetable` | 時間割データ       |

RLS有効。認証はメール/パスワード方式。

## License

MIT
