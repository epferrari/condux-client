import sockjs from 'sockjs-client';
import WebSocketMultiplex from './WebSocketMultiplex.js';
import Channel from './Channel.js';

var uniqId =  function(){
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1).toUpperCase();
};

var singleton;


/**
* @desc A client-side companion to `reflux-nexus` on the server. All actions will
* be called on the main `NEXUS_CLIENT_ACTIONS` channel, ensuring the Server dispatch can
* perform its delegation
* @param {object} options
* @param {string} [options.prefix=/reflux-nexus] - the root path to your websocket connection
* #param {object} [options.sock] - a sockjs instance
*/
function ClientNexus(options){

	options = options || {};

	// use singleton to ensure only one ClientNexus
	if(singleton) return singleton;

	this.sock = options.sock || new sockjs(options.prefix || "/reflux-nexus");
	this.connected = new Promise( (resolve) => {
		if(this.sock.readyState > 0){
			resolve();
		} else {
			this.sock.addEventListener("open",resolve);
		}
	});

	this.multiplexer = new WebSocketMultiplex(this.sock);
	this.action_channel = this.multiplexer.channel('CLIENT_NEXUS_ACTIONS');
	singleton = this;
}

/**
* @name use
* @static
* @memberof ClientNexus
* @desc Initialize a ClientNexus instance with a pre-existing sockjs instance
* @param {object} sock - a sockjs instance
* @returns {object} a ClientNexus
*/
ClientNexus.use = function(sock){

	// use singleton to ensure only one ClientNexus
	if(singleton){
		singleton.sock = sock;
		singleton.multiplexer = new WebSocketMultiplex(sock);
		singleton.action_channel = singleton.multiplexer.channel('CLIENT_NEXUS_ACTIONS');
		return singleton;
	}
	singleton =  new this({sock: sock});
	return singleton;
};

/**
* @name subscribe
* @desc Helper function to subscribe the implementing object to a `Channel` with `handler`
* @param {object} channel - The `ClientNexus.Channel` to subscribe to `onmessage` events
* @param {function} onMessage - The function that will be called when `Channel`'s `onmessage` event is triggered.
* `handler` is applied to the implementing object and called with one argument, the deserialized data from `onmessage`
* @param {function} [onClose] - Function to call when the Channel's connection closes, bound to implementing object
*/
function subscribe(channel,onMessage,onClose){
	let {addListener,removeListener,topic} = channel;

	if(!channel.__is_reflux_nexus_channel__){
		return new Error('First argument passed to .tuneIn must a Client Nexus Channel.');
	}

	if( !this._nexusSubscriptions[topic] ){
		let token = addListener({
			onMessage: onMessage,
			onClose: onClose,
			listener: this
		});
		this._nexusTokens.push( removeListener.bind(channel,token) );
	}
}

/**
* @name Connect
* @static
* @desc Convenience Mixin for a React Component, giving it a `tuneIn` method that
* that allows the component to subscribe to a `ClientNexus.Channel` with a handler.
* Conveniently removes all Component handlers from the Channel on `componentWillUnmount`
* @name Connect
* @memberof ClientNexus
*/
ClientNexus.Connect = {

	componentWillMount(){
		this._nexusTokens = [];
		this._nexusSubscriptions = {};
		this.tuneIn = subscribe.bind(this);
	},

	componentWillUnmount(){
		this._nexusTokens.forEach(disposer => disposer());
	}
};





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
		return payload => this.action_channel.send(JSON.stringify({
			actionType: actionName,
			payload: payload
		}));
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
	* @name Channel
	* @constructor
	* @desc Create a new channel to subscribe to data streams on
	* @param {string} name - The channel's name
	* @param {object} multiplexer - The WebSocketMultiplex that will create channels
	*/
	channel(topic){
		let channels = this.multiplexer.channels;
		let channel;
		if(!channels[topic]) {
			channel = new Channel(topic, this.multiplexer.channel(topic) );
			this.connected.then( () => {
				this.action_channel.send(JSON.stringify({
					actionType: "REGISTER_CLIENT_CHANNEL",
					payload: {topic: topic}
				}));
			});
		}
		return channels[topic];
	}
};






export {ClientNexus as default};
