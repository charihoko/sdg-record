SDG Record V1.0

■ 機能
- 測定日、測点（No.20～No.110）、左右、乾燥密度を登録
- SDG画面写真からOCR読取り
- OCR値の直接修正
- 端末内保存（localStorage）
- 一覧表示、修正、削除
- UTF-8 BOM付きCSV出力
- JSONバックアップ保存・読込
- 写真そのものは保存しません
- GitHubには測定データを送信しません

■ GitHub Pagesへの設置
1. このフォルダ内のファイルをGitHubリポジトリへアップロード
2. Settings → Pages
3. Deploy from a branch を選択
4. main / root を指定
5. 表示されたURLをiPhoneのSafariで開く
6. 共有 → ホーム画面に追加

■ 注意
- 測定データは利用端末内に保存されます。
- Safariの履歴・Webサイトデータ削除、端末故障・交換で消える可能性があります。
- 毎日または週末にCSVとバックアップJSONをOneDriveへ保存してください。
- OCRはTesseract.jsをCDNから読み込むため、初回OCR時はインターネット接続が必要です。
- OCR結果は必ずSDG画面と照合してください。
