const R = require('ramda');
const game = require('./lib/game');

const boardBase = `
+-+-+-+-+   +-+-+
| | | | |   | | |
+-+-+-+-+-+-+-+-+
| | | | | | | | |
+-+-+-+-+-+-+-+-+
| | | | |   | | |
+-+-+-+-+   +-+-+
`.trim().split(/\n/).map(s => s.split(''));

function positionTo2dPosition(position, player) {
	const y = (player === 0) ? 1 : -1;

	if(position < 4) { return { x: 3 - position, y: y }; }
	if(position >= 4 && position <= 11) { return { x: position - 4, y: 0 }; }
	if(position > 11) { return { x: 19 - position, y: y }; }
}

function renderBoard(state) {
	const board = R.clone(boardBase);

	for(let i = 0; i < state.players.length; i++) {
		const symbol = (i === 0) ? 'O' : 'X';

		for(const piece of state.players[i].fieldedPieces) {
			const { x, y } = positionTo2dPosition(piece.position, i);

			board[1+(y+1)*2][1+x*2] = symbol;
		}
	}

	return board.map(a => a.join('')).join('\n');
}

function render(state) {
	const player1 = state.players[0];
	const player2 = state.players[1];

	return `
PLAYER #2 (won pieces: ${player2.wonPieces}) (remaining pieces: ${player2.outOfPlayPieces})

${renderBoard(state)}

PLAYER #1 (won pieces: ${player1.wonPieces}) (remaining pieces: ${player1.outOfPlayPieces})

Player #${state.currentPlayer+1}'s turn!!
Last roll: ${state.lastRoll}
`.trim();
}

function positionToIndex(state, player, position) {
	return R.findIndex(R.propEq('position', position), state.players[player].fieldedPieces);
}

function toAction(argv, state) {
	if(argv[0] === 'roll') {
		return { type: 'setDiceRolls', roll: Math.floor(Math.random() * 5) };
	}
	else if(argv[0] === 'add') {
		return { type: 'addPiece' };
	}
	else if(argv[0] === 'move') {
		return { type: 'movePiece', index: positionToIndex(state, state.currentPlayer, Number(argv[1])) };
	}
	else if(argv[0] === 'pass') {
		return { type: 'pass' };
	}
}

const fs = require('fs');

if(process.argv[2] === 'init') {
	fs.writeFileSync('state.json', JSON.stringify(game.initialState, null, '\t'));
}
else if(process.argv[2] === 'print') {
	const state = JSON.parse(fs.readFileSync('state.json'));

	console.log(render(state));
}
else {
	const state = JSON.parse(fs.readFileSync('state.json'));

	const action = toAction(process.argv.slice(2), state);

	const newState = game.reducer(state, action);

	console.log(render(newState));

	fs.writeFileSync('state.json', JSON.stringify(newState, null, '\t'));
}
