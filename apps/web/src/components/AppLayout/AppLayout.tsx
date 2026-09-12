import { classNames } from "../../utils/classNames";
import styles from "./AppLayout.module.css";
import { FC, PropsWithChildren, ReactNode } from "react";

export const AppLayout: FC<
  PropsWithChildren<{
    header?: ReactNode;
    className?: string;
    headerClassName?: string;
  }>
> = ({ children, header, headerClassName, className }) => {
  return (
    <main className={classNames(styles.AppLayout, className)}>
      {header && (
        <header
          className={classNames(styles.AppLayout_header, headerClassName)}
        >
          {header}
        </header>
      )}
      {children}
    </main>
  );
};
