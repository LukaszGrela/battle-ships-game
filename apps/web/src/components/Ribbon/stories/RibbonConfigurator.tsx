import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { classNames } from "../../../utils/classNames";
import { Flag, Swords } from "../../icons";
import { Ribbon } from "../Ribbon";
import {
  AVATAR_CONFIG,
  copyRibbonSide,
  countRibbonSideChanges,
  RIBBON_DEFAULTS,
  RIBBON_FIELDS,
  RIBBON_GROUPS,
  SWALLOWTAIL_CONFIG,
  parseRibbonCssVars,
  toCssRule,
  toCssVars,
  toJsxStyle,
  type RibbonConfig,
  type RibbonField,
  type RibbonGroup,
} from "./Ribbon.config";
import styles from "./RibbonConfigurator.module.css";
import { PirateAvatar } from "../../PirateAvatar/PirateAvatar";

export interface IRibbonConfiguratorProps {
  /** Początkowa konfiguracja — domyślnie preset „Swallowtail”. */
  initialConfig?: RibbonConfig;
  /** Treść podglądowej wstążki. */
  children?: ReactNode;
  /** Nazwa selektora w generowanym CSS. */
  defaultSelector?: string;
  /** Wywoływane po każdej zmianie — pozwala wynieść stan wyżej. */
  onConfigChange?: (config: RibbonConfig) => void;
  className?: string;
}

type OutputFormat = "css" | "jsx";

const PRESETS: { name: string; config: RibbonConfig }[] = [
  { name: "Domyślny", config: RIBBON_DEFAULTS },
  { name: "Swallowtail", config: SWALLOWTAIL_CONFIG },
  { name: "Avatar", config: AVATAR_CONFIG },
];

/** Grupy, które opisują jedno zakończenie — tam ląduje przycisk „skopiuj na drugie”. */
const SIDE_OF_GROUP: Partial<Record<RibbonGroup, "left" | "right">> = {
  "Lewe zakończenie": "left",
  "Prawe zakończenie": "right",
};

/** „1 zmienioną wartość” / „3 zmienione wartości” / „7 zmienionych wartości”. */
const pluralValues = (count: number): string => {
  if (count === 1) return "1 zmienioną wartość";
  const rest = count % 10;
  const tens = count % 100;
  const isFew = rest >= 2 && rest <= 4 && (tens < 12 || tens > 14);
  return isFew
    ? `${count} zmienione wartości`
    : `${count} zmienionych wartości`;
};

/**
 * Interaktywny konfigurator zmiennych CSS wstążki.
 *
 * Trzyma stan w React i podaje go do `<Ribbon style={...} />` jako inline
 * custom properties, więc każda zmiana jest widoczna natychmiast. Ten sam stan
 * serializuje do gotowej reguły CSS lub fragmentu JSX — jednym kliknięciem
 * trafia do schowka, czyli da się go zapisać jako nową konfigurację.
 */
