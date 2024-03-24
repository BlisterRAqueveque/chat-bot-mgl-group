import {
  createBot,
  createFlow,
  MemoryDB,
  createProvider,
  addKeyword,
} from '@bot-whatsapp/bot';
import { BaileysProvider, handleCtx } from '@bot-whatsapp/provider-baileys';
import { exec } from 'child_process';
import * as fs from 'fs';

/** @description Podemos crear mensajes personalizados de respuesta automática */
//const welcome = addKeyword("Hola").addAnswer("Buenas!");
const main = async () => {
  const provider = createProvider(BaileysProvider);

  let isConnected = false;

  /** @description Evento para consultar si existe una conexión activa */
  provider.on('ready', () => {
    isConnected = true;
    console.log('Conectado');
  });
  provider.on('preinit', () => {
    isConnected = false;
    console.log('Iniciando');
  });
  provider.on('require_action', () => {
    isConnected = false;
    console.log('Esperando conexión');
  });
  provider.on('auth_failure', () => {
    isConnected = false;
    console.log('Falló conexión');
  });
  provider.initHttpServer(3002);

  /** @description Consultamos si existe una conexión activa, si no existe, envía el qr (recordar que el qr tiene un ciclo de vida de 1 min) */
  provider.http.server.get('/connection', (req, res) => {
    if (!isConnected) {
      fs.readFile('./bot.qr.png', (err, data) => {
        if (err) {
          // Si hay un error al leer el archivo, responde con un estado 500
          res.sendStatus(500);
        } else {
          // Establece el encabezado de la respuesta para indicar que se trata de una imagen PNG
          res.writeHead(200, { 'Content-Type': 'image/png' });
          // Envía el contenido del archivo como respuesta
          res.end(data);
        }
      });
    } else res.end('Exist an connection');
  });

  /** @description Podemos mandar un mensaje desde un post */
  provider.http?.server.post(
    '/send-message',
    handleCtx(async (bot, req, res) => {
      const body = req.body as {
        phone: string;
        message: string;
        mediaUrl: string;
      };
      await bot.sendMessage(body.phone, body.message, {
        media: body.mediaUrl,
      });
      res.end('Message sent');
    }),
  );

  /** @description Desconectamos el proveedor actual */
  provider.http.server.post(
    '/disconnect',
    handleCtx(async (bot, req, res) => {
      // TODO Desconectar el provider
      //! Si se borra la carpeta bot_sessions y se reinicia el servidor, funciona, pero es muy forzado:
      fs.rmdirSync('./bot_sessions', { recursive: true }); //Borramos la carpeta que contiene las credenciales
      exec('npm run restart', (error, stdout, stderr) => {
        //Reiniciamos el servidor
        if (error) {
          console.error(`Error al reiniciar el servidor: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
      });
      //! Tener en cuenta que se debe cambiar el comando de el package.json, esta con pm2 y un log llamado bot
      /**
       * import { exec } from "child_process";
       * import * as fs from "fs";
       * //* Borra la carpeta bot_sessions
       * fs.rmdirSync("../bot_sessions", { recursive: true });
       * //* Corre comando, podemos usar pm2, por ejemplo
       * exec("npm run dev", (error, stdout, stderr) => {
       *  if (error) {
       *    console.error(`Error al reiniciar el servidor: ${error.message}`);
       *     return;
       *  }
       *  if (stderr) {
       *    console.error(`stderr: ${stderr}`);
       *     return;
       *  }
       *  console.log(`stdout: ${stdout}`);
       * });
       */
      res.end('Disconnected');
    }),
  );

  await createBot({
    flow: createFlow([]),
    database: new MemoryDB(),
    provider,
  });
};

main();
