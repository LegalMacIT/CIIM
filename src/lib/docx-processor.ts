import mammoth from "mammoth";
import { BOOLEAN_KEYS } from "./fields";

// Heading text → boolean field key
const HEADING_TO_FIELD: Record<string, string> = {
  "Getting Started": "Getting_Started",
  "Create an Exchange Rule": "Exchange_Rule",
  "Review Checked Out Documents Report": "Checked_Out_Docs",
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

// ── Color preservation ──────────────────────────────────────────────────────
// Maps lower-cased Word hex colors (no #) to CSS class names used in style map below.
// Covers the standard Office color wheel + common CARM/professional document colors.
const WORD_COLOR_MAP: Record<string, string> = {
  "c00000": "wc-c00000", // Dark Red — warnings, important notes
  "ff0000": "wc-ff0000", // Red
  "9c0006": "wc-c00000", // Office "Bad" red — alias to same class
  "e26b0a": "wc-e26b0a", // Dark Orange
  "c55a11": "wc-c55a11", // CARM brand orange
  "ed7d31": "wc-ed7d31", // Office orange
  "ffc000": "wc-ffc000", // Amber/Gold
  "ff7200": "wc-e26b0a", // Orange alias
  "0070c0": "wc-0070c0", // Standard blue
  "4472c4": "wc-4472c4", // Office theme blue
  "2f75b6": "wc-0070c0", // Blue alias
  "00b0f0": "wc-00b0f0", // Light blue
  "17375e": "wc-17375e", // Navy
  "1f3864": "wc-17375e", // Dark navy alias
  "00b050": "wc-00b050", // Green
  "70ad47": "wc-70ad47", // Office light green
  "548235": "wc-548235", // Dark green
  "7030a0": "wc-7030a0", // Purple
  "8b4726": "wc-8b4726", // Dark brown/rust
  "595959": "wc-595959", // Dark gray
  "808080": "wc-595959", // Gray alias
  "404040": "wc-404040", // Charcoal
};

// Style map entries generated from the color map (appended to mammoth styleMap)
const COLOR_STYLE_MAP = Array.from(
  new Set(Object.values(WORD_COLOR_MAP))
).map((cls) => `r[style-name='${cls}'] => span.${cls}:fresh`);

// Transform: tag runs that have a Word colour with the mapped CSS class name as their styleName.
// This runs before the styleMap is applied, so the styleMap entries above will match.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mammothTransforms = (mammoth as any).transforms;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildColorTransform(): ((doc: any) => any) | undefined {
  if (!mammothTransforms?.run) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mammothTransforms.run((run: any) => {
    const col: string | undefined = run.colour; // British spelling in mammoth
    if (col && col !== "auto" && col.toLowerCase() !== "000000" && !run.styleName) {
      const key = col.toLowerCase();
      const cls = WORD_COLOR_MAP[key];
      if (cls) return { ...run, styleName: cls };
    }
    return run;
  });
}

// ── Block parsing ──────────────────────────────────────────────────────────

function parseBlocks(html: string): string[] {
  const blocks: string[] = [];
  const pattern = /(<(?:h[1-4]|p|ul|ol|table)[^>]*>[\s\S]*?<\/(?:h[1-4]|p|ul|ol|table)>)/g;
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
  const m = block.match(/^<h([1-4])/);
  return m ? parseInt(m[1]) : null;
}

function headingText(block: string): string {
  return block.replace(/<[^>]+>/g, "").trim();
}

// ── "Important" note marking ───────────────────────────────────────────────
// Detects paragraphs that start with "Important" (with or without bold markup)
// and injects the class "note-important" for CSS icon + highlight treatment.

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

// ── Callout: orange IT Task boxes ──────────────────────────────────────────

function isCalloutItem(block: string): boolean {
  return (
    block.includes('class="callout-it"') ||
    block.includes('class="task-checkbox"') ||
    block.includes('class="task-checkbox-indent"')
  );
}

