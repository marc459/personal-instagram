import { sortBy } from 'lodash';
import Color from 'color';
import CanvasImage from './canvas';
import { Image } from 'canvas';

const THRESHOLD_CONTRAST_RATIO = 1.0;
const MINIMUM_CONTRAST_RATIO = 4.5;
let totalPixelCount = 0;
let RGBToPixelCountMap = {};

function getRGBRange(color: Color) {
  const rgb = sortBy(color.rgb().array()).reverse();
  const [max, min] = rgb;
  return (max - min) / 10;
}

function getPixelDominance(color: Color) {
  //@ts-ignore
  const pixelCount: number = RGBToPixelCountMap[color];
  return pixelCount / totalPixelCount;
}

function calculateTotalPairScore(pairs) {
  return pairs.reduce((score, color) => score + color.score, 0);
}

function sortPairsByScore(pairs: ColorPairings) {
  pairs.sort((a, b) => {
    if (a.score === b.score) {
      return 0;
    }
    return a.score > b.score ? -1 : 1;
  });
}

function getMostDominantPrimaryColor(WCAGCompliantColorPairs: ColorPairingMap) {
  let highestDominanceScore = 0;
  let mostDominantColor = '';
  for (const dominantColor in WCAGCompliantColorPairs) {
    const pairs = WCAGCompliantColorPairs[dominantColor];
    //@ts-ignore
    const dominance = getPixelDominance(dominantColor);
    const totalPairScore = calculateTotalPairScore(pairs);
    const score = pairs.length
      ? (pairs.length + totalPairScore) * dominance
      : 0;
    if (score > highestDominanceScore) {
      highestDominanceScore = score;
      mostDominantColor = dominantColor;
    }
  }
  sortPairsByScore(WCAGCompliantColorPairs[mostDominantColor]);
  return new Color(mostDominantColor);
}

function getColorPalette(image): Color[] {
  totalPixelCount = 0;
  RGBToPixelCountMap = {};
  return getPalette(image).map((color) => {
    const colorWrapper: Color = new Color(color.rgb);
    //@ts-ignore
    RGBToPixelCountMap[colorWrapper] = color.count;
    totalPixelCount += color.count;
    return colorWrapper;
  });
}

const pv = {
  map: function (array, f) {
    const o: any = {};
    return f
      ? array.map(function (d, i) {
          o.index = i;
          return f.call(o, d);
        })
      : array.slice();
  },
  naturalOrder: function (a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  },
  sum: function (array: any[], f?: any) {
    const o: any = {};
    return array.reduce(
      f
        ? function (p, d, i) {
            o.index = i;
            return p + f.call(o, d);
          }
        : function (p, d) {
            return p + d;
          },
      0
    );
  },
  max: function (array, f?: any) {
    return Math.max.apply(null, f ? pv.map(array, f) : array);
  }
};

