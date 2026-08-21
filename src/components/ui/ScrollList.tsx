import type { ReactNode } from "react";
import { cn } from "@/src/lib/cn";

type Props = {
  children: ReactNode;
  /**
   * Cap in Tailwind max-height form. Only a cap: a short list keeps its
   * natural height and shows no scrollbar, so a quiet night never
   * renders a tall empty scroll box.
   */
  maxHeightClassName?: string;
  className?: string;
};

/*
 * The contained-scroll list used by Recent Activity and Today's
 * Transactions.
 *
 * Both had, or wanted, the same behaviour: the card header and summary
 * stay put while the rows scroll inside, so one busy day cannot make
 * the whole page enormous. Extracted so there is one treatment rather
 * than two that drift apart.
 *
 * Deliberately not used for the live queue or pending list. Those had
 * exactly this and it was removed in 3A: a scroll box around the
 * content a DJ is working through mid-set caps it at about four visible
 * rows and puts a trap around the most important thing on the screen.
 * It is right here because both of these are secondary, retrospective
 * lists that a DJ reads rather than acts on.
 */
export default function ScrollList({
  children,
  maxHeightClassName = "max-h-80",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "scroll-subtle overflow-y-auto",
        maxHeightClassName,
        className
      )}
    >
      {children}
    </div>
  );
}
