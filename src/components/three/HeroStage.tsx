"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CategoryId, MenuItem } from "@/lib/menu";
import type { CharacterSettings } from "@/lib/settings";
import { formatRub } from "@/lib/format";
import { PHRASES } from "./model-paths";

const FoodScene = dynamic(() => import("./FoodScene"), {
  ssr: false,
  loading: () => <StageSkeleton />,
});

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function StageSkeleton() {
  return (
    <div className="stage-skeleton" aria-hidden="true">
      <div className="stage-skeleton__ring" />
      <div className="stage-skeleton__plate" />
    </div>
  );
}

function StagePoster({
  item,
  price,
  message,
  onRetry,
}: {
  item: MenuItem;
  price: number | null;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="stage-poster">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/poster.svg" alt="" className="stage-poster__image" />
      <div className="stage-poster__copy">
        <p>{message}</p>
        <span className="stage-poster__item">
          {item.name}
          {price !== null ? ` · ${formatRub(price)}` : " · по запросу"}
        </span>
        {onRetry ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={onRetry}>
            Попробовать 3D снова
          </button>
        ) : null}
        <a href="#menu" className="text-link">
          Выбрать блюдо в меню
        </a>
      </div>
    </div>
  );
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

export function HeroStage({
  item,
  category,
  price,
  character,
  accent,
}: {
  item: MenuItem;
  category: CategoryId;
  price: number | null;
  character: CharacterSettings;
  accent: string;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [inView, setInView] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [boundaryKey, setBoundaryKey] = useState(0);
  const [forcedStatic, setForcedStatic] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setForcedStatic(params.get("static") === "1" || params.get("no3d") === "1");
    setWebgl(supportsWebGL());
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setInView(entries[0]?.isIntersecting ?? false);
      },
      { rootMargin: "120px 0px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const retry = () => {
    setWebgl(supportsWebGL());
    setBoundaryKey((value) => value + 1);
  };

  const priceLabel = price !== null ? formatRub(price) : "По запросу";
  const isStatic = forcedStatic || webgl === false;

  const phrase = useMemo(() => {
    const list = PHRASES[category] ?? PHRASES.default;
    return list[item.id.charCodeAt(0) % list.length]!;
  }, [category, item.id]);

  const showBubble =
    character.phrases && character.preset !== "none" && !isStatic && webgl === true;

  return (
    <div
      ref={containerRef}
      className="stage-shell"
      data-theme-static={isStatic ? "true" : "false"}
    >
      <div className="stage-topline">
        <span className="stage-eyebrow">3D-витрина</span>
        <span className="stage-category">{item.name}</span>
      </div>

      {webgl === null ? <StageSkeleton /> : null}

      {webgl === true && !forcedStatic ? (
        <SceneBoundary
          key={boundaryKey}
          fallback={
            <StagePoster
              item={item}
              price={price}
              message="3D-сцена не загрузилась. Меню и оформление заказа продолжают работать."
              onRetry={retry}
            />
          }
        >
          <FoodScene
            item={item}
            character={character}
            accent={accent}
            reducedMotion={reducedMotion}
            inView={inView && documentVisible}
          />
        </SceneBoundary>
      ) : null}

      {showBubble ? (
        <div className="mascot-bubble mascot-bubble--overlay" role="status" aria-live="polite">
          <strong>{character.name}</strong>
          <span>{phrase}</span>
        </div>
      ) : null}

      {isStatic ? (
        <StagePoster
          item={item}
          price={price}
          message={
            forcedStatic
              ? "Показан облегчённый режим без WebGL."
              : "На этом устройстве 3D недоступно. Меню, цены и заказ работают как обычно."
          }
          onRetry={retry}
        />
      ) : null}

      <div className="stage-price-tag" aria-hidden={isStatic}>
        <span>{priceLabel}</span>
        <small>{price !== null ? "за порцию" : "после согласования"}</small>
      </div>
    </div>
  );
}
