import { parentPort, workerData } from "worker_threads";
import { promises as fs } from "fs";
const demangle = require("assemblyscript/lib/loader").demangle;

const memory = workerData.memory;

fs.readFile("./build/worker.wasm")
  .then(e => WebAssembly.instantiate(e, {
    env: {
      log(value: number) {
        parentPort!.postMessage("trace from worker: " + workerData.id + " -> " + value);
      },
      trace() {
      },
      abort() {},
      memory,
    }
  }))
  .then(mod => {
    const threadID = workerData.id;
    const instance = mod.instance;
    const wasm = demangle(instance.exports);
    parentPort!.postMessage("Worker " + threadID + " instantiated.");
    wasm.workerTick(threadID);
    function tick() {
      setTimeout(tick, 0);
      wasm.workerTick(threadID);
    }
    setTimeout(tick, 0);
  });
