---
title: "HideMyData：基于同款 Privacy Filter 模型的 macOS 原生客户端"
description: "HideMyData 是社区开发的 Mac 应用，在本地运行 openai/privacy-filter 模型，对 PDF 和图片做隐私脱敏——与本站同款模型，但通过 MLX 和 Apple Vision 实现原生体验。"
pubDate: 2026-04-29
author: "Privacy Filter Team"
tags: ["releases", "macos", "open-source"]
---

想发个截图或 PDF 给别人，又怕里面漏了名字、邮箱、账号没擦干净，于是在 Preview 里反复检查十分钟——[HideMyData](https://github.com/mkbula/HideMyData) 想干掉的就是这种工作流。

它是 [mkbula](https://github.com/mkbula) 开发的 macOS 原生应用，4 月 28 日刚发了 v0.1.0。让我们感兴趣的是：它跑的是**和本站同一个 `openai/privacy-filter` 模型**——只不过通过 [MLX-Swift](https://github.com/ml-explore/mlx-swift) 原生运行，PDF 和图片的 OCR 由 Apple Vision 负责。同样的大脑，不一样的躯壳。

如果你用过 Privacy Filter Online，希望它能一次处理一摞 PDF 而不用一页一页复制粘贴——现在有个 Mac 应用大致能做到这件事。本地跑、开源、采用 GPL-3.0。这不是我们做的，但同根同源、项目本身也不错，值得介绍一下。

## 它具体能做什么

把 PDF 或图片拖进去，HideMyData 会通过三层流程处理：

1. **Apple Vision OCR** 把文字识别出来——包括扫描版 PDF，以及那种字体内嵌、复制时反而拿不到文字的「难搞 PDF」。
2. **privacy-filter 模型（MLX 8-bit 量化）** 做和本站一样的 NER 推理，借助 Apple Neural Engine 和统一内存的优势，结合上下文识别姓名、邮箱、电话、地址、日期，以及各类 ID。
3. **手工维护的正则** 负责上下文帮不上忙的部分：IBAN、SSN、MAC 地址、IPv4/v6、JWT、API key、加密钱包地址等。确定性的模式交给正则，模糊的判断留给模型。

识别完会得到一组打码矩形，你可以手动调整——加新的、删误判的、调边界。打码风格有两种：纯黑实底，或磨砂玻璃模糊。说实话做对外截图时，磨砂模糊更自然些，看着也专业。

保存的时候，**打码会被永久烙进文件**。每页都会被栅格化重建——原始的字形和文本是真的从文件里消失，而不是被盖住。这件事比听起来重要得多。常见的 PDF 打码翻车场景就是在上面画个黑框就发出去：底下的文字还在，能复制能粘贴，最后是出大事。HideMyData 是把页面整个重建一遍，所以黑框底下没有可恢复的数据。

## 和 Privacy Filter Online 怎么搭配用

我们做的是浏览器版。同一个模型，通过 Transformers.js 和 WebGPU/WASM 在你的标签页里跑。如果你只是临时想清理一段文字、查一张图，又不想装东西，浏览器版正合适。

HideMyData 更适合这些场景：

- **要处理 PDF**，尤其是多页 PDF。浏览器能渲染 PDF，但用来打码并不顺手。
- **处理扫描文档**——这种场景下 OCR 质量很关键，Apple Vision 在这一块确实够强。
- **不想每次 Chrome 清缓存就重新下一遍模型**。原生应用把模型放在 `~/Library/Application Support/HideMyData/`。
- **需要栅格化重建式的保存方式**。Web 版给你的是文本片段标注，方便复制出来用，并不会替你改写 PDF 文件。

总的来说，是同一个想法做成原生版本——拿到了浏览器给不了的磁盘和 GPU 权限。

## 实现里值得说一下的部分

如果你对技术栈感兴趣，几点值得提一嘴：

- **推理用的是 MLX-Swift**。在 Apple Silicon 上选 MLX 没毛病——统一内存意味着 GPU/CPU 之间不用拷数据，`openai/privacy-filter` 的 8-bit 量化版在工作内存里也很宽裕。
- **模型加载用 OpenMedKit 包了一层**。它是把 Hugging Face 权重转成 MLX 能消费的格式的 Swift 胶水。
- **PDFKit + Vision + 模型 全在一条流水线上**。每一层都是 Apple 原生组件——没有 Python 副车，没有 Electron，风扇也不会狂转。冷启动很快。

它在设计上还有一个不错的地方：没掉进「相信我的智能自动打码」那种陷阱。保存之前有一道手动编辑步骤——看模型给的建议，要么接受要么改，确认后再永久写入。一旦出错就泄露数据这种事，由人和模型分工才靠谱。

## 一些注意事项

毕竟还是 v0.1.0，几件事得提前知道：

- **macOS 26 或更新版本，仅限 Apple Silicon**。MLX 后端不支持 Intel Mac。
- **暂时没用开发者证书签名**。首次启动会被 Gatekeeper 拦住，README 里有 `xattr -rd com.apple.quarantine /Applications/HideMyData.app` 的绕过方法。
- **首次下载模型约 1.5 GB**。在酒店 Wi-Fi 上用要心里有数。
- **协议是 GPL-3.0**，如果想嵌进商业产品里得先看清条款。

简单说就是早期阶段的开源项目。基本组件都有了，仓库里的演示视频也挺干净，但毛刺难免，留意 issue 列表更稳妥。

## 想试试

- 仓库：[github.com/mkbula/HideMyData](https://github.com/mkbula/HideMyData)
- 最新发布：[v0.1.0](https://github.com/mkbula/HideMyData/releases/tag/v0.1.0)
- 两个项目共享的模型：[openai/privacy-filter](https://huggingface.co/openai/privacy-filter)

如果你也用同一个模型在别的平台上做了点什么，欢迎告诉我们。开放模型的意义就在这里：浏览器工具、Mac 应用，以及之后还会出现的更多东西，都能从不同角度去解决同一个问题。
