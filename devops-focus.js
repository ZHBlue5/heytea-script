// ==UserScript==
// @name         运维平台审核和重试按钮居中脚本增强版
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  将审核按钮、重试按钮、CANCELED、RUNNING和FAILED状态节点在鼠标悬停时移动到屏幕中间，并自动滚动页面
// @author       ZHBlue
// @match        *://devops-bk.heyteago.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const INIT_DELAY = 1;

    console.log(`审核和重试按钮居中脚本已加载，将在${INIT_DELAY/1000}秒后开始运行`);

    function initializeScript() {
        console.log('脚本开始运行');

        let clonedButton = null;
        let originalButton = null;

        function scrollToButton(button) {
            // 使用 scrollIntoView 确保元素可见
            button.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });

            // 备用滚动方法，以防 scrollIntoView 不生效
            setTimeout(() => {
                if (Math.abs(button.getBoundingClientRect().top - window.innerHeight/2) > 10) {
                    const rect = button.getBoundingClientRect();
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetY = rect.top + scrollTop - (window.innerHeight / 2) + (rect.height / 2);
                    const targetX = rect.left + scrollLeft - (window.innerWidth / 2) + (rect.width / 2);

                    window.scrollTo({
                        top: targetY,
                        left: targetX,
                        behavior: 'smooth'
                    });
                }
            }, 100);
        }

        function handleButtons() {
            // 查找审核按钮、重试按钮和状态节点
            const reviewButtons = document.querySelectorAll('.atom-reviewing-tips.atom-operate-area');
            const retryButtons = document.querySelectorAll('span.atom-operate-area');
            const canceledNodes = document.querySelectorAll('.readonly.bk-pipeline-atom.CANCELED');
            const runningNodes = document.querySelectorAll('.readonly.bk-pipeline-atom.RUNNING');
            const failedNodes = document.querySelectorAll('.stage-status.element.FAILED.readonly');

            const allButtons = [...reviewButtons, ...retryButtons, ...canceledNodes, ...runningNodes, ...failedNodes].filter(button => {
                // 过滤重试按钮，只保留文本内容为"重试"的按钮
                if (button.classList.contains('atom-operate-area') && !button.classList.contains('atom-reviewing-tips')) {
                    return button.textContent.trim() === '重试';
                }
                return true;
            });

            console.log('找到节点总数:', allButtons.length, '(审核按钮:', reviewButtons.length, ', 重试按钮:', retryButtons.length, ', CANCELED节点:', canceledNodes.length, ', RUNNING节点:', runningNodes.length, ', FAILED节点:', failedNodes.length, ')');

            allButtons.forEach((button, index) => {
                if (button.dataset.handlerAttached) return;
                button.dataset.handlerAttached = 'true';

                // 立即滚动到第一个找到的按钮
                if (index === 0) {
                    setTimeout(() => {
                        scrollToButton(button);
                        // 如果是审核按钮，自动点击
                        if (button.classList.contains('atom-reviewing-tips')) {
                            button.click();
                        }
                    }, 500);
                }

                // 鼠标进入时的处理
                button.addEventListener('mouseenter', (e) => {
                    originalButton = e.target;
                    scrollToButton(originalButton);
                    // 如果是审核按钮且不为disabled状态，自动点击
                    if (originalButton.classList.contains('atom-reviewing-tips') && !originalButton.disabled) {
                        originalButton.click();
                    }
                });
            });
        }

        // 添加动画样式
        // 创建一个新的<style>标签来添加CSS样式
        const style = document.createElement('style');

        // 定义CSS样式内容
        style.textContent = `
            // 定义一个名为fadeIn的动画效果
            @keyframes fadeIn {
                // 动画开始时：元素完全透明，缩小到80%，并居中
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                // 动画结束时：元素完全不透明，恢复到正常大小，并居中
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }

            // 为以下类名的元素添加过渡效果
            .atom-reviewing-tips.atom-operate-area,  // 审核按钮
            span.atom-operate-area,                  // 操作区域
            .readonly.bk-pipeline-atom.CANCELED,     // 已取消状态
            .readonly.bk-pipeline-atom.RUNNING,      // 运行中状态
            .stage-status.element.FAILED.readonly {  // 失败状态
                // 所有属性变化时，在0.2秒内平滑过渡
                // !important表示这个样式优先级最高
                transition: all 0.2s ease !important;
            }
        `;
        document.head.appendChild(style);

        // 监听动态添加的元素
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length) {
                    handleButtons();
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 初始化处理
        handleButtons();
    }

    setTimeout(() => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeScript);
        } else {
            initializeScript();
        }
    }, INIT_DELAY);
})();