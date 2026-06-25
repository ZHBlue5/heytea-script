// ==UserScript==
// @name         inner-logs 自动密码并延时跳转
// @namespace    heyteago-tools
// @version      1.2.1
// @description  自动填写免登录密码并在 3 秒后跳转到 CLS 搜索页
// @match        https://inner-logs.heyteago.com/*
// @run-at       document-start
// @grant        GM_getValue
// @config       password secret 免登录跳转密码 required
// ==/UserScript==

(function () {
    'use strict';

    const KEYWORD = '免登陆跳转服务密码';
    const REDIRECT_URL = 'https://console.cloud.tencent.com/cls/search?hideLeftNav=true&hideTopNav=true&hideHeader=true&time=now-3d,now&topicType=log&multiple=false&timeZone=browser&analysis=eyJ0eXBlIjoidGFibGUifQ&region=ap-guangzhou&topic_id=20960686-2ec6-43ad-864c-98ce3fc28d7f';
    const REDIRECT_DELAY_MS = 3000;

    function installPromptOverride(password) {
        const originalPrompt = window.prompt;

        function overridePrompt(message, defaultValue) {
            try {
                if (typeof message === 'string' && message.includes(KEYWORD)) {
                    return password;
                }
            } catch (_) {}
            return originalPrompt.call(this, message, defaultValue);
        }

        try {
            Object.defineProperty(window, 'prompt', {value: overridePrompt, configurable: true});
            window.self.prompt = window.prompt;
            return;
        } catch (_) {}

        const script = document.createElement('script');
        script.textContent = `(${function injectPromptOverride(pwd, kw) {
            const original = window.prompt;
            window.prompt = function (msg, def) {
                try {
                    if (typeof msg === 'string' && msg.includes(kw)) return pwd;
                } catch (_) {}
                return original.call(this, msg, def);
            };
        }})(${JSON.stringify(password)}, ${JSON.stringify(KEYWORD)});`;
        (document.documentElement || document.head).appendChild(script);
        script.remove();
    }

    function scheduleRedirect() {
        setTimeout(() => {
            try {
                window.location.replace(REDIRECT_URL);
            } catch (_) {
                window.location.href = REDIRECT_URL;
            }
        }, REDIRECT_DELAY_MS);
    }

    const password = GM_getValue('password', '');
    if (password) {
        installPromptOverride(password);
    }

    scheduleRedirect();
})();
