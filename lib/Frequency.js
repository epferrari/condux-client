/*
* inspiration from https://github.com/sockjs/websocket-multiplex.git `multiplex_client`
* tweaked to have unidirectional data flow across the wire
*/
'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

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
* @desc A read-only stream of data from the server on `topic`. Split from a single websocket connection.
* Frequencies cannot be directly instansiated with the new operator; they are created with `<ConduxClient>.registerFrequency`
* or the shorthand `<ConduxClient>.Hz`.
* @constructor
* @param {string} topic - name handle of the Frequency, ex `/chat`
* @param {object} conduxClient - the ConduxClient instance that owns the Frequency
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
* 	(if required by the Channel to connect, otherwise leave you can this blank)
* @protected
*/

function Frequency(topic, conduxClient, options) {
	var _this = this;

	this.isConnected = false;

	var _Data = {},
	    defaults = {
		handleConnection: Frequency.prototype._hydrateData.bind(this),
		handleMessage: Frequency.prototype._updateData.bind(this),
		provideCredentials: function provideCredentials() {
			return null;
		}
	};

	options = (0, _vendorLodash_mergePullMapEachReduceUniqJs.merge)({}, defaults, options);

	/* send subscription request to the Condux server, call at end of constructor*/
	this._subscribe = function () {
		conduxClient.joinAndSend("sub", topic, options.provideCredentials());
	};

	this._subscriptions_ = {};
	this._responseListeners_ = {};

	/**
 * @desc A `bluebird` Promise fulfilled when the Frequency connects with the Condux Server
 */
	this.didConnect = new _bluebird2['default'](function (resolve) {
		_this._connectionToken = _this.addListener(_this, {
			// resolve promise on connection
			connection: function connection() {
				this.isConnected = true;
				resolve();
			},
			// unsubscribe from server updates onclose
			close: function close() {
				this.isConnected = false;
				conduxClient.joinAndSend("uns", this.topic);
			}
		});
	});

	/**
 * @name topic
 * @instance
 * @memberof Frequency
 * @readonly
 * @desc The name of the frequency, should match a Channel on the Condux server
 */

	/**
 * @name band
 * @instance
 * @memberof Frequency
 * @readonly
 * @desc A hash of all the Frequencies on the ConduxClient instance that created this Frequency
 */
	Object.defineProperties(this, {
		"topic": { value: topic },
		"band": { value: conduxClient.band },
		"__is_condux_frequency__": { value: true }
	});

	/**
 * @name Data
 * @desc getter
 * @instance
 * @memberof Frequency
 * @readonly
 * @returns {any} immutable _Data state of Frequency
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

			_Data = updateData ? updateData(message, this.Data) : handleMessage(message, this.Data);
		},
		enumerable: false,
		configurable: false,
		writable: false
	});

	/**
 * @desc The client side of Condux request API. Sends constraints to a Condux server Channel implementing the `response` interface,
 * Sent with a silent, unique request token that ensures resolution of the Promise created when the Condux server responds.
 * Adds the Promise to `this._responseListeners_`. When the Condux server Channel responds, the resolved Promise's thenables are called
 * and the Promise itself is removed from the `this._responseListeners_` hash.
 * @param {object} constraints - developer-defined key:value map of constraints to send Condux server Channel
 * @returns {Promise}
 */
	this.request = function (constraints) {
		return new _bluebird2['default'](function (resolve, reject) {
			// create a token to cache the resolver for when then the request receives a response,
			// token is a randomly-generated id string, and when the server responds
			// the resolver will be called with the response body
			var token = uniqId();
			var responseHandler = {
				success: function success(token, body) {
					delete _this._responseListeners_[token];
					resolve(body);
				},
				error: function error(token, err) {
					delete _this._responseListeners_[token];
					reject(err);
				}
			};

			_this._responseListeners_[token] = responseHandler;

			var req = {
				request_token: token,
				constraints: constraints
			};

			_this.didConnect.then(function () {
				// the connection was lost before the request went out
				if (!_this.isConnected) {
					reject('Lost connection to Frequency');
				} else {
					conduxClient.joinAndSend("req", _this.topic, JSON.stringify(req));
				}
			});
		});
	};

	conduxClient.didConnect.then(function () {
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
		_bluebird2['default'].all((0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(this._subscriptions_, function (sub) {
			return new _bluebird2['default'](function (resolve, reject) {
				/* deprecated - onConnection handlers when registering listeners, removing in 1.0 */
				sub.onConnection && sub.onConnection(_this2.Data);
				/* updated API as of 0.2.4 */
				sub.connection && sub.connection(_this2.Data);
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
		_bluebird2['default'].all((0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(this._subscriptions_, function (sub) {
			return new _bluebird2['default'](function (resolve, reject) {
				/* deprecated - onMessage handlers when registering listeners, removing in 1.0 */
				sub.onMessage && sub.onMessage(msg, _this3.Data);
				/* updated API as of 0.2.4 */
				sub.message && sub.message(msg, _this3.Data);
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
		_bluebird2['default'].all((0, _vendorLodash_mergePullMapEachReduceUniqJs.map)(this._subscriptions_, function (sub) {
			return new _bluebird2['default'](function (resolve, reject) {
				/* deprecated - onClose handlers for registering listeners, removing in 1.0 */
				sub.onClose && sub.onClose();
				/* updated API as of 0.2.4 */
				sub.close && sub.close();
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
 * conduxClient with no additional steps.
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
 * update from its server-side Channel
 * @param {function} [handlers.connection] - called with`this.Data` as single argument
 * when the Frequency connects to its Channel
 * @param {function} [handlers.message] - called when the Frequency receives a message. Is passed two arguments,
 * the parsed JSON payload of the message, and `this.Data`
 * @param {function} [handlers.close] - called when the connection to the server-side channel closes
 * @returns {string} token - unique identifier for the registered listener
 */
	addListener: function addListener(listener, handlers) {
		var token = uniqId();
		var sub = (0, _vendorLodash_mergePullMapEachReduceUniqJs.reduce)(handlers, function (r, fn, name) {
			if (typeOf(fn) === 'function') {
				r[name] = fn.bind(listener);
			}
			return r;
		}, {});
		this._subscriptions_[token] = sub;
		/* deprecated - onConnection handler for listeners, removing for 1.0 */
		if (this.isConnected && sub.onConnection) sub.onConnection(this.Data);
		/* new API as of 0.2.4 */
		if (this.isConnected && sub.connection) sub.connection(this.Data);
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

	/**
 * @desc Shut down the Frequency, unsubscribing from Condux server's channel broadcasts on this topic
 */
	close: function close() {
		var _this4 = this;

		setTimeout(function () {
			return _this4.broadcast("close");
		}, 0);
	}
};

exports['default'] = Frequency;
module.exports = exports['default'];