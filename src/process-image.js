import sharp from 'sharp';
import FormData from 'form-data';

export default class processImage {
    constructor(args) {
        this.buffer = args?.buffer;
        this.filename = args?.filename ?? 'file';
        this.error = args?.error ?? null;

        this.qualities = [70, 75, 80, 85];
    }

    static fromBuffer(buffer, filename, filetype) {
        if (buffer == undefined) return new processImage({ error: 'Keine Datei übertragen' });
        if (!(filetype.split('/')[1] in sharp.format))
            return new processImage({ error: 'Kann Dateiformat nicht verarbeiten' });
        return new processImage({
            buffer: buffer,
            filename: filename.split('.')[0],
        });
    }

    /* fromFile(_path) {} */
    /* fromURL(_url) {} */

    toWebP(quality) {
        if (quality == undefined) return sharp(this.buffer).webp().toBuffer();
        else return sharp(this.buffer).webp({ quality: quality }).toBuffer();
    }

    async makeWebPs() {
        let returnobj = {};
        for (const q of this.qualities) {
            returnobj[q] = await this.toWebP(q);
        }
        return returnobj;
    }

    async toJPEG(quality) {
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

    async makeJPEGs() {
        let returnobj = {};
        for (const q of this.qualities) {
            returnobj[q] = await this.toJPEG(q);
        }
        return returnobj;
    }

    async toPNG() {
        const encode = await import('@wasm-codecs/oxipng');
        return encode.default(await sharp(this.buffer).png().toBuffer());
    }

    async getFiletype() {
        const meta = await sharp(this.buffer).metadata();
        return meta.format;
    }

    async getFilesize() {
        const meta = await sharp(this.buffer).metadata();
        return meta.size;
    }

    async createImages() {
        const manifest = {
            inputfile: {
                filename: this.filename,
                filetype: await this.getFiletype(),
                filesize: await this.getFilesize(),
            },
        };

        const images = new Map();

        // WebP
        manifest['webp'] = {};
        for (const [q, buff] of Object.entries(await this.makeWebPs())) {
            const handle = 'webp-q' + q;
            const values = {
                quality: q,
                filesize: buff.length,
                filename: this.filename + '-q' + q + '.webp',
            };
            manifest.webp[handle] = values;
            images.set(handle, buff);
        }

        // JPEG
        manifest['jpeg'] = {};
        for (const [q, buff] of Object.entries(await this.makeJPEGs())) {
            const handle = 'jpeg-q' + q;
            const values = {
                quality: q,
                filesize: buff.length,
                filename: this.filename + '-q' + q + '.jpeg',
            };
            manifest.jpeg[handle] = values;
            images.set(handle, buff);
        }

        // PNG
        const pngBuffer = await this.toPNG();
        manifest['png'] = {
            filesize: pngBuffer.length,
            filename: this.filename + '.png',
        };
        images.set('png', pngBuffer);

        return [manifest, images];
    }

    async toFormData() {
        const formdata = new FormData();

        if (this.error) {
            formdata.append('error', this.error);
            return [formdata, formdata.getBoundary()];
        }

        const [data, images] = await this.createImages();
        formdata.append('manifest', JSON.stringify(data));

        // WebP
        for (const curr of Object.entries(data.webp)) {
            formdata.append(
                'webp-q' + curr[1].quality,
                'data:image/webp;base64,' + images.get('webp-q' + curr[1].quality).toString('base64'),
                curr[1].filename,
            );
        }

        // JPEG
        for (const curr of Object.entries(data.jpeg)) {
            formdata.append(
                'jpeg-q' + curr[1].quality,
                'data:image/jpeg;base64,' + images.get('jpeg-q' + curr[1].quality).toString('base64'),
                curr[1].filename,
            );
        }

        // PNG
        formdata.append('png', 'data:image/png;base64,' + images.get('png').toString('base64'), data.png.filename);

        return [formdata, formdata.getBoundary()];
    }
}
