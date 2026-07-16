# auto-shutdown-for-palworld

## Pre-Reqs
1. [Node](https://nodejs.org)
2. [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD)

## Installing PalWorld with SteamCMD
1. Run `steamcmd.exe +login anonymous +app_update 2394010 validate +quit`

## Warning: do NOT open the REST API port to the internet
DO NOT PORT FORWARD `RESTAPIPort`

## Setup
1. Clone it with `git clone` (or click the green `<> Code` button, `Download ZIP`, and then extract the file).
2. Open this folder in the terminal.
3. Run `npm install`
4. Locate your `PalWorldSettings.ini` and set `RESTAPIEnabled=True`, note the port number in `PublicPort=`, note the port number in `RESTAPIPort=`, also note the password in `AdminPassword=` (set one if you do not have one)
5. Copy the `.env.template` file to `.env`
6. Update the values for `webPassword`, `webPort`, `gamePort`, `steamcmd`, and `palworld` in `.env`

## How to Run
1. Open up a terminal in this directory and run `node .`