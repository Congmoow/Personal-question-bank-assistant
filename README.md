# 📚 题库助手

一款功能强大的桌面端题库管理应用，帮助你高效管理、导入和练习各类考试题目。

![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 功能特性

### 📥 多种导入方式
- **CSV 导入** - 支持批量导入 CSV 格式的题目文件
- **AI 智能导入** - 通过 AI 自动解析和识别题目内容
- **手动录入** - 逐题手动添加，支持多种题型

### 📂 题库管理
- 创建和管理多个题库分类
- 题目预览、编辑和删除
- 支持单选题、多选题、判断题等多种题型

### 📝 刷题练习
- 随机抽题练习模式
- 答题结果即时反馈
- 练习进度统计

### 📊 数据统计
- 仪表盘展示题库概览
- 题目数量统计
- 练习情况分析

---

## 🖥️ 界面预览

> 💡 提示：可在此处添加应用截图
> 
> ```
> screenshots/
> ├── dashboard.png      # 仪表盘
> ├── import.png         # 导入页面
> ├── practice.png       # 练习页面
> └── preview.png        # 题目预览
> ```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.x
- npm >= 9.x

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动 Electron 开发环境
npm run electron:dev
```

### 构建应用

```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

构建完成后，安装包位于 `release/` 目录。

---

## 📁 项目结构

```
question-bank-assistant/
├── electron/                 # Electron 主进程
│   ├── main.cjs             # 主进程入口
│   ├── preload.cjs          # 预加载脚本
│   ├── ai/                  # AI 导入模块
│   ├── csv/                 # CSV 解析模块
│   ├── database/            # SQLite 数据库模块
│   └── validation/          # 数据验证模块
├── src/                     # React 渲染进程
│   ├── components/          # 通用组件
│   ├── contexts/            # React Context
│   ├── pages/               # 页面组件
│   └── api/                 # API 接口层
├── build/                   # 构建资源（图标等）
└── release/                 # 打包输出目录
```

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron + React |
| 构建工具 | Vite |
| UI 样式 | Tailwind CSS |
| 数据库 | SQL.js (SQLite) |
| 图表 | Recharts |
| 动画 | Framer Motion |
| 图标 | Lucide React |

---

## 📦 下载安装

前往 [Releases](../../releases) 页面下载最新版本安装包。

- Windows: `题库助手-x.x.x-Setup.exe`
- macOS: `题库助手-x.x.x.dmg`
- Linux: `题库助手-x.x.x.AppImage`

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

[MIT License](LICENSE)
