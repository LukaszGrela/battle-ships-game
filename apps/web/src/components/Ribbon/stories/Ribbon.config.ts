import type { CSSProperties } from "react";

/** `CSSProperties` nie zna własnych właściwości CSS, więc dokładamy sygnaturę. */
export type CSSVars = CSSProperties & Record<`--${string}`, string>;

/**
 * Pełny zestaw zmiennych CSS wstążki, które da się ustawić z formularza.
 *
 * Wszystkie pola liczbowe są w `rem`. Pola tekstowe (`background`, `shadow`,
 * `padding`, `boxShadow`, `transition`) przyjmują dowolny CSS — także `var(...)`
 * i `calc(...)`. Pusty string oznacza „nie nadpisuj”, czyli wartość z motywu.
 */
export interface RibbonConfig {
  /* Lewe zakończenie */
  leftXOffset: number;
  leftYOffset: number;
  foldLeftHeight: number;
  foldLeftWidth: number;
  leftNotchSize: number;

  /* Prawe zakończenie */
  rightXOffset: number;
  rightYOffset: number;
  foldRightHeight: number;
  foldRightWidth: number;
  rightNotchSize: number;

  /* Panel */
  minWidth: number;
  minHeight: number;
  width: number;
  maxWidth: number;
  baseYOffset: number;

  /* Marginesy zewnętrzne (rezerwa na wystające końcówki) */
  marginTopOffset: number;
  marginRightOffset: number;
  marginBottomOffset: number;
  marginLeftOffset: number;

  /* Kolory */
  background: string;
  shadow: string;
  backgroundLeft: string;
  shadowLeft: string;
  backgroundRight: string;
  shadowRight: string;

  /* Zaawansowane */
  padding: string;
  boxShadow: string;
  transition: string;
}

/** Wartości z `Ribbon.module.css` — punkt odniesienia dla „tylko zmienione”. */
export const RIBBON_DEFAULTS: RibbonConfig = {
  leftXOffset: 1,
  leftYOffset: 1,
  foldLeftHeight: 3,
  foldLeftWidth: 4.5,
  leftNotchSize: 1.5,

  rightXOffset: 1,
  rightYOffset: 1,
  foldRightHeight: 3,
  foldRightWidth: 4.5,
  rightNotchSize: 1.5,

  minWidth: 20,
  minHeight: 3,
  width: 0,
  maxWidth: 0,
  baseYOffset: 0,

  marginTopOffset: 0,
  marginRightOffset: 0,
  marginBottomOffset: 0,
  marginLeftOffset: 0,

  background: "",
  shadow: "",
  backgroundLeft: "",
  shadowLeft: "",
  backgroundRight: "",
  shadowRight: "",

  padding: "",
  boxShadow: "",
  transition: "",
};

/** Preset „Swallowtail” — asymetryczne, kolorowe zakończenia. */
export const SWALLOWTAIL_CONFIG: RibbonConfig = {
  ...RIBBON_DEFAULTS,

  leftXOffset: 2.75,
  leftYOffset: 2.25,
  foldLeftHeight: 3.75,
  foldLeftWidth: 7,
  leftNotchSize: 2,

  rightXOffset: 2.75,
  rightYOffset: -2.25,
  foldRightHeight: 3.75,
  foldRightWidth: 7,
  rightNotchSize: 2,

  minWidth: 16,
  minHeight: 4,
  backgroundLeft: "#b83b2d",
  shadowLeft: "#6b2019",
  backgroundRight: "#185f78",
  shadowRight: "#0b394a",
};
export const AVATAR_CONFIG: RibbonConfig = {
  ...RIBBON_DEFAULTS,
  /*
    --ribbon-left-y-offset: 0.25rem;
    --ribbon-fold-left-height: 2.5rem;
    --ribbon-fold-left-width: 128px;
    --ribbon-left-notch-size: 0.75rem;

    --ribbon-right-y-offset: 0.25rem;
    --ribbon-fold-right-height: 2.5rem;
    --ribbon-fold-right-width: 2rem;
    --ribbon-right-notch-size: 0.75rem;
    --ribbon-min-width: min-content;
    --offset: 100%;
    --ribbon-max-width: 100%;

    --ribbon-box-shadow: var(--shadow-raised), inset 0px 0 2px 0px rgba(0, 0, 0, 0.25);
    font-weight: bold;
    -webkit-text-stroke: 3px var(--pirates-palette-16);
    paint-order: stroke fill;
    --background: linear-gradient( to bottom, var(--pirates-enemy-main) 0%, var(--pirates-palette-29) 49%, var(--pirates-enemy-main) 100% );
    --shadow: var(--pirates-palette-31);
    --background-left: var(--pirates-palette-35);
    --shadow-left: var(--pirates-palette-36);
*/
  leftYOffset: 0.25,
  foldLeftHeight: 2.5,
  foldLeftWidth: 8,
  leftNotchSize: 0.75,
  rightYOffset: 0.25,
  foldRightHeight: 2.5,
  foldRightWidth: 2,
  rightNotchSize: 0.75,
  minWidth: 0,

  maxWidth: 16,
  minHeight: 4,
  background:
    "linear-gradient( to bottom, var(--pirates-enemy-main) 0%, var(--pirates-palette-29) 49%, var(--pirates-enemy-main) 100% )",
  backgroundLeft: "var(--pirates-palette-35)",
  shadowLeft: "var(--pirates-palette-36)",
  backgroundRight: "var(--pirates-palette-35)",
  shadowRight: "var(--pirates-palette-36)",
};

