import { BOOLEAN_KEYS } from "./fields";

// Heading text → boolean field key (controls which sections are visible per client)
const HEADING_TO_FIELD: Record<string, string> = {
  "Getting Started": "Getting_Started",
  "Create an Exchange Rule": "Exchange_Rule",
  "Review Checked Out Documents Report": "Checked_Out_Docs",
  "Review and Prepare for the Desktop Transition Process": "Desktop_Transition",
  "Enabling Auto Discovery on Windows DNS Server": "Auto_Discovery",
  "Upgrade iManage Work Desktop for Windows to v10.10": "Upgrading_imWork",
  "Configure Adobe Acrobat for iManage Integration": "Acrobat",
  "Prepare for iManage Workspace Generation": "Workspace_Gen",
  "Create SAML Applications for iManage Share": "SAML_Share",
  "Create a SAML SSO application for iManage Work": "SAML_Work",
  "Create a SAML SCIM application for iManage Work": "SCIM",
  "Install and Configure iManage Drive": "Drive",
  "Conduct User Acceptance Testing (UAT)": "UAT",
  "Install iManage Work for iPad and iPhone": "iOS_Mobility",
  "Install the iManage File Transfer Extension": "File_Transfer",
  "Go Live Issues to Anticipate": "Go_Live",
  "Installing and Configuring Litera Compare v11.x": "Litera_Compare",
  "Installing and Integrating Tungsten Power PDF": "Power_PDF",
  "Integrating Foxit PDF Editor": "Foxit_PDF",
  "Installing iManage Reporting Tool": "reporting_tool",
};

// ── Merge-code conversion ──────────────────────────────────────────────────
// Graph preserves «field» text as-is. Strip any wrapping span/strong tags
// that Word may have applied to the guillemets before matching.

function convertMergeCodes(html: string): string {
  // Unwrap spans/strong around guillemets so the regex can match across them
  html = html.replace(/<(?:span|strong)[^>]*>(«|»)<\/(?:span|strong)>/g, "$1");
  // Convert «field» → {{field}}
  html = html.replace(/«(?:<[^>]+>)?([^»<]+?)(?:<\/[^>]+>)?»/g, (_, key: string) =>
    `{{${key.trim()}}}`
  );
  html = html.replace(/«([^»]+)»/g, (_, key: string) => `{{${key.trim()}}}`);
  return html;
}

// ── Checkbox normalisation ─────────────────────────────────────────────────
// Graph may render Word checkboxes as ☐ (U+2610) text characters instead of
// <input> elements. Convert them so the downstream pipeline works uniformly.

function normalizeCheckboxes(html: string): string {
  // Replace bare ☐/☑ characters inside block elements with an <input> tag
  return html.replace(
    /(<(?:p|li)[^>]*>)((?:<[^>]+>)*)([☐☑])((?:<\/[^>]+>)*)/g,
    (_, open: string, inner: string, _char: string, close: string) =>
      `${open}${inner}<input type="checkbox" />${close}`
  );
}

// ── Block parsing ──────────────────────────────────────────────────────────

function parseBlocks(html: string): string[] {
  const blocks: string[] = [];
  const pattern =
    /(<(?:h[1-4]|p|ul|ol|table|div)[^>]*>[\s\S]*?<\/(?:h[1-4]|p|ul|ol|table|div)>)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match.index > last) blocks.push(html.slice(last, match.index));
    blocks.push(match[1]);
    last = match.index + match[0].length;
  }
  if (last < html.length) blocks.push(html.slice(last));
  return blocks.filter((b) => b.trim());
}

function headingLevel(block: string): number | null {
  const m = block.match(/^<h([1-4])[\s>]/);
  return m ? parseInt(m[1]) : null;
}

function headingText(block: string): string {
  return block.replace(/<[^>]+>/g, "").trim();
}

// ── "Important" note marking ───────────────────────────────────────────────

