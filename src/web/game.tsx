import React = require('react');
import R = require('ramda');

function positionTo2dPosition(position: number, player: number) {
	const y = (player === 0) ? 1 : -1;

	if(position < 4) { return { x: 3 - position, y: y }; }
	if(position >= 4 && position <= 11) { return { x: position - 4, y: 0 }; }
	if(position > 11) { return { x: 19 - position, y: y }; }

	return null;
}

function screenCoords(position: number, player: number) {
	const coords = positionTo2dPosition(position, player);

	if(coords == null) return null;

	const { x, y } = coords;

	return { x: 74*x + 40, y: 74*(y+1) + 51 };
}

type Piece = { position: number };

function GameBoard(props: { piecesPerPlayer: Piece[][], onPieceClick: (player: number, piece: number) => void }) {
	const { piecesPerPlayer, onPieceClick } = props;

	const pieceMapper = player => (piece: Piece, index) => {
		const coords = screenCoords(piece.position, player);

		if(coords == null) return null;

		const { x, y } = coords;

		return <div
			className={['piece', `player-${player+1}`].join(' ')}
			style={{ top: y, left: x }}
			onClick={() => onPieceClick(player, index)}>
		</div>;
	};

	return <div className='board'>
		{piecesPerPlayer.map((pieces, player) => {
			return pieces.map(pieceMapper(player));
		})}
	</div>;
}

function PlayerInfo({ playerIndex, playerState, userInfo }) {
	return <div className={`player-info player-${playerIndex+1}`}>
		<p>Player #{ playerIndex+1 } ({ userInfo.name })</p>
		<ul>
			<li>{ playerState.wonPieces } won pieces</li>
			<li>{ playerState.outOfPlayPieces } addable pieces</li>
		</ul>
	</div>;
}

function StatusText({ gameOver, game, winner, userInfos }) {
	const statusTextClasses = [
		'status-text',
		gameOver ? 'game-over' : 'current-player',
		gameOver ? `player-${winner+1}` : `player-${game.currentPlayer+1}`
	].join(' ');

	const statusText = gameOver ?
		`${ userInfos[winner].name } won!!!!!` :
		`${ userInfos[game.currentPlayer].name }'s turn!!`;

	return <p className={statusTextClasses}>{statusText}</p>;
}

export function Game({ ownPlayer, spectating = false, game, userInfos, gameOver, winner, onAction }) {
	if(game == null) { return <p>No game here, create a new one or something!</p>; }

	const onRoll = () => onAction({ type: 'roll' });
	const onAdd = () => onAction({ type: 'addPiece' });
	const onMove = (player, index) => (player == ownPlayer) && onAction({ type: 'movePiece', index });
	const onPass = () => onAction({ type: 'pass' });

	const piecesPerPlayer = game.players.map(player => player.fieldedPieces);

	const isOurTurn = gameOver || (game.currentPlayer === ownPlayer);

	return <div>
		<p>{ userInfos[0].name } vs { userInfos[1].name }!!</p>

		<PlayerInfo playerIndex={1} playerState={game.players[1]} userInfo={userInfos[1]} />

		<GameBoard piecesPerPlayer={piecesPerPlayer} onPieceClick={onMove} />

		<PlayerInfo playerIndex={0} playerState={game.players[0]} userInfo={userInfos[0]} />

		<StatusText {...{ gameOver, game, winner, userInfos }} />
		{spectating ? null : [
			<button onClick={onRoll} disabled={!isOurTurn}>Roll</button>,
			<button onClick={onAdd} disabled={!isOurTurn}>Add piece</button>,
			<button onClick={onPass} disabled={!isOurTurn}>Pass</button>
		]}
		<p>Last dice roll: {game.lastRoll}</p>
	</div>;
}
