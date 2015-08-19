"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _vendorLodash_customJs = require('../vendor/lodash_custom.js');

var uniqId = function uniqId() {
	return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1).toUpperCase();
};

function Frequency(topic, nexus) {
	this.topic = topic;
	this.socket = nexus.sock;
	this.subscribers = {};
	this.__is_reflux_nexus_frequency__ = true;
	nexus.connected.then(this.open.bind(this));
}

Frequency.prototype = {

	open: function open() {
		var _this = this;

		this.socket.send(["sub", this.topic].join(","));
		setTimeout(function () {
			return _this.broadcast("open");
		}, 0);
	},

	close: function close() {
		var _this2 = this;

		this.socket.send(["uns", this.topic].join(","));
		setTimeout(function () {
			return _this2.broadcast("close");
		}, 0);
	},

	broadcast: function broadcast(eventType) {
		var handler = "on" + eventType;
		var args = [].slice.call(arguments, 1);
		if (this[handler]) this[handler].apply(this, args);
	},

	onmessage: function onmessage(msg) {
		Promise.all((0, _vendorLodash_customJs.map)(this.subscribers, function (sub) {
			return new Promise(function (resolve, reject) {
				sub.onMessage && sub.onMessage.apply(sub.listener, [JSON.parse(msg.data)]);
				resolve();
			});
		}));
	},

	onclose: function onclose() {
		Promise.all((0, _vendorLodash_customJs.map)(this.subscribers, function (sub) {
			return new Promise(function (resolve, reject) {
				sub.onClose && sub.onClose.apply(sub.listener);
				resolve();
			});
		}));
	},

	/**
 * @name addSubscriber
 * @desc Add a handler for Frequency's `onmessage` event
 * @method
 * @memberof Frequency
 * @param {object} subscriber
 * @param {function} subscriber.handler
 * @param {object} subscriber.listener
 * @returns {string} token - unique identifier for the registered subscriber
 */
	addSubscriber: function addSubscriber(subscriber) {
		var token = uniqId();
		this.subscribers[token] = subscriber;
		return token;
	},

	/**
 * @name removeSubscriber
 * @method
 * @desc Remove a handler from Frequency's `onmessage` event
 * @memberof Frequency
 * @param {string} token - the subscriber's unique identifier returned from `addSubscriber`
 */
	removeSubscriber: function removeSubscriber(token) {
		this.subscribers[token] = null;
	}
};

exports["default"] = Frequency;
module.exports = exports["default"];