export const RIBBON_GROUPS = [
  "Lewe zakończenie",
  "Prawe zakończenie",
  "Panel",
  "Marginesy",
  "Kolory",
  "Zaawansowane",
] as const;

export type RibbonGroup = (typeof RIBBON_GROUPS)[number];

export type RibbonControl = "range" | "color" | "text";

export interface RibbonField {
  key: keyof RibbonConfig;
  label: string;
  cssVar: string;
  group: RibbonGroup;
  control: RibbonControl;
  min?: number;
  max?: number;
  step?: number;
  /** Wartość `0` zapisujemy w CSS jako `unset` (np. `--ribbon-width`). */
  unsetAtZero?: boolean;
  hint?: string;
}

/**
 * Jedno źródło prawdy dla formularza, panelu Controls i serializacji CSS.
 * Kolejność wpisów = kolejność pól w formularzu.
 */
export const RIBBON_FIELDS: RibbonField[] = [
  /* Lewe zakończenie */
  {
    key: "leftXOffset",
    label: "Przesunięcie X",
    cssVar: "--ribbon-left-x-offset",
    group: "Lewe zakończenie",
    control: "range",
    min: 0,
    max: 6,
    step: 0.05,
  },
  {
    key: "leftYOffset",
    label: "Przesunięcie Y",
    cssVar: "--ribbon-left-y-offset",
    group: "Lewe zakończenie",
    control: "range",
    min: -4,
    max: 4,
    step: 0.05,
  },
  {
    key: "foldLeftHeight",
    label: "Wysokość chorągiewki",
    cssVar: "--ribbon-fold-left-height",
    group: "Lewe zakończenie",
    control: "range",
    min: 1,
    max: 8,
    step: 0.05,
  },
  {
    key: "foldLeftWidth",
    label: "Szerokość chorągiewki",
    cssVar: "--ribbon-fold-left-width",
    group: "Lewe zakończenie",
    control: "range",
    min: 2,
    max: 10,
    step: 0.05,
  },
  {
    key: "leftNotchSize",
    label: "Głębokość wycięcia",
    cssVar: "--ribbon-left-notch-size",
    group: "Lewe zakończenie",
    control: "range",
    min: 0,
    max: 6,
    step: 0.05,
  },

  /* Prawe zakończenie */
  {
    key: "rightXOffset",
    label: "Przesunięcie X",
    cssVar: "--ribbon-right-x-offset",
    group: "Prawe zakończenie",
    control: "range",
    min: 0,
    max: 6,
    step: 0.05,
  },
  {
    key: "rightYOffset",
    label: "Przesunięcie Y",
    cssVar: "--ribbon-right-y-offset",
    group: "Prawe zakończenie",
    control: "range",
    min: -4,
    max: 4,
    step: 0.05,
  },
  {
    key: "foldRightHeight",
    label: "Wysokość chorągiewki",
    cssVar: "--ribbon-fold-right-height",
    group: "Prawe zakończenie",
    control: "range",
    min: 1,
    max: 8,
    step: 0.05,
  },
  {
    key: "foldRightWidth",
    label: "Szerokość chorągiewki",
    cssVar: "--ribbon-fold-right-width",
    group: "Prawe zakończenie",
    control: "range",
    min: 2,
    max: 10,
    step: 0.05,
  },
  {
    key: "rightNotchSize",
    label: "Głębokość wycięcia",
    cssVar: "--ribbon-right-notch-size",
    group: "Prawe zakończenie",
    control: "range",
    min: 0,
    max: 6,
    step: 0.05,
  },

  /* Panel */
  {
    key: "minWidth",
    label: "Minimalna szerokość",
    cssVar: "--ribbon-min-width",
    group: "Panel",
    control: "range",
    min: 10,
    max: 40,
    step: 0.5,
  },
  {
    key: "minHeight",
    label: "Minimalna wysokość",
    cssVar: "--ribbon-min-height",
    group: "Panel",
    control: "range",
    min: 1,
    max: 8,
    step: 0.25,
  },
  {
    key: "width",
    label: "Szerokość",
    cssVar: "--ribbon-width",
    group: "Panel",
    control: "range",
    min: 0,
    max: 40,
    step: 0.5,
    unsetAtZero: true,
    hint: "0 = brak (unset)",
  },
  {
    key: "maxWidth",
    label: "Maksymalna szerokość",
    cssVar: "--ribbon-max-width",
    group: "Panel",
    control: "range",
    min: 0,
    max: 60,
    step: 0.5,
    unsetAtZero: true,
    hint: "0 = brak (unset)",
  },
  {
    key: "baseYOffset",
    label: "Bazowe przesunięcie Y",
    cssVar: "--ribbon-base-y-offset",
    group: "Panel",
    control: "range",
    min: -4,
    max: 4,
    step: 0.05,
  },

  /* Marginesy */
  {
    key: "marginTopOffset",
    label: "Górny",
    cssVar: "--ribbon-margin-top-offset",
    group: "Marginesy",
    control: "range",
    min: -4,
    max: 8,
    step: 0.25,
  },
  {
    key: "marginRightOffset",
    label: "Prawy",
    cssVar: "--ribbon-margin-right-offset",
    group: "Marginesy",
    control: "range",
    min: -4,
    max: 8,
    step: 0.25,
  },
  {
    key: "marginBottomOffset",
    label: "Dolny",
    cssVar: "--ribbon-margin-bottom-offset",
    group: "Marginesy",
    control: "range",
    min: -4,
    max: 8,
    step: 0.25,
  },
  {
    key: "marginLeftOffset",
    label: "Lewy",
    cssVar: "--ribbon-margin-left-offset",
    group: "Marginesy",
    control: "range",
    min: -4,
    max: 8,
    step: 0.25,
  },

  /* Kolory */
  {
    key: "background",
    label: "Tło panelu",
    cssVar: "--background",
    group: "Kolory",
    control: "text",
    hint: "puste = z motywu, np. var(--pirates-palette-4)",
  },
  {
    key: "shadow",
    label: "Cień trójkątów",
    cssVar: "--shadow",
    group: "Kolory",
    control: "text",
    hint: "puste = z motywu, np. var(--pirates-palette-5)",
  },
  {
    key: "backgroundLeft",
    label: "Tło lewej chorągiewki",
    cssVar: "--background-left",
    group: "Kolory",
    control: "color",
  },
  {
    key: "shadowLeft",
    label: "Cień lewego trójkąta",
    cssVar: "--shadow-left",
    group: "Kolory",
    control: "color",
  },
  {
    key: "backgroundRight",
    label: "Tło prawej chorągiewki",
    cssVar: "--background-right",
    group: "Kolory",
    control: "color",
  },
  {
    key: "shadowRight",
    label: "Cień prawego trójkąta",
    cssVar: "--shadow-right",
    group: "Kolory",
    control: "color",
  },

  /* Zaawansowane */
  {
    key: "padding",
    label: "Padding panelu",
    cssVar: "--ribbon-padding",
    group: "Zaawansowane",
    control: "text",
    hint: "puste = 0.5rem 1rem",
  },
  {
    key: "boxShadow",
    label: "Box-shadow panelu",
    cssVar: "--ribbon-box-shadow",
    group: "Zaawansowane",
    control: "text",
    hint: "puste = --shadow-raised",
  },
  {
    key: "transition",
    label: "Transition",
    cssVar: "--transition",
    group: "Zaawansowane",
    control: "text",
    hint: "puste = transform/opacity 0.1s",
  },
];

