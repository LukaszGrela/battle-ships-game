import { classNames } from "../../utils/classNames";
import styles from "./Ribbon.module.css";
import { FC } from "react";
import { IProps } from "./types";

/**
 * Chorągiewka z wyciętymi zakończeniami.
 */
export const Ribbon: FC<IProps> = ({
  children,
  className,
  style,
  ribbonFoldRightChildren,
  ribbonFoldLeftChildren,
  ribbonFoldLeftClassName,
  ribbonFoldRightClassName,
}) => {
  return (
    <div className={classNames(styles.Ribbon, className)} style={style}>
      <div className={styles.ribbon}>
        {children}
        {/*
          *
          * `clip-path` przycina wszystko, co wychodzi poza obrys elementu — również
          * dzieci — więc treść nie może siedzieć w tym samym pudełku co kształt.
          * Dlatego każde zakończenie składa się z dwóch warstw:
          *
          * 1. **kształt** (`.ribbon-fold-shape`) — puste, pomalowane tło z `clip-path`,
          *    czyli wycięcie zostaje dokładnie takie jak wcześniej;
          * 2. **treść** (`.ribbon-fold-content`) — ten sam prostokąt, ale bez tła,
          *    bez `clip-path` i ponad panelem wstążki, więc `ribbonFold*Children`
          *    może być dowolnie duże i nic nie zostanie odcięte.
          *
          * Obie warstwy dostają klasy `ribbon-fold-left` / `-right`, żeby nie
          * duplikować wyliczeń pozycji, wysokości i szerokości.        
          */}
        <div
          aria-hidden="true"
          className={classNames(
            styles["ribbon-fold"],
            styles["ribbon-fold-left"],
            styles["ribbon-fold-shape"],
          )}
        />
        <div
          className={classNames(
            styles["ribbon-fold"],
            styles["ribbon-fold-left"],
            styles["ribbon-fold-content"],
            !!ribbonFoldLeftChildren && styles["ribbon-fold-children"],
            !!ribbonFoldLeftChildren && styles["ribbon-fold-children-left"],
            ribbonFoldLeftClassName,
          )}
        >
          {ribbonFoldLeftChildren}
        </div>
        <div
          aria-hidden="true"
          className={classNames(
            styles["ribbon-fold"],
            styles["ribbon-fold-right"],
            styles["ribbon-fold-shape"],
          )}
        />
        <div
          className={classNames(
            "ribbon-fold",
            styles["ribbon-fold"],
            styles["ribbon-fold-right"],
            styles["ribbon-fold-content"],
            !!ribbonFoldRightChildren && styles["ribbon-fold-children"],
            !!ribbonFoldRightChildren && styles["ribbon-fold-children-right"],
            ribbonFoldRightClassName,
          )}
        >
          {ribbonFoldRightChildren}
        </div>
      </div>
    </div>
  );
};
