//import sockjs from 'sockjs-client';
import Frequency from './Frequency.js';
import {pull,merge} from '../vendor/lodash_merge-map-reduce-pull-uniq.js';

var typeOf = function(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

var Singleton;
var REGISTRATION_REQUESTS = "REGISTRATION_REQUESTS",
		CLIENT_ACTIONS = "CLIENT_ACTIONS";

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

	//options = merge({},options);
	//if(!/\/reflux-nexus$/.test(url)) url = url + "/reflux-nexus";
	//this.sock = new sockjs(url,protocols,options);
	this.sock = sock;
	this.band = {};

	this.connected = new Promise( (resolve) => {
		if(this.sock.readyState > 0){
			resolve();
		} else {
			this.sock.addEventListener("open",resolve);
		}
	});

	this.connected.then( () => {
		this.sock.send(["sub",CLIENT_ACTIONS].join(","));
		this.sock.send(["sub",REGISTRATION_REQUESTS].join(","));
	});

	this.sock.addEventListener("message", e => {
		var msg = e.data.split(","),
				type = msg.shift(),
				topic = msg.shift(),
				payload = msg.join(),
				frequency = this.band[topic];

		if(!frequency) return;

		switch(type){
			case "uns":
				setTimeout( () => frequency.broadcast("close"),0 );
				break;
			case "conn":
				setTimeout( () => frequency.broadcast("connection",{data:payload}),0 );
				break;
			case "msg":
				setTimeout( () => frequency.broadcast("message",{data:payload}),0 );
				break;
		}

		return;
	});

	Singleton = this;
}




ClientNexus.prototype = {

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
				this.sock.send([
					"msg",
					CLIENT_ACTIONS,
					JSON.stringify({actionType: actionName,payload: payload})
				].join(","));
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

		if(!frequency && topic != REGISTRATION_REQUESTS && topic != CLIENT_ACTIONS){

			this.connected.then( () => {
				return new Promise( (resolve,reject) => {
					this.sock.send([
						"msg",
						REGISTRATION_REQUESTS,
						JSON.stringify({topic: topic})
					].join(","));
					resolve();
				});
			});
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
		this._nexusTokens = [];
		this._nexusSubscriptions = {};
		this._queuedSubscriptions = [];
		/**
		* @name tuneInto
		* @desc Tune into a ClientNexus `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`
		* @param {string} topic - a Frequency name handle
		* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
		* @param {onConnection} handlers.onConnection
		* @param {onMessage} handlers.onMessage
		* @param {onClose} handlers.onClose
		*/
		this.tuneInto = (topic,handlers) => {

			let defaults = {
				onConnection(){},
				onMessage(){},
				onClose(){}
			};

			handlers = merge({},defaults,handlers);
			attemptListen.call(this,topic,handlers);
		};
	},

	componentWillUnmount(){
		var sock = Singleton.sock;
		this._nexusTokens.forEach(disposer => disposer());
		this._queuedSubscriptions.forEach( q => {
			sock.removeEventListener("message",q);
		});
	}
};


/**
* Helper for Connect mixin's `tuneInto` method
* @param {string} topic - a Frequency name handle
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {onConnection} handlers.onConnection
* @param {onMessage} handlers.onMessage
* @param {onClose} handlers.onClose
*/
function attemptListen(topic,handlers){

	let frequency = Singleton.band[topic];

	if(!frequency){
		frequency = Singleton.registerFrequency(topic);
		var queuedSub = function(e){
			var msg = e.data.split(','),
					type = msg.shift(),
					channel = msg.shift(),
					payload = JSON.parse(msg.join(","));
			if(type === "msg" && channel === REGISTRATION_REQUESTS && payload.topic === topic && payload.status === 'approved'){

				listenTo.call(this,frequency,handlers);
				pull(this._queuedSubscriptions,queuedSub);
				Singleton.sock.removeEventListener("message", queuedSub);
			}
		}.bind(this);
		this._queuedSubscriptions.push(queuedSub);
		Singleton.sock.addEventListener("message",queuedSub);
	} else {
		listenTo.call(this,frequency,handlers);
	}
}



/**
* @name listenTo
* @desc Helper function to subscribe the implementing object to a `Frequency` with listener callbacks
* @param {object} frequency - The `ClientNexus.Frequency` to being listened to
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {onConnection} handlers.onConnection
* @param {onMessage} handlers.onMessage
* @param {onClose} handlers.onClose
*/
function listenTo(frequency,handlers){

	let {topic} = frequency;
	handlers.subject = this;
	if( !this._nexusSubscriptions[topic] ){
		let token = frequency.addListener.call(frequency,handlers);
		this._nexusTokens.push( frequency.removeListener.bind(frequency,token) );
	}
}




export {ClientNexus as default};
