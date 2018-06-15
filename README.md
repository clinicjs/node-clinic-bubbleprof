# node-clinic-bubbleprof
[![npm version][2]][3] [![build status][4]][5] [![build status][13]][14]
[![downloads][8]][9] [![js-standard-style][10]][11]

Programmable interface to [clinic][12] bubbleprof

![banner](logo.png)

## Supported node versions
Node.js 9.4.0 and above
Node.js 8.10.0 and above

## Example

```js
const ClinicBubbleprof = require('clinic-bubbleprof')
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
const ClinicBubbleprof = require('clinic-bubbleprof')
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
[Apache 2.0](https://tldrlegal.com/license/apache-license-2.0-(apache-2.0))

[0]: https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square
[1]: https://nodejs.org/api/documentation.html#documentation_stability_index
[2]: https://img.shields.io/npm/v/@nearform/clinic-bubbleprof.svg?style=flat-square
[3]: https://www.npmjs.org/@nearform/clinic-bubbleprof
[4]: https://circleci.com/gh/nearform/node-clinic-bubbleprof/tree/master.svg?style=shield&circle-token=82bfc179bd7ca96fd9183a66c40cefcfb93b07ea
[5]: https://circleci.com/gh/nearform/node-clinic-bubbleprof
[6]: https://img.shields.io/codecov/c/github/nearform/node-clinic-bubbleprof/master.svg?style=flat-square
[7]: https://codecov.io/github/nearform/node-clinic-bubbleprof
[8]: http://img.shields.io/npm/dm/@nearform/clinic-bubbleprof.svg?style=flat-square
[9]: https://www.npmjs.org/@nearform/clinic-bubbleprof
[10]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[11]: https://github.com/feross/standard
[12]: https://github.com/nearform/node-clinic
[13]: https://ci.appveyor.com/api/projects/status/vnqc76526mjf0sdh/branch/master?svg=true
[14]: https://ci.appveyor.com/project/nearForm/node-clinic-bubbleprof/branch/master
