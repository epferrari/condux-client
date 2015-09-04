<a name="ClientNexus"></a>
## ClientNexus
**Kind**: global class  

* [ClientNexus](#ClientNexus)
  * [new ClientNexus(sock)](#new_ClientNexus_new)
  * _instance_
    * [.connect(sock)](#ClientNexus+connect)
    * [.reconnect(sock)](#ClientNexus+reconnect)
    * [.createAction(actionName)](#ClientNexus+createAction) ⇒ <code>function</code>
    * [.createActions(actionNames)](#ClientNexus+createActions) ⇒ <code>object</code>
    * [.registerFrequency(topic, options)](#ClientNexus+registerFrequency) ⇒ <code>[Frequency](#Frequency)</code>
  * _static_
    * [.Connect](#ClientNexus.Connect)


-

<a name="new_ClientNexus_new"></a>
### new ClientNexus(sock)
A client-side companion to `reflux-nexus` on the server. All actions will
be called on the main `CLIENT_ACTIONS` channel, ensuring the Server dispatch can
perform its delegation.


| Param | Type | Description |
| --- | --- | --- |
| sock | <code>object</code> | a SockJS instance. Ensure that the prefix `http://yoururl.com{/prefix}` is `/reflux-nexus` to connect to the `reflux-nexus` instance on your node server, or change the prefix on your server accordingly |


-

<a name="ClientNexus+connect"></a>
### clientNexus.connect(sock)
Set up frequency multiplexing

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  

| Param | Type | Description |
| --- | --- | --- |
| sock | <code>object</code> | A SockJS instance |


-

<a name="ClientNexus+reconnect"></a>
### clientNexus.reconnect(sock)
Set up frequency multiplexing after a disconnect with existing frequencies

**Kind**: instance method of <code>[ClientNexus](#ClientNexus)</code>  

| Param | Type | Description |
| --- | --- | --- |
| sock | <code>object</code> | A SockJS instance |


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


-

<a name="ClientNexus.Connect"></a>
### ClientNexus.Connect
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
  * [.count](#Frequency+count)
  * [.stream](#Frequency+stream)
  * [.Data](#Frequency+Data) ⇒ <code>any</code>
  * [.history(index)](#Frequency+history) ⇒ <code>Data</code>
  * [.request(constraints)](#Frequency+request) ⇒ <code>Promise</code>
  * [.addListener(listener, handlers)](#Frequency+addListener) ⇒ <code>string</code>
  * [.removeListener(token)](#Frequency+removeListener)
  * [.close()](#Frequency+close)


-

<a name="new_Frequency_new"></a>
### new Frequency(topic, nexus, options)
A read-only stream of data from the server on `topic`. Split from a single websocket connection


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| topic | <code>string</code> |  | name handle of the Frequency, ex `/chat` |
| nexus | <code>object</code> |  | the ClientNexus instance that owns the Frequency |
| options | <code>object</code> |  |  |
| [options.handleConnection] | <code>function</code> | <code>Frequency.prototype._hydrateData</code> | handle initial 	data flowing into `Data` on connection |
| [options.handleMessage] | <code>function</code> | <code>Frequency.prototype._updateData</code> | handle the updating 	`Data` from incoming message |
| [options.setInitialData] | <code>function</code> |  | (since 0.2.3) new API for bootstrapping `this.Data` on connection to Server. 	If declared, replaces `options.handleConnection` |
| [options.updateData] | <code>function</code> |  | (since 0.2.3) new API for handling how messages from the server 	are integrated into `this.Data`. If declared, replaces `options.handleMessage` |


-

<a name="Frequency+didConnect"></a>
### frequency.didConnect
A promise that is fulfilled when the Frequency connects with the
Server Nexus

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  

-

<a name="Frequency+topic"></a>
### frequency.topic
The name of the frequency, should match a Channel on the Server Nexus

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  

-

<a name="Frequency+band"></a>
### frequency.band
A hash of all the Frequencies on the ClientNexus instance that created
this Frequency

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  

-

<a name="Frequency+count"></a>
### frequency.count
get the number of updates Frequency has received from the server

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  

-

<a name="Frequency+stream"></a>
### frequency.stream
immutably get Frequency's internal stream of messages

**Kind**: instance property of <code>[Frequency](#Frequency)</code>  

-

<a name="Frequency+Data"></a>
### frequency.Data ⇒ <code>any</code>
**Kind**: instance property of <code>[Frequency](#Frequency)</code>  
**Returns**: <code>any</code> - - getter: returns immutable _Data state of Frequency  
**Read only**: true  

-

<a name="Frequency+history"></a>
### frequency.history(index) ⇒ <code>Data</code>
get the state of Frequency's internal `datastream` at `index` in history.
0 is initial hydration from server

**Kind**: instance method of <code>[Frequency](#Frequency)</code>  

| Param | Type |
| --- | --- |
| index | <code>number</code> | 


-

<a name="Frequency+request"></a>
### frequency.request(constraints) ⇒ <code>Promise</code>
the client side of Nexus request API. Sends constraints to a server ChannelStore,
along with a unique request token. Adds a Promise to `this._responseListeners_`, and
when the ChannelStore responds, it resolves the promise and removes itself from
`this._responseListeners_`

**Kind**: instance method of <code>[Frequency](#Frequency)</code>  

| Param | Type | Description |
| --- | --- | --- |
| constraints | <code>object</code> | = developer-defined key:value map of constraints to send ChannelStore |


-

<a name="Frequency+addListener"></a>
### frequency.addListener(listener, handlers) ⇒ <code>string</code>
Add a handler for Frequency's `onmessage` event

**Kind**: instance method of <code>[Frequency](#Frequency)</code>  
**Returns**: <code>string</code> - token - unique identifier for the registered listener  

| Param | Type | Description |
| --- | --- | --- |
| listener | <code>object</code> | handlers are invoked with listener as `this` |
| handlers | <code>object</code> | a hash of callbacks to execute when the Frequency recieves an update from its Channel-Store on the server |
| [handlers.onConnection] | <code>function</code> |  |
| [handlers.onMessage] | <code>function</code> |  |
| [handlers.onClose] | <code>function</code> |  |


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
**Implements:** <code>[Connect](#ClientNexus.Connect)</code>  

| Param | Type | Description |
| --- | --- | --- |
| frequency | <code>object</code> | a Frequency name handle |
| handlers | <code>object</code> | a hash of callbacks for Frequency's lifecycle events |
| [handlers.onConnection] | <code>[onConnection](#onConnection)</code> |  |
| [handlers.onMessage] | <code>[onMessage](#onMessage)</code> |  |
| [handlers.onClose] | <code>[onClose](#onClose)</code> |  |


-

<a name="onConnection"></a>
## onConnection : <code>function</code>
A callback for the ClientNexus.Connect mixin triggered when the component initially tunes into a Frequency

**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| hydration | <code>object</code> &#124; <code>array</code> | the tuned-in Frequency's `datastream` when the component begins listening |


-

<a name="onMessage"></a>
## onMessage : <code>function</code>
A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data

**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>object</code> &#124; <code>array</code> | the tuned-in Frequency's latest message from the server |
| datastream | <code>object</code> &#124; <code>array</code> | a copy of the Frequency's full datastream |


-

<a name="onClose"></a>
## onClose : <code>function</code>
A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data

**Kind**: global typedef  

-

