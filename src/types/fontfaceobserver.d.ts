declare module "fontfaceobserver" {
  export default class FontFaceObserver {
    constructor(family: string, options?: { weight?: string | number; style?: string });
    load(
      text?: string,
      timeout?: number
    ): Promise<void>;
  }
}
