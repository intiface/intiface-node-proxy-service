import * as commander from "commander";
import * as ws from "ws";
import * as fs from "fs";
import * as util from "util";
import * as https from "https";
import * as http from "http";
const selfsigned = require("selfsigned");

async function main() {
  process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
    // application specific logging, throwing an error, or other logic here
  });

  commander
    .version("0.0.1-alpha")
    .option("-p, --port <number>", "Port to listen on, defaults to 12345.", 12345)
    .option("--nossl", "If passed, do not use SSL. Needed for ScriptPlayer. SSL on by default otherwise.", false)
    .parse(process.argv);

  let wsServerProxy;
  let wsClientProxy;
  console.log("Using SSL.");
  const attrs = [{
    name: "commonName",
    value: "buttplug.localhost",
  }, {
    name: "organizationName",
    value: "Metafetish",
  }];

  let pems: any = {};
  const existsAsync = util.promisify(fs.exists);

  if (await existsAsync("cert.pem") && await existsAsync("private.pem")) {
    console.log("Loading keys");
    pems.cert = fs.readFileSync("cert.pem");
    pems.private = fs.readFileSync("private.pem");
  } else {
    console.log("Creating keys");
    pems = selfsigned.generate(undefined, { days: 365 });
    fs.writeFileSync("cert.pem", pems.cert);
    fs.writeFileSync("private.pem", pems.private);
  }

  const serverProxy = https.createServer({
    cert: pems.cert,
    key: pems.private,
  }).listen(12346);
  const clientProxy = https.createServer({
    cert: pems.cert,
    key: pems.private,
  }).listen(12345);

  wsServerProxy = new ws.Server({
    server: serverProxy
  });
  wsClientProxy = new ws.Server({
    server: clientProxy
  });

  let serverProxyClient;
  let clientProxyClient;
  wsServerProxy.on("connection", function connection(client) {
    console.log("Server connected");
    serverProxyClient = client;
    serverProxyClient.on("message", async (message) => {
      clientProxyClient.send(message);
    });
  });
  wsClientProxy.on("connection", function connection(client) {
    console.log("Client connected");
    clientProxyClient = client;
    clientProxyClient.on("message", async (message) => {
      serverProxyClient.send(message);
    });
  });

  if (process.platform === "win32") {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // rl.on("SIGINT", () => {
    //   process.emit("SIGINT");
    // });
  }

  process.on("SIGINT", () => {

    process.exit();
  });
}

main();
