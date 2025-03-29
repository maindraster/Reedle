// 如果侧边栏不存在，则创建；如果存在则删除（初始状态下采用创建方式）
if (!document.getElementById('my-extension-sidebar')) {
    createSidebarElement();
  }
  
  // 确保消息监听器正确处理getContent请求
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getContent') {
      console.log('收到获取内容请求');
      const content = document.body.innerText || document.body.textContent || '';
      console.log(`返回内容长度: ${content.length}`);
      sendResponse({ content: content });
    } else if (message.action === 'closeSidebar') {
      const sidebar = document.getElementById('my-extension-sidebar');
      if (sidebar) {
        sidebar.remove();
        updateSidebarState(false);
      }
      sendResponse({ success: true });
    } else if (message.action === 'toggleSidebar') {
      const sidebar = document.getElementById('my-extension-sidebar');
      if (sidebar) {
        sidebar.remove();
        updateSidebarState(false);
      } else {
        createSidebarElement();
        updateSidebarState(true);
      }
      sendResponse({ success: true });
    }
    return true; // 保持连接打开，以便异步响应
  });
  
  // 监听来自sidebar的消息
  window.addEventListener('message', function(event) {
    // 确保消息来源是我们的iframe
    const sidebar = document.getElementById('my-extension-sidebar');
    const iframe = sidebar ? sidebar.querySelector('iframe') : null;
    
    if (iframe && event.source === iframe.contentWindow) {
      if (event.data.action === 'getContent') {
        event.source.postMessage({
          response: 'content',
          content: document.body.innerText
        }, '*');
      } else if (event.data.action === 'closeSidebar') {
        sidebar.remove();
        updateSidebarState(false);
      } else if (event.data.action === 'startAggregateSummary') {
        // 转发聚合摘要请求到background.js
        chrome.runtime.sendMessage({ action: 'startAggregateSummary' }, function(response) {
          event.source.postMessage({
            response: 'aggregateSummary',
            success: response?.success || false
          }, '*');
        });
      } else if (event.data.action === 'resizeSidebar') {
        // 处理侧边栏大小调整
        if (sidebar) {
          sidebar.style.width = event.data.width;
          console.log('调整侧边栏宽度为:', event.data.width);
        }
      }
    }
  });
  
  function createSidebarElement() {
    const sidebar = document.createElement('div');
    sidebar.id = 'my-extension-sidebar';
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '0';
    
    // 从localStorage读取宽度，如果没有则使用默认值30%
    const savedWidth = localStorage.getItem('shidu_sidebar_width') || '30%';
    sidebar.style.width = savedWidth;
    
    sidebar.style.height = '100%';
    sidebar.style.backgroundColor = '#fff';
    sidebar.style.borderLeft = '1px solid #ccc';
    sidebar.style.zIndex = '9999';
    sidebar.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
    sidebar.style.overflow = 'auto';
    sidebar.style.transition = 'width 0.1s ease'; // 添加平滑过渡效果
  
    document.body.appendChild(sidebar);
  
    if (window.location.href.startsWith('chrome://')) {
      sidebar.innerHTML = `<div style="padding: 20px;">
        <h2>无法在Chrome内部页面使用</h2>
        <p>由于浏览器安全限制，此扩展无法在Chrome内部页面上运行。</p>
        <button id="close-sidebar">关闭</button>
      </div>`;
      
      const closeBtn = document.getElementById('close-sidebar');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          sidebar.remove();
          updateSidebarState(false);
        });
      }
    } else {
      // 使用iframe加载sidebar.html，这样可以保持Chrome API的上下文
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '99%';
      iframe.style.border = 'none';
      iframe.src = chrome.runtime.getURL('sidebar.html');
      
      sidebar.appendChild(iframe);
      
      // 设置一个全局对象来与iframe通信
      window.sidebarInterface = {
        getContent: () => document.body.innerText,
        closeSidebar: () => {
          sidebar.remove();
          updateSidebarState(false);
        }
      };
    }
  }
  
  function handleSummarize() {
    const content = document.body.innerText;
    const summaryElement = document.getElementById('summary');
    if (!summaryElement) return;
    
    summaryElement.innerHTML = '<p>正在生成摘要，请稍候...</p>';
    
    generateSummaryWithLocalModel(content)
      .then(summary => {
        summaryElement.innerHTML = `
          <h3>网页内容摘要：</h3>
          <div style="white-space: pre-wrap; font-size: 14px; border: 1px solid #ddd; padding: 10px; background-color: #f9f9f9;">
            ${summary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </div>
        `;
      })
      .catch(error => {
        summaryElement.innerHTML = `
          <h3>摘要生成失败：</h3>
          <p style="color: red;">${error.message}</p>
          <button id="showRawContent">显示原始内容</button>
        `;
        
        const showRawBtn = document.getElementById('showRawContent');
        if (showRawBtn) {
          showRawBtn.addEventListener('click', () => showOriginalContent(content, summaryElement));
        }
      });
  }
  
  function showOriginalContent(content, element) {
    const maxLength = 5000;
    const displayContent = content.length > maxLength ? 
      content.substring(0, maxLength) + '...(内容过长，已截断)' : 
      content;
    
    element.innerHTML = `
      <h3>捕获到的网页内容：</h3>
      <div style="max-height: 400px; overflow: auto; white-space: pre-wrap; font-size: 12px; border: 1px solid #ddd; padding: 10px; background-color: #f9f9f9;">
        ${displayContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
      <p style="margin-top: 10px; font-size: 12px; color: #666;">
        总字符数: ${content.length}
      </p>
    `;
  }
  
  // 使用本地模型生成摘要的函数
  async function generateSummaryWithLocalModel(text) {
    // 本地模型的URL，可以在选项页面中配置
    const localModelUrl = 'http://localhost:8000/v1/chat/completions'; // 默认地址，可根据实际情况修改
    
    // 准备请求数据
    const messages = [
      {
        "role": "system", 
        "content": "你是一个专业的文本摘要助手。请为以下文本生成一个简洁、全面的摘要，突出关键信息和主要观点。"
      },
      {
        "role": "user", 
        "content": text
      }
    ];
    
    const requestData = {
      "model": "local-model", // 本地模型名称，可根据实际情况修改
      "messages": messages,
      "temperature": 0.7,
      "max_tokens": -1,
      "stream": false
    };
    
    try {
      // 发送请求到本地模型
      const response = await fetch(localModelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        timeout: 60000 // 60秒超时
      });
      
      // 检查响应状态
      if (!response.ok) {
        throw new Error(`本地模型返回错误状态码: ${response.status}`);
      }
      
      // 解析响应
      const result = await response.json();
      
      // 提取回复内容
      if (result.choices && result.choices.length > 0 && 
          result.choices[0].message && result.choices[0].message.content) {
        return result.choices[0].message.content.trim();
      } else {
        throw new Error('无法从模型响应中提取摘要内容');
      }
    } catch (error) {
      console.error('调用本地模型出错:', error);
      throw new Error(`生成摘要失败: ${error.message}`);
    }
  }
  
  function updateSidebarState(isVisible) {
    chrome.runtime.sendMessage({ 
      action: 'updateSidebarState', 
      isVisible: isVisible 
    });  }