const MMCQ = (function () {
  // private constants
  const sigbits = 5,
    rshift = 8 - sigbits,
    maxIterations = 1000,
    fractByPopulations = 0.75;

  // get reduced-space color index for a pixel
  function getColorIndex(r, g, b) {
    return (r << (2 * sigbits)) + (g << sigbits) + b;
  }

  // Simple priority queue
  function PQueue(comparator) {
    const contents: any[] = [];
    let sorted = false;

    function sort() {
      contents.sort(comparator);
      sorted = true;
    }

    return {
      push: function (o) {
        contents.push(o);
        sorted = false;
      },
      peek: function (index) {
        if (!sorted) sort();
        if (index === undefined) index = contents.length - 1;
        return contents[index];
      },
      pop: function () {
        if (!sorted) sort();
        return contents.pop();
      },
      size: function () {
        return contents.length;
      },
      map: function (f) {
        return contents.map(f);
      },
      debug: function () {
        if (!sorted) sort();
        return contents;
      }
    };
  }

  // 3d color space box
  function VBox(r1, r2, g1, g2, b1, b2, histo) {
    this.r1 = r1;
    this.r2 = r2;
    this.g1 = g1;
    this.g2 = g2;
    this.b1 = b1;
    this.b2 = b2;
    this.histo = histo;
  }
  VBox.prototype = {
    volume: function (force) {
      if (!this._volume || force) {
        this._volume =
          (this.r2 - this.r1 + 1) *
          (this.g2 - this.g1 + 1) *
          (this.b2 - this.b1 + 1);
      }
      return this._volume;
    },
    count: function (force) {
      const histo = this.histo;
      if (!this._count_set || force) {
        let npix = 0,
          i,
          j,
          k;
        for (i = this.r1; i <= this.r2; i++) {
          for (j = this.g1; j <= this.g2; j++) {
            for (k = this.b1; k <= this.b2; k++) {
              const index = getColorIndex(i, j, k);
              npix += histo[index] || 0;
            }
          }
        }
        this._count = npix;
        this._count_set = true;
      }
      return this._count;
    },
    copy: function () {
      return new VBox(
        this.r1,
        this.r2,
        this.g1,
        this.g2,
        this.b1,
        this.b2,
        this.histo
      );
    },
    avg: function (force) {
      const histo = this.histo;
      if (!this._avg || force) {
        const mult = 1 << (8 - sigbits);
        let ntot = 0,
          rsum = 0,
          gsum = 0,
          bsum = 0,
          hval,
          i,
          j,
          k,
          histoindex;
        for (i = this.r1; i <= this.r2; i++) {
          for (j = this.g1; j <= this.g2; j++) {
            for (k = this.b1; k <= this.b2; k++) {
              histoindex = getColorIndex(i, j, k);
              hval = histo[histoindex] || 0;
              ntot += hval;
              rsum += hval * (i + 0.5) * mult;
              gsum += hval * (j + 0.5) * mult;
              bsum += hval * (k + 0.5) * mult;
            }
          }
        }
        if (ntot) {
          this._avg = [~~(rsum / ntot), ~~(gsum / ntot), ~~(bsum / ntot)];
        } else {
          this._avg = [
            ~~((mult * (this.r1 + this.r2 + 1)) / 2),
            ~~((mult * (this.g1 + this.g2 + 1)) / 2),
            ~~((mult * (this.b1 + this.b2 + 1)) / 2)
          ];
        }
      }
      return this._avg;
    },
    contains: function (pixel) {
      const rval = pixel[0] >> rshift;
      const gval = pixel[1] >> rshift;
      const bval = pixel[2] >> rshift;
      return (
        rval >= this.r1 &&
        rval <= this.r2 &&
        gval >= this.g1 &&
        gval <= this.g2 &&
        bval >= this.b1 &&
        bval <= this.b2
      );
    }
  };

  // Color map
  function CMap() {
    this.vboxes = PQueue(function (a, b) {
      return pv.naturalOrder(
        a.vbox.count() * a.vbox.volume(),
        b.vbox.count() * b.vbox.volume()
      );
    });
  }
  CMap.prototype = {
    push: function (vbox) {
      this.vboxes.push({
        vbox: vbox,
        rgb: vbox.avg(),
        count: vbox.count()
      });
    },
    palette: function () {
      return this.vboxes.map(function (vb) {
        return { rgb: vb.rgb, count: vb.count };
      });
    },
    size: function () {
      return this.vboxes.size();
    },
    map: function (color) {
      const vboxes = this.vboxes;
      for (let i = 0; i < vboxes.size(); i++) {
        if (vboxes.peek(i).vbox.contains(color)) {
          return vboxes.peek(i).color;
        }
      }
      return this.nearest(color);
    },
    nearest: function (color) {
      const vboxes = this.vboxes;
      let d1, d2, pColor;
      for (let i = 0; i < vboxes.size(); i++) {
        d2 = Math.sqrt(
          Math.pow(color[0] - vboxes.peek(i).color[0], 2) +
            Math.pow(color[1] - vboxes.peek(i).color[1], 2) +
            Math.pow(color[2] - vboxes.peek(i).color[2], 2)
        );
        if (d2 < d1 || d1 === undefined) {
          d1 = d2;
          pColor = vboxes.peek(i).color;
        }
      }
      return pColor;
    },
    forcebw: function () {
      // XXX: won't  work yet
      const vboxes = this.vboxes;
      vboxes.sort(function (a, b) {
        return pv.naturalOrder(pv.sum(a.color), pv.sum(b.color));
      });

      // force darkest color to black if everything < 5
      const lowest = vboxes[0].color;
      if (lowest[0] < 5 && lowest[1] < 5 && lowest[2] < 5)
        vboxes[0].color = [0, 0, 0];

      // force lightest color to white if everything > 251
      const idx = vboxes.length - 1,
        highest = vboxes[idx].color;
      if (highest[0] > 251 && highest[1] > 251 && highest[2] > 251)
        vboxes[idx].color = [255, 255, 255];
    }
  };

  // histo (1-d array, giving the number of pixels in
  // each quantized region of color space), or null on error
  function getHisto(pixels): number[] {
    const histo = 1 << (3 * sigbits),
      res: any[] = [];
    let index, rval, gval, bval;
    pixels.forEach(function (pixel) {
      rval = pixel[0] >> rshift;
      gval = pixel[1] >> rshift;
      bval = pixel[2] >> rshift;
      index = getColorIndex(rval, gval, bval);
      res[index] = (histo[index] || 0) + 1;
    });
    return res;
  }

  function vboxFromPixels(pixels, histo) {
    let rmin = 1000000,
      rmax = 0,
      gmin = 1000000,
      gmax = 0,
      bmin = 1000000,
      bmax = 0,
      rval,
      gval,
      bval;
    // find min/max
    pixels.forEach(function (pixel) {
      rval = pixel[0] >> rshift;
      gval = pixel[1] >> rshift;
      bval = pixel[2] >> rshift;
      if (rval < rmin) rmin = rval;
      else if (rval > rmax) rmax = rval;
      if (gval < gmin) gmin = gval;
      else if (gval > gmax) gmax = gval;
      if (bval < bmin) bmin = bval;
      else if (bval > bmax) bmax = bval;
    });
    return new VBox(rmin, rmax, gmin, gmax, bmin, bmax, histo);
  }

  function medianCutApply(histo, vbox) {
    if (!vbox.count()) return;

    const rw = vbox.r2 - vbox.r1 + 1,
      gw = vbox.g2 - vbox.g1 + 1,
      bw = vbox.b2 - vbox.b1 + 1,
      maxw = pv.max([rw, gw, bw]);
    // only one pixel, no split
    if (vbox.count() == 1) {
      return [vbox.copy()];
    }
    /* Find the partial sum arrays along the selected axis. */
    const partialsum: number[] = [],
      lookaheadsum: number[] = [];
    let total = 0,
      i,
      j,
      k,
      sum,
      index;
    if (maxw == rw) {
      for (i = vbox.r1; i <= vbox.r2; i++) {
        sum = 0;
        for (j = vbox.g1; j <= vbox.g2; j++) {
          for (k = vbox.b1; k <= vbox.b2; k++) {
            index = getColorIndex(i, j, k);
            sum += histo[index] || 0;
          }
        }
        total += sum;
        partialsum[i] = total;
      }
    } else if (maxw == gw) {
      for (i = vbox.g1; i <= vbox.g2; i++) {
        sum = 0;
        for (j = vbox.r1; j <= vbox.r2; j++) {
          for (k = vbox.b1; k <= vbox.b2; k++) {
            index = getColorIndex(j, i, k);
            sum += histo[index] || 0;
          }
        }
        total += sum;
        partialsum[i] = total;
      }
    } else {
      /* maxw == bw */
      for (i = vbox.b1; i <= vbox.b2; i++) {
        sum = 0;
        for (j = vbox.r1; j <= vbox.r2; j++) {
          for (k = vbox.g1; k <= vbox.g2; k++) {
            index = getColorIndex(j, k, i);
            sum += histo[index] || 0;
          }
        }
        total += sum;
        partialsum[i] = total;
      }
    }
    partialsum.forEach(function (d, i) {
      lookaheadsum[i] = total - d;
    });
    function doCut(color) {
      const dim1 = `${color}1`,
        dim2 = `${color}2`;
      let left,
        right,
        vbox1,
        vbox2,
        d2,
        count2 = 0;
      for (i = vbox[dim1]; i <= vbox[dim2]; i++) {
        if (partialsum[i] > total / 2) {
          vbox1 = vbox.copy();
          vbox2 = vbox.copy();
          left = i - vbox[dim1];
          right = vbox[dim2] - i;
          if (left <= right) d2 = Math.min(vbox[dim2] - 1, ~~(i + right / 2));
          else d2 = Math.max(vbox[dim1], ~~(i - 1 - left / 2));
          // avoid 0-count boxes
          while (!partialsum[d2]) d2++;
          count2 = lookaheadsum[d2];
          while (!count2 && partialsum[d2 - 1]) count2 = lookaheadsum[--d2];
          // set dimensions
          vbox1[dim2] = d2;
          vbox2[dim1] = vbox1[dim2] + 1;
          return [vbox1, vbox2];
        }
      }
    }
    // determine the cut planes
    return maxw == rw ? doCut('r') : maxw == gw ? doCut('g') : doCut('b');
  }

  function quantize(pixels, maxcolors) {
    // short-circuit
    if (!pixels.length || maxcolors < 2 || maxcolors > 256) {
      return new CMap();
    }

    // XXX: check color content and convert to grayscale if insufficient

    const histo = getHisto(pixels);
    // check that we aren't below maxcolors already
    let nColors = 0;
    histo.forEach(function () {
      nColors++;
    });

    if (nColors <= maxcolors) {
      // XXX: generate the new colors from the histo and return
    }

    // get the beginning vbox from the colors
    const vbox = vboxFromPixels(pixels, histo),
      pq = PQueue(function (a, b) {
        return pv.naturalOrder(a.count(), b.count());
      });
    pq.push(vbox);

    // inner function to do the iteration
    function iter(lh, target) {
      let ncolors = 1,
        niters = 0,
        vbox;
      while (niters < maxIterations) {
        vbox = lh.pop();
        if (!vbox.count()) {
          /* just put it back */
          lh.push(vbox);
          niters++;
          continue;
        }
        // do the cut
        const vboxes = medianCutApply(histo, vbox),
          vbox1 = vboxes![0],
          vbox2 = vboxes![1];

        if (!vbox1) {
          return;
        }
        lh.push(vbox1);
        if (vbox2) {
          /* vbox2 can be null */
          lh.push(vbox2);
          ncolors++;
        }
        if (ncolors >= target) return;
        if (niters++ > maxIterations) {
          return;
        }
      }
    }

    // first set of colors, sorted by population
    iter(pq, fractByPopulations * maxcolors);

    // Re-sort by the product of pixel occupancy times the size in color space.
    const pq2 = PQueue(function (a, b) {
      return pv.naturalOrder(a.count() * a.volume(), b.count() * b.volume());
    });
    while (pq.size()) {
      pq2.push(pq.pop());
    }

    // next set - generate the median cuts using the (npix * vol) sorting.
    iter(pq2, maxcolors - pq2.size());

    // calculate the actual colors
    const cmap = new CMap();
    while (pq2.size()) {
      cmap.push(pq2.pop());
    }

    return cmap;
  }

  return {
    quantize: quantize
  };
})();