function wrapITTaskBoxes(blocks: string[]): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const text = headingText(block);

    if (/^\s*(IT Tasks|Initial Setup Tasks)\s*$/.test(text)) {
      const boxItems: string[] = [];
      i++;
      // Skip any intermediate "IT Tasks" label paragraph (e.g. from a text-box anchor)
      // that is not itself a callout item
      if (
        i < blocks.length &&
        !isCalloutItem(blocks[i]) &&
        /\bIT\s+Tasks\b/.test(headingText(blocks[i]))
      ) {
        i++;
      }
      while (i < blocks.length && isCalloutItem(blocks[i])) {
        boxItems.push(blocks[i++]);
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

    if (block.includes('class="callout-it"')) {
      const boxItems: string[] = [block];
      i++;
      while (i < blocks.length && isCalloutItem(blocks[i])) {
        boxItems.push(blocks[i++]);
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

// ── Callout: blue Helpful Insights boxes ──────────────────────────────────

function wrapHelpfulInsights(blocks: string[]): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const text = headingText(block);

    if (text === "Helpful Insights") {
      const content: string[] = [];
      i++;
      while (i < blocks.length) {
        const b = blocks[i];
        if (b.match(/^<(?:p|ul|ol)[> ]/)) {
          content.push(b);
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

// ── Section wrapping + task ID assignment ─────────────────────────────────

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
// mammoth sometimes wraps <ol> items in <ul><li>…</li></ul> when Word uses
// ListParagraph style for numbered content. Unwrap those spurious bullet shells.

function cleanupNestedLists(html: string): string {
  // <ul><li><ol>…</ol></li></ul>  →  <ol>…</ol>
  return html.replace(/<ul><li>(<ol>[\s\S]*?<\/ol>)<\/li><\/ul>/g, "$1");
}

// ── TOC removal ───────────────────────────────────────────────────────────

function stripTOC(html: string): string {
  // Remove the "Table of Contents" heading (any h1-h4, with optional inline markup)
  html = html.replace(
    /<h[1-4][^>]*>(?:\s*<[^>]*>\s*)*\s*Table of Contents\s*(?:\s*<\/[^>]*>\s*)*<\/h[1-4]>/gi,
    ""
  );
  // Remove all TOC entry paragraphs (toc-1, toc-2, toc-3)
  html = html.replace(/<p class="toc-[123]"[^>]*>[\s\S]*?<\/p>/g, "");
  return html;
}

// ── Main export ────────────────────────────────────────────────────────────

export async function processDocx(buffer: Buffer | ArrayBuffer): Promise<string> {
  const input = Buffer.isBuffer(buffer) ? { buffer } : { arrayBuffer: buffer };
  const colorTransform = buildColorTransform();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    styleMap: [
      "p[style-name='Title'] => p.cover-title:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Hang indent checkbox'] => p.task-checkbox:fresh",
      "p[style-name='Indent checkbox'] => p.task-checkbox-indent:fresh",
      "p[style-name='First CARM IT task'] => p.callout-it:fresh",
      "p[style-name='ALL_CAPS'] => p.code-line:fresh",
      "r[style-name='Copy_contents'] => span.copy-contents:fresh",
      "p[style-name='TOC 1'] => p.toc-1:fresh",
      "p[style-name='TOC 2'] => p.toc-2:fresh",
      "p[style-name='TOC 3'] => p.toc-3:fresh",
      ...COLOR_STYLE_MAP,
    ],
  };
  if (colorTransform) options.transformDocument = colorTransform;

  const { value: rawHtml } = await mammoth.convertToHtml(input, options);

  // Replace Word merge field markers «field» → {{field}}
  let html = rawHtml.replace(/«([^»]+)»/g, (_, key: string) => `{{${key.trim()}}}`);

  // Post-processing pipeline
  html = markImportantNotes(html);
  let blocks = parseBlocks(html);
  blocks = wrapITTaskBoxes(blocks);
  blocks = wrapHelpfulInsights(blocks);
  html = wrapSections(blocks);
  html = cleanupNestedLists(html);
  html = stripTOC(html);

  return html;
}
