import { createServer } from 'http';
import dotenv from 'dotenv';
import Busboy from 'busboy';
import processImage from './process-image.js';

const server = createServer((req, res) => {
    if (req.method === 'GET') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Connection', 'close');
        res.end();
    }

    if (req.method === 'POST') {
        let fileBuffer;
        let fileName;
        let mimeType;
        let postData = new Busboy({ headers: req.headers });

        postData.on('file', (_fieldname, file, filename, _encoding, mimetype) => {
            fileName = filename;
            mimeType = mimetype;
            let chunks = [];
            file.on('data', chunk => chunks.push(chunk));
            file.on('end', () => (fileBuffer = Buffer.concat(chunks)));
        });

        postData.on('finish', async () => {
            const processedImage = processImage.fromBuffer(fileBuffer, fileName, mimeType);
            const [output, boundary] = await processedImage.toFormData();
            res.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Connection', 'close');
            output.pipe(res);
            res.end();
        });

        req.pipe(postData);
    }
});

dotenv.config();
server.listen(process.env.PORT ?? 3001, process.env?.HOSTNAME);
console.log('Server gestartet');
