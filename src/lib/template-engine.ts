import { CREDENTIAL_KEYS } from "./fields";

// Fields whose values are URLs — rendered as clickable anchor tags
const URL_KEYS = new Set(["link_teams_channel", "cim_url", "work_url"]);

export interface ManualSection {
  key: string;
  title: string;
  totalTasks: number;
  isEnabled: boolean;
  html: string;
}

export interface ManualParts {
  coverHtml: string;      // Cover page through "Proprietary and Confidential"
  preambleHtml: string;   // TOC, Important Links, etc. (after cover)
  sections: ManualSection[];
}

// Convert bare https:// URLs in text nodes to anchor tags, skipping content already inside <a>
function linkifyBareUrls(html: string): string {
  const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;
  const parts = html.split(/(<a[\s>][\s\S]*?<\/a>|<[^>]+>)/);
  return parts
    .map((part, i) => {
      // Odd-indexed parts are tags or existing <a> elements — leave them alone
      if (i % 2 === 1) return part;
      // Even-indexed parts are text nodes — linkify bare URLs
      return part.replace(URL_RE, (url) => {
        // Strip trailing punctuation that's unlikely to be part of the URL
        const stripped = url.replace(/[.,;:!?]$/, "");
        const tail = url.slice(stripped.length);
        return `<a href="${stripped}" target="_blank" rel="noopener noreferrer">${stripped}</a>${tail}`;
      });
    })
    .join("");
}

/**
 * Merges customer form values into the HTML template string.
 * - {{field_key}} → customer value (credential fields → empty string)
 * - data-section="FieldKey" divs are hidden when the field value is not "x"
 * - All bare URLs in the resulting HTML are linkified
 */
export function mergeTemplate(html: string, values: Record<string, string>): string {
  let result = html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (CREDENTIAL_KEYS.has(key)) return "";
    const val = values[key];
    if (val === undefined || val === "") return `<span class="ciim-missing">[${key} not set]</span>`;
    if (URL_KEYS.has(key) && /^https?:\/\//.test(val)) {
      return `<a href="${val}" target="_blank" rel="noopener noreferrer">${val}</a>`;
    }
    return val;
  });

  result = result.replace(
    /(<[^>]+data-section="([^"]+)"[^>]*>)/g,
    (match, openTag: string, fieldKey: string) => {
      const isEnabled = values[fieldKey] === "x";
      if (!isEnabled) return openTag.replace(/>$/, ` style="display:none">`);
      return openTag;
    }
  );

  return linkifyBareUrls(result);
}

/**
 * Splits the merged HTML into:
 *   coverHtml   — everything up to and including the "Proprietary and Confidential" paragraph
 *   preambleHtml — TOC, Important Links, and any remaining pre-section content
 *   sections    — one entry per <div data-section="X"> wrapper
 */
export function splitManual(mergedHtml: string): ManualParts {
  let remaining = mergedHtml;
  let rawPreamble = "";
  const sections: ManualSection[] = [];

  const sectionStartRe = /<div data-section="([^"]+)"([^>]*)>/;

  while (remaining.length > 0) {
    const m = sectionStartRe.exec(remaining);
    if (!m) {
      if (sections.length === 0) rawPreamble = remaining;
      break;
    }

    if (sections.length === 0 && m.index > 0) {
      rawPreamble = remaining.slice(0, m.index);
    }

    const sectionKey = m[1];
    const attrs = m[2];

    const titleMatch = attrs.match(/data-section-title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1].replace(/&quot;/g, '"') : sectionKey;

    const tasksMatch = attrs.match(/data-total-tasks="(\d+)"/);
    const totalTasks = tasksMatch ? parseInt(tasksMatch[1]) : 0;

    const styleMatch = attrs.match(/style="([^"]*)"/);
    const isEnabled = !styleMatch || !styleMatch[1].includes("display:none");

    // Find matching </div> using depth-counting (handles nested divs in callout boxes)
    const contentStart = m.index + m[0].length;
    let depth = 1;
    let pos = contentStart;
    let sectionHtml = "";
    let sectionEnd = -1;

    while (pos < remaining.length && depth > 0) {
      const nextOpen = remaining.indexOf("<div", pos);
      const nextClose = remaining.indexOf("</div>", pos);

      if (nextClose < 0) break;

      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          sectionHtml = remaining.slice(contentStart, nextClose);
          sectionEnd = nextClose + 6;
        } else {
          pos = nextClose + 6;
        }
      }
    }

    if (sectionEnd >= 0) {
      sections.push({ key: sectionKey, title, totalTasks, isEnabled, html: sectionHtml });
      remaining = remaining.slice(sectionEnd);
    } else {
      break;
    }
  }

  // Split the preamble at "Proprietary and Confidential" to separate the cover page
  let coverHtml = "";
  let preambleHtml = rawPreamble;

  const confRe = /[Pp]roprietary and [Cc]onfidential/;
  const confIdx = rawPreamble.search(confRe);
  if (confIdx >= 0) {
    // Find the closing tag of the paragraph containing this text
    const closeP = rawPreamble.indexOf("</p>", confIdx);
    if (closeP >= 0) {
      coverHtml = rawPreamble.slice(0, closeP + 4);
      preambleHtml = rawPreamble.slice(closeP + 4);
    }
  }

  return { coverHtml, preambleHtml, sections };
}
