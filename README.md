# heytea-script

Heytea 官方 Userscript catalog，供 [Ctool](https://github.com/baiy/Ctool) Userscript 管理器同步使用。

## 脚本

| 文件 | 说明 |
|------|------|
| `ali-log.js` | Intl Logs 一体化自动登录与 SLS 跳转（密码通过 Ctool GM 配置） |
| `cls.js` | 腾讯云 CLS 日志检索页 Topic 快速切换 |
| `devops-bk.js` | DevOps BK 变更弹窗增强 |
| `rancher.js` | Rancher 集群/命名空间快速导航 |

## 发布

```bash
# 修改脚本并更新 @version 后
npm run generate-index
git add .
git commit -m "feat: update scripts"
git push origin main
```

`index.json` 由 `scripts/generate-index.mjs` 自动生成，请勿手改。CI 会在 push/PR 时运行 `npm run check-index` 校验一致性。

## Ctool 同步

内置官方源：`ZHBlue5/heytea-script`（分支 `main`）。在 Ctool → Heytea Userscript → 同步清单 即可拉取；新脚本默认停用，需手动启用。
