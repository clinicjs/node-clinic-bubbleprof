# Welcome to Clinic.js!

Please take a second to read over this before opening an issue. Providing complete information upfront will help us address any issue (and ship new features!) faster.

We greatly appreciate bug fixes, documentation improvements and new features, however when contributing a new major feature, it is a good idea to idea to first open an issue, to make sure the feature it fits with the goal of the project, so we don't waste your or our time.

## Code of Conduct

The Clinic.js project has a [Code of Conduct][CoC] that all contributors are
expected to follow.

## Bug Reports

A perfect bug report would have the following:

1. Summary of the issue you are experiencing.
2. Details on what versions of Node.js and Clinic.js you have (`node -v` and `clinic -v`).
3. A simple repeatable test case for us to run. Please try to run through it 2-3 times to ensure it is completely repeatable.

We would like to avoid issues that require a follow up questions to identify the bug. These follow ups are difficult to do unless we have a repeatable test case.

In addition, it is helpful if you upload your Clinic.js data to help us diagnose your issues.
Use the `clinic upload` tool to do this:

```
clinic upload 10000.clinic-doctor
```

After the upload has finished, add the printed upload id to your issue.

## For Developers

### Automated Tests

All contributions should fit the [standard](https://github.com/standard/standard) linter, and pass the tests.
You can test this by running:

```
npm test
```

In addition, make sure to add tests for any new features.
You can test the test coverage by running:

```
npm run ci-cov
```

### Manual Tests

For quick setup use [demo](https://github.com/clinicjs/node-clinic-bubbleprof-demo) and [examples](https://github.com/clinicjs/node-clinic-bubbleprof-examples)

We have also prepared a wide range of "real" samples which can be used during development. These samples can be downloaded from [here (930MB)](https://clinic-submit.nearform.net/data/bulk?id=fac951815d06615f0ca7ac5a813204777a0a6bf748b2d659f7cb3796623bb0ca&id=e6729cb8d620dad4e4540a3c4c67e25e5a7b6294160f06d6cfd2d4e28c677c1f&id=3fac27a61b1d1f5619e2d976103ad4a9e5bd0e45a36289beed0452f4d052df20&id=0654292db03925a0e5a3fb353d0356aca91fe6ce70f17a2332edefbcc46e72f7&id=77797d77e6e79aa87296066f1a71ba88f613f27415f638bd307d7cdbb1e64fdf&id=16b85abb28cf5a486c704f65012ac8ccece66333ca51af2e12f450d472a3b666&id=0ea0e4b4a3edf675221b0cd2dfe274ae8c022a3bf2bcb33561ca255d10c1c027&id=10fa1f93ef424a9201acf368a90c46408736ef62a702412acfdbd2814838ce54&id=59e873d5673ff64ccb5400b0a5491fa54c6c138de532cbbe84ba711fae54494e&id=a5f5089b5a87e3b6c4c37f69e6a664d523acf3dd3bee275e39c9b963d74ba4e0&id=f4a1bd1972336d48e4f18ea7d313dd17d2cb12fc7229a0dddea374ffcf2f6722&id=a39d6b7f4e74b7fea4678b20499225d5b577c3e81130bedb41146cd035146206&id=d2db315afb3c7b9fffa097ab287ae64109d04f9a92bace0584e8d6ce3854828a&id=1e06931188c30c0f56063f7e6d62e900c9190aba277a6008bcf949080ef70a7f&id=07a89d14bb38f1b166b8bec797618434f81f083a93696bd69b8cb65526746ccc&id=3e0d15f1337263d48056d5908eaa7e1828060ecf002036428522cef19323322c&id=154c5986b633572969c1baa2c9ef322d1e007464390fb9ab29648f1e8bfca888&id=7a980817d360185c502b5fe7842803ece6029690987a1cf715e1a046b63f9dd0&id=c9f50c0a0bb042ed05f217b097b31e0b1a34309a925e3b2dd2871ff3a6c2dab6). They contain profiles of [Acmeair](https://github.com/acmeair/acmeair-nodejs), [Udaru](https://github.com/nearform/udaru), [Loopback](http://loopback.io/doc/en/lb3/Getting-started-with-LoopBack.html) and [ApostropheCMS](https://apostrophecms.org/docs/tutorials/getting-started/creating-your-first-project.html).

After unzipping the tarball, give the folder a name (e.g. `node-clinic-bubbleprof-samples`) and run the visualize-all command from your local Bubbleprof folder (command below assumes folders are side by side):
```
npm run visualize-all ../node-clinic-bubbleprof-samples/*.clinic-bubbleprof
```
Generating all of those samples at once may take a while. It is also possible to generate a single sample or a small selection of them
```
npm run visualize-all ../node-clinic-bubbleprof-samples/15896.clinic-bubbleprof ../node-clinic-bubbleprof-samples/7078.clinic-bubbleprof
```

`npm run visualize-all` is very useful at quickly iterating over a sample - or a set of samples - as it runs `analysis` and `vizualizer` without the need to `collect` the data again. Simply reload the html after the command has finished to see your changes.

## For Collaborators

Make sure to get a `:thumbsup:`, `+1` or `LGTM` from another collaborator before merging a PR. If you aren't sure if a release should happen, open an issue.

Release process:

- `npm test`
- `npm version <major|minor|patch>`
- `git push && git push --tags`
- `npm publish`

-----------------------------------------

## Licensing and Certification

All contributions to the Clinic.js project are submitted *to* the
project under the MIT license.

The Clinic.js project uses a Contribution Certification that is derived from
the [Developer Certificate of Origin][DCO]. It is important to note that the
Contribution Certification *is not the same as the standard DCO* and we do not
use the term "DCO" or "Developer Certificate of Origin" to describe it to avoid
confusion. Nevertheless, the intent and purpose is effectively the same.

Every contributor agrees to the Contribution Certification by including a
`Signed-off-by` statement within each commit. The statement *must* include
the contributor's real full name and email address.

```
Signed-off-by: J. Random User <j.random.user@example.com>
```

### Certification

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I have the right
to and hereby submit it under the MIT license; or

(b) The contribution is based upon previous work that, to the best of my
knowledge, is covered under an appropriate open source license and I have the
right under that license to submit that work with modifications, whether created
in whole or in part by me, under the MIT License; or

(c) The contribution was provided directly to me by some other person who
certified (a), (b) or (c) and I have not modified it.

(d) I understand and agree that this project and the contribution are public
and that a record of the contribution (including all personal information I
submit with it, including my sign-off) is maintained indefinitely and may be
redistributed consistent with this project or license(s) involved.

[CoC]: CODE_OF_CONDUCT.md
[DCO]: https://developercertificate.org/
