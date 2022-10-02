import Koa from 'koa';
import ProcessImage from './processImage.js';
import { allowedFormats, Format } from './types.js';

export async function handleRequest(ctx: Koa.ParameterizedContext) {
  const { uuid, format, quality } = ctx.params as { uuid: string; format: Format; quality: string };

  if (!allowedFormats.includes(format)) {
    // todo: Was passiert wenn ein falsches Format angefordert wird?
  }

  let desiredQuality: number | undefined = parseInt(quality);
  if (desiredQuality < 1 || desiredQuality > 100 || isNaN(desiredQuality)) {
    // todo: Was passiert wenn ein ungültiger Wert angegeben wird?
    desiredQuality = undefined;
  }

  try {
    const [formdata, boundary] = await ProcessImage.produceImage(uuid, format, desiredQuality);
    ctx.response.set('Content-Type', `multipart/form-data; boundary=${boundary}`);
    ctx.status = 200;
    formdata.pipe(ctx.res);
  } catch (e) {
    // todo: Fehlermeldung an den Browser schicken
    console.log('Behandelter Fehler: ', (e as Error).message);
    ctx.status = 500;
  }
}
