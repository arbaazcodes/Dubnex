# Motion Animation System

Reusable **Motion.dev** (`motion/react`) helpers for Dubnex.

Style target: **Linear / Cursor / Vercel** — short fades, micro-slides (4–8px), shared ease-out, **no bounce / no spring overshoot**.

Existing pages are **not** wired yet. Import when you are ready to animate a surface.

---

## Install / import

```ts
import {
  // presets
  durations,
  easings,
  transitionFor,
  // variants
  fadeVariants,
  slideVariants,
  scaleVariants,
  staggerContainer,
  staggerItem,
  pageVariants,
  modalContentVariants,
  hoverMotion,
  // components
  AnimatedPage,
  AnimatedCard,
  AnimatedButton,
  AnimatedModal,
  AnimatedList,
  AnimatedItem,
  AnimatedPresence,
} from "@/lib/animations";
```

Or import components from `@/components/animations`.

---

## Presets

| Preset | Duration | Use for |
|--------|----------|---------|
| `fast` | 150ms | Buttons, hovers, modal chrome |
| `normal` | 220ms | Cards, lists, default enter |
| `slow` | 360ms | Page-level emphasis (rare) |

Easing (shared): `[0.16, 1, 0.3, 1]` — soft decelerate.

```ts
import { baseTransition, durations, easings } from "@/lib/animations";

baseTransition({ preset: "fast" });
// → { duration: 0.15, ease: easings.out, delay: 0 }
```

---

## `prefers-reduced-motion`

Every variant factory takes `reducedMotion` (from Motion’s `useReducedMotion()`).

When `true` / reduced:

- Duration → `0`
- No translate / scale travel
- Components already call `useReducedMotion()` internally

```ts
import { useReducedMotion } from "motion/react";
import { fadeVariants } from "@/lib/animations";

const reduced = useReducedMotion();
const variants = fadeVariants(reduced, { preset: "normal" });
```

---

## Variant modules

### `fade.ts`

Opacity only.

```tsx
<motion.div
  variants={fadeVariants(reduced, { preset: "normal" })}
  initial="hidden"
  animate="visible"
  exit="exit"
/>
```

### `slide.ts`

Fade + 8px slide. Directions: `up` | `down` | `left` | `right`.

```ts
slideVariants(reduced, { preset: "normal", direction: "up", offset: 8 });
slideUp(reduced, "fast");
```

### `scale.ts`

Fade + scale from `0.98` → `1` (no overshoot).

```ts
scaleVariants(reduced, { preset: "normal", from: 0.98 });
```

### `stagger.ts`

Parent/child stagger for lists.

```ts
staggerContainer(reduced, { preset: "normal", staggerChildren: 0.05 });
staggerItem(reduced, { child: "slide" });
```

### `page.ts`

Route / view enter–exit for `AnimatedPresence mode="wait"`.

```ts
pageVariants(reduced, { preset: "normal", direction: "fade" });
```

### `modal.ts`

Backdrop + content pairs.

```ts
modalBackdropVariants(reduced, { preset: "fast", backdropOpacity: 0.5 });
modalContentVariants(reduced, { preset: "fast" });
```

### `hover.ts`

Subtle hover / tap (≈1–2px lift or 1.015 scale).

```ts
const props = hoverMotion(reduced, { preset: "fast", y: -1, scale: 1.01 });
<motion.button {...props} />
```

---

## Components

### `AnimatedPresence`

Wrapper around Motion `AnimatePresence`.

```tsx
<AnimatedPresence mode="wait">
  {tab === "a" ? <AnimatedPage key="a">…</AnimatedPage> : null}
</AnimatedPresence>
```

### `AnimatedPage`

```tsx
<AnimatedPage preset="normal" direction="fade" className="min-h-0">
  {children}
</AnimatedPage>
```

### `AnimatedCard`

```tsx
<AnimatedCard enter="scale" hover className="rounded-xl border p-4">
  Content
</AnimatedCard>
```

### `AnimatedButton`

```tsx
<AnimatedButton
  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white"
  onClick={onSave}
>
  Save
</AnimatedButton>
```

### `AnimatedModal`

Presentational only — you own content and open state.

```tsx
<AnimatedModal open={open} onClose={() => setOpen(false)} aria-label="Settings">
  <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900">
    …
  </div>
</AnimatedModal>
```

### `AnimatedList` + `AnimatedItem`

```tsx
<AnimatedList preset="normal" className="space-y-2">
  {items.map((item) => (
    <AnimatedItem key={item.id} className="rounded-lg border p-3">
      {item.label}
    </AnimatedItem>
  ))}
</AnimatedList>
```

---

## Full page-transition example

```tsx
import {
  AnimatedPresence,
  AnimatedPage,
} from "@/lib/animations";

function StudioTabs({ view }: { view: "edit" | "export" }) {
  return (
    <AnimatedPresence mode="wait">
      <AnimatedPage key={view} direction="fade" preset="normal">
        {view === "edit" ? <Editor /> : <Exporter />}
      </AnimatedPage>
    </AnimatedPresence>
  );
}
```

---

## File map

```
src/lib/animations/
  presets.ts   # Fast / Normal / Slow + easing
  fade.ts
  slide.ts
  scale.ts
  stagger.ts
  page.ts
  modal.ts
  hover.ts
  index.ts     # public barrel
  README.md

src/components/animations/
  AnimatedPage.tsx
  AnimatedCard.tsx
  AnimatedButton.tsx
  AnimatedModal.tsx
  AnimatedList.tsx
  AnimatedItem.tsx
  AnimatedPresence.tsx
  index.ts
```

---

## Rules of thumb

1. Prefer `fast` / `normal` — reserve `slow` for rare emphasis.
2. Keep offsets ≤ 12px.
3. Never add bounce or high-stiffness springs.
4. Always respect reduced motion (built into helpers/components).
5. Do not animate layout thrash (width/height) unless necessary — prefer opacity + transform.
