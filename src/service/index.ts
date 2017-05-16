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

function diceRoll() {
	const coinFlip = () => (Math.random() < 0.5) ? 1 : 0;

	return coinFlip() + coinFlip() + coinFlip() + coinFlip();
}

const actionMappers = {
	roll(data) {
		return { type: 'setDiceRolls', roll: diceRoll() };
	},

	addPiece(data) {
		return data;
	},

	movePiece(data) {
		return data;
	},

	pass(data) {
		return data;
	}
};

client.rpc.provide('performAction', ({ userId, gameId, action }, res) => {
	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.whenReady(() => {
		try {
			const state = stateRecord.get();

			assert.strictEqual(state.state, 'playing');

			if(state.players[state.gameState.currentPlayer] !== userId) {
				throw new Error(`It is not that player's turn`);
			}

			const gameAction = actionMappers[action.type](action);

			const newGameState = game.reducer(state.gameState, gameAction);

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
