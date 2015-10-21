# CHANGELOG

## 0.3.0


###Breaking Changes

- the `ClientNexus` constructor no longer takes a SockJS instance as it only argument.
Instead it takes the url of the ServerNexus as its first argument. SockJS is now an explicit
dependency of reflux-nexus-client, and `<ClientNexus>.connect` creates the SockJS instance from the
url passed to the constructor.
- `ClientNexus.Connect` is now `ClientNexus.ReactConnectMixin`

### Non Breaking Changes

- the `ClientNexus` constructor now accepts a second argument, an object of persistence options. See [README](README.md/#new_ClientNexus_new)
- `disablePersistence` method was added to the `ClientNexus` prototype to disable automatic reconnection attempts when websocket closes
- `enablePersistence` method was added to the `ClientNexus` prototype to enable automatic reconnection attempts when websocket closes
