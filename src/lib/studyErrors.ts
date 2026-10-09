export class StudyCardUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudyCardUnavailableError";
  }
}
