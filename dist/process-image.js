import sharp from 'sharp';
import FormData from 'form-data';
export default class processImage {
    constructor(args) {
        this.qualities = [70, 75, 80, 85];
        if ('buffer' in args) {
            this.buffer = args.buffer;
            this.filename = args.filename;
        }
        if ('error' in args)
            this.error = args.error;
    }
    static fromBuffer(buffer, filename, filetype) {
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
        if (quality == undefined)
            return sharp(this.buffer).webp().toBuffer();
        else
            return sharp(this.buffer).webp({ quality: quality }).toBuffer();
    }
    async makeWebPs() {
        const returnobj = new Map();
        for (const q of this.qualities) {
            returnobj.set(q, await this.toWebP(q));
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
        const returnobj = new Map();
        for (const q of this.qualities) {
            returnobj.set(q, await this.toJPEG(q));
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
        const inputfileFragment = {
            filename: this.filename,
            filetype: await this.getFiletype(),
            filesize: await this.getFilesize(),
        };
        const images = new Map();
        // WebP
        const webps = {};
        for (const [q, buff] of Object.entries(await this.makeWebPs())) {
            const handle = 'webp-q' + q;
            const values = {
                quality: parseInt(q),
                filesize: buff.length,
                filename: this.filename + '-q' + q + '.webp',
            };
            webps.handle = values;
            images.set(handle, buff);
        }
        // JPEG
        const jpegs = {};
        for (const [q, buff] of Object.entries(await this.makeJPEGs())) {
            const handle = 'jpeg-q' + q;
            const values = {
                quality: parseInt(q),
                filesize: buff.length,
                filename: this.filename + '-q' + q + '.jpeg',
            };
            jpegs.handle = values;
            images.set(handle, buff);
        }
        // PNG
        const pngBuffer = await this.toPNG();
        const png = {
            filesize: pngBuffer.length,
            filename: this.filename + '.png',
        };
        images.set('png', pngBuffer);
        const manifest = { inputfile: inputfileFragment, webps: webps, jpegs: jpegs, png: png };
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
        for (const curr of Object.entries(data.webps)) {
            formdata.append('webp-q' + curr[1].quality, 'data:image/webp;base64,' + images.get('webp-q' + curr[1].quality)?.toString('base64'), curr[1].filename);
        }
        // JPEG
        for (const curr of Object.entries(data.jpegs)) {
            formdata.append('jpeg-q' + curr[1].quality, 'data:image/jpeg;base64,' + images.get('jpeg-q' + curr[1].quality)?.toString('base64'), curr[1].filename);
        }
        // PNG
        formdata.append('png', 'data:image/png;base64,' + images.get('png')?.toString('base64'), data.png.filename);
        return [formdata, formdata.getBoundary()];
    }
}
