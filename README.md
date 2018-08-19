# node-clinic-bubbleprof
[![npm version][npm-version]][npm-url] [![Stability Stable][stability-stable]][stability-docs] [![CircleCI build status][circleci-status]][circleci-url] [![Appveyor build status][appveyor-status]][appveyor-url]
[![Downloads][npm-downloads]][npm-url] [![Code style][lint-standard]][lint-standard-url]

Programmable interface to [clinic][clinic-url] bubbleprof

![banner](logo.png)

## Supported node versions

Node.js 10.0.0 and above
Node.js 9.4.0 and above
Node.js 8.10.0 and above

## Example

```js
const ClinicBubbleprof = require('@nearform/bubbleprof')
const bubbleprof = new ClinicBubbleprof()

bubbleprof.collect(['node', './path-to-script.js'], function (err, filepath) {
  if (err) throw err

  bubbleprof.visualize(filepath, filepath + '.html', function (err) {
    if (err) throw err
  })
})
```

To get started with bubbleprof you might want to take a look at the [examples repo](https://github.com/nearform/node-clinic-bubbleprof-examples).

## Documentation

```js
const ClinicBubbleprof = require('@nearform/bubbleprof')
const bubbleprof = new ClinicBubbleprof()
```

#### `bubbleprof.collect(args, callback)`

Starts a process by using:

```js
const { spawn } = require('child_process')
spawn(args[0], ['-r', 'sampler.js'].concat(args.slice(1)))
```

The injected sampler will produce a file in the current working directory, with the process `PID` in its filename. The filepath relative to the current working directory will be the value in the callback.

stdout, stderr, and stdin will be relayed to the calling process. As will the `SIGINT` event.

#### `bubbleprof.visualize(dataFilename, outputFilename, callback)`

Will consume the data file specified by `dataFilename`, this data file will be produced by the sampler using `bubbleprof.collect`.

`bubbleprof.visualize` will then output a standalone HTML file to `outputFilename`. When completed the callback will be called with no extra arguments, except a possible error.

## License
[GPL 3.0](LICENSE)

[stability-stable]: https://img.shields.io/badge/stability-stable-green.svg?style=flat-square
[stability-docs]: https://nodejs.org/api/documentation.html#documentation_stability_index
[npm-version]: https://img.shields.io/npm/v/@nearform/bubbleprof.svg?style=flat-square
[npm-url]: https://www.npmjs.org/@nearform/bubbleprof
[circleci-status]: https://circleci.com/gh/nearform/node-clinic-bubbleprof/tree/master.svg?style=shield&circle-token=82bfc179bd7ca96fd9183a66c40cefcfb93b07ea
[circleci-url]: https://circleci.com/gh/nearform/node-clinic-bubbleprof
[npm-downloads]: http://img.shields.io/npm/dm/@nearform/bubbleprof.svg?style=flat-square
[lint-standard]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[lint-standard-url]: https://github.com/feross/standard
[clinic-url]: https://github.com/nearform/node-clinic
[appveyor-status]: https://ci.appveyor.com/api/projects/status/vnqc76526mjf0sdh/branch/master?svg=true
[appveyor-url]: https://ci.appveyor.com/project/nearForm/node-clinic-bubbleprof/branch/master
