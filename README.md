<a name="ClientNexus"></a>
## ClientNexus
**Kind**: global class  

* [ClientNexus](#ClientNexus)
  * [new ClientNexus(url, persistence)](#new_ClientNexus_new)
  * _instance_
    * [.Hz](#ClientNexus+Hz) ⇒ <code>[Frequency](#Frequency)</code>
    * [.connect()](#ClientNexus+connect)
    * [.reconnect()](#ClientNexus+reconnect)
    * [.createAction(actionName)](#ClientNexus+createAction) ⇒ <code>function</code>
    * [.createActions(actionNames)](#ClientNexus+createActions) ⇒ <code>object</code>
    * [.registerFrequency(topic, options)](#ClientNexus+registerFrequency) ⇒ <code>[Frequency](#Frequency)</code>
    * [.enablePersistence()](#ClientNexus+enablePersistence)
    * [.disablePersistence()](#ClientNexus+disablePersistence)
  * _static_
    * [.ReactConnectMixin](#ClientNexus.ReactConnectMixin)


-

<a name="new_ClientNexus_new"></a>
### new ClientNexus(url, persistence)
A client-side companion to `reflux-nexus` on the server. Use to call actions that will be listened to
by Reflux stores on the server. Create actions Reflux-like actions with `<ClientNexus>.createAction` and `<ClientNexus>.createActions`.
All actions are called on the main `CLIENT_ACTIONS` channel, which handles all inbound action traffic from the client nexus to the server nexus,
ensuring the Server dispatch can perform its delegation in a reactive, unidirectional way.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| url | <code>string</code> |  | a url of your server to pass into SockJS. Ensure the prefix `http://yoururl.com:port{/prefix}` is `/reflux-nexus` to connect to the `reflux-nexus` instance on your node server, or change the prefix on your server accordingly |
| persistence | <code>object</code> |  |  |
| [persistence.enabled] | <code>boolean</code> | <code>true</code> | should <ClientNexus> automatically try to reconnect on websocket "close" event |
| [persistence.attempts] | <code>number</code> | <code>10</code> | how many times should <ClientNexus> attempt to reconnect after losing connection. 		This happens inside <ClientNexus>.reconnect, which can be called independently of the websocket "close" event if necessary |
| [persistence.interval] | <code>number</code> | <code>3000</code> | how long to wait between reconnection attempts, in milliseconds |
| [persistence.onDisconnect] | <code>function</code> | <code>noop</code> | called when <ClientNexus> disconnects with a close event from websocket |
| [persistence.onConnecting] | <code>function</code> | <code>noop</code> | called when <ClientNexus> begins a reconnection attempt |
| [persistence.onConnection] | <code>function</code> | <code>noop</code> | called when <ClientNexus> re-establishes connection to <ServerNexus> |
| [persistence.onTimeout] | <code>function</code> | <code>noop</code> | called when reconnection attempts are exhausted |


-

<a name="ClientNexus+Hz"></a>
### clientNexus.Hz ⇒ <code>[Frequency](#Frequency)</code>
convenience alias for `registerFrequency`

**Kind**: instance property of <code>[ClientNexus](#ClientNexus)</code>  
**Returns**: <code>[Frequency](#Frequency)</code> - A Frequency instance  
**Since**: 0.2.4  

-

<a name="ClientNexus+connect"></a>
### clientNexus.connect()
Set up frequency multiplexing and persistent connection (if enabled)

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  

-

<a name="ClientNexus+reconnect"></a>
### clientNexus.reconnect()
Set up frequency multiplexing after a disconnection with existing frequencies.
Will attempt the reconnection with options passed to ClientNexus constructor as
persistence options `attempts` and `interval`

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  

-

<a name="ClientNexus+createAction"></a>
### clientNexus.createAction(actionName) ⇒ <code>function</code>
Create a function that sends a keyed object with actionType
and payload to a `ServerNexus`. Use like you would use `Reflux.createAction` for
a local store.

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  
**Returns**: <code>function</code> - An action that should be called with an object payload
to be serialized and sent over the wire to the `ServerNexus`  

| Param | Type | Description |
| --- | --- | --- |
| actionName | <code>string</code> | name of the action the ServerNexus will need to listen to |


-

<a name="ClientNexus+createActions"></a>
### clientNexus.createActions(actionNames) ⇒ <code>object</code>
Create a hash of action name keys with ClientNexus actions as values

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  
**Returns**: <code>object</code> - - a hash of action functions that accept an object payload to
be serialized and sent to the server  

| Param | Type | Description |
| --- | --- | --- |
| actionNames | <code>Array.&lt;string&gt;</code> | create a hash of actions, use like you would `Reflux.createActions` for a local store. |


-

<a name="ClientNexus+registerFrequency"></a>
### clientNexus.registerFrequency(topic, options) ⇒ <code>[Frequency](#Frequency)</code>
Create a new Frequency to subscribe to data streams from

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  
**Returns**: <code>[Frequency](#Frequency)</code> - A Frequency instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| topic | <code>string</code> |  | The Frequency's name handle |
| options | <code>object</code> |  | hash of options |
| [options.setInitialData] | <code>function</code> | <code>Frequency.prototype._hydrateData</code> | handle the merging of new data into `datastream` |
| [options.updateData] | <code>function</code> | <code>Frequency.prototype._updateData</code> | handle the updating of new data to `datastream` |
| [options.provideCredentials] | <code>function</code> |  | provide a function that returns a hash of credentials to the Server 	(if required by the Channel to connect, otherwise leave blank) |


-

<a name="ClientNexus+enablePersistence"></a>
### clientNexus.enablePersistence()
enable automatic reconnection on websocket "close" event,
for use after persistence has been set by constructor

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  
**Since**: 0.3.0  

-

<a name="ClientNexus+disablePersistence"></a>
### clientNexus.disablePersistence()
disable automatic reconnection on websocket "close" event,
for use after persistence has been set by constructor

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  
**Since**: 0.3.0  

-

<a name="ClientNexus.ReactConnectMixin"></a>
### ClientNexus.ReactConnectMixin
Convenience Mixin for a React Component, giving it a `tuneIn` method that
that allows the component to subscribe to a `ClientNexus Frequency` with a handler.
Conveniently removes all Component handlers from the Frequency on `componentWillUnmount`

**Kind**: static mixin of <code>[ClientNexus](#ClientNexus)</code>  

-

<a name="Frequency"></a>
## Frequency
**Kind**: global class  
**Access:** protected  

* [Frequency](#Frequency)
  * [new Frequency(topic, nexus, options)](#new_Frequency_new)
  * [.didConnect](#Frequency+didConnect)
  * [.topic](#Frequency+topic)
  * [.band](#Frequency+band)
  * [.Data](#Frequency+Data) ⇒ <code>any</code>
  * [.request(constraints)](#Frequency+request) ⇒ <code>Promise</code>
  * [.addListener(listener, handlers)](#Frequency+addListener) ⇒ <code>string</code>
  * [.removeListener(token)](#Frequency+removeListener)
  * [.close()](#Frequency+close)


-

<a name="new_Frequency_new"></a>
### new Frequency(topic, nexus, options)
A read-only stream of data from the server on `topic`. Split from a single websocket connection.
Frequencies cannot be directly instansiated with the new operator; they are created with `<ClientNexus>.registerFrequency`
or the shorthand `<ClientNexus>.Hz`.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| topic | <code>string</code> |  | name handle of the Frequency, ex `/chat` |
| nexus | <code>object</code> |  | the ClientNexus instance that owns the Frequency |
| options | <code>object</code> |  |  |
| [options.handleConnection] | <code>function</code> | <code>Frequency.prototype._hydrateData</code> | handle initial 	data flowing into `Data` on connection |
| [options.handleMessage] | <code>function</code> | <code>Frequency.prototype._updateData</code> | handle the updating 	`Data` from incoming message |
| [options.setInitialData] | <code>function</code> |  | (since 0.2.3) new API for bootstrapping `this.Data` on connection to Server. 	If declared, replaces `options.handleConnection` |
| [options.updateData] | <code>function</code> |  | (since 0.2.3) new API for handling how messages from the server 	are integrated into `this.Data`. If declared, replaces `options.handleMessage` |
| [options.provideCredentials] | <code>function</code> |  | provide a function that returns a hash of credentials to the Server 	(if required by the Channel to connect, otherwise leave you can this blank) |


-

<a name="Frequency+didConnect"></a>
### frequency.didConnect
A `bluebird` promise fulfilled when the Frequency connects with the
Server Nexus

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  

-

<a name="Frequency+topic"></a>
### frequency.topic
The name of the frequency, should match a Channel on the Server Nexus

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  
**Read only**: true  

-

<a name="Frequency+band"></a>
### frequency.band
A hash of all the Frequencies on the ClientNexus instance that created
this Frequency

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  
**Read only**: true  

-

<a name="Frequency+Data"></a>
### frequency.Data ⇒ <code>any</code>
getter

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  
**Returns**: <code>any</code> - immutable _Data state of Frequency  
**Read only**: true  

-

<a name="Frequency+request"></a>
### frequency.request(constraints) ⇒ <code>Promise</code>
the client side of Nexus request API. Sends constraints to a server-side Channel,
along with a unique request token. Adds a Promise to `this._responseListeners_`.
When the Channel responds, it resolves the promise and removes itself from
`this._responseListeners_`

**Kind**: instance method of <code>[Frequency](#Frequency)</code>  

| Param | Type | Description |
| --- | --- | --- |
| constraints | <code>object</code> | developer-defined key:value map of constraints to send server-side Channel |


-

<a name="Frequency+addListener"></a>
### frequency.addListener(listener, handlers) ⇒ <code>string</code>
Add a handler for Frequency's `onmessage` event

**Kind**: instance method of <code>[Frequency](#Frequency)</code>  
**Returns**: <code>string</code> - token - unique identifier for the registered listener  

| Param | Type | Description |
| --- | --- | --- |
| listener | <code>object</code> | handlers are invoked with listener as `this` |
| handlers | <code>object</code> | a hash of callbacks to execute when the Frequency recieves an update from its server-side Channel |
| [handlers.connection] | <code>function</code> | called with`this.Data` as single argument when the Frequency connects to its Channel |
| [handlers.message] | <code>function</code> | called when the Frequency receives a message. Is passed two arguments, the parsed JSON payload of the message, and `this.Data` |
| [handlers.close] | <code>function</code> | called when the connection to the server-side channel closes |


-

<a name="Frequency+removeListener"></a>
### frequency.removeListener(token)
Remove a handler from Frequency's `onmessage` event

**Kind**: instance method of <code>[Frequency](#Frequency)</code>  

| Param | Type | Description |
| --- | --- | --- |
| token | <code>string</code> | the listener's unique identifier returned from `addListener` |


-

<a name="Frequency+close"></a>
### frequency.close()
Shut down the Frequency, unsubscribing from ServerNexus messages on topic

**Kind**: instance method of <code>[Frequency](#Frequency)</code>  

-

<a name="tuneInto"></a>
## tuneInto ⇐ <code>React.Component</code>
Tune into a ClientNexus `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`

**Kind**: global variable  
**Extends:** <code>React.Component</code>  
**Implements:** <code>ClientNexus.Connect</code>  

| Param | Type | Description |
| --- | --- | --- |
| frequency | <code>object</code> | a Frequency name handle |
| handlers | <code>object</code> | a hash of callbacks for Frequency's lifecycle events |
| [handlers.connection] | <code>[connectionHandler](#connectionHandler)</code> |  |
| [handlers.message] | <code>[messageHandler](#messageHandler)</code> |  |
| [handlers.close] | <code>[closeHandler](#closeHandler)</code> |  |


-

<a name="connectionHandler"></a>
## connectionHandler : <code>function</code>
A callback for the ClientNexus.Connect mixin triggered when the component initially tunes into a Frequency

**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| hydration | <code>object</code> &#124; <code>array</code> | the tuned-in Frequency's `datastream` when the component begins listening |


-

<a name="messageHandler"></a>
## messageHandler : <code>function</code>
A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data

**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>object</code> &#124; <code>array</code> | the tuned-in Frequency's latest message from the server |
| datastream | <code>object</code> &#124; <code>array</code> | a copy of the Frequency's full datastream |


-

<a name="closeHandler"></a>
## closeHandler : <code>function</code>
A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data

**Kind**: global typedef  

-

