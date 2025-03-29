// 跟踪侧边栏状态的变量
let sidebarActive = {};

// 跟踪聚合摘要任务状态
let aggregateSummaryInProgress = false;

// 将refineSummaries函数移到全局作用域
// 同样修改refineSummaries函数，从设置中获取配置
async function refineSummaries(text) {
  try {
    // 从存储中获取设置
    const settings = await new Promise(resolve => {
      chrome.storage.local.get({
        // 默认设置
        refinementModelUrl: 'http://localhost:1234/v1/chat/completions',
        localModelName: 'local-model',
        temperature: 0.7,
        maxTokens: 1000,
        timeout: 30000 // 默认30秒超时
      }, resolve);
    });
    
    console.log('使用精炼设置:', settings);
    
    // 修改系统提示，使其生成分类整理的格式
    const messages = [
      {
        "role": "system",
        "content": "请将以下摘要内容整合，归纳出主要观点和主题，用分类的方式进行整理输出。例如：\n- 人工智能\n\t- 强化学习\n\t- 深度学习\n- 机器人\n\t- 正运动学"
      },
      {
        "role": "user",
        "content": text
      }
    ];
    
    const requestData = {
      "model": settings.localModelName,
      "messages": messages,
      "temperature": settings.temperature,
      "max_tokens": settings.maxTokens || 1000,
      "stream": false
    };
    
    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`模型请求超时(${settings.timeout/1000 || 30}秒)`)), settings.timeout || 30000);
    });
    
    const responsePromise = fetch(settings.refinementModelUrl || settings.localModelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });
    
    // 使用Promise.race来实现超时
    const response = await Promise.race([responsePromise, timeoutPromise]);
    
    if (!response.ok) {
      throw new Error(`本地模型返回错误状态码: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
      return result.choices[0].message.content.trim();
    } else {
      throw new Error('无法从模型响应中提取精炼摘要内容');
    }
  } catch (error) {
    console.error('精炼摘要失败:', error);
    // 返回一个带有错误信息的摘要，而不是抛出异常
    return `精炼摘要失败: ${error.message}`;
  }
}

// 修改generateSummaryForTab函数，从设置中获取配置
async function generateSummaryForTab(content) {
  try {
    // 从存储中获取设置
    const settings = await new Promise(resolve => {
      chrome.storage.local.get({
        // 默认设置
        localModelUrl: 'http://localhost:1234/v1/chat/completions',
        localModelName: 'local-model',
        temperature: 0.7,
        maxTokens: 2000,
        timeout: 30000 // 默认30秒超时
      }, resolve);
    });
    
    console.log('使用摘要设置:', settings);
    
    const maxChars = 3000;
    const truncatedContent = content.length > maxChars ? content.substring(0, maxChars) + '...(内容已截断)' : content;
    
    const messages = [
      {
        "role": "system",
        "content": "你是一个专业的文本摘要助手。首先请为以下文本进行分点总结。然后判断本文存在的错误，从有效信息量和错误信息数量，对本文的有效性进行1-100的评分，给出分数。"
      },
      {
        "role": "user",
        "content": truncatedContent
      }
    ];
    
    const requestData = {
      "model": settings.localModelName,
      "messages": messages,
      "temperature": settings.temperature,
      "max_tokens": settings.maxTokens,
      "stream": false
    };
    
    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`模型请求超时(${settings.timeout/1000}秒)`)), settings.timeout);
    });
    
    const responsePromise = fetch(settings.localModelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });
    
    // 使用Promise.race来实现超时
    const response = await Promise.race([responsePromise, timeoutPromise]);
    
    if (!response.ok) {
      throw new Error(`本地模型返回错误状态码: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
      return result.choices[0].message.content.trim();
    } else {
      throw new Error('无法从模型响应中提取摘要内容');
    }
  } catch (error) {
    console.error('生成摘要失败:', error);
    // 返回一个带有错误信息的摘要，而不是抛出异常
    return `摘要生成失败: ${error.message}\n\n评分: 0`;
  }
}

