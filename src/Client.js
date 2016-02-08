
import Frequency
	from './Frequency.js';

// since 0.3.0
import SockJS
	from 'sockjs-client';

import Promise
	from 'bluebird';

import {pull,merge,each,reduce}
	from '../vendor/lodash_merge.pull.map.each.reduce.uniq.js';

var typeOf = function(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

var pick = function(obj,props){
	return reduce(obj,function(r,val,key){
		if(props.indexOf(key) !== -1){
			r[key] = val;
		}
		return r;
	},{});
};

var connecting = false;
var Singleton;
var REGISTRATIONS = "/REGISTRATIONS",
		CLIENT_ACTIONS = "/CLIENT_ACTIONS";

// defaults for persistent connection
var defaultPersistence = {
	enabled: true,
	onDisconnect: function(){},
	onConnecting: function(){},
	onConnection: function(){},
	onReconnect: function(){},
	onTimeout: function(){},
	attempts: 10,
	interval: 3000
};

/**
* @desc create a Condux Client instance
* @param {string} url - a url of your server to pass into SockJS. Ensure the prefix `http://yoururl.com:port{/prefix}` is `/reflux-nexus`
* to connect to the `reflux-nexus` instance on your node server, or change the prefix on your server accordingly
* @param {object} persistence
* @param {boolean} [persistence.enabled=true] - should <ConduxClient> automatically try to reconnect on websocket "close" event
* @param {number} [persistence.attempts=10] - how many times should <ConduxClient> attempt to reconnect after losing connection.
* 		This happens inside <ConduxClient>.reconnect, which can be called independently of the websocket "close" event if necessary
* @param {number|function} [persistence.interval=3000] - how long to wait between reconnection attempts, in milliseconds. If passed a function, the function will be called with the number of reconnection attempts aleady made, and should return a number in milliseconds
* @param {function} [persistence.onConnecting=noop] - called when <ConduxClient> begins a reconnection attempt
* @param {function} [persistence.onConnection=noop] - called when <ConduxClient> establishes a connection to <ServerNexus>
* @param {function} [persistence.onDisconnect=noop] - called when <ConduxClient> disconnects with a close event from websocket
* @param {function} [persistence.onReconnect=noop] - called when <ConduxClient> re-establishes a connection to <ServerNexus> after being dropped
* @param {function} [persistence.onTimeout=noop] - called when reconnection attempts are exhausted
* @constructor
*/
function ConduxClient(url,persistence){

	// use Singleton to ensure only one ConduxClient
	if(Singleton) return Singleton;

	var p = pick( merge({},defaultPersistence,persistence), Object.keys(defaultPersistence) );

	/**
	* @name persistence
	* @returns {object} current persistence options
	* @instance
	* @readonly
	* @memberof ConduxClient
	* @since 0.4.2
	*/
	Object.defineProperty(this,'persistence',{
		get: function(){
			return p;
		},
		enumerable: false,
		configurable: false
	});

	/**
	* @name updatePersistence
	* @description Update the current persistence options. If `<ConduxClient>` is connecting and the `onConnecting` hook was updated, it will immediately call the new onConnecting function
	* @returns {object} updated persistence options
	* @method
	* @instance
	* @memberof ConduxClient
	* @since 0.4.2
	*/
	this.updatePersistence = function(options){
		let prevOnConnecting = p.onConnecting;
		let prevEnabled = p.enabled;
		p = pick( merge({},p,options), Object.keys(p) );

		// persistence was enabled
		if(!prevEnabled && p.enabled){
			this.sock.addEventListener("close",this.reconnect.bind(this));
		}

		// persistence was disabled
		if(prevEnabled && !p.enabled){
			this.sock.removeEventListener("close",this.reconnect.bind(this));
		}

		if((prevOnConnecting !== p.onConnecting) && connecting){
			p.onConnecting();
		}
		return p;
	};

	this._queue = [];
	this.url = url;
	this.band = {};
	this.connect();
	this.sock.addEventListener( "message", e => this._multiplex(e));

	Singleton = this;
}


ConduxClient.prototype = {

	/**
	* @desc Set up frequency multiplexing and persistent connection (if enabled)
	* @instance
	* @memberof ConduxClient
	*/
	connect(){
		// call event hook
		this.persistence.onConnecting();
		// connect to websocket
		connecting = true;
		var sock = this.sock = new SockJS(this.url);
		// scheduled for deprecation in 0.3.2
		this.isConnected = () => (sock.readyState === 1);

		// create connection Promise
		this.didConnect = new Promise( (resolve) => {
			if(sock.readyState > 0){
				resolve();
			} else {
				sock.addEventListener("open",resolve);
			}
		});

		this.didConnect
			.then(() => {
				connecting = false;
			})
			.then(() => {
				this.joinAndSend("sub",CLIENT_ACTIONS);
				this.joinAndSend("sub",REGISTRATIONS);
			})
			.then(() => {
				connecting = false;
				this.persistence.onConnection();
				sock.addEventListener("close",() => tthis.persistence.onDisconnect());
				if(this.persistence.enabled){
					// reset up a persistent connection, aka attempt to reconnect if the connection closes
					sock.addEventListener("close",this.reconnect.bind(this));
				}
			});
	},



	/**
	* @desc Set up frequency multiplexing after a disconnection with existing frequencies.
	* Will attempt the reconnection with options passed to ConduxClient constructor as
	* persistence options `attempts` and `interval`
	* @instance
	* @memberof ConduxClient
	*/
	reconnect(){
		if(!connecting){
			var attemptsMade = 0;
			var attemptsRemaining = this.persistence.attempts;
			// immediately try to reconnect
			var timeout = setTimeout(() => attemptReconnection(),200);

			var attemptReconnection = function(){
				if(!attemptsRemaining){
					// Failure, stop trying to reconnect
					this.persistence.onTimeout();
				} else {
					let delay;
					let {interval} = this.persistence;

					// setup to try again after interval
					if(typeof interval == 'number'){
						delay = interval
					} else if(typeof interval === 'function'){
						delay = interval(attemptsMade);
					}

					timeout = setTimeout(() => attemptReconnection(),delay);
					attemptsMade++;
					attemptsRemaining--;


					// attempt to re-establish the websocket connection
					// resets `this.sock`
					// resets `this.didConnect` to a new Promise resolved by `this.sock`
					this.connect();

					// re-subscribe all frequencies
					_resubscribeFrequencies()

					// re-apply the message handling multiplexer
					this.sock.addEventListener("message",e => this._multiplex(e));

					// Success, stop trying to reconnect,
					this.didConnect.then(() => {
						attemptsRemaining = 0;
						clearTimeout(timeout);
						this.persistence.onReconnect();
					});
				}
			}.bind(this);
			// end function attemptReconnection
		}
	},

	_resubscribeFrequencies(){
		var activeConduxClient = this;
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
						activeConduxClient.joinAndSend("uns",fq.topic);
					}
				});
			});
			// resubscribe after ensuring new websocket connection
			this.didConnect.then(() => fq._subscribe());
		});
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
	* @instance
	* @memberof ConduxClient
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
	* @desc Create a hash of action name keys with ConduxClient actions as values
	* @param {string[]} actionNames - create a hash of actions, use like you would
	* `Reflux.createActions` for a local store.
	* @returns {object} - a hash of action functions that accept an object payload to
	* be serialized and sent to the server
	* @instance
	* @memberof ConduxClient
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
	* @instance
	* @memberof ConduxClient
	*/
	registerFrequency(topic,options){
		let frequency = this.band[topic];

		if(!frequency && (topic !== CLIENT_ACTIONS) && (topic !== REGISTRATIONS)){
			this.band[topic] = frequency = new Frequency(topic,this,options);
		}
		return frequency;
	},

	/**
	* @desc enable automatic reconnection on websocket "close" event,
	* for use after persistence has been set by constructor
	* @instance
	* @memberof ConduxClient
	* @since 0.3.0
	*/
	enablePersistence(){
		this.updatePersistence({enabled: true});
	},

	/**
	* @desc disable automatic reconnection on websocket "close" event,
	* for use after persistence has been set by constructor
	* @since 0.3.0
	* @instance
	* @memberof ConduxClient
	*/
	disablePersistence(){
		this.updatePersistence({enabled: false});
	},

	/**
	* convenience alias for `registerFrequency`
	* @instance
	* @memberof ConduxClient
	* @returns {Frequency} A Frequency instance
	* @since 0.2.4
	*/
	Hz(topic,options){
		return this.registerFrequency(topic,options);
	},


	/**
	* @name connecting
	* @instance
	* @memberof ConduxClient
	* @desc is the <ConduxClient> in the process of connecting
	* @returns {boolean}
	* @readonly
	* @since 0.3.1
	*/
	get connecting(){
		return connecting;
	},

	/**
	* @name connected
	* @instance
	* @memberof ConduxClient
	* @desc is the <ConduxClient> currently connected to the Server
	* @returns {boolean}
	* @since 0.3.1
	* @readonly
	*/
	get connected(){
		return this.sock.readyState === 1;
	}
};




