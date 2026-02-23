# 圖片重新命名 + 壓縮工具（MVP v0.1）

## 概述

這是一個**非互動式的命令列工具**，用於批次壓縮和重新命名 JPG/JPEG 圖片。

工具會從固定的 `compress/` 資料夾讀取圖片，嘗試將每張圖片壓縮至 500 KB 以下（使用品質遞減策略），
並以 `NN-<slug>.jpg` 格式重新命名，最後輸出到 `done-compress/<slug>/` 資料夾，
同時產生機器可讀的 `result.json` 報表。

---

## 固定資料夾規則

| 資料夾 | 用途 |
|---|---|
| `compress/` | 執行前請將所有原始 JPG/JPEG 檔案放在此處 |
| `done-compress/<slug>/` | 所有輸出檔案和 `result.json` 會寫入這裡 |

- **工具絕不會修改 `compress/` 內的任何檔案。**
- 輸出結果永遠隔離在 `done-compress/<slug>/` 下。
- 如果 `done-compress/<slug>/` 已存在，工具會**停止並報錯** — 請先刪除舊資料夾。

---

## 安裝

```bash
cd rename-agent
npm install
```

---

## 使用方式

```bash
npm start -- <slug>
```

- `slug` 是唯一的必填參數。
- 允許的字元：小寫英文字母 `a-z`、數字 `0-9`、連字號 `-`。

**範例：**

```bash
# 將圖片放入 compress/ 後，執行：
npm start -- bangkok-chocolate-village
```

輸出結果會寫入：

```
done-compress/
  bangkok-chocolate-village/
    01-bangkok-chocolate-village.jpg
    02-bangkok-chocolate-village.jpg
    ...
    result.json
```

---

## 行為說明

1. 掃描 `compress/` 資料夾中的 `.jpg` / `.jpeg` 檔案（單層掃描，不區分大小寫）。
2. 依照檔案修改時間 `mtime` 升冪排序；相同時間的檔案則依檔名字母順序排序。
3. **階段一：品質遞減** — 從 JPEG 品質 90 → 85 → 80 → 75 → 70 → 65 → 60 → 55 → 50 → 45 → 40 逐步嘗試，直到輸出 ≤ 500 KB。
4. **階段二：尺寸縮放回退** — 若在品質 40 時仍超過 500 KB，會逐步縮小圖片尺寸（80% → 64% → 51%...）並維持品質 40，直到達標。
5. 若經過縮放嘗試後仍無法達標，檔案會被儲存並標記為 `cannot_reach_target`（目前設定下極為罕見）。
6. 單一檔案失敗（讀取 / 壓縮 / 寫入錯誤）會被記錄，**不會中斷整批處理**。
7. 產生 `result.json`，包含每個檔案的詳細資訊（含 `resizeScale` 欄位）和批次摘要。
8. 在終端機顯示最終摘要。

---

## result.json 欄位說明

### 批次摘要（Summary）

```jsonc
{
  "slug": "...",
  "inputDir": "compress",
  "outputDir": "done-compress/<slug>",
  "totalFound": 27,          // compress/ 中所有檔案
  "processableCount": 26,    // 僅 jpg/jpeg
  "processedCount": 26,
  "targetMetCount": 10,
  "targetNotMetCount": 16,
  "failedCount": 0,
  "skippedCount": 0
}
```

### 單一檔案狀態值

| 狀態 | 意義 |
|---|---|
| `ok` | 壓縮完成且在 500 KB 以內 |
| `cannot_reach_target` | 在最低品質和縮放後仍超過 500 KB；檔案仍會儲存 |
| `read_error` | 無法讀取原始檔案 |
| `compress_error` | 壓縮過程失敗 |
| `write_error` | 無法寫入輸出檔案 |
| `skipped_unsupported` | 檔案類型不支援（MVP 未使用） |

---

## MVP 限制

- 僅處理 `.jpg` / `.jpeg` 檔案 — `.png`、`.heic` 等會被忽略。
- 不使用 EXIF 排序（使用檔案系統的 `mtime`）。
- 縮放會維持長寬比，但超大檔案不會保持原始尺寸。
- 大多數照片可透過品質 + 縮放達到 500 KB 目標；極大/複雜的圖片極少數可能超標。
- Metadata / EXIF **不會保留**（壓縮時會移除）。
- 本版本不計畫支援 PNG。

---

## 開發

執行單元測試：

```bash
npm test
```

---

## 授權

MIT