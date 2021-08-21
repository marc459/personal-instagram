import Color from 'color';

declare global {
  type ColorDescriptor = {
    color: Color;
    score: number;
    contrast: number;
  };

  type Palette = {
    backgroundColor: string;
    color: string;
    alternativeColor: string;
  };

  type ColorPairings = Array<ColorDescriptor>;

  type ColorPairingMap = {
    [key: string]: ColorPairings;
  };
}
