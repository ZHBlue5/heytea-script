# heytea-script

Heytea 官方 Userscript catalog，供 [Ctool](https://github.com/baiy/Ctool) Userscript 管理器同步使用。

## 开发规范

| 文档 | 说明 |
|------|------|
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | 贡献流程、元数据、代码约定、Ctool 本地验证、发布 Checklist |
| [docs/config.md](docs/config.md) | `@config` 声明与 GM 配置（密码等敏感项） |

## 脚本

| 文件 | 说明 |
|------|------|
| `ali-log.js` | Intl Logs 一体化自动登录与 SLS 跳转（密码通过 Ctool `@config`） |
| `cls.js` | 腾讯云 CLS 日志检索页 Topic 快速切换 |
| `devops-bk.js` | DevOps BK 变更弹窗增强 |
| `devops-focus.js` | 运维平台审核/重试按钮悬停居中与滚动（iframe 场景） |
| `rancher.js` | Rancher 集群/命名空间快速导航 |
| `tencent-cls.js` | inner-logs 自动密码并延时跳转 CLS（`@config` 密码） |

## Ctool 同步

内置官方源：`ZHBlue5/heytea-script`（分支 `main`）。在 Ctool → Heytea Userscript 打开页面时会**自动同步** catalog，亦可手动点「同步清单」。**新脚本默认停用**，需在列表中手动启用；含 `@config` 的脚本启用后请在卡片「配置」中填写必填项。

## 发布

```bash
# 修改脚本并更新 @version 后
npm run generate-index
npm run check-index   # 可选，与 CI 一致
git add .
git commit -m "feat: update scripts"
git push origin main
```

`index.json` 由 `scripts/generate-index.mjs` 自动生成，请勿手改。CI 会在 push/PR 时运行 `npm run check-index` 校验一致性。完整流程见 [CONTRIBUTING.md](docs/CONTRIBUTING.md)。
