import RequestPageClient from "./RequestPageClient";
import { fetchPublicDjBootstrap } from "@/src/lib/publicDjBootstrap";

/*
 * ── Why this route is dynamic again ──────────────────────────────
 *
 * R5 made this shell CDN-cacheable, which was correct while the server
 * rendered no DJ data: the HTML was the same skeleton for everybody.
 * That is no longer true. This page now renders a specific DJ's name,
 * availability and prices, and those go stale — a DJ pausing requests or
 * changing a price would otherwise keep serving the old answer from the
 * edge until the cache expired, and a guest could be quoted a price that
 * checkout then disagrees with.
 *
 * R5's measured benefit on the metric that mattered was zero (weak-mobile
 * time-to-search moved 6261ms to within noise of itself), because the
 * bottleneck was never the server. What it did buy was cold-start
 * removal, and with functions pinned to lhr1 next to the database that
 * is a far cheaper problem than a wrong price. Correctness wins.
 *
 * The London region from Performance Pass 1 still applies and is what
 * makes this affordable: the bootstrap query below runs in the same city
 * as Postgres.
 */
export const dynamic = "force-dynamic";

export default async function RequestPage({
  params,
}: {
  params: Promise<{ djSlug: string }>;
}) {
  const { djSlug } = await params;

  const result = await fetchPublicDjBootstrap(djSlug);

  /*
   * The three outcomes stay separate all the way to the browser.
   *
   * A failed bootstrap hands the client bootstrapFailed rather than a
   * null DJ, because null means "this DJ does not exist" and that is a
   * different, much more damaging thing to tell a guest standing in a
   * venue. During the 2026-09-03 outage the two were the same value and
   * every working DJ's page said "DJ Not Found".
   */
  if (result.status === "error") {
    return <RequestPageClient bootstrap={null} bootstrapFailed />;
  }

  if (result.status === "not_found") {
    return <RequestPageClient bootstrap={null} />;
  }

  const { dj } = result;

  /*
   * Mapped explicitly onto the shape the client already speaks. Written
   * out field by field rather than spread: this is the last point before
   * the data is serialized into HTML, so it is the last place a stray
   * column could escape, and there is deliberately no mechanism here for
   * one to do so.
   *
   * `bio` is absent on purpose. The view exposes it and the client's
   * reconciliation fetch reads it, but it sits behind a disclosure below
   * the fold and has no business in the first paint. hasBio is enough to
   * render the disclosure affordance correctly.
   */
  return (
    <RequestPageClient
      bootstrap={{
        id: dj.id,
        dj_name: dj.djName,
        request_status: dj.requestStatus,
        last_active_at: dj.lastActiveAt,
        auto_close_at: dj.autoCloseAt,
        genres: dj.genres,
        bio: dj.hasBio ? "" : null,
        profile_image_url: dj.profileImageUrl,
        request_price: dj.effectiveRequestPrice,
        shoutout_price: dj.effectiveShoutoutPrice,
      }}
      bootstrapEvent={
        dj.effectiveEvent
          ? {
              id: dj.effectiveEvent.id,
              name: dj.effectiveEvent.name,
              /* The view already resolved the override into the
                 effective prices above; carrying the raw numbers again
                 would just be a second chance to disagree. */
              request_price: null,
              shoutout_price: null,
            }
          : null
      }
    />
  );
}
