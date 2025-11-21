🎙️ IndexTTS Hub (v0.1.0)

IndexTTS Hub 是一个专为 IndexTTS 设计的 一站式本地部署与控制中心。

它由 Helloview 团队打造，旨在消除繁琐的命令行操作，通过现代化的 GUI 界面，让任何用户（无论是否具备编程基础）都能在几分钟内轻松搭建并运行高性能的语音合成服务。

✨ 核心特性

🛠️ 零门槛部署 (Zero-Config Setup)

全自动依赖管理：自动检测并安装 Git、Git LFS、Python 和 uv 包管理器。

智能环境隔离：基于 uv 创建独立的 Python 虚拟环境，不污染您的系统全局环境。

一键克隆：自动拉取 IndexTTS 核心代码库。

🚀 极速下载 (Smart Mirroring)

区域感知：内置网络检测功能。

国内镜像加速：对于中国大陆用户，自动切换至 ModelScope (魔搭社区) 源，告别下载超时。

国际源支持：海外用户直连 Hugging Face。

🎛️ 赛博朋克控制台 (Cyber Dashboard)

可视化进程管理：一键启动/停止推理服务，无需打开终端。

实时日志流：内置黑客风格的日志终端，实时监控服务运行状态。

动态硬件配置：

GPU 加速：自动检测 NVIDIA 显卡并开启 CUDA 支持。

FP16 量化：一键开启半精度推理，节省 50% 显存。

版本控制：自动检测上游更新，支持一键 git pull 升级。

📦 安装指南

1. 系统要求

Windows: 10/11 (x64)

macOS: 12+ (Apple Silicon / Intel)

Linux: Ubuntu 20.04+ (需安装 webkit2gtk)

2. 下载安装包

请前往 Releases 页面 下载对应您系统的安装包：

Windows: IndexTTS-Hub_x64_en-US.msi

macOS: IndexTTS-Hub_aarch64.dmg (M1/M2/M3)

3. 首次运行

打开应用，您将看到 初始化向导。

按照提示选择您的 网络区域 (中国大陆/国际)。

等待系统自动完成 环境自检 和 核心依赖安装。

进入主控台，点击 "启动引擎"。

待状态变为 ONLINE 后，点击 "打开 WebUI" 即可开始使用！

🛠️ 开发与构建 (For Developers)

如果您想自行构建或参与开发，请遵循以下步骤：

前置依赖

确保您的系统已安装：

Node.js (v18+)

Rust (最新稳定版)

pnpm (推荐)

本地运行

# 1. 克隆仓库
```bash
git clone [git@github.com:yj369/indextts-hub.git](git@github.com:yj369/indextts-hub.git)
cd indextts-hub

```

# 2. 安装前端依赖
```bash
pnpm install
```

# 3. 启动开发模式 (同时启动 React 前端和 Tauri 后端)
```bash
pnpm tauri dev
```


打包构建

# 构建生产环境安装包
pnpm tauri build


构建产物将位于 src-tauri/target/release/bundle 目录下。

🖼️ 界面预览

启动页 (Splash)

环境自检 (Check)

主控台 (Dashboard)




🤝 贡献与反馈

我们欢迎任何形式的贡献！

Bug 反馈: 请提交 Issue。

功能建议: 欢迎在 Discussions 中讨论。

代码贡献: Fork 本仓库 -> 创建分支 -> 提交 PR。

📄 开源协议

本项目基于 MIT License 开源。
IndexTTS 核心算法归原作者所有。

<div align="center">
<p>Made with ❤️ by <b>Helloview Team</b></p>
</div>