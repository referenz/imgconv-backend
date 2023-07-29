import type { Socket } from 'socket.io'
import type { Upload } from './types.js'
import { ProcessImage } from './processImage.js'

/*
interface ResponseImage {
  filename: string
  filesize: number
  filetype: string
  binary: ArrayBuffer
  quality?: number
}
*/

export function socketHandler(socket: Socket) {
  let image: ProcessImage

  socket.on('upload', (data: Upload) => {
    image = new ProcessImage(data.binary, data.filename, data.filetype)

    if (image.hasError()) {
      socket.emit('error', image.getError())
    } else socket.emit('upload-successful', true)
  })

  socket.on('request', async (handler: string, format: string, quality: string) => {
    const response = await image.produceImage(format, quality)
    socket.emit('request-answer', { handler, ...response })
  })
}