chrome.action.onClicked.addListener((tab) => {
  // 检查当前标签页是否已激活侧边栏
  const tabId = tab.id;

  // 检查是否可以在此页面上运行脚本
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    console.log('无法在浏览器内部页面上运行扩展');
    return;
  }
  
  // 发送消息给content script来切换侧边栏
  chrome.tabs.sendMessage(tabId, { action: 'toggleSidebar' }, (response) => {
    // 如果没有收到响应，说明content script可能尚未注入，尝试注入它
    if (chrome.runtime.lastError) {
      console.log('尝试注入content script');
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['contentScript.js']
      }).then(() => {
        console.log('脚本注入成功');
        sidebarActive[tabId] = true; // 设置状态为激活
      }).catch(err => {
        console.error('注入脚本失败:', err);
      });
    } else if (response) {
      // 根据响应更新侧边栏状态
      sidebarActive[tabId] = response.sidebarVisible;
      console.log('侧边栏状态更新为:', sidebarActive[tabId]);
    }
  });
});

// 当标签页关闭时清理状态
chrome.tabs.onRemoved.addListener((tabId) => {
  delete sidebarActive[tabId];
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSidebarState') {
    const tabId = sender.tab.id;
    sidebarActive[tabId] = message.isVisible;
    console.log('收到状态更新:', tabId, message.isVisible);
    sendResponse({ success: true });
    return true;
  }
  
  // 新增"试毒"聚合摘要功能的处理逻辑
  if (message.action === 'startAggregateSummary') {
    console.log('收到聚合摘要请求');
    
    // 检查是否已经在处理中
    if (aggregateSummaryInProgress) {
      console.log('已有聚合摘要任务正在进行中，忽略此请求');
      sendResponse({ success: false, error: '已有聚合摘要任务正在进行中' });
      return true;
    }
    
    // 标记为处理中
    aggregateSummaryInProgress = true;
    
    // 立即响应请求，避免浏览器等待
    sendResponse({ success: true });
    
    // 立即打开结果页面，显示"处理中"状态
    chrome.storage.local.set({ 
      aggregateSummaryResult: `<h1>正在处理中...</h1><p>正在获取标签页信息...</p>` 
    }, () => {
      // 确保存储完成后再打开页面
      chrome.tabs.create({ url: chrome.runtime.getURL('aggregator.html') }, (tab) => {
        console.log('已打开聚合结果页面，标签ID:', tab.id);
        
        // 记录结果页面的标签ID，以便后续更新
        const resultTabId = tab.id;
        
        // 开始处理摘要任务
        (async function() {
          try {
            // 获取所有标签页
            const tabs = await chrome.tabs.query({});
            console.log(`找到 ${tabs.length} 个标签页`);
            
            // 定义totalTabs变量，修复ReferenceError
            const totalTabs = tabs.length;
            
            // 更新进度信息
            chrome.storage.local.set({ 
              aggregateSummaryResult: `<h1>正在处理中...</h1><p>已找到 ${totalTabs} 个标签页，开始分析...</p>` 
            });
            
            let results = [];
            let processedCount = 0;
            
            // 向聚合页面发送初始更新
            chrome.tabs.sendMessage(resultTabId, { 
              action: 'updateAggregatorContent', 
              content: `<h1>正在处理中...</h1><p>已找到 ${totalTabs} 个标签页，开始分析...</p>`
            }).catch(err => console.error('发送初始更新失败:', err));
            
            // 修改generateSummaryForTab函数，添加超时处理
            // 修改generateSummaryForTab函数，从设置中获取配置
            async function generateSummaryForTab(content) {
              try {
                // 从存储中获取设置
                const settings = await new Promise(resolve => {
                  chrome.storage.sync.get({
                    // 默认设置
                    modelUrl: 'http://localhost:1234/v1/chat/completions',
                    modelName: 'local-model',
                    temperature: 0.7,
                    maxTokens: 2000,
                    timeout: 30000 // 默认30秒超时
                  }, resolve);
                });
                
                console.log('使用摘要设置:', settings);
                
                const maxChars = 3000;
                const truncatedContent = content.length > maxChars ? content.substring(0, maxChars) + '...(内容已截断)' : content;
                
                const messages = [
                  {
                    "role": "system",
                    "content": "你是一个专业的文本摘要助手。首先请为以下文本进行分点总结。然后判断本文存在的错误，从有效信息量和错误信息数量，对本文的有效性进行1-100的评分，给出分数。"
                  },
                  {
                    "role": "user",
                    "content": truncatedContent
                  }
                ];
                
                const requestData = {
                  "model": settings.modelName,
                  "messages": messages,
                  "temperature": settings.temperature,
                  "max_tokens": settings.maxTokens,
                  "stream": false
                };
                
                // 添加超时处理
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error(`模型请求超时(${settings.timeout/1000}秒)`)), settings.timeout);
                });
                
                const responsePromise = fetch(settings.modelUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestData)
                });
                
                // 使用Promise.race来实现超时
                const response = await Promise.race([responsePromise, timeoutPromise]);
                
                if (!response.ok) {
                  throw new Error(`本地模型返回错误状态码: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
                  return result.choices[0].message.content.trim();
                } else {
                  throw new Error('无法从模型响应中提取摘要内容');
                }
              } catch (error) {
                console.error('生成摘要失败:', error);
                // 返回一个带有错误信息的摘要，而不是抛出异常
                return `摘要生成失败: ${error.message}\n\n评分: 0`;
              }
            }
            
            // 修改refineSummaries函数，添加超时处理
            // 同样修改refineSummaries函数，从设置中获取配置
            async function refineSummaries(text) {
              try {
                // 从存储中获取设置
                const settings = await new Promise(resolve => {
                  chrome.storage.local.get({
                    // 默认设置
                    refinementModelUrl: 'http://localhost:1234/v1/chat/completions',
                    localModelName: 'local-model',
                    temperature: 0.7,
                    maxTokens: 1000,
                    timeout: 30000 // 默认30秒超时
                  }, resolve);
                });
                
                console.log('使用精炼设置:', settings);
                
                const messages = [
                  {
                    "role": "system",
                    "content": "请将以下摘要内容整合，归纳出主要观点和主题，用少量几句话进行分类输出。"
                  },
                  {
                    "role": "user",
                    "content": text
                  }
                ];
                
                const requestData = {
                  "model": settings.localModelName,
                  "messages": messages,
                  "temperature": settings.temperature,
                  "max_tokens": settings.maxTokens || 1000,
                  "stream": false
                };
                
                // 添加超时处理
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error(`模型请求超时(${settings.timeout/1000 || 30}秒)`)), settings.timeout || 30000);
                });
                
                const responsePromise = fetch(settings.refinementModelUrl || settings.localModelUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestData)
                });
                
                // 使用Promise.race来实现超时
                const response = await Promise.race([responsePromise, timeoutPromise]);
                
                if (!response.ok) {
                  throw new Error(`本地模型返回错误状态码: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
                  return result.choices[0].message.content.trim();
                } else {
                  throw new Error('无法从模型响应中提取精炼摘要内容');
                }
              } catch (error) {
                console.error('精炼摘要失败:', error);
                // 返回一个带有错误信息的摘要，而不是抛出异常
                return `精炼摘要失败: ${error.message}`;
              }
            }
            
            // 修改处理标签页的循环部分
            // 在处理标签页的循环中
            for (const tab of tabs) {
              // 排除内部页面和结果页面本身
              if (tab.url.startsWith('chrome://') || 
                  tab.url.startsWith('about:') || 
                  tab.url.startsWith('edge://') ||
                  tab.id === resultTabId) {
                console.log(`跳过页面: ${tab.url}`);
                continue;
              }
              
              try {
                processedCount++;
                console.log(`处理标签页 ${processedCount}/${totalTabs}: ${tab.title}`);
                
                // 更新进度 - 使用已定义的totalTabs变量
                const progressContent = `<h1>正在处理中...</h1><p>正在处理第 ${processedCount}/${totalTabs} 个标签页...</p><p>当前: ${tab.title}</p>`;
                
                await new Promise((resolve) => {
                  chrome.storage.local.set({ 
                    aggregateSummaryResult: progressContent
                  }, resolve);
                });
                
                // 向聚合页面广播更新
                try {
                  await chrome.tabs.sendMessage(resultTabId, { 
                    action: 'updateAggregatorContent', 
                    content: progressContent
                  });
                } catch (err) {
                  console.error('发送进度更新失败:', err);
                }
                
                // 首先检查内容脚本是否已注入
                let content;
                try {
                  // 尝试注入内容脚本
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['contentScript.js']
                  });
                  console.log(`已向标签页 ${tab.id} 注入内容脚本`);
                  
                  // 等待一小段时间让脚本初始化
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // 通过消息获取页面内容
                  content = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'getContent' }, (response) => {
                      if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message));
                      }
                      if (!response || !response.content) {
                        return reject(new Error("未收到内容"));
                      }
                      resolve(response.content);
                    });
                  });
                } catch (err) {
                  console.error(`无法从标签页 ${tab.id} 获取内容:`, err);
                  content = `无法获取内容: ${err.message}`;
                }
                
                // 调用本地模型生成摘要
                const summary = await generateSummaryForTab(content);
                const score = extractScore(summary);
                
                results.push({ 
                  tabId: tab.id, 
                  url: tab.url, 
                  title: tab.title || tab.url, 
                  summary: summary, 
                  score: score 
                });
                
                // 每处理完一个标签页就更新一次结果
                await updatePartialResults(results, totalTabs, processedCount, resultTabId);
                
              } catch (err) {
                console.error(`处理标签 ${tab.id} 失败:`, err);
                results.push({ 
                  tabId: tab.id, 
                  url: tab.url, 
                  title: tab.title || tab.url, 
                  summary: `处理失败: ${err.message}`, 
                  score: 0 
                });
                
                // 修复参数不匹配问题
                await updatePartialResults(results, totalTabs, processedCount, resultTabId);
              }
            }
            
            // 所有标签页处理完毕，生成最终结果
            await generateFinalResults(results, resultTabId);
            
          } catch (error) {
            console.error('聚合摘要失败:', error);
            try {
              chrome.storage.local.set({ 
                aggregateSummaryResult: `<h1>聚合摘要失败</h1><p style="color:red">${error.message}</p>` 
              });
              
              // 尝试向结果页面发送错误消息
              chrome.tabs.sendMessage(resultTabId, { 
                action: 'updateAggregatorContent', 
                content: `<h1>聚合摘要失败</h1><p style="color:red">${error.message}</p>`,
                isFinal: true
              }).catch(err => console.error('发送错误消息失败:', err));
            } catch (err) {
              console.error('设置错误状态失败:', err);
            }
          } finally {
            // 无论成功还是失败，都标记为处理完成
            aggregateSummaryInProgress = false;
            console.log('聚合摘要任务完成，可以开始新的任务');
          }
        })();
      });
    });
    
    // 已经在上面发送了响应，这里不需要再返回true
    return true;
  }
  
  // 响应激活指定标签页的消息
  if (message.action === 'activateTab') {
    chrome.tabs.update(message.tabId, { active: true });
    sendResponse({ success: true });
    return true;
  }
});

