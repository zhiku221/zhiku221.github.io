const Api = {
  async sendMessages(messages, model, settings, onChunk, signal) {
    const { apiKey, baseUrl } = this.getProviderConfig(settings);

    if (!apiKey) {
      throw new Error('API Key 未配置，请在设置中添加');
    }

    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';

    const body = {
      model,
      messages,
      stream: true,
      temperature: settings.temperature ?? 1
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let msg = `API 请求失败 (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) msg = errJson.error.message;
        else if (errJson.message) msg = errJson.message;
      } catch {}
      throw new Error(msg);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data:')) {
          try {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            const data = JSON.parse(jsonStr);

            const delta = data.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onChunk(delta.content, fullContent);
            }
          } catch (e) {
            // skip malformed lines
          }
        }
      }
    }

    return fullContent;
  },

  getProviderConfig(settings) {
    const provider = settings.activeProvider || 'deepseek';
    return {
      apiKey: settings.apiKeys?.[provider] || '',
      baseUrl: settings.baseUrls?.[provider] || 'https://api.deepseek.com/v1'
    };
  },

  async testConnection(settings) {
    const { apiKey, baseUrl } = this.getProviderConfig(settings);
    if (!apiKey) return { ok: false, error: 'API Key 未配置' };

    try {
      const response = await fetch(baseUrl.replace(/\/+$/, '') + '/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (response.ok) {
        return { ok: true };
      }
      const errText = await response.text().catch(() => '');
      return { ok: false, error: `HTTP ${response.status}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
};
