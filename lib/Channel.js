"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

function Channel(topic, eventStream) {
	var _this = this;

	this.topic = topic;
	this.stream = eventStream;
	this.subscribers = {};
	this.__is_reflux_nexus_channel__ = true;

	this.stream.onmessage = function (msg) {
		Promise.all(_this.subscribers.reduce(function (accum, sub) {
			accum.push(new Promise(function (resolve, reject) {
				sub.onMessage && sub.onMessage.apply(sub.listener, [JSON.parse(msg.data)]);
				resolve();
			}));
			return accum;
		}, []));
	};

	this.stream.onclose = function () {
		Promise.all(_this.subscribers.reduce(function (accum, sub) {
			accum.push(new Promise(function (resolve, reject) {
				sub.onClose && sub.onClose.apply(sub.listener);
				resolve();
			}));
			return accum;
		}, []));
	};
}

Channel.prototype = {

	/**
 * @name addListener
 * @desc Add a handler to a Channel socket's `onmessage` event
 * @method
 * @memberof Channel
 * @param {object} subscriber
 * @param {function} subscriber.handler
 * @param {object} subscriber.listener
 * @returns {string} token - unique identifier for the registered subscriber
 */
	addListener: function addListener(subscriber) {
		var token = uniqId();
		this.subscribers[token] = subscriber;
		return token;
	},

	/**
 * @name removeListener
 * @method
 * @desc Remove a handler from a Channel socket's `onmessage` event
 * @memberof Channel
 * @param {string} token
 */
	removeListener: function removeListener(token) {
		this.subscribers[token] = null;
	}
};

exports["default"] = Channel;
module.exports = exports["default"];