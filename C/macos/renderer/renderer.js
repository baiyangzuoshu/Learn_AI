(() => {
  const messages = document.querySelector("#messages");

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function renderInlineMarkdown(value) {
    const codeSpans = [];
    let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_, code) => {
      const index = codeSpans.push(`<code>${code}</code>`) - 1;
      return `\u0000CODE${index}\u0000`;
    });
    html = html.replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, href) => `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`,
    );
    html = html
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
    return html.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => codeSpans[Number(index)] || "");
  }

  function splitTableRow(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }

  function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
    let html = "", listType = "", inCode = false, codeLanguage = "";
    let paragraph = [], codeLines = [];

    const closeList = () => {
      if (!listType) return;
      html += `</${listType}>`;
      listType = "";
    };
    const flushParagraph = () => {
      if (!paragraph.length) return;
      html += `<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`;
      paragraph = [];
    };
    const openList = (type) => {
      flushParagraph();
      if (listType === type) return;
      closeList();
      html += `<${type}>`;
      listType = type;
    };
    const flushCode = () => {
      const label = escapeHtml(codeLanguage || "code");
      html += `<pre><span class="code-label">${label}</span><button class="copy-code" type="button">复制</button><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
      inCode = false;
      codeLanguage = "";
      codeLines = [];
    };

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const trimmed = line.trim();

      if (inCode) {
        if (/^\s*```\s*$/.test(line)) flushCode();
        else codeLines.push(line);
        continue;
      }

      const fence = line.match(/^\s*```([A-Za-z0-9_+.-]+)?\s*$/);
      if (fence) {
        flushParagraph();
        closeList();
        inCode = true;
        codeLanguage = fence[1] || "";
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        closeList();
        continue;
      }

      if (index + 1 < lines.length && trimmed.includes("|") && isTableSeparator(lines[index + 1])) {
        flushParagraph();
        closeList();
        const header = splitTableRow(line);
        const rows = [];
        index += 2;
        while (index < lines.length && lines[index].trim().includes("|")) {
          rows.push(splitTableRow(lines[index]));
          index++;
        }
        index--;
        html += `<div class="table-wrap"><table><thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        continue;
      }

      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        const quoteLines = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*>\s?(.*)$/);
          if (!match) break;
          quoteLines.push(match[1]);
          index++;
        }
        index--;
        html += `<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        html += `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`;
        continue;
      }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushParagraph();
        closeList();
        html += "<hr>";
        continue;
      }

      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      if (unordered) {
        openList("ul");
        html += `<li>${renderInlineMarkdown(unordered[1])}</li>`;
        continue;
      }

      const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
      if (ordered) {
        openList("ol");
        html += `<li>${renderInlineMarkdown(ordered[1])}</li>`;
        continue;
      }

      closeList();
      paragraph.push(trimmed);
    }

    if (inCode) flushCode();
    flushParagraph();
    closeList();
    return html;
  }

  function appendMessage(message) {
    const role = ["system", "user", "assistant"].includes(message.role) ? message.role : "assistant";
    const article = document.createElement("article");
    article.className = `message ${role}`;

    if (role === "system") {
      article.textContent = message.content;
    } else if (role === "user") {
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = message.content;
      article.append(bubble);
    } else {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = "C";
      const body = document.createElement("div");
      body.className = "assistant-body";
      body.innerHTML = `<div class="role">AI Agent C</div><div class="markdown">${renderMarkdown(message.content)}</div>`;
      article.append(avatar, body);
    }

    messages.append(article);
    messages.querySelectorAll(".copy-code").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "1";
      button.addEventListener("click", async () => {
        const code = button.parentElement?.querySelector("code")?.textContent || "";
        let copied = false;
        try {
          await navigator.clipboard.writeText(code);
          copied = true;
        } catch {
          const field = document.createElement("textarea");
          field.value = code;
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.append(field);
          field.select();
          copied = document.execCommand("copy");
          field.remove();
        }
        button.textContent = copied ? "已复制" : "复制失败";
        setTimeout(() => { button.textContent = "复制"; }, 1200);
      });
    });
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }

  window.chatRenderer = { appendMessage, renderMarkdown };
})();
