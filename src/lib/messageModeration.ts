import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

/*
 * Only ever applied to the guest's own free-text shoutout — never to
 * song titles or artist names. Those come from Spotify and legitimately
 * contain profanity; filtering them would block real songs.
 *
 * The message is the one piece of stranger-written text that ends up in
 * front of the DJ and, at a wedding or corporate gig, frequently read
 * out loud. Rejecting on submission (rather than censoring to asterisks)
 * means the guest can reword it while they're still standing there, and
 * the DJ never has to see it.
 *
 * The matcher handles the usual evasion — leetspeak, padded characters,
 * spacing — and its dataset carries whitelisted phrases for the
 * "Scunthorpe problem", so ordinary words that happen to contain a rude
 * substring aren't caught.
 */
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export const MESSAGE_REJECTED_COPY =
  "Please reword your message — it looks like it contains language we can’t pass on to the DJ.";

/*
 * The matcher handles character substitution ("sh1t") but not letters
 * padded apart ("f u c k", "f.u.c.k"), so single letters separated by
 * punctuation or spaces get pulled back together and checked a second
 * time. Deliberately narrow: only single characters are joined, so
 * initialisms a guest would plausibly type — "R E W I N D", "D J
 * Khaled", "A B B A" — collapse to harmless words rather than
 * accidentally forming a match.
 */
function collapsePaddedLetters(message: string): string {
  return message.replace(/\b(\w)[\s._\-*]+(?=\w\b)/g, "$1");
}

export function messageNeedsRewording(message: string | null): boolean {
  if (!message) return false;

  return (
    matcher.hasMatch(message) ||
    matcher.hasMatch(collapsePaddedLetters(message))
  );
}
