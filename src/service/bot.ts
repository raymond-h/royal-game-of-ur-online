import deepstream = require('deepstream.io-client-js');
import game = require('../game');
import bot = require('../game/bot');
import Rx = require('rxjs/Rx');
import R = require('ramda');

let clientData;

const client = deepstream(process.env.DEEPSTREAM_BACKEND_URL).login({
	internalService: true,
	internalToken: process.env.INTERNAL_SERVICE_TOKEN
}, (success, data) => {
	clientData = data;
});

client.on('error', (err, ev, topic) => {
	console.error('# Deepstream error');
	console.error(err, ev, topic);
});

const botGamesRecord = client.record.getList('bot/games-queue');

botGamesRecord.on('entry-added', onNewGame);
botGamesRecord.whenReady(() =>
	botGamesRecord.getEntries().forEach(onNewGame)
);

function fromDsRecord<T>(
	client: deepstreamIO.Client,
	recordName: string,
	triggerImmediately: boolean): Rx.Observable<T> {

	return Rx.Observable.fromEventPattern(
		handler => {
			const record = client.record.getRecord(recordName);
			record.subscribe((handler as (data: any) => void), triggerImmediately);
			return record;
		},
		(handler, record: deepstreamIO.Record) => {
			record.unsubscribe((handler as (data: any) => void));
			record.discard();
		}
	);
}

function rpcCallAsync(client: deepstreamIO.Client, rpcName: string, params: any): Promise<any> {
	return new Promise((resolve, reject) => {
		client.rpc.make(rpcName, params, (err, result) => {
			if(err) return reject(new Error(err));

			resolve(result);
		});
	});
}

function onNewGame(gameId) {
	console.log('Handling game:', gameId);

	const stateRecordObs =
		fromDsRecord<{ gameState: game.State, players: [string, string] }>(client, `game/${gameId}`, true)
		.share();

	stateRecordObs
		.takeUntil(
			stateRecordObs
			.filter(state => {
				const [gameOver, winner] = game.hasWinner(state.gameState);

				return gameOver;
			})
		)
		.debounceTime(1000)
		.filter(state => {
			return state.players[state.gameState.currentPlayer] == 'bot';
		})
		.map(state => bot.nextMove(state.gameState))
		.mergeMap(move =>
			rpcCallAsync(client, 'performAction', { userId: 'bot', gameId, userAction: move })
		)
		.finally(() => {
			console.log(`Done with game with ID ${gameId}`);
			botGamesRecord.removeEntry(gameId);
		})
		.subscribe({
			error(err) {
				console.error(`# Error while doing bot logic for game with ID '${gameId}'`);
				console.error(err.stack);
			}
		});
}
