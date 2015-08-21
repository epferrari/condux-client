/*
* inspiration from https://github.com/sockjs/websocket-multiplex.git `multiplex_client`
* tweaked to have unidirectional data flow across the wire
*/

"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _vendorLodash_mergeMapReducePullUniqJs = require('../vendor/lodash_merge-map-reduce-pull-uniq.js');

var random4 = function random4() {
	return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1).toUpperCase();
};

var uniqId = function uniqId() {
	return random4() + random4() + random4();
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
* @param {function} [options.hydrateWith=Frequency.prototype._hydrateData] - handle initial data flowing into `Data` on connection
* @param {function} [options.updateWith=Frequency.prototype._updateData] - handle the updating `Data` from incoming message
*/

function Frequency(topic, nexus, options) {
	var _this = this;

	var Data = {},
	    stream = [],
	    history = [],
	    socket = nexus.sock,
	    defaults = {
		hydrateWith: Frequency.prototype._hydrateData.bind(this),
		updateWith: Frequency.prototype._updateData.bind(this)
	};

	options = (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, defaults, options);

	this._listeners_ = {};

	this.connected = new Promise(function (resolve) {
		return _this.onconnected = resolve;
	});
	// get the state of Frequency's internal `datastream` at `index` in history.
	// 0 is initial hydration from server
	this.history = function (index) {
		return history[index];
	};
	// unsubscribe from server updates onclose
	// here instead of `this.onclose` to protect the socket from unauthorized sends
	this.addListener({
		subject: this,
		onClose: function onClose() {
			socket.send(["uns", this.topic].join(","));
		}
	});

	Object.defineProperties(this, {
		"topic": { value: topic },
		"band": { value: nexus.band },
		"__is_reflux_nexus_frequency__": { value: true }
	});

	// get the number of updates Frequency has received from the server
	Object.defineProperty(this, 'version', {
		get: function get() {
			return history.length - 1;
		},
		enumerable: true,
		configurable: false
	});

	// immutably get Frequency's internal stream of messages
	Object.defineProperty(this, 'stream', {
		get: function get() {
			return (0, _vendorLodash_mergeMapReducePullUniqJs.map)(stream, function (itm) {
				return itm;
			});
		},
		enumerable: true,
		configurable: false
	});

	Object.defineProperty(this, 'Data', {
		get: function get() {
			if (typeOf(Data) === 'object') {
				return (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, Data);
			}
			if (typeOf(Data) === 'array') {
				return (0, _vendorLodash_mergeMapReducePullUniqJs.map)(Data, function (itm) {
					return itm;
				});
			}
			return Data;
		},
		enumerable: true,
		configurable: false
	});

	/**
 * @name _hydrate_
 * @desc Handle initial data flowing to Frequency on connection.
 * Define with options.hydrateWith, defaults to `Frequency.prototype._hydrateWith`
 * @param {object|array} data - parsed JSON data message from server
 */
	Object.defineProperty(this, "_hydrate_", {
		value: function value(msg) {
			history.unshift(Data);
			stream.unshift(msg);
			Data = options.hydrateWith(msg);
		},
		enumerable: false,
		configurable: false,
		writable: false
	});

	/**
 * @name _update_
 * @desc Handle incoming data - overwrite or merge into `datastream`
 * can also customize the merging and updating methods by setting them
 * on construct as `options.mergeWith`/`options.updateWith`, default to the prototype methods if undefined
 * @param {any} new - parsed JSON data message from server
 */
	Object.defineProperty(this, "_update_", {
		value: function value(msg) {
			history.unshift(Data);
			stream.unshift(msg);
			Data = options.updateWith(this.Data, msg);
		},
		enumerable: false,
		configurable: false,
		writable: false
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
		var _this2 = this;

		// update or merge with Frequency's data stream, depending on options set
		this._hydrate_(JSON.parse(msg.data));
		setTimeout(function () {
			return _this2.broadcast('connected');
		}, 0);
	},

	onmessage: function onmessage(msg) {
		var _this3 = this;

		var data = JSON.parse(msg.data);
		// update or merge with Frequency's data stream, depending on options set
		// datastream will hydrate listeners that tune in after the initial connection is made
		this._update_(data);
		// push message data to Frequency's listeners' onMessage handler,
		// first arg is the message data from server,
		// second arg is the Frequency's cached datastream
		Promise.all((0, _vendorLodash_mergeMapReducePullUniqJs.map)(this._listeners_, function (l) {
			return new Promise(function (resolve, reject) {
				l.onMessage && l.onMessage.apply(l.subject, [data, _this3.Data]);
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

	_hydrateData: function _hydrateData(initialData) {
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
	_updateData: function _updateData(prevData, message) {
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
	addListener: function addListener(listener) {
		var _this4 = this;

		var token = uniqId();
		var l = listener;
		this._listeners_[token] = l;
		this.connected.then(function () {
			return l.onConnection && l.onConnection.call(l.subject, _this4.Data, _this4.stream);
		});
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
	},

	close: function close() {
		var _this5 = this;

		setTimeout(function () {
			return _this5.broadcast("close");
		}, 0);
	}
};

exports["default"] = Frequency;
module.exports = exports["default"];