// ==UserScript==
// @name Heytea Intl Logs 一体化自动登录与跳转
// @namespace http://tampermonkey.net/
// @version 1.3.0
// @description 1) 阿里云登录页精准匹配即重定向回内部登录；2) 内部登录页自动填密码并提交，随后 3 秒跳到 SLS 日志页
// @match https://intl-logs.lan.heytea-co.com/login*
// @match https://account.aliyun.com/login/login.htm?oauth_callback=https://sls4service.console.aliyun.com/lognext/exit
// @run-at document-start
// @grant GM_getValue
// @config password secret 内部登录密码 required
// ==/UserScript==

(function () {
    'use strict';

    const SESSION_FLAG = 'intlLogs_autoLogin_done';
    const INTERNAL_LOGIN_URL = 'https://intl-logs.lan.heytea-co.com/login';
    const ALIYUN_LOGIN_URL = 'https://account.aliyun.com/login/login.htm?oauth_callback=https://sls4service.console.aliyun.com/lognext/exit';
    const REDIRECT_URL = 'https://sls4service.console.aliyun.com/lognext/project/intl-heytea-devteststg-alisz/logsearch/intl-heytea-devteststg-logs-k8s?spm=5176.2020520112.114.d_0_click_project.153a3efdSrAzyU&slsRegion=cn-shenzhen';

    // 1) 若当前是“精准匹配”的阿里云登录页，立即重定向回内部登录页
    if (location.href === ALIYUN_LOGIN_URL) {
        location.replace(INTERNAL_LOGIN_URL);
        return;
    }

    // 仅在内部登录页执行自动登录逻辑
    if (!location.href.startsWith(INTERNAL_LOGIN_URL)) return;

    // 已触发过一次，避免重复提交
    if (sessionStorage.getItem(SESSION_FLAG) === '1') return;

    function setInputValue(input, value) {
        try {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(input, value); else input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        } catch {
            input.value = value;
        }
    }

    function findPasswordInput(root = document) {
        return (
            root.querySelector('input[type="password"]') ||
            root.querySelector('input[name*="password" i]') ||
            root.querySelector('.ant-input-password input[type="password"]') ||
            root.querySelector('input[autocomplete="current-password"]') ||
            root.querySelector('input[autocomplete="new-password"]') ||
            null
        );
    }

    function findSubmitButton(root = document) {
        let btn = root.querySelector('button[type="submit"], input[type="submit"], button.ant-btn-primary');
        if (btn) return btn;
        const buttons = Array.from(root.querySelectorAll('button, input[type="button"], input[type="submit"]'));
        const textMatches = ['登录', 'Login', 'Sign in', 'Sign In', 'SignIn'];
        return (
            buttons.find(b =>
                textMatches.some(t => (b.innerText || b.value || '').trim().toLowerCase().includes(t.toLowerCase()))
            ) || null
        );
    }

    function findFormFromElement(el) {
        return el?.form || el?.closest?.('form') || document.querySelector('form');
    }

    function submitFormOrClick(form, btn) {
        if (form && typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return true;
        }
        if (btn) {
            btn.click();
            return true;
        }
        if (form) {
            form.submit();
            return true;
        }
        return false;
    }

    function redirectAfterDelay() {
        setTimeout(() => {
            if (sessionStorage.getItem(SESSION_FLAG) === '1') {
                window.location.href = REDIRECT_URL;
            }
        }, 3000);
    }

    function tryAutoLogin() {
        const password = GM_getValue('password', '');
        if (!password) return false;

        const pwd = findPasswordInput();
        if (!pwd) return false;

        if (!pwd.value) {
            setInputValue(pwd, password);
        }

        const form = findFormFromElement(pwd);
        const btn = findSubmitButton(form || document);

        const ok = submitFormOrClick(form, btn);
        if (ok) {
            sessionStorage.setItem(SESSION_FLAG, '1');
            redirectAfterDelay();
        }
        return ok;
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        if (tryAutoLogin()) return;
    }

    const observer = new MutationObserver(() => {
        if (tryAutoLogin()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => observer.disconnect(), 10000);
})();
