# 美卡论坛首楼更新稿 — 待审阅

原帖：https://www.uscardforum.com/t/topic/388701
用途：更新现有首楼及标题；不新开帖。当前仅本地草稿，未上传视频、未修改论坛。

## 建议标题

【免费开源】Perks Reminder 更新：Amex 福利自动读取，支持 Chrome Extension / 油猴｜中英文演示

## 正文

回来更新一下我做的 Perks Reminder。之前首楼主要讲手机 UI，这次想重点补上大家用福利追踪工具时最麻烦的一步：**在 Amex 查完 credit，还得切回表格或网站再手动记一遍。**

这次做了 Amex Benefit Reader，提供 **Chrome Extension 和 Tampermonkey（油猴）脚本**两种方式，最新 reader 版本是 **1.5.0**。

装好后，登录 Amex、打开支持的账户页面，reader 会自动读取福利使用进度，把卡片、额度、已用金额和周期整理出来。哪些没用、哪些只用了一部分，不用自己逐条抄数字；需要时也可以手动刷新。

### 先看一分钟演示

**中文版｜Amex 扩展演示（59 秒）**

[视频附件位置：perks-reminder-amex-zh-v2.mp4]

**English｜完整功能 walkthrough（60 秒，英文女声）**

[视频附件位置：perks-reminder-walkthrough-en-v3.mp4]

英文版会从添加卡片开始，走一遍福利追踪、卡片日历、使用指南、Amex reader 和年费回报统计。两个视频侧重点不同，可以挑感兴趣的看。

### 这次更新怎么用

1. 安装 Chrome 扩展或油猴脚本，二选一即可。
2. 登录 Amex，打开支持的账户页面，查看自动读取的福利进度。
3. 视频也展示了把读取结果带到 Perks Reminder、匹配卡片和福利的同步预览流程。

**版本说明：**1.5.0 的油猴版已发布，Chrome 版已提交商店审核，安装前请看页面上的版本号。视频使用示例数据，网站同步部分展示的是预览流程。

- [Chrome Extension](https://chromewebstore.google.com/detail/idpcieaeladegdoelljadhcggjndclpk)
- [Tampermonkey / 油猴脚本](https://greasyfork.org/en/scripts/591349-perks-reminder-amex-benefit-reader)

这里自动读取的是 **Amex 福利 / credit 的使用进度**，不包含开卡奖励的消费达标进度。其他银行的福利仍可在网站里手动追踪。

### 网站现在可以做什么

- **集中看福利：**按卡片查看每月、每季、每年的 credit，记录已完成、部分使用和备注。
- **卡片日历：**把福利到期、开卡奖励截止日期和年费时间放到一起看。
- **到期提醒：**福利到期前收到邮件，手机上也可以查看和更新。
- **福利使用指南：**查看具体 credit 怎么用；信息或 DP 变了也欢迎提醒我修正。
- **年费回报：**看自己实际用了多少福利，再和年费放在一起比较。

仍然免费、开源，可以直接用网站，也可以自己部署。

网站：[Perks Reminder](https://www.perks-reminder.com)
源码：[GitHub](https://github.com/lifan-builds/perks-reminder)

这次先把 Amex 这一大块做好。有多张 Amex 的朋友尤其欢迎试试：哪些福利没有读到、金额或周期哪里不对、哪一步还得手动折腾，直接回帖告诉我。

---

## 制作与发布备注（不放进论坛正文）

- 两个原视频均保留，不重新编码、不覆盖。附件明细见 forum-update-attachments.json。
- 中文附件是 Amex 演示；英文附件是 Jessica 女声的完整产品 walkthrough v3；不是同一剪辑的双语翻译。
- 1.5.0 是 reader/扩展版本，不是整个网站的版本号。
- 原帖公开内容已于本次核对；仍显示 2.1 标题、2.0 主体介绍。新稿替换首楼，不删除后续楼层的历史更新。
- Greasy Fork 1.5.0 已发布和 Chrome 1.5.0 已提交审核来自 docs/reader-publication-2026-11-02.md 及 STORE.md 的发布记录。本次公开网页抓取失败，Chrome 浏览器访问被拒绝，未重新确认商店当前状态。正式发布前更新正文版本说明。
- 生产网站同步能力本次未确认。草稿仅介绍已演示的同步预览，不承诺自动写入或完整银行覆盖；发布前按实际开放状态核对第三步。
- 尚未确认论坛当前 MP4 上传限制；两个文件均不足 6 MB。获得发布指令后上传并核对两段视频的可播放状态，再保存首楼。

## 发布清单

| 目标 | 操作 | 状态 |
| --- | --- | --- |
| 原帖 388701 / fanhy | 修改标题与首楼 | 本地稿待用户审阅，未执行 |
| 原帖 388701 | 上传中文视频 v2 | 本地成片已保留，未上传 |
| 原帖 388701 | 上传英文视频 v3 | 本地成片已保留，未上传 |
