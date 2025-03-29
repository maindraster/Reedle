document.addEventListener('DOMContentLoaded', () => {
  console.log('聚合页面已加载');
  const contentDiv = document.getElementById('content');
  
  // 显示加载中状态
  contentDiv.innerHTML = '<h1>正在加载结果...</h1>';
  
  // 从存储中获取初始内容
  chrome.storage.local.get('aggregateSummaryResult', (result) => {
    console.log('获取到聚合结果');
    
    if (result.aggregateSummaryResult) {
      contentDiv.innerHTML = result.aggregateSummaryResult;
      setupTabLinks();
    } else {
      contentDiv.innerHTML = '<h1>没有汇总结果</h1><p>请先运行聚合摘要功能</p>';
    }
  });
  
  // 监听来自background.js的更新消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateAggregatorContent') {
      console.log('收到内容更新', message.isFinal ? '(最终结果)' : '(进度更新)');
      
      // 更新页面内容
      contentDiv.innerHTML = message.content;
      
      // 设置标签页链接的点击事件
      setupTabLinks();
      
      // 如果是最终结果，滚动到页面顶部
      if (message.isFinal) {
        window.scrollTo(0, 0);
      }
      
      sendResponse({ success: true });
    }
    return true;
  });
  
  // 设置标签页链接的点击事件
  function setupTabLinks() {
    const links = document.querySelectorAll('a[data-tabid]');
    console.log(`找到 ${links.length} 个标签页链接`);
    
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = parseInt(e.target.getAttribute('data-tabid'));
        console.log(`激活标签页: ${tabId}`);
        chrome.runtime.sendMessage({ action: 'activateTab', tabId: tabId });
      });
    });
  }
});
  