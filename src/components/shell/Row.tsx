import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RowProps {
  /** Colore della costola verticale (2px, gradient verso trasparente). Passa
   *  un colore hex/rgba oppure una `var(--t-…)`. Default: `rgba(255,255,255,.14)`. */
  ribColor?: string;
  /** Se true, applica il pattern non-letto (fondo blu tenue, bordo blu, costola blu + glow). */
  unread?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  as?: "div" | "button" | "a";
  href?: string;
  ariaLabel?: string;
}

/**
 * Primitiva condivisa della shell: riga glassy con costola di territorio.
 * Usata da Diario, Messaggi, Notifiche, Cerca. La grammatica è in
 * `.row` (index.css); qui aggiungiamo comportamento e composizione.
 */
export const Row = forwardRef<HTMLElement, RowProps>(function Row(
  { ribColor, unread, onClick, className, style, children, as = "div", href, ariaLabel },
  ref
) {
  const finalStyle: CSSProperties = {
    ...(ribColor ? ({ "--rib": ribColor } as CSSProperties) : {}),
    ...style,
  };

  const commonProps = {
    className: cn("row", onClick || as !== "div" ? "cursor-pointer" : "", className),
    style: finalStyle,
    "data-unread": unread ? "true" : undefined,
    onClick,
    "aria-label": ariaLabel,
  };

  if (as === "a" && href) {
    return (
      // eslint-disable-next-line jsx-a11y/anchor-has-content
      <a ref={ref as any} href={href} {...(commonProps as any)}>
        {children}
      </a>
    );
  }
  if (as === "button") {
    return (
      <button
        ref={ref as any}
        type="button"
        {...(commonProps as any)}
      >
        {children}
      </button>
    );
  }
  return (
    <div ref={ref as any} {...(commonProps as any)}>
      {children}
    </div>
  );
});

export default Row;