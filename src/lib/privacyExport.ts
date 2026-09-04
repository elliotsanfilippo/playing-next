import PDFDocument from "pdfkit";

/*
 * ── The data-subject export, built once and rendered twice ────────
 *
 * One snapshot in, two artefacts out. The JSON and the PDF are rendered
 * from the same `ExportSnapshot` object, so they cannot disagree about
 * what we hold: there is no second query, no second shaping step, and no
 * path where one is refreshed and the other is not.
 *
 * Everything here is pure apart from the PDF buffer it returns. No
 * database, no network, no Stripe call, no clock of its own - the caller
 * passes `generatedAt` so both artefacts carry the identical instant.
 */

export const SCHEMA_VERSION = "1.0";
export const GENERATOR = "playing-next-privacy-export";
export const GENERATOR_VERSION = "1.0.0";

export const EXPORT_FORMATS = ["pdf", "json"] as const;

/*
 * The three statements, written once and used verbatim in both
 * artefacts. They are constants rather than prose typed into a renderer
 * because their exact wording was decided deliberately and a paraphrase
 * would quietly change what we are telling a person about their data.
 */
export const WORDING = {
  /* Replaces an earlier draft that said we hold nothing personal about
     guests. That was wrong: a free-text message may contain anything. */
  holdings:
    "Playing Next does not maintain a guest account or store a guest email " +
    "address or dedicated guest name field. Information entered into a " +
    "request, such as a message, may still contain personal information.",

  /* Goes directly under the PDF title, not in a closing section. A
     reader who stops after the first page must still know what this
     document is and is not. */
  scope:
    "This export covers only Playing Next records for which ownership was " +
    "verified as part of this request. It is not a complete export of " +
    "information held by other services, including Stripe.",

  /* States what we do and do not receive. It deliberately does NOT
     characterise Stripe's legal role, which is for the solicitor. */
  stripe:
    "Playing Next does not receive or store your email address, cardholder " +
    "name or payment details. Stripe collects those directly. Stripe also " +
    "holds the payment and refund transaction records.",

  /* The 90-day rule is decided and built, so it can be stated. The
     financial period is NOT decided, and naming one here would publish
     an invented policy. */
  retention:
    "Free-text messages are cleared 90 days after the request was created. " +
    "Records that carry payment information are kept for as long as legal " +
    "and accounting obligations require.",

  purposes:
    "We use this information to pass your request to the DJ, to take and " +
    "settle the payment, and to keep the financial records a business is " +
    "required to keep.",
} as const;

export const VERIFICATION_WORDING: Record<string, string> = {
  stripe_payment: "a payment shown in Stripe under the address you contacted us from",
  my_requests_link: "a My Requests link you supplied, which contains this record",
  quoted_message: "the wording of your message, which you quoted back to us",
};

export type ExportRecord =
  | {
      type: "song_request";
      id: string;
      created_at: string;
      dj_name: string | null;
      dj_slug: string | null;
      song_title: string | null;
      artist: string | null;
      message: string | null;
      status: string;
      refunded: boolean;
      currency: string | null;
      total_paid: number | null;
      guest_service_fee: number | null;
    }
  | {
      type: "tip";
      id: string;
      created_at: string;
      dj_name: string | null;
      dj_slug: string | null;
      message: string | null;
      status: string;
      refunded: boolean;
      currency: string | null;
      total_paid: number | null;
      guest_service_fee: number | null;
    }
  | {
      type: "not_played_report";
      id: string;
      created_at: string;
      reason: string | null;
      song_request_id: string | null;
      resolution: string | null;
    };

export type ExportSnapshot = {
  requestReference: string | null;
  verificationMethod: string;
  /** One instant, shared by both artefacts. */
  generatedAt: string;
  /** VERCEL_GIT_COMMIT_SHA, so an export is reproducible. */
  appCommit: string | null;
  records: ExportRecord[];
};

const money = (pence: number | null, currency: string | null) => {
  if (pence === null || pence === undefined) return null;
  const symbol = (currency ?? "gbp").toLowerCase() === "gbp" ? "£" : "";
  return `${symbol}${(pence / 100).toFixed(2)}`;
};

/** Earliest and latest record covered. Null when nothing was found. */
export function dataPeriod(records: ExportRecord[]) {
  const dates = records.map((r) => r.created_at).filter(Boolean).sort();

  return {
    earliest_record: dates[0] ?? null,
    latest_record: dates[dates.length - 1] ?? null,
  };
}

/* ── JSON ─────────────────────────────────────────────────────── */

