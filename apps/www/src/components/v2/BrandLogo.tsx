import { cn } from "@/lib/utils";
import { BRAND_LOGOS } from "@/lib/brand-logos";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Shape = "circle" | "rounded" | "square";

interface BrandLogoProps {
  /** id from BRAND_LOGOS — e.g. "usdc", "visa", "stripe". */
  id: string;
  size?: Size;
  /** Shape of the frame applied to glyph fallbacks (SVGs render as-is). */
  shape?: Shape;
  /**
   * When true, the frame is also applied around SVG marks. Useful when you
   * want every item in a list (mixed SVG + fallback) to share the same
   * silhouette. Default `false` — SVGs render at their natural look.
   */
  framed?: boolean;
  /** Show the label next to the logo. */
  withLabel?: boolean;
  className?: string;
}

const sizeMap: Record<Size, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 44,
  xl: 56,
};

const shapeMap: Record<Shape, string> = {
  circle: "rounded-full",
  rounded: "rounded-xl",
  square: "rounded-md",
};

/**
 * Renders a single brand mark — uses the official SVG when available,
 * otherwise renders a colored badge with a glyph fallback. Drives every
 * payment-method / chain / integration logo on the site so we never
 * sprinkle one-off `<span>$</span>` or hex-color literals into a feature.
 *
 * @example
 *   <BrandLogo id="usdc" size="md" />
 *   <BrandLogo id="visa" size="sm" withLabel />
 *   <BrandLogo id="stripe" size="lg" shape="rounded" />
 */
export function BrandLogo({
  id,
  size = "md",
  shape = "circle",
  framed = false,
  withLabel = false,
  className,
}: BrandLogoProps) {
  const logo = BRAND_LOGOS[id];
  if (!logo) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`BrandLogo: unknown id "${id}"`);
    }
    return null;
  }

  const px = sizeMap[size];
  const shapeCls = shapeMap[shape];

  // Inner SVG size when sitting inside a frame — leaves a little padding
  const innerPx = Math.round(px * 0.72);
  const glyphFontPx = Math.max(11, Math.round(px * 0.38));

  let mark: React.ReactNode;
  if (logo.src) {
    if (framed) {
      mark = (
        <span
          className={cn(
            "inline-grid shrink-0 place-items-center overflow-hidden border border-rule bg-bg-card",
            shapeCls,
          )}
          style={{ width: px, height: px }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.src}
            alt={logo.label}
            width={innerPx}
            height={innerPx}
            loading="lazy"
            className="object-contain"
          />
        </span>
      );
    } else {
      mark = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.src}
          alt={logo.label}
          width={px}
          height={px}
          loading="lazy"
          className={cn("shrink-0 object-contain", shapeCls)}
          style={{ width: px, height: px }}
        />
      );
    }
  } else if (logo.icon) {
    const Icon = logo.icon;
    const iconPx = Math.round(px * 0.5);
    mark = (
      <span
        aria-label={withLabel ? undefined : logo.label}
        role={withLabel ? undefined : "img"}
        className={cn(
          "inline-grid shrink-0 place-items-center",
          shapeCls,
          logo.tone,
        )}
        style={{ width: px, height: px }}
      >
        <Icon size={iconPx} strokeWidth={1.7} />
      </span>
    );
  } else {
    mark = (
      <span
        aria-label={withLabel ? undefined : logo.label}
        role={withLabel ? undefined : "img"}
        className={cn(
          "inline-grid shrink-0 place-items-center font-semibold",
          shapeCls,
          logo.tone,
        )}
        style={{
          width: px,
          height: px,
          fontSize: glyphFontPx,
          fontFamily: "var(--font-display)",
        }}
      >
        {logo.glyph}
      </span>
    );
  }

  if (!withLabel) {
    return className ? <span className={className}>{mark}</span> : mark;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark}
      <span className="text-[13px] font-medium text-ink">{logo.label}</span>
    </span>
  );
}