const getPaletteFromPixels = function (
  pixels,
  pixelCount,
  colorCount,
  quality
) {
  // Store the RGB values in an array format suitable for quantize function
  const pixelArray: any[] = [];
  for (let i = 0, offset, r, g, b, a; i < pixelCount; i = i + quality) {
    offset = i * 4;
    r = pixels[offset + 0];
    g = pixels[offset + 1];
    b = pixels[offset + 2];
    a = pixels[offset + 3];
    // If pixel is mostly opaque and not white
    if (a >= 125) {
      if (!(r > 255 && g > 255 && b > 255)) {
        pixelArray.push([r, g, b]);
      }
    }
  }

  // Send array to quantize function which clusters values
  // using median cut algorithm
  const cmap = MMCQ.quantize(pixelArray, colorCount);
  const palette = cmap.palette();
  return palette;
};

export const getPalette = (
  sourceImage: Image,
  colorCount = 5,
  quality = 5
): Array<{
  color: string;
  count: number;
  rgb: string;
}> => {
  if (colorCount < 2 || colorCount > 256) {
    colorCount = 5;
  }
  if (quality < 1) {
    quality = 5;
  }

  // Create custom CanvasImage object.
  const image = new CanvasImage(sourceImage);
  const imageData = image.getImageData();
  const pixels = imageData.data;
  const pixelCount = image.getPixelCount();
  const palette = getPaletteFromPixels(pixels, pixelCount, colorCount, quality);
  return palette;
};

