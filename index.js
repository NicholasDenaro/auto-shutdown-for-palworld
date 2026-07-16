import {createSocket} from 'dgram';
import {spawn} from 'child_process';
import {createInterface} from 'readline/promises';
import {moveCursor} from 'readline';
import {stdin, stdout} from 'process';
import {join} from 'path';

import "dotenv/config";

const webPort = process.env.webPort;
const gamePort = process.env.gamePort;
const username = process.env.webUsername;
const password = process.env.webPassword;
const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const steamCMDFullPath = process.env.steamcmd;
const palserverFullPath = process.env.palworld;

function log(rl, ...message) {
  output(console.log, process.stdout, rl, ...message);
}

function error(rl, ...message) {
  output(console.error, process.stderr, rl, ...message);
}

function output(method, stdX, rl, ...message) {
  rl.pause();
  const savedText = rl.line;
  const cursor = rl.cursor;
  stdX.write('\r\x1b[K');
  method(...message);
  process.stdout.write(rl.getPrompt() + savedText);
  const move = savedText.length - cursor;
  if (move > 0) {
    moveCursor(process.stdout, -move, 0);
  }
  rl.resume();
}

async function startListenServer(rl) {
  const promise = new Promise((resolve, reject) => {
    const server = createSocket('udp4');

    server.on('message', (msg, rinfo) => {
      log(rl, `Received: ${msg} from ${rinfo.address}:${rinfo.port}`);

      server.close(() => {
        log(rl, 'UDP server closed');
        resolve();
      });
    });

    server.on('listening', () => {
      const address = server.address();
      log(rl, `UDP server listening on ${address.address}:${address.port}`);
    });

    server.bind(gamePort);
  });
  
  await promise;
}

async function getPlayers() {
  const data = await (await fetch(`http://localhost:${webPort}/v1/api/players`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth
    }
  })).json();
  
  return data.players;
}

async function saveServer(rl) {
  const result = await (await fetch(`http://localhost:${webPort}/v1/api/save`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth
    }
  })).text();
  log(rl, 'save result', result);
}

async function shutdownServer(rl) {
  const result = await (await fetch(`http://localhost:${webPort}/v1/api/shutdown`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth
    },
    body: JSON.stringify({
      waittime: 1,
      message: 'Shutting down server'
    })
  })).text();
  log(rl, 'shutdown result', result);
}

async function startSteamCmd(rl) {
  log(rl, 'Updating Palworld Server...');
  const steamcmd = spawn(
    steamCMDFullPath,
    ['+login', 'anonymous', '+app_update', '2394010', 'validate', '+quit'],
    {
      stdio: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit'
    });

  await new Promise((resolve, reject) => {
    steamcmd.on('close', code => {
      log(rl, 'SteamCMD closed', code);
      resolve();
    });
    steamcmd.on('error', error => {
      error(rl, error);
      reject();
    });
  });
}

async function startPalworld(rl) {
  log(rl, 'Starting Palworld Community Server...');
  const palworld = spawn(
    join(palserverFullPath, 'PalServer.exe'),
    ['-EpicApp=PalServer', '-publiclobby'],
    {
      cwd: palserverFullPath
    });
  palworld.stdout.on('data', data => {
    log(rl, data.toString());
  });
  palworld.stderr.on('data', data => {
    error(rl, data.toString());
  });

  const promise = new Promise((resolve, reject) => {
    palworld.on('close', code => {
      log(rl, 'Palworld Server closed', code);
      resolve();
    });
    palworld.on('error', error => {
      error(rl,error);
      reject();
    });
  });

  await new Promise(async (resolve, reject) => setTimeout(resolve, 1000 * 60));

  while (true) {
    const playerList = await getPlayers();
    log(rl, 'players: ', playerList.length);

    if (playerList.length === 0) {
      console.log('Shutting down server...');
      await saveServer(rl);
      await shutdownServer(rl);
      break;
    }

    await new Promise(async (resolve, reject) => setTimeout(resolve, 1000 * 60 * 10));
  }

  await promise;
}

async function main() {
  const rl = createInterface({
    input: stdin,
    output: stdout
  });

  rl.setPrompt('server> ');

  let runningServer = false;

  new Promise(async (resolve, reject) => {
    while (true) {
      await startSteamCmd(rl);
      runningServer = true;
      await startPalworld(rl);
      runningServer = false;
      await startListenServer(rl);
    }
  }).catch(reason => {
    console.error(reason);
    process.exit(1);
  });

  rl.prompt();
  rl.on('line', async answer => {
    switch (answer) {
      case 'quit':
        if (runningServer) {
          await saveServer(rl);
          await shutdownServer(rl);
        }
        process.exit(0);
        break;
      default:
        log(rl, 'invalid command:', answer);
        break;
    }
  });

  await new Promise(() => {});
}

await main();