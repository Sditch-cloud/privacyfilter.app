---
title: "HideMyData：基於相同 Privacy Filter 模型的 macOS 原生應用程式"
description: "HideMyData 是社群開發的 Mac 應用程式，在本機執行 openai/privacy-filter 模型，對 PDF 與圖片進行隱私去識別化——與本站採用同一個模型，但透過 MLX 與 Apple Vision 帶來原生體驗。"
pubDate: 2026-04-29
author: "Privacy Filter Team"
tags: ["releases", "macos", "open-source"]
---

想把截圖或 PDF 傳給別人，又擔心裡面有名字、Email、帳號沒清乾淨，於是在預覽程式裡反覆確認十分鐘——[HideMyData](https://github.com/mkbula/HideMyData) 想消滅的就是這種流程。

它是 [mkbula](https://github.com/mkbula) 開發的 macOS 原生應用程式，v0.1.0 才剛在 4 月 28 日推出。會引起我們注意的點是：它跑的是**與本站同一個 `openai/privacy-filter` 模型**——只是改用 [MLX-Swift](https://github.com/ml-explore/mlx-swift) 原生執行，PDF 與圖片的 OCR 則交給 Apple Vision。腦袋一樣，身體不同。

如果你用過 Privacy Filter Online，希望能一次處理一整疊 PDF 而不是一頁一頁複製貼上——現在有個 Mac 應用程式大致做到了這件事。在本機跑、開源、採用 GPL-3.0。雖然不是我們做的，但同源同根、專案本身也不錯，值得介紹一下。

## 它實際上能做什麼

把 PDF 或圖片拖進去，HideMyData 會分三層處理：

1. **Apple Vision OCR** 先把文字辨識出來——包括掃描的 PDF，以及那種把字型內嵌、選取時拿不到文字的「難搞 PDF」。
2. **privacy-filter 模型（MLX 8-bit 量化）** 進行與本站相同的 NER 推論，借助 Apple Neural Engine 與統一記憶體的優勢，根據上下文找出姓名、Email、電話、地址、日期、各類 ID。
3. **手工維護的正規表示式** 負責上下文幫不上忙的部分：IBAN、SSN、MAC 位址、IPv4/v6、JWT、API key、加密貨幣錢包地址等。確定性的樣式交給正規表示式，模糊的判斷則留給模型。

辨識完成後會產生一組遮蔽矩形，你可以自己調整——新增、刪除誤判、微調邊界。遮蔽樣式有兩種：純黑實底，或毛玻璃模糊。要做給人看的截圖時，毛玻璃看起來比較自然，也比較有質感。

按下儲存後，**遮蔽會被永久烙進檔案**。每頁都會被柵格化、重建——原本的字型與文字會真的從檔案中消失，而不是被蓋住。這比聽起來更重要。常見的 PDF 遮蔽事故，就是在上面畫個黑框就直接寄出：下面的文字還在，可以複製貼上，最後變成資料外洩。HideMyData 是把頁面整個重建，所以黑框底下沒有可還原的資料。

## 與 Privacy Filter Online 如何分工

我們做的是瀏覽器版。同一個模型，透過 Transformers.js 與 WebGPU/WASM 在分頁裡執行。如果只是臨時要清理一段文字、看一張圖，又不想安裝任何東西，瀏覽器版剛剛好。

HideMyData 更適合這些情況：

- **要處理 PDF**，特別是多頁 PDF 的時候。瀏覽器雖然能顯示 PDF，但拿來做遮蔽並不順手。
- **要處理掃描文件**——OCR 品質會直接影響結果，這方面 Apple Vision 真的滿強的。
- **不想每次 Chrome 清快取就重新下載一次模型**。原生應用程式會把模型放在 `~/Library/Application Support/HideMyData/`。
- **需要柵格化重建式的儲存行為**。Web 版給你的是可複製出來的文字遮蔽結果，不會替你改寫 PDF 檔案。

簡單說，就是同一個想法的原生版本，拿到了瀏覽器給不了的磁碟與 GPU 存取權。

## 實作中值得一提的地方

如果你對技術細節有興趣，幾個點值得提一下：

- **推論用 MLX-Swift**。在 Apple Silicon 上挑 MLX 是合理選擇——統一記憶體代表 GPU/CPU 之間不用搬資料，`openai/privacy-filter` 的 8-bit 量化版在工作記憶體中也很寬裕。
- **模型載入交由 OpenMedKit 處理**。它是把 Hugging Face 權重轉成 MLX 能讀的格式的 Swift 黏合層。
- **PDFKit + Vision + 模型 全部串在同一條流水線上**。每一層都是 Apple 原生元件——沒有 Python 副程式、也沒有 Electron，風扇不會狂轉，冷啟動也很快。

它在設計上還有一個值得稱讚的地方：沒有掉進「請相信我的智慧自動遮蔽」那種陷阱。儲存前有一個手動編輯的步驟——你看到模型的提案後，可以接受、修改，再確定永久寫入。對於「失誤就會洩露資料」的軟體，這種人機分工才合理。

## 注意事項

畢竟還是 v0.1.0，有幾件事要先知道：

- **macOS 26 以上、僅支援 Apple Silicon**。MLX 後端在 Intel Mac 上不會跑。
- **目前沒有用開發者憑證簽署**。首次啟動會被 Gatekeeper 擋下來，README 裡提供 `xattr -rd com.apple.quarantine /Applications/HideMyData.app` 的繞過方法。
- **首次模型下載大約 1.5 GB**。如果在飯店 Wi-Fi 上用，要先有心理準備。
- **授權是 GPL-3.0**，如果想嵌入商用產品，請先確認影響範圍。

簡單說就是早期階段的開源專案。需要的零件大致到位，倉庫裡的示範影片看起來也很乾淨，但粗糙之處難免，建議追一下 issue 列表會比較放心。

## 試試看

- 倉庫：[github.com/mkbula/HideMyData](https://github.com/mkbula/HideMyData)
- 最新版本：[v0.1.0](https://github.com/mkbula/HideMyData/releases/tag/v0.1.0)
- 兩個專案共用的模型：[openai/privacy-filter](https://huggingface.co/openai/privacy-filter)

如果你也用同一個模型在其他平台上做了點什麼，歡迎告訴我們。開放模型的意義就是這樣：瀏覽器工具、Mac 應用程式，以及未來會出現的其他東西，都能從不同角度切入同一個問題。
