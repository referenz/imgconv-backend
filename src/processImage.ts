import sharp from 'sharp';
import FormData from 'form-data';
import { InputData, LosslessImgData, LossyImgData, Manifest } from './types.js';
import debugDecorator from './debugDecorator.js';

export default class ProcessImage {
  private buffer?: Buffer;
  private filename?: string;
  private error?: string;
  private qualities = [70, 75, 80, 85];

  private constructor(args: { buffer: Buffer; filename: string } | { error: string }) {
    if ('buffer' in args) {
      this.buffer = args.buffer;
      this.filename = args.filename;
    }
    if ('error' in args) this.error = args.error;
  }

  @debugDecorator()
  static fromBuffer(buffer: Buffer, filename: string, filetype: string): ProcessImage {
    const type = filetype.split('/')[1];
    if (!(type in sharp.format) || sharp.format[type as keyof sharp.FormatEnum].input.buffer === false)
      return new ProcessImage({ error: 'Kann Dateiformat nicht verarbeiten' });

    return new ProcessImage({
      buffer: buffer,
      filename: filename.split('.')[0],
    });
  }

  /* fromFile(_path) {} */
  /* fromURL(_url) {} */

  private toWebP(quality: number): Promise<Buffer> {
    if (quality == undefined) return sharp(this.buffer).webp().toBuffer();
    else return sharp(this.buffer).webp({ quality: quality }).toBuffer();
  }

  private async makeWebPs(): Promise<Map<number, Buffer>> {
    const returnobj = new Map<number, Buffer>();
    for (const q of this.qualities) {
      returnobj.set(q, await this.toWebP(q));
    }
    return returnobj;
  }

  private async toJPEG(quality: number): Promise<Buffer> {
    const encodedJPEG = await sharp(this.buffer)
      .jpeg({
        quality: quality,
        quantisationTable: 3,
        optimiseScans: true,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer();
    return encodedJPEG;
  }

  private async makeJPEGs(): Promise<Map<number, Buffer>> {
    const returnobj = new Map<number, Buffer>();
    for (const q of this.qualities) {
      returnobj.set(q, await this.toJPEG(q));
    }
    return returnobj;
  }

  /*
    private async toPNG(): Promise<Buffer> {
        const encode = await import('@wasm-codecs/oxipng');
        return encode.default(await sharp(this.buffer).png().toBuffer());
    }
    */

  private async toPNG(): Promise<Buffer> {
    return await sharp(this.buffer)
      .png({ adaptiveFiltering: true, palette: true, compressionLevel: 9, effort: 8 })
      .toBuffer();
  }

  private async getFiletype(): Promise<string> {
    const meta = await sharp(this.buffer).metadata();
    return meta.format as string;
  }

  private async getFilesize(): Promise<number> {
    const meta = await sharp(this.buffer).metadata();
    return meta.size as number;
  }

  @debugDecorator()
  private async createImages(): Promise<[Manifest, Map<string, Buffer>]> {
    const images = new Map<string, Buffer>();
    const manifest: Manifest = {};

    manifest['inputfile'] = {
      filesize: await this.getFilesize(),
      filename: this.filename as string,
      filetype: await this.getFiletype(),
    };

    // WebP
    for (const [q, buff] of await this.makeWebPs()) {
      const handle = 'webp-q' + q;
      const values: LossyImgData = {
        quality: q,
        filesize: buff.length,
        filename: this.filename + '-q' + q + '.webp',
      };
      manifest[handle] = values;
      images.set(handle, buff);
    }

    // WebP nearlossless
    const webpLosslessbuffer = await sharp(this.buffer).webp({ nearLossless: true }).toBuffer();
    const webpLossless: LosslessImgData = {
      filesize: webpLosslessbuffer.length,
      filename: this.filename + '-nearLossless.webp',
    };
    manifest['webp-nearLossless'] = webpLossless;
    images.set('webp-nearLossless', webpLosslessbuffer);

    // JPEG
    for (const [q, buff] of await this.makeJPEGs()) {
      const handle = 'jpeg-q' + q;
      const values: LossyImgData = {
        quality: q,
        filesize: buff.length,
        filename: this.filename + '-q' + q + '.jpeg',
      };
      manifest[handle] = values;
      images.set(handle, buff);
    }

    // PNG
    const pngBuffer = await this.toPNG();
    const png: LosslessImgData = {
      filesize: pngBuffer.length,
      filename: this.filename + '.png',
    };
    manifest['png'] = png;
    images.set('png', pngBuffer);

    return [manifest, images];
  }

  @debugDecorator()
  async toFormData(): Promise<[FormData, string]> {
    const formdata = new FormData();

    if (this.error) {
      formdata.append('error', this.error);
      return [formdata, formdata.getBoundary()];
    }

    const [data, images] = await this.createImages();
    formdata.append('manifest', JSON.stringify(data));

    for (const curr in data) {
      const type = curr.split('-')[0];
      formdata.append(curr, `data:image/${type};base64,` + images.get(curr)?.toString('base64'), data[curr].filename);
    }

    return [formdata, formdata.getBoundary()];
  }
}
