'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _sockjsClient = require('sockjs-client');

var _sockjsClient2 = _interopRequireDefault(_sockjsClient);

var _FrequencyJs = require('./Frequency.js');

var _FrequencyJs2 = _interopRequireDefault(_FrequencyJs);

var _vendorLodash_mergeMapReducePullUniqJs = require('../vendor/lodash_merge-map-reduce-pull-uniq.js');

var typeOf = function typeOf(obj) {
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

var Singleton;
var REGISTRATION_REQUESTS = "REGISTRATION_REQUESTS",
    CLIENT_ACTIONS = "CLIENT_ACTIONS";

/**
* @desc A client-side companion to `reflux-nexus` on the server. All actions will
* be called on the main `NEXUS_CLIENT_ACTIONS` channel, ensuring the Server dispatch can
* perform its delegation
* @param {object} options - hash of options
* @param {string} [options.prefix=/reflux-nexus] - the root path to your websocket connection
* @param {object} [options.sock] - a sockjs instance
* @constructor
*/
function ClientNexus(options) {
	var _this = this;

	options = (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, { prefix: "/reflux-nexus" }, options);

	// use Singleton to ensure only one ClientNexus
	if (Singleton) return Singleton;

	this.sock = options.sock || new _sockjsClient2['default'](options.prefix || "/reflux-nexus");
	this.band = {};

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
		    frequency = _this.band[topic];

		if (!frequency) return;

		switch (type) {
			case "uns":
				setTimeout(function () {
					return frequency.broadcast("close");
				}, 0);
				break;
			case "conn":
				setTimeout(function () {
					return frequency.broadcast("connection", { data: payload });
				}, 0);
				break;
			case "msg":
				setTimeout(function () {
					return frequency.broadcast("message", { data: payload });
				}, 0);
				break;
		}

		return;
	});

	Singleton = this;
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
		var _this2 = this;

		return function (payload) {
			return new Promise(function (resolve, reject) {
				_this2.sock.send(["msg", CLIENT_ACTIONS, JSON.stringify({ actionType: actionName, payload: payload })].join(","));
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
		var _this3 = this;

		return actionNames.reduce(function (accum, actionName) {
			accum[actionName] = _this3.createAction(actionName);
			return accum;
		}, {});
	},

	/**
 * @name registerFrequency
 * @desc Create a new Frequency to subscribe to data streams from
 * @param {string} topic - The Frequency's name handle
 * @param {object} options - hash of options
 * @param {boolean} [options.merge=false] - should the Frequency's `datastream` be merged or updated when new data arrives?
 * @param {function} [options.mergeWith=Frequency.prototype.mergeStream] - handle the merging of new data into `datastream`
 * @param {function} [options.updateWith=Frequency.prototype.updateStream] - handle the updating of new data to `datastream`
 * @returns {object} A Frequency instance
 */
	registerFrequency: function registerFrequency(topic, options) {
		var _this4 = this;

		var frequency = this.band[topic];

		if (!frequency && topic != REGISTRATION_REQUESTS && topic != CLIENT_ACTIONS) {

			this.connected.then(function () {
				return new Promise(function (resolve, reject) {
					_this4.sock.send(["msg", REGISTRATION_REQUESTS, JSON.stringify({ topic: topic })].join(","));
					resolve();
				});
			});
			this.band[topic] = frequency = new _FrequencyJs2['default'](topic, this, options);
		}
		return frequency;
	}
};

/**
* @callback onConnection
* @desc A callback for the ClientNexus.Connect mixin triggered when the component initially tunes into a Frequency
* @param {object|array} hydration - the tuned-in Frequency's `datastream` when the component begins listening
*/

/**
* @callback onMessage
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
* @param {object|array} message - the tuned-in Frequency's latest message from the server
* @param {object|array} datastream - a copy of the Frequency's full datastream
*/

/**
* @callback onClose
* @desc A callback for the ClientNexus.Connect mixin triggered when Frequency receives server data
*/

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
		var _this5 = this;

		this._nexusTokens = [];
		this._nexusSubscriptions = {};
		this._queuedSubscriptions = [];
		/**
  * @name tuneInto
  * @desc Tune into a ClientNexus `Frequency` and handle Frequency lifecyle events `connection`,`message`, and `close`
  * @param {string} topic - a Frequency name handle
  * @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
  * @param {onConnection} handlers.onConnection
  * @param {onMessage} handlers.onMessage
  * @param {onClose} handlers.onClose
  */
		this.tuneInto = function (topic, handlers) {

			var defaults = {
				onConnection: function onConnection() {},
				onMessage: function onMessage() {},
				onClose: function onClose() {}
			};

			handlers = (0, _vendorLodash_mergeMapReducePullUniqJs.merge)({}, defaults, handlers);
			attemptListen.call(_this5, topic, handlers);
		};
	},

	componentWillUnmount: function componentWillUnmount() {
		var sock = Singleton.sock;
		this._nexusTokens.forEach(function (disposer) {
			return disposer();
		});
		this._queuedSubscriptions.forEach(function (q) {
			sock.removeEventListener("message", q);
		});
	}
};

/**
* Helper for Connect mixin's `tuneInto` method
* @param {string} topic - a Frequency name handle
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {onConnection} handlers.onConnection
* @param {onMessage} handlers.onMessage
* @param {onClose} handlers.onClose
*/
function attemptListen(topic, handlers) {

	var frequency = Singleton.band[topic];

	if (!frequency) {
		frequency = Singleton.registerFrequency(topic);
		var queuedSub = (function (e) {
			var msg = e.data.split(','),
			    type = msg.shift(),
			    channel = msg.shift(),
			    payload = JSON.parse(msg.join(","));
			if (type === "msg" && channel === REGISTRATION_REQUESTS && payload.topic === topic && payload.status === 'approved') {

				listenTo.call(this, frequency, handlers);
				(0, _vendorLodash_mergeMapReducePullUniqJs.pull)(this._queuedSubscriptions, queuedSub);
				Singleton.sock.removeEventListener("message", queuedSub);
			}
		}).bind(this);
		this._queuedSubscriptions.push(queuedSub);
		Singleton.sock.addEventListener("message", queuedSub);
	} else {
		listenTo.call(this, frequency, handlers);
	}
}

/**
* @name listenTo
* @desc Helper function to subscribe the implementing object to a `Frequency` with listener callbacks
* @param {object} frequency - The `ClientNexus.Frequency` to being listened to
* @param {object} handlers - a hash of callbacks for Frequency's lifecycle events
* @param {onConnection} handlers.onConnection
* @param {onMessage} handlers.onMessage
* @param {onClose} handlers.onClose
*/
function listenTo(frequency, handlers) {
	var topic = frequency.topic;

	handlers.subject = this;
	if (!this._nexusSubscriptions[topic]) {
		var token = frequency.addListener.call(frequency, handlers);
		this._nexusTokens.push(frequency.removeSubscriber.bind(frequency, token));
	}
}

exports['default'] = ClientNexus;
module.exports = exports['default'];