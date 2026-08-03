# 语言与区域设置

Dockstash 提供七种界面语言。首次访问时会自动选择语言，您可以随时切换。

## 支持的语言

- English (`en`) — 默认
- العربية (`ar`) — 从右到左布局
- Français (`fr`)
- Deutsch (`de`)
- Español (`es`)
- Русский (`ru`)
- 中文 (`zh`)

## 自动检测

- **浏览器端**：我们读取 `navigator.language`。若匹配七种语言之一（含 `zh-TW` → 中文 等变体），则使用它；否则回退到英文。
- **服务器端**：我们解析 `Accept-Language` 头（带 q 值），使错误信息、事务性邮件和 API 响应本地化。显式的 `x-lang` 头或 `lang` cookie 优先。

## 切换语言

使用导航栏中的 **语言** 切换器。您的选择会保存在 `lang` cookie 中一年。

## 从右到左（RTL）

选择 **العربية** 时，我们会设置 `<html lang="ar" dir="rtl">`，整个布局镜像。

## 面向开发者

- 可选环境变量 `DEFAULT_LOCALE` 控制服务器端默认语言。
- 参见 `client/src/shared/i18n/README.md` 和 `server/src/shared/i18n/README.md`。