/**
* @callback connectionHandler
* @desc A callback for the ConduxClient.Connect mixin triggered when the component initially tunes into a Frequency
* @param {object|array} hydration - the tuned-in Frequency's `datastream` when the component begins listening
*/

/**
* @callback messageHandler
* @desc A callback for the ConduxClient.Connect mixin triggered when Frequency receives server data
* @param {object|array} message - the tuned-in Frequency's latest message from the server
* @param {object|array} datastream - a copy of the Frequency's full datastream
*/

/**
* @callback closeHandler
* @desc A callback for the ConduxClient.Connect mixin triggered when Frequency receives server data
*/


/**
* @name ReactConnectMixin
* @static
* @desc Convenience Mixin for a React Component, giving it a `tuneIn` method that
* that allows the component to subscribe to a `ConduxClient Frequency` with a handler.
* Conveniently removes all Component handlers from the Frequency on `componentWillUnmount`
* @mixin
* @memberof ConduxClient
*/
ConduxClient.ReactConnectMixin = {
	componentWillMount(){
		this._nexusTokens = {};
		/**
		* @name tuneInto
		* @desc exposed to React.Component via `ConduxClient.ReactConnectMixin` Tune into a ConduxClient `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`
		* @param {object} frequency - a Frequency name handle
		* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
		* @param {connectionHandler} [handlers.connection]
		* @param {messageHandler} [handlers.message]
		* @param {closeHandler} [handlers.close]
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
* @param {object} frequency - The `<ConduxClient>.Frequency` to being listened to
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {connectionHandler} handlers.connection
* @param {messageHandler} handlers.message
* @param {closeHandler} handlers.close
* @private
*/
function listenToFrequency(frequency,handlers){

	if(typeOf(frequency) === "string") frequency = Singleton.band[frequency];
	if(!frequency || !frequency.__is_condux_frequency__){
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


/**
* @since 0.4.0
* @name DISCONNECTED
* @memberof ConduxClient
* @static
* @readonly
*/
Object.defineProperty(ConduxClient,'DISCONNECTED',{
	value: 0,
	writable: false,
	configurable: false,
	enumerable: false
});

/**
* @since 0.4.0
* @name CONNECTING
* @memberof ConduxClient
* @constant
* @static
* @readonly
*/
Object.defineProperty(ConduxClient,'CONNECTING',{
	value: 0,
	writable: false,
	configurable: false,
	enumerable: false
});

/**
* @since 0.4.0
* @name CONNECTED
* @memberof ConduxClient
* @readonly
* @static
* @constant
*/
Object.defineProperty(ConduxClient,'CONNECTED',{
	value: 2,
	writable: false,
	configurable: false,
	enumerable: false
});

export {ConduxClient as default};
