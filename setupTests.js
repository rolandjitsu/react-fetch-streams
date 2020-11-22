// Adds custom jest matchers for asserting on DOM nodes.
// https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');

// Add support for ReadableStream and friends
// https://github.com/MattiasBuelens/web-streams-polyfill
require('web-streams-polyfill/es2018');

// Config fetch-mock
// https://github.com/wheresrhys/fetch-mock
const {config} = require('fetch-mock-jest');
// Don't convert anything to JSON
config.sendAsJson = false;
// NOTE: Need to set these, otherwise fetch-mock won't use the Response
// we set during the test.
config.Headers = Headers;
config.Request = Request;
config.Response = Response;
config.Response = Response;
config.Promise = Promise;
config.fetch = fetch;
