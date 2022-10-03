import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import multer from '@koa/multer';
import { handleRequest } from './handleRequest.js';
import { handleUpload } from './handleUpload.js';

const baseUrl = process.env.NODE_ENV === 'development' ? '' : '/imgconv-backend';

const app = new Koa();
const router = new Router({ prefix: baseUrl });
const upload = multer();

router.get('/', ctx => (ctx.body = 'ImgConv-Backend'));
router.post('/storeimage', upload.single('datei'), handleUpload);
router.get('/:uuid/:format/:quality?', handleRequest);

app.use(cors());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3001, () => console.log('Server gestartet, Port 3001'));