export const RibbonConfigurator = ({
  initialConfig = SWALLOWTAIL_CONFIG,
  children = "Custom swallowtail ribbon",
  defaultSelector = ".Swallowtail",
  onConfigChange,
  className,
}: IRibbonConfiguratorProps) => {
  const [config, setConfig] = useState<RibbonConfig>(() => ({
    ...initialConfig,
  }));
  const [selector, setSelector] = useState(defaultSelector);
  const [format, setFormat] = useState<OutputFormat>("css");
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [showFoldIcons, setShowFoldIcons] = useState(true);
  const [avatarOnLeft, setAvatarOnLeft] = useState(false);
  const [avatarOnRight, setAvatarOnRight] = useState(false);
  const [copied, setCopied] = useState(false);
  /**
   * Wersja tekstu z pola „Konfiguracja”, gdy użytkownik coś w nim zmieni lub
   * wklei. `null` = pole pokazuje wynik aktualnej konfiguracji.
   */
  const [outputDraft, setOutputDraft] = useState<string | null>(null);
  /** Potwierdzenie/ostrzeżenie po kliknięciu „Zastosuj wklejone”. */
  const [importStatus, setImportStatus] = useState<{
    tone: "ok" | "error";
    message: string;
  } | null>(null);
  /** Które zakończenie właśnie skopiowano — do potwierdzenia na przycisku. */
  const [sideCopied, setSideCopied] = useState<"left" | "right" | null>(null);

  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      if (sideTimeout.current) clearTimeout(sideTimeout.current);
    },
    [],
  );

  const updateField = useCallback(
    (key: keyof RibbonConfig, value: string | number) => {
      setConfig((previous) => {
        const next = { ...previous, [key]: value };
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange],
  );

  const applyConfig = (next: RibbonConfig) => {
    setConfig(next);
    setOutputDraft(null);
    setImportStatus(null);
    onConfigChange?.(next);
  };

  const cssVars = useMemo(() => toCssVars(config), [config]);

  const code = useMemo(
    () =>
      format === "css"
        ? toCssRule(config, selector.trim() || ".Swallowtail", onlyChanged)
        : toJsxStyle(config),
    [config, format, onlyChanged, selector],
  );

  /** To, co widzi użytkownik — wklejony/edytowany tekst albo wynik konfiguracji. */
  const visibleCode = outputDraft ?? code;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(visibleCode);
    } catch {
      // Starsze/przeglądarkowe konteksty bez Clipboard API — awaryjnie przez
      // zaznaczenie treści `<textarea>`.
      const area = document.createElement("textarea");
      area.value = visibleCode;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }

    setCopied(true);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopied(false), 1600);
  };

  /**
   * Kopiuje ustawienia jednego zakończenia na drugie. Przenosimy tylko
   * wartości inne niż domyślne — puste pole koloru po stronie źródłowej nie
   * wyczyści konfiguracji strony docelowej.
   */
  const copySide = (from: "left" | "right") => {
    applyConfig(copyRibbonSide(config, from));

    setSideCopied(from);
    if (sideTimeout.current) clearTimeout(sideTimeout.current);
    sideTimeout.current = setTimeout(() => setSideCopied(null), 1600);
  };

  /**
   * Zapisuje wklejone CSS vars w konfiguracji. Nadpisuje tylko te pola, które
   * znalazły się w tekście — można więc wkleić sam fragment z poprawkami.
   */
  const applyImportedStyle = () => {
    const parsed = parseRibbonCssVars(visibleCode);

    if (parsed.applied.length === 0) {
      setImportStatus({
        tone: "error",
        message:
          parsed.rejected.length > 0
            ? `Nie udało się zapisać: ${parsed.rejected
                .map((item) => `${item.cssVar} (${item.reason})`)
                .join(", ")}`
            : "Brak ribbonowych zmiennych CSS. Wklej np. --ribbon-fold-left-height: 2.4rem;",
      });
      return;
    }

    const next: RibbonConfig = { ...config, ...parsed.config };
    setConfig(next);
    onConfigChange?.(next);
    setOutputDraft(null);

    const details = [
      `Zastosowano ${parsed.applied.length} ${parsed.applied.length === 1 ? "zmienną" : "zmiennych"}`,
    ];
    if (parsed.rejected.length > 0)
      details.push(
        `pominięto ${parsed.rejected.length} (nieprzeliczalna wartość)`,
      );
    if (parsed.unknown.length > 0)
      details.push(`${parsed.unknown.length} poza wstążką`);

    setImportStatus({ tone: "ok", message: `${details.join(", ")}.` });
  };

  const changedCount = RIBBON_FIELDS.filter(
    (field) => config[field.key] !== RIBBON_DEFAULTS[field.key],
  ).length;

  return (
    <div className={classNames(styles.root, className)}>
      <div className={styles.previewArea}>
        <div className={styles.preview}>
          <div className={styles.previewInner}>
            <Ribbon
              style={cssVars}

              ribbonFoldLeftChildren={
                showFoldIcons ? (
                  <div style={{ flex: "0 0 auto" }}>
                    <Swords />
                  </div>
                ) : avatarOnLeft ? (
                  <div style={{ "--avatar-size": "96px" } as CSSProperties}>
                    <PirateAvatar />
                  </div>
                ) : undefined
              }
              ribbonFoldRightChildren={
                showFoldIcons ? (
                  <div style={{ flex: "0 0 auto" }}>
                    <Flag />
                  </div>
                ) : avatarOnRight ? (
                  <div style={{ "--avatar-size": "96px" } as CSSProperties}>
                    <PirateAvatar avatarIndex={2} />
                  </div>
                ) : undefined
              }
            >
              {children}
            </Ribbon>
          </div>
        </div>

        <label className={styles.hint}>
          <input
            type="checkbox"
            checked={showFoldIcons}
            onChange={(event) => setShowFoldIcons(event.target.checked)}
          />{" "}
          Ikony w zakończeniach (sprawdza, że treść nie jest przycinana przez
          `clip-path`)
        </label>

        <label className={styles.hint}>
          <input
            type="checkbox"
            disabled={showFoldIcons}
            checked={avatarOnLeft}
            onChange={(event) => setAvatarOnLeft(event.target.checked)}
          />{" "}
          Uzyj avatara w lewym zakonczeniu
        </label>
        <label className={styles.hint}>
          <input
            type="checkbox"
            disabled={showFoldIcons}
            checked={avatarOnRight}
            onChange={(event) => setAvatarOnRight(event.target.checked)}
          />{" "}
          Uzyj avatara w prawym zakonczeniu
        </label>
      </div>

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={styles.button}
              data-active={
                JSON.stringify(preset.config) === JSON.stringify(config)
                  ? "true"
                  : "false"
              }
              onClick={() => applyConfig({ ...preset.config })}
            >
              {preset.name}
            </button>
          ))}

          <span className={styles.toolbarSpacer} />

          <button
            type="button"
            className={styles.button}
            onClick={() => applyConfig({ ...initialConfig })}
          >
            Reset
          </button>
        </div>

        {RIBBON_GROUPS.map((group) => {
          const fields = RIBBON_FIELDS.filter((field) => field.group === group);
          if (fields.length === 0) return null;

          const groupChanged = fields.filter(
            (field) => config[field.key] !== RIBBON_DEFAULTS[field.key],
          ).length;

          const side = SIDE_OF_GROUP[group];
          const sideChanges = side ? countRibbonSideChanges(config, side) : 0;
          const sideTarget = side === "left" ? "prawe" : "lewe";

          return (
            <details className={styles.group} key={group}>
              <summary>
                {group}
                {groupChanged > 0 && (
                  <span className={styles.groupBadge}>{groupChanged}</span>
                )}
                {side && (
                  <button
                    type="button"
                    className={classNames(styles.button, styles.sideCopyButton)}
                    disabled={sideChanges === 0}
                    data-copied={sideCopied === side ? "true" : "false"}
                    title={
                      sideChanges === 0
                        ? `To zakończenie nie ma zmian względem domyślnych — nie ma czego przenieść na ${sideTarget}`
                        : `Przenieś ${pluralValues(sideChanges)} (geometrię i kolory) na ${sideTarget} zakończenie`
                    }
                    // Przycisk siedzi w `<summary>`, więc bez tego kliknięcie
                    // zwijałoby akordeon.
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      copySide(side);
                    }}
                  >
                    {sideCopied === side
                      ? "Skopiowano ✓"
                      : `Kopiuj na ${sideTarget}`}
                  </button>
                )}
              </summary>
              <div className={styles.groupBody}>
                {fields.map((field) => (
                  <Field
                    key={field.key}
                    field={field}
                    config={config}
                    onChange={updateField}
                  />
                ))}
              </div>
            </details>
          );
        })}

        <div className={styles.outputSection}>
          <div className={styles.outputHead}>
            <span className={styles.outputTitle}>Konfiguracja</span>

            <span className={styles.toolbarSpacer} />

            <button
              type="button"
              className={styles.button}
              data-active={format === "css" ? "true" : "false"}
              onClick={() => setFormat("css")}
            >
              CSS
            </button>
            <button
              type="button"
              className={styles.button}
              data-active={format === "jsx" ? "true" : "false"}
              onClick={() => setFormat("jsx")}
            >
              JSX
            </button>
            <button
              type="button"
              className={classNames(styles.button, styles.buttonPrimary)}
              data-copied={copied ? "true" : "false"}
              onClick={copy}
            >
              {copied ? "Skopiowano ✓" : "Kopiuj"}
            </button>
          </div>

          {format === "css" ? (
            <div className={styles.fieldControls}>
              <input
                className={styles.text}
                value={selector}
                onChange={(event) => setSelector(event.target.value)}
                aria-label="Selektor"
                spellCheck={false}
              />
              <label className={styles.hint}>
                <input
                  type="checkbox"
                  checked={onlyChanged}
                  onChange={(event) => setOnlyChanged(event.target.checked)}
                />{" "}
                tylko zmienione ({changedCount})
              </label>
            </div>
          ) : (
            <p className={styles.hint}>
              Gotowy `style` do wklejenia w `&lt;Ribbon /&gt;` — działa też poza
              Storybookiem.
            </p>
          )}

          <textarea
            className={styles.output}
            value={visibleCode}
            spellCheck={false}
            aria-label="Wygenerowana konfiguracja"
            placeholder={
              "Wklej tutaj ribbonowe CSS vars, np.\n--ribbon-fold-left-height: 2.4rem;\n--ribbon-background: #c9a227;"
            }
            onChange={(event) => {
              setOutputDraft(event.target.value);
              setImportStatus(null);
            }}
          />

          <div className={styles.outputActions}>
            <button
              type="button"
              className={styles.button}
              disabled={outputDraft === null || outputDraft.trim().length === 0}
              onClick={applyImportedStyle}
            >
              Zastosuj wklejone
            </button>
            <span className={styles.hint}>
              Wklej CSS vars (także całą regułę albo {"style={{ … }}"}) i zapisz
              je w konfiguracji. Każda zmienna musi być w jednej linijce (np
              definicja gradientu).
            </span>
          </div>

          {importStatus && (
            <p
              className={styles.outputStatus}
              data-tone={importStatus.tone}
              role="status"
            >
              {importStatus.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Pojedyncze pole ────────────────────────────────────────────────────── */

interface IFieldProps {
  field: RibbonField;
  config: RibbonConfig;
  /** `RibbonConfig[keyof RibbonConfig]` to `string | number`, więc wystarczy ta sygnatura. */
  onChange: (key: keyof RibbonConfig, value: string | number) => void;
}

const numberFrom = (event: ChangeEvent<HTMLInputElement>): number => {
  const parsed = Number.parseFloat(event.target.value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const Field = ({ field, config, onChange }: IFieldProps) => {
  const value = config[field.key];

  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <code className={styles.fieldVar}>{field.cssVar}</code>
      </div>

      {field.control === "range" && typeof value === "number" && (
        <>
          <div className={styles.fieldControls}>
            <input
              className={styles.slider}
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value}
              aria-label={field.label}
              onChange={(event) =>
                onChange(field.key, numberFrom(event) as never)
              }
            />
            <input
              className={styles.number}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value}
              aria-label={`${field.label} (wartość)`}
              onChange={(event) =>
                onChange(field.key, numberFrom(event) as never)
              }
            />
            <span className={styles.unit}>
              {field.unsetAtZero && value === 0 ? "unset" : "rem"}
            </span>
          </div>
          {field.hint && <span className={styles.hint}>{field.hint}</span>}
        </>
      )}

      {field.control === "color" && typeof value === "string" && (
        <div className={styles.colorRow}>
          <input
            className={styles.swatch}
            type="color"
            // `<input type="color">` nie zna pustej wartości — pokazujemy
            // kolor zastępczy, ale pole tekstowe zostaje puste (motyw rządzi).
            value={value || "#b83b2d"}
            aria-label={`${field.label} (próbnik)`}
            onChange={(event) =>
              onChange(field.key, event.target.value as never)
            }
          />
          <input
            className={styles.text}
            type="text"
            value={value}
            placeholder="z motywu"
            aria-label={field.label}
            spellCheck={false}
            onChange={(event) =>
              onChange(field.key, event.target.value as never)
            }
          />
          <button
            type="button"
            className={styles.swatchButton}
            title="Wyczyść (wróć do wartości z motywu)"
            aria-label={`Wyczyść ${field.cssVar}`}
            onClick={() => onChange(field.key, "" as never)}
          />
        </div>
      )}

      {field.control === "text" && typeof value === "string" && (
        <>
          <input
            className={styles.text}
            type="text"
            value={value}
            aria-label={field.label}
            spellCheck={false}
            onChange={(event) =>
              onChange(field.key, event.target.value as never)
            }
          />
          {field.hint && <span className={styles.hint}>{field.hint}</span>}
        </>
      )}
    </div>
  );
};
