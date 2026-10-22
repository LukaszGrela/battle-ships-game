/**
 * Makes partial selected as `K` fields.
 * Note: rest is not changed
 */
export type TPartialPick<T, K extends keyof T> = Partial<Pick<T, K>> &
  Omit<T, K>;

/**
 * Makes required selected as `K` fields, and rest is partial.
 */
export type TPartialWithRequired<T, K extends keyof T> = Required<Pick<T, K>> &
  Partial<Omit<T, K>>;

export type TDataProps = {
  [key: `data-${string}`]: string | boolean | number | undefined;
};

export type TStringifiedEnum<E extends string> = E | `${E}`;
