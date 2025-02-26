import OpenAI from "openai";
import { segment } from 'oicq';
import common from '../../lib/common/common.js';
import fetch from 'node-fetch';

const MESSAGE_COUNT_THRESHOLD = 50;
const MESSAGE_INTERVAL = 5000;
const SEGMENT_DELAY = 500;
const RESET_INTERVAL = 3600 * 1000;
const MAX_MESSAGE_HISTORY = 10;

const groupMessages = new Map();
const groupCounters = new Map();

const config = {
    enable_master_switch: true, 
    enable_ai_chat: true, // AI对话开关
    enable_think_process: true, // 思考过程开关
    ai_prompt: `场景： (不需要在括号里描述动作，你只是用语言聊天。） (最多两句，字数限制在20字以内。） 你在一个QQ群里进行对话，群号为 {group_id}。 请以第一人称对话，不能重复上句话，风格多变。 你要温柔体贴，不要反问句，要直接肯定句。 被问身份时否认，回答你不是机器人。 个人信息：小落，15岁，中学生，粉色长发，蓝色眼眸，高冷温柔体贴人设`, // AI 设定
    trigger_words: ['小落', 'xxx'], // 触发关键词
    emoji_api: ['xxx','xxx'], // 表情包 API
    speaker: '酥心御姐', // 说话者角色
    api_url: '', // AI API 地址
    api_key: '', // AI API Key
    tts_key: '', // 语音 API Key（如果 enable_voice 关闭，可以为空）
    model_type: '', // 模型类型
    ai_temperature: 1.0, // AI 温度
    reply_probability: 0.05, // AI 回复概率
    enable_segment_sending: true, // 分段发送开关
    enable_voice: true, // 语音开关
    enable_emoji: true, // 表情包开关
    emoji_probability: 0.5, // 发送表情包概率
    voice_probability: 0.5 // 语音回复概率
};

export class DeepSeek extends plugin {
    constructor() {
        super({
            name: 'deepseek',
            dsc: 'deepseek',
            event: 'message',
            priority: 20000000,
            rule: [
                { reg: '^[^#].*$', fnc: 'messageRouter' },
                { reg: '^#结束本群对话$', fnc: 'reset' }
            ]
        });

        this.openai = new OpenAI({
            baseURL: config.api_url,
            apiKey: config.api_key
        });

        setInterval(() => this.resetCounters(), RESET_INTERVAL);
    }

    resetCounters() {
        const now = Date.now();
        for (const [group_id, counter] of groupCounters.entries()) {
            if (now - counter.lastResetTime >= RESET_INTERVAL) {
                counter.count = 0;
                counter.lastResetTime = now;
                groupCounters.set(group_id, counter);
            }
        }
    }

    async messageRouter(e) {
        if (!config.enable_master_switch) return;

        if (e.isPrivate) return this.handlePrivate(e);
        if (await this.handleGroupMention(e)) return;
        await this.handleGroupRandom(e);

        if (config.enable_emoji && Math.random() < config.emoji_probability) await this.sendMessage(e, 'image');
    }

    async handlePrivate(e) {
        if (!config.enable_master_switch || !config.enable_ai_chat) return;

        await this.sendChat(e, this.buildPrompt(e), config.ai_temperature);
        return true;
    }

    async handleGroupMention(e) {
        if (!config.enable_master_switch || !config.enable_ai_chat) return false;

        const message = e.msg || '';
        const isMentioned = config.trigger_words.some(word => message.includes(word)) || e.atBot;
        if (!isMentioned) return false;

        await this.sendChat(e, this.buildPrompt(e), config.ai_temperature);
        return true;
    }

    async handleGroupRandom(e) {
        if (!config.enable_master_switch || !config.enable_ai_chat) return false;

        const counter = groupCounters.get(e.group_id) || { count: 0, lastTime: 0, lastResetTime: Date.now() };
        counter.count++;

        const shouldReply = counter.count >= MESSAGE_COUNT_THRESHOLD || (Math.random() < config.reply_probability && Date.now() - counter.lastTime > MESSAGE_INTERVAL);
        if (!shouldReply) return false;

        counter.count = counter.count >= MESSAGE_COUNT_THRESHOLD ? 0 : counter.count;
        counter.lastTime = Date.now();

        groupCounters.set(e.group_id, counter);

        await this.sendChat(e, this.buildPrompt(e), config.ai_temperature);
        return true;
    }

