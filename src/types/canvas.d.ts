export {};

declare global {
  interface CanvasRenderingContext2D {
    drawTextWithEmoji(
      fillType: string,
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
      emojiSideMarginPercent?: number,
      emojiTopMarginPercent?: number
    ): Promise<void>;
    drawTextAlongArc(
      str: string,
      centerX: number,
      centerY: number,
      radius: number,
      angle: number
    ): Promise<void>;
  }
}
