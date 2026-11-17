最新英文女声版：[English walkthrough](README-English.md) — `output/perks-reminder-walkthrough-en-v3.mp4`。

# Amex 新扩展中文宣传片

本地制作项目，源文件与素材均在本目录。没有发布到论坛或视频平台。

- 成片：`output/perks-reminder-amex-zh-v2.mp4`
- 字幕：`output/captions-zh.srt`、`output/captions-zh.vtt`
- 旁白：`narration.txt`，原始 take 保留在 `audio-source/`
- 分镜、字幕、帧数唯一时间来源：`src/timing.json`
- 论坛文案：`forum-update-draft.md`
- 制作依据与版权：`brief.md`
- 技术与观感检查：`qa/review.md`

## 重现

```sh
npm ci --ignore-scripts
npm run check
node scripts/render.mjs stills
node scripts/render.mjs
```

依赖锁定在 package-lock.json；Remotion 4.0.539、React 19.1.0。
字体使用 macOS 自带 PingFang SC，未复制系统字体。外部机器需提供相容中文字体。

## 音频

ElevenLabs / Jin — Clear, Warm and Casual / Eleven v4，稳定度 50%、相似度 75%、clone strength 0%。未加速旁白；原始长度 55.248938 秒，成片偏移 0.5 秒，片长 59 秒。
ElevenLabs — user's separate permission for free use on their open-source projects.

原创配乐由 `scripts/music.py` 生成，无外部采样。混音由 video-with-voice skill 的 mix_audio.py 完成，旁白和配乐分别留存。

机器转写使用本机 whisper.cpp 与官方多语言 base 模型，仅用于检查内容、定位短句。人名/品牌和同音字根据旁白稿校正。模型不进入 Git。

导出校验：
```sh
python3 /Users/lfan/.codex-switcher/skills/video-with-voice/scripts/validate_video.py output/perks-reminder-amex-zh-v2.mp4 --width 1920 --height 1080 --fps 30 --frames 1770 > qa/export-check.json
```

高清界面来自本地合成 fixture 的实际 Shadow DOM，保存在 `src/reader-panel.json`，由 Remotion 按最终分辨率渲染。原截图仅作来源核对，不再放大栅格文字。
