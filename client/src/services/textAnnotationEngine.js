/**
 * Yash AI - Intelligent Text Annotation & Highlighting Engine
 *
 * Provides:
 * 1. Robust DOM selection and character offset mapping across text nodes and inline formatting.
 * 2. Deterministic AST-level Rehype plugin for rendering non-overlapping marker highlights.
 * 3. Contextual anchor resolution (prefix, exactText, suffix, startOffset, endOffset).
 * 4. Deterministic overlapping range segmentation and color replacement.
 * 5. High-contrast, theme-adaptive Red, Green, and Blue translucent marker palettes.
 * 6. Full compatibility with React reconciliation, ReactMarkdown, speech synchronization, and exports.
 */

// Primary accessible RGB translucent marker palette (soft marker style)
export const PRIMARY_HIGHLIGHT_PALETTE = {
  red: {
    key: 'red',
    label: 'Red',
    hex: '#EF4444',
    rgb: { r: 239, g: 68, b: 68 },
    swatchColor: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    textColor: '#ef4444',
    defaultRgba: 'rgba(239, 68, 68, 0.28)',
    getRgba: (alpha = 0.28) => `rgba(239, 68, 68, ${alpha})`
  },
  green: {
    key: 'green',
    label: 'Green',
    hex: '#10B981',
    rgb: { r: 16, g: 185, b: 129 },
    swatchColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    textColor: '#10b981',
    defaultRgba: 'rgba(16, 185, 129, 0.28)',
    getRgba: (alpha = 0.28) => `rgba(16, 185, 129, ${alpha})`
  },
  blue: {
    key: 'blue',
    label: 'Blue',
    hex: '#3B82F6',
    rgb: { r: 59, g: 130, b: 246 },
    swatchColor: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    textColor: '#3b82f6',
    defaultRgba: 'rgba(59, 130, 246, 0.28)',
    getRgba: (alpha = 0.28) => `rgba(59, 130, 246, ${alpha})`
  }
};

/**
 * Normalizes any color representation (key name, hex, rgb object, or rgba string)
 * into a valid, theme-accessible translucent RGBA marker string.
 */
