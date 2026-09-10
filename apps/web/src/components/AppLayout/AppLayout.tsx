import { classNames } from "../../utils/classNames";
import styles from "./AppLayout.module.css";
import { FC, PropsWithChildren, ReactNode } from "react";

export const AppLayout: FC<
  PropsWithChildren<{
    header?: ReactNode;
    headerClassName?: string;
  }>
> = ({ children, header, headerClassName }) => {
  return (
    <main className={styles.AppLayout}>
      <header className={classNames(styles.AppLayout_header, headerClassName)}>
        {header}
      </header>
      {children}
    </main>
  );
};
