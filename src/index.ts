import { createServer } from 'http';
import Busboy from 'busboy';
import ProcessImage from './processImage.js';

const server = createServer((req, res) => {
  if (req.method === 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Connection', 'close');
    res.end();
  }

  if (req.method === 'POST') {
    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;
    const postData = Busboy({ headers: req.headers });

    postData.on('file', (_fieldname, file, info) => {
      fileName = info.filename;
      mimeType = info.mimeType;
      const chunks: Array<Uint8Array> = [];
      file.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      file.on('end', () => (fileBuffer = Buffer.concat(chunks)));
    });

    postData.on('finish', () => {
      const processedImage = ProcessImage.fromBuffer(fileBuffer, fileName, mimeType);
      void processedImage.toFormData().then(result => {
        res.setHeader('Content-Type', `multipart/form-data; boundary=${result[1]}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Connection', 'close');
        result[0].pipe(res);
        res.end();
      });
    });
    req.pipe(postData);
  }
});

// server.listen(process.env.PORT ? parseInt(process.env.PORT) : 3001, process.env.INTERNAL_HOSTNAME);
server.listen(3001);
console.log('Server gestartet');
