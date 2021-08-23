import {
  Canvas,
  createCanvas,
  Image,
  NodeCanvasRenderingContext2D
} from 'canvas';
import _Canvas from 'canvas';
import {
  getFontSizeByCssFont,
  loadTwemojiImageByUrl,
  splitEntitiesFromText
} from './emoji';

export default class CanvasImage {
  public canvas: Canvas;
  public context: NodeCanvasRenderingContext2D;
  public width: number;
  public height: number;

  constructor(image: Image) {
    const { width, height } = image;
    this.canvas = createCanvas(width, height);
    this.context = this.canvas.getContext('2d');
    this.width = width;
    this.height = height;
    this.context.drawImage(image, 0, 0, this.width, this.height);
  }

  clear(): void {
    this.context.clearRect(0, 0, this.width, this.height);
  }

  update(imageData: ImageData): void {
    this.context.putImageData(imageData, 0, 0);
  }

  getPixelCount(): number {
    return this.width * this.height;
  }

  getImageData(): ImageData {
    return this.context.getImageData(0, 0, this.width, this.height);
  }
}

_Canvas.CanvasRenderingContext2D.prototype.drawTextWithEmoji = async function (
  fillType: string,
  text: string,
  x: number,
  y: number,
  maxWidth?: number,
  emojiSideMarginPercent = 0.1
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const ctx: NodeCanvasRenderingContext2D = this;
  const textEntities = splitEntitiesFromText(text);
  const fontSize = getFontSizeByCssFont(ctx.font);
  const emojiSideMargin = fontSize * emojiSideMarginPercent;
  let currentWidth = 0;

  for (let i = 0; i < textEntities.length; i++) {
    const entity = textEntities[i];
    if (typeof entity === 'string') {
      // Common text case
      if (fillType === 'fill') {
        ctx.fillText(entity, x + currentWidth, y, maxWidth);
      } else {
        ctx.strokeText(entity, x + currentWidth, y, maxWidth);
      }
      currentWidth += ctx.measureText(entity).width;
    } else {
      // Emoji case
      const emoji = await loadTwemojiImageByUrl(entity.url, x);
      ctx.drawImage(
        emoji,
        x - emoji.width,
        y - emoji.height,
        fontSize,
        fontSize
      );
      currentWidth += fontSize + emojiSideMargin * 2;
    }
  }
};

_Canvas.CanvasRenderingContext2D.prototype.drawTextAlongArc = async function (
  str: string,
  centerX: number,
  centerY: number,
  radius: number,
  angle: number
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const ctx: NodeCanvasRenderingContext2D = this;
  const len = str.length;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((-1 * angle) / 2);
  ctx.rotate((-1 * (angle / len)) / 2);
  for (let n = 0; n < len; n++) {
    ctx.rotate(angle / len);
    ctx.save();
    ctx.translate(0, -1 * radius);
    ctx.fillText(str[n], 0, 0);
    ctx.restore();
  }
  ctx.restore();
};
