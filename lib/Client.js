'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _sockjsClient = require('sockjs-client');

var _sockjsClient2 = _interopRequireDefault(_sockjsClient);

var _FrequencyJs = require('./Frequency.js');

var _FrequencyJs2 = _interopRequireDefault(_FrequencyJs);

var _vendorLodash_customJs = require('../vendor/lodash_custom.js');

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
function ClientNexus(options) {
	var _this = this;

	options = options || {};

	// use singleton to ensure only one ClientNexus
	if (singleton) return singleton;

	this.sock = options.sock || new _sockjsClient2['default'](options.prefix || "/reflux-nexus");
	this.spectrum = {};

	this.connected = new Promise(function (resolve) {
		if (_this.sock.readyState > 0) {
			resolve();
		} else {
			_this.sock.addEventListener("open", resolve);
		}
	});

	this.connected.then(function () {
		_this.sock.send(["sub", CLIENT_ACTIONS].join(","));
		_this.sock.send(["sub", REGISTRATION_REQUESTS].join(","));
	});

	this.sock.addEventListener("message", function (e) {
		var msg = e.data.split(","),
		    type = msg.shift(),
		    topic = msg.shift(),
		    payload = msg.join(),
		    frequency = _this.spectrum[topic];

		if (!frequency) return;

		if (type === "uns") {
			frequency.close();
		} else if (type === "msg") {
			frequency.broadcast("message", { data: payload });
		}
	});

	singleton = this;
}

ClientNexus.get = function get() {
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
	componentWillMount: function componentWillMount() {
		var _this2 = this;

		this._nexusTokens = [];
		this._nexusSubscriptions = {};
		this._queuedSubscriptions = [];
		this.tuneIn = function (topic, onMessage, onClose) {
			ClientNexus.get().attemptSubscription(_this2, topic, onMessage, onClose);
		};
	},

	componentWillUnmount: function componentWillUnmount() {
		var sock = ClientNexus.get().sock;
		this._nexusTokens.forEach(function (disposer) {
			return disposer();
		});
		this._queuedSubscriptions.forEach(function (queuedSub) {
			sock.removeEventListener("message", queuedSub);
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
function subscribe(frequency, onMessage, onClose) {

	if (!frequency || !frequency.__is_reflux_nexus_frequency__) {
		return new Error('First argument passed to .tuneIn must a Client Nexus Frequency.');
	}

	var topic = frequency.topic;

	if (!this._nexusSubscriptions[topic]) {
		var token = frequency.addSubscriber.call(frequency, {
			onMessage: onMessage,
			onClose: onClose,
			listener: this
		});
		this._nexusTokens.push(frequency.removeSubscriber.bind(frequency, token));
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
	createAction: function createAction(actionName) {
		var _this3 = this;

		return function (payload) {
			return new Promise(function (resolve, reject) {
				_this3.sock.send(["msg", CLIENT_ACTIONS, JSON.stringify({ actionType: actionName, payload: payload })].join(","));
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
	createActions: function createActions(actionNames) {
		var _this4 = this;

		return actionNames.reduce(function (accum, actionName) {
			accum[actionName] = _this4.createAction(actionName);
			return accum;
		}, {});
	},

	/**
 * @name registerFrequency
 * @desc Create a new Frequency to subscribe to data streams from
 * @param {string} topic - The Frequency's name handle
 */
	registerFrequency: function registerFrequency(topic) {
		var _this5 = this;

		var spectrum = this.spectrum;

		if (!spectrum[topic] && topic != REGISTRATION_REQUESTS && topic != CLIENT_ACTIONS) {

			this.connected.then(function () {
				return new Promise(function (resolve, reject) {
					_this5.sock.send(["msg", REGISTRATION_REQUESTS, JSON.stringify({ topic: topic })].join(","));
					resolve();
				});
			});
			spectrum[topic] = new _FrequencyJs2['default'](topic, this);
		}
		return spectrum[topic];
	},

	attemptSubscription: function attemptSubscription(subscriber, topic, onMessage, onClose) {
		var _this6 = this;

		if (!this.spectrum[topic]) {
			this.registerFrequency(topic);
			var queuedSub = function queuedSub(e) {
				var msg = e.data.split(','),
				    type = msg.shift(),
				    channel = msg.shift(),
				    payload = JSON.parse(msg.join(","));
				if (type === "msg" && channel === REGISTRATION_REQUESTS && payload.topic === topic && payload.status === 'approved') {
					subscribe.call(subscriber, _this6.spectrum[topic], onMessage, onClose);
					(0, _vendorLodash_customJs.pull)(subscriber._queuedSubscriptions, queuedSub);
					_this6.sock.removeEventListener("message", queuedSub);
				}
			};
			subscriber._queuedSubscriptions.push(queuedSub);
			this.sock.addEventListener("message", queuedSub);
		} else {
			subscribe.call(subscriber, this.spectrum[topic], onMessage, onClose);
		}
	}
};

exports['default'] = ClientNexus;
module.exports = exports['default'];