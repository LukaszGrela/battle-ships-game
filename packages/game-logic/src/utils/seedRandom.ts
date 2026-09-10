export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  private next(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    this.seed = (a * this.seed + c) % m;
    return this.seed;
  }

  public nextFloat(): number {
    return this.next() / 2 ** 32;
  }

  public nextInt(max: number): number;
  public nextInt(min: number, max: number): number;
  public nextInt(minMax: number, max?: number): number {
    if (max === undefined) {
      return Math.floor(this.nextFloat() * minMax);
    }
    return Math.floor(this.nextFloat() * (max - minMax + 1)) + minMax;
  }
}

export const seedRandom = (seed: number) => {
  const random = new SeededRandom(seed);

  return random;
};

// // Example usage:
// const seed = 1979;
// const random = seedRandom(seed);

// console.log(random.nextFloat()); // Random float between 0 and 1
// console.log(random.nextInt(100)); // Random integer between 0 and 99
// console.log(random.nextInt(0, 20)); // Random integer between 10 and 20
// console.log(random.nextInt(0, 20)); // Random integer between 10 and 20
// console.log(random.nextInt(0, 20)); // Random integer between 10 and 20
// console.log(random.nextInt(0, 20)); // Random integer between 10 and 20
