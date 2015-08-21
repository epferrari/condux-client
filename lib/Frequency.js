/*
* inspiration from https://github.com/sockjs/websocket-multiplex.git `multiplex_client`
* tweaked to have unidirectional data flow across the wire
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

var _vendorLodash_mergeMapReducePullUniqJs = require('../vendor/lodash_merge-map-reduce-pull-uniq.js');

var uniqId = function uniqId() {
	return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1).toUpperCase();
};

var typeOf = function typeOf(obj) {
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

function Frequency(topic, nexus, options) {
	var _this = this;

	var datastream = {},
	    version = -1,
	    history = [],
	    socket = nexus.sock,
	    defaults = {
		merge: false,
		mergeWith: this.mergeStream.bind(this),
		updateWith: this.updateStream.bind(this)
	};

	options = (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, defaults, options);

	this.topic = topic;
	this.band = nexus.band;
	this._listeners_ = {};
	this.__is_reflux_nexus_frequency__ = true;

	// get the state of Frequency's internal `datastream` at `index` in history.
	// 0 is initial hydration from server
	this.history = function (index) {
		return history[index];
	};

	// get the number of updates Frequency has received from the server
	Object.defineProperty(this, 'version', Object.defineProperties({
		enumerable: true,
		configurable: false
	}, {
		'function': {
			get: function get() {
				return version;
			},
			configurable: true,
			enumerable: true
		}
	}));

	// immutably get Frequency's internal datastream
	Object.defineProperty(this, 'datastream', Object.defineProperties({
		enumerable: true,
		configurable: false
	}, {
		'function': {
			get: function get() {
				if (typeOf(datastream) === "array") {
					return (0, _vendorLodash_mergeMapReducePullUniqJs.map)(datastream, function (itm) {
						return itm;
					});
				} else if (typeOf(datastream) === "object") {
					return (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, datastream);
				} else {
					return datastream;
				}
			},
			configurable: true,
			enumerable: true
		}
	}));

	/**
 * @name _handleStream_
 * @desc Handle incoming data - overwrite or merge into `datastream`
 * set with `options.merge`, false by default
 * can also customize the merging and updating methods by setting them
 * on construct as `options.mergeWith`/`options.updateWith`, default to the prototype methods if undefined
 * @param {object|array} data - parsed JSON data message from server
 */
	Object.defineProperty(this, "_handleStream_", {
		value: function value(newData) {
			history.push(datastream);
			version++;
			datastream = (options.merge ? options.mergeWith(datastream, newData) : options.updateWith(datastream, newData)) || datastream;
		},
		enumerable: false,
		configurable: false,
		writable: false
	});

	// unsubscribe from server updates onclose
	// here instead of `this.onclose` to protect the socket from unauthorized sends
	this.addListener({
		subject: this,
		onClose: function onClose() {
			socket.send(["uns", this.topic].join(","));
		}
	});

	nexus.connected.then(function () {
		socket.send(["sub", _this.topic].join(","));
		setTimeout(function () {
			return _this.broadcast("open");
		}, 0);
	});
}

Frequency.prototype = {

	broadcast: function broadcast(eventType) {
		var handler = "on" + eventType;
		var args = [].slice.call(arguments, 1);
		if (this[handler]) this[handler].apply(this, args);
	},

	onconnection: function onconnection(msg) {
		// update or merge with Frequency's data stream, depending on options set
		this._handleStream_(JSON.parse(msg.data));
	},

	onmessage: function onmessage(msg) {
		var data = JSON.parse(msg.data);
		// update or merge with Frequency's data stream, depending on options set
		// datastream will hydrate listeners that tune in after the initial connection is made
		this._handleStream_(data);
		// push message data to Frequency's listeners' onMessage handler,
		// first arg is the message data from server,
		// second arg is the Frequency's cached datastream
		Promise.all((0, _vendorLodash_mergeMapReducePullUniqJs.map)(this._listeners_, function (l) {
			return new Promise(function (resolve, reject) {
				l.onMessage && l.onMessage.apply(l.subject, [data, this.datastream]);
				resolve();
			});
		}));
	},

	onclose: function onclose() {
		delete this.band[this.topic];
		Promise.all((0, _vendorLodash_mergeMapReducePullUniqJs.map)(this._listeners_, function (l) {
			return new Promise(function (resolve, reject) {
				l.onClose && l.onClose.apply(l.subject);
				resolve();
			});
		}));
	},

	updateStream: function updateStream(newData) {
		return newData;
	},

	mergeStream: function mergeStream(prevStream, newData) {
		var typeA = typeOf(prevStream);
		var typeB = typeOf(newData);
		if (typeA === typeB === "object") {
			return (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, prevStream, newData);
		}
		if (typeA === typeB === "array") {
			return (0, _vendorLodash_mergeMapReducePullUniqJs.uniq)(prevStream.concat(newData));
		}
		if (typeA === "array") {
			return (0, _vendorLodash_mergeMapReducePullUniqJs.uniq)(prevStream.push(newData));
		}
		if (typeA === "object") {
			var obj = {};
			obj[this.version] = newData;
			return (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, prevStream, obj);
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
	addListener: function addListener(listener) {
		var token = uniqId();
		var l = listener;
		this._listeners_[token] = l;
		l.onConnection && l.onConnection.call(l.subject, this.datastream);
		return token;
	},

	/**
 * @name removeListener
 * @method
 * @desc Remove a handler from Frequency's `onmessage` event
 * @memberof Frequency
 * @param {string} token - the listener's unique identifier returned from `addListener`
 */
	removeListener: function removeListener(token) {
		delete this._listeners_[token];
		// if the only listener left is Frequency's own onClose handler
		// close the connection
		if (Object.keys(this._listeners_).length >= 1) this.broadcast("close");
	},

	close: function close() {
		var _this2 = this;

		setTimeout(function () {
			return _this2.broadcast("close");
		}, 0);
	}
};

exports['default'] = Frequency;
module.exports = exports['default'];