# Natural-Only Key Signature Clears Sticky Display Design

**Problem**

当谱面中途换调时，如果新的调号块由还原记号组成，左侧吸顶当前会继续显示这个“还原调号块”。这不符合记谱语义：还原记号只是把之前的升降号取消掉，替换完成后左侧应回到无调号，也就是 C 调号。

**Root Cause**

- `scripts/features/svg-analysis.js` 目前把所有 `KeySig` 块都当成同一种 sticky 块处理。
- `scripts/app.js` 在滚动激活某个 `key` 块后，会直接把该块宽度计入吸顶布局，并把该块的元素钉在左侧。
- 这意味着“取消调号”的还原记号块也会像普通升降号调号一样长期留在 sticky 区域。

**Chosen Design**

1. 在 `scripts/features/svg-analysis.js` 的 `key` 分块阶段识别“全还原记号”调号块。
   - 只把全部元素都解码为 natural 的 `KeySig` 块视为“清空调号块”。
   - 保留它的 block 顺序和锁定距离，确保旧调号在正确时机被替换掉。
2. 对清空调号块单独记录 sticky 显示宽度为 `0`。
   - 块本身仍存在于 `typeBlocks.key` 中，供激活逻辑推进 `currentActive`。
   - 但它不再为吸顶区占用宽度，也不再成为后续 `time` 吸顶的前置偏移。
3. 不把清空调号块的元素注册为 sticky 渲染项。
   - 这样原谱中的还原记号仍按原位置滚动显示。
   - 一旦切换点通过，旧调号会被隐藏，而左侧不会留下新的还原记号吸顶。

**Expected Result**

- 滚动到 natural-only `KeySig` 块时，旧的吸顶调号会被清空。
- 左侧吸顶后续显示为空调号，相当于 C 调。
- 原谱中的还原记号本体仍正常显示并随谱面滚动离开。
- 现有普通升号/降号调号块的 sticky 行为保持不变。
