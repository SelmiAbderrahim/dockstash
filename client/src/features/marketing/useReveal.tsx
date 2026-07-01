import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';

/**
 * SSR-safe one-shot entrance reveal.
 *
 * Content is always present and visible in server-rendered HTML — crawlers and
 * no-JS visitors never see a hidden element. The hide→show transition only
 * applies after hydration: the hook adds `html.mk-js`, which is the sole gate
 * for the `.mk-reveal` opacity/transform in marketing.scss (further gated by
 * `prefers-reduced-motion: no-preference`). Without JS, or with reduced motion,
 * the element simply renders in its natural visible state.
 *
 * Returns a ref to attach to the target and whether it has entered the
 * viewport yet. Once visible it stops observing (one-shot).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mark that JS is active so the reveal styles engage (see marketing.scss).
    document.documentElement.classList.add('mk-js');

    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (old browser) → reveal immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export interface RevealProps {
  children: ReactNode;
  /** Element to render. Defaults to a <div>. */
  as?: ElementType;
  /** Stagger index — each step adds ~70ms delay. */
  index?: number;
  className?: string;
}

/**
 * Wrapper that applies the entrance reveal to its subtree. Renders visible on
 * the server; animates in on scroll after hydration (unless reduced motion).
 */
export const Reveal = ({
  children,
  as,
  index = 0,
  className,
}: RevealProps) => {
  const Tag = as ?? 'div';
  const { ref, visible } = useReveal<HTMLElement>();
  const classes = ['mk-reveal', visible ? 'is-visible' : '', className]
    .filter(Boolean)
    .join(' ');

  const style = index
    ? ({ '--mk-reveal-delay': `${index * 70}ms` } as CSSProperties)
    : undefined;

  return (
    <Tag ref={ref} className={classes} style={style}>
      {children}
    </Tag>
  );
};
