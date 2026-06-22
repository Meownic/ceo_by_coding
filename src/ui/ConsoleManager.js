/**
 * ConsoleManager — Manages the in-game console output panel
 * Bridges console.log from sandboxed code to the DOM console panel.
 */
export class ConsoleManager {
  constructor() {
    this.outputEl = document.getElementById('console-output');
    this.maxLines = 200;
    this.lines = [];
  }

  /**
   * Add a line to the console output
   * @param {string} text - The text to display
   * @param {'log'|'error'|'info'|'warn'} type - Line type for styling
   */
  addLine(text, type = 'log') {
    const line = { text, type, timestamp: Date.now() };
    this.lines.push(line);

    // Trim old lines
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }

    this._renderLine(line);
    this._scrollToBottom();
  }

  /** Clear all console output */
  clear() {
    this.lines = [];
    if (this.outputEl) {
      this.outputEl.innerHTML = '';
    }
  }

  /** Render a single line to the DOM */
  _renderLine(line) {
    if (!this.outputEl) return;

    const div = document.createElement('div');
    div.className = `console-line ${line.type}`;

    // Prefix based on type
    const prefixes = {
      log: '›',
      error: '✗',
      info: 'ℹ',
      warn: '⚠',
    };

    const prefix = prefixes[line.type] || '›';
    div.textContent = `${prefix} ${line.text}`;

    this.outputEl.appendChild(div);
  }

  /** Scroll console to bottom */
  _scrollToBottom() {
    const panel = document.getElementById('console-panel');
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }

  /** Get all lines */
  getLines() {
    return [...this.lines];
  }
}
