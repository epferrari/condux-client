import {map,reduce} from '../vendor/lodash_custom.js';


function Channel(topic,eventStream){
	this.topic = topic;
	this.stream = eventStream;
	this.subscribers = {};
	this.__is_reflux_nexus_channel__ = true;

	this.stream.onmessage = (msg) => {
		Promise.all(map(this.subscribers, sub => {
			return new Promise(function(resolve,reject){
				sub.onMessage && sub.onMessage.apply(sub.listener,[JSON.parse(msg.data)]);
				resolve();
			});
		}));
	};

	this.stream.onclose = () => {
		Promise.all(map(this.subscribers, sub => {
			return new Promise(function(resolve,reject){
				sub.onClose && sub.onClose.apply(sub.listener);
				resolve();
			});
		}));
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
	addListener(subscriber){
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
	removeListener (token){
		this.subscribers[token] = null;
	}
};

export default Channel;
