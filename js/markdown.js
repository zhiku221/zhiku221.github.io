const Markdown = {
  init() {
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
    }
  },

  render(text) {
    if (!text) return '';
    
    if (typeof marked === 'undefined') {
      return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    try {
      let html = marked.parse(text);
      html = this.highlightCode(html);
      return html;
    } catch (e) {
      console.warn('Markdown parse error:', e);
      return this.escapeHtml(text).replace(/\n/g, '<br>');
    }
  },

  highlightCode(html) {
    if (typeof hljs === 'undefined') return html;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    tempDiv.querySelectorAll('pre code').forEach(block => {
      try {
        hljs.highlightElement(block);
      } catch (e) {
        // skip
      }
    });

    return tempDiv.innerHTML;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