/* ── Lustro zakończeń ───────────────────────────────────────────────────── */

/** Odpowiedniki pól po obu stronach wstążki. */
export const RIBBON_SIDE_PAIRS: {
  left: keyof RibbonConfig;
  right: keyof RibbonConfig;
}[] = [
  { left: "leftXOffset", right: "rightXOffset" },
  { left: "leftYOffset", right: "rightYOffset" },
  { left: "foldLeftHeight", right: "foldRightHeight" },
  { left: "foldLeftWidth", right: "foldRightWidth" },
  { left: "leftNotchSize", right: "rightNotchSize" },
  /* Kolory też opisują zakończenie, choć w formularzu mają osobną grupę. */
  { left: "backgroundLeft", right: "backgroundRight" },
  { left: "shadowLeft", right: "shadowRight" },
];

/** Para kluczy „skąd → dokąd” dla wybranej strony źródłowej. */
const sideKeys = (
  pair: { left: keyof RibbonConfig; right: keyof RibbonConfig },
  from: "left" | "right",
) =>
  from === "left"
    ? { source: pair.left, target: pair.right }
    : { source: pair.right, target: pair.left };

/**
 * Kopiuje ustawienia jednego zakończenia na drugie.
 *
 * @param from        strona źródłowa
 * @param onlyChanged `true` (domyślnie) — przenosimy wyłącznie wartości inne
 *                    niż domyślne, więc puste pola (kolor z motywu) nie
 *                    wyczyszczą konfiguracji strony docelowej;
 *                    `false` — pełne lustro, łącznie z resetem do domyślnych
 */
