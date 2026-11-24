import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import { normalizeHighlightColor, rehypeHighlightApplier } from './speechAlignment.js';
import { resolveAnnotationRange } from './textAnnotationEngine.js';

/**
 * Sanitizes conversation title into a safe, descriptive filename.
 * Preserves Unicode letters and marks across Indian languages (Hindi, Marathi, Gujarati, etc.).
 * Strips unsafe OS filename characters ( \ / : * ? " < > | ) and normalizes whitespace/hyphens.
 */
export function sanitizeFilename(title, ext) {
  const cleanExt = String(ext || 'txt').replace(/^\.+/, '').trim().toLowerCase();
  const cleaned = String(title || 'Conversation')
    .trim()
    .replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g, '') // Strip forbidden OS chars
    .replace(/[^\p{L}\p{M}\p{N}\s\-_]/gu, '')  // Keep letters, marks, numbers, spaces, dashes, underscores
    .replace(/\s+/g, '-')                     // Replace whitespace with dash
    .replace(/-+/g, '-')                      // Collapse consecutive dashes
    .replace(/^-+|-+$/g, '')                  // Trim leading/trailing dashes
    .substring(0, 60);

  const safeTitle = cleaned || 'Conversation';
  const now = new Date();
  const dateStr = !isNaN(now.getTime()) ? now.toISOString().split('T')[0] : 'export';
  return `Yash-AI_${safeTitle}_${dateStr}.${cleanExt}`;
}

/**
 * Robust timestamp parser supporting:
 * 1. Java Date.toString() e.g. "Wed Oct 21 19:47:01 IST 2026"
 * 2. ISO 8601 strings with nanoseconds or standard offsets
 * 3. Numeric epoch milliseconds / seconds
 * 4. Message ID fallback extraction (msg-1792592221495-user)
 *
 * Never returns or displays "Invalid Date". Returns null if missing or unparseable.
 */
