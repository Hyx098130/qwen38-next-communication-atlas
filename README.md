# Qwen3.8-Next 的 48 层卡间通信

[打开翻页演示](https://hyx098130.github.io/qwen38-next-communication-atlas/#slide=1)

按左右方向键翻页，也可使用页脚、目录和章节导航。手机支持左右滑动。演示从 token 行和两卡配合讲起，沿 GDN、PLE、QSA 和 MoE 走到输出头，再用真实双卡时间线定位等待。

[逐层路线](https://hyx098130.github.io/qwen38-next-communication-atlas/details.html#layer/1) · [88 种算子](https://hyx098130.github.io/qwen38-next-communication-atlas/details.html#ops) · [逐笔通信](https://hyx098130.github.io/qwen38-next-communication-atlas/details.html#events)

本次采集采用 DP4、PCP2、EP8，正式窗口为 20 秒。八张卡共记录 33,296 条窗内显式通信端记录，对应 16,648 笔双卡调用，另有 866,522 个具名计算核。详情页也保留正式窗口之外的原始事件。网页上的模型层从 1 计数，按设备锚点和核序列还原。MegaMoe 的内部重叠率在本次记录中未知。

站点由 GitHub Pages 从 main 分支根目录发布。index.html 是演示，details.html 是共享明细入口。data/atlas.json 包含前向结构、算子词典和配对通信数据，data/kernels 下的实例按卡和前向段按需加载。

翻页与章节导航的展示参考了 [CP-Viz 序列并行讲解](https://pisceskkk.github.io/CP-Viz/va-onboarding/#slide=1)。

