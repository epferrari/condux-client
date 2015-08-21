/*
* inspiration from https://github.com/sockjs/websocket-multiplex.git `multiplex_client`
* tweaked to have unidirectional data flow across the wire
*/


import {map,reduce,merge,uniq} from '../vendor/lodash_merge-map-reduce-pull-uniq.js';

var uniqId = function(){
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1).toUpperCase();
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
* @param {boolean} [options.merge=false] - should the Frequency's `datastream` be merged or updated when new data arrives?
* @param {function} [options.mergeWith=Frequency.prototype.mergeStream] - handle the merging of new data into `datastream`
* @param {function} [options.updateWith=Frequency.prototype.updateStream] - handle the updating of new data to `datastream`
*/

function Frequency(topic,nexus,options){

	var datastream = {},
			version = -1
			history = [],
			socket = nexus.sock,
			defaults = {
				merge: false,
				mergeWith: this.mergeStream.bind(this),
				updateWith: this.updateStream.bind(this)
			};

	options = merge({},defaults,options);

	this.topic = topic;
	this.band = nexus.band;
	this._listeners_ = {};
	this.__is_reflux_nexus_frequency__ = true;

	// get the state of Frequency's internal `datastream` at `index` in history.
	// 0 is initial hydration from server
	this.history = function(index){
		return(history[index]);
	};

	// get the number of updates Frequency has received from the server
	Object.defineProperty(this,'version',{
		get function(){
			return version;
		},
		enumerable: true,
		configurable: false
	});

	// immutably get Frequency's internal datastream
	Object.defineProperty(this,'datastream',{
		get function(){
			if(typeOf(datastream) === "array"){
				return map(datastream, itm => itm);
			} else if(typeOf(datastream) === "object"){
				return merge({},datastream);
			} else {
				return datastream;
			}
		},
		enumerable: true,
		configurable: false
	});

	/**
	* @name _handleStream_
	* @desc Handle incoming data - overwrite or merge into `datastream`
	* set with `options.merge`, false by default
	* can also customize the merging and updating methods by setting them
	* on construct as `options.mergeWith`/`options.updateWith`, default to the prototype methods if undefined
	* @param {object|array} data - parsed JSON data message from server
	*/
	Object.defineProperty(this,"_handleStream_",{
		value: function(newData){
			history.push(datastream);
			version++;
			datastream = (options.merge ? options.mergeWith(datastream,newData) : options.updateWith(datastream,newData)) || datastream;
		},
		enumerable: false,
		configurable: false,
		writable: false
	});

	// unsubscribe from server updates onclose
	// here instead of `this.onclose` to protect the socket from unauthorized sends
	this.addListener({
		subject: this,
		onClose: function(){
			socket.send( ["uns",this.topic].join(",") );
		}
	});

	nexus.connected.then( () => {
		socket.send( ["sub",this.topic].join(",") );
		setTimeout( () => this.broadcast("open"),0 );
	});
}

Frequency.prototype = {

	broadcast(eventType){
		let handler = "on" + eventType;
		let args = [].slice.call(arguments,1);
		if(this[handler]) this[handler].apply(this,args);
	},

	onconnection(msg){
		// update or merge with Frequency's data stream, depending on options set
		this._handleStream_(JSON.parse(msg.data));
	},

	onmessage(msg){
		let data = JSON.parse(msg.data);
		// update or merge with Frequency's data stream, depending on options set
		// datastream will hydrate listeners that tune in after the initial connection is made
		this._handleStream_(data);
		// push message data to Frequency's listeners' onMessage handler,
		// first arg is the message data from server,
		// second arg is the Frequency's cached datastream
		Promise.all(map(this._listeners_, l => {
			return new Promise(function(resolve,reject){
				l.onMessage && l.onMessage.apply(l.subject,[data,this.datastream]);
				resolve();
			});
		}));
	},

	onclose(){
		delete this.band[this.topic]
		Promise.all(map(this._listeners_, l => {
			return new Promise(function(resolve,reject){
				l.onClose && l.onClose.apply(l.subject);
				resolve();
			});
		}));
	},

	updateStream(newData){
		return newData;
	},

	mergeStream(prevStream,newData){
		var typeA = typeOf(prevStream);
		var typeB = typeOf(newData);
		if(typeA === typeB === "object"){
			return merge({},prevStream,newData);
		}
		if(typeA === typeB === "array"){
			return uniq(prevStream.concat(newData));
		}
		if(typeA === "array"){
			return uniq(prevStream.push(newData));
		}
		if(typeA === "object"){
			var obj = {};
			obj[this.version] = newData;
			return merge({},prevStream,obj);
		}
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
		l.onConnection && l.onConnection.call(l.subject,this.datastream);
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
		// if the only listener left is Frequency's own onClose handler
		// close the connection
		if(Object.keys(this._listeners_).length >= 1) this.broadcast("close");
	},

	close(){
		setTimeout( () => this.broadcast("close"),0 );
	}
};

export default Frequency;