export function parseMessageTimestamp(raw, messageId) {
  if (raw) {
    if (typeof raw === 'number') {
      const d = new Date(raw > 1e11 ? raw : raw * 1000);
      if (!isNaN(d.getTime())) return d;
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed && trimmed !== 'Invalid Date' && trimmed !== 'null' && trimmed !== 'undefined') {
        // Pure numeric string
        if (/^\d{10,14}$/.test(trimmed)) {
          const num = Number(trimmed);
          const d = new Date(num > 1e11 ? num : num * 1000);
          if (!isNaN(d.getTime())) return d;
        }

        // Java Date.toString() format: "Wed Oct 21 19:47:01 IST 2026"
        const javaDateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Za-z0-9_+-]+)?\s*(\d{4})$/);
        if (javaDateMatch) {
          const month = javaDateMatch[1];
          const day = javaDateMatch[2];
          const time = javaDateMatch[3];
          const year = javaDateMatch[5];
          const d = new Date(`${month} ${day} ${year} ${time}`);
          if (!isNaN(d.getTime())) return d;
        }

        // Clean ISO 8601 with nanoseconds down to milliseconds (.442489200Z -> .442Z)
        const sanitizedIso = trimmed.replace(/(\.\d{3})\d+([Z+-])/, '$1$2');
        const dIso = new Date(sanitizedIso);
        if (!isNaN(dIso.getTime())) return dIso;

        const dDirect = new Date(trimmed);
        if (!isNaN(dDirect.getTime())) return dDirect;
      }
    }
  }

  // Fallback: extract epoch ms from messageId
  if (messageId) {
    const idMatch = String(messageId).match(/msg-(\d{10,14})/);
    if (idMatch) {
      const num = Number(idMatch[1]);
      if (!isNaN(num) && num > 1000000000000) {
        const d = new Date(num);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  return null;
}

/**
 * Formats a valid Date object into a readable time/date string.
 * Never outputs "Invalid Date".
 */
export function formatTimestampDisplay(date, mode = 'time') {
  if (!date || isNaN(date.getTime())) return '';
  try {
    if (mode === 'time') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (mode === 'datetime') {
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleString();
  } catch (e) {
    return '';
  }
}

/**
 * Reconciles authoritative server messages and active in-memory client messages.
 * Ensures:
 * 1. Zero missing or dropped messages.
 * 2. Zero duplicated messages.
 * 3. Exact chronological ordering preserved.
 * 4. Client-side enrichments (generatedImage, attachments with dataUrl, researchSources,
 *    documentSources, memoriesUsed, ongoing streaming content) are preserved without loss.
 */
export function reconcileConversationMessages(serverMessages = [], clientMessages = []) {
  const server = Array.isArray(serverMessages) ? serverMessages : [];
  const client = Array.isArray(clientMessages) ? clientMessages : [];

  if (server.length === 0) return client;
  if (client.length === 0) return server;

  const clientById = new Map();
  for (const cm of client) {
    if (cm && cm.id) {
      clientById.set(cm.id, cm);
    }
  }

  const merged = [];
  const matchedClientIndices = new Set();

  for (let i = 0; i < server.length; i++) {
    const sMsg = server[i];
    if (!sMsg) continue;

    // 1. Match by exact ID
    let matchedClient = sMsg.id ? clientById.get(sMsg.id) : null;
    let clientIndex = matchedClient ? client.indexOf(matchedClient) : -1;

    // 2. Fallback match by role and relative sequence position if ID was assigned differently
    if (!matchedClient && i < client.length) {
      const candidate = client[i];
      if (candidate && candidate.role === sMsg.role && !matchedClientIndices.has(i)) {
        matchedClient = candidate;
        clientIndex = i;
      }
    }

    if (matchedClient) {
      if (clientIndex !== -1) matchedClientIndices.add(clientIndex);

      // Determine content: client has priority if it has longer text (e.g. streaming or edited)
      const clientContent = typeof matchedClient.content === 'string' ? matchedClient.content : '';
      const serverContent = typeof sMsg.content === 'string' ? sMsg.content : '';
      const finalContent = (clientContent && clientContent.length >= serverContent.length)
        ? clientContent
        : (serverContent || clientContent);

      // Merge attachments ensuring dataUrl and metadata are preserved
      const sAtts = Array.isArray(sMsg.attachments) ? sMsg.attachments : [];
      const cAtts = Array.isArray(matchedClient.attachments) ? matchedClient.attachments : [];
      const attMap = new Map();
      for (const a of [...sAtts, ...cAtts]) {
        if (!a) continue;
        const key = a.name || a.url || a.dataUrl || JSON.stringify(a);
        if (!attMap.has(key) || (a.dataUrl && !attMap.get(key).dataUrl)) {
          attMap.set(key, a);
        }
      }
      const mergedAtts = Array.from(attMap.values());

      merged.push({
        ...sMsg,
        ...matchedClient,
        id: matchedClient.id || sMsg.id || `msg-${i}`,
        role: sMsg.role || matchedClient.role,
        content: finalContent,
        attachments: mergedAtts,
        generatedImage: matchedClient.generatedImage || sMsg.generatedImage || null,
        imageUrl: matchedClient.imageUrl || sMsg.imageUrl || null,
        imageName: matchedClient.imageName || sMsg.imageName || null,
        researchSources: (matchedClient.researchSources && matchedClient.researchSources.length > 0)
          ? matchedClient.researchSources
          : (sMsg.researchSources || []),
        documentSources: (matchedClient.documentSources && matchedClient.documentSources.length > 0)
          ? matchedClient.documentSources
          : (sMsg.documentSources || []),
        memoriesUsed: (matchedClient.memoriesUsed && matchedClient.memoriesUsed.length > 0)
          ? matchedClient.memoriesUsed
          : (sMsg.memoriesUsed || []),
        modelId: matchedClient.modelId || sMsg.modelId || null,
        modelName: matchedClient.modelName || sMsg.modelName || null,
        provider: matchedClient.provider || sMsg.provider || null,
        language: matchedClient.language || sMsg.language || 'en',
        createdAt: sMsg.createdAt || matchedClient.createdAt || new Date().toISOString()
      });
    } else {
      // Retain authoritative server message
      merged.push(sMsg);
    }
  }

  // Append any newly sent or in-progress client messages not yet in database
  for (let j = 0; j < client.length; j++) {
    if (!matchedClientIndices.has(j)) {
      const cMsg = client[j];
      if (cMsg && !merged.some(m => m.id === cMsg.id)) {
        merged.push(cMsg);
      }
    }
  }

  return merged;
}

/**
 * Reconciles highlights between database and client state.
 */
export function reconcileHighlights(serverHighlights = [], clientHighlights = []) {
  const sList = Array.isArray(serverHighlights) ? serverHighlights : [];
  const cList = Array.isArray(clientHighlights) ? clientHighlights : [];
  const map = new Map();

  for (const h of [...sList, ...cList]) {
    if (!h) continue;
    const key = h.id || `${h.messageId}-${h.startOffset}-${h.endOffset}`;
    map.set(key, h);
  }

  return Array.from(map.values());
}

/**
 * Applies saved highlight annotations to raw text for Markdown export.
 * Uses exact anchor matching so duplicate words are highlighted accurately.
 */
export function applyHighlightsToMarkdown(content, messageHighlights) {
  if (!content || !messageHighlights || messageHighlights.length === 0) {
    return content || '';
  }

  const resolved = [];
  for (const hl of messageHighlights) {
    if (!hl || !hl.text) continue;
    const range = resolveAnnotationRange(content, hl);
    if (range) {
      resolved.push({
        start: range.start,
        end: range.end,
        hl
      });
    }
  }

  if (resolved.length === 0) {
    return content;
  }

  // Sort descending by start offset to prevent offset shifting
  resolved.sort((a, b) => b.start - a.start);

  let result = content;
  for (const item of resolved) {
    const { start, end, hl } = item;
    const rgba = normalizeHighlightColor(hl.color, 0.35);
    const textSlice = result.slice(start, end);
    const markTag = `<mark style="background-color: ${rgba}; padding: 1px 3px; border-radius: 3px;">${textSlice}</mark>`;
    result = result.slice(0, start) + markTag + result.slice(end);
  }

  return result;
}

/**
 * High-fidelity Markdown to readable Plain Text converter.
 * Strips formatting markup while preserving structural integrity:
 * - Headings, paragraphs, bullet points, numbered lists
 * - Tables formatted as aligned clean text rows
 * - Code blocks formatted with clear language headers
 * - Mathematical equations and formulas preserved cleanly
 * - Citations, links, emojis, and Unicode intact
 */
export function convertMarkdownToPlainText(markdown) {
  if (!markdown) return '';
  let text = String(markdown);

  // Normalize line breaks
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strip HTML tags like <mark>, <span>, <div>, etc. (without stripping mathematical inequalities like < 50ms)
  text = text.replace(/<mark[^>]*>(.*?)<\/mark>/gis, '$1');
  text = text.replace(/<[a-zA-Z\/][^>]*>/g, '');

  // Convert markdown images ![alt](url) -> [Image: alt]
  text = text.replace(/!\[(.*?)\]\([^)]+\)/g, (match, alt) => `[Image: ${alt || 'Attachment'}]`);

  // Convert markdown links [label](url) -> label (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // Convert bold and italic: **bold**, __bold__, *italic*, _italic_
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Convert fenced code blocks ```lang ... ``` -> clean bounded code blocks (must precede inline code)
  text = text.replace(/```(\w*)[^\n]*\n([\s\S]*?)```/g, (match, lang, code) => {
    const langLabel = lang ? ` [${lang.toUpperCase()}]` : '';
    return `\n----- CODE BLOCK${langLabel} -----\n${code.trim()}\n---------------------------\n`;
  });

  // Convert inline code `code` -> code
  text = text.replace(/`([^`\n]+)`/g, '$1');

  // Convert markdown tables
  text = text.replace(/((?:\|[^\n]+\|\n?)+)/g, (match) => {
    const lines = match.trim().split('\n').filter(l => l.trim().startsWith('|'));
    if (lines.length < 2) return match;
    const contentRows = lines.filter(l => !/^[|\s:-]+$/.test(l));
    return '\n' + contentRows.map(row => {
      const cells = row.split('|').slice(1, -1).map(c => c.trim());
      return cells.join('  |  ');
    }).join('\n') + '\n';
  });

  // Convert blockquotes: > quote -> | quote
  text = text.replace(/^>\s?(.*)$/gm, '| $1');

  // Convert bullet points: * item or - item -> • item
  text = text.replace(/^[\*\-]\s+(.*)$/gm, '• $1');

  // Convert headers: # Header -> Header
  text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // Strip horizontal rules: --- or ***
  text = text.replace(/^[-*_]{3,}\s*$/gm, '----------------------------------------');

  // Clean excessive empty lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Escapes plain text for safe HTML injection.
 */
export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders message content to static HTML with highlighted spans, custom code blocks,
 * responsive tables, math blocks, and secure links.
 */
export function renderMessageHtml(content, messageHighlights) {
  if (!content) return '';
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          [rehypeHighlightApplier, { highlights: messageHighlights }]
        ],
        components: {
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isBlock = match || codeString.includes('\n');

            if (isBlock) {
              const lang = match ? match[1].toUpperCase() : 'CODE';
              return React.createElement(
                'div',
                { className: 'code-container' },
                React.createElement('div', { className: 'code-header' }, lang),
                React.createElement(
                  'pre',
                  { className: 'code-body' },
                  React.createElement('code', { className, ...props }, codeString)
                )
              );
            }
            return React.createElement(
              'code',
              { className: 'inline-code', ...props },
              children
            );
          },
          table({ node, children, ...props }) {
            return React.createElement(
              'div',
              { className: 'table-wrapper' },
              React.createElement('table', { className: 'markdown-table', ...props }, children)
            );
          },
          mark({ node, children, className, style, ...props }) {
            const hlColor = props['data-highlight-color'];
            const bg = normalizeHighlightColor(hlColor || (typeof style === 'object' ? style?.backgroundColor : style), 0.28);
            return React.createElement(
              'mark',
              {
                ...props,
                className: 'rgb-marker-highlight',
                style: {
                  backgroundColor: bg,
                  padding: '1px 3px',
                  borderRadius: '3px',
                  ...(typeof style === 'object' ? style : {})
                }
              },
              children
            );
          },
          a({ node, href, children, ...props }) {
            return React.createElement(
              'a',
              {
                href,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'export-link',
                ...props
              },
              children
            );
          },
          img({ node, src, alt, ...props }) {
            return React.createElement(
              'div',
              { className: 'markdown-image-wrapper' },
              React.createElement('img', {
                src,
                alt: alt || 'Embedded Image',
                className: 'markdown-embedded-image',
                loading: 'eager',
                ...props
              }),
              alt ? React.createElement('div', { className: 'image-caption' }, alt) : null
            );
          },
          p({ node, children, ...props }) {
            // Check for display math equations wrapped in $$...$$
            const textContent = Array.isArray(children)
              ? children.map(c => (typeof c === 'string' ? c : '')).join('')
              : (typeof children === 'string' ? children : '');

            const trimmed = textContent.trim();
            if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
              const eq = trimmed.slice(2, -2).trim();
              return React.createElement(
                'div',
                { className: 'math-block' },
                React.createElement('span', { className: 'math-tex' }, eq)
              );
            }

            // Also check if paragraph contains $$...$$ in the middle
            if (trimmed.includes('$$')) {
              const parts = trimmed.split(/(\$\$[\s\S]+?\$\$)/g);
              if (parts.length > 1) {
                return React.createElement(
                  'div',
                  { className: 'p-with-math' },
                  parts.map((part, idx) => {
                    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
                      return React.createElement(
                        'div',
                        { key: idx, className: 'math-block' },
                        React.createElement('span', { className: 'math-tex' }, part.slice(2, -2).trim())
                      );
                    }
                    return part ? React.createElement('p', { key: idx }, part) : null;
                  })
                );
              }
            }

            return React.createElement('p', props, children);
          }
        }
      },
      content
    )
  );
}

// Crisp inline SVGs for UI elements (eliminates any emoji surrogate pair font decoding issues)
const USER_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

const BOT_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10a37f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>`;

const CALENDAR_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;

const MESSAGE_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;

const ZAP_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10a37f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

const PRINTER_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>`;

const FILE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 5px;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;

const IMAGE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 5px;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

const GLOBE_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 5px;"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

/**
 * Renders user attachments and AI-generated images associated with a message.
 * Handles dataUrl, url, and data payloads gracefully without losing images.
 */
export function renderAttachmentsHtml(attachments, imageUrl, imageName, generatedImage) {
  const items = [];

  // 1. Direct imageUrl property
  if (imageUrl) {
    items.push({
      src: imageUrl,
      name: imageName || 'Image Attachment',
      isImage: true
    });
  }

  // 2. AI-generated image object
  if (generatedImage) {
    const gSrc = generatedImage.imageDataUrl || generatedImage.url || generatedImage.imageUrl;
    if (gSrc) {
      items.push({
        src: gSrc,
        name: generatedImage.prompt || 'Generated Image',
        isImage: true,
        caption: `Generated with ${generatedImage.modelName || 'AI Image Generator'}: "${generatedImage.prompt || ''}"`
      });
    }
  }

  // 3. User attachments array
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (!att) continue;
      const src = att.dataUrl || att.url || att.data;
      const isImg = (att.type && att.type.startsWith('image/')) || (src && String(src).startsWith('data:image/'));
      items.push({
        src: src || '#',
        name: att.name || 'Attachment',
        type: att.type || 'file',
        size: att.formattedSize,
        isImage: Boolean(isImg && src)
      });
    }
  }

  if (items.length === 0) return '';

  let html = '<div class="message-attachments">';
  for (const item of items) {
    if (item.isImage && item.src && item.src !== '#') {
      html += `
        <div class="attachment-item attachment-image">
          <img src="${item.src}" alt="${escapeHtml(item.name)}" loading="eager" />
          <div class="attachment-caption">${IMAGE_ICON_SVG}${escapeHtml(item.caption || item.name)}</div>
        </div>
      `;
    } else {
      html += `
        <div class="attachment-item attachment-file">
          <span class="file-icon">${FILE_ICON_SVG}</span>
          <span class="file-name">${escapeHtml(item.name)}${item.size ? ` (${escapeHtml(item.size)})` : ''}</span>
        </div>
      `;
    }
  }
  html += '</div>';
  return html;
}

/**
 * Triggers browser file download from a Blob with robust revocation delay.
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Safe 1500ms delay ensures download stream is fully initiated before revoking Object URL
  setTimeout(() => {
    if (a.parentNode) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Builds standalone HTML markup with embedded print, typography, and screen styling.
 * Applies A4 boundaries, prevents horizontal spill, renders inline SVGs, and supports Indic languages.
 */
export function buildStandaloneHtml(conversation, messages, highlights = [], options = {}) {
  const { forPdf = false, isPrintPreview = false } = options;
  const title = conversation?.title || 'Yash AI Conversation';
  const now = new Date().toLocaleString();

  let messagesHtml = '';
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isUser = msg.role === 'user';
    const roleIconSvg = isUser ? USER_ICON_SVG : BOT_ICON_SVG;
    const modelBadge = !isUser && (msg.modelName || msg.modelId) ? ` (${msg.modelName || msg.modelId})` : '';
    const roleName = isUser ? 'You' : `Yash AI${modelBadge}`;

    const dateObj = parseMessageTimestamp(msg.createdAt, msg.id);
    const timeStr = formatTimestampDisplay(dateObj, 'time');
    const msgHighlights = highlights.filter(h => h.messageId === msg.id);

    const attachmentsHtml = renderAttachmentsHtml(msg.attachments, msg.imageUrl, msg.imageName, msg.generatedImage);
    const bodyHtml = renderMessageHtml(msg.content, msgHighlights) || (isUser ? '' : '<p class="in-progress-text"><em>(Response in progress...)</em></p>');

    let sourcesHtml = '';
    if (Array.isArray(msg.researchSources) && msg.researchSources.length > 0) {
      sourcesHtml = `
        <div class="message-sources">
          <div class="sources-title">${GLOBE_ICON_SVG}Verified Sources (${msg.researchSources.length})</div>
          <ul class="sources-list">
            ${msg.researchSources.map(s => `
              <li>
                <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || s.url)}</a>
                ${s.snippet ? ` <span class="source-snippet">— ${escapeHtml(s.snippet)}</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    let docsHtml = '';
    if (Array.isArray(msg.documentSources) && msg.documentSources.length > 0) {
      docsHtml = `
        <div class="message-documents">
          <div class="sources-title">${FILE_ICON_SVG}Referenced Documents</div>
          <ul class="sources-list">
            ${msg.documentSources.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    messagesHtml += `
      <div class="message-card ${isUser ? 'user-message' : 'assistant-message'}">
        <div class="message-header">
          <div class="role-badge">
            <span class="role-icon">${roleIconSvg}</span>
            <span class="role-name">${escapeHtml(roleName)}</span>
          </div>
          ${timeStr ? `<span class="message-time">${timeStr}</span>` : ''}
        </div>
        ${attachmentsHtml}
        <div class="message-body markdown-content">
          ${bodyHtml}
        </div>
        ${sourcesHtml}
        ${docsHtml}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Yash AI Export</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f8fafc;
      --card-user: #f1f5f9;
      --card-assistant: #ffffff;
      --border-user: #e2e8f0;
      --border-assistant: #cbd5e1;
      --accent: #10a37f;
      --text: #0f172a;
      --text-muted: #64748b;
    }
    ${!forPdf && !isPrintPreview ? `
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --card-user: #1e293b;
        --card-assistant: #1e293b;
        --border-user: #334155;
        --border-assistant: #334155;
        --accent: #10a37f;
        --text: #f8fafc;
        --text-muted: #94a3b8;
      }
    }
    ` : ''}
    * {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      ${forPdf ? `
        width: 720px !important;
        max-width: 720px !important;
        overflow-x: hidden !important;
        background-color: #ffffff !important;
      ` : ''}
    }
    body {
      font-family: "Noto Sans Devanagari", "Noto Sans Gujarati", "Nirmala UI", "Segoe UI Historic", "Kohinoor Devanagari", "Lohit Devanagari", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Arial Unicode MS", Arial, sans-serif !important;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: ${forPdf ? '0' : '28px 16px'};
      -webkit-font-smoothing: antialiased;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
    .container {
      width: 100% !important;
      max-width: ${forPdf ? '720px' : '860px'} !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      overflow-x: hidden !important;
    }
    .doc-header {
      background: var(--card-assistant);
      border: 1px solid var(--border-assistant);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      box-sizing: border-box !important;
    }
    .doc-header h1 {
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--text);
      line-height: 1.3;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .doc-meta {
      font-size: 0.82rem;
      color: var(--text-muted);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }
    .print-btn-bar {
      display: ${forPdf ? 'none' : 'flex'};
      justify-content: flex-end;
      margin-bottom: 14px;
    }
    .print-btn {
      background-color: var(--accent);
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: opacity 0.15s ease;
    }
    .print-btn:hover { opacity: 0.9; }

    /* Message Cards */
    .message-card {
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 14px;
      border: 1px solid;
      box-sizing: border-box !important;
      max-width: 100% !important;
      break-inside: auto;
      page-break-inside: auto;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .user-message {
      background-color: var(--card-user);
      border-color: var(--border-user);
    }
    .assistant-message {
      background-color: var(--card-assistant);
      border-color: var(--border-assistant);
      border-left: 4px solid var(--accent);
      box-shadow: 0 1px 4px rgba(0,0,0,0.02);
    }
    .message-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      gap: 12px !important;
      margin-bottom: 8px !important;
      padding-bottom: 6px !important;
      border-bottom: 1px solid var(--border-user) !important;
      break-inside: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      box-sizing: border-box !important;
    }
    .role-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      min-width: 0 !important;
      flex: 1 1 auto !important;
      overflow: hidden !important;
    }
    .role-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .role-name {
      font-weight: 600 !important;
      font-size: 0.9rem !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      line-height: 1.35 !important;
    }
    .message-time {
      font-size: 0.76rem !important;
      color: var(--text-muted) !important;
      flex-shrink: 0 !important;
      white-space: nowrap !important;
      text-align: right !important;
      padding-top: 2px !important;
    }
    .in-progress-text {
      color: var(--text-muted);
      font-style: italic;
    }

    /* Message Attachments & Images */
    .message-attachments {
      margin: 8px 0 12px 0;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      box-sizing: border-box !important;
      max-width: 100% !important;
    }
    .attachment-item {
      border: 1px solid var(--border-assistant);
      border-radius: 8px;
      overflow: hidden;
      background: var(--card-assistant);
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .attachment-image img {
      display: block;
      max-width: 100% !important;
      max-height: 320px;
      object-fit: contain;
    }
    .attachment-caption {
      padding: 6px 10px;
      font-size: 0.75rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border-user);
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      font-weight: 500;
    }
    .attachment-file {
      padding: 8px 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      max-width: 100%;
      word-break: break-word;
    }

    /* Markdown Typography & Structure */
    .markdown-content {
      font-size: 0.92rem;
      line-height: 1.62;
      color: var(--text);
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      box-sizing: border-box !important;
      max-width: 100% !important;
    }
    .markdown-content h1 {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 14px 0 6px 0;
      color: var(--text);
      break-inside: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      word-break: break-word !important;
    }
    .markdown-content h2 {
      font-size: 1.2rem;
      font-weight: 700;
      margin: 12px 0 6px 0;
      color: var(--text);
      break-inside: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      word-break: break-word !important;
    }
    .markdown-content h3 {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 10px 0 4px 0;
      color: var(--text);
      break-inside: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      word-break: break-word !important;
    }
    .markdown-content h4, .markdown-content h5, .markdown-content h6 {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 8px 0 4px 0;
      color: var(--text);
      break-inside: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      word-break: break-word !important;
    }
    .markdown-content p {
      margin: 6px 0;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      line-height: 1.6;
    }
    .markdown-content p:first-child { margin-top: 0; }
    .markdown-content p:last-child { margin-bottom: 0; }
    .markdown-content strong { font-weight: 600; }
    .markdown-content em { font-style: italic; }

    /* Reliable Markdown Lists for Print & PDF */
    .markdown-content ul {
      list-style-type: disc !important;
      padding-left: 26px !important;
      margin: 8px 0 !important;
      box-sizing: border-box !important;
    }
    .markdown-content ol {
      list-style-type: decimal !important;
      padding-left: 28px !important;
      margin: 8px 0 !important;
      box-sizing: border-box !important;
    }
    .markdown-content li {
      margin: 4px 0 !important;
      line-height: 1.6 !important;
      display: list-item !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .markdown-content li > p {
      display: inline !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .markdown-content ul ul {
      list-style-type: circle !important;
      padding-left: 22px !important;
      margin: 4px 0 !important;
    }
    .markdown-content ul ul ul {
      list-style-type: square !important;
      padding-left: 20px !important;
      margin: 2px 0 !important;
    }
    .markdown-content ol ol {
      list-style-type: lower-alpha !important;
      padding-left: 22px !important;
      margin: 4px 0 !important;
    }

    /* Math Blocks */
    .math-block {
      background: rgba(100, 116, 139, 0.05);
      border-left: 3px solid var(--accent);
      padding: 10px 16px;
      margin: 10px 0;
      border-radius: 4px;
      font-family: "KaTeX_Main", "Cambria Math", "Noto Sans Devanagari", "Times New Roman", serif;
      font-size: 1.05rem;
      text-align: center;
      overflow-x: auto;
      letter-spacing: 0.02em;
      word-break: break-word;
      box-sizing: border-box !important;
      max-width: 100% !important;
    }

    /* Embedded Markdown Images */
    .markdown-image-wrapper {
      margin: 12px 0;
      text-align: center;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      max-width: 100% !important;
    }
    .markdown-embedded-image {
      max-width: 100% !important;
      max-height: 380px;
      border-radius: 8px;
      border: 1px solid var(--border-assistant);
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      object-fit: contain;
    }
    .image-caption {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 4px;
      font-style: italic;
    }

    /* Code Blocks */
    .code-container {
      background: rgba(100, 116, 139, 0.08);
      border: 1px solid rgba(100, 116, 139, 0.2);
      border-radius: 8px;
      margin: 10px 0;
      overflow: hidden !important;
      box-sizing: border-box !important;
      max-width: 100% !important;
      width: 100% !important;
      break-inside: auto;
    }
    .code-header {
      background: rgba(100, 116, 139, 0.12);
      padding: 4px 10px;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid rgba(100, 116, 139, 0.15);
    }
    .code-body {
      padding: 10px 12px;
      font-family: "JetBrains Mono", Consolas, "Courier New", monospace !important;
      font-size: 0.84rem;
      line-height: 1.5;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      box-sizing: border-box !important;
      max-width: 100% !important;
    }
    .code-body code {
      background: none;
      padding: 0;
      border: none;
      font-family: inherit;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
    }
    .inline-code {
      font-family: "JetBrains Mono", Consolas, "Courier New", monospace !important;
      font-size: 0.85em;
      background-color: rgba(100, 116, 139, 0.12);
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid rgba(100, 116, 139, 0.15);
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }

    /* Tables: Fixed layout ensuring 100% container containment */
    .table-wrapper {
      width: 100% !important;
      max-width: 100% !important;
      margin: 10px 0;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    .markdown-table {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      font-size: 0.86rem;
      box-sizing: border-box !important;
    }
    .markdown-table th, .markdown-table td {
      border: 1px solid var(--border-assistant);
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      white-space: normal !important;
      box-sizing: border-box !important;
    }
    .markdown-table th {
      background-color: rgba(100, 116, 139, 0.08);
      font-weight: 600;
      color: var(--text);
    }
    .markdown-table tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .markdown-table tr:nth-child(even) td {
      background-color: rgba(100, 116, 139, 0.03);
    }

    /* Blockquotes & Dividers */
    .markdown-content blockquote {
      border-left: 3px solid var(--accent);
      padding: 4px 12px;
      margin: 8px 0;
      color: var(--text-muted);
      background-color: rgba(16, 163, 127, 0.04);
      border-radius: 0 4px 4px 0;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .markdown-content hr {
      border: 0;
      border-top: 1px solid var(--border-assistant);
      margin: 12px 0;
    }
    .export-link {
      color: var(--accent);
      text-decoration: underline;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
    }

    /* Sources & Documents Boxes */
    .message-sources, .message-documents {
      margin-top: 12px;
      padding: 8px 12px;
      background: rgba(100, 116, 139, 0.05);
      border: 1px solid var(--border-assistant);
      border-radius: 8px;
      font-size: 0.82rem;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      box-sizing: border-box !important;
      max-width: 100% !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .sources-title {
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
    }
    .sources-list {
      padding-left: 18px;
      margin: 2px 0;
    }
    .sources-list li {
      margin: 2px 0;
      line-height: 1.45;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .source-snippet {
      color: var(--text-muted);
      font-style: italic;
    }

    /* Saved Highlights */
    .rgb-marker-highlight {
      display: inline;
      padding: 1px 3px;
      border-radius: 3px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }

    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .print-btn-bar { display: none !important; }
      .doc-header, .message-card {
        box-shadow: none !important;
        border-color: #cbd5e1 !important;
        background-color: #ffffff !important;
      }
      .user-message {
        background-color: #f8fafc !important;
      }
      .assistant-message {
        border-left: 4px solid #10a37f !important;
      }
      .message-card {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      .message-header, h1, h2, h3, h4, h5, h6, tr, .attachment-item {
        break-inside: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
      }
      @page {
        margin: 14mm 15mm;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="print-btn-bar">
      <button class="print-btn" onclick="window.print()">${PRINTER_ICON_SVG}Print / Save to PDF</button>
    </div>
    <div class="doc-header">
      <h1>${escapeHtml(title)}</h1>
      <div class="doc-meta">
        <span>${CALENDAR_ICON_SVG}<strong>Exported:</strong> ${now}</span>
        <span>${MESSAGE_ICON_SVG}<strong>Messages:</strong> ${messages.length}</span>
        <span>${ZAP_ICON_SVG}<strong>Yash AI Enterprise Platform</strong></span>
      </div>
    </div>
    <div class="messages-list">
      ${messagesHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Export Format 1: Plain Text (.txt)
 * Generates an exceptionally clean, readable, structured text file.
 */
export async function exportToText(conversation, messages, highlights = []) {
  const title = conversation?.title || 'Yash AI Conversation';
  const now = new Date().toLocaleString();
  const filename = sanitizeFilename(title, 'txt');

  let txt = `================================================================================\n`;
  txt += `YASH AI CONVERSATION EXPORT\n`;
  txt += `================================================================================\n`;
  txt += `Title:          ${title}\n`;
  txt += `Export Date:    ${now}\n`;
  txt += `Total Messages: ${messages.length}\n`;
  if (highlights.length > 0) {
    txt += `Saved Highlights: ${highlights.length}\n`;
  }
  txt += `Platform:       Yash AI Enterprise Platform\n`;
  txt += `================================================================================\n\n`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isUser = msg.role === 'user';
    const roleLabel = isUser ? 'USER' : `YASH AI (${msg.modelName || msg.modelId || 'Assistant'})`;

    const dateObj = parseMessageTimestamp(msg.createdAt, msg.id);
    const timeStr = formatTimestampDisplay(dateObj, 'datetime');

    txt += `--------------------------------------------------------------------------------\n`;
    txt += `[#${i + 1}] ${roleLabel}${timeStr ? `  |  ${timeStr}` : ''}\n`;
    txt += `--------------------------------------------------------------------------------\n`;

    // Attachments
    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      txt += `Attachments:\n`;
      for (const att of msg.attachments) {
        if (!att) continue;
        txt += `  • [${att.type || 'File'}] ${att.name || 'attachment'}${att.formattedSize ? ` (${att.formattedSize})` : ''}\n`;
      }
      txt += `\n`;
    }

    // Generated Image
    if (msg.generatedImage) {
      const g = msg.generatedImage;
      txt += `Generated Image:\n`;
      txt += `  • Prompt: "${g.prompt || g.originalPrompt || 'Image'}"\n`;
      if (g.modelName || g.modelId) {
        txt += `  • Model: ${g.modelName || g.modelId}\n`;
      }
      txt += `\n`;
    }

    const cleanBody = convertMarkdownToPlainText(msg.content);
    if (cleanBody) {
      txt += `${cleanBody}\n\n`;
    } else if (msg.role === 'assistant') {
      txt += `(Response in progress...)\n\n`;
    }

    // Web Research Sources
    if (Array.isArray(msg.researchSources) && msg.researchSources.length > 0) {
      txt += `Verified Web Sources:\n`;
      for (const src of msg.researchSources) {
        txt += `  • ${src.title || 'Source'}: ${src.url}\n`;
      }
      txt += `\n`;
    }

    // Document Sources
    if (Array.isArray(msg.documentSources) && msg.documentSources.length > 0) {
      txt += `Referenced Documents:\n`;
      for (const doc of msg.documentSources) {
        txt += `  • ${doc}\n`;
      }
      txt += `\n`;
    }
  }

  txt += `================================================================================\n`;
  txt += `END OF CONVERSATION EXPORT\n`;
  txt += `================================================================================\n`;

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, filename);
  return filename;
}

/**
 * Export Format 2: Markdown (.md)
 * Preserves native Markdown syntax for headings, lists, tables, code blocks, math, and highlights.
 */
export async function exportToMarkdown(conversation, messages, highlights = []) {
  const title = conversation?.title || 'Yash AI Conversation';
  const now = new Date().toLocaleString();
  const filename = sanitizeFilename(title, 'md');

  let md = `# ${title}\n\n`;
  md += `> **Platform:** Yash AI Enterprise Assistant  \n`;
  md += `> **Export Date:** ${now}  \n`;
  md += `> **Total Messages:** ${messages.length}  \n`;
  if (highlights.length > 0) {
    md += `> **Saved Highlights:** ${highlights.length}  \n`;
  }
  md += `\n---\n\n`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isUser = msg.role === 'user';
    const roleLabel = isUser ? '👤 User' : `🤖 Yash AI (${msg.modelName || msg.modelId || 'Assistant'})`;

    const dateObj = parseMessageTimestamp(msg.createdAt, msg.id);
    const timeStr = formatTimestampDisplay(dateObj, 'datetime');
    const msgHighlights = highlights.filter(h => h.messageId === msg.id);

    md += `### ${roleLabel}${timeStr ? ` • *${timeStr}*` : ''}\n\n`;

    // Attachments
    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (!att) continue;
        const src = att.dataUrl || att.url || att.data;
        const isImg = (att.type && att.type.startsWith('image/')) || (src && String(src).startsWith('data:image/'));
        if (isImg && src) {
          md += `![${att.name || 'Attachment'}](${src})\n\n`;
        } else if (src) {
          md += `📎 **Attachment:** [${att.name || 'File'}](${src})${att.formattedSize ? ` *(${att.formattedSize})*` : ''}\n\n`;
        } else {
          md += `📎 **Attachment:** ${att.name || 'File'}${att.formattedSize ? ` *(${att.formattedSize})*` : ''}\n\n`;
        }
      }
    }

    // Generated Image
    if (msg.generatedImage) {
      const g = msg.generatedImage;
      const gSrc = g.imageDataUrl || g.url || g.imageUrl;
      if (gSrc) {
        md += `![${g.prompt || 'Generated Image'}](${gSrc})\n\n`;
      }
      if (g.prompt) {
        md += `*🎨 Generated Image Prompt:* "${g.prompt}"${g.modelName ? ` — *Model: ${g.modelName}*` : ''}\n\n`;
      }
    } else if (msg.imageUrl) {
      md += `![${msg.imageName || 'Image'}](${msg.imageUrl})\n\n`;
    }

    const formattedContent = applyHighlightsToMarkdown(msg.content, msgHighlights);
    if (formattedContent && formattedContent.trim()) {
      md += `${formattedContent}\n\n`;
    } else if (msg.role === 'assistant') {
      md += `*(Response in progress...)*\n\n`;
    }

    // Web Research Sources
    if (Array.isArray(msg.researchSources) && msg.researchSources.length > 0) {
      md += `#### 🌐 Verified Sources & Citations\n`;
      for (const src of msg.researchSources) {
        md += `- [${src.title || src.url}](${src.url})${src.snippet ? ` — *${src.snippet}*` : ''}\n`;
      }
      md += `\n`;
    }

    // Document Sources
    if (Array.isArray(msg.documentSources) && msg.documentSources.length > 0) {
      md += `#### 📄 Referenced Documents\n`;
      for (const doc of msg.documentSources) {
        md += `- ${doc}\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, filename);
  return filename;
}

/**
 * Export Format 3: Standalone HTML (.html)
 */
export async function exportToHtml(conversation, messages, highlights = []) {
  const title = conversation?.title || 'Yash AI Conversation';
  const filename = sanitizeFilename(title, 'html');
  const htmlContent = buildStandaloneHtml(conversation, messages, highlights, { forPdf: false });

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, filename);
  return filename;
}

/**
 * Export Format 4: Multi-Page PDF (.pdf)
 * Uses an isolated hidden iframe with exact A4 page metrics (595.28 pt x 841.89 pt).
 * Applies synchronized geometry, consistent margins [44, 32, 44, 32], and prevents horizontal overflow.
 * Running headers and footers are positioned safely in the margin bands to prevent overlapping text.
 */
export async function exportToPdf(conversation, messages, highlights = []) {
  const title = conversation?.title || 'Yash AI Conversation';
  const filename = sanitizeFilename(title, 'pdf');

  // Create an isolated hidden iframe locked to standard 720px A4 printable width
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '720px';
  iframe.style.minWidth = '720px';
  iframe.style.maxWidth = '720px';
  iframe.style.height = '1100px';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.border = 'none';
  iframe.style.overflow = 'hidden';

  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const html = buildStandaloneHtml(conversation, messages, highlights, { forPdf: true });
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Settle fonts and external styles
    await new Promise(resolve => setTimeout(resolve, 200));
    if (iframeDoc.fonts && iframeDoc.fonts.ready) {
      try {
        await Promise.race([
          iframeDoc.fonts.ready,
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      } catch (e) {}
    }

    // Wait for any embedded images to load
    const images = Array.from(iframeDoc.images || []);
    if (images.length > 0) {
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => {
            img.onload = res;
            img.onerror = res;
            setTimeout(res, 3000);
          });
        })
      );
    }

    // Allow browser rendering engine to layout and settle text shaping
    await new Promise(resolve => setTimeout(resolve, 250));

    const targetElement = iframeDoc.querySelector('.container') || iframeDoc.body;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    });

    // Synchronized A4 Geometry:
    // Page: 595.28 pt wide x 841.89 pt tall.
    // Margin Top: 44 pt, Margin Bottom: 44 pt, Margin Left: 32 pt, Margin Right: 32 pt.
    // Printable content width: 595.28 - 32 - 32 = 531.28 pt.
    // windowWidth: 720 matches iframe container width exactly (scale = 531.28 / 720 = 0.737888).
    await doc.html(targetElement, {
      callback: (pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        // Safe title for running headers with built-in font
        const safeTitle = (title || 'Yash AI Conversation')
          .replace(/[^\x20-\x7E]/g, '')
          .trim()
          .substring(0, 50) || 'Yash AI Conversation';

        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(130, 140, 150);

          // Top Header Line & Running Title (positioned safely in top margin at y=22)
          pdf.text(safeTitle, 32, 22);
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.5);
          pdf.line(32, 30, 563.28, 30);

          // Bottom Footer Line & Page Number (positioned safely in bottom margin at y=824)
          pdf.line(32, 808, 563.28, 808);
          pdf.text('Yash AI Chat Export', 32, 822);
          pdf.text(`Page ${i} of ${totalPages}`, 563.28, 822, { align: 'right' });
        }
        pdf.save(filename);
      },
      margin: [44, 32, 44, 32],
      autoPaging: 'slice',
      width: 531.28,
      windowWidth: 720,
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 720,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const b = clonedDoc.body;
          if (b) {
            b.style.width = '720px';
            b.style.maxWidth = '720px';
            b.style.overflow = 'hidden';
            b.style.backgroundColor = '#ffffff';
          }
          const c = clonedDoc.querySelector('.container');
          if (c) {
            c.style.width = '720px';
            c.style.maxWidth = '720px';
            c.style.boxSizing = 'border-box';
          }
        }
      }
    });

    return filename;
  } finally {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}

/**
 * Direct Print to PDF via browser native print engine (100% vector typography fidelity)
 */
export function printConversation(conversation, messages, highlights = []) {
  const html = buildStandaloneHtml(conversation, messages, highlights, { forPdf: false, isPrintPreview: true });
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to open the print dialog.');
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for fonts and images in print window
  if (printWindow.document.fonts && printWindow.document.fonts.ready) {
    Promise.race([
      printWindow.document.fonts.ready,
      new Promise(res => setTimeout(res, 2500))
    ]).catch(() => {}).finally(() => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 350);
    });
  } else {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 450);
  }
}
