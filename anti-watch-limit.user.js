// ==UserScript==
// @name         屏蔽视频试看限制 & M3U8 捕获（iPhone版适配）
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  终极框架：拦截试看、捕获主/子 m3u8、展示UI面板（完美适配iPhone竖屏）
// @match        *://*/*
// @run-at       document-start
// @inject-into  page
// ==/UserScript==

(function() {
    'use strict';

    if (window._antiLimitInjected) return;
    window._antiLimitInjected = true;

    const IS_TOP = window.self === window.top;

    // ==========================================
    // 部分 A: UI 显示 (仅主窗口) - 已针对手机优化
    // ==========================================
    if (IS_TOP) {
        const CAPTURED_URLS = new Set();
        let autoHideTimer = null;
        let timeLeft = 5;

        function startCountdown() {
            if (autoHideTimer) clearInterval(autoHideTimer);
            const timerEl = document.getElementById('m3u8-timer-display');
            const box = document.getElementById('m3u8-master-panel');
            if (!timerEl || !box) return;
            
            // 如果面板是隐藏的，显示出来
            if (box.style.display === 'none') {
                box.style.display = 'flex';
                box.style.opacity = '1';
            }
            
            timeLeft = 5;
            timerEl.innerText = `(${timeLeft}s)`;
            timerEl.style.color = '#fa0';
            
            autoHideTimer = setInterval(() => {
                timeLeft--;
                if (timeLeft <= 0) {
                    clearInterval(autoHideTimer);
                    box.style.display = 'none';
                } else {
                    timerEl.innerText = `(${timeLeft}s)`;
                }
            }, 1000);
        }

        function pauseCountdown() {
            if (autoHideTimer) clearInterval(autoHideTimer);
            const timerEl = document.getElementById('m3u8-timer-display');
            if (timerEl) {
                timerEl.innerText = '(保持)';
                timerEl.style.color = '#0f0';
            }
        }

        function createMasterPanel() {
            if (document.getElementById('m3u8-master-panel')) return;

            const box = document.createElement('div');
            box.id = 'm3u8-master-panel';
            // 手机适配关键样式修改：使用 left/right 定位，取消固定 width
            box.style.cssText = `
                position: fixed; 
                top: 10px; 
                left: 10px; 
                right: 10px; 
                width: auto;
                z-index: 2147483647;
                background: rgba(0, 0, 0, 0.95); 
                color: #fff; 
                border: 1px solid #00aa00; 
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                display: flex; 
                flex-direction: column;
                max-height: 80vh; /* 防止遮挡底部导航栏 */
                transition: opacity 0.3s;
                font-size: 13px;
            `;
            
            // 触摸交互处理
            box.ontouchstart = pauseCountdown;
            // 点击面板任何空白处暂停倒计时，不使用 mouseleave，因为手机没有鼠标移出
            box.onclick = pauseCountdown; 

            const header = document.createElement('div');
            header.style.cssText = "padding: 8px 10px; background: #003300; border-bottom: 1px solid #005500; display:flex; justify-content:space-between; align-items:center; border-radius: 8px 8px 0 0;";

            const titleArea = document.createElement('div');
            titleArea.innerHTML = '<span style="font-weight:bold; font-size:14px;">🕵️ M3U8捕获</span> ';
            const timerDisplay = document.createElement('span');
            timerDisplay.id = 'm3u8-timer-display';
            timerDisplay.style.cssText = "font-size:12px; margin-left:5px; color:#fa0;";
            titleArea.appendChild(timerDisplay);
            header.appendChild(titleArea);

            const controls = document.createElement('div');
            const clearBtn = document.createElement('button');
            clearBtn.innerText = '清空';
            clearBtn.style.cssText = "cursor:pointer; background:#333; color:#fff; border:none; padding:4px 8px; border-radius:4px; margin-right:8px; font-size:12px;";
            clearBtn.onclick = (e) => {
                e.stopPropagation(); // 防止触发 box 点击
                document.getElementById('m3u8-list-content').innerHTML = '';
                CAPTURED_URLS.clear();
            };

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '隐藏';
            closeBtn.style.cssText = "cursor:pointer; background:#611; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:12px;";
            closeBtn.onclick = (e) => {
                e.stopPropagation(); // 防止触发 box 点击
                box.style.display = 'none';
                if (autoHideTimer) clearInterval(autoHideTimer);
            };

            controls.appendChild(clearBtn);
            controls.appendChild(closeBtn);
            header.appendChild(controls);

            const content = document.createElement('div');
            content.id = 'm3u8-list-content';
            content.style.cssText = "overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; -webkit-overflow-scrolling: touch;"; // iOS平滑滚动
            box.appendChild(header);
            box.appendChild(content);
            document.body.appendChild(box);
        }

        function addLinkToUI(data) {
            const { url, source, desc } = data;
            if (CAPTURED_URLS.has(url)) return;
            CAPTURED_URLS.add(url);

            createMasterPanel();
            startCountdown();

            const list = document.getElementById('m3u8-list-content');
            const item = document.createElement('div');

            let tagColor = '#666';
            let tagText = '未知';
            let borderColor = '#666';

            if (url.includes('/hls/') || desc.includes('子链接')) {
                tagColor = '#0f0';
                tagText = '🔥正片';
                borderColor = '#0f0';
            } else if (desc.includes('索引')) {
                tagColor = '#fa0';
                tagText = '⚠️索引';
                borderColor = '#fa0';
            }

            item.style.cssText = `background:#1a1a1a; border-left:3px solid ${borderColor}; padding:8px; border-radius:4px; border-bottom:1px solid #333;`;

            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:12px;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        <span style="color:${tagColor}; font-weight:bold; border:1px solid ${tagColor}; padding:0px 3px; border-radius:3px; font-size:11px;">${tagText}</span>
                        <span style="color:#888; margin-left:5px; font-size:11px;">${source}</span>
                    </div>
                </div>
                <input value="${url}" readonly style="width:100%; box-sizing:border-box; background:#080808; color:#ccc; border:1px solid #333; padding:6px; margin-bottom:6px; font-family:monospace; font-size:11px; display:block; border-radius:3px;">
                <button class="copy-btn" style="width:100%; box-sizing:border-box; background:#222; color:#aaa; border:1px solid #444; padding:6px; cursor:pointer; font-size:13px; border-radius:4px;">复制链接</button>
            `;

            const btn = item.querySelector('.copy-btn');
            const input = item.querySelector('input');
            
            // 阻止输入框点击冒泡，方便复制
            input.onclick = (e) => {
                e.stopPropagation();
                input.select();
            };
            
            btn.onclick = (e) => {
                e.stopPropagation();
                pauseCountdown(); // 复制时暂停倒计时
                input.select();
                document.execCommand('copy');
                btn.innerText = '✅ 已复制';
                btn.style.background = '#060';
                btn.style.color = '#fff';
                btn.style.borderColor = '#0f0';
                setTimeout(() => {
                    btn.innerText = '复制链接';
                    btn.style.background = '#222';
                    btn.style.color = '#aaa';
                    btn.style.borderColor = '#444';
                }, 1500);
            };

            if (url.includes('/hls/') || desc.includes('子链接'))
                list.insertBefore(item, list.firstChild);
            else
                list.appendChild(item);
        }

        window.addEventListener('message', e => {
            if (e.data && e.data.type === 'M3U8_REPORT') addLinkToUI(e.data.data);
        });
    }

    // ==========================================
    // 部分 B: 深度解析捕获 (保持不变)
    // ==========================================

    function report(url, source, desc = '') {
        if (!url || !url.includes('.m3u8')) return;
        try {
            if (!url.startsWith('http')) {
                url = new URL(url, window.location.href).href;
            }
        } catch (e) { return; }

        const data = { url, source, desc };
        if (IS_TOP)
            setTimeout(() => addLinkToUI(data), 0);
        else
            window.top.postMessage({ type: 'M3U8_REPORT', data }, '*');
    }

    function parseContent(content, masterUrl) {
        if (!content) return;
        if (content.includes('#EXT-X-STREAM-INF')) {
            const lines = content.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line && !line.startsWith('#') && line.includes('.m3u8')) {
                    let childUrl = line;
                    if (!childUrl.startsWith('http')) {
                        childUrl = new URL(childUrl, masterUrl).href;
                    }
                    report(childUrl, '自动解析', '👉 从索引中提取的子链接');
                }
            }
        }
    }

    // XHR hook
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._targetUrl = url;
        return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
        if (typeof this._targetUrl === 'string' && this._targetUrl.includes('.m3u8')) {
            this.addEventListener('load', function() {
                const fullUrl = this.responseURL || this._targetUrl;
                report(fullUrl, '网络(XHR)', '可能为索引或正片'); // 缩短文本以适应手机

                let content = '';
                try {
                    if (this.responseType === 'arraybuffer' && this.response) {
                        content = new TextDecoder("utf-8").decode(this.response);
                    } else if (!this.responseType || this.responseType === 'text') {
                        content = this.responseText;
                    }
                } catch (e) {}

                if (content) parseContent(content, fullUrl);
            });
        }
        return originalSend.apply(this, arguments);
    };

    // Fetch hook
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const response = await originalFetch.call(this, input, init);
        const clone = response.clone();
        try {
            let url = (typeof input === 'string') ? input : input.url;
            if (url && url.includes('.m3u8')) {
                report(url, '网络(Fetch)', '可能为索引或正片');
                clone.text().then(text => parseContent(text, url)).catch(() => {});
            }
        } catch (e) {}
        return response;
    };

    // Performance Observer
    try {
        const observer = new PerformanceObserver(list => {
            list.getEntries().forEach(entry => {
                if (entry.name.includes('.m3u8')) {
                    report(entry.name, '网络(监听)', '无法判断类型');
                }
            });
        });
        observer.observe({ entryTypes: ['resource'] });
    } catch (e) {}

    // 页面变量检查
    setInterval(() => {
        try {
            if (window.player_aaaa && window.player_aaaa.url) {
                report(window.player_aaaa.url, '页面变量', '通常为索引');
            }
        } catch (e) {}
    }, 2000);

    // ==========================================
    // 部分 C: 试看屏蔽 (保持不变)
    // ==========================================

    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function(callback, delay, ...args) {
        if (delay >= 170000 && delay <= 190000) return -1;
        if (callback && typeof callback === 'function') {
            const str = callback.toString();
            if ((str.includes('.MacPlayer') || str.includes('MacPlayer')) && str.includes('.html(')) return -1;
        }
        return originalSetTimeout.apply(this, [callback, delay, ...args]);
    };

    function hookJQuery() {
        if (window.jQuery && !window.jQuery.fn._hooked) {
            const $ = window.jQuery;
            const originalHtml = $.fn.html;
            $.fn.html = function(content) {
                if (this.selector === '.MacPlayer' || this.hasClass('MacPlayer')) {
                    if (content && typeof content === 'string' && (content.includes('hl-player-showtry') || content.includes('试看'))) return this;
                }
                return originalHtml.apply(this, arguments);
            };
            $.fn._hooked = true;
        }
    }
    setInterval(hookJQuery, 1000);

})();