    buildPrompt(e) {
        const promptText = config.ai_prompt.replace('{group_id}', e.group_id);
        const prompt = [{ role: "system", content: promptText }];

        const messages = groupMessages.get(e.group_id) || [];
        const senderName = e.sender?.nickname || "未知用户";
        const userMessage = e.msg || "";

        messages.push({ role: "user", content: `用户名:${senderName}，userid:${e.user_id} 说：${userMessage}` });
        if (messages.length > MAX_MESSAGE_HISTORY) messages.shift();

        groupMessages.set(e.group_id, messages);

        return [...prompt, ...messages];
    }

    async reset(e) {
        if (!groupMessages.has(e.group_id)) return e.reply('本群没有对话记录');

        groupMessages.set(e.group_id, []);
        groupCounters.set(e.group_id, { count: 0, lastTime: 0, lastResetTime: Date.now() });
        e.reply('重置对话完毕');
    }

    async sendChat(e, prompt, temperature) {
        try {
            const completion = await this.openai.chat.completions.create({
                messages: prompt,
                model: config.model_type,
                temperature,
                frequency_penalty: 0.2,
                presence_penalty: 0.2,
            });

            let response = completion.choices?.[0]?.message?.content || "。";

            const thinkRegex = /<think>(.*?)<\/think>\s*\n*\s*\n*/gs;
            const thinkMatches = [...response.matchAll(thinkRegex)];
            let thinkContent = [];

            if (config.enable_think_process) {
                thinkContent = thinkMatches.map(match => match[1].trim());
                response = response.replace(thinkRegex, '');
            } else {
                response = response.replace(thinkRegex, '');
            }

            if (config.enable_segment_sending) {
                const specialRegex = /(\([^()]*\)|（[^（）]*）|《[^《》]*》|“[^“”]*”|"[^"]*")/g;
                const specialMatches = [...response.matchAll(specialRegex)];
                let segments = [];
                let lastIndex = 0;

                for (const match of specialMatches) {
                    const textBefore = response.slice(lastIndex, match.index);
                    if (textBefore.trim() !== '') {
                        segments.push(...textBefore.split(/([。！？])/).filter(s => s.trim() !== ''));
                    }
                    segments.push(match[0]);
                    lastIndex = match.index + match[0].length;
                }

                const remainingText = response.slice(lastIndex);
                if (remainingText.trim() !== '') {
                    segments.push(...remainingText.split(/([。！？])/).filter(s => s.trim() !== ''));
                }

                for (let i = 0; i < segments.length; i += 2) {
                    const textSegment = segments[i] + (segments[i + 1] || '');
                    await this.sendResponse(e, textSegment);
                    await common.sleep(SEGMENT_DELAY);
                }
            } else {
                await this.sendResponse(e, response);
            }

            if (config.enable_think_process && thinkContent.length > 0) {
                const output = await common.makeForwardMsg(e, thinkContent, '思考过程');
                await e.reply(output);
            }

            if (config.enable_emoji && Math.random() < config.emoji_probability) await this.sendMessage(e, 'image');

            const messages = groupMessages.get(e.group_id) || [];
            messages.push({ role: "assistant", content: response });
            groupMessages.set(e.group_id, messages);

        } catch (error) {
            this.handleError(e, error, 'Chat API 错误');
        }
    }

    async sendResponse(e, text) {
        if (config.enable_voice && Math.random() < config.voice_probability) {
            await this.sendMessage(e, 'voice', text);
        } else {
            await e.reply(text);
        }
    }

    async sendMessage(e, type, content = '') {
        try {
            if (type === 'voice' && config.enable_voice) {
                const apiUrl = `https://oiapi.net/API/QQCharacterTts/?content=${encodeURIComponent(content)}&key=${config.tts_key}&name=${encodeURIComponent(config.speaker)}`;
                const response = await fetch(apiUrl);
                const result = await response.json();

                if (result.code === 1 && result.message) e.reply(segment.record(result.message));
                else e.reply(`语音生成失败：${result.message || '未知错误'}`);
            } else if (type === 'image' && config.enable_emoji) {
                const imageUrl = config.emoji_api[Math.floor(Math.random() * config.emoji_api.length)];
                await e.reply(segment.image(imageUrl));
            }
        } catch (error) {
            this.handleError(e, error, '消息发送失败');
        }
    }

    handleError(e, error, context) {
        console.error(`${context}:`, error);

        if (error instanceof fetch.FetchError) {
            e.reply(`网络错误：${error.message}`);
        } else if (error instanceof OpenAI.APIError) {
            e.reply(`API 错误：${error.message}`);
        } else {
            e.reply(`未知错误：${error.message}`);
        }
    }
}