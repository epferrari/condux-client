
import Frequency
	from './Frequency.js';

// since 0.3.0
import SockJs
	from 'sockjs-client';

import Promise
	from 'bluebird';

import {pull,merge,each}
	from '../vendor/lodash_merge.pull.map.each.reduce.uniq.js';

var typeOf = function(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

var Singleton;
var REGISTRATIONS = "/REGISTRATIONS",
		CLIENT_ACTIONS = "/CLIENT_ACTIONS";

/**
* @desc A client-side companion to `reflux-nexus` on the server. Use to call actions that will be listened to
* by Reflux stores on the server. Create actions Reflux-like actions with `<ClientNexus>.createAction` and `<ClientNexus>.createActions`.
* All actions are called on the main `CLIENT_ACTIONS` channel, which handles all inbound action traffic from the client nexus to the server nexus,
* ensuring the Server dispatch can perform its delegation in a reactive, unidirectional way.
* @param {string} url - a url of your server to pass into SockJS. Ensure the prefix `http://yoururl.com:port{/prefix}` is `/reflux-nexus`
* to connect to the `reflux-nexus` instance on your node server, or change the prefix on your server accordingly
* @param {object} persistence
* @param {boolean} [persistence.enabled=true] - should <ClientNexus> automatically try to reconnect on websocket "close" event
* @param {number} [persistence.attempts=10] - how many times should <ClientNexus> attempt to reconnect after losing connection.
* 		This happens inside <ClientNexus>.reconnect, which can be called independently of the websocket "close" event if necessary
* @param {number} [persistence.interval=3000] - how long to wait between reconnection attempts, in milliseconds
* @param {function} [persistence.onDisconnect=noop] - called when <ClientNexus> disconnects with a close event from websocket
* @param {function} [persistence.onConnecting=noop] - called when <ClientNexus> begins a reconnection attempt
* @param {function} [persistence.onReconnect=noop] - called when <ClientNexus> re-establishes connection to <ServerNexus>
* @constructor
*/
function ClientNexus(url,persistence){

	// use Singleton to ensure only one ClientNexus
	if(Singleton) return Singleton;

	// defaults for persistent connection
	let p = {
		enabled: true,
		onDisconnect: function(){},
		onConnecting: function(){},
		onReconnect: function(){},
		attempts: 10,
		interval: 3000
	};

	this._persistence = merge({},persistence,p);
	this._queue = [];
	this.url = url;
	this.band = {};
	this.connect();
	this.sock.addEventListener( "message", e => this._multiplex(e));

	Singleton = this;
}


ClientNexus.prototype = {

	/**
	* @desc Set up frequency multiplexing and persistent connection (if enabled)
	*/
	connect(){
		// call event hook
		this._persistence.onConnecting();
		// connect to websocket
		this.sock = new SockJS(this.url);
		this.isConnected = () => (this.sock.readyState === 1);

		// create connection Promise
		this.didConnect = new Promise( (resolve) => {
			if(this.sock.readyState > 0){
				resolve();
			} else {
				this.sock.addEventListener("open",resolve);
			}
		});

		this.didConnect
			.then(() => {
				this.joinAndSend("sub",CLIENT_ACTIONS);
				this.joinAndSend("sub",REGISTRATIONS);
			})
			.then(() => {
				this.sock.addEventListener("close",() => this._persistence.onDisconnect());
				if(this._persistence.enabled){
					// reset up a persistent connection, aka attempt to reconnect if the connection closes
					this.sock.addEventListener("close",this.reconnect.bind(this));
				}
			});
	},

	/**
	* @desc Set up frequency multiplexing after a disconnection with existing frequencies.
	* Will attempt the reconnection with options passed to ClientNexus constructor as
	* persistence options `attempts` and `interval`
	*/
	reconnect(){
		var attempts = this._persistence.attempts;
		// immediately try to reconnect
		var timeout = setTimeout(() => attemptReconnection,200);

		var attemptReconnection = function(){
			if(attempts){
				// setup to try again after interval
				timeout = setTimeout(() => attemptReconnection,this._persistence.interval);
				attempts--;

				// attempt to re-establish the websocket connection
				// resets `this.sock`
				// resets `this.didConnect` to a new Promise resolved by `this.sock`
				this.connect();
				var nexus = this;
				// re-subscribe all frequencies
				each(this.band, (fq) => {
					fq.removeListener(fq._connectionToken);
					// create new didConnect Promise for each frequency
					fq.didConnect = new Promise(resolve => {
						fq._connectionToken = fq.addListener(fq,{
							// resolve frequency's didConnect Promise on re-connection
							connection: function(){
								fq.isConnected = true;
								resolve();
							},
							// unsubscribe from server updates onclose
							close: function(){
								fq.isConnected = false;
								nexus.joinAndSend("uns",fq.topic);
							}
						});
					});
					// resubscribe after ensuring new websocket connection
					this.didConnect.then(() => fq._subscribe());
				});

				// re-apply the message handling multiplexer
				this.sock.addEventListener("message",e => this._multiplex(e));

				// Success, stop trying to reconnect,
				this.didConnect.then(() => {
					connecting = false;
					attempts = 0;
					clearTimeout(timeout);
					// call event hook
					setTimeout(() => this._persistence.onReconnect,800);
				});
			} else {
				// Failure, stop trying to reconnect
				connecting = false;
				this._persistence.onTimeout();
			}
		}.bind(this);

	},

	/**
	* @desc Handle messages from the ServerNexus on different channels by sending
	* them to the appropriate frequency
	* @param {object} e - the event object passed from `<SockJS>.addEventLister`
	* @private
	*/
	_multiplex(e){
		var queue = this._queue;
		var msg = e.data.split(","),
				type = msg.shift(),
				topic = msg.shift(),
				payload = msg.join(),
				frequency = this.band[topic];

		if(!frequency) return;

		if(topic === REGISTRATIONS){
			// a channel was registered on the server after this Nexus subscribed to it
			// resubscribe, and remove the topic from the queue
			let payload = JSON.parse(payload);
			let registeredTopic = payload.registered;
			let queuePosition = queue.indexOf(registeredTopic);
			if(queuePosition !== -1){
				frequency._subscribe();
				pull(queue,registeredTopic);
			}
		}

		try{ payload = JSON.parse(payload); }
		catch(e){
			// dispose the error
			let x = e;
			type = "err"
			payload = {message: "ERROR: invalid payload. Payload must be stringified JSON."};
		}

		switch(type){
			case "uns":
				_broadcast(frequency,"close");
				break;
			case "conn":
				_broadcast(frequency,"connection",payload);
				break;
			case "msg":
				_broadcast(frequency,"message",payload);
				break;
			case "res":
				_broadcast(frequency,"response",payload);
				break;
			case "err":
				_broadcast(frequency,"error",payload);
				break;
			case "rej":
				// channel is not registered with the server (yet), but might be later.
				queue.push(topic);
				break;
		}

		return;
	},

	/**
	* @desc Format type, topic, and data to send to ServerNexus
	* @private
	*/
	joinAndSend(){
		var msgArray = [].slice.call(arguments,0);
		this.didConnect.then( () => this.sock.send(msgArray.join(',')) );
	},

	/**
	* @desc Create a function that sends a keyed object with actionType
	* and payload to a `ServerNexus`. Use like you would use `Reflux.createAction` for
	* a local store.
	* @param {string} actionName - name of the action the ServerNexus will need to listen to
	* @returns {function} An action that should be called with an object payload
	* to be serialized and sent over the wire to the `ServerNexus`
	*/
	createAction(actionName){
		return payload => {
			return new Promise( (resolve,reject) => {
				let message = JSON.stringify({actionType: actionName,payload: payload});
				this.joinAndSend("msg",CLIENT_ACTIONS,message);
				resolve();
			});
		};
	},

	/**
	* @desc Create a hash of action name keys with ClientNexus actions as values
	* @param {string[]} actionNames - create a hash of actions, use like you would
	* `Reflux.createActions` for a local store.
	* @returns {object} - a hash of action functions that accept an object payload to
	* be serialized and sent to the server
	*/
	createActions(actionNames){
		return actionNames.reduce( (accum,actionName) => {
			accum[actionName] = this.createAction(actionName);
			return accum;
		},{});
	},

	/**
	* @desc Create a new Frequency to subscribe to data streams from
	* @param {string} topic - The Frequency's name handle
	* @param {object} options - hash of options
	* @param {function} [options.setInitialData=Frequency.prototype._hydrateData] - handle the merging of new data into `datastream`
	* @param {function} [options.updateData=Frequency.prototype._updateData] - handle the updating of new data to `datastream`
	* @param {function} [options.provideCredentials] - provide a function that returns a hash of credentials to the Server
	* 	(if required by the Channel to connect, otherwise leave blank)
	* @returns {Frequency} A Frequency instance
	*/
	registerFrequency(topic,options){
		let frequency = this.band[topic];

		if(!frequency && (topic !== CLIENT_ACTIONS) && (topic !== REGISTRATIONS)){
			this.band[topic] = frequency = new Frequency(topic,this,options);
		}
		return frequency;
	},

	/**
	* enable automatic reconnection on websocket "close" event,
	* for use after persistence has been set by constructor
	* @since 0.3.0
	*/
	enablePersistence(){
		if(!this._persistence.enabled){
			this.sock.addEventListener("close",this.reconnect.bind(this));
			this._persistence.enabled = true;
		}
	},

	/**
	* disable automatic reconnection on websocket "close" event,
	* for use after persistence has been set by constructor
	* @since 0.3.0
	*/
	disablePersistence(){
		if(this._persistence.enabled){
			this.sock.removeEventListener("close",this.reconnect.bind(this));
			this._persistence.enabled = false;
		}
	},

	/**
	* convenience alias for `registerFrequency`
	* @name Hz
	* @instance
	* @memberof ClientNexus
	* @returns {Frequency} A Frequency instance
	* @since 0.2.4
	*/
	Hz(topic,options){
		return this.registerFrequency(topic,options);
	}
};




/**
* @callback connectionHandler
* @desc A callback for the ClientNexus.Connect mixin triggered when the component initially tunes into a Frequency
* @param {object|array} hydration - the tuned-in Frequency's `datastream` when the component begins listening
*/

/**
* @callback messageHandler
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
* @param {object|array} message - the tuned-in Frequency's latest message from the server
* @param {object|array} datastream - a copy of the Frequency's full datastream
*/

/**
* @callback closeHandler
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
*/


/**
* @name ReactConnectMixin
* @static
* @desc Convenience Mixin for a React Component, giving it a `tuneIn` method that
* that allows the component to subscribe to a `ClientNexus Frequency` with a handler.
* Conveniently removes all Component handlers from the Frequency on `componentWillUnmount`
* @mixin
* @memberof ClientNexus
*/
ClientNexus.ReactConnectMixin = {
	componentWillMount(){
		this._nexusTokens = {};
		/**
		* @name tuneInto
		* @extends React.Component
		* @desc Tune into a ClientNexus `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`
		* @param {object} frequency - a Frequency name handle
		* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
		* @param {connectionHandler} [handlers.connection]
		* @param {messageHandler} [handlers.message]
		* @param {closeHandler} [handlers.close]
		* @implements ClientNexus.Connect
		*/
		this.tuneInto = (frequency,handlers) => {
			listenToFrequency.call(this,frequency,handlers);
		};
	},

	componentWillUnmount(){
		each(this._nexusTokens, disposer => disposer());
	}
};


/**
* @name listenToFrequency
* @desc Helper function to subscribe the implementing object to a `Frequency` with listener callbacks
* @param {object} frequency - The `ClientNexus.Frequency` to being listened to
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {connectionHandler} handlers.connection
* @param {messageHandler} handlers.message
* @param {closeHandler} handlers.close
* @private
*/
function listenToFrequency(frequency,handlers){

	if(typeOf(frequency) === "string") frequency = Singleton.band(frequency);
	if(!frequency || !frequency.__is_reflux_nexus_frequency__){
		throw new TypeError('first argument to "tuneInto" must be instance of Frequency');
	}

	let {topic} = frequency;
	if( !this._nexusTokens[topic] ){
		let token = frequency.addListener(this,handlers);
		this._nexusTokens[topic] = frequency.removeListener.bind(frequency,token);
	}
}


function _broadcast(frequency,message,payload){
	setTimeout(() => frequency.broadcast(message,payload),0);
}

export {ClientNexus as default};
