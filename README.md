# 原稿を、本にする — Word → Kindle EPUB3 変換ツール

Word 原稿（`.docx`）を、Amazon KDP にそのままアップロードできる **EPUB3** に変換するブラウザ製ツールです。
変換処理はすべてブラウザ内で完結し、原稿や画像が外部サーバーへ送信されることはありません。

## 機能

- `.docx` のドラッグ&ドロップ取り込み（`mammoth` による解析）
- 見出し1での章の自動分割、画像の自動抽出
- 書籍メタデータ入力（タイトル / 著者 / 言語 / ISBN / 紹介文 ほか）
- 表紙画像の設定（JPEG / PNG / WebP）
- 縦書き / 横書きの切り替え（縦書きは右綴じ・`page-progression-direction="rtl"`）
- EPUB3 生成（`mimetype` 無圧縮先頭・`content.opf` / `nav.xhtml` / `toc.ncx` を正規生成）

## 技術スタック

React + Vite + TypeScript + Tailwind CSS / `mammoth` / `JSZip` / `file-saver`

## 開発

```bash
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド (dist/)
npm run preview  # ビルド結果のプレビュー
node --import tsx scripts/test-convert.mjs  # 変換ロジックの統合テスト
```

## ライセンス

MIT
