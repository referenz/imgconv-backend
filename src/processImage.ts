import sharp from 'sharp'
import type { Format } from './types.js'

/*
type Base64<imageType extends string> = `data:image/${imageType};base64${string}`
const base64: Base64<'png'> = 'data:image/png;base64test...'
*/

export class ProcessImage {
  private originalImage: Buffer
  private originalFilename: string
  private originalFiletype: string
  private origginalFilezsize: number

  private error: string | undefined

  constructor(buffer: Buffer, filename: string, filetype: string, filesize: number) {
    const type = filetype.split('/')[1]
    if (!(type in sharp.format) || !sharp.format[type as keyof sharp.FormatEnum].input.buffer)
      this.error = 'Kann Dateiformat nicht verarbeiten'

    this.originalImage = buffer
    this.originalFilename = filename
    this.originalFiletype = filetype
    this.origginalFilezsize = filesize
  }

  public hasError() {
    return this.error !== undefined
  }

  public getError() {
    if (this.error !== undefined) return this.error
    else throw new Error('no error')
  }

  public async produceImage(format: string, quality?: string) {
    try {
      const convertedImage = await this.makeConvertedImage(format as Format, quality)

      return {
        filename: await this.newFileName(this.originalFilename, convertedImage),
        filesize: await this.getFileSize(convertedImage),
        quality,
        binary: convertedImage,
      }
    } catch (e) {
      this.error = (e as Error).message
      console.log('Behandelter Fehler: ', (e as Error).message)
    }
  }

  private async makeConvertedImage(format: Format, argQuality?: string) {
    const quality = parseInt(argQuality ?? '85')

    if (format === 'png') return await this.toPNG()
    else if (format === 'webp-nearlossless') return await this.toWebPnearLossless()
    else if (format === 'webp') return await this.toWebP(quality)
    /* format === 'jpeg' */ else return await this.toJPEG(quality)
    //else throw new Error('falsches Format angefordert: ', format);
  }

  private async toPNG(): Promise<Buffer> {
    return await sharp(this.originalImage)
      .png({ adaptiveFiltering: true, palette: true, compressionLevel: 9, effort: 8 })
      .toBuffer()
  }

  private async toWebPnearLossless(): Promise<Buffer> {
    return await sharp(this.originalImage).webp({ nearLossless: true }).toBuffer()
  }

  private async toJPEG(quality?: number): Promise<Buffer> {
    return await sharp(this.originalImage)
      .jpeg({
        quality,
        quantisationTable: 3,
        optimiseScans: true,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer()
  }

  private async toWebP(quality?: number): Promise<Buffer> {
    return sharp(this.originalImage).webp({ quality }).toBuffer()
  }

  private async getFileSize(buffer: Buffer): Promise<number> {
    const meta = await sharp(buffer).metadata()
    return meta.size ?? 0
  }

  private async getFileType(buffer: Buffer): Promise<string> {
    const meta = await sharp(buffer).metadata()
    return meta.format as string
  }

  private async newFileName(originalFilename: string, convertedImage: Buffer) {
    return originalFilename.split('.')[0] + '.' + (await this.getFileType(convertedImage))
  }
}
