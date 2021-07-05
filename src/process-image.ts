import sharp from 'sharp';
import FormData from 'form-data';
import { Manifest, InputData, LossyImgData, LosslessImgData } from './Manifest';

export default class processImage {
    buffer?: Buffer;
    filename?: string;
    error?: string;
    qualities = [70, 75, 80, 85];

    private constructor(args: { buffer: Buffer; filename: string } | { error: string }) {
        if ('buffer' in args) {
            this.buffer = args.buffer;
            this.filename = args.filename;
        }
        if ('error' in args) this.error = args.error;
    }

    static fromBuffer(buffer: Buffer, filename: string, filetype: string): processImage {
        if (!(filetype.split('/')[1] in sharp.format))
            return new processImage({ error: 'Kann Dateiformat nicht verarbeiten' });
        return new processImage({
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
                trellisQuantisation: true,
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
        return await sharp(this.buffer).png().toBuffer();
    }

    private async getFiletype(): Promise<string> {
        const meta = await sharp(this.buffer).metadata();
        return meta.format as string;
    }

    private async getFilesize(): Promise<number> {
        const meta = await sharp(this.buffer).metadata();
        return meta.size as number;
    }

    private async createImages(): Promise<[Manifest, Map<string, Buffer>]> {
        const inputfileFragment: InputData = {
            filename: this.filename as string,
            filetype: await this.getFiletype(),
            filesize: await this.getFilesize(),
        };

        const images = new Map<string, Buffer>();

        // WebP
        const webps: Record<string, LossyImgData> = {};
        for (const [q, buff] of await this.makeWebPs()) {
            const handle = 'webp-q' + q;
            const values: LossyImgData = {
                quality: q,
                filesize: buff.length,
                filename: this.filename + '-q' + q + '.webp',
            };
            webps[handle] = values;
            images.set(handle, buff);
        }

        // JPEG
        const jpegs: Record<string, LossyImgData> = {};
        for (const [q, buff] of await this.makeJPEGs()) {
            const handle = 'jpeg-q' + q;
            const values: LossyImgData = {
                quality: q,
                filesize: buff.length,
                filename: this.filename + '-q' + q + '.jpeg',
            };
            jpegs[handle] = values;
            images.set(handle, buff);
        }

        // PNG
        const pngBuffer = await this.toPNG();
        const png: LosslessImgData = {
            filesize: pngBuffer.length,
            filename: this.filename + '.png',
        };
        images.set('png', pngBuffer);

        const manifest: Manifest = { inputfile: inputfileFragment, webps: webps, jpegs: jpegs, png: png };
        return [manifest, images];
    }

    async toFormData(): Promise<[FormData, string]> {
        const formdata = new FormData();

        if (this.error) {
            formdata.append('error', this.error);
            return [formdata, formdata.getBoundary()];
        }

        const [data, images] = await this.createImages();
        formdata.append('manifest', JSON.stringify(data));

        // WebP
        for (const curr of Object.entries(data.webps)) {
            formdata.append(
                'webp-q' + curr[1].quality,
                'data:image/webp;base64,' + images.get('webp-q' + curr[1].quality)?.toString('base64'),
                curr[1].filename,
            );
        }

        // JPEG
        for (const curr of Object.entries(data.jpegs)) {
            formdata.append(
                'jpeg-q' + curr[1].quality,
                'data:image/jpeg;base64,' + images.get('jpeg-q' + curr[1].quality)?.toString('base64'),
                curr[1].filename,
            );
        }

        // PNG
        formdata.append('png', 'data:image/png;base64,' + images.get('png')?.toString('base64'), data.png.filename);

        return [formdata, formdata.getBoundary()];
    }
}