export function normalizeHighlightColor(color, defaultAlpha = 0.28) {
  if (!color) return PRIMARY_HIGHLIGHT_PALETTE.green.getRgba(defaultAlpha);

  if (typeof color === 'string') {
    const trimmed = color.trim().toLowerCase();
    if (trimmed === 'red' || trimmed.startsWith('#ff0000') || trimmed.startsWith('#ef4444')) {
      return PRIMARY_HIGHLIGHT_PALETTE.red.getRgba(defaultAlpha);
    }
    if (trimmed === 'green' || trimmed.startsWith('#00ff00') || trimmed.startsWith('#10b981')) {
      return PRIMARY_HIGHLIGHT_PALETTE.green.getRgba(defaultAlpha);
    }
    if (trimmed === 'blue' || trimmed.startsWith('#0000ff') || trimmed.startsWith('#3b82f6')) {
      return PRIMARY_HIGHLIGHT_PALETTE.blue.getRgba(defaultAlpha);
    }

    const rgbaMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
    if (rgbaMatch) {
      const r = Number(rgbaMatch[1]);
      const g = Number(rgbaMatch[2]);
      const b = Number(rgbaMatch[3]);
      const a = rgbaMatch[4] !== undefined ? Math.min(1, Math.max(0.15, Number(rgbaMatch[4]))) : defaultAlpha;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    if (trimmed.startsWith('#')) {
      let clean = trimmed.replace(/^#/, '');
      if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
      const num = parseInt(clean, 16);
      if (!isNaN(num)) {
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${defaultAlpha})`;
      }
    }
    return trimmed;
  }

  if (typeof color === 'object') {
    const r = color.r ?? 16;
    const g = color.g ?? 185;
    const b = color.b ?? 129;
    const a = color.a ?? defaultAlpha;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return PRIMARY_HIGHLIGHT_PALETTE.green.getRgba(defaultAlpha);
}

/**
 * Resolves colorKey ('red' | 'green' | 'blue') from a color representation.
 */
export function getHighlightColorKey(color) {
  if (!color) return 'green';
  if (typeof color === 'string') {
    const lower = color.toLowerCase();
    if (lower === 'red' || lower.includes('239, 68, 68') || lower.includes('255, 0, 0') || lower === '#ef4444' || lower === '#ff0000') {
      return 'red';
    }
    if (lower === 'blue' || lower.includes('59, 130, 246') || lower.includes('0, 0, 255') || lower === '#3b82f6' || lower === '#0000ff') {
      return 'blue';
    }
    if (lower === 'green' || lower.includes('16, 185, 129') || lower.includes('0, 255, 0') || lower === '#10b981' || lower === '#00ff00') {
      return 'green';
    }
  }
  if (typeof color === 'object') {
    if (color.key) return color.key;
    if (color.r > color.g && color.r > color.b) return 'red';
    if (color.b > color.r && color.b > color.g) return 'blue';
  }
  return 'green';
}

/**
 * Computes exact character offsets and surrounding context for a DOM selection
 * within a message container element using DOM TreeWalker.
 * Skips code blocks (<pre>) and non-content elements.
 */
export function computeDomSelectionOffsets(rootElement, range) {
  if (!rootElement || !range || range.collapsed) return null;
  if (typeof document === 'undefined') return null;

  // Verify that the selection range is contained within the rootElement
  if (!rootElement.contains(range.commonAncestorContainer) &&
      range.commonAncestorContainer !== rootElement) {
    return null;
  }

  // Filter out selections that intersect buttons, toolbars, or code blocks
  const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const endEl = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;

  if (startEl?.closest('button') || endEl?.closest('button') ||
      startEl?.closest('.code-block-header') || endEl?.closest('.code-block-header')) {
    return null;
  }

  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // Skip code block contents inside <pre>
        if (node.parentElement?.closest('pre')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip interactive chrome, copy buttons, timestamps
        if (node.parentElement?.closest('button') ||
            node.parentElement?.closest('.chat-avatar') ||
            node.parentElement?.closest('.streaming-cursor')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );

  let currentOffset = 0;
  let startOffset = -1;
  let endOffset = -1;
  let fullText = '';

  let node;
  while ((node = walker.nextNode())) {
    const val = node.nodeValue || '';
    const nodeLen = val.length;

    if (node === range.startContainer) {
      startOffset = currentOffset + range.startOffset;
    }
    if (node === range.endContainer) {
      endOffset = currentOffset + range.endOffset;
    }

    fullText += val;
    currentOffset += nodeLen;
  }

  if (startOffset === -1 || endOffset === -1 || endOffset <= startOffset) {
    return null;
  }

  const selectedText = fullText.slice(startOffset, endOffset);
  if (!selectedText.trim()) return null;

  const prefix = fullText.slice(Math.max(0, startOffset - 35), startOffset);
  const suffix = fullText.slice(endOffset, Math.min(fullText.length, endOffset + 35));

  return {
    startOffset,
    endOffset,
    text: selectedText,
    prefix,
    suffix,
    docTextLength: fullText.length
  };
}

/**
 * Resolves a stored annotation to an exact [start, end] character range in the document text.
 * Uses 4-stage anchor matching:
 * 1. Direct offset check
 * 2. Prefix + Text + Suffix contextual matching
 * 3. Proximity search around stored offsets
 * 4. Unique occurrence fallback
 */
export function resolveAnnotationRange(docText, annotation) {
  if (!docText || !annotation || !annotation.text) return null;
  const targetText = annotation.text;
  const docLen = docText.length;
  const targetLen = targetText.length;

  const start = annotation.startOffset;
  const end = annotation.endOffset;

  // 1. Direct offset check
  if (typeof start === 'number' && typeof end === 'number' && start >= 0 && end <= docLen && end > start) {
    if (docText.slice(start, end) === targetText) {
      return { start, end };
    }
  }

  // 2. Prefix + Text + Suffix contextual matching
  const prefix = annotation.prefix || '';
  const suffix = annotation.suffix || '';
  if (prefix || suffix) {
    const pattern = `${prefix}${targetText}${suffix}`;
    const patternIdx = docText.indexOf(pattern);
    if (patternIdx !== -1) {
      const actualStart = patternIdx + prefix.length;
      return { start: actualStart, end: actualStart + targetLen };
    }

    // Try shorter prefix/suffix match (last 12 chars of prefix, first 12 chars of suffix)
    const shortPrefix = prefix.slice(-12);
    const shortSuffix = suffix.slice(0, 12);
    const shortPattern = `${shortPrefix}${targetText}${shortSuffix}`;
    const shortIdx = docText.indexOf(shortPattern);
    if (shortIdx !== -1) {
      const actualStart = shortIdx + shortPrefix.length;
      return { start: actualStart, end: actualStart + targetLen };
    }
  }

  // 3. Proximity search near original startOffset (within +/- 60 chars)
  if (typeof start === 'number' && start >= 0) {
    const searchMin = Math.max(0, start - 60);
    const searchMax = Math.min(docLen, (end || start + targetLen) + 60);
    const window = docText.slice(searchMin, searchMax);
    const localIdx = window.indexOf(targetText);
    if (localIdx !== -1) {
      const actualStart = searchMin + localIdx;
      return { start: actualStart, end: actualStart + targetLen };
    }
  }

  // 4. Unique global occurrence check
  const firstIdx = docText.indexOf(targetText);
  if (firstIdx !== -1) {
    const secondIdx = docText.indexOf(targetText, firstIdx + 1);
    if (secondIdx === -1) {
      // Exactly one occurrence in the entire text stream: safe to anchor!
      return { start: firstIdx, end: firstIdx + targetLen };
    }
  }

  // Unresolvable: safely return null to avoid placing highlight on incorrect words
  return null;
}

/**
 * Merges a new or updated highlight into a list of existing highlights deterministically.
 * Rules:
 * - If new highlight completely covers an existing highlight: replaces it.
 * - If new highlight is inside an existing highlight with same color: no change.
 * - If new highlight is inside an existing highlight with different color: splits existing into
 *   non-overlapping segments [before, new, after].
 * - If partial overlap: trims existing highlight so they never overlap.
 * - Guarantees non-overlapping, strictly ordered annotations.
 */
export function mergeAndSegmentHighlights(existingHighlights = [], newHl) {
  if (!newHl || typeof newHl.startOffset !== 'number' || typeof newHl.endOffset !== 'number') {
    return existingHighlights || [];
  }

  const nStart = newHl.startOffset;
  const nEnd = newHl.endOffset;
  const nColor = newHl.colorKey || getHighlightColorKey(newHl.color);

  const result = [];

  for (const ex of existingHighlights) {
    // If same ID, it's being updated/replaced directly
    if (ex.id === newHl.id) continue;

    const eStart = ex.startOffset;
    const eEnd = ex.endOffset;

    // No overlap
    if (eEnd <= nStart || eStart >= nEnd) {
      result.push(ex);
      continue;
    }

    // New completely covers existing -> existing is consumed
    if (nStart <= eStart && nEnd >= eEnd) {
      continue;
    }

    // Existing completely covers new
    if (eStart < nStart && eEnd > nEnd) {
      const exColor = ex.colorKey || getHighlightColorKey(ex.color);
      if (exColor === nColor) {
        // Same color: keep existing, it already highlights this range
        return existingHighlights;
      }
      // Different color: split existing into before and after
      const beforeText = ex.text.slice(0, nStart - eStart);
      const afterText = ex.text.slice(nEnd - eStart);

      if (beforeText.trim()) {
        result.push({
          ...ex,
          id: `${ex.id}-pre`,
          endOffset: nStart,
          text: beforeText,
          suffix: newHl.text.slice(0, 20)
        });
      }
      if (afterText.trim()) {
        result.push({
          ...ex,
          id: `${ex.id}-post`,
          startOffset: nEnd,
          text: afterText,
          prefix: newHl.text.slice(-20)
        });
      }
      continue;
    }

    // Partial overlap at end: eStart < nStart < eEnd <= nEnd
    if (eStart < nStart && eEnd > nStart) {
      const trimmedText = ex.text.slice(0, nStart - eStart);
      if (trimmedText.trim()) {
        result.push({
          ...ex,
          endOffset: nStart,
          text: trimmedText,
          suffix: newHl.text.slice(0, 20)
        });
      }
      continue;
    }

    // Partial overlap at start: nStart <= eStart < nEnd < eEnd
    if (eStart < nEnd && eEnd > nEnd) {
      const trimmedText = ex.text.slice(nEnd - eStart);
      if (trimmedText.trim()) {
        result.push({
          ...ex,
          startOffset: nEnd,
          text: trimmedText,
          prefix: newHl.text.slice(-20)
        });
      }
      continue;
    }
  }

  result.push(newHl);
  return result.sort((a, b) => a.startOffset - b.startOffset);
}

/**
 * Rehype plugin that accurately applies RGB marker highlights across AST text nodes.
 * Works seamlessly across multi-node spans (bold, italic, links), headings, lists,
 * tables, blockquotes, and Indian scripts.
 * Preserves preformatted code blocks (<pre>) intact.
 */
export function rehypeHighlightApplier(options = {}) {
  const highlights = options.highlights || [];

  return (tree) => {
    if (!highlights || highlights.length === 0) return;

    // 1. Gather all eligible text nodes in document order
    const textNodes = [];
    let currentOffset = 0;
    let fullDocText = '';

    function collectTextNodes(node, parent, indexInParent) {
      if (!node) return;

      // Skip code blocks inside <pre>
      if (node.type === 'element' && (node.tagName === 'pre' || (node.tagName === 'code' && parent?.tagName === 'pre'))) {
        return;
      }

      if (node.type === 'text' && typeof node.value === 'string') {
        const val = node.value;
        const len = val.length;
        if (len > 0) {
          textNodes.push({
            node,
            parent,
            indexInParent,
            start: currentOffset,
            end: currentOffset + len,
            value: val
          });
          fullDocText += val;
          currentOffset += len;
        }
        return;
      }

      if (node.children && Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          collectTextNodes(node.children[i], node, i);
        }
      }
    }

    collectTextNodes(tree, null, 0);
    if (textNodes.length === 0 || !fullDocText) return;

    // 2. Resolve highlights to exact non-overlapping intervals in fullDocText
    const resolvedIntervals = [];

    for (const hl of highlights) {
      if (!hl || !hl.text) continue;
      const resolved = resolveAnnotationRange(fullDocText, hl);
      if (resolved) {
        resolvedIntervals.push({
          start: resolved.start,
          end: resolved.end,
          hl
        });
      }
    }

    if (resolvedIntervals.length === 0) return;

    // Sort intervals by start offset
    resolvedIntervals.sort((a, b) => a.start - b.start);

    // 3. For each text node, apply intersecting highlight intervals
    // Process text nodes in reverse order so parent.children index mutations don't invalidate subsequent nodes
    for (let i = textNodes.length - 1; i >= 0; i--) {
      const item = textNodes[i];
      const { node, parent, start: nodeStart, end: nodeEnd, value: nodeValue } = item;

      // Find intersecting intervals
      const intersecting = [];
      for (const interval of resolvedIntervals) {
        if (Math.max(nodeStart, interval.start) < Math.min(nodeEnd, interval.end)) {
          intersecting.push(interval);
        }
      }

      if (intersecting.length === 0) continue;

      // Segment nodeValue according to intersecting highlight intervals
      const cuts = new Set([0, nodeValue.length]);
      for (const inv of intersecting) {
        const segStart = Math.max(0, inv.start - nodeStart);
        const segEnd = Math.min(nodeValue.length, inv.end - nodeStart);
        cuts.add(segStart);
        cuts.add(segEnd);
      }

      const sortedCuts = Array.from(cuts).sort((a, b) => a - b);
      const newNodes = [];

      for (let c = 0; c < sortedCuts.length - 1; c++) {
        const segStart = sortedCuts[c];
        const segEnd = sortedCuts[c + 1];
        if (segStart >= segEnd) continue;

        const segText = nodeValue.slice(segStart, segEnd);
        const midPoint = nodeStart + (segStart + segEnd) / 2;

        // Check which highlight covers this segment
        const matchingInv = intersecting.find(inv => inv.start <= midPoint && inv.end >= midPoint);

        if (matchingInv) {
          const hl = matchingInv.hl;
          const colorKey = hl.colorKey || getHighlightColorKey(hl.color);
          const rgba = normalizeHighlightColor(hl.color, 0.28);

          newNodes.push({
            type: 'element',
            tagName: 'mark',
            properties: {
              className: ['rgb-marker-highlight'],
              'data-highlight-id': hl.id,
              'data-highlight-color': colorKey,
              style: `background-color: ${rgba};`
            },
            children: [{ type: 'text', value: segText }]
          });
        } else {
          newNodes.push({
            type: 'text',
            value: segText
          });
        }
      }

      // Replace original text node with segmented nodes in parent
      if (parent && Array.isArray(parent.children)) {
        const idx = parent.children.indexOf(node);
        if (idx !== -1) {
          parent.children.splice(idx, 1, ...newNodes);
        }
      }
    }
  };
}
