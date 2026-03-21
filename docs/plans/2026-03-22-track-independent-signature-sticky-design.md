# Track-Independent Signature Sticky Design

**Problem**

当前左侧吸顶对 `clef` / `key` / `time` 的替代并不完全按轨道独立工作。

在 `调号修复.svg` 里，这会表现成两类问题：

- `Violoncello` 两条分轨的签名替代互相污染，某一条轨道上的调号清除或替代会影响另一条轨道。
- 中后段分奏数字 `1` / `2`、`unis.` 这类文本虽然本身没有被分类为 `TimeSig` 或 `KeySig`，但由于签名 sticky 宽度和偏移按系统共享最大值传播，后续拍号/调号列会被错误推挤或错误清空，看起来像被这些分奏标记“替代”了。

**Root Cause**

- `scripts/features/svg-analysis.js` 已经按 lane 构建了每条轨道自己的 `typeBlocks.clef/key/time` 和 `baseWidths`。
- 但 `scripts/app.js` 在渲染时仍把 `clef` / `key` 的基宽和当前宽度按 system 聚合成共享最大值，再用它计算所有 lane 的 `laneOffsets`。
- 这意味着某一条轨道的调号清除块、宽调号块、无调号状态，都会通过共享宽度影响同系统其他轨道的 key/time 吸顶位置。
- 另外，Dorico 文本拍号识别当前允许纯数字文本在非音乐字体中继续进入拍号候选流程。虽然 `调号修复.svg` 中的 `1` / `2` 当前没有直接被标成 `TimeSig`，这个入口仍然会让分奏数字和普通数字文本保持高风险误判状态。

**Chosen Design**

1. 把签名类 sticky 明确拆成“轨道独立默认，显式共享例外”。
   - `clef` / `key` / 普通 `time` 的替代链、基宽、当前宽度、偏移都按 lane 独立计算。
   - 只有显式打上 `sharedStickyGroupId` 的共享组继续跨 lane 联动，当前主要是 giant time-signature shared groups 和 instrument-group shared groups。
2. 让调号清除只影响当前轨道。
   - `natural-only` 的 `KeySig` 清除块继续只清本 lane 的 sticky key 显示。
   - 它不再通过系统共享宽度把其他轨道的 key 列一起清空或压缩。
3. 让拍号列跟随本轨道自己的 clef/key 状态。
   - 每条 lane 的 `time` 偏移基于该 lane 当前激活的 clef/key 宽度，而不是同系统其他轨道的最大值。
   - 这样 `Violoncello 1` 和 `Violoncello 2` 可以在同一时刻显示不同的调号与拍号替代状态。
4. 收紧 Dorico 纯数字文本拍号入口。
   - 保留真正拍号文本的合法识别路径。
   - 但对普通文本域的纯数字候选增加更严格的门槛，避免分奏数字继续参与拍号候选链。

**Expected Result**

- `调号修复.svg` 中两个 `Violoncello` 轨道的调号和拍号吸顶替代互不干扰。
- 某条轨道上的还原调号只清除该轨道 sticky key，不再全局影响同系统其他轨道。
- 普通分奏数字 `1` / `2` 与 `unis.` 不会再通过共享宽度副作用扰乱签名列，也不会轻易进入拍号候选链。
- 现有 giant time-signature 这类明确需要跨轨共享的 sticky 仍保持共享替代能力。
