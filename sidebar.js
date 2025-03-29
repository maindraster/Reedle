console.log('sidebar.js loaded');

// Wrap all code in an IIFE to avoid global scope pollution
(function() {
  // 获取页面元素
  const summaryPage = document.getElementById('summaryPage');
  const optionsPage = document.getElementById('optionsPage');
  const pageTitle = document.getElementById('pageTitle');
  const optionsBtn = document.getElementById('optionsBtn');
  const backBtn = document.getElementById('backBtn');
  const saveBtn = document.getElementById('saveBtn');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const aggregateBtn = document.getElementById('aggregateBtn');

  // 添加自定义滚动条样式
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    /* 自定义滚动条样式 */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #aaa;
    }
  `;
  document.head.appendChild(styleElement);

  console.log('页面元素:', {
    summaryPage: !!summaryPage,
    optionsPage: !!optionsPage,
    optionsBtn: !!optionsBtn,
    backBtn: !!backBtn
  });

  // 设置与父页面通信的函数
  function sendMessageToParent(message) {
    window.parent.postMessage(message, '*');
  }

  // 获取页面内容
  function getPageContent() {
    return new Promise((resolve) => {
      sendMessageToParent({ action: 'getContent' });
      
      function messageHandler(event) {
        if (event.data && event.data.response === 'content') {
          window.removeEventListener('message', messageHandler);
          resolve(event.data.content);
        }
      }
      
      window.addEventListener('message', messageHandler);
    });
  }

  // 切换到设置页面
  optionsBtn.onclick = function() {
    console.log('点击设置按钮');
    summaryPage.style.display = 'none';
    optionsPage.style.display = 'block';
    pageTitle.textContent = '设置';
    loadOptions();
  };

  // 返回摘要页面
  backBtn.onclick = function() {
    console.log('点击返回按钮');
    summaryPage.style.display = 'block';
    optionsPage.style.display = 'none';
    pageTitle.textContent = '网页总结';
  };

  // 保存设置
  // 在saveBtn.onclick函数中添加API设置的保存逻辑
  saveBtn.onclick = function() {
    console.log('保存设置');
    const modelUrl = document.getElementById('modelUrl').value;
    const modelName = document.getElementById('modelName').value;
    const temperature = parseFloat(document.getElementById('temperature').value);
    
    // 获取API设置
    const useApi = document.getElementById('useApiToggle').checked;
    const apiKey = document.getElementById('apiKey').value;
    const apiBaseUrl = document.getElementById('apiBaseUrl').value;
    const apiModel = document.getElementById('apiModel').value;
    const apiMaxToken = parseInt(document.getElementById('apiMaxToken').value);
    const apiTemperature = parseFloat(document.getElementById('apiTemperature').value);
  
    // 使用 chrome.storage.local 保存设置
    const settings = {
      localModelUrl: modelUrl,
      localModelName: modelName,
      temperature: temperature,
      // API设置
      useApi: useApi,
      apiKey: apiKey,
      apiBaseUrl: apiBaseUrl,
      apiModel: apiModel,
      apiMaxToken: apiMaxToken,
      apiTemperature: apiTemperature
    };
    
    // 同时保存到 localStorage 和 chrome.storage.local
    localStorage.setItem('shidu_settings', JSON.stringify(settings));
    
    // 使用 chrome.storage.local 保存
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(settings, function() {
        console.log('设置已保存到 chrome.storage.local');
      });
    }
    
    console.log('设置已保存');
    summaryPage.style.display = 'block';
    optionsPage.style.display = 'none';
    pageTitle.textContent = '网页总结';
  };
  
  // 在loadOptions函数中添加API设置的加载逻辑
  function loadOptions() {
    console.log('加载设置');
    // 默认设置
    const defaultSettings = {
      localModelUrl: 'http://localhost:1234/v1/chat/completions',
      localModelName: 'qwen2.5-coder-3b-instruct',
      temperature: 0.7,
      // API默认设置
      useApi: false,
      apiKey: '',
      apiBaseUrl: 'https://api.openai.com/v1',
      apiModel: 'gpt-3.5-turbo',
      apiMaxToken: 2000,
      apiTemperature: 0.7
    };
    
    // 优先从 chrome.storage.local 加载
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(defaultSettings, function(items) {
        console.log('从 chrome.storage.local 加载设置:', items);
        document.getElementById('modelUrl').value = items.localModelUrl;
        document.getElementById('modelName').value = items.localModelName;
        document.getElementById('temperature').value = items.temperature;
        
        // 加载API设置 - 确保apiKey被正确加载
        document.getElementById('useApiToggle').checked = items.useApi;
        document.getElementById('apiKey').value = items.apiKey || '';
        document.getElementById('apiBaseUrl').value = items.apiBaseUrl;
        document.getElementById('apiModel').value = items.apiModel;
        document.getElementById('apiMaxToken').value = items.apiMaxToken;
        document.getElementById('apiTemperature').value = items.apiTemperature;
        
        // 根据是否使用API来显示/隐藏API设置区域
        toggleApiSettings(items.useApi);
      });
    } else {
      // 回退到 localStorage
      try {
        const savedSettings = localStorage.getItem('shidu_settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          Object.assign(defaultSettings, parsedSettings);
        }
      } catch (e) {
        console.error('从 localStorage 获取设置失败:', e);
      }
      
      document.getElementById('modelUrl').value = defaultSettings.localModelUrl;
      document.getElementById('modelName').value = defaultSettings.localModelName;
      document.getElementById('temperature').value = defaultSettings.temperature;
      
      // 加载API设置 - 确保apiKey被正确加载
      document.getElementById('useApiToggle').checked = defaultSettings.useApi;
      document.getElementById('apiKey').value = defaultSettings.apiKey || '';
      document.getElementById('apiBaseUrl').value = defaultSettings.apiBaseUrl;
      document.getElementById('apiModel').value = defaultSettings.apiModel;
      document.getElementById('apiMaxToken').value = defaultSettings.apiMaxToken;
      document.getElementById('apiTemperature').value = defaultSettings.apiTemperature;
      
      // 根据是否使用API来显示/隐藏API设置区域
      toggleApiSettings(defaultSettings.useApi);
    }
    
    // 添加API切换事件监听 - 确保切换时不会丢失数据
    document.getElementById('useApiToggle').addEventListener('change', function(e) {
      toggleApiSettings(e.target.checked);
      // 保存当前设置，确保切换模式时不会丢失数据
      const currentSettings = {
        localModelUrl: document.getElementById('modelUrl').value,
        localModelName: document.getElementById('modelName').value,
        temperature: parseFloat(document.getElementById('temperature').value),
        useApi: e.target.checked,
        apiKey: document.getElementById('apiKey').value,
        apiBaseUrl: document.getElementById('apiBaseUrl').value,
        apiModel: document.getElementById('apiModel').value,
        apiMaxToken: parseInt(document.getElementById('apiMaxToken').value),
        apiTemperature: parseFloat(document.getElementById('apiTemperature').value)
      };
      
      // 临时保存到localStorage，确保切换模式时不会丢失数据
      localStorage.setItem('shidu_settings_temp', JSON.stringify(currentSettings));
    });
  }
  
  // 切换API设置区域的显示/隐藏
  function toggleApiSettings(show) {
    const apiSettings = document.getElementById('apiSettings');
    apiSettings.style.display = show ? 'block' : 'none';
  }

  // 在processSummaryGeneration函数中添加API支持
  function processSummaryGeneration(settings, content) {
    console.log('使用设置:', settings);
    
    // 截取内容以适应模型的最大长度限制
    const maxChars = 3000; // 保守估计，约等于3000-4000 tokens
    const truncatedContent = content.length > maxChars ? 
      content.substring(0, maxChars) + '...(内容已截断以适应模型限制)' : 
      content;
    
    const messages = [
      {
        "role": "system", 
        "content": "你是一个专业的文本摘要助手。首先请为以下文本进行分点总结。然后判断本文存在的错误，从有效信息量和错误信息数量，对本文的有效性进行1-100的评分，按照'评分: 数字'的形式输出，例如'评分: 85'。"
      },
      {
        "role": "user", 
        "content": truncatedContent
      }
    ];
    
    // 根据设置决定使用本地模型还是API
    if (settings.useApi) {
      // 使用API
      const requestData = {
        "model": settings.apiModel,
        "messages": messages,
        "temperature": settings.apiTemperature,
        "max_tokens": settings.apiMaxToken,
        "stream": false
      };
      
      console.log('使用API发送请求到:', settings.apiBaseUrl);
      
      fetch(`${settings.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(requestData)
      })
      .then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API返回错误(${response.status}): ${errorText}`);
        }
        return response.json();
      })
      .then(result => {
        console.log('收到API响应:', result);
        if (result.choices && result.choices.length > 0 && 
            result.choices[0].message && result.choices[0].message.content) {
          const summary = result.choices[0].message.content.trim();
          document.getElementById('summary').innerHTML = `
            <h3>网页内容摘要：</h3>
            <div style="white-space: pre-wrap;">${summary.replace(/\n/g, '<br>')}</div>
          `;
        } else {
          throw new Error('API返回格式不正确');
        }
      })
      .catch(error => {
        console.error('调用API出错:', error);
        document.getElementById('summary').innerHTML = `
          <h3>摘要生成失败：</h3>
          <p style="color: red;">${error.message}</p>
          <button id="showRawContent">显示原始内容</button>
        `;
        
        document.getElementById('showRawContent').onclick = function() {
          showOriginalContent(content);
        };
      });
    } else {
      // 使用本地模型（原有逻辑）
      const requestData = {
        "model": settings.localModelName,
        "messages": messages,
        "temperature": settings.temperature,
        "max_tokens": 2000,
        "stream": false
      };
      
      console.log('发送请求到:', settings.localModelUrl);
      
      // 修复本地模型请求逻辑
      fetch(settings.localModelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })
      .then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`模型返回错误(${response.status}): ${errorText}`);
        }
        return response.json();
      })
      .then(result => {
        console.log('收到模型响应:', result);
        if (result.choices && result.choices.length > 0 && 
            result.choices[0].message && result.choices[0].message.content) {
          const summary = result.choices[0].message.content.trim();
          document.getElementById('summary').innerHTML = `
            <h3>网页内容摘要：</h3>
            <div style="white-space: pre-wrap;">${summary.replace(/\n/g, '<br>')}</div>
          `;
        } else {
          throw new Error('模型返回格式不正确');
        }
      })
      .catch(error => {
        console.error('调用模型出错:', error);
        document.getElementById('summary').innerHTML = `
          <h3>摘要生成失败：</h3>
          <p style="color: red;">${error.message}</p>
          <button id="showRawContent">显示原始内容</button>
        `;
        
        document.getElementById('showRawContent').onclick = function() {
          showOriginalContent(content);
        };
      });
    }
  }
  
  // 显示原始内容的辅助函数
  function showOriginalContent(content) {
    const maxLength = 2096;
    const displayContent = content.length > maxLength ? 
      content.substring(0, maxLength) + '...(内容过长，已截断)' : 
      content;
    
    document.getElementById('summary').innerHTML = `
      <h3>捕获到的网页内容：</h3>
      <div style="max-height: 400px; overflow: auto; white-space: pre-wrap; font-size: 12px; border: 1px solid #ddd; padding: 10px; background-color: #f9f9f9;">
        ${displayContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
      <p style="margin-top: 10px; font-size: 12px; color: #666;">
        总字符数: ${content.length}
      </p>
    `;
  }

  // 添加生成摘要按钮的点击事件处理
  summarizeBtn.onclick = function() {
    console.log('点击生成摘要按钮');
    document.getElementById('summary').innerHTML = '<p>正在获取页面内容，请稍候...</p>';
    
    getPageContent().then(content => {
      document.getElementById('summary').innerHTML = '<p>正在生成摘要，请稍候...</p>';
      generateSummary(content);
    }).catch(error => {
      console.error('获取内容出错:', error);
      document.getElementById('summary').innerHTML = '<p>获取内容时出错</p>';
    });
  };
  
  // 修复试毒按钮的事件绑定
  try {
    const aggregateBtn = document.getElementById('aggregateBtn');
    console.log('试毒按钮元素:', aggregateBtn);
    
    if (aggregateBtn) {
      aggregateBtn.addEventListener('click', function() {
        console.log('点击试毒按钮');
        
        // 使用postMessage与父页面通信
        sendMessageToParent({ action: 'startAggregateSummary' });
        document.getElementById('summary').innerHTML = '<p>正在启动聚合摘要任务，请稍候...</p>';
        
        // 监听父页面的响应
        function messageHandler(event) {
          if (event.data && event.data.response === 'aggregateSummary') {
            window.removeEventListener('message', messageHandler);
            if (event.data.success) {
              document.getElementById('summary').innerHTML = '<p>聚合摘要任务已启动，请查看结果页面</p>';
            } else {
              document.getElementById('summary').innerHTML = '<p>启动聚合摘要任务失败，请检查后台服务</p>';
            }
          }
        }
        
        window.addEventListener('message', messageHandler);
      });
      console.log('试毒按钮事件监听器已添加');
    } else {
      console.error('找不到试毒按钮元素');
    }
  } catch (error) {
    console.error('设置试毒按钮事件时出错:', error);
  }

  // 生成摘要的函数
  function generateSummary(content) {
    try {
      // 检查 chrome.storage 是否可用
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({
          localModelUrl: 'http://localhost:1234/v1/chat/completions',
          localModelName: 'qwen2.5-coder-3b-instruct',
          temperature: 0.7,
          useApi: false,
          apiKey: '',
          apiBaseUrl: 'https://api.openai.com/v1',
          apiModel: 'gpt-3.5-turbo',
          apiMaxToken: 2000,
          apiTemperature: 0.7
        }, function(items) {
          processSummaryGeneration(items, content);
        });
      } else {
        // 如果 chrome.storage 不可用，使用默认设置
        const defaultSettings = {
          localModelUrl: 'http://localhost:1234/v1/chat/completions',
          localModelName: 'qwen2.5-coder-3b-instruct',
          temperature: 0.7,
          useApi: false,
          apiKey: '',
          apiBaseUrl: 'https://api.openai.com/v1',
          apiModel: 'gpt-3.5-turbo',
          apiMaxToken: 2000,
          apiTemperature: 0.7
        };
        
        // 尝试从 localStorage 获取设置
        try {
          const savedSettings = localStorage.getItem('shidu_settings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            Object.assign(defaultSettings, parsedSettings);
          }
        } catch (e) {
          console.error('从 localStorage 获取设置失败:', e);
        }
        
        processSummaryGeneration(defaultSettings, content);
      }
    } catch (error) {
      console.error('生成摘要出错:', error);
      document.getElementById('summary').innerHTML = `
        <h3>摘要生成失败：</h3>
        <p style="color: red;">${error.message}</p>
        <button id="showRawContent">显示原始内容</button>
      `;
      
      document.getElementById('showRawContent').onclick = function() {
        showOriginalContent(content);
      };
    }
  }
})();
