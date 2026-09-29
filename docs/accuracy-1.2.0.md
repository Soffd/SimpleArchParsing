# Simple 1.2.0 主页总 ACC 核对

## 结论

主页总 ACC 按谱面难度加权：SP=1、CM=2、CL=4、OL=8。它既不是按判定数加权，也不是所有谱面等权平均。

1. 按章节、曲目标识、难度分组，只保留整数 ACC 最高的一条记录。
2. 每条记录计算 `units = floor((10×Perfect + 6×Good) × 1000 / (Perfect+Good+Bad+Miss))`。
3. 将 `units / 10000` 转为单精度浮点数，按上述难度权重累加，再除以权重总和。
4. 使用两位百分比格式 `P2` 显示，最终结果四舍五入。不要复用单谱面 ACC 的截断格式。

空列表返回 0；游戏底层对判定总和为 0 的已有记录返回 10000 units（100%）。未知难度不参与主页总 ACC。本工具在游戏汇总中保留这些行为；分析模式及单曲展示仍保留原有的零判定保护。

## 本地 APK 证据

- 文件：`Simple_1.2.0.apk`，arm64-v8a。
- SHA-256：`972e56e410fba950f29acef03d2f4af8834fbe57a60950a63e185ee8590ef0b8`。
- `PlayerInfoModel.get_PlayerAverageAcc`，RVA `0x257E8A4`：调用 `ScoreManager.QueryAverageAcc`。
- `ScoreManager.QueryAverageAcc`，RVA `0x259D4D4`：遍历 `BestACCs`，难度分支分别累加 ACC×1、×2、×4、×8，分母为对应权重之和；ARM64 `fadd/fmul/fdiv` 使用单精度。
- `ScoreManager.TryReplaceBestScore`，RVA `0x259CC98`：键包含章节、曲名和难度，以 `GetAcc` 的整数结果比较最佳记录。
- `GetAcc01(SongScore)`，RVA `0x2517364`：整数乘加及除法先产生 0～10000 的 ACC，再转浮点数除以 10000。
- `PlayerInfoView.UpdateView`，RVA `0x2583A04`：对主页总 ACC 调用 `Single.ToString(string)`；对应字符串常量为 `P2`。

元数据及方法地址使用 [Il2CppDumper](https://github.com/Perfare/Il2CppDumper) v6.7.46 提取，计算指令通过 ARM64 反汇编核对。另一个名为 `CalculateBestAverageAcc` 的函数采用不同的平均方式，但它不是主页属性的调用目标，不能仅凭函数名称选用。

## 回归验证

报告样本包含 SP 1 条、CL 16 条、OL 3 条，权重总和为 `1 + 16×4 + 3×8 = 89`。

| 方式 | 显示值 |
|---|---|
| 游戏主页口径 | 94.61% |
| 按判定数加权（分析） | 93.35% |
| 所有记录等权平均（分析） | 95.46% |

游戏汇总值约为 94.6073%，格式化后与报告中的 94.61% 一致。回归文件 `web/tests/fixtures/aggregate-1.2.0.json` 仅含匿名谱面编号与判定字段，没有玩家名、同步码、设备信息或账号标识。

APK、提取物、分析工具及原始样本留在 Git 忽略目录中，不属于网页运行依赖。