export default function getImagePalette(image: Image): Palette {
  const palettes = getColorPalette(image) as Color[];
  const WCAGCompliantColorPairs: ColorPairingMap = {};
  palettes.forEach((dominantColor) => {
    //@ts-ignore
    const pairs: any[] = (WCAGCompliantColorPairs[dominantColor] = []);
    palettes.forEach((color) => {
      let contrast = dominantColor.contrast(color);
      if (contrast > THRESHOLD_CONTRAST_RATIO) {
        const range = getRGBRange(color);
        if (contrast < MINIMUM_CONTRAST_RATIO) {
          const delta = (MINIMUM_CONTRAST_RATIO - contrast) / 20;
          let lighten = dominantColor.isLight();
          while (contrast < MINIMUM_CONTRAST_RATIO) {
            const newColor = lighten
              ? color.lighten(delta)
              : color.darken(delta);
            // If the new color is the same as the old one, we're not getting any
            // lighter or darker so we need to stop.
            if (newColor.hex() === color.hex()) {
              break;
            }
            const newContrast = dominantColor.contrast(newColor);
            // If the new contrast is lower than the old contrast
            // then we need to start moving the other direction in the spectrum
            if (newContrast < contrast) {
              lighten = !lighten;
            }
            color = newColor;
            contrast = newContrast;
          }
        }
        const score = contrast + range;
        pairs.push({ color, score, contrast });
      }
    });
  });
  const backgroundColor = getMostDominantPrimaryColor(WCAGCompliantColorPairs);
  // eslint-disable-next-line prefer-const
  let [color, alternativeColor, accentColor] =
    //@ts-ignore
    WCAGCompliantColorPairs[backgroundColor]; // eslint-disable
  if (!alternativeColor) {
    alternativeColor = color;
  }
  if (!accentColor) {
    accentColor = alternativeColor;
  }
  return {
    backgroundColor: backgroundColor.hex(),
    color: color.color.hex(),
    alternativeColor: alternativeColor.color.hex()
  };
}