function markImportantNotes(html: string): string {
  return html.replace(
    /<p([^>]*)>((?:\s*<(?:strong|em|b|span)[^>]*>\s*)?Important\s*:)/gi,
    (_, attrs: string, prefix: string) => {
      if (attrs.includes("note-important")) return `<p${attrs}>${prefix}`;
      const newAttrs = /class="[^"]*"/.test(attrs)
        ? attrs.replace(/class="([^"]*)"/, 'class="$1 note-important"')
        : `${attrs} class="note-important"`;
      return `<p${newAttrs}>${prefix}`;
    }
  );
}

// ── Callout detection ──────────────────────────────────────────────────────
// Graph HTML uses Word-generated class names we don't control. Detect callout
// items broadly: blocks that contain a checkbox, are list items, or carry the
// class names we know from the mammoth pipeline (retained for compatibility if
// a mammoth-processed template is ever re-uploaded).

function isCalloutItem(block: string): boolean {
  if (
    block.includes('class="callout-it"') ||
    block.includes('class="task-checkbox"') ||
    block.includes('class="task-checkbox-indent"')
  )
    return true;
  if (block.includes('<input type="checkbox"')) return true;
  if (block.includes("☐") || block.includes("☑")) return true;
  // Microsoft list paragraphs (MsoListParagraph*) after an IT Tasks heading
  if (/class="[^"]*MsoList[^"]*"/.test(block)) return true;
  return false;
}

// Extract all cell content from a table block (Word uses layout-tables).
function flattenTableBlock(tableHtml: string): string {
  const parts: string[] = [];
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(tableHtml)) !== null) {
    const content = m[1].trim();
    if (content) parts.push(content);
  }
  return parts.join("\n");
}

// ── IT Tasks callout boxes ─────────────────────────────────────────────────

function wrapITTaskBoxes(blocks: string[]): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const text = headingText(block);

    if (/^\s*(IT Tasks|Initial Setup Tasks)\s*$/.test(text)) {
      const boxItems: string[] = [];
      i++;

      // Skip any duplicate "IT Tasks" label that isn't a callout item itself
      if (
        i < blocks.length &&
        !isCalloutItem(blocks[i]) &&
        /\bIT\s+Tasks\b/.test(headingText(blocks[i]))
      ) {
        i++;
      }

      // Collect items until the next heading
      while (i < blocks.length && isCalloutItem(blocks[i])) {
        const b = blocks[i++];
        boxItems.push(b.startsWith("<table") ? flattenTableBlock(b) : b);
      }

      if (boxItems.length > 0) {
        output.push(
          `<div class="callout-it-box">` +
            `<div class="callout-it-header">{{firm_company_nickname}} ${text.trim()}</div>` +
            boxItems.join("") +
            `</div>`
        );
      }
      continue;
    }

    // Standalone callout-it paragraphs not preceded by an IT Tasks heading
    if (isCalloutItem(block) && block.includes('class="callout-it"')) {
      const boxItems: string[] = [
        block.startsWith("<table") ? flattenTableBlock(block) : block,
      ];
      i++;
      while (i < blocks.length && isCalloutItem(blocks[i])) {
        const b = blocks[i++];
        boxItems.push(b.startsWith("<table") ? flattenTableBlock(b) : b);
      }
      output.push(
        `<div class="callout-it-box">` +
          `<div class="callout-it-header">{{firm_company_nickname}} IT Tasks</div>` +
          boxItems.join("") +
          `</div>`
      );
      continue;
    }

    output.push(block);
    i++;
  }

  return output;
}

// ── Helpful Insights callout boxes ────────────────────────────────────────

function wrapHelpfulInsights(blocks: string[]): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (headingText(block) === "Helpful Insights") {
      const content: string[] = [];
      i++;
      while (i < blocks.length) {
        const b = blocks[i];
        if (b.match(/^<(?:p|ul|ol|table)[> ]/)) {
          content.push(b.startsWith("<table") ? flattenTableBlock(b) : b);
          i++;
        } else {
          break;
        }
      }
      output.push(
        `<div class="callout-info">` +
          `<div class="callout-info-header">Helpful Insights</div>` +
          content.join("") +
          `</div>`
      );
      continue;
    }

    output.push(block);
    i++;
  }

  return output;
}

