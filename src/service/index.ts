import assert = require('assert');
import deepstream = require('deepstream.io-client-js');
import game = require('../game');

let clientData;

const client = deepstream(process.env.DEEPSTREAM_BACKEND_URL).login({
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
		gameState: game.initialState,
		winner: null
	});

	stateRecord.discard();

	res.send({ gameId });
});

client.rpc.provide('acceptGame', ({ userId, gameId }, res) => {
	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.whenReady(() => {
		try {
			stateRecord.set('players[1]', userId);
			stateRecord.set('state', 'playing');

			stateRecord.discard();

			const state = stateRecord.get();

			res.send({ gameId });

			const currentUserId = state.players[state.currentPlayer];

			client.event.emit(`game/${gameId}/players-turn/${currentUserId}`, {});
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

function diceRoll() {
	const coinFlip = () => (Math.random() < 0.5) ? 1 : 0;

	return coinFlip() + coinFlip() + coinFlip() + coinFlip();
}

const userActionMappers = {
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

client.rpc.provide('performAction', ({ userId, gameId, userAction }, res) => {
	const stateRecord = client.record.getRecord(`game/${gameId}`);

	stateRecord.whenReady(() => {
		try {
			const state = stateRecord.get();

			assert.strictEqual(state.state, 'playing',
				'This game is either not ready to be played yet, or already finished');

			assert.strictEqual(state.players[state.gameState.currentPlayer], userId,
				`It is not that player's turn`);

			const action = userActionMappers[userAction.type](userAction);

			const newGameState = game.reducer(state.gameState, action);

			const [gameOver, winner] = game.hasWinner(newGameState);

			if(gameOver) {
				client.event.emit(`game/${gameId}/game-over`, {});
			}
			else if(newGameState.currentPlayer !== state.gameState.currentPlayer) {
				const currentUserId = state.players[newGameState.currentPlayer];

				client.event.emit(`game/${gameId}/players-turn/${currentUserId}`, {});
			}

			stateRecord.set('gameState', newGameState);
			stateRecord.set('winner', winner);
			if(gameOver) {
				stateRecord.set('state', 'game-over');
			}
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

const userRegex = /^user\/user_(.+)$/;

client.presence.subscribe((username, isLoggedIn) => {
	if(!isLoggedIn) return;
	if(!userRegex.test(username)) return;

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
