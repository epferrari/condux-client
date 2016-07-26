# CHANGELOG

## 0.4.3

- fixed `_resubscribeFrequencies is undefined` error on reconnection

## 0.4.2

- added `persistence` getter to `<ConduxClient>` instance
- added `updatePersistence` method to `<ConduxClient>` instance
- `persistence.interval` can now accept a function that can calculate a delay between reconnection attempts based on number of previous attempts
- `enablePersistence` and `disablePersistence` both modified to use `updatePersistence` method
- internal refactor of `<Frequency>.addListener` to auto-bind callbacks to the listener instead of using apply() at call time

## 0.4.1

- bug fix in `<Frequency>.addListener`

## 0.4.0

### Package Name change (!!)

- reflux-nexus-client => condux-client
- published to npm
- **condux** = conduit + flux.

### Additions

- *added* static constant `ConduxClient.CONNECTED`
- *added* static constant `ConduxClient.CONNECTING`
- *added* static constant `ConduxClient.DISCONNECTED`

### Misc

- better API documentation


## 0.3.1

- *added* `connected` and `connecting` getter methods to `<ClientNexus>`
- bug fixes in `<ClientNexus>.reconnect`


## 0.3.0


###Breaking Changes

- the `ClientNexus` constructor no longer takes a SockJS instance as it only argument.
Instead it takes the url of the ServerNexus as its first argument. SockJS is now an explicit
dependency of reflux-nexus-client, and `<ClientNexus>.connect` creates the SockJS instance from the
url passed to the constructor.
- `ClientNexus.Connect` is now `ClientNexus.ReactConnectMixin`

### Non-Breaking Changes

- *added* connection persistence. The `ClientNexus` constructor now accepts a second argument, an object of persistence options. See [README](README.md/#new_ClientNexus_new)
- *added* instance method `disablePersistence` method was added to the `ClientNexus` prototype to disable automatic reconnection attempts when websocket closes
- *added* instance method `enablePersistence` method was added to the `ClientNexus` prototype to enable automatic reconnection attempts when websocket closes
