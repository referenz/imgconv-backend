import Koa from 'koa';
import ProcessImage from './processImage.js';

export async function handleUpload(ctx: Koa.ParameterizedContext) {
  try {
    const [success, key] = await ProcessImage.fromBuffer(ctx.file.buffer, ctx.file.originalname, ctx.file.mimetype);
    if (!success) throw Error(key);
    ctx.body = JSON.stringify({
      success: true,
      handler: key,
    });
  } catch (e) {
    ctx.body = JSON.stringify({ success: false, error: e });
  }
}
