import {createSocket} from 'dgram';
import {spawn} from 'child_process';
import {createInterface} from 'readline/promises';
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

async function startListenServer() {
  const promise = new Promise((resolve, reject) => {
    const server = createSocket('udp4');

    server.on('message', (msg, rinfo) => {
      console.log(`Received: ${msg} from ${rinfo.address}:${rinfo.port}`);

      server.close(() => {
        console.log('UDP server closed');
        resolve();
      });
    });

    server.on('listening', () => {
      const address = server.address();
      console.log(`UDP server listening on ${address.address}:${address.port}`);
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

async function saveServer() {
  const result = await (await fetch(`http://localhost:${webPort}/v1/api/save`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth
    }
  })).text();
  console.log('save result', result);
}

async function shutdownServer() {
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
  console.log('shutdown result', result);
}

async function startSteamCmd() {
  console.log('Updating Palworld Server...');
  const steamcmd = spawn(steamCMDFullPath, ['+login', 'anonymous', '+app_update', '2394010', 'validate', '+quit']);
  steamcmd.stdout.on('data', data => {
    console.log(data.toString());
  });
  steamcmd.stderr.on('data', data => {
    console.log(data.toString());
  });

  await new Promise((resolve, reject) => {
    steamcmd.on('close', code => {
      console.log('SteamCMD closed', code);
      resolve();
    });
    steamcmd.on('error', error => {
      console.error(error);
      reject();
    });
  });
}

async function startPalworld() {
  console.log('Starting Palworld Community Server...');
  const palworld = spawn(join(palserverFullPath, 'PalServer.exe'), ['-EpicApp=PalServer', '-publiclobby'], {
    cwd: palserverFullPath
  });
  palworld.stdout.on('data', data => {
    console.log(data.toString());
  });
  palworld.stderr.on('data', data => {
    console.log(data.toString());
  });

  const promise = new Promise((resolve, reject) => {
    palworld.on('close', code => {
      console.log('Palworld Server closed', code);
      resolve();
    });
    palworld.on('error', error => {
      console.error(error);
      reject();
    });
  });

  await new Promise(async (resolve, reject) => setTimeout(resolve, 1000 * 60));

  while (true) {
    const playerList = await getPlayers();
    console.log('players: ', playerList.length);

    if (playerList.length === 0) {
      console.log('Shutting down server...');
      await saveServer();
      await shutdownServer();
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

  let runningServer = false;

  new Promise(async (resolve, reject) => {
    while (true) {
      await startSteamCmd();
      runningServer = true;
      await startPalworld();
      runningServer = false;
      await startListenServer();
    }
  }).catch(reason => {
    console.error(reason);
    process.exit(1);
  });

  while(true) {
    const answer = await rl.question('server> ');
    switch (answer) {
      case 'quit':
        if (runningServer) {
          await saveServer();
          await shutdownServer();
          process.exit(0);
        }
        break;
      default:
        console.log('invalid command');
        break;
    }
  }
  
}

await main();