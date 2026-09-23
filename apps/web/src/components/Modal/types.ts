import type { ReactNode } from "react";

type TConfirmModal = {
  confirm: true;
  footer?: never;
  onConfirm?: () => void;
};
type TCustomDialog = {
  confirm?: false;
  footer?: (open: boolean, onClose: () => void) => React.ReactNode;
};
type THeaderRenderProps = {
  title?: never;
  header: (open: boolean, onClose: () => void) => React.ReactNode;

  hideHeader?: false;
};
type TTitleProps = {
  title: Exclude<ReactNode, null | undefined | boolean>;
  header?: never;
  hideHeader?: false;
};

type THeaderProps = { hideHeader: true } | (THeaderRenderProps | TTitleProps);

export type TProps = {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /**
   * When `true` backdrop can be clicked to close
   * Default `true`.
   */
  backdrop?: boolean;
  /**
   * When `true` modal is closed with Escape key.
   * Default `true`.
   */
  keyboard?: boolean;
  /**
   * Class name applied on the `dialog` element, this is for backdrop style mostly.
   */
  className?: string;
  /**
   * Class name applied on the UI of the modal
   */
  dialogClassName?: string;
  /**
   * Class name applied on the content body wrapper of the modal
   */
  bodyClassName?: string;
  "aria-labelledby"?: string;
} & (TConfirmModal | TCustomDialog) &
  THeaderProps;
