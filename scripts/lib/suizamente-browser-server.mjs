import assert from 'node:assert/strict'
import {createServer} from 'vite'

// This launcher is used only by the isolated browser tests, never by npm dev.
const port=Number(process.argv[2])
assert.ok([5255,5256].includes(port),'Use a dedicated Suizamente test port')
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}})
assert.ok(server.httpServer)
server.httpServer.prependListener('connection',socket=>{
  // WebKit on Windows can reset an idle connection when closing a context.
  // Keep the test HTTP server alive for this ordinary client disconnection.
  // All other socket errors retain their fatal behaviour and diagnostics.
  socket.on('error',error=>{
    if(error.code!=='ECONNRESET'&&error.code!=='EPIPE')throw error
  })
})
await server.listen()
server.printUrls()
