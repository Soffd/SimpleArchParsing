# Simple 游戏存档解析器

适用于 `com.gooseeggstudio.simple`（Goose Egg Studio「Simple」，Unity IL2CPP + xLua 音游/剧情游戏）v1.2.0 (versionCode 33)。

提供浏览器成绩分析页面和 Python 命令行解析器。网页使用贴近游戏的浅灰白底、青绿色、菱形和胶囊曲名栏，支持黑色夜间模式。存档在本地解析，工具只读，不写回游戏存档。

## 快速开始

在项目根目录运行（需要 Python 3）：

```bash
python -m http.server 8000 --bind 127.0.0.1 --directory web
```

打开 [本地网页](http://127.0.0.1:8000/)，粘贴游戏存档码后点击「解析」，或选择 `player0.save` 文件。没有存档时可点击「载入示例」。结束预览时，在运行服务的终端按 `Ctrl+C`。

也可直接打开 `web/index.html`；海报导出建议使用上述 HTTP 方式，避免浏览器对本地图片的访问限制。系统使用 `python3` 命令时，将示例中的 `python` 替换为 `python3`。

## 网页功能

- **主题与布局**：首次跟随系统，手动选择日间 / 夜间模式后在本机记住选择；首页直接进入存档导入区。
- **成绩概览**：玩家信息、平均 ACC、记录数量、零 Miss 谱面、音符总数及最高已游玩等级。
- **成绩洞察**：各难度平均 ACC、ACC 区间分布、早晚 Good/Bad 比例，以及按理论可恢复 ACC 排列的练习建议。
- **成绩档案**：大圆角曲绘、胶囊曲名、作曲信息、排名、难度、Lv、SCORE、原生字母评级、ACC 和 P/G/B/M 判定；桌面三列，中等宽度两列，手机单列。
- **图表与明细**：总体判定环形图、各谱面 ACC 条形图、判定构成堆叠图，以及可点击表头排序的明细表。
- **查看与导出**：点击曲绘查看高清图，支持左右方向键切换、Esc 关闭、下载原图 PNG；支持三列成绩海报和复制解析 JSON。

### 筛选与排序

| 区域 | 操作与范围 |
|---|---|
| 成绩卡片与明细表 | 曲名 / 难度搜索、难度选择、AP / 零 Miss / 存在 Miss 组合筛选；卡片可按 ACC、分数、评级、难度、Lv 升降序排列，明细表可独立排序 |
| 各谱面 ACC | 独立选择难度、Lv、ACC、分数、评级、曲名，以及升序 / 降序 |
| 判定构成 | 与 ACC 图独立选择排序条件及方向，标签包含难度与 Lv |
| 概览、洞察及两张谱面图 | 使用整份存档，不受成绩档案筛选影响 |
| 成绩海报 | 导出整份存档，按 ACC 降序，使用当前主题、ACC 权重及聚合方式 |

两张谱面图默认按难度升序：`SP → CM → CL → OL`，同难度按 Lv 升序，同难度同 Lv 内按 ACC 降序。按 Lv 排序时，同 Lv 内也按 ACC 降序；`12+` 排在 `12` 与 `13` 之间，未知 Lv 始终置后。调整公式或窗口尺寸后保留图表排序选择。

### ACC、分数与评级

```text
Good = earlyGood + lateGood
Bad  = earlyBad + lateBad
判定总和 = Perfect + Good + Bad + Miss
ACC  = (Perfect + Good权重 × Good + Bad权重 × Bad) / 判定总和
SCORE = floor((Perfect + 0.6 × Good) × 10000 / 音符总数) × 100
      + floor(min(最大连击, 音符总数) × 100000 / 音符总数)
```

- 默认 Good 权重为 `0.6`、Bad 权重为 `0`，可在「高级设置」调整。ACC 百分比截断到两位小数。
- 分数的音符总数优先使用大于 0 的 `fullComboCount`，否则使用判定总和；ACC 始终使用判定总和作分母。分数两项分别向下取整，满分为 1,100,000。
- 平均 ACC 默认按判定数加权，也可切换为各谱面等权平均。
- 分数和评级固定使用游戏口径（Good=0.6、Bad=0），不受自定义 ACC 权重影响。概览评级按游戏口径的加权平均 ACC 计算。
- 公式与评级阈值来自逆向拟合；ACC 不按谱面难度修正，比较表现时建议结合难度与 Lv 排序。
- **零 Miss**：有实际判定且 Miss 为 0，不直接等同游戏官方 FC。**AP**：有实际判定且全部为 Perfect。
- 难度表现和 ACC 分布排除零判定记录；早晚偏向只统计 Good 与 Bad，不据此推断设备延迟。
- 练习建议按 Good / Bad / Miss 全部转为 Perfect 可恢复的单谱面 ACC 排列，只表示理论空间，不是提分预测。
- 存档成绩是最佳记录，不能用于还原每次游玩的历史或进步趋势。

评级按未截断的游戏口径 ACC 判定，升序为 `F → D → C → B → A → S → S+ → P`：

| 评级 | ACC 下限 |
|---|---|
| P | 99.9% |
| S+ | 99% |
| S | 98% |
| A | 90% |
| B | 80% |
| C | 70% |
| D | 60% |
| F | 低于 60% |

阈值为逆向推测，可通过 `META.GRADE_THRESHOLDS` 覆盖。结算样本 `Perfect=532、Good=2、Bad=0、Miss=0、音符数=534、最大连击=534` 对应 **1,098,500 分 / 99.85% / S+**。内置 `MockPlayer` 演示数据默认加权 ACC 为 **98.20%**。

难度主题色：SP `#007087`、CM `#b76e16`、CL `#d75645`、OL `#c442ba`。成绩海报包含分数、字母评级与 ACC，底部署名为 `by SimpleArchParsing`。

## 文件

| 文件 | 说明 |
|---|---|
| `simple_save_parser.py` | 命令行解析器，纯 Python 3，无第三方依赖 |
| `Config_Music.csv` | 游戏内置曲目表（从 APK 提取），供 `--music` 参数映射曲名 |
| `web/` | 静态网页，页面、样式、解析、统计与展示代码分目录保存 |

## 存档位置

游戏存档文件名为 `player0.save`（另有 `logs.save` 是日志，非存档）：

```
/sdcard/Android/data/com.gooseeggstudio.simple/files/player0.save
```

这是 Unity 的 `Application.persistentDataPath`。Android 11+ 需用 MT 管理器等文件管理器进入 `Android/data`（或 adb / Shizuku）。

> 注意：TapTap SDK 还提供云存档接口（TapGameSave），云端存档内容与此相同。

## 命令行用法

```bash
# 完整 JSON 输出
python3 simple_save_parser.py player0.save

# 人性化摘要（玩家名、成绩 Top20、解锁条目）
python3 simple_save_parser.py player0.save --summary

# 附带曲名/作曲（需要 Config_Music.csv）
python3 simple_save_parser.py player0.save --music Config_Music.csv

# 直接从 hex 字符串解析（方便在 MT 管理器里复制）
python3 simple_save_parser.py --hex "0A0B546573746572..."

# 直接解析游戏内分享/云同步的“存档同步码”（Base64 文本，一行搞定）
python3 simple_save_parser.py --base64 "CgpTb2ZmZEBsaW5l..."

# 把同步码保存为 .txt 文件也可以（自动识别 Base64 文本）
python3 simple_save_parser.py sync_code.txt --summary

# 通用 TLV 转储（不依赖已知 schema）
python3 simple_save_parser.py player0.save --raw

# 输出到文件
python3 simple_save_parser.py player0.save -o out.json
```

Python 命令行还支持 gzip/zlib 包装、JSON 文本的自动识别。网页目前支持 Protobuf 二进制文件、Base64 文本文件及粘贴的 Base64 / hex 文本，不支持 gzip/zlib 和 JSON 输入。Protobuf 未知字段保留在 `_unknown` 中。

## 存档格式（逆向结果）

文件为 **Google Protobuf (proto3) 二进制**，顶层消息 `SimpleProto.PlayerInfo`。
以下 IDL 通过分析 APK 内 IL2CPP 元数据（`global-metadata.dat`）中内嵌的
`FileDescriptorProto` 还原，字段号与类型均经原始描述符字节验证：

```proto
syntax = "proto3";
package SimpleProto;

message PlayerInfo {
  string playerName = 1;                  // 玩家名
  repeated SongScore scores = 2;          // 各谱面成绩
  map<string, bool> unlockedStatus = 3;   // 解锁状态（key 形如 "章节-难度序号"）
  string unionId = 4;                     // TapTap unionId
  string deviceInfo = 5;                  // 设备信息
}

message SongScore {
  Chapter chapter = 1;   // 章节
  string musicName = 2;  // 曲目标识（对应 Config_Music 的 MusicName）
  Hard hard = 3;         // 难度
  // 4..9 未使用（历史遗留）
  int32 perfect = 10;
  int32 earlyGood = 11;
  int32 lateGood = 12;
  int32 earlyBad = 13;
  int32 lateBad = 14;
  int32 miss = 15;
  int32 fullComboCount = 16;  // 实测作为谱面音符总数使用，并非全连次数
  int32 maxComboCount = 17;   // 最大连击
}

enum Chapter {
  Invalid = 0;
  Chapter1 = 1;
  Chapter2 = 2;
  Crystle = 3;
  Public = 4;
  Huanyun = 5;      // 超验解离（Cloud of Illusion 联动）
  Start = 9000;     // 启明（新手教程）
  Single = 9001;    // 单曲
  AprilFool = 9002; // 愚人戏宴（2026 愚人节）
}

enum Hard {
  Sp = 0;  // SP
  Cm = 1;  // CM
  Cl = 2;  // CL
  Ol = 3;  // OL
}
```

## 存档同步码（云同步/分享码）

游戏内分享/云同步用的“存档码/同步码”就是本地存档内容的 Base64：

```
Base64( player0.save )  ==  Base64( SimpleProto.PlayerInfo )
```

解码后与 `player0.save` 使用相同的 Protobuf 结构。Python 命令行在识别同步码时将 `_container` 标记为 `base64 (存档同步码)`；网页的容器标记取决于传入解析层的是 Base64 文本字节还是已解码的二进制。

⚠️ 隐私提醒：同步码中包含玩家名、TapTap unionId、设备型号等信息，分享前请确认无隐私顾虑。

## 项目结构与维护

`web/` 是无需构建、无需业务后端的静态站点，HTML、CSS 与 JavaScript 分开维护。

### 目录结构

```
web/
├── index.html              页面结构与脚本入口（无内嵌业务逻辑）
├── styles/                 基础组件样式、响应式布局与黑白主题
├── js/
│   ├── data.js             元数据配置与难度枚举
│   ├── app.js              输入处理、状态更新、事件绑定
│   ├── parser/             Protobuf / Base64 / hex 解析，不依赖 DOM
│   ├── analysis/           ACC、分数、评级、筛选与成绩洞察计算
│   ├── ui/                 主题、成绩卡片、图表、大图查看器
│   └── export/             Canvas 三列成绩海报
├── tests/regression.cjs    Node.js 回归检查（无需安装依赖）
├── assets/
│   ├── data/meta.js        曲目 / 章节 / 谱面等级 / 示例码（可单独更新数据）
│   ├── ui/rank/            游戏原生评级图标（SP 文件表示 S+ 评级）
│   └── covers/
│       ├── thumb/          320px WebP 缩略图（列表、卡片用；手机友好，共 ~380KB）
│       ├── full/           2048px WebP 高清图（大图查看器用，共 ~11MB）
│       └── original/       2048px PNG 原图（收藏/大屏欣赏用，共 ~81MB）
└── _build/
    ├── export_assets.py    游戏版本更新后，一键重新导出全部资源
    └── sample_code.txt     示例码
```

### 维护与验证

脚本按 `index.html` 底部顺序加载，保持普通脚本以兼容直接双击打开页面。解析层不访问 DOM；统计层依赖 `data.js` 的元数据及 `state` 的 ACC 参数；UI 层只负责展示。更新曲库仍使用 `assets/data/meta.js`。

在项目根目录运行（需要 Node.js，无需安装 npm 依赖）：

```bash
node web/tests/regression.cjs
```

覆盖示例存档、ACC、三个结算分数样本、评级边界、百分比截断、谱面等级映射、Base64/hex、损坏输入、零判定与 AP、统计筛选，以及难度 / Lv+ / 未知等级 / ACC / 分数 / 评级排序。界面调整后，再用浏览器检查主题、手机布局、图表排序和海报导出。

`save_parser_test/` 是本地测试与参考目录，已加入 `.gitignore`，不追踪或上传；正式网页所需评级图标保存在 `web/assets/ui/rank/`，运行不依赖测试目录。

| 修改内容 | 主要文件 |
|---|---|
| 页面结构、控件 | `web/index.html` |
| 基础组件、游戏风格与响应式样式 | `web/styles/base.css`、`web/styles/dashboard.css` |
| 存档协议与输入解码 | `web/js/parser/save-parser.js` |
| ACC、筛选、排序与分析 | `web/js/analysis/statistics.js`、`web/js/analysis/insights.js` |
| 图表、卡片与分析展示 | `web/js/ui/dashboard.js`、`web/js/ui/insights.js` |
| 主题、大图查看器 | `web/js/ui/theme.js`、`web/js/ui/lightbox.js` |
| 海报生成 | `web/js/export/poster.js` |
| 事件与状态更新 | `web/js/app.js` |

页面支持 `?code=...` 或 `#code=...` 自动解析；构造链接时应对存档码进行 URL 编码，避免 Base64 中的 `+` 被查询参数解析为空格。存档码含玩家信息，日常使用建议直接粘贴到输入框。

### 云端部署

部署入口为 `web/index.html`。发布时保留 `index.html`、`styles/`、`js/`、`assets/` 的相对目录关系；`tests/`、`_build/` 不需要部署。

- 静态托管平台：将 `web/` 设为发布目录，无构建步骤
- **自有服务器（nginx 示例）**：

```nginx
server {
  listen 80;
  server_name simple-save.example.com;
  root /var/www/simple-save;
  index index.html;
}
```

- `assets/covers/original/` 可省略，但「下载原图 PNG」会不可用；当前原图下载链接不会自动回退。
- 大图查看使用 `full/`，卡片、表格及海报使用 `thumb/`，需要保留对应资源。

### 曲绘素材说明

- 所有张曲绘从游戏 APK 的 `*image_assets_all_*.bundle`（Unity 资源包）中提取
  （2048px 原图，缩略图/大图为 WebP 转码；AprilFool 曲目复用对应普通版曲绘）
- 版权归游戏方及画师所有，仅供个人本地展示/收藏用途，请勿商用或再分发
- 曲绘缺失不影响成绩解析；卡片和表格会隐藏加载失败的图片，高清查看和原图下载仍需要相应文件。

### 资源重新导出（游戏更新后）

```bash
cd web/_build
python3 export_assets.py /path/to/Simple_x.y.z.apk   # 需要 UnityPy + Pillow
```

## 目录里的其它文件（重要）

`files/` 目录下除 `player0.save` 外还常见：

| 文件 | 说明 |
|---|---|
| `logs.save` | 游戏运行日志，非存档 |
| `.userdata` | LeanCloud 账号会话缓存（`_User` 对象）：含 TapTap 登录绑定的 access_token、LeanCloud mac_key/sessionToken 等**账号凭证**。它不是游戏存档，不含任何成绩/进度，**属极高敏感信息，切勿分享或上传网络** |

Python 命令行对识别出的 LeanCloud `_User` JSON 会脱敏输出并给出警告；网页版不提供这项处理。复制的成绩 JSON 仍可能包含玩家名、unionId 和设备信息。

> 想分享游戏成绩，请用游戏内的“存档码/同步码”（即 `player0.save` 的 Base64）。

## 实测说明（真实同步码判读）

- `fullComboCount`(16) 实测数值≈谱面判定总数（即“全连所需连击数”），
  `maxComboCount`(17) 为该次记录的最大连击
- 同步码中的统计字段（perfect/earlyGood/lateGood/earlyBad/lateBad/miss）均为“最佳记录”
- 真实样本中出现过 schema 之外的保留字段号（如 field 49），解析器会原样保留在
  `_unknown` 中，不影响其它字段解析；如遇更多样本可据此扩展 schema

## 协议兼容性说明

- 字段号 / wire 类型 / 枚举值：均从 IL2CPP 元数据中内嵌的 proto 描述符字节实证
- 当前网页回归检查的范围与命令见「维护与验证」；Python 命令行的 gzip/zlib、JSON 支持不属于这份网页测试的覆盖范围
- 支持的 Protobuf wire 类型中，未识别字段会保留在 `_unknown`；损坏数据、不支持的 wire 类型或未来协议变更仍可能导致解析失败

## 风险与说明

- 本解析器为**只读**解析，不写回存档；如需改档需另行开发写入器并理解校验逻辑
- 游戏版本升级后字段号可能变化；解析失败时可用 `--raw` 查看原始 TLV 结构
- 使用前请备份原存档


## 其他
- 此为玩家自制，非官方功能，涉及隐私内容建议本地部署运行。
- 由 DeepSeek-v4.1-flash 完成存档逆向解析，GPT-6 Astra 完成页面设计。
