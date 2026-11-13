import type { CategoryId, ModelKind } from "@/lib/menu";

type GlyphKind = ModelKind | CategoryId;

export function FoodGlyph({
  kind,
  className,
}: {
  kind: GlyphKind;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const glyph: GlyphKind =
    kind === "snacks"
      ? "fries"
      : kind === "desserts"
        ? "donut"
        : kind === "drinks"
          ? "drink"
          : kind === "burgers"
            ? "burger"
            : kind === "custom"
              ? "box"
              : kind;

  return (
    <svg
      className={className ?? "item-card__glyph"}
      viewBox="0 0 48 48"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {glyph === "burger" ? (
        <g {...common}>
          <path d="M9 20c0-5 4.2-9 9.6-9h10.8C34.8 11 39 15 39 20v1H9v-1Z" />
          <path d="M8 21h32" />
          <path d="M10 26c3-2.4 6-2.4 9 0s6 2.4 9 0 6-2.4 9 0" />
          <path d="M10 27h28l-2.2 3.5a4 4 0 0 1-3.4 1.9H15.6a4 4 0 0 1-3.4-1.9L10 27Z" />
          <path d="M11 33h26c0 3.2-2.5 5.5-5.6 5.5H16.6C13.5 38.5 11 36.2 11 33Z" />
          <circle cx="17" cy="16" r=".8" fill="currentColor" />
          <circle cx="24" cy="14.5" r=".8" fill="currentColor" />
          <circle cx="31" cy="16" r=".8" fill="currentColor" />
        </g>
      ) : null}

      {glyph === "shawarma" ? (
        <g {...common}>
          <path d="M13 39c-3-6 1-17 9-26 2.5-2.8 5-4 7.5-3.5 3.6.7 5.5 4.2 4.2 7.8L23 40" />
          <path d="M13 39c5-2 11-6 17-12 3.2-3.2 5.4-6 6.5-8.8" />
          <path d="M18 33c4-1 8-3.5 12-7" />
          <path d="M27 11c-2 1-4 3-5.5 5.5" />
        </g>
      ) : null}

      {glyph === "pizza" ? (
        <g {...common}>
          <path d="M10 11c9-2 19-2 28 0L24 41 10 11Z" />
          <path d="M13 15.5c5.5-1.1 11-1.4 16.5-1" />
          <circle cx="20" cy="22" r="2.3" />
          <circle cx="29" cy="25" r="2" />
          <circle cx="23.5" cy="31" r="1.6" />
          <path d="M27 18.5c1.5-.4 3-.7 4.5-.9" />
        </g>
      ) : null}

      {glyph === "fries" ? (
        <g {...common}>
          <path d="M14 22h20l-2.4 16a3 3 0 0 1-3 2.6h-9.2a3 3 0 0 1-3-2.6L14 22Z" />
          <path d="M18 22V11M23 22V8.5M28 22v-9M32.5 22l1-8" />
          <path d="M16.5 28h15" />
          <path d="M18.5 34h11" />
        </g>
      ) : null}

      {glyph === "drink" ? (
        <g {...common}>
          <path d="M14 14h20l-2.2 25a3 3 0 0 1-3 2.7H19.2a3 3 0 0 1-3-2.7L14 14Z" />
          <path d="M13 14h22" />
          <path d="M27 14 32 5" />
          <path d="M18 21h12" />
          <circle cx="21" cy="28" r="1.2" />
          <circle cx="27" cy="33" r="1" />
          <circle cx="22.5" cy="36" r=".8" />
        </g>
      ) : null}

      {glyph === "donut" ? (
        <g {...common}>
          <circle cx="24" cy="24" r="14" />
          <circle cx="24" cy="24" r="5" />
          <path d="M14 18c5 2.5 10 3 15 1.8" opacity=".8" />
          <path d="M17 33c4-1.5 8-1.5 12 0" opacity=".8" />
          <path d="M18 12.5c.8 1.3 2 2 3.5 2.2M30.5 15c-.3 1.2-1 2.1-2.2 2.7M32 29c-1.2.4-2.2 1.2-2.8 2.3" />
        </g>
      ) : null}

      {glyph === "box" ? (
        <g {...common}>
          <path d="M17 17c0-3.5 3-6.2 7-6.2s7 2.7 7 6.2" />
          <path d="M11 16h26l2 6H9l2-6Z" />
          <path d="M11 22h26v15a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V22Z" />
          <circle cx="19" cy="30" r="1.2" fill="currentColor" />
          <circle cx="29" cy="30" r="1.2" fill="currentColor" />
          <path d="M21 34c1.8 1.4 4.2 1.4 6 0" />
        </g>
      ) : null}
    </svg>
  );
}
