/*
* inspiration from https://github.com/sockjs/websocket-multiplex.git `multiplex_client`
* tweaked to have unidirectional data flow across the wire
*/

"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _vendorLodash_mergePullMapEachReduceUniqJs = require('../vendor/lodash_merge.pull.map.each.reduce.uniq.js');

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
* @param {function} [options.handleConnection=Frequency.prototype._hydrateData] - handle initial
* 	data flowing into `Data` on connection
* @param {function} [options.handleMessage=Frequency.prototype._updateData] - handle the updating
* 	`Data` from incoming message
* @param {function} [options.setInitialData] - (since 0.2.3) new API for bootstrapping `this.Data` on connection to Server.
* 	If declared, replaces `options.handleConnection`
* @param {function} [options.updateData] - (since 0.2.3) new API for handling how messages from the server
* 	are integrated into `this.Data`. If declared, replaces `options.handleMessage`
* @param {function} [options.provideCredentials] - provide a function that returns a hash of credentials to the Server
* 	(if required by the Channel to connect, otherwise leave blank)
* @protected
*/

function Frequency(topic, nexus, options) {
	var _this = this;

	this.isConnected = false;

	var _Data = {},
	    stream = [],
	    history = [],
	    defaults = {
		handleConnection: Frequency.prototype._hydrateData.bind(this),
		handleMessage: Frequency.prototype._updateData.bind(this),
		provideCredentials: function provideCredentials() {
			return null;
		}
	};

	options = (0, _vendorLodash_mergePullMapEachReduceUniqJs.merge)({}, defaults, options);

	/* send subscription request to the server nexus, call at end of constructor*/
	this._subscribe = function () {
		nexus.joinAndSend("sub", topic, options.provideCredentials());
	};

	this._subscriptions_ = {};
	this._responseListeners_ = {};

	/**
 * @desc A promise that is fulfilled when the Frequency connects with the
 * Server Nexus
 */
	this.didConnect = new Promise(function (resolve) {
		_this._connectionToken = _this.addListener(_this, {
			// resolve promise on connection
			connection: function connection() {
				this.isConnected = true;
				resolve();
			},
			// unsubscribe from server updates onclose
			close: function close() {
				this.isConnected = false;
				nexus.joinAndSend("uns", this.topic);
			}
		});
	});

	/**
 * @desc get the state of Frequency's internal `datastream` at `index` in history.
 * 0 is initial hydration from server
 * @param {number} index
 * @returns {Data}
 */
	this.history = function (index) {
		return history[index];
	};

	/**
 * @name topic
 * @instance
 * @memberof Frequency
 * @desc The name of the frequency, should match a Channel on the Server Nexus
 */

	/**
 * @name band
 * @instance
 * @memberof Frequency
 * @desc A hash of all the Frequencies on the ClientNexus instance that created
 * this Frequency
 */
	Object.defineProperties(this, {
		"topic": { value: topic },
		"band": { value: nexus.band },
		"__is_reflux_nexus_frequency__": { value: true }
	});

	/**
 * @name count
 * @instance
 * @memberof Frequency
 * @desc get the number of updates Frequency has received from the server
 */
	Object.defineProperty(this, 'count', {
		get: function get() {
			return history.length - 1;
		},
		enumerable: true,
		configurable: false
	});

	/**
 * @name stream
 * @instance
 * @memberof Frequency
 * @desc immutably get Frequency's internal stream of messages
 */
	Object.defineProperty(this, 'stream', {
		get: function get() {
			return (0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(stream, function (itm) {
				return itm;
			});
		},
		enumerable: true,
		configurable: false
	});

	/**
 * @name Data
 * @instance
 * @memberof Frequency
 * @readonly
 * @returns {any} - getter: returns immutable _Data state of Frequency
 */
	Object.defineProperty(this, 'Data', {
		get: function get() {
			switch (typeOf(_Data)) {
				case 'object':
					return (0, _vendorLodash_mergePullMapEachReduceUniqJs.merge)({}, _Data);
				case "array":
					return (0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(_Data, function (itm) {
						return itm;
					});
				default:
					return _Data;
			}
		},
		enumerable: true,
		configurable: false
	});

	/**
 * @name _hydrate_
 * @private
 * @desc Handle initial data flowing to Frequency on connection.
 * Define with options.handleConnection, defaults to `Frequency.prototype._hydrateWith`
 * In most cases you should define a custom method for handling data hydration
 * using `options.handleConnection` when you register the frequency.
 * @param {object|array} data - parsed JSON data message from server
 */
	Object.defineProperty(this, "_hydrate_", {
		value: function value(bootstrap) {
			var _options = options;
			var handleConnection = _options.handleConnection;
			var setInitialData = _options.setInitialData;

			history.unshift(_Data);
			_Data = setInitialData ? setInitialData(bootstrap) : handleConnection(bootstrap);
		},
		enumerable: false,
		configurable: false,
		writable: false
	});

	/**
 * @name _update_
 * @private
 * @desc Handle incoming data - overwrite or merge into `datastream`
 * using `options.handleMessage` if defined or prototype method `_updateData`,
 * which just overwrites the Data object with whatever streamed in.
 * In most cases you should define a custom method for handling messages
 * using `options.handleMessage` when you register the frequency.
 * @param {any} new - parsed JSON data message from server
 */
	Object.defineProperty(this, "_update_", {
		value: function value(message) {
			var _options2 = options;
			var handleMessage = _options2.handleMessage;
			var updateData = _options2.updateData;

			history.unshift(_Data);
			stream.unshift(message);
			_Data = updateData ? updateData(message, this.Data) : handleMessage(message, this.Data);
		},
		enumerable: false,
		configurable: false,
		writable: false
	});

	/**
 * @desc the client side of Nexus request API. Sends constraints to a server ChannelStore,
 * along with a unique request token. Adds a Promise to `this._responseListeners_`, and
 * when the ChannelStore responds, it resolves the promise and removes itself from
 * `this._responseListeners_`
 * @param {object} constraints = developer-defined key:value map of constraints to send ChannelStore
 * @returns {Promise}
 */
	this.request = function (constraints) {
		return new Promise(function (resolve, reject) {
			// create a token to cache the resolver for when then the request receives a response,
			// token is a randomly-generated id string, and when the server responds
			// the resolver will be called with the response body
			var token = _this.__addResponseListener({
				success: function success(token, body) {
					delete _this._responseListeners_[token];
					resolve(body);
				},
				error: function error(token, err) {
					delete _this._responseListeners_[token];
					reject(err);
				}
			});
			var req = {
				request_token: token,
				constraints: constraints
			};
			_this.didConnect.then(function () {
				// the connection was lost before the request went out
				if (!_this.isConnected) {
					reject('Frequency is no longer connected');
				} else {
					nexus.joinAndSend("req", _this.topic, JSON.stringify(req));
				}
			});
		});
	};

	nexus.didConnect.then(function () {
		return _this._subscribe();
	});
}

Frequency.prototype = {

	broadcast: function broadcast(eventType) {
		var handler = "on" + eventType;
		var args = [].slice.call(arguments, 1);
		if (this[handler]) this[handler].apply(this, args);
	},

	onconnection: function onconnection(data) {
		var _this2 = this;

		// update or merge with Frequency's data stream, depending on options set
		this._hydrate_(data);
		Promise.all((0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(this._subscriptions_, function (sub) {
			return new Promise(function (resolve, reject) {
				var listener = sub.listener;
				var handlers = sub.handlers;

				/* deprecated - onConnection handlers when registering listeners, removing in 1.0 */
				handlers.onConnection && handlers.onConnection.apply(listener, [_this2.Data]);
				/* updated API as of 0.2.4 */
				handlers.connection && handlers.connection.apply(listener, [_this2.Data]);
				resolve();
			});
		}));
	},

	onmessage: function onmessage(msg) {
		var _this3 = this;

		// update or merge with Frequency's data stream, depending on options set
		// datastream will hydrate listeners that tune in after the initial connection is made
		this._update_(msg);
		// push message data to Frequency's listeners' onMessage handler,
		// first arg is the message data from server,
		// second arg is the Frequency's cached datastream
		Promise.all((0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(this._subscriptions_, function (sub) {
			return new Promise(function (resolve, reject) {
				var listener = sub.listener;
				var handlers = sub.handlers;

				/* deprecated - onMessage handlers when registering listeners, removing in 1.0 */
				handlers.onMessage && handlers.onMessage.apply(listener, [msg, _this3.Data]);
				/* updated API as of 0.2.4 */
				handlers.message && handlers.message.apply(listener, [msg, _this3.Data]);
				resolve();
			});
		}));
	},

	onresponse: function onresponse(response) {
		var responseHandler = this._responseListeners_[response.request_token];
		// this calls the resolver of the promise created by the request
		if (responseHandler) responseHandler.success(response.request_token, response.body);
	},

	onerror: function onerror(response) {
		var responseHandler = this._responseListeners_[response.request_token];
		// this calls the resolver of the promise created by the request
		if (responseHandler) responseHandler.error(response.request_token, response.body);
	},

	onclose: function onclose() {
		delete this.band[this.topic];
		Promise.all((0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(this._subscriptions_, function (sub) {
			return new Promise(function (resolve, reject) {
				var listener = sub.listener;
				var handlers = sub.handlers;

				/* deprecated - onClose handlers for registering listeners, removing in 1.0 */
				handlers.onClose && handlers.onClose.apply(listener);
				/* updated API as of 0.2.4 */
				handlers.close && handlers.close.apply(listener);
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
 * @param {any} message - sent from server on topic channel
 * @param {object|array} previousData - the last Data state of the Frequency
 * @private
 */
	_updateData: function _updateData(message, previousData) {
		return message;
	},

	/**
 * @desc Add a handler for Frequency's `onmessage` event
 * @method
 * @param {object} listener - handlers are invoked with listener as `this`
 * @param {object} handlers - a hash of callbacks to execute when the Frequency recieves an
 * update from its Channel-Store on the server
 * @param {function} [handlers.connection]
 * @param {function} [handlers.message]
 * @param {function} [handlers.close]
 * @returns {string} token - unique identifier for the registered listener
 */
	addListener: function addListener(listener, handlers) {
		var token = uniqId();
		var h = handlers;
		this._subscriptions_[token] = { listener: listener, handlers: handlers };
		/* deprecated - onConnection handler for listeners, removing for 1.0 */
		if (this.isConnected && h.onConnection) h.onConnection.call(listener, this.Data, this.stream);
		/* new API as of 0.2.4 */
		if (this.isConnected && h.connection) h.connection.call(listener, this.Data, this.stream);
		return token;
	},

	/**
 * @desc Remove a handler from Frequency's `onmessage` event
 * @method
 * @param {string} token - the listener's unique identifier returned from `addListener`
 */
	removeListener: function removeListener(token) {
		delete this._subscriptions_[token];
	},

	__addResponseListener: function __addResponseListener(responseHandler) {
		var token = uniqId();
		this._responseListeners_[token] = responseHandler;
		return token;
	},

	/**
 * @desc Shut down the Frequency, unsubscribing from ServerNexus messages on topic
 */
	close: function close() {
		var _this4 = this;

		setTimeout(function () {
			return _this4.broadcast("close");
		}, 0);
	}
};

exports["default"] = Frequency;
module.exports = exports["default"];