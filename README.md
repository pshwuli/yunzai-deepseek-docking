## 主要功能  

1. **自动回复**  
   - 私聊中自动回复用户消息。  
   - 群聊中被提及（如“小落”）时自动回复，支持多个触发词。  
   - 可随机回复群聊消息，概率可调。  

2. **语音回复**  
   - 可将文字转换为语音发送。  

3. **对话管理**  
   - 支持重置群聊对话历史。  
   - 仅保留最近 10 条消息，确保对话连贯。  

免费使用 GPT-4 及多种大模型：[点击进入](http://aicnn.cn/loginPage?aff=kkh59n7Ptb)（支持 DeepSeek-R1、DeepSeek-Chat API）  
语音 API：[点击查看](https://oiapi.net/?action=doc&id=117)  

## 搭建方式  

### 推荐方案  
使用 **TRSS-Yunzai** + **NapCatQQ** 搭建：  
1. **TRSS-Yunzai** 项目地址：[https://github.com/TimeRainStarSky/Yunzai](https://github.com/TimeRainStarSky/Yunzai)  
2. **NapCatQQ** 项目地址：[https://github.com/NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ)  

#### 搭建步骤  
1. 克隆或下载 **TRSS-Yunzai** 项目到本地。  
2. 将提供的 JS 文件放入 `Yunzai/plugins/example` 目录中。  
3. 安装依赖：  
   ```bash  
   pnpm add openai oicq -w  
   ```  
4. 启动 **TRSS-Yunzai** 并配置 **NapCatQQ**  
5. 按照下文配置相关 API 和参数即可使用。  

## 使用方法  

- **AI 设定**：填写 AI 说话风格。  
- **触发关键词**：填写触发 AI 对话的词，多个用 `,` 分隔。  
- **表情包 API**：填写表情包 API 地址，可多个。  
- **语音角色**：填写语音 API 角色名称。  
- **AI API 地址**：填写 AI API 接口地址。  
- **AI API Key**：填写 AI API Key。  
- **语音 API Key**：填写语音 API Key。  
- **AI 模型**：填写 AI 模型名称，如 `deepseek-chat`。  
- **AI 回复概率**：填写 0~1 之间的数值。  
- **分段发送**：`true` 开启，`false` 关闭。  
- **语音开关**：`true` 开启，`false` 关闭。  
- **表情包开关**：`true` 开启，`false` 关闭。
