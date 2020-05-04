import { Worker } from "worker_threads";
import { promises as fs } from "fs";

const demangle = require("assemblyscript/lib/loader").demangle;
const WORKER_COUNT = 1;

async function main(): Promise<void> {
  const buffer = await fs.readFile("./build/master.wasm");
  const memory = new WebAssembly.Memory({
    // @ts-ignore
    shared: true,
    initial: 10000,
    maximum: 10000,
  });
  const mod = await WebAssembly.instantiate(buffer, {
    env: {
      log(value: number) {
        console.log("trace from master: " + value);
      },
      trace() {},
      abort() {},
      memory,
    },
  });
  const wasm = demangle(mod.instance.exports);
  if (!(memory.buffer instanceof SharedArrayBuffer)) throw new Error("Stuff didn't work :)");
  wasm.master(WORKER_COUNT);
  for (let i = 0; i < WORKER_COUNT; i++) {
    let worker = new Worker(require.resolve("./worker"), {
      workerData: {
        id: i,
        memory,
      },
      env: process.env,
    });
    worker.ref();
    worker.on("exit", () => console.log("Exit"));
    worker.on("online", () => console.log("Online"));
    worker.on("error", (err) => {
      console.log("Worker Error:", i, err);
    });
    worker.on("message", (value) => console.log(value));
  }
  wasm.example();
  function tick() {
    setTimeout(tick, 0);
    wasm.serverTick();
  }
  setTimeout(tick, 0);
}

main().catch(reason => console.error(reason));