export function buildExportJson(snapshot: ExportSnapshot) {
  const period = dataPeriod(snapshot.records);

  const requests = snapshot.records.filter((r) => r.type === "song_request");
  const tips = snapshot.records.filter((r) => r.type === "tip");
  const reports = snapshot.records.filter((r) => r.type === "not_played_report");

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: snapshot.generatedAt,
    request_reference: snapshot.requestReference,

    versions: {
      schema: SCHEMA_VERSION,
      generator: GENERATOR,
      generator_version: GENERATOR_VERSION,
      app_commit: snapshot.appCommit,
    },

    data_period: {
      ...period,
      generated_as_at: snapshot.generatedAt,
    },

    about_this_export: {
      /*
       * "service", not "controller". Naming ourselves the controller is
       * a legal characterisation, and the decision was to leave those to
       * the solicitor - which applies to our own role as much as to
       * Stripe's. This identifies who produced the document without
       * asserting anything about roles under UK GDPR.
       */
      service: "Playing Next",
      contact: "info@playingnextapp.com",
      identified_by: snapshot.verificationMethod,
      note: WORDING.holdings,
      scope: WORDING.scope,
    },

    not_included: {
      statement: WORDING.stripe,
    },

    purposes_and_retention: {
      purposes: WORDING.purposes,
      retention: WORDING.retention,
    },

    song_requests: requests.map((r) =>
      r.type === "song_request"
        ? {
            id: r.id,
            requested_at: r.created_at,
            dj: { name: r.dj_name, slug: r.dj_slug },
            song: { title: r.song_title, artist: r.artist },
            your_message: r.message,
            status: r.status,
            refunded: r.refunded,
            payment: {
              currency: r.currency,
              total_paid: r.total_paid,
              guest_service_fee: r.guest_service_fee,
            },
          }
        : null
    ),

    tips: tips.map((r) =>
      r.type === "tip"
        ? {
            id: r.id,
            sent_at: r.created_at,
            dj: { name: r.dj_name, slug: r.dj_slug },
            your_message: r.message,
            status: r.status,
            refunded: r.refunded,
            payment: {
              currency: r.currency,
              total_paid: r.total_paid,
              guest_service_fee: r.guest_service_fee,
            },
          }
        : null
    ),

    not_played_reports: reports.map((r) =>
      r.type === "not_played_report"
        ? {
            id: r.id,
            reported_at: r.created_at,
            your_reason: r.reason,
            concerned_request_id: r.song_request_id,
            outcome: r.resolution,
          }
        : null
    ),

    totals: {
      song_requests: requests.length,
      tips: tips.length,
      not_played_reports: reports.length,
    },
  };
}

/* ── PDF ──────────────────────────────────────────────────────── */

const INK = "#141416";
const MUTED = "#5c5e66";
const RULE = "#e2e3e7";
const ACCENT = "#22a45d";
const MARK_BG = "#0d0d0f";

/*
 * The Playing Next mark, drawn rather than embedded.
 *
 * These are the exact coordinates from public/logo.svg on its 120-unit
 * viewBox, scaled. Drawing it avoids shipping a binary asset into a
 * serverless function and avoids any question of whether public/ is
 * available at runtime, and it is the real geometry rather than an
 * approximation of it.
 */
function drawMark(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const u = size / 120;

  doc.save();
  doc.roundedRect(x, y, size, size, 28 * u).fill(MARK_BG);
  doc.circle(x + 26.4 * u, y + 60 * u, 5.4 * u).fill("#5C5A57");
  doc.circle(x + 54 * u, y + 60 * u, 7.8 * u).fill("#A8A5A0");
  doc
    .moveTo(x + 76.8 * u, y + 39.6 * u)
    .lineTo(x + 76.8 * u, y + 80.4 * u)
    .lineTo(x + 104.4 * u, y + 60 * u)
    .fill("#4ADE80");
  doc.restore();
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });

function heading(doc: PDFKit.PDFDocument, text: string) {
  if (doc.y > 690) doc.addPage();
  doc.moveDown(1.1);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9).text(text.toUpperCase(), { characterSpacing: 1.1 });
  doc.moveDown(0.35);
  doc
    .strokeColor(RULE)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.6);
}

function body(doc: PDFKit.PDFDocument, text: string, colour = INK) {
  doc.fillColor(colour).font("Helvetica").fontSize(10).text(text, { lineGap: 2.5 });
}

function field(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(label.toUpperCase(), { characterSpacing: 0.6 });
  doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(value, { lineGap: 2 });
  doc.moveDown(0.45);
}