// 修改updatePartialResults函数，直接向结果标签页发送消息
function updatePartialResults(results, totalTabs, processedCount, resultTabId) {
  const high = results.filter(r => r.score >= 80);
  const low = results.filter(r => r.score < 80);
  
  let htmlContent = `<h1>处理中... (${processedCount}/${totalTabs})</h1>`;
  htmlContent += `<p>已处理 ${results.length} 个标签页</p>`;
  
  htmlContent += `<h2>有效内容 (评分>=80) - ${high.length}个</h2>`;
  htmlContent += `<ul>`;
  high.forEach(r => {
    htmlContent += `<li>
      <a href="#" data-tabid="${r.tabId}">${r.title}</a> (评分: ${r.score})
      <div style="font-size: 0.9em; margin: 5px 0 10px 20px; padding: 5px; border-left: 2px solid #4CAF50;">
        ${r.summary.replace(/\n/g, '<br>')}
      </div>
    </li>`;
  });
  htmlContent += `</ul>`;
  
  htmlContent += `<h2>低效内容 (评分<80) - ${low.length}个</h2>`;
  htmlContent += `<ul>`;
  low.forEach(r => {
    htmlContent += `<li>
      <a href="#" data-tabid="${r.tabId}">${r.title}</a> (评分: ${r.score})
      <div style="font-size: 0.9em; margin: 5px 0 10px 20px; padding: 5px; border-left: 2px solid #f44336;">
        ${r.summary.replace(/\n/g, '<br>')}
      </div>
    </li>`;
  });
  htmlContent += `</ul>`;
  
  // 使用Promise确保存储操作完成
  return new Promise((resolve) => {
    chrome.storage.local.set({ aggregateSummaryResult: htmlContent }, () => {
      // 直接向结果标签页发送消息，而不是查询所有标签页
      if (resultTabId) {
        try {
          chrome.tabs.sendMessage(resultTabId, { 
            action: 'updateAggregatorContent', 
            content: htmlContent 
          }).then(() => {
            resolve();
          }).catch(err => {
            console.error('发送更新消息失败:', err);
            resolve(); // 即使发送失败也继续
          });
        } catch (err) {
          console.error('发送更新消息异常:', err);
          resolve(); // 即使发送失败也继续
        }
      } else {
        resolve();
      }
    });
  });
}

