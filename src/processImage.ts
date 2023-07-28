import { randomUUID } from 'crypto';
import sharp from 'sharp';
import FormData from 'form-data';
import type { IRedisValue, Format, IFileInfo } from './types.js';
import { getRedisClient } from './redisProvider.js';

type Base64 = string;
/*
type Base64<imageType extends string> = `data:image/${imageType};base64${string}`
const base64: Base64<'png'> = 'data:image/png;base64test...'
*/

export async function fromBuffer(buffer: Buffer, filename: string, filetype: string): Promise<[boolean, string]> {
  const type = filetype.split('/')[1];
  if (!(type in sharp.format) || !sharp.format[type as keyof sharp.FormatEnum].input.buffer)
    return [false, JSON.stringify({ error: 'Kann Dateiformat nicht verarbeiten' })];

  const client = getRedisClient();
  client.on('error', err => {
    console.log('Redis Client Error', err);
  });
  await client.connect();
  const key = randomUUID();

  // nach Wechsel auf Typescript 4.9 hier `satisfies IRedisValue` ergänzen?
  await client.hSet(key, {
    filename,
    filetype,
    buffer: buffer.toString('base64'),
  });
  await client.expire(key, 180);
  await client.quit();
  return [true, key];
}

export async function produceImage(key: string, format: Format, desiredQuality?: number): Promise<[FormData, string]> {
  const originalImage = await getImageFromRedis(key);

  try {
    const [convertedImage, quality] = await makeConvertedImage(originalImage.buffer, format, desiredQuality);

    const manifest: IFileInfo = {
      filename: await newFileName(originalImage.filename, convertedImage),
      filesize: await getFileSize(convertedImage),
      quality,
    };

    const formdata = new FormData();
    formdata.append('manifest', JSON.stringify(manifest));
    formdata.append(
      'file',
      `data:image/${await getFileType(convertedImage)};base64,${convertedImage.toString('base64')}`,
      manifest.filename,
    );
    return [formdata, formdata.getBoundary()];
  } catch (e) {
    console.log('Behandelter Fehler: ', (e as Error).message);
    throw new Error(e as string);
  }
}

async function getImageFromRedis(key: string): Promise<IRedisValue> {
  const client = getRedisClient();

  // const client = createClient();
  // todo: Fehlerbehandlungsfunktion dasselbe Return wie produceImage()?
  client.on('error', err => {
    console.log('Redis Client Error', err);
  });
  await client.connect();

  // todo: Fehlerbehandlungsfunktion dasselbe Return wie produceImage()?
  if (!(await client.exists(key))) throw new Error('Redis-Datenbankeintrag existiert nicht');

  return (await client.hGetAll(key)) as unknown as IRedisValue;
}

async function makeConvertedImage(original: Base64, format: Format, quality?: number): Promise<[Buffer, number?]> {
  quality ??= 85;

  if (format === 'png') return [await toPNG(original)];
  else if (format === 'webp-nearlossless') return [await toWebPnearLossless(original)];
  else if (format === 'webp') return [await toWebP(original, quality), quality];
  /* format === 'jpeg' */ else return [await toJPEG(original, quality), quality];
  //else throw new Error('falsches Format angefordert: ', format);
}

async function toPNG(original: Base64): Promise<Buffer> {
  return await sharp(Buffer.from(original, 'base64'))
    .png({ adaptiveFiltering: true, palette: true, compressionLevel: 9, effort: 8 })
    .toBuffer();
}

async function toWebPnearLossless(original: Base64): Promise<Buffer> {
  return await sharp(Buffer.from(original, 'base64')).webp({ nearLossless: true }).toBuffer();
}

async function toJPEG(original: Base64, quality?: number): Promise<Buffer> {
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

async function toWebP(original: Base64, quality?: number): Promise<Buffer> {
  return sharp(Buffer.from(original, 'base64')).webp({ quality }).toBuffer();
}

async function getFileSize(buffer: Buffer): Promise<number> {
  const meta = await sharp(buffer).metadata();
  return meta.size ?? 0;
}

async function getFileType(buffer: Buffer): Promise<string> {
  const meta = await sharp(buffer).metadata();
  return meta.format as string;
}

async function newFileName(originalFilename: string, convertedImage: Buffer) {
  return originalFilename.split('.')[0] + '.' + (await getFileType(convertedImage));
}