// ── Section wrapping + task ID stamping ───────────────────────────────────

function wrapSections(blocks: string[]): string {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const level = headingLevel(block);

    if (level !== null) {
      const text = headingText(block);
      const fieldKey = HEADING_TO_FIELD[text];

      if (fieldKey && BOOLEAN_KEYS.has(fieldKey)) {
        const section: string[] = [block];
        i++;
        let taskNum = 0;

        while (i < blocks.length) {
          const nextLevel = headingLevel(blocks[i]);
          if (nextLevel !== null && nextLevel <= level) break;

          const stamped = blocks[i].replace(/<input type="checkbox" \/>/g, () => {
            taskNum++;
            return `<input type="checkbox" data-task-id="${fieldKey}-task-${taskNum}" data-section="${fieldKey}" />`;
          });
          section.push(stamped);
          i++;
        }

        const encodedTitle = text.replace(/"/g, "&quot;");
        output.push(
          `<div data-section="${fieldKey}" data-section-title="${encodedTitle}" data-total-tasks="${taskNum}">` +
            section.join("") +
            `</div>`
        );
        continue;
      }
    }

    output.push(block);
    i++;
  }

  return output.join("");
}

// ── Nested list cleanup ────────────────────────────────────────────────────

function cleanupNestedLists(html: string): string {
  return html.replace(
    /<ul><li>(<ol>[\s\S]*?<\/ol>)<\/li><\/ul>/g,
    "$1"
  );
}

// ── TOC removal ───────────────────────────────────────────────────────────

function stripTOC(html: string): string {
  html = html.replace(
    /<h[1-4][^>]*>(?:\s*<[^>]*>\s*)*\s*Table of Contents\s*(?:\s*<\/[^>]*>\s*)*<\/h[1-4]>/gi,
    ""
  );
  html = html.replace(/<p class="toc-[123]"[^>]*>[\s\S]*?<\/p>/g, "");
  // Graph may wrap the TOC in a nav or div with a Word-generated id
  html = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  return html;
}

// ── Microsoft Word style classes → CIIM classes ───────────────────────────
// Graph renders Word paragraph styles as Word-generated class names (e.g.
// MsoNormal). Map the ones we care about to our own CIIM CSS classes so the
// existing ciim-manual.css rules apply.
//
// NOTE: The exact class names depend on the Word document styles. This list
// will be refined after testing the first converted template.

function mapWordClasses(html: string): string {
  return (
    html
      // Cover title
      .replace(/\bMsoTitle\b/g, "cover-title")
      // Code / fixed-font paragraphs
      .replace(/\bMsoCode\b/g, "fixed-font")
      // TOC entries (strip at source, but map just in case)
      .replace(/\bMsoToc1\b/g, "toc-1")
      .replace(/\bMsoToc2\b/g, "toc-2")
      .replace(/\bMsoToc3\b/g, "toc-3")
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function processHtml(rawHtml: string): string {
  let html = rawHtml;

  // 1. Merge codes
  html = convertMergeCodes(html);

  // 2. Normalise ☐/☑ checkbox characters → <input type="checkbox">
  html = normalizeCheckboxes(html);

  // 3. Map Word class names → CIIM class names
  html = mapWordClasses(html);

  // 4. Important-note highlighting
  html = markImportantNotes(html);

  // 5. Block-level pipeline
  let blocks = parseBlocks(html);
  blocks = wrapITTaskBoxes(blocks);
  blocks = wrapHelpfulInsights(blocks);
  html = wrapSections(blocks);

  // 6. Structural cleanup
  html = cleanupNestedLists(html);
  html = stripTOC(html);

  return html;
}
