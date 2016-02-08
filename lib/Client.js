'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _FrequencyJs = require('./Frequency.js');

var _FrequencyJs2 = _interopRequireDefault(_FrequencyJs);

// since 0.3.0

var _sockjsClient = require('sockjs-client');

var _sockjsClient2 = _interopRequireDefault(_sockjsClient);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _vendorLodash_mergePullMapEachReduceUniqJs = require('../vendor/lodash_merge.pull.map.each.reduce.uniq.js');

var typeOf = function typeOf(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

var pick = function pick(obj, props) {
	return (0, _vendorLodash_mergePullMapEachReduceUniqJs.reduce)(obj, function (r, val, key) {
		if (props.indexOf(key) !== -1) {
			r[key] = val;
		}
		return r;
	}, {});
};

var connecting = false;
var Singleton;
var REGISTRATIONS = "/REGISTRATIONS",
    CLIENT_ACTIONS = "/CLIENT_ACTIONS";

// defaults for persistent connection
var defaultPersistence = {
	enabled: true,
	onDisconnect: function onDisconnect() {},
	onConnecting: function onConnecting() {},
	onConnection: function onConnection() {},
	onReconnect: function onReconnect() {},
	onTimeout: function onTimeout() {},
	attempts: 10,
	interval: 3000
};

/**
* @desc create a Condux Client instance
* @param {string} url - a url of your server to pass into SockJS. Ensure the prefix `http://yoururl.com:port{/prefix}` is `/reflux-nexus`
* to connect to the `reflux-nexus` instance on your node server, or change the prefix on your server accordingly
* @param {object} persistence
* @param {boolean} [persistence.enabled=true] - should <ConduxClient> automatically try to reconnect on websocket "close" event
* @param {number} [persistence.attempts=10] - how many times should <ConduxClient> attempt to reconnect after losing connection.
* 		This happens inside <ConduxClient>.reconnect, which can be called independently of the websocket "close" event if necessary
* @param {number|function} [persistence.interval=3000] - how long to wait between reconnection attempts, in milliseconds. If passed a function, the function will be called with the number of reconnection attempts aleady made, and should return a number in milliseconds
* @param {function} [persistence.onConnecting=noop] - called when <ConduxClient> begins a reconnection attempt
* @param {function} [persistence.onConnection=noop] - called when <ConduxClient> establishes a connection to <ServerNexus>
* @param {function} [persistence.onDisconnect=noop] - called when <ConduxClient> disconnects with a close event from websocket
* @param {function} [persistence.onReconnect=noop] - called when <ConduxClient> re-establishes a connection to <ServerNexus> after being dropped
* @param {function} [persistence.onTimeout=noop] - called when reconnection attempts are exhausted
* @constructor
*/
function ConduxClient(url, persistence) {
	var _this = this;

	// use Singleton to ensure only one ConduxClient
	if (Singleton) return Singleton;

	var p = pick((0, _vendorLodash_mergePullMapEachReduceUniqJs.merge)({}, defaultPersistence, persistence), Object.keys(defaultPersistence));

	/**
 * @name persistence
 * @returns {object} current persistence options
 * @instance
 * @readonly
 * @memberof ConduxClient
 * @since 0.4.2
 */
	Object.defineProperty(this, 'persistence', {
		get: function get() {
			return p;
		},
		enumerable: false,
		configurable: false
	});

	/**
 * @name updatePersistence
 * @description Update the current persistence options. If `<ConduxClient>` is connecting and the `onConnecting` hook was updated, it will immediately call the new onConnecting function
 * @returns {object} updated persistence options
 * @method
 * @instance
 * @memberof ConduxClient
 * @since 0.4.2
 */
	this.updatePersistence = function (options) {
		var prevOnConnecting = p.onConnecting;
		var prevEnabled = p.enabled;
		p = pick((0, _vendorLodash_mergePullMapEachReduceUniqJs.merge)({}, p, options), Object.keys(p));

		// persistence was enabled
		if (!prevEnabled && p.enabled) {
			this.sock.addEventListener("close", this.reconnect.bind(this));
		}

		// persistence was disabled
		if (prevEnabled && !p.enabled) {
			this.sock.removeEventListener("close", this.reconnect.bind(this));
		}

		if (prevOnConnecting !== p.onConnecting && connecting) {
			p.onConnecting();
		}
		return p;
	};

	this._queue = [];
	this.url = url;
	this.band = {};
	this.connect();
	this.sock.addEventListener("message", function (e) {
		return _this._multiplex(e);
	});

	Singleton = this;
}

ConduxClient.prototype = Object.defineProperties({

	/**
 * @desc Set up frequency multiplexing and persistent connection (if enabled)
 * @instance
 * @memberof ConduxClient
 */
	connect: function connect() {
		var _this2 = this;

		// call event hook
		this.persistence.onConnecting();
		// connect to websocket
		connecting = true;
		var sock = this.sock = new _sockjsClient2['default'](this.url);
		// scheduled for deprecation in 0.3.2
		this.isConnected = function () {
			return sock.readyState === 1;
		};

		// create connection Promise
		this.didConnect = new _bluebird2['default'](function (resolve) {
			if (sock.readyState > 0) {
				resolve();
			} else {
				sock.addEventListener("open", resolve);
			}
		});

		this.didConnect.then(function () {
			connecting = false;
		}).then(function () {
			_this2.joinAndSend("sub", CLIENT_ACTIONS);
			_this2.joinAndSend("sub", REGISTRATIONS);
		}).then(function () {
			connecting = false;
			_this2.persistence.onConnection();
			sock.addEventListener("close", function () {
				return tthis.persistence.onDisconnect();
			});
			if (_this2.persistence.enabled) {
				// reset up a persistent connection, aka attempt to reconnect if the connection closes
				sock.addEventListener("close", _this2.reconnect.bind(_this2));
			}
		});
	},

	/**
 * @desc Set up frequency multiplexing after a disconnection with existing frequencies.
 * Will attempt the reconnection with options passed to ConduxClient constructor as
 * persistence options `attempts` and `interval`
 * @instance
 * @memberof ConduxClient
 */
	reconnect: function reconnect() {
		if (!connecting) {
			var attemptsMade = 0;
			var attemptsRemaining = this.persistence.attempts;
			// immediately try to reconnect
			var timeout = setTimeout(function () {
				return attemptReconnection();
			}, 200);

			var attemptReconnection = (function () {
				var _this3 = this;

				if (!attemptsRemaining) {
					// Failure, stop trying to reconnect
					this.persistence.onTimeout();
				} else {
					var delay = undefined;
					var interval = this.persistence.interval;

					// setup to try again after interval
					if (typeof interval == 'number') {
						delay = interval;
					} else if (typeof interval === 'function') {
						delay = interval(attemptsMade);
					}

					timeout = setTimeout(function () {
						return attemptReconnection();
					}, delay);
					attemptsMade++;
					attemptsRemaining--;

					// attempt to re-establish the websocket connection
					// resets `this.sock`
					// resets `this.didConnect` to a new Promise resolved by `this.sock`
					this.connect();

					// re-subscribe all frequencies
					_resubscribeFrequencies();

					// re-apply the message handling multiplexer
					this.sock.addEventListener("message", function (e) {
						return _this3._multiplex(e);
					});

					// Success, stop trying to reconnect,
					this.didConnect.then(function () {
						attemptsRemaining = 0;
						clearTimeout(timeout);
						_this3.persistence.onReconnect();
					});
				}
			}).bind(this);
			// end function attemptReconnection
		}
	},

	_resubscribeFrequencies: function _resubscribeFrequencies() {
		var _this4 = this;

		var activeConduxClient = this;
		(0, _vendorLodash_mergePullMapEachReduceUniqJs.each)(this.band, function (fq) {
			fq.removeListener(fq._connectionToken);
			// create new didConnect Promise for each frequency
			fq.didConnect = new _bluebird2['default'](function (resolve) {
				fq._connectionToken = fq.addListener(fq, {
					// resolve frequency's didConnect Promise on re-connection
					connection: function connection() {
						fq.isConnected = true;
						resolve();
					},
					// unsubscribe from server updates onclose
					close: function close() {
						fq.isConnected = false;
						activeConduxClient.joinAndSend("uns", fq.topic);
					}
				});
			});
			// resubscribe after ensuring new websocket connection
			_this4.didConnect.then(function () {
				return fq._subscribe();
			});
		});
	},

	/**
 * @desc Handle messages from the ServerNexus on different channels by sending
 * them to the appropriate frequency
 * @param {object} e - the event object passed from `<SockJS>.addEventLister`
 * @private
 */
	_multiplex: function _multiplex(e) {
		var queue = this._queue;
		var msg = e.data.split(","),
		    type = msg.shift(),
		    topic = msg.shift(),
		    payload = msg.join(),
		    frequency = this.band[topic];

		if (!frequency) return;

		if (topic === REGISTRATIONS) {
			// a channel was registered on the server after this Nexus subscribed to it
			// resubscribe, and remove the topic from the queue
			var _payload = JSON.parse(_payload);
			var registeredTopic = _payload.registered;
			var queuePosition = queue.indexOf(registeredTopic);
			if (queuePosition !== -1) {
				frequency._subscribe();
				(0, _vendorLodash_mergePullMapEachReduceUniqJs.pull)(queue, registeredTopic);
			}
		}

		try {
			payload = JSON.parse(payload);
		} catch (e) {
			// dispose the error
			var x = e;
			type = "err";
			payload = { message: "ERROR: invalid payload. Payload must be stringified JSON." };
		}

		switch (type) {
			case "uns":
				_broadcast(frequency, "close");
				break;
			case "conn":
				_broadcast(frequency, "connection", payload);
				break;
			case "msg":
				_broadcast(frequency, "message", payload);
				break;
			case "res":
				_broadcast(frequency, "response", payload);
				break;
			case "err":
				_broadcast(frequency, "error", payload);
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
 * @private
 */
	joinAndSend: function joinAndSend() {
		var _this5 = this;

		var msgArray = [].slice.call(arguments, 0);
		this.didConnect.then(function () {
			return _this5.sock.send(msgArray.join(','));
		});
	},

	/**
 * @desc Create a function that sends a keyed object with actionType
 * and payload to a `ServerNexus`. Use like you would use `Reflux.createAction` for
 * a local store.
 * @param {string} actionName - name of the action the ServerNexus will need to listen to
 * @returns {function} An action that should be called with an object payload
 * to be serialized and sent over the wire to the `ServerNexus`
 * @instance
 * @memberof ConduxClient
 */
	createAction: function createAction(actionName) {
		var _this6 = this;

		return function (payload) {
			return new _bluebird2['default'](function (resolve, reject) {
				var message = JSON.stringify({ actionType: actionName, payload: payload });
				_this6.joinAndSend("msg", CLIENT_ACTIONS, message);
				resolve();
			});
		};
	},

	/**
 * @desc Create a hash of action name keys with ConduxClient actions as values
 * @param {string[]} actionNames - create a hash of actions, use like you would
 * `Reflux.createActions` for a local store.
 * @returns {object} - a hash of action functions that accept an object payload to
 * be serialized and sent to the server
 * @instance
 * @memberof ConduxClient
 */
	createActions: function createActions(actionNames) {
		var _this7 = this;

		return actionNames.reduce(function (accum, actionName) {
			accum[actionName] = _this7.createAction(actionName);
			return accum;
		}, {});
	},

	/**
 * @desc Create a new Frequency to subscribe to data streams from
 * @param {string} topic - The Frequency's name handle
 * @param {object} options - hash of options
 * @param {function} [options.setInitialData=Frequency.prototype._hydrateData] - handle the merging of new data into `datastream`
 * @param {function} [options.updateData=Frequency.prototype._updateData] - handle the updating of new data to `datastream`
 * @param {function} [options.provideCredentials] - provide a function that returns a hash of credentials to the Server
 * 	(if required by the Channel to connect, otherwise leave blank)
 * @returns {Frequency} A Frequency instance
 * @instance
 * @memberof ConduxClient
 */
	registerFrequency: function registerFrequency(topic, options) {
		var frequency = this.band[topic];

		if (!frequency && topic !== CLIENT_ACTIONS && topic !== REGISTRATIONS) {
			this.band[topic] = frequency = new _FrequencyJs2['default'](topic, this, options);
		}
		return frequency;
	},

	/**
 * @desc enable automatic reconnection on websocket "close" event,
 * for use after persistence has been set by constructor
 * @instance
 * @memberof ConduxClient
 * @since 0.3.0
 */
	enablePersistence: function enablePersistence() {
		this.updatePersistence({ enabled: true });
	},

	/**
 * @desc disable automatic reconnection on websocket "close" event,
 * for use after persistence has been set by constructor
 * @since 0.3.0
 * @instance
 * @memberof ConduxClient
 */
	disablePersistence: function disablePersistence() {
		this.updatePersistence({ enabled: false });
	},

	/**
 * convenience alias for `registerFrequency`
 * @instance
 * @memberof ConduxClient
 * @returns {Frequency} A Frequency instance
 * @since 0.2.4
 */
	Hz: function Hz(topic, options) {
		return this.registerFrequency(topic, options);
	}

}, {
	connecting: { /**
               * @name connecting
               * @instance
               * @memberof ConduxClient
               * @desc is the <ConduxClient> in the process of connecting
               * @returns {boolean}
               * @readonly
               * @since 0.3.1
               */

		get: function get() {
			return connecting;
		},
		configurable: true,
		enumerable: true
	},
	connected: {

		/**
  * @name connected
  * @instance
  * @memberof ConduxClient
  * @desc is the <ConduxClient> currently connected to the Server
  * @returns {boolean}
  * @since 0.3.1
  * @readonly
  */

		get: function get() {
			return this.sock.readyState === 1;
		},
		configurable: true,
		enumerable: true
	}
});

/**
* @callback connectionHandler
* @desc A callback for the ConduxClient.Connect mixin triggered when the component initially tunes into a Frequency
* @param {object|array} hydration - the tuned-in Frequency's `datastream` when the component begins listening
*/

/**
* @callback messageHandler
* @desc A callback for the ConduxClient.Connect mixin triggered when Frequency receives server data
* @param {object|array} message - the tuned-in Frequency's latest message from the server
* @param {object|array} datastream - a copy of the Frequency's full datastream
*/

/**
* @callback closeHandler
* @desc A callback for the ConduxClient.Connect mixin triggered when Frequency receives server data
*/

/**
* @name ReactConnectMixin
* @static
* @desc Convenience Mixin for a React Component, giving it a `tuneIn` method that
* that allows the component to subscribe to a `ConduxClient Frequency` with a handler.
* Conveniently removes all Component handlers from the Frequency on `componentWillUnmount`
* @mixin
* @memberof ConduxClient
*/
ConduxClient.ReactConnectMixin = {
	componentWillMount: function componentWillMount() {
		var _this8 = this;

		this._nexusTokens = {};
		/**
  * @name tuneInto
  * @desc exposed to React.Component via `ConduxClient.ReactConnectMixin` Tune into a ConduxClient `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`
  * @param {object} frequency - a Frequency name handle
  * @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
  * @param {connectionHandler} [handlers.connection]
  * @param {messageHandler} [handlers.message]
  * @param {closeHandler} [handlers.close]
  */
		this.tuneInto = function (frequency, handlers) {
			listenToFrequency.call(_this8, frequency, handlers);
		};
	},

	componentWillUnmount: function componentWillUnmount() {
		(0, _vendorLodash_mergePullMapEachReduceUniqJs.each)(this._nexusTokens, function (disposer) {
			return disposer();
		});
	}
};

/**
* @name listenToFrequency
* @desc Helper function to subscribe the implementing object to a `Frequency` with listener callbacks
* @param {object} frequency - The `<ConduxClient>.Frequency` to being listened to
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {connectionHandler} handlers.connection
* @param {messageHandler} handlers.message
* @param {closeHandler} handlers.close
* @private
*/
function listenToFrequency(frequency, handlers) {

	if (typeOf(frequency) === "string") frequency = Singleton.band[frequency];
	if (!frequency || !frequency.__is_condux_frequency__) {
		throw new TypeError('first argument to "tuneInto" must be instance of Frequency');
	}

	var _frequency = frequency;
	var topic = _frequency.topic;

	if (!this._nexusTokens[topic]) {
		var token = frequency.addListener(this, handlers);
		this._nexusTokens[topic] = frequency.removeListener.bind(frequency, token);
	}
}

function _broadcast(frequency, message, payload) {
	setTimeout(function () {
		return frequency.broadcast(message, payload);
	}, 0);
}

/**
* @since 0.4.0
* @name DISCONNECTED
* @memberof ConduxClient
* @static
* @readonly
*/
Object.defineProperty(ConduxClient, 'DISCONNECTED', {
	value: 0,
	writable: false,
	configurable: false,
	enumerable: false
});

/**
* @since 0.4.0
* @name CONNECTING
* @memberof ConduxClient
* @constant
* @static
* @readonly
*/
Object.defineProperty(ConduxClient, 'CONNECTING', {
	value: 0,
	writable: false,
	configurable: false,
	enumerable: false
});

/**
* @since 0.4.0
* @name CONNECTED
* @memberof ConduxClient
* @readonly
* @static
* @constant
*/
Object.defineProperty(ConduxClient, 'CONNECTED', {
	value: 2,
	writable: false,
	configurable: false,
	enumerable: false
});

exports['default'] = ConduxClient;
module.exports = exports['default'];