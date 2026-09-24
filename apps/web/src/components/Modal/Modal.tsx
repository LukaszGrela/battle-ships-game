import styles from "./Modal.module.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "../Button/Button";
import { Close } from "../icons";
import { TProps } from "./types";
import { classNames } from "../../utils/classNames";
import { TDataProps } from "@repo/types";

export function Modal({
  open,
  onClose,
  children,
  footer,
  className,
  dialogClassName,
  bodyClassName,
  headerClassName,
  backdrop = true,
  keyboard = true,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy = "Modal-header-title",
  ...conditionalProps
}: TProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  const handleCancel: React.KeyboardEventHandler<HTMLDialogElement> =
    useCallback(
      (e) => {
        console.log("onCancel", keyboard);
        if (!keyboard && e.key === "Escape") {
          e.preventDefault();
        }
      },
      [keyboard],
    );

  const onCloseHandler = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (conditionalProps.confirm) {
      conditionalProps.onConfirm?.();
    }
    onClose?.();
  }, [onClose, conditionalProps]);

  const handleBackdropClick: React.MouseEventHandler<HTMLDialogElement> =
    useCallback(
      (e) => {
        if (backdrop && e.target === ref.current) onClose?.();
      },
      [onClose, backdrop],
    );

  const dataProps = useMemo(() => {
    return Object.entries(conditionalProps)
      .filter(([prop]) => prop.startsWith("data-"))
      .reduce((acc, [prop, value]) => {
        return { ...acc, [prop]: value };
      }, {} as TDataProps);
  }, [conditionalProps]);

  return (
    <dialog
      className={classNames(styles.Modal, className)}
      ref={ref}
      onKeyDown={handleCancel}
      onClick={handleBackdropClick}
      onClose={onClose}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <div
        className={classNames(styles.Modal_dialog, dialogClassName)}
        {...dataProps}
      >
        {!conditionalProps.hideHeader && (
          <div className={classNames(styles.Modal_header, headerClassName)}>
            {!conditionalProps.title &&
              conditionalProps.header &&
              conditionalProps.header(open, onCloseHandler)}
            {!conditionalProps.header && (
              <>
                <h2 id={ariaLabelledBy}>{conditionalProps.title}</h2>
                <Button
                  type="custom"
                  onClick={onClose}
                  className={styles.closeBtn}
                >
                  <Close />
                </Button>
              </>
            )}
          </div>
        )}
        <div className={classNames(styles.Modal_body, bodyClassName)}>
          {children}
        </div>
        {footer && (
          <div className={styles.Modal_footer}>
            {footer(open, onCloseHandler)}
          </div>
        )}
        {!footer && conditionalProps.confirm && (
          <div className={styles.Modal_footer}>
            <Button type="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="primary" onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}