export const copyRibbonSide = (
  config: RibbonConfig,
  from: "left" | "right",
  { onlyChanged = true }: { onlyChanged?: boolean } = {},
): RibbonConfig => {
  const next = { ...config };
  const target = next as Record<keyof RibbonConfig, string | number>;

  for (const pair of RIBBON_SIDE_PAIRS) {
    const { source, target: destination } = sideKeys(pair, from);
    const value = config[source];

    if (onlyChanged && value === RIBBON_DEFAULTS[source]) continue;

    target[destination] = value;
  }

  return next;
};

/** Ile wartości przeniesie `copyRibbonSide` w trybie „tylko zmienione”. */
export const countRibbonSideChanges = (
  config: RibbonConfig,
  from: "left" | "right",
): number =>
  RIBBON_SIDE_PAIRS.filter((pair) => {
    const { source } = sideKeys(pair, from);
    return config[source] !== RIBBON_DEFAULTS[source];
  }).length;

/**
 * Zamienia pojedynczą wartość na tekst CSS.
 * Zwraca `null`, gdy zmiennej nie należy w ogóle emitować (pusty tekst).
 */
export const formatValue = (
  field: RibbonField,
  value: RibbonConfig[keyof RibbonConfig],
): string | null => {
  if (typeof value === "number") {
    if (field.unsetAtZero && value === 0) return "unset";
    return `${value}rem`;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
};

/**
 * Konfiguracja → właściwości inline dla `<Ribbon style={...} />`.
 * Inline style wygrywa z `@layer Ribbon`, więc efekty widać natychmiast.
 */
export const toCssVars = (config: Partial<RibbonConfig> = {}): CSSVars => {
  const merged: RibbonConfig = { ...RIBBON_DEFAULTS, ...config };
  const vars: Record<string, string> = {};

  for (const field of RIBBON_FIELDS) {
    const value = formatValue(field, merged[field.key]);
    if (value !== null) vars[field.cssVar] = value;
  }

  return vars as CSSVars;
};

/**
 * Konfiguracja → gotowa reguła CSS, np. do wklejenia w `Ribbon.stories.tsx`
 * albo do własnego arkusza.
 *
 * @param selector   np. `.Swallowtail`
 * @param onlyChanged pomiń wartości równe domyślnym z `Ribbon.module.css`
 */
export const toCssRule = (
  config: RibbonConfig,
  selector = ".Swallowtail",
  onlyChanged = false,
): string => {
  const body = RIBBON_FIELDS.flatMap((field) => {
    if (onlyChanged && config[field.key] === RIBBON_DEFAULTS[field.key])
      return [];

    const value = formatValue(field, config[field.key]);
    return value === null ? [] : [`  ${field.cssVar}: ${value};`];
  });

  return `${selector} {\n${body.join("\n")}\n}`;
};

/** Konfiguracja → fragment JSX z `style={{ ... }}` (do wklejenia w kod). */
export const toJsxStyle = (config: RibbonConfig): string => {
  const entries = Object.entries(toCssVars(config))
    .map(([name, value]) => `  "${name}": "${value}",`)
    .join("\n");

  return `style={{\n${entries}\n}}`;
};
