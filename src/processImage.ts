import { createClient } from 'redis';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import FormData from 'form-data';
import type { IRedisValue, Format, IFileInfo } from './types.js';

type Base64 = string;
/*
type Base64<imageType extends string> = `data:image/${imageType};base64${string}`
const base64: Base64<'png'> = 'data:image/png;base64test...'
*/

export default class ProcessImage {
  static async fromBuffer(buffer: Buffer, filename: string, filetype: string): Promise<[boolean, string]> {
    const type = filetype.split('/')[1];
    if (!(type in sharp.format) || sharp.format[type as keyof sharp.FormatEnum].input.buffer === false)
      return [false, JSON.stringify({ error: 'Kann Dateiformat nicht verarbeiten' })];

    const client = createClient();
    client.on('error', err => console.log('Redis Client Error', err));
    await client.connect();
    const key = randomUUID();

    // nach Wechsel auf Typescript 4.9 hier `satisfies IRedisValue` ergänzen?
    await client.hSet(key, {
      filename,
      filetype,
      buffer: buffer.toString('base64'),
    });
    await client.expire(key, 180);
    return [true, key];
  }

  static async produceImage(key: string, format: Format, desiredQuality?: number): Promise<[FormData, string]> {
    const originalImage = await this.getImageFromRedis(key);
    const [convertedImage, quality] = await this.makeConvertedImage(originalImage.buffer, format, desiredQuality);

    const manifest: IFileInfo = {
      filename: await this.newFileName(originalImage.filename, convertedImage),
      filesize: await this.getFileSize(convertedImage),
      quality,
    };

    const formdata = new FormData();
    formdata.append('manifest', JSON.stringify(manifest));
    formdata.append(
      'file',
      `data:image/${await this.getFileType(convertedImage)};base64,${convertedImage.toString('base64')}`,
      manifest.filename,
    );

    return [formdata, formdata.getBoundary()];
  }

  // Ab Typescript 4.9 vielleicht mit Rückgabewert `Promise<IRedisValue>`
  static async getImageFromRedis(key: string) {
    const client = createClient();
    // todo: Fehlerbehandlungsfunktion die dasselbe Return wie produceImage()?
    client.on('error', err => console.log('Redis Client Error', err));
    await client.connect();
    // todo: Fehlerbehandlungsfunktion die dasselbe Return wie produceImage()?
    if (!(await client.exists(key))) throw new Error('Redis-Datenbankeintrag existiert nicht');

    // Hier vielleicht ab TS 4.9 `satisfies IRedisValue`?
    return await client.hGetAll(key);
  }

  static async makeConvertedImage(original: Base64, format: Format, quality?: number): Promise<[Buffer, number?]> {
    quality ??= 85;

    if (format === 'png') return [await ProcessImage.toPNG(original)];
    else if (format === 'webp-nearlossless') return [await ProcessImage.toWebPnearLossless(original)];
    else if (format === 'webp') return [await ProcessImage.toWebP(original, quality), quality];
    else return [await ProcessImage.toJPEG(original, quality), quality];
  }

  static async toPNG(original: Base64): Promise<Buffer> {
    return await sharp(Buffer.from(original, 'base64'))
      .png({ adaptiveFiltering: true, palette: true, compressionLevel: 9, effort: 8 })
      .toBuffer();
  }

  static async toWebPnearLossless(original: Base64): Promise<Buffer> {
    return await sharp(Buffer.from(original, 'base64')).webp({ nearLossless: true }).toBuffer();
  }

  static async toJPEG(original: Base64, quality?: number): Promise<Buffer> {
    return await sharp(Buffer.from(original, 'base64'))
      .jpeg({
        quality,
        quantisationTable: 3,
        optimiseScans: true,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer();
  }

  static async toWebP(original: Base64, quality?: number): Promise<Buffer> {
    return sharp(Buffer.from(original, 'base64')).webp({ quality }).toBuffer();
  }

  static async getFileSize(buffer: Buffer): Promise<number> {
    const meta = await sharp(buffer).metadata();
    return meta.size as number;
  }

  static async getFileType(buffer: Buffer): Promise<string> {
    const meta = await sharp(buffer).metadata();
    return meta.format as string;
  }

  static async newFileName(originalFilename: string, convertedImage: Buffer) {
    return originalFilename.split('.')[0] + '.' + (await this.getFileType(convertedImage));
  }
}
