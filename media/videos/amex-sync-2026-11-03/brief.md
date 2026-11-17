# Perks Reminder — Amex 新扩展宣传片

受众：美卡论坛读者，持有多张 Amex、手工记录 credit 使用进度的人。
目标：认识新扩展，了解自动读取与同步入口，访问 perks-reminder.com。
成片：中文旁白、中文字幕，1920×1080 / 30 fps，约一分钟。
主线：手工查记的麻烦 → Amex 自动读取 → 按卡查看额度/已用/周期 → 同步流程 → 少记一点，多用一点。

## 依据
- 原帖：https://www.uscardforum.com/t/topic/388701
- 原帖最后更新页：https://www.uscardforum.com/t/topic/388701?page=9
- 代码：https://github.com/lifan-builds/perks-reminder（MIT）
- 真实 UI：release/store-assets/screenshot-1280x800.png，来自实际 AmexBenefitReaderPanel 与合成 fixture。
- 数据均为示例，不是任何用户的真实账户。功能演示不包含线上写入成功回执。
- 自动读取要求登录 Amex 并打开支持页面；网站同步需用户点击、核对并确认。不是所有银行后台自动同步，也不是开卡奖励消费追踪。
- 截至本次制作，Chrome Web Store 1.5.0 已提交审核，未据此声称已公开上线。
- 网站写入是否开放是独立发布状态；本片以新版功能预览呈现同步步骤，不伪造线上成功结果。

## 视觉方向
暖白 + 深海军蓝 + 青绿色。清晰大字、真实扩展界面特写、克制的卡片与流程动画。不要堆满功能列表。

## 素材与音频
- 产品标志与界面：本项目自有素材。
- 配音：ElevenLabs，Jin — Clear, Warm and Casual，Eleven v4，稳定度 50%，相似度 75%，clone strength 0%。
- ElevenLabs — user's separate permission for free use on their open-source projects.
- 配乐：本项目脚本原创合成，无外部采样。

高清修订：通过本地 fixture 读取实际面板的 Shadow DOM；在 Remotion 中原样呈现样式、图标与示例数据，避免放大低分辨率截图。输出 v2 保留 v1 供比较。
