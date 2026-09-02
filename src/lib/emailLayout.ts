/*
 * ── The shared Playing Next email layout ──────────────────────────
 *
 * The minimum that ROADMAP §7 needs and no more. It gives every
 * lifecycle email one branded shell, one type scale, one button, and a
 * plain-text alternative built from the same content rather than
 * written twice.
 *
 * What this is deliberately not: a rebuild of the QR box emails, a port
 * of the three Supabase Auth templates, or a component system. Those are
 * still §7's, and folding them in here would turn a two-email feature
 * into an email platform.
 *
 * Why the markup looks like 2005
 * ------------------------------
 * Because email clients do. Outlook renders through Word, Gmail strips
 * <style> blocks in several contexts and removes classes, and no client
 * can be relied on for flexbox, grid, or a web font. So: presentation
 * tables, every declaration inline, widths in pixels, and a system font
 * stack. Nothing here should be copied into the product UI, and nothing
 * from the product UI should be copied into here.
 *
 * Dark by choice, with the auto-inverters told to leave it alone
 * ---------------------------------------------------------------
 * Playing Next is a dark product for people working in dark rooms, and
 * the design Elliot approved is dark. The risk with a dark email is a
 * client that "helpfully" inverts it and lands light text on a light
 * ground, so: the color-scheme meta tags declare the email handles both
 * itself, every single cell carries an explicit bgcolor rather than
 * inheriting, and no text colour depends on a background staying dark by
 * default. A client that ignores all of that still gets legible type on
 * an explicit ground.
 */

const ACCENT = "#4ade80";
const ACCENT_INK = "#06210f";
const CANVAS = "#08090a";
const SURFACE = "#111417";
const HAIRLINE = "#23272b";
const TEXT = "#f4f4f5";
/*
 * Raised on 2026-09-02 after reading the first test on an iPhone. The
 * previous pair (#9a9aa2 and #6c6e76) measured about 5.1:1 and 3.3:1
 * against the card, and the second of those is below the 4.5:1 floor for
 * body text. A phone held at arm's length in a dark room is the actual
 * reading condition here, so secondary text now clears the floor with
 * room to spare and the hierarchy is carried by weight and size instead
 * of by making the quiet text quieter.
 */
const MUTED = "#b4b5bc";
const DIM = "#8e9098";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type StepState = "done" | "todo" | "future";

export type EmailStep = {
  state: StepState;
  /** The number shown for a `todo` step. Ignored otherwise. */
  index?: number;
  label: string;
  detail?: string;
};

export type EmailContent = {
  /** Inbox preview line. Never repeat the subject here. */
  preheader: string;
  heading: string;
  intro: string;
  steps: EmailStep[];
  ctaLabel: string;
  ctaHref: string;
  /** Small reassurance under the button. Never a time estimate. */
  ctaNote?: string;
  payoffTitle: string;
  payoffBody: string;
  /** Why this email arrived, and what happens next. */
  footerReason: string;
  unsubscribeHref: string;
};

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/*
 * A tick, a number, or a dot, drawn as a table cell rather than an
 * image. Images are blocked by default in most clients, and a progress
 * indicator that disappears when images are off is worse than none.
 */
function marker(step: EmailStep): string {
  if (step.state === "done") {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="24" height="24" align="center" valign="middle" bgcolor="${ACCENT}"
          style="width:24px;height:24px;background-color:${ACCENT};border-radius:12px;
                 font-family:${FONT};font-size:13px;font-weight:700;color:${ACCENT_INK};
                 line-height:24px;">&#10003;</td></tr></table>`;
  }

  if (step.state === "todo") {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="24" height="24" align="center" valign="middle" bgcolor="${SURFACE}"
          style="width:24px;height:24px;background-color:${SURFACE};border-radius:12px;
                 border:2px solid ${ACCENT};font-family:${FONT};font-size:12px;
                 font-weight:700;color:${ACCENT};line-height:20px;">${step.index ?? ""}</td>
      </tr></table>`;
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="24" height="24" align="center" valign="middle" bgcolor="${SURFACE}"
        style="width:24px;height:24px;background-color:${SURFACE};border-radius:12px;
               font-family:${FONT};font-size:13px;color:${DIM};line-height:24px;">&bull;</td>
    </tr></table>`;
}

function stepRow(step: EmailStep, isLast: boolean): string {
  const labelColour = step.state === "todo" ? TEXT : MUTED;
  const labelWeight = step.state === "todo" ? "600" : "500";
  const border = isLast ? "none" : `1px solid ${HAIRLINE}`;

  return `<tr>
    <td valign="top" width="24"
        style="padding:13px 13px 13px 0;border-bottom:${border};">${marker(step)}</td>
    <td valign="top" style="padding:13px 0;border-bottom:${border};">
      <div style="font-family:${FONT};font-size:15px;line-height:20px;
                  font-weight:${labelWeight};color:${labelColour};">${escape(step.label)}</div>
      ${
        step.detail
          ? `<div style="font-family:${FONT};font-size:13px;line-height:18px;color:${DIM};
                         padding-top:3px;">${escape(step.detail)}</div>`
          : ""
      }
    </td>
  </tr>`;
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const steps = content.steps
    .map((step, i) => stepRow(step, i === content.steps.length - 1))
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escape(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
<div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escape(
    content.preheader
  )}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       bgcolor="${CANVAS}" style="background-color:${CANVAS};margin:0;padding:0;">
<tr><td align="center" style="padding:24px 12px 40px 12px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="max-width:480px;width:100%;">

    <tr><td style="padding:4px 8px 18px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="8" height="8" bgcolor="${ACCENT}"
                style="width:8px;height:8px;background-color:${ACCENT};border-radius:4px;
                       font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
        <td valign="middle" style="font-family:${FONT};font-size:11px;letter-spacing:2px;
            text-transform:uppercase;color:${MUTED};font-weight:600;">Playing Next</td>
      </tr></table>
    </td></tr>

    <tr><td bgcolor="${SURFACE}"
        style="background-color:${SURFACE};border-radius:14px;padding:28px 24px;">

      <div style="font-family:${FONT};font-size:24px;line-height:30px;font-weight:700;
                  color:${TEXT};margin:0 0 12px 0;">${escape(content.heading)}</div>

      <div style="font-family:${FONT};font-size:15px;line-height:22px;color:${MUTED};
                  margin:0 0 4px 0;">${escape(content.intro)}</div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="width:100%;margin-top:18px;border-top:1px solid ${HAIRLINE};">
        ${steps}
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="width:100%;margin-top:24px;">
        <tr><td align="center" bgcolor="${ACCENT}"
            style="background-color:${ACCENT};border-radius:9px;">
          <a href="${escape(content.ctaHref)}"
             style="display:block;padding:14px 20px;font-family:${FONT};font-size:15px;
                    font-weight:700;color:${ACCENT_INK};text-decoration:none;">${escape(
    content.ctaLabel
  )}</a>
        </td></tr>
      </table>

      ${
        content.ctaNote
          ? `<div style="font-family:${FONT};font-size:12px;line-height:16px;color:${DIM};
                         text-align:center;padding-top:10px;">${escape(content.ctaNote)}</div>`
          : ""
      }

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="width:100%;margin-top:24px;">
        <tr><td bgcolor="${CANVAS}"
            style="background-color:${CANVAS};border-radius:10px;padding:16px 17px;
                   border:1px solid ${HAIRLINE};">
          <div style="font-family:${FONT};font-size:10px;letter-spacing:1.4px;
                      text-transform:uppercase;color:${ACCENT};font-weight:700;
                      padding-bottom:7px;">${escape(content.payoffTitle)}</div>
          <div style="font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED};">${escape(
    content.payoffBody
  )}</div>
        </td></tr>
      </table>

    </td></tr>

    <tr><td style="padding:12px 12px 0 12px;">
      <div style="font-family:${FONT};font-size:11px;line-height:17px;color:${DIM};">
        ${escape(content.footerReason)}
        <a href="${escape(content.unsubscribeHref)}"
           style="color:${MUTED};text-decoration:underline;">Stop setup reminders</a>.
      </div>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  /*
   * The plain-text alternative is built from the same content object, so
   * it cannot drift from the HTML the way a separately written version
   * always eventually does. Some people read in plain text by choice,
   * some clients render it, and a missing text part is a spam signal.
   */
  const textSteps = content.steps
    .map((step) => {
      const bullet =
        step.state === "done" ? "[x]" : step.state === "todo" ? `[${step.index ?? " "}]` : " - ";
      return `${bullet} ${step.label}${step.detail ? `\n      ${step.detail}` : ""}`;
    })
    .join("\n");

  const text = `PLAYING NEXT

${content.heading}

${content.intro}

${textSteps}

${content.ctaLabel}: ${content.ctaHref}
${content.ctaNote ? `${content.ctaNote}\n` : ""}
${content.payoffTitle.toUpperCase()}
${content.payoffBody}

--
${content.footerReason}
Stop setup reminders: ${content.unsubscribeHref}
`;

  return { html, text };
}
