(function () {
  'use strict';

  var panel, messagesEl, inputEl, sendBtn;

  function createPanel() {
    if (document.getElementById('campus-chatbot-panel')) return;

    var wrap = document.createElement('div');
    wrap.id = 'campus-chatbot-panel';
    wrap.className = 'chatbot-panel';
    wrap.innerHTML =
      '<div class="chatbot-header">' +
      '<h3><i class="fas fa-robot"></i> SmartCampus Assistant</h3>' +
      '<button type="button" class="chatbot-close" aria-label="Close chat"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="chatbot-messages"></div>' +
      '<div class="chatbot-input-wrap">' +
      '<input type="text" class="chatbot-input" placeholder="Ask about schedule, grades, events..." maxlength="500" />' +
      '<button type="button" class="chatbot-send" aria-label="Send"><i class="fas fa-paper-plane"></i></button>' +
      '</div>';

    document.body.appendChild(wrap);

    panel = wrap;
    messagesEl = wrap.querySelector('.chatbot-messages');
    inputEl = wrap.querySelector('.chatbot-input');
    sendBtn = wrap.querySelector('.chatbot-send');

    wrap.querySelector('.chatbot-close').addEventListener('click', togglePanel);
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    addBotMessage('Hi! I\'m the SmartCampus assistant. Ask me about schedules, grades, attendance, events, contact info, library, exams, or fees.');
  }

  function togglePanel() {
    if (!panel) createPanel();
    panel.classList.toggle('is-open');
    if (panel.classList.contains('is-open')) inputEl.focus();
  }

  function addMessage(text, isUser) {
    if (!messagesEl) return;
    var div = document.createElement('div');
    div.className = 'chatbot-msg ' + (isUser ? 'user' : 'bot');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addBotMessage(text, isTyping) {
    if (!messagesEl) return;
    var div = document.createElement('div');
    div.className = 'chatbot-msg bot' + (isTyping ? ' typing' : '');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function removeTyping(el) {
    if (el && el.classList) el.classList.remove('typing');
  }

  function sendMessage() {
    var text = (inputEl && inputEl.value) ? inputEl.value.trim() : '';
    if (!text) return;

    if (inputEl) inputEl.value = '';
    if (sendBtn) sendBtn.disabled = true;
    addMessage(text, true);

    var typingEl = addBotMessage('...', true);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        removeTyping(typingEl);
        if (typingEl) typingEl.textContent = (data.reply || 'I couldn\'t process that. Try asking about schedule, grades, events, or contact.');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      })
      .catch(function () {
        removeTyping(typingEl);
        if (typingEl) typingEl.textContent = 'Something went wrong. Please try again or check your connection.';
        messagesEl.scrollTop = messagesEl.scrollHeight;
      })
      .finally(function () {
        if (sendBtn) sendBtn.disabled = false;
        if (inputEl) inputEl.focus();
      });
  }

  function openChatbot() {
    createPanel();
    panel.classList.add('is-open');
    if (inputEl) inputEl.focus();
  }

  // Expose for buttons
  window.openCampusChatbot = openChatbot;
  window.toggleCampusChatbot = togglePanel;

  // Bind when DOM ready
  function bind() {
    var openBtn = document.getElementById('openChatbot');
    var fab = document.getElementById('chatbotFab');
    if (openBtn) openBtn.addEventListener('click', function (e) { e.preventDefault(); openChatbot(); });
    if (fab) fab.addEventListener('click', togglePanel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
