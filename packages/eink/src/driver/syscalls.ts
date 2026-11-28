/**
 * The only file that knows about the FFI bridge (Koffi today, node:ffi once
 * it is stable). open/read/close use Node's fs (real OS fds); ioctl, fcntl
 * and native memory need FFI.
 *
 * Tests replace this module with a fake (`syscalls.fake.ts`), so everything
 * above it runs unchanged against a simulated kernel.
 */
import fs from "node:fs";
import koffi from "koffi";
import { F_GETFL, F_SETFL, O_NONBLOCK } from "./abi.ts";

const libc = koffi.load("libc.so.6");
const ioctlFn = libc.func("int ioctl(int fd, unsigned long request, ...)");
const fcntlFn = libc.func("int fcntl(int fd, int cmd, ...)");

/** A failed syscall, with the kernel's errno. */
export class SyscallError extends Error {
  constructor(
    message: string,
    readonly errno: number,
  ) {
    super(`${message}: errno ${errno}`);
  }
}

export function open(path: string, flags: "r" | "r+"): number {
  return fs.openSync(path, flags);
}

export function close(fd: number): void {
  fs.closeSync(fd);
}

/** ioctl with a Buffer argument passed in place (kernel writes are visible). */
export function ioctl(fd: number, request: number, arg: Buffer): void {
  if ((ioctlFn(fd, request, "void *", arg) as number) < 0) {
    throw new SyscallError(`ioctl(fd ${fd}, 0x${request.toString(16)})`, koffi.errno());
  }
}

/**
 * Make reads on `fd` return at once instead of waiting for data. A blocking
 * read parks a libuv worker that closing the fd does not wake, so the
 * process could not exit until the next button press.
 */
export function setNonBlocking(fd: number): void {
  const flags = fcntlFn(fd, F_GETFL, "int", 0) as number;
  if (flags < 0 || (fcntlFn(fd, F_SETFL, "int", flags | O_NONBLOCK) as number) < 0) {
    throw new SyscallError(`fcntl(fd ${fd}, O_NONBLOCK)`, koffi.errno());
  }
}

/** Read from a non-blocking fd. Returns 0 when there is nothing to read. */
export function read(fd: number, buf: Buffer): number {
  try {
    return fs.readSync(fd, buf, 0, buf.length, null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EAGAIN") return 0;
    throw err;
  }
}

/** Native memory with a stable address, for pointers inside structs (SPI tx_buf). */
export interface NativeBuffer {
  address: bigint;
  bytes: Uint8Array;
  free(): void;
}

export function allocNative(size: number): NativeBuffer {
  const ptr = koffi.alloc("uint8_t", size);
  return {
    address: koffi.address(ptr),
    bytes: new Uint8Array(koffi.view(ptr, size)),
    free: () => koffi.free(ptr),
  };
}
