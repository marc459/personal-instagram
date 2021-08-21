import {
  Canvas,
  createCanvas,
  Image,
  NodeCanvasRenderingContext2D
} from 'canvas';

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
