/// <reference path="../node_modules/assemblyscript/std/assembly/rt/index.d.ts" />
const workloads = memory.data(offsetof<Workload>() * 16);

// @ts-ignore
@external("env", "log")
declare function log(id: i32): void;

let rr = 0;
let globalThreadCount = 0;

const ARENA_SIZE = 4000;

export function master(threadCount: i32): void {
  for (let i = 0; i < threadCount; i++) {
    let workload = changetype<Workload>(workloads + i * threadCount);
    workload.block = __alloc(ARENA_SIZE, idof<ArrayBuffer>());
    workload.run = 0;
    workload.size = ARENA_SIZE;
    workload.result = 0;
  }
  globalThreadCount = threadCount;
}

export function delegate(fp: (input: usize, self: Workload) => usize, complete: (work: Workload) => void, result: usize): void {
  while (true) {
    let worker = assert(getWorkload(rr));
    if (worker.isFree) {
      worker.fp = assert(fp);
      worker.complete = assert(complete);
      worker.result = result;
      worker.semaphore = 1;
      break;
    } else {
      rr ++;
      if (rr >= globalThreadCount) {
        rr = 0;
      }
    }
  }
}

export function serverTick(): void {
  for (let i = 0; i < globalThreadCount; i++) {
    let work = getWorkload(i);
    if (work.isComplete) {
      work.complete(work);
      work.resetMemory();
      work.semaphore = 0;
    }
  }
}

function exampleFunc(input: usize, workload: Workload): usize {
  assert(input == 0);
  let ptr = workload.allocate(256);
  for (let i: u16 = 0; i < 256; i++) {
    log(<i32>i);
    store<u8>(<usize>i + ptr, <u8>i);
  }
  return ptr;
}

function cleanup(workload: Workload): void {
  let ptr = workload.result;
  for (let i: u16 = 0; i < 256; i++) {
    assert(<u8>i == load<u8>(ptr + <usize>i));
  }
  log(42);
}

export function example(): void {
  delegate(exampleFunc, cleanup, 0);
}

@unmanaged
class Workload {
  _semaphore: i32;
  fp: (input: usize, self: Workload) => usize;
  block: usize;
  size: usize;
  run: usize;
  result: usize;
  complete: (work: Workload) => void = (work: Workload) => {};

  allocate(size: usize): usize {
    let result = this.run;
    let block = this.block;
    assert(
      block != 0
      && result + size < this.size,
      "Cannot allocate memory from block."
    );
    this.run += size;
    result += block;
    memory.fill(result, 0, size);
    return this.block + result;
  }

  resetMemory(): void {
    memory.fill(this.block, 0, this.size);
    this.run = 0;
  }

  get semaphore(): i32 {
    return atomic.load<i32>(changetype<usize>(this), offsetof<Workload>("_semaphore"));
  }

  set semaphore(value: i32) {
    atomic.store<i32>(changetype<usize>(this), value, offsetof<Workload>("_semaphore"));
    if (value == 1) atomic.notify(changetype<usize>(this) + offsetof<Workload>("_semaphore"), 1);
  }

  get isFree(): bool {
    return this.semaphore == 0;
  }

  get isReady(): bool {
    return this.semaphore == 1;
  }

  get isComplete(): bool {
    return this.semaphore == 2;
  }

  dispatch(): void {
    this.result = this.fp(this.result, this);
    this.semaphore = 2;
  }

  wait(): void {
    for (let i = 0; i < 3; i++) {
      if (this.isReady) return;
      if (this.isReady) return;
      if (this.isReady) return;
      if (this.isReady) return;
      if (this.isReady) return;
      let result = atomic.wait<i32>(changetype<usize>(this) + offsetof<Workload>("_semaphore"), 1, 10);
      if (result === AtomicWaitResult.OK) return;
    }
  }
}

function getWorkload(id: i32): Workload {
  return changetype<Workload>(workloads + offsetof<Workload>() * id);
}

export function workerTick(threadID: i32): void {
  let work = getWorkload(threadID);
  if (work.isReady) {
    work.dispatch();
    return;
  }
  work.wait();
  if (work.isReady) work.dispatch();
}

// @ts-ignore
export { memory }
