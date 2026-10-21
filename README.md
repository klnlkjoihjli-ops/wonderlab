# WonderLab 森林邮局

5—6 岁孩子和妈妈一起玩的搭桥探索原型：三次连续体验 + 纸桥现实活动 + 家长页面。

## 启动

```bash
npm install
npm run dev
```

- 电脑上打开 http://localhost:4177（普通版）；HTTPS 版见下文，用 4178，两个可以同时开
- iPad 和电脑连同一个 Wi‑Fi，在 Safari 打开 `http://<电脑的局域网 IP>:4177`，横屏使用
- 服务端（AI 导师）在 8787 端口，前端通过 `/api` 代理访问

## 在 iPad 上用语音（HTTPS）

Safari 只在 HTTPS 下开放麦克风。证书由 mkcert 在项目里生成（`certs/`，含私钥，已排除出 git），**没有改动 Mac 的系统信任设置**。

1. 启动 HTTPS 模式：`npm run dev:https`
2. 把 `certs/WonderLab本地证书.crt` 隔空投送（AirDrop）到 iPad，iPad 会提示“已下载描述文件”
3. iPad：设置 →「已下载描述文件」→ 安装（需要输入 iPad 锁屏密码）
4. iPad：设置 → 通用 → 关于本机 → 证书信任设置 → 打开「mkcert development CA」开关
5. Safari 打开 `https://CandeMacBook-Air.local:4178`（IP 变了也能用；不行时用 `https://<电脑 IP>:4178`）
6. 家长页面 →「设置与隐私」→ 勾选“允许孩子用说话提问”。第一次按话筒时允许麦克风

不想继续信任时：iPad 设置 → 通用 → VPN 与设备管理 → 删除这个描述文件。
`certs/ca/rootCA-key.pem` 是证书机构的私钥，不要发给任何人，也不要上传。

重新生成证书（例如换了电脑名）：
```bash
CAROOT="$PWD/certs/ca" mkcert -cert-file certs/dev.pem -key-file certs/dev-key.pem <电脑名>.local <IP> localhost 127.0.0.1
```

## 接入 DeepSeek

1. 复制 `.env.example` 为 `.env`，填写 `WONDERLAB_AI_KEY=你的密钥`（模型默认 `deepseek-flash`，已关闭思考模式以保证响应快）
2. 重启 `npm run dev`
3. 家长页面 →「设置与隐私」→ 勾选“让小诺使用在线模型”→「测试连接」

密钥只在服务端读取，不进入浏览器代码、聊天记录或导出文件。模型超时（8 秒）或出错时，小诺自动改用写好的基础提示。

## 结构

| 位置 | 内容 |
| --- | --- |
| `shared/bridge.ts` | 搭桥规则：试车结果只由这里的程序规则决定 |
| `shared/game.ts` | 三次体验、基础提示、存档结构 |
| `server/tutor.ts` | DeepSeek 调用、回退、“以后想探索的事”标记、连接测试 |
| `src/scene/` | Three.js 场景（程序生成，不依赖外部美术素材） |
| `src/components/Kid.tsx` | 信件板、装备/收信人/装饰选择、说话面板、纸桥步骤 |
| `src/components/Parent.tsx` | 家长页面：陪伴说明、记录、纸桥、三个问题、设置与隐私 |

## 已知限制

- 语音识别依赖浏览器（Safari / Chrome 的 Web Speech API），iPad 上需要按上面的步骤走 HTTPS；用 `http://` 访问时会自动改为打字输入。
- 所有家庭记录只存在当前浏览器的本地存储里，换设备或清除网站数据会丢失，建议定期在家长页面导出。
