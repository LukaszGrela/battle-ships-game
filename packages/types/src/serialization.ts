export interface ISerializable {
  serialize(): string;
}

export interface IDeserializableClass<C> {
  new (): C;

  deserialize(data: string): C;
}
