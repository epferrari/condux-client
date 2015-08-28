/*
* inspiration from https://github.com/sockjs/websocket-multiplex.git `multiplex_client`
* tweaked to have unidirectional data flow across the wire
*/


import {map,reduce,merge,uniq} from '../vendor/lodash_merge.pull.map.each.reduce.uniq.js';

var random4 = function(){
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1).toUpperCase();
};

var uniqId = function(){
	return random4() + random4() + random4();
};

var typeOf = function(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

/**
* @desc A read-only stream of data from the server on `topic`. Split from a single websocket connection
* @constructor
* @param {string} topic - name handle of the Frequency, ex `/chat`
* @param {object} nexus - the ClientNexus instance that owns the Frequency
* @param {object} options
* @param {function} [options.handleConnection=Frequency.prototype._hydrateData] - handle initial data flowing into `Data` on connection
* @param {function} [options.handleMessage=Frequency.prototype._updateData] - handle the updating `Data` from incoming message
*/

function Frequency(topic,nexus,options){

	var Data = {},
			stream = [],
			history = [],
			defaults = {
				handleConnection: Frequency.prototype._hydrateData.bind(this),
				handleMessage: Frequency.prototype._updateData.bind(this)
			};

	options = merge({},defaults,options);

	this._listeners_ = {};
	this._responseListeners_ = {};

	this.didConnect = new Promise( (resolve) => this.onconnected = resolve);

	// get the state of Frequency's internal `datastream` at `index` in history.
	// 0 is initial hydration from server
	this.history = function(index){
		return history[index];
	};
	// unsubscribe from server updates onclose
	// here instead of `this.onclose` to protect the socket from unauthorized sends
	this.addListener({
		sub: this,
		onClose: function(){
			nexus.joinAndSend("uns",this.topic);
		}
	});

	Object.defineProperties(this,{
		"topic": { value: topic },
		"band": { value: nexus.band },
		"__is_reflux_nexus_frequency__": { value: true }
	});

	// get the number of updates Frequency has received from the server
	Object.defineProperty(this,'count',{
		get: function(){ return history.length - 1; },
		enumerable: true,
		configurable: false
	});

	// immutably get Frequency's internal stream of messages
	Object.defineProperty(this,'stream',{
		get: function(){ return map(stream, itm => itm); },
		enumerable: true,
		configurable: false
	});

	// return immutable Data
	Object.defineProperty(this,'Data',{
		get: function(){
			if(typeOf(Data) === 'object'){
				return merge({},Data);
			}
			if(typeOf(Data) === 'array'){
				return map(Data, itm => itm);
			}
			return Data;
		},
		enumerable: true,
		configurable: false
	});

	/**
	* @name _hydrate_
	* @desc Handle initial data flowing to Frequency on connection.
	* Define with options.handleConnection, defaults to `Frequency.prototype._hydrateWith`
	* In most cases you should define a custom method for handling data hydration
	* using `options.handleConnection` when you register the frequency.
	* @param {object|array} data - parsed JSON data message from server
	*/
	Object.defineProperty(this,"_hydrate_",{
		value: function(msg){
			history.unshift(Data);
			stream.unshift(msg);
			Data = options.handleConnection(msg);
		},
		enumerable: false,
		configurable: false,
		writable: false
	});

	/**
	* @name _update_
	* @desc Handle incoming data - overwrite or merge into `datastream`
	* using `options.handleMessage` if defined or prototype method `_updateData`,
	* which just overwrites the Data object with whatever streamed in.
	* In most cases you should define a custom method for handling messages
	* using `options.handleMessage` when you register the frequency.
	* @param {any} new - parsed JSON data message from server
	*/
	Object.defineProperty(this,"_update_", {
		value: function(msg) {
			history.unshift(Data);
			stream.unshift(msg);
			Data = options.handleMessage(this.Data,msg);
		},
		enumerable: false,
		configurable: false,
		writable: false
	});


	nexus.didConnect.then( () => {
		nexus.joinAndSend("sub",this.topic);
		// onopen serves no purpose currently
		setTimeout( () => this.broadcast("open"),0 );
	});

	this.request = (constraints) => {
		return new Promise( (resolve,reject) => {
			// create a token to cache the resolver for when then the request receives a response,
			// token is a randomly-generated id string, and when the server responds
			// the resolver will be called with the response body
			let token = this.__addResponseListener( (token,body) => {
				delete this._responseListeners_[token];
				resolve(body);
			});
			let req = {
				request_token: token,
				constraints: constraints
			};
			nexus.joinAndSend("req",this.topic, JSON.stringify(req));
		});
	};
}

Frequency.prototype = {

	broadcast(eventType){
		let handler = "on" + eventType;
		let args = [].slice.call(arguments,1);
		if(this[handler]) this[handler].apply(this,args);
	},

	onconnection(data){
		// update or merge with Frequency's data stream, depending on options set
		this._hydrate_(data);
		setTimeout( () => this.broadcast('connected'),0 );
	},

	onmessage(msg){
		// update or merge with Frequency's data stream, depending on options set
		// datastream will hydrate listeners that tune in after the initial connection is made
		this._update_(msg);
		// push message data to Frequency's listeners' onMessage handler,
		// first arg is the message data from server,
		// second arg is the Frequency's cached datastream
		Promise.all(map(this._listeners_, l => {
			return new Promise( (resolve,reject) => {
				l.onMessage && l.onMessage.apply(l.sub,[msg,this.Data]);
				resolve();
			});
		}));
	},

	onresponse(response){
		let responseHandler = this._responseListeners_[response.request_token];
		// this calls the resolver of the promise created by the request
		if(responseHandler) responseHandler(response.request_token,response.body);
	},

	onclose(){
		delete this.band[this.topic]
		Promise.all(map(this._listeners_, l => {
			return new Promise(function(resolve,reject){
				l.onClose && l.onClose.apply(l.sub);
				resolve();
			});
		}));
	},

	_hydrateData(initialData){
		return initialData;
	},

	/**
	* @desc The Frequency will overwrite its Data with message data unless you
	* define a custom `updateWith(prevData,message)` method by passing it as an
	* option on construct. This default behavior is so that you could simply send
	* an updated collection from your server and have the state maintained on the
	* client with no additional steps.
	* @param {object|array} prevData - the last Data state of the Frequency
	* @param {any} message - sent from server on topic channel
	*/
	_updateData(prevData,message){
		return message;
	},

	/**
	* @name addListener
	* @desc Add a handler for Frequency's `onmessage` event
	* @method
	* @memberof Frequency
	* @param {object} listener
	* @param {function} listener.onConnection
	* @param {function} listener.onMessage
	* @param {function} listener.onClose
	* @param {object} listener.listener
	* @returns {string} token - unique identifier for the registered listener
	*/
	addListener(listener){
		var token = uniqId();
		var l = listener;
		this._listeners_[token] = l;
		this.didConnect.then( () => l.onConnection && l.onConnection.call(l.sub,this.Data,this.stream) );
		return token;
	},

	/**
	* @name removeListener
	* @method
	* @desc Remove a handler from Frequency's `onmessage` event
	* @memberof Frequency
	* @param {string} token - the listener's unique identifier returned from `addListener`
	*/
	removeListener(token){
		delete this._listeners_[token];
	},

	__addResponseListener(responseHandler){
		var token = uniqId();
		this._responseListeners_[token] = responseHandler;
		return token;
	},

	close(){
		setTimeout( () => this.broadcast("close"),0 );
	}
};

export default Frequency;
