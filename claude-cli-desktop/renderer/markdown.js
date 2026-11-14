(() => {
  function render(container, source) {
    container.replaceChildren();
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) {
        index += 1;
        continue;
      }

      const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w.+#-]*)?.*$/);
      if (fence) {
        const marker = fence[1];
        const language = fence[2] ?? "";
        index += 1;
        const codeLines = [];
        while (index < lines.length && !new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`).test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const block = document.createElement("div");
        block.className = "markdown-code-block";
        if (language) {
          const languageLabel = document.createElement("div");
          languageLabel.className = "markdown-code-language";
          languageLabel.textContent = language;
          block.append(languageLabel);
        }
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeLines.join("\n");
        pre.append(code);
        block.append(pre);
        container.append(block);
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*$/);
      if (heading) {
        const element = document.createElement(`h${Math.min(heading[1].length, 4)}`);
        appendInlineMarkdown(element, heading[2]);
        container.append(element);
        index += 1;
        continue;
      }

      if (/^(?:[-*_]\s*){3,}$/.test(trimmed)) {
        container.append(document.createElement("hr"));
        index += 1;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        const quoteLines = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
          index += 1;
        }
        const quote = document.createElement("blockquote");
        const paragraph = document.createElement("p");
        appendInlineMarkdown(paragraph, quoteLines.join(" "));
        quote.append(paragraph);
        container.append(quote);
        continue;
      }

      if (index + 1 < lines.length && isTableDivider(lines[index + 1])) {
        const headers = splitTableRow(line);
        const table = document.createElement("table");
        const head = document.createElement("thead");
        const headerRow = document.createElement("tr");
        for (const cellText of headers) {
          const cell = document.createElement("th");
          appendInlineMarkdown(cell, cellText);
          headerRow.append(cell);
        }
        head.append(headerRow);
        table.append(head);
        index += 2;
        const body = document.createElement("tbody");
        while (index < lines.length && lines[index].includes("|")) {
          const cells = splitTableRow(lines[index]);
          const row = document.createElement("tr");
          headers.forEach((_, cellIndex) => {
            const cell = document.createElement("td");
            appendInlineMarkdown(cell, cells[cellIndex] ?? "");
            row.append(cell);
          });
          body.append(row);
          index += 1;
        }
        if (body.childElementCount) table.append(body);
        container.append(table);
        continue;
      }

      const listMatch = trimmed.match(/^(?:([-+*])|(\d+)[.)])\s+(.+)$/);
      if (listMatch) {
        const ordered = Boolean(listMatch[2]);
        const list = document.createElement(ordered ? "ol" : "ul");
        while (index < lines.length) {
          const itemMatch = lines[index].trim().match(/^(?:([-+*])|(\d+)[.)])\s+(.+)$/);
          if (!itemMatch || Boolean(itemMatch[2]) !== ordered) break;
          const item = document.createElement("li");
          appendInlineMarkdown(item, itemMatch[3]);
          list.append(item);
          index += 1;
        }
        container.append(list);
        continue;
      }

      if (/^(?: {4}|\t)/.test(line)) {
        const codeLines = [];
        while (index < lines.length && (/^(?: {4}|\t)/.test(lines[index]) || !lines[index].trim())) {
          codeLines.push(lines[index].replace(/^(?: {4}|\t)/, ""));
          index += 1;
        }
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeLines.join("\n").replace(/\n+$/, "");
        pre.append(code);
        pre.className = "markdown-code-block markdown-code-plain";
        container.append(pre);
        continue;
      }

      const paragraphLines = [];
      while (index < lines.length && lines[index].trim()) {
        if (paragraphLines.length && isMarkdownBlockStart(lines, index)) break;
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, paragraphLines.join(" "));
      container.append(paragraph);
    }
  }

  function isMarkdownBlockStart(lines, index) {
    const line = lines[index].trim();
    return /^(`{3,}|~{3,})/.test(line) || /^#{1,6}\s+/.test(line) || /^>\s?/.test(line) ||
      /^(?:[-*_]\s*){3,}$/.test(line) || /^(?:[-+*]|\d+[.)])\s+/.test(line) ||
      (index + 1 < lines.length && isTableDivider(lines[index + 1]));
  }

  function isTableDivider(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function splitTableRow(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }

  function appendInlineMarkdown(parent, source) {
    const pattern = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|\*[^*\n]+?\*|_[^_\n]+?_|!?\[[^\]]*\]\([^)]+\))/g;
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index > cursor) parent.append(document.createTextNode(source.slice(cursor, match.index)));
      const token = match[0];
      const element = token.startsWith("`") ? document.createElement("code")
        : token.startsWith("**") || token.startsWith("__") ? document.createElement("strong")
        : token.startsWith("~~") ? document.createElement("del")
        : token.startsWith("*") || token.startsWith("_") ? document.createElement("em")
        : document.createElement("span");
      if (token.startsWith("![")) {
        element.className = "markdown-image-label";
        element.textContent = token.slice(2, token.indexOf("]")) || "图片";
      } else if (token.startsWith("[")) {
        element.className = "markdown-link-label";
        const label = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        element.textContent = label?.[1] ?? token;
        if (label?.[2]) element.setAttribute("title", label[2]);
      } else {
        const width = token.startsWith("**") || token.startsWith("__") || token.startsWith("~~") ? 2 : 1;
        element.textContent = token.slice(width, -width);
      }
      parent.append(element);
      cursor = match.index + token.length;
    }
    if (cursor < source.length) parent.append(document.createTextNode(source.slice(cursor)));
  }

  window.claudeMarkdown = Object.freeze({ render });
})();
