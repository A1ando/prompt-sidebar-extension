(function () {
  if (window.__promptSidebarInjected) return;
  window.__promptSidebarInjected = true;
  if (window.top !== window.self) return;

  let lastActiveElement = null;
  let savedSelection = { start: null, end: null };
  let isInjecting = false;
  let lastInjectTime = 0;
  let lastInjectText = "";

  function isEditable(el) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT" && ["text", "search", "url", "tel", "email"].includes(el.type)) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  document.addEventListener("focusin", (e) => {
    if (isEditable(e.target)) {
      lastActiveElement = e.target;
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
        savedSelection.start = e.target.selectionStart;
        savedSelection.end = e.target.selectionEnd;
      }
    }
  });

  document.addEventListener("selectionchange", () => {
    const el = document.activeElement;
    if (isEditable(el)) {
      lastActiveElement = el;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        savedSelection.start = el.selectionStart;
        savedSelection.end = el.selectionEnd;
      }
    }
  });

  function findPrimaryInput() {
    const candidates = Array.from(document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]'));
    if (candidates.length === 0) return null;
    
    // 放宽条件：只要能看见、没被禁用就行，不强制要求宽高
    const visible = candidates.filter(el => {
      if (el.disabled || el.readOnly) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (visible.length > 0) return visible[0];
    return candidates.find(el => !el.disabled && !el.readOnly) || null;
  }

  function insertText(el, text) {
    el.focus();

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      let start = el.selectionStart;
      let end = el.selectionEnd;

      if (start === 0 && end === 0 && savedSelection.start !== null) {
        start = savedSelection.start;
        end = savedSelection.end;
      }
      
      if (start === null || start === undefined) {
        start = el.value.length;
        end = el.value.length;
      }

      el.setSelectionRange(start, end);

      // 修复：提前记录原始值，防止 execCommand 成功后因返回值错误导致二次注入
      const oldValue = el.value; 
      let success = false;
      try {
        success = document.execCommand('insertText', false, text);
      } catch (e) {
        success = false;
      }

      if (!success) {
        const newValue = oldValue.slice(0, start) + text + oldValue.slice(end);
        const prototype = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, "value").set;
        
        nativeInputValueSetter.call(el, newValue);
        
        const newCursorPos = start + text.length;
        el.setSelectionRange(newCursorPos, newCursorPos);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        
        savedSelection.start = newCursorPos;
        savedSelection.end = newCursorPos;
      }
      return;
    }

    if (el.isContentEditable) {
      const sel = window.getSelection();
      let range;
      
      if (sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        range = sel.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      
      document.execCommand('insertText', false, text);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "injectText") {
      if (isInjecting) {
        sendResponse({ success: true });
        return;
      }

      // 防止短时间内因重试导致重复注入
      const now = Date.now();
      if (message.text === lastInjectText && now - lastInjectTime < 300) {
        sendResponse({ success: true });
        return;
      }

      let targetEl = lastActiveElement;
      if (!targetEl || !document.body.contains(targetEl)) {
        targetEl = findPrimaryInput();
        savedSelection.start = null; 
        savedSelection.end = null;
      }

      if (!isEditable(targetEl)) {
        sendResponse({ success: false, error: "未找到输入框" });
        return;
      }

      isInjecting = true;
      try {
        insertText(targetEl, message.text);
        lastActiveElement = targetEl; 
        lastInjectText = message.text;
        lastInjectTime = Date.now();
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: "注入失败" });
      } finally {
        setTimeout(() => { isInjecting = false; }, 100);
      }
    }
    return true;
  });
})();