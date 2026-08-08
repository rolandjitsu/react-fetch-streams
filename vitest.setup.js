// jsdom does not implement the WHATWG Streams APIs. Pull them from Node core so
// the hook and tests can build ReadableStreams the way a browser would.
import {ReadableStream, TransformStream, WritableStream} from 'node:stream/web';

globalThis.ReadableStream ??= ReadableStream;
globalThis.TransformStream ??= TransformStream;
globalThis.WritableStream ??= WritableStream;
