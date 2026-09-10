import { seedRandom } from './seedRandom';

describe('utils', () => {
  describe('seedRandom', () => {
    // // Example usage:
    const seed = 1979;

    it('returns seeded random float', () => {
      const random = seedRandom(seed);

      const nextFloatNum = 0.003034226130694151;

      expect(random.nextFloat()).toBe(nextFloatNum);

      const random2 = seedRandom(seed);
      expect(random2.nextFloat()).toBe(nextFloatNum);
    });

    it('returns seeded random int', () => {
      const random = seedRandom(seed);

      const nextIntNum = 78;
      random.nextInt(100); // First is 0 for seed 1979 (small seed)

      expect(random.nextInt(100)).toBe(nextIntNum);

      const random2 = seedRandom(seed);
      random2.nextInt(100); // First is 0 for seed 1979 (small seed)
      expect(random2.nextInt(100)).toBe(nextIntNum);
    });

    it('returns seeded random range int', () => {
      const random = seedRandom(seed);

      const nextIntNum = 44;

      expect(random.nextInt(20, 50)).toBe(20);
      expect(random.nextInt(20, 50)).toBe(nextIntNum);

      const random2 = seedRandom(seed);

      expect(random2.nextInt(20, 50)).toBe(20);
      expect(random2.nextInt(20, 50)).toBe(nextIntNum);
    });
  });
});
