//import sockjs from 'sockjs-client';
'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _FrequencyJs = require('./Frequency.js');

var _FrequencyJs2 = _interopRequireDefault(_FrequencyJs);

var _vendorLodash_mergePullMapEachReduceUniqJs = require('../vendor/lodash_merge.pull.map.each.reduce.uniq.js');

var typeOf = function typeOf(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

var Singleton;
var REGISTRATIONS = "/REGISTRATIONS",
    CLIENT_ACTIONS = "/CLIENT_ACTIONS";

/**
* @desc A client-side companion to `reflux-nexus` on the server. All actions will
* be called on the main `CLIENT_ACTIONS` channel, ensuring the Server dispatch can
* perform its delegation.
* @param {object} sock - a SockJS instance. Ensure that the prefix `http://yoururl.com{/prefix}` is `/reflux-nexus`
* to connect to the `reflux-nexus` instance on your node server, or change the prefix on your server accordingly
* @constructor
*/
function ClientNexus(sock) {
	var _this = this;

	// use Singleton to ensure only one ClientNexus
	if (Singleton) return Singleton;

	this._queue = [];
	this.sock = sock;
	this.band = {};
	this.connect(sock);
	sock.addEventListener("message", function (e) {
		return _this._multiplex(e);
	});

	Singleton = this;
}

ClientNexus.prototype = {

	/**
 * @desc Set up frequency multiplexing
 * @param {object} sock - A SockJS instance
 */
	connect: function connect(sock) {
		var _this2 = this;

		this.sock = sock;
		this.isConnected = function () {
			return sock.readyState === 1;
		};

		this.didConnect = new Promise(function (resolve) {
			if (sock.readyState > 0) {
				resolve();
			} else {
				sock.addEventListener("open", resolve);
			}
		});

		this.didConnect.then(function () {
			_this2.joinAndSend("sub", CLIENT_ACTIONS);
			_this2.joinAndSend("sub", REGISTRATIONS);
		});
	},

	/**
 * @desc Set up frequency multiplexing after a disconnect with existing frequencies
 * @param {object} sock - A SockJS instance
 */
	reconnect: function reconnect(sock) {
		var _this3 = this;

		// rebind to new sock
		this.connect(sock);

		// resubscribe the frequencies
		(0, _vendorLodash_mergePullMapEachReduceUniqJs.each)(this.band, function (fq) {
			fq.removeListener(fq._connectionToken);
			fq.didConnect = new Promise(function (resolve) {
				fq._connectionToken = fq.addListener(fq, {
					// resolve promise on connection
					connection: function connection() {
						fq.isConnected = true;
						resolve();
					},
					// unsubscribe from server updates onclose
					close: function close() {
						fq.isConnected = false;
						nexus.joinAndSend("uns", fq.topic);
					}
				});
			});
			_this3.didConnect.then(function () {
				return fq._subscribe();
			});
		});

		// reapply the message handling multiplexer
		sock.addEventListener("message", function (e) {
			return _this3._multiplex(e);
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
			var x = e;
			payload = {};
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
		var _this4 = this;

		var msgArray = [].slice.call(arguments, 0);
		this.didConnect.then(function () {
			return _this4.sock.send(msgArray.join(','));
		});
	},

	/**
 * @desc Create a function that sends a keyed object with actionType
 * and payload to a `ServerNexus`. Use like you would use `Reflux.createAction` for
 * a local store.
 * @param {string} actionName - name of the action the ServerNexus will need to listen to
 * @returns {function} An action that should be called with an object payload
 * to be serialized and sent over the wire to the `ServerNexus`
 */
	createAction: function createAction(actionName) {
		var _this5 = this;

		return function (payload) {
			return new Promise(function (resolve, reject) {
				var message = JSON.stringify({ actionType: actionName, payload: payload });
				_this5.joinAndSend("msg", CLIENT_ACTIONS, message);
				resolve();
			});
		};
	},

	/**
 * @desc Create a hash of action name keys with ClientNexus actions as values
 * @param {string[]} actionNames - create a hash of actions, use like you would
 * `Reflux.createActions` for a local store.
 * @returns {object} - a hash of action functions that accept an object payload to
 * be serialized and sent to the server
 */
	createActions: function createActions(actionNames) {
		var _this6 = this;

		return actionNames.reduce(function (accum, actionName) {
			accum[actionName] = _this6.createAction(actionName);
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
 */
	registerFrequency: function registerFrequency(topic, options) {
		var frequency = this.band[topic];

		if (!frequency && topic !== CLIENT_ACTIONS && topic !== REGISTRATIONS) {
			this.band[topic] = frequency = new _FrequencyJs2['default'](topic, this, options);
		}
		return frequency;
	},

	/**
 * convenience alias for `registerFrequency`
 * @since 0.2.4
 */
	Hz: function Hz(topic, options) {
		return this.registerFrequency(topic, options);
	}
};

/**
* @callback connectionHandler
* @desc A callback for the ClientNexus.Connect mixin triggered when the component initially tunes into a Frequency
* @param {object|array} hydration - the tuned-in Frequency's `datastream` when the component begins listening
*/

/**
* @callback messageHandler
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
* @param {object|array} message - the tuned-in Frequency's latest message from the server
* @param {object|array} datastream - a copy of the Frequency's full datastream
*/

/**
* @callback closeHandler
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
*/

/**
* @name Connect
* @static
* @desc Convenience Mixin for a React Component, giving it a `tuneIn` method that
* that allows the component to subscribe to a `ClientNexus Frequency` with a handler.
* Conveniently removes all Component handlers from the Frequency on `componentWillUnmount`
* @mixin
* @memberof ClientNexus
*/
ClientNexus.Connect = {
	componentWillMount: function componentWillMount() {
		var _this7 = this;

		this._nexusTokens = {};
		/**
  * @name tuneInto
  * @extends React.Component
  * @desc Tune into a ClientNexus `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`
  * @param {object} frequency - a Frequency name handle
  * @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
  * @param {connectionHandler} [handlers.connection]
  * @param {messageHandler} [handlers.message]
  * @param {closeHandler} [handlers.close]
  * @implements ClientNexus.Connect
  */
		this.tuneInto = function (frequency, handlers) {
			listenToFrequency.call(_this7, frequency, handlers);
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
* @param {object} frequency - The `ClientNexus.Frequency` to being listened to
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {connectionHandler} handlers.connection
* @param {messageHandler} handlers.message
* @param {closeHandler} handlers.close
* @private
*/
function listenToFrequency(frequency, handlers) {

	if (typeOf(frequency) === "string") frequency = Singleton.band(frequency);
	if (!frequency || !frequency.__is_reflux_nexus_frequency__) {
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

exports['default'] = ClientNexus;
module.exports = exports['default'];