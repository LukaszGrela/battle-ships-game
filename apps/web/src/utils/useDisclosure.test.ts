import { act, renderHook } from '@testing-library/react';
import { useDisclosure } from './useDisclosure';

describe('hooks', () => {
  describe('useDisclosure', () => {
    it('sets toggles state correctly', () => {
      const { result, rerender } = renderHook(() => useDisclosure());

      expect(result.current.isOpen).toBe(false);

      act(() => result.current.toggle());
      rerender();

      expect(result.current.isOpen).toBe(true);
    });

    it('sets value to true when opened', () => {
      const { result, rerender } = renderHook(() => useDisclosure());

      expect(result.current.isOpen).toBe(false);

      act(() => result.current.open());
      rerender();

      expect(result.current.isOpen).toBe(true);
    });

    it('sets value to false when opened', () => {
      const { result, rerender } = renderHook(() => useDisclosure(true));

      expect(result.current.isOpen).toBe(true);

      act(() => result.current.close());
      rerender();

      expect(result.current.isOpen).toBe(false);
    });
  });
});
