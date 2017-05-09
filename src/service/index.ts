import assert = require('assert');
import deepstream = require('deepstream.io-client-js');
import game = require('../game');

let clientData;

const client = deepstream(process.env.DEEPSTREAM_URL).login({
	internalService: true,
	internalToken: process.env.INTERNAL_SERVICE_TOKEN
}, (success, data) => {
	clientData = data;
});

client.rpc.provide('newGame', ({ userId }, res) => {
	const gameId = client.getUid();

	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.set({
		state: 'awaitingOpponent',
		players: [userId, null],
		gameState: game.initialState
	});

	stateRecord.discard();

	res.send({ gameId });
});

client.rpc.provide('acceptGame', ({ userId, gameId }, res) => {
	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.set('players[1]', userId);
	stateRecord.set('state', 'playing');

	stateRecord.discard();

	res.send({ gameId });
});

client.rpc.provide('performAction', ({ userId, gameId, action }, res) => {
	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.whenReady(() => {
		try {
			const state = stateRecord.get();

			assert.strictEqual(state.state, 'playing');

			if(state.players[state.gameState.currentPlayer] !== userId) {
				throw new Error(`It is not that player's turn`);
			}

			const newGameState = game.reducer(state.gameState, action);

			stateRecord.set('gameState', newGameState);
			res.send('ok');
		}
		catch(e) {
			console.error(e.stack);
			res.error(e.message);
		}
		finally {
			stateRecord.discard();
		}
	});
});

client.presence.subscribe((username, isLoggedIn) => {
	if(!isLoggedIn) return;

	const userInfoRecord = client.record.getRecord(`user/${username}`);

	userInfoRecord.whenReady(() => {
		try {
			userInfoRecord.set('name', userInfoRecord.get('name') || 'some-random-name');
		}
		finally {
			userInfoRecord.discard();
		}
	});
});
