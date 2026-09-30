export class InvalidVideoInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidVideoInputError";
  }
}
