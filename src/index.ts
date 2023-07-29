import Koa from 'koa'
import Router from '@koa/router'
import cors from '@koa/cors'
import { Server } from 'socket.io'
import { createServer } from 'http'
import { socketHandler } from './socketHandler.js'

const baseUrl = process.env.NODE_ENV === 'development' ? '' : '/imgconv-backend'
const port = 3001

const app = new Koa()
const router = new Router({ prefix: baseUrl })

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const httpServer = createServer(app.callback())
const socket = new Server(httpServer, {
  path: '/imgconv-backend/socket.io/',
  cors: {
    origin: ['http://localhost:8080', 'http://localhost:5173', 'http://0.0.0.0'],
  },
})

router.get('/', ctx => (ctx.body = 'ImgConv-Backend'))
socket.on('connection', socketHandler)

app.use(cors())
app.use(router.routes())
app.use(router.allowedMethods())

httpServer.listen(port, () => {
  console.log('Server gestartet. Port', port)
})

/*
app.listen(3001, () => {
  console.log('Server gestartet, Port 3001');
});
*/
