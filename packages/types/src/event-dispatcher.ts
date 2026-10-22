export type TUnsubscribe = () => boolean;
export type TListener<T> = (event: T) => void;
export interface IEventDispatcher<E = void> {
  /**
   * Register callback listener for event notification.
   * @param listener
   * @returns Unsubscription method
   */
  subscribe: (listener: TListener<E>) => TUnsubscribe;
  /**
   * Unregister callback listener from receiving event notifications.
   * @param listener
   * @returns
   */
  unsubscribe: (listener: TListener<E>) => boolean;
}
