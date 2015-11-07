# Condux Client

A client-side companion to [condux](https://github.com/epferrari/condux), an over-the-wire unidirectional data-flow architecture utilizing Reflux as the flux pattern implementation and SockJS as the websocket implementation.

Tap into readonly streams of data ([Frequencies](#Frequency)) broadcast by the Condux server, or call actions that can be listened to by datastores on the server. Create actions Reflux-like actions with `<ConduxClient>.createAction` and `<ConduxClient>.createActions` to interact with your server stores.

All actions are transmitted to the Condux server via a main `CLIENT_ACTIONS` channel,
ensuring the Condux server dispatch can perform its delegation in a reactive, unidirectional pattern.


### Installation

	npm install condux-client --save


### API

