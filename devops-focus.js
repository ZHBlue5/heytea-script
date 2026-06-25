// ==UserScript==
// @name         运维平台审核和重试按钮居中脚本增强版
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  将审核按钮、重试按钮、CANCELED、RUNNING和FAILED状态节点在鼠标悬停时移动到屏幕中间，并自动滚动页面
// @author       ZHBlue
// @match        *://devops-bk.heyteago.com/*
// @grant        none
// @inject-into  all-frames
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const REVIEW_CLICK_DELAY_MS = 300;
    const INITIAL_SCROLL_DELAY_MS = 500;

    console.log('审核和重试按钮居中脚本已加载');

    function initializeScript() {
        console.log('脚本开始运行');

        let initialScrollDone = false;

        function scrollToButton(button) {
            button.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
            });

            setTimeout(() => {
                if (Math.abs(button.getBoundingClientRect().top - window.innerHeight / 2) > 10) {
                    const rect = button.getBoundingClientRect();
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetY = rect.top + scrollTop - (window.innerHeight / 2) + (rect.height / 2);
                    const targetX = rect.left + scrollLeft - (window.innerWidth / 2) + (rect.width / 2);

                    window.scrollTo({
                        top: targetY,
                        left: targetX,
                        behavior: 'smooth',
                    });
                }
            }, 100);
        }

        function isReviewButton(button) {
            return button.classList.contains('atom-reviewing-tips');
        }

        function tryClickReview(button) {
            if (!isReviewButton(button) || button.disabled) return;
            button.click();
        }

        function scheduleReviewClick(button) {
            if (!isReviewButton(button) || button.dataset.reviewClickScheduled === '1') return;
            button.dataset.reviewClickScheduled = '1';
            setTimeout(() => {
                if (!button.isConnected) return;
                tryClickReview(button);
            }, REVIEW_CLICK_DELAY_MS);
        }

        function handleButtons() {
            const reviewButtons = document.querySelectorAll('.atom-reviewing-tips.atom-operate-area');
            const retryButtons = document.querySelectorAll('span.atom-operate-area');
            const canceledNodes = document.querySelectorAll('.readonly.bk-pipeline-atom.CANCELED');
            const runningNodes = document.querySelectorAll('.readonly.bk-pipeline-atom.RUNNING');
            const failedNodes = document.querySelectorAll('.stage-status.element.FAILED.readonly');

            const allButtons = [...reviewButtons, ...retryButtons, ...canceledNodes, ...runningNodes, ...failedNodes].filter(button => {
                if (button.classList.contains('atom-operate-area') && !button.classList.contains('atom-reviewing-tips')) {
                    return button.textContent.trim() === '重试';
                }
                return true;
            });

            if (allButtons.length === 0) return;

            console.log(
                '找到节点总数:', allButtons.length,
                '(审核:', reviewButtons.length,
                ', 重试:', retryButtons.length,
                ', CANCELED:', canceledNodes.length,
                ', RUNNING:', runningNodes.length,
                ', FAILED:', failedNodes.length, ')',
            );

            if (!initialScrollDone && allButtons.length > 0) {
                initialScrollDone = true;
                const scrollTarget = reviewButtons[0] || allButtons[0];
                setTimeout(() => scrollToButton(scrollTarget), INITIAL_SCROLL_DELAY_MS);
            }

            allButtons.forEach((button) => {
                if (button.dataset.handlerAttached === '1') return;
                button.dataset.handlerAttached = '1';

                if (isReviewButton(button)) {
                    scheduleReviewClick(button);
                }

                button.addEventListener('mouseenter', () => {
                    scrollToButton(button);
                    tryClickReview(button);
                });
            });
        }

        const style = document.createElement('style');
        style.id = 'devops-focus-style';
        style.textContent = `
            .atom-reviewing-tips.atom-operate-area,
            span.atom-operate-area,
            .readonly.bk-pipeline-atom.CANCELED,
            .readonly.bk-pipeline-atom.RUNNING,
            .stage-status.element.FAILED.readonly {
                transition: all 0.2s ease !important;
            }
        `;
        if (!document.getElementById('devops-focus-style')) {
            document.head.appendChild(style);
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    handleButtons();
                    return;
                }
            }
        });

        function boot() {
            if (!document.body) return;
            observer.observe(document.body, { childList: true, subtree: true });
            handleButtons();
        }

        if (document.body) boot();
        else document.addEventListener('DOMContentLoaded', boot, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScript, { once: true });
    } else {
        initializeScript();
    }
})();