// 辅助函数：生成最终结果
async function generateFinalResults(results, resultTabId) {
  try {
    // 分组：有效 (评分 ≥ 80) 与低效 (评分 < 80)
    const high = results.filter(r => r.score >= 80);
    const low = results.filter(r => r.score < 80);
    
    console.log(`高评分标签页: ${high.length}, 低评分标签页: ${low.length}`);
    
    // 对高评分内容进一步提炼
    let refinedHigh = "";
    if (high.length > 0) {
      const combinedSummaries = high.map(r => r.summary).join("\n\n---\n\n");
      try {
        console.log('开始精炼高评分摘要');
        // 确保refineSummaries函数已定义
        if (typeof refineSummaries !== 'function') {
          throw new Error('refineSummaries函数未定义');
        }
        refinedHigh = await refineSummaries(combinedSummaries);
        console.log('精炼完成');
      } catch (err) {
        console.error('精炼摘要失败:', err);
        refinedHigh = `<p style="color:red">精炼摘要失败: ${err.message}</p>` + combinedSummaries;
      }
    }
    
    // 生成汇总页面 HTML
    let htmlContent = `<h1>汇总结果</h1>`;
    htmlContent += `<p>共分析了 ${results.length} 个标签页</p>`;
    
    htmlContent += `<h2>有效内容 (评分>=80) - ${high.length}个</h2>`;
    if (refinedHigh) {
      htmlContent += `<div style="padding: 10px; background-color: #f0f8ff; border: 1px solid #ccc; margin-bottom: 20px;">${refinedHigh.replace(/\n/g, '<br>')}</div>`;
    }
    htmlContent += `<ul>`;
    high.forEach(r => {
      htmlContent += `<li>
        <a href="#" data-tabid="${r.tabId}">${r.title}</a> (评分: ${r.score})
        <div style="font-size: 0.9em; margin: 5px 0 10px 20px; padding: 5px; border-left: 2px solid #4CAF50;">
          ${r.summary.replace(/\n/g, '<br>')}
        </div>
      </li>`;
    });
    htmlContent += `</ul>`;
    
    htmlContent += `<h2>低效内容 (评分<80) - ${low.length}个</h2>`;
    htmlContent += `<ul>`;
    low.forEach(r => {
      htmlContent += `<li>
        <a href="#" data-tabid="${r.tabId}">${r.title}</a> (评分: ${r.score})
        <div style="font-size: 0.9em; margin: 5px 0 10px 20px; padding: 5px; border-left: 2px solid #f44336;">
          ${r.summary.replace(/\n/g, '<br>')}
        </div>
      </li>`;
    });
    htmlContent += `</ul>`;
    
    // 存储最终结果并广播更新
    return new Promise((resolve) => {
      chrome.storage.local.set({ aggregateSummaryResult: htmlContent }, () => {
        // 向结果标签页发送更新消息
        try {
          chrome.tabs.sendMessage(resultTabId, { 
            action: 'updateAggregatorContent', 
            content: htmlContent,
            isFinal: true
          }).then(() => {
            resolve();
          }).catch(err => {
            console.error('发送最终更新消息失败:', err);
            resolve(); // 即使发送失败也继续
          });
        } catch (err) {
          console.error('发送最终更新消息异常:', err);
          resolve(); // 即使发送失败也继续
        }
      });
    });
  } catch (error) {
    console.error('生成最终结果失败:', error);
    chrome.storage.local.set({ 
      aggregateSummaryResult: `<h1>生成最终结果失败</h1><p style="color:red">${error.message}</p>` 
    });
  }
}

// 辅助函数：从摘要中提取评分（假设摘要中包含类似"评分：85"格式）
function extractScore(summary) {
  const regex = /[评分|分数][:：]?\s*(\d{1,3})/;
  const match = summary.match(regex);
  if (match && match[1]) {
    const score = parseInt(match[1]);
    return isNaN(score) ? 0 : score;
  }
  return 0; // 未找到评分则返回0
}