export function renderExportPdf(
  snapshot: ExportSnapshot,
  /*
   * compress is true in every real call. Tests turn it off so the text
   * is readable in the raw buffer, which is what lets them assert that
   * the PDF and the JSON really did come from one snapshot rather than
   * taking it on trust from the call site.
   */
  options: { compress?: boolean } = {}
): Promise<Buffer> {
  const json = buildExportJson(snapshot);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      compress: options.compress !== false,
      size: "A4",
      margins: { top: 56, bottom: 64, left: 56, right: 56 },
      info: {
        Title: "Your personal data — Playing Next",
        Author: "Playing Next",
        Subject: snapshot.requestReference ?? "Data subject access request",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    /* ── masthead ── */
    drawMark(doc, 56, 52, 22);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text("Playing Next", 86, 58);
    doc.moveDown(1.8);

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(21).text("Your personal data", 56);
    doc.moveDown(0.5);

    /* The scope statement sits here, immediately under the title. */
    doc.fillColor(INK).font("Helvetica-Oblique").fontSize(10).text(WORDING.scope, { lineGap: 2.5 });
    doc.moveDown(0.8);

    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    doc.text(
      [
        snapshot.requestReference ? `Reference ${snapshot.requestReference}` : "No reference supplied",
        `Generated ${fmtDate(snapshot.generatedAt)}`,
        `Schema ${SCHEMA_VERSION}`,
      ].join("   ·   ")
    );

    /* ── what this is ── */
    heading(doc, "What this document is");
    body(
      doc,
      "This is the information Playing Next holds about you in the records " +
        "listed below. It was produced in response to your request."
    );
    doc.moveDown(0.5);
    body(doc, WORDING.holdings, MUTED);

    /* ── identification ── */
    heading(doc, "How we identified you");
    body(
      doc,
      "We confirmed these records were yours using " +
        (VERIFICATION_WORDING[snapshot.verificationMethod] ?? snapshot.verificationMethod) +
        "."
    );

    /* ── the records ── */
    const requests = json.song_requests.filter(Boolean) as NonNullable<
      (typeof json.song_requests)[number]
    >[];
    const tips = json.tips.filter(Boolean) as NonNullable<(typeof json.tips)[number]>[];
    const reports = json.not_played_reports.filter(Boolean) as NonNullable<
      (typeof json.not_played_reports)[number]
    >[];

    heading(doc, `Your song requests (${requests.length})`);

    if (requests.length === 0) {
      body(doc, "We hold no song requests for you.", MUTED);
    } else {
      for (const r of requests) {
        if (doc.y > 640) doc.addPage();
        field(doc, "Requested", fmtDate(r.requested_at));
        field(doc, "DJ", r.dj.name ?? r.dj.slug ?? "Unknown");
        field(doc, "Song", [r.song.title, r.song.artist].filter(Boolean).join(" — ") || "Not recorded");
        field(doc, "Status", r.refunded ? `${r.status} (refunded)` : r.status);
        field(
          doc,
          "You paid",
          money(r.payment.total_paid, r.payment.currency) ?? "Not recorded"
        );
        if (r.payment.guest_service_fee !== null) {
          field(doc, "Of which service fee", money(r.payment.guest_service_fee, r.payment.currency) ?? "");
        }
        field(doc, "Your message", r.your_message ?? "No message was sent with this request");
        doc
          .strokeColor(RULE)
          .lineWidth(0.5)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.7);
      }
    }

    heading(doc, `Your tips (${tips.length})`);
    if (tips.length === 0) {
      body(doc, "We hold no tips for you.", MUTED);
    } else {
      for (const t of tips) {
        if (doc.y > 640) doc.addPage();
        field(doc, "Sent", fmtDate(t.sent_at));
        field(doc, "DJ", t.dj.name ?? t.dj.slug ?? "Unknown");
        field(doc, "Status", t.refunded ? `${t.status} (refunded)` : t.status);
        field(doc, "You paid", money(t.payment.total_paid, t.payment.currency) ?? "Not recorded");
        field(doc, "Your message", t.your_message ?? "No message was sent with this tip");
        doc.moveDown(0.4);
      }
    }

    heading(doc, `Your reports (${reports.length})`);
    if (reports.length === 0) {
      body(doc, "We hold no reports for you.", MUTED);
    } else {
      for (const r of reports) {
        if (doc.y > 640) doc.addPage();
        field(doc, "Reported", fmtDate(r.reported_at));
        field(doc, "Your reason", r.your_reason ?? "Not recorded");
        field(doc, "Outcome", r.outcome ?? "Not yet resolved");
        doc.moveDown(0.4);
      }
    }

    /* ── what is not here ── */
    heading(doc, "What is not in this document");
    body(doc, WORDING.stripe);

    /* ── purposes and retention ── */
    heading(doc, "Why we hold this, and for how long");
    body(doc, WORDING.purposes);
    doc.moveDown(0.5);
    body(doc, WORDING.retention);

    /* ── footer ── */
    heading(doc, "Questions");
    body(doc, "Reply to the email this document arrived with, or contact info@playingnextapp.com.");

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(7.5)
        .text(
          `${snapshot.requestReference ?? "Playing Next"}   ·   page ${i - range.start + 1} of ${range.count}`,
          56,
          doc.page.height - 44,
          { align: "center", width: doc.page.width - 112 }
        );
    }

    doc.end();
  });
}
