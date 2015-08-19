import sockjs from 'sockjs-client';
import Frequency from './Frequency.js';
import {pull} from '../vendor/lodash_custom.js';

var singleton;
var REGISTRATION_REQUESTS = "REGISTRATION_REQUESTS",
		CLIENT_ACTIONS = "CLIENT_ACTIONS";

/**
* @desc A client-side companion to `reflux-nexus` on the server. All actions will
* be called on the main `NEXUS_CLIENT_ACTIONS` channel, ensuring the Server dispatch can
* perform its delegation
* @param {object} options
* @param {string} [options.prefix=/reflux-nexus] - the root path to your websocket connection
* @param {object} [options.sock] - a sockjs instance
*/
function ClientNexus(options){

	options = options || {};

	// use singleton to ensure only one ClientNexus
	if(singleton) return singleton;

	this.sock = options.sock || new sockjs(options.prefix || "/reflux-nexus");
	this.spectrum = {};

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
				frequency = this.spectrum[topic];

		if(!frequency) return;

		if(type === "uns"){
			frequency.close();
		} else if (type === "msg"){
			frequency.broadcast("message",{data:payload});
		}
	});

	singleton = this;
}


ClientNexus.get = function get(){
	return singleton;
};

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
		this.tuneIn = (topic,onMessage,onClose) => {
			ClientNexus.get().attemptSubscription(this,topic,onMessage,onClose);
		};
	},

	componentWillUnmount(){
		var sock = ClientNexus.get().sock;
		this._nexusTokens.forEach(disposer => disposer());
		this._queuedSubscriptions.forEach( queuedSub => {
			sock.removeEventListener("message",queuedSub);
		});
	}
};




/**
* @name subscribe
* @desc Helper function to subscribe the implementing object to a `Channel` with `handler`
* @param {object} channel - The `ClientNexus.Channel` to subscribe to `onmessage` events
* @param {function} onMessage - The function that will be called when `Channel`'s `onmessage` event is triggered.
* `handler` is applied to the implementing object and called with one argument, the deserialized data from `onmessage`
* @param {function} [onClose] - Function to call when the Channel's connection closes, bound to implementing object
*/
function subscribe(frequency,onMessage,onClose){

	if(!frequency || !frequency.__is_reflux_nexus_frequency__){
		return new Error('First argument passed to .tuneIn must a Client Nexus Frequency.');
	}

	let {topic} = frequency;

	if( !this._nexusSubscriptions[topic] ){
		let token = frequency.addSubscriber.call(frequency,{
			onMessage: onMessage,
			onClose: onClose,
			listener: this
		});
		this._nexusTokens.push( frequency.removeSubscriber.bind(frequency,token) );
	}
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
	*/
	registerFrequency(topic){
		let spectrum = this.spectrum;

		if(!spectrum[topic] && topic != REGISTRATION_REQUESTS && topic != CLIENT_ACTIONS){

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
			spectrum[topic] = new Frequency(topic,this);
		}
		return spectrum[topic];
	},

	attemptSubscription(subscriber,topic,onMessage,onClose){

		if(!this.spectrum[topic]){
			this.registerFrequency(topic);
			var queuedSub = (e) => {
				var msg = e.data.split(','),
						type = msg.shift(),
						channel = msg.shift(),
						payload = JSON.parse(msg.join(","));
				if(type === "msg" && channel === REGISTRATION_REQUESTS && payload.topic === topic && payload.status === 'approved'){
					subscribe.call(subscriber, this.spectrum[topic], onMessage, onClose);
					pull(subscriber._queuedSubscriptions,queuedSub);
					this.sock.removeEventListener("message", queuedSub);
				}
			};
			subscriber._queuedSubscriptions.push(queuedSub);
			this.sock.addEventListener("message",queuedSub);
		} else {
			subscribe.call(subscriber,this.spectrum[topic],onMessage,onClose);
		}
	}
};






export {ClientNexus as default};
