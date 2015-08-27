//import sockjs from 'sockjs-client';
import Frequency from './Frequency.js';
import {pull,merge,each} from '../vendor/lodash_merge.pull.map.each.reduce.uniq.js';

var typeOf = function(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

var Singleton;
var REGISTRATIONS = "/REGISTRATIONS",
		CLIENT_ACTIONS = "/CLIENT_ACTIONS";

/**
* @desc A client-side companion to `reflux-nexus` on the server. All actions will
* be called on the main `CLIENT_ACTIONS` channel, ensuring the Server dispatch can
* perform its delegation.
* @param {object} sock - a SockJS instance. Ensure that the prefix `http://yoururl.com{/prefix}` is `/reflux-nexus`
* to connect to the `reflux-nexus` instance on your node server, or change the prefix on your server accordingly
* @constructor
*/
function ClientNexus(sock){

	// use Singleton to ensure only one ClientNexus
	if(Singleton) return Singleton;

	this._queue = [];
	this.sock = sock;
	this.band = {};
	this.connect(sock);
	sock.addEventListener( "message", e => this._multiplex(e));

	Singleton = this;
}




ClientNexus.prototype = {

	/**
	* @desc Set up frequency multiplexing
	* @param {object} sock - A SockJS instance
	*/
	connect(sock){
		this.sock = sock;
		this.isConnected = () => (sock.readyState === 1);

		this.didConnect = new Promise( (resolve) => {
			if(sock.readyState > 0){
				resolve();
			} else {
				sock.addEventListener("open",resolve);
			}
		});

		this.didConnect.then( () => {
			this.joinAndSend("sub",CLIENT_ACTIONS);
			this.joinAndSend("sub",REGISTRATIONS);
		});
	},

	/**
	* @desc Set up frequency multiplexing after a disconnect with existing frequencies
	* @param {object} sock - A SockJS instance
	*/
	reconnect(sock){
		// rebind to new sock
		this.connect(sock);

		// resubscribe the frequencies
		each(this.band, (fq) => {
			fq.didConnect = new Promise( (resolve) => fq.onconnected = resolve);
			this.didConnect.then( () => {
				this.joinAndSend("sub",fq.topic);
				setTimeout( () => fq.broadcast("open"),0 );
			});
		});

		// reapply the message handling multiplexer
		sock.addEventListener("message",e => this._multiplex(e));
	},

	/**
	* @desc Handle messages from the ServerNexus on different channels by sending
	* them to the appropriate frequency
	* @param {object} e - the event object passed from `<SockJS>.addEventLister`
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
				this.joinAndSend("sub",registeredTopic);
				pull(queue,registeredTopic);
			}
		}

		try{ payload = JSON.parse(payload); }
		catch(e){
			let x = e;
			payload = {};
		}

		switch(type){
			case "uns":
				setTimeout( () => frequency.broadcast("close"),0 );
				break;
			case "conn":
				setTimeout( () => frequency.broadcast("connection",payload),0 );
				break;
			case "msg":
				setTimeout( () => frequency.broadcast("message",payload),0 );
				break;
			case "res":
				setTimeout( () => frequency.broadcast("response",payload),0 );
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
	*/
	joinAndSend(){
		var msgArray = [].slice.call(arguments,0);
		this.didConnect.then( () => this.sock.send(msgArray.join(',')) );
	},

	/**
	* @name createAction
	* @desc Create a function that sends a keyed object with actionType
	* and payload to a `ServerNexus`. Use like you would use `Reflux.createAction` for
	* a local store.
	*
	* @method
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
	* @name createActions
	* @desc Create a hash of action name keys with ClientNexus actions as values
	*
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
	* @name registerFrequency
	* @desc Create a new Frequency to subscribe to data streams from
	* @param {string} topic - The Frequency's name handle
	* @param {object} options - hash of options
	* @param {boolean} [options.merge=false] - should the Frequency's `datastream` be merged or updated when new data arrives?
	* @param {function} [options.mergeWith=Frequency.prototype.mergeStream] - handle the merging of new data into `datastream`
	* @param {function} [options.updateWith=Frequency.prototype.updateStream] - handle the updating of new data to `datastream`
	* @returns {object} A Frequency instance
	*/
	registerFrequency(topic,options){
		let frequency = this.band[topic];

		if(!frequency && (topic !== CLIENT_ACTIONS) && (topic !== REGISTRATIONS)){
			this.band[topic] = frequency = new Frequency(topic,this,options);
		}
		return frequency;
	}
};




/**
* @callback onConnection
* @desc A callback for the ClientNexus.Connect mixin triggered when the component initially tunes into a Frequency
* @param {object|array} hydration - the tuned-in Frequency's `datastream` when the component begins listening
*/

/**
* @callback onMessage
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
* @param {object|array} message - the tuned-in Frequency's latest message from the server
* @param {object|array} datastream - a copy of the Frequency's full datastream
*/

/**
* @callback onClose
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
*/


/**
* @name Connect
* @static
* @desc Convenience Mixin for a React Component, giving it a `tuneIn` method that
* that allows the component to subscribe to a `ClientNexus Frequency` with a handler.
* Conveniently removes all Component handlers from the Frequency on `componentWillUnmount`
* @name Connect
* @memberof ClientNexus
*/
ClientNexus.Connect = {
	componentWillMount(){
		this._nexusTokens = {};
		/**
		* @name tuneInto
		* @desc Tune into a ClientNexus `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`
		* @param {object} frequency - a Frequency name handle
		* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
		* @param {onConnection} handlers.onConnection
		* @param {onMessage} handlers.onMessage
		* @param {onClose} handlers.onClose
		*/
		this.tuneInto = (frequency,handlers) => {


			let defaults = {
				onConnection(){},
				onMessage(){},
				onClose(){}
			};

			handlers = merge({},defaults,handlers);
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
* @param {onConnection} handlers.onConnection
* @param {onMessage} handlers.onMessage
* @param {onClose} handlers.onClose
*/
function listenToFrequency(frequency,handlers){

	if(typeOf(frequency) === "string") frequency = Singleton.band(frequency);
	if(!frequency || !frequency.__is_reflux_nexus_frequency__){
		throw new TypeError('first argument to "tuneInto" must be instance of Frequency');
	}

	let {topic} = frequency;
	handlers.sub = this;
	if( !this._nexusTokens[topic] ){
		let token = frequency.addListener.call(frequency,handlers);
		this._nexusTokens[topic] = frequency.removeListener.bind(frequency,token);
	}
}




export {ClientNexus as default};
