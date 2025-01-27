<div align="center">
  <img src="images/icon.png" alt="DTV Logo" width="128" height="128">
  <h1>DTV</h1>
  <p>基于 Tauri 2.0 的跨平台非官方斗鱼直播精简版桌面客户端</p>
</div>

## 说明

1. 本项目基于 Tauri 2.0 开发，最初基于 Electron 开发的版本已存放于 [electron-legacy](https://github.com/c-zeong/DTV/tree/electron-legacy) 分支

2. 搜索接口有访问频率限制，过于频繁的搜索请求会触发验证码校验，建议合理使用搜索功能

3. 本项目仅供学习编程目的使用，未进行任何逆向工程

## 软件截图

<div align="center">
  <div style="display: flex; justify-content: center; gap: 20px;">
    <div>
      <img src="images/iShot_light.png" alt="日间模式" width="400">
      <p>日间模式</p>
    </div>
    <div>
      <img src="images/iShot_dark.png" alt="夜间模式" width="400"> 
      <p>夜间模式</p>
    </div>
  </div>
</div>

## 安装方式

可以在 [release](https://github.com/c-zeong/dtv/releases) 目录下载对应系统的安装包, 也可以通过源码编译安装

## 编译

```bash
# 克隆项目
git clone https://github.com/c-zeong/dtv.git
cd dtv

# 安装依赖
npm install

# 开发调试
npm run tauri dev

# 打包构建
npm run tauri build      # 构建当前系统的安装包

# 构建产物位置
# macOS: src-tauri/target/release/bundle/
# Windows: src-tauri/target/release/bundle/
# Linux: src-tauri/target/release/bundle/
```

注意：需要在对应的操作系统下进行构建，Tauri 不支持跨平台编译。