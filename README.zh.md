# dsh-plugin-model-switcher

[English](README.md) | 中文

DSH 插件：通过键盘快捷键切换模型和推理等级。

## 快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl+Shift+M` / `Cmd+Shift+M` | 在当前 provider 内循环切换模型 |
| `Ctrl+Shift+R` / `Cmd+Shift+R` | 循环切换推理等级（off → low → high → max → off） |

每次切换右下角弹出 toast 提示，2 秒后自动消失。

## 原理

**Host**（`src/index.ts`）：
- 从 `agentDefaultModel` 读取当前模型选择
- 通过 `llm.listModels()` 获取模型列表进行循环切换
- 通过 `llm.resolveModelInfo()` 获取推理等级列表进行循环切换
- 通过 `agentDefaultModel.saveSelection()` 持久化新选择

**Client**（`src/client/index.ts`）：
- 在 `shell.overlay` 插槽注册 toast 浮层组件
- 在 `conversation.input.dock` 插槽监听键盘事件（捕获阶段）
- 通过 `host.call()` 调用 Host 端处理器
- 通过 `modelDirectories.directoryFor(sessionId).select()` 同步更新模型选择器 UI

## 安装

```bash
dsh plugin --profile web add https://github.com/Mrlilili/dsh-plugin-model-switcher.git
```

重启 DSH 即可生效。

## 许可证

MIT