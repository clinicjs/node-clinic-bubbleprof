'use strict'

const dummyCallbackEvents = [
  { i: 'root', delayStart: undefined, before: undefined, after: undefined, aggregateId: 'root', clusterId: 'A' },
  { i: 0, delayStart: 9, before: 14, after: 15.5, aggregateId: 'a', clusterId: 'A' },
  { i: 1, delayStart: 13, before: 15, after: 15.5, aggregateId: 'b', clusterId: 'A' },
  { i: 2, delayStart: 16.5, before: 17, after: 17.5, aggregateId: 'e', clusterId: 'C' }, // is sources[0] on aggregateId e
  { i: 3, delayStart: 3, before: 17.5, after: 19, aggregateId: 'a', clusterId: 'A' },
  { i: 4, delayStart: 18.5, before: 19, after: 19.5, aggregateId: 'c', clusterId: 'A' },
  { i: 5, delayStart: 18, before: 19.5, after: 22, aggregateId: 'c', clusterId: 'A' },
  { i: 6, delayStart: 18.5, before: 20, after: 21.5, aggregateId: 'c', clusterId: 'A' },
  { i: 7, delayStart: 20, before: 21, after: 22, aggregateId: 'a', clusterId: 'A' },
  { i: 8, delayStart: 16, before: 22, after: 23.5, aggregateId: 'd', clusterId: 'B' }, // is sources[0] on aggregateId d
  { i: 9, delayStart: 20, before: 24, after: 25.5, aggregateId: 'e', clusterId: 'C' }, // is sources[1] on aggregateId e
  { i: 10, delayStart: 23.5, before: 24, after: 24.5, aggregateId: 'e', clusterId: 'C' }, // is sources[2] on aggregateId e

  // Attaches to .before and .after arrays of sources[0] on aggregateId d, instead of adding new asyncId to .sources[]
  { i: 11, /* gets delayStart of 24 */ before: 25, after: 25.5, aggregateId: 'd', clusterId: 'B', sourceKey: 0 },

  // Attaches to .before and .after arrays of sources[2] on aggregateId e, instead of adding new asyncId to .sources[]
  { i: 12, /* gets delayStart of 24.5 */ before: 25, after: 25.5, aggregateId: 'e', clusterId: 'C', sourceKey: 2 },

  { i: 13, delayStart: 21, before: 27, after: 28, aggregateId: 'f', clusterId: 'B' },
  { i: 14, delayStart: 27.5, before: 28, after: 28.5, aggregateId: 'a', clusterId: 'A' },
  { i: 15, delayStart: 24.5, before: 28.5, after: 29, aggregateId: 'g', clusterId: 'B' },
  { i: 16, delayStart: 25, before: 29, after: 29.5, aggregateId: 'h', clusterId: 'C' }
]

const dummyClusterNodes = {
  A: { nodes: ['root', 'a', 'b', 'c'] },
  B: { nodes: ['d', 'f', 'g'], parentClusterId: 'A' },
  C: { nodes: ['e', 'h'], parentClusterId: 'A' }
}

const dummyAggregateNodes = {
  root: { isRoot: true },
  a: { parentAggregateId: 'root', type: 'ZLIB', mark: ['module', null, null] },
  b: { parentAggregateId: 'root', type: 'GETADDRINFOREQWRAP', mark: ['nodecore', null, null] },
  c: { parentAggregateId: 'a', type: 'UDPSENDWRAP', mark: ['nodecore', null, null] },
  d: { parentAggregateId: 'c', type: 'PROCESSWRAP', mark: ['user', null, null] },
  e: { parentAggregateId: 'b', type: 'someCustomType', mark: ['module', null, null] },
  f: { parentAggregateId: 'd', type: 'FSEVENTWRAP', mark: ['module', null, null] },
  g: { parentAggregateId: 'f', type: 'PROCESSWRAP', mark: ['nodecore', null, null] },
  h: { parentAggregateId: 'a', type: 'ANOTHERCUSTOMTYPE', mark: ['user', null, null] }
}

/**
 * Diagrams showing how the above events and nodes interrelate:
 *
 **********************************************************************************
 * NODE CONNECTIONS:
 **********************************************************************************
 *
 *                    -----------------
 *                   |*** CLUSTER A ***|
 *                   |    [ag root]    |
 *                   |       /  \      |
 *                   |  [ag a] [ag b]  |
 *                   |     / \    \    |
 *                   |[ag c]  \    \   |
 *                    ---/-----\----\--
 *                      /       \    \
 *           ----------/----     \ ---\-----------
 *          |** CLUSTER B **|     \** CLUSTER C **|
 *          |      [ag d]   |     |\   [ag e]     |
 *          |       /       |     | \             |
 *          |    [ag f]     |     |  \            |
 *          |     /         |     |   \           |
 *          |  [ag g]       |     |    [ag h]     |
 *           ---------------       ---------------
 *
 *
 **********************************************************************************
 * NODES OVER TIME:
 **********************************************************************************
 * Each character below represents 0.5 units of time
 * letter = async delay (.delayStart -> .before)
 *      ▓ = sync processing (.before -> .after)
 * For example, ddd▓ = 1.5 async delay & 0.5 sync delay, in one callbackEvent, on aggregateNode d
 *
 * Test slices defined in 'Visualizer CallbackEvents - Wall time slices' test:
 *                     sliceA: __ (10 - 11)     sliceB: ______ (22.5 - 25)
 *  -----|-------------------------------------------------------------
 *  i=   | Time -------->      ⒑                  ⒛
 *       | 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9  Totals:     asyncIds:
 *  -----|-------------------------------------------------------------
 * [16]Cb|                                                   hhhhhhhh▓  raw:  4     asyncId: 15
 * [15]Bw|                                                  gggggggg▓   raw:  4     asyncId: 14
 * [14]Aw|                                                        a▓    raw:  0.5   asyncId: 13
 * [13]Bw|                                           ffffffffffff▓▓     raw:  6     asyncId: 12
 * [12]Cb|                                                  e▓          raw:  0.5   asyncId: 11 *
 * [11]Bb|                                                ddd▓          raw:  1.5   asyncId:  9 *
 * [10]Cb|                                                e▓            raw:  0.5   asyncId: 11
 *  [9]Cb|                                         eeeeeeee▓▓▓          raw:  4     asyncId: 10
 *  [8]Bb|                                 dddddddddddd▓▓▓              raw:  6     asyncId:  9
 *  [7]Aw|                                         aa▓▓                 raw:  1     asyncId:  8
 *  [6]Aw|                                      ccc▓▓▓                  raw:  2.0   asyncId:  7
 *  [5]Aw|                                     ccc▓▓▓▓▓                 raw:  1.5   asyncId:  6
 *  [4]Aw|                                      c▓                      raw:  0.5   asyncId:  5
 *  [3]Aw|       aaaaaaaaaaaaaaaaaaaaaaaaaaaaa▓▓▓                       raw: 14.5   asyncId:  4
 *  [2]Cw|                                  e▓                          raw:  0.5   asyncId:  3
 *  [1]Aw|                           bbbb▓                              raw:  2     asyncId:  2
 *  [0]Aw|                   aaaaaaaaaa▓▓▓                              raw:  5     asyncId:  1
 *  -----|------------------------------------------------------------            * See comments in
 *       | 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9      dummyCallbackEvents def
 *
 *  Flattened times (times when any event is busy) based on the above:  Expected
 *  -----|------------------------------------------------------------  results (ms):
 *       | Flattened async by aggregate node:
 *      a|       aaaaaaaaaaaaaaaaaaaaaaaaaaaaa     aa             a     16
 *      b|                           bbbb                                2
 *      c|                                     cccc                      2
 *      d|                                 dddddddddddd   ddd            7.5
 *      e|                                  e      eeeeeeeee             5
 *      f|                                           ffffffffffff        6
 *      g|                                                  gggggggg     4
 *      h|                                                   hhhhhhhh    4
 *  -----|------------------------------------------------------------
 *       | Flattened async BETWEEN (b) cluster nodes:
 *      A|                                                               0
 *      B|                                 BBBBBBBBBBBB   BBB            7.5
 *      C|                                  C      CCCCCCCC CCCCCCCCC    9
 *  -----|------------------------------------------------------------
 *       | Flattened async WITHIN (w) cluster nodes:
 *      A|       AAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAA             A     18
 *      B|                                           BBBBBBBBBBBBBBB     7.5
 *      C|                                                               0
 *  -----|------------------------------------------------------------
 *       | Flattened sync by aggregate node:
 *      a|                             aaa    aaa    aa            a     4.5
 *      b|                               b                               0.5
 *      c|                                       cccccc                  3
 *      d|                                             ddd   d           2
 *      e|                                   e             eee           2
 *      f|                                                       ff      1
 *      g|                                                          g    0.5
 *      h|                                                           h   0.5
 *  -----|------------------------------------------------------------
 *       | Flattened sync by cluster nodes:
 *      A|                             AAA    AAAAAAAAA            A     6.5
 *      B|                                             BBB   B   BB B    3.5
 *      C|                                  C              CCC       C   2.5
 *
 * Raw async stats:
 *  A. between: 0, within: 26.5; B. between: 9, within: 10; C. between: 13.5, within: 0
 *  a: 21, b: 2.5, c: 3.5, d: 9, e: 5.5, f: 6, g: 4, h: 4
 *
 * Raw sync stats:
 * A: 10, B: 3.5, C: 3
 * a: 4.5, b: 1, c: 4.5, d: 2, e: 3, f: 2, g: 0.5, h: 0.5
 *
**/

const expectedClusterResults = new Map(Object.entries({
  A: {
    async: {
      within: 18,
      between: 0
    },
    sync: 6.5,
    rawTotals: {
      async: {
        within: 26.5,
        between: 0
      },
      sync: 9.5
    }
  },
  B: {
    async: {
      within: 7.5,
      between: 7.5
    },
    sync: 3.5,
    rawTotals: {
      async: {
        within: 10,
        between: 7.5
      },
      sync: 3.5
    }
  },
  C: {
    async: {
      within: 0,
      between: 9
    },
    sync: 2.5,
    rawTotals: {
      async: {
        within: 0,
        between: 9.5
      },
      sync: 3.5
    }
  }
}))

// Only define .rawSync if it's different to .sync
const expectedAggregateResults = new Map(Object.entries({
  root: {
    async: 0,
    sync: 0,
    raw: 0
  },
  a: {
    async: 16,
    sync: 4.5,
    raw: 21
  },
  b: {
    async: 2,
    sync: 0.5,
    raw: 2
  },
  c: {
    async: 2,
    sync: 3,
    raw: 3.5,
    rawSync: 4.5
  },
  d: {
    async: 7.5,
    sync: 2,
    raw: 7.5
  },
  e: {
    async: 5,
    sync: 2,
    raw: 5.5,
    rawSync: 3
  },
  f: {
    async: 6,
    sync: 1,
    raw: 6
  },
  g: {
    async: 4,
    sync: 0.5,
    raw: 4
  },
  h: {
    async: 4,
    sync: 0.5,
    raw: 4
  }
}))

const expectedTypeSubCategories = new Map(Object.entries({
  root: 'root',
  a: 'zlib',
  b: 'dns',
  c: 'network',
  d: 'process',
  e: 'user-defined',
  f: 'fs',
  g: 'process',
  h: 'user-defined'
}))

const expectedTypeCategories = new Map(Object.entries({
  root: 'other',
  a: 'files-streams',
  b: 'networks',
  c: 'networks',
  d: 'other',
  e: 'other',
  f: 'files-streams',
  g: 'other',
  h: 'other'
}))

const expectedDecimalsTo5Places = new Map(Object.entries({
  A: {
    type: {
      between: new Map(),
      within: new Map(Object.entries({
        ZLIB: 0.70833,
        GETADDRINFOREQWRAP: 0.06944,
        UDPSENDWRAP: 0.22222
      }))
    },
    /* TODO: Re-implement when type category labels are stable
    typeCategory: {
      between: new Map(),
      within: new Map(Object.entries({
        zlib: 0.70833,
        dns: 0.06944,
        network: 0.22222
      }))
    },
    */
    party: {
      between: new Map(),
      within: new Map(Object.entries({
        module: 0.70833,
        nodecore: 0.29167
      }))
    }
  },
  B: {
    type: {
      between: new Map(Object.entries({
        PROCESSWRAP: 1
      })),
      within: new Map(Object.entries({
        PROCESSWRAP: 0.48148,
        FSEVENTWRAP: 0.51852
      }))
    },
    /* TODO: Re-implement when type category labels are stable
    typeCategory: {
      between: new Map(Object.entries({
        process: 1
      })),
      within: new Map(Object.entries({
        process: 0.48148,
        fs: 0.51852
      }))
    },
    */
    party: {
      between: new Map(Object.entries({
        user: 1
      })),
      within: new Map(Object.entries({
        user: 0.14815,
        module: 0.51852,
        nodecore: 0.33333
      }))
    }
  },
  C: {
    type: {
      between: new Map(Object.entries({
        someCustomType: 0.57895,
        ANOTHERCUSTOMTYPE: 0.42105
      })),
      within: new Map(Object.entries({
        someCustomType: 0.85714,
        ANOTHERCUSTOMTYPE: 0.14286
      }))
    },
    /* TODO: Re-implement when type category labels are stable
    typeCategory: {
      between: new Map(Object.entries({
        'user-defined': 1
      })),
      within: new Map(Object.entries({
        'user-defined': 1
      }))
    },
    */
    party: {
      between: new Map(Object.entries({
        module: 0.57895,
        user: 0.42105
      })),
      within: new Map(Object.entries({
        module: 0.85714,
        user: 0.14286
      }))
    }
  }
}))

const clusterNodes = new Map(Object.entries(dummyClusterNodes))
const aggregateNodes = new Map(Object.entries(dummyAggregateNodes))

module.exports = {
  clusterNodes,
  aggregateNodes,
  dummyCallbackEvents,
  expectedClusterResults,
  expectedAggregateResults,
  expectedTypeCategories,
  expectedTypeSubCategories,
  expectedDecimalsTo5Places
}
