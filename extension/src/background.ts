console.log('Waillet background loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Waillet installed');
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'RPC_REQUEST') {
    console.log('🔄 Background RPC Request to:', request.url);
    console.log('📤 Request body:', request.body);
    console.log('📤 Request body type:', typeof request.body);
    console.log('📤 Request body length:', request.body?.length);

    fetch(request.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: request.body,
    })
      .then(async response => {
        console.log('📡 Response status:', response.status, response.statusText);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Background RPC HTTP Error:', response.status, response.statusText, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        const text = await response.text();
        console.log('📝 Response text:', text.substring(0, 200));
        
        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from RPC endpoint');
        }
        
        try {
          const data = JSON.parse(text);
          console.log('✅ Parsed data:', data);
          sendResponse({ success: true, data });
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError, 'Text:', text);
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }
      })
      .catch(error => {
        console.error('❌ Background RPC Error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});

