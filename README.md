# びわ湖大花火大会 混雑マップ生成ツール

なぎさ公園〜びわ湖ホール〜プロムナードの観覧エリアをブロック分けし、
各ブロックの混雑度（1〜5）を入力するとヒートマップ風に色分けされた
画像（PNG）を生成できるツールです。GitHub Pages だけで動作します
（サーバー・データベース不要）。

地図は **OpenStreetMap のデータから生成した実形状の地図**です。
画像右下の「地図データ © OpenStreetMap contributors」の表記は
ライセンス（ODbL）上必須なので削除しないでください。

## 当日の使い方

1. サイトを開く（GitHub Pages のURL）
2. 「時刻表示」の **現在時刻** ボタンを押す
3. 各ブロックの混雑度を入力する
   - 右側パネルの 1〜5 ボタンを押す、**または** 地図上のブロックを直接タップ（タップするたびに 未入力→1→2→…→5→未入力 と切り替わります）
4. **画像（PNG）を保存** ボタンを押す → `konzatsu-map_日付_時刻.png` がダウンロードされる
5. ダウンロードした画像を公式サイトに貼り付ける

入力内容はブラウザ（端末ごと）に自動保存されるので、ページを閉じても消えません。
次の時間帯は数値を打ち替えて再度保存するだけでOKです。

## GitHub Pages の公開手順（初回のみ）

このリポジトリには自動デプロイ用のワークフロー（`.github/workflows/pages.yml`）が
入っています。

1. GitHub のリポジトリページ → **Settings** → **Pages**
2. 「Build and deployment」の Source を **GitHub Actions** にする
3. ブランチにプッシュすると自動でデプロイされ、
   `https://<ユーザー名>.github.io/biwako_map/` で公開されます
   （Actions タブで進行状況を確認できます）

Source を「Deploy from a branch」にしてブランチを選ぶ方法でも公開できます。
その場合はブランチ選択後に **Save** を押し忘れないでください。

## カスタマイズ

### ブロックの位置・数・名前を変える

`blocks.js` の `BLOCKS` 配列を編集します。座標は地図（1280×720）基準です。

```js
{ id: "A1", area: "打出の森 湖側", x: 356, y: 326, w: 64, h: 60, rot: -16 },
```

- `id` … 画像に表示されるブロック名
- `area` … 入力パネルに表示されるエリア名
- `x, y, w, h` … 位置とサイズ
- `rot` … 回転角（度）。湖岸の向きに合わせたい時に使います（省略可）

行を追加・削除すれば、ブロック数も自由に変えられます。

### 混雑度の色・ラベルを変える

`blocks.js` の `LEVELS` 配列を編集します。
現在の配色は色覚多様性（色弱）に配慮して検証済みのものです。
変更する場合も、各ブロックに数字が表示されるため意味は数字でも伝わります。

### 地図（ベースマップ）を作り直す

ベースマップ（`basemap.js`）は OpenStreetMap のデータから
`tools/build_map.js` で自動生成しています。表示範囲やズームを変えたい場合：

1. OSMデータを取得（Overpass API）：
   ```
   curl -X POST -d @tools/overpass.ql  "https://overpass-api.de/api/interpreter" -o osm.json
   curl -X POST -d @tools/overpass2.ql "https://overpass-api.de/api/interpreter" -o osm2.json
   ```
2. `tools/build_map.js` の `SPAN_M`（表示幅・メートル）や `CX_M / CY_M`（中心のずらし量）を調整
3. `node tools/build_map.js` を実行（osm.json と同じフォルダで）→ `basemap.js` ができるのでリポジトリ直下に置き換え

地名ラベルや「入口・本部」の目印は `index.html` の `<g id="labels">` /
`<g id="badges">` にあり、直接編集できます。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | ページ本体＋ラベル・凡例などのSVG |
| `basemap.js` | OpenStreetMap由来のベースマップ（自動生成・手で編集しない） |
| `blocks.js` | ブロック定義・混雑度レベル定義（**調整はまずここ**） |
| `app.js` | 入力・色分け・PNG書き出しの処理 |
| `style.css` | 画面のスタイル |
| `tools/` | ベースマップ再生成用スクリプト |
| `.github/workflows/pages.yml` | GitHub Pages 自動デプロイ